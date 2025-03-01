
import { MedicationCard } from "@/components/MedicationCard";
import { EmptyMedications } from "./EmptyMedications";
import type { MedicationWithStatus } from "@/types/medication";

interface MedicationListProps {
  medications: MedicationWithStatus[];
  onTake: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const MedicationList = ({ medications, onTake, onSkip, onDelete }: MedicationListProps) => {
  return (
    <div className="space-y-4">
      {medications.length === 0 ? (
        <EmptyMedications />
      ) : (
        medications.map((medication) => (
          <MedicationCard
            key={medication.id}
            medication={medication}
            onTake={onTake}
            onSkip={onSkip}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};
