
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MedicationStats } from "@/components/MedicationStats";
import { MedicationList } from "@/components/medications/MedicationList";
import { MedicationStreaks } from "@/components/streaks/MedicationStreaks";
import { useMedications } from "@/contexts/MedicationContext";

export const DashboardOverview = () => {
  const { sortedMedications, takeMedication, skipMedication, deleteMedication } = useMedications();

  return (
    <div className="space-y-6 mt-0">
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-5 w-5 text-primary"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
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
              onTake={takeMedication}
              onSkip={skipMedication}
              onDelete={deleteMedication}
            />
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center">
              <span className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-5 w-5 text-secondary"
                >
                  <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path>
                </svg>
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
              onTake={takeMedication}
              onSkip={skipMedication}
              onDelete={deleteMedication}
              showActions={false}
            />
          </CardContent>
        </Card>
      </div>
      
      <MedicationStreaks />
    </div>
  );
};
