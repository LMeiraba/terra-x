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

void setup() {
  Serial.begin(115200);
  initMotors();
  initRadar();

  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  Serial.print("Rover SoftAP Started! IP: ");
  Serial.println(WiFi.softAPIP());

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
