
import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { DaySummary } from "./DaySummary";
import { CalendarLegend } from "./CalendarLegend";
import { format } from "date-fns";
import { useMedicationCalendarData, DayStatus } from "./useMedicationCalendarData";

type MedicationCalendarContentProps = {
  date: Date;
  setDate: (date: Date) => void;
};

export const MedicationCalendarContent = ({ date, setDate }: MedicationCalendarContentProps) => {
  const { dayStatus, loading, customDayClassNames } = useMedicationCalendarData(date);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-[240px] bg-muted rounded mt-2"></div>
      </div>
    );
  }

  // Function to determine if a day has custom styling
  const hasDayModifier = (day: Date): boolean => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return Boolean(customDayClassNames[dateStr]);
  };

  return (
    <>
      <CalendarLegend />
      
      <Calendar
        mode="single"
        selected={date}
        onSelect={(newDate) => newDate && setDate(newDate)}
        className="border rounded-md p-4"
        modifiers={{
          customStyles: hasDayModifier,
        }}
        modifiersClassNames={{
          customStyles: "custom-day-style",
        }}
        styles={{
          day: {
            className: (day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              return customDayClassNames[dateStr] || '';
            }
          }
        }}
      />
      
      <DaySummary date={date} dayStatus={dayStatus} />
    </>
  );
};
