
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
    const { userId, date, mood, notes } = await req.json();
    
    if (req.method === "POST") {
      // Record a new mood entry
      const { data, error } = await supabase
        .from('mood_entries')
        .insert({
          user_id: userId,
          date: date || new Date().toISOString(),
          mood,
          notes
        })
        .select()
        .single();
        
      if (error) throw error;
      
      return new Response(JSON.stringify({ 
        success: true,
        data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // GET - Retrieve mood entries
      const { data, error } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);
        
      if (error) throw error;
      
      return new Response(JSON.stringify({ 
        success: true,
        data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Error in mood-tracker function:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
