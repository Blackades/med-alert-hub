import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const RESPONSE_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json"
};

// Alert timing configurations
const MINUTES_BEFORE_MEDICATION = 5; // Send alert 5 minutes before medication time
const MILLISECONDS_BEFORE_MEDICATION = MINUTES_BEFORE_MEDICATION * 60 * 1000;

// Medication status enum for better code readability
enum MedicationStatus {
  UPCOMING = 'upcoming',  // About to be due (5 minutes before)
  DUE = 'due',           // Currently due
  OVERDUE = 'overdue'    // Past due time
}

// Helper function to generate personalized alert messages based on medication details and status
function generateAlertMessage(medicationName: string, dosage: string, status: MedicationStatus): string {
  switch (status) {
    case MedicationStatus.UPCOMING:
      return `In 5 minutes: Please prepare to take ${dosage} of ${medicationName}`;
    case MedicationStatus.DUE:
      return `Time to take your ${dosage} of ${medicationName} now`;
    case MedicationStatus.OVERDUE:
      return `REMINDER: Your ${dosage} of ${medicationName} is overdue`;
    default:
      return `Please take your ${dosage} of ${medicationName}`;
  }
}

// Helper to format time in a user-friendly way
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (e) {
    console.error("Error formatting time:", e);
    return isoString;
  }
}

// Helper to determine medication status
function determineMedicationStatus(nextDoseTime: string): MedicationStatus {
  const now = new Date();
  const nextDose = new Date(nextDoseTime);
  
  if (nextDose > now) {
    return MedicationStatus.UPCOMING;
  } else if (nextDose.getTime() + 10 * 60000 > now.getTime()) {
    return MedicationStatus.DUE;
  } else {
    return MedicationStatus.OVERDUE;
  }
}

// Handle different HTTP methods
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle different routes
  if (path.endsWith('/notifications')) {
    return await handleNotifications(req);
  } else if (path.endsWith('/mark-taken')) {
    return await handleMarkTaken(req);
  } else {
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: 'Endpoint not found' 
    }), {
      headers: RESPONSE_HEADERS,
      status: 404,
    });
  }
}

// Handle medication notifications endpoint
async function handleNotifications(req: Request): Promise<Response> {
  try {
    const now = new Date();
    const notificationWindow = new Date(now.getTime() + MILLISECONDS_BEFORE_MEDICATION);
    
    // Query all active medication schedules that need alerts:
    // 1. Upcoming meds (due in 5 minutes from now)
    // 2. Currently due meds
    // 3. Overdue meds that haven't been marked as taken
    const { data: alertMeds, error: queryError } = await supabase
      .from('medication_schedules')
      .select(`
        id,
        scheduled_time,
        next_dose,
        medication_id,
        medications (
          id,
          name,
          dosage,
          frequency,
          instructions,
          user_id,
          icon,
          color
        ),
        users (
          id,
          display_name,
          notification_preferences
        )
      `)
      .eq('active', true) // Only fetch active medication schedules
      .or(`taken.eq.false,next_reminder_sent.lt.${now.toISOString()}`)
      .order('next_dose', { ascending: true });
      
    if (queryError) throw queryError;
    
    // Process and prepare notifications
    const processedNotifications = [];
    const updatePromises = [];
    
    if (alertMeds && alertMeds.length > 0) {
      for (const med of alertMeds) {
        const nextDose = new Date(med.next_dose);
        const status = determineMedicationStatus(med.next_dose);
        const shouldSendAlert = (
          // 5 minutes before medication time
          (nextDose.getTime() - now.getTime() <= MILLISECONDS_BEFORE_MEDICATION && 
           nextDose.getTime() > now.getTime()) ||
          // Currently due or overdue
          (nextDose.getTime() <= now.getTime())
        );
        
        if (shouldSendAlert) {
          // Prepare notification with personalized message
          const formattedDoseTime = formatTime(med.next_dose);
          const alertMessage = generateAlertMessage(
            med.medications.name, 
            med.medications.dosage,
            status
          );
          
          processedNotifications.push({
            id: med.id,
            medication_id: med.medication_id,
            medication_name: med.medications.name,
            dosage: med.medications.dosage,
            instructions: med.medications.instructions,
            scheduled_time: formattedDoseTime,
            due_at: med.next_dose,
            status: status,
            user_id: med.medications.user_id,
            message: alertMessage,
            icon: med.medications.icon || 'pill',
            color: med.medications.color || '#1E88E5',
            priority: status === MedicationStatus.OVERDUE ? 'high' : 'normal'
          });
          
          // Update last reminder sent timestamp in database
          updatePromises.push(
            supabase
              .from('medication_schedules')
              .update({ 
                last_reminder_sent: now.toISOString(),
                reminder_count: supabase.sql`reminder_count + 1`
              })
              .eq('id', med.id)
          );
        }
      }
      
      // Execute all database updates in parallel
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    }
    
    return new Response(JSON.stringify({ 
      status: 'success', 
      timestamp: now.toISOString(),
      notifications: processedNotifications 
    }), {
      headers: RESPONSE_HEADERS,
      status: 200,
    });
  } catch (error) {
    console.error("Error processing medication notifications:", error);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: error.message || 'An error occurred while processing medication notifications'
    }), {
      headers: RESPONSE_HEADERS,
      status: 500,
    });
  }
}

// Handle marking medication as taken
async function handleMarkTaken(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Method not allowed'
      }), {
        headers: RESPONSE_HEADERS,
        status: 405
      });
    }
    
    const requestData = await req.json();
    const { medication_schedule_id, taken_at } = requestData;
    
    if (!medication_schedule_id) {
      throw new Error('medication_schedule_id is required');
    }
    
    // Get the medication schedule to calculate next dose
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('id', medication_schedule_id)
      .single();
      
    if (scheduleError) throw scheduleError;
    if (!scheduleData) throw new Error('Medication schedule not found');
    
    const now = new Date();
    const takenTimestamp = taken_at ? new Date(taken_at) : now;
    
    // Calculate next dose based on frequency
    let nextDoseDate;
    switch (scheduleData.frequency_type) {
      case 'daily':
        nextDoseDate = new Date(scheduleData.scheduled_time);
        nextDoseDate.setDate(nextDoseDate.getDate() + 1);
        break;
      case 'weekly':
        nextDoseDate = new Date(scheduleData.scheduled_time);
        nextDoseDate.setDate(nextDoseDate.getDate() + 7);
        break;
      case 'monthly':
        nextDoseDate = new Date(scheduleData.scheduled_time);
        nextDoseDate.setMonth(nextDoseDate.getMonth() + 1);
        break;
      case 'custom':
        const hoursToAdd = scheduleData.frequency_hours || 24;
        nextDoseDate = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
        break;
      default:
        // Default to next day if frequency type is not recognized
        nextDoseDate = new Date(scheduleData.scheduled_time);
        nextDoseDate.setDate(nextDoseDate.getDate() + 1);
    }
    
    // Update the medication schedule with taken status and calculate next dose
    const { data: updateData, error: updateError } = await supabase
      .from('medication_schedules')
      .update({
        taken: true,
        taken_at: takenTimestamp.toISOString(),
        next_dose: nextDoseDate.toISOString(),
        reminder_count: 0, // Reset reminder count for next cycle
        last_reminder_sent: null // Reset last reminder sent
      })
      .eq('id', medication_schedule_id)
      .select();
      
    if (updateError) throw updateError;
    
    // Log medication adherence for tracking/analytics
    await supabase
      .from('medication_adherence_log')
      .insert({
        medication_schedule_id: medication_schedule_id,
        medication_id: scheduleData.medication_id,
        user_id: scheduleData.user_id,
        scheduled_time: scheduleData.scheduled_time,
        taken_time: takenTimestamp.toISOString(),
        delay_minutes: Math.round((takenTimestamp.getTime() - new Date(scheduleData.scheduled_time).getTime()) / 60000),
        on_time: (takenTimestamp.getTime() - new Date(scheduleData.scheduled_time).getTime()) <= 30 * 60 * 1000 // Within 30 minutes
      });
    
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Medication marked as taken',
      next_dose: nextDoseDate.toISOString(),
      data: updateData
    }), {
      headers: RESPONSE_HEADERS,
      status: 200
    });
  } catch (error) {
    console.error("Error marking medication as taken:", error);
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message || 'An error occurred while marking medication as taken'
    }), {
      headers: RESPONSE_HEADERS,
      status: 500
    });
  }
}

// Main server function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  
  try {
    return await handleRequest(req);
  } catch (error) {
    console.error("Unhandled error in edge function:", error);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: 'Internal server error'
    }), {
      headers: RESPONSE_HEADERS,
      status: 500,
    });
  }
});
