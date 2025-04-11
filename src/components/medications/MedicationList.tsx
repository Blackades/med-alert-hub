
import { MedicationCard } from "@/components/MedicationCard";
import { EmptyMedications } from "./EmptyMedications";
import type { MedicationWithStatus } from "@/types/medication";

interface MedicationListProps {
  medications: MedicationWithStatus[];
  onTake: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showActions?: boolean; // Added showActions prop with optional flag
  isLoading?: boolean; // Added isLoading prop
}

export const MedicationList = ({ 
  medications, 
  onTake, 
  onSkip, 
  onDelete,
  showActions = true, // Default to true to maintain backward compatibility
  isLoading = false // Default to false for isLoading
}: MedicationListProps) => {
  if (isLoading) {
    return <div className="flex justify-center py-8">Loading medications...</div>;
  }
  
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
