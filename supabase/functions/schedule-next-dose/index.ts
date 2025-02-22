
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { addHours, parseISO } from "npm:date-fns@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { medicationId, currentDose } = await req.json();

    // Fetch medication details
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('*, medication_schedules(*)')
      .eq('id', medicationId)
      .single();

    if (medError) throw medError;

    // Calculate interval based on frequency
    const frequencyMap: { [key: string]: number } = {
      'daily': 24,
      'twice_daily': 12,
      'thrice_daily': 8,
      'every_hour': 1,
    };

    const intervalHours = frequencyMap[medication.frequency] || 24;
    const nextDoseTime = addHours(parseISO(currentDose), intervalHours);

    // Update next dose time
    const { error: updateError } = await supabase
      .from('medication_schedules')
      .update({ 
        next_dose: nextDoseTime.toISOString(),
        taken: true 
      })
      .eq('medication_id', medicationId);

    if (updateError) throw updateError;

    // Schedule next notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        medication_schedule_id: medication.medication_schedules[0].id,
        user_id: medication.user_id,
        status: 'pending'
      });

    if (notificationError) throw notificationError;

    return new Response(
      JSON.stringify({ success: true, nextDose: nextDoseTime }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
