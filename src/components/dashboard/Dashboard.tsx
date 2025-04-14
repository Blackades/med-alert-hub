import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  BarChart4, 
  Calendar, 
  Menu, 
  Bell, 
  Moon, 
  Sun, 
  PlusCircle, 
  Smartphone,
  Activity,
  Pill
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Footer } from "@/components/layout/Footer";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { useTheme } from "next-themes";
import { MedicationCalendar } from "@/components/calendar/MedicationCalendar";
import { MoodTracker } from "@/components/mood/MoodTracker";
import { DashboardOverview } from "./DashboardOverview";
import { useMedications } from "@/contexts/MedicationContext";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { session } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { sortedMedications, addMedication } = useMedications();

  if (!session) {
    navigate("/auth");
    return null;
  }

  const userInitial = session?.user?.email?.[0].toUpperCase() || "U";
  const userEmail = session?.user?.email;

  // Calculate stats for dashboard
  const totalMedications = sortedMedications.length;
  const takenMedications = sortedMedications.filter(med => med.status === 'taken').length;
  const missedMedications = sortedMedications.filter(med => med.status === 'overdue').length;
  const adherenceRate = totalMedications > 0 
    ? Math.round((takenMedications / totalMedications) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight hidden md:block">
            MedAlertHub
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse-soft"></span>
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground">Logged in</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {userInitial}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <MediTrackSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Welcome back! Here's an overview of your medication schedule.
              </p>
            </div>
            
            <AddMedicationDialog onAdd={addMedication}>
              <Button 
                className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Medication
              </Button>
            </AddMedicationDialog>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Total Medications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{totalMedications}</div>
                  <p className="text-muted-foreground">Active medications</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">Today's Doses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {takenMedications + missedMedications}
                  </div>
                  <p className="text-muted-foreground">
                    {takenMedications} taken, {missedMedications} missed
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center">
                    Adherence Rate
                    <Activity className="ml-2 h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {adherenceRate}%
                  </div>
                  <Progress value={adherenceRate} className="mt-2" />
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center">
                  <Smartphone className="mr-2 h-5 w-5" />
                  Device Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-destructive"></div>
                  <span className="font-semibold">Disconnected</span>
                </div>
                <p className="text-muted-foreground mt-1">
                  Connect your device to receive alerts
                </p>
                <Button 
                  className="mt-4 bg-primary hover:bg-primary/90 text-white"
                  onClick={() => navigate("/devices")}
                >
                  Connect Device
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Upcoming Doses</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Your medication schedule for today
                </p>
              </CardHeader>
              <CardContent>
                {sortedMedications.filter(med => med.status === 'upcoming').length > 0 ? (
                  <div className="space-y-3">
                    {sortedMedications
                      .filter(med => med.status === 'upcoming')
                      .slice(0, 3)
                      .map((med) => (
                        <div 
                          key={med.id} 
                          className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Pill className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{med.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(med.nextDose).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No upcoming doses scheduled</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};
