
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { Bluetooth, Info, AlertCircle, Smartphone, CheckCircle, Menu, Pill } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const Devices = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  
  if (!session) {
    navigate("/auth");
    return null;
  }
  
  const handleConnect = () => {
    setConnecting(true);
    
    // Simulate connection process
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      
      toast({
        title: "Device Connected",
        description: "Your ESP32 device has been successfully connected.",
        variant: "default",
      });
    }, 2000);
  };
  
  const handleDisconnect = () => {
    setConnected(false);
    
    toast({
      title: "Device Disconnected",
      description: "Your ESP32 device has been disconnected.",
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:flex items-center gap-2">
            <div className="bg-gradient-to-r from-primary to-secondary rounded-full h-9 w-9 flex items-center justify-center">
              <Pill className="text-white" size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <MediTrackSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Devices</h1>
              <p className="text-muted-foreground mt-1">
                Connect and manage your smart medication devices.
              </p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  ESP32 Medication Alert Device
                </CardTitle>
                <CardDescription>
                  Connect your ESP32 device to receive real-time medication alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">How It Works</p>
                      <p className="text-sm text-muted-foreground">
                        When connected, the device will light up an LED and make a sound when
                        it's time to take your medication. This helps ensure you never miss a dose.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  {connected ? (
                    <>
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      <span className="font-semibold">Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="h-3 w-3 rounded-full bg-destructive"></div>
                      <span className="font-semibold">Disconnected</span>
                    </>
                  )}
                </div>
                
                {connected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div>
                          <p className="font-medium">Device Ready</p>
                          <p className="text-sm">
                            Your ESP32 device is connected and will notify you when it's time to take your medications.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleDisconnect}
                    >
                      Disconnect Device
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>Connecting...</>
                    ) : (
                      <>
                        <Bluetooth className="mr-2 h-5 w-5" />
                        Connect Device
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Troubleshooting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 list-disc pl-6">
                  <li>
                    <p className="font-medium">Device not connecting?</p>
                    <p className="text-sm text-muted-foreground">
                      Make sure your device is powered on and within Bluetooth range.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">LED not working?</p>
                    <p className="text-sm text-muted-foreground">
                      Check the power supply and ensure the LED is properly connected.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Still having issues?</p>
                    <p className="text-sm text-muted-foreground">
                      Contact support for assistance with your device.
                    </p>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Devices;
