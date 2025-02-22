
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [frequency, setFrequency] = useState("daily");
  const [firstDoseTime, setFirstDoseTime] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const frequencyMap = {
      'daily': { timesPerDay: 1, intervalHours: 24 },
      'twice_daily': { timesPerDay: 2, intervalHours: 12 },
      'thrice_daily': { timesPerDay: 3, intervalHours: 8 },
      'every_hour': { timesPerDay: 24, intervalHours: 1 },
    };
    
    const medicationFrequency = frequencyMap[frequency as keyof typeof frequencyMap];
    const schedule: TimeSlot[] = [];
    
    // Generate all dose times based on first dose and frequency
    const totalDoses = 24 / medicationFrequency.intervalHours;
    for (let i = 0; i < totalDoses; i++) {
      const baseTime = new Date(`2000-01-01T${firstDoseTime}`);
      const doseTime = addHours(baseTime, i * medicationFrequency.intervalHours);
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
      frequency: medicationFrequency,
    });

    setName("");
    setDosage("");
    setInstructions("");
    setFrequency("daily");
    setFirstDoseTime("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Once daily</SelectItem>
                <SelectItem value="twice_daily">Twice daily (every 12 hours)</SelectItem>
                <SelectItem value="thrice_daily">Three times daily (every 8 hours)</SelectItem>
                <SelectItem value="every_hour">Every hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstDoseTime">First Dose Time</Label>
            <Input
              id="firstDoseTime"
              type="time"
              value={firstDoseTime}
              onChange={(e) => setFirstDoseTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (Optional)</Label>
            <Input
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Save Medication
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
