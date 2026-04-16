import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Hand, HelpCircle, X } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface CircuitEngineProps { onBack: () => void; }

// ── Component data (report specs, diagram layout) ──────────────────────────
interface ComponentDef {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  x: number; y: number; w: number; h: number;
  group: 'sensor' | 'actuator' | 'controller' | 'power' | 'display' | 'cloud';
  pins: string[];
  protocol: string;
  info: string;
}

const COMPONENTS: ComponentDef[] = [
  // ── CONTROLLER (center) ───────────────────────────────────────────────────
  { id: 'esp32s3', label: 'ESP32', sublabel: 'Dual-Core 240MHz MCU', color: '#00d4ff',
    x: 340, y: 240, w: 180, h: 220, group: 'controller',
    pins: ['GPIO 1-9','GPIO 10-19','GPIO 20-27','GPIO 34,35','SDA GPIO 21','SCL GPIO 22'],
    protocol: 'ALL PROTOCOLS',
    info: 'ESP32 WROOM-1 Master MCU. Dual-core Xtensa LX7 @ 240MHz, 512KB SRAM, 8MB Flash, built-in WiFi/BT. Core 0: WiFi + Blynk. Core 1: Sensors + Actuators. Powers the entire KAI system.' },

  // ── SENSORS (left column) ─────────────────────────────────────────────────
  { id: 'hcsr04', label: 'HC-SR04', sublabel: 'Ultrasonic Distance', color: '#76b900',
    x: 40, y: 60, w: 140, h: 70, group: 'sensor',
    pins: ['Trig: GPIO 5','Echo: GPIO 18','VCC: 5V','GND'],
    protocol: 'GPIO PULSE',
    info: 'HC-SR04 Ultrasonic Sensor. Range 2–400cm, accuracy ±1cm. Trigger: 10µs pulse on GPIO 5. Echo: pulse width ∝ distance on GPIO 18. Used for Engaged state: distance < 30cm = person present.' },

  { id: 'mpu6050', label: 'MPU6050', sublabel: '6-Axis IMU (Gyro+Accel)', color: '#ffaa00',
    x: 40, y: 165, w: 140, h: 70, group: 'sensor',
    pins: ['SDA: GPIO 21','SCL: GPIO 22','I2C Addr: 0x68','Interrupt: GPIO 4'],
    protocol: 'I²C',
    info: 'MPU6050 6-Axis IMU. 3-axis gyroscope + 3-axis accelerometer on one chip. Connected via I2C shared bus (addr 0x68). Detects KAI tilt, shake, orientation changes. Library: MPU6050 (I2CDevLib).' },

  { id: 'bme280', label: 'BME280', sublabel: 'Temp / Humidity / Pressure', color: '#ff5522',
    x: 40, y: 270, w: 140, h: 70, group: 'sensor',
    pins: ['SDA: GPIO 21','SCL: GPIO 22','I2C Addr: 0x76','VCC: 3.3V'],
    protocol: 'I²C',
    info: 'BME280 Environmental Sensor. Measures temperature (±0.5°C), relative humidity (±3%), barometric pressure. Shares I2C bus with MPU6050. Tested range: 26–31°C. Library: Adafruit_BME280.' },

  { id: 'mq2', label: 'MQ-2', sublabel: 'Gas / Smoke Sensor', color: '#cc44ff',
    x: 40, y: 375, w: 140, h: 70, group: 'sensor',
    pins: ['AO: GPIO 34','VCC: 5V','GND','(Digital unused)'],
    protocol: 'ADC ANALOG',
    info: 'MQ-2 Gas Sensor. Detects LPG, propane, hydrogen, smoke. Analog output on GPIO 34 (ADC1). Threshold: 2500 ADC counts = Alert state → buzzer + vibration + red face. Preheating required: 20s warmup.' },

  { id: 'ldr', label: 'LDR', sublabel: 'Light Sensor', color: '#ffdd44',
    x: 40, y: 480, w: 140, h: 70, group: 'sensor',
    pins: ['Analog: GPIO 35','Voltage divider 10kΩ','VCC: 3.3V','GND'],
    protocol: 'ADC ANALOG',
    info: 'LDR (Light Dependent Resistor). Resistance decreases with light. Read via GPIO 35 ADC with 10kΩ voltage divider. Low reading = darkness = Drowsy state: KAI dims display and slows movement.' },

  // ── DISPLAY (top center) ──────────────────────────────────────────────────
  { id: 'gc9a01', label: 'GC9A01', sublabel: '1.28" Round TFT — KAI Face', color: '#06FFA5',
    x: 340, y: 40, w: 180, h: 80, group: 'display',
    pins: ['SPI MOSI: GPIO 23','SPI CLK: GPIO 18','CS: GPIO 10','DC: GPIO 14','RST: GPIO 9'],
    protocol: 'SPI',
    info: 'GC9A01 Round TFT Display. 1.28" 240×240px circular display. Renders KAI\'s animated face — eye expressions change per state. SPI interface at up to 80MHz. Library: TFT_eSPI. The most visually distinctive KAI component.' },

  // ── POWER (top right area) ────────────────────────────────────────────────
  { id: 'battery', label: '18650 × 2', sublabel: '7.4V Li-ion Pack', color: '#ff8800',
    x: 680, y: 40, w: 140, h: 70, group: 'power',
    pins: ['Output: 7.4V','2× 18650 in series','Capacity: ~4000mAh','Nylon braided sleeving'],
    protocol: 'POWER RAIL',
    info: '2× 18650 Li-ion cells in series. 7.4V nominal. Provides main power rail to LD33CV regulator and L298N motor driver. Nylon braided cable sleeving. Sufficient for multi-hour KAI operation.' },

  { id: 'ld33cv', label: 'LD33CV', sublabel: '3.3V Voltage Regulator', color: '#3a86ff',
    x: 680, y: 145, w: 140, h: 70, group: 'power',
    pins: ['VIN: 7.4V from battery','VOUT: 3.3V','GND','Capacitors for stability'],
    protocol: 'POWER',
    info: 'LD33CV Linear Voltage Regulator. Steps 7.4V → 3.3V for ESP32 and all 3.3V logic components (BME280, MPU6050, LDR voltage divider). Simple TO-252 package. Max 1A output. Quiet, stable 3.3V rail.' },

  { id: 'l298n', label: 'L298N', sublabel: 'Dual H-Bridge Motor Driver', color: '#ff3366',
    x: 680, y: 250, w: 140, h: 70, group: 'power',
    pins: ['IN1: GPIO 12 (PWM)','IN2: GPIO 13 (PWM)','IN3: GPIO 14 (PWM)','IN4: GPIO 15 (PWM)','5V OUT → HC-SR04'],
    protocol: 'PWM + POWER',
    info: 'L298N Mini Motor Driver. Dual H-bridge controls 2× N20 geared motors for differential drive. Also provides 5V regulated output for HC-SR04. PWM frequency determines motor speed. Max 2A per channel.' },

  // ── ACTUATORS (right column) ──────────────────────────────────────────────
  { id: 'n20motors', label: 'N20 Motors ×2', sublabel: 'Differential Drive', color: '#44ffaa',
    x: 700, y: 370, w: 130, h: 70, group: 'actuator',
    pins: ['Via L298N driver','PWM GPIO 12,13,14,15','Rubber high-traction','Dual wheel drive'],
    protocol: 'PWM → L298N',
    info: 'Dual N20 Geared DC Motors. Rubber high-traction wheels. Differential drive: vary left/right speed for turning. Controlled via L298N H-bridge. In autonomous mode: gentle spin when Engaged. In manual mode: Blynk joystick → speed/direction.' },

  { id: 'mg90s', label: 'MG90S Servo', sublabel: 'Head Tilt Mechanism', color: '#00d4ff',
    x: 700, y: 460, w: 130, h: 70, group: 'actuator',
    pins: ['PWM: GPIO 4','VCC: 5V','GND','Range: 0°–180°'],
    protocol: 'PWM SERVO',
    info: 'MG90S Micro Servo. Controls KAI\'s head tilt axis. Center (90°) = neutral. Nod forward (60°) = Engaged state. Tilt down (120°) = Drowsy state. Right/left = tracking. Library: ESP32Servo (hardware timer PWM).' },

  { id: 'relay', label: '5V Relay', sublabel: 'External Circuit Switch', color: '#FF006E',
    x: 700, y: 550, w: 130, h: 70, group: 'actuator',
    pins: ['Control: GPIO 26','VCC: 5V','COM/NO/NC contacts','10A @ 250VAC rated'],
    protocol: 'GPIO',
    info: '5V Single-Channel Relay Module. Switches external high-current circuits via GPIO 26. Toggled via Blynk app V-pin in Manual mode. Opto-isolated — ESP32 signal safely controls mains-level loads. Future: control external LED strip or fan.' },

  { id: 'vibration', label: 'Vibration ×2', sublabel: 'Haptic Feedback Array', color: '#8338ec',
    x: 700, y: 640, w: 130, h: 70, group: 'actuator',
    pins: ['GPIO 2 (HAPTIC_L)','GPIO 27 (HAPTIC_R)','NPN transistor driver','5V motors'],
    protocol: 'GPIO → TRANSISTOR',
    info: 'Dual Vibration Motors for haptic feedback. Left (GPIO 2) and Right (GPIO 27) driven by NPN transistors from GPIO. Alert state: rapid pulses. Engaged state: single pulse on detection. Creates physical presence awareness without speakers.' },

  { id: 'buzzer', label: 'Piezo Buzzer', sublabel: 'Audio Alert', color: '#ffbe0b',
    x: 700, y: 730, w: 130, h: 70, group: 'actuator',
    pins: ['GPIO 25','Direct drive (passive)','PWM tone generation','GND'],
    protocol: 'PWM / GPIO',
    info: 'Piezo Buzzer (passive). Driven directly from GPIO 25 with PWM for tone generation. Alert state: 880Hz warning beep pattern. Engagement: short 440Hz pip. Can play simple melodies via tone() function. Low power, high audibility.' },

  // ── CLOUD (top) ───────────────────────────────────────────────────────────
  { id: 'blynk', label: 'Blynk IoT', sublabel: 'Cloud + AI API', color: '#06FFA5',
    x: 530, y: 40, w: 120, h: 80, group: 'cloud',
    pins: ['WiFi 2.4GHz','V-pins: sensor data','Joystick: V5/V6','Relay: V7','AI API: V10'],
    protocol: 'WiFi / MQTT',
    info: 'Blynk IoT Cloud + AI API. ESP32 streams all 5 sensor readings every 500ms via V-pins. Manual mode joystick (V5,V6) controls N20 motors. V7 toggles relay. Blynk AI API (V10) enables natural language interaction with KAI\'s live sensor data.' },
];

// ── Wire connections (from, to, color, label) ──────────────────────────────
interface Wire {
  from: string; to: string; color: string; label: string;
  fromSide: 'right' | 'left' | 'top' | 'bottom';
  toSide: 'right' | 'left' | 'top' | 'bottom';
}

const WIRES: Wire[] = [
  { from: 'hcsr04',    to: 'esp32s3',  color: '#76b900', label: 'GPIO 5/18 + 5V', fromSide: 'right', toSide: 'left' },
  { from: 'mpu6050',   to: 'esp32s3',  color: '#ffaa00', label: 'I²C SDA/SCL',   fromSide: 'right', toSide: 'left' },
  { from: 'bme280',    to: 'esp32s3',  color: '#ff5522', label: 'I²C SDA/SCL',   fromSide: 'right', toSide: 'left' },
  { from: 'mq2',       to: 'esp32s3',  color: '#cc44ff', label: 'ADC GPIO 34',   fromSide: 'right', toSide: 'left' },
  { from: 'ldr',       to: 'esp32s3',  color: '#ffdd44', label: 'ADC GPIO 35',   fromSide: 'right', toSide: 'left' },
  { from: 'esp32s3',   to: 'gc9a01',   color: '#06FFA5', label: 'SPI',           fromSide: 'top',   toSide: 'bottom' },
  { from: 'esp32s3',   to: 'blynk',    color: '#06FFA5', label: 'WiFi',          fromSide: 'top',   toSide: 'bottom' },
  { from: 'esp32s3',   to: 'l298n',    color: '#ff3366', label: 'PWM GPIO 12-15',fromSide: 'right', toSide: 'left' },
  { from: 'esp32s3',   to: 'mg90s',    color: '#00d4ff', label: 'PWM GPIO 4',    fromSide: 'right', toSide: 'left' },
  { from: 'esp32s3',   to: 'relay',    color: '#FF006E', label: 'GPIO 26',       fromSide: 'right', toSide: 'left' },
  { from: 'esp32s3',   to: 'vibration',color: '#8338ec', label: 'GPIO 2/27',     fromSide: 'right', toSide: 'left' },
  { from: 'esp32s3',   to: 'buzzer',   color: '#ffbe0b', label: 'GPIO 25 PWM',   fromSide: 'right', toSide: 'left' },
  { from: 'battery',   to: 'ld33cv',   color: '#ff8800', label: '7.4V',          fromSide: 'bottom',toSide: 'top' },
  { from: 'battery',   to: 'l298n',    color: '#ff8800', label: '7.4V power',    fromSide: 'bottom',toSide: 'top' },
  { from: 'ld33cv',    to: 'esp32s3',  color: '#3a86ff', label: '3.3V VCC',      fromSide: 'left',  toSide: 'right' },
  { from: 'l298n',     to: 'n20motors',color: '#44ffaa', label: 'Motor out',     fromSide: 'bottom',toSide: 'top' },
];

function getCenter(c: ComponentDef, side: 'right'|'left'|'top'|'bottom') {
  if (side === 'right')  return { x: c.x + c.w, y: c.y + c.h / 2 };
  if (side === 'left')   return { x: c.x,        y: c.y + c.h / 2 };
  if (side === 'top')    return { x: c.x + c.w / 2, y: c.y };
  return                        { x: c.x + c.w / 2, y: c.y + c.h };
}

const CANVAS_W = 880;
const CANVAS_H = 860;

export default function CircuitEngine({ onBack }: CircuitEngineProps) {
  const [selected, setSelected] = useState<ComponentDef | null>(null);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [zoom, setZoom]         = useState(0.85);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureState,   setGestureState]   = useState<GestureState | null>(null);
  const [pulseT, setPulseT]     = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const panDrag = useRef<{ on: boolean; sx: number; sy: number; px: number; py: number }>({ on: false, sx: 0, sy: 0, px: 0, py: 0 });

  // Animate wire pulses
  useEffect(() => {
    const id = setInterval(() => setPulseT(t => (t + 1) % 200), 30);
    return () => clearInterval(id);
  }, []);

  const nudgeZoom = (d: number) => setZoom(z => Math.max(0.4, Math.min(2.2, z + d)));

  const handleGesture = useCallback((g: GestureState) => {
    setGestureState(g);
    if (g.type === 'open') nudgeZoom(0.15);
    else if (g.type === 'fist') nudgeZoom(-0.15);
  }, [nudgeZoom]);

  useEffect(() => {
    if (gestureEnabled) {
      gestureController.subscribe(handleGesture);
      return () => gestureController.unsubscribe(handleGesture);
    } else { setGestureState(null); }
  }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) { gestureController.stop(); setGestureEnabled(false); return; }
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera unavailable'); return; }
    try { const ok = await gestureController.init(); if (ok) setGestureEnabled(true); } catch (e) { alert(`${e}`); }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panDrag.current = { on: true, sx: e.clientX, sy: e.clientY, px: panX, py: panY };
    setIsPanning(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!panDrag.current.on) return;
    setPanX(panDrag.current.px + (e.clientX - panDrag.current.sx));
    setPanY(panDrag.current.py + (e.clientY - panDrag.current.sy));
  };
  const handlePointerUp = () => { panDrag.current.on = false; setIsPanning(false); };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    // If Ctrl key is pressed (typical trackpad pinch behavior), zoom.
    if (e.ctrlKey) {
      e.preventDefault();
      const d = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom(z => Math.max(0.4, Math.min(2.2, z + d)));
    } else {
      // Otherwise, scrolling vertically should pan the diagram (like scrolling a page)
      e.preventDefault();
      setPanY(p => p - e.deltaY * 0.8);
    }
  };

  const comp = (id: string) => COMPONENTS.find(c => c.id === id)!;

  const groupColors: Record<string, string> = {
    sensor: '#1a2a0a', actuator: '#0a0a2a', controller: '#001530',
    power: '#2a1200', display: '#001a10', cloud: '#001a10',
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#08080f', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '10px 16px', borderBottom: '2px solid rgba(0,212,255,0.3)', background: 'rgba(0,6,24,0.95)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => nudgeZoom(0.15)} style={{ background: '#000', border: '2px solid #00d4ff', color: '#00d4ff', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ZoomIn size={14} /></button>
        <button onClick={() => nudgeZoom(-0.15)} style={{ background: '#000', border: '2px solid #00d4ff', color: '#00d4ff', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ZoomOut size={14} /></button>
        <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); musicEngine.playSfx(400); }} style={{ background: '#000', border: '2px solid #666', color: '#888', padding: '0 10px', height: 36, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.52rem', cursor: 'pointer' }}>
          <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />RESET
        </button>
        <button onClick={toggleGesture} style={{ background: gestureEnabled ? 'rgba(6,255,165,0.2)' : '#000', border: `2px solid ${gestureEnabled ? '#06FFA5' : '#555'}`, color: gestureEnabled ? '#06FFA5' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Hand size={16} />
        </button>
        <button onClick={() => { setShowHelp(v => !v); musicEngine.playSfx(600); }} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <HelpCircle size={16} />
        </button>
        <button onClick={onBack} style={{ background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '0 15px', height: 40, fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', cursor: 'pointer' }}>EXIT</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.45rem,1vw,0.7rem)', color: '#00d4ff', textShadow: '0 0 12px #00d4ff', letterSpacing: 2 }}>KAI SENTINEL — PIN DIAGRAM</span>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.45rem', color: 'rgba(6,255,165,0.4)', marginTop: 6 }}>v2.0 · NMIMS INDORE</div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: '#00d4ff88' }}>{(zoom * 100).toFixed(0)}%</div>
      </div>

      {/* SVG diagram */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%" height="100%"
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="xMidYMin meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : 'default', touchAction: 'none', userSelect: 'none' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {COMPONENTS.map(c => (
              <marker key={c.id} id={`arr-${c.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={c.color} />
              </marker>
            ))}
          </defs>

          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Background label areas */}
            <rect x="10" y="10" width="200" height="600" rx="6" fill="rgba(0,80,0,0.05)" stroke="rgba(118,185,0,0.12)" strokeWidth="1" />
            <text x="80" y="28" fill="rgba(118,185,0,0.4)" fontSize="9" fontFamily="'JetBrains Mono',monospace" letterSpacing="2">SENSORS</text>
            <rect x="660" y="10" width="210" height="800" rx="6" fill="rgba(0,0,80,0.05)" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
            <text x="700" y="28" fill="rgba(0,212,255,0.4)" fontSize="9" fontFamily="'JetBrains Mono',monospace" letterSpacing="2">ACTUATORS / POWER</text>

            {/* Wire connections */}
            {WIRES.map((w, i) => {
              const a = comp(w.from); const b = comp(w.to);
              if (!a || !b) return null;
              const p1 = getCenter(a, w.fromSide);
              const p2 = getCenter(b, w.toSide);
              const mx = (p1.x + p2.x) / 2;
              const d = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
              const dash = 160;
              const offset = -(pulseT * 2.5) % dash;
              const isHov = hovered === w.from || hovered === w.to;
              return (
                <g key={i}>
                  {/* Base wire */}
                  <path d={d} fill="none" stroke={w.color + '33'} strokeWidth={isHov ? 2.5 : 1.5} />
                  {/* Animated pulse */}
                  <path d={d} fill="none" stroke={w.color} strokeWidth={isHov ? 2 : 1}
                    strokeDasharray={`${dash * 0.18} ${dash * 0.82}`}
                    strokeDashoffset={offset}
                    opacity={isHov ? 1 : 0.5}
                  />
                </g>
              );
            })}

            {/* Component blocks */}
            {COMPONENTS.map(c => {
              const isHov = hovered === c.id;
              const isSel = selected?.id === c.id;
              return (
                <g key={c.id}
                  onClick={() => { setSelected(isSel ? null : c); musicEngine.playSfx(700); }}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Shadow glow */}
                  {(isHov || isSel) && <rect x={c.x - 3} y={c.y - 3} width={c.w + 6} height={c.h + 6} rx="5" fill={c.color + '22'} filter="url(#glow)" />}
                  {/* Main block */}
                  <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="4"
                    fill={groupColors[c.group]}
                    stroke={isSel ? c.color : isHov ? c.color + 'aa' : c.color + '55'}
                    strokeWidth={isSel ? 2.5 : 1.5}
                  />
                  {/* Color accent bar */}
                  <rect x={c.x} y={c.y} width={6} height={c.h} rx="2" fill={c.color} opacity={0.8} />
                  {/* Label */}
                  <text x={c.x + 14} y={c.y + 24} fill={c.color} fontSize={c.group === 'controller' ? 12 : 11} fontFamily="'Press Start 2P',cursive" fontWeight="700">{c.label}</text>
                  <text x={c.x + 14} y={c.y + 38} fill={c.color + 'aa'} fontSize="7.5" fontFamily="'JetBrains Mono',monospace">{c.sublabel}</text>
                  {/* Protocol badge - Moved to bottom-right to avoid overlap */}
                  <rect x={c.x + c.w - 74} y={c.y + c.h - 22} width="66" height="14" rx="3" fill={c.color + '22'} />
                  <text x={c.x + c.w - 41} y={c.y + c.h - 15} fill={c.color} fontSize="6.5" fontFamily="'JetBrains Mono',monospace" textAnchor="middle" dominantBaseline="central">{c.protocol}</text>
                  {/* Pin labels for controller */}
                  {c.group === 'controller' && c.pins.map((p, pi) => (
                    <text key={pi} x={c.x + 14} y={c.y + 54 + pi * 28} fill="rgba(0,212,255,0.65)" fontSize="7" fontFamily="'JetBrains Mono',monospace">{p}</text>
                  ))}
                  {/* Hover: show first two pins */}
                  {isHov && c.group !== 'controller' && c.pins.slice(0, 2).map((p, pi) => (
                    <text key={pi} x={c.x + 14} y={c.y + 44 + pi * 14} fill={c.color + 'bb'} fontSize="7" fontFamily="'JetBrains Mono',monospace">{p}</text>
                  ))}
                  {/* Selection indicator */}
                  {isSel && <circle cx={c.x + c.w - 8} cy={c.y + c.h - 8} r="5" fill={c.color} opacity="0.9" />}
                </g>
              );
            })}

            {/* Title */}
            <text x={CANVAS_W / 2} y={CANVAS_H - 10} textAnchor="middle" fill="rgba(0,212,255,0.2)" fontSize="9" fontFamily="'JetBrains Mono',monospace" letterSpacing="3">KAI SENTINEL — UNIFIED PHASE 1 & 2 PIN DIAGRAM · ESP32 MASTER MCU</text>
          </g>
        </svg>

        {/* Gesture HUD */}
        {gestureEnabled && gestureState && gestureState.type !== 'none' && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', border: '2px solid #06FFA5', padding: '6px 16px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.42rem', color: '#06FFA5', pointerEvents: 'none' }}>
            {gestureState.type === 'pinch' ? '🤏 PINCH → ZOOM IN' : gestureState.type === 'open' ? '✋ OPEN → ZOOM OUT' : '✊ GESTURE ACTIVE'}
          </div>
        )}

        {/* Info panel */}
        {selected && (
          <div style={{ position: 'absolute', top: 16, right: 16, width: 300, zIndex: 100 }}>
            <div style={{ background: 'rgba(0,4,20,0.97)', border: `2px solid ${selected.color}`, borderRadius: 8, padding: '16px 18px', boxShadow: `0 6px 40px ${selected.color}44` }}>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: selected.color, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', color: selected.color, letterSpacing: 2, marginBottom: 4 }}>{selected.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: selected.color + 'aa', marginBottom: 10 }}>{selected.sublabel}</div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', color: '#444', marginBottom: 5, letterSpacing: 1 }}>PROTOCOL</div>
                <div style={{ display: 'inline-block', background: selected.color + '22', border: `1px solid ${selected.color}55`, borderRadius: 3, padding: '2px 8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: selected.color }}>{selected.protocol}</div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', color: '#444', marginBottom: 5, letterSpacing: 1 }}>PIN CONNECTIONS</div>
                {selected.pins.map((p, i) => (
                  <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'rgba(180,220,255,0.75)', lineHeight: 1.8 }}>▸ {p}</div>
                ))}
              </div>

              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'rgba(200,230,255,0.85)', lineHeight: 1.7, borderTop: `1px solid ${selected.color}33`, paddingTop: 10 }}>
                {selected.info}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(0,212,255,0.2)', padding: '8px 12px', zIndex: 50 }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.35rem', color: '#00d4ff', marginBottom: 6, letterSpacing: 2 }}>LEGEND</div>
          {[
            { color: '#76b900', label: 'Sensors' },
            { color: '#00d4ff', label: 'Controller' },
            { color: '#06FFA5', label: 'Display / Cloud' },
            { color: '#ff3366', label: 'Power' },
            { color: '#44ffaa', label: 'Actuators' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', color: '#ccc' }}>{l.label}</div>
            </div>
          ))}
        </div>

        {/* Drag hint */}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'rgba(0,212,255,0.3)', letterSpacing: 2, pointerEvents: 'none' }}>
          DRAG · SCROLL ZOOM · CLICK COMPONENT
        </div>
      </div>
    </div>
  );
}
