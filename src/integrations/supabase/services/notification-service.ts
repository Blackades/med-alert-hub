
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";

// Types that match backend schema
export type NotificationType = 'email' | 'sms' | 'esp32' | 'both' | 'all';
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
    
    // Send notification directly using the send-notification endpoint
    const response = await supabase.functions.invoke('send-notification', {
      body: options,
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
    
    return { success: true, data: response.data as NotificationResponse };
  } catch (error) {
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
  notificationType: 'email' | 'esp32' | 'both'
) => {
  try {
    console.log(`Triggering demo notification: userId=${userId}, medicationId=${medicationId}, type=${notificationType}`);
    
    // Direct call to the medication-alerts function with required parameters
    const { data, error } = await supabase.functions.invoke('medication-alerts', {
      method: 'POST',
      body: {
        userId,
        medicationId,
        notificationType,
        demoMode: true // Always use demo mode for this function
      }
    });

    if (error) {
      console.error('Medication alerts function error:', error);
      throw new Error(error.message || 'Failed to trigger demo notification');
    }
    
    console.log('Medication alerts response:', data);
    
    return { success: true, data };
  } catch (error) {
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
    const response = await supabase.functions.invoke('process-email-queue', {
      method: 'POST',
    });
    
    if (response.error) {
      console.error("Process email queue error:", response.error);
      throw new Error(response.error.message || 'Failed to process email queue');
    }
    
    console.log("Process email queue response:", response.data);
    
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
 * Function to make the demo panel functionality explicit
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
