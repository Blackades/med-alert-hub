
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MedicationWithStatus } from "@/types/medication";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, Check, Clock, Droplet, Pill, SkipForward, Trash2, RefreshCw, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMedications } from "@/contexts/MedicationContext";
import { format } from "date-fns";
import { MedicationRefillDialog } from "./medications/MedicationRefillDialog";

interface MedicationCardProps {
  medication: MedicationWithStatus;
  onTake: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showActions?: boolean;
}

export function MedicationCard({ 
  medication, 
  onTake, 
  onSkip, 
  onDelete,
  showActions = true
}: MedicationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [streakInfo, setStreakInfo] = useState({ currentStreak: 0, longestStreak: 0 });
  const { getMedicationStreak } = useMedications();

  const { name, dosage, instructions, status, nextDose } = medication;

  useEffect(() => {
    // Fetch streak information
    const fetchStreakInfo = async () => {
      const info = await getMedicationStreak(medication.id);
      setStreakInfo(info);
    };
    
    fetchStreakInfo();
  }, [medication.id, getMedicationStreak]);

  const handleAction = async (action: string, id: string) => {
    setIsLoading(true);
    setCurrentAction(action);
    try {
      if (action === "take") {
        await onTake(id);
      } else if (action === "skip") {
        await onSkip(id);
      } else if (action === "delete") {
        await onDelete(id);
      }
    } finally {
      setIsLoading(false);
      setCurrentAction('');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "taken": return "text-green-500";
      case "overdue": return "text-destructive";
      case "upcoming": return "text-amber-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "taken": 
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Taken</Badge>;
      case "overdue": 
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
      case "upcoming": 
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Due Now</Badge>;
      default: 
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Upcoming</Badge>;
    }
  };

  const getTimeDisplay = () => {
    if (!nextDose) return "No schedule";
    
    try {
      const nextDoseDate = new Date(nextDose);
      // Check if it's today
      const isToday = new Date().toDateString() === nextDoseDate.toDateString();
      
      if (isToday) {
        return format(nextDoseDate, "h:mm a");
      } else {
        return format(nextDoseDate, "MMM d, h:mm a");
      }
    } catch (e) {
      console.error("Date parsing error:", e);
      return "Invalid date";
    }
  };

  return (
    <Card className={`overflow-hidden transition-all duration-300 ${
      status === "overdue" ? "border-destructive/40 shadow-sm shadow-destructive/10" : 
      status === "upcoming" ? "border-amber-500/40 shadow-sm shadow-amber-500/10" : 
      status === "taken" ? "border-green-500/40 shadow-sm shadow-green-500/10" : 
      "hover:shadow-md hover:border-primary/40"
    }`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-grow p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">{name}</h3>
                  {getStatusBadge()}
                </div>
                <p className="text-muted-foreground text-sm mt-1">{dosage}</p>
                {instructions && (
                  <p className="text-sm mt-2 text-muted-foreground">{instructions}</p>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-sm">
                  <Clock className={`h-4 w-4 ${getStatusColor()}`} />
                  <span className={`${getStatusColor()}`}>{getTimeDisplay()}</span>
                </div>
                {streakInfo.currentStreak > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                          <Flame className="h-3 w-3" />
                          <span>{streakInfo.currentStreak} day streak</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current streak: {streakInfo.currentStreak} days</p>
                        <p>Longest streak: {streakInfo.longestStreak} days</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            {showActions && status !== 'taken' && (
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleAction("take", medication.id)}
                  disabled={isLoading}
                  className={`transition-all duration-200 ${
                    currentAction === 'take' ? 'bg-primary/20' : 'hover:bg-primary/10'
                  }`}
                >
                  {currentAction === 'take' && isLoading ? (
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Take
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleAction("skip", medication.id)}
                  disabled={isLoading}
                  className={`transition-all duration-200 ${
                    currentAction === 'skip' ? 'bg-amber-500/20' : 'hover:bg-amber-500/10'
                  }`}
                >
                  {currentAction === 'skip' && isLoading ? (
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <SkipForward className="mr-1 h-4 w-4" />
                  )}
                  Skip
                </Button>
                
                <MedicationRefillDialog medicationId={medication.id} medicationName={name}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="transition-all duration-200 hover:bg-indigo-500/10"
                  >
                    <Droplet className="mr-1 h-4 w-4" />
                    Refill
                  </Button>
                </MedicationRefillDialog>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="ml-auto transition-all duration-200 hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="animate-scale-in">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {name} from your medications list. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleAction("delete", medication.id)}
                        disabled={isLoading && currentAction === 'delete'}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isLoading && currentAction === 'delete' ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
