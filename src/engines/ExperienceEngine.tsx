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
  const [isRelayOn, setIsRelayOn]   = useState(false);
  const [logs, setLogs]             = useState<string[]>(['KAI SYSTEM INITIALIZED', 'WAITING FOR SIMULATION INPUT...']);
  
  // AI Chat State
  const [isListening, setIsListening] = useState(false);
  const [isTalking, setIsTalking]     = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [lastResponse, setLastResponse] = useState('');
  
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
  
  // Real-time Refs to avoid stale state in the Animation Loop
  const simRef         = useRef(simValues);
  const relayRef       = useRef(isRelayOn);
  const tiltRef        = useRef(isTilted);
  const phaseRef       = useRef<string>('IDLE');

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 12));
  };

  const getPhase = () => {
    const sim = simRef.current;
    if (sim.gas > 2500) return 'ALERT';
    if (sim.distance < 40) return 'ENGAGED';
    if (sim.light < 20) return 'DROWSY';
    return 'IDLE';
  };

  const triggerBuzzer = () => {
    addLog("BUZZER GPIO 25 TRIGGERED");
    musicEngine.playSfx(1000);
  };

  // ── Neural AI Chat Logic ───────────────────────────────────────────────────

  const handleQuery = (query: string) => {
    const q = query.toLowerCase();
    let response = "I am KAI, your Kinetic Artificial Intelligence. How can I assist with your COA project?";

    if (q.includes("name")) response = "My name is KAI. I was developed as a high-fidelity Digital Twin for this architecture study.";
    else if (q.includes("prof") || q.includes("gautam")) response = "This project is submitted to Dr. Divya Gautam, Assistant Professor at STME.";
    else if (q.includes("uni") || q.includes("nmims")) response = "I am part of the COA case study for SVKM's NMIMS University.";
    else if (q.includes("team") || q.includes("creators") || q.includes("who made")) response = "I was created by Srishti Jain, Diksha Rathi, and Tanay Trivedi.";
    else if (q.includes("course") || q.includes("subject")) response = "This project falls under Computer Organisation and Architecture.";
    else if (q.includes("city")) response = "I am stationed at the SVKM NMIMS Mumbai campus neural lab.";
    else if (q.includes("hello") || q.includes("hi")) response = "Greetings. Biological presence detected. Systems are nominal.";

    setLastResponse(response);
    addLog(`AI RESPONSE: ${response}`);
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
    if (!SpeechRecognition) {
      addLog("SPEECH API NOT SUPPORTED IN THIS BROWSER.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => { setIsListening(true); setTranscript('Listening...'); };
    recognition.onresult = (event: any) => {
      const msg = event.results[0][0].transcript;
      setTranscript(msg);
      addLog(`VOICE INPUT: ${msg}`);
      handleQuery(msg);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
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
    scene.fog = new THREE.Fog(COLORS.bg, 10, 50);
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
    
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);

    const spotlight = new THREE.SpotLight(0xffffff, 20);
    spotlight.position.set(2, 5, 2);
    scene.add(spotlight);

    const point = new THREE.PointLight(COLORS.accent, 2, 12);
    point.position.set(0, 1, 1);
    scene.add(point);

    const pathLight = new THREE.PointLight(0x3A86FF, 1.5, 20);
    pathLight.position.set(0, 2, -10);
    scene.add(pathLight);

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

    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, 0, 0.28);
    head.add(screenGroup);

    const faceGeom = new THREE.CircleGeometry(0.28, 32);
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

    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.1, transparent: true, opacity: 0.25 })
    );
    glass.position.set(0, 0, 0.3);
    head.add(glass);

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

    // AI Components Labels (Truthful Hardware markers)
    const micMark = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    micMark.position.set(0.15, -0.2, 0.2);
    micMark.rotation.x = Math.PI/2;
    head.add(micMark); // I2S Mic loc

    const speakerMark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    speakerMark.position.set(-0.15, -0.25, 0.2);
    speakerMark.rotation.x = Math.PI/2;
    head.add(speakerMark); // I2S Speaker loc
  };

  const drawFace = (t: number) => {
    if (!faceCanvas.current || !faceTexture.current) return;
    const ctx = faceCanvas.current.getContext('2d');
    if (!ctx) return;

    const phase = phaseRef.current;
    const sim   = simRef.current;
    const isOverheating = sim.temp > 30;
    const isSleepy      = sim.light < 20;

    // 1. Face Background (Dramatized)
    let bgColor = '#000000';
    if (phase === 'ALERT') bgColor = '#FF0000';
    else if (isOverheating) bgColor = '#FF6600';
    else if (isSleepy)  bgColor = '#000022';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 256);

    // 2. Truthful Ocular Expressions (Sharp Primitives)
    ctx.lineWidth = 14;
    ctx.lineCap   = 'round';
    let eyeColor = phase === 'ALERT' ? '#ffffff' : (isOverheating ? '#ffffff' : COLORS.accent);
    ctx.strokeStyle = eyeColor;
    ctx.shadowBlur  = 15;
    ctx.shadowColor = eyeColor;

    if (isTalking) {
      // 3. Talking Mouth Waveform
      ctx.beginPath();
      ctx.lineWidth = 6;
      for(let i=0; i<80; i+=5) {
        const h = Math.sin(t * 30 + i) * 30;
        ctx.moveTo(88+i, 180-h/2); ctx.lineTo(88+i, 180+h/2);
      }
      ctx.stroke();
    }

    if (phase === 'ALERT') {
      // Ocular "X" Primitives
      ctx.beginPath(); ctx.moveTo(60, 80); ctx.lineTo(110, 140); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(110, 80); ctx.lineTo(60, 140); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(146, 80); ctx.lineTo(196, 140); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(196, 80); ctx.lineTo(146, 140); ctx.stroke();
    } else if (isSleepy) {
      // Sleepy Ocular Arcs
      ctx.beginPath(); ctx.arc(100, 128, 30, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(156, 128, 30, Math.PI, 0); ctx.stroke();
    } else if (phase === 'ENGAGED') {
      // Focused Ocular Circles (TFT style)
      ctx.beginPath(); ctx.arc(100, 128, 25, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(156, 128, 25, 0, Math.PI*2); ctx.stroke();
    } else {
      // Idle Scanning Arcs
      const scanOffset = Math.sin(t*2)*10;
      ctx.beginPath(); ctx.arc(100+scanOffset, 128, 20, 0, Math.PI, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(156+scanOffset, 128, 20, 0, Math.PI, true); ctx.stroke();
    }

    faceTexture.current.needsUpdate = true;
  };

  const currentZ = useRef(-8);
  const targetZ  = useRef(0);

  const animate = () => {
    if (!mountedRef.current) return;
    const t = performance.now() * 0.001;

    if (rootGroup.current && headGroup.current) {
      const sim = simRef.current;
      const phase = getPhase(); // This now uses simRef internally
      const prevZ = currentZ.current;
      currentZ.current += (targetZ.current - currentZ.current) * 0.04;
      rootGroup.current.position.z = currentZ.current;

      const deltaZ = currentZ.current - prevZ;
      const wheelRadius = 0.2;
      wheels.current.forEach(w => { w.rotation.x -= deltaZ / wheelRadius; });

      if (isSummoned && Math.abs(currentZ.current - targetZ.current) < 0.01) {
        setIsSummoned(false);
        addLog("SUMMON COMPLETE - DOCKED AT USER");
      }

      const targetTilt = phase === 'DROWSY' ? 0.6 : (phase === 'ENGAGED' ? -0.2 : 0);
      headGroup.current.rotation.x += (targetTilt - headGroup.current.rotation.x) * 0.08;

      if (faceCanvas.current && faceTexture.current) {
        drawFace(t);
        const alertFlash = phase === 'ALERT' && Math.sin(t * 15) > 0;

        chassisParts.current.forEach((mesh, id) => {
          if (mesh.material.emissive) {
            if (alertFlash) mesh.material.emissive.set('#ff0000');
            else if (id === 'core' && phase === 'ENGAGED') mesh.material.emissive.set(COLORS.accent);
            else if (sim.temp > 30) mesh.material.emissive.set('#ff6600');
            else mesh.material.emissiveIntensity = (id.startsWith('bat') ? 0.4 : 0.1) + Math.abs(Math.sin(t*3)) * 0.2;
          }
        });

        // 3. Actuator VFX: Sound Wave Rings
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

        // 4. MPU6050 Mapping
        if (tiltRef.current) {
          rootGroup.current.rotation.z = Math.min(0.8, rootGroup.current.rotation.z + 0.1); 
          rootGroup.current.position.y = -0.15;
          rootGroup.current.rotation.y = Math.sin(t * 20) * 0.05; // Shake while tilted
        } else {
          rootGroup.current.rotation.z *= 0.85;
          rootGroup.current.position.y *= 0.85;
        }

        // 5. Relay Actuator Shake Kick
        if (relayRef.current) {
          rootGroup.current.position.x = Math.sin(t * 80) * 0.02; // Violent vibration
          rootGroup.current.scale.set(1.03, 1.03, 1.03); 
        } else {
          rootGroup.current.scale.set(1, 1, 1);
          rootGroup.current.position.x *= 0.8;
        }

        const overHeat = sim.temp > 30;
        const isNightVal = sim.light < 20;

        // 6. Servo Logic (DROWSY STOPS SCANNING)
        if (isNightVal) {
          // DROWSY: STOP NECK TILTING & DROP HEAD
          headGroup.current.rotation.y += (0 - headGroup.current.rotation.y) * 0.05;
          headGroup.current.rotation.x += (0.6 - headGroup.current.rotation.x) * 0.05;
        } else if (phase === 'ALERT') {
          headGroup.current.rotation.y = Math.sin(t * 22) * 0.1;
          smokeParticles.current.forEach(sm => {
            if (sm.material.opacity <= 0) {
               sm.position.set(0, 0.8, 0); sm.material.opacity = 1;
            }
            sm.position.y += 0.06; sm.material.opacity -= 0.02;
          });
        } else if (overHeat) {
          headGroup.current.rotation.x = Math.sin(t * 50) * 0.05; // Thermal shimmer
        } else if (phase === 'ENGAGED') {
          headGroup.current.rotation.y = Math.sin(t * 1.5) * 0.2;
          headGroup.current.rotation.x = Math.sin(t * 8) * 0.1 - 0.2;
        } else {
          headGroup.current.rotation.y = Math.sin(t * 0.5) * 0.4;
          headGroup.current.rotation.x *= 0.9;
        }
      }
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    simRef.current = simValues;
    relayRef.current = isRelayOn;
    tiltRef.current = isTilted;
    
    const nextPhase = getPhase();
    if (nextPhase !== phase) {
      setPhase(nextPhase);
      addLog(`PHASE SHIFT → ${nextPhase}`);
      musicEngine.playSfx(nextPhase === 'ALERT' ? 1000 : 700);
    }
  }, [simValues, phase, isRelayOn, isTilted]);

  useEffect(() => { loadThree(setupScene); return () => { mountedRef.current = false; if(animRef.current) cancelAnimationFrame(animRef.current); }; }, []);

  const triggerSummon = () => {
    if (isSummoned) return;
    addLog("SUMMON SIGNAL SENT → N20 PWM CONTROL");
    currentZ.current = -15;
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
      <canvas ref={canvasRef} style={{ flex: 1, width: '100%', height: '100%', touchAction: 'none' }} />

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
              { p: 'G26', active: isRelayOn, label: 'RELAY' },
              { p: 'G18', active: true, label: 'ECHO' }
            ].map((p, i) => (
              <div key={i} style={{ border: `1px solid ${p.active ? COLORS.accent : 'rgba(255,255,255,0.1)'}`, padding: '4px 6px', borderRadius: 2, fontSize: '0.38rem', color: p.active ? COLORS.accent : 'rgba(255,255,255,0.3)', background: p.active ? `${COLORS.accent}11` : 'none' }}>
                {p.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} /> NEURAL AI INTERFACE (VOICE READY)
          </div>
          <div style={{ padding: 10, background: 'rgba(6,255,165,0.1)', border: '1px solid #06FFA5', borderRadius: 4, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              onClick={startListening}
              style={{ background: isListening ? '#FF006E' : '#06FFA5', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Radio size={14} color="#000" />
            </button>
            <div style={{ fontSize: '0.5rem', color: '#06FFA5' }}>{isListening ? 'LISTENING...' : 'READY FOR VOICE INPUT'}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:5, marginBottom: 10 }}>
              {['RELAY','BUZZER','N20','MG90S','TFT'].map(a => (
                <div key={a} onClick={() => {
                  if (a === 'RELAY') {
                    setIsRelayOn(!isRelayOn);
                    addLog(`RELAY GPIO 26 toggled: ${!isRelayOn ? 'ON' : 'OFF'}`);
                    musicEngine.playSfx(100);
                  } else if (a === 'BUZZER') {
                    triggerBuzzer();
                  } else if (a === 'N20') {
                    triggerSummon();
                  } else {
                    addLog(`${a} Actuator Manual Pulse.`);
                    musicEngine.playSfx(300);
                  }
                }} style={{ padding:6, background: (a==='RELAY'&&isRelayOn)?'rgba(255,0,110,0.3)':'rgba(6,255,165,0.05)', border: `1px solid ${(a==='RELAY'&&isRelayOn)?'#FF006E':'rgba(6,255,165,0.2)'}`, color:(a==='RELAY'&&isRelayOn)?'#FF006E':'#06FFA5', fontSize:'0.45rem', cursor:'pointer', textAlign:'center' }}>{a}</div>
              ))}
            </div>
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: 10, fontSize: '0.52rem', lineHeight: 1.6 }}>
            {transcript && <div style={{ color: '#06FFA5', marginBottom: 5 }}>YOU: "{transcript}"</div>}
            {lastResponse && <div style={{ color: '#fff', marginBottom: 10, borderLeft: '2px solid #06FFA5', paddingLeft: 8 }}>KAI: {lastResponse}</div>}
            {logs.map((l, i) => (
              <div key={i} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
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
          <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(6,255,165,0.2); border-radius: 4px; }
      `}</style>
    </div>
      )}

      <style>{`
        @keyframes heartbeat { 0%{opacity:0.2;} 50%{opacity:0.6;} 100%{opacity:0.2;} }
      `}</style>
    </div>
  );
}
