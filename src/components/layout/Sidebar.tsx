
import { format } from "date-fns";
import type { MedicationWithStatus } from "@/types/medication";

interface SidebarProps {
  sidebarOpen: boolean;
  medications: MedicationWithStatus[];
}

export const Sidebar = ({ sidebarOpen, medications }: SidebarProps) => {
  return (
    <aside className={`bg-card rounded-lg p-6 transition-all duration-300 ${
      sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
    }`}>
      <h2 className="text-xl font-semibold mb-4">Upcoming Reminders</h2>
      <div className="space-y-4">
        {medications
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
              {medications.filter(m => m.status === 'taken').length}
            </p>
            <p className="text-sm text-muted-foreground">Taken Today</p>
          </div>
          <div className="bg-background p-4 rounded-md">
            <p className="text-2xl font-bold text-destructive">
              {medications.filter(m => m.status === 'overdue').length}
            </p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
