// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { parse, format, addMinutes, differenceInMinutes } from "https://esm.sh/date-fns@2.30.0";

// Environment variables
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");
const fromEmail = Deno.env.get("FROM_EMAIL") || "care@medalert.com";
const appName = Deno.env.get("APP_NAME") || "MedAlert";

// Email template configuration
const brandColor = "#48BBB5";
const warningColor = "#FFB74D";
const dangerColor = "#E57373";
const successColor = "#81C784";

// Initialize clients
const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Format time string for user-friendly display
 */
function formatTimeString(timeString: string): string {
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) {
      // Handle time-only strings like "08:30"
      const now = new Date();
      const [hours, minutes] = timeString.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) {
        return timeString; // Return original if parsing fails
      }
      
      now.setHours(hours, minutes, 0, 0);
      return format(now, 'h:mm a');
    }
    
    return format(date, 'h:mm a, EEEE MMMM do');
  } catch (error) {
    console.error("Error formatting time:", error);
    return timeString; // Return original if formatting fails
  }
}

/**
 * Builds common email template elements
 */
function buildEmailTemplate(content: string, footerText?: string): string {
  const footer = footerText || `This is an automated message from ${appName}. If you need assistance, please contact support.`;
  
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e0e0e0; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
      ${content}
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <img src="https://via.placeholder.com/120x40?text=${appName}" alt="${appName} Logo" style="margin-bottom: 10px;" />
        <p style="font-size: 13px; color: #777; margin-top: 15px;">${footer}</p>
      </div>
    </div>
  `;
}

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
  action?: string,
  firstName?: string
) {
  console.log(`Attempting to send ${isReminder ? 'reminder' : 'notification'} email to: ${email} for medication: ${medication}`);
  
  try {
    // Format user-friendly time display
    const formattedTime = formatTimeString(scheduledTime);
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
    
    // Handle different email subjects and templates based on action
    let subject = '';
    let contentHtml = '';
    
    if (isReminder) {
      // Reminder email (5 minutes before scheduled time)
      subject = `🔔 Upcoming Medication: ${medication} in 5 minutes`;
      contentHtml = `
        <h1 style="color: ${brandColor}; margin-top: 0;">Your Medication is Due Soon</h1>
        <p>${greeting}</p>
        <p>In just <strong>5 minutes</strong>, it will be time to take your medication:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${brandColor};">
          <h2 style="margin-top: 0; color: #333; font-size: 22px;">${medication}</h2>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Dosage:</span> ${dosage}</p>
          ${instructions ? `<p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Instructions:</span> ${instructions}</p>` : ''}
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Scheduled Time:</span> ${formattedTime}</p>
        </div>
        <p>Please remember to take your medication on time for optimal effectiveness.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://your-app-url.com/medication-log?action=take&id=[MEDICATION_ID]" style="background-color: ${brandColor}; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">Mark as Taken</a>
          <a href="https://your-app-url.com/medication-log?action=skip&id=[MEDICATION_ID]" style="background-color: #f5f5f5; color: #333; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block;">Skip This Dose</a>
        </div>
        <p>Staying consistent with your medication schedule is an important part of your health journey.</p>
      `;
    } else if (action === 'miss') {
      // Missed medication notification
      subject = `❗ Missed Medication: ${medication}`;
      contentHtml = `
        <h1 style="color: ${dangerColor}; margin-top: 0;">Missed Medication</h1>
        <p>${greeting}</p>
        <p>Our records show that you missed taking the following medication:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${dangerColor};">
          <h2 style="margin-top: 0; color: #333; font-size: 22px;">${medication}</h2>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Dosage:</span> ${dosage}</p>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Scheduled Time:</span> ${formattedTime}</p>
        </div>
        <p>Missing medications can affect your treatment. If you're frequently missing doses, consider:</p>
        <ul style="margin-bottom: 25px;">
          <li>Setting additional reminders</li>
          <li>Adjusting your medication schedule with your healthcare provider</li>
          <li>Using a pill organizer</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://your-app-url.com/medication-log?action=take-late&id=[MEDICATION_ID]" style="background-color: ${brandColor}; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">I Took It Late</a>
          <a href="https://your-app-url.com/medication-log?action=confirm-miss&id=[MEDICATION_ID]" style="background-color: #f5f5f5; color: #333; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block;">Confirm Missed</a>
        </div>
        <p><strong>Important:</strong> If you're unsure about what to do about a missed dose, please consult your healthcare provider.</p>
      `;
    } else if (action === 'skip') {
      // Skipped medication confirmation
      subject = `⏭️ Medication Skipped: ${medication}`;
      contentHtml = `
        <h1 style="color: ${warningColor}; margin-top: 0;">Medication Skipped</h1>
        <p>${greeting}</p>
        <p>We've recorded that you've decided to skip the following medication dose:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${warningColor};">
          <h2 style="margin-top: 0; color: #333; font-size: 22px;">${medication}</h2>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Dosage:</span> ${dosage}</p>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Scheduled Time:</span> ${formattedTime}</p>
        </div>
        <p>Skipping medications occasionally might be necessary, but frequent skipping could impact your treatment effectiveness.</p>
        <p>If you're experiencing side effects or have concerns about your medication, please consult your healthcare provider.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://your-app-url.com/medication-log?action=undo-skip&id=[MEDICATION_ID]" style="background-color: ${brandColor}; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block;">I've Changed My Mind</a>
        </div>
      `;
    } else {
      // Default confirmation email for taken medication
      subject = `✅ Medication Taken: ${medication}`;
      contentHtml = `
        <h1 style="color: ${successColor}; margin-top: 0;">Medication Taken Successfully</h1>
        <p>${greeting}</p>
        <p>Great job! We've recorded that you've taken the following medication:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${successColor};">
          <h2 style="margin-top: 0; color: #333; font-size: 22px;">${medication}</h2>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Dosage:</span> ${dosage}</p>
          <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Time Taken:</span> ${formattedTime}</p>
        </div>
        <p>Maintaining consistent medication habits is a key part of your health journey. Your dedication to staying on track is commendable!</p>
        <div style="padding: 15px; background-color: #f3f9f4; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 15px;">Your next scheduled dose will be at: <strong>[NEXT_DOSE_TIME]</strong></p>
        </div>
      `;
    }
    
    // Assemble the final email with template
    const htmlContent = buildEmailTemplate(contentHtml, `You're receiving this because you've set up medication reminders in ${appName}. You can adjust your notification preferences in the app settings.`);
    
    const response = await resend.emails.send({
      from: fromEmail,
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
  currentQuantity: number,
  daysRemaining: number,
  firstName?: string
) {
  console.log(`Sending low stock alert for ${medication} to ${email}`);
  
  try {
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
    const urgencyLevel = daysRemaining <= 3 ? "urgent" : "normal";
    
    let contentHtml = `
      <h1 style="color: ${dangerColor}; margin-top: 0;">Your Medication is Running Low</h1>
      <p>${greeting}</p>
      <p>It's time to refill your prescription for:</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${dangerColor};">
        <h2 style="margin-top: 0; color: #333; font-size: 22px;">${medication}</h2>
        <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Dosage:</span> ${dosage}</p>
        <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Current Quantity:</span> ${currentQuantity} ${currentQuantity === 1 ? 'dose' : 'doses'}</p>
        <p style="font-size: 16px;"><span style="color: #555; font-weight: bold;">Estimated Supply:</span> 
          <span style="${urgencyLevel === 'urgent' ? 'color: #d32f2f; font-weight: bold;' : ''}">${daysRemaining <= 0 ? 'Less than a day' : daysRemaining === 1 ? '1 day' : `${daysRemaining} days`}</span>
        </p>
      </div>
      <p>${urgencyLevel === 'urgent' ? '<strong>Please refill this medication as soon as possible to avoid missing doses.</strong>' : 'Please arrange to refill this medication soon to ensure you don\'t run out.'}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://your-app-url.com/refill-reminder?med=[MEDICATION_ID]" style="background-color: ${brandColor}; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block;">Set Refill Reminder</a>
      </div>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <p style="margin: 0; font-size: 14px;">💡 <strong>Tip:</strong> Many pharmacies offer automatic refill programs. Ask your pharmacist about setting up this convenient service.</p>
      </div>
    `;
    
    const htmlContent = buildEmailTemplate(contentHtml);
    
    const response = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `${urgencyLevel === 'urgent' ? '❗ URGENT: ' : ''}Running Low on ${medication} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left)`,
      html: htmlContent
    });
    
    console.log("Low stock alert sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending low stock alert:", error);
    throw error;
  }
}

/**
 * Calculate days of medication remaining
 */
function calculateDaysRemaining(currentQuantity: number, frequency: number, dosesPerDay: number): number {
  // If frequency is in days, directly calculate
  if (frequency > 0 && dosesPerDay > 0) {
    return Math.floor(currentQuantity / (dosesPerDay / frequency));
  }
  
  // Default to a simple calculation if frequency details are missing
  return Math.floor(currentQuantity);
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
    action,
    firstName,
    frequency,
    dosesPerDay
  } = await req.json();
  
  console.log(`Starting to send notification email to ${email}`);
  
  if (!email || !medication || !dosage) {
    throw new Error("Missing required parameters");
  }
  
  let emailResponse;
  
  // Handle different notification types
  if (isLowStockAlert) {
    const daysRemaining = calculateDaysRemaining(currentQuantity, frequency || 1, dosesPerDay || 1);
    
    emailResponse = await sendLowStockAlert(
      email, 
      medication, 
      dosage, 
      currentQuantity, 
      daysRemaining,
      firstName
    );
    
    // Record the notification in the database
    if (userId && medicationId) {
      try {
        await supabase.from('medication_alerts').insert({
          user_id: userId,
          medication_id: medicationId,
          scheduled_time: new Date().toISOString(),
          alert_type: 'low_stock',
          status: 'sent',
          manual_trigger: true,
          metadata: { 
            daysRemaining, 
            currentQuantity 
          }
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
      action,
      firstName
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
          manual_trigger: true,
          metadata: { 
            isReminder,
            action: action || null
          }
        });
        
        // If this is a confirmation (not a reminder), mark as taken/skipped/missed
        if (!isReminder && action) {
          const statusMap = {
            'take': 'taken',
            'skip': 'skipped',
            'miss': 'missed'
          };
          
          await supabase.from('medication_logs').insert({
            user_id: userId,
            medication_id: medicationId,
            taken_at: action === 'take' ? new Date().toISOString() : null,
            scheduled_time: scheduledTime,
            status: statusMap[action] || 'unknown'
          });
          
          // Update medication quantity if taken
          if (action === 'take') {
            try {
              // First get current medication details
              const { data: medicationData, error: fetchError } = await supabase
                .from('medications')
                .select('current_quantity, dosage_amount')
                .eq('id', medicationId)
                .single();
                
              if (fetchError) throw fetchError;
              
              if (medicationData && medicationData.current_quantity !== null) {
                const newQuantity = Math.max(0, medicationData.current_quantity - (medicationData.dosage_amount || 1));
                
                // Update the quantity
                await supabase
                  .from('medications')
                  .update({ current_quantity: newQuantity })
                  .eq('id', medicationId);
                  
                // Check if we need to send a low stock alert
                if (newQuantity <= 5) {
                  // Schedule a low stock alert
                  // This could be handled by a separate function or here directly
                  console.log(`Medication ${medicationId} is running low (${newQuantity} left). Scheduling alert.`);
                }
              }
            } catch (updateError) {
              console.error('Error updating medication quantity:', updateError);
            }
          }
        }
      } catch (dbError) {
        console.error('Error recording notification in database:', dbError);
        // Continue anyway - the important part is the email was sent
      }
    }
  }
  
  // Return success response
  return { success: true, message: "Notification sent successfully" };
}

/**
 * Handles scheduled background checks for upcoming medications
 */
async function handleScheduledChecks() {
  console.log("Running scheduled medication checks");
  const now = new Date();
  
  try {
    // Get all active medications with upcoming scheduled times in the next 5 minutes
    const { data: upcomingMedications, error } = await supabase
      .from('medications')
      .select(`
        id, 
        name, 
        dosage, 
        instructions,
        scheduled_time, 
        current_quantity,
        frequency_type,
        frequency_interval,
        doses_per_day,
        users (
          id, 
          email, 
          first_name,
          notification_preferences
        )
      `)
      .eq('is_active', true)
      .gte('current_quantity', 1);  // Only check medications with stock
    
    if (error) {
      throw error;
    }
    
    if (!upcomingMedications || upcomingMedications.length === 0) {
      console.log("No upcoming medications found");
      return { processed: 0 };
    }
    
    let processedCount = 0;
    
    // Process each medication
    for (const med of upcomingMedications) {
      try {
        // Extract scheduled time from string like "08:30"
        const scheduledTimeParts = med.scheduled_time.split(':').map(Number);
        if (scheduledTimeParts.length !== 2) continue;
        
        const [scheduledHour, scheduledMinute] = scheduledTimeParts;
        
        // Create scheduled time for today
        const scheduledTimeToday = new Date();
        scheduledTimeToday.setHours(scheduledHour, scheduledMinute, 0, 0);
        
        // Calculate time 5 minutes before scheduled time
        const reminderTime = addMinutes(scheduledTimeToday, -5);
        
        // Check if current time is within 1 minute of the reminder time
        const minutesDiff = Math.abs(differenceInMinutes(now, reminderTime));
        
        // Only process if we're within 1 minute of the designated reminder time (5 minutes before medication time)
        if (minutesDiff <= 1) {
          console.log(`Processing reminder for ${med.name} scheduled at ${med.scheduled_time}`);
          
          const user = med.users;
          if (!user || !user.email) {
            console.warn(`User data missing for medication ${med.id}`);
            continue;
          }
          
          // Check if we've already sent a reminder for this medication recently
          const fiveMinutesAgo = addMinutes(now, -5);
          const { data: existingAlerts } = await supabase
            .from('medication_alerts')
            .select('id')
            .eq('medication_id', med.id)
            .eq('user_id', user.id)
            .eq('alert_type', 'email')
            .gte('scheduled_time', fiveMinutesAgo.toISOString())
            .eq('status', 'sent');
            
          if (existingAlerts && existingAlerts.length > 0) {
            console.log(`Reminder already sent for ${med.name} in the last 5 minutes. Skipping.`);
            continue;
          }
          
          // Send reminder email
          await sendMedicationEmail(
            user.email,
            med.name,
            med.dosage,
            med.scheduled_time,
            true, // isReminder
            med.instructions,
            null, // action
            user.first_name
          );
          
          // Record the alert in the database
          await supabase.from('medication_alerts').insert({
            user_id: user.id,
            medication_id: med.id,
            scheduled_time: now.toISOString(),
            alert_type: 'email',
            status: 'sent',
            manual_trigger: false
          });
          
          processedCount++;
        }
        
        // Also check if a medication has been missed (over 30 minutes past scheduled time)
        // Only if we haven't already logged it as taken or missed today
        const thirtyMinutesAfter = addMinutes(scheduledTimeToday, 30);
        if (now > thirtyMinutesAfter) {
          // Check if there's already a log for today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const { data: existingLogs } = await supabase
            .from('medication_logs')
            .select('id, status')
            .eq('medication_id', med.id)
            .eq('user_id', user.id)
            .gte('scheduled_time', todayStart.toISOString());
            
          if (!existingLogs || existingLogs.length === 0) {
            console.log(`Medication ${med.name} appears to be missed. Sending missed notification.`);
            
            // Send missed medication email
            await sendMedicationEmail(
              user.email,
              med.name,
              med.dosage,
              med.scheduled_time,
              false, // not a reminder
              med.instructions,
              'miss', // action
              user.first_name
            );
            
            // Log the missed medication
            await supabase.from('medication_logs').insert({
              user_id: user.id,
              medication_id: med.id,
              taken_at: null,
              scheduled_time: scheduledTimeToday.toISOString(),
              status: 'missed'
            });
            
            processedCount++;
          }
        }
        
        // Check for low stock (separate function that could be called less frequently)
        if (med.current_quantity <= 5) {
          // Calculate days remaining
          const daysRemaining = calculateDaysRemaining(
            med.current_quantity, 
            med.frequency_interval || 1, 
            med.doses_per_day || 1
          );
          
          // Only send if days remaining is concerning
          if (daysRemaining <= 3) {
            // Check if we've sent a low stock alert recently
            const twoDaysAgo = addMinutes(now, -2880); // 48 hours
            const { data: existingLowStockAlerts } = await supabase
              .from('medication_alerts')
              .select('id')
              .eq('medication_id', med.id)
              .eq('user_id', user.id)
              .eq('alert_type', 'low_stock')
              .gte('scheduled_time', twoDaysAgo.toISOString())
              .eq('status', 'sent');
              
            if (!existingLowStockAlerts || existingLowStockAlerts.length === 0) {
              await sendLowStockAlert(
                user.email,
                med.name,
                med.dosage,
                med.current_quantity,
                daysRemaining,
                user.first_name
              );
              
              // Record the low stock alert
              await supabase.from('medication_alerts').insert({
                user_id: user.id,
                medication_id: med.id,
                scheduled_time: now.toISOString(),
                alert_type: 'low_stock',
                status: 'sent',
                manual_trigger: false,
                metadata: {
                  daysRemaining,
                  currentQuantity: med.current_quantity
                }
              });
              
              processedCount++;
            }
          }
        }
      } catch (medError) {
        console.error(`Error processing medication ${med.id}:`, medError);
        // Continue with next medication
      }
    }
    
    return { processed: processedCount };
    
  } catch (error) {
    console.error("Error in scheduled medication checks:", error);
    throw error;
  }
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
      // This is a scheduled job - run checks for upcoming medications
      result = await handleScheduledChecks();
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
        details: error.response?.body || "No additional details",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );}
})

/**
 * Handles health endpoint checks
 */
async function handleHealthCheck() {
  try {
    // Check Supabase connection
    const { data, error } = await supabase
      .from('health_checks')
      .select('id')
      .limit(1);
      
    if (error) {
      throw new Error(`Supabase connection error: ${error.message}`);
    }
    
    // Check Resend API connection
    const resendTestResponse = await resend.emails.send({
      from: fromEmail,
      to: "health-check@internal.medalert.com",
      subject: "Health check",
      html: "<p>Service health check</p>",
      text: "Service health check"
    });
    
    if (!resendTestResponse || !resendTestResponse.id) {
      throw new Error("Failed to connect to Resend API");
    }
    
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        supabase: "connected",
        resend: "connected"
      }
    };
  } catch (error) {
    console.error("Health check failed:", error);
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        supabase: error.message.includes("Supabase") ? "disconnected" : "unknown",
        resend: error.message.includes("Resend") ? "disconnected" : "unknown"
      }
    };
  }
}

/**
 * Send test notification for user setup verification
 */
async function sendTestNotification(email: string, firstName?: string) {
  try {
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
    
    const contentHtml = `
      <h1 style="color: ${brandColor}; margin-top: 0;">Your Notifications Are Working!</h1>
      <p>${greeting}</p>
      <p>Good news! Your medication reminder system is now successfully set up.</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid ${successColor};">
        <h2 style="margin-top: 0; color: #333; font-size: 22px;">Test Notification</h2>
        <p style="font-size: 16px;">This is a test notification to confirm that your email notifications are working correctly.</p>
      </div>
      <p>You'll now receive timely reminders 5 minutes before each scheduled medication time, helping you stay on track with your health regimen.</p>
      <div style="padding: 15px; background-color: #f3f9f4; border-radius: 8px; margin-top: 20px;">
        <p style="margin: 0; font-size: 15px;">💡 <strong>Tip:</strong> Make sure to add <strong>${fromEmail}</strong> to your contacts to prevent our reminders from going to your spam folder.</p>
      </div>
    `;
    
    const htmlContent = buildEmailTemplate(contentHtml);
    
    const response = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `✅ ${appName} Notifications Successfully Set Up`,
      html: htmlContent
    });
    
    console.log("Test notification sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending test notification:", error);
    throw error;
  }
}

/**
 * Check and handle user notification preferences
 */
async function getUserNotificationPreferences(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('notification_preferences, email, phone')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    // Default preferences if none set
    if (!data || !data.notification_preferences) {
      return {
        email: true,
        push: true,
        sms: data?.phone ? true : false,
        reminderLeadTime: 5, // minutes before scheduled time
        lowStockThreshold: 5, // doses remaining
        missedMedicationDelay: 30 // minutes after scheduled time
      };
    }
    
    return data.notification_preferences;
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    // Return default preferences on error
    return {
      email: true,
      push: true, 
      sms: false,
      reminderLeadTime: 5,
      lowStockThreshold: 5,
      missedMedicationDelay: 30
    };
  }
}

/**
 * Process in bulk all pending medication notifications and logs
 */
async function processAllPendingMedications() {
  console.log("Processing all pending medications");
  const now = new Date();
  const processedItems = {
    reminders: 0,
    missed: 0,
    lowStock: 0,
    errors: 0
  };
  
  try {
    // Get all active medications
    const { data: allMedications, error } = await supabase
      .from('medications')
      .select(`
        id, 
        name, 
        dosage, 
        instructions,
        scheduled_time, 
        current_quantity,
        frequency_type,
        frequency_interval,
        doses_per_day,
        last_reminder_sent,
        users (
          id, 
          email, 
          first_name,
          notification_preferences,
          phone
        )
      `)
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    if (!allMedications || allMedications.length === 0) {
      return processedItems;
    }
    
    // Process each medication
    for (const med of allMedications) {
      try {
        // Skip if no valid user data
        const user = med.users;
        if (!user || !user.email) continue;
        
        // Get user notification preferences 
        const preferences = await getUserNotificationPreferences(user.id);
        
        // Skip if email notifications are disabled
        if (!preferences.email) continue;
        
        // Process upcoming reminders (default 5 minutes before or custom lead time)
        await processUpcomingMedication(med, user, preferences, now, processedItems);
        
        // Process missed medications
        await processMissedMedication(med, user, preferences, now, processedItems);
        
        // Process low stock alerts
        await processLowStockAlert(med, user, preferences, processedItems);
        
      } catch (medError) {
        console.error(`Error processing medication ${med.id}:`, medError);
        processedItems.errors++;
      }
    }
    
    return processedItems;
    
  } catch (error) {
    console.error("Error in bulk medication processing:", error);
    throw error;
  }
}

/**
 * Process a single upcoming medication reminder
 */
async function processUpcomingMedication(med, user, preferences, now, processedItems) {
  // Extract reminder lead time (minutes before scheduled time)
  const reminderLeadTime = preferences.reminderLeadTime || 5;
  
  // Extract scheduled time from string like "08:30"
  const scheduledTimeParts = med.scheduled_time.split(':').map(Number);
  if (scheduledTimeParts.length !== 2) return;
  
  const [scheduledHour, scheduledMinute] = scheduledTimeParts;
  
  // Create scheduled time for today
  const scheduledTimeToday = new Date();
  scheduledTimeToday.setHours(scheduledHour, scheduledMinute, 0, 0);
  
  // Calculate time for sending reminder based on lead time
  const reminderTime = addMinutes(scheduledTimeToday, -reminderLeadTime);
  
  // Check if current time is within the reminder window
  const minutesDiff = Math.abs(differenceInMinutes(now, reminderTime));
  
  // Only process if we're within 1 minute of the designated reminder time
  if (minutesDiff <= 1) {
    // Check if we've already sent a reminder recently
    const lastHour = addMinutes(now, -60);
    const { data: existingAlerts } = await supabase
      .from('medication_alerts')
      .select('id')
      .eq('medication_id', med.id)
      .eq('user_id', user.id)
      .eq('alert_type', 'email')
      .gte('scheduled_time', lastHour.toISOString())
      .eq('status', 'sent');
      
    if (existingAlerts && existingAlerts.length > 0) {
      // Reminder already sent recently
      return;
    }
    
    // Send reminder email
    await sendMedicationEmail(
      user.email,
      med.name,
      med.dosage,
      med.scheduled_time,
      true, // isReminder
      med.instructions,
      null, // action
      user.first_name
    );
    
    // Record the alert in the database
    await supabase.from('medication_alerts').insert({
      user_id: user.id,
      medication_id: med.id,
      scheduled_time: now.toISOString(),
      alert_type: 'email',
      status: 'sent',
      manual_trigger: false,
      metadata: {
        reminderLeadTime
      }
    });
    
    // Update last reminder sent timestamp
    await supabase
      .from('medications')
      .update({ last_reminder_sent: now.toISOString() })
      .eq('id', med.id);
    
    processedItems.reminders++;
  }
}

/**
 * Process a missed medication check
 */
async function processMissedMedication(med, user, preferences, now, processedItems) {
  // Extract missed medication delay threshold (minutes after scheduled time)
  const missedDelay = preferences.missedMedicationDelay || 30;
  
  // Extract scheduled time
  const scheduledTimeParts = med.scheduled_time.split(':').map(Number);
  if (scheduledTimeParts.length !== 2) return;
  
  const [scheduledHour, scheduledMinute] = scheduledTimeParts;
  
  // Create scheduled time for today
  const scheduledTimeToday = new Date();
  scheduledTimeToday.setHours(scheduledHour, scheduledMinute, 0, 0);
  
  // Calculate the time after which a medication is considered missed
  const missedTime = addMinutes(scheduledTimeToday, missedDelay);
  
  // Check if now is past the missed time threshold
  if (now > missedTime) {
    // Check if there's already a log for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: existingLogs } = await supabase
      .from('medication_logs')
      .select('id, status')
      .eq('medication_id', med.id)
      .eq('user_id', user.id)
      .gte('scheduled_time', todayStart.toISOString());
      
    if (!existingLogs || existingLogs.length === 0) {
      // Send missed medication email
      await sendMedicationEmail(
        user.email,
        med.name,
        med.dosage,
        med.scheduled_time,
        false, // not a reminder
        med.instructions,
        'miss', // action
        user.first_name
      );
      
      // Log the missed medication
      await supabase.from('medication_logs').insert({
        user_id: user.id,
        medication_id: med.id,
        taken_at: null,
        scheduled_time: scheduledTimeToday.toISOString(),
        status: 'missed'
      });
      
      processedItems.missed++;
    }
  }
}

/**
 * Process low stock alerts
 */
async function processLowStockAlert(med, user, preferences, processedItems) {
  // Check threshold for stock alerts
  const stockThreshold = preferences.lowStockThreshold || 5;
  
  if (med.current_quantity <= stockThreshold) {
    // Calculate days remaining
    const daysRemaining = calculateDaysRemaining(
      med.current_quantity, 
      med.frequency_interval || 1, 
      med.doses_per_day || 1
    );
    
    // Check if we need to send an alert based on days remaining
    const shouldSendAlert = daysRemaining <= 3; // Critical threshold
    
    if (shouldSendAlert) {
      // Check if we've sent a low stock alert recently
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data: existingLowStockAlerts } = await supabase
        .from('medication_alerts')
        .select('id')
        .eq('medication_id', med.id)
        .eq('user_id', user.id)
        .eq('alert_type', 'low_stock')
        .gte('scheduled_time', threeDaysAgo.toISOString())
        .eq('status', 'sent');
        
      // Only send if no recent alert
      if (!existingLowStockAlerts || existingLowStockAlerts.length === 0) {
        await sendLowStockAlert(
          user.email,
          med.name,
          med.dosage,
          med.current_quantity,
          daysRemaining,
          user.first_name
        );
        
        // Record the low stock alert
        await supabase.from('medication_alerts').insert({
          user_id: user.id,
          medication_id: med.id,
          scheduled_time: new Date().toISOString(),
          alert_type: 'low_stock',
          status: 'sent',
          manual_trigger: false,
          metadata: {
            daysRemaining,
            currentQuantity: med.current_quantity,
            threshold: stockThreshold
          }
        });
        
        processedItems.lowStock++;
      }
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Extract auth info
    const authHeader = req.headers.get('Authorization');
    const isScheduled = authHeader === `Bearer ${cronSecret}`;
    const path = new URL(req.url).pathname.split('/').pop();
    
    let result;
    
    // Route to appropriate handler based on path and request type
    if (path === 'health') {
      // Health check endpoint
      result = await handleHealthCheck();
    } else if (path === 'test-notification' && req.method === "POST") {
      // Test notification endpoint
      const { email, firstName } = await req.json();
      if (!email) {
        throw new Error("Email is required for test notification");
      }
      result = await sendTestNotification(email, firstName);
    } else if (isScheduled) {
      // Scheduled cron job
      result = await processAllPendingMedications();
    } else if (req.method === "POST") {
      // Manual notification from frontend
      result = await handleManualNotification(req);
    } else {
      return new Response(JSON.stringify({ error: 'Method or path not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error processing request:', error);
    
    // Structured error response
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.response?.body || "No additional details",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
