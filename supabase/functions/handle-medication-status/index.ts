
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { medicationId, action } = await req.json();

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
    const intervalHours = getFrequencyHours(medication.frequency);

    // Calculate the next reminder time by adding the interval to the current time
    nextReminderTime = new Date(now.getTime());
    nextReminderTime.setHours(nextReminderTime.getHours() + intervalHours);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Next reminder set for: ${nextReminderTime.toISOString()}`);
    console.log(`Frequency: ${medication.frequency}, Interval hours: ${intervalHours}`);

    // Update medication schedule
    const { error: updateError } = await supabase
      .from('medication_schedules')
      .update({
        taken: action === 'take',
        missed_doses: action === 'miss',
        next_reminder_at: nextReminderTime.toISOString(),
        last_taken_at: action === 'take' ? now.toISOString() : null
      })
      .eq('medication_id', medicationId);

    if (updateError) throw updateError;

    // If medication was taken, send confirmation email
    if (action === 'take') {
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
            scheduledTime: nextReminderTime.toLocaleTimeString(),
            isReminder: false
          }),
        });
      }
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
    default:
      return 24;
  }
}
