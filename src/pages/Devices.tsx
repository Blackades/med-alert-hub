
import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { Bluetooth, Info, AlertCircle, Smartphone, CheckCircle, Menu, Pill, Wifi, Radio } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { registerESP32Device, getUserESP32Devices, ESP32Device } from "@/integrations/supabase/services/esp32-service";
import { registerMqttDevice, getUserMqttDevices } from "@/integrations/supabase/services/mqtt-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Form schema for HTTP device registration
const httpDeviceSchema = z.object({
  deviceId: z.string().min(3, "Device ID must be at least 3 characters"),
  deviceName: z.string().min(3, "Device name must be at least 3 characters"),
  deviceEndpoint: z.string().url("Must be a valid URL (e.g. http://192.168.1.100/)"),
  deviceToken: z.string().min(6, "Device token must be at least 6 characters"),
});

// Form schema for MQTT device registration
const mqttDeviceSchema = z.object({
  deviceId: z.string().min(3, "Device ID must be at least 3 characters"),
  deviceName: z.string().min(3, "Device name must be at least 3 characters"),
});

const Devices = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [httpDevices, setHttpDevices] = useState<ESP32Device[]>([]);
  const [mqttDevices, setMqttDevices] = useState<any[]>([]);
  const [showHttpForm, setShowHttpForm] = useState(false);
  const [showMqttForm, setShowMqttForm] = useState(false);
  
  const httpForm = useForm<z.infer<typeof httpDeviceSchema>>({
    resolver: zodResolver(httpDeviceSchema),
    defaultValues: {
      deviceId: "",
      deviceName: "",
      deviceEndpoint: "http://",
      deviceToken: "",
    },
  });

  const mqttForm = useForm<z.infer<typeof mqttDeviceSchema>>({
    resolver: zodResolver(mqttDeviceSchema),
    defaultValues: {
      deviceId: "",
      deviceName: "",
    },
  });

  // Load devices on component mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchDevices();
    }
  }, [session?.user?.id]);
  
  if (!session) {
    navigate("/auth");
    return null;
  }

  // Fetch both HTTP and MQTT devices
  const fetchDevices = async () => {
    if (!session?.user?.id) return;
    
    try {
      // Fetch HTTP devices
      const httpResult = await getUserESP32Devices(session.user.id);
      if (httpResult.success && httpResult.devices) {
        setHttpDevices(httpResult.devices);
      }
      
      // Fetch MQTT devices
      const mqttResult = await getUserMqttDevices(session.user.id);
      if (mqttResult.success && mqttResult.devices) {
        setMqttDevices(mqttResult.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };
  
  // Register HTTP device
  const handleRegisterHttp = async (data: z.infer<typeof httpDeviceSchema>) => {
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
          description: "Your ESP32 HTTP device has been successfully registered.",
          variant: "default",
        });
        
        // Refresh device list and close form
        fetchDevices();
        setShowHttpForm(false);
        httpForm.reset();
      } else {
        throw new Error("Failed to register HTTP device");
      }
    } catch (error) {
      console.error("Error registering HTTP device:", error);
      toast({
        title: "Registration Failed",
        description: "Could not register your ESP32 HTTP device. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Register MQTT device
  const handleRegisterMqtt = async (data: z.infer<typeof mqttDeviceSchema>) => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    try {
      const response = await registerMqttDevice(
        session.user.id,
        data.deviceId,
        data.deviceName
      );
      
      if (response.success) {
        toast({
          title: "Device Registered",
          description: "Your MQTT device has been successfully registered.",
          variant: "default",
        });
        
        // Refresh device list and close form
        fetchDevices();
        setShowMqttForm(false);
        mqttForm.reset();
      } else {
        throw new Error("Failed to register MQTT device");
      }
    } catch (error) {
      console.error("Error registering MQTT device:", error);
      toast({
        title: "Registration Failed",
        description: "Could not register your MQTT device. Please try again.",
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
            
            <Tabs defaultValue="mqtt">
              <TabsList className="mb-4">
                <TabsTrigger value="mqtt" className="flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  MQTT Devices
                </TabsTrigger>
                <TabsTrigger value="http" className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  HTTP Devices
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="mqtt">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="h-5 w-5" />
                      MQTT Medication Alert Device
                    </CardTitle>
                    <CardDescription>
                      Connect your ESP32 device using MQTT for reliable medication alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-4 bg-primary/5 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">MQTT Connection Details</p>
                          <p className="text-sm text-muted-foreground">
                            Use these details to connect your ESP32 device to the MQTT broker:
                          </p>
                          <ul className="mt-2 space-y-1 text-sm">
                            <li><span className="font-medium">Broker:</span> df116a1a463d460c99605be93a4db7db.s1.eu.hivemq.cloud</li>
                            <li><span className="font-medium">Port:</span> 8883 (TLS/SSL)</li>
                            <li><span className="font-medium">Username:</span> hivemq.webclient.1746829092080</li>
                            <li><span className="font-medium">Password:</span> IvHQa.w*0r8i5L7,mT:X</li>
                            <li><span className="font-medium">Topic:</span> meditrack/alerts/YOUR_DEVICE_ID</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    {/* Show registered MQTT devices if available */}
                    {mqttDevices.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Your MQTT Devices</h3>
                        {mqttDevices.map((device) => (
                          <div key={device.id} className="p-4 border rounded-lg">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-3 w-3 rounded-full bg-green-500"></div>
                              <span className="font-semibold">{device.device_name || 'MQTT Device'}</span>
                            </div>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                              <p><span className="font-medium">Device ID:</span> {device.device_id}</p>
                              <p><span className="font-medium">Topic:</span> meditrack/alerts/{device.device_id}</p>
                              <p><span className="font-medium">Status:</span> {device.is_active ? 'Active' : 'Inactive'}</p>
                            </div>
                          </div>
                        ))}
                        
                        <Button 
                          variant="outline" 
                          onClick={() => setShowMqttForm(true)}
                          className="mt-2"
                        >
                          Register Another MQTT Device
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        {!showMqttForm ? (
                          <div className="text-center">
                            <p className="mb-4">No MQTT devices are registered yet</p>
                            <Button 
                              className="bg-primary hover:bg-primary/90"
                              onClick={() => setShowMqttForm(true)}
                            >
                              <Radio className="mr-2 h-5 w-5" />
                              Register MQTT Device
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                    
                    {/* MQTT device registration form */}
                    {showMqttForm && (
                      <div className="mt-6 p-4 border rounded-lg">
                        <h3 className="text-lg font-medium mb-4">Register MQTT Device</h3>
                        
                        <Form {...mqttForm}>
                          <form onSubmit={mqttForm.handleSubmit(handleRegisterMqtt)} className="space-y-4">
                            <FormField
                              control={mqttForm.control}
                              name="deviceId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Device ID</FormLabel>
                                  <FormControl>
                                    <Input placeholder="esp32-mqtt-001" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    The unique identifier for your ESP32 device
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={mqttForm.control}
                              name="deviceName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Device Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Bedroom MQTT Device" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    A friendly name to identify this device
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
                                  setShowMqttForm(false);
                                  mqttForm.reset();
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
                  <CardFooter className="flex flex-col items-start">
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-2">How to Use:</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>Flash your ESP32 with the provided MQTT sketch</li>
                        <li>Configure the sketch with your WiFi and the MQTT details above</li>
                        <li>Register your device with the same Device ID used in the sketch</li>
                        <li>Your device will automatically receive alerts when medications are due</li>
                      </ol>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="http">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      HTTP ESP32 Alert Device
                    </CardTitle>
                    <CardDescription>
                      Connect your ESP32 device via direct HTTP connection for medication alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">How It Works</p>
                          <p className="text-sm text-muted-foreground">
                            When connected, the device will receive HTTP requests that trigger an LED and buzzer
                            when it's time to take your medication.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Show registered HTTP devices if available */}
                    {httpDevices.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Your HTTP Devices</h3>
                        {httpDevices.map((device) => (
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
                          onClick={() => setShowHttpForm(true)}
                          className="mt-2"
                        >
                          Register Another HTTP Device
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        {!showHttpForm ? (
                          <div className="text-center">
                            <p className="mb-4">No HTTP ESP32 devices are registered yet</p>
                            <Button 
                              className="bg-primary hover:bg-primary/90"
                              onClick={() => setShowHttpForm(true)}
                            >
                              <Smartphone className="mr-2 h-5 w-5" />
                              Register HTTP Device
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                    
                    {/* HTTP device registration form */}
                    {showHttpForm && (
                      <div className="mt-6 p-4 border rounded-lg">
                        <h3 className="text-lg font-medium mb-4">Register HTTP ESP32 Device</h3>
                        
                        <Form {...httpForm}>
                          <form onSubmit={httpForm.handleSubmit(handleRegisterHttp)} className="space-y-4">
                            <FormField
                              control={httpForm.control}
                              name="deviceId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Device ID</FormLabel>
                                  <FormControl>
                                    <Input placeholder="esp32-http-001" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    The unique identifier for your ESP32 device
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={httpForm.control}
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
                              control={httpForm.control}
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
                              control={httpForm.control}
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
                                  setShowHttpForm(false);
                                  httpForm.reset();
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
              </TabsContent>
            </Tabs>
            
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
                    <p className="font-medium">MQTT connection issues?</p>
                    <p className="text-sm text-muted-foreground">
                      Make sure your ESP32 is connected to WiFi and using the correct MQTT credentials. Port 8883 requires TLS/SSL support.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Not receiving MQTT messages?</p>
                    <p className="text-sm text-muted-foreground">
                      Verify that your device is subscribed to the correct topic format: meditrack/alerts/YOUR_DEVICE_ID
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Direct HTTP not working?</p>
                    <p className="text-sm text-muted-foreground">
                      Ensure your ESP32 has a static IP address or check your router's DHCP list to find its current IP.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">LED or buzzer not working?</p>
                    <p className="text-sm text-muted-foreground">
                      Verify that the LED is connected to the correct GPIO pin (default: GPIO 2) and that the buzzer is properly wired (default: GPIO 4).
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Still having issues?</p>
                    <p className="text-sm text-muted-foreground">
                      Check the ESP32 serial monitor for debugging information or try restarting your device.
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
