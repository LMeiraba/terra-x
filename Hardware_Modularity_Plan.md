# Terra-X Hardware Modularity & Final BOM

To impress the judges, Terra-X is presented as a **rapidly deployable, multi-mission platform** built entirely from COTS (Commercial Off-The-Shelf) components. 

By separating the hardware into a **Permanent Core** and **Swappable Mission Payloads**, you prove extreme cost-efficiency. Instead of buying multiple expensive, specialized robots, an agency only needs one Terra-X base and a toolkit of simple, low-cost payloads.

---

## 1. The Permanent Core (The Base Platform)
This is the baseline hardware required for the rover to survive, navigate, and see in any environment.

### 🧠 Processing Boards (The "Split-Brain" Architecture)
1. **ESP32 Dev Module (Main Brain)**
   * **Role:** Handles all WiFi/WebSocket routing, motor PWM generation, and sensor reading.
2. **ESP32-CAM (Vision Module)**
   * **Role:** Dedicated purely to capturing and streaming high-framerate MJPEG video to the dashboard. 

### 🛞 Drivetrain & Chassis
1. **4WD Rover Chassis:** Standard four-motor compatible chassis.
2. **4x BO Gear Motors & Wheels:** Matching voltage/RPM, one motor per wheel.
3. **2x L298N Motor Drivers:** 
   * Driver 1 handles the Left-side motor pair.
   * Driver 2 handles the Right-side motor pair.

### 📡 Base Navigation Sensor Array
1. **HC-SR04 Ultrasonic Distance Sensor:** Bounces sound waves to detect obstacles in front of the rover. 
2. **DHT11 (Temperature & Humidity):** Permanently mounted inside to monitor the rover's own electronics for overheating or condensation.

### 💡 Illumination
* **4x White LED Modules:** Front camera illumination.
* **LED Resistors:** Current limiting for the LEDs.

### 🔋 Power Delivery & Protection
* **1x Battery Pack:** Suitable for four BO motors.
* **1x Buck Converter:** Regulated electronics supply for the ESP32s.
* **1x Main Power Switch:** Main system isolation.
* **1x Main Fuse + Holder:** Battery-side protection.
* **Battery Connectors/Terminals/Charger:** Power connections.

---

## 2. The Rotating Cone Payload (Inspection Nose)
A specialized rotating inspection attachment for the front of the rover, completely isolated for safety.
* **1x DC Geared Motor:** Drives the rotating inspection cone.
* **1x MOSFET Driver Module:** One-direction DC motor switching.
* **1x Flyback Diode:** Inductive spike suppression.
* **1x Rotating Cone:** Inspection nose attachment.
* **1x Shaft Coupler & Motor Mounting Bracket:** Connects the motor shaft to the cone shaft.
* **1x Cone Motor Fuse + Holder:** Protection specifically for the cone motor branch.
* **1x Emergency Cutoff Switch:** Independent cone isolation.

---

## 3. Mechanical & Wiring (Assembly Parts)
* **Wiring:** Jumper and signal wires, Power wires, Heat-shrink tubing.
* **Electronics:** Perfboard and pin headers (for small permanent circuits).
* **Hardware:** M3 screw/nut/washer kit, Nylon/brass spacers, L-brackets, Cable clips / strain relief.

---

## 4. Swappable Mission Payloads (The Universal I2C Port)
*(Planned expansions beyond the initial BOM)*
To achieve true "hot-swappability", the rover features a universal 4-pin port (VCC, GND, SDA, SCL). 
* **Search & Rescue:** Thermal Sensor (MLX90614) & Respiration Sensor (BME280).
* **Hazmat Scouting:** Air Quality/Gas Sensor (CCS811) & Ambient Light Sensor (BH1750).
* **Autonomous Security:** Time-of-Flight Laser Sensor (VL53L0X).
