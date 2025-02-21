
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Check, X, Trash2 } from "lucide-react";
import type { MedicationWithStatus } from "@/types/medication";
import { format } from "date-fns";

interface MedicationCardProps {
  medication: MedicationWithStatus;
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
  onDelete: (id: string) => void;
}

export const MedicationCard = ({ medication, onTake, onSkip, onDelete }: MedicationCardProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTake = () => {
    setIsAnimating(true);
    onTake(medication.id);
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <Card className={`p-6 transition-all duration-300 transform hover:shadow-lg ${
      isAnimating ? 'scale-95' : ''
    } animate-fade-up`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full bg-primary-${medication.status === 'overdue' ? '600' : '400'}`} />
            <h3 className="font-semibold text-lg">{medication.name}</h3>
          </div>
          <p className="text-sm text-gray-500">{medication.dosage}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium">
            {format(new Date(medication.nextDose), 'h:mm a')}
          </span>
        </div>
      </div>

      {medication.instructions && (
        <p className="mt-2 text-sm text-gray-600">{medication.instructions}</p>
      )}

      <div className="mt-4 flex items-center justify-end space-x-2">
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center space-x-1"
          onClick={() => onDelete(medication.id)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-1 hover:bg-gray-100"
          onClick={() => onSkip(medication.id)}
        >
          <X className="w-4 h-4" />
          <span>Skip</span>
        </Button>
        <Button
          size="sm"
          className="flex items-center space-x-1 bg-primary hover:bg-primary-600"
          onClick={handleTake}
        >
          <Check className="w-4 h-4" />
          <span>Take</span>
        </Button>
      </div>
    </Card>
  );
};
