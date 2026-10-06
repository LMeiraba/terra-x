#include "IMU.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "Config.h"

Adafruit_MPU6050 mpu;
bool imuAvailable = false;

float currentPitch = 0;
float currentRoll = 0;
float currentYaw = 0;

void initIMU() {
    Wire.begin(I2C_SDA, I2C_SCL);
    if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip");
        return;
    }
    Serial.println("MPU6050 Found!");
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    imuAvailable = true;
}

void updateIMU() {
    if (!imuAvailable) return;
    
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Basic complementary filter for pitch and roll
    float accelPitch = atan2(a.acceleration.y, a.acceleration.z) * 180 / PI;
    float accelRoll = atan2(-a.acceleration.x, a.acceleration.z) * 180 / PI;

    // A real system integrates gyro, but this is a simplified example
    currentPitch = accelPitch;
    currentRoll = accelRoll;
    
    // Yaw requires a magnetometer (HMC5883L) or advanced gyro integration.
    // We'll roughly integrate the Z gyro for yaw just for visualization.
    static unsigned long lastTime = millis();
    unsigned long now = millis();
    float dt = (now - lastTime) / 1000.0;
    lastTime = now;
    
    // Ignore small gyro drift
    if (abs(g.gyro.z) > 0.05) {
        currentYaw += (g.gyro.z * 180 / PI) * dt;
    }
}

float getPitch() { return currentPitch; }
float getRoll() { return currentRoll; }
float getYaw() { return currentYaw; }
