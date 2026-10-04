# Hardware Integration Plan

## Goal Description
Now that the core software architecture (Dual-WiFi, WebSockets, PWM Motor Control) is complete and successfully tested on the ESP32 Brain, we need to physically wire up the remaining hardware components and write their integration code. 

## User Review Required
Please review the complete component list and wiring plan below. Once you approve, we will begin writing the firmware for the I2C sensors and servos.

## Proposed Changes

### 1. Final Physical Component List
To physically wire this rover, you will need the exact components and connectors listed below:

**🧠 Core Boards & Drivers**
- **1x ESP32 Dev Board** (30-pin or 38-pin version).
- **1x ESP32-CAM** (AI-Thinker module with OV2640 camera).
- **1x L298N Motor Driver** (Standard red board with heavy heatsink. Can also use a smaller TB6612FNG to save space).
- **1x Half-Size Solderless Breadboard** (400 tie-points) to act as the central hub for VCC/GND and I2C wiring.

**🛞 Chassis & Servos**
- **1x 4WD Smart Car Chassis Kit** (Includes 4x TT DC Gear Motors and 4x plastic wheels).
- **1x SG90 Micro Servo (Blue, Plastic Gear):** Used specifically for sweeping the Ultrasonic radar (lightweight).
- **1x MG90S Micro Servo (Black, Metal Gear):** Used for panning the ESP32-CAM (can handle the heavier weight of the camera module).

**📡 Sensor Array**
- **1x MPU6050 Module (IMU):** 6-axis gyroscope and accelerometer. Requires a 4-pin I2C connection.
- **1x HC-SR04 Ultrasonic Sensor:** Requires 4 pins (VCC, GND, TRIG, ECHO).
- **1x DHT11 Temperature/Humidity Sensor:** Requires 3 pins (VCC, GND, DATA).

**🔋 Power & Connectors**
- **2x 18650 Li-Ion Batteries (3.7V, ~3000mAh)** to provide a total of 7.4V.
- **1x 18650 Dual Battery Holder** with raw wire leads (or a standard DC Barrel Jack).
- **1x Pack of Dupont Jumper Wires:**
  - *Female-to-Female* (Crucial for connecting sensors directly to the ESP32 pins).
  - *Male-to-Female* (For bridging components to the breadboard).
  - *Male-to-Male* (For wiring across the breadboard).
- **1x Universal 4-Pin JST Connector (Optional):** To create a clean, hot-swappable "Payload Port" on the outside of the chassis for future I2C sensors.

### 2. Physical Wiring & Pin Assignments
We will finalize the hardware wiring according to `Config.h`:
#### [MODIFY] `include/Config.h`
*   Add strict pin definitions for the I2C Bus (`SDA`, `SCL`) which will connect to the MPU6050 and the Universal Payload Port.
*   Add pin definitions for the Radar Servo and Camera Pan Servo.

### 3. I2C Sensor Integration (MPU6050)
#### [NEW] `include/IMU.h` & `src/IMU.cpp`
*   Initialize the `Adafruit_MPU6050` library.
*   Read live Pitch, Roll, and Yaw data.
*   Feed this data to the Dashboard via WebSockets so the 3D Map rotates exactly like the physical rover.

### 4. Servo & Radar Integration
#### [MODIFY] `src/Radar.cpp`
*   Update the mock radar code to actually sweep the SG90 servo 180 degrees.
*   Fire the HC-SR04 ultrasonic sensor at every 10-degree step to generate a true point-cloud for the dashboard.

## Verification Plan
### Automated Tests
*   Compile the new `IMU.cpp` and `Radar.cpp` code using PlatformIO without errors.
### Manual Verification
*   Flash the ESP32 Brain.
*   Open the Dashboard, tilt the physical rover in your hand, and verify the 3D model on the screen mimics the movement perfectly.
