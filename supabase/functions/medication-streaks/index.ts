
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Get the last 30 days of medication logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: medications, error: medError } = await supabase
      .from('medications')
      .select('id, name')
      .eq('user_id', userId);
    
    if (medError) throw medError;
    
    const results = [];
    
    // For each medication, calculate streaks
    for (const med of medications) {
      const { data: logs, error: logError } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('medication_id', med.id)
        .gte('scheduled_time', thirtyDaysAgo.toISOString())
        .order('scheduled_time', { ascending: false });
      
      if (logError) throw logError;
      
      // Calculate current streak
      let currentStreak = 0;
      let longestStreak = 0;
      let lastDate = null;
      
      // Group logs by day
      const logsByDate = {};
      for (const log of logs) {
        const date = new Date(log.scheduled_time).toISOString().split('T')[0];
        if (!logsByDate[date]) {
          logsByDate[date] = [];
        }
        logsByDate[date].push(log);
      }
      
      // Sort dates in descending order
      const sortedDates = Object.keys(logsByDate).sort().reverse();
      
      // Calculate streaks
      for (const date of sortedDates) {
        const dayLogs = logsByDate[date];
        const allTaken = dayLogs.every(log => log.status === 'taken');
        
        if (allTaken) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          // Break the streak if any dose was missed
          break;
        }
      }
      
      results.push({
        medicationId: med.id,
        medicationName: med.name,
        currentStreak,
        longestStreak,
        adherenceRate: logs.length > 0 
          ? logs.filter(log => log.status === 'taken').length / logs.length * 100 
          : 0
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error calculating medication streaks:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
