
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { Menu, Pill, PlusCircle } from "lucide-react";
import { MedicationProvider } from "@/contexts/MedicationContext";
import { MedicationList } from "@/components/medications/MedicationList";
import { AddMedicationDialog } from "@/components/AddMedicationDialog";
import { useMedications } from "@/contexts/MedicationContext";
import { DemoModePanel } from "@/components/DemoModePanel";

const MedicationsPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!session) {
    navigate("/auth");
    return null;
  }
  
  return (
    <MedicationProvider>
      <MedicationsContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </MedicationProvider>
  );
};

const MedicationsContent = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) => {
  const { addMedication, sortedMedications, isLoading, takeMedication, skipMedication, deleteMedication } = useMedications();
  
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">Medications</h1>
                <p className="text-muted-foreground mt-1">
                  Manage and track your medications
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
            </div>
            
            {/* Add Demo Mode Panel here */}
            <DemoModePanel />
            
            <MedicationList 
              medications={sortedMedications} 
              isLoading={isLoading}
              onTake={takeMedication}
              onSkip={skipMedication}
              onDelete={deleteMedication}
            />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default MedicationsPage;
