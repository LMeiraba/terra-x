# Terra-X Hardware Manifest

Based on our architectural decisions, firmware implementations, and previous design notes, here is the complete official parts list required to build the physical Terra-X Rover.

## 🧠 Processing Boards (The "Split-Brain" Architecture)
1. **ESP32 Dev Module (Main Brain)**
   * **Role:** Handles all WiFi/WebSocket routing, motor PWM generation, IMU reading, and radar servo sweeps.
   * **Type:** Standard 30-pin or 38-pin ESP32 development board.
2. **ESP32-CAM (Vision Module)**
   * **Role:** Dedicated purely to capturing and streaming high-framerate MJPEG video to the dashboard. 
   * **Type:** AI-Thinker ESP32-CAM (OV2640 Camera).

## 🛞 Drivetrain & Chassis
1. **4WD Rover Chassis**
   * Standard dual-deck acrylic or aluminum chassis kit.
2. **4x DC Gear Motors (TT Motors)**
   * Standard 3V-6V yellow DC gear motors.
3. **Motor Driver Board (L298N or TB6612FNG)**
   * **Role:** Takes the 3.3V PWM signals from the ESP32 Brain and uses them to switch the high-current 7.4V battery power to the 4 motors (wired in parallel pairs for left/right skid-steering).

## 📡 Sensor Array
1. **MPU6050 (IMU - Inertial Measurement Unit)**
   * **Role:** 6-axis gyroscope and accelerometer. Calculates the real-time pitch, roll, and yaw of the rover so the 3D Map in the dashboard rotates synchronously.
   * **Wiring:** I2C (SDA/SCL pins).
2. **HC-SR04 Ultrasonic Distance Sensor**
   * **Role:** Bounces sound waves to detect obstacles in front of the rover. Triggers the automatic collision-override system if objects are < 20cm away.
3. **SG90 Micro Servo**
   * **Role:** The Ultrasonic sensor mounts on top of this. The ESP32 sweeps this servo back and forth 180° to create a 3D radar point-cloud map.

## 🔋 Power Delivery
1. **2x 18650 Li-Ion Batteries (7.4V Total)**
   * The primary power source. 
   * **Routing:** 7.4V goes directly into the Motor Driver. The Motor Driver usually has a 5V regulator output, which you use to safely power the `VIN` (5V) pin of the ESP32 Brain and ESP32-CAM.

## 🔌 Payload Port (Future-Proofing)
* As discussed in earlier architecture notes, the rover features a **Universal 4-pin Payload Port** exposed on the chassis. 
* **Pins:** `VCC (5V/3.3V)`, `GND`, `SDA`, `SCL`.
* **Role:** Allows you to effortlessly plug in future I2C sensors (like Gas sensors, Thermal cameras, or OLED screens) without ripping the rover apart.
