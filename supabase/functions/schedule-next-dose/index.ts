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

// Helper for day calculations in weekly schedules
const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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
        medication_schedules (*),
        medication_schedule_days (*)
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
      // For weekly schedules
      const scheduleDays = medicationData.medication_schedule_days;
      if (scheduleDays && scheduleDays.length > 0) {
        // Find the next scheduled day
        const today = new Date().getDay(); // 0-6, starting with Sunday
        
        // Sort the scheduled days by their numeric day values
        const sortedDays = [...scheduleDays].sort((a, b) => {
          const dayA = DAYS_OF_WEEK.indexOf(a.day.toLowerCase());
          const dayB = DAYS_OF_WEEK.indexOf(b.day.toLowerCase());
          return dayA - dayB;
        });
        
        // Find the next day that is scheduled
        let nextDayIndex = -1;
        for (let i = 0; i < sortedDays.length; i++) {
          const dayIndex = DAYS_OF_WEEK.indexOf(sortedDays[i].day.toLowerCase());
          if (dayIndex > today) {
            nextDayIndex = dayIndex;
            break;
          }
        }
        
        // If no future day this week, take the first scheduled day
        if (nextDayIndex === -1 && sortedDays.length > 0) {
          nextDayIndex = DAYS_OF_WEEK.indexOf(sortedDays[0].day.toLowerCase());
          // Calculate days to add (from today to next scheduled day next week)
          const daysToAdd = (7 - today) + nextDayIndex;
          nextReminderDate = new Date(nextReminderDate.setDate(nextReminderDate.getDate() + daysToAdd));
        } else if (nextDayIndex !== -1) {
          // Calculate days to add (from today to next scheduled day this week)
          const daysToAdd = nextDayIndex - today;
          nextReminderDate = new Date(nextReminderDate.setDate(nextReminderDate.getDate() + daysToAdd));
        } else {
          // Fallback to daily if no days are scheduled
          nextReminderDate = new Date(currentDoseDate.getTime() + (24 * 60 * 60 * 1000));
        }
      } else {
        // Default to 7 days if no specific days are set
        nextReminderDate = new Date(currentDoseDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      }
      
      // Keep the time component from current dose
      nextReminderDate.setHours(
        currentDoseDate.getHours(),
        currentDoseDate.getMinutes(),
        currentDoseDate.getSeconds(),
        currentDoseDate.getMilliseconds()
      );
      
      const nextReminder = nextReminderDate.toISOString();
      console.log(`Next weekly reminder set for: ${nextReminder}`);
      
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
    } else if (medicationData.frequency === FREQUENCY_OPTIONS.MONTHLY) {
      // For monthly schedules - calculate to the same day next month
      nextReminderDate = new Date(currentDoseDate);
      
      // Get the current month and year
      let month = nextReminderDate.getMonth();
      let year = nextReminderDate.getFullYear();
      
      // Move to next month
      month++;
      if (month > 11) {
        month = 0; // January
        year++; // Next year
      }
      
      // Set the next month
      nextReminderDate.setMonth(month);
      nextReminderDate.setFullYear(year);
      
      // Handle month length differences (e.g., Jan 31 -> Feb 28)
      const currentDay = currentDoseDate.getDate();
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      nextReminderDate.setDate(Math.min(currentDay, lastDayOfMonth));
      
      const nextReminder = nextReminderDate.toISOString();
      console.log(`Next monthly reminder set for: ${nextReminder}`);
      
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
    } else if (medicationData.frequency.startsWith('every_')) {
      // Parse custom hour interval (e.g., "every_4" for every 4 hours)
      const hours = parseInt(medicationData.frequency.split('_')[1]);
      if (!isNaN(hours)) {
        intervalHours = hours;
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
