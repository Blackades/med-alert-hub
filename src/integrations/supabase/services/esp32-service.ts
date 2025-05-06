
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Interface for ESP32 device
export interface ESP32Device {
  id: string;
  device_id: string;
  device_token: string;
  user_id: string;
  is_active: boolean;
  last_seen?: string;
  name?: string;
  endpoint?: string; // Added for physical device endpoint
}

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
  name?: string,
  endpoint?: string
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
        last_seen: new Date().toISOString(),
        endpoint: endpoint // Store the physical device endpoint
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
 * Send notification to a physical ESP32 device
 */
export const sendNotificationToESP32 = async (deviceId: string, message: string, type: 'buzzer' | 'led' | 'both' = 'both') => {
  try {
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

    // Use the stored endpoint or fall back to default
    const endpoint = device.endpoint || process.env.ESP32_ENDPOINT || '';
    
    if (!endpoint) {
      throw new Error('No endpoint configured for ESP32 device');
    }

    // Send notification to the physical device
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device.device_token}`
      },
      body: JSON.stringify({
        message,
        type, // What to activate: buzzer, led or both
        duration: 5000, // Duration in ms
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send notification to ESP32: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Update last seen timestamp
    await supabase
      .from('user_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('device_id', deviceId);
    
    return { success: true, result };
  } catch (error) {
    console.error('Error sending notification to ESP32:', error);
    return { success: false, error };
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
        last_seen: isActive ? new Date().toISOString() : undefined
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
