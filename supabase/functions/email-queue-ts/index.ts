import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
// Environment variables
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");
const fromEmail = Deno.env.get("FROM_EMAIL") || "notifications@yourappdomain.com";
const appName = Deno.env.get("APP_NAME") || "YourApp";
// Initialize clients
const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
//Process pending emails in the queue
async function processEmailQueue() {
  console.log("Starting to process email queue");
  try {
    // Get pending emails from the queue
    const { data: emails, error } = await supabase.from('email_queue').select('*').eq('status', 'pending').limit(20);
    if (error) {
      console.error('Error fetching emails:', error);
      return {
        processed: 0,
        failed: 0,
        error: error.message
      };
    }
    if (!emails || emails.length === 0) {
      console.log('No pending emails to process');
      return {
        processed: 0,
        failed: 0
      };
    }
    console.log(`Processing ${emails.length} emails`);
    let successCount = 0;
    let failedCount = 0;
    // Process each email
    for (const email of emails){
      try {
        // Mark as processing
        await supabase.from('email_queue').update({
          status: 'processing',
          updated_at: new Date().toISOString()
        }).eq('id', email.id);
        
        // Get recipient email - check both email and to fields for backward compatibility
        let recipientEmail = email.email || email.to;
        
        // If no direct email is found but we have a user_id
        if ((!recipientEmail || recipientEmail.trim() === '') && email.user_id) {
          console.log(`No direct email found, looking up email for user_id: ${email.user_id}`);
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', email.user_id)
            .single();
            
          if (userError) {
            console.error(`Error fetching user data: ${userError.message}`);
            throw new Error(`Could not find email for user_id: ${email.user_id}`);
          }
          
          if (!userData || !userData.email) {
            throw new Error(`No email found for user_id: ${email.user_id}`);
          }
          
          recipientEmail = userData.email;
          console.log(`Found email ${recipientEmail} for user_id: ${email.user_id}`);
        }
        
        if (!recipientEmail || recipientEmail.trim() === '') {
          throw new Error("No recipient email address found");
        }
        // Send the email using Resend API
        const response = await resend.emails.send({
          from: fromEmail,
          to: [
            recipientEmail
          ],
          subject: email.subject,
          html: email.body // Using 'body' rather than 'html_body' based on your schema
        });
        if (response && response.id) {
          // Mark as sent
          await supabase.from('email_queue').update({
            status: 'sent',
            updated_at: new Date().toISOString(),
            metadata: {
              ...email.metadata,
              resend_id: response.id
            }
          }).eq('id', email.id);
          console.log(`Email sent to ${recipientEmail}, Resend ID: ${response.id}`);
          successCount++;
        } else {
          throw new Error("No response ID received from Resend");
        }
      } catch (err) {
        console.error(`Failed to send email ${email.id}:`, err);
        failedCount++;
        // Increment retry count
        const retries = (email.retries || 0) + 1;
        // Mark as failed
        await supabase.from('email_queue').update({
          status: 'failed',
          error_message: err.message || 'Unknown error',
          retries: retries,
          updated_at: new Date().toISOString()
        }).eq('id', email.id);
        // If there have been fewer than 3 retry attempts, schedule a retry
        if (retries < 3) {
          await supabase.from('email_queue').update({
            status: 'pending',
            next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // retry in 15 minutes
          }).eq('id', email.id);
        }
      }
    }
    console.log(`Email processing complete. Sent: ${successCount}, Failed: ${failedCount}`);
    return {
      processed: successCount,
      failed: failedCount
    };
  } catch (error) {
    console.error('Error in processing email queue:', error);
    return {
      processed: 0,
      failed: 0,
      error: error.message
    };
  }
}
/**
 * Add a new email to the queue
 */ async function addToEmailQueue(req) {
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
    }
    
    // Add to queue - store in both email and to fields for compatibility
    const { data: newEmail, error } = await supabase.from('email_queue').insert({
      email: recipientEmail,
      to: recipientEmail,
      user_id,
      subject,
      body,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: metadata || {}
    }).select();
    
    if (error) {
      throw error;
    }
    
    return {
      success: true,
      message: "Email added to queue successfully",
      id: newEmail[0].id
    };
  } catch (error) {
    console.error("Error adding email to queue:", error);
    throw error;
  }
}
/**
 * Handles health endpoint checks
 */ async function handleHealthCheck() {
  try {
    // Check Supabase connection
    const { data, error } = await supabase.from('email_queue').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection error: ${error.message}`);
    }
    // Check Resend API connection (optional - you can comment this out if you're concerned about sending test emails)
    /*
    const resendTestResponse = await resend.emails.send({
      from: fromEmail,
      to: "health-check@internal.yourappdomain.com",
      subject: "Health check",
      html: "<p>Service health check</p>"
    });
    
    if (!resendTestResponse || !resendTestResponse.id) {
      throw new Error("Failed to connect to Resend API");
    }
    */ return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        supabase: "connected"
      }
    };
  } catch (error) {
    console.error("Health check failed:", error);
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        supabase: error.message.includes("Supabase") ? "disconnected" : "unknown"
      }
    };
  }
}
/**
 * Main request handler for the function
 */ serve(async (req)=>{
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
    // Check authorization for scheduled tasks
    if (mode === "process" || mode === "cron") {
      // Verify that the cron secret matches for scheduled tasks
      const authHeader = req.headers.get("Authorization") || "";
      const providedSecret = authHeader.replace("Bearer ", "");
      if (!cronSecret || providedSecret !== cronSecret) {
        return new Response(JSON.stringify({
          error: "Unauthorized"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 401
        });
      }
      // Process email queue
      const result = await processEmailQueue();
      return new Response(JSON.stringify({
        success: true,
        result
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
      return new Response(JSON.stringify(result), {
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
    console.error("Error in edge function:", error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: Deno.env.get("NODE_ENV") === "development" ? error.stack : undefined
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
