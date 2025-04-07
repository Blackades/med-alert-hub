
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

type MedicationLog = {
  medication_id: string;
  status: string;
  scheduled_time: string;
};

type DayStatus = {
  [date: string]: {
    taken: number;
    missed: number;
    skipped: number;
    total: number;
  };
};

export const MedicationCalendar = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [dayStatus, setDayStatus] = useState<DayStatus>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Add a state to track custom day styles
  const [customDayClassNames, setCustomDayClassNames] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const fetchMedicationLogs = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      
      // Get medication IDs for this user
      const { data: medications, error: medError } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', user.id);
      
      if (medError) {
        console.error("Error fetching medications:", medError);
        setLoading(false);
        return;
      }
      
      if (!medications || medications.length === 0) {
        setLoading(false);
        return;
      }
      
      const medicationIds = medications.map(med => med.id);
      
      // Get the start and end of the month
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Query medication logs
      const { data: logs, error: logError } = await supabase
        .from('medication_logs')
        .select('medication_id, status, scheduled_time')
        .in('medication_id', medicationIds)
        .gte('scheduled_time', startOfMonth.toISOString())
        .lte('scheduled_time', endOfMonth.toISOString());
      
      if (logError) {
        console.error("Error fetching medication logs:", logError);
        setLoading(false);
        return;
      }
      
      // Process logs by day
      const newDayStatus: DayStatus = {};
      
      if (Array.isArray(logs)) {
        logs.forEach((log: MedicationLog) => {
          const day = log.scheduled_time.split('T')[0];
          
          if (!newDayStatus[day]) {
            newDayStatus[day] = { taken: 0, missed: 0, skipped: 0, total: 0 };
          }
          
          newDayStatus[day].total++;
          
          if (log.status === 'taken') {
            newDayStatus[day].taken++;
          } else if (log.status === 'missed') {
            newDayStatus[day].missed++;
          } else if (log.status === 'skipped') {
            newDayStatus[day].skipped++;
          }
        });
      }
      
      setDayStatus(newDayStatus);
      
      // Calculate and set custom class names based on day status
      const newCustomDayClassNames: Record<string, string> = {};
      
      // Process each day in the month
      const currentDate = new Date(startOfMonth);
      while (currentDate <= endOfMonth) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const status = newDayStatus[dateStr];
        
        if (status) {
          if (status.missed > 0) {
            newCustomDayClassNames[dateStr] = 'bg-destructive/10 text-destructive font-medium hover:bg-destructive/20';
          } else if (status.taken === status.total) {
            newCustomDayClassNames[dateStr] = 'bg-primary/10 text-primary font-medium hover:bg-primary/20';
          } else if (status.taken > 0) {
            newCustomDayClassNames[dateStr] = 'bg-amber-500/10 text-amber-500 font-medium hover:bg-amber-500/20';
          }
        }
        
        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      setCustomDayClassNames(newCustomDayClassNames);
      setLoading(false);
    };
    
    fetchMedicationLogs();
  }, [user, date]);
  
  // Function to determine if a day has custom styling
  const hasDayModifier = (day: Date): boolean => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return Boolean(customDayClassNames[dateStr]);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Medication Calendar</CardTitle>
        <CardDescription>Track your medication history</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-[240px] bg-muted rounded mt-2"></div>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4 space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-primary mr-1"></div>
                <span className="text-xs text-muted-foreground">All taken</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-1"></div>
                <span className="text-xs text-muted-foreground">Partially taken</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-destructive mr-1"></div>
                <span className="text-xs text-muted-foreground">Missed doses</span>
              </div>
            </div>
            
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              className="border rounded-md p-4"
              modifiers={{
                customStyles: hasDayModifier,
              }}
              modifiersClassNames={{
                customStyles: "custom-day-style",
              }}
              styles={{
                day: {
                  className: (date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    return customDayClassNames[dateStr] || '';
                  }
                }
              }}
            />
            
            <div className="mt-4">
              <h4 className="font-medium mb-2">
                {format(date, 'MMMM d, yyyy')}
              </h4>
              
              {(() => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const status = dayStatus[dateStr];
                
                if (!status) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No medication data for this date
                    </p>
                  );
                }
                
                return (
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="flex items-center space-x-1 px-3 py-1">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      <span>{status.taken} taken</span>
                    </Badge>
                    
                    <Badge variant="outline" className="flex items-center space-x-1 px-3 py-1">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span>{status.skipped} skipped</span>
                    </Badge>
                    
                    <Badge variant="outline" className="flex items-center space-x-1 px-3 py-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      <span>{status.missed} missed</span>
                    </Badge>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
