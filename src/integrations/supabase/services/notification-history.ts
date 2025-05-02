
import { supabase } from '../client';

/**
 * Get notification history for a user
 */
export const getNotificationHistory = async (userId: string, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select(`
        id,
        user_id,
        medication_id,
        notification_type,
        priority_level,
        delivered,
        scheduled_time,
        created_at,
        updated_at,
        medications (name, dosage, instructions)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return { success: true, notifications: data };
  } catch (error) {
    console.error('Error getting notification history:', error);
    return { success: false, error, notifications: [] };
  }
};
