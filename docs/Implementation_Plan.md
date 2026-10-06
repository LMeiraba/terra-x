# Hardware Integration Plan (Phase 2)

## Goal Description
With the base WiFi, Dashboard, and PWM Locomotion completed, the next major goal is to integrate the physical sensor array and the Rotating Cone payload. This requires updating the ESP32 firmware to read I2C data (from the MPU6050 IMU) and control the PWM Servos (Radar and Camera Pan), while passing that telemetry back to the Dashboard.

## User Review Required
> [!IMPORTANT]
> Because your artifact popup UI is completely broken, we will use this `docs/` folder for all future planning! Please review the proposed changes below. Once you approve this plan in the chat, I will execute the code changes.

## Open Questions
> [!WARNING]
> Do you want the **Rotating Cone** to turn on automatically when the rover drives forward, or do you want a dedicated manual toggle switch for it on the Dashboard?

## Proposed Changes

---

### Firmware Configuration
Centralizing all the physical ESP32 pin assignments for the new hardware.

#### [MODIFY] `esp32-rover-firmware/include/Config.h`
*   Define the `I2C_SDA` and `I2C_SCL` pins for the MPU6050.
*   Define the PWM pin for the SG90 Radar Servo.
*   Define the PWM pin for the MG90S Camera Pan Servo.
*   Define the output pin for the Rotating Cone's MOSFET driver.

---

### IMU Integration (MPU6050)
Replacing the mocked IMU data with real hardware readings.

#### [NEW] `esp32-rover-firmware/include/IMU.h`
#### [NEW] `esp32-rover-firmware/src/IMU.cpp`
*   Initialize the `Adafruit_MPU6050` library.
*   Create an `updateIMU()` function that reads Pitch, Roll, and Yaw in real-time.
*   Apply basic low-pass filtering to prevent sensor jitter from shaking the 3D map.

#### [MODIFY] `esp32-rover-firmware/src/main.cpp`
*   Include `IMU.h` and call `updateIMU()` in the main loop.
*   Inject the real `imuPitch`, `imuRoll`, and `imuYaw` values into the WebSocket JSON payload.

---

### Radar & Servo Integration
Replacing the mocked radar data with physical sweeping logic.

#### [MODIFY] `esp32-rover-firmware/src/Radar.cpp`
*   Include the `ESP32Servo` library.
*   Sweep the SG90 servo from 0° to 180° in non-blocking increments (using `millis()`).
*   Trigger the HC-SR04 ultrasonic sensor at every 10-degree step.
*   Return the `sweepAngle` and `sweepDistance` so `main.cpp` can transmit it to the Dashboard point-cloud map.

## Verification Plan

### Automated Tests
Run `platformio run --environment esp32dev` to ensure the new `Adafruit_MPU6050` and `ESP32Servo` libraries compile successfully without breaking the existing motor logic.

### Manual Verification
1.  Flash the updated firmware to the ESP32.
2.  Wire the MPU6050 to the defined I2C pins.
3.  Open the Dashboard and physically tilt the breadboard in your hand to verify the 3D model on the screen rotates synchronously.
