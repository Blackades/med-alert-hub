
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MedicationWithStatus } from "@/types/medication";
import { format, subDays, startOfDay, isWithinInterval } from "date-fns";

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

  // Calculate statistics for each day
  const data = daysOfWeek.map(({ date, label }) => {
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let taken = 0;
    let missed = 0;
    let skipped = 0;

    medications.forEach(medication => {
      const schedules = medication.schedule || [];
      schedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.time);
        if (isWithinInterval(scheduleDate, { start: dayStart, end: dayEnd })) {
          if (schedule.taken) {
            taken++;
          } else if (schedule.missed) {
            missed++;
          } else if (schedule.skipped) {
            skipped++;
          }
        }
      });
    });

    return {
      name: label,
      taken,
      missed,
      skipped
    };
  });

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
