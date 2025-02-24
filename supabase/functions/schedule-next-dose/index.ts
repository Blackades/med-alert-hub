
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

    // Calculate next reminder time based on frequency
    const { data: nextReminder, error: reminderError } = await supabase.rpc(
      'calculate_next_reminder',
      {
        p_frequency: medicationData.frequency,
        p_last_taken: currentDose
      }
    );

    if (reminderError) throw reminderError;

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
