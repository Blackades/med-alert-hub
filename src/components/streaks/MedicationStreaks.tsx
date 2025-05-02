
import { useState, useEffect } from "react";
import { getMedicationStreaks } from "@/integrations/supabase/services/streaks";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Award, TrendingUp, Medal } from "lucide-react";

// Define the StreakData type to match what's used in the component
export type StreakData = {
  medicationId: string;
  medicationName: string;
  currentStreak: number;
  longestStreak: number;
  adherenceRate: number;
};

export const MedicationStreaks = () => {
  const [streaks, setStreaks] = useState<StreakData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    const loadStreaks = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      const { success, data } = await getMedicationStreaks(user.id);
      
      if (success && data) {
        // Map the returned data to match the StreakData type
        const mappedStreaks: StreakData[] = Array.isArray(data) 
          ? data.map(streak => ({
              medicationId: streak.medication_id || streak.medicationId,
              medicationName: streak.medication_name || '',
              currentStreak: streak.current_streak || 0,
              longestStreak: streak.longest_streak || 0,
              adherenceRate: streak.adherence_rate || 0
            }))
          : [];
        
        setStreaks(mappedStreaks);
      } else {
        setStreaks([]);
      }
      setLoading(false);
    };
    
    loadStreaks();
  }, [user]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="h-6 bg-muted rounded"></CardTitle>
          <CardDescription className="h-4 bg-muted rounded w-3/4 mt-2"></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }
  
  if (streaks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Medication Streaks</CardTitle>
          <CardDescription>Start taking your medications to build streaks</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>No streak data available yet</p>
        </CardContent>
      </Card>
    );
  }

  // Find the medication with the highest current streak
  // Only try to find topStreak if we have streaks
  const topStreak = streaks.length > 0 
    ? streaks.reduce((prev, current) => 
        (current.currentStreak > prev.currentStreak) ? current : prev
      , streaks[0])
    : { currentStreak: 0 };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Medication Streaks</CardTitle>
            <CardDescription>Track your medication consistency</CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center bg-background/80">
            <Flame className="h-4 w-4 text-primary mr-1" />
            <span>{topStreak.currentStreak} day streak</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {streaks.map((streak) => (
            <div key={streak.medicationId} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    streak.currentStreak >= 7 ? 'bg-primary/20 text-primary' : 
                    streak.currentStreak >= 3 ? 'bg-secondary/20 text-secondary' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {streak.currentStreak >= 7 ? (
                      <Medal className="h-4 w-4" />
                    ) : streak.currentStreak >= 3 ? (
                      <Award className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">{streak.medicationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {streak.currentStreak === 0 ? 
                        "Start your streak today" : 
                        `${streak.currentStreak} day${streak.currentStreak === 1 ? '' : 's'} streak`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(streak.adherenceRate)}% adherence
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Best: {streak.longestStreak} days
                  </p>
                </div>
              </div>
              <Progress value={streak.adherenceRate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
