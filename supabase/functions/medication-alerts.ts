
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

// Setup CORS headers for browsers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Medication alerts function called`);
  
  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Get the request method
    const { method } = req;
    
    // Handle GET request to check for due medications
    if (method === "GET") {
      console.log(`[${requestId}] Finding medications that need alerts`);
      
      // Query medications that need alerts
      const { data: dueAlerts, error: alertsError } = await supabaseAdmin
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          user_id,
          next_dose_at,
          alert_before_minutes,
          profiles!inner(id, email)
        `)
        .lt('next_dose_at', new Date(Date.now() + 30 * 60 * 1000).toISOString()) // Next 30 mins
        .gt('next_dose_at', new Date().toISOString()) // Not in the past
        .eq('active', true)
        .order('next_dose_at', { ascending: true });
      
      if (alertsError) {
        throw new Error(`Error querying due alerts: ${alertsError.message}`);
      }
      
      console.log(`[${requestId}] Found ${dueAlerts?.length || 0} medications due soon`);
      
      // Return the due medications
      return new Response(JSON.stringify({
        success: true,
        count: dueAlerts?.length || 0,
        medications: dueAlerts || []
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Handle POST request to send alerts for a specific medication
    else if (method === "POST") {
      // Parse the request body
      let body;
      try {
        body = await req.json();
      } catch (e) {
        console.error(`[${requestId}] Failed to parse request body: ${e.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid request body: Could not parse JSON"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      const { userId, medicationId, notificationType } = body;
      
      // Log received parameters for debugging
      console.log(`[${requestId}] Received parameters:`, { userId, medicationId, notificationType });
      
      if (!userId || !medicationId) {
        console.error(`[${requestId}] Missing required fields: userId=${userId}, medicationId=${medicationId}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: userId and medicationId"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      console.log(`[${requestId}] Sending medication alert for med ${medicationId} to user ${userId}`);
      
      // Fetch the user to verify they exist
      const { data: user, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name, notification_preferences')
        .eq('id', userId)
        .maybeSingle();
      
      if (userError) {
        console.error(`[${requestId}] Error fetching user: ${userError.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch user: ${userError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      if (!user) {
        console.error(`[${requestId}] User with ID ${userId} not found`);
        return new Response(JSON.stringify({
          success: false,
          error: `User with ID ${userId} not found`
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      // Fetch the medication
      const { data: medication, error: medError } = await supabaseAdmin
        .from('medications')
        .select('*')
        .eq('id', medicationId)
        .maybeSingle();
      
      if (medError) {
        console.error(`[${requestId}] Error fetching medication: ${medError.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch medication: ${medError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      if (!medication) {
        console.error(`[${requestId}] Medication with ID ${medicationId} not found`);
        return new Response(JSON.stringify({
          success: false,
          error: `Medication with ID ${medicationId} not found`
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      // Check that medication belongs to the user
      if (medication.user_id !== userId) {
        console.error(`[${requestId}] Medication does not belong to user: med.user_id=${medication.user_id}, userId=${userId}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Medication does not belong to this user"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      // Call the send-notification function to deliver the alert
      const alertPayload = {
        userId,
        medicationId,
        notificationType: notificationType || user.notification_preferences?.default_type || 'email',
        customMessage: `Time to take your ${medication.name} (${medication.dosage})`,
        priorityLevel: 'high',
      };
      
      console.log(`[${requestId}] Sending notification with payload:`, alertPayload);
      
      // Send notification
      const { data: notificationResult, error: notifyError } = await supabaseAdmin.functions.invoke(
        'send-notification', {
          body: alertPayload
        }
      );
      
      if (notifyError) {
        console.error(`[${requestId}] Failed to send notification: ${notifyError.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to send notification: ${notifyError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      console.log(`[${requestId}] Alert sent successfully: ${JSON.stringify(notificationResult)}`);
      
      // Return success
      return new Response(JSON.stringify({
        success: true,
        message: `Alert sent for ${medication.name}`,
        details: notificationResult
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      requestId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

console.log("Medication alerts function initialized");
