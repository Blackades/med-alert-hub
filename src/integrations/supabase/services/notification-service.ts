
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";

// Types that match backend schema
export type NotificationType = 'email' | 'sms' | 'esp32' | 'both' | 'all';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

// Request interface that matches the backend Zod schema
export interface NotificationRequest {
  userId: string;
  medicationId: string;
  notificationType: NotificationType;
  customMessage?: string;
  priorityLevel?: PriorityLevel;
  scheduleTime?: string; // ISO string
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
    // Set default priority level if not provided
    if (!options.priorityLevel) {
      options.priorityLevel = 'medium';
    }

    // Validate required fields
    if (!options.userId || !options.medicationId || !options.notificationType) {
      throw new Error('Missing required notification parameters');
    }

    console.log("Sending notification with options:", options);

    // Try the demo-notification endpoint first
    try {
      const demoResponse = await supabase.functions.invoke('demo-notification', {
        body: options,
      });
      
      if (demoResponse.error) {
        console.warn("Demo notification endpoint error:", demoResponse.error);
        throw new Error(`Demo endpoint failed: ${demoResponse.error.message || "Unknown error"}`);
      }
      
      console.log("Demo notification endpoint response:", demoResponse.data);
      
      // Show a success toast
      toast({
        title: "Notification Sent",
        description: demoResponse.data?.message || "Notification has been sent successfully.",
        variant: "default",
      });
      
      return { success: true, data: demoResponse.data as NotificationResponse };
    } catch (demoError) {
      // Log the error from demo endpoint
      console.warn("Falling back to send-notification endpoint due to error:", demoError);
      
      // Fallback to send-notification endpoint
      console.log("Falling back to send-notification endpoint");
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
    }
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
    
    // Add a custom message to make it clear this is a demo
    return await triggerNotification({
      userId,
      medicationId,
      notificationType: notificationType as NotificationType,
      customMessage: "This is a DEMO notification from MedTracker.",
      priorityLevel: 'medium',
    });
  } catch (error) {
    console.error('Error triggering demo notification:', error);
    
    // Show only one error toast
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
    
    // Show only one error toast
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Could not schedule notification.",
      variant: "destructive",
    });
    
    return { success: false, error, data: null };
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

/**
 * Process the email queue manually - for admins or debugging
 */
export const processEmailQueue = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('email-queue-ts', {
      body: {},
      query: { mode: 'process' }
    });
    
    if (error) throw error;
    
    console.log("Email queue processing results:", data);
    return { success: true, data };
  } catch (error) {
    console.error('Error processing email queue:', error);
    return { success: false, error, data: null };
  }
};
