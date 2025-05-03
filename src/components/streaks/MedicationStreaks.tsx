
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Award } from "lucide-react";
import { getMedicationStreaks } from "@/integrations/supabase/services/streaks";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/hooks/use-toast";

export interface MedicationStreak {
  id: string;
  medication_id: string;
  medication_name?: string; // This can be undefined initially
  current_streak: number;
  longest_streak: number;
  last_taken_at: string;
  created_at: string;
  updated_at: string;
}

export const MedicationStreaks = () => {
  const { user } = useAuth();
  const [streaks, setStreaks] = useState<MedicationStreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreaks = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await getMedicationStreaks(user.id);
        
        if (error) throw new Error(error.message);
        
        if (data) {
          setStreaks(data);
        }
      } catch (error) {
        console.error("Error loading medication streaks:", error);
        toast({
          title: "Error",
          description: "Could not load medication streaks data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStreaks();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (streaks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" /> Medication Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Take your medications consistently to build up streaks.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="h-5 w-5" /> Medication Streaks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {streaks.map((streak) => (
            <div
              key={streak.id}
              className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{streak.medication_name || "Unknown Medication"}</p>
                <p className="text-sm text-muted-foreground">
                  Last taken: {new Date(streak.last_taken_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                  Current: {streak.current_streak} days
                </div>
                <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium">
                  Best: {streak.longest_streak} days
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
