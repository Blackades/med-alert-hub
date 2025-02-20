
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { Medication, TimeSlot } from "@/types/medication";

interface AddMedicationDialogProps {
  onAdd: (medication: Omit<Medication, "id">) => void;
}

export const AddMedicationDialog = ({ onAdd }: AddMedicationDialogProps) => {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState<string[]>([""]);
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const schedule: TimeSlot[] = times.map((time, index) => ({
      id: `time-${index}`,
      time,
      taken: false,
    }));

    onAdd({
      name,
      dosage,
      instructions,
      schedule,
    });

    setName("");
    setDosage("");
    setInstructions("");
    setTimes([""]);
    setOpen(false);
  };

  const addTimeSlot = () => {
    setTimes([...times, ""]);
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
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
            <Label htmlFor="instructions">Instructions (Optional)</Label>
            <Input
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label>Schedule</Label>
            {times.map((time, index) => (
              <Input
                key={index}
                type="time"
                value={time}
                onChange={(e) => updateTime(index, e.target.value)}
                required
                className="w-full mt-2"
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addTimeSlot}
              className="mt-2"
            >
              Add Time
            </Button>
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary-600">
            Save Medication
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
