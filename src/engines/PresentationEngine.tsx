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
      'KAI is a compact, battery-powered robotic device built on an ESP32 (The main brain or processor) motor for SVKM\'s NMIMS Indore',
      'Course: Microprocessors and Microcontrollers (702CO0C072) — Semester IV, Academic Year 2025-26',
      'Faculty: Dr. Nirmal K Gupta | Team: Tanay Trivedi (F061), Diksha Rathi (F118), Srishti Jain (F149)',
      'KAI monitors 5 environmental parameters and reacts through actuators (Moving parts) and a round GC9A01 (Round display face) display face',
      'Submitted: April 12, 2026 — Department of Computer Engineering, School of Technology Management',
    ],
    detail: 'KAI stands apart from traditional IoT projects by communicating its state physically — moving its head, displaying expressions, and activating haptics (Vibration feedback) — rather than just logging data to a cloud dashboard. The name "Kinetic Artificial Intelligence" reflects this embodied approach to sensor-actuator intelligence.',
  },
  {
    title: 'PROJECT MOTIVATION',
    subtitle: 'Bridging the Gap: Data to Presence',
    color: '#3A86FF',
    content: [
      'Raw sensor data (numbers on a screen) is often abstract and easy to ignore.',
      'Motivation: To create a device that "feels" its environment and reacts like a living entity.',
      'Goal: Shift from "Internet of Things" (Devices talking to the cloud) to "Robotic Companions" that are expressive and intuitive.',
      'Explores the intersection of embedded systems, social robotics, and human-computer interaction.',
      'KAI makes the invisible (gas levels, tilt, temperature) visible through kinetic (Physical) movement.',
    ],
    detail: 'The core motivation was to move beyond the traditional "dashboard-only" IoT (Internet of Things) paradigm. By giving KAI a face and physical movement, we create a more immediate and emotional connection between the user and the environment. When KAI "flinches" at a gas spike, the urgency is felt physically, not just read numerically.',
  },
  {
    title: 'ABSTRACT & MOTIVATION',
    subtitle: 'Why Build a Robot That Feels Its Environment?',
    color: '#FFBE0B',
    content: [
      'Traditional IoT (Internet of Things) devices log data silently — KAI makes environmental awareness tangible and visible',
      'KAI reads 5 sensors every 100ms (Milliseconds) and updates its behavioral state machine in real-time',
      'Physical reactions (head tilt, display expression, vibration, buzzer) replace the need for a dashboard',
      'Demonstrates modern microcontroller capability: dual-core processing, cloud IoT, and multi-protocol communication',
      'Goal: an interactive device that communicates its state through gesture and expression — not just numbers',
    ],
    detail: 'The inspiration for KAI comes from social robotics research — the idea that a device becomes more useful and engaging when it reflects the world around it rather than merely recording it. A gas spike doesn\'t just log as "2501 ADC" (Analog sensor value) — KAI flinches, sounds its Piezo Buzzer (Alarm speaker), and its face turns alert red.',
  },
  {
    title: 'SYSTEM ARCHITECTURE',
    subtitle: 'Dual-Core ESP32 Design',
    color: '#3A86FF',
    content: [
      'ESP32 (Dual-core brain chips) — Core 0 and Core 1 run independently and simultaneously',
      'Core 0: WiFi stack + Blynk (Phone control app) cloud communication — handles all network I/O without blocking sensors',
      'Core 1: Real-time sensor reading every 100ms + state machine evaluation + actuator (Physical output) control',
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
      'Controller: ESP32 (Powerful dual-core 240MHz brain, with built-in WiFi/Bluetooth)',
      'Sensors: HC-SR04 (Ultrasonic distance radar), MPU6050 (Motion and tilt sensor), BME280 (Weather/Atmosphere sensor), MQ-2 (Smoke and gas sniffer), LDR (Room light sensor)',
      'Actuators: GC9A01 (Circular face display), MG90S (Tiny head-tilt motor), N20 Motors (Wheel drive units) via L298N (High-power motor controller), Vibration Motors, Piezo Buzzer, 5V Relay (On/Off switch)',
      'Power: 2× 18650 (Rechargeable lithium cells) stepped down via LD33CV (Safety regulator) and L298N (Motor power controller)',
      'Connectivity: WiFi to Blynk (Mobile control dashboard) cloud + AI API for remote monitoring',
    ],
    detail: 'The component selection was optimized for cost, availability, and protocol (Data language) diversity. The BME280 uses I2C (Serial data for slow sensors), the GC9A01 uses SPI (High-speed serial for screens), and the HC-SR04 uses direct GPIO (Digital pin) triggering — exposing students to three distinct communication paradigms on a single device.',
  },
  {
    title: 'SENSORS DEEP DIVE',
    subtitle: 'Five Environmental Inputs to KAI\'s Brain',
    color: '#8338EC',
    content: [
      'HC-SR04 Ultrasonic (Like a bat\'s sonar): distance 2–400cm, ±1cm accuracy — detects human presence',
      'MPU6050 6-Axis IMU (Motion and tilt tracker): 3-axis gyro + 3-axis accel — detects tilt, shake, orientation',
      'BME280 Environmental (Atmospheric sensor): temperature 26–31°C range tested, humidity, barometric pressure',
      'MQ-2 Gas Sensor (Analog gas sniffer): detects LPG, propane, hydrogen — threshold 2500 ADC (Sensor units) = Alert',
      'LDR Light Sensor (Measures room brightness): ambient light level for Drowsy (Sleep) state detection',
    ],
    detail: 'The sensors collectively give KAI a "sensory nervous system." The HC-SR04 is KAI\'s eyes (Detecting if someone is close), the MQ-2 is KAI\'s nose (Sensing dangerous fumes), the BME280 is its skin sensing the weather, the MPU6050 tells it when it\'s been physically touched or moved, and the LDR (Light sensor) tells it whether to dim for sleep.',
  },
  {
    title: 'ACTUATORS & OUTPUT',
    subtitle: 'How KAI Expresses Itself',
    color: '#00D4FF',
    content: [
      'GC9A01 Round TFT (The high-speed circular face): draws animated face expressions — eyes wide (Engaged), drooped (Drowsy), narrow (Alert)',
      'MG90S Micro Servo (Head tilting motor): controls head angle for physical nodding and directional attention',
      'Dual N20 Geared Motors (Wheel propulsion units) via L298N (Power controller): different speeds used for steering',
      'Dual Vibration Motors (Like a vibrating phone): haptic feedback array — short pulses for current status',
      'Piezo Buzzer (Small alarm speaker): audio alerts for gas detection and proximity warnings',
    ],
    detail: 'The GC9A01 (Round display) is the most visually distinctive component — a circular display that renders KAI\'s "face". The face changes in real-time based on state. Combined with the MG90S (Servo motor) head tilt, KAI achieves a surprisingly emotive physical presence — nodding toward a detected person, drooping when sleepy, stiffening when gas is detected.',
  },
  {
    title: 'POWER SYSTEM',
    subtitle: '7.4V Li-ion with Dual Regulation',
    color: '#FF8800',
    content: [
      '2× 18650 Li-ion cells (High-capacity batteries): 7.4V nominal, sufficient capacity for multi-hour operation',
      'LD33CV Linear Regulator (Voltage protector): steps 7.4V down to 3.3V for safe ESP32 (Brain) operation',
      'L298N H-Bridge (High-power motor driver): acts as both motor driver AND 5V regulated output for basic sensors',
      '5V Single-Channel Relay (Remote switch): controls high-current external circuits (Like fans or lamps) safely',
      'Nylon braided cable sleeving keeps power runs organized and prevents wiring shorts in the compact chassis',
    ],
    detail: 'The dual-regulation approach is pragmatic: the LD33CV (Voltage regulator) provides clean 3.3V for sensitive sensors. The L298N (Motor controller) provides 5V for parts like the HC-SR04 (Sonar) and relay, reducing the total part count while teaching students about voltage regulation.',
  },
  {
    title: 'COMMUNICATION PROTOCOLS',
    subtitle: 'I²C, SPI, GPIO & WiFi in One Device',
    color: '#CC44FF',
    content: [
      'I²C Bus (Two-wire sensor bus): BME280 + MPU6050 share the same two-wire bus with unique internal addresses',
      'SPI Bus (High-speed screen bus): GC9A01 face display — high-speed serial for pushing graphics data to the screen',
      'Direct GPIO (General purpose pins): HC-SR04 sonar, MQ-2 gas, LDR light, relay, servo PWM, motor PWM, haptics',
      'Serial/I2C (Data language): ESP32-CAM (Vision module) communicates for tracking humans or objects',
      'WiFi: ESP32 built-in connects to Blynk (IoT control app) for remote interaction via phone',
    ],
    detail: 'Using I2C for environmental sensors elegantly solves bus (Electronic highway) contention — the ESP32 (Brain) polls sensors sequentially on the same wires. SPI for the display is essential for speed: pushing graphics at 30fps (Frames per second) requires high bandwidth that I2C cannot provide.',
  },
  {
    title: 'FIRMWARE ARCHITECTURE',
    subtitle: 'State Machine + Hardware Timers + Arduino C++',
    color: '#44FFAA',
    content: [
      'Written in C++ (The coding language) using the Arduino framework — compiled for the ESP32 brain',
      'Hardware timers for non-blocking execution: sensor polling every 100ms, display refresh every 50ms',
      'State machine (Logical moods): 4 states — Idle, Engaged, Alert, Drowsy — evaluated constantly',
      'Task pinning: WiFi tasks pinned to Core 0, critical sensor loops pinned to Core 1',
      'No blocking delay() (Pauses) in main loops — uses real-time clock timing for snappy behavior',
    ],
    detail: 'The firmware (Brain software) design follows best practices: the state machine is like a set of "moods". If the MQ-2 (Gas sensor) is high, KAI enters ALERT mode instantly. If the HC-SR04 (Sonar) sees someone, it enters ENGAGED. This multi-tasking ensures KAI never "freezes" while talking to the cloud.',
  },
  {
    title: 'SOFTWARE LIBRARIES',
    subtitle: 'The Firmware Stack',
    color: '#FF006E',
    content: [
      'TFT_eSPI (Screen driver): handles the circular eyes and face expressions on the round display',
      'BlynkSimpleEsp32 (Phone app bridge): connects the robot to the internet for remote control',
      'Adafruit_BME280 (Weather library): tracks temperature and air pressure from the atmosphere',
      'MPU6050 (Motion library): handles 6-axis data to detect if KAI has been picked up or tilted',
      'ESP32Servo (Motor controller): controls the MG90S head-tilt motor using specialized timing',
    ],
    detail: 'Libraries are pre-written code that speed up development. Instead of writing code from scratch to talk to the GC9A01 (Face display), we use TFT_eSPI. Instead of manually handling WiFi, we use Blynk. This modular approach makes the project professional and easy to maintain.',
  },
  {
    title: 'BEHAVIORAL MODES',
    subtitle: 'Autonomous State Machine',
    color: '#06FFA5',
    content: [
      'IDLE (Default): face neutral, head centered, no movement — waiting for interactions',
      'ENGAGED (Detection): Sonar sees a person — face brightens, head nods, moves toward the user',
      'ALERT (Danger): Smoke or gas detected — face turns bright red, buzzer screams, vibrating intense haptics',
      'DROWSY (Sleep): Room lights off — eyes droop, head tilts down, display dims, low power mode',
      'Immediate transitions: KAI reacts in less than 600ms (Faster than a human eye blink)',
    ],
    detail: 'The behavior system is a priority ladder: ALERT (Danger) is #1. ENGAGED (Person nearby) is #2. DROWSY (Dark room) is #3. This "safe-first" logic ensures that even if you are playing with KAI, it will instantly stop and sound the alarm if the MQ-2 (Gas sniffer) detects smoke.',
  },
  {
    title: 'MANUAL MODE — BLYNK',
    subtitle: 'Remote Control via IoT',
    color: '#FFBE0B',
    content: [
      'Manual Mode via phone: Core 0 (WiFi brain) receives your command and overrides autonomous rules',
      'Joystick control: Drag your finger on the phone app to move KAI with its N20 (Wheel) motors',
      'Relay control: Remote button to turn on external devices (Like a fan) using the 5V Relay switch',
      'Live Telemetry: All 5 sensor readings are beamed to your phone every 500ms (Half-second)',
      'AI Analysis: Ask the robot "How is the air quality?" and it uses real data to answer you in the app',
    ],
    detail: 'Blynk is the bridge between the robot and the internet (IoT). When you move the joystick on your phone, the ESP32 (Main brain) receives the command over WiFi and tells the L298N (Motor driver) to spin the wheels. This allows you to "become" KAI from anywhere in the world.',
  },
  {
    title: 'TESTING & RESULTS',
    subtitle: 'Measured Performance from Physical Testing',
    color: '#3A86FF',
    content: [
      'Sonar Accuracy: measures distance within 1cm (Half-inch) — extremely precise for obstacle avoidance',
      'Sensors Stability: Atmospheric and tilt data remained consistent over hours of laboratory testing',
      'Response Time: Total delay from sensor hit to physical reaction is under 600ms (Very snappy)',
      'Network Delay: Round-trip via cloud/WiFi is ~200-800ms (Acceptable for remote steering)',
      'Reliability: No software crashes or "freezes" observed during continuous 4-hour stress tests',
    ],
    detail: 'Testing proved that separating the brain into two cores works: the robot never lags even when the internet is slow. The L298N (Motor controller) handled the wheel power without overheating, and the HC-SR04 (Sonar) reliably detected people moving in and out of its "visual field".',
  },
  {
    title: 'FUTURE SCOPE',
    subtitle: 'Phase 2 and 3 Enhancements',
    color: '#CC44FF',
    content: [
      'OV2640 (Mini camera): add real vision for face recognition and person tracking',
      'TensorFlow Lite (AI on chip): recognize hand gestures from the camera without using the internet',
      'LoRa (Long-range radio): communicate over miles without using WiFi or phone signals',
      'DRV8833 (Small motor driver): a more efficient and tiny brain for the wheels to replace the L298N',
      'Voice synthesis: add a real mouth for KAI to talk to you through an I2S (Digital sound) speaker',
    ],
    detail: 'Future upgrades are easy because of the ESP32\'s (Dual-core brain) power. Adding a camera or LoRa (Radio) just requires plugging into the existing GPIO (General purpose) pins and updating the software. KAI is designed to grow smarter over time.',
  },
  {
    title: 'CONCLUSION',
    subtitle: 'KAI — A Living Microcontroller Textbook',
    color: '#06FFA5',
    content: [
      'Successfully demonstrates advanced dual-core architecture and multi-sensor (I2C/SPI) communication',
      'Combines diverse technologies: WiFi, IoT, haptics, motor control, and circular display graphics',
      'Proven hardware-guaranteed response times and professional-grade firmware structure',
      'Expressive logic makes sensor data useful and engaging for real-world environmental monitoring',
      'Completed at SVKM\'S NMIMS Indore — Semester IV — April 12, 2026',
    ],
    detail: 'KAI is not just a project; it is a demonstration of how microprocessors (Brains) and sensors (Nerves) can work together to create something that feels alive. It covers every major topic in our course: dual-core data handling, serial communication, and real-time physical control. Thank you for following the journey of KAI!',
  },
  {
    title: 'REFERENCES',
    subtitle: 'Data Sources & Documentation Used',
    color: '#FFBE0B',
    content: [
      '① ESP32 Technical Reference — Official datasheet for the dual-core brain chip',
      '② TFT_eSPI Library — Professional code guide for circular face displays',
      '③ Blynk IoT Manual — Guide for connecting sensors to phone apps over the internet',
      '④ Adafruit sensor docs — Reference for atmospheric (BME280) and motion (MPU6050) sensors',
      '⑤ GC9A01 Datasheet — Schematic for KAI\'s circular eye display hardware',
    ],
    detail: 'Additional references: HC-SR04 (Sonar sensor), L298N (Motor controller), and MQ-2 (Smoke sniffer) technical manuals were used to calibrate all detection thresholds. This documentation ensures KAI operates exactly according to its industrial specifications.',
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
    // Simplified machine gestures for stability
    if (gesture.type === 'open') {
      navigate(1);
    } else if (gesture.type === 'fist') {
      navigate(-1);
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
