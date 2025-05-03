
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Environment variables
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");
const fromEmail = Deno.env.get("FROM_EMAIL") || "notifications@yourappdomain.com";
const appName = Deno.env.get("APP_NAME") || "MedTracker";

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Initialize clients
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
};

//Process pending emails in the queue
async function processEmailQueue() {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Starting to process email queue`);
  
  // Check if Resend is initialized
  if (!resend) {
    console.error(`[${requestId}] Error: Resend API key is not configured`);
    return {
      processed: 0,
      failed: 0,
      error: "Resend API key is not configured"
    };
  }
  
  try {
    // Get pending emails from the queue
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(20);
    
    if (error) {
      console.error(`[${requestId}] Error fetching emails: ${error.message}`);
      return {
        processed: 0,
        failed: 0,
        error: error.message
      };
    }
    
    if (!emails || emails.length === 0) {
      console.log(`[${requestId}] No pending emails to process`);
      return {
        processed: 0,
        failed: 0
      };
    }
    
    console.log(`[${requestId}] Processing ${emails.length} emails`);
    
    let successCount = 0;
    let failedCount = 0;
    
    // Process each email
    for (const email of emails) {
      const emailId = email.id;
      console.log(`[${requestId}] Processing email ${emailId}`);
      
      try {
        // Mark as processing
        await supabase
          .from('email_queue')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);
        
        // Get recipient email - check both email and to fields for backward compatibility
        let recipientEmail = email.email || email.to;
        
        // If no direct email is found but we have a user_id
        if ((!recipientEmail || recipientEmail.trim() === '') && email.user_id) {
          console.log(`[${requestId}] No direct email found, looking up email for user_id: ${email.user_id}`);
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', email.user_id)
            .single();
            
          if (userError) {
            console.error(`[${requestId}] Error fetching user data: ${userError.message}`);
            throw new Error(`Could not find email for user_id: ${email.user_id}`);
          }
          
          if (!userData || !userData.email) {
            throw new Error(`No email found for user_id: ${email.user_id}`);
          }
          
          recipientEmail = userData.email;
          console.log(`[${requestId}] Found email ${recipientEmail} for user_id: ${email.user_id}`);
        }
        
        if (!recipientEmail || recipientEmail.trim() === '') {
          throw new Error("No recipient email address found");
        }

        console.log(`[${requestId}] Sending email to ${recipientEmail} with subject: ${email.subject}`);
        
        // Send the email using Resend API
        const response = await resend.emails.send({
          from: `${appName} <${fromEmail}>`,
          to: [recipientEmail],
          subject: email.subject,
          html: email.body
        });
        
        console.log(`[${requestId}] Resend API response:`, response);
        
        if (response && response.id) {
          // Mark as sent
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              updated_at: new Date().toISOString(),
              metadata: {
                ...email.metadata,
                resend_id: response.id
              }
            })
            .eq('id', emailId);
            
          console.log(`[${requestId}] Email sent to ${recipientEmail}, Resend ID: ${response.id}`);
          successCount++;
        } else {
          throw new Error("No response ID received from Resend");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[${requestId}] Failed to send email ${emailId}: ${errorMessage}`);
        failedCount++;
        
        // Increment retry count
        const retries = (email.retries || 0) + 1;
        
        // Mark as failed
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            retries: retries,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);
          
        // If there have been fewer than 3 retry attempts, schedule a retry
        if (retries < 3) {
          await supabase
            .from('email_queue')
            .update({
              status: 'pending',
              next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // retry in 15 minutes
            })
            .eq('id', emailId);
        }
      }
    }
    
    console.log(`[${requestId}] Email processing complete. Sent: ${successCount}, Failed: ${failedCount}`);
    
    return {
      processed: successCount,
      failed: failedCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error in processing email queue: ${errorMessage}`);
    
    return {
      processed: 0,
      failed: 0,
      error: errorMessage
    };
  }
}

/**
 * Add a new email to the queue
 */ 
async function addToEmailQueue(req) {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Adding new email to queue`);
  
  try {
    const data = await req.json();
    const { to, email, user_id, subject, body, priority, metadata } = data;
    
    // Use email field if provided, otherwise use to field
    const recipientEmail = email || to;
    
    // Validate required fields based on your schema
    if (!subject) {
      throw new Error("Missing required parameter: subject");
    }
    if (!body) {
      throw new Error("Missing required parameter: body");
    }
    if (!recipientEmail && !user_id) {
      throw new Error("Missing required parameter: either 'email', 'to' (email address) or 'user_id' is required");
    }
    
    console.log(`[${requestId}] Email data validated, adding to queue`);
    
    // If only user_id is provided, verify the user exists and has an email
    if (!recipientEmail && user_id) {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user_id)
        .single();
        
      if (userError || !userData || !userData.email) {
        throw new Error(`Could not find valid email for user_id: ${user_id}`);
      }
      
      console.log(`[${requestId}] Found email for user_id ${user_id}: ${userData.email}`);
    }
    
    // Add to queue - store in both email and to fields for compatibility
    const { data: newEmail, error } = await supabase
      .from('email_queue')
      .insert({
        email: recipientEmail,
        to: recipientEmail,
        user_id,
        subject,
        body,
        status: 'pending',
        created_at: new Date().toISOString(),
        metadata: metadata || {}
      })
      .select();
      
    if (error) {
      throw error;
    }
    
    console.log(`[${requestId}] Email added to queue with ID: ${newEmail[0].id}`);
    
    return {
      success: true,
      message: "Email added to queue successfully",
      id: newEmail[0].id,
      requestId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error adding email to queue: ${errorMessage}`);
    throw error;
  }
}

/**
 * Handles health endpoint checks
 */ 
async function handleHealthCheck() {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Health check requested`);
  
  try {
    // Check if required environment variables are set
    const missingVars = [];
    if (!resendApiKey) missingVars.push("RESEND_API_KEY");
    if (!supabaseUrl) missingVars.push("SUPABASE_URL");
    if (!supabaseServiceKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
    
    if (missingVars.length > 0) {
      console.warn(`[${requestId}] Missing environment variables: ${missingVars.join(", ")}`);
    }
    
    // Check Supabase connection
    const { data, error } = await supabase.from('email_queue').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection error: ${error.message}`);
    }
    
    console.log(`[${requestId}] Health check passed`);
    
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        supabase: "connected",
        resend: resendApiKey ? "configured" : "not configured"
      },
      requestId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Health check failed: ${errorMessage}`);
    
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: errorMessage,
      services: {
        supabase: errorMessage.includes("Supabase") ? "disconnected" : "unknown",
        resend: resendApiKey ? "configured" : "not configured"
      },
      requestId
    };
  }
}

/**
 * Main request handler for the function
 */ 
serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Email queue function received request: ${req.method} ${new URL(req.url).pathname}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200
    });
  }
  
  try {
    // Get URL to determine function mode
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "add";
    
    console.log(`[${requestId}] Function mode: ${mode}`);
    
    // Check authorization for scheduled tasks
    if (mode === "process" || mode === "cron") {
      // Verify that the cron secret matches for scheduled tasks
      const authHeader = req.headers.get("Authorization") || "";
      const providedSecret = authHeader.replace("Bearer ", "");
      
      if (!cronSecret || providedSecret !== cronSecret) {
        console.error(`[${requestId}] Unauthorized access attempt with provided secret: ${providedSecret}`);
        
        return new Response(JSON.stringify({
          error: "Unauthorized",
          requestId
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 401
        });
      }
      
      console.log(`[${requestId}] Authorization successful, processing email queue`);
      
      // Process email queue
      const result = await processEmailQueue();
      
      return new Response(JSON.stringify({
        success: true,
        result,
        requestId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    } else if (mode === "health" || mode === "healthcheck") {
      // Handle health check requests
      const healthStatus = await handleHealthCheck();
      const statusCode = healthStatus.status === "healthy" ? 200 : 500;
      
      return new Response(JSON.stringify(healthStatus), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: statusCode
      });
    } else if (mode === "add") {
      // Add new email to queue
      const result = await addToEmailQueue(req);
      
      return new Response(JSON.stringify({
        ...result,
        requestId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error in edge function: ${errorMessage}`);
    
    return new Response(JSON.stringify({
      error: errorMessage,
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

// Log that the function is ready
console.log(`Email queue function initialized. Using URL: ${supabaseUrl}`);
