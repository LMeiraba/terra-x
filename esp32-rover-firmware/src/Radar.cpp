#include "Radar.h"
#include "Config.h"
#include <ESP32Servo.h>

Servo radarServo;
Servo cameraServo;
int sweepAngle = 0;
int sweepDir = 1;
long lastSweepTime = 0;
long currentDist = 0;

void initRadar() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  radarServo.attach(SERVO_PIN);
  cameraServo.attach(CAMERA_PAN_PIN);
  cameraServo.write(90); // Start facing forward
}

void setCameraPan(int angle) {
  angle = constrain(angle, 0, 180);
  cameraServo.write(angle);
}

long getUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) return 200; 
  return duration * 0.034 / 2;
}

void updateRadar() {
  if (millis() - lastSweepTime > 30) {
    lastSweepTime = millis();
    
    sweepAngle += sweepDir * 5; 
    if (sweepAngle >= 180) { sweepAngle = 180; sweepDir = -1; }
    if (sweepAngle <= 0) { sweepAngle = 0; sweepDir = 1; }
    radarServo.write(sweepAngle);
    
    currentDist = getUltrasonicDistance();
  }
}

int getSweepAngle() { return sweepAngle; }
long getSweepDistance() { return currentDist; }
