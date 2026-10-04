#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

#include "Config.h"
#include "Radar.h"
#include "Motors.h"

WebSocketsServer webSocket = WebSocketsServer(81);
float imuYaw = 0; // Mocked until MPU6050 is integrated

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      if (doc.containsKey("cmd") && strcmp(doc["cmd"], "DRIVE") == 0) {
        int L = doc["L"];
        int R = doc["R"];
        setMotors(L, R);
      } else if (doc.containsKey("cmd") && strcmp(doc["cmd"], "STOP") == 0) {
        setMotors(0, 0);
      }
    }
  }
}

#include <ESPmDNS.h>

void setup() {
  Serial.begin(115200);
  initMotors();
  initRadar();

  // Smart WiFi Auto-Fallback Logic
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(HOME_SSID, HOME_PASS);
  Serial.print("Connecting to Home WiFi...");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) { // 10 second timeout
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[HOME MODE] Connected to Home WiFi!");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[FIELD MODE] Home WiFi not found. Falling back to Standalone Rover AP.");
    WiFi.mode(WIFI_AP);
    WiFi.softAP(ROVER_AP_SSID, ROVER_AP_PASS);
    Serial.print("AP Started! IP: "); Serial.println(WiFi.softAPIP());
  }

  // Start mDNS so the dashboard can always find it at terra-brain.local
  if (!MDNS.begin("terra-brain")) {
    Serial.println("Error setting up MDNS responder!");
  } else {
    Serial.println("mDNS responder started: terra-brain.local");
  }

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
  updateRadar();

  static long lastBroadcast = 0;
  if (millis() - lastBroadcast > 30) {
    lastBroadcast = millis();
    
    StaticJsonDocument<256> doc;
    doc["sweepAngle"] = getSweepAngle();
    doc["sweepDistance"] = getSweepDistance();
    
    // Simulate IMU drifting forward for 3D mapping test
    imuYaw += 0.5;
    if (imuYaw >= 360) imuYaw = 0;
    doc["imuYaw"] = imuYaw;
    doc["imuPitch"] = 0;
    doc["batteryVoltage"] = 7.4;
    
    char buffer[256];
    serializeJson(doc, buffer);
    webSocket.broadcastTXT(buffer);
  }
}
