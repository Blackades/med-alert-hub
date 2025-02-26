import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Check, X, Trash2, AlertTriangle } from "lucide-react";
import { format, parseISO, isFuture, isPast, differenceInMinutes } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export interface MedicationWithStatus {
  id: string;
  name: string;
  dosage: string;
  instructions?: string;
  nextDose: string; // ISO string
  status: 'upcoming' | 'due' | 'overdue' | 'taken' | 'missed' | 'skipped';
  frequency: string;
}

interface MedicationCardProps {
  medication: MedicationWithStatus;
  onTake: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const MedicationCard = ({ medication, onTake, onSkip, onDelete }: MedicationCardProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [medicationStatus, setMedicationStatus] = useState(medication.status);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const { toast } = useToast();

  // Process the medication status and update it every minute
  useEffect(() => {
    const updateStatus = () => {
      if (!medication.nextDose) return;
      
      const nextDoseTime = parseISO(medication.nextDose);
      const now = new Date();
      
      // Calculate time difference in minutes
      const minutesDiff = differenceInMinutes(nextDoseTime, now);
      
      let newStatus = medication.status;
      let timeText = null;
      
      if (['taken', 'skipped', 'missed'].includes(medication.status)) {
        // Status is final, don't change it
        newStatus = medication.status as any;
      } else if (minutesDiff <= -10) {
        // More than 10 minutes past the scheduled time
        newStatus = 'overdue';
        timeText = `${Math.abs(minutesDiff)}m overdue`;
      } else if (minutesDiff < 0) {
        // Less than 10 minutes past, still due
        newStatus = 'due';
        timeText = 'Due now';
      } else if (minutesDiff <= 10) {
        // Due within 10 minutes
        newStatus = 'due';
        timeText = `Due in ${minutesDiff}m`;
      } else {
        // Upcoming dose
        newStatus = 'upcoming';
        
        if (minutesDiff < 60) {
          timeText = `In ${minutesDiff}m`;
        } else {
          const hours = Math.floor(minutesDiff / 60);
          const mins = minutesDiff % 60;
          timeText = `In ${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
        }
      }
      
      setMedicationStatus(newStatus as any);
      setTimeRemaining(timeText);
    };
    
    // Update immediately
    updateStatus();
    
    // Set up interval to update every minute
    const interval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(interval);
  }, [medication.nextDose, medication.status]);

  // Handle taking medication
  const handleTake = async () => {
    if (!['due', 'overdue'].includes(medicationStatus) && medicationStatus !== 'upcoming') {
      return;
    }
    
    try {
      setIsAnimating(true);
      await onTake(medication.id);
      setMedicationStatus('taken');
      toast({
        title: "Medication taken",
        description: `You've marked ${medication.name} as taken.`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark medication as taken. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  // Handle skipping medication
  const handleSkip = async () => {
    if (!['due', 'overdue', 'upcoming'].includes(medicationStatus)) {
      return;
    }
    
    try {
      setIsAnimating(true);
      await onSkip(medication.id);
      setMedicationStatus('skipped');
      toast({
        title: "Medication skipped",
        description: `You've marked ${medication.name} as skipped.`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark medication as skipped. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  // Handle deleting medication
  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete ${medication.name}?`)) {
      try {
        await onDelete(medication.id);
        toast({
          title: "Medication deleted",
          description: `${medication.name} has been deleted.`,
          variant: "default",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete medication. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Get status-based styling
  const getStatusColor = () => {
    switch (medicationStatus) {
      case 'taken':
        return "bg-green-500";
      case 'skipped':
        return "bg-yellow-500";
      case 'missed':
        return "bg-red-500";
      case 'overdue':
        return "bg-red-400";
      case 'due':
        return "bg-orange-500";
      case 'upcoming':
      default:
        return "bg-blue-500";
    }
  };

  // Get formatted next dose time
  const getFormattedNextDose = () => {
    if (!medication.nextDose) return 'N/A';
    return format(parseISO(medication.nextDose), 'h:mm a');
  };

  // Determine if action buttons should be disabled
  const canTake = ['due', 'overdue', 'upcoming'].includes(medicationStatus);
  const canSkip = ['due', 'overdue', 'upcoming'].includes(medicationStatus);

  return (
    <Card className={cn(
      "p-6 transition-all duration-300 transform hover:shadow-lg dark:bg-gray-800 dark:border-gray-700",
      isAnimating ? "scale-95" : "",
      medicationStatus === 'overdue' ? "border-l-4 border-l-red-500" : "",
      medicationStatus === 'due' ? "border-l-4 border-l-orange-500" : ""
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <h3 className="font-semibold text-lg dark:text-white">{medication.name}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{medication.dosage}</p>
          {medication.frequency && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{medication.frequency}</p>
          )}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium dark:text-gray-300">
              {getFormattedNextDose()}
            </span>
          </div>
          {timeRemaining && (
            <span className={cn(
              "text-xs mt-1",
              medicationStatus === 'overdue' ? "text-red-500 font-medium" : "text-gray-500"
            )}>
              {medicationStatus === 'overdue' && <AlertTriangle className="inline w-3 h-3 mr-1" />}
              {timeRemaining}
            </span>
          )}
        </div>
      </div>

      {medication.instructions && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{medication.instructions}</p>
      )}

      <div className="mt-4 flex items-center justify-end space-x-2">
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center space-x-1"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={handleSkip}
          disabled={!canSkip || medicationStatus === 'skipped'}
        >
          <X className="w-4 h-4" />
          <span>{medicationStatus === 'skipped' ? 'Skipped' : 'Skip'}</span>
        </Button>
        <Button
          size="sm"
          className={cn(
            "flex items-center space-x-1",
            medicationStatus === 'taken' ? "bg-green-500 hover:bg-green-600" : ""
          )}
          onClick={handleTake}
          disabled={!canTake || medicationStatus === 'taken'}
        >
          <Check className="w-4 h-4" />
          <span>{medicationStatus === 'taken' ? 'Taken' : 'Take'}</span>
        </Button>
      </div>
    </Card>
  );
};
