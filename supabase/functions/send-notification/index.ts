
// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Environment variables
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");

// Initialize clients
const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sends a medication reminder email
 */
async function sendMedicationEmail(
  email: string, 
  medication: string, 
  dosage: string, 
  scheduledTime: string, 
  isReminder: boolean,
  instructions?: string
) {
  console.log(`Attempting to send email to: ${email} for medication: ${medication}`);
  
  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // Using Resend's default verified domain
      to: [email],
      subject: isReminder 
        ? `Reminder: Time to take ${medication} at ${scheduledTime}`
        : `Confirmation: ${medication} taken`,
      html: isReminder ? `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #48BBB5;">Upcoming Medication Reminder</h1>
          <p>This is a reminder that you need to take your medication in 15 minutes:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">${medication}</h2>
            <p><strong>Dosage:</strong> ${dosage}</p>
            ${instructions ? `<p><strong>Instructions:</strong> ${instructions}</p>` : ''}
            <p><strong>Scheduled Time:</strong> ${scheduledTime}</p>
          </div>
          <p>Please make sure to take your medication as prescribed.</p>
          <p>Stay healthy!</p>
          <p style="font-size: 12px; color: #777; margin-top: 30px;">
            If you no longer want to receive these reminders, you can update your notification preferences in the app settings.
          </p>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #48BBB5;">Medication Taken</h1>
          <p>This confirms that you've taken your medication:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">${medication}</h2>
            <p><strong>Dosage:</strong> ${dosage}</p>
            <p><strong>Time Taken:</strong> ${scheduledTime}</p>
          </div>
          <p>Great job staying on track with your medication!</p>
          <p style="font-size: 12px; color: #777; margin-top: 30px;">
            This is an automated confirmation from MedAlert.
          </p>
        </div>
      `,
    });
    
    console.log("Email sent successfully:", response);
    return response;
    
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Handle manual notification sending from the frontend
 */
async function handleManualNotification(req: Request) {
  const { email, medication, dosage, scheduledTime, isReminder, userId, medicationId } = await req.json();
  
  console.log(`Starting to send ${isReminder ? 'reminder' : 'confirmation'} email to ${email}`);
  
  if (!email || !medication || !dosage || !scheduledTime) {
    throw new Error("Missing required parameters");
  }
  
  // Send the email
  const emailResponse = await sendMedicationEmail(
    email,
    medication,
    dosage,
    scheduledTime,
    isReminder
  );
  
  // If we have user and medication IDs, record this in the database
  if (userId && medicationId) {
    try {
      await supabase.from('medication_alerts').insert({
        user_id: userId,
        medication_id: medicationId,
        scheduled_time: new Date().toISOString(),
        alert_type: 'email',
        status: 'sent',
        manual_trigger: true
      });
      
      // If this is a confirmation (not a reminder), mark as taken
      if (!isReminder) {
        await supabase.from('medication_logs').insert({
          user_id: userId,
          medication_id: medicationId,
          taken_at: new Date().toISOString(),
          scheduled_time: scheduledTime,
          status: 'taken'
        });
      }
    } catch (dbError) {
      console.error('Error recording notification in database:', dbError);
      // Continue anyway - the important part is the email was sent
    }
  }
  
  console.log("Email notification processed");
  return { success: true, message: "Email sent successfully" };
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Check if this is a scheduled invocation via cron
    const isScheduled = req.headers.get('Authorization') === `Bearer ${cronSecret}`;
    
    let result;
    
    if (isScheduled) {
      // This is a scheduled job (not implemented in this function)
      result = { success: true, message: "Scheduled execution is handled by medication-alerts function" };
    } else if (req.method === "POST") {
      // This is a manual notification request from the frontend
      result = await handleManualNotification(req);
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error processing notification:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.response?.body || "No additional details" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
