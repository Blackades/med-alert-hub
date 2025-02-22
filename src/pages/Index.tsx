import { useState, useEffect } from "react";
import { MedicationCard } from "@/components/MedicationCard";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { MedicationStats } from "@/components/MedicationStats";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import type { Medication, MedicationWithStatus } from "@/types/medication";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

const Index = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        frequency: {
          timesPerDay: 1,
          intervalHours: 24,
        },
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
      const { data: medData, error: medError } = await supabase
        .from('medications')
        .insert({
          name: newMedication.name,
          dosage: newMedication.dosage,
          instructions: newMedication.instructions,
          user_id: user?.id,
          frequency: 'daily',
        })
        .select()
        .single();

      if (medError) throw medError;

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

      await supabase.functions.invoke('send-notification', {
        body: {
          email: user?.email,
          medication: newMedication.name,
          dosage: newMedication.dosage,
          scheduledTime: newMedication.schedule[0].time,
        },
      });

      toast({
        title: "Medication added",
        description: `${newMedication.name} has been added to your schedule.`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding medication",
        description: error.message,
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

  const calculateNextDose = (currentTime: Date, scheduledTime: string): string => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const nextDoseTime = parseISO(`${todayStr}T${scheduledTime}`);
    return nextDoseTime <= currentTime 
      ? addDays(nextDoseTime, 1).toISOString()
      : nextDoseTime.toISOString();
  };

  const getMedicationStatus = (medication: Medication): MedicationWithStatus => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    
    if (!medication.schedule || medication.schedule.length === 0) {
      return {
        ...medication,
        nextDose: now.toISOString(),
        status: 'upcoming',
        schedule: [] // Ensure schedule is never undefined
      };
    }

    const validScheduleTimes = medication.schedule
      .filter(slot => slot && slot.time)
      .map(slot => parseISO(`${todayStr}T${slot.time}`));

    if (validScheduleTimes.length === 0) {
      return {
        ...medication,
        nextDose: now.toISOString(),
        status: 'upcoming',
        schedule: medication.schedule
      };
    }

    const nextDoseTime = validScheduleTimes.find(time => time > now) || 
      addDays(parseISO(`${todayStr}T${medication.schedule[0].time}`), 1);

    const status = medication.schedule.some(slot => slot.taken)
      ? 'taken'
      : nextDoseTime < now
      ? 'overdue'
      : 'upcoming';

    return {
      ...medication,
      nextDose: nextDoseTime.toISOString(),
      status,
    };
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

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-2xl font-bold text-primary">MedAlert</h2>
          </div>
          <nav className="flex-1 ml-8">
            <ul className="flex space-x-4">
              <li><a href="#" className="text-muted-foreground hover:text-foreground">Dashboard</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground">Calendar</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground">Reports</a></li>
            </ul>
          </nav>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10 rounded-full"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <UserSettingsDialog onSave={handleSaveSettings} />
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Medication Reminder</h1>
                <p className="text-muted-foreground">Keep track of your daily medications</p>
              </div>
              <AddMedicationDialog onAdd={addMedication} />
            </div>

            {sortedMedications.length > 0 && (
              <div className="animate-fade-in">
                <MedicationStats medications={sortedMedications} />
              </div>
            )}

            <div className="space-y-4">
              {sortedMedications.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg">
                  <img
                    src="/lovable-uploads/e747fbbf-5ff6-4891-90c6-c43b8b464dff.png"
                    alt="Empty state"
                    className="w-32 h-32 mx-auto mb-4 rounded-full"
                  />
                  <p className="text-muted-foreground">No medications added yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click the "Add Medication" button to get started.
                  </p>
                </div>
              ) : (
                sortedMedications.map((medication) => (
                  <MedicationCard
                    key={medication.id}
                    medication={medication}
                    onTake={handleTakeMedication}
                    onSkip={handleSkipMedication}
                    onDelete={handleDeleteMedication}
                  />
                ))
              )}
            </div>
          </div>

          <aside className={`bg-card rounded-lg p-6 transition-all duration-300 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}>
            <h2 className="text-xl font-semibold mb-4">Upcoming Reminders</h2>
            <div className="space-y-4">
              {sortedMedications
                .filter(med => med.status === 'upcoming')
                .slice(0, 3)
                .map(med => (
                  <div key={med.id} className="flex items-center space-x-3 p-3 bg-background rounded-md">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{med.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(med.nextDose), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-md">
                  <p className="text-2xl font-bold text-primary">
                    {sortedMedications.filter(m => m.status === 'taken').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Taken Today</p>
                </div>
                <div className="bg-background p-4 rounded-md">
                  <p className="text-2xl font-bold text-destructive">
                    {sortedMedications.filter(m => m.status === 'overdue').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-border/40 mt-12 py-6 bg-card">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">© 2024 MedAlert. All rights reserved.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
