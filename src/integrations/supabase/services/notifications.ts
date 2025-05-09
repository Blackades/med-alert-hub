
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";
import { sendNotificationToESP32, getUserESP32Devices } from './esp32-service';
import { sendMqttNotification, getUserMqttDevices } from './mqtt-service';

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
    console.log(`Sending ESP32 notification to user ${userId} with message: ${message}, type: ${type}`);
    
    // First try MQTT devices
    const mqttResult = await sendMqttNotificationsToAllDevices(userId, message, {});
    
    // Then try direct HTTP devices
    const { devices, success, error } = await getUserESP32Devices(userId);
    
    if (!success || error) {
      // If HTTP devices failed but MQTT succeeded, return partial success
      if (mqttResult.success && mqttResult.deviceCount > 0) {
        console.log(`MQTT notification succeeded for ${mqttResult.successCount} devices`);
        return mqttResult;
      }
      throw error || new Error('Failed to get ESP32 devices');
    }
    
    if (!devices || devices.length === 0) {
      // If no HTTP devices but MQTT succeeded, return MQTT results
      if (mqttResult.success && mqttResult.deviceCount > 0) {
        console.log(`No HTTP ESP32 devices found, but MQTT notification successful`);
        return mqttResult;
      }
      console.log('No ESP32 devices found for user:', userId);
      return { success: true, message: 'No ESP32 devices found', deviceCount: 0 };
    }
    
    console.log(`Found ${devices.length} HTTP ESP32 devices for user ${userId}`);
    
    // Send notification to all HTTP devices
    const notificationPromises = devices.map(device => {
      // Check if device has endpoint
      if (!device.device_endpoint) {
        console.log(`Device ${device.device_id} has no endpoint configured`);
        return Promise.resolve({ 
          device_id: device.device_id,
          success: false, 
          error: 'No endpoint configured' 
        });
      }
      
      console.log(`Attempting to send HTTP notification to device: ${device.device_id} at ${device.device_endpoint}`);
      return sendNotificationToESP32(device.device_id, message, type);
    });
    
    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Successfully sent HTTP notifications to ${successCount}/${devices.length} ESP32 devices`);
    console.log(`HTTP notification results:`, results);
    
    // Combine HTTP and MQTT results
    const totalDeviceCount = devices.length + (mqttResult.deviceCount || 0);
    const totalSuccessCount = successCount + (mqttResult.successCount || 0);
    
    return {
      success: totalSuccessCount > 0,
      message: `Sent notifications to ${totalSuccessCount}/${totalDeviceCount} ESP32 devices`,
      deviceCount: totalDeviceCount,
      successCount: totalSuccessCount,
      httpResults: results,
      mqttResults: mqttResult.results
    };
  } catch (error) {
    console.error('Error sending ESP32 notifications:', error);
    return { success: false, error, deviceCount: 0, successCount: 0 };
  }
};

// Function to send notifications to all MQTT devices
export const sendMqttNotificationsToAllDevices = async (
  userId: string, 
  message: string, 
  medicationDetails: any = {}
) => {
  try {
    console.log(`Sending MQTT notifications for user ${userId}`);
    
    // Get all MQTT devices for the user
    const { devices, success, error } = await getUserMqttDevices(userId);
    
    if (!success || error) {
      throw error || new Error('Failed to get MQTT devices');
    }
    
    if (!devices || devices.length === 0) {
      console.log('No MQTT devices found for user:', userId);
      return { success: true, message: 'No MQTT devices found', deviceCount: 0, successCount: 0 };
    }
    
    console.log(`Found ${devices.length} MQTT devices for user ${userId}`);
    
    // Send notification to all devices
    const notificationPromises = devices.map(device => {
      console.log(`Attempting to send MQTT notification to device: ${device.device_id}`);
      return sendMqttNotification(userId, device.device_id, message, medicationDetails);
    });
    
    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Successfully sent MQTT notifications to ${successCount}/${devices.length} devices`);
    
    return {
      success: successCount > 0,
      message: `Sent MQTT notifications to ${successCount}/${devices.length} devices`,
      deviceCount: devices.length,
      successCount,
      results
    };
  } catch (error) {
    console.error('Error sending MQTT notifications:', error);
    return { success: false, error, deviceCount: 0, successCount: 0 };
  }
};

// Function to directly process email queue after demo notifications
export const processEmailsAfterDemo = async () => {
  try {
    // Pass a flag to prioritize demo emails in the queue and prevent duplication
    const response = await supabase.functions.invoke('process-email-queue', {
      method: 'POST',
      body: { 
        prioritizeDemoEmails: true,
        preventDuplicates: true 
      }
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
