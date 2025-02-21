
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MedicationWithStatus } from "@/types/medication";
import { format } from "date-fns";

interface MedicationStatsProps {
  medications: MedicationWithStatus[];
}

export const MedicationStats = ({ medications }: MedicationStatsProps) => {
  const today = new Date();
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    return format(date, 'EEE');
  }).reverse();

  // Initialize data with zeros
  const data = daysOfWeek.map(day => ({
    name: day,
    taken: 0,
    missed: 0,
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
            <Bar dataKey="taken" fill="#34D399" stackId="a" />
            <Bar dataKey="missed" fill="#FF6B6B" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
