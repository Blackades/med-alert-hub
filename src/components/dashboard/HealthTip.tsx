
import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const healthTips = [
  "Stay hydrated! Drinking water helps medications absorb properly.",
  "Store medications in a cool, dry place away from direct sunlight.",
  "Set reminders on your phone as a backup for medication alerts.",
  "Keep a medication journal to track any side effects or concerns.",
  "Talk to your doctor before taking any new supplements with your medications."
];

export const HealthTip = () => {
  const [showTip, setShowTip] = useState(true);
  const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];

  if (!showTip) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 animate-fade-up">
      <CardContent className="p-4 flex items-start">
        <div className="p-2 mr-3 rounded-full bg-primary/10 text-primary">
          <Zap className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Health Tip</p>
          <p className="text-sm text-muted-foreground">{randomTip}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTip(false)}
          className="ml-2 h-8 w-8 p-0"
        >
          &times;
        </Button>
      </CardContent>
    </Card>
  );
};
