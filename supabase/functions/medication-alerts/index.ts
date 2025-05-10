
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

// Setup CORS headers for browsers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// Generate a unique request ID for tracing
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Medication alerts function called`);
  
  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Get the request method
    const { method } = req;
    
    // Handle GET request to check for due medications
    if (method === "GET") {
      console.log(`[${requestId}] Finding medications that need alerts`);
      
      // Query medications that need alerts
      const { data: dueAlerts, error: alertsError } = await supabaseAdmin
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          user_id,
          next_dose_at,
          alert_before_minutes,
          profiles!inner(id, email)
        `)
        .lt('next_dose_at', new Date(Date.now() + 30 * 60 * 1000).toISOString()) // Next 30 mins
        .gt('next_dose_at', new Date().toISOString()) // Not in the past
        .eq('active', true)
        .order('next_dose_at', { ascending: true });
      
      if (alertsError) {
        console.log(`[${requestId}] Error querying due alerts: ${alertsError.message}`);
        // Continue with an empty array if error occurred
      }
      
      console.log(`[${requestId}] Found ${dueAlerts?.length || 0} medications due soon`);
      
      // If there are medications due soon, trigger notifications for each
      if (dueAlerts && dueAlerts.length > 0) {
        const notificationPromises = dueAlerts.map(alert => {
          return supabaseAdmin.functions.invoke('send-notification', {
            body: {
              userId: alert.user_id,
              medicationId: alert.id,
              notificationType: 'email', // Default to email
              customMessage: `Time to take your ${alert.name} (${alert.dosage})`,
              priorityLevel: 'high',
              preventDuplicates: true // Prevent duplicate notifications
            }
          });
        });
        
        // Wait for all notifications to be sent
        await Promise.allSettled(notificationPromises);
        console.log(`[${requestId}] Sent notifications for ${dueAlerts.length} medications`);
      }
      
      // Return the due medications
      return new Response(JSON.stringify({
        success: true,
        count: dueAlerts?.length || 0,
        medications: dueAlerts || []
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Handle POST request to send alerts for a specific medication
    else if (method === "POST") {
      // Parse the request body
      let body;
      try {
        body = await req.json();
      } catch (e) {
        console.error(`[${requestId}] Failed to parse request body: ${e.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid request body: Could not parse JSON"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      const { userId, medicationId, notificationType, demoMode, customMessage, testMode, preventDuplicates } = body;
      
      // Log received parameters for debugging
      console.log(`[${requestId}] Received parameters:`, { userId, medicationId, notificationType, demoMode, customMessage, testMode, preventDuplicates });
      
      // Check for demo mode or test mode
      const isDemoMode = demoMode === true || testMode === true;
      console.log(`[${requestId}] Demo mode: ${isDemoMode ? "ENABLED" : "DISABLED"}`);
      
      // Only validate required fields if not in demo/test mode
      if (!isDemoMode && (!userId || !medicationId)) {
        console.error(`[${requestId}] Missing required fields: userId=${userId}, medicationId=${medicationId}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: userId and medicationId"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      // In demo mode, if userId or medicationId is missing, use placeholders
      const effectiveUserId = userId || 'demo-user-id';
      const effectiveMedicationId = medicationId || 'demo-medication-id';
      
      console.log(`[${requestId}] Sending medication alert for med ${effectiveMedicationId} to user ${effectiveUserId}`);
      
      // Fetch the user to verify they exist
      const { data: user, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, notification_preferences')
        .eq('id', effectiveUserId)
        .maybeSingle();
      
      if (userError) {
        console.error(`[${requestId}] Error fetching user: ${userError.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch user: ${userError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      let placeholderUser = null;
      
      // For demo mode, if user not found, create a placeholder for testing
      if (!user) {
        console.warn(`[${requestId}] User with ID ${effectiveUserId} not found`);
        
        if (isDemoMode) {
          console.log(`[${requestId}] Running in demo mode - will proceed with placeholder user data`);
          // Create a placeholder user for demo purposes
          placeholderUser = {
            id: effectiveUserId,
            email: testMode ? body.recipientEmail || "demo@example.com" : "demo@example.com",
            notification_preferences: { default_type: "email" }
          };
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: `User with ID ${effectiveUserId} not found`
          }), {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      }
      
      const effectiveUser = user || placeholderUser;
      
      // CRITICAL FIX: Fetch the medication with proper error handling and logging
      let medication = null;
      let placeholderMedication = null;
      
      try {
        // Only fetch if we have a valid medication ID that's not the demo ID
        if (effectiveMedicationId && effectiveMedicationId !== 'demo-medication-id') {
          console.log(`[${requestId}] Fetching medication details for ID: ${effectiveMedicationId}`);
          
          const { data, error } = await supabaseAdmin
            .from('medications')
            .select('*')
            .eq('id', effectiveMedicationId)
            .maybeSingle();
          
          if (error) {
            console.error(`[${requestId}] Error fetching medication: ${error.message}`);
            throw error;
          }
          
          if (data) {
            medication = data;
            console.log(`[${requestId}] Successfully retrieved medication:`, medication);
          } else {
            console.warn(`[${requestId}] No medication found with ID: ${effectiveMedicationId}`);
          }
        } else {
          console.log(`[${requestId}] No valid medication ID provided, will use placeholder data`);
        }
      } catch (error) {
        console.error(`[${requestId}] Failed to fetch medication: ${error}`);
      }
      
      // Create placeholder medication if needed for demo mode or if fetch failed
      if (!medication) {
        if (isDemoMode) {
          console.log(`[${requestId}] Creating placeholder medication data for demo mode`);
          
          // Use display name "Demo Medication" instead of "N2"
          placeholderMedication = {
            id: effectiveMedicationId,
            name: "Demo Medication", // Changed from "N2" to "Demo Medication"
            dosage: "10mg",
            instructions: "Take with water",
            user_id: effectiveUserId
          };
          
          console.log(`[${requestId}] Created placeholder medication:`, placeholderMedication);
        } else {
          console.error(`[${requestId}] Medication with ID ${effectiveMedicationId} not found and not in demo mode`);
          return new Response(JSON.stringify({
            success: false,
            error: `Medication with ID ${effectiveMedicationId} not found`
          }), {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      }
      
      const effectiveMedication = medication || placeholderMedication;
      console.log(`[${requestId}] Using medication for notification:`, effectiveMedication);
      
      // Check that medication belongs to the user (skip in demo mode)
      if (!isDemoMode && effectiveMedication && effectiveMedication.user_id !== effectiveUserId) {
        console.error(`[${requestId}] Medication does not belong to user: med.user_id=${effectiveMedication.user_id}, userId=${effectiveUserId}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Medication does not belong to this user"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      // Call the send-notification function to deliver the alert
      const alertPayload = {
        userId: effectiveUserId,
        medicationId: effectiveMedicationId,
        notificationType: notificationType || (effectiveUser?.notification_preferences?.default_type || 'email'),
        customMessage: customMessage || `Time to take your ${effectiveMedication?.name} (${effectiveMedication?.dosage})`,
        priorityLevel: 'high',
        demoMode: isDemoMode, // Pass the demo mode flag to the send-notification function
        testMode: testMode,   // Pass the test mode flag
        preventDuplicates: preventDuplicates !== false, // Default to preventing duplicates 
        recipientEmail: testMode ? body.recipientEmail : undefined,
        medication: effectiveMedication // Pass the full medication object to ensure correct data
      };
      
      console.log(`[${requestId}] Sending notification with payload:`, JSON.stringify(alertPayload, null, 2));
      
      // Send notification
      const { data: notificationResult, error: notifyError } = await supabaseAdmin.functions.invoke(
        'send-notification', {
          body: alertPayload
        }
      );
      
      if (notifyError) {
        console.error(`[${requestId}] Failed to send notification: ${notifyError.message}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to send notification: ${notifyError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      
      console.log(`[${requestId}] Alert sent successfully: ${JSON.stringify(notificationResult)}`);
      
      // Return success
      return new Response(JSON.stringify({
        success: true,
        message: `Alert sent for ${effectiveMedication?.name}`,
        details: notificationResult,
        demoMode: isDemoMode
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
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

console.log("Medication alerts function initialized");
