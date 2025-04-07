
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicationCalendarContent } from "./MedicationCalendarContent";

export const MedicationCalendar = () => {
  const [date, setDate] = useState<Date>(new Date());
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Medication Calendar</CardTitle>
        <CardDescription>Track your medication history</CardDescription>
      </CardHeader>
      <CardContent>
        <MedicationCalendarContent date={date} setDate={setDate} />
      </CardContent>
    </Card>
  );
};
