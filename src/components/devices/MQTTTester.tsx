
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { sendMqttNotification } from "@/integrations/supabase/services/mqtt-service";
import { useAuth } from "@/components/AuthProvider";
import { MessageSquare, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function MQTTTester() {
  const [message, setMessage] = useState("Time to take your medication");
  const [deviceId, setDeviceId] = useState("all");
  const [medication, setMedication] = useState("Test Medication");
  const [dosage, setDosage] = useState("1 pill");
  const [instructions, setInstructions] = useState("Take with water");
  const [isSending, setIsSending] = useState(false);
  const [responseLog, setResponseLog] = useState<string>("");
  const { user } = useAuth();
  
  const appendToLog = (text: string) => {
    setResponseLog(prev => `${prev}\n${new Date().toLocaleTimeString()}: ${text}`);
  };
  
  const handleSendMessage = async () => {
    if (!user) {
      toast({
        title: "Not logged in",
        description: "You need to be logged in to send MQTT messages",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    appendToLog("Sending MQTT message...");
    
    try {
      const response = await sendMqttNotification(
        user.id, 
        deviceId,
        message,
        {
          name: medication,
          dosage: dosage,
          instructions: instructions,
          action: 'reminder',
          demoMode: true // For testing purposes
        }
      );
      
      if (response.success) {
        toast({
          title: "Message Sent",
          description: "MQTT message sent successfully!",
          variant: "default",
        });
        appendToLog(`SUCCESS: Message sent with ID ${response.requestId}`);
        appendToLog(`Response: ${JSON.stringify(response.data, null, 2)}`);
      } else {
        toast({
          title: "Failed to Send",
          description: response.message || "Unknown error",
          variant: "destructive",
        });
        appendToLog(`ERROR: ${response.message}`);
      }
    } catch (error) {
      console.error("Error sending MQTT message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send MQTT message",
        variant: "destructive",
      });
      appendToLog(`ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          MQTT Message Tester
        </CardTitle>
        <CardDescription>
          Send test MQTT messages to your connected devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="medication">Medication Name</Label>
            <Input 
              id="medication"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              placeholder="Medication name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input 
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="Dosage"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions</Label>
          <Input 
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Input 
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message to send"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="deviceId">Device ID</Label>
          <Input 
            id="deviceId"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device ID or 'all' for all devices"
          />
        </div>
        
        <Separator className="my-2" />
        
        <div className="space-y-2">
          <Label htmlFor="response">Response Log</Label>
          <Textarea 
            id="response" 
            className="h-32 font-mono text-xs"
            value={responseLog}
            readOnly
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={handleSendMessage}
          disabled={isSending}
        >
          {isSending ? (
            <>Sending...</>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send MQTT Message
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
