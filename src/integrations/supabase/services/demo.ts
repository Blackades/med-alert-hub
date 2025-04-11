
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

export type DemoNotificationType = 'email' | 'esp32' | 'both';

// Function to trigger demo notifications
export const triggerDemoNotification = async (
  userId: string, 
  medicationId: string, 
  notificationType: DemoNotificationType
) => {
  try {
    const response = await supabase.functions.invoke('demo-notification', {
      body: { userId, medicationId, notificationType },
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to trigger demo notification');
    }
    
    return { success: true, data: response.data };
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

// Function to make the demo panel functionality explicit
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
