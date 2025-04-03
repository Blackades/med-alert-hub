
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
    const now = new Date();
    
    // Query upcoming medications due in the next 15 minutes
    const { data: upcomingMeds, error: upcomingError } = await supabase
      .from('medication_schedules')
      .select(`
        id,
        scheduled_time,
        medication_id,
        medications (
          id,
          name,
          dosage,
          instructions,
          user_id
        )
      `)
      .eq('taken', false)
      .lte('next_dose', new Date(now.getTime() + 15 * 60000).toISOString()) // Next 15 minutes
      .gte('next_dose', now.toISOString());
      
    if (upcomingError) throw upcomingError;
    
    if (upcomingMeds && upcomingMeds.length > 0) {
      // Format the response for ESP32
      const notifications = upcomingMeds.map(med => ({
        id: med.id,
        medication_name: med.medications.name,
        dosage: med.medications.dosage,
        instructions: med.medications.instructions,
        scheduled_time: med.scheduled_time,
        due_at: med.next_dose,
        user_id: med.medications.user_id
      }));
      
      return new Response(JSON.stringify({ 
        status: 'success', 
        timestamp: now.toISOString(),
        notifications 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    return new Response(JSON.stringify({ 
      status: 'success', 
      timestamp: now.toISOString(),
      notifications: [] 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in ESP32 notifications function:", error);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: error.message || 'An error occurred'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
