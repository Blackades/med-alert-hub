/*
 * ESP32 Medication Alert System with MQTT
 * 
 * This sketch allows your ESP32 to receive medication alerts via MQTT
 * and trigger a buzzer and LED accordingly.
 * 
 * Hardware requirements:
 * - ESP32 development board
 * - LED connected to pin 2 (or change LED_PIN)
 * - Buzzer connected to pin 4 (or change BUZZER_PIN)
 * - WiFi connection
 * 
 * Setup instructions:
 * 1. Update WiFi credentials (WIFI_SSID, WIFI_PASSWORD)
 * 2. Set your device ID (must match what's registered in the app)
 * 3. Upload this sketch to your ESP32
 * 4. Use the serial monitor to verify connection to WiFi and MQTT
 * 5. In the app, register the device with the device ID
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===== CONFIGURATION =====
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";  // Replace with your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Replace with your WiFi password

// Device credentials
const String DEVICE_ID = "esp32-001";  // Device ID (must match what you register in the app)

// Hardware pins
const int LED_PIN = 2;     // LED connected to GPIO 2 (built-in LED on most ESP32 boards)
const int BUZZER_PIN = 4;  // Buzzer connected to GPIO 4

// MQTT settings
const char* MQTT_BROKER = "df116a1a463d460c99605be93a4db7db.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "hivemq.webclient.1746829092080"; // Replace with your HiveMQ credentials
const char* MQTT_PASSWORD = "IvHQa.w*0r8i5L7,mT:X"; // Replace with your HiveMQ password
const char* MQTT_TOPIC = "meditrack/alerts/esp32-001"; // Will be suffixed with device ID

// ===== GLOBAL VARIABLES =====
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
bool ledState = false;
unsigned long alertEndTime = 0;

// Generates a unique client ID based on device ID and a random number
String generateClientId() {
  return "esp32_" + DEVICE_ID + "_" + String(random(0xffff), HEX);
}

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  Serial.println("\nMedication Alert System with MQTT starting...");
  
  // Initialize hardware pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Turn off LED and buzzer initially
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Connect to WiFi
  connectToWifi();
  
  // Setup MQTT client
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  
  // Connect to MQTT broker
  connectToMqtt();
  
  Serial.println("Device is ready to receive medication alerts via MQTT!");
  Serial.println("Register this device in the app with:");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectToWifi();
  }
  
  // Check MQTT connection
  if (!mqttClient.connected()) {
    Serial.println("MQTT disconnected. Reconnecting...");
    connectToMqtt();
  }
  
  // Keep the MQTT connection alive
  mqttClient.loop();
  
  // Check if alert should be turned off
  if (alertEndTime > 0 && millis() >= alertEndTime) {
    stopAlert();
    alertEndTime = 0;
  }
  
  // Small delay
  delay(10);
}

// Connect to WiFi network
void connectToWifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Wait for connection
  int connectionAttempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    connectionAttempts++;
    
    if (connectionAttempts > 20) {
      Serial.println("\nWiFi connection failed. Restarting...");
      ESP.restart();
    }
  }
  
  Serial.println("");
  Serial.println("WiFi connected successfully");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// Connect to MQTT broker
void connectToMqtt() {
  // Generate a unique client ID for this connection
  String clientId = generateClientId();
  Serial.print("Connecting to MQTT broker as: ");
  Serial.println(clientId);
  
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    Serial.print("Attempting MQTT connection...");
    
    // Attempt to connect with username and password
    if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println("connected!");
      
      // Subscribe to device-specific topic
      String topic = String(MQTT_TOPIC);
      Serial.print("Subscribing to topic: ");
      Serial.println(topic);
      mqttClient.subscribe(topic.c_str());
      
      // Also subscribe to wildcard topic for broadcasts
      String broadcastTopic = "meditrack/alerts/all";
      Serial.print("Also subscribing to broadcast topic: ");
      Serial.println(broadcastTopic);
      mqttClient.subscribe(broadcastTopic.c_str());
      
      // Publish a connection message
      String connectMessage = "{\"status\":\"online\",\"device\":\"" + DEVICE_ID + "\"}";
      mqttClient.publish("meditrack/status", connectMessage.c_str());
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" trying again in 5 seconds");
      delay(5000);
      attempts++;
    }
  }
  
  if (!mqttClient.connected()) {
    Serial.println("Failed to connect to MQTT after multiple attempts. Restarting...");
    ESP.restart();
  }
}

// MQTT message callback
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received on topic: ");
  Serial.println(topic);
  
  // Create a buffer for the payload
  char message[length + 1];
  for (unsigned int i = 0; i < length; i++) {
    message[i] = (char)payload[i];
  }
  message[length] = '\0';
  
  Serial.print("Payload: ");
  Serial.println(message);
  
  // Parse JSON payload
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parsing failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Extract data from MQTT message
  const char* alertMessage = doc["message"];
  String alertType = doc["alertType"] | "medication";
  int duration = doc["duration"] | 5000;
  
  // Log the medication details
  if (doc.containsKey("medicationName")) {
    Serial.print("Medication: ");
    Serial.println(doc["medicationName"].as<String>());
  }
  
  if (doc.containsKey("dosage")) {
    Serial.print("Dosage: ");
    Serial.println(doc["dosage"].as<String>());
  }
  
  if (doc.containsKey("instructions")) {
    Serial.print("Instructions: ");
    Serial.println(doc["instructions"].as<String>());
  }
  
  // Log the message
  Serial.print("MEDICATION ALERT: ");
  Serial.println(alertMessage);
  
  // Trigger alert (both LED and buzzer)
  triggerAlert("both", duration);
}

// Trigger the alert (LED and/or buzzer)
void triggerAlert(String alertType, int duration) {
  if (alertType == "led" || alertType == "both") {
    digitalWrite(LED_PIN, HIGH);
    ledState = true;
  }
  
  if (alertType == "buzzer" || alertType == "both") {
    digitalWrite(BUZZER_PIN, HIGH);
  }
  
  // Set timer to stop the alert after the specified duration
  alertEndTime = millis() + duration;
  
  // Log the alert
  Serial.print("Alert triggered (");
  Serial.print(alertType);
  Serial.print(") for ");
  Serial.print(duration);
  Serial.println("ms");
}

// Stop all alerts
void stopAlert() {
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  ledState = false;
  Serial.println("Alert ended");
}
