
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Wifi, WifiOff } from 'lucide-react';
import { registerMqttDevice } from '@/integrations/supabase/services/mqtt-service';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { MQTTTester } from '@/components/devices/MQTTTester';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DevicesPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Redirect if not logged in
  if (!session) {
    navigate('/auth');
    return null;
  }

  const handleRegisterDevice = async () => {
    if (!deviceId || !deviceName) {
      return;
    }

    setIsRegistering(true);
    try {
      await registerMqttDevice(user.id, deviceId, deviceName);
      setDeviceId('');
      setDeviceName('');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Connected Devices</h1>
      <p className="text-muted-foreground mb-8">
        Manage your MediTrack connected devices for medication reminders
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Register New Device</CardTitle>
            <CardDescription>
              Connect an ESP8266 or ESP32 device to receive medication reminders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deviceId">Device ID</Label>
              <Input
                id="deviceId"
                placeholder="Enter device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceName">Device Name</Label>
              <Input
                id="deviceName"
                placeholder="Enter a name for this device"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleRegisterDevice}
              disabled={!deviceId || !deviceName || isRegistering}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {isRegistering ? 'Registering...' : 'Register Device'}
            </Button>
          </CardFooter>
        </Card>

        <MQTTTester />
      </div>

      <Separator className="my-8" />

      <h2 className="text-2xl font-bold mb-4">Registered Devices</h2>
      <DevicesList userId={user.id} />

      <Separator className="my-8" />
      
      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-semibold mb-4">ESP8266/ESP32 Setup Instructions</h2>
        <p className="mb-4">To set up your ESP8266/ESP32 device for medication reminders:</p>
        <ol className="list-decimal pl-6 space-y-2 mb-4">
          <li>Upload the MediTrack firmware to your ESP8266/ESP32 device</li>
          <li>Configure your WiFi credentials in the sketch</li>
          <li>Note the device ID displayed on first boot</li>
          <li>Register the device ID on this page</li>
          <li>Test the connection using the MQTT Message Tester</li>
        </ol>
        <p>Need help? Check out the <a href="#" className="text-primary hover:underline">setup guide</a>.</p>
      </div>
    </div>
  );
}

function DevicesList({ userId }: { userId: string }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock devices for demonstration (replace with real data in production)
  const mockDevices = [
    { id: '1', name: 'Bedroom ESP8266', status: 'online', lastConnected: '2 minutes ago' },
    { id: '2', name: 'Kitchen ESP32', status: 'offline', lastConnected: '2 days ago' }
  ];

  return (
    <div className="space-y-4">
      {mockDevices.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No devices registered yet</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {mockDevices.map((device) => (
            <Card key={device.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{device.name}</CardTitle>
                  {device.status === 'online' ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <CardDescription>Last seen: {device.lastConnected}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm">Device ID: {device.id}</p>
                <p className={`text-sm font-medium ${device.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                  Status: {device.status}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm">Test</Button>
                <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
