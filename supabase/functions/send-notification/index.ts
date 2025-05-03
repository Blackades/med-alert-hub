
// Implementation of the send-notification edge function
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Initialize Resend client for email sending
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

// Format email content for medication reminders
const formatEmailContent = (medication: any, customMessage?: string) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <h2 style="color: #333; border-bottom: 1px solid #eaeaea; padding-bottom: 10px;">Medication Reminder</h2>
      <p style="font-size: 16px; color: #444;">It's time to take your medication: <strong>${medication?.name || "your medication"}</strong></p>
      <p style="font-size: 14px; color: #666;">Dosage: ${medication?.dosage || "as prescribed"}</p>
      ${medication?.instructions ? `<p style="font-size: 14px; color: #666;">Instructions: ${medication.instructions}</p>` : ""}
      ${customMessage ? `<p style="font-size: 14px; color: #666; margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 4px;"><em>Note: ${customMessage}</em></p>` : ""}
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eaeaea; font-size: 12px; color: #999;">
        <p>This is an automated reminder from your medication tracking system.</p>
      </div>
    </div>
  `;
};

// Direct email sending function to avoid queue
const sendEmailDirectly = async (to: string, subject: string, html: string, requestId: string) => {
  if (!resend) {
    console.error(`[${requestId}] Resend API key is not configured`);
    throw new Error("Email service is not properly configured");
  }
  
  try {
    console.log(`[${requestId}] Sending email directly to ${to}`);
    const appName = Deno.env.get("APP_NAME") || "MedTracker";
    const fromEmail = Deno.env.get("FROM_EMAIL") || "notifications@medtracker.app";
    
    const result = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: html
    });
    
    console.log(`[${requestId}] Email sent successfully:`, result);
    return result;
  } catch (error) {
    console.error(`[${requestId}] Failed to send email:`, error);
    throw error;
  }
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
    
    // Handle direct test email
    if (requestData.testMode && requestData.recipientEmail) {
      console.log(`[${requestId}] Processing test email to ${requestData.recipientEmail}`);
      
      try {
        const result = await sendEmailDirectly(
          requestData.recipientEmail,
          requestData.subject || "Test Email from MedTracker",
          requestData.message || "This is a test email from MedTracker.",
          requestId
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: `Test email sent to ${requestData.recipientEmail}`,
            details: result,
            requestId
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      } catch (error) {
        console.error(`[${requestId}] Test email error:`, error);
        throw error;
      }
    }
    
    // Process the notification request
    const { userId, medicationId, notificationType, customMessage, priorityLevel, scheduleTime } = requestData;
    
    // Validate required parameters for normal notification
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
      throw new Error(`Failed to fetch user data: ${userError.message}`);
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
      throw new Error(`Failed to fetch medication data: ${medError.message}`);
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
    
    // Process notifications based on type
    const notifications = [];
    
    // Handle email notification if requested and user has email
    if (["email", "both", "all"].includes(notificationType) && userData?.email) {
      console.log(`[${requestId}] Processing email notification to ${userData.email}`);
      
      try {
        // Format email content
        const emailSubject = `Medication Reminder: ${medication?.name || "Time to take your medication"}`;
        const emailContent = formatEmailContent(medication, customMessage);
        
        // Send email directly instead of queueing
        const emailResult = await sendEmailDirectly(
          userData.email,
          emailSubject,
          emailContent,
          requestId
        );
        
        notifications.push({
          success: true,
          channel: "email",
          timestamp: new Date().toISOString(),
          message: `Email sent to ${userData.email}`,
          details: emailResult
        });
        
        // Update notification log with delivery details
        await supabase
          .from("notification_logs")
          .update({
            delivered: true,
            delivery_details: { email: { sent: true, timestamp: new Date().toISOString() } },
            updated_at: new Date().toISOString()
          })
          .eq("request_id", requestId);
          
      } catch (emailError) {
        console.error(`[${requestId}] Error sending email:`, emailError);
        notifications.push({
          success: false,
          channel: "email",
          timestamp: new Date().toISOString(),
          message: `Failed to send email: ${emailError.message}`,
        });
      }
    } else if (["email", "both", "all"].includes(notificationType)) {
      console.warn(`[${requestId}] Email notification requested but user has no email address`);
      notifications.push({
        success: false,
        channel: "email",
        timestamp: new Date().toISOString(),
        message: "User has no email address configured",
      });
    }
    
    // Handle ESP32 notification
    if (["esp32", "both", "all"].includes(notificationType)) {
      // ESP32 notification implementation would go here
      // For now, just add a placeholder response
      notifications.push({
        success: true,
        channel: "esp32",
        timestamp: new Date().toISOString(),
        message: "ESP32 notification processed",
      });
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification processed successfully",
        notifications,
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
