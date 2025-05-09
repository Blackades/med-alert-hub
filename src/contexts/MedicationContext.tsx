
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/AuthProvider";
import type { Medication, MedicationWithStatus } from "@/types/medication";
import { getMedicationStatus, calculateNextDose } from "@/utils/MedicationUtils";
import { getMedicationStreak as fetchMedicationStreak } from "@/integrations/supabase/services/streaks";
import { sendMqttNotification } from "@/integrations/supabase/services/mqtt-service";

type MedicationContextType = {
  medications: Medication[];
  sortedMedications: MedicationWithStatus[];
  isLoading: boolean;
  fetchMedications: () => Promise<void>;
  addMedication: (newMedication: Omit<Medication, "id">) => Promise<void>;
  takeMedication: (id: string) => Promise<void>;
  skipMedication: (id: string) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  refillMedication: (id: string, quantity: number) => Promise<void>;
  getMedicationStreak: (id: string) => Promise<{ currentStreak: number; longestStreak: number }>;
};

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider = ({ children }: { children: ReactNode }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user, session } = useAuth();

  // Set up periodic medication check for automatic reminders
  useEffect(() => {
    if (session) {
      fetchMedications();
      
      // Set up automatic reminder check every minute
      const reminderInterval = setInterval(() => {
        checkAndSendReminders();
      }, 60000); // Check every minute
      
      return () => {
        clearInterval(reminderInterval);
      };
    }
  }, [session]);

  // Function to check medications and send reminders
  const checkAndSendReminders = async () => {
    try {
      // Call the medication-alerts function to check for due medications
      const { data, error } = await supabase.functions.invoke('medication-alerts', {
        method: 'GET'
      });
      
      if (error) {
        console.error("Error checking medication alerts:", error);
        return;
      }
      
      if (data?.count > 0) {
        console.log(`Found ${data.count} medications due soon`);
        // Notifications will be handled by the backend
      }
    } catch (err) {
      console.error("Error in automatic medication check:", err);
    }
  };

  const fetchMedications = async () => {
    try {
      setIsLoading(true);
      const { data: medsData, error: medsError } = await supabase
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          instructions,
          frequency,
          medication_schedules (
            id,
            scheduled_time,
            taken
          )
        `)
        .eq('user_id', user?.id);

      if (medsError) throw medsError;

      if (!Array.isArray(medsData)) {
        console.error("Expected array for medsData but got:", medsData);
        setMedications([]);
        return;
      }

      const formattedMedications: Medication[] = medsData.map(med => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        frequency: med.frequency,
        schedule: Array.isArray(med.medication_schedules) 
          ? med.medication_schedules.map(schedule => ({
              id: schedule.id,
              time: schedule.scheduled_time,
              taken: schedule.taken || false,
            }))
          : [],
      }));

      setMedications(formattedMedications);
    } catch (error: any) {
      console.error("Error in fetchMedications:", error);
      toast({
        title: "Error fetching medications",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMedication = async (newMedication: Omit<Medication, "id">) => {
    try {
      console.log("Adding medication with frequency:", newMedication.frequency);
      
      let frequency = newMedication.frequency;
      
      const { data: medData, error: medError } = await supabase
        .from('medications')
        .insert({
          name: newMedication.name,
          dosage: newMedication.dosage,
          instructions: newMedication.instructions,
          user_id: user?.id,
          frequency: frequency,
        })
        .select()
        .single();

      if (medError) {
        console.error("Error adding medication:", medError);
        throw medError;
      }

      const schedulePromises = newMedication.schedule.map(slot => 
        supabase
          .from('medication_schedules')
          .insert({
            medication_id: medData.id,
            scheduled_time: slot.time,
            next_dose: calculateNextDose(new Date(), slot.time),
            taken: false,
          })
      );

      await Promise.all(schedulePromises);

      await fetchMedications();

      if (user?.email) {
        await supabase.functions.invoke('send-notification', {
          body: {
            email: user.email,
            medication: newMedication.name,
            dosage: newMedication.dosage,
            scheduledTime: newMedication.schedule[0].time,
          },
        });
      }

      toast({
        title: "Medication added",
        description: `${newMedication.name} has been added to your schedule.`,
        className: "bg-primary/10 border-primary",
      });
    } catch (error: any) {
      console.error("Error details:", error);
      toast({
        title: "Error adding medication",
        description: error.message || "Failed to add medication",
        variant: "destructive",
      });
    }
  };

  const takeMedication = async (id: string) => {
    try {
      const medication = medications.find(med => med.id === id);
      if (!medication) return;

      // Log the medication as taken but don't permanently mark it as taken
      const { data, error } = await supabase.functions.invoke('handle-medication-status', {
        body: {
          action: 'take',
          medicationId: id,
          takenAt: new Date().toISOString(),
          updateStatus: true,  // This will update the log but not mark the medication as permanently taken
        },
      });

      if (error) throw error;
      console.log("Medication taken response:", data);

      // Send MQTT notification if supported
      try {
        // Find the actual medication details to send in the notification
        if (medication) {
          await sendMqttNotification(
            user?.id || '',
            'all',  // Send to all registered devices
            `Medication ${medication.name} taken`,
            {
              name: medication.name,
              dosage: medication.dosage,
              instructions: medication.instructions || '',
              medicationId: medication.id,
              action: 'taken'
            }
          );
        }
      } catch (mqttError) {
        console.error("MQTT notification error:", mqttError);
        // Continue even if MQTT fails
      }

      // Refresh the medications list to show updated state
      await fetchMedications();

      toast({
        title: "Medication taken",
        description: "Great job keeping up with your medication schedule!",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error taking medication:", error);
      toast({
        title: "Error updating medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const skipMedication = async (id: string) => {
    try {
      const medication = medications.find(med => med.id === id);

      // Call the medication-status service instead of directly updating
      const { data, error } = await supabase.functions.invoke('handle-medication-status', {
        body: {
          action: 'skip',
          medicationId: id,
          reason: "Skipped by user",
          updateStatus: true  // This will update the log but not mark the medication as permanently skipped
        },
      });

      if (error) throw error;
      console.log("Medication skipped response:", data);

      // Send MQTT notification if supported
      try {
        if (medication) {
          await sendMqttNotification(
            user?.id || '',
            'all',
            `Medication ${medication.name} skipped`,
            {
              name: medication.name,
              dosage: medication.dosage,
              instructions: medication.instructions || '',
              medicationId: medication.id,
              action: 'skipped'
            }
          );
        }
      } catch (mqttError) {
        console.error("MQTT notification error:", mqttError);
        // Continue even if MQTT fails
      }

      // Refresh the medications list to show updated state
      await fetchMedications();

      toast({
        title: "Medication skipped",
        description: "The medication has been marked as skipped and scheduled for next time.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error skipping medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMedication = async (id: string) => {
    try {
      const { error: scheduleError } = await supabase
        .from('medication_schedules')
        .delete()
        .eq('medication_id', id);

      if (scheduleError) throw scheduleError;

      const { error: medicationError } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (medicationError) throw medicationError;

      await fetchMedications();

      toast({
        title: "Medication deleted",
        description: "The medication has been removed from your schedule.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Updated refillMedication function
  const refillMedication = async (id: string, quantity: number) => {
    try {
      if (!quantity || quantity <= 0) {
        throw new Error("Please enter a valid refill quantity");
      }
      
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      const { data, error } = await supabase.functions.invoke('medication-refill', {
        body: {
          medicationId: id,
          refillQuantity: quantity,
          userId: user.id,
          date: new Date().toISOString(),
        },
      });
      if (error) throw error;
      console.log("Refill response:", data);
      toast({
        title: "Medication refilled",
        description: `Added ${quantity} units to your inventory.`,
        className: "bg-primary/10 border-primary",
      });
      await fetchMedications();
      return data;
    } catch (error: any) {
      console.error("Error refilling medication:", error);
      toast({
        title: "Error refilling medication",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Get medication streak using the improved function from services
  const getMedicationStreak = async (id: string) => {
    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      const { success, data } = await fetchMedicationStreak(id, user.id);
      
      if (!success) {
        throw new Error("Failed to fetch streak information");
      }
      
      // Handle both typed and untyped responses
      if (typeof data === 'object' && data !== null) {
        // Handle single streak object
        const streak = Array.isArray(data) ? data[0] : data;
        return {
          currentStreak: streak.currentStreak ?? streak.current_streak ?? 0,
          longestStreak: streak.longestStreak ?? streak.longest_streak ?? 0
        };
      }
      
      return { currentStreak: 0, longestStreak: 0 };
    } catch (error: any) {
      console.error("Error getting medication streak:", error);
      return { currentStreak: 0, longestStreak: 0 };
    }
  };

  const sortedMedications = Array.isArray(medications) 
    ? medications
        .map(getMedicationStatus)
        .sort((a, b) => {
          // Check if nextDose exists and is a valid date
          if (!a.nextDose) return 1;
          if (!b.nextDose) return -1;
          
          return new Date(a.nextDose).getTime() - new Date(b.nextDose).getTime();
        })
    : [];

  return (
    <MedicationContext.Provider
      value={{
        medications,
        sortedMedications,
        isLoading,
        fetchMedications,
        addMedication,
        takeMedication,
        skipMedication,
        deleteMedication,
        refillMedication,
        getMedicationStreak
      }}
    >
      {children}
    </MedicationContext.Provider>
  );
};

export const useMedications = (): MedicationContextType => {
  const context = useContext(MedicationContext);
  if (context === undefined) {
    throw new Error("useMedications must be used within a MedicationProvider");
  }
  return context;
};
