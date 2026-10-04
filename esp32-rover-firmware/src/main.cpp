#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPmDNS.h>

#include "Config.h"
#include "Radar.h"
#include "Motors.h"

WebSocketsServer webSocket = WebSocketsServer(81);
Preferences preferences;
float imuYaw = 0; // Mocked until MPU6050 is integrated
bool mockDataEnabled = false; // Global toggle for hardware mock mode

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("[%u] Dashboard Connected!\n", num);
    
    preferences.begin("terra-x", true);
    String savedSSID = preferences.getString("ssid", "");
    preferences.end();
    
    StaticJsonDocument<128> doc;
    doc["cmd"] = "CONFIG";
    doc["ssid"] = savedSSID;
    doc["mockEnabled"] = mockDataEnabled;
    
    char buffer[128];
    serializeJson(doc, buffer);
    webSocket.sendTXT(num, buffer);
  } else if (type == WStype_TEXT) {
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      if (doc.containsKey("cmd") && strcmp(doc["cmd"], "DRIVE") == 0) {
        int L = doc["L"];
        int R = doc["R"];
        setMotors(L, R);
      } else if (doc.containsKey("cmd") && strcmp(doc["cmd"], "STOP") == 0) {
        setMotors(0, 0);
      } else if (doc.containsKey("cmd") && strcmp(doc["cmd"], "SET_WIFI") == 0) {
        // Save new WiFi credentials from the Dashboard to persistent memory
        preferences.begin("terra-x", false);
        preferences.putString("ssid", doc["ssid"].as<String>());
        preferences.putString("pass", doc["pass"].as<String>());
        preferences.end();
        
        Serial.println("New WiFi Credentials Saved! Rebooting...");
        webSocket.broadcastTXT("{\"cmd\":\"log\",\"msg\":\"[ACK] WiFi Credentials successfully saved to NVS. Rebooting now!\",\"level\":\"system\"}");
        delay(1000);
        ESP.restart();
      } else if (doc.containsKey("cmd") && strcmp(doc["cmd"], "RESTART") == 0) {
        Serial.println("Reboot command received from dashboard!");
        webSocket.broadcastTXT("{\"cmd\":\"log\",\"msg\":\"[ACK] Reboot command acknowledged. Restarting...\",\"level\":\"system\"}");
        delay(500);
        ESP.restart();
      } else if (doc.containsKey("cmd") && strcmp(doc["cmd"], "SET_MOCK") == 0) {
        mockDataEnabled = doc["enabled"];
        Serial.print("Mock hardware data ");
        Serial.println(mockDataEnabled ? "enabled!" : "disabled!");
        webSocket.broadcastTXT("{\"cmd\":\"log\",\"msg\":\"[ACK] Hardware mock mode updated.\",\"level\":\"system\"}");
      }
    }
  }
}

#include <ESPmDNS.h>

void setup() {
  Serial.begin(115200);
  initMotors();
  initRadar();

  // Load Saved WiFi Credentials from Non-Volatile Memory
  preferences.begin("terra-x", true);
  String savedSSID = preferences.getString("ssid", "");
  String savedPass = preferences.getString("pass", "");
  preferences.end();

  // Smart WiFi Auto-Fallback Logic
  if (savedSSID.length() > 0) {
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());
    Serial.print("Connecting to Saved Home WiFi: ");
    Serial.println(savedSSID);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) { // 10 second timeout
      delay(500);
      Serial.print(".");
      attempts++;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[HOME MODE] Connected to Home WiFi!");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[FIELD MODE] Home WiFi not found or not set. Starting Standalone Rover AP.");
    WiFi.mode(WIFI_AP);
    WiFi.softAP(ROVER_AP_SSID, ROVER_AP_PASS);
    Serial.print("AP Started! Connect to TERRA-X-ROVER. IP: "); 
    Serial.println(WiFi.softAPIP());
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
