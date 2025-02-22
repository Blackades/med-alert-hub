
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { medicationId, currentDose } = await req.json();

    // Validate required parameters
    if (!medicationId || !currentDose) {
      throw new Error("Missing required parameters: medicationId or currentDose");
    }

    console.log(`Processing medication ID: ${medicationId}, Current dose: ${currentDose}`);

    // First, fetch just the medication to ensure it exists
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('*')
      .eq('id', medicationId)
      .single();

    if (medError || !medication) {
      console.error("Error fetching medication:", medError);
      throw new Error("Medication not found");
    }

    console.log("Fetched medication:", medication);

    // Calculate next dose time based on frequency
    const intervalHours = medication.frequency === 'daily' ? 24 :
      medication.frequency === 'twice_daily' ? 12 :
      medication.frequency === 'thrice_daily' ? 8 : 1;

    const nextDoseTime = addHours(parseISO(currentDose), intervalHours);
    console.log(`Calculated next dose time: ${nextDoseTime.toISOString()}`);

    // Fetch existing schedule or create new one
    const { data: schedules, error: scheduleError } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('medication_id', medicationId);

    if (scheduleError) {
      console.error("Error fetching schedules:", scheduleError);
      throw scheduleError;
    }

    let scheduleId;

    if (!schedules || schedules.length === 0) {
      // Create new schedule if none exists
      const { data: newSchedule, error: createError } = await supabase
        .from('medication_schedules')
        .insert({
          medication_id: medicationId,
          scheduled_time: nextDoseTime.toISOString().split('T')[1].split('.')[0],
          next_dose: nextDoseTime.toISOString(),
          taken: true
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating schedule:", createError);
        throw createError;
      }

      scheduleId = newSchedule.id;
    } else {
      // Update existing schedule
      const { error: updateError } = await supabase
        .from('medication_schedules')
        .update({
          next_dose: nextDoseTime.toISOString(),
          taken: true
        })
        .eq('id', schedules[0].id);

      if (updateError) {
        console.error("Error updating schedule:", updateError);
        throw updateError;
      }

      scheduleId = schedules[0].id;
    }

    // Schedule next notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        medication_schedule_id: scheduleId,
        user_id: medication.user_id,
        status: 'pending',
        scheduled_for: nextDoseTime.toISOString()
      });

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't throw here, as the main operation succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        nextDose: nextDoseTime.toISOString(),
        message: "Successfully scheduled next dose"
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in schedule-next-dose function:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred",
        success: false
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500,
      }
    );
  }
});
