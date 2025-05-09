
import { supabase } from '../client';
import { toast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

// MQTT broker connection details - match ESP8266 sketch
const MQTT_BROKER = "df116a1a463d460c99605be93a4db7db.s1.eu.hivemq.cloud";
const MQTT_PORT = "8883";
const MQTT_USERNAME = "hivemq.webclient.1746829092080";
const MQTT_PASSWORD = "lvHQa.w*0r8i5L7,mT:X";
const MQTT_TOPIC_REMINDERS = "medication/reminders"; // Topic ESP8266 is subscribed to
const MQTT_TOPIC_STATUS = "medication/status";      // Topic ESP8266 publishes to

// Function to generate a unique client ID for MQTT connections
export const generateMqttClientId = (): string => {
  return `meditrack_${uuidv4().substring(0, 8)}`;
};

/**
 * Send MQTT notification for medication
 */
export const sendMqttNotification = async (
  userId: string,
  deviceId: string,
  message: string,
  medicationDetails: any = {}
) => {
  try {
    console.log(`Sending MQTT notification to device: ${deviceId} for user: ${userId}`);

    // Generate unique request ID for tracing
    const requestId = uuidv4();

    // Format the payload to match what the ESP8266 expects - this must match the ESP8266 code format
    const payload = {
      medication: medicationDetails.name || "Unknown Medication",
      dosage: medicationDetails.dosage || "As prescribed",
      instructions: medicationDetails.instructions || message,
      timestamp: new Date().toISOString(),
      alertType: 'medication',
      medicationId: medicationDetails.medicationId || null,
      action: medicationDetails.action || 'reminder',
      requestId,
      deviceId
    };

    console.log("Sending MQTT payload:", payload);

    // Call Supabase Edge Function to publish MQTT message
    const response = await supabase.functions.invoke('mqtt-publish', {
      body: {
        deviceId,
        userId,
        topic: MQTT_TOPIC_REMINDERS, // Use the ESP8266 expected topic
        payload,
        requestId
      }
    });

    if (response.error) {
      console.error("MQTT Publish Error:", response.error);
      throw new Error(response.error.message || 'Failed to publish MQTT notification');
    }

    console.log("MQTT notification sent successfully:", response.data);
    
    return { 
      success: true, 
      requestId,
      data: response.data
    };
  } catch (error) {
    console.error('Error sending MQTT notification:', error);
    
    toast({
      title: "MQTT Notification Failed",
      description: error instanceof Error ? error.message : "Failed to send MQTT notification to device",
      variant: "destructive",
    });
    
    return { 
      success: false, 
      error, 
      message: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

/**
 * Send MQTT notifications to all user's active devices
 */
export const sendMqttNotificationsToAllDevices = async (
  userId: string,
  message: string,
  medicationDetails: any = {}
) => {
  try {
    console.log(`Sending MQTT notifications to all devices for user: ${userId}`);
    
    // Get all active MQTT devices for the user
    const { devices } = await getUserMqttDevices(userId);
    
    if (!devices || devices.length === 0) {
      console.log(`No active MQTT devices found for user: ${userId}`);
      
      // Send to a default device in case we're in demo mode
      if (medicationDetails.demoMode) {
        console.log("Demo mode enabled, sending to demo device");
        return await sendMqttNotification(userId, "demo-device", message, {
          ...medicationDetails,
          name: medicationDetails.name || "Demo Medication", 
        });
      }
      
      return { 
        success: false, 
        message: "No active MQTT devices found", 
        sentCount: 0 
      };
    }
    
    console.log(`Found ${devices.length} MQTT devices for user ${userId}`);
    
    // Send notification to each device
    const notificationPromises = devices.map(device => 
      sendMqttNotification(userId, device.device_id, message, medicationDetails)
    );
    
    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Successfully sent MQTT notifications to ${successCount} of ${devices.length} devices`);
    
    return {
      success: successCount > 0,
      message: `Sent to ${successCount}/${devices.length} devices`,
      sentCount: successCount,
      totalDevices: devices.length,
      results
    };
  } catch (error) {
    console.error('Error sending MQTT notifications to devices:', error);
    
    // Try sending to demo device if in demo mode
    if (medicationDetails.demoMode) {
      console.log("Error with regular devices but demo mode enabled, sending to demo device");
      return await sendMqttNotification(userId, "demo-device", message, {
        ...medicationDetails,
        name: medicationDetails.name || "Demo Medication",
      });
    }
    
    return { 
      success: false, 
      error, 
      message: error instanceof Error ? error.message : "Unknown error",
      sentCount: 0 
    };
  }
};

/**
 * Function to register a device with MQTT capabilities
 */
export const registerMqttDevice = async (
  userId: string,
  deviceId: string,
  deviceName: string
) => {
  try {
    console.log(`Registering MQTT device for user ${userId}: ${deviceId} - ${deviceName}`);
    
    // Call Supabase function to register device
    const { data, error } = await supabase
      .from('user_devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName || `ESP8266 MQTT Device ${deviceId.substring(0, 6)}`,
        device_type: 'mqtt',
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`Successfully registered MQTT device: ${deviceId}`);
    toast({
      title: "Device Registered",
      description: "Your MQTT device has been registered successfully.",
      variant: "default",
    });
    
    return { success: true, device: data };
  } catch (error) {
    console.error('Error registering MQTT device:', error);
    toast({
      title: "Registration Failed",
      description: "Could not register MQTT device.",
      variant: "destructive",
    });
    return { success: false, error, device: null };
  }
};

/**
 * Function to get all MQTT devices for a user
 */
export const getUserMqttDevices = async (userId: string) => {
  try {
    console.log(`Getting MQTT devices for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_type', 'mqtt')
      .eq('is_active', true);
    
    if (error) throw error;
    
    console.log(`Found ${data?.length || 0} MQTT devices for user ${userId}`);
    
    return { success: true, devices: data };
  } catch (error) {
    console.error('Error getting MQTT devices:', error);
    return { success: false, error, devices: [] };
  }
};
