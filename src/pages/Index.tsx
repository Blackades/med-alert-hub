
import { useState, useEffect } from "react";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { MedicationStats } from "@/components/MedicationStats";
import type { Medication } from "@/types/medication";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { MedicationList } from "@/components/medications/MedicationList";
import { getMedicationStatus, calculateNextDose } from "@/utils/MedicationUtils";

const Index = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
      return;
    }

    fetchMedications();
  }, [session]);

  const fetchMedications = async () => {
    try {
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

      const formattedMedications: Medication[] = medsData.map(med => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        frequency: {
          timesPerDay: 1,
          intervalHours: 24,
        },
        schedule: med.medication_schedules.map(schedule => ({
          id: schedule.id,
          time: schedule.scheduled_time,
          taken: schedule.taken || false,
        })),
      }));

      setMedications(formattedMedications);
    } catch (error: any) {
      toast({
        title: "Error fetching medications",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addMedication = async (newMedication: Omit<Medication, "id">) => {
    try {
      const { data: medData, error: medError } = await supabase
        .from('medications')
        .insert({
          name: newMedication.name,
          dosage: newMedication.dosage,
          instructions: newMedication.instructions,
          user_id: user?.id,
          frequency: 'daily',
        })
        .select()
        .single();

      if (medError) throw medError;

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

      await supabase.functions.invoke('send-notification', {
        body: {
          email: user?.email,
          medication: newMedication.name,
          dosage: newMedication.dosage,
          scheduledTime: newMedication.schedule[0].time,
        },
      });

      toast({
        title: "Medication added",
        description: `${newMedication.name} has been added to your schedule.`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async (settings: { email: string; phoneNumber: string }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email: settings.email,
          phone_number: settings.phoneNumber 
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `Notifications will be sent to ${settings.email} and ${settings.phoneNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTakeMedication = async (id: string) => {
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

  const handleSkipMedication = async (id: string) => {
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

  const handleDeleteMedication = async (id: string) => {
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

  const sortedMedications = medications
    .map(getMedicationStatus)
    .sort((a, b) => new Date(a.nextDose).getTime() - new Date(b.nextDose).getTime());

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <Header 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onSaveSettings={handleSaveSettings} 
      />

      <div className="container py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Medication Reminder</h1>
                <p className="text-muted-foreground">Keep track of your daily medications</p>
              </div>
              <AddMedicationDialog onAdd={addMedication} />
            </div>

            {sortedMedications.length > 0 && (
              <div className="animate-fade-in">
                <MedicationStats medications={sortedMedications} />
              </div>
            )}

            <MedicationList 
              medications={sortedMedications} 
              onTake={handleTakeMedication}
              onSkip={handleSkipMedication}
              onDelete={handleDeleteMedication}
            />
          </div>

          <Sidebar sidebarOpen={sidebarOpen} medications={sortedMedications} />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
