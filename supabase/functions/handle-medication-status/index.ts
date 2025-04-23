import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Enhanced CORS headers with configurable origin
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // Cache preflight requests for 24 hours
};

// Define more comprehensive frequency constants with metadata for easier processing
const FREQUENCY = {
  DAILY: {
    id: 'daily',
    intervals: 1,
    hoursPerInterval: 24,
    description: 'Once per day'
  },
  TWICE_DAILY: {
    id: 'twice_daily',
    intervals: 2,
    hoursPerInterval: 12,
    description: 'Twice per day'
  },
  THRICE_DAILY: {
    id: 'thrice_daily',
    intervals: 3,
    hoursPerInterval: 8,
    description: 'Three times per day'
  },
  EVERY_HOUR: {
    id: 'every_hour',
    intervals: 24,
    hoursPerInterval: 1,
    description: 'Every hour'
  },
  SPECIFIC_TIMES: {
    id: 'specific_times',
    intervals: null, // Dynamic
    hoursPerInterval: null, // Dynamic
    description: 'At specific times'
  },
  EVERY_X_HOURS: {
    id: 'every_x_hours',
    intervals: null, // Dynamic
    hoursPerInterval: null, // Set by x value
    description: 'Every x hours'
  },
  WEEKLY: {
    id: 'weekly',
    intervals: 1,
    hoursPerInterval: 168, // 24 * 7
    description: 'Once per week'
  },
  MONTHLY: {
    id: 'monthly',
    intervals: 1,
    hoursPerInterval: 720, // 24 * 30 (approx)
    description: 'Once per month'
  },
  CUSTOM: {
    id: 'custom',
    intervals: null, // Dynamic
    hoursPerInterval: null, // Dynamic
    description: 'Custom schedule'
  }
};

// Define log types for better tracking and analytics
const LOG_STATUS = {
  TAKEN: 'taken',
  MISSED: 'missed',
  SKIPPED: 'skipped',
  DELAYED: 'delayed'
};

// Define request schema validation
const RequestSchema = z.object({
  medicationId: z.string().uuid(),
  action: z.enum(['take', 'miss', 'skip', 'delay']),
  reason: z.string().optional(),
  delayDuration: z.number().positive().optional(),
  takenAt: z.string().datetime().optional(),
  quantity: z.number().positive().optional()
});

// Define medication item schema for cleaner type checking
type MedicationItem = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  frequency_value?: number;
  user_id: string;
  instructions?: string;
  medication_schedules: Array<{
    id: string;
    medication_id: string;
    scheduled_time: string;
    day_of_week?: number;
    taken: boolean;
    missed_doses: boolean;
    skipped: boolean;
    next_reminder_at?: string;
    last_taken_at?: string;
  }>;
  medication_inventory?: Array<{
    id: string;
    medication_id: string;
    current_quantity: number;
    unit: string;
    refill_threshold?: number;
    dose_amount: number;
    last_updated: string;
    pharmacy_info?: string;
    prescription_details?: string;
    refill_reminder_sent?: boolean;
    last_refill_date?: string;
  }>;
};

// Initialize Supabase client once at the module level
const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Custom error class for better error handling
class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// Main request handler
serve(async (req) => {
  // Handle preflight requests for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Only allow POST methods
    if (req.method !== "POST") {
      throw new ApiError('Method not allowed', 405);
    }
    
    const supabase = createSupabaseClient();
    
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
      RequestSchema.parse(requestBody);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ApiError(`Invalid request: ${e.errors.map(err => `${err.path}: ${err.message}`).join(', ')}`, 400);
      }
      throw new ApiError('Invalid JSON in request body', 400);
    }
    
    const { medicationId, action, reason, delayDuration, takenAt, quantity } = requestBody;

    // Get medication and related data
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select(`
        *,
        medication_schedules (*),
        medication_inventory (*)
      `)
      .eq('id', medicationId)
      .single();

    if (medError) {
      throw new ApiError(`Medication not found: ${medError.message}`, 404);
    }

    const typedMedication = medication as MedicationItem;
    
    // Get the current user for permissions check
    const { data: { user } } = await supabase.auth.getUser();
    
    // Security check to ensure the user can only access their own medications
    if (user && user.id !== typedMedication.user_id) {
      throw new ApiError('Unauthorized access to medication', 403);
    }

    const now = takenAt ? new Date(takenAt) : new Date();
    const nextReminderTime = calculateNextReminder(typedMedication, now);
    
    // Create a medication log entry with more details
    const logData = createMedicationLog(typedMedication, action, reason, now, quantity);
    
    // Execute all database operations in parallel for efficiency
    const [logResult, scheduleResult, inventoryResult, notificationResult] = await Promise.allSettled([
      // Create medication log
      createMedicationLogEntry(supabase, logData),
      
      // Update medication schedule
      updateMedicationSchedule(supabase, typedMedication, action, now, nextReminderTime),
      
      // Update inventory if medication was taken
      action === 'take' ? updateMedicationInventory(supabase, typedMedication, quantity || 1, now) : Promise.resolve(null),
      
      // Send appropriate notifications
      sendNotifications(supabase, typedMedication, action, now)
    ]);

    // Process results and handle any errors
    const errors = [];
    if (logResult.status === 'rejected') errors.push(`Log error: ${logResult.reason.message}`);
    if (scheduleResult.status === 'rejected') errors.push(`Schedule error: ${scheduleResult.reason.message}`);
    if (action === 'take' && inventoryResult.status === 'rejected') errors.push(`Inventory error: ${inventoryResult.reason.message}`);
    
    // Log notification errors but don't fail the request
    if (notificationResult.status === 'rejected') {
      console.error("Notification error:", notificationResult.reason);
    }

    if (errors.length > 0) {
      throw new ApiError(`Partial failure: ${errors.join('; ')}`, 500);
    }

    // Determine status of inventory for frontend notifications
    let inventoryStatus = null;
    if (action === 'take' && typedMedication.medication_inventory?.[0]) {
      const inventory = typedMedication.medication_inventory[0];
      const doseAmount = quantity || inventory.dose_amount || 1;
      const newQuantity = Math.max(0, inventory.current_quantity - doseAmount);
      
      if (newQuantity === 0) {
        inventoryStatus = 'depleted';
      } else if (inventory.refill_threshold && newQuantity <= inventory.refill_threshold) {
        inventoryStatus = 'below_threshold';
      }
    }

    // Return success response with helpful data
    return new Response(
      JSON.stringify({ 
        success: true, 
        nextReminder: nextReminderTime.toISOString(),
        actionTaken: action,
        medicationName: typedMedication.name,
        processedAt: now.toISOString(),
        inventoryStatus
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in handle-medication-status:", error);
    
    // Determine appropriate status code and message
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});

/**
 * Calculate the next reminder time based on medication frequency
 */
function calculateNextReminder(medication: MedicationItem, now: Date): Date {
  // Start with current time as base
  const nextReminderTime = new Date(now.getTime());
  
  const frequency = medication.frequency;
  
  // Handle specific times scheduling
  if (frequency === FREQUENCY.SPECIFIC_TIMES.id || frequency === FREQUENCY.CUSTOM.id) {
    return calculateNextSpecificTime(medication, now);
  }
  
  // Handle dynamic "every_X_hours" frequency
  if (frequency.startsWith('every_')) {
    const hours = parseInt(frequency.split('_')[1]);
    if (!isNaN(hours)) {
      nextReminderTime.setHours(nextReminderTime.getHours() + hours);
      return nextReminderTime;
    }
  }
  
  // Handle standard frequencies
  const frequencyKey = Object.keys(FREQUENCY).find(key => FREQUENCY[key].id === frequency);
  if (frequencyKey) {
    const hoursToAdd = FREQUENCY[frequencyKey].hoursPerInterval;
    if (hoursToAdd) {
      nextReminderTime.setHours(nextReminderTime.getHours() + hoursToAdd);
    }
  } else {
    // Default to daily if frequency not recognized
    nextReminderTime.setHours(nextReminderTime.getHours() + 24);
  }
  
  return nextReminderTime;
}

/**
 * Calculate next specific time from a list of scheduled times
 */
function calculateNextSpecificTime(medication: MedicationItem, now: Date): Date {
  const schedules = medication.medication_schedules;
  
  if (!schedules || schedules.length === 0) {
    // Fallback to daily if no schedules defined
    const tomorrow = new Date(now.getTime());
    tomorrow.setHours(tomorrow.getHours() + 24);
    return tomorrow;
  }
  
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Map scheduled times to actual Date objects
  let scheduleTimes = schedules.map(s => {
    try {
      // Handle day-specific schedules for custom frequencies
      if (s.day_of_week !== undefined) {
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
        const daysUntilScheduled = (s.day_of_week - currentDay + 7) % 7;
        
        const scheduleDate = new Date(now);
        scheduleDate.setDate(scheduleDate.getDate() + daysUntilScheduled);
        
        const [hours, minutes] = s.scheduled_time.split(':');
        scheduleDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // If it's the same day but time has passed, move to next week
        if (daysUntilScheduled === 0 && scheduleDate <= now) {
          scheduleDate.setDate(scheduleDate.getDate() + 7);
        }
        
        return {
          originalSchedule: s,
          date: scheduleDate,
          dayOfWeek: s.day_of_week
        };
      }
      
      // Handle time-based schedules
      const [hours, minutes] = s.scheduled_time.split(':');
      
      // Create today's scheduled time
      const todaySchedule = new Date(`${todayStr}T${s.scheduled_time}`);
      // If today's time has passed, use tomorrow's time
      if (todaySchedule <= now) {
        return {
          originalSchedule: s,
          date: new Date(`${tomorrowStr}T${s.scheduled_time}`)
        };
      }
      
      return {
        originalSchedule: s,
        date: todaySchedule
      };
    } catch (e) {
      console.error(`Error parsing schedule time: ${s.scheduled_time}`, e);
      // Return a fallback schedule 24 hours from now
      const fallback = new Date(now);
      fallback.setHours(fallback.getHours() + 24);
      return {
        originalSchedule: s,
        date: fallback
      };
    }
  });
  
  // Sort by time
  scheduleTimes.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Find the next scheduled time after now
  const nextSchedule = scheduleTimes.find(s => s.date > now);
  
  if (nextSchedule) {
    return nextSchedule.date;
  } else if (scheduleTimes.length > 0) {
    // If no future times, use the first time (which will be tomorrow or next week)
    return scheduleTimes[0].date;
  }
  
  // Fallback if something went wrong: 24 hours from now
  const fallback = new Date(now);
  fallback.setHours(fallback.getHours() + 24);
  return fallback;
}

/**
 * Create comprehensive medication log entry
 */
function createMedicationLog(medication: MedicationItem, action: string, reason: string | null, timestamp: Date, quantity?: number) {
  let status;
  switch(action) {
    case 'take': status = LOG_STATUS.TAKEN; break;
    case 'miss': status = LOG_STATUS.MISSED; break;
    case 'skip': status = LOG_STATUS.SKIPPED; break;
    case 'delay': status = LOG_STATUS.DELAYED; break;
    default: status = LOG_STATUS.TAKEN;
  }
  
  return {
    medication_id: medication.id,
    user_id: medication.user_id, // Add user ID for easier querying
    scheduled_time: timestamp.toISOString(),
    status: status,
    taken_at: action === 'take' ? timestamp.toISOString() : null,
    reason: reason || null,
    dosage_taken: action === 'take' ? (quantity || 1) : null,
    dosage_unit: medication.medication_inventory?.[0]?.unit || null,
    medication_name: medication.name, // Denormalize for easier reporting
    notes: action === 'delay' ? `Delayed by user request` : null
  };
}

/**
 * Create medication log entry in database
 */
async function createMedicationLogEntry(supabase, logData) {
  const { error } = await supabase
    .from('medication_logs')
    .insert(logData);
    
  if (error) {
    console.error("Error creating medication log:", error);
    throw new Error(`Failed to create medication log: ${error.message}`);
  }
  
  return true;
}

/**
 * Update medication schedule with new status
 */
async function updateMedicationSchedule(supabase, medication: MedicationItem, action: string, timestamp: Date, nextReminderTime: Date) {
  // Find the relevant schedule to update
  const schedules = medication.medication_schedules;
  
  // If there are multiple schedules, find the most relevant one
  // This handles specific times scheduling better than the original
  let scheduleId = null;
  
  if (schedules && schedules.length > 0) {
    if (schedules.length === 1) {
      // Single schedule case
      scheduleId = schedules[0].id;
    } else {
      // Multiple schedules - find the closest one
      const now = timestamp.getTime();
      
      let closestSchedule = schedules[0];
      let closestDiff = Infinity;
      
      for (const schedule of schedules) {
        try {
          const scheduleTime = new Date(`${timestamp.toDateString()} ${schedule.scheduled_time}`).getTime();
          const diff = Math.abs(scheduleTime - now);
          
          if (diff < closestDiff) {
            closestDiff = diff;
            closestSchedule = schedule;
          }
        } catch (e) {
          console.error(`Error parsing schedule time: ${schedule.scheduled_time}`, e);
        }
      }
      
      scheduleId = closestSchedule.id;
    }
  }
  
  // Prepare update data
  const updateData = {
    next_reminder_at: nextReminderTime.toISOString(),
    last_updated: timestamp.toISOString()
  };
  
  // Add action-specific updates
  switch (action) {
    case 'take':
      updateData.taken = true;
      updateData.missed_doses = false;
      updateData.skipped = false;
      updateData.last_taken_at = timestamp.toISOString();
      break;
    case 'miss':
      updateData.taken = false;
      updateData.missed_doses = true;
      updateData.skipped = false;
      break;
    case 'skip':
      updateData.taken = false;
      updateData.missed_doses = false;
      updateData.skipped = true;
      break;
    case 'delay':
      // Just update the next reminder time without marking as taken/missed/skipped
      break;
  }
  
  // Update the specific schedule if found, otherwise update all schedules
  let query = supabase.from('medication_schedules').update(updateData);
  
  if (scheduleId) {
    query = query.eq('id', scheduleId);
  } else {
    query = query.eq('medication_id', medication.id);
  }
  
  const { error } = await query;
  
  if (error) {
    console.error("Error updating medication schedule:", error);
    throw new Error(`Failed to update medication schedule: ${error.message}`);
  }
  
  return true;
}

/**
 * Update medication inventory when medication is taken
 */
async function updateMedicationInventory(supabase, medication: MedicationItem, quantityTaken: number, timestamp: Date) {
  if (!medication.medication_inventory || medication.medication_inventory.length === 0) {
    return null; // No inventory to update
  }
  
  const inventory = medication.medication_inventory[0];
  if (inventory.current_quantity === null) {
    return null; // Quantity not tracked
  }
  
  // Calculate new quantity
  const doseAmount = quantityTaken * (inventory.dose_amount || 1);
  const newQuantity = Math.max(0, inventory.current_quantity - doseAmount);
  
  // Check if this is the last dose
  const isLastDose = newQuantity === 0;
  
  // Check if below threshold
  const isBelowThreshold = inventory.refill_threshold && newQuantity <= inventory.refill_threshold;
  
  // Update inventory
  const { error } = await supabase
    .from('medication_inventory')
    .update({ 
      current_quantity: newQuantity,
      last_updated: timestamp.toISOString(),
      refill_reminder_sent: isBelowThreshold ? true : inventory.refill_reminder_sent
    })
    .eq('id', inventory.id);
    
  if (error) {
    console.error("Error updating inventory:", error);
    throw new Error(`Failed to update medication inventory: ${error.message}`);
  }
  
  // Send refill alerts if needed
  if (isBelowThreshold) {
    await sendRefillAlert(supabase, medication, newQuantity, isLastDose);
  }
  
  return {
    newQuantity,
    isBelowThreshold,
    isLastDose
  };
}

/**
 * Send all appropriate notifications based on action
 */
async function sendNotifications(supabase, medication: MedicationItem, action: string, timestamp: Date) {
  try {
    // Get user details for notifications
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email, phone_number, notification_preferences')
      .eq('id', medication.user_id)
      .single();
      
    if (userError || !userData) {
      throw new Error(`User not found: ${userError?.message || 'No user data'}`);
    }
    
    // Check notification preferences
    const preferences = userData.notification_preferences || {};
    
    // Determine which notifications to send
    switch(action) {
      case 'take':
        if (preferences.confirm_taken !== false) {
          await sendMedicationNotification(supabase, userData, medication, 'TAKEN', timestamp);
        }
        break;
      case 'miss':
        if (preferences.missed_dose !== false) {
          await sendMedicationNotification(supabase, userData, medication, 'MISSED', timestamp);
        }
        break;
      case 'skip':
        if (preferences.skipped_dose !== false) {
          await sendMedicationNotification(supabase, userData, medication, 'SKIPPED', timestamp);
        }
        break;
      case 'delay':
        if (preferences.delayed_dose !== false) {
          await sendMedicationNotification(supabase, userData, medication, 'DELAYED', timestamp);
        }
        break;
    }
    
    return true;
  } catch (error) {
    console.error("Error in send notifications:", error);
    throw error;
  }
}

/**
 * Send refill alert to user through appropriate channels
 */
async function sendRefillAlert(supabase, medication: MedicationItem, currentQuantity: number, isLastDose = false) {
  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('email, phone_number, notification_preferences, emergency_contact')
      .eq('id', medication.user_id)
      .single();
      
    if (!userData) return;
    
    // Check notification preferences
    const preferences = userData.notification_preferences || {};
    
    // Skip if user disabled refill alerts
    if (preferences.refill_alerts === false) return;
    
    // Determine severity of alert
    const alertType = isLastDose ? 'DEPLETED' : 'LOW_STOCK';
    
    // Send email notification
    if (userData.email) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          email: userData.email,
          medication: medication.name,
          dosage: medication.dosage,
          currentQuantity: currentQuantity,
          isLowStockAlert: true,
          alertType,
          phoneNumber: userData?.phone_number,
          pharmacyInfo: medication.medication_inventory?.[0]?.pharmacy_info
        }),
      });
    }
    
    // If it's the last dose and emergency contact is enabled, also notify emergency contact
    if (isLastDose && preferences.notify_emergency_contact !== false && userData.emergency_contact) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          email: userData.emergency_contact.email,
          medication: medication.name,
          isEmergencyContact: true,
          patientName: userData.emergency_contact.patient_name || 'Your contact',
          medicationDepleted: true
        }),
      });
    }
    
    return true;
  } catch (alertError) {
    console.error("Error sending refill alert:", alertError);
    throw alertError;
  }
}

/**
 * Send medication status notification through appropriate channels
 */
async function sendMedicationNotification(supabase, userData, medication, notificationType, timestamp) {
  if (!userData.email) return;
  
  const formattedTime = new Intl.DateTimeFormat('en-US', { 
    hour: 'numeric', 
    minute: 'numeric',
    hour12: true 
  }).format(timestamp);
  
  const notificationData = {
    email: userData.email,
    medication: medication.name,
    dosage: medication.dosage,
    scheduledTime: formattedTime,
    notificationType: notificationType,
    phoneNumber: userData?.phone_number,
    instructions: medication.instructions
  };
  
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify(notificationData),
  });
}
