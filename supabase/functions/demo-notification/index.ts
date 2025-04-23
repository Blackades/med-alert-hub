import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { z } from 'https://esm.sh/zod@3.22.4';

// Environment validation
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ESP32_ENDPOINT'
];

for (const envVar of requiredEnvVars) {
  if (!Deno.env.get(envVar)) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// Input validation schema
const RequestSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  medicationId: z.string().uuid("Invalid medication ID format"),
  notificationType: z.enum(['email', 'sms', 'esp32', 'both', 'all']),
  customMessage: z.string().optional(),
  priorityLevel: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  scheduleTime: z.string().optional().default(() => new Date().toISOString()),
});

// Types for better code organization
type NotificationResult = {
  success: boolean;
  channel: string;
  message: string;
  timestamp: string;
  details?: any;
};

type ApiResponse = {
  success: boolean;
  message: string;
  notifications?: NotificationResult[];
  error?: string;
  timestamp: string;
  requestId: string;
};

// Generate a unique ID for each request for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper for formatted timestamps
const getFormattedTimestamp = () => {
  return new Date().toISOString();
};

// Function to create appropriate notification content
function createNotificationContent(
  userData: any, 
  medication: any, 
  customMessage?: string, 
  priorityLevel: string = 'medium'
) {
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

  // Base message content
  let messageContent = `
Hello ${userData.first_name || 'there'},

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
    priority: priorityLevel,
  };

  return {
    subject,
    emailContent: messageContent,
    smsContent,
    esp32Content
  };
}

// Main handler function
serve(async (req) => {
  // Generate a unique request ID for tracing
  const requestId = generateRequestId();
  console.log(`[${requestId}] Processing request`);
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }
  
  // Ensure the request is POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
        timestamp: getFormattedTimestamp(),
        requestId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Parse and validate request
    const requestBody = await req.json().catch(() => {
      throw new Error("Invalid JSON in request body");
    });
    
    // Validate request body against schema
    const validationResult = RequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          error: errorMessage,
          timestamp: getFormattedTimestamp(),
          requestId
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    const { 
      userId, 
      medicationId, 
      notificationType, 
      customMessage, 
      priorityLevel,
      scheduleTime 
    } = validationResult.data;

    console.log(`[${requestId}] Processing ${notificationType} notification for user ${userId} and medication ${medicationId}`);
    
    // Get user information with more detailed selection
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email, phone_number, first_name, last_name, notification_preferences, timezone')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error(`[${requestId}] User fetch error:`, userError);
      throw new Error(`Failed to fetch user data: ${userError.message}`);
    }
    
    if (!userData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User not found",
          timestamp: getFormattedTimestamp(),
          requestId
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }
    
    // Get medication details with expanded information
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('id, name, dosage, instructions, frequency, start_date, end_date, refill_reminder, side_effects')
      .eq('id', medicationId)
      .single();
      
    if (medError) {
      console.error(`[${requestId}] Medication fetch error:`, medError);
      throw new Error(`Failed to fetch medication data: ${medError.message}`);
    }
    
    if (!medication) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Medication not found",
          timestamp: getFormattedTimestamp(),
          requestId
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Create notification content
    const notificationContent = createNotificationContent(
      userData, 
      medication, 
      customMessage, 
      priorityLevel
    );
    
    // Log this notification in the database for tracking
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        medication_id: medicationId,
        notification_type: notificationType,
        content: notificationContent,
        priority_level: priorityLevel,
        scheduled_time: scheduleTime,
        request_id: requestId
      });
    
    if (logError) {
      console.warn(`[${requestId}] Failed to log notification:`, logError);
      // Non-blocking - continue execution
    }
    
    // Determine what type of notification to send and track results
    const notificationResults: NotificationResult[] = [];
    
    // Send email notification if requested
    if (['email', 'both', 'all'].includes(notificationType) && userData.email) {
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: userData.email,
            subject: notificationContent.subject,
            text: notificationContent.emailContent,
            userId,
            medicationId,
            requestId
          }),
        });
        
        if (!emailResponse.ok) {
          throw new Error(`Email service responded with status: ${emailResponse.status}`);
        }
        
        const emailResult = await emailResponse.json();
        
        notificationResults.push({
          success: true,
          channel: 'email',
          message: "Email notification sent successfully",
          timestamp: getFormattedTimestamp(),
          details: emailResult
        });
      } catch (error) {
        console.error(`[${requestId}] Email notification error:`, error);
        notificationResults.push({
          success: false,
          channel: 'email',
          message: `Failed to send email: ${error.message}`,
          timestamp: getFormattedTimestamp()
        });
      }
    }
    
    // Send SMS notification if requested
    if (['sms', 'both', 'all'].includes(notificationType) && userData.phone_number) {
      try {
        const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: userData.phone_number,
            message: notificationContent.smsContent,
            userId,
            medicationId,
            requestId
          }),
        });
        
        if (!smsResponse.ok) {
          throw new Error(`SMS service responded with status: ${smsResponse.status}`);
        }
        
        const smsResult = await smsResponse.json();
        
        notificationResults.push({
          success: true,
          channel: 'sms',
          message: "SMS notification sent successfully",
          timestamp: getFormattedTimestamp(),
          details: smsResult
        });
      } catch (error) {
        console.error(`[${requestId}] SMS notification error:`, error);
        notificationResults.push({
          success: false,
          channel: 'sms',
          message: `Failed to send SMS: ${error.message}`,
          timestamp: getFormattedTimestamp()
        });
      }
    }
    
    // Send ESP32 notification if requested
    if (['esp32', 'both', 'all'].includes(notificationType)) {
      try {
        // Get device information for this user
        const { data: deviceData, error: deviceError } = await supabase
          .from('user_devices')
          .select('device_id, device_token')
          .eq('user_id', userId)
          .eq('device_type', 'esp32')
          .eq('is_active', true);
          
        if (deviceError) throw deviceError;
        
        if (deviceData && deviceData.length > 0) {
          // Send notification to all active ESP32 devices
          const esp32Responses = await Promise.allSettled(
            deviceData.map(async (device) => {
              const esp32Response = await fetch(Deno.env.get('ESP32_ENDPOINT') || '', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  device_id: device.device_id,
                  device_token: device.device_token,
                  notification: notificationContent.esp32Content,
                  requestId
                }),
              });
              
              if (!esp32Response.ok) {
                throw new Error(`ESP32 service responded with status: ${esp32Response.status}`);
              }
              
              return await esp32Response.json();
            })
          );
          
          // Process ESP32 responses
          const successfulDevices = esp32Responses
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<any>).value);
            
          const failedDevices = esp32Responses
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);
          
          if (successfulDevices.length > 0) {
            notificationResults.push({
              success: true,
              channel: 'esp32',
              message: `ESP32 notifications sent to ${successfulDevices.length} device(s)`,
              timestamp: getFormattedTimestamp(),
              details: { successfulDevices }
            });
          }
          
          if (failedDevices.length > 0) {
            notificationResults.push({
              success: false,
              channel: 'esp32',
              message: `Failed to send ESP32 notifications to ${failedDevices.length} device(s)`,
              timestamp: getFormattedTimestamp(),
              details: { failedDevices }
            });
          }
        } else {
          notificationResults.push({
            success: false,
            channel: 'esp32',
            message: "No active ESP32 devices found for this user",
            timestamp: getFormattedTimestamp()
          });
        }
      } catch (error) {
        console.error(`[${requestId}] ESP32 notification error:`, error);
        notificationResults.push({
          success: false,
          channel: 'esp32',
          message: `ESP32 notification error: ${error.message}`,
          timestamp: getFormattedTimestamp()
        });
      }
    }
    
    // Check if any notifications succeeded
    const anySuccess = notificationResults.some(result => result.success);
    
    // Update the notification log with results
    await supabase
      .from('notification_logs')
      .update({ 
        delivered: anySuccess,
        delivery_details: notificationResults,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId);
    
    // Prepare the response
    const response: ApiResponse = {
      success: anySuccess,
      message: anySuccess 
        ? `Successfully sent ${notificationResults.filter(r => r.success).length} notification(s)`
        : "Failed to send notifications",
      notifications: notificationResults,
      timestamp: getFormattedTimestamp(),
      requestId
    };
    
    console.log(`[${requestId}] Request completed with status: ${anySuccess ? 'success' : 'failure'}`);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: anySuccess ? 200 : 207, // Use 207 Multi-Status when some succeeded and some failed
    });
    
  } catch (error) {
    console.error(`[${requestId}] Unhandled error:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: "Server error",
        error: error.message || "An unknown error occurred",
        timestamp: getFormattedTimestamp(),
        requestId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
