
// Following EdgeFunction best practices for schedule-next-dose
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, successResponse, errorResponse } from "./utils.ts";

// Configuration
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface ScheduleRequest {
  medicationId: string;
  currentDose: string; // ISO string timestamp
  frequency?: string; // Optional override for medication frequency
  skipNextDose?: boolean; // Flag to skip scheduling next dose
}

/**
 * Calculate next dose date based on frequency and current time
 */
function calculateNextDoseTime(
  currentTime: Date, 
  frequency: string, 
  originalScheduleTime: string
): Date {
  const hour = new Date(originalScheduleTime).getHours();
  const minute = new Date(originalScheduleTime).getMinutes();
  
  // Create base next dose date at the same time
  const nextDoseDate = new Date(currentTime);
  nextDoseDate.setHours(hour, minute, 0, 0);
  
  // If the calculated time is in the past, adjust forward based on frequency
  if (nextDoseDate <= currentTime) {
    switch (frequency) {
      case "daily":
        nextDoseDate.setDate(nextDoseDate.getDate() + 1);
        break;
      case "twice_daily":
        nextDoseDate.setHours(nextDoseDate.getHours() + 12);
        break;
      case "three_times_daily":
        nextDoseDate.setHours(nextDoseDate.getHours() + 8);
        break;
      case "four_times_daily":
        nextDoseDate.setHours(nextDoseDate.getHours() + 6);
        break;
      case "weekly":
        nextDoseDate.setDate(nextDoseDate.getDate() + 7);
        break;
      case "biweekly":
        nextDoseDate.setDate(nextDoseDate.getDate() + 14);
        break;
      case "monthly":
        nextDoseDate.setMonth(nextDoseDate.getMonth() + 1);
        break;
      default: // Default to daily if unknown frequency
        nextDoseDate.setDate(nextDoseDate.getDate() + 1);
    }
  }
  
  return nextDoseDate;
}

/**
 * Updates the medication schedule with the next dose time
 */
async function scheduleNextDose(request: ScheduleRequest) {
  try {
    // Get medication details including frequency
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('id, name, frequency, dosage, instructions')
      .eq('id', request.medicationId)
      .single();
    
    if (medError) throw new Error(`Failed to fetch medication: ${medError.message}`);
    if (!medication) throw new Error(`Medication not found: ${request.medicationId}`);
    
    // Skip scheduling next dose if flag is set
    if (request.skipNextDose) {
      return {
        medication,
        message: "Next dose scheduling skipped as requested",
        skipped: true
      };
    }
    
    // Get existing schedule entry
    const { data: schedules, error: scheduleError } = await supabase
      .from('medication_schedules')
      .select('id, scheduled_time, next_dose')
      .eq('medication_id', request.medicationId);
    
    if (scheduleError) throw new Error(`Failed to fetch schedule: ${scheduleError.message}`);
    if (!schedules || schedules.length === 0) {
      throw new Error(`No schedule found for medication: ${request.medicationId}`);
    }
    
    const currentTime = new Date(request.currentDose);
    const frequency = request.frequency || medication.frequency;
    
    // Process each schedule entry
    const updatePromises = schedules.map(async (schedule) => {
      const nextDoseTime = calculateNextDoseTime(
        currentTime,
        frequency,
        schedule.scheduled_time
      );
      
      // Calculate next reminder time (10 minutes before next dose)
      const nextReminderTime = new Date(nextDoseTime);
      nextReminderTime.setMinutes(nextReminderTime.getMinutes() - 10);
      
      // Update schedule with new next_dose time
      const { error: updateError } = await supabase
        .from('medication_schedules')
        .update({
          next_dose: nextDoseTime.toISOString(),
          next_reminder_at: nextReminderTime.toISOString(),
          last_taken_at: currentTime.toISOString(),
          taken: true,
          missed_doses: false
        })
        .eq('id', schedule.id);
      
      if (updateError) {
        throw new Error(`Failed to update schedule: ${updateError.message}`);
      }
      
      return {
        scheduleId: schedule.id,
        previousDose: schedule.next_dose,
        nextDose: nextDoseTime.toISOString(),
        nextReminder: nextReminderTime.toISOString()
      };
    });
    
    const results = await Promise.all(updatePromises);
    
    // Log medication dose in medication_logs table
    const { error: logError } = await supabase
      .from('medication_logs')
      .insert({
        medication_id: request.medicationId,
        medication_name: medication.name,
        scheduled_time: request.currentDose,
        status: 'taken',
        taken_at: currentTime.toISOString(),
        dosage_taken: parseFloat(medication.dosage) || null,
        user_id: (await supabase.from('medications').select('user_id').eq('id', request.medicationId).single()).data?.user_id
      });
    
    if (logError) {
      console.error(`Warning: Failed to log medication dose: ${logError.message}`);
    }
    
    // Update streak information
    const { data: streakData } = await supabase
      .from('medication_streaks')
      .select('id, current_streak, longest_streak')
      .eq('medication_id', request.medicationId)
      .maybeSingle();
      
    if (streakData) {
      // Update existing streak
      const newCurrentStreak = streakData.current_streak + 1;
      const newLongestStreak = Math.max(newCurrentStreak, streakData.longest_streak || 0);
      
      await supabase
        .from('medication_streaks')
        .update({
          current_streak: newCurrentStreak,
          longest_streak: newLongestStreak,
          last_taken_at: currentTime.toISOString(),
        })
        .eq('id', streakData.id)
        .catch(error => console.error(`Failed to update streak: ${error.message}`));
    } else {
      // Create new streak record
      await supabase
        .from('medication_streaks')
        .insert({
          medication_id: request.medicationId,
          user_id: (await supabase.from('medications').select('user_id').eq('id', request.medicationId).single()).data?.user_id,
          current_streak: 1,
          longest_streak: 1,
          last_taken_at: currentTime.toISOString()
        })
        .catch(error => console.error(`Failed to create streak: ${error.message}`));
    }
    
    // Update inventory if applicable
    try {
      const { data: inventory } = await supabase
        .from('medication_inventory')
        .select('id, current_quantity, dose_amount')
        .eq('medication_id', request.medicationId)
        .maybeSingle();
      
      if (inventory && inventory.current_quantity > 0) {
        const newQuantity = Math.max(0, inventory.current_quantity - (inventory.dose_amount || 1));
        
        await supabase
          .from('medication_inventory')
          .update({ current_quantity: newQuantity, last_updated: new Date().toISOString() })
          .eq('id', inventory.id);
          
        // Check if inventory is below threshold and create notification
        if (inventory.current_quantity > 0 && newQuantity <= (inventory.refill_threshold || 5)) {
          await supabase
            .from('notification_logs')
            .insert({
              medication_id: request.medicationId,
              notification_type: 'refill_needed',
              priority_level: 'medium',
              content: { 
                message: `Your ${medication.name} is running low. Current count: ${newQuantity}` 
              }
            })
            .catch(error => console.error(`Failed to create refill notification: ${error.message}`));
        }
      }
    } catch (error) {
      console.error(`Non-critical inventory update failed: ${error.message}`);
      // Non-critical error, continue execution
    }
    
    return {
      medication,
      scheduleUpdates: results,
      message: "Successfully scheduled next dose",
      nextDose: results[0]?.nextDose // For convenience, return the next dose time
    };
  } catch (error: any) {
    throw new Error(`Failed to schedule next dose: ${error.message}`);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestData: ScheduleRequest = await req.json();
    
    // Validate request
    if (!requestData.medicationId) {
      return errorResponse("Medication ID is required", 400);
    }
    
    if (!requestData.currentDose) {
      requestData.currentDose = new Date().toISOString();
    }

    // Schedule next dose
    const result = await scheduleNextDose(requestData);
    return successResponse(result);
  } catch (error: any) {
    console.error("Error in schedule-next-dose function:", error);
    return errorResponse(error.message);
  }
});
