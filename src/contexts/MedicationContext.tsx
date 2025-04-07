
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/AuthProvider";
import type { Medication, MedicationWithStatus } from "@/types/medication";
import { getMedicationStatus, calculateNextDose } from "@/utils/MedicationUtils";

type MedicationContextType = {
  medications: Medication[];
  sortedMedications: MedicationWithStatus[];
  isLoading: boolean;
  fetchMedications: () => Promise<void>;
  addMedication: (newMedication: Omit<Medication, "id">) => Promise<void>;
  takeMedication: (id: string) => Promise<void>;
  skipMedication: (id: string) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
};

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider = ({ children }: { children: ReactNode }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user, session } = useAuth();

  useEffect(() => {
    if (session) {
      fetchMedications();
    }
  }, [session]);

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

      const { error: scheduleError } = await supabase
        .from('medication_schedules')
        .update({ taken: true })
        .eq('medication_id', id);

      if (scheduleError) throw scheduleError;

      const { error } = await supabase.functions.invoke('schedule-next-dose', {
        body: {
          medicationId: id,
          currentDose: new Date().toISOString(),
        },
      });

      if (error) throw error;

      await fetchMedications();

      toast({
        title: "Medication taken",
        description: "Great job keeping up with your medication schedule!",
      });
    } catch (error: any) {
      toast({
        title: "Error updating medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const skipMedication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('medication_schedules')
        .update({ taken: true })
        .eq('medication_id', id);

      if (error) throw error;

      await fetchMedications();

      toast({
        title: "Medication skipped",
        description: "The medication has been marked as skipped.",
        variant: "destructive",
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

  const sortedMedications = Array.isArray(medications) 
    ? medications
        .map(getMedicationStatus)
        .sort((a, b) => new Date(a.nextDose).getTime() - new Date(b.nextDose).getTime())
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
