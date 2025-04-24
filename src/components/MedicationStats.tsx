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
      // Get medication schedules from the medication object
      const schedules = medication.medication_schedules || [];
      
      schedules.forEach(schedule => {
        // Check if this schedule is relevant for this day
        if (!schedule.scheduled_time) return;
        
        try {
          // Handle specific scheduled time format from backend
          let scheduleDate: Date;
          
          // If it's a full ISO date
          if (schedule.scheduled_time.includes('T')) {
            scheduleDate = parseISO(schedule.scheduled_time);
          } else {
            // If it's just a time string (HH:MM), combine with the current date
            const [hours, minutes] = schedule.scheduled_time.split(':');
            scheduleDate = new Date(date);
            scheduleDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          }
          
          // Check if this schedule falls within the current day
          if (isWithinInterval(scheduleDate, { start: dayStart, end: dayEnd })) {
            if (schedule.taken) {
              acc.taken++;
            } else if (schedule.missed_doses) {
              acc.missed++;
            } else if (schedule.skipped) {
              acc.skipped++;
            }
          }
        } catch (error) {
          console.error("Error parsing schedule time:", error);
        }
      });
      
      // Also check medication logs for this day if available
      const logs = medication.medication_logs || [];
      logs.forEach(log => {
        if (!log.scheduled_time) return;
        
        try {
          const logDate = parseISO(log.scheduled_time);
          
          if (isWithinInterval(logDate, { start: dayStart, end: dayEnd })) {
            switch (log.status) {
              case 'taken':
                // Only count if not already counted from schedules
                if (!medication.medication_schedules?.some(s => 
                  s.scheduled_time && 
                  isWithinInterval(parseISO(s.scheduled_time), { start: dayStart, end: dayEnd }) && 
                  s.taken
                )) {
                  acc.taken++;
                }
                break;
              case 'missed':
                if (!medication.medication_schedules?.some(s => 
                  s.scheduled_time && 
                  isWithinInterval(parseISO(s.scheduled_time), { start: dayStart, end: dayEnd }) && 
                  s.missed_doses
                )) {
                  acc.missed++;
                }
                break;
              case 'skipped':
                if (!medication.medication_schedules?.some(s => 
                  s.scheduled_time && 
                  isWithinInterval(parseISO(s.scheduled_time), { start: dayStart, end: dayEnd }) && 
                  s.skipped
                )) {
                  acc.skipped++;
                }
                break;
            }
          }
        } catch (error) {
          console.error("Error parsing log time:", error);
        }
      });
      
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
