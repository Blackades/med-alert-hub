
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export type MedicationLog = {
  medication_id: string;
  status: string;
  scheduled_time: string;
};

export type DayStatus = {
  [date: string]: {
    taken: number;
    missed: number;
    skipped: number;
    total: number;
  };
};

export const useMedicationCalendarData = (date: Date) => {
  const [dayStatus, setDayStatus] = useState<DayStatus>({});
  const [loading, setLoading] = useState(true);
  const [customDayClassNames, setCustomDayClassNames] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    const fetchMedicationLogs = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      
      try {
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
        
        // Ensure medications is an array
        if (!Array.isArray(medications) || medications.length === 0) {
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
      } catch (error) {
        console.error("Error in calendar data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMedicationLogs();
  }, [user, date]);

  return {
    dayStatus,
    loading,
    customDayClassNames
  };
};
