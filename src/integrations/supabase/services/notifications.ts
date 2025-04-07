
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

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
