import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, Hand, ZoomIn, ZoomOut, HelpCircle, X, Radio } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface ExploreEngineProps { onBack: () => void; }

// ── KAI Component Hotspot Data (report specs) ──────────────────────────────
const KAI_PARTS = [
  { id: 'gc9a01',   pos: [0, 0.75, 0.55] as [number,number,number], col: 0x06FFA5, color: '#06FFA5', title: 'GC9A01 TFT FACE',       info: '1.28" round TFT display. Renders ocular expressions (Idle, Engaged, Alert, Drowsy). SPI @ 80MHz.' },
  { id: 'hcsr04',   pos: [0, 0.5, 0.95] as [number,number,number], col: 0x76b900, color: '#76b900', title: 'HC-SR04 VISOR',          info: 'Ultrasonic "eyes". Detects proximity < 30cm to trigger Engaged state. Dual transducer system.' },
  { id: 'esp32s3',  pos: [0, 0.15, 0]    as [number,number,number], col: 0x00d4ff, color: '#00d4ff', title: 'ESP32 MCU',            info: 'Master MCU. Dual-core LX7 @ 240MHz. Handles sensor fusion and cloud uplink concurrently.' },
  { id: 'mpu6050',  pos: [0.35, 0.15, 0.25]as [number,number,number], col: 0xffaa00, color: '#ffaa00', title: 'MPU6050 IMU',             info: '6-Axis Gyro/Accel. Detects kinetic movement and tilt orientation on the I2C bus.' },
  { id: 'bme280',   pos: [-0.35, 0.15, 0.25]as[number,number,number], col: 0xff5522, color: '#ff5522', title: 'BME280 ENVIRON.',         info: 'P-T-H sensor. Monitors environmental safety. I2C shared bus with MPU6050.' },
  { id: 'mq2',      pos: [0.55, 0.15, 0]  as [number,number,number], col: 0xcc44ff, color: '#cc44ff', title: 'MQ-2 GAS SENSOR',        info: 'Forensic gas sniffer. Detects smoke/LPG. ADC threshold > 2500 triggers Alert mode.' },
  { id: 'ldr',      pos: [-0.55, 0.15, 0] as [number,number,number], col: 0xffdd44, color: '#ffdd44', title: 'LDR LIGHT SENSOR',       info: 'Light intensity monitor. Triggers Drowsy sleep state when ambient light falls below 20%.' },
  { id: 'mg90s',    pos: [0, 1.0, 0]   as [number,number,number], col: 0x44aaff, color: '#44aaff', title: 'MG90S SERVO',           info: 'Head tilt mechanism. PWM driven on GPIO 4. Provides physical feedback for states.' },
  { id: 'l298n',    pos: [0, -0.2, -0.45]as [number,number,number], col: 0xff3366, color: '#ff3366', title: 'L298N DRIVER',           info: 'Dual H-bridge. Drives N20 motors. High-mass heatsink for thermal dissipation.' },
  { id: 'n20',      pos: [0.85, -0.45, 0.1] as [number,number,number], col: 0x06FFA5, color: '#06FFA5', title: 'N20 RIGHT MOTOR',      info: 'Geared DC motor with high-traction wheel. Controlled via PWM on GPIO 12/13.' },
  { id: 'n20b',     pos: [-0.85, -0.45, 0.1]as [number,number,number], col: 0x06FFA5, color: '#06FFA5', title: 'N20 LEFT MOTOR',       info: 'Geared DC motor. High-torque output for precision locomotion.' },
  { id: 'buzzer',   pos: [0.65, 0.45, 0.45]as[number,number,number], col: 0xffbe0b, color: '#ffbe0b', title: 'PIEZO BUZZER',          info: 'Audio alert system on GPIO 25. Fires 880Hz pulses during Alert state.' },
  { id: 'vibration',pos: [0, -0.15, 0.55] as [number,number,number], col: 0x8338ec, color: '#8338ec', title: 'HAPTIC UNIT',          info: 'Internal vibration feedback + NeoPixel underglow for visual status indicator.' },
  { id: 'battery',  pos: [0, 0.25, -0.85] as [number,number,number], col: 0xff8800, color: '#ff8800', title: 'LIPO POWER',           info: 'Dual 18650 cells (7.4V nominal). Core power source for the entire KAI architecture.' },
  { id: 'relay',    pos: [-0.65, 0.45, 0.45]as[number,number,number],col: 0xFF006E, color: '#FF006E', title: 'POWER RELAY',          info: '5V Opto-isolated relay on GPIO 26. Switches high-power external loads via Blynk.' },
  { id: 'ld33cv',   pos: [-0.45, -0.15, -0.55]as[number,number,number],col:0x3a86ff,color:'#3a86ff', title: 'LD33CV REGULATOR',      info: '7.4V → 3.3V Step-down regulator. Powers digital bus and MCU circuitry.' },
];

// ── Box definitions for 3D stencil model ──────────────────────────────────
interface BoxDef { x:number; y:number; z:number; w:number; h:number; d:number; col:number; em?:number; ei?:number; shape?: 'box' | 'sphere' | 'cylinder' | 'circle'; rx?:number; ry?:number; rz?:number; }

function getKaiBoxes(): Record<string, { home:[number,number,number]; boxes:BoxDef[] }> {
  return {
    // ── KAI PRIME CHASSIS ───────────────────────────────────────────────────
    body: { home:[0,0,0], boxes:[
      // Main Core Structure
      { x:0,y:0,z:0,  w:1.4,h:0.7,d:1.0, col:0x1a1a2e, em:0x003366, ei:0.1 }, 
      { x:0,y:0.4,z:0, w:1.2,h:0.4,d:0.8, col:0x16213e, em:0x002244, ei:0.1 },
      // Side Armor Plates
      { x:0.75,y:0.1,z:0, w:0.1,h:0.6,d:0.9, col:0x222233, em:0x00d4ff, ei:0.15 }, 
      { x:-0.75,y:0.1,z:0,w:0.1,h:0.6,d:0.9, col:0x222233, em:0x00d4ff, ei:0.15 },
      // Front V-Grill Armor
      { x:0.3,y:0.25,z:0.55, w:0.5,h:0.4,d:0.05, col:0x111122, em:0x00d4ff, ei:0.2 },
      { x:-0.3,y:0.25,z:0.55,w:0.5,h:0.4,d:0.05, col:0x111122, em:0x00d4ff, ei:0.2 },
      // Top Roll-Cage Handle
      { x:0,y:0.85,z:0,    w:0.8,h:0.05,d:0.05, col:0x333344 },
      { x:0.4,y:0.75,z:0,  w:0.05,h:0.2,d:0.05, col:0x333344 },
      { x:-0.4,y:0.75,z:0, w:0.05,h:0.2,d:0.05, col:0x333344 },
      // Rear Exhaust Fins
      { x:0,y:0.2,z:-0.55, w:1.0,h:0.1,d:0.1, col:0x222233 },
      { x:0,y:0.0,z:-0.55, w:0.8,h:0.1,d:0.1, col:0x111122, em:0xff006e, ei:0.3 },
    ]},

    // ── GC9A01 ROUND FACE ───────────────────────────────────────────────────
    gc9a01: { home:[0, 0.75, 0.55], boxes:[
      { x:0,y:0,z:0,  w:0.35,h:0,d:0, col:0x111111, shape: 'sphere' }, // Head
      { x:0,y:0,z:0.3, w:0.28,h:0,d:0, col:0x000000, em:0x06FFA5, ei:0.95, shape: 'circle' }, // Face
      { x:0,y:-0.3,z:0, w:0.1,h:0.1,d:0.4, col:0x333333 }, // Neck
    ]},

    // ── HC-SR04 VISOR ───────────────────────────────────────────────────────
    hcsr04: { home:[0, 0.55, 0.82], boxes:[
      { x:0,y:0,z:-0.05, w:0.7,h:0.2,d:0.05, col:0x1a2e0a, em:0x76b900, ei:0.1 }, // PCB
      { x:-0.2,y:0,z:0.08, w:0.18,h:0.18,d:0.18, col:0x0d1a06, em:0x76b900, ei:0.8 }, // Left sonar
      { x: 0.2,y:0,z:0.08, w:0.18,h:0.18,d:0.18, col:0x0d1a06, em:0x76b900, ei:0.8 }, // Right sonar
      { x:0,y:-0.05,z:0.05, w:0.1,h:0.06,d:0.06, col:0x333333 }, // Crystal osc
    ]},

    // ── MCU BOARD (ESP32) ────────────────────────────────────────────────
    esp32s3: { home:[0, 0.15, 0], boxes:[
      { x:0,y:0,z:0,  w:0.9,h:0.04,d:0.6, col:0x0d2210 }, // PCB Main
      { x:0,y:0.05,z:-0.1, w:0.4,h:0.06,d:0.45, col:0x333333, em:0x00d4ff, ei:0.2 }, // Metal shield
      { x:0,y:0.05,z:0.22, w:0.15,h:0.08,d:0.1, col:0x555555 }, // USB-C Port
      // Pin headers
      ...Array.from({length:12},(_,i)=>({ x:-0.4,y:0.1,z:(i-5.5)*0.045,w:0.03,h:0.1,d:0.03,col:0x888800,em:0xffff00,ei:0.2 })),
      ...Array.from({length:12},(_,i)=>({ x: 0.4,y:0.1,z:(i-5.5)*0.045,w:0.03,h:0.1,d:0.03,col:0x888800,em:0xffff00,ei:0.2 })),
    ]},

    // ── SENSOR HUB ──────────────────────────────────────────────────────────
    mpu6050: { home:[0.35, 0.15, 0.25], boxes:[
      { x:0,y:0,z:0,w:0.2,h:0.03,d:0.2,col:0x002244 }, // PCB
      { x:0,y:0.04,z:0,w:0.1,h:0.04,d:0.1,col:0x111111,em:0xffaa00,ei:0.5 }, // Chip
    ]},
    bme280: { home:[-0.35, 0.15, 0.25], boxes:[
      { x:0,y:0,z:0,w:0.18,h:0.03,d:0.16,col:0x221144 }, // PCB
      { x:0,y:0.04,z:0,w:0.08,h:0.03,d:0.07,col:0x888888,em:0xff5522,ei:0.6 }, // Metal cap
    ]},
    mq2: { home:[0.55, 0.1, 0], boxes:[
      { x:0,y:0,z:0,w:0.25,h:0.1,d:0.25,col:0x444444 }, // Base
      { x:0,y:0.12,z:0,w:0.15,h:0.12,d:0.15,col:0x1a0028,em:0xcc44ff,ei:0.8 }, // Mesh
    ]},
    ldr: { home:[-0.55, 0.1, 0], boxes:[
      { x:0,y:0,z:0,w:0.15,h:0.06,d:0.15,col:0x2a2212 },
      { x:0,y:0.06,z:0,w:0.08,h:0.02,d:0.08,col:0xffdd44,em:0xffdd44,ei:0.9 }, // Active element
    ]},

    // ── ACTUATORS ───────────────────────────────────────────────────────────
    mg90s: { home:[0, 0.95, 0], boxes:[
      { x:0,y:0,z:0,  w:0.28,h:0.22,d:0.15,col:0x002255,em:0x44aaff,ei:0.3 }, // Body
      { x:0,y:0.15,z:0,w:0.08,h:0.08,d:0.08,col:0x777777 }, // Shaft
      { x:0,y:0.22,z:0,w:0.5,h:0.03,d:0.05,col:0xeeeeee }, // Arm
    ]},
    l298n: { home:[0, -0.2, -0.4], boxes:[
      { x:0,y:0,z:0,  w:0.5,h:0.1,d:0.45,col:0x111111 }, // Main plate
      { x:0,y:0.1,z:0, w:0.2,h:0.15,d:0.3,col:0x220008,em:0xff3366,ei:0.6 }, // Large heatsink
      { x:-0.15,y:0.1,z:0.15,w:0.08,h:0.12,d:0.08,col:0x004400 }, // Caps
      { x:0.15,y:0.1,z:0.15, w:0.08,h:0.12,d:0.08,col:0x004400 },
    ]},
    n20: { home:[0.85, -0.45, 0.1], boxes:[
      { x:0,y:0,z:0,   w:0.2,h:0.2,d:0.12, col:0x111111, shape:'cylinder', rz:Math.PI/2 }, // Wheel R
      { x:-0.1,y:0,z:0, w:0.12,h:0.12,d:0.3, col:0x555555, em:0x06FFA5, ei:0.2 }, // Motor body
    ]},
    n20b: { home:[-0.85, -0.45, 0.1], boxes:[
      { x:0,y:0,z:0,   w:0.2,h:0.2,d:0.12, col:0x111111, shape:'cylinder', rz:Math.PI/2 }, // Wheel L
      { x:0.1,y:0,z:0,  w:0.12,h:0.12,d:0.3, col:0x555555, em:0x06FFA5, ei:0.2 }, // Motor body
    ]},
    buzzer: { home:[0.6, 0.4, 0.4], boxes:[
      { x:0,y:0,z:0,w:0.15,h:0.1,d:0.15,col:0x111111,em:0xffbe0b,ei:0.75 }, // Piezo housing
      { x:0,y:0.06,z:0,w:0.04,h:0.02,d:0.04,col:0x000000 }, // Center hole
    ]},

    // ── HAPTICS & AURA ──────────────────────────────────────────────────────
    vibration: { home:[0, -0.15, 0.5], boxes:[
      { x:-0.2,y:0,z:0,w:0.12,h:0.08,d:0.12,col:0x1a0a2a,em:0x8338ec,ei:0.8 }, // Motor L
      { x: 0.2,y:0,z:0,w:0.12,h:0.08,d:0.12,col:0x1a0a2a,em:0x8338ec,ei:0.8 }, // Motor R
      // NeoPixel aura ring - Expanded and brighter
      ...Array.from({length:12},(_,i)=>({ x:Math.sin(i*Math.PI/6)*0.7,y:-0.1,z:Math.cos(i*Math.PI/6)*0.7-0.5,w:0.08,h:0.04,d:0.08,col:0x0a0a22,em:0x8338ec,ei:0.95 })),
    ]},

    // ── POWER SECTOR ────────────────────────────────────────────────────────
    battery: { home:[0, 0.2, -0.75], boxes:[
      { x:0,y:0,z:0,  w:0.65,h:0.25,d:0.3,col:0x1a1200 }, // Battery holder
      { x:-0.15,y:0.12,z:0,w:0.25,h:0.04,d:0.22,col:0x33b5e5,em:0x33b5e5,ei:0.4 }, // Cell 1 blue wrap
      { x: 0.15,y:0.12,z:0,w:0.25,h:0.04,d:0.22,col:0x33b5e5,em:0x33b5e5,ei:0.4 }, // Cell 2
      { x:0,y:-0.05,z:0, w:0.7,h:0.15,d:0.35, col:0x111111 }, // Bottom casing
    ]},
    relay: { home:[-0.6, 0.4, 0.4], boxes:[
      { x:0,y:0,z:0,w:0.22,h:0.15,d:0.18,col:0x1a051a,em:0xFF006E,ei:0.6 }, // Relay body
      { x:0,y:0.1,z:0.05,w:0.15,h:0.05,d:0.1,col:0x333333 }, // Terminal block
    ]},
    ld33cv: { home:[-0.4, -0.1, -0.5], boxes:[
      { x:0,y:0,z:0,w:0.18,h:0.12,d:0.1,col:0x001a33,em:0x3a86ff,ei:0.8 }, // TO-220 body
      { x:0,y:0.15,z:0,w:0.18,h:0.02,d:0.1,col:0x444444 }, // Tab
    ]},
  };
}

const EXPLODE_LOCS: Record<string,[number,number,number]> = {
  body:      [  0,    0,    0   ],
  gc9a01:   [  0,    3.5,  2.5 ],
  hcsr04:   [  0,    2.5,  4.0 ],
  esp32s3:  [  0,    0.5,  0   ],
  mpu6050:  [  3.0,  2.0,  1.5 ],
  bme280:   [ -3.0,  2.0,  1.5 ],
  mq2:      [  4.5,  0.5,  0   ],
  ldr:      [ -4.5,  0.5,  0   ],
  mg90s:    [  0,    4.5,  0   ],
  l298n:    [  0,   -1.5, -3.5 ],
  n20:      [  5.0, -2.0,  0   ],
  n20b:     [ -5.0, -2.0,  0   ],
  buzzer:   [  4.0,  2.0,  2.5 ],
  vibration:[  0,   -0.5,  3.5 ],
  battery:  [  0,    0.5, -4.5 ],
  relay:    [ -4.0,  2.0,  2.5 ],
  ld33cv:   [ -3.0, -1.5, -3.5 ],
};

// Helper: Get parts ordered spatially clockwise in the X-Z plane
function getClockwiseOrderedIds(): string[] {
  return Object.entries(EXPLODE_LOCS)
    .map(([id, pos]) => ({ id, angle: Math.atan2(pos[2], pos[0]) }))
    .sort((a, b) => a.angle - b.angle)
    .map(x => x.id);
}

type Phase = 'assembled' | 'exploding' | 'exploded' | 'assembling' | 'done';
declare global { interface Window { THREE: any; } }

function loadThree(cb: () => void) {
  if (window.THREE) { cb(); return; }
  const ex = document.querySelector('script[src*="three"]');
  if (ex) { const p = setInterval(() => { if (window.THREE) { clearInterval(p); cb(); } }, 30); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

export default function ExploreEngine({ onBack }: ExploreEngineProps) {
  const [phase, setPhase]                   = useState<Phase>('assembled');
  const [autoRot, setAutoRot]               = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureLog, setGestureLog]         = useState('✊ FIST + OPEN = BLAST  ·  CLICK HOTSPOT FOR INFO');
  const [selectedPart, setSelectedPart]     = useState<typeof KAI_PARTS[0] | null>(null);
  const [isListening, setIsListening]       = useState(false);
  const [isTalking, setIsTalking]           = useState(false);
  const [transcript, setTranscript]         = useState('');
  const [lastResponse, setLastResponse]     = useState('');
  const [hotspotScreenPos, setHotspotScreenPos] = useState<{x:number;y:number}|null>(null);
  const [showSuccess, setShowSuccess]       = useState(false);
  const [handGesture, setHandGesture]       = useState<string>('none');
  const [handPtr, setHandPtr]               = useState<{x:number;y:number}|null>(null);
  const [displayZoom, setDisplayZoom]       = useState(6);
  const [hoveredHotspot, setHoveredHotspot] = useState(false);
  const [hoveredPartId, setHoveredPartId]   = useState<string | null>(null);
  const [hoveredPartPos, setHoveredPartPos] = useState<{ x: number; y: number } | null>(null);
  const [pinchSelectedIndex, setPinchSelectedIndex] = useState<number>(-1);
  const [isDragging, setIsDragging]         = useState(false);
  const [showHelp, setShowHelp]             = useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const faceCanvas  = useRef<HTMLCanvasElement | null>(null);
  const faceTexture = useRef<any>(null);
  const sceneRef    = useRef<any>(null);
  const cameraRef   = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const rootGroup   = useRef<any>(null);
  const animRef     = useRef<number|null>(null);
  const mountedRef  = useRef(false);
  const partGroup   = useRef<Map<string,any>>(new Map());
  const partTarget  = useRef<Map<string,[number,number,number]>>(new Map());
  const hotspotsRef = useRef<any[]>([]);
  const selectedRef = useRef<typeof KAI_PARTS[0]|null>(null);
  const rotRef      = useRef({ theta:0.4, phi:1.1 });
  const autoRotRef  = useRef(true);
  const targetZoom  = useRef(6);
  const curZoom     = useRef(6);
  const camDrag     = useRef({ on:false, lx:0, ly:0 });
  const phaseRef    = useRef<Phase>('assembled');
  const raycaster   = useRef<any>(null);
  const mouse3D     = useRef<any>(null);
  const pinchTimer  = useRef<number>(0);
  const orderedIds  = useRef<string[]>(getClockwiseOrderedIds());

  useEffect(() => { phaseRef.current  = phase; },     [phase]);
  useEffect(() => { autoRotRef.current = autoRot; }, [autoRot]);

  const resizeRenderer = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !rendererRef.current || !cameraRef.current) return;
    const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    rendererRef.current.setSize(w,h); cameraRef.current.aspect = w/h; cameraRef.current.updateProjectionMatrix();
  }, []);

  const projectToScreen = useCallback((wx:number,wy:number,wz:number):{x:number;y:number}|null => {
    if (!cameraRef.current || !canvasRef.current || !window.THREE) return null;
    const v = new window.THREE.Vector3(wx,wy,wz).project(cameraRef.current);
    const r = canvasRef.current.getBoundingClientRect();
    return { x:(v.x+1)/2*r.width+r.left, y:(-v.y+1)/2*r.height+r.top };
  }, []);

  const buildHotspots = useCallback(() => {
    if (!rootGroup.current || !window.THREE) return;
    const THREE = window.THREE;
    hotspotsRef.current.forEach(h => { rootGroup.current.remove(h); });
    hotspotsRef.current = [];
    KAI_PARTS.forEach(d => {
      const orbMat = new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.88 });
      const orb    = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), orbMat);
      orb.position.set(...d.pos);
      const ringMat = new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.45, side: 2 });
      const ring    = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 24), ringMat);
      orb.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      orb.add(dot);
      orb.userData = { ...d, isHotspot: true };
      rootGroup.current.add(orb);
      hotspotsRef.current.push(orb);
    });
    raycaster.current = new THREE.Raycaster();
    mouse3D.current   = new THREE.Vector2();
  }, [projectToScreen]);

  // ── Neural AI Chat Logic (Synced with Experience Engine) ───────────────────

  const handleQuery = (query: string) => {
    const q = query.toLowerCase();
    let response = "I am KAI. How can I assist with your NMIMS project?";
    if (q.includes("name")) response = "My name is KAI. I am an architectural synthesis developed for COA studies.";
    else if (q.includes("prof") || q.includes("gautam")) response = "This project is submmited to Dr. Divya Gautam at NMIMS.";
    else if (q.includes("team") || q.includes("who made")) response = "KAI was created by Srishti Jain, Diksha Rathi, and Tanay Trivedi.";
    else if (q.includes("city")) response = "I am stationed at the SVKM NMIMS Mumbai campus.";
    else if (q.includes("hello") || q.includes("hi")) response = "Neural link established. Systems nominal.";

    setLastResponse(response);
    speak(response);
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.8;
    utterance.rate = 1.1;
    utterance.onstart = () => setIsTalking(true);
    utterance.onend = () => setIsTalking(false);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => { setIsListening(true); setTranscript('Listening...'); };
    recognition.onresult = (event: any) => {
      const msg = event.results[0][0].transcript;
      setTranscript(msg);
      handleQuery(msg);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const drawFace = (t: number) => {
    if (!faceCanvas.current || !faceTexture.current) return;
    const ctx = faceCanvas.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#06FFA5';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#06FFA5';

    if (isTalking) {
      ctx.beginPath();
      ctx.lineWidth = 6;
      for(let i=0; i<80; i+=5) {
        const h = Math.sin(t * 30 + i) * 30;
        ctx.moveTo(88+i, 180-h/2); ctx.lineTo(88+i, 180+h/2);
      }
      ctx.stroke();
    }

    // Idle Scanning Arcs (Truthful Primitives)
    const scanOffset = Math.sin(t*2)*10;
    ctx.beginPath(); ctx.arc(100+scanOffset, 128, 20, 0, Math.PI, true); ctx.stroke();
    ctx.beginPath(); ctx.arc(156+scanOffset, 128, 20, 0, Math.PI, true); ctx.stroke();

    faceTexture.current.needsUpdate = true;
  };

  const buildKai = useCallback(() => {
    if (!rootGroup.current || !window.THREE) return;
    const THREE = window.THREE;
    const root  = rootGroup.current;
    // Remove non-hotspot children
    const toRemove: any[] = [];
    root.children.forEach((c: any) => { if (!c.userData?.isHotspot) toRemove.push(c); });
    toRemove.forEach(c => root.remove(c));
    partGroup.current.clear(); partTarget.current.clear();

    Object.entries(getKaiBoxes()).forEach(([id, { home, boxes }]) => {
      const pg = new THREE.Group(); pg.userData.partId = id;
      boxes.forEach(b => {
        let mat;
        if (id === 'gc9a01' && b.shape === 'circle') {
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 256;
          faceCanvas.current = canvas;
          const texture = new THREE.CanvasTexture(canvas);
          faceTexture.current = texture;
          mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.9 });
        } else {
          mat = new THREE.MeshStandardMaterial({ 
            color: b.col, 
            roughness: 0.6, 
            metalness: 0.4,
            emissive: b.em !== undefined ? new THREE.Color(b.em) : undefined,
            emissiveIntensity: b.ei ?? 0.2
          });
        }
        
        let geom;
        if (b.shape === 'sphere') geom = new THREE.SphereGeometry(b.w, 32, 24);
        else if (b.shape === 'cylinder') geom = new THREE.CylinderGeometry(b.w, b.h, b.d, 32);
        else if (b.shape === 'circle') geom = new THREE.CircleGeometry(b.w, 32);
        else geom = new THREE.BoxGeometry(b.w, b.h, b.d);
        
        const m = new THREE.Mesh(geom, mat);
        m.userData.baseEI = b.ei ?? 0.2;
        m.position.set(b.x, b.y, b.z);
        if (b.rx) m.rotation.x = b.rx;
        if (b.ry) m.rotation.y = b.ry;
        if (b.rz) m.rotation.z = b.rz;
        m.userData.partId = id; pg.add(m);
      });
      pg.position.set(home[0], home[1], home[2]); root.add(pg);
      partGroup.current.set(id, pg); partTarget.current.set(id, [home[0], home[1], home[2]]);
    });
    
    // Virtual I2S Markers
    const micMark = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x06FFA5, emissive: 0x06FFA5, emissiveIntensity: 1.0 }));
    micMark.position.set(0.15, 0.55, 0.8); micMark.rotation.x = Math.PI/2; root.add(micMark);
    
    const speakerMark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    speakerMark.position.set(-0.15, 0.5, 0.82); speakerMark.rotation.x = Math.PI/2; root.add(speakerMark);
  }, []);

  const startLoopRef = useRef<() => void>(() => {});
  startLoopRef.current = () => {
    const loop = () => {
      if (!cameraRef.current || !rendererRef.current || !sceneRef.current) { animRef.current = requestAnimationFrame(loop); return; }
      if (autoRotRef.current && (phaseRef.current === 'assembled' || phaseRef.current === 'done')) rotRef.current.theta += 0.004;
      const zt = (phaseRef.current === 'exploded' || phaseRef.current === 'exploding') ? targetZoom.current + 5 : targetZoom.current;
      curZoom.current += (zt - curZoom.current) * 0.08;
      const { theta, phi } = rotRef.current; const r = curZoom.current;
      cameraRef.current.position.set(r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.cos(theta));
      cameraRef.current.lookAt(0,0,0);
      
      // Face Animation
      if (faceCanvas.current && faceTexture.current) {
        drawFace(performance.now() * 0.001);
      }
      // Animate hotspots
      const t = Date.now() * 0.001;
      hotspotsRef.current.forEach((h, i) => {
        const visible = phaseRef.current === 'assembled' || phaseRef.current === 'done';
        h.visible = visible;
        if (visible) {
          const s = 1 + Math.sin(t * 2.5 + i * 0.9) * 0.25;
          h.scale.set(s,s,s);
          if (h.children[0]) h.children[0].rotation.z = t * 1.2 + i;
        }
      });
      // Update selected hotspot position
      if (selectedRef.current) {
        const sel = selectedRef.current; const pos = projectToScreen(sel.pos[0], sel.pos[1], sel.pos[2]);
        if (pos) setHotspotScreenPos(pos);
      }
      // Lerp parts to targets
      let settled = true;
      partTarget.current.forEach((tgt, id) => {
        const pg = partGroup.current.get(id); if (!pg) return;
        const dx = tgt[0]-pg.position.x, dy = tgt[1]-pg.position.y, dz = tgt[2]-pg.position.z;
        const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
        const speed = phaseRef.current === 'exploding' ? 0.055 : 0.075;
        if (dist > 0.01) { settled = false; pg.position.x+=dx*speed; pg.position.y+=dy*speed; pg.position.z+=dz*speed; }
        else pg.position.set(tgt[0],tgt[1],tgt[2]);
      });
      if (settled && phaseRef.current === 'exploding') { phaseRef.current = 'exploded'; setPhase('exploded'); setPinchSelectedIndex(0); }
      if (settled && phaseRef.current === 'assembling') { phaseRef.current = 'done'; setPhase('done'); autoRotRef.current = true; setAutoRot(true); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 5000); setPinchSelectedIndex(-1); }
      
      // If we are in exploded phase, check if all parts have returned home
      if (phaseRef.current === 'exploded') {
        let allHome = true;
        const boxes = getKaiBoxes();
        partTarget.current.forEach((tgt, id) => {
          const home = boxes[id].home;
          if (Math.abs(tgt[0] - home[0]) > 0.01 || Math.abs(tgt[1] - home[1]) > 0.01 || Math.abs(tgt[2] - home[2]) > 0.01) allHome = false;
        });
        if (allHome) { phaseRef.current = 'done'; setPhase('done'); autoRotRef.current = true; setAutoRot(true); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 5000); setPinchSelectedIndex(-1); }
      }

      // Select pulse for pinch reassembly
      if (phaseRef.current === 'exploded' && pinchSelectedIndex !== -1) {
        const ids = orderedIds.current;
        const selectedId = ids[pinchSelectedIndex % ids.length];
        const pg = partGroup.current.get(selectedId);
        if (pg) {
          const s = 1.0 + Math.sin(t * 10) * 0.08;
          pg.scale.set(s, s, s);
          // Boost emissive if meshes have it
          pg.children.forEach((c: any) => {
            if (c.material?.emissive) {
              c.material.emissiveIntensity = (c.material.userData.baseEI ?? 0.2) + Math.abs(Math.sin(t * 10)) * 1.5;
            }
          });
        }
        // Reset others
        ids.forEach((id, idx) => {
          if (idx !== (pinchSelectedIndex % ids.length)) {
            const opg = partGroup.current.get(id);
            if (opg) {
              opg.scale.set(1, 1, 1);
              opg.children.forEach((c: any) => {
                if (c.material?.emissive) c.material.emissiveIntensity = c.material.userData.baseEI ?? 0.2;
              });
            }
          }
        });
      } else {
        partGroup.current.forEach(pg => {
          pg.scale.set(1, 1, 1);
          pg.children.forEach((c: any) => {
            if (c.material?.emissive) c.material.emissiveIntensity = c.material.userData.baseEI ?? 0.2;
          });
        });
      }

      // Update sticky Hover HUD position
      if (phaseRef.current === 'exploded' && hoveredPartId) {
        const pg = partGroup.current.get(hoveredPartId);
        if (pg) {
          const pos = projectToScreen(pg.position.x, pg.position.y, pg.position.z);
          if (pos) setHoveredPartPos(pos);
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  const setupScene = () => {
    if (!canvasRef.current || !window.THREE || mountedRef.current) return;
    mountedRef.current = true;
    const THREE = window.THREE, canvas = canvasRef.current;
    const W = canvas.clientWidth || 800, H = canvas.clientHeight || 540;
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(50, W/H, 0.01, 200);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(W,H); renderer.setClearColor(0x050510,1); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    
    // Ambient and Hemisphere lighting for uniform visibility
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1.0));
    
    const dl  = new THREE.DirectionalLight(0xffffff,2.5); dl.position.set(6,10,7); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x88ccff,1.5); dl2.position.set(-6,5,-4); scene.add(dl2);
    const pl1 = new THREE.PointLight(0x06FFA5,5,25); pl1.position.set(-4,6,-4); scene.add(pl1);
    const pl2 = new THREE.PointLight(0x00d4ff,4,20); pl2.position.set(4,5,4);  scene.add(pl2);
    
    const root = new THREE.Group(); scene.add(root);
    sceneRef.current=scene; cameraRef.current=camera; rendererRef.current=renderer; rootGroup.current=root;
    buildKai(); buildHotspots(); startLoopRef.current(); window.addEventListener('resize',resizeRenderer);
  };

  useEffect(() => { loadThree(setupScene); return () => { if(animRef.current) cancelAnimationFrame(animRef.current); window.removeEventListener('resize',resizeRenderer); mountedRef.current=false; }; }, []); // eslint-disable-line

  const triggerBlast = useCallback(() => {
    if (phaseRef.current !== 'assembled' && phaseRef.current !== 'done') return;
    setPhase('exploding'); phaseRef.current = 'exploding';
    setAutoRot(false); autoRotRef.current = false;
    setSelectedPart(null); selectedRef.current = null; setHotspotScreenPos(null);
    musicEngine.playSfx(180);
    rotRef.current = { theta: 0, phi: Math.PI / 2.2 };
    Object.entries(EXPLODE_LOCS).forEach(([id, pos]) => partTarget.current.set(id, pos));
  }, []);

  const triggerAssemble = useCallback(() => {
    if (phaseRef.current !== 'exploded') return;
    setPhase('assembling'); phaseRef.current = 'assembling';
    musicEngine.playSfx(900);
    const boxes = getKaiBoxes();
    Object.entries(boxes).forEach(([id, { home }]) => partTarget.current.set(id, home));
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (camDrag.current.on) return;
    if (phaseRef.current !== 'assembled' && phaseRef.current !== 'done' && phaseRef.current !== 'exploded') return;
    if (!cameraRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const rect  = canvasRef.current!.getBoundingClientRect();
    mouse3D.current.set(((e.clientX - rect.left)/rect.width)*2-1, -((e.clientY - rect.top)/rect.height)*2+1);
    raycaster.current.setFromCamera(mouse3D.current, cameraRef.current);

    if (phaseRef.current === 'assembled' || phaseRef.current === 'done') {
      const hits = raycaster.current.intersectObjects(hotspotsRef.current, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.isHotspot) obj = obj.parent;
        if (obj?.userData.isHotspot) {
          const part = KAI_PARTS.find(p => p.id === obj.userData.id) ?? obj.userData;
          setSelectedPart(part); selectedRef.current = part;
          const pos = projectToScreen(part.pos[0], part.pos[1], part.pos[2]);
          if (pos) setHotspotScreenPos(pos);
          musicEngine.playSfx(900);
        }
      } else {
        setSelectedPart(null); selectedRef.current = null; setHotspotScreenPos(null);
      }
    } else if (phaseRef.current === 'exploded') {
      const parts = Array.from(partGroup.current.values());
      const hits = raycaster.current.intersectObjects(parts, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.partId) obj = obj.parent;
        if (obj?.userData.partId) {
          const pid = obj.userData.partId;
          const home = getKaiBoxes()[pid].home;
          partTarget.current.set(pid, home);
          musicEngine.playSfx(1000);
        }
      }
    }
  };

  const pointerDownAt = useRef<{x:number;y:number}|null>(null);
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    camDrag.current = { on: false, lx: e.clientX, ly: e.clientY };
    pointerDownAt.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    // Raycast for hotspot hover feedback
    if ((phaseRef.current === 'assembled' || phaseRef.current === 'done') && cameraRef.current && window.THREE) {
      const rect = canvasRef.current!.getBoundingClientRect();
      mouse3D.current.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.current.setFromCamera(mouse3D.current, cameraRef.current);
      const hits = raycaster.current.intersectObjects(hotspotsRef.current, true);
      const isOver = hits.length > 0;
      if (isOver !== hoveredHotspot) setHoveredHotspot(isOver);
    }

    // Raycast for part hover in exploded phase
    if (phaseRef.current === 'exploded' && cameraRef.current && window.THREE) {
      const rect = canvasRef.current!.getBoundingClientRect();
      mouse3D.current.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.current.setFromCamera(mouse3D.current, cameraRef.current);
      const parts = Array.from(partGroup.current.values());
      const hits = raycaster.current.intersectObjects(parts, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.partId) obj = obj.parent;
        const pid = obj?.userData.partId;
        if (pid !== hoveredPartId) {
          setHoveredPartId(pid);
          if (pid) {
            const pg = partGroup.current.get(pid);
            if (pg) {
              const pos = projectToScreen(pg.position.x, pg.position.y, pg.position.z);
              setHoveredPartPos(pos);
            }
          } else setHoveredPartPos(null);
        }
      } else {
        if (hoveredPartId) { setHoveredPartId(null); setHoveredPartPos(null); }
      }
    }

    const dx = e.clientX - camDrag.current.lx, dy = e.clientY - camDrag.current.ly;
    if (pointerDownAt.current && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) { 
      camDrag.current.on = true; 
      autoRotRef.current = false; 
      setAutoRot(false); 
    }
    
    if (camDrag.current.on && pointerDownAt.current) {
      rotRef.current.theta -= dx * 0.007;
      rotRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, rotRef.current.phi - dy * 0.007));
    }
    camDrag.current.lx = e.clientX; camDrag.current.ly = e.clientY;
  };
  const handlePointerUp = () => { camDrag.current.on = false; pointerDownAt.current = null; setIsDragging(false); };

  const touchRef = useRef<{dist:number}|null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY; touchRef.current={dist:Math.hypot(dx,dy)}; }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY, d=Math.hypot(dx,dy);
      targetZoom.current = Math.max(2,Math.min(12,targetZoom.current+(touchRef.current.dist-d)*0.02));
      setDisplayZoom(+targetZoom.current.toFixed(1));
      touchRef.current.dist=d;
    }
  };

  const nudgeZoom = (d: number) => { targetZoom.current=Math.max(2,Math.min(12,targetZoom.current+d)); setDisplayZoom(+targetZoom.current.toFixed(1)); };
  const handleWheel = (e: React.WheelEvent) => { const d=e.deltaMode===1?e.deltaY*40:e.deltaY; targetZoom.current=Math.max(2,Math.min(12,targetZoom.current+d*0.004)); setDisplayZoom(+targetZoom.current.toFixed(1)); };

  const handleGesture = useCallback((g: GestureState) => {
    if (g.rawX !== undefined && g.rawY !== undefined) {
      if (g.type !== 'none') { setHandPtr({x:(1-g.rawX)*window.innerWidth, y:g.rawY*window.innerHeight}); setHandGesture(g.type); }
      else { setHandPtr({x:(1-g.rawX)*window.innerWidth, y:g.rawY*window.innerHeight}); setHandGesture('none'); }
    } else { setHandPtr(null); setHandGesture('none'); }

    // Index rotation
    if (g.type === 'index') {
      const vx = g.velX ?? 0, vy = g.velY ?? 0;
      if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
        setGestureLog('☝ Index Ptr → Rotating…');
        autoRotRef.current = false; setAutoRot(false);
        rotRef.current.theta -= vx * 10;
        rotRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, rotRef.current.phi + vy * 10));
      }
      return;
    }

    if (g.type === 'pinch') {
      if (phaseRef.current === 'exploded') {
        const now = Date.now();
        if (now - pinchTimer.current > 600) {
          setGestureLog('🤏 Pinch Held → Sequential Selection (Auto-Cycle)');
          setPinchSelectedIndex(prev => prev + 1);
          musicEngine.playSfx(700);
          pinchTimer.current = now;
        }
      }
      return;
    }

    if (g.type === 'open') {
      if (g.blastFired && (phaseRef.current === 'assembled' || phaseRef.current === 'done')) {
        setGestureLog('💥 BLASTING…'); triggerBlast();
      } else if (phaseRef.current === 'exploded' && pinchSelectedIndex !== -1) {
        const ids = orderedIds.current;
        const selectedId = ids[pinchSelectedIndex % ids.length];
        setGestureLog(`✋ Push → ${selectedId.toUpperCase()} Returning Home`);
        const home = getKaiBoxes()[selectedId].home;
        partTarget.current.set(selectedId, home);
        musicEngine.playSfx(1000);
      } else {
        setGestureLog('✋ Open → Zooming IN');
        nudgeZoom(-0.5);
      }
      return;
    }

    if (g.type === 'fist') {
      setGestureLog('✊ Fist → Zooming OUT');
      nudgeZoom(0.5);
      return;
    }

    setGestureLog('☝ Rotate · 🤏 Pinch (Select) · ✋ Open (Push Home) · ✊ Fist (Zoom Out)');
  }, [triggerBlast, triggerAssemble, nudgeZoom, pinchSelectedIndex]);

  useEffect(() => { if(gestureEnabled){ gestureController.subscribe(handleGesture); return()=>gestureController.unsubscribe(handleGesture); } else { setHandPtr(null); } }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) { gestureController.stop(); setGestureEnabled(false); musicEngine.playSfx(400); return; }
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera unavailable.'); return; }
    try { const ok=await gestureController.init(); if(ok){setGestureEnabled(true);musicEngine.playSfx(900);} else alert('Gesture engine failed.'); }
    catch(err){alert(`${err}`);}
  };

  const getInfoStyle = (): React.CSSProperties => {
    if (!hotspotScreenPos) return { display: 'none' };
    const bW=340, bH=180, vw=window.innerWidth, vh=window.innerHeight;
    let left=hotspotScreenPos.x-bW/2, top=hotspotScreenPos.y-bH-28;
    if (left<8) left=8; if(left+bW>vw-8) left=vw-bW-8;
    if (top<60) top=hotspotScreenPos.y+28; if(top+bH>vh-8) top=vh-bH-8;
    return { position:'fixed', left, top, zIndex:150, width:bW, pointerEvents:'auto' };
  };

  const handColor = () => {
    switch(handGesture){ case 'pinch': return '#ff006e'; case 'fist': return '#ff8800'; case 'open': return '#06FFA5'; default: return 'rgba(200,200,200,0.5)'; }
  };

  const isAssembled = phase === 'assembled' || phase === 'done';
  const isExploded  = phase === 'exploded';

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#050510' }}>
      <canvas ref={canvasRef}
        onClick={handleCanvasClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { touchRef.current=null; }}
        style={{ width:'100%', height:'100%', display:'block', touchAction:'none', cursor: isDragging ? 'grabbing' : (hoveredHotspot ? 'pointer' : 'default') }}
      />

      {/* Hand gesture pointer */}
      {gestureEnabled && handPtr && (
        <div style={{ position:'fixed', left:handPtr.x, top:handPtr.y, transform:'translate(-50%,-50%)', zIndex:1000, pointerEvents:'none', transition:'left 0.04s linear,top 0.04s linear' }}>
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:handGesture==='pinch'?18:28, height:handGesture==='pinch'?18:28, borderRadius:'50%', border:`2px solid ${handColor()}`, opacity:handGesture==='none'?0.3:0.7, boxShadow:`0 0 12px ${handColor()}88` }} />
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:handColor(), boxShadow:`0 0 8px ${handColor()}` }} />
        </div>
      )}

      {/* Top controls */}
      <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, display:'flex', gap:8, padding:'10px 14px', alignItems:'center', flexWrap:'wrap', background:'rgba(5,5,16,0.88)', backdropFilter:'blur(6px)', borderBottom:'1px solid rgba(0,212,255,0.12)' }}>
        <button onClick={onBack} style={{ fontFamily:"'Press Start 2P',cursive", background:'#000', border:'3px solid #FFBE0B', color:'#FFBE0B', padding:'7px 12px', fontSize:'0.48rem', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}><ArrowLeft size={11}/> EXIT</button>
        <button onClick={() => { const n=!autoRotRef.current; autoRotRef.current=n; setAutoRot(n); }} style={{ background:autoRot?'rgba(6,255,165,0.18)':'#000', border:`2px solid ${autoRot?'#06FFA5':'#444'}`, color:autoRot?'#06FFA5':'#444', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><RotateCcw size={13}/></button>
        <button onClick={toggleGesture} style={{ background:gestureEnabled?'rgba(6,255,165,0.18)':'#000', border:`2px solid ${gestureEnabled?'#06FFA5':'#555'}`, color:gestureEnabled?'#06FFA5':'#555', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Hand size={13}/></button>
        <button onClick={()=>nudgeZoom(-0.8)} style={{ background:'#000', border:'2px solid #00d4ff', color:'#00d4ff', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><ZoomIn size={13}/></button>
        <button onClick={()=>nudgeZoom(+0.8)} style={{ background:'#000', border:'2px solid #00d4ff', color:'#00d4ff', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><ZoomOut size={13}/></button>
        <button onClick={() => { setShowHelp(v=>!v); musicEngine.playSfx(600); }} style={{ background:showHelp?'rgba(255,190,11,0.18)':'#000', border:`2px solid ${showHelp?'#FFBE0B':'#555'}`, color:showHelp?'#FFBE0B':'#555', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><HelpCircle size={13}/></button>
        <button onClick={() => { targetZoom.current=6; setDisplayZoom(6); rotRef.current={theta:0.4,phi:1.1}; autoRotRef.current=true; setAutoRot(true); }} style={{ background:'#000', border:'2px solid #666', color:'#888', padding:'0 10px', height:36, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem', cursor:'pointer' }}>RESET</button>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem', color:'#00d4ff88', padding:'3px 8px', border:'1px solid #00d4ff22' }}>{displayZoom.toFixed(1)}×</div>

        <div style={{ flex:1, textAlign:'center', pointerEvents:'none' }}>
          <span style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'clamp(0.45rem,1vw,0.7rem)', color:'#06FFA5', textShadow:'0 0 14px #06FFA5', letterSpacing:3 }}>KAI 3D EXPLORE</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem', color:'rgba(6,255,165,0.4)', marginLeft:12 }}>
            {phase==='assembled'&&'AUTO-ROTATING · CLICK HOTSPOTS'}{phase==='exploding'&&'BLASTING…'}{phase==='exploded'&&'EXPLODED · DRAG TO ROTATE · OPEN PALM TO REASSEMBLE'}{phase==='assembling'&&'ASSEMBLING…'}{phase==='done'&&'✓ KAI ASSEMBLED'}
          </span>
        </div>
      </div>

      {/* BLAST / ASSEMBLE CTA */}
      {isAssembled && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', zIndex:150, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'clamp(0.4rem,0.8vw,0.6rem)', color:'rgba(6,255,165,0.72)', background:'rgba(0,4,18,0.82)', padding:'8px 18px', border:'1px solid rgba(6,255,165,0.18)' }}>
            Click <b style={{color:'#06FFA5'}}>BLAST</b> · or ✊ hold fist then ✋ open palm · or click glowing hotspots
          </div>
          <button onClick={triggerBlast} style={{ fontFamily:"'Press Start 2P',cursive", background:'linear-gradient(180deg,#FF006E,#c1004e)', border:'3px solid #000', color:'#fff', padding:'10px 28px', fontSize:'0.5rem', cursor:'pointer', boxShadow:'0 5px 0 #8B0040,0 5px 24px rgba(255,0,110,0.5)', letterSpacing:1 }}
            onMouseDown={e=>{e.currentTarget.style.transform='translateY(4px)';e.currentTarget.style.boxShadow='0 1px 0 #8B0040';}}
            onMouseUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #8B0040,0 5px 24px rgba(255,0,110,0.5)';}}>
            💥 BLAST KAI
          </button>
        </div>
      )}

      {/* REASSEMBLE button in exploded state */}
      {isExploded && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', zIndex:150, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.58rem', color:'rgba(6,255,165,0.7)', background:'rgba(0,4,18,0.82)', padding:'6px 14px', border:'1px solid rgba(6,255,165,0.15)' }}>
            Drag to rotate · ✋ open palm to reassemble
          </div>
          <button onClick={triggerAssemble} style={{ fontFamily:"'Press Start 2P',cursive", background:'linear-gradient(180deg,#06FFA5,#05CC84)', border:'3px solid #000', color:'#000', padding:'10px 24px', fontSize:'0.5rem', cursor:'pointer', boxShadow:'0 5px 0 #048F5F,0 5px 24px rgba(6,255,165,0.5)', letterSpacing:1 }}>
            🔧 REASSEMBLE
          </button>
        </div>
      )}

      {/* Hotspot sidebar */}
      {isAssembled && (
        <div style={{ position:'fixed', top:80, right:16, zIndex:100, display:'flex', flexDirection:'column', gap:3, maxHeight:'calc(100vh - 180px)', overflowY:'auto', pointerEvents:'auto' }}>
          {KAI_PARTS.map(p => (
            <button key={p.id} onClick={() => {
              const isSel = selectedPart?.id === p.id;
              setSelectedPart(isSel ? null : p); selectedRef.current = isSel ? null : p;
              if (!isSel) { const pos = projectToScreen(p.pos[0], p.pos[1], p.pos[2]); if(pos) setHotspotScreenPos(pos); } else setHotspotScreenPos(null);
              musicEngine.playSfx(700);
            }} style={{ background:selectedPart?.id===p.id?`${p.color}33`:'rgba(0,0,0,0.8)', border:`1px solid ${selectedPart?.id===p.id?p.color:p.color+'55'}`, color:p.color, padding:'3px 8px', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.52rem', cursor:'pointer', textAlign:'left', maxWidth:155, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              ● {p.title.split(' ').slice(0,2).join(' ')}
            </button>
          ))}
        </div>
      )}

      {/* Hotspot info card */}
      {selectedPart && hotspotScreenPos && (
        <div style={getInfoStyle()}>
          <div style={{ background:'rgba(0,5,25,0.98)', border:`2px solid ${selectedPart.color}`, borderRadius:8, padding:'14px 18px', boxShadow:`0 6px 40px ${selectedPart.color}55`, position:'relative' }}>
            <button onClick={() => { setSelectedPart(null); selectedRef.current=null; setHotspotScreenPos(null); }} style={{ position:'absolute', top:8, right:10, background:'none', border:'none', color:selectedPart.color, fontSize:15, cursor:'pointer' }}>✕</button>
            <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.52rem', color:selectedPart.color, letterSpacing:2, marginBottom:8 }}>{selectedPart.title}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.7rem', color:'rgba(200,240,255,0.85)', lineHeight:1.7 }}>{selectedPart.info}</div>
          </div>
        </div>
      )}

      {/* Neural AI Interface Overlay */}
      <div style={{ position:'fixed', bottom:100, left:20, zIndex:200, width:300, background:'rgba(5,5,16,0.9)', border:'1px solid #06FFA5', padding:15, borderRadius:8 }}>
        <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.45rem', color:'#06FFA5', marginBottom:10 }}>NEURAL AI STATUS</div>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
          <button onClick={startListening} style={{ background:isListening?'#FF006E':'#06FFA5', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Radio size={16}/></button>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem', color:isListening?'#FF006E':'#06FFA5' }}>{isListening?'LISTENING…':'VOICE READY (NMIMS DB)'}</div>
        </div>
        {transcript && <div style={{ fontSize:'0.65rem', color:'#06FFA5', marginBottom:8 }}>YOU: "{transcript}"</div>}
        {lastResponse && <div style={{ fontSize:'0.65rem', color:'#fff', paddingLeft:8, borderLeft:'2px solid #06FFA5' }}>KAI: {lastResponse}</div>}
      </div>

      {/* Gesture log bar */}
      {gestureEnabled && (
        <div style={{ position:'fixed', bottom:44, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.92)', border:'2px solid #06FFA5', padding:'6px 20px', minWidth:380, textAlign:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.56rem', color:'#06FFA5', zIndex:150, pointerEvents:'none', whiteSpace:'nowrap' }}>
          {gestureLog}
        </div>
      )}

      {/* Part Hover HUD */}
      {phase === 'exploded' && hoveredPartId && hoveredPartPos && (
        <div style={{ position:'fixed', left:hoveredPartPos.x, top:hoveredPartPos.y - 40, transform:'translateX(-50%)', zIndex:160, pointerEvents:'none' }}>
          <div style={{ background:'rgba(0,10,30,0.95)', border:'1px solid #06FFA5', padding:'4px 12px', borderRadius:4, boxShadow:'0 0 20px rgba(6,255,165,0.3)', animation:'fadeInUp 0.3s ease' }}>
            <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.45rem', color:'#06FFA5', letterSpacing:1 }}>{hoveredPartId.toUpperCase()}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.4rem', color:'rgba(6,255,165,0.6)', marginTop:2 }}>CLICK TO REASSEMBLE</div>
          </div>
          <div style={{ width:2, height:15, background:'#06FFA5', margin:'0 auto', opacity:0.6 }} />
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position:'absolute', inset:0, zIndex:300, background:'rgba(5,5,15,0.92)', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ maxWidth:600, width:'100%', background:'rgba(0,0,0,0.85)', border:'3px solid #FFBE0B', padding:30, position:'relative', boxShadow:'0 0 50px rgba(255,190,11,0.2)' }}>
            <button onClick={()=>setShowHelp(false)} style={{ position:'absolute', top:15, right:15, background:'none', border:'none', color:'#FFBE0B', cursor:'pointer' }}><X size={20}/></button>
            <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.8rem', marginBottom:20, textAlign:'center' }}>3D EXPLORE HELP</div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { label:'ROTATE', text:'Use (Index Pointer) gesture or Drag to rotate KAI.' },
                { label:'ZOOM',   text:'Use (Open/Fist) gestures or Scroll to zoom.' },
                { label:'BLAST',  text:'Fist then Open Palm to explode the model.' },
                { label:'REBUILD', text:'Pinch to cycle parts, Open Palm to push home. Or click parts individually.' },
                { label:'RESET',  text:'Resets camera and reassembles everything.' }
              ].map((h,i)=>(
                <div key={i} style={{ display:'flex', gap:12 }}>
                  <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.45rem', width:80, flexShrink:0, marginTop:4 }}>{h.label}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#ddd', fontSize:'0.75rem', lineHeight:1.5 }}>{h.text}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowHelp(false)} style={{ marginTop:30, width:'100%', fontFamily:"'Press Start 2P',cursive", background:'#FFBE0B', border:'none', color:'#000', padding:10, fontSize:'0.5rem', cursor:'pointer' }}>CLOSE HELP</button>
          </div>
        </div>
      )}

      {/* Success banner */}
      {showSuccess && (
        <div style={{ position:'fixed', top:'15%', left:'50%', transform:'translateX(-50%)', zIndex:400 }}>
          <div style={{ background:'rgba(0,10,5,0.98)', border:'2px solid #06FFA5', borderRadius:6, padding:'20px 40px', boxShadow:'0 0 80px rgba(6,255,165,0.55)', textAlign:'center' }}>
            <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'clamp(0.7rem,1.5vw,1.1rem)', color:'#06FFA5', textShadow:'0 0 30px #06FFA5', letterSpacing:4, marginBottom:8 }}>✓ KAI ASSEMBLED</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'rgba(120,255,175,0.82)', fontSize:'0.72rem' }}>Project KAI — Kinetic Artificial Intelligence, operational.</div>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div style={{ position:'fixed', bottom:16, right:16, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.52rem', color:'rgba(6,255,165,0.3)', letterSpacing:2, zIndex:50, pointerEvents:'none' }}>
        DRAG · SCROLL · CLICK HOTSPOT
      </div>

      <style>{`@keyframes fadeInUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }`}</style>
    </div>
  );
}
