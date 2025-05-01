
import { supabase } from '../client';
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/AuthProvider";

// Helper function to track medication inventory
export const updateMedicationInventory = async (medicationId: string, newQuantity: number) => {
  try {
    // Get the current user ID
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }
    
    // Using raw SQL query to avoid type issues
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
    return { success: true, data };
  } catch (error) {
    console.error('Error updating medication inventory:', error);
    toast({
      title: "Inventory Update Failed",
      description: "There was a problem updating the medication inventory.",
      variant: "destructive",
    });
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
    const response = await supabase.functions.invoke('medication-refill', {
      body: {
        medicationId,
        refillQuantity: quantity,
        date: new Date().toISOString(),
        notes
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to refill medication');
    }
    
    toast({
      title: "Medication Refilled",
      description: `Successfully added ${quantity} units to your medication.`,
      variant: "default",
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error refilling medication:', error);
    toast({
      title: "Refill Failed",
      description: "There was a problem refilling your medication.",
      variant: "destructive",
    });
    return { success: false, error };
  }
};
