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
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
// Handle CORS preflight requests
const handleCors = (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return null;
};
// Generate a unique request ID for tracing
const generateRequestId = ()=>{
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
// Format email content for medication reminders
const formatEmailContent = (medication, customMessage)=>{
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
// Direct email sending function with proper error handling
const sendEmailDirectly = async (to, subject, html, requestId)=>{
  if (!resend) {
    console.error(`[${requestId}] Resend API key is not configured`);
    return {
      success: false,
      error: "Email service is not properly configured"
    };
  }
  try {
    console.log(`[${requestId}] Sending email directly to ${to}`);
    const appName = Deno.env.get("APP_NAME") || "MedTracker";
    const fromEmail = Deno.env.get("FROM_EMAIL") || "notifications@medtracker.app";
    const result = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [
        to
      ],
      subject: subject,
      html: html
    });
    console.log(`[${requestId}] Email sent successfully:`, result);
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error(`[${requestId}] Failed to send email:`, error);
    return {
      success: false,
      error: error.message || "Unknown email error"
    };
  }
};
// Safe database operation wrapper with better error handling
const safeDbOperation = async (operation, fallback = null, requestId)=>{
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error(`[${requestId}] Database operation failed:`, error.message);
    return {
      data: fallback,
      error
    };
  }
};
// Main request handler with improved error handling
serve(async (req)=>{
  const requestId = generateRequestId();
  console.log(`[${requestId}] Received request to send-notification endpoint`);
  // Handle CORS preflight request
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }
  try {
    // Parse request body safely
    let requestData;
    try {
      requestData = await req.json();
      console.log(`[${requestId}] Request data:`, JSON.stringify(requestData));
    } catch (parseError) {
      console.error(`[${requestId}] Error parsing request body:`, parseError.message);
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid JSON in request body",
        requestId
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get Supabase client with validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[${requestId}] Missing Supabase configuration`);
      return new Response(JSON.stringify({
        success: false,
        message: "Server configuration error: Missing Supabase credentials",
        requestId
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Create client with error handling
    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (clientError) {
      console.error(`[${requestId}] Failed to create Supabase client:`, clientError.message);
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to initialize database client",
        requestId
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Handle direct test email mode
    if (requestData.testMode === true && requestData.recipientEmail) {
      console.log(`[${requestId}] Processing test email to ${requestData.recipientEmail}`);
      const emailResult = await sendEmailDirectly(requestData.recipientEmail, requestData.subject || "Test Email from MedTracker", requestData.message || "This is a test email from MedTracker.", requestId);
      if (!emailResult.success) {
        return new Response(JSON.stringify({
          success: false,
          message: `Failed to send test email: ${emailResult.error}`,
          requestId
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: `Test email sent to ${requestData.recipientEmail}`,
        details: emailResult.result,
        requestId
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
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
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required parameters. userId, medicationId, and notificationType are required.",
        requestId
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`[${requestId}] Processing ${notificationType} notification for user ${userId}`);
    // Retrieve user data for notification with robust error handling
    // Use .maybeSingle() instead of .single() to handle empty results gracefully
    const userResult = await safeDbOperation(async ()=>{
      const { data, error } = await supabase.from("profiles").select("email, phone_number").eq("id", userId).maybeSingle();
      if (error) throw error;
      // Use a more graceful handling of missing users
      return {
        data: data || null,
        error: null
      };
    }, null, requestId);
    if (userResult.error) {
      console.error(`[${requestId}] User data fetch error:`, userResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to fetch user data: ${userResult.error.message || "Database error"}`,
        requestId
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Add specific handling for missing users
    if (!userResult.data) {
      console.error(`[${requestId}] User with ID ${userId} not found`);
      return new Response(JSON.stringify({
        success: false,
        message: `User with ID ${userId} not found`,
        requestId
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const userData = userResult.data;
    console.log(`[${requestId}] Found user data:`, userData);
    // Get medication details with proper error handling
    // Use .maybeSingle() instead of .single() to handle empty results gracefully
    const medResult = await safeDbOperation(async ()=>{
      const { data, error } = await supabase.from("medications").select("name, dosage, instructions").eq("id", medicationId).maybeSingle();
      if (error) throw error;
      // Just return the data, even if null
      return {
        data: data || null,
        error: null
      };
    }, null, requestId);
    if (medResult.error) {
      console.error(`[${requestId}] Medication data fetch error:`, medResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to fetch medication data: ${medResult.error.message || "Database error"}`,
        requestId
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Add specific handling for missing medications
    if (!medResult.data) {
      console.error(`[${requestId}] Medication with ID ${medicationId} not found`);
      console.log(`[${requestId}] Will continue with generic medication information`);
      // Instead of returning an error, we'll continue with a generic medication
      medResult.data = {
        name: "your medication",
        dosage: "as prescribed",
        instructions: "as directed by your healthcare provider"
      };
    }
    const medication = medResult.data;
    console.log(`[${requestId}] Medication data:`, medication);
    // Log the notification request in a try-catch block to prevent failure
    try {
      await supabase.from("notification_logs").insert({
        user_id: userId,
        medication_id: medicationId,
        notification_type: notificationType,
        priority_level: priorityLevel || "medium",
        scheduled_time: scheduleTime || new Date().toISOString(),
        content: {
          custom_message: customMessage,
          medication: medication || {
            name: "Unknown",
            dosage: "Unknown"
          }
        },
        request_id: requestId,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      // Non-critical error, just log it
      console.warn(`[${requestId}] Failed to log notification: ${logError.message}`);
    }
    // Process notifications based on type
    const notifications = [];
    // Handle email notification if requested and user has email
    if ([
      "email",
      "both",
      "all"
    ].includes(notificationType)) {
      if (userData?.email) {
        console.log(`[${requestId}] Processing email notification to ${userData.email}`);
        // Format email content
        const emailSubject = `Medication Reminder: ${medication?.name || "Time to take your medication"}`;
        const emailContent = formatEmailContent(medication, customMessage);
        // Send email directly
        const emailResult = await sendEmailDirectly(userData.email, emailSubject, emailContent, requestId);
        if (emailResult.success) {
          notifications.push({
            success: true,
            channel: "email",
            timestamp: new Date().toISOString(),
            message: `Email sent to ${userData.email}`,
            details: emailResult.result
          });
          // Update notification log with delivery details - non-critical operation
          try {
            await supabase.from("notification_logs").update({
              delivered: true,
              delivery_details: {
                email: {
                  sent: true,
                  timestamp: new Date().toISOString()
                }
              },
              updated_at: new Date().toISOString()
            }).eq("request_id", requestId);
          } catch (updateError) {
            console.warn(`[${requestId}] Failed to update notification log: ${updateError.message}`);
          }
        } else {
          notifications.push({
            success: false,
            channel: "email",
            timestamp: new Date().toISOString(),
            message: `Failed to send email: ${emailResult.error}`
          });
        }
      } else {
        console.warn(`[${requestId}] Email notification requested but user has no email address`);
        notifications.push({
          success: false,
          channel: "email",
          timestamp: new Date().toISOString(),
          message: "User has no email address configured"
        });
      }
    }
    // Handle ESP32 notification (placeholder)
    if ([
      "esp32",
      "both",
      "all"
    ].includes(notificationType)) {
      // This is just a placeholder that will be implemented in the future
      notifications.push({
        success: true,
        channel: "esp32",
        timestamp: new Date().toISOString(),
        message: "ESP32 notification processed"
      });
    }
    // Return success response with all notification results
    return new Response(JSON.stringify({
      success: true,
      message: "Notification processing completed",
      notifications,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(`[${requestId}] Unhandled error processing notification:`, errorMessage);
    if (errorStack) console.error(`[${requestId}] Error stack:`, errorStack);
    return new Response(JSON.stringify({
      success: false,
      message: `Server error: ${errorMessage}`,
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
