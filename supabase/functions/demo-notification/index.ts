import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { z } from 'https://esm.sh/zod@3.22.4';
// Environment validation with more robust handling
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ESP32_ENDPOINT'
];
const missingEnvVars = [];
for (const envVar of requiredEnvVars){
  if (!Deno.env.get(envVar)) {
    console.error(`Missing required environment variable: ${envVar}`);
    missingEnvVars.push(envVar);
  }
}
// CORS configuration - IMPORTANT FIX: Allow your frontend domain specifically
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://med-alert-hub.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400"
};
// Input validation schema
const RequestSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  medicationId: z.string().uuid("Invalid medication ID format"),
  notificationType: z.enum([
    'email',
    'sms',
    'esp32',
    'both',
    'all'
  ]),
  customMessage: z.string().optional(),
  priorityLevel: z.enum([
    'low',
    'medium',
    'high',
    'urgent'
  ]).optional().default('medium'),
  scheduleTime: z.string().optional().default(()=>new Date().toISOString())
});
// Generate a unique ID for each request for tracing
const generateRequestId = ()=>{
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
// Helper for formatted timestamps
const getFormattedTimestamp = ()=>{
  return new Date().toISOString();
};
// Function to create appropriate notification content
function createNotificationContent(userData, medication, customMessage, priorityLevel = 'medium') {
  // Format the time in a user-friendly way
  const timeFormatted = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  // Determine priority indicator
  let priorityIndicator = '';
  if (priorityLevel === 'high') priorityIndicator = '❗';
  if (priorityLevel === 'urgent') priorityIndicator = '❗❗';
  // Create message subject
  const subject = `${priorityIndicator} Medication Reminder: Time to take ${medication.name} ${priorityIndicator}`;
  // Base message content - now checking if properties exist before using them
  const firstName = userData && userData.first_name ? userData.first_name : 'there';
  let messageContent = `
Hello ${firstName},

This is a reminder to take your medication:

✅ Medication: ${medication.name}
✅ Dosage: ${medication.dosage}
✅ Time: ${timeFormatted}
${medication.instructions ? `✅ Instructions: ${medication.instructions}` : ''}
${customMessage ? `\nNote: ${customMessage}` : ''}

Please remember to record this dose in your medication tracker.

Need help or have questions? Reply to this message or contact your healthcare provider.

Stay healthy!
MedTracker System
`;
  // SMS is more concise 
  const smsContent = `MedTracker ${priorityIndicator}: Time to take ${medication.name} (${medication.dosage}) at ${timeFormatted}. ${medication.instructions || ''} ${customMessage || ''}`;
  // ESP32 is most concise
  const esp32Content = {
    medicationName: medication.name,
    dosage: medication.dosage,
    time: timeFormatted,
    instructions: medication.instructions || '',
    priority: priorityLevel
  };
  return {
    subject,
    emailContent: messageContent,
    smsContent,
    esp32Content
  };
}
// Function to send Email
// Function to send Email
async function sendEmail(supabase, userData, notificationContent, userId, medicationId, requestId) {
  try {
    // Ensure the user has a valid email
    if (!userData.email || !userData.email.includes('@')) {
      throw new Error(`Invalid or missing email address for user ${userId}`);
    }
    // Additional check to prevent null email
    const emailToUse = userData.email.trim();
    if (!emailToUse) {
      throw new Error(`Email address is empty for user ${userId}`);
    }
    // Insert with the correct field structure and status
    // Changed "to" field to "email" to match the database schema
    const { error } = await supabase.from('email_queue').insert({
      email: emailToUse,
      user_id: userId,
      subject: notificationContent.subject,
      body: notificationContent.emailContent,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        medication_id: medicationId,
        request_id: requestId
      }
    });
    if (error) {
      console.error(`[${requestId}] Email queue insert error: ${error.message || JSON.stringify(error)}`);
      throw new Error(`Failed to queue email: ${error.message || 'Unknown error'}`);
    }
    console.log(`[${requestId}] Email queued for ${emailToUse}`);
    return {
      success: true,
      message: "Email notification queued successfully"
    };
  } catch (error) {
    console.error(`[${requestId}] Error queuing email:`, error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}
// Function to send SMS
async function sendSms(supabase, userData, notificationContent, userId, medicationId, requestId) {
  try {
    // Ensure the user has a valid phone number
    if (!userData.phone_number || userData.phone_number.trim() === '') {
      throw new Error(`Invalid or missing phone number for user ${userId}`);
    }
    // Additional check to prevent null phone number
    const phoneToUse = userData.phone_number.trim();
    if (!phoneToUse) {
      throw new Error(`Phone number is empty for user ${userId}`);
    }
    // Insert into SMS queue
    const { error } = await supabase.from('sms_queue').insert({
      phone_number: phoneToUse,
      user_id: userId,
      message: notificationContent.smsContent,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        medication_id: medicationId,
        request_id: requestId
      }
    });
    if (error) {
      console.error(`[${requestId}] SMS queue insert error: ${error.message || JSON.stringify(error)}`);
      throw new Error(`Failed to queue SMS: ${error.message || 'Unknown error'}`);
    }
    console.log(`[${requestId}] SMS queued for ${phoneToUse}`);
    return {
      success: true,
      message: "SMS notification queued successfully"
    };
  } catch (error) {
    console.error(`[${requestId}] Error queuing SMS:`, error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}
// Main handler function
serve(async (req)=>{
  // Generate a unique request ID for tracing
  const requestId = generateRequestId();
  console.log(`[${requestId}] Processing request`);
  // IMPORTANT: Handle preflight requests properly
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] Handling OPTIONS preflight request`);
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }
  // Ensure the request is POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      success: false,
      message: "Method not allowed",
      timestamp: getFormattedTimestamp(),
      requestId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 405
    });
  }
  // Handle missing environment variables early and gracefully
  if (missingEnvVars.length > 0) {
    console.error(`[${requestId}] Missing environment variables: ${missingEnvVars.join(', ')}`);
    return new Response(JSON.stringify({
      success: false,
      message: "Server configuration error",
      error: `Missing environment variables: ${missingEnvVars.join(', ')}`,
      timestamp: getFormattedTimestamp(),
      requestId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // Verify connection to Supabase
    try {
      const { error: connError } = await supabase.from('profiles').select('count').limit(1);
      if (connError) {
        console.error(`[${requestId}] Supabase connection error: ${connError.message || JSON.stringify(connError)}`);
        throw new Error(`Supabase connection error: ${connError.message || 'Unknown error'}`);
      }
    } catch (connErr) {
      console.error(`[${requestId}] Failed to connect to Supabase: ${connErr.message || JSON.stringify(connErr)}`);
      throw new Error(`Failed to connect to Supabase: ${connErr.message || 'Unknown error'}`);
    }
    // Parse and validate request
    const requestBody = await req.json().catch((err)=>{
      console.error(`[${requestId}] JSON parse error: ${err.message || JSON.stringify(err)}`);
      throw new Error("Invalid JSON in request body");
    });
    // Validate request body against schema
    const validationResult = RequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map((issue)=>`${issue.path.join('.')}: ${issue.message}`).join(', ');
      return new Response(JSON.stringify({
        success: false,
        message: "Validation error",
        error: errorMessage,
        timestamp: getFormattedTimestamp(),
        requestId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    const { userId, medicationId, notificationType, customMessage, priorityLevel, scheduleTime } = validationResult.data;
    console.log(`[${requestId}] Processing ${notificationType} notification for user ${userId} and medication ${medicationId}`);
    // Get user information with more detailed selection and better error handling
    let userData;
    try {
      // First, check if the user exists without fetching specific columns that might not exist
      const { data: userExists, error: userExistsError } = await supabase.from('profiles').select('id').eq('id', userId).single();
      if (userExistsError) {
        console.error(`[${requestId}] User existence check error: ${userExistsError.message || JSON.stringify(userExistsError)}`);
        throw new Error(`Failed to check user existence: ${userExistsError.message || 'Unknown error'}`);
      }
      if (!userExists) {
        return new Response(JSON.stringify({
          success: false,
          message: "User not found",
          timestamp: getFormattedTimestamp(),
          requestId
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 404
        });
      }
      // Now get the full user data with safer column selection
      const { data: fullUserData, error: fullUserError } = await supabase.from('profiles').select('id, email, phone_number').eq('id', userId).single();
      if (fullUserError) {
        console.error(`[${requestId}] User fetch error: ${fullUserError.message || JSON.stringify(fullUserError)}`);
        throw new Error(`Failed to fetch user data: ${fullUserError.message || 'Unknown error'}`);
      }
      userData = fullUserData;
      // Optionally try to get first_name and last_name
      try {
        const { data: nameData } = await supabase.from('profiles').select('first_name, last_name').eq('id', userId).single();
        if (nameData) {
          userData = {
            ...userData,
            ...nameData
          };
        }
      } catch (nameError) {
        console.warn(`[${requestId}] Could not fetch user name data, continuing with basic user data: ${nameError.message || JSON.stringify(nameError)}`);
      }
    } catch (userError) {
      console.error(`[${requestId}] User data fetch error: ${userError.message || JSON.stringify(userError)}`);
      throw new Error(`Failed to fetch user data: ${userError.message || 'Unknown error'}`);
    }
    // Get medication details with expanded information
    const { data: medication, error: medError } = await supabase.from('medications').select('id, name, dosage, instructions').eq('id', medicationId).single();
    if (medError) {
      console.error(`[${requestId}] Medication fetch error: ${medError.message || JSON.stringify(medError)}`);
      throw new Error(`Failed to fetch medication data: ${medError.message || 'Unknown error'}`);
    }
    if (!medication) {
      return new Response(JSON.stringify({
        success: false,
        message: "Medication not found",
        timestamp: getFormattedTimestamp(),
        requestId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 404
      });
    }
    // Create notification content
    const notificationContent = createNotificationContent(userData, medication, customMessage, priorityLevel);
    // Check notification_logs table structure
    let notificationLogSuccess = true;
    try {
      const { error: structureError } = await supabase.from('notification_logs').select('count').limit(1);
      if (structureError) {
        console.warn(`[${requestId}] notification_logs table structure error: ${structureError.message || JSON.stringify(structureError)}`);
        notificationLogSuccess = false;
      }
    } catch (structErr) {
      console.warn(`[${requestId}] Failed to check notification_logs table: ${structErr.message || JSON.stringify(structErr)}`);
      notificationLogSuccess = false;
    }
    // Log this notification in the database for tracking
    if (notificationLogSuccess) {
      try {
        const { error: logError } = await supabase.from('notification_logs').insert({
          user_id: userId,
          medication_id: medicationId,
          notification_type: notificationType,
          content: notificationContent,
          priority_level: priorityLevel,
          scheduled_time: scheduleTime,
          request_id: requestId
        });
        if (logError) {
          console.warn(`[${requestId}] Failed to log notification: ${logError.message || JSON.stringify(logError)}`);
        // Non-blocking - continue execution
        }
      } catch (logError) {
        console.warn(`[${requestId}] Failed to log notification (caught): ${logError.message || JSON.stringify(logError)}`);
      // Non-blocking - continue execution
      }
    }
    // Determine what type of notification to send and track results
    const notificationResults = [];
    // Send email notification if requested - with improved checks for user email
    if ([
      'email',
      'both',
      'all'
    ].includes(notificationType)) {
      if (!userData.email || !userData.email.includes('@')) {
        console.warn(`[${requestId}] User ${userId} has no valid email address, skipping email notification`);
        notificationResults.push({
          success: false,
          channel: 'email',
          message: "Email notification skipped: user has no valid email address",
          timestamp: getFormattedTimestamp()
        });
      } else {
        try {
          console.log(`[${requestId}] Sending email notification to ${userData.email}`);
          const emailResult = await sendEmail(supabase, userData, notificationContent, userId, medicationId, requestId);
          notificationResults.push({
            success: true,
            channel: 'email',
            message: "Email notification queued successfully",
            timestamp: getFormattedTimestamp(),
            details: emailResult
          });
        } catch (error) {
          console.error(`[${requestId}] Email notification error: ${error.message || JSON.stringify(error)}`);
          notificationResults.push({
            success: false,
            channel: 'email',
            message: `Failed to send email: ${error.message || 'Unknown error'}`,
            timestamp: getFormattedTimestamp()
          });
        }
      }
    }
    // Send SMS notification if requested - with improved checks for phone number
    if ([
      'sms',
      'both',
      'all'
    ].includes(notificationType)) {
      if (!userData.phone_number || userData.phone_number.trim() === '') {
        console.warn(`[${requestId}] User ${userId} has no valid phone number, skipping SMS notification`);
        notificationResults.push({
          success: false,
          channel: 'sms',
          message: "SMS notification skipped: user has no valid phone number",
          timestamp: getFormattedTimestamp()
        });
      } else {
        try {
          console.log(`[${requestId}] Sending SMS notification to ${userData.phone_number}`);
          const smsResult = await sendSms(supabase, userData, notificationContent, userId, medicationId, requestId);
          notificationResults.push({
            success: true,
            channel: 'sms',
            message: "SMS notification queued successfully",
            timestamp: getFormattedTimestamp(),
            details: smsResult
          });
        } catch (error) {
          console.error(`[${requestId}] SMS notification error: ${error.message || JSON.stringify(error)}`);
          notificationResults.push({
            success: false,
            channel: 'sms',
            message: `Failed to send SMS: ${error.message || 'Unknown error'}`,
            timestamp: getFormattedTimestamp()
          });
        }
      }
    }
    // Send ESP32 notification if requested and ESP32_ENDPOINT is available
    if ([
      'esp32',
      'both',
      'all'
    ].includes(notificationType)) {
      const esp32Endpoint = Deno.env.get('ESP32_ENDPOINT');
      if (!esp32Endpoint) {
        console.error(`[${requestId}] ESP32_ENDPOINT environment variable not set`);
        notificationResults.push({
          success: false,
          channel: 'esp32',
          message: "ESP32 notification failed: ESP32_ENDPOINT not configured",
          timestamp: getFormattedTimestamp()
        });
      } else {
        try {
          // Get device information for this user
          const { data: deviceData, error: deviceError } = await supabase.from('user_devices').select('id, device_id, device_token').eq('user_id', userId).eq('device_type', 'esp32').eq('is_active', true);
          if (deviceError) {
            console.error(`[${requestId}] Device fetch error: ${deviceError.message || JSON.stringify(deviceError)}`);
            throw deviceError;
          }
          if (!deviceData || deviceData.length === 0) {
            notificationResults.push({
              success: false,
              channel: 'esp32',
              message: "No active ESP32 devices found for this user",
              timestamp: getFormattedTimestamp()
            });
          } else {
            // Send notification to all active ESP32 devices
            const esp32Responses = await Promise.allSettled(deviceData.map(async (device)=>{
              try {
                const esp32Response = await fetch(esp32Endpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    device_id: device.device_id,
                    device_token: device.device_token,
                    notification: notificationContent.esp32Content,
                    requestId
                  })
                });
                if (!esp32Response.ok) {
                  throw new Error(`ESP32 device responded with status: ${esp32Response.status}`);
                }
                return await esp32Response.json();
              } catch (err) {
                console.error(`[${requestId}] ESP32 fetch error for device ${device.device_id}: ${err.message || JSON.stringify(err)}`);
                throw new Error(`Failed to connect to ESP32 endpoint for device ${device.device_id}: ${err.message || 'Unknown error'}`);
              }
            }));
            // Process ESP32 responses
            const successfulDevices = esp32Responses.filter((result)=>result.status === 'fulfilled').map((result)=>result.value);
            const failedDevices = esp32Responses.filter((result)=>result.status === 'rejected').map((result)=>result.reason);
            if (successfulDevices.length > 0) {
              notificationResults.push({
                success: true,
                channel: 'esp32',
                message: `ESP32 notifications sent to ${successfulDevices.length} device(s)`,
                timestamp: getFormattedTimestamp(),
                details: {
                  successfulDevices
                }
              });
            }
            if (failedDevices.length > 0) {
              notificationResults.push({
                success: false,
                channel: 'esp32',
                message: `Failed to send ESP32 notifications to ${failedDevices.length} device(s)`,
                timestamp: getFormattedTimestamp(),
                details: {
                  failedDevices
                }
              });
            }
          }
        } catch (error) {
          console.error(`[${requestId}] ESP32 notification error: ${error.message || JSON.stringify(error)}`);
          notificationResults.push({
            success: false,
            channel: 'esp32',
            message: `ESP32 notification error: ${error.message || 'Unknown error'}`,
            timestamp: getFormattedTimestamp()
          });
        }
      }
    }
    // Check if any notifications succeeded
    const anySuccess = notificationResults.some((result)=>result.success);
    // Update the notification log with results
    if (notificationLogSuccess) {
      try {
        const { error: updateError } = await supabase.from('notification_logs').update({
          delivered: anySuccess,
          delivery_details: notificationResults,
          updated_at: new Date().toISOString()
        }).eq('request_id', requestId);
        if (updateError) {
          console.warn(`[${requestId}] Failed to update notification log: ${updateError.message || JSON.stringify(updateError)}`);
        // Non-blocking - continue execution
        }
      } catch (updateError) {
        console.warn(`[${requestId}] Failed to update notification log (caught): ${updateError.message || JSON.stringify(updateError)}`);
      // Non-blocking - continue execution
      }
    }
    // Prepare the response
    const response = {
      success: anySuccess,
      message: anySuccess ? `Successfully sent ${notificationResults.filter((r)=>r.success).length} notification(s)` : "Failed to send notifications",
      notifications: notificationResults,
      timestamp: getFormattedTimestamp(),
      requestId
    };
    console.log(`[${requestId}] Request completed with status: ${anySuccess ? 'success' : 'failure'}`);
    // IMPORTANT: Always include CORS headers in the response
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: anySuccess ? 200 : 207
    });
  } catch (error) {
    console.error(`[${requestId}] Unhandled error: ${error.message || JSON.stringify(error)}`);
    // IMPORTANT: Always include CORS headers in error responses too
    return new Response(JSON.stringify({
      success: false,
      message: "Server error",
      error: error.message || "An unknown error occurred",
      timestamp: getFormattedTimestamp(),
      requestId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
