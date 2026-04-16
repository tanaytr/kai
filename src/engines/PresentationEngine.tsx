import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Hand, Menu, X, HelpCircle } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface PresentationEngineProps { onBack: () => void; }

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 14, style = {} }: { color: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: color,
      boxShadow: `inset -${Math.max(2, size / 6)}px -${Math.max(2, size / 6)}px 0 rgba(0,0,0,0.5), inset ${Math.max(2, size / 6)}px ${Math.max(2, size / 6)}px 0 rgba(255,255,255,0.3)`,
      border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0, ...style,
    }} />
  );
}

function TetrisRow({ count = 32, reversed = false }: { count?: number; reversed?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '6px 12px', justifyContent: reversed ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <TetrisBlock key={i} color={COLORS[i % 5]} size={16} style={{ opacity: 0.3 + (i % 3) * 0.2 }} />
      ))}
    </div>
  );
}

function GestureHUD({ state }: { state: GestureState | null }) {
  if (!state || state.type === 'none') return null;
  let label = 'TRACKING'; let color = '#06FFA5'; let icon = '✋';
  if (state.type === 'open')  { icon = '✋'; color = '#3A86FF'; label = 'OPEN PALM → NEXT SLIDE'; }
  else if (state.type === 'fist') { icon = '✊'; color = '#FF006E'; label = 'FIST → PREV SLIDE'; }
  return (
    <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.92)', border: `2px solid ${color}`, padding: '7px 18px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 0 14px ${color}55`, fontFamily: "'Press Start 2P', cursive", pointerEvents: 'none', minWidth: 220 }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <div style={{ fontSize: '0.45rem', color, letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

const SLIDES = [
  {
    title: 'PROJECT KAI',
    subtitle: 'Kinetic Artificial Intelligence — Your Presence, Extended',
    color: '#06FFA5',
    content: [
      'KAI is a compact, battery-powered robotic device built on an ESP32-S3 microcontroller for SVKM\'s NMIMS Indore',
      'Course: Microprocessors and Microcontrollers (702CO0C072) — Semester IV, Academic Year 2025-26',
      'Faculty: Dr. Nirmal K Gupta | Team: Tanay Trivedi (F061), Diksha Rathi (F118), Srishti Jain (F149)',
      'KAI monitors 5 environmental parameters and reacts through actuators and a round GC9A01 display face',
      'Submitted: April 12, 2026 — Department of Computer Engineering, School of Technology Management',
    ],
    detail: 'KAI stands apart from traditional IoT projects by communicating its state physically — moving its head, displaying expressions, and activating haptics — rather than just logging data to a cloud dashboard. The name "Kinetic Artificial Intelligence" reflects this embodied approach to sensor-actuator intelligence.',
  },
  {
    title: 'INTRODUCING KAI',
    subtitle: 'Representation & Physical Chassis',
    color: '#06FFA5',
    content: [
      'Visual overview of the KAI Kinetic Robot chassis and sensory visor.',
      'Designed for durability, compactness, and high-visibility social interaction.',
      'Note: The following image represents the industrial design intent.',
      'Integration of OLED/TFT facial expressions and ultrasonic visual field.',
    ],
    image: '/img.png',
    detail: 'For representational purposes only. The KAI chassis is designed to be modular, allowing for easy access to the ESP32-S3 core and the 5-sensor array. The rounded "head" houses the GC9A01 display face, giving KAI its distinctive expressive personality.',
  },
  {
    title: 'PROJECT MOTIVATION',
    subtitle: 'Bridging the Gap: Data to Presence',
    color: '#3A86FF',
    content: [
      'Raw sensor data (numbers on a screen) is often abstract and easy to ignore.',
      'Motivation: To create a device that "feels" its environment and reacts like a living entity.',
      'Goal: Shift from "Internet of Things" to "Robotic Companions" that are expressive and intuitive.',
      'Explores the intersection of embedded systems, social robotics, and human-computer interaction.',
      'KAI makes the invisible (gas levels, tilt, temperature) visible through kinetic movement.',
    ],
    detail: 'The core motivation was to move beyond the traditional "dashboard-only" IoT paradigm. By giving KAI a face and physical movement, we create a more immediate and emotional connection between the user and the environment. When KAI "flinches" at a gas spike, the urgency is felt physically, not just read numerically.',
  },
  {
    title: 'ABSTRACT & MOTIVATION',
    subtitle: 'Why Build a Robot That Feels Its Environment?',
    color: '#FFBE0B',
    content: [
      'Traditional IoT devices log data silently — KAI makes environmental awareness tangible and visible',
      'KAI reads 5 sensors every 100ms and updates its behavioral state machine in real-time',
      'Physical reactions (head tilt, display expression, vibration, buzzer) replace the need for a dashboard',
      'Demonstrates modern microcontroller capability: dual-core processing, cloud IoT, and multi-protocol communication',
      'Goal: an interactive device that communicates its state through gesture and expression — not just numbers',
    ],
    detail: 'The inspiration for KAI comes from social robotics research — the idea that a device becomes more useful and engaging when it reflects the world around it rather than merely recording it. A gas spike doesn\'t just log as "2501 ADC" — KAI flinches, sounds its buzzer, and its face turns alert red.',
  },
  {
    title: 'SYSTEM ARCHITECTURE',
    subtitle: 'Dual-Core ESP32-S3 Design',
    color: '#3A86FF',
    content: [
      'ESP32-S3 (Dual-core Xtensa LX7 @ 240MHz) — Core 0 and Core 1 run independently and simultaneously',
      'Core 0: WiFi stack + Blynk cloud communication — handles all network I/O without blocking sensors',
      'Core 1: Real-time sensor reading every 100ms + state machine evaluation + actuator control',
      'Dual-core architecture prevents network latency from affecting sensor response time',
      'Non-blocking execution via hardware timers and a state machine — no delay() calls in final firmware',
    ],
    detail: 'The dual-core assignment is a deliberate design decision: network operations (WiFi, Blynk API calls) can stall for hundreds of milliseconds. By pinning them to Core 0, Core 1 remains deterministic — sensor reads and actuator commands always execute within the 100ms window regardless of cloud latency.',
  },
  {
    title: 'HARDWARE: KEY COMPONENTS',
    subtitle: 'Controller, Sensors, Actuators & Power',
    color: '#FF006E',
    content: [
      'Controller: ESP32-S3 (Dual-core 240MHz, built-in WiFi/BT, 512KB SRAM, 8MB Flash)',
      'Sensors: HC-SR04 (Ultrasonic Distance), MPU6050 (6-Axis IMU), BME280 (Temp/Humidity/Pressure), MQ-2 (Gas), LDR (Light)',
      'Actuators: GC9A01 Round TFT (1.28" face), MG90S Servo (head tilt), Dual N20 Motors via L298N (drive), Vibration Motors, Piezo Buzzer, 5V Relay',
      'Power: 2× 18650 Li-ion cells (7.4V) stepped down via LD33CV (3.3V) and L298N (motor power)',
      'Connectivity: WiFi to Blynk IoT cloud + AI API for remote monitoring and manual control',
    ],
    detail: 'The component selection was optimized for cost, availability, and protocol diversity. The BME280 uses I2C (teaching bus communication), the GC9A01 uses SPI (teaching high-speed serial), and the HC-SR04 uses direct GPIO triggering — exposing students to three distinct communication paradigms on a single device.',
  },
  {
    title: 'SENSORS DEEP DIVE',
    subtitle: 'Five Environmental Inputs to KAI\'s Brain',
    color: '#8338EC',
    content: [
      'HC-SR04 Ultrasonic (GPIO 5 Trig, GPIO 18 Echo, 5V): distance 2–400cm, ±1cm accuracy — detects human presence',
      'MPU6050 6-Axis IMU (I2C: SDA GPIO 21, SCL GPIO 22): 3-axis gyro + 3-axis accel — detects tilt, shake, orientation',
      'BME280 Environmental (I2C shared bus): temperature 26–31°C range tested, humidity, barometric pressure',
      'MQ-2 Gas Sensor (Analog GPIO 34): detects LPG, propane, hydrogen — threshold 2500 ADC counts = Alert',
      'LDR Light Sensor (GPIO 35, analog): ambient light level for Drowsy state detection in dark environments',
    ],
    detail: 'The sensors collectively give KAI a "sensory nervous system." The HC-SR04 is KAI\'s eyes (30cm threshold = "Engaged"), the MQ-2 is KAI\'s nose ("Forensic Nose" in the schematic), the BME280 is its skin sensing the atmosphere, the MPU6050 tells it when it\'s been physically touched or moved, and the LDR tells it whether to dim for sleep.',
  },
  {
    title: 'ACTUATORS & OUTPUT',
    subtitle: 'How KAI Expresses Itself',
    color: '#00D4FF',
    content: [
      'GC9A01 Round TFT (SPI, 1.28" 240×240px): draws animated face expressions — eyes wide (Engaged), drooped (Drowsy), narrow (Alert)',
      'MG90S Micro Servo (PWM GPIO 4): controls head tilt angle for physical nodding and directional attention',
      'Dual N20 Geared Motors via L298N (GPIO 12/13 PWM): differential drive for autonomous and Blynk-controlled movement',
      'Dual Vibration Motors (GPIO 2, GPIO 27 via transistor): haptic feedback array — short pulses for states',
      'Piezo Buzzer (GPIO 25): audio alerts for gas detection (Alert state) and proximity events',
    ],
    detail: 'The GC9A01 is the most visually distinctive component — a circular display that renders KAI\'s "face" using the TFT_eSPI library. The face changes in real-time based on state. Combined with the MG90S head tilt, KAI achieves a surprisingly emotive physical presence — nodding toward a detected person, drooping when drowsy, stiffening when gas is detected.',
  },
  {
    title: 'POWER SYSTEM',
    subtitle: '7.4V Li-ion with Dual Regulation',
    color: '#FF8800',
    content: [
      '2× 18650 Li-ion cells in series: 7.4V nominal, sufficient capacity for multi-hour operation',
      'LD33CV Linear Regulator: steps 7.4V → 3.3V for ESP32-S3 and logic-level components (BME280, MPU6050)',
      'L298N H-Bridge Dual Function: acts as both motor driver AND 5V regulated output for HC-SR04 (5V sensor)',
      '5V Single-Channel Relay Module: controls high-current external circuits safely (GPIO 26)',
      'Nylon braided cable sleeving keeps power runs organized and prevents shorts in the compact chassis',
    ],
    detail: 'The dual-regulation approach is pragmatic: the LD33CV is a simple, cheap linear regulator that provides clean 3.3V for sensitive I2C/SPI sensors. The L298N\'s built-in 5V output (from its onboard regulator) conveniently powers the 5V components like HC-SR04 and relay, reducing the total component count while teaching students about voltage regulation.',
  },
  {
    title: 'COMMUNICATION PROTOCOLS',
    subtitle: 'I²C, SPI, GPIO & WiFi in One Device',
    color: '#CC44FF',
    content: [
      'I²C Bus (SDA GPIO 21, SCL GPIO 22): BME280 + MPU6050 share the same two-wire bus with unique addresses',
      'SPI Bus: GC9A01 TFT display — high-speed serial for pixel pushing (up to 80MHz on ESP32-S3)',
      'Direct GPIO: HC-SR04 trigger/echo, MQ-2 analog, LDR analog, relay, servo PWM, motor PWM, haptics',
      'Serial/I2C: ESP32-CAM (Vision module) communicates via Serial/I2C for vision pipeline integration',
      'WiFi: ESP32-S3 built-in connects to Blynk IoT cloud + AI API (Blynk App joystick, V-pin data streaming)',
    ],
    detail: 'Using I2C for environmental sensors elegantly solves bus contention — the ESP32-S3 polls BME280 then MPU6050 sequentially on the same two wires. SPI for the display is essential: pushing 240×240px at 30fps requires bandwidth that I2C cannot provide. This protocol diversity makes KAI an ideal teaching device for the Microprocessors course.',
  },
  {
    title: 'FIRMWARE ARCHITECTURE',
    subtitle: 'State Machine + Hardware Timers + Arduino C++',
    color: '#44FFAA',
    content: [
      'Written in C++ using the Arduino framework — compiled with ESP-IDF toolchain via PlatformIO',
      'Hardware timers for non-blocking execution: sensor polling every 100ms, display refresh every 50ms',
      'State machine with 4 states: Idle, Engaged, Alert, Drowsy — evaluated on every sensor cycle',
      'Task pinning: WiFi/Blynk task pinned to Core 0 (xTaskCreatePinnedToCore), sensor loop on Core 1',
      'No blocking delay() in main loops — uses millis()-based timing throughout for deterministic behavior',
    ],
    detail: 'The firmware design follows embedded systems best practices: the state machine is a single evaluate() function that takes all sensor readings as input and returns a State enum. This makes it trivially testable and readable. The hardware timer approach (as opposed to RTOS tick-based) ensures the 100ms sensor window is hardware-guaranteed, not software-approximate.',
  },
  {
    title: 'SOFTWARE LIBRARIES',
    subtitle: 'The Firmware Stack',
    color: '#FF006E',
    content: [
      'TFT_eSPI: SPI display driver for ESP32 — handles GC9A01 round display, custom font rendering, sprite buffering',
      'BlynkSimpleEsp32: WiFi-based IoT communication with Blynk cloud for remote monitoring and control',
      'Adafruit_BME280: I2C driver for BME280 environmental sensor — temperature, humidity, pressure readings',
      'MPU6050 (I2CDevLib): 6-axis IMU driver with DMP (Digital Motion Processor) for stable orientation data',
      'ESP32Servo: PWM-based servo control library optimized for ESP32 timer hardware — controls MG90S',
    ],
    detail: 'Library selection balanced capability with simplicity. TFT_eSPI was chosen over Adafruit GFX for its ESP32-optimized DMA transfers, which allow the display to update without blocking Core 1. The Blynk library abstracts all MQTT/WebSocket complexity into simple virtualWrite() calls, letting the firmware focus on sensor logic.',
  },
  {
    title: 'BEHAVIORAL MODES',
    subtitle: 'Autonomous State Machine',
    color: '#06FFA5',
    content: [
      'IDLE: Default state — face neutral, servo centered, no motion — all thresholds below trigger level',
      'ENGAGED: Distance < 30cm (HC-SR04 detects person) — face brightens, servo nods forward, motors spin softly',
      'ALERT: Gas > 2500 ADC counts (MQ-2 detects smoke/gas) — face turns red, buzzer sounds, vibration fires repeatedly',
      'DROWSY: LDR below darkness threshold — face droops, servo tilts down, display dims, activity slows',
      'State evaluation every 100ms — transitions immediate, behavioral response < 600ms total (measured in testing)',
    ],
    detail: 'The 4-state machine is a priority system: Alert overrides all other states (safety first). Engaged overrides Idle and Drowsy (presence takes priority over environment). Drowsy only activates when no human is present and ambient light is low. This priority ordering makes KAI\'s behavior predictable and safe — it will always alert on gas even if someone is present and it\'s dark.',
  },
  {
    title: 'MANUAL MODE — BLYNK',
    subtitle: 'Remote Control via IoT',
    color: '#FFBE0B',
    content: [
      'Manual Mode triggered by Blynk app V-pin toggle — Core 0 receives command, passes flag to Core 1',
      'Joystick control: Blynk joystick widget streams X/Y values → mapped to differential motor speeds via L298N',
      'Relay control: Blynk button widget toggles 5V relay (GPIO 26) for external circuit switching remotely',
      'Telemetry streaming: all 5 sensor readings + current state sent to Blynk dashboard every 500ms',
      'AI API integration: Blynk widget triggers Blynk AI API for natural language interaction with KAI\'s sensor data',
    ],
    detail: 'Manual mode is implemented as a clean state overlay: when the Blynk manual flag is set, Core 1 skips the state machine evaluation and directly maps Blynk joystick values to motor commands. This prevents the autonomous behavior from fighting the user\'s manual inputs — a lesson in mutex-free state design for embedded systems.',
  },
  {
    title: 'TESTING & RESULTS',
    subtitle: 'Measured Performance from Physical Testing',
    color: '#3A86FF',
    content: [
      'HC-SR04 distance accuracy: ±1cm across the tested 0–200cm range — meets datasheet specification',
      'BME280 temperature readings: 26–31°C range logged during lab testing — stable and consistent',
      'Behavioral response time: < 600ms from sensor threshold crossing to full physical response (measured)',
      'WiFi/Blynk latency: 200–800ms round-trip depending on network conditions — acceptable for manual control',
      'Continuous runtime: stable operation over test sessions without watchdog resets or memory leaks',
    ],
    detail: 'The <600ms behavioral response time is the most important metric — it means KAI feels reactive rather than laggy. This was achieved specifically because of the Core 1 isolation: the sensor read → state evaluate → actuator command loop runs at 100ms intervals independent of whatever Core 0 is doing with WiFi. The bottleneck is the servo\'s physical settling time (~200ms), not software.',
  },
  {
    title: 'FUTURE SCOPE',
    subtitle: 'Phase 2 and 3 Enhancements',
    color: '#CC44FF',
    content: [
      'OV2640 Camera Module: add computer vision for face detection and person tracking — feeds into Engaged state',
      'TensorFlow Lite on ESP32-S3: gesture recognition from OV2640 — KAI responds to hand waves without touching',
      'LoRa Module: extended-range communication beyond WiFi — mesh network of multiple KAI units',
      'DRV8833 Motor Driver: replace L298N for higher efficiency dual H-bridge, lower heat, smaller footprint',
      'Voice synthesis: I2S speaker + TTS library for KAI to verbally announce its state ("Gas detected!")',
    ],
    detail: 'The ESP32-S3 was chosen specifically for its PSRAM (8MB) and its ability to run TensorFlow Lite Micro models. The camera + TFLite combination would enable on-device face detection without cloud round-trips — making KAI truly autonomous. LoRa extends KAI from a room gadget to a campus-wide sensor network.',
  },
  {
    title: 'CONCLUSION',
    subtitle: 'KAI — A Living Microcontroller Textbook',
    color: '#06FFA5',
    content: [
      'KAI successfully demonstrates ESP32-S3 dual-core architecture, multi-protocol communication, and real-time control',
      'Integrates I2C, SPI, analog ADC, PWM, GPIO, WiFi — covering all major microcontroller interface types',
      'State machine design + hardware timers + Core isolation = professional-grade embedded firmware structure',
      'Physical, expressive output makes sensor data instantly understandable — a human-computer interaction lesson',
      'Codebase and hardware design structured for extensibility — Phase 2 additions require no architectural changes',
    ],
    detail: 'KAI is not just a course project — it is a reference implementation of modern embedded systems design. Every design decision has a pedagogical justification: why dual-core? (determinism), why I2C for sensors? (bus efficiency), why state machine? (clarity and safety). Future students can learn from KAI\'s codebase as much as from building it. SVKM\'S NMIMS Indore — 702CO0C072 — April 2026.',
  },
  {
    title: 'REFERENCES',
    subtitle: 'Data Sources & Documentation Used',
    color: '#FFBE0B',
    content: [
      '① ESP32-S3 Technical Reference Manual — Espressif Systems, 2023 (docs.espressif.com)',
      '② TFT_eSPI Library — Bodmer, GitHub (github.com/Bodmer/TFT_eSPI)',
      '③ Blynk IoT Documentation — Blynk Inc. 2024 (docs.blynk.io)',
      '④ Adafruit BME280 Library — Adafruit Industries (github.com/adafruit/Adafruit_BME280_Library)',
      '⑤ GC9A01 Round Display Datasheet — Waveshare Electronics, 2022',
    ],
    detail: 'Additional references: ⑥ MPU6050 Product Specification — InvenSense Inc. ⑦ HC-SR04 Ultrasonic Sensor Datasheet ⑧ L298N Dual Full-Bridge Driver Datasheet — STMicroelectronics ⑨ MQ-2 Gas Sensor Technical Data — Hanwei Electronics ⑩ Arduino ESP32 Core Documentation — github.com/espressif/arduino-esp32. Project report submitted April 12, 2026.',
  },
];

export default function PresentationEngine({ onBack }: PresentationEngineProps) {
  const [currentSlide, setCurrentSlide]     = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureState, setGestureState]     = useState<GestureState | null>(null);
  const [showHelp, setShowHelp]             = useState(false);
  const [showIndex, setShowIndex]           = useState(false);
  const [colorIndex, setColorIndex]         = useState(0);
  const [transitioning, setTransitioning]   = useState(false);

  const currentSlideRef = useRef(0);
  const transitionRef   = useRef(false);

  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);
  useEffect(() => { transitionRef.current   = transitioning; }, [transitioning]);

  useEffect(() => {
    const t = setInterval(() => setColorIndex(c => (c + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  const navigate = useCallback((dir: number) => {
    if (transitionRef.current) return;
    const cur  = currentSlideRef.current;
    const next = Math.max(0, Math.min(SLIDES.length - 1, cur + dir));
    if (next === cur) return;
    transitionRef.current = true;
    setTransitioning(true);
    musicEngine.playSfx(700);
    setTimeout(() => {
      setCurrentSlide(next);
      currentSlideRef.current = next;
      setTransitioning(false);
      transitionRef.current = false;
    }, 220);
  }, []);

  const goTo = useCallback((idx: number) => {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    musicEngine.playSfx(700);
    setTimeout(() => {
      setCurrentSlide(idx);
      currentSlideRef.current = idx;
      setTransitioning(false);
      transitionRef.current = false;
    }, 220);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'Escape')     { if (showIndex) setShowIndex(false); else onBack(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, showIndex, onBack]);

  const handleGesture = useCallback((gesture: GestureState) => {
    setGestureState(gesture);
    if (gesture.type === 'open') navigate(1);
    else if (gesture.type === 'fist') navigate(-1);
    else if (gesture.type === 'index') {
      if (gesture.direction === 'left') navigate(1);
      else if (gesture.direction === 'right') navigate(-1);
    }
  }, [navigate]);

  useEffect(() => {
    if (gestureEnabled) {
      gestureController.subscribe(handleGesture);
      return () => gestureController.unsubscribe(handleGesture);
    } else { setGestureState(null); }
  }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) { gestureController.stop(); setGestureEnabled(false); musicEngine.playSfx(400); return; }
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera API unavailable.'); return; }
    try {
      const ok = await gestureController.init();
      if (ok) { setGestureEnabled(true); musicEngine.playSfx(900); }
      else alert('Gesture engine failed to start.');
    } catch (err) { alert(`Gesture error:\n${err}`); }
  };

  const slide    = SLIDES[currentSlide];
  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
      <TetrisRow count={36} />

      {/* Top bar */}
      <div style={{ padding: '8px 20px', borderBottom: `3px solid ${COLORS[colorIndex]}`, background: 'rgba(10,10,20,0.70)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 4px 20px ${COLORS[colorIndex]}33` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: 'rgba(0,0,0,0.7)', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={11} /> EXIT
          </button>
          <button onClick={() => { setShowIndex(v => !v); musicEngine.playSfx(600); }} style={{ background: showIndex ? 'rgba(131,56,236,0.3)' : 'rgba(0,0,0,0.5)', border: `2px solid ${showIndex ? '#8338EC' : '#555'}`, color: showIndex ? '#8338EC' : '#888', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Menu size={14} />
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.7rem', color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}>PROJECT KAI — REPORT</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.6rem' }}>{currentSlide + 1} / {SLIDES.length} · {slide.subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleGesture} style={{ background: gestureEnabled ? 'rgba(6,255,165,0.2)' : 'rgba(0,0,0,0.5)', border: `2px solid ${gestureEnabled ? '#06FFA5' : '#555'}`, color: gestureEnabled ? '#06FFA5' : '#666', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Hand size={14} />
          </button>
          <button onClick={() => { setShowHelp(v => !v); musicEngine.playSfx(600); }} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : 'rgba(0,0,0,0.5)', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#666', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, #8338EC, ${slide.color})`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Index overlay */}
      {showIndex && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(5,5,15,0.97)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={32} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #8338EC' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.7rem' }}>KAI REPORT — CONTENTS</div>
            <button onClick={() => setShowIndex(false)} style={{ background: 'none', border: '2px solid #8338EC', color: '#8338EC', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {SLIDES.map((sl, i) => (
                <button key={i} onClick={() => { goTo(i); setShowIndex(false); }} style={{ background: i === currentSlide ? `${sl.color}22` : 'rgba(0,0,0,0.5)', border: `2px solid ${i === currentSlide ? sl.color : sl.color + '44'}`, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: sl.color, fontSize: '0.5rem', marginBottom: 4 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: i === currentSlide ? '#fff' : '#ccc', fontSize: '0.7rem' }}>{sl.title}</div>
                </button>
              ))}
            </div>
          </div>
          <TetrisRow count={32} reversed />
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(5,5,15,0.97)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={32} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>HOW TO USE</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { color: '#06FFA5', title: 'KEYBOARD NAV',    body: '← → arrow keys navigate slides. Escape closes overlays.' },
                { color: '#3A86FF', title: 'BUTTONS',         body: 'Chevron buttons on sides, or dot indicators below slide content.' },
                { color: '#3A86FF', title: '✋ OPEN PALM',    body: 'Enable hand button. Full open palm → next slide (edge-triggered with cooldown).' },
                { color: '#FF006E', title: '✊ FIST',         body: 'Closed fist → previous slide. Works from all angles.' },
                { color: '#FFBE0B', title: 'SLIDE INDEX',     body: '☰ button opens full slide list. Click any slide to jump directly.' },
              ].map((sec, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${sec.color}44`, borderLeft: `4px solid ${sec.color}`, padding: '12px 16px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: sec.color, fontSize: '0.5rem', marginBottom: 6 }}>{sec.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.78rem', lineHeight: 1.7 }}>{sec.body}</div>
                </div>
              ))}
            </div>
          </div>
          <TetrisRow count={32} reversed />
        </div>
      )}

      {/* Main slide content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 60px', overflow: 'auto', opacity: transitioning ? 0 : 1, transform: transitioning ? 'scale(0.97)' : 'scale(1)', transition: 'opacity 0.22s, transform 0.22s' }}>
        <div style={{ maxWidth: 900, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '2.5rem', color: slide.color, opacity: 0.3, lineHeight: 1, flexShrink: 0 }}>{String(currentSlide + 1).padStart(2, '0')}</div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.8rem, 2vw, 1.3rem)', color: slide.color, textShadow: `0 0 15px ${slide.color}88`, marginBottom: 6, letterSpacing: '2px' }}>{slide.title}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.85rem' }}>{slide.subtitle}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', border: `3px solid ${slide.color}`, boxShadow: `0 0 30px ${slide.color}22`, padding: '28px 32px', position: 'relative', marginBottom: 16 }}>
            {[{ top: -6, left: -6 }, { top: -6, right: -6 }, { bottom: -6, left: -6 }, { bottom: -6, right: -6 }].map((pos, i) => (
              <div key={i} style={{ position: 'absolute', width: 12, height: 12, background: slide.color, ...pos }} />
            ))}
            
            {/* Conditional Image for Introducing KAI */}
            {(slide as any).image && (
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <img src={(slide as any).image} alt="KAI" style={{ maxWidth: '100%', maxHeight: '400px', border: `2px solid ${slide.color}`, borderRadius: '8px', boxShadow: `0 0 20px ${slide.color}44` }} />
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: '#888', marginTop: 8 }}>For representational purposes only</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {slide.content.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 8, height: 8, background: slide.color, boxShadow: `0 0 6px ${slide.color}`, flexShrink: 0, marginTop: 7 }} />
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.65rem, 1.1vw, 0.88rem)', color: '#e0e0f0', lineHeight: 1.8 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: `${slide.color}0d`, backdropFilter: 'blur(4px)', border: `1px solid ${slide.color}44`, padding: '14px 18px' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: slide.color, marginBottom: 8, letterSpacing: 2 }}>DEEP DIVE</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#aaa', lineHeight: 1.75 }}>{slide.detail}</div>
            {currentSlide === SLIDES.length - 1 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', background: 'rgba(0,0,0,0.7)', border: '3px solid #06FFA5', color: '#06FFA5', padding: '12px 24px', cursor: 'pointer', letterSpacing: 1, boxShadow: '0 0 20px rgba(6,255,165,0.3)' }}>RETURN TO EXPLORE (HOME)</button>
              </div>
            )}
          </div>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {SLIDES.map((_sl, i) => (
              <button key={i} onClick={() => goTo(i)} style={{ width: i === currentSlide ? 20 : 7, height: 7, background: i === currentSlide ? slide.color : i < currentSlide ? '#8338EC' : '#2a2a4a', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Chevrons */}
      <button onClick={() => navigate(-1)} disabled={currentSlide === 0} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 44, height: 70, background: currentSlide === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.75)', border: `2px solid ${currentSlide === 0 ? '#222' : '#8338EC'}`, color: currentSlide === 0 ? '#333' : '#8338EC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === 0 ? 'default' : 'pointer', opacity: currentSlide === 0 ? 0.3 : 1, zIndex: 20 }}>
        <ChevronLeft size={20} />
      </button>
      <button onClick={() => navigate(1)} disabled={currentSlide === SLIDES.length - 1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 44, height: 70, background: currentSlide === SLIDES.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.75)', border: `2px solid ${currentSlide === SLIDES.length - 1 ? '#222' : '#06FFA5'}`, color: currentSlide === SLIDES.length - 1 ? '#333' : '#06FFA5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === SLIDES.length - 1 ? 'default' : 'pointer', opacity: currentSlide === SLIDES.length - 1 ? 0.3 : 1, zIndex: 20 }}>
        <ChevronRight size={20} />
      </button>

      {gestureEnabled && <GestureHUD state={gestureState} />}
      <TetrisRow count={36} reversed />
    </div>
  );
}
