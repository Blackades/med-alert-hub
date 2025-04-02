
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
  instructions?: string,
  action?: string
) {
  console.log(`Attempting to send ${isReminder ? 'reminder' : 'notification'} email to: ${email} for medication: ${medication}`);
  
  try {
    // Handle different email subjects and templates based on action
    let subject = '';
    let htmlContent = '';
    
    if (isReminder) {
      subject = `Reminder: Time to take ${medication} at ${scheduledTime}`;
      htmlContent = `
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
      `;
    } else if (action === 'miss' || action === 'skip') {
      const actionText = action === 'miss' ? 'missed' : 'skipped';
      subject = `Medication ${actionText}: ${medication}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: ${action === 'miss' ? '#e57373' : '#ffb74d'};">Medication ${actionText}</h1>
          <p>We've recorded that you've ${actionText} the following medication:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">${medication}</h2>
            <p><strong>Dosage:</strong> ${dosage}</p>
            <p><strong>Scheduled Time:</strong> ${scheduledTime}</p>
          </div>
          <p>If this was a mistake, please update your record in the medication app.</p>
        </div>
      `;
    } else {
      // Default confirmation email for taken medication
      subject = `Confirmation: ${medication} taken`;
      htmlContent = `
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
      `;
    }
    
    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // Using Resend's default verified domain
      to: [email],
      subject: subject,
      html: htmlContent
    });
    
    console.log("Email sent successfully:", response);
    return response;
    
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Sends a low stock alert email
 */
async function sendLowStockAlert(
  email: string,
  medication: string,
  dosage: string,
  currentQuantity: number
) {
  console.log(`Sending low stock alert for ${medication} to ${email}`);
  
  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [email],
      subject: `Low Stock Alert: ${medication}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f44336;">Low Medication Stock Alert</h1>
          <p>Your supply of the following medication is running low:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">${medication}</h2>
            <p><strong>Dosage:</strong> ${dosage}</p>
            <p><strong>Current Quantity:</strong> ${currentQuantity}</p>
          </div>
          <p>Please refill this medication soon to avoid missing doses.</p>
          <p>You can record your refill in the MedAlert app once you've obtained more medication.</p>
        </div>
      `
    });
    
    console.log("Low stock alert sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending low stock alert:", error);
    throw error;
  }
}

/**
 * Handle manual notification sending from the frontend
 */
async function handleManualNotification(req: Request) {
  const { 
    email, 
    medication, 
    dosage, 
    scheduledTime, 
    isReminder, 
    userId, 
    medicationId,
    isLowStockAlert,
    currentQuantity,
    phoneNumber,
    instructions,
    action
  } = await req.json();
  
  console.log(`Starting to send notification email to ${email}`);
  
  if (!email || !medication || !dosage) {
    throw new Error("Missing required parameters");
  }
  
  let emailResponse;
  
  // Handle different notification types
  if (isLowStockAlert) {
    emailResponse = await sendLowStockAlert(email, medication, dosage, currentQuantity);
    
    // Record the notification in the database
    if (userId && medicationId) {
      try {
        await supabase.from('medication_alerts').insert({
          user_id: userId,
          medication_id: medicationId,
          scheduled_time: new Date().toISOString(),
          alert_type: 'low_stock',
          status: 'sent',
          manual_trigger: true
        });
      } catch (dbError) {
        console.error('Error recording low stock alert in database:', dbError);
      }
    }
  } else {
    // Regular medication reminder/confirmation
    emailResponse = await sendMedicationEmail(
      email,
      medication,
      dosage,
      scheduledTime || new Date().toLocaleTimeString(),
      isReminder,
      instructions,
      action
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
        if (!isReminder && action === 'take') {
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
  }
  
  // If phone number is provided and SMS is needed, implement SMS sending here
  if (phoneNumber && isLowStockAlert) {
    // This would be implemented with a service like Twilio
    console.log(`Would send SMS to ${phoneNumber} about low stock of ${medication}`);
  }
  
  console.log("Email notification processed");
  return { success: true, message: "Notification sent successfully" };
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
