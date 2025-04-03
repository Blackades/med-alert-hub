
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/AuthProvider";
import { recordMood } from "@/integrations/supabase/client";
import { Smile, Meh, Frown, ThumbsUp, ThumbsDown } from "lucide-react";

const moods = [
  { value: "great", label: "Great", icon: <Smile className="h-6 w-6" />, color: "text-green-500" },
  { value: "good", label: "Good", icon: <ThumbsUp className="h-6 w-6" />, color: "text-primary" },
  { value: "okay", label: "Okay", icon: <Meh className="h-6 w-6" />, color: "text-amber-500" },
  { value: "bad", label: "Bad", icon: <ThumbsDown className="h-6 w-6" />, color: "text-orange-500" },
  { value: "awful", label: "Awful", icon: <Frown className="h-6 w-6" />, color: "text-destructive" }
];

export const MoodTracker = () => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  
  const handleSubmit = async () => {
    if (!selectedMood || !user?.id) return;
    
    setSubmitting(true);
    await recordMood(user.id, selectedMood, notes);
    
    // Reset form
    setSelectedMood(null);
    setNotes("");
    setSubmitting(false);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>How are you feeling today?</CardTitle>
        <CardDescription>Track your mood alongside your medication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          {moods.map((mood) => (
            <Button
              key={mood.value}
              variant={selectedMood === mood.value ? "default" : "outline"}
              className={`flex-col h-auto py-4 ${selectedMood === mood.value ? 'bg-primary text-primary-foreground' : mood.color}`}
              onClick={() => setSelectedMood(mood.value)}
            >
              <div className="mb-1">{mood.icon}</div>
              <span>{mood.label}</span>
            </Button>
          ))}
        </div>
        
        <div className="pt-2">
          <Textarea
            placeholder="Any additional notes about how you're feeling..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={!selectedMood || submitting}
        >
          {submitting ? "Saving..." : "Save Today's Mood"}
        </Button>
      </CardFooter>
    </Card>
  );
};
