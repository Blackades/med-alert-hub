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

// Interface for ESP32 device
export interface ESP32Device {
  id: string;
  device_id: string;
  device_token: string;
  user_id: string;
  is_active: boolean;
  last_seen?: string;
  name?: string;
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
      // Partial success (status 207) handling
      toast({
        title: "Notification Status",
        description: response.data?.message || "Notification request processed with warnings.",
        variant: "warning",
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
 * Get user's ESP32 devices
 */
export const getUserESP32Devices = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_type', 'esp32')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return { success: true, devices: data as ESP32Device[] };
  } catch (error) {
    console.error('Error getting ESP32 devices:', error);
    return { success: false, error, devices: [] };
  }
};

/**
 * Register a new ESP32 device for a user
 */
export const registerESP32Device = async (
  userId: string,
  deviceId: string,
  deviceToken: string,
  name?: string
) => {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_token: deviceToken,
        device_type: 'esp32',
        is_active: true,
        name: name || `ESP32 Device ${deviceId.substring(0, 6)}`,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    toast({
      title: "Device Registered",
      description: "Your ESP32 device has been registered successfully.",
      variant: "default",
    });
    
    return { success: true, device: data as ESP32Device };
  } catch (error) {
    console.error('Error registering ESP32 device:', error);
    toast({
      title: "Error",
      description: "Could not register ESP32 device.",
      variant: "destructive",
    });
    return { success: false, error, device: null };
  }
};

/**
 * Get notification history for a user
 */
export const getNotificationHistory = async (userId: string, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select(`
        id,
        user_id,
        medication_id,
        notification_type,
        priority_level,
        delivered,
        scheduled_time,
        created_at,
        updated_at,
        medications (name, dosage, instructions)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return { success: true, notifications: data };
  } catch (error) {
    console.error('Error getting notification history:', error);
    return { success: false, error, notifications: [] };
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
