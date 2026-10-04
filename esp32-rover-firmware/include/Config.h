#pragma once

// ==========================================
// WIFI CREDENTIALS (Auto-Fallback)
// ==========================================
#define HOME_SSID "YOUR_HOME_WIFI"
#define HOME_PASS "YOUR_HOME_PASSWORD"

#define ROVER_AP_SSID "TERRA-X-ROVER"
#define ROVER_AP_PASS "password"

// ==========================================
// PINOUT DEFINITIONS
// ==========================================
// Radar & Ultrasonic
#define TRIG_PIN 5
#define ECHO_PIN 18
#define SERVO_PIN 19

// Motor Controller (L298N / TB6612)
#define MOTOR_LEFT_A 25
#define MOTOR_LEFT_B 26
#define MOTOR_RIGHT_A 27
#define MOTOR_RIGHT_B 14
