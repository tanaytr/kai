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
  const [simValues, setSimValues] = useState({ distance: 100, gas: 400, light: 100, temp: 27.5 });
  const [isSummoned, setIsSummoned] = useState(false);
  const [isGasActive, setIsGasActive] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [logs, setLogs] = useState<string[]>(['KAI SYSTEM INITIALIZED', 'WAITING FOR SIMULATION INPUT...']);
  
  const rootGroup      = useRef<any>(null);
  const headGroup      = useRef<any>(null);
  const faceMesh       = useRef<any>(null);
  const wheels         = useRef<any[]>([]);
  const cameraRef      = useRef<any>(null);
  const rendererRef    = useRef<any>(null);
  const sceneRef       = useRef<any>(null);
  const mountedRef     = useRef(true);
  const animRef        = useRef<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 12));
  };

  // ── 3D Scene Setup ────────────────────────────────────────────────────────

  const loadThree = async (cb: () => void) => {
    if ((window as any).THREE) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  };

  const setupScene = () => {
    if (!canvasRef.current || !(window as any).THREE) return;
    const THREE = (window as any).THREE;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 6, 12);
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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(hemi);

    const spotlight = new THREE.SpotLight(0xffffff, 20);
    spotlight.position.set(2, 5, 2);
    spotlight.castShadow = true;
    scene.add(spotlight);

    // KAI-specific point light to ensure visibility
    const point = new THREE.PointLight(COLORS.accent, 2, 8);
    point.position.set(0, 1, 1);
    scene.add(point);

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

    // Chassis (Body)
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.05, metalness: 1.0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), chassisMat);
    body.position.y = 0;
    root.add(body);

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

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 24), chassisMat);
    head.add(headSphere);

    const faceGeom = new THREE.CircleGeometry(0.28, 32);
    const faceMat = new THREE.MeshStandardMaterial({ 
      color: 0x000000, 
      emissive: new THREE.Color(COLORS.accent), 
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.95
    });
    const facePlane = new THREE.Mesh(faceGeom, faceMat);
    facePlane.position.set(0, 0, 0.28);
    faceMesh.current = facePlane;
    head.add(facePlane);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.15), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 }));
    visor.position.set(0, -0.1, 0.3);
    head.add(visor);
  };

  const currentZ = useRef(0);
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

      // 3. Handle Face Expressions
      if (faceMesh.current) {
        const pulse = Math.abs(Math.sin(t * 3)) * 0.3;
        faceMesh.current.material.emissiveIntensity = 0.5 + pulse;
        if (phase === 'ALERT') faceMesh.current.material.emissive.set(COLORS.alert);
        else if (phase === 'DROWSY') faceMesh.current.material.emissive.set(COLORS.info);
        else faceMesh.current.material.emissive.set(COLORS.accent);
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
    currentZ.current = 2.5; 
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.bg, color: 'white', fontFamily: "'JetBrains Mono', monospace", display: 'flex' }}>
      {/* 3D Viewport */}
      <canvas ref={canvasRef} style={{ flex: 1, width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Diagnostics HUD (Right Panel) */}
      <div style={{ width: 'clamp(300px, 25vw, 400px)', background: 'rgba(0,4,18,0.95)', borderLeft: '2px solid rgba(0,212,255,0.15)', display: 'flex', flexDirection: 'column', padding: 20, zIndex: 100, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid rgba(0,212,255,0.2)', paddingBottom: 15, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', color: COLORS.accent, marginBottom: 8 }}>DIAGNOSTICS HUD</div>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)' }}>PHASE 4: DIGITAL TWIN SIMULATOR</div>
        </div>

        {/* Telemetry */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 25 }}>
          {[
            { label: 'DIST', val: `${simValues.distance}cm`, color: simValues.distance < 40 ? COLORS.warning : COLORS.accent },
            { label: 'GAS', val: `${simValues.gas} ADC`, color: simValues.gas > 2500 ? COLORS.alert : COLORS.accent },
            { label: 'LIGHT', val: `${simValues.light}%`, color: simValues.light < 20 ? COLORS.info : COLORS.accent },
            { label: 'TEMP', val: `${simValues.temp}°C`, color: COLORS.accent }
          ].map((t, i) => (
            <div key={i} style={{ border: `1px solid ${t.color}33`, padding: '10px 15px', background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
              <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: '0.85rem', color: t.color, fontWeight: 'bold' }}>{t.val}</div>
            </div>
          ))}
        </div>

        {/* GPIO Pin Map (Simplified) */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 15, marginBottom: 25 }}>
          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.6)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={12} /> GPIO STATUS (LIVE)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { p: 'G12', active: isSummoned, label: 'MOT_L' },
              { p: 'G13', active: isSummoned, label: 'MOT_R' },
              { p: 'G25', active: phase === 'ALERT', label: 'BUZZ' },
              { p: 'G04', active: phase !== 'IDLE', label: 'SERVO' },
              { p: 'G18', active: true, label: 'ECHO' }
            ].map((p, i) => (
              <div key={i} style={{ border: `1px solid ${p.active ? COLORS.accent : 'rgba(255,255,255,0.1)'}`, padding: '4px 6px', borderRadius: 2, fontSize: '0.38rem', color: p.active ? COLORS.accent : 'rgba(255,255,255,0.3)', background: p.active ? `${COLORS.accent}11` : 'none' }}>
                {p.label}
              </div>
            ))}
          </div>
        </div>
            {[
              { p: 'G12', active: isSummoned, label: 'MOT_L' },
              { p: 'G13', active: isSummoned, label: 'MOT_R' },
              { p: 'G25', active: phase === 'ALERT', label: 'BUZZ' },
              { p: 'G04', active: phase !== 'IDLE', label: 'SERVO' },
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

      {/* Control Tools (Left Panel) */}
      <div style={{ position: 'fixed', left: 20, top: 120, display: 'flex', flexDirection: 'column', gap: 15, zIndex: 150 }}>
        <button onClick={triggerSummon} disabled={isSummoned} style={{ width: 44, height: 44, borderRadius: '50%', background: isSummoned ? 'rgba(0,0,0,0.5)' : '#3A86FF', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(58,134,255,0.4)' }} title="Summon KAI">
          <Radio size={20} />
        </button>
        <button onClick={toggleGas} style={{ width: 44, height: 44, borderRadius: '50%', background: isGasActive ? COLORS.alert : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test MQ-2 Gas">
          <Flame size={20} />
        </button>
        <button onClick={toggleNight} style={{ width: 44, height: 44, borderRadius: '50%', background: isNight ? '#8338EC' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Test LDR Light">
          {isNight ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button onClick={() => setSimValues({ distance: 100, gas: 400, light: 100, temp: 27.5 })} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reset Simulation">
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Persistent Help HUD */}
      <div style={{ position: 'fixed', bottom: 30, right: 370, background: 'rgba(0,4,18,0.9)', border: `1px solid ${COLORS.accent}`, padding: '12px 20px', borderRadius: 8, zIndex: 100, maxWidth: 320 }}>
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
    </div>
  );
}
