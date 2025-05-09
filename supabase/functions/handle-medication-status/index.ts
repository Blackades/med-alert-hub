import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// Initialize Supabase client with service role key to bypass RLS policies
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, medicationId, takenAt, reason, updateStatus = true } = await req.json();
    console.log(`Handling medication status: Action=${action}, MedicationID=${medicationId}`);

    if (!medicationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Medication ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get medication details
    const { data: medication, error: medError } = await supabase
      .from("medications")
      .select("id, name, dosage, instructions, user_id")
      .eq("id", medicationId)
      .single();

    if (medError || !medication) {
      console.error("Error fetching medication:", medError);
      return new Response(
        JSON.stringify({ success: false, error: "Medication not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process based on action type
    if (action === "take") {
      // Log the medication as taken
      const now = new Date();
      const actionTime = takenAt ? new Date(takenAt) : now;
      
      // Always add log entry
      const { data: logData, error: logError } = await supabase
        .from("medication_logs")
        .insert({
          medication_id: medicationId,
          medication_name: medication.name,
          status: "taken",
          taken_at: actionTime.toISOString(),
          scheduled_time: now.toISOString(),
          dosage_taken: parseFloat(medication.dosage) || 1,
          user_id: medication.user_id
        })
        .select()
        .single();
      
      if (logError) {
        console.error("Error creating log entry:", logError);
      } else {
        console.log("Created medication taken log:", logData);
      }
      
      let result = { logData };
      
      // Update streak information
      try {
        const { data: streakData } = await supabase
          .from("medication_streaks")
          .select("id, current_streak, longest_streak")
          .eq("medication_id", medicationId)
          .maybeSingle();
        
        if (streakData) {
          // Update existing streak
          const newCurrentStreak = streakData.current_streak + 1;
          const newLongestStreak = Math.max(newCurrentStreak, streakData.longest_streak || 0);
          
          const { data: updatedStreak } = await supabase
            .from("medication_streaks")
            .update({
              current_streak: newCurrentStreak,
              longest_streak: newLongestStreak,
              last_taken_at: now.toISOString()
            })
            .eq("id", streakData.id)
            .select()
            .single();
            
          result.streak = updatedStreak;
        } else {
          // Create new streak
          const { data: newStreak } = await supabase
            .from("medication_streaks")
            .insert({
              medication_id: medicationId,
              user_id: medication.user_id,
              current_streak: 1,
              longest_streak: 1,
              last_taken_at: now.toISOString()
            })
            .select()
            .single();
            
          result.streak = newStreak;
        }
      } catch (streakError) {
        console.error("Error updating streak:", streakError);
      }
      
      // Only update the medication_schedules table if updateStatus is true
      if (updateStatus) {
        try {
          // Update the schedule status
          await supabase.functions.invoke("schedule-next-dose", {
            body: {
              medicationId,
              currentDose: now.toISOString()
            }
          });
        } catch (scheduleError) {
          console.error("Error scheduling next dose:", scheduleError);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          action: "take",
          result,
          message: "Medication marked as taken"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } 
    else if (action === "skip") {
      // Log the medication as skipped
      const now = new Date();
      
      // Always add log entry
      const { data: logData, error: logError } = await supabase
        .from("medication_logs")
        .insert({
          medication_id: medicationId,
          medication_name: medication.name,
          status: "skipped",
          reason: reason || "Skipped by user",
          scheduled_time: now.toISOString(),
          user_id: medication.user_id
        })
        .select()
        .single();
      
      if (logError) {
        console.error("Error creating skip log entry:", logError);
      } else {
        console.log("Created medication skipped log:", logData);
      }
      
      let result = { logData };
      
      // Reset streak information
      try {
        const { data: streakData } = await supabase
          .from("medication_streaks")
          .select("id, current_streak, longest_streak")
          .eq("medication_id", medicationId)
          .maybeSingle();
        
        if (streakData) {
          // Reset current streak but keep longest streak
          const { data: updatedStreak } = await supabase
            .from("medication_streaks")
            .update({
              current_streak: 0,
              // longest_streak remains unchanged
            })
            .eq("id", streakData.id)
            .select()
            .single();
            
          result.streak = updatedStreak;
        }
      } catch (streakError) {
        console.error("Error updating streak for skip:", streakError);
      }
      
      // Only update the medication_schedules table if updateStatus is true
      if (updateStatus) {
        try {
          // Skip means we don't mark it as taken but schedule the next dose
          await supabase.functions.invoke("schedule-next-dose", {
            body: {
              medicationId,
              currentDose: now.toISOString(),
              skipNextDose: false  // We want to schedule the next dose
            }
          });
        } catch (scheduleError) {
          console.error("Error scheduling next dose after skip:", scheduleError);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          action: "skip",
          result,
          message: "Medication marked as skipped"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in handle-medication-status function:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
