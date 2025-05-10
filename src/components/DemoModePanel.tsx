import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useMedications } from "@/contexts/MedicationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Smartphone, Info, RefreshCw, Wifi } from "lucide-react";
import { triggerNotification, processEmailQueue, getESP32NotificationData } from "@/integrations/supabase/services/notification-service";
import { supabase } from "@/integrations/supabase/client";
import { sendMqttNotificationsToAllDevices } from "@/integrations/supabase/services/mqtt-service";

// Define compatible notification types for the demo panel
type DemoPanelNotificationType = "email" | "esp32" | "mqtt" | "both";

export const DemoModePanel = () => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { medications } = useMedications();
  const [selectedMedication, setSelectedMedication] = useState<string>("");
  const [notificationType, setNotificationType] = useState<DemoPanelNotificationType>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingEmails, setIsProcessingEmails] = useState(false);
  const [esp32Data, setEsp32Data] = useState<any>(null);
  const [isLoadingEsp32Data, setIsLoadingEsp32Data] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleTriggerDemo = async () => {
    if (!selectedMedication) {
      toast({
        title: "Error",
        description: "Please select a medication first",
        variant: "destructive",
      });
      return;
    }

    // Find the selected medication details
    const selectedMed = medications.find(med => med.id === selectedMedication);
    if (!selectedMed) {
      toast({
        title: "Error",
        description: "Could not find the selected medication",
        variant: "destructive",
      });
      return;
    }

    // Use the user ID if available, otherwise use a demo placeholder
    const userId = user?.id || "demo-user-id";

    setIsLoading(true);
    try {
      console.log("Triggering demo with:", { 
        userId, 
        medicationId: selectedMedication, 
        type: notificationType,
        demoMode: true,
        selectedMed
      });
      
      // Call the notification service with the selected medication ID
      const response = await triggerNotification({
        userId: userId,
        medicationId: selectedMedication,
        notificationType: notificationType,
        customMessage: `Demo notification for ${selectedMed.name}`,
        demoMode: true,
        testMode: !user, // If no user, use test mode to avoid auth issues
        autoProcessEmails: true, // Auto-process emails immediately
        preventDuplicates: true, // Prevent duplicate emails
        // Include medication details in the metadata object instead of as separate properties
        metadata: {
          medicationName: selectedMed.name,
          medicationDosage: selectedMed.dosage,
          medicationInstructions: selectedMed.instructions || "Take as directed"
        }
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
        description: `Successfully triggered ${notificationType} notification demo for ${selectedMed.name}`,
        variant: "default",
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
        variant: "default",
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

  const handleDemoNotification = async () => {
    if (!session) {
      toast({
        title: "Not logged in",
        description: "You need to be logged in to trigger a demo notification.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Find the selected medication details or use a fallback
      const selectedMed = selectedMedication ? 
        medications.find(med => med.id === selectedMedication) : 
        { name: "Demo Medication", dosage: "Standard Dose", instructions: "Take as directed" };
      
      if (!selectedMed) {
        throw new Error("Could not find the selected medication");
      }
      
      // Create a proper demo medication object with the correct name
      const medDetails = {
        name: selectedMed.name,
        dosage: selectedMed.dosage,
        instructions: selectedMed.instructions || "Take as directed"
      };
      
      // Send email notification
      const emailResult = await supabase.functions.invoke("demo-notification", {
        body: {
          userId: user.id,
          email: user.email,
          medicationId: selectedMedication || "demo-medication-id",
          recipientName: "Demo User",
          medicationName: medDetails.name,
          dosage: medDetails.dosage,
          instructions: medDetails.instructions,
          preventDuplicates: true
        },
      });

      // Also send MQTT notification if applicable
      if (notificationType === "mqtt" || notificationType === "both") {
        try {
          const mqttResponse = await sendMqttNotificationsToAllDevices(
            user.id, 
            `Time to take your ${medDetails.name}`,
            {
              name: medDetails.name,
              dosage: medDetails.dosage,
              instructions: medDetails.instructions,
              demoMode: true
            }
          );
          
          console.log("MQTT demo notification response:", mqttResponse);
        } catch (mqttError) {
          console.error("MQTT demo notification error:", mqttError);
          // Continue even if MQTT fails
        }
      }

      if (emailResult.error) {
        throw new Error(emailResult.error.message || "Failed to send demo notification");
      }

      toast({
        title: "Demo Notification Sent",
        description: `Check your inbox for the demo notification email for ${medDetails.name} and watch for device alerts.`,
      });
    } catch (error: any) {
      console.error("Demo notification error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send demo notification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="mqtt" className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" /> MQTT
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
              <p className="mt-1">All notifications will be simulated and not sent to real email addresses or devices.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
