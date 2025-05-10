
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
const mqttUsername = Deno.env.get('MQTT_USERNAME') || 'hivemq.webclient.1746880653510';
const mqttPassword = Deno.env.get('MQTT_PASSWORD') || '3Q#?wJD7c&N4Az.0hqtU';

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
    
    // Default topic as in the ESP8266 sketch if not provided
    const defaultTopic = "medication/reminders";
    
    if (!payload) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required field: payload"
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
    
    // Format the payload exactly according to what the ESP8266 sketch expects
    let finalPayload = {
      medication: "",
      dosage: "",
      instructions: ""
    };
    
    if (typeof payload === 'string') {
      // Try to parse if it's a JSON string
      try {
        finalPayload = JSON.parse(payload);
      } catch (e) {
        // If not valid JSON, use it as the medication name
        finalPayload = {
          medication: payload,
          dosage: "Standard Dose",
          instructions: ""
        };
      }
    } else if (typeof payload === 'object') {
      // If it's already an object, ensure it has the required fields
      finalPayload = {
        medication: payload.medication || payload.name || "Unknown Medication",
        dosage: payload.dosage || "Standard Dose",
        instructions: payload.instructions || payload.message || ""
      };
    }
    
    // Ensure the payload matches exactly what the ESP8266 sketch expects
    console.log(`Prepared payload for ESP8266:`, JSON.stringify(finalPayload, null, 2));
    
    // Use the topic from request or fallback to default
    const effectiveTopic = topic || defaultTopic;
    console.log(`Publishing message to topic: ${effectiveTopic}`);
    
    const publishResult = await new Promise((resolve, reject) => {
      client.publish(
        effectiveTopic,
        JSON.stringify(finalPayload),
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
