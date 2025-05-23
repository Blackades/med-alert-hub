
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";
import { sendEsp32Notification } from './notifications';
import { sendMqttNotificationsToAllDevices } from './mqtt-service';

// Types that match backend schema
export type NotificationType = 'email' | 'sms' | 'esp32' | 'mqtt' | 'both' | 'all';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

// Request interface that matches the backend Zod schema
export interface NotificationRequest {
  userId?: string;
  medicationId?: string;
  notificationType?: NotificationType;
  customMessage?: string;
  priorityLevel?: PriorityLevel;
  scheduleTime?: string; // ISO string
  demoMode?: boolean; // Add demoMode flag
  
  // Direct email params for test emails
  recipientEmail?: string;
  subject?: string;
  message?: string;
  testMode?: boolean;
  autoProcessEmails?: boolean; // New flag to auto-process emails
  preventDuplicates?: boolean; // New flag to prevent duplicate emails
}

// Response interface
export interface NotificationResponse {
  success: boolean;
  message: string;
  notifications?: {
    success: boolean;
    channel: string;
    message: string;
    timestamp: string;
    details?: any;
  }[];
  timestamp: string;
  requestId: string;
}

/**
 * Trigger a notification for the specified medication and user
 * @param options - Notification request options
 * @returns Response with success status and data
 */
export const triggerNotification = async (options: NotificationRequest) => {
  try {
    // For tracking function execution
    console.log("Sending notification with options:", options);

    // Always ensure demoMode is explicitly set in the request
    const requestOptions = {
      ...options,
      demoMode: options.demoMode === true,
      preventDuplicates: options.preventDuplicates !== false // Default to preventing duplicates
    };

    // Add check to ensure medication ID is properly passed
    if (!requestOptions.medicationId && !requestOptions.testMode) {
      console.error("No medication ID provided for notification");
      throw new Error("Medication ID is required");
    }

    // First try sending directly to the medication-alerts function to ensure proper demo mode handling
    const alertsResponse = await supabase.functions.invoke('medication-alerts', {
      method: 'POST',
      body: requestOptions,
    });

    if (alertsResponse.error) {
      console.error("Medication alerts error:", alertsResponse.error);
      
      // If medication-alerts fails, fall back to direct send-notification
      const response = await supabase.functions.invoke('send-notification', {
        body: requestOptions,
      });
      
      if (response.error) {
        console.error("Send notification endpoint error:", response.error);
        throw new Error(response.error.message || 'Failed to trigger notification');
      }
      
      console.log("Send notification endpoint response:", response.data);
      
      // Show a success toast
      toast({
        title: "Notification Sent",
        description: response.data?.message || "Notification has been sent successfully.",
        variant: "default",
      });
      
      // Auto-process emails if flag is set
      if (options.autoProcessEmails) {
        await processEmailQueue();
      }
      
      // Fetch medication details if needed for MQTT notifications
      let medicationDetails = {};
      if (['mqtt', 'esp32', 'both', 'all'].includes(options.notificationType || '') && options.medicationId) {
        try {
          const { data: medication } = await supabase
            .from('medications')
            .select('*')
            .eq('id', options.medicationId)
            .single();
          
          if (medication) {
            medicationDetails = {
              medicationId: medication.id,
              name: medication.name,
              dosage: medication.dosage,
              instructions: medication.instructions
            };
          }
        } catch (err) {
          console.error("Error fetching medication details:", err);
        }
      }
      
      // Handle ESP32 & MQTT physical device notification
      if (['esp32', 'mqtt', 'both', 'all'].includes(options.notificationType || '')) {
        const message = options.customMessage || `Medication reminder: ${options.medicationId ? 'Time to take your medication' : 'Demo notification'}`;
        if (options.userId) {
          // Send both ESP32 direct and MQTT notifications
          if (['mqtt', 'both', 'all'].includes(options.notificationType || '')) {
            await sendMqttNotificationsToAllDevices(options.userId, message, medicationDetails);
          }
          if (['esp32', 'both', 'all'].includes(options.notificationType || '')) {
            await sendEsp32Notification(options.userId, message, 'both');
          }
        }
      }
      
      return { success: true, data: response.data as NotificationResponse };
    }
    
    console.log("Medication alerts response:", alertsResponse.data);
    
    // Show a success toast
    toast({
      title: "Notification Sent",
      description: alertsResponse.data?.message || "Medication alert has been sent successfully.",
      variant: "default",
    });
    
    // Auto-process emails if flag is set
    if (options.autoProcessEmails) {
      await processEmailQueue();
    }
    
    // Fetch medication details for MQTT notifications - this is important for both normal and demo mode
    let medicationDetails = {};
    if (['mqtt', 'esp32', 'both', 'all'].includes(options.notificationType || '')) {
      if (options.medicationId) {
        try {
          const { data: medication } = await supabase
            .from('medications')
            .select('*')
            .eq('id', options.medicationId)
            .single();
          
          if (medication) {
            medicationDetails = {
              medicationId: medication.id,
              name: medication.name,
              dosage: medication.dosage,
              instructions: medication.instructions
            };
          }
        } catch (err) {
          console.error("Error fetching medication details:", err);
        }
      } else if (options.demoMode) {
        // Create demo medication details
        medicationDetails = {
          medicationId: 'demo-medication-id',
          name: 'Demo Medication',
          dosage: '10mg',
          instructions: options.customMessage || 'Take with water'
        };
      }
    }
    
    // Always send MQTT notifications in demo mode if the notification type includes mqtt
    if (['mqtt', 'esp32', 'both', 'all'].includes(options.notificationType || '')) {
      const message = options.customMessage || `Medication reminder: ${options.medicationId ? 'Time to take your medication' : 'Demo notification'}`;
      
      if (options.userId) {
        console.log("Attempting to send MQTT notifications in triggerNotification");
        
        // Send MQTT notification regardless of demo mode
        if (['mqtt', 'both', 'all'].includes(options.notificationType || '')) {
          const mqttResult = await sendMqttNotificationsToAllDevices(
            options.userId, 
            message, 
            medicationDetails
          );
          console.log("MQTT notification result:", mqttResult);
        }
        
        // Send ESP32 notification if applicable
        if (['esp32', 'both', 'all'].includes(options.notificationType || '')) {
          const result = await sendEsp32Notification(options.userId, message, 'both');
          console.log("ESP32 notification result:", result);
        }
      } else {
        console.warn("Cannot send MQTT/ESP32 notification: No userId provided");
      }
    }
    
    return { success: true, data: alertsResponse.data };
    
  } catch (error: any) {
    console.error('Error triggering notification:', error);
    
    // Show only one error toast
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Could not trigger notification.",
      variant: "destructive",
    });
    
    return { success: false, error, data: null };
  }
};

/**
 * Legacy function to maintain compatibility with existing code
 */
export const triggerDemoNotification = async (
  userId: string, 
  medicationId: string, 
  notificationType: 'email' | 'mqtt' | 'esp32' | 'both'
) => {
  try {
    console.log(`Triggering demo notification: userId=${userId}, medicationId=${medicationId}, type=${notificationType}`);
    
    // Use the new triggerNotification function with demoMode=true
    return await triggerNotification({
      userId,
      medicationId,
      notificationType,
      demoMode: true,
      autoProcessEmails: true, // Always auto-process emails for demo
      preventDuplicates: true, // Prevent duplicate emails
      customMessage: "This is a demo notification"
    });
  } catch (error: any) {
    console.error('Error triggering demo notification:', error);
    
    toast({
      title: "Error",
      description: "Could not trigger demo notification.",
      variant: "destructive",
    });
    
    return { success: false, error, data: null };
  }
};

/**
 * Schedule a notification for future delivery
 */
export const scheduleNotification = async (options: NotificationRequest & { scheduleTime: string }) => {
  try {
    // Ensure scheduleTime is provided and is a valid ISO string
    if (!options.scheduleTime) {
      throw new Error('Schedule time is required');
    }
    
    // Validate the date format
    const scheduleDate = new Date(options.scheduleTime);
    if (isNaN(scheduleDate.getTime())) {
      throw new Error('Invalid schedule time format');
    }
    
    // Call the main notification function with a future schedule time
    return await triggerNotification(options);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Could not schedule notification.",
      variant: "destructive",
    });
    
    return { success: false, error, data: null };
  }
};

/**
 * Process the email notification queue manually
 * This function will call the API endpoint to process pending email notifications
 */
export const processEmailQueue = async () => {
  try {
    console.log("Processing email queue...");
    const response = await supabase.functions.invoke('process-email-queue', {
      method: 'POST',
      body: { 
        preventDuplicates: true // Add flag to prevent duplicate emails
      }
    });
    
    if (response.error) {
      console.error("Process email queue error:", response.error);
      throw new Error(response.error.message || 'Failed to process email queue');
    }
    
    console.log("Process email queue response:", response.data);
    
    // Don't show a toast here as it will be called automatically after demo notification
    
    return { 
      success: true, 
      data: response.data,
      result: {
        processed: response.data?.processed || 0,
        failed: response.data?.failed || 0,
      }
    };
  } catch (error) {
    console.error('Error processing email queue:', error);
    return { 
      success: false, 
      error, 
      data: null 
    };
  }
};

/**
 * Function to fetch ESP32 notification data
 */
export const getESP32NotificationData = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('esp32-notifications', {
      method: 'GET',
    });
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error getting ESP32 notification data:', error);
    return { success: false, error, data: null };
  }
};
