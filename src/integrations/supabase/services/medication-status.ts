
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

/**
 * Mark medication as taken
 */
export const markMedicationAsTaken = async (medicationId: string, takenTime?: string) => {
  try {
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('handle-medication-status', {
      body: { 
        action: 'take', 
        medicationId,
        takenTime
      }
    });
    
    if (error) throw error;
    
    // Show success toast
    toast({
      title: "Medication Taken",
      description: "Medication has been marked as taken.",
      variant: "default",
    });
    
    return { success: true, data };
  } catch (error) {
    console.error('Error marking medication as taken:', error);
    toast({
      title: "Error",
      description: "Could not mark medication as taken.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};

/**
 * Reset medication status to upcoming
 */
export const resetMedicationStatus = async (medicationId: string) => {
  try {
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('reset-medication-status', {
      body: { medicationId }
    });
    
    if (error) throw error;
    
    // Show success toast
    toast({
      title: "Medication Status Reset",
      description: "Medication status has been reset to upcoming.",
      variant: "default",
    });
    
    return { success: true, data };
  } catch (error) {
    console.error('Error resetting medication status:', error);
    toast({
      title: "Error",
      description: "Could not reset medication status.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};

/**
 * Schedule the next dose for a medication
 */
export const scheduleNextDose = async (medicationId: string) => {
  try {
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('schedule-next-dose', {
      body: { medicationId }
    });
    
    if (error) throw error;
    
    // Show success toast
    toast({
      title: "Next Dose Scheduled",
      description: "The next dose for this medication has been scheduled.",
      variant: "default",
    });
    
    return { success: true, data };
  } catch (error) {
    console.error('Error scheduling next dose:', error);
    toast({
      title: "Error",
      description: "Could not schedule the next dose.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};

export const markMedicationAsSkipped = async (medicationId: string, reason?: string) => {
  try {
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('handle-medication-status', {
      body: { 
        action: 'skip', 
        medicationId,
        reason 
      }
    });
    
    if (error) throw error;
    
    // Show success toast
    toast({
      title: "Medication Skipped",
      description: reason 
        ? `Medication marked as skipped: ${reason}`
        : "Medication has been marked as skipped.",
      variant: "default", // Changed from "warning" to "default"
    });
    
    return { success: true, data };
  } catch (error) {
    console.error('Error skipping medication:', error);
    toast({
      title: "Error",
      description: "Could not mark medication as skipped.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};
