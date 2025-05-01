
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMedications } from "@/contexts/MedicationContext";
import { Pill, Plus, RefreshCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface MedicationRefillDialogProps {
  medicationId: string;
  medicationName: string;
  children: React.ReactNode;
}

export function MedicationRefillDialog({
  medicationId,
  medicationName,
  children,
}: MedicationRefillDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refillMedication } = useMedications();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid refill amount.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await refillMedication(medicationId, quantity);
      setOpen(false);
      setQuantity(0);
    } catch (error) {
      console.error("Error in refill:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground animate-scale-in">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <span>Refill {medicationName}</span>
          </DialogTitle>
          <DialogDescription>
            Add medication units to your inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <div className="relative col-span-3">
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="pr-12 border-input focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  placeholder="Enter amount..."
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">units</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="transition-all duration-200 hover:bg-destructive/10"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
              disabled={isSubmitting || !quantity || quantity <= 0}
            >
              {isSubmitting ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Refilling...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Refill
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
