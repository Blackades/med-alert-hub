
/*
 * ESP32 Medication Alert System
 * 
 * This sketch allows your ESP32 to receive medication alerts from your application 
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
 * 2. Set your device ID and token (must match what's registered in the app)
 * 3. Upload this sketch to your ESP32
 * 4. Use the serial monitor to verify connection and get device IP
 * 5. In the app, register the device with the device ID and token
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// ===== CONFIGURATION =====
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";  // Replace with your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Replace with your WiFi password

// Device credentials (must match what you register in the app)
const String DEVICE_ID = "esp32-001";  // Device ID (can be any unique string)
const String DEVICE_TOKEN = "your-secret-token";  // Device token for authentication

// Hardware pins
const int LED_PIN = 2;     // LED connected to GPIO 2 (built-in LED on most ESP32 boards)
const int BUZZER_PIN = 4;  // Buzzer connected to GPIO 4

// Server settings
const int SERVER_PORT = 80;  // Web server port
WebServer server(SERVER_PORT);

// ===== GLOBAL VARIABLES =====
bool ledState = false;
unsigned long alertEndTime = 0;

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  Serial.println("\nMedication Alert System starting...");
  
  // Initialize hardware pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Turn off LED and buzzer initially
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Connect to WiFi
  connectToWifi();
  
  // Setup server routes
  configureWebServer();
  
  // Start the server
  server.begin();
  Serial.println("HTTP server started");
  Serial.print("Device IP address: ");
  Serial.println(WiFi.localIP());
  Serial.println("Device is ready to receive medication alerts!");
  Serial.println("Register this device in the app with:");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Device Endpoint: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/");
}

void loop() {
  // Handle incoming client requests
  server.handleClient();
  
  // Check if alert should be turned off
  if (alertEndTime > 0 && millis() >= alertEndTime) {
    stopAlert();
    alertEndTime = 0;
  }
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

// Configure web server routes
void configureWebServer() {
  // Root route for testing
  server.on("/", HTTP_GET, []() {
    server.send(200, "application/json", 
      "{\"status\":\"online\",\"device\":\"" + DEVICE_ID + "\"}");
  });
  
  // Route for handling medication alerts
  server.on("/", HTTP_POST, handleAlertRequest);
  
  // Handle CORS preflight OPTIONS requests
  server.on("/", HTTP_OPTIONS, handleCorsOptions);
  
  // Setup 404 route
  server.onNotFound(handleNotFound);
}

// Handle CORS preflight requests
void handleCorsOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  server.send(204); // No content
}

// Handle 404 errors
void handleNotFound() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "application/json", "{\"status\":\"error\",\"message\":\"Not found\"}");
}

// Handle medication alert requests
void handleAlertRequest() {
  // Check authorization header
  if (!server.hasHeader("Authorization")) {
    server.send(401, "application/json", "{\"status\":\"error\",\"message\":\"Authorization required\"}");
    return;
  }
  
  String authHeader = server.header("Authorization");
  if (authHeader != "Bearer " + DEVICE_TOKEN) {
    server.send(403, "application/json", "{\"status\":\"error\",\"message\":\"Invalid token\"}");
    return;
  }
  
  // Parse incoming JSON
  String body = server.arg("plain");
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid JSON\"}");
    return;
  }
  
  // Extract data
  String message = doc["message"] | "Medication Alert";
  String alertType = doc["type"] | "both";
  int duration = doc["duration"] | 5000;
  
  // Trigger alert
  triggerAlert(alertType, duration);
  
  // Log the message
  Serial.println("MEDICATION ALERT: " + message);
  
  // Send success response
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", 
    "{\"status\":\"success\",\"message\":\"Alert triggered\",\"alertType\":\"" + alertType + "\"}");
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
}

// Stop all alerts
void stopAlert() {
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  ledState = false;
  Serial.println("Alert ended");
}

// Reconnect to WiFi if connection is lost
void checkWifiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int reconnectAttempts = 0;
    while (WiFi.status() != WL_CONNECTED && reconnectAttempts < 20) {
      delay(500);
      Serial.print(".");
      reconnectAttempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi reconnected successfully");
      Serial.print("New IP address: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("\nFailed to reconnect WiFi. Restarting...");
      ESP.restart();
    }
  }
}
