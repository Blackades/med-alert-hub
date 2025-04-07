
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Function to get medication streaks
export const getMedicationStreaks = async (userId: string) => {
  try {
    const response = await supabase.functions.invoke('medication-streaks', {
      body: { userId },
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch medication streaks');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching medication streaks:', error);
    toast({
      title: "Error",
      description: "Could not load medication streak information.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};
