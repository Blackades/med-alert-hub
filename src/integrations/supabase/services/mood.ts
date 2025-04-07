
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Function to track mood
export const recordMood = async (userId: string, mood: string, notes?: string) => {
  try {
    const response = await supabase.functions.invoke('mood-tracker', {
      body: { 
        userId, 
        mood, 
        notes, 
        date: new Date().toISOString() 
      },
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to record mood');
    }
    
    toast({
      title: "Mood Recorded",
      description: "Your mood has been recorded successfully.",
      variant: "default",
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error recording mood:', error);
    toast({
      title: "Error",
      description: "Could not record your mood.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};

// Function to get mood history
export const getMoodHistory = async (userId: string) => {
  try {
    const response = await supabase.functions.invoke('mood-tracker', {
      body: { userId },
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch mood history');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching mood history:', error);
    toast({
      title: "Error",
      description: "Could not load mood history.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};
