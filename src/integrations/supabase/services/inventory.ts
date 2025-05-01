import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";
import { User } from '@supabase/supabase-js';

// Helper function to get current authenticated user
export const getCurrentUser = async (): Promise<User> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.id) {
    throw new Error("User not authenticated");
  }
  
  return user;
};

// Helper function to show toast notification
export const showNotification = (
  title: string,
  description: string,
  variant: "default" | "destructive" = "default"
) => {
  toast({
    title,
    description,
    variant,
  });
};

// Helper function to track medication inventory
export const updateMedicationInventory = async (medicationId: string, newQuantity: number) => {
  try {
    // Get the current user ID
    const user = await getCurrentUser();
    
    // Using upsert to handle both insert and update scenarios
    const { data, error } = await supabase
      .from('medication_inventory')
      .upsert({
        medication_id: medicationId,
        current_quantity: newQuantity,
        last_updated: new Date().toISOString(),
        user_id: user.id
      }, {
        onConflict: 'medication_id',
        ignoreDuplicates: false
      });
    
    if (error) throw error;
    
    showNotification(
      "Inventory Updated", 
      `Medication quantity updated to ${newQuantity} units.`
    );
    
    return { success: true, data };
  } catch (error) {
    console.error('Error updating medication inventory:', error);
    showNotification(
      "Inventory Update Failed",
      "There was a problem updating the medication inventory.",
      "destructive"
    );
    return { success: false, error };
  }
};

// Helper function to refill medication inventory
export const refillMedication = async (
  medicationId: string, 
  quantity: number, 
  notes?: string
) => {
  try {
    // Get the current user to include in the payload
    const user = await getCurrentUser();
    
    // Call the Supabase Edge Function with complete payload
    const response = await supabase.functions.invoke('medication-refill', {
      body: {
        medicationId,
        refillQuantity: quantity,
        userId: user.id,
        date: new Date().toISOString(),
        notes: notes || null // Ensure consistent handling of optional notes
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to refill medication');
    }
    
    showNotification(
      "Medication Refilled",
      `Successfully added ${quantity} units to your medication.`
    );
    
    // After successful refill, update the local inventory to reflect new quantity
    if (response.data?.newQuantity) {
      // Update the local inventory with the new quantity returned from the server
      await updateMedicationInventory(medicationId, response.data.newQuantity);
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error refilling medication:', error);
    showNotification(
      "Refill Failed",
      "There was a problem refilling your medication.",
      "destructive"
    );
    return { success: false, error };
  }
};
