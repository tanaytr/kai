# Project KAI: Technical Glossary & What-is-What

This document explains every hardware component and software concept used in Project KAI for Viva preparation.

---

## 🧠 THE BRAIN: ESP32 (Microcontroller)
The **ESP32** is the central nervous system.
- **Dual-Core**: Unlike simple Arduinos, the ESP32 has two brains (Core 0 and Core 1).
  - **Core 0**: Handles the Internet, WiFi, and Blynk App connection.
  - **Core 1**: Handles the sensors, motors, and screen animations.
  - **Why?** This prevents the robot from "freezing" when the internet is slow.
- **Microprocessor vs Microcontroller**: The ESP32 is a *microcontroller* because it has its CPU, RAM, and Storage on one tiny chip, designed for specific tasks.

---

## 👁️ THE SENSORS (Input)
Sensors tell KAI about the world.

1.  **HC-SR04 (Ultrasonic "Eyes")**:
    - **How it works**: It sends out a high-pitched sound (ultrasound) that humans can't hear. The sound bounces off objects and comes back.
    - **Function**: KAI measures how long the sound took to return to calculate distance. "Bat Sonar" in robot form.
2.  **MPU6050 (Motion/Gyro Sensor)**:
    - **How it works**: It uses internal micro-mechanical parts to detect tilt and rotation.
    - **Function**: Detects if KAI has been picked up, tilted, or shaken.
3.  **BME280 (Weather Sensor)**:
    - **How it works**: It has silicon-based sensing elements for air pressure, humidity, and temperature.
    - **Function**: Monitors the room's atmosphere for climate safety.
4.  **MQ-2 (Gas/Smoke Sniffer)**:
    - **How it works**: It has a heated heating element that reacts chemically when flammable gas (LPG, Smoke) passes through a mesh.
    - **Function**: Triggers the "ALERT" state if smoke is detected.
5.  **LDR (Light Dependent Resistor)**:
    - **How it works**: Its electrical resistance changes based on how much light hits it.
    - **Function**: Detects if the room is dark to put KAI into "DROWSY" (Sleep) mode.

---

## 🦾 THE ACTUATORS (Output)
Actuators allow KAI to "react" physically.

1.  **GC9A01 (Circular TFT Screen)**:
    - **Function**: KAI's face. It uses the SPI protocol to draw animated eyes and expressions at high speed.
2.  **MG90S Servo (Head Motor)**:
    - **Function**: Controls the physical tilting of the head. It uses **PWM** (Pulse Width Modulation) — a way of telling the motor an exact angle (0° to 180°).
3.  **N20 Geared Motors (Wheel Drive)**:
    - **Function**: High-torque mini motors that allow KAI to roll. Geared down for precision and power.
4.  **L298N (Motor Driver)**:
    - **Function**: Bridges the gap between the weak brain (ESP32) and the strong batteries. It allows the ESP32 to spin the wheels.
5.  **5V Relay Module**:
    - **Function**: An electromagnetic switch that allows KAI to control high-power external devices (like a cooling fan or a bigger lamp) safely. It fulfills the "Control Actuator" cloud requirement.
6.  **Piezo Buzzer**:
    - **Function**: The alarm speaker. It sounds whenever the MQ-2 sensor detects gas.

---

## 🛠️ THE LOGIC (Software)
- **State Machine**: A logic loop with 4 moods: **IDLE**, **ENGAGED** (saw a person), **ALERT** (Gas detected), and **DROWSY** (Darkness).
- **I2C & SPI**: The "Data Languages" used by the sensors and screen to talk to the ESP32.
  - **I2C**: Like a two-wire highway for slow sensors (BME280).
  - **SPI**: Like a high-speed multi-lane highway for the face screen (GC9A01).

---

## 🚀 "EASIFICATION" PLAN (For Phase 1 / Prototype)
If the project feels too complex, follow this "Dumbed Down" architecture while keeping every part used:

1.  **Software Simplified**:
    - **Single Core**: Run everything in the standard `void setup()` and `void loop()` instead of task pinning.
    - **Sequential Logic**: Instead of a "State Machine," use simple `if/else` statements:
      - `if(gas > threshold) { alarm(); } else if (dist < 30) { headNod(); }`
2.  **Connectivity Simplified**:
    - **Offline Mode**: Skip the WiFi/Blynk setup initially. Make the robot 100% autonomous. This removes 40% of the code complexity.
3.  **Screen Simplified**:
    - Use static images or text labels on the circular screen instead of complex procedural eye animations. Use the `Adafruit_GFX` library functions (`drawCircle`, `printText`) for speed.
4.  **Hardware "Modular" Wiring**:
    - Use a **General Purpose PCB** (Zero Board) instead of breadboards. Solder "female headers" for every sensor so you can plug them in and out for testing without worrying about loose jumper wires.

---

## ☁️ CLOUD WORKFLOW (The "Blynk" Solution)
For the Viva requirement of "Cloud Based Workflow" (Data logging + Control):

1.  **Data Logging**: In the Blynk App, create a **SuperChart** widget. Direct the ESP32 to push sensor data (Temp, Gas, Distance) every 5 seconds. This creates a cloud-based history of KAI's environment.
2.  **Remote Control**: Add a **Button Widget** in the Blynk App. When pressed, it sends a signal to the ESP32 to flip the **5V Relay** or tilt the **Servo**. This fulfills the "Control Actuator from Cloud" requirement.
3.  **Real-time Alerts**: Use the Blynk **Notification** widget to send a push notification to your phone whenever the MQ-2 sensor detects smoke.
