
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Interface for ESP32 device
export interface ESP32Device {
  id: string;
  device_id: string;
  device_token: string;
  user_id: string;
  is_active: boolean;
  created_at?: string;
  device_name?: string;
  device_endpoint?: string;
}

/**
 * Get user's ESP32 devices
 */
export const getUserESP32Devices = async (userId: string) => {
  try {
    console.log(`Getting ESP32 devices for user: ${userId}`);
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_type', 'esp32')
      .eq('is_active', true);
    
    if (error) throw error;
    
    console.log(`Found ${data?.length || 0} ESP32 devices for user ${userId}`);
    console.log("Device details:", data);
    
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
  name?: string,
  deviceEndpoint?: string
) => {
  try {
    console.log(`Registering ESP32 device for user ${userId}: ${deviceId} at ${deviceEndpoint}`);
    const { data, error } = await supabase
      .from('user_devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_token: deviceToken,
        device_type: 'esp32',
        is_active: true,
        device_name: name || `ESP32 Device ${deviceId.substring(0, 6)}`,
        created_at: new Date().toISOString(),
        device_endpoint: deviceEndpoint // Store the device endpoint
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`Successfully registered ESP32 device: ${deviceId}`);
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
 * Send notification to a physical ESP32 device
 */
export const sendNotificationToESP32 = async (deviceId: string, message: string, type: 'buzzer' | 'led' | 'both' = 'both') => {
  try {
    console.log(`Sending notification to ESP32 device: ${deviceId}, type: ${type}`);
    
    // Get the device details
    const { data: device, error: deviceError } = await supabase
      .from('user_devices')
      .select('*')
      .eq('device_id', deviceId)
      .eq('device_type', 'esp32')
      .single();
    
    if (deviceError || !device) {
      throw new Error(deviceError?.message || 'Device not found');
    }

    // Use the stored device_endpoint
    const deviceEndpoint = device.device_endpoint;
    
    if (!deviceEndpoint) {
      throw new Error('No device_endpoint configured for ESP32 device');
    }

    console.log(`Sending request to ESP32 at: ${deviceEndpoint}`);

    // Send notification to the physical device
    const response = await fetch(deviceEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device.device_token}`
      },
      body: JSON.stringify({
        message,
        type, // What to activate: buzzer, led or both
        duration: 5000 // Duration in ms
      })
    });

    // Log the actual response data for debugging
    let responseText, responseJson;
    try {
      responseText = await response.text();
      console.log(`Raw ESP32 response text: ${responseText}`);
      if (responseText) {
        try {
          responseJson = JSON.parse(responseText);
          console.log(`Parsed ESP32 response:`, responseJson);
        } catch (e) {
          console.log(`Could not parse response as JSON: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`Error reading response: ${e.message}`);
    }

    if (!response.ok) {
      console.error(`ESP32 returned error: ${response.status} - ${responseText}`);
      throw new Error(`Failed to send notification to ESP32: ${response.statusText}`);
    }

    // Update the last connection timestamp
    await supabase
      .from('user_devices')
      .update({ 
        is_active: true, 
        created_at: new Date().toISOString() // Using created_at as the timestamp field
      })
      .eq('device_id', deviceId);
    
    return { 
      success: true, 
      result: responseJson || { message: "Notification sent successfully" }
    };
  } catch (error) {
    console.error('Error sending notification to ESP32:', error);
    return { success: false, error: error.message || String(error) };
  }
};

/**
 * Update ESP32 device status (online/offline)
 */
export const updateESP32DeviceStatus = async (deviceId: string, isActive: boolean) => {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .update({
        is_active: isActive,
        created_at: isActive ? new Date().toISOString() : undefined // Using created_at instead of last_seen
      })
      .eq('device_id', deviceId)
      .eq('device_type', 'esp32')
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, device: data as ESP32Device };
  } catch (error) {
    console.error('Error updating ESP32 device status:', error);
    return { success: false, error };
  }
};
