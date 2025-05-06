
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";
import { sendNotificationToESP32, getUserESP32Devices } from './esp32-service';

// Function to fetch ESP32 notifications data
export const fetchEsp32Notifications = async () => {
  try {
    const response = await supabase.functions.invoke('esp32-notifications', {
      method: 'GET',
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch ESP32 notifications');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching ESP32 notifications:', error);
    toast({
      title: "Error",
      description: "Could not fetch notifications for ESP32 device.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};

// Function to send notification to all of user's ESP32 devices
export const sendEsp32Notification = async (userId: string, message: string, type: 'buzzer' | 'led' | 'both' = 'both') => {
  try {
    // Get all ESP32 devices for the user
    const { devices, success, error } = await getUserESP32Devices(userId);
    
    if (!success || error) {
      throw error || new Error('Failed to get ESP32 devices');
    }
    
    if (!devices || devices.length === 0) {
      console.log('No ESP32 devices found for user:', userId);
      return { success: true, message: 'No ESP32 devices found', deviceCount: 0 };
    }
    
    // Send notification to all devices
    const notificationPromises = devices.map(device => 
      sendNotificationToESP32(device.device_id, message, type)
    );
    
    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      message: `Sent notifications to ${successCount}/${devices.length} ESP32 devices`,
      deviceCount: devices.length,
      successCount
    };
  } catch (error) {
    console.error('Error sending ESP32 notifications:', error);
    return { success: false, error, deviceCount: 0, successCount: 0 };
  }
};

// Function to directly process email queue after demo notifications
export const processEmailsAfterDemo = async () => {
  try {
    // Pass a flag to prioritize demo emails in the queue
    const response = await supabase.functions.invoke('process-email-queue', {
      method: 'POST',
      body: { prioritizeDemoEmails: true }
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to process email queue');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error processing emails after demo:', error);
    return { success: false, error };
  }
};
