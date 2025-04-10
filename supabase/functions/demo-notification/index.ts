
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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

    const { userId, medicationId, notificationType } = await req.json();
    
    // Get user information
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('email, phone_number')
      .eq('id', userId)
      .single();
      
    if (userError) throw userError;
    
    // Get medication details
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('id, name, dosage, instructions')
      .eq('id', medicationId)
      .single();
      
    if (medError) throw medError;
    
    // Determine what type of notification to send
    let result = { success: false, message: "No action taken" };
    
    if (notificationType === 'email') {
      // Send an email notification
      const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          email: userData.email,
          medication: medication.name,
          dosage: medication.dosage,
          scheduledTime: new Date().toLocaleTimeString(),
          isReminder: true,
          instructions: medication.instructions
        }),
      });
      
      const emailResult = await emailResponse.json();
      result = { success: true, message: "Demo email notification sent", details: emailResult };
    } 
    else if (notificationType === 'esp32') {
      // Simulate an ESP32 notification
      const { data, error } = await supabase.functions.invoke('esp32-notifications', {
        method: 'GET',
      });
      
      if (error) throw error;
      
      result = { 
        success: true, 
        message: "ESP32 notifications retrieved", 
        notifications: data.notifications || [] 
      };
    }
    else if (notificationType === 'both') {
      // Send both notifications
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
          scheduledTime: new Date().toLocaleTimeString(),
          isReminder: true,
          instructions: medication.instructions
        }),
      });
      
      const { data } = await supabase.functions.invoke('esp32-notifications', {
        method: 'GET',
      });
      
      result = { 
        success: true, 
        message: "Both notifications triggered", 
        esp32Data: data 
      };
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in demo-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unknown error occurred" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
