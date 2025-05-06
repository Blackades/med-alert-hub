import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { Bluetooth, Info, AlertCircle, Smartphone, CheckCircle, Menu, Pill } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { registerESP32Device, getUserESP32Devices, ESP32Device } from "@/integrations/supabase/services/esp32-service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Form schema for device registration
const deviceSchema = z.object({
  deviceId: z.string().min(3, "Device ID must be at least 3 characters"),
  deviceName: z.string().min(3, "Device name must be at least 3 characters"),
  deviceEndpoint: z.string().url("Must be a valid URL (e.g. http://192.168.1.100/)"),
  deviceToken: z.string().min(6, "Device token must be at least 6 characters"),
});

const Devices = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<ESP32Device[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  const form = useForm<z.infer<typeof deviceSchema>>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      deviceId: "",
      deviceName: "",
      deviceEndpoint: "http://",
      deviceToken: "",
    },
  });

  // Fixing the error - using useEffect correctly instead of useState
  useEffect(() => {
    if (session?.user?.id) {
      fetchDevices();
    }
  }, [session?.user?.id]);
  
  if (!session) {
    navigate("/auth");
    return null;
  }

  const fetchDevices = async () => {
    if (!session?.user?.id) return;
    
    try {
      const result = await getUserESP32Devices(session.user.id);
      if (result.success && result.devices) {
        setDevices(result.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };
  
  const handleRegister = async (data: z.infer<typeof deviceSchema>) => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    try {
      const response = await registerESP32Device(
        session.user.id,
        data.deviceId,
        data.deviceToken,
        data.deviceName,
        data.deviceEndpoint
      );
      
      if (response.success) {
        toast({
          title: "Device Registered",
          description: "Your ESP32 device has been successfully registered.",
          variant: "default",
        });
        
        // Refresh device list and close form
        fetchDevices();
        setShowForm(false);
        form.reset();
      } else {
        throw new Error("Failed to register device");
      }
    } catch (error) {
      console.error("Error registering device:", error);
      toast({
        title: "Registration Failed",
        description: "Could not register your ESP32 device. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
                
                {/* Show registered devices if available */}
                {devices.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Your Registered Devices</h3>
                    {devices.map((device) => (
                      <div key={device.id} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-3 w-3 rounded-full bg-green-500"></div>
                          <span className="font-semibold">{device.device_name || 'ESP32 Device'}</span>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground">
                          <p><span className="font-medium">Device ID:</span> {device.device_id}</p>
                          <p><span className="font-medium">Endpoint:</span> {device.device_endpoint || 'Not configured'}</p>
                          <p><span className="font-medium">Status:</span> {device.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                    ))}
                    
                    <Button 
                      variant="outline" 
                      onClick={() => setShowForm(true)}
                      className="mt-2"
                    >
                      Register Another Device
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    {!showForm ? (
                      <div className="text-center">
                        <p className="mb-4">No ESP32 devices are registered yet</p>
                        <Button 
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => setShowForm(true)}
                        >
                          <Smartphone className="mr-2 h-5 w-5" />
                          Register a Device
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
                
                {/* Device registration form */}
                {showForm && (
                  <div className="mt-6 p-4 border rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Register ESP32 Device</h3>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="deviceId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Device ID</FormLabel>
                              <FormControl>
                                <Input placeholder="esp32-abc123" {...field} />
                              </FormControl>
                              <FormDescription>
                                The unique identifier for your ESP32 device
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="deviceName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Device Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Bedroom ESP32" {...field} />
                              </FormControl>
                              <FormDescription>
                                A friendly name to identify this device
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="deviceEndpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Device Endpoint URL</FormLabel>
                              <FormControl>
                                <Input placeholder="http://192.168.1.100/" {...field} />
                              </FormControl>
                              <FormDescription>
                                The URL where your ESP32 can be reached (e.g., http://192.168.1.100/)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="deviceToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Authentication Token</FormLabel>
                              <FormControl>
                                <Input placeholder="abc123def456" {...field} />
                              </FormControl>
                              <FormDescription>
                                Security token configured on your ESP32
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex gap-2 pt-2">
                          <Button type="submit" disabled={loading}>
                            {loading ? 'Registering...' : 'Register Device'}
                          </Button>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowForm(false);
                              form.reset();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
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
                      Make sure your ESP32 is powered on and connected to your WiFi network.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Can't reach device endpoint?</p>
                    <p className="text-sm text-muted-foreground">
                      Ensure your ESP32 has a static IP address or check your router's DHCP list to find its current IP.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">LED or buzzer not working?</p>
                    <p className="text-sm text-muted-foreground">
                      Verify that the LED is connected to the correct GPIO pin and that the buzzer is properly wired.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Still having issues?</p>
                    <p className="text-sm text-muted-foreground">
                      Check the ESP32 serial monitor for debugging information.
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
