
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { Medication, TimeSlot } from "@/types/medication";
import { addHours, format } from "date-fns";

interface AddMedicationDialogProps {
  onAdd: (medication: Omit<Medication, "id">) => void;
}

export const AddMedicationDialog = ({ onAdd }: AddMedicationDialogProps) => {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [firstDoseTime, setFirstDoseTime] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const intervalHours = 24 / timesPerDay;
    const schedule: TimeSlot[] = [];
    
    // Generate all dose times based on first dose and frequency
    for (let i = 0; i < timesPerDay; i++) {
      const baseTime = new Date(`2000-01-01T${firstDoseTime}`);
      const doseTime = addHours(baseTime, i * intervalHours);
      schedule.push({
        id: `time-${i}`,
        time: format(doseTime, 'HH:mm'),
        taken: false,
      });
    }

    onAdd({
      name,
      dosage,
      instructions,
      schedule,
      frequency: {
        timesPerDay,
        intervalHours,
      },
    });

    setName("");
    setDosage("");
    setInstructions("");
    setTimesPerDay(1);
    setFirstDoseTime("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Medication
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Medication Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timesPerDay">Times per Day</Label>
            <Input
              id="timesPerDay"
              type="number"
              min="1"
              max="24"
              value={timesPerDay}
              onChange={(e) => setTimesPerDay(parseInt(e.target.value))}
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstDoseTime">First Dose Time</Label>
            <Input
              id="firstDoseTime"
              type="time"
              value={firstDoseTime}
              onChange={(e) => setFirstDoseTime(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (Optional)</Label>
            <Input
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary-600">
            Save Medication
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
