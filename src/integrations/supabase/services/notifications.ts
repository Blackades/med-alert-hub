
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";

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
