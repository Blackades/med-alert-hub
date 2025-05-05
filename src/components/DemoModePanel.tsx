
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useMedications } from "@/contexts/MedicationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Smartphone, Info, RefreshCw } from "lucide-react";
import { triggerNotification, processEmailQueue, getESP32NotificationData } from "@/integrations/supabase/services/notification-service";

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
  const [isLoadingEsp32Data, setIsLoadingEsp32Data] = useState(false);

  const handleTriggerDemo = async () => {
    if (!selectedMedication) {
      toast({
        title: "Error",
        description: "Please select a medication first",
        variant: "destructive",
      });
      return;
    }

    // Use the user ID if available, otherwise use a demo placeholder
    const userId = user?.id || "demo-user-id";

    setIsLoading(true);
    try {
      console.log("Triggering demo with:", { 
        user: userId, 
        medication: selectedMedication, 
        type: notificationType,
        demoMode: true 
      });
      
      // For the notification service
      const response = await triggerNotification({
        userId: userId,
        medicationId: selectedMedication,
        notificationType: notificationType,
        customMessage: "This is a demo notification",
        demoMode: true // Always set demoMode to true for demo panel
      });

      if (!response.success) {
        throw new Error(response.error?.message || "Unknown error");
      }

      console.log("Demo notification response:", response.data);
      
      // For ESP32 notification data, fetch it after triggering
      if (notificationType === 'esp32' || notificationType === 'both') {
        await fetchESP32Data();
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

  const fetchESP32Data = async () => {
    setIsLoadingEsp32Data(true);
    try {
      const { success, data } = await getESP32NotificationData();
      if (success && data) {
        setEsp32Data(data);
      } else {
        setEsp32Data([]);
      }
    } catch (error) {
      console.error("Error fetching ESP32 data:", error);
      setEsp32Data([]);
    } finally {
      setIsLoadingEsp32Data(false);
    }
  };
  
  const handleProcessEmailQueue = async () => {
    setIsProcessingEmails(true);
    try {
      const { success, data, error, result } = await processEmailQueue();
      
      if (!success) throw error;
      
      toast({
        title: "Email Queue Processed",
        description: `Processed: ${result?.processed || 0}, Failed: ${result?.failed || 0}`,
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
                  {medications.length === 0 && (
                    <SelectItem value="demo-medication-id">
                      Demo Medication (10mg)
                    </SelectItem>
                  )}
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
                disabled={isLoading}
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

          {isLoadingEsp32Data && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          )}

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
          
          {!user && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
              <p className="font-medium">Note: You are using demo mode while not logged in.</p>
              <p className="mt-1">All notifications will be simulated and not sent to real email addresses.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
