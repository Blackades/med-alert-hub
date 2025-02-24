
import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Check, X, Trash2 } from "lucide-react";
import type { MedicationWithStatus } from "@/types/medication";
import { format, parseISO, isFuture } from "date-fns";

interface MedicationCardProps {
  medication: MedicationWithStatus;
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
  onDelete: (id: string) => void;
}

export const MedicationCard = ({ medication, onTake, onSkip, onDelete }: MedicationCardProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [canTake, setCanTake] = useState(false);

  useEffect(() => {
    const checkCanTake = () => {
      if (!medication.nextDose) return false;
      const nextDoseTime = new Date(medication.nextDose);
      return !isFuture(nextDoseTime);
    };

    // Initial check
    setCanTake(checkCanTake());

    // Set up interval to check every minute
    const interval = setInterval(() => {
      setCanTake(checkCanTake());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [medication.nextDose]);

  const handleTake = async () => {
    setIsAnimating(true);
    await onTake(medication.id);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const statusColors = {
    upcoming: "bg-primary",
    overdue: "bg-destructive",
    taken: "bg-green-500",
    missed: "bg-red-500"
  };

  const getStatusColor = () => {
    if (medication.status === 'taken') return statusColors.taken;
    if (medication.status === 'missed' || medication.missed) return statusColors.missed;
    if (medication.status === 'overdue') return statusColors.overdue;
    return statusColors.upcoming;
  };

  const nextDoseTime = medication.nextDose ? format(parseISO(medication.nextDose), 'h:mm a') : 'N/A';

  const isMedicationMissed = medication.status === 'missed' || medication.missed;

  return (
    <Card className={`p-6 transition-all duration-300 transform hover:shadow-lg ${
      isAnimating ? 'scale-95' : ''
    } animate-fade-up dark:bg-gray-800 dark:border-gray-700`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <h3 className="font-semibold text-lg dark:text-white">{medication.name}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{medication.dosage}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium dark:text-gray-300">
            {nextDoseTime}
          </span>
        </div>
      </div>

      {medication.instructions && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{medication.instructions}</p>
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
          className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => onSkip(medication.id)}
          disabled={medication.status === 'taken' || isMedicationMissed}
        >
          <X className="w-4 h-4" />
          <span>Skip</span>
        </Button>
        <Button
          size="sm"
          className="flex items-center space-x-1"
          onClick={handleTake}
          disabled={!canTake || medication.status === 'taken' || isMedicationMissed}
        >
          <Check className="w-4 h-4" />
          <span>{medication.status === 'taken' ? 'Taken' : 'Take'}</span>
        </Button>
      </div>
    </Card>
  );
};
