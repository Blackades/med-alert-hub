
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Pill } from "lucide-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addHours, format } from "date-fns";
import { Medication, MedicationType, TimeSlot } from "@/types/medication";
import { MEDICATION_TYPES, createDefaultSchedule } from "@/utils/MedicationUtils";

const frequencyOptions = [
  { value: "daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily (every 12 hours)" },
  { value: "thrice_daily", label: "Three times daily (every 8 hours)" },
  { value: "every_hour", label: "Every hour" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "every_x_hours", label: "Custom hours interval" },
  { value: "specific_times", label: "Specific times" }
];

const formSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  medicationType: z.string().optional(),
  frequency: z.string().min(1, "Frequency is required"),
  customHours: z.number().optional(),
  firstDoseTime: z.string().min(1, "First dose time is required"),
  instructions: z.string().optional(),
  withFood: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  inventory: z.object({
    enabled: z.boolean().default(false),
    currentQuantity: z.number().optional(),
    doseAmount: z.number().optional(),
    refillThreshold: z.number().optional()
  }).optional()
});

type FormValues = z.infer<typeof formSchema>;

interface AddMedicationDialogProps {
  onAdd: (medication: Omit<Medication, "id">) => void;
}

export const AddMedicationDialog = ({ onAdd }: AddMedicationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dosage: "",
      medicationType: "pill",
      frequency: "daily",
      firstDoseTime: "08:00",
      instructions: "",
      withFood: false,
      inventory: {
        enabled: false,
        currentQuantity: 30,
        doseAmount: 1,
        refillThreshold: 7
      }
    }
  });

  const watchFrequency = form.watch("frequency");
  const watchInventoryEnabled = form.watch("inventory.enabled");
  
  const handleSubmit = (values: FormValues) => {
    // Generate schedule based on frequency and first dose time
    let schedule: TimeSlot[] = [];
    
    schedule = createDefaultSchedule(values.frequency, values.firstDoseTime);
    
    // Calculate doses per day for inventory tracking
    let dosesPerDay = 1;
    switch (values.frequency) {
      case "twice_daily": dosesPerDay = 2; break;
      case "thrice_daily": dosesPerDay = 3; break;
      case "every_hour": dosesPerDay = 24; break;
      default: dosesPerDay = 1;
    }
    
    const newMedication = {
      name: values.name,
      dosage: values.dosage,
      medicationType: values.medicationType as MedicationType,
      instructions: values.instructions,
      schedule,
      frequency: values.frequency,
      withFood: values.withFood,
      startDate: values.startDate,
      endDate: values.endDate,
      inventory: values.inventory?.enabled ? {
        currentQuantity: values.inventory.currentQuantity || 0,
        dosesPerDay,
        doseAmount: values.inventory.doseAmount || 1,
        refillThreshold: values.inventory.refillThreshold
      } : undefined
    };

    onAdd(newMedication);
    form.reset();
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dosage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dosage</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="medicationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MEDICATION_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="withFood"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Take with food</FormLabel>
                        <FormDescription>
                          This medication should be taken with meals.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>
              
              <TabsContent value="schedule" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {frequencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchFrequency === "every_x_hours" && (
                  <FormField
                    control={form.control}
                    name="customHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours Between Doses</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={24} 
                            onChange={e => field.onChange(parseInt(e.target.value))} 
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="firstDoseTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Dose Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="inventory.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Track Inventory</FormLabel>
                        <FormDescription>
                          Get notified when your medication is running low.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                {watchInventoryEnabled && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="inventory.currentQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0} 
                              onChange={e => field.onChange(parseInt(e.target.value))} 
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="inventory.doseAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Per Dose</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0.5} 
                              step={0.5} 
                              onChange={e => field.onChange(parseFloat(e.target.value))} 
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="inventory.refillThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Refill Alert Threshold (Days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              onChange={e => field.onChange(parseInt(e.target.value))} 
                              value={field.value}
                            />
                          </FormControl>
                          <FormDescription>
                            Get alerted when you have fewer than this many days of medication left
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <Button type="submit" className="w-full">
              Save Medication
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
