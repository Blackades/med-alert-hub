
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { connect } from "https://esm.sh/mqtt@5.4.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// MQTT broker settings to match ESP8266 sketch
const mqttBroker = Deno.env.get('MQTT_BROKER') || 'df116a1a463d460c99605be93a4db7db.s1.eu.hivemq.cloud';
const mqttPort = Deno.env.get('MQTT_PORT') || '8883';
const mqttUsername = Deno.env.get('MQTT_USERNAME') || 'hivemq.webclient.1746829092080';
const mqttPassword = Deno.env.get('MQTT_PASSWORD') || 'lvHQa.w*0r8i5L7,mT:X';

// Generate a random client ID for each connection
const generateClientId = () => {
  return `meditrack_server_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Generate a unique client ID for this connection
    const clientId = generateClientId();
    console.log(`Creating MQTT client with ID: ${clientId}`);
    
    // Get request data
    const requestData = await req.json();
    const { topic, payload, deviceId } = requestData;
    
    if (!topic || !payload) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: topic and payload"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
    
    // Create MQTT client
    const mqttUrl = `mqtts://${mqttBroker}:${mqttPort}`;
    console.log(`Connecting to MQTT broker at: ${mqttUrl}`);
    
    const client = connect(mqttUrl, {
      clientId,
      clean: true,
      connectTimeout: 5000,
      username: mqttUsername,
      password: mqttPassword,
      rejectUnauthorized: false
    });
    
    // Wait for the connection to be established
    const connectionResult = await new Promise((resolve, reject) => {
      // Set timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);
      
      client.on('connect', () => {
        clearTimeout(timeout);
        resolve({ connected: true });
      });
      
      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('MQTT connection error:', err);
        reject(err);
      });
    });
    
    console.log("MQTT connection result:", connectionResult);
    
    // Prepare the message payload - ensure it matches what ESP8266 expects
    let finalPayload = payload;
    
    // If it's an object, ensure it has the minimum required fields for ESP8266
    if (typeof payload === 'object') {
      // Make sure object has all the required fields
      finalPayload = {
        medication: payload.medication || payload.name || "Unknown Medication",
        dosage: payload.dosage || "Standard Dose",
        instructions: payload.instructions || payload.message || "",
        timestamp: payload.timestamp || new Date().toISOString(),
        ...payload
      };
    }
    
    // Publish the message - use the expected topic format for ESP8266
    const effectiveTopic = topic || 'medication/reminders';
    console.log(`Publishing message to topic: ${effectiveTopic}`);
    console.log(`Payload:`, JSON.stringify(finalPayload, null, 2));
    
    const publishResult = await new Promise((resolve, reject) => {
      client.publish(
        effectiveTopic,
        typeof finalPayload === 'string' ? finalPayload : JSON.stringify(finalPayload),
        { qos: 1, retain: false },
        (err, packet) => {
          if (err) {
            console.error('Publish error:', err);
            reject(err);
          } else {
            resolve({ published: true, packet });
          }
        }
      );
    });
    
    console.log("MQTT publish result:", publishResult);
    
    // Close the connection
    client.end();
    
    return new Response(
      JSON.stringify({
        success: true,
        topic: effectiveTopic,
        clientId,
        timestamp: new Date().toISOString(),
        message: "Message published successfully",
        payload: finalPayload
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
    
  } catch (error) {
    console.error("Error in MQTT publish function:", error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to publish MQTT message"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});

console.log("MQTT publish function initialized");
