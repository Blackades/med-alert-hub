import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

// Types for better TypeScript support
type MedicationAction = 'take' | 'miss' | 'skip' | 'delay';

interface MedicationStatusOptions {
  reason?: string;
  delayDuration?: number; // In hours
  quantity?: number;
  takenAt?: Date | string;
}

interface MedicationStatusResponse {
  success: boolean;
  data?: {
    nextReminder: string;
    actionTaken: MedicationAction;
    medicationName: string;
    processedAt: string;
    inventoryStatus?: 'depleted' | 'below_threshold' | null;
  };
  error?: any;
}

/**
 * Comprehensive helper function to handle all medication actions
 * 
 * @param medicationId - The ID of the medication
 * @param action - The action to perform (take, miss, skip, delay)
 * @param options - Additional options like reason, quantity, etc.
 * @returns Response with status and data
 */
export const handleMedicationStatus = async (
  medicationId: string,
  action: MedicationAction,
  options: MedicationStatusOptions = {}
): Promise<MedicationStatusResponse> => {
  try {
    // Prepare request body
    const requestBody: Record<string, any> = {
      medicationId,
      action,
    };

    // Add optional parameters if provided
    if (options.reason) requestBody.reason = options.reason;
    if (options.delayDuration && action === 'delay') requestBody.delayDuration = options.delayDuration;
    if (options.quantity && action === 'take') requestBody.quantity = options.quantity;
    if (options.takenAt) requestBody.takenAt = options.takenAt instanceof Date 
      ? options.takenAt.toISOString() 
      : options.takenAt;

    // Call the edge function
    const response = await supabase.functions.invoke('handle-medication-status', {
      body: requestBody
    });
    
    if (response.error) {
      throw new Error(response.error.message || `Failed to ${action} medication`);
    }
    
    const data = response.data;
    
    // Handle toast notifications based on action
    const actionDisplayText = getActionDisplayText(action);
    
    // Create toast notification
    toast({
      title: `Medication ${actionDisplayText.title}`,
      description: actionDisplayText.description,
      variant: "default",
    });
    
    // Handle inventory status notifications if medication was taken
    if (action === 'take' && data.inventoryStatus) {
      handleInventoryNotification(data.inventoryStatus, data.medicationName);
    }
    
    // Format and return the response
    return { 
      success: true, 
      data
    };
  } catch (error) {
    console.error(`Error handling medication ${action}:`, error);
    
    // Error toast
    toast({
      title: "Action Failed",
      description: `There was a problem with your medication ${action} action.`,
      variant: "destructive",
    });
    
    return { success: false, error };
  }
};

/**
 * Get appropriate display text for different actions
 */
function getActionDisplayText(action: MedicationAction) {
  switch (action) {
    case 'take':
      return {
        title: 'Taken',
        description: 'Your medication has been marked as taken.'
      };
    case 'miss':
      return {
        title: 'Missed',
        description: 'Your medication has been marked as missed.'
      };
    case 'skip':
      return {
        title: 'Skipped',
        description: 'Your medication has been marked as skipped.'
      };
    case 'delay':
      return {
        title: 'Delayed',
        description: 'Your medication reminder has been delayed.'
      };
    default:
      return {
        title: 'Updated',
        description: 'Your medication status has been updated.'
      };
  }
}

/**
 * Show appropriate notifications for inventory status
 */
function handleInventoryNotification(
  inventoryStatus: 'depleted' | 'below_threshold', 
  medicationName: string
) {
  if (inventoryStatus === 'depleted') {
    toast({
      title: "Medication Depleted",
      description: `You've taken your last dose of ${medicationName}. Please refill soon.`,
      variant: "destructive",
      duration: 6000,
    });
  } else if (inventoryStatus === 'below_threshold') {
    toast({
      title: "Low Medication Supply",
      description: `Your supply of ${medicationName} is running low. Consider refilling soon.`,
      variant: "warning",
      duration: 5000,
    });
  }
}

/**
 * Helper specifically for taking medication with optional quantity
 */
export const takeMedication = async (
  medicationId: string, 
  quantity?: number, 
  takenAt?: Date
): Promise<MedicationStatusResponse> => {
  return handleMedicationStatus(medicationId, 'take', { quantity, takenAt });
};

/**
 * Helper specifically for delaying medication with required duration
 */
export const delayMedication = async (
  medicationId: string, 
  delayDuration: number, // in hours
  reason?: string
): Promise<MedicationStatusResponse> => {
  return handleMedicationStatus(medicationId, 'delay', { delayDuration, reason });
};

/**
 * Format a date returned from the API to a user-friendly string
 */
export const formatReminderTime = (isoDateString: string): string => {
  const date = new Date(isoDateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
};

/**
 * Calculate time remaining until next reminder
 * @returns Object with time remaining and formatted string
 */
export const getTimeUntilReminder = (nextReminderIso: string) => {
  const now = new Date();
  const nextReminder = new Date(nextReminderIso);
  const diffMs = nextReminder.getTime() - now.getTime();
  
  // Handle case if reminder is in the past
  if (diffMs < 0) return { hours: 0, minutes: 0, text: "Now" };
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let text = '';
  if (hours > 0) {
    text += `${hours} hr${hours !== 1 ? 's' : ''} `;
  }
  text += `${minutes} min${minutes !== 1 ? 's' : ''}`;
  
  return { hours, minutes, text };
};
