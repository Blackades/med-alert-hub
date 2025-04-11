
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { Menu, Calendar as CalendarIcon, Pill } from "lucide-react";
import { MedicationProvider } from "@/contexts/MedicationContext";
import { MedicationCalendar } from "@/components/calendar/MedicationCalendar";

const Schedule = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!session) {
    navigate("/auth");
    return null;
  }
  
  return (
    <MedicationProvider>
      <ScheduleContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </MedicationProvider>
  );
};

const ScheduleContent = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:flex items-center gap-2">
            <div className="bg-gradient-to-r from-primary to-secondary rounded-full h-9 w-9 flex items-center justify-center">
              <Pill className="text-white" size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <MediTrackSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Schedule</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your medication schedule
              </p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Medication Calendar
                </CardTitle>
                <CardDescription>
                  Your complete medication schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MedicationCalendar />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Schedule;
