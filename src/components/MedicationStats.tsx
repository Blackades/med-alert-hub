
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MedicationWithStatus } from "@/types/medication";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";

interface MedicationStatsProps {
  medications: MedicationWithStatus[];
}

export const MedicationStats = ({ medications }: MedicationStatsProps) => {
  const today = new Date();
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, i);
    return {
      date,
      label: format(date, 'EEE')
    };
  }).reverse();

  const calculateDailyStats = (date: Date, meds: MedicationWithStatus[]) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    return meds.reduce((acc, medication) => {
      // For each medication, check its status for this day
      if (medication.nextDose) {
        try {
          const nextDoseDate = new Date(medication.nextDose);
          
          // Check if the next dose falls on this day
          if (isWithinInterval(nextDoseDate, { start: dayStart, end: dayEnd })) {
            if (medication.status === 'taken') {
              acc.taken++;
            } else if (medication.status === 'missed') {
              acc.missed++;
            } else if (medication.status === 'overdue') {
              acc.missed++;
            } else {
              // upcoming doses
              acc.skipped++;
            }
          }
        } catch (error) {
          console.error("Error parsing dose time:", error);
        }
      }
      
      return acc;
    }, { taken: 0, missed: 0, skipped: 0 });
  };

  const data = daysOfWeek.map(({ date, label }) => ({
    name: label,
    ...calculateDailyStats(date, medications)
  }));

  return (
    <Card className="p-6 animate-fade-in">
      <h3 className="text-lg font-semibold mb-4">Weekly Medication Adherence</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="taken" fill="#34D399" stackId="a" name="Taken" />
            <Bar dataKey="missed" fill="#FF6B6B" stackId="a" name="Missed" />
            <Bar dataKey="skipped" fill="#FCD34D" stackId="a" name="Skipped" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
