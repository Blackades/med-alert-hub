
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

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

    // Call the edge function
    const response = await supabase.functions.invoke('send-notification', {
      body: options,
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to trigger notification');
    }

    // Show a success toast if appropriate
    if (response.data?.success) {
      toast({
        title: "Notification Sent",
        description: response.data.message || "Notification has been sent successfully.",
        variant: "default",
      });
    } else {
      // Partial success (status 207) handling - FIX: change variant to "default" instead of "warning"
      toast({
        title: "Notification Status",
        description: response.data?.message || "Notification request processed with warnings.",
        variant: "default", // Changed from "warning" to "default"
      });
    }

    return { success: true, data: response.data as NotificationResponse };
  } catch (error) {
    console.error('Error triggering notification:', error);
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
 * @deprecated Use triggerNotification instead
 */
export const triggerDemoNotification = async (
  userId: string, 
  medicationId: string, 
  notificationType: 'email' | 'esp32' | 'both'
) => {
  try {
    // Map the old type to the new type for backward compatibility
    const mappedType: NotificationType = notificationType as NotificationType;
    
    return await triggerNotification({
      userId,
      medicationId,
      notificationType: mappedType,
      priorityLevel: 'medium',
    });
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
