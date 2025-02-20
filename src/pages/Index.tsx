
import { useState, useEffect } from "react";
import { MedicationCard } from "@/components/MedicationCard";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { MedicationStats } from "@/components/MedicationStats";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import type { Medication, MedicationWithStatus } from "@/types/medication";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const navigate = useNavigate();

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
      // Insert medication
      const { data: medData, error: medError } = await supabase
        .from('medications')
        .insert({
          name: newMedication.name,
          dosage: newMedication.dosage,
          instructions: newMedication.instructions,
          user_id: user?.id,
          frequency: 'daily', // Default to daily for now
        })
        .select()
        .single();

      if (medError) throw medError;

      // Insert schedules
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

      // Refresh medications list
      await fetchMedications();

      // Schedule notification
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

  const handleSaveSettings = async (settings: { email: string }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email: settings.email })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `Notifications will be sent to ${settings.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateNextDose = (currentTime: Date, scheduledTime: string): string => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const nextDoseTime = parseISO(`${todayStr}T${scheduledTime}`);
    return nextDoseTime <= currentTime 
      ? addDays(nextDoseTime, 1).toISOString()
      : nextDoseTime.toISOString();
  };

  const getMedicationStatus = (medication: Medication): MedicationWithStatus => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    
    const nextDoseTime = medication.schedule
      .map(slot => parseISO(`${todayStr}T${slot.time}`))
      .find(time => time > now) || addDays(parseISO(`${todayStr}T${medication.schedule[0].time}`), 1);

    const status = medication.schedule.some(slot => slot.taken)
      ? 'taken'
      : nextDoseTime < now
      ? 'overdue'
      : 'upcoming';

    return {
      ...medication,
      nextDose: nextDoseTime.toISOString(),
      status,
    };
  };

  const handleTakeMedication = async (id: string) => {
    try {
      const medication = medications.find(med => med.id === id);
      if (!medication) return;

      // Update all schedule slots for this medication
      const { error } = await supabase
        .from('medication_schedules')
        .update({ taken: true })
        .eq('medication_id', id);

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

  const sortedMedications = medications
    .map(getMedicationStatus)
    .sort((a, b) => new Date(a.nextDose).getTime() - new Date(b.nextDose).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Medication Reminder</h1>
            <p className="text-gray-600 mt-1">Keep track of your daily medications</p>
          </div>
          <div className="flex items-center space-x-2">
            <UserSettingsDialog onSave={handleSaveSettings} />
            <AddMedicationDialog onAdd={addMedication} />
          </div>
        </div>

        {sortedMedications.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <MedicationStats medications={sortedMedications} />
          </div>
        )}

        <div className="space-y-4">
          {sortedMedications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <p className="text-gray-600">No medications added yet.</p>
              <p className="text-gray-500 text-sm mt-1">
                Click the "Add Medication" button to get started.
              </p>
            </div>
          ) : (
            sortedMedications.map((medication) => (
              <MedicationCard
                key={medication.id}
                medication={medication}
                onTake={handleTakeMedication}
                onSkip={handleSkipMedication}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
