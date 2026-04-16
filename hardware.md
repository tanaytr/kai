# Project KAI: Hardware Specifications & Viva Guide

This document provides a comprehensive breakdown of the hardware components used in the KAI (Kinetic Artificial Intelligence) engine, their specific roles, and a preparation guide for technical Viva examinations.

## 1. Hardware Component List

| Component | Purpose / Action | Interface |
|:---|:---|:---|
| **ESP32-S3 WROOM-1** | Master MCU. Handles dual-core processing: Core 0 for WiFi/Cloud, Core 1 for real-time sensor loops. | N/A |
| **GC9A01 TFT Display** | KAI's 1.28" round face. Renders ocular expressions and status animations. | SPI (80MHz) |
| **HC-SR04 Ultrasonic** | Object detection and distance measurement (2cm–400cm). Triggers "Engaged" state. | Digital (Trig/Echo) |
| **MPU6050 IMU** | 6-Axis Motion Tracking. Detects tilt, shake, and orientation for balance telemetry. | I2C (0x68) |
| **BME280 Sensor** | Environmental telemetry: Temperature, Humidity, and Barometric Pressure. | I2C (0x76) |
| **MQ-2 Gas Sensor** | Smoke and LPG detection. Triggers "Alert" state and haptic/audio warnings. | Analog (ADC) |
| **LDR (Photoresistor)** | Ambient light sensing. Adjusts KAI's "Drowsy" state in dark environments. | Analog (ADC) |
| **MG90S Micro Servo** | Controls the neck mechanism for physical head-tilt expressions. | PWM (Hardware) |
| **L298N Motor Driver** | Dual H-bridge driver. Bridges low-power logic to high-power DC motors. | PWM / Digital |
| **N20 Geared Motors** | High-torque locomotion at 6V. Enables differential drive steering. | DC Power |
| **Piezo Buzzer** | Audio feedback system for alerts and interaction confirmation. | PWM (Tones) |
| **Vibration Motors** | Tactical haptic feedback for user interaction and system alerts. | Digital (NPN) |
| **18650 Li-ion Pack** | 7.4V Power source. Provides high capacity for long-duration operation. | DC Power |
| **LD33CV Regulator** | LDO Regulator. Steps 7.4V down to a stable 3.3V for sensitive logic components. | Voltage Reg. |
| **5V Relay Module** | Opto-isolated switch for controlling external high-voltage AC/DC loads. | Digital |

---

## 2. Technical Viva Questions & Answers

### Q1: Why was the ESP32-S3 chosen over a standard Arduino Uno?
**A:** The ESP32-S3 provides a dual-core Xtensa® 32-bit LX7 architecture running at 240MHz, which is far superior to Arduino's 16MHz. It also includes integrated WiFi and Bluetooth (essential for the Blynk IoT interface) and has native support for AI instructions and internal hall effects sensors.

### Q2: How does the project handle multiple I2C sensors on a single bus?
**A:** The MPU6050 and BME280 share the same I2C SDA (GPIO 21) and SCL (GPIO 22) pins. They are distinguished by their unique hardware addresses: `0x68` for the MPU6050 and `0x76` for the BME280. The Master (ESP32) communicates with them sequentially.

### Q3: Explain the term "Differential Drive" in KAI’s locomotion.
**A:** KAI uses two independent motors. To move forward, both spin at the same speed. To turn, the speeds are varied (e.g., stopping the left wheel while the right continues results in a left pivot). This eliminates the need for a complex steering rack.

### Q4: What is the role of the LD33CV and why is it necessary?
**A:** The 18650 battery pack supplies ~7.4V, which would fry the ESP32 (rated for 3.3V). The LD33CV treats the voltage down to a steady 3.3V, ensuring clean power for the logic circuits, while the L298N takes the raw 7.4V directly to power the motors.

### Q5: How are the face expressions rendered on the round display?
**A:** We use the `TFT_eSPI` library. Expressions are generated as procedural graphics (circles/arcs) in the buffer and pushed to the GC9A01 controller via a high-speed SPI bus (80MHz) to ensure smooth, high-frame-rate ocular movement.

### Q6: How does the Gas Sensor (MQ-2) trigger an alert?
**A:** The MQ-2 provides an analog voltage proportional to the concentration of gas. The ESP32 reads this via its 12-bit ADC. If the value exceeds a pre-defined software threshold (e.g., 2500), the MCU interrupts the idle loop to trigger the buzzer, red LEDs, and cloud pushes.

### Q7: What is the purpose of the 5V Relay in this project?
**A:** Since the ESP32 can only output low current, it cannot drive things like a room fan or large light strips directly. The relay uses an opto-isolator to safely switch a secondary high-power circuit using the ESP32’s low-power signal.

---

> [!TIP]
> **Pro-Tip for Viva**: If asked about concurrency, mention that the **Dual-Core** architecture is used specifically to ensure that heavy WiFi processing (Core 0) doesn't introduce "jitter" into the critical sensor-reading and motor-control loops (Core 1).
