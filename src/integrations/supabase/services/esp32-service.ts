
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
