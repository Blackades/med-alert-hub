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
    
    // Ensure data is an array and normalize field names
    const streaksData = Array.isArray(response.data) ? response.data : [];
    
    // Normalize field names to camelCase
    const normalizedData = streaksData.map(streak => ({
      medicationId: streak.medicationId || streak.medication_id,
      medicationName: streak.medicationName || streak.medication_name,
      currentStreak: streak.currentStreak || streak.current_streak || 0,
      longestStreak: streak.longestStreak || streak.longest_streak || 0, 
      adherenceRate: streak.adherenceRate || streak.adherence_rate || 0,
      userId: streak.userId || streak.user_id,
      lastTaken: streak.lastTaken || streak.last_taken,
      // Keep original fields for compatibility
      medication_id: streak.medicationId || streak.medication_id,
      medication_name: streak.medicationName || streak.medication_name,
      current_streak: streak.currentStreak || streak.current_streak || 0,
      longest_streak: streak.longestStreak || streak.longest_streak || 0,
      adherence_rate: streak.adherenceRate || streak.adherence_rate || 0
    }));
    
    return { success: true, data: normalizedData };
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
    return { 
      success: false, 
      error,
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
