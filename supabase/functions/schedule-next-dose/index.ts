
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

    const { medicationId, currentDose } = await req.json();

    // Get medication details
    const { data: medicationData, error: medicationError } = await supabase
      .from('medications')
      .select(`
        *,
        medication_schedules (*)
      `)
      .eq('id', medicationId)
      .single();

    if (medicationError) throw medicationError;

    // Log the medication details for debugging
    console.log("Medication data:", JSON.stringify(medicationData, null, 2));
    console.log("Medication frequency:", medicationData.frequency);

    // Calculate next reminder time based on frequency
    let nextReminderDate = new Date();
    const currentDoseDate = new Date(currentDose);
    
    // Default interval
    let intervalHours = 24;
    
    // Determine interval based on frequency
    if (medicationData.frequency === FREQUENCY_OPTIONS.DAILY) {
      intervalHours = 24;
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.TWICE_DAILY) {
      intervalHours = 12;
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.THRICE_DAILY) {
      intervalHours = 8;
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.EVERY_HOUR) {
      intervalHours = 1;
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.WEEKLY) {
      intervalHours = 24 * 7; // One week
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.MONTHLY) {
      intervalHours = 24 * 30; // Approximate month
    } else if (medicationData.frequency.startsWith('every_')) {
      // Parse custom hour interval (e.g., "every_4" for every 4 hours)
      const hours = parseInt(medicationData.frequency.split('_')[1]);
      if (!isNaN(hours)) {
        intervalHours = hours;
      }
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.SPECIFIC_TIMES) {
      // For specific times, find the next time slot after the current one
      const schedules = medicationData.medication_schedules;
      if (schedules && schedules.length > 0) {
        // Sort the schedules by time
        const sortedSchedules = [...schedules].sort((a, b) => {
          return a.scheduled_time.localeCompare(b.scheduled_time);
        });
        
        // Find the current schedule slot
        const currentSchedule = sortedSchedules.find(s => s.scheduled_time === medicationData.medication_schedules.find(ms => ms.id === medicationId)?.scheduled_time);
        const currentIndex = currentSchedule ? sortedSchedules.indexOf(currentSchedule) : -1;
        
        // Get the next schedule slot (or wrap around to the first one)
        const nextScheduleIndex = (currentIndex + 1) % sortedSchedules.length;
        const nextSchedule = sortedSchedules[nextScheduleIndex];
        
        // If we wrapped around, add a day
        if (nextScheduleIndex <= currentIndex) {
          nextReminderDate.setDate(nextReminderDate.getDate() + 1);
        }
        
        // Set the time to the next schedule's time
        const [hours, minutes] = nextSchedule.scheduled_time.split(':').map(Number);
        nextReminderDate.setHours(hours, minutes, 0, 0);
        
        // Use this directly instead of adding interval hours
        const nextReminder = nextReminderDate.toISOString();
        console.log(`Next reminder set for specific time: ${nextReminder}`);
        
        // Update medication schedule with next reminder
        const { error: updateError } = await supabase
          .from('medication_schedules')
          .update({
            taken: true,
            last_taken_at: currentDose,
            next_reminder_at: nextReminder
          })
          .eq('medication_id', medicationId);

        if (updateError) throw updateError;
        
        // Send confirmation email
        await sendConfirmationEmail(supabase, medicationData);
        
        return new Response(
          JSON.stringify({ success: true, nextReminder }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    }
    
    // For standard intervals, calculate next reminder time
    nextReminderDate = new Date(currentDoseDate.getTime() + (intervalHours * 60 * 60 * 1000));
    const nextReminder = nextReminderDate.toISOString();

    console.log(`Current dose time: ${currentDoseDate.toISOString()}`);
    console.log(`Next reminder calculated for: ${nextReminder}`);
    console.log(`Using interval hours: ${intervalHours}`);

    // Update medication schedule with next reminder
    const { error: updateError } = await supabase
      .from('medication_schedules')
      .update({
        taken: true,
        last_taken_at: currentDose,
        next_reminder_at: nextReminder
      })
      .eq('medication_id', medicationId);

    if (updateError) throw updateError;

    // Send confirmation email
    await sendConfirmationEmail(supabase, medicationData);

    return new Response(
      JSON.stringify({ success: true, nextReminder }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in schedule-next-dose:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Helper function to send confirmation email
async function sendConfirmationEmail(supabase, medicationData) {
  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', medicationData.user_id)
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
          medication: medicationData.name,
          dosage: medicationData.dosage,
          scheduledTime: new Date().toLocaleTimeString(),
          isReminder: false
        }),
      });
    }
  } catch (emailError) {
    console.error("Error sending confirmation email:", emailError);
    // Don't throw the error, to avoid disrupting the main flow
  }
}

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
