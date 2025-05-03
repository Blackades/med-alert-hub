
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

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Serve the HTTP request
serve(async (req: Request): Promise<Response> => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Received request to send-notification endpoint`);
  
  // Handle CORS preflight request
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Parse request body
    const requestData = await req.json();
    console.log(`[${requestId}] Request data:`, JSON.stringify(requestData));
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Process the notification request
    const { userId, medicationId, notificationType, customMessage, priorityLevel, scheduleTime } = requestData;
    
    // Validate required parameters
    if (!userId || !medicationId || !notificationType) {
      console.error(`[${requestId}] Missing required parameters:`, {
        userId,
        medicationId,
        notificationType
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing required parameters",
          requestId 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`[${requestId}] Processing ${notificationType} notification for user ${userId}`);
    
    // Retrieve user data for notification
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("email, phone_number")
      .eq("id", userId)
      .single();
      
    if (userError) {
      console.error(`[${requestId}] Error fetching user data: ${userError.message}`);
    } else {
      console.log(`[${requestId}] Found user data:`, userData);
    }
    
    // Get medication details
    const { data: medication, error: medError } = await supabase
      .from("medications")
      .select("name, dosage, instructions")
      .eq("id", medicationId)
      .single();
      
    if (medError) {
      console.error(`[${requestId}] Error fetching medication data: ${medError.message}`);
    } else {
      console.log(`[${requestId}] Medication data:`, medication);
    }
    
    // Log the notification request
    const { data: logData, error: logError } = await supabase.from("notification_logs").insert({
      user_id: userId,
      medication_id: medicationId,
      notification_type: notificationType,
      priority_level: priorityLevel || "medium",
      scheduled_time: scheduleTime || new Date().toISOString(),
      content: {
        custom_message: customMessage,
        medication: medication || { name: "Unknown", dosage: "Unknown" }
      },
      request_id: requestId,
    }).select();
    
    if (logError) {
      console.error(`[${requestId}] Error logging notification: ${logError.message}`);
    } else {
      console.log(`[${requestId}] Notification logged with ID: ${logData?.[0]?.id}`);
    }
    
    // Handle email notification if requested
    if (["email", "both", "all"].includes(notificationType)) {
      if (userData?.email) {
        const emailContent = `
          <h2>Medication Reminder</h2>
          <p>It's time to take your medication: ${medication?.name || "your medication"}</p>
          <p>Dosage: ${medication?.dosage || "as prescribed"}</p>
          ${customMessage ? `<p>Note: ${customMessage}</p>` : ""}
        `;
        
        const { data: emailData, error: emailError } = await supabase.from("email_queue").insert({
          email: userData.email,
          user_id: userId,
          subject: `Medication Reminder: ${medication?.name || "Time to take your medication"}`,
          body: emailContent,
          status: "pending",
          created_at: new Date().toISOString(),
          metadata: {
            medication_id: medicationId,
            request_id: requestId
          }
        }).select();
        
        if (emailError) {
          console.error(`[${requestId}] Error queueing email: ${emailError.message}`);
        } else {
          console.log(`[${requestId}] Email queued successfully with ID: ${emailData?.[0]?.id}`);
        }
      } else {
        console.warn(`[${requestId}] Email notification requested but user has no email address`);
      }
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification processed successfully",
        timestamp: new Date().toISOString(),
        requestId: requestId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] Error processing notification: ${errorMessage}`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        requestId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
