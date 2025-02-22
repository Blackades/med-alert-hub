
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

    // Fetch medication details with error handling
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('*, medication_schedules(*)')
      .eq('id', medicationId)
      .single();

    if (medError) {
      console.error("Error fetching medication:", medError);
      throw medError;
    }

    if (!medication) {
      throw new Error(`No medication found with ID: ${medicationId}`);
    }

    console.log("Fetched medication:", medication);

    // Calculate next dose time based on frequency
    const intervalHours = medication.frequency === 'daily' ? 24 :
      medication.frequency === 'twice_daily' ? 12 :
      medication.frequency === 'thrice_daily' ? 8 : 1;

    const nextDoseTime = addHours(parseISO(currentDose), intervalHours);
    console.log(`Calculated next dose time: ${nextDoseTime.toISOString()}`);

    // Update medication schedule
    if (!medication.medication_schedules || medication.medication_schedules.length === 0) {
      console.error("No medication schedules found");
      throw new Error("No medication schedules found for this medication");
    }

    const scheduleId = medication.medication_schedules[0].id;
    const { error: updateError } = await supabase
      .from('medication_schedules')
      .update({ 
        next_dose: nextDoseTime.toISOString(),
        taken: true 
      })
      .eq('id', scheduleId);

    if (updateError) {
      console.error("Error updating schedule:", updateError);
      throw updateError;
    }

    // Schedule next notification if needed
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
