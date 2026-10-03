#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// --- PIN DEFINITIONS ---
#define DHT_PIN 4
#define DHT_TYPE DHT22  // Wokwi uses DHT22
#define TRIG_PIN 5
#define ECHO_PIN 18
#define SERVO_PIN 19
#define BATTERY_PIN 34
#define MOTOR_LEFT_FWD 25
#define MOTOR_RIGHT_FWD 26

DHT dht(DHT_PIN, DHT_TYPE);
Servo radarServo;

// --- STATE VARIABLES ---
long lastTelemetryTime = 0;
int sweepAngle = 0;
int sweepDirection = 1; // 1 for UP, -1 for DOWN

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- TERRA-X ESP32 CORE BOOTING ---");
  
  dht.begin();
  radarServo.attach(SERVO_PIN);
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);
  
  // LED "Motors"
  pinMode(MOTOR_LEFT_FWD, OUTPUT);
  pinMode(MOTOR_RIGHT_FWD, OUTPUT);
  analogWrite(MOTOR_LEFT_FWD, 0);
  analogWrite(MOTOR_RIGHT_FWD, 0);
  
  Serial.println("System Ready. Waiting for JSON commands...");
  Serial.println("Try typing: {\"cmd\":\"DRIVE\", \"L\":100, \"R\":100}");
}

// Function to read the ultrasonic sensor
long getRadarDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) return -1;
  return duration * 0.034 / 2;
}

// Handle incoming JSON from the Serial Monitor (simulating WebSockets)
void processCommand(String jsonString) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, jsonString);
  
  if (error) {
    Serial.println("Failed to parse JSON command");
    return;
  }
  
  const char* cmd = doc["cmd"];
  
  if (strcmp(cmd, "DRIVE") == 0) {
    int L = doc["L"]; // -100 to 100
    int R = doc["R"];
    
    Serial.printf("Executing DRIVE -> Left: %d%% | Right: %d%%\n", L, R);
    
    // Map percentages to PWM (0-255)
    int pwmLeft = map(abs(L), 0, 100, 0, 255);
    int pwmRight = map(abs(R), 0, 100, 0, 255);
    
    // In Wokwi we just light up the LEDs to prove the PWM works!
    analogWrite(MOTOR_LEFT_FWD, pwmLeft);
    analogWrite(MOTOR_RIGHT_FWD, pwmRight);
    
  } else if (strcmp(cmd, "STOP") == 0) {
    Serial.println("Executing STOP");
    analogWrite(MOTOR_LEFT_FWD, 0);
    analogWrite(MOTOR_RIGHT_FWD, 0);
  }
}

void loop() {
  // 1. Process Incoming Serial Commands
  if (Serial.available()) {
    String incoming = Serial.readStringUntil('\n');
    processCommand(incoming);
  }
  
  // 2. Generate and Send Telemetry (10Hz)
  long now = millis();
  if (now - lastTelemetryTime > 100) {
    lastTelemetryTime = now;
    
    // Sweep Servo
    sweepAngle += sweepDirection * 5;
    if (sweepAngle >= 180 || sweepAngle <= 0) sweepDirection *= -1;
    radarServo.write(sweepAngle);
    
    // Read Sensors
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    long dist = getRadarDistance();
    
    // Simulate Battery Voltage Divider (0-4095 mapped to 0V-8.4V)
    int rawBattery = analogRead(BATTERY_PIN);
    float batteryVoltage = (rawBattery / 4095.0) * 8.4; 

    // Create Outgoing JSON
    StaticJsonDocument<256> out;
    out["temperature"] = temp;
    out["humidity"] = hum;
    out["distanceFront"] = dist;
    out["sweepAngle"] = sweepAngle;
    out["batteryVoltage"] = batteryVoltage;
    
    // Print telemetry back to "dashboard"
    String output;
    serializeJson(out, output);
    Serial.println(output);
  }
}
