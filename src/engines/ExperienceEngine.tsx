import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Play, Sun, Moon, Flame, RefreshCw, Radio, Settings, HelpCircle, X, Activity, Cpu } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface ExperienceEngineProps { onBack: () => void; }

type KAIState = 'IDLE' | 'ENGAGED' | 'ALERT' | 'DROWSY';

const COLORS = {
  accent: '#06FFA5',
  alert: '#FF006E',
  warning: '#FFBE0B',
  info: '#3A86FF',
  bg: '#000412'
};

export default function ExperienceEngine({ onBack }: ExperienceEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<KAIState>('IDLE');
  const [showHelp, setShowHelp] = useState(true);
  const [simValues, setSimValues] = useState({ distance: 100, gas: 400, light: 100, temp: 26.5, humidity: 45, tiltX: 0, tiltY: 0 });
  const [isSummoned, setIsSummoned] = useState(false);
  const [isGasActive, setIsGasActive] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [isTilted, setIsTilted] = useState(false);
  const [isClimateStressed, setIsClimateStressed] = useState(false);
  const [logs, setLogs] = useState<string[]>(['KAI SYSTEM INITIALIZED', 'WAITING FOR SIMULATION INPUT...']);
  
  const rootGroup      = useRef<any>(null);
  const headGroup      = useRef<any>(null);
  const faceMesh       = useRef<any>(null);
  const wheels         = useRef<any[]>([]);
  const cameraRef      = useRef<any>(null);
  const rendererRef    = useRef<any>(null);
  const sceneRef       = useRef<any>(null);
  const mountedRef     = useRef(false);
  const animRef        = useRef<any>(null);

  // Group references for targeted animations
  const chassisParts   = useRef<Map<string, any>>(new Map());
  const faceCanvas     = useRef<HTMLCanvasElement>(null);
  const faceTexture    = useRef<any>(null);
  const soundRings     = useRef<any[]>([]);
  const smokeParticles = useRef<any[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 12));
  };

  // ── 3D Scene Setup ────────────────────────────────────────────────────────

  function loadThree(cb: () => void) {
    if ((window as any).THREE) { cb(); return; }
    const ex = document.querySelector('script[src*="three"]');
    if (ex) { const p = setInterval(() => { if ((window as any).THREE) { clearInterval(p); cb(); } }, 30); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  const setupScene = () => {
    if (!canvasRef.current || !(window as any).THREE || mountedRef.current) return;
    mountedRef.current = true;
    const THREE = (window as any).THREE;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 10, 50); // Restored Fog
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 4.5);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;
 
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    
    // Hemisphere light for better overall visibility
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);

    const spotlight = new THREE.SpotLight(0xffffff, 20);
    spotlight.position.set(2, 5, 2);
    scene.add(spotlight);

    // KAI-specific point light to ensure visibility
    const point = new THREE.PointLight(COLORS.accent, 2, 12);
    point.position.set(0, 1, 1);
    scene.add(point);

    // Path Lighting (Entrance)
    const pathLight = new THREE.PointLight(0x3A86FF, 1.5, 20);
    pathLight.position.set(0, 2, -10);
    scene.add(pathLight);

    // Floor Grid
    const grid = new THREE.GridHelper(20, 40, 0x06FFA5, 0x002233);
    grid.position.y = -0.4;
    scene.add(grid);

    buildKai();
    animate();
  };

  const buildKai = () => {
    const THREE = (window as any).THREE;
    const root = new THREE.Group();
    rootGroup.current = root;
    sceneRef.current.add(root);

    // Dynamic data-driven parts (Simplified Explore Engine spec)
    const boxes = [
      { id: 'chassis', w:0.8, h:0.4, d:0.6, y:0, col:0x1a1a2e, em:0x00d4ff, ei:0.1 },
      { id: 'core',    w:0.4, h:0.2, d:0.4, y:0.1, col:0x16213e, em:0x00ffff, ei:0.25 },
      { id: 'batL',    w:0.15,h:0.04,d:0.25,x:-0.2, y:0.25, col:0x33b5e5, em:0x33b5e5, ei:0.4 },
      { id: 'batR',    w:0.15,h:0.04,d:0.25,x:0.2,  y:0.25, col:0x33b5e5, em:0x33b5e5, ei:0.4 },
      { id: 'trimL',   w:0.04,h:0.3, d:0.5, x:-0.41,y:0, col:0x06FFA5, em:0x06FFA5, ei:0.2 },
      { id: 'trimR',   w:0.04,h:0.3, d:0.5, x:0.41, y:0, col:0x06FFA5, em:0x06FFA5, ei:0.2 },
    ];

    boxes.forEach(b => {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d);
      const m = new THREE.MeshStandardMaterial({ 
        color: b.col, 
        emissive: b.em ? new THREE.Color(b.em) : undefined, 
        emissiveIntensity: b.ei || 0,
        roughness: 0.3,
        metalness: 0.6
      });
      const mesh = new THREE.Mesh(g, m);
      if (b.x) mesh.position.x = b.x;
      if (b.y) mesh.position.y = b.y;
      root.add(mesh);
      chassisParts.current.set(b.id, mesh);
    });

    const wheelGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 32);
    wheelGeom.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.5 });
    
    [-0.45, 0.45].forEach(x => {
      const w = new THREE.Mesh(wheelGeom, wheelMat);
      w.position.set(x, -0.2, 0);
      root.add(w);
      wheels.current.push(w);
    });

    const head = new THREE.Group();
    headGroup.current = head;
    head.position.y = 0.45;
    root.add(head);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 24), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }));
    head.add(headSphere);

    // Screen Group with Canvas Face
    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, 0, 0.28);
    head.add(screenGroup);

    const faceGeom = new THREE.CircleGeometry(0.28, 32);
    // Initialize Canvas for face
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    (faceCanvas as any).current = canvas;
    const texture = new THREE.CanvasTexture(canvas);
    faceTexture.current = texture;

    const faceMat = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.9
    });
    const facePlane = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.current = facePlane;
    screenGroup.add(facePlane);

    // Actuator VFX: Sound Waves (Buzzer)
    const ringGroup = new THREE.Group();
    root.add(ringGroup);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.12, 32),
        new THREE.MeshBasicMaterial({ color: COLORS.warning, transparent: true, opacity: 0 })
      );
      r.rotation.x = -Math.PI/2;
      r.position.y = 0.5;
      ringGroup.add(r);
      soundRings.current.push(r);
    }

    // Screen Glass Cover
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.1, transparent: true, opacity: 0.25 })
    );
    glass.position.set(0, 0, 0.3);
    head.add(glass);

    // Actuator VFX: Smoke Particles for Alert
    const smokeGroup = new THREE.Group();
    root.add(smokeGroup);
    for (let i = 0; i < 20; i++) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0 })
      );
      smokeGroup.add(s);
      smokeParticles.current.push(s);
    }

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.15), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 }));
    visor.position.set(0, -0.1, 0.3);
    head.add(visor);
  };

  const currentZ = useRef(-8); // Start distant
  const targetZ  = useRef(0);

  const animate = () => {
    if (!mountedRef.current) return;
    const THREE = (window as any).THREE;
    const t = performance.now() * 0.001;

    if (rootGroup.current && headGroup.current) {
      // 1. Handle Locomotion (Smooth Rolling)
      const prevZ = currentZ.current;
      currentZ.current += (targetZ.current - currentZ.current) * 0.04; // Slightly slower, smoother lerp
      rootGroup.current.position.z = currentZ.current;

      const deltaZ = currentZ.current - prevZ;
      const wheelRadius = 0.2;
      wheels.current.forEach(w => {
        w.rotation.x -= deltaZ / wheelRadius;
      });

      if (isSummoned && Math.abs(currentZ.current - targetZ.current) < 0.01) {
        setIsSummoned(false);
        addLog("SUMMON COMPLETE - DOCKED AT USER");
      }

      // 2. Handle Head Tilt
      const targetTilt = phase === 'DROWSY' ? 0.6 : (phase === 'ENGAGED' ? -0.2 : 0);
      headGroup.current.rotation.x += (targetTilt - headGroup.current.rotation.x) * 0.08;

      // 3. Handle Dynamic Expressions (Canvas Logic)
      if (faceCanvas.current && faceTexture.current) {
        const ctx = faceCanvas.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 256, 256);
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();

          // Scanlines effect
          ctx.strokeStyle = 'rgba(0,212,255,0.05)';
          for(let i=0; i<256; i+=4) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke(); }

          const color = phase === 'ALERT' ? COLORS.alert : (phase === 'DROWSY' ? COLORS.info : COLORS.accent);
          ctx.fillStyle = color;
          ctx.shadowBlur = 15; ctx.shadowColor = color;

          const blink = Math.sin(t * 4) > 0.95 && phase === 'IDLE';
          
          if (phase === 'ALERT') {
            // X_X Face
            ctx.lineWidth = 12; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.moveTo(60, 80); ctx.lineTo(100, 140); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(100, 80); ctx.lineTo(60, 140); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(156, 80); ctx.lineTo(196, 140); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(196, 80); ctx.lineTo(156, 140); ctx.stroke();
          } else if (phase === 'DROWSY') {
            // Sleepy Slits
            ctx.fillRect(60, 110, 45, 8); ctx.fillRect(151, 110, 45, 8);
          } else if (phase === 'ENGAGED') {
            // Happy ^_^
            ctx.lineWidth = 10; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.arc(80, 140, 30, Math.PI, 0); ctx.stroke();
            ctx.beginPath(); ctx.arc(176, 140, 30, Math.PI, 0); ctx.stroke();
          } else {
            // Normal Round Eyes
            if (!blink) {
              ctx.beginPath(); ctx.arc(80, 128, 25, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(176, 128, 25, 0, Math.PI * 2); ctx.fill();
            }
          }
          faceTexture.current.needsUpdate = true;
        }

        const alertFlash = phase === 'ALERT' && Math.sin(t * 15) > 0;

        // Global Thermal Glow (Chassis Reactions)
        chassisParts.current.forEach((mesh, id) => {
          if (mesh.material.emissive) {
            if (alertFlash) mesh.material.emissive.set(COLORS.alert);
            else if (id === 'core' && phase === 'ENGAGED') mesh.material.emissive.set(COLORS.accent);
            else mesh.material.emissiveIntensity = (id.startsWith('bat') ? 0.4 : 0.1) + Math.abs(Math.sin(t*3)) * 0.2;
          }
        });

        // 4. Actuator VFX: Sound Waves
        soundRings.current.forEach((ring, i) => {
          if (phase === 'ALERT' || phase === 'ENGAGED') {
            const cycle = (t * 2 + i * 0.3) % 1;
            ring.scale.set(1 + cycle * 4, 1 + cycle * 4, 1);
            ring.material.opacity = (1 - cycle) * 0.8;
            ring.visible = true;
          } else {
            ring.visible = false;
          }
        });

        // 5. Physical Tilt Mapping (Dramatic 35-degree tip)
        if (isTilted) {
          rootGroup.current.rotation.z = Math.min(0.8, rootGroup.current.rotation.z + 0.05); // 45-degree tip
          rootGroup.current.position.y = -0.15;
          rootGroup.current.rotation.x = Math.sin(t * 10) * 0.1; // Jitter while tilted
        } else {
          rootGroup.current.rotation.z *= 0.9;
          rootGroup.current.rotation.x *= 0.9;
          rootGroup.current.position.y *= 0.9;
        }

        // 6. Independent Head Scanning & Nodding
        if (phase === 'IDLE') {
          headGroup.current.rotation.y = Math.sin(t * 0.5) * 0.4;
        } else if (phase === 'ENGAGED') {
          headGroup.current.rotation.y = Math.sin(t * 1.5) * 0.2; // Tracking
          headGroup.current.rotation.x = Math.sin(t * 8) * 0.1 - 0.2; // Nodding
        } else if (phase === 'ALERT') {
          headGroup.current.rotation.y = Math.sin(t * 22) * 0.1; // Panic jitter
          // 7. Smoke Particles Logic
          smokeParticles.current.forEach((sm, i) => {
            if (sm.material.opacity <= 0) {
               sm.position.set(0, 0.8, 0);
               sm.material.opacity = 0.8;
               sm.userData.vx = (Math.random()-0.5)*0.05;
               sm.userData.vy = 0.05 + Math.random()*0.05;
               sm.userData.vz = (Math.random()-0.5)*0.05;
            }
            sm.position.x += sm.userData.vx;
            sm.position.y += sm.userData.vy;
            sm.position.z += sm.userData.vz;
            sm.material.opacity -= 0.015;
            sm.scale.multiplyScalar(1.02);
          });
        } else {
          headGroup.current.rotation.y *= 0.95;
          // Fade smokes
          smokeParticles.current.forEach(sm => { sm.material.opacity *= 0.9; });
        }
      }
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animRef.current = requestAnimationFrame(animate);
  };

  // ── Simulation Logic ───────────────────────────────────────────────────────

  useEffect(() => {
    let nextPhase: KAIState = 'IDLE';
    if (simValues.gas > 2500) nextPhase = 'ALERT';
    else if (simValues.distance < 40) nextPhase = 'ENGAGED';
    else if (simValues.light < 20) nextPhase = 'DROWSY';

    if (nextPhase !== phase) {
      setPhase(nextPhase);
      addLog(`PHASE SHIFT → ${nextPhase}`);
      musicEngine.playSfx(nextPhase === 'ALERT' ? 1000 : 700);
    }
  }, [simValues, phase]);

  useEffect(() => { loadThree(setupScene); return () => { mountedRef.current = false; if(animRef.current) cancelAnimationFrame(animRef.current); }; }, []); // eslint-disable-line

  const triggerSummon = () => {
    if (isSummoned) return;
    addLog("SUMMON SIGNAL SENT → N20 PWM CONTROL");
    currentZ.current = -15; // Set to distant view
    targetZ.current = 0;
    setSimValues(v => ({ ...v, distance: 30 }));
    setIsSummoned(true);
    musicEngine.playSfx(200);
  };

  const toggleGas = () => {
    const active = !isGasActive;
    setIsGasActive(active);
    setSimValues(v => ({ ...v, gas: active ? 3200 : 400 }));
    addLog(active ? "MATCHSTICK IGNITED → MQ-2 ANALOG SPIKE detected" : "GAS CLEARED → MQ-2 NORMALIZED");
  };

  const toggleNight = () => {
    const active = !isNight;
    setIsNight(active);
    setSimValues(v => ({ ...v, light: active ? 5 : 100 }));
    addLog(active ? "AMBIENT LIGHT DIMMED → LDR < 20" : "LIGHT RESTORED → LDR NORMALIZED");
  };

  const toggleTilt = () => {
    const active = !isTilted;
    setIsTilted(active);
    setSimValues(v => ({ ...v, tiltX: active ? 45 : 0, tiltY: active ? -20 : 0 }));
    addLog(active ? "PHYSICAL SHAKE DETECTED → MPU6050 INTERRUPT" : "SYSTEM STABILIZED → IMU NORMALIZED");
  };

  const toggleClimate = () => {
    const active = !isClimateStressed;
    setIsClimateStressed(active);
    setSimValues(v => ({ ...v, temp: active ? 34.5 : 26.5, humidity: active ? 85 : 45 }));
    addLog(active ? "ENVIRONMENTAL STRESS → BME280 THRESHOLD" : "CLIMATE STABILIZED");
    if (active) musicEngine.playSfx(500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.bg, color: 'white', fontFamily: "'JetBrains Mono', monospace", display: 'flex' }}>
      {/* 3D Viewport */}
      <canvas ref={canvasRef} style={{ flex: 1, width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Diagnostics HUD (Right Panel) */}
      <div style={{ 
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '320px', 
        background: 'rgba(0,4,18,0.98)', 
        borderLeft: '2px solid rgba(0,212,255,0.15)', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: 20, 
        zIndex: 100, 
        overflowY: 'auto'
      }}>
        <div style={{ borderBottom: '1px solid rgba(0,212,255,0.2)', paddingBottom: 15, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', color: COLORS.accent, marginBottom: 8 }}>DIAGNOSTICS HUD</div>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)' }}>PHASE 4: DIGITAL TWIN SIMULATOR</div>
        </div>

        {/* Telemetry Grid (5 Sensors) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 25 }}>
          {[
            { label: 'DIST (HC-SR04)', val: `${simValues.distance}cm`, color: simValues.distance < 40 ? COLORS.warning : COLORS.accent },
            { label: 'GAS (MQ-2)', val: `${simValues.gas} ADC`, color: simValues.gas > 2500 ? COLORS.alert : COLORS.accent },
            { label: 'LIGHT (LDR)', val: `${simValues.light}%`, color: simValues.light < 20 ? COLORS.info : COLORS.accent },
            { label: 'TEMP (BME280)', val: `${simValues.temp}°C`, color: simValues.temp > 30 ? COLORS.warning : COLORS.accent },
            { label: 'HUMIDITY (BME)', val: `${simValues.humidity}%`, color: COLORS.accent },
            { label: 'TILT (MPU6050)', val: `${simValues.tiltX}°`, color: isTilted ? COLORS.alert : COLORS.accent }
          ].map((t, i) => (
            <div key={i} style={{ border: `1px solid ${t.color}33`, padding: '10px 15px', background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
              <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: '0.75rem', color: t.color, fontWeight: 'bold' }}>{t.val}</div>
            </div>
          ))}
        </div>

        {/* GPIO Pin Map (Simplified) */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 15, marginBottom: 25 }}>
          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.6)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={12} /> GPIO STATUS (LIVE)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as any, gap: 6 }}>
            {[
              { p: 'G12', active: isSummoned, label: 'MOT_L' },
              { p: 'G13', active: isSummoned, label: 'MOT_R' },
              { p: 'G25', active: phase === 'ALERT', label: 'BUZZ' },
              { p: 'G04', active: phase !== 'IDLE', label: 'SERVO' },
              { p: 'G26', active: isClimateStressed, label: 'RELAY' },
              { p: 'G18', active: true, label: 'ECHO' }
            ].map((p, i) => (
              <div key={i} style={{ border: `1px solid ${p.active ? COLORS.accent : 'rgba(255,255,255,0.1)'}`, padding: '4px 6px', borderRadius: 2, fontSize: '0.38rem', color: p.active ? COLORS.accent : 'rgba(255,255,255,0.3)', background: p.active ? `${COLORS.accent}11` : 'none' }}>
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Log Window */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} /> ACTION LOGS
          </div>
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: 10, fontSize: '0.52rem', lineHeight: 1.6 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: i === 0 ? COLORS.accent : 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
                {`> ${l}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Control Tools (6 Interactive Tests) */}
      <div style={{ position: 'fixed', left: 20, top: 100, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 150 }}>
        <button onClick={triggerSummon} disabled={isSummoned} style={{ width: 44, height: 44, borderRadius: '50%', background: isSummoned ? 'rgba(0,0,0,0.5)' : '#3A86FF', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test HC-SR04 Sonar">
          <Radio size={20} />
        </button>
        <button onClick={toggleGas} style={{ width: 44, height: 44, borderRadius: '50%', background: isGasActive ? COLORS.alert : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test MQ-2 Gas">
          <Flame size={20} />
        </button>
        <button onClick={toggleNight} style={{ width: 44, height: 44, borderRadius: '50%', background: isNight ? '#8338EC' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test LDR Light">
          {isNight ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button onClick={toggleTilt} style={{ width: 44, height: 44, borderRadius: '50%', background: isTilted ? COLORS.warning : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test MPU6050 Shake">
          <Activity size={20} />
        </button>
        <button onClick={toggleClimate} style={{ width: 44, height: 44, borderRadius: '50%', background: isClimateStressed ? COLORS.info : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test BME280 Climate">
          <Settings size={20} />
        </button>
        <button onClick={() => { setIsTilted(false); setIsClimateStressed(false); setIsSummoned(false); setIsGasActive(false); setIsNight(false); setSimValues({ distance: 100, gas: 400, light: 100, temp: 26.5, humidity: 45, tiltX: 0, tiltY: 0 }); }} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reset All Sensors">
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Persistent Help HUD (Floating left of Sidebar) */}
      <div style={{ position: 'fixed', bottom: 30, right: 340, background: 'rgba(0,4,18,0.9)', border: `1px solid ${COLORS.accent}`, padding: '12px 20px', borderRadius: 8, zIndex: 100, maxWidth: 280 }}>
        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: COLORS.accent, marginBottom: 8 }}>VIRTUAL TEST GUIDE</div>
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
          {phase === 'IDLE' && "KAI is in Idle. Try using the Summon button (Left) to move it or ignite the Matchstick (MQ-2) to test safety logic."}
          {phase === 'ENGAGED' && "Person detected! Head tilt (Servo) active. N20 motors rolling toward target. Diagnostics show proximity trigger."}
          {phase === 'ALERT' && "DANGER! Gas threshold exceeded. Face turns red, Buzzer (G25) is firing. Clear the gas to reset KAI."}
          {phase === 'DROWSY' && "Environment is dark. KAI has entered sleep mode (DROWSY). Expressions are dimmed to save power."}
        </div>
      </div>

      {/* Top Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', background: 'rgba(0,4,18,0.4)', backdropFilter: 'blur(5px)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginRight: 20 }}> <ArrowLeft size={24} /> </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.8rem', color: COLORS.accent, letterSpacing: 2 }}>KAI EXPERIENCE ENGINE</div>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>SIMULATED DIGITAL TWIN PH-4</div>
        </div>
        <button onClick={() => setShowHelp(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.65rem' }}>
          <HelpCircle size={14} /> HELP
        </button>
      </div>

      {/* Modals */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#000412', border: `3px solid ${COLORS.accent}`, padding: 30, maxWidth: 540, position: 'relative', boxShadow: `0 0 50px ${COLORS.accent}33` }}>
            <button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: 15, right: 15, color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.9rem', color: COLORS.accent, marginBottom: 20, textAlign: 'center' }}>SIMULATOR BOOTING...</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, marginBottom: 30 }}>
              Welcome to the **KAI EXPERIENCE ENGINE**. This is a functional Digital Twin of the kinetic robot.
              <br/><br/>
              • **RADIO BUTTON (Blue)**: Sends a Summon signal. KAI will roll forward.
              <br/>
              • **FLAME BUTTON (Red)**: Simulates a Gas Leak. Test the MQ-2 alarm logic.
              <br/>
              • **SUN/MOON**: Toggle ambient light levels. Test the LDR sleep state.
              <br/>
              • **HUD (Right)**: Watch real-time sensor data and live GPIO pin triggers as KAI reacts.
            </div>
            <button onClick={() => setShowHelp(false)} style={{ width: '100%', background: COLORS.accent, color: '#000', border: 'none', padding: 12, fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', cursor: 'pointer' }}>START EXPERIENCE</button>
          </div>
        </div>
      )}
      {/* Fire Alarm Overlay (Real-world reaction) */}
      {phase === 'ALERT' && (
        <div style={{ position:'fixed', inset:0, zIndex:200, pointerEvents:'none', background:'radial-gradient(circle, transparent 40%, rgba(255,0,110,0.3) 100%)', animation:'heartbeat 0.5s infinite' }} />
      )}

      {/* Floating Method Indicator */}
      {(isTilted || isClimateStressed || isGasActive || isSummoned) && (
        <div style={{ position:'fixed', bottom:200, left:'50%', transform:'translateX(-50%)', zIndex:160, background:'rgba(0,10,20,0.92)', border:'1px solid #06FFA5', padding:'10px 20px', borderRadius:4, textAlign:'center' }}>
          <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.45rem', color:'#06FFA5', marginBottom:4 }}>DEMO MODE ACTIVE</div>
          <div style={{ fontSize:'0.6rem', color:'white' }}>
            {isTilted && "METHOD: MPU6050 TILT TEST → CHASSIS PITCH"}
            {isClimateStressed && "METHOD: BME280 CLIMATE → 5V RELAY TRIPPED"}
            {isGasActive && "METHOD: MQ-2 GAS TEST → GC9A01 ALARM FACE"}
            {isSummoned && "METHOD: HC-SR04 SONAR → N20 TRACTION"}
          </div>
        </div>
      )}

      <style>{`
        @keyframes heartbeat { 0%{opacity:0.2;} 50%{opacity:0.6;} 100%{opacity:0.2;} }
      `}</style>
    </div>
  );
}
