
// medication-streaks edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Type definitions
interface MedicationStreak {
  medicationId: string;
  medication_id?: string;
  medication_name?: string;
  currentStreak: number;
  current_streak?: number;
  longestStreak: number;
  longest_streak?: number;
  adherenceRate: number;
  adherence_rate?: number;
  userId: string;
}

interface RequestBody {
  userId: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  console.log("Medication streaks function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    let requestData: RequestBody;
    
    if (req.headers.get("content-type")?.includes("application/json")) {
      requestData = await req.json();
    } else {
      const formData = await req.formData();
      requestData = {
        userId: formData.get("userId") as string
      };
    }
    
    // Validate request data
    if (!requestData.userId) {
      throw new Error("User ID is required");
    }

    console.log(`Fetching streak data for user: ${requestData.userId}`);
    
    // Get all medications for the user
    const { data: medications, error: medError } = await supabase
      .from('medications')
      .select('id, name')
      .eq('user_id', requestData.userId);
    
    if (medError) {
      console.error("Error fetching medications:", medError);
      throw new Error(`Failed to fetch medications: ${medError.message}`);
    }
    
    if (!medications || medications.length === 0) {
      // No medications found, return empty array
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // For each medication, calculate its streak data
    const streakData: MedicationStreak[] = [];
    
    for (const med of medications) {
      // Get medication logs for this medication
      const { data: logs, error: logError } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('medication_id', med.id)
        .order('scheduled_time', { ascending: false });
      
      if (logError) {
        console.error(`Error fetching logs for medication ${med.id}:`, logError);
        continue; // Skip this medication on error
      }
      
      // Calculate current streak
      let currentStreak = 0;
      let lastDate: Date | null = null;
      
      if (logs && logs.length > 0) {
        for (const log of logs) {
          if (log.status !== 'taken') continue;
          
          const logDate = new Date(log.scheduled_time);
          logDate.setHours(0, 0, 0, 0); // Normalize to start of day
          
          if (!lastDate) {
            // First taken dose
            lastDate = logDate;
            currentStreak = 1;
            continue;
          }
          
          const prevDate = new Date(lastDate);
          prevDate.setDate(prevDate.getDate() - 1);
          
          if (logDate.getTime() === prevDate.getTime()) {
            // Consecutive day
            currentStreak++;
            lastDate = logDate;
          } else {
            // Streak broken
            break;
          }
        }
      }
      
      // Calculate longest streak (simplified version for now)
      // In a real app, we would need to analyze the entire history
      const longestStreak = currentStreak; // For simplicity
      
      // Calculate adherence rate
      let takenCount = 0;
      let totalLogs = 0;
      
      if (logs) {
        totalLogs = logs.length;
        takenCount = logs.filter(log => log.status === 'taken').length;
      }
      
      const adherenceRate = totalLogs > 0 ? (takenCount / totalLogs) * 100 : 0;
      
      streakData.push({
        medicationId: med.id,
        medication_id: med.id,
        medication_name: med.name,
        currentStreak: currentStreak,
        current_streak: currentStreak,
        longestStreak: longestStreak,
        longest_streak: longestStreak,
        adherenceRate: adherenceRate,
        adherence_rate: adherenceRate,
        userId: requestData.userId
      });
    }
    
    console.log(`Returning streak data: ${streakData.length} items`);
    
    return new Response(
      JSON.stringify(streakData),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error in medication streaks function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});
