
import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type DayStatus = {
  taken: number;
  missed: number;
  skipped: number;
  total: number;
};

type DaySummaryProps = {
  date: Date;
  dayStatus: Record<string, DayStatus>;
};

export const DaySummary = ({ date, dayStatus }: DaySummaryProps) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const status = dayStatus[dateStr];

  if (!status) {
    return (
      <div className="mt-4">
        <h4 className="font-medium mb-2">{format(date, 'MMMM d, yyyy')}</h4>
        <p className="text-sm text-muted-foreground text-center py-4">
          No medication data for this date
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="font-medium mb-2">{format(date, 'MMMM d, yyyy')}</h4>
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
    </div>
  );
};
