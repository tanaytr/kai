import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, Hand, ZoomIn, ZoomOut, HelpCircle, X } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface ChipViewerProps { onBack: () => void; }

const HOTSPOTS = [
  { key: 'grace_cpu',        pos: [-0.60,  0.12,  0.00] as [number,number,number], col: 0x76b900, title: 'GRACE CPU DIE',         color: '#76b900', info: '72-core ARM Neoverse V2 (ARMv9-A). 5-wide OoO superscalar, 320-entry ROB. SVE2 SIMD up to 2048-bit. 64 KB L1-I + 64 KB L1-D per core. 576 MB L3 NUCA shared. TSMC 4N.' },
  { key: 'grace_l3',         pos: [-0.60,  0.12, -0.55] as [number,number,number], col: 0xffaa00, title: 'L3 CACHE (576 MB)',      color: '#ffaa00', info: '576 MB NUCA — 72 slices × 8 MB each. Closest slices to a core run ~20% faster. Mesh interconnect rings all slices. Reduces LPDDR5X accesses by ~40%.' },
  { key: 'lpddr5x',          pos: [-1.05,  0.08,  0.00] as [number,number,number], col: 0xff8800, title: 'LPDDR5X (480 GB)',       color: '#ff8800', info: '480 GB on-package LPDDR5X. 8 channels, 546 GB/s aggregate. On-package → shorter traces → lower capacitance → 50% power saving vs DDR5.' },
  { key: 'c2c',              pos: [ 0.00,  0.14,  0.00] as [number,number,number], col: 0x00d4ff, title: 'NVLink-C2C BRIDGE',      color: '#00d4ff', info: '900 GB/s bidirectional. 18 NVLink lanes × 50 GB/s. MESI coherence across dies. ~40 ns latency. Hardware snoop filter. 14× faster than PCIe 5.0.' },
  { key: 'hopper_gpu',       pos: [ 0.60,  0.12,  0.00] as [number,number,number], col: 0x00ff88, title: 'HOPPER GPU (H100)',      color: '#00ff88', info: '132 SMs in 7 GPCs × 2 TPCs × 2 SM. 16,896 CUDA cores. Transformer Engine: FP8↔BF16. 3,958 TFLOPS FP8. Boost 1.98 GHz. L2: 60 MB.' },
  { key: 'tensor',           pos: [ 0.60,  0.12, -0.55] as [number,number,number], col: 0xcc44ff, title: 'TENSOR CORES (528)',     color: '#cc44ff', info: '4th-gen Tensor Cores. D=A×B+C hardware matrix op. 16×8/8×16 tiles. FP8, BF16, FP16, TF32, FP64, INT8, INT4. Dynamic exponent scaling.' },
  { key: 'hbm3e',            pos: [ 1.10,  0.12,  0.00] as [number,number,number], col: 0xff5522, title: 'HBM3e (96 GB, 4 TB/s)', color: '#ff5522', info: '6 HBM3e stacks. Each: base die + 8 DRAM dies via TSVs. 1024-bit bus per stack. 4 TB/s aggregate. ECC SECDED. Micro-bumps ~55 μm pitch.' },
  { key: 'nvlink_net',       pos: [ 1.10,  0.08, -0.35] as [number,number,number], col: 0x44aaff, title: 'NVLink 4 NETWORK',       color: '#44aaff', info: '18× NVLink 4 lanes for multi-GPU fabric. 900 GB/s aggregate. Up to 256 GH200 GPUs in single coherent fabric.' },
  { key: 'pcie',             pos: [-1.10,  0.08, -0.35] as [number,number,number], col: 0x888888, title: 'PCIe 5.0 HOST I/F',     color: '#aaaaaa', info: '4× PCIe 5.0 ×16. 512 GB/s aggregate. Connects NVMe SSDs, NICs, host systems. 32 GT/s per lane. CXL capable.' },
  { key: 'interposer',       pos: [ 0.00,  0.00,  0.50] as [number,number,number], col: 0x00ff44, title: 'SILICON INTERPOSER',     color: '#00ff44', info: 'CoWoS-L (Chip-on-Wafer-on-Substrate). 2.5D integration. High-density solder bumps between GPU and HBM3e. Wider memory bus than PCB.' },
  { key: 'sm_array',         pos: [ 0.60,  0.12,  0.50] as [number,number,number], col: 0x88ffcc, title: 'SM ARRAY (132 SMs)',    color: '#88ffcc', info: '132 SMs in 7 GPCs. Each SM: 128 CUDA cores, 4 Tensor Cores, 1 RT Core. 256 KB register file, 228 KB shared memory.' },
  { key: 'power_delivery',   pos: [-0.60,  0.08,  0.50] as [number,number,number], col: 0xff3366, title: 'POWER DELIVERY',        color: '#ff3366', info: '~1000W TDP. CPU ~500W, GPU ~500W. Independent DVFS per domain. 10% voltage reduction saves ~19% power. Per-cluster power gating.' },
  { key: 'coherence_engine', pos: [ 0.00,  0.14, -0.50] as [number,number,number], col: 0xffdd44, title: 'COHERENCE ENGINE',      color: '#ffdd44', info: 'MESI protocol: Modified, Exclusive, Shared, Invalid per 128-byte cache line. Snoop filter at C2C. CPU can directly access GPU HBM3e.' },
  { key: 'tsv_stack',        pos: [ 1.10,  0.12,  0.35] as [number,number,number], col: 0xffaa88, title: 'TSV INTERCONNECT',      color: '#ffaa88', info: 'Through-Silicon Vias: vertical metal pillars. ~1 μm diameter. 1024 TSVs per stack enable 1024-bit bus. Bonded at 55 μm pitch.' },
];

declare global { interface Window { THREE: any; } }

function GestureHUD({ state, zoom }: { state: GestureState | null; zoom: number }) {
  if (!state || state.type === 'none') return null;
  let label = 'TRACKING'; let color = '#06FFA5'; let icon = '✊';
  if (state.type === 'fist') {
    icon = '✊'; color = '#FFBE0B'; label = 'FIST DRAG → ROTATE ALL AXES';
  } else if (state.type === 'open') {
    icon = '✋'; color = '#06FFA5'; label = 'OPEN PALM → ZOOM OUT';
  } else if (state.type === 'pinch') {
    icon = '🤏'; color = '#FF006E'; label = 'PINCH → ZOOM IN';
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.92)', border: `2px solid ${color}`, padding: '7px 18px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 0 14px ${color}55`, fontFamily: "'Press Start 2P', cursive", pointerEvents: 'none', minWidth: 280 }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.45rem', color, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: '0.38rem', color: '#666', marginTop: 3 }}>ZOOM {zoom.toFixed(1)}×</div>
      </div>
    </div>
  );
}

export default function ChipViewer({ onBack }: ChipViewerProps) {
  const [mode, setMode]                         = useState<'stencil' | 'real'>('stencil');
  const [autoRotate, setAutoRotate]             = useState(true);
  const [selectedHotspot, setSelectedHotspot]   = useState<typeof HOTSPOTS[0] | null>(null);
  const [hotspotScreenPos, setHotspotScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [gestureEnabled, setGestureEnabled]     = useState(false);
  const [gestureState, setGestureState]         = useState<GestureState | null>(null);
  const [showHelp, setShowHelp]                 = useState(false);
  const [displayZoom, setDisplayZoom]           = useState(5);
  const [modelError, setModelError]             = useState(false);

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const sceneRef       = useRef<any>(null);
  const cameraRef      = useRef<any>(null);
  const rendererRef    = useRef<any>(null);
  const groupRef       = useRef<any>(null);
  const hotspotsRef    = useRef<any[]>([]);
  const animRef        = useRef<number | null>(null);
  const mountedRef     = useRef(false);
  const selectedRef    = useRef<typeof HOTSPOTS[0] | null>(null);
  const autoRotRef     = useRef(true);

  const rotRef         = useRef({ theta: 0.3, phi: Math.PI / 4 });
  const targetZoomRef  = useRef(5);
  const currentZoomRef = useRef(5);
  const dragRef        = useRef({ active: false, lastX: 0, lastY: 0, button: 0 });
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { autoRotRef.current = autoRotate; }, [autoRotate]);

  const nudgeZoom = useCallback((delta: number) => {
    targetZoomRef.current = Math.max(2, Math.min(10, targetZoomRef.current + delta));
    setDisplayZoom(+targetZoomRef.current.toFixed(1));
  }, []);
  const nudgeZoomRef = useRef(nudgeZoom);
  useEffect(() => { nudgeZoomRef.current = nudgeZoom; }, [nudgeZoom]);

  const projectToScreen = useCallback((worldPos: [number, number, number]): { x: number; y: number } | null => {
    if (!cameraRef.current || !canvasRef.current || !window.THREE) return null;
    const THREE    = window.THREE;
    const vec      = new THREE.Vector3(...worldPos);
    if (groupRef.current) vec.applyMatrix4(groupRef.current.matrixWorld);
    const projected = vec.project(cameraRef.current);
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * rect.width  + rect.left,
      y: ((-projected.y + 1) / 2) * rect.height + rect.top,
    };
  }, []);

  const initThree = useCallback(() => {
    if (!canvasRef.current || mountedRef.current) return;
    if (window.THREE) { setupScene(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload  = () => setupScene();
    s.onerror = () => console.error('[ChipViewer] THREE.js failed to load');
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setupScene = () => {
    if (!canvasRef.current || !window.THREE || mountedRef.current) return;
    mountedRef.current = true;
    const THREE = window.THREE;
    const W = canvasRef.current.clientWidth  || 800;
    const H = canvasRef.current.clientHeight || 540;
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(50, W / H, 0.01, 200);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setClearColor(0x0a0a14, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    scene.add(new THREE.AmbientLight(0x334455, 4.0));
    const dl = new THREE.DirectionalLight(0xffffff, 3.5); dl.position.set(6, 10, 7); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x88ccff, 2);  dl2.position.set(-6, 5, -4); scene.add(dl2);
    const pl1 = new THREE.PointLight(0x76b900, 4, 20); pl1.position.set(-5, 6, -5); scene.add(pl1);
    const pl2 = new THREE.PointLight(0x00d4ff, 3, 18); pl2.position.set(5, 5, 5);   scene.add(pl2);
    const pl3 = new THREE.PointLight(0xff5500, 2, 15); pl3.position.set(3, 3, -6);  scene.add(pl3);
    scene.add(new THREE.HemisphereLight(0x223344, 0x111122, 1.5));
    const group = new THREE.Group();
    scene.add(group);
    sceneRef.current    = scene;
    cameraRef.current   = camera;
    rendererRef.current = renderer;
    groupRef.current    = group;
    buildStencil();
    buildHotspots();
    startAnimate();
  };

  const makeMat = (color: number, emissive?: number, emissiveIntensity = 0.2, roughness = 0.25, metalness = 0.80) => {
    if (!window.THREE) return null;
    const params: any = { color, roughness, metalness };
    if (emissive !== undefined) { params.emissive = new window.THREE.Color(emissive); params.emissiveIntensity = emissiveIntensity; }
    return new window.THREE.MeshStandardMaterial(params);
  };

  const buildStencil = () => {
    if (!groupRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const g = groupRef.current;
    while (g.children.length) g.remove(g.children[0]);
    const add = (geo: any, mat: any, x = 0, y = 0, z = 0) => {
      if (!mat) return null;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m;
    };
    add(new THREE.BoxGeometry(2.9, 0.05, 2.1),  makeMat(0x1a1a1a, undefined, 0, 0.9, 0.2),  0, -0.32, 0);
    add(new THREE.BoxGeometry(2.5, 0.04, 1.7),  makeMat(0x0d2210, 0x00ff44, 0.04),           0, -0.27, 0);
    add(new THREE.BoxGeometry(1.0, 0.09, 1.3),  makeMat(0x1e3a10, 0x76b900, 0.22),        -0.6, 0, 0);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 9; col++) {
        add(new THREE.BoxGeometry(0.085, 0.022, 0.12), makeMat(0x2a5a18, 0x76b900, 0.10), -0.6 + (col - 4) * 0.10, 0.055, (row - 3.5) * 0.14);
      }
    }
    for (let i = 0; i < 5; i++) {
      add(new THREE.BoxGeometry(0.16, 0.022, 0.25), makeMat(0x332200, 0xff8800, 0.28), -1.05 + i * 0.095, 0.055, -0.55);
      add(new THREE.BoxGeometry(0.16, 0.022, 0.25), makeMat(0x332200, 0xff8800, 0.28), -1.05 + i * 0.095, 0.055,  0.55);
    }
    for (let i = 0; i < 3; i++) {
      add(new THREE.BoxGeometry(0.22, 0.09, 0.3), makeMat(0x331a00, 0xff8800, 0.28), -1.2, 0, -0.45 + i * 0.45);
    }
    add(new THREE.BoxGeometry(0.22, 0.04, 1.1), makeMat(0x003050, 0x00d4ff, 0.90), 0, 0.03, 0);
    for (let i = 0; i < 18; i++) {
      add(new THREE.BoxGeometry(0.18, 0.009, 0.04), makeMat(0x001830, 0x00d4ff, 0.65), 0, 0.04, -0.42 + i * 0.05);
    }
    add(new THREE.BoxGeometry(0.18, 0.03, 0.2), makeMat(0x332200, 0xffdd44, 0.75), 0, 0.04, -0.50);
    add(new THREE.BoxGeometry(1.1, 0.10, 1.3), makeMat(0x0e2818, 0x00ff88, 0.16), 0.6, 0.005, 0);
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 12; col++) {
        if (row * 12 + col >= 132) break;
        add(new THREE.BoxGeometry(0.07, 0.025, 0.09), makeMat(0x103820, 0x00ff88, 0.12), 0.6 + (col - 5.5) * 0.085, 0.062, (row - 5) * 0.11);
      }
    }
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        add(new THREE.BoxGeometry(0.04, 0.032, 0.04), makeMat(0x220033, 0xcc44ff, 0.85), 0.30 + col * 0.12, 0.077, -0.22 + row * 0.12);
      }
    }
    const hbmZ = [-0.55, -0.22, 0.11, 0.44];
    hbmZ.forEach(z => {
      const stack = new THREE.Group();
      for (let layer = 0; layer < 9; layer++) {
        const m = makeMat(layer % 2 === 0 ? 0x3a0800 : 0x220500, 0xff3300, 0.12 + layer * 0.04);
        if (!m) return;
        const lay = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.22), m);
        lay.position.y = layer * 0.032; stack.add(lay);
      }
      for (let tx = -1; tx <= 1; tx++) {
        for (let tz = -1; tz <= 1; tz++) {
          const m = makeMat(0x886644, 0xff8800, 0.35); if (!m) return;
          const tsv = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8), m);
          tsv.position.set(tx * 0.07, 0.13, tz * 0.07); stack.add(tsv);
        }
      }
      stack.position.set(1.15, 0.05, z); g.add(stack);
    });
    add(new THREE.BoxGeometry(0.12, 0.07, 0.7),  makeMat(0x001a44, 0x44aaff, 0.70),  1.35, -0.05, 0);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.55), makeMat(0x222222, undefined, 0, 0.6, 0.4), -1.35, -0.05, 0);
    for (let i = 0; i < 5; i++) {
      add(new THREE.BoxGeometry(2.6, 0.009, 0.03), makeMat(0x443300, 0xffcc00, 0.20), 0, -0.12, -0.6 + i * 0.3);
    }
    for (let i = 0; i < 8; i++) {
      const m = makeMat(0x443300, 0xff3366, 0.45); if (!m) continue;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8), m);
      cap.position.set(-1.35 + i * 0.10, -0.08, 0.70); g.add(cap);
    }
  };

  const buildHotspots = () => {
    if (!groupRef.current || !window.THREE) return;
    const THREE = window.THREE;
    hotspotsRef.current = [];
    HOTSPOTS.forEach(d => {
      const orbMat = new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.9 });
      const orb    = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), orbMat);
      orb.position.set(...d.pos);
      const ringMat = new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.5, side: 2 });
      const ring    = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 24), ringMat);
      orb.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      orb.add(dot);
      orb.userData = { ...d, isHotspot: true };
      groupRef.current.add(orb);
      hotspotsRef.current.push(orb);
    });
  };

  const loadGLTF = () => {
    if (!groupRef.current || !window.THREE) return;
    const g = groupRef.current;
    while (g.children.length) g.remove(g.children[0]);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    s.onload = () => {
      const loader = new (window as any).THREE.GLTFLoader();
      loader.load(
        '/sample.glb',
        (gltf: any) => {
          const model = gltf.scene;
          model.traverse((child: any) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
          const box    = new window.THREE.Box3().setFromObject(model);
          const sz     = box.getSize(new window.THREE.Vector3());
          const sc     = 3.0 / Math.max(sz.x, sz.y, sz.z);
          model.scale.set(sc, sc, sc);
          const center = new window.THREE.Box3().setFromObject(model).getCenter(new window.THREE.Vector3());
          model.position.sub(center);
          g.add(model);
          buildHotspots();
          setModelError(false);
        },
        undefined,
        () => { setModelError(true); buildStencil(); buildHotspots(); }
      );
    };
    s.onerror = () => { setModelError(true); buildStencil(); buildHotspots(); };
    document.head.appendChild(s);
  };

  const startAnimate = () => {
    const loop = () => {
      if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
      if (autoRotRef.current) rotRef.current.theta += 0.004;
      currentZoomRef.current += (targetZoomRef.current - currentZoomRef.current) * 0.10;
      const { theta, phi } = rotRef.current;
      const r = currentZoomRef.current;
      cameraRef.current.position.set(
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.cos(theta)
      );
      cameraRef.current.lookAt(0, 0, 0);
      const t = Date.now() * 0.001;
      hotspotsRef.current.forEach((h, i) => {
        const s = 1 + Math.sin(t * 2.5 + i * 0.9) * 0.25;
        h.scale.set(s, s, s);
        if (h.children[0]) h.children[0].rotation.z = t * 1.2 + i;
      });
      if (selectedRef.current) {
        const pos = projectToScreen(selectedRef.current.pos);
        if (pos) setHotspotScreenPos(pos);
      }
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    initThree();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mountedRef.current) return;
    if (mode === 'stencil') { buildStencil(); buildHotspots(); }
    else loadGLTF();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const raw = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      targetZoomRef.current = Math.max(2, Math.min(10, targetZoomRef.current + raw * 0.004));
      setDisplayZoom(+targetZoomRef.current.toFixed(1));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // FIST DRAG = rotate all axes (smooth, works from any angle via distance-based detection)
  // OPEN PALM = zoom out (continuous nudge each frame it fires)
  // PINCH = zoom in (fires once per pinch with cooldown)
  // Index removed from rotation — was jittery
  const handleGesture = useCallback((gesture: GestureState) => {
    setGestureState(gesture);

    if (gesture.type === 'fist') {
      // fistDX/fistDY are wrist deltas from gestureControl — smooth continuous rotation
      const dx = gesture.fistDX ?? 0;
      const dy = gesture.fistDY ?? 0;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        autoRotRef.current = false;
        setAutoRotate(false);
        // dx: wrist moves right (positive) → theta increases (rotate right around Y)
        // dy: wrist moves down (positive in camera space) → phi increases (look from below)
        rotRef.current.theta -= dx * 12;
        rotRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15,
          rotRef.current.phi + dy * 12
        ));
      }
    }

    // Open palm fires continuously — nudge zoom out each frame it's held
    if (gesture.type === 'open') {
      nudgeZoomRef.current(+0.12);
    }

    // Pinch fires once per gesture (edge-triggered in gestureControl)
    if (gesture.type === 'pinch') {
      nudgeZoomRef.current(-0.6);
    }
  }, []);

  useEffect(() => {
    if (gestureEnabled) {
      gestureController.subscribe(handleGesture);
      return () => gestureController.unsubscribe(handleGesture);
    } else {
      setGestureState(null);
    }
  }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) { gestureController.stop(); setGestureEnabled(false); musicEngine.playSfx(400); return; }
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera API unavailable.'); return; }
    try {
      const ok = await gestureController.init();
      if (ok) { setGestureEnabled(true); musicEngine.playSfx(900); }
      else alert('Gesture engine failed. See DevTools console.');
    } catch (err) { alert(`Gesture init error:\n${err}`); }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragRef.current.active) return;
    if (!cameraRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const rect  = canvasRef.current!.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      ((e.clientY - rect.top)  / rect.height) * -2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, cameraRef.current);
    const hits = ray.intersectObjects(hotspotsRef.current, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.isHotspot) obj = obj.parent;
      if (obj?.userData.isHotspot) {
        const hs = HOTSPOTS.find(h => h.key === obj.userData.key) ?? obj.userData;
        setSelectedHotspot(hs);
        selectedRef.current = hs;
        const pos = projectToScreen(hs.pos);
        if (pos) setHotspotScreenPos(pos);
        musicEngine.playSfx(900);
      }
    } else {
      setSelectedHotspot(null);
      selectedRef.current = null;
      setHotspotScreenPos(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: false, lastX: e.clientX, lastY: e.clientY, button: e.button };
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      dragRef.current.active = true;
      autoRotRef.current = false;
      setAutoRotate(false);
    }
    rotRef.current.theta -= dx * 0.008;
    rotRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, rotRef.current.phi - dy * 0.008));
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };

  const handlePointerUp = () => { pointerDownRef.current = null; };

  const touchRef = useRef<{ dist: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { dist: Math.hypot(dx, dy) };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d  = Math.hypot(dx, dy);
      targetZoomRef.current = Math.max(2, Math.min(10, targetZoomRef.current + (touchRef.current.dist - d) * 0.02));
      setDisplayZoom(+targetZoomRef.current.toFixed(1));
      touchRef.current.dist = d;
    }
  };
  const handleTouchEnd = () => { touchRef.current = null; };

  const getInfoBoxStyle = (): React.CSSProperties => {
    if (!hotspotScreenPos) return { display: 'none' };
    const boxW = 340; const boxH = 180;
    const vw = window.innerWidth; const vh = window.innerHeight;
    let left = hotspotScreenPos.x - boxW / 2;
    let top  = hotspotScreenPos.y - boxH - 28;
    if (left < 8)             left = 8;
    if (left + boxW > vw - 8) left = vw - boxW - 8;
    if (top  < 60)            top  = hotspotScreenPos.y + 28;
    if (top  + boxH > vh - 8) top  = vh - boxH - 8;
    return { position: 'fixed', left, top, zIndex: 150, width: boxW, pointerEvents: 'auto' };
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0a14' }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ width: '100%', height: '100%', cursor: pointerDownRef.current ? 'grabbing' : 'grab', touchAction: 'none', display: 'block' }}
      />

      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 100, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={11} /> EXIT
        </button>
        <button onClick={() => { setAutoRotate(v => !v); autoRotRef.current = !autoRotRef.current; }} title="Toggle auto-rotate"
          style={{ background: autoRotate ? 'rgba(6,255,165,0.2)' : '#000', border: '3px solid #06FFA5', color: '#06FFA5', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RotateCcw size={15} />
        </button>
        <button onClick={toggleGesture} title="Toggle gesture"
          style={{ background: gestureEnabled ? 'rgba(6,255,165,0.2)' : '#000', border: `3px solid ${gestureEnabled ? '#06FFA5' : '#555'}`, color: gestureEnabled ? '#06FFA5' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Hand size={15} />
        </button>
        <button onClick={() => nudgeZoom(-0.8)} title="Zoom in"
          style={{ background: '#000', border: '2px solid #00d4ff', color: '#00d4ff', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ZoomIn size={15} />
        </button>
        <button onClick={() => nudgeZoom(+0.8)} title="Zoom out"
          style={{ background: '#000', border: '2px solid #00d4ff', color: '#00d4ff', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ZoomOut size={15} />
        </button>
        <button onClick={() => { targetZoomRef.current = 5; setDisplayZoom(5); rotRef.current = { theta: 0.3, phi: Math.PI / 4 }; setAutoRotate(true); autoRotRef.current = true; }}
          style={{ background: '#000', border: '2px solid #666', color: '#888', padding: '0 10px', height: 40, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', cursor: 'pointer' }}>
          RESET
        </button>
        <button onClick={() => setShowHelp(v => !v)}
          style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <HelpCircle size={15} />
        </button>
      </div>

      <div style={{ position: 'fixed', top: 70, left: 16, zIndex: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: '#00d4ff', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', border: '1px solid #00d4ff44' }}>
        ZOOM {displayZoom.toFixed(1)}×
      </div>

      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', background: 'rgba(0,15,40,0.95)', border: '2px solid rgba(0,212,255,0.4)', overflow: 'hidden' }}>
        {(['stencil', 'real'] as const).map((m, i) => (
          <button key={m} onClick={() => { setMode(m); musicEngine.playSfx(600); }}
            style={{ padding: '10px 24px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', letterSpacing: 2, color: mode === m ? '#00d4ff' : 'rgba(0,212,255,0.5)', cursor: 'pointer', border: 'none', background: mode === m ? 'rgba(0,212,255,0.2)' : 'none', borderLeft: i === 1 ? '1px solid rgba(0,212,255,0.2)' : 'none' }}>
            {m === 'stencil' ? '⬡ STENCIL' : '◉ REAL (GLTF)'}
          </button>
        ))}
      </div>

      {modelError && mode === 'real' && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,110,0.9)', border: '2px solid #FF006E', padding: '8px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: '#fff', zIndex: 100 }}>
          ⚠ Model not found. Place sample.glb in /public folder.
        </div>
      )}

      <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {HOTSPOTS.map(h => (
          <button key={h.key} onClick={() => {
            setSelectedHotspot(h);
            selectedRef.current = h;
            const pos = projectToScreen(h.pos);
            if (pos) setHotspotScreenPos(pos);
            musicEngine.playSfx(700);
          }}
            style={{ background: selectedHotspot?.key === h.key ? `${h.color}33` : 'rgba(0,0,0,0.8)', border: `1px solid ${selectedHotspot?.key === h.key ? h.color : h.color + '55'}`, color: h.color, padding: '3px 8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', cursor: 'pointer', textAlign: 'left', maxWidth: 155, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ● {h.title.split(' ')[0]}
          </button>
        ))}
      </div>

      {selectedHotspot && hotspotScreenPos && (
        <div style={getInfoBoxStyle()}>
          <div style={{ background: 'rgba(0,12,35,0.98)', border: `2px solid ${selectedHotspot.color}`, borderRadius: 8, padding: '14px 18px', boxShadow: `0 6px 40px ${selectedHotspot.color}55`, position: 'relative' }}>
            <button onClick={() => { setSelectedHotspot(null); selectedRef.current = null; setHotspotScreenPos(null); }}
              style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: selectedHotspot.color, fontSize: 15, cursor: 'pointer' }}>✕</button>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', color: selectedHotspot.color, letterSpacing: 2, marginBottom: 8 }}>{selectedHotspot.title}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(200,255,255,0.85)', lineHeight: 1.7 }}>{selectedHotspot.info}</div>
          </div>
        </div>
      )}

      {gestureEnabled && <GestureHUD state={gestureState} zoom={displayZoom} />}

      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B', background: 'rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>3D CHIP VIEWER — HELP</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {[
                  { color: '#06FFA5', title: 'DRAG TO ROTATE',   body: 'Click/touch drag in ANY direction — full spherical rotation. Works on mouse and trackpad.' },
                  { color: '#00d4ff', title: 'ZOOM',             body: 'Mouse wheel, trackpad scroll, pinch gesture (touch), or +/− buttons. RESET returns to default view.' },
                  { color: '#FFBE0B', title: 'HOTSPOT INFO',     body: 'Click any glowing orb or use the sidebar. Infobox tracks the orb spatially as the model rotates.' },
                  { color: '#06FFA5', title: 'REAL MODE',        body: 'Switch to REAL (GLTF) to load a custom 3D model from /public/sample.glb. Hotspots overlay at same positions.' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.48rem', marginBottom: 7 }}>{s.title}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.75rem', lineHeight: 1.7 }}>{s.body}</div>
                  </div>
                ))}
              </div>

              {/* Gesture guide section */}
              <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #FFBE0B44', borderLeft: '4px solid #FFBE0B', padding: '14px 16px' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.48rem', marginBottom: 10 }}>GESTURE CONTROL (enable hand button)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {[
                    { icon: '✊', gesture: 'Fist + drag',  action: 'Rotate all axes (smooth, any angle)',  color: '#FFBE0B' },
                    { icon: '✋', gesture: 'Open Palm',    action: 'Zoom out (continuous)',                color: '#06FFA5' },
                    { icon: '🤏', gesture: 'Pinch',        action: 'Zoom in (single trigger)',             color: '#FF006E' },
                  ].map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', padding: '8px 10px', border: `1px solid ${g.color}33` }}>
                      <span style={{ fontSize: '1.4rem' }}>{g.icon}</span>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.65rem', color: g.color }}>{g.gesture}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.6rem', color: '#888' }}>{g.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: '0.65rem', color: 'rgba(180,220,255,0.6)', lineHeight: 1.6 }}>
                  Fist detection uses wrist-to-fingertip distance — works from front, side, and diagonal angles.
                  Move your fist in any direction to orbit the camera around all axes.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 16, right: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', color: 'rgba(0,212,255,0.4)', letterSpacing: 2, zIndex: 50, pointerEvents: 'none' }}>
        DRAG · SCROLL · CLICK HOTSPOT
      </div>
    </div>
  );
}