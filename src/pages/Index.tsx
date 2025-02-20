
import { useState, useEffect } from "react";
import { MedicationCard } from "@/components/MedicationCard";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { MedicationStats } from "@/components/MedicationStats";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import type { Medication, MedicationWithStatus } from "@/types/medication";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, addDays } from "date-fns";

const Index = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { toast } = useToast();

  const addMedication = (newMedication: Omit<Medication, "id">) => {
    const medication: Medication = {
      ...newMedication,
      id: crypto.randomUUID(),
    };
    setMedications([...medications, medication]);
    toast({
      title: "Medication added",
      description: `${medication.name} has been added to your schedule.`,
    });
  };

  const handleSaveSettings = (settings: { email: string }) => {
    toast({
      title: "Settings saved",
      description: `Notifications will be sent to ${settings.email}`,
    });
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

  const handleTakeMedication = (id: string) => {
    setMedications(medications.map(med => {
      if (med.id === id) {
        return {
          ...med,
          schedule: med.schedule.map(slot => ({
            ...slot,
            taken: true,
          })),
        };
      }
      return med;
    }));
    toast({
      title: "Medication taken",
      description: "Great job keeping up with your medication schedule!",
    });
  };

  const handleSkipMedication = (id: string) => {
    setMedications(medications.map(med => {
      if (med.id === id) {
        return {
          ...med,
          schedule: med.schedule.map(slot => ({
            ...slot,
            taken: true,
          })),
        };
      }
      return med;
    }));
    toast({
      title: "Medication skipped",
      description: "The medication has been marked as skipped.",
      variant: "destructive",
    });
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
