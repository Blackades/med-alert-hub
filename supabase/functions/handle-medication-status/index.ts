
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define frequency constants to match frontend
const FREQUENCY_OPTIONS = {
  DAILY: 'daily',
  TWICE_DAILY: 'twice_daily',
  THRICE_DAILY: 'thrice_daily',
  EVERY_HOUR: 'every_hour',
  SPECIFIC_TIMES: 'specific_times',
  EVERY_X_HOURS: 'every_x_hours',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { medicationId, action, reason } = await req.json();

    // Get medication and schedule details
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select(`
        *,
        medication_schedules (*)
      `)
      .eq('id', medicationId)
      .single();

    if (medError) throw medError;

    let nextReminderTime;
    const now = new Date();

    // Calculate next reminder based on frequency
    let intervalHours = getFrequencyHours(medication.frequency);
    
    // For specific times or custom schedules, we need special handling
    if (medication.frequency === FREQUENCY_OPTIONS.SPECIFIC_TIMES || 
        medication.frequency === FREQUENCY_OPTIONS.CUSTOM) {
      // Find the next scheduled time after now
      const schedules = medication.medication_schedules;
      
      if (schedules && schedules.length > 0) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Convert schedule times to Date objects for comparison
        const scheduleTimes = schedules.map(s => {
          const [hours, minutes] = s.scheduled_time.split(':');
          const scheduleDate = new Date(todayStr + 'T' + s.scheduled_time);
          return { 
            originalSchedule: s, 
            date: scheduleDate 
          };
        });
        
        // Sort by time
        scheduleTimes.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Find the next scheduled time after now
        const nextSchedule = scheduleTimes.find(s => s.date > now);
        
        if (nextSchedule) {
          nextReminderTime = nextSchedule.date;
        } else if (scheduleTimes.length > 0) {
          // If no future times today, use the first time tomorrow
          nextReminderTime = new Date(scheduleTimes[0].date);
          nextReminderTime.setDate(nextReminderTime.getDate() + 1);
        }
      }
    }
    
    // If we don't have a next reminder time from specific schedules,
    // calculate it based on interval
    if (!nextReminderTime) {
      nextReminderTime = new Date(now.getTime());
      nextReminderTime.setHours(nextReminderTime.getHours() + intervalHours);
    }

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Next reminder set for: ${nextReminderTime.toISOString()}`);
    console.log(`Frequency: ${medication.frequency}, Interval hours: ${intervalHours}`);

    // Create a medication log entry
    const logData = {
      medication_id: medicationId,
      scheduled_time: now.toISOString(),
      status: action === 'take' ? 'taken' : action === 'miss' ? 'missed' : 'skipped',
      taken_at: action === 'take' ? now.toISOString() : null,
      reason: reason || null
    };
    
    const { error: logError } = await supabase
      .from('medication_logs')
      .insert(logData);
      
    if (logError) {
      console.error("Error creating medication log:", logError);
    }

    // Update medication schedule
    const { error: updateError } = await supabase
      .from('medication_schedules')
      .update({
        taken: action === 'take',
        missed_doses: action === 'miss',
        skipped: action === 'skip',
        next_reminder_at: nextReminderTime.toISOString(),
        last_taken_at: action === 'take' ? now.toISOString() : null
      })
      .eq('medication_id', medicationId);

    if (updateError) throw updateError;

    // If medication was taken, send confirmation email
    if (action === 'take') {
      await sendNotification(supabase, medication, false);
    } else if (action === 'miss' || action === 'skip') {
      // Optionally send a missed/skipped notification
      await sendNotification(supabase, medication, false, action);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        nextReminder: nextReminderTime.toISOString() 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in handle-medication-status:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Helper function to calculate interval hours based on frequency
function getFrequencyHours(frequency: string): number {
  switch (frequency) {
    case 'daily':
      return 24;
    case 'twice_daily':
      return 12;
    case 'thrice_daily':
      return 8;
    case 'every_hour':
      return 1;
    case 'weekly':
      return 24 * 7; // One week
    case 'monthly':
      return 24 * 30; // Approximately one month
    default:
      // Try to parse custom frequency formats like "every_4"
      if (frequency.startsWith('every_')) {
        const hours = parseInt(frequency.split('_')[1]);
        if (!isNaN(hours)) {
          return hours;
        }
      }
      return 24; // Default fallback
  }
}

// Helper function to send notification email
async function sendNotification(supabase, medication, isReminder = false, action = 'take') {
  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', medication.user_id)
      .single();

    if (userData?.email) {
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
          scheduledTime: new Date().toLocaleTimeString(),
          isReminder: isReminder,
          action: action // Added this to indicate if the medication was taken, missed, or skipped
        }),
      });
    }
  } catch (emailError) {
    console.error("Error sending notification email:", emailError);
    // Don't throw the error, to avoid disrupting the main flow
  }
}
