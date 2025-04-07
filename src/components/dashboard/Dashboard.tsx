
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Calendar, BarChart4 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { PlusCircle } from "lucide-react";
import { MedicationCalendar } from "@/components/calendar/MedicationCalendar";
import { MoodTracker } from "@/components/mood/MoodTracker";
import { HealthTip } from "./HealthTip";
import { DashboardOverview } from "./DashboardOverview";
import { useUserSettings } from "./UserSettings";
import { useMedications } from "@/contexts/MedicationContext";
import { useAuth } from "@/components/AuthProvider";

export const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { session } = useAuth();
  const navigate = useNavigate();
  const { sortedMedications, addMedication } = useMedications();
  const { saveSettings } = useUserSettings();

  if (!session) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 bg-[linear-gradient(180deg,var(--background)_0%,var(--background)_100%),radial-gradient(ellipse_at_top,var(--primary)/10%_0%,transparent_50%)]">
      <Header 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onSaveSettings={saveSettings} 
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

            <HealthTip />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="overview" className="flex items-center">
                  <Gauge className="w-4 h-4 mr-2" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Calendar</span>
                </TabsTrigger>
                <TabsTrigger value="mood" className="flex items-center">
                  <BarChart4 className="w-4 h-4 mr-2" />
                  <span>Mood</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6 mt-0">
                <DashboardOverview />
              </TabsContent>
              
              <TabsContent value="calendar" className="mt-0">
                <MedicationCalendar />
              </TabsContent>
              
              <TabsContent value="mood" className="space-y-6 mt-0">
                <MoodTracker />
              </TabsContent>
            </Tabs>
          </div>

          <Sidebar sidebarOpen={sidebarOpen} medications={sortedMedications} />
        </div>
      </div>

      <Footer />
    </div>
  );
};
