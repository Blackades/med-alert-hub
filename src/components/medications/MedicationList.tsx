
import { MedicationCard } from "@/components/MedicationCard";
import { EmptyMedications } from "./EmptyMedications";
import type { MedicationWithStatus } from "@/types/medication";

interface MedicationListProps {
  medications: MedicationWithStatus[];
  onTake: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showActions?: boolean; // Added showActions prop with optional flag
}

export const MedicationList = ({ 
  medications, 
  onTake, 
  onSkip, 
  onDelete,
  showActions = true // Default to true to maintain backward compatibility
}: MedicationListProps) => {
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
            showActions={showActions}
          />
        ))
      )}
    </div>
  );
};
