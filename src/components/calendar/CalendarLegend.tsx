
import React from "react";

export const CalendarLegend = () => {
  return (
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
  );
};
