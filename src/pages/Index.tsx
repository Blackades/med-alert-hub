import { useState, useEffect } from "react";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { MedicationStats } from "@/components/MedicationStats";
import type { Medication } from "@/types/medication";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { MedicationList } from "@/components/medications/MedicationList";
import { getMedicationStatus, calculateNextDose } from "@/utils/MedicationUtils";
import { PlusCircle, Calendar, Bell, Pill, ChevronDown, ArrowUpRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Index = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTips, setShowTips] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
      return;
    }

    fetchMedications();
  }, [session]);

  const fetchMedications = async () => {
    try {
      const { data: medsData, error: medsError } = await supabase
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          instructions,
          frequency,
          medication_schedules (
            id,
            scheduled_time,
            taken
          )
        `)
        .eq('user_id', user?.id);

      if (medsError) throw medsError;

      const formattedMedications: Medication[] = medsData.map(med => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        frequency: med.frequency,
        schedule: med.medication_schedules.map(schedule => ({
          id: schedule.id,
          time: schedule.scheduled_time,
          taken: schedule.taken || false,
        })),
      }));

      setMedications(formattedMedications);
    } catch (error: any) {
      toast({
        title: "Error fetching medications",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addMedication = async (newMedication: Omit<Medication, "id">) => {
    try {
      console.log("Adding medication with frequency:", newMedication.frequency);
      
      let frequency = newMedication.frequency;
      
      const { data: medData, error: medError } = await supabase
        .from('medications')
        .insert({
          name: newMedication.name,
          dosage: newMedication.dosage,
          instructions: newMedication.instructions,
          user_id: user?.id,
          frequency: frequency,
        })
        .select()
        .single();

      if (medError) {
        console.error("Error adding medication:", medError);
        throw medError;
      }

      const schedulePromises = newMedication.schedule.map(slot => 
        supabase
          .from('medication_schedules')
          .insert({
            medication_id: medData.id,
            scheduled_time: slot.time,
            next_dose: calculateNextDose(new Date(), slot.time),
            taken: false,
          })
      );

      await Promise.all(schedulePromises);

      await fetchMedications();

      if (user?.email) {
        await supabase.functions.invoke('send-notification', {
          body: {
            email: user.email,
            medication: newMedication.name,
            dosage: newMedication.dosage,
            scheduledTime: newMedication.schedule[0].time,
          },
        });
      }

      toast({
        title: "Medication added",
        description: `${newMedication.name} has been added to your schedule.`,
        className: "bg-primary/10 border-primary",
      });
    } catch (error: any) {
      console.error("Error details:", error);
      toast({
        title: "Error adding medication",
        description: error.message || "Failed to add medication",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async (settings: { email: string; phoneNumber: string }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email: settings.email,
          phone_number: settings.phoneNumber 
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `Notifications will be sent to ${settings.email} and ${settings.phoneNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTakeMedication = async (id: string) => {
    try {
      const medication = medications.find(med => med.id === id);
      if (!medication) return;

      const { error: scheduleError } = await supabase
        .from('medication_schedules')
        .update({ taken: true })
        .eq('medication_id', id);

      if (scheduleError) throw scheduleError;

      const { error } = await supabase.functions.invoke('schedule-next-dose', {
        body: {
          medicationId: id,
          currentDose: new Date().toISOString(),
        },
      });

      if (error) throw error;

      await fetchMedications();

      toast({
        title: "Medication taken",
        description: "Great job keeping up with your medication schedule!",
      });
    } catch (error: any) {
      toast({
        title: "Error updating medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSkipMedication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('medication_schedules')
        .update({ taken: true })
        .eq('medication_id', id);

      if (error) throw error;

      await fetchMedications();

      toast({
        title: "Medication skipped",
        description: "The medication has been marked as skipped.",
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Error skipping medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      const { error: scheduleError } = await supabase
        .from('medication_schedules')
        .delete()
        .eq('medication_id', id);

      if (scheduleError) throw scheduleError;

      const { error: medicationError } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (medicationError) throw medicationError;

      await fetchMedications();

      toast({
        title: "Medication deleted",
        description: "The medication has been removed from your schedule.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting medication",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sortedMedications = medications
    .map(getMedicationStatus)
    .sort((a, b) => new Date(a.nextDose).getTime() - new Date(b.nextDose).getTime());

  const healthTips = [
    "Stay hydrated! Drinking water helps medications absorb properly.",
    "Store medications in a cool, dry place away from direct sunlight.",
    "Set reminders on your phone as a backup for medication alerts.",
    "Keep a medication journal to track any side effects or concerns.",
    "Talk to your doctor before taking any new supplements with your medications."
  ];
  
  const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 bg-[linear-gradient(180deg,var(--background)_0%,var(--background)_100%),radial-gradient(ellipse_at_top,var(--primary)/10%_0%,transparent_50%)]">
      <Header 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onSaveSettings={handleSaveSettings} 
      />

      <div className="container py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between animate-fade-in">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Medication Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Welcome back! Keep track of your daily medications and stay healthy.
                </p>
              </div>
              <AddMedicationDialog onAdd={addMedication}>
                <Button className="btn-pulse bg-gradient-to-r from-primary to-secondary">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Medication
                </Button>
              </AddMedicationDialog>
            </div>

            {showTips && (
              <Card className="border-primary/20 bg-primary/5 animate-fade-up">
                <CardContent className="p-4 flex items-start">
                  <div className="p-2 mr-3 rounded-full bg-primary/10 text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Health Tip</p>
                    <p className="text-sm text-muted-foreground">{randomTip}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTips(false)}
                    className="ml-2 h-8 w-8 p-0"
                  >
                    &times;
                  </Button>
                </CardContent>
              </Card>
            )}

            {sortedMedications.length > 0 && (
              <div className="animate-fade-in">
                <MedicationStats medications={sortedMedications} />
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 animate-fade-up">
              <Card className="glass-card overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Calendar className="mr-2 h-5 w-5 text-primary" />
                      Today's Schedule
                    </span>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/90 hover:bg-primary/10">
                      View All
                      <ArrowUpRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>Your medication schedule for today</CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <MedicationList 
                    medications={sortedMedications.filter(med => med.status === 'upcoming' || med.status === 'overdue')} 
                    onTake={handleTakeMedication}
                    onSkip={handleSkipMedication}
                    onDelete={handleDeleteMedication}
                  />
                </CardContent>
              </Card>

              <Card className="glass-card overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Pill className="mr-2 h-5 w-5 text-secondary" />
                      Recent Medications
                    </span>
                    <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/90 hover:bg-secondary/10">
                      View All
                      <ArrowUpRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>Medications you've recently taken</CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <MedicationList 
                    medications={sortedMedications.filter(med => med.status === 'taken').slice(0, 3)} 
                    onTake={handleTakeMedication}
                    onSkip={handleSkipMedication}
                    onDelete={handleDeleteMedication}
                    showActions={false}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <Sidebar sidebarOpen={sidebarOpen} medications={sortedMedications} />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
