
// Implementation of the send-notification edge function
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

// Define CORS headers to enable cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handleCors = (req: Request): Response | null => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
};

// Serve the HTTP request
serve(async (req: Request): Promise<Response> => {
  console.log("Received request to send-notification endpoint");
  
  // Handle CORS preflight request
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Parse request body
    const requestData = await req.json();
    console.log("Request data:", requestData);
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Process the notification request
    const { userId, medicationId, notificationType, customMessage, priorityLevel, scheduleTime } = requestData;
    
    // Validate required parameters
    if (!userId || !medicationId || !notificationType) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing required parameters" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`Processing ${notificationType} notification for user ${userId}`);
    
    // Log the notification request
    await supabase.from("notification_logs").insert({
      user_id: userId,
      medication_id: medicationId,
      notification_type: notificationType,
      priority_level: priorityLevel || "medium",
      scheduled_time: scheduleTime || new Date().toISOString(),
      content: {
        custom_message: customMessage,
      },
      request_id: crypto.randomUUID(),
    });
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification processed successfully",
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle errors
    console.error("Error processing notification:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error processing notification request",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
