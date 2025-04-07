
import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { DaySummary } from "./DaySummary";
import { CalendarLegend } from "./CalendarLegend";
import { useMedicationCalendarData } from "./useMedicationCalendarData";
import { format } from "date-fns";

interface MedicationCalendarContentProps {
  date: Date;
  setDate: (date: Date) => void;
}

export const MedicationCalendarContent: React.FC<MedicationCalendarContentProps> = ({ 
  date, 
  setDate 
}) => {
  const { dayStatus, loading, customDayClassNames } = useMedicationCalendarData(date);
  
  // Format selected date for display
  const formattedDate = format(date, "MMMM d, yyyy");
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <CalendarLegend />
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => newDate && setDate(newDate)}
              className="rounded-md border mx-auto"
              modifiersClassNames={{
                ...customDayClassNames
              }}
            />
          </CardContent>
        </Card>
        
        <Card className="flex-1">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-4">{formattedDate}</h3>
            <DaySummary 
              date={date} 
              dayStatus={dayStatus} 
              isLoading={loading} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
