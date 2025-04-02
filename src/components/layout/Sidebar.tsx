
import { format } from "date-fns";
import type { MedicationWithStatus } from "@/types/medication";
import { Calendar, Clock, CheckCircle, AlertCircle, PlusCircle, Activity, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface SidebarProps {
  sidebarOpen: boolean;
  medications: MedicationWithStatus[];
}

export const Sidebar = ({ sidebarOpen, medications }: SidebarProps) => {
  // Calculate completion percentage
  const totalMeds = medications.length;
  const takenMeds = medications.filter(m => m.status === 'taken').length;
  const completionPercentage = totalMeds > 0 ? (takenMeds / totalMeds) * 100 : 0;
  
  const upcomingMeds = medications
    .filter(med => med.status === 'upcoming')
    .slice(0, 3);
    
  const overdueMeds = medications
    .filter(med => med.status === 'overdue')
    .slice(0, 2);

  return (
    <aside className={`card-gradient rounded-lg shadow-soft overflow-hidden transition-all duration-300 ${
      sidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full md:translate-x-0 opacity-0 md:opacity-100'
    }`}>
      {/* Today's Overview Section */}
      <div className="p-6 border-b border-border/50">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-primary" />
          Today's Overview
        </h2>
        
        <div className="space-y-4">
          <div className="bg-background/50 rounded-lg p-4 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Daily Progress</span>
              <span className="text-sm font-bold">{Math.round(completionPercentage)}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/50 p-2 rounded">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{totalMeds}</p>
              </div>
              <div className="bg-primary/10 p-2 rounded">
                <p className="text-xs text-muted-foreground">Taken</p>
                <p className="text-lg font-bold text-primary">{takenMeds}</p>
              </div>
              <div className="bg-destructive/10 p-2 rounded">
                <p className="text-xs text-muted-foreground">Missed</p>
                <p className="text-lg font-bold text-destructive">{medications.filter(m => m.status === 'overdue').length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Upcoming Medications */}
      <div className="p-6 border-b border-border/50">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Clock className="mr-2 h-5 w-5 text-primary" />
          Upcoming Reminders
        </h2>
        
        <div className="space-y-3 staggered-children">
          {upcomingMeds.length > 0 ? (
            upcomingMeds.map((med, index) => (
              <div key={med.id} className="flex items-center space-x-3 p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-all hover-scale">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{med.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {format(new Date(med.nextDose), 'h:mm a')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-4 bg-background/30 rounded-lg">
              <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">No upcoming medications</p>
            </div>
          )}
          
          {upcomingMeds.length > 0 && (
            <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary">
              <Clock className="mr-2 h-4 w-4" />
              View All Upcoming
            </Button>
          )}
        </div>
      </div>
      
      {/* Overdue Section */}
      {overdueMeds.length > 0 && (
        <div className="p-6 border-b border-border/50">
          <h2 className="text-xl font-semibold mb-3 flex items-center text-destructive">
            <AlertCircle className="mr-2 h-5 w-5" />
            Overdue
          </h2>
          
          <div className="space-y-3 staggered-children">
            {overdueMeds.map((med) => (
              <div key={med.id} className="flex items-center space-x-3 p-3 bg-destructive/10 rounded-lg hover:bg-destructive/15 transition-all hover-scale">
                <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{med.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Missed at {format(new Date(med.nextDose), 'h:mm a')}
                  </p>
                </div>
                <Button size="sm" variant="destructive" className="h-8">Take Now</Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-3">Quick Actions</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="flex-col h-auto py-4 hover:bg-primary/10 hover:text-primary border-primary/30">
            <PlusCircle className="h-5 w-5 mb-1" />
            <span>Add Medication</span>
          </Button>
          
          <Button variant="outline" className="flex-col h-auto py-4 hover:bg-secondary/10 hover:text-secondary border-secondary/30">
            <Activity className="h-5 w-5 mb-1" />
            <span>Health Tips</span>
          </Button>
          
          <Button variant="outline" className="flex-col h-auto py-4 hover:bg-primary/10 hover:text-primary border-primary/30 col-span-2">
            <LineChart className="h-5 w-5 mb-1" />
            <span>View Detailed Reports</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};
