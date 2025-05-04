
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Define CORS headers for browser compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Email queue processing triggered`);
  
  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Initialize Resend email client
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    const resend = new Resend(resendApiKey);
    
    // Get pending emails from queue
    const { data: pendingEmails, error: queueError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process in batches
    
    if (queueError) {
      throw new Error(`Failed to fetch pending emails: ${queueError.message}`);
    }
    
    console.log(`[${requestId}] Found ${pendingEmails?.length || 0} pending emails to process`);
    
    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No pending emails to process",
        processed: 0,
        failed: 0
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    let processed = 0;
    let failed = 0;
    
    // Process each email
    for (const email of pendingEmails) {
      try {
        console.log(`[${requestId}] Processing email ID ${email.id} to ${email.email}`);
        
        // Get app name from environment or use default
        const appName = Deno.env.get("APP_NAME") || "MedTracker";
        const fromEmail = Deno.env.get("FROM_EMAIL") || "notifications@medtracker.app";
        
        // Send email using Resend
        const result = await resend.emails.send({
          from: `${appName} <${fromEmail}>`,
          to: [email.email],
          subject: email.subject,
          html: email.body
        });
        
        console.log(`[${requestId}] Email sent successfully:`, result);
        
        // Update email status in queue
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            result: result
          })
          .eq('id', email.id);
        
        if (updateError) {
          console.error(`[${requestId}] Failed to update email status:`, updateError);
          failed++;
        } else {
          processed++;
        }
      } catch (emailError) {
        console.error(`[${requestId}] Failed to send email:`, emailError);
        
        // Update email status to failed
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            error: emailError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);
        
        if (updateError) {
          console.error(`[${requestId}] Failed to update email failure status:`, updateError);
        }
        
        failed++;
      }
    }
    
    console.log(`[${requestId}] Email processing complete. Processed: ${processed}, Failed: ${failed}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processed} emails, ${failed} failed`,
      processed,
      failed
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(`[${requestId}] Error processing email queue:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

console.log("Email queue processor initialized");
