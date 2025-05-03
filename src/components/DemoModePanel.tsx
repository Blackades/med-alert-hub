import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useMedications } from "@/contexts/MedicationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Smartphone, Info, RefreshCw } from "lucide-react";
import { triggerDemoNotification } from "@/integrations/supabase/services/notification-service";

// Define compatible notification types for the demo panel
type DemoPanelNotificationType = "email" | "esp32" | "both";

export const DemoModePanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { medications } = useMedications();
  const [selectedMedication, setSelectedMedication] = useState<string>("");
  const [notificationType, setNotificationType] = useState<DemoPanelNotificationType>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingEmails, setIsProcessingEmails] = useState(false);
  const [esp32Data, setEsp32Data] = useState<any>(null);

  const handleTriggerDemo = async () => {
    if (!selectedMedication) {
      toast({
        title: "Error",
        description: "Please select a medication first",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Triggering demo with:", { 
        user: user.id, 
        medication: selectedMedication, 
        type: notificationType 
      });
      
      const { success, data, error } = await triggerDemoNotification(
        user.id,
        selectedMedication,
        notificationType
      );

      if (!success) throw error;

      console.log("Demo notification response:", data);
      
      if (notificationType === 'esp32' || notificationType === 'both') {
        setEsp32Data(data?.notifications || []);
      }

      toast({
        title: "Demo Triggered",
        description: `Successfully triggered ${notificationType} notification demo`,
      });
    } catch (error: any) {
      console.error("Error triggering demo:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to trigger demo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleProcessEmailQueue = async () => {
    setIsProcessingEmails(true);
    try {
      // Since processEmailQueue is not available from the notification service,
      // we need to implement this functionality here or call the appropriate API
      
      // Placeholder implementation - replace with actual implementation
      const response = await fetch('/api/notifications/process-email-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process email queue');
      }
      
      toast({
        title: "Email Queue Processed",
        description: `Processed: ${data.result?.processed || 0}, Failed: ${data.result?.failed || 0}`,
      });
    } catch (error: any) {
      console.error("Error processing email queue:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process email queue",
        variant: "destructive",
      });
    } finally {
      setIsProcessingEmails(false);
    }
  };

  return (
    <Card className="mb-6 bg-slate-50 border-dashed border-slate-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5" /> Demo Mode
        </CardTitle>
        <CardDescription>
          For demonstration purposes only - Trigger notifications on demand
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Medication</label>
              <Select value={selectedMedication} onValueChange={setSelectedMedication}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a medication" />
                </SelectTrigger>
                <SelectContent>
                  {medications.map((med) => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.name} ({med.dosage})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notification Type</label>
              <Tabs defaultValue="email" value={notificationType} onValueChange={(value) => setNotificationType(value as DemoPanelNotificationType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="esp32" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> ESP32
                  </TabsTrigger>
                  <TabsTrigger value="both">Both</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleTriggerDemo} 
                disabled={isLoading || !selectedMedication}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Triggering...
                  </>
                ) : (
                  "Trigger Demo Notification"
                )}
              </Button>
              
              <Button 
                onClick={handleProcessEmailQueue} 
                disabled={isProcessingEmails}
                variant="outline"
              >
                {isProcessingEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Process Emails
                  </>
                )}
              </Button>
            </div>
          </div>

          {esp32Data && esp32Data.length > 0 && (
            <div className="mt-4 border rounded-md p-4 bg-white">
              <h3 className="font-medium mb-2">ESP32 Notification Data:</h3>
              <pre className="text-xs bg-slate-100 p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(esp32Data, null, 2)}
              </pre>
            </div>
          )}
          
          {esp32Data && esp32Data.length === 0 && (
            <div className="mt-4 border rounded-md p-4 bg-white">
              <p className="text-sm text-muted-foreground">No pending ESP32 notifications found.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
