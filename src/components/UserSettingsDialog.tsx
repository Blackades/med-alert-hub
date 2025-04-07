import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface UserSettingsDialogProps {
  onSave: (settings: { email: string; phoneNumber: string }) => void;
  children?: React.ReactNode; // Added children prop
}

export const UserSettingsDialog = ({ onSave, children }: UserSettingsDialogProps) => {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, phone_number')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setEmail(data.email || "");
          setPhoneNumber(data.phone_number || "");
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ email, phoneNumber });
    setOpen(false);
  };

  const handleTestEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address first",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          email: email,
          medication: "Test Medication",
          dosage: "1 pill",
          scheduledTime: new Date().toLocaleTimeString(),
          isReminder: true,
        },
      });

      if (error) throw error;

      toast({
        title: "Test email sent",
        description: `A test email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Error sending test email",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email for Notifications</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number for SMS Notifications</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Include country code (e.g., +1 for US)
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Save Settings
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestEmail}
              disabled={isSending}
              className="flex-1"
            >
              {isSending ? "Sending..." : "Test Email"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
