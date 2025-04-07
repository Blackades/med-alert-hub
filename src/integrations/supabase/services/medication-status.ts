
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Helper function to handle medication status (take/miss/skip)
export const handleMedicationStatus = async (
  medicationId: string,
  action: 'take' | 'miss' | 'skip',
  reason?: string
) => {
  try {
    const response = await supabase.functions.invoke('handle-medication-status', {
      body: {
        medicationId,
        action,
        reason
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message || `Failed to ${action} medication`);
    }
    
    const actionText = action === 'take' ? 'taken' : action === 'miss' ? 'missed' : 'skipped';
    
    toast({
      title: `Medication ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
      description: `Your medication has been marked as ${actionText}.`,
      variant: "default",
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error handling medication ${action}:`, error);
    toast({
      title: "Action Failed",
      description: `There was a problem marking your medication as ${action === 'take' ? 'taken' : action === 'miss' ? 'missed' : 'skipped'}.`,
      variant: "destructive",
    });
    return { success: false, error };
  }
};
