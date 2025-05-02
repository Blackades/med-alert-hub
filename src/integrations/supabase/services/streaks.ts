import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";

/**
 * Types for medication streak data
 */
export interface MedicationStreak {
  medicationId: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastTaken?: string; // ISO date string
  // Support for backend response format
  medication_id?: string;
  medication_name?: string;
  current_streak?: number;
  longest_streak?: number;
  adherence_rate?: number;
  adherenceRate?: number;
}

export interface StreaksResponse {
  success: boolean;
  data: MedicationStreak[] | MedicationStreak;
  error?: Error;
}

// Track if an error toast is already shown to prevent duplicates
let errorToastShown = false;

// Reset the error toast flag after some time
const resetErrorToastFlag = () => {
  setTimeout(() => {
    errorToastShown = false;
  }, 5000); // Reset after 5 seconds
};

/**
 * Function to get medication streaks for a user
 * @param userId The user ID to fetch streaks for
 * @returns Object containing success status and streaks data
 */
export const getMedicationStreaks = async (userId: string): Promise<StreaksResponse> => {
  try {
    // Input validation
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Requesting medication streaks for user ${userId}`);
    
    const response = await supabase.functions.invoke('medication-streaks', {
      body: { userId },
    });
    
    if (response.error) {
      console.error("Edge function error:", response.error);
      throw new Error(response.error.message || 'Failed to fetch medication streaks');
    }
    
    console.log("Medication streaks response:", response.data);
    
    // Ensure data is an array and normalize field names
    const streaksData = Array.isArray(response.data) ? response.data : [];
    
    // Normalize field names to camelCase
    const normalizedData = streaksData.map(streak => ({
      medicationId: streak.medicationId || streak.medication_id || '',
      medicationName: streak.medicationName || streak.medication_name || '',
      currentStreak: streak.currentStreak || streak.current_streak || 0,
      longestStreak: streak.longestStreak || streak.longest_streak || 0, 
      adherenceRate: streak.adherenceRate || streak.adherence_rate || 0,
      userId: streak.userId || streak.user_id || '',
      lastTaken: streak.lastTaken || streak.last_taken,
      // Keep original fields for compatibility
      medication_id: streak.medicationId || streak.medication_id || '',
      medication_name: streak.medicationName || streak.medication_name || '',
      current_streak: streak.currentStreak || streak.current_streak || 0,
      longest_streak: streak.longestStreak || streak.longest_streak || 0,
      adherence_rate: streak.adherenceRate || streak.adherence_rate || 0
    }));
    
    // Reset the error toast flag since we have successful data
    errorToastShown = false;
    
    return { success: true, data: normalizedData };
  } catch (error) {
    console.error('Error fetching medication streaks:', error);
    
    // Only show toast if one isn't already displayed
    if (!errorToastShown) {
      errorToastShown = true;
      toast({
        title: "Error",
        description: "Could not load medication streak information.",
        variant: "destructive",
      });
      
      // Reset the flag after some time
      resetErrorToastFlag();
    }
    
    return { success: false, error: error as Error, data: [] };
  }
};

/**
 * Function to get streak for a specific medication
 * @param medicationId The medication ID to fetch streak for
 * @param userId The user ID associated with the medication
 * @returns Object containing success status and specific medication streak data
 */
export const getMedicationStreak = async (medicationId: string, userId: string): Promise<StreaksResponse> => {
  try {
    // Input validation
    if (!medicationId) {
      throw new Error('Medication ID is required');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const { success, data } = await getMedicationStreaks(userId);
    
    if (!success || !Array.isArray(data)) {
      throw new Error('Failed to fetch medication streaks');
    }
    
    // Find the specific medication streak
    const medicationStreak = data.find(streak => 
      streak.medicationId === medicationId || streak.medication_id === medicationId
    );
    
    const defaultStreak: MedicationStreak = { 
      medicationId, 
      userId, 
      currentStreak: 0, 
      longestStreak: 0,
      medication_id: medicationId,
      current_streak: 0,
      longest_streak: 0,
      adherence_rate: 0,
      adherenceRate: 0
    };
    
    return { 
      success: true, 
      data: medicationStreak || defaultStreak
    };
  } catch (error) {
    console.error('Error fetching specific medication streak:', error);
    
    // We don't show a toast here as the main function already shows one
    // and we don't want to flood the screen with error messages
    
    return { 
      success: false, 
      error: error as Error,
      data: { 
        medicationId, 
        userId,
        currentStreak: 0, 
        longestStreak: 0,
        medication_id: medicationId,
        current_streak: 0,
        longest_streak: 0,
        adherence_rate: 0,
        adherenceRate: 0
      } 
    };
  }
};
