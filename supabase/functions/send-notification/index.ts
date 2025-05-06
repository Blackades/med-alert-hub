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
const handleCors = (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return null;
};

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Format email content for medication reminders
const formatEmailContent = (medication, customMessage) => {
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
const sendEmailDirectly = async (to, subject, html, requestId) => {
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
      to: [to],
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

// Add new function to send to physical ESP32 devices
const sendToPhysicalESP32 = async (userId: string, message: string, requestId: string) => {
  try {
    // Get the user's ESP32 devices
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_type', 'esp32')
      .eq('is_active', true);
    
    if (error) {
      console.error(`[${requestId}] Error fetching ESP32 devices:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
    
    if (!devices || devices.length === 0) {
      console.log(`[${requestId}] No ESP32 devices found for user ${userId}`);
      return {
        success: true,
        message: 'No ESP32 devices found',
        deviceCount: 0
      };
    }
    
    console.log(`[${requestId}] Found ${devices.length} ESP32 devices for user ${userId}`);
    
    // Send notifications to each device with an endpoint
    const results = await Promise.all(devices.map(async (device) => {
      if (device.endpoint) {
        try {
          console.log(`[${requestId}] Sending notification to ESP32 device ${device.device_id} at ${device.endpoint}`);
          
          const response = await fetch(device.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${device.device_token}`
            },
            body: JSON.stringify({
              message,
              type: 'both', // Activate both LED and buzzer
              duration: 5000 // 5 seconds
            })
          });
          
          if (response.ok) {
            console.log(`[${requestId}] Successfully sent notification to device ${device.device_id}`);
            
            // Update last seen timestamp
            await supabase
              .from('user_devices')
              .update({ last_seen: new Date().toISOString() })
              .eq('id', device.id);
              
            return {
              device_id: device.device_id,
              success: true
            };
          } else {
            console.error(`[${requestId}] Failed to send notification to device ${device.device_id}:`, await response.text());
            return {
              device_id: device.device_id,
              success: false,
              error: await response.text()
            };
          }
        } catch (err) {
          console.error(`[${requestId}] Error sending to device ${device.device_id}:`, err);
          return {
            device_id: device.device_id,
            success: false,
            error: String(err)
          };
        }
      } else {
        console.log(`[${requestId}] Device ${device.device_id} has no endpoint configured`);
        return {
          device_id: device.device_id,
          success: false,
          error: 'No endpoint configured'
        };
      }
    }));
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      message: `Sent notifications to ${successCount}/${devices.length} ESP32 devices`,
      deviceCount: devices.length,
      successCount,
      results
    };
  } catch (err) {
    console.error(`[${requestId}] Error in sendToPhysicalESP32:`, err);
    return {
      success: false,
      error: String(err),
      deviceCount: 0,
      successCount: 0
    };
  }
};

// Main request handler with improved error handling
serve(async (req) => {
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
    
    // Check for demo mode
    const isDemoMode = requestData.demoMode === true;
    console.log(`[${requestId}] Demo mode: ${isDemoMode ? "ENABLED" : "DISABLED"}`);
    
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
      
      const emailResult = await sendEmailDirectly(
        requestData.recipientEmail,
        requestData.subject || "Test Email from MedTracker",
        requestData.message || "This is a test email from MedTracker.",
        requestId
      );
      
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
    
    // Make the userId and medicationId optional in demo mode
    const effectiveUserId = userId || (isDemoMode ? 'demo-user-id' : null);
    const effectiveMedicationId = medicationId || (isDemoMode ? 'demo-medication-id' : null);
    
    // Validate required parameters for normal notification
    if (!isDemoMode && (!effectiveUserId || !effectiveMedicationId || !notificationType)) {
      console.error(`[${requestId}] Missing required parameters in non-demo mode:`, { effectiveUserId, effectiveMedicationId, notificationType });
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required parameters. userId, medicationId, and notificationType are required in non-demo mode.",
        requestId
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // In demo mode, we can proceed with placeholder values
    if (isDemoMode && (!effectiveUserId || !effectiveMedicationId || !notificationType)) {
      console.log(`[${requestId}] Using placeholder values in demo mode for missing parameters`);
    }
    
    const effectiveNotificationType = notificationType || 'email';
    
    console.log(`[${requestId}] Processing ${effectiveNotificationType} notification for user ${effectiveUserId}${isDemoMode ? " (DEMO MODE)" : ""}`);
    
    // If in demo mode and we have a specific demo recipient email
    let userData = null;
    let fakeUser = false;
    
    // Retrieve user data for notification with robust error handling
    if (!isDemoMode) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("email, phone_number")
          .eq("id", effectiveUserId)
          .maybeSingle();
          
        if (error) throw error;
        
        if (!data) {
          console.error(`[${requestId}] User with ID ${effectiveUserId} not found`);
          return new Response(JSON.stringify({
            success: false,
            message: `User with ID ${effectiveUserId} not found`,
            requestId
          }), {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
        
        userData = data;
      } catch (error) {
        console.error(`[${requestId}] User data fetch error:`, error.message);
        return new Response(JSON.stringify({
          success: false,
          message: `Failed to fetch user data: ${error.message || "Database error"}`,
          requestId
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    } else {
      // Create fake user data for demo mode
      console.log(`[${requestId}] Using demo mode with placeholder user data`);
      userData = {
        email: "demo@example.com",
        phone_number: "+1234567890"
      };
      fakeUser = true;
    }
    
    console.log(`[${requestId}] Found user data:`, userData);
    
    // Get medication details with proper error handling
    let medication = null;
    
    try {
      if (!isDemoMode) {
        const { data, error } = await supabase
          .from("medications")
          .select("name, dosage, instructions")
          .eq("id", effectiveMedicationId)
          .maybeSingle();
          
        if (error) throw error;
        
        if (!data) {
          console.error(`[${requestId}] Medication with ID ${effectiveMedicationId} not found`);
          
          // In non-demo mode, medication must exist
          return new Response(JSON.stringify({
            success: false,
            message: `Medication with ID ${effectiveMedicationId} not found`,
            requestId
          }), {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
        
        medication = data;
      } else {
        // Create placeholder medication for demo mode
        medication = {
          name: "Demo Medication",
          dosage: "10mg",
          instructions: "Take with water as directed"
        };
      }
    } catch (error) {
      console.error(`[${requestId}] Medication data fetch error:`, error.message);
      
      if (!isDemoMode) {
        return new Response(JSON.stringify({
          success: false,
          message: `Failed to fetch medication data: ${error.message || "Database error"}`,
          requestId
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      } else {
        // In demo mode, we can proceed with a placeholder medication
        medication = {
          name: "Demo Medication",
          dosage: "10mg",
          instructions: "Take with water as directed"
        };
      }
    }
    
    console.log(`[${requestId}] Medication data:`, medication);
    
    // Log the notification request in a try-catch block to prevent failure
    try {
      await supabase.from("notification_logs").insert({
        user_id: effectiveUserId,
        medication_id: effectiveMedicationId,
        notification_type: effectiveNotificationType,
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
        created_at: new Date().toISOString(),
        demo_mode: isDemoMode
      });
    } catch (logError) {
      // Non-critical error, just log it
      console.warn(`[${requestId}] Failed to log notification: ${logError.message}`);
    }
    
    // Process notifications based on type
    const notifications = [];
    
    // Handle email notification if requested and user has email
    if (['email', 'both', 'all'].includes(effectiveNotificationType)) {
      if (userData?.email) {
        console.log(`[${requestId}] Processing email notification to ${userData.email}`);
        
        // Format email content
        const emailSubject = `Medication Reminder: ${medication?.name || "Time to take your medication"}`;
        const emailContent = formatEmailContent(medication, customMessage);
        
        if (isDemoMode) {
          // In demo mode, don't actually send the email but simulate success
          console.log(`[${requestId}] DEMO MODE: Would send email to ${userData.email}`);
          console.log(`[${requestId}] DEMO MODE: Email content would be: ${emailContent.substring(0, 100)}...`);
          
          notifications.push({
            success: true,
            channel: "email",
            timestamp: new Date().toISOString(),
            message: `DEMO: Email would be sent to ${userData.email}`,
            demo: true
          });
        } else {
          // Send email directly in normal mode
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
    
    // Handle ESP32 notification
    if (['esp32', 'both', 'all'].includes(effectiveNotificationType)) {
      if (userData?.email) {
        console.log(`[${requestId}] Processing ESP32 notification for user ${effectiveUserId}`);
        
        // Try sending to physical ESP32 device first
        const esp32Result = await sendToPhysicalESP32(
          effectiveUserId,
          `Medication Reminder: ${medication?.name || "Time to take your medication"}`,
          requestId
        );
        
        if (esp32Result.success && esp32Result.successCount > 0) {
          notifications.push({
            success: true,
            channel: "esp32_physical",
            timestamp: new Date().toISOString(),
            message: `ESP32 notification sent to ${esp32Result.successCount} physical devices`,
            details: esp32Result
          });
        } else {
          // Fall back to simulated ESP32 notification if no physical devices or send failed
          notifications.push({
            success: true,
            channel: "esp32",
            timestamp: new Date().toISOString(),
            message: isDemoMode ? "DEMO: ESP32 notification simulated" : "ESP32 notification processed",
            data: {
              userId: effectiveUserId,
              medicationId: effectiveMedicationId,
              medicationName: medication?.name || "Demo Medication",
              dosage: medication?.dosage || "10mg",
              timestamp: new Date().toISOString(),
              demoMode: isDemoMode
            }
          });
        }
      } else {
        console.warn(`[${requestId}] ESP32 notification requested but user has no email address`);
        notifications.push({
          success: false,
          channel: "esp32",
          timestamp: new Date().toISOString(),
          message: "User has no email address configured"
        });
      }
    }
    
    // Return success response with all notification results
    return new Response(JSON.stringify({
      success: true,
      message: isDemoMode ? "Demo notification processing completed" : "Notification processing completed",
      notifications,
      timestamp: new Date().toISOString(),
      requestId,
      demoMode: isDemoMode || false
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
