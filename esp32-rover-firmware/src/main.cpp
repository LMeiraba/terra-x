#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ─── PINS ───────────────────────────────────────────────────────────────────
#define TRIG_PIN 5
#define ECHO_PIN 18
#define SERVO_PIN 19
#define MOTOR_LEFT_A 25
#define MOTOR_LEFT_B 26
#define MOTOR_RIGHT_A 27
#define MOTOR_RIGHT_B 14

// ─── GLOBALS ────────────────────────────────────────────────────────────────
WebSocketsServer webSocket = WebSocketsServer(81);
Servo radarServo;

// Radar Sweep State
int sweepAngle = 0;
int sweepDir = 1;
long lastSweepTime = 0;

// IMU State (Mocked for now until MPU6050 is wired)
float imuYaw = 0;

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────
long getUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5m max)
  if (duration == 0) return 200; // timeout or out of range
  return duration * 0.034 / 2;
}

// ─── WEBSOCKET EVENTS ───────────────────────────────────────────────────────
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      const char* cmd = doc["cmd"];
      int speed = doc["speed"]; // 0-100
      
      // Basic Motor Control Logic
      if (strcmp(cmd, "F") == 0) {
        Serial.println("Moving FORWARD");
        // digitalWrite(MOTOR_LEFT_A, HIGH); ...
      } else if (strcmp(cmd, "STOP") == 0) {
        Serial.println("STOPPING");
        // digitalWrite(MOTOR_LEFT_A, LOW); ...
      }
    }
  }
}

// ─── SETUP ──────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  radarServo.attach(SERVO_PIN);
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: ");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

// ─── MAIN LOOP ──────────────────────────────────────────────────────────────
void loop() {
  webSocket.loop();

  // Sweep the servo every 30ms for smooth radar
  if (millis() - lastSweepTime > 30) {
    lastSweepTime = millis();
    
    // Update servo position
    sweepAngle += sweepDir * 5; // move 5 degrees per tick
    if (sweepAngle >= 180) { sweepAngle = 180; sweepDir = -1; }
    if (sweepAngle <= 0) { sweepAngle = 0; sweepDir = 1; }
    radarServo.write(sweepAngle);
    
    // Read distance at this angle
    long dist = getUltrasonicDistance();
    
    // Build JSON payload matching exactly what the Tauri dashboard expects
    StaticJsonDocument<256> doc;
    doc["sweepAngle"] = sweepAngle;
    doc["sweepDistance"] = dist;
    doc["imuYaw"] = imuYaw;
    doc["imuPitch"] = 0;
    doc["batteryVoltage"] = 7.4;
    
    // Simulate IMU drifting forward for mapping test
    imuYaw += 0.5;
    if (imuYaw >= 360) imuYaw = 0;
    
    char buffer[256];
    serializeJson(doc, buffer);
    
    // Broadcast to the Tauri dashboard
    webSocket.broadcastTXT(buffer);
  }
}
