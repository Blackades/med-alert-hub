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
}

export interface StreaksResponse {
  success: boolean;
  data: MedicationStreak[] | MedicationStreak;
  error?: Error;
}

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

    const response = await supabase.functions.invoke('medication-streaks', {
      body: { userId },
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to fetch medication streaks');
    }
    
    // Ensure data is an array
    const streaksData = Array.isArray(response.data) ? response.data : [];
    
    return { success: true, data: streaksData };
  } catch (error) {
    console.error('Error fetching medication streaks:', error);
    toast({
      title: "Error",
      description: "Could not load medication streak information.",
      variant: "destructive",
    });
    return { success: false, error, data: [] };
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
    const medicationStreak = data.find(streak => streak.medicationId === medicationId);
    
    return { 
      success: true, 
      data: medicationStreak || { 
        medicationId, 
        userId, 
        currentStreak: 0, 
        longestStreak: 0 
      } 
    };
  } catch (error) {
    console.error('Error fetching specific medication streak:', error);
    return { 
      success: false, 
      error,
      data: { 
        medicationId, 
        userId,
        currentStreak: 0, 
        longestStreak: 0 
      } 
    };
  }
};
