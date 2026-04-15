import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface ChipAssemblerProps { onBack: () => void; }

const PARTS_META = [
  { id:'grace_cpu',    label:'GRACE CPU',          sublabel:'72-core ARM Neoverse V2', color:'#76b900', side:'left'  as const, info:'72 ARM Neoverse V2 cores (ARMv9-A). 5-wide OoO superscalar, 320-entry ROB, SVE2 SIMD. TSMC 4N. Delivers ~900 GB/s to on-package LPDDR5X.',         placed:'Adds the 72-core CPU brain. Grace now handles all system logic, OS, and AI preprocessing — unlocking CPU-side compute.' },
  { id:'l3_cache',     label:'L3 CACHE',           sublabel:'576 MB NUCA',             color:'#ffaa00', side:'left'  as const, info:'576 MB NUCA L3 — 72×8 MB slices on a mesh ring. Closest slices ~20% faster. Cuts LPDDR5X traffic by ~40%.',                                           placed:'576 MB on-die cache installed. Reduces memory latency by 40% — CPUs can now serve most requests without hitting LPDDR5X.' },
  { id:'lpddr5x',      label:'LPDDR5X',            sublabel:'480 GB · 546 GB/s',       color:'#ff8800', side:'left'  as const, info:'480 GB on-package LPDDR5X, 8 channels, 546 GB/s. On-package → 50% less power vs DDR5 DIMM.',                                                           placed:'480 GB system memory online at 546 GB/s. CPU can now run massive LLM contexts and datasets with half the power of DDR5.' },
  { id:'coherence',    label:'COHERENCE ENGINE',   sublabel:'MESI Protocol',           color:'#ffdd44', side:'left'  as const, info:'MESI coherence over 128-byte cache lines. Snoop filter at C2C. Lets Grace CPU threads read GPU HBM3e directly.',                                        placed:'MESI coherence active. CPU threads can now read GPU HBM3e directly — no copies, unified memory model unlocked.' },
  { id:'pcie',         label:'PCIe 5.0',           sublabel:'4× ×16 · 512 GB/s',      color:'#aaaaaa', side:'left'  as const, info:'4× PCIe 5.0 ×16 = 512 GB/s. Connects NVMe, NICs, hosts. CXL-capable. External world gateway.',                                                         placed:'PCIe 5.0 host interface live. GH200 can now talk to NVMe SSDs, 400G NICs, and host servers at 512 GB/s.' },
  { id:'hopper_gpu',   label:'HOPPER GPU',         sublabel:'H100 · 132 SMs',          color:'#00ff88', side:'right' as const, info:'132 SMs · 16,896 CUDA cores. Boost 1.98 GHz. 3,958 TFLOPS FP8 via Transformer Engine.',                                                                placed:'H100 GPU die seated. 16,896 CUDA cores and Transformer Engine now delivering 3,958 TFLOPS FP8 for AI inference.' },
  { id:'tensor_cores', label:'TENSOR CORES',       sublabel:'528 × 4th-gen',           color:'#cc44ff', side:'right' as const, info:'528 4th-gen Tensor Cores. D=A×B+C on 16×8 tiles. FP8/BF16/FP16/TF32/INT8. Dynamic exponent scaling.',                                                  placed:'528 Tensor Cores active. Matrix multiply throughput for AI training now up — FP8, BF16, INT8 all supported natively.' },
  { id:'hbm3e',        label:'HBM3e',              sublabel:'96 GB · 4 TB/s',          color:'#ff5522', side:'right' as const, info:'6 HBM3e stacks = 96 GB at 4 TB/s. 1024-bit bus via TSVs. ECC SECDED. Primary GPU working memory.',                                                     placed:'96 GB HBM3e stacked. GPU now has 4 TB/s memory bandwidth — 10× a DDR5 DIMM. LLM weights load in milliseconds.' },
  { id:'nvlink_c2c',   label:'NVLink-C2C',         sublabel:'900 GB/s bridge',         color:'#00d4ff', side:'right' as const, info:'18 NVLink 4 lanes × 50 GB/s = 900 GB/s bidir. MESI coherent, ~40 ns. 14× faster than PCIe 5.0.',                                                      placed:'NVLink-C2C bridge connected. CPU↔GPU now share a coherent 900 GB/s fabric — 14× faster than PCIe. True unified memory.' },
  { id:'interposer',   label:'CoWoS-L INTERPOSER', sublabel:'2.5D silicon substrate',  color:'#00ff44', side:'right' as const, info:'TSMC CoWoS-L: GPU die + HBM3e on silicon interposer. Enables 1024-bit HBM bus. Heart of the GH200 package.',                                           placed:'Silicon interposer substrate placed. This is the foundation — enables the 1024-bit HBM3e bus and 2.5D chip stacking.' },
];

const BOARD_ID  = 'interposer';
const PLACE_IDS = PARTS_META.map(p => p.id).filter(id => id !== BOARD_ID);
const LEFT_IDS  = PARTS_META.filter(p => p.side === 'left').map(p => p.id);
const RIGHT_IDS = PARTS_META.filter(p => p.side === 'right' && p.id !== BOARD_ID).map(p => p.id);

// Gesture hint strings — updated (no peace sign)
const HINT_ASSEMBLED = '✊ hold fist then ✋ open = BLAST DISMANTLE';
const HINT_EXPLODED  = '✊ FIST DRAG = ROTATE ALL AXES  ·  🤏 PINCH LEFT/RIGHT = GRAB  ·  ✋ OPEN = PLACE';

interface BoxDef { x:number; y:number; z:number; w:number; h:number; d:number; col:number; em?:number; ei?:number; }

function getAssembledBoxes(): Record<string, { boxes:BoxDef[]; home:[number,number,number] }> {
  return {
    grace_cpu:    { home:[-0.60, 0.05,  0.00], boxes:[
      { x:0,y:0,z:0, w:1.0,h:0.10,d:1.3, col:0x1e3a10,em:0x76b900,ei:0.30 },
      ...Array.from({length:24},(_,i)=>({ x:((i%6)-2.5)*0.14,y:0.07,z:(Math.floor(i/6)-1.5)*0.28,w:0.10,h:0.025,d:0.20,col:0x2a5a18,em:0x76b900,ei:0.18 })),
    ]},
    l3_cache:     { home:[-0.60, 0.05, -0.58], boxes:[
      { x:0,y:0,z:0, w:0.85,h:0.04,d:0.20,col:0x3a2800,em:0xffaa00,ei:0.55 },
      ...Array.from({length:6},(_,i)=>({ x:(i-2.5)*0.13,y:0.03,z:0,w:0.10,h:0.025,d:0.16,col:0x2a1e00,em:0xffaa00,ei:0.30 })),
    ]},
    lpddr5x:      { home:[-1.15, 0.05,  0.00], boxes:[
      ...Array.from({length:3},(_,i)=>({ x:0,y:0,z:(i-1)*0.46,w:0.22,h:0.10,d:0.32,col:0x331a00,em:0xff8800,ei:0.40 })),
    ]},
    coherence:    { home:[ 0.00, 0.05, -0.52], boxes:[
      { x:0,y:0,z:0,w:0.20,h:0.04,d:0.22,col:0x332200,em:0xffdd44,ei:0.80 },
    ]},
    pcie:         { home:[-1.38,-0.02,  0.00], boxes:[
      { x:0,y:0,z:0,w:0.14,h:0.07,d:0.60,col:0x222222,em:0xaaaaaa,ei:0.20 },
    ]},
    hopper_gpu:   { home:[ 0.60, 0.05,  0.00], boxes:[
      { x:0,y:0,z:0,w:1.10,h:0.10,d:1.3,col:0x0e2818,em:0x00ff88,ei:0.22 },
      ...Array.from({length:24},(_,i)=>({ x:((i%6)-2.5)*0.16,y:0.07,z:(Math.floor(i/6)-1.5)*0.28,w:0.12,h:0.025,d:0.20,col:0x103820,em:0x00ff88,ei:0.14 })),
    ]},
    tensor_cores: { home:[ 0.38, 0.07, -0.12], boxes:[
      ...Array.from({length:9},(_,i)=>({ x:((i%3)-1)*0.13,y:0,z:(Math.floor(i/3)-1)*0.13,w:0.09,h:0.035,d:0.09,col:0x1a0028,em:0xcc44ff,ei:0.90 })),
    ]},
    hbm3e:        { home:[ 1.18, 0.10,  0.00], boxes:[
      ...[-0.52,-0.18,0.16,0.50].flatMap(z=>
        Array.from({length:5},(_,l)=>({ x:0,y:l*0.035,z,w:0.22,h:0.030,d:0.22,col:l%2===0?0x3a0800:0x220500,em:0xff3300,ei:0.15+l*0.05 }))
      ),
    ]},
    nvlink_c2c:   { home:[ 0.00, 0.04,  0.00], boxes:[
      { x:0,y:0,z:0,w:0.20,h:0.04,d:1.10,col:0x003050,em:0x00d4ff,ei:0.95 },
      ...Array.from({length:12},(_,i)=>({ x:0,y:0.025,z:(i-5.5)*0.09,w:0.16,h:0.012,d:0.06,col:0x001830,em:0x00d4ff,ei:0.60 })),
    ]},
    interposer:   { home:[ 0.00,-0.27,  0.00], boxes:[
      { x:0,y:0,z:0,   w:3.20,h:0.06,d:2.40,col:0x141414 },
      { x:0,y:0.04,z:0,w:2.80,h:0.04,d:2.00,col:0x0a1f0c,em:0x00ff44,ei:0.05 },
    ]},
  };
}

const COLUMN_SLOT_LEFT : [number,number,number][] = [
  [-5.0,  1.8, 0.0],[-5.6,  0.9, 0.0],[-6.0,  0.0, 0.0],[-5.6, -0.9, 0.0],[-5.0, -1.8, 0.0],
];
const COLUMN_SLOT_RIGHT: [number,number,number][] = [
  [ 5.0,  1.8, 0.0],[ 5.6,  0.9, 0.0],[ 6.0,  0.0, 0.0],[ 5.6, -0.9, 0.0],[ 5.0, -1.8, 0.0],
];

const isNearColumn = (ex: number): boolean => {
  const frac = ex / window.innerWidth;
  return frac < 0.20 || frac > 0.80;
};

type Phase = 'assembled'|'exploding'|'exploded'|'assembling'|'done';
declare global { interface Window { THREE:any; } }

function loadThree(cb: ()=>void) {
  if (window.THREE) { cb(); return; }
  const existing = document.querySelector('script[src*="three"]');
  if (existing) { const poll = setInterval(()=>{ if(window.THREE){ clearInterval(poll); cb(); } }, 30); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload = cb;
  s.onerror = ()=>console.error('[ChipAssembler] THREE load failed');
  document.head.appendChild(s);
}

export default function ChipAssembler({ onBack }: ChipAssemblerProps) {
  const [phase, setPhase]                   = useState<Phase>('assembled');
  const [autoRot, setAutoRot]               = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureLog, setGestureLog]         = useState(HINT_ASSEMBLED);
  const [placedParts, setPlacedParts]       = useState<Set<string>>(new Set());
  const [hudPart, setHudPart]               = useState<string|null>(null);
  const [hudScreen, setHudScreen]           = useState<{x:number,y:number}|null>(null);
  const [displayZoom, setDisplayZoom]       = useState(6);
  const [showSuccess, setShowSuccess]       = useState(false);
  const [lastPlaced, setLastPlaced]         = useState<string|null>(null);
  const lastPlacedTimerRef                  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const [handPointer, setHandPointer]       = useState<{x:number,y:number}|null>(null);
  const [handGesture, setHandGesture]       = useState<string>('none');

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const sceneRef    = useRef<any>(null);
  const cameraRef   = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const rootGroup   = useRef<any>(null);
  const animRef     = useRef<number|null>(null);
  const mountedRef  = useRef(false);
  const partGroup   = useRef<Map<string,any>>(new Map());
  const partTarget  = useRef<Map<string,[number,number,number]>>(new Map());
  const dragging    = useRef<string|null>(null);
  const dragPlane   = useRef<any>(null);
  const raycaster   = useRef<any>(null);
  const mouse3D     = useRef<any>(null);
  const rotRef      = useRef({ theta:0.4, phi:1.1 });
  const autoRotRef  = useRef(true);
  const targetZoom  = useRef(6);
  const curZoom     = useRef(6);
  const camDrag     = useRef({ on:false, lx:0, ly:0 });
  const phaseRef    = useRef<Phase>('assembled');
  const placedRef   = useRef<Set<string>>(new Set());
  const hudPartRef  = useRef<string|null>(null);
  const gPickRef    = useRef<string|null>(null);

  useEffect(()=>{ phaseRef.current   = phase; },       [phase]);
  useEffect(()=>{ placedRef.current  = placedParts; }, [placedParts]);
  useEffect(()=>{ autoRotRef.current = autoRot; },     [autoRot]);
  useEffect(()=>{ hudPartRef.current = hudPart; },     [hudPart]);

  useEffect(()=>{
    if(gestureEnabled){
      if(phase==='assembled'||phase==='done') setGestureLog(HINT_ASSEMBLED);
      else if(phase==='exploded') setGestureLog(HINT_EXPLODED);
    }
  },[phase, gestureEnabled]);

  const resizeRenderer = useCallback(()=>{
    const c=canvasRef.current;
    if(!c||!rendererRef.current||!cameraRef.current) return;
    const w=c.clientWidth, h=c.clientHeight; if(!w||!h) return;
    rendererRef.current.setSize(w,h); cameraRef.current.aspect=w/h; cameraRef.current.updateProjectionMatrix();
  },[]);

  const projectToScreen = useCallback((wx:number,wy:number,wz:number):{x:number,y:number}|null=>{
    if(!cameraRef.current||!canvasRef.current||!window.THREE) return null;
    const v=new window.THREE.Vector3(wx,wy,wz).project(cameraRef.current);
    const r=canvasRef.current.getBoundingClientRect();
    return { x:(v.x+1)/2*r.width+r.left, y:(-v.y+1)/2*r.height+r.top };
  },[]);

  const buildScene = useCallback(()=>{
    if(!rootGroup.current||!window.THREE) return;
    const THREE=window.THREE, root=rootGroup.current;
    while(root.children.length) root.remove(root.children[0]);
    partGroup.current.clear(); partTarget.current.clear();
    Object.entries(getAssembledBoxes()).forEach(([id,{home,boxes}])=>{
      const pg=new THREE.Group(); pg.userData.partId=id;
      boxes.forEach(b=>{
        const p:any={color:b.col,roughness:0.25,metalness:0.80};
        if(b.em!==undefined){p.emissive=new THREE.Color(b.em);p.emissiveIntensity=b.ei??0.2;}
        const m=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,b.d),new THREE.MeshStandardMaterial(p));
        m.position.set(b.x,b.y,b.z); m.userData.partId=id; pg.add(m);
      });
      pg.position.set(home[0],home[1],home[2]); root.add(pg);
      partGroup.current.set(id,pg); partTarget.current.set(id,[home[0],home[1],home[2]]);
    });
    raycaster.current=new THREE.Raycaster(); mouse3D.current=new THREE.Vector2();
    dragPlane.current=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  },[]);

  const startLoopRef = useRef<()=>void>(()=>{});
  startLoopRef.current = ()=>{
    const loop=()=>{
      if(!cameraRef.current||!rendererRef.current||!sceneRef.current){ animRef.current=requestAnimationFrame(loop); return; }
      if(autoRotRef.current&&(phaseRef.current==='assembled'||phaseRef.current==='done')) rotRef.current.theta+=0.003;
      const zt=(phaseRef.current==='exploded'||phaseRef.current==='exploding')?targetZoom.current+4:targetZoom.current;
      curZoom.current+=(zt-curZoom.current)*0.08;
      const {theta,phi}=rotRef.current, r=curZoom.current;
      cameraRef.current.position.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta));
      cameraRef.current.lookAt(0,0,0);
      let settled=true;
      partTarget.current.forEach((tgt,id)=>{
        const pg=partGroup.current.get(id); if(!pg||dragging.current===id) return;
        const dx=tgt[0]-pg.position.x,dy=tgt[1]-pg.position.y,dz=tgt[2]-pg.position.z;
        const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(dist>0.008){ settled=false; const s=phaseRef.current==='exploding'?0.055:0.075; pg.position.x+=dx*s;pg.position.y+=dy*s;pg.position.z+=dz*s; }
        else pg.position.set(tgt[0],tgt[1],tgt[2]);
      });
      if(settled&&phaseRef.current==='exploding'){ phaseRef.current='exploded'; setPhase('exploded'); }
      if(settled&&phaseRef.current==='assembling'){ phaseRef.current='done'; setPhase('done'); autoRotRef.current=true; setAutoRot(true); setShowSuccess(true); setTimeout(()=>setShowSuccess(false),6000); }
      const hp=hudPartRef.current;
      if(hp){ const pg=partGroup.current.get(hp); if(pg){ const sp=projectToScreen(pg.position.x,pg.position.y+0.3,pg.position.z); if(sp) setHudScreen(sp); } }
      rendererRef.current.render(sceneRef.current,cameraRef.current);
      animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);
  };

  const setupScene = ()=>{
    if(!canvasRef.current||!window.THREE||mountedRef.current) return;
    mountedRef.current=true;
    const THREE=window.THREE, canvas=canvasRef.current;
    const W=canvas.clientWidth||800, H=canvas.clientHeight||540;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(55,W/H,0.01,200);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    renderer.setSize(W,H); renderer.setClearColor(0x080810,1); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    scene.add(new THREE.AmbientLight(0x334455,3.5));
    const dl=new THREE.DirectionalLight(0xffffff,3.0); dl.position.set(6,10,7); scene.add(dl);
    const dl2=new THREE.DirectionalLight(0x88ccff,1.8); dl2.position.set(-6,5,-4); scene.add(dl2);
    const pl1=new THREE.PointLight(0x76b900,5,25); pl1.position.set(-5,7,-5); scene.add(pl1);
    const pl2=new THREE.PointLight(0x00d4ff,4,22); pl2.position.set(5,6,5); scene.add(pl2);
    const pl3=new THREE.PointLight(0xff5500,2,18); pl3.position.set(3,4,-6); scene.add(pl3);
    scene.add(new THREE.HemisphereLight(0x223344,0x111122,1.5));
    const root=new THREE.Group(); scene.add(root);
    sceneRef.current=scene; cameraRef.current=camera; rendererRef.current=renderer; rootGroup.current=root;
    buildScene(); startLoopRef.current(); window.addEventListener('resize',resizeRenderer);
  };

  useEffect(()=>{ loadThree(setupScene); return ()=>{ if(animRef.current) cancelAnimationFrame(animRef.current); window.removeEventListener('resize',resizeRenderer); mountedRef.current=false; }; },[]); // eslint-disable-line

  const triggerExplode=useCallback(()=>{
    if(phaseRef.current!=='assembled') return;
    setPhase('exploding'); phaseRef.current='exploding';
    setAutoRot(false); autoRotRef.current=false;
    musicEngine.playSfx(180);
    rotRef.current={ theta: 0, phi: Math.PI / 2 };
    LEFT_IDS.forEach((id,i)=>partTarget.current.set(id,COLUMN_SLOT_LEFT[i]));
    RIGHT_IDS.forEach((id,i)=>partTarget.current.set(id,COLUMN_SLOT_RIGHT[i]));
    partTarget.current.set(BOARD_ID,[0,-0.27,0]);
  },[]);

  const showLastPlaced = useCallback((id: string) => {
    setLastPlaced(id);
    if(lastPlacedTimerRef.current) clearTimeout(lastPlacedTimerRef.current);
    lastPlacedTimerRef.current = setTimeout(()=>setLastPlaced(null), 5000);
  }, []);

  const snapToBoard=useCallback((id:string)=>{
    if(placedRef.current.has(id)||id===BOARD_ID) return;
    const def=getAssembledBoxes()[id]; if(!def) return;
    partTarget.current.set(id,[def.home[0],def.home[1],def.home[2]]);
    dragging.current=null; showLastPlaced(id);
    setPlacedParts(prev=>{ const n=new Set(prev); n.add(id); if(PLACE_IDS.every(pid=>n.has(pid))) setTimeout(()=>{setPhase('assembling');phaseRef.current='assembling';},300); return n; });
    musicEngine.playSfx(820);
  },[showLastPlaced]);

  const returnToSlot=useCallback((id:string)=>{
    const meta=PARTS_META.find(p=>p.id===id); if(!meta) return;
    if(meta.side==='left'){ const i=LEFT_IDS.indexOf(id); if(i>=0) partTarget.current.set(id,COLUMN_SLOT_LEFT[i]); }
    else                  { const i=RIGHT_IDS.indexOf(id); if(i>=0) partTarget.current.set(id,COLUMN_SLOT_RIGHT[i]); }
    dragging.current=null;
  },[]);

  const hitTestColumns=(ex:number,ey:number)=>{
    if(!cameraRef.current||!canvasRef.current||!window.THREE||!raycaster.current) return null;
    const rect=canvasRef.current.getBoundingClientRect();
    mouse3D.current.set(((ex-rect.left)/rect.width)*2-1,-((ey-rect.top)/rect.height)*2+1);
    raycaster.current.setFromCamera(mouse3D.current,cameraRef.current);
    const cands:any[]=[];
    PARTS_META.forEach(p=>{ if(p.id===BOARD_ID||placedRef.current.has(p.id)) return; const pg=partGroup.current.get(p.id); if(pg) pg.children.forEach((m:any)=>cands.push(m)); });
    const hits=raycaster.current.intersectObjects(cands,false);
    return hits.length?(hits[0].object.userData.partId??null):null;
  };

  const moveDraggedPart=(ex:number,ey:number)=>{
    if(!dragging.current||!cameraRef.current||!canvasRef.current||!window.THREE) return;
    const pg=partGroup.current.get(dragging.current); if(!pg) return;
    const rect=canvasRef.current.getBoundingClientRect();
    mouse3D.current.set(((ex-rect.left)/rect.width)*2-1,-((ey-rect.top)/rect.height)*2+1);
    raycaster.current.setFromCamera(mouse3D.current,cameraRef.current);
    const t=new window.THREE.Vector3(); dragPlane.current.constant=-pg.position.y;
    if(raycaster.current.ray.intersectPlane(dragPlane.current,t)){ pg.position.x=t.x; pg.position.z=t.z; }
  };

  const handlePointerDown=(e:React.PointerEvent)=>{
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if(phaseRef.current==='exploded'){
      const hit=hitTestColumns(e.clientX,e.clientY);
      if(hit){ dragging.current=hit; setHudPart(hit); hudPartRef.current=hit; const pos=partGroup.current.get(hit)?.position??{x:0,y:0,z:0}; const sp=projectToScreen(pos.x,pos.y,pos.z); if(sp) setHudScreen(sp); musicEngine.playSfx(600); return; }
    }
    camDrag.current={on:true,lx:e.clientX,ly:e.clientY};
  };

  const handlePointerMove=(e:React.PointerEvent)=>{
    if(dragging.current){ moveDraggedPart(e.clientX,e.clientY); const pg=partGroup.current.get(dragging.current); if(pg){ const sp=projectToScreen(pg.position.x,pg.position.y+0.35,pg.position.z); if(sp) setHudScreen(sp); } return; }
    if(phaseRef.current==='exploded'){ const hit=hitTestColumns(e.clientX,e.clientY); if(hit!==hudPart){ setHudPart(hit); hudPartRef.current=hit; if(hit){ const pg=partGroup.current.get(hit); if(pg){ const sp=projectToScreen(pg.position.x,pg.position.y+0.4,pg.position.z); if(sp) setHudScreen(sp); } } } }
    if(camDrag.current.on){ const dx=e.clientX-camDrag.current.lx,dy=e.clientY-camDrag.current.ly; rotRef.current.theta-=dx*0.007; rotRef.current.phi=Math.max(0.15,Math.min(Math.PI-0.15,rotRef.current.phi-dy*0.007)); camDrag.current.lx=e.clientX; camDrag.current.ly=e.clientY; }
  };

  const handlePointerUp=(e:React.PointerEvent)=>{
    if(dragging.current){ const id=dragging.current; if(isNearColumn(e.clientX)) returnToSlot(id); else snapToBoard(id); dragging.current=null; setHudPart(null); hudPartRef.current=null; }
    camDrag.current.on=false;
  };

  const handleWheel=(e:React.WheelEvent)=>{ const d=e.deltaMode===1?e.deltaY*40:e.deltaY; targetZoom.current=Math.max(2,Math.min(12,targetZoom.current+d*0.004)); setDisplayZoom(+targetZoom.current.toFixed(1)); };
  const nudgeZoom=(d:number)=>{ targetZoom.current=Math.max(2,Math.min(12,targetZoom.current+d)); setDisplayZoom(+targetZoom.current.toFixed(1)); };
  const toggleRot=useCallback(()=>{ const n=!autoRotRef.current; autoRotRef.current=n; setAutoRot(n); },[]);

  const resetAll=()=>{
    setPlacedParts(new Set()); placedRef.current=new Set();
    setShowSuccess(false); setLastPlaced(null);
    setHudPart(null); hudPartRef.current=null; setHudScreen(null);
    dragging.current=null; gPickRef.current=null;
    targetZoom.current=6; setDisplayZoom(6);
    rotRef.current={theta:0.4,phi:1.1}; autoRotRef.current=true; setAutoRot(true);
    setPhase('assembled'); phaseRef.current='assembled';
    setGestureLog(HINT_ASSEMBLED);
    buildScene();
  };

  // ── GESTURE HANDLER ───────────────────────────────────────────────
  // ASSEMBLED / DONE:
  //   FIST (hold) → armed, log feedback
  //   OPEN after FIST (blastFired=true) → DISMANTLE
  //   OPEN without prior fist → hint
  //
  // EXPLODED:
  //   FIST DRAG (fistDX/fistDY) → rotate all axes continuously (distance-based, all angles)
  //   PINCH → grab from column by screen side
  //   OPEN → place held part onto board
  //
  // Peace sign REMOVED — was too easy to accidentally trigger rotation toggle
  const handleGesture=useCallback((g:GestureState)=>{
    const curPhase = phaseRef.current;

    // Update hand pointer
    if(g.rawX !== undefined && g.rawY !== undefined) {
      if(g.type !== 'none') {
        setHandPointer({ x: (1 - g.rawX) * window.innerWidth, y: g.rawY * window.innerHeight });
        setHandGesture(g.type);
      } else {
        setHandPointer({ x: (1 - g.rawX) * window.innerWidth, y: g.rawY * window.innerHeight });
        setHandGesture('none');
      }
    } else {
      setHandPointer(null);
      setHandGesture('none');
    }

    // ── ASSEMBLED ──────────────────────────────────────────────────
    if(curPhase === 'assembled' || curPhase === 'done') {
      if(g.type === 'fist') {
        setGestureLog('✊ Fist held — now OPEN your palm to BLAST!');
        return;
      }
      if(g.type === 'open') {
        if(g.blastFired) {
          setGestureLog('💥 BLAST! DISMANTLING…');
          triggerExplode();
          musicEngine.playSfx(180);
        } else {
          setGestureLog('✋ Open palm — make a ✊ fist first, then open to BLAST');
        }
        return;
      }
      setGestureLog(HINT_ASSEMBLED);
      return;
    }

    // ── EXPLODED ───────────────────────────────────────────────────
    if(curPhase === 'exploded') {
      // FIST DRAG → rotate all axes (distance-based fist, works any angle)
      if(g.type === 'fist') {
        const dx = g.fistDX ?? 0;
        const dy = g.fistDY ?? 0;
        if(Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          setGestureLog('✊ Rotating…');
          autoRotRef.current = false; setAutoRot(false);
          // dx positive = wrist moving right in camera = rotate right (theta decreases in mirrored view)
          rotRef.current.theta -= dx * 10;
          rotRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15,
            rotRef.current.phi + dy * 10
          ));
        } else {
          setGestureLog('✊ Fist ready — drag to rotate');
        }
        return;
      }

      // PINCH → grab from column
      if(g.type === 'pinch') {
        const rx  = g.rawX ?? 0.5;
        const col = rx >= 0.5 ? 'left' : 'right';
        const avail = (col === 'left' ? LEFT_IDS : RIGHT_IDS).filter(id => !placedRef.current.has(id));
        if(avail.length) {
          const id = avail[0]; gPickRef.current = id;
          setHudPart(id); hudPartRef.current = id;
          const label = PARTS_META.find(p => p.id === id)?.label ?? id;
          setGestureLog(`🤏 GRABBED ${label} — open palm ✋ to place`);
          musicEngine.playSfx(600);
        } else {
          setGestureLog(`🤏 No more parts on ${col} side`);
        }
        return;
      }

      // OPEN → place held part
      if(g.type === 'open') {
        if(gPickRef.current) {
          const id = gPickRef.current;
          snapToBoard(id);
          setGestureLog(`✅ PLACED ${PARTS_META.find(p => p.id === id)?.label ?? id}`);
          gPickRef.current = null; setHudPart(null); hudPartRef.current = null;
        } else {
          setGestureLog('✋ Open — 🤏 pinch left/right to grab a part first');
        }
        return;
      }

      return;
    }
    // exploding / assembling — transitioning, ignore
  },[triggerExplode, snapToBoard]);

  const toggleGesture=async()=>{
    if(gestureEnabled){
      gestureController.stop(); setGestureEnabled(false); setHandPointer(null);
      setGestureLog(HINT_ASSEMBLED);
      musicEngine.playSfx(400); return;
    }
    if(!navigator.mediaDevices?.getUserMedia){ alert('Camera unavailable.'); return; }
    try{
      setGestureLog('⏳ Loading gesture model…');
      const ok=await gestureController.init();
      if(ok){ setGestureEnabled(true); setGestureLog(HINT_ASSEMBLED); musicEngine.playSfx(900); }
      else { setGestureLog('❌ Gesture engine failed'); alert('Gesture engine failed.'); }
    }catch(err){ setGestureLog('❌ Gesture error'); alert(`Gesture error:\n${err}`); }
  };

  useEffect(()=>{ if(gestureEnabled){ gestureController.subscribe(handleGesture); return()=>gestureController.unsubscribe(handleGesture); } },[gestureEnabled,handleGesture]);

  const gesturePointerColor = () => {
    switch(handGesture) {
      case 'pinch': return '#ff006e'; case 'fist':  return '#ff8800';
      case 'open':  return '#06FFA5'; case 'peace': return '#cc44ff';
      case 'index': return '#00d4ff'; default: return 'rgba(200,200,200,0.5)';
    }
  };

  const hudMeta        = hudPart ? PARTS_META.find(p=>p.id===hudPart) : null;
  const lastPlacedMeta = lastPlaced ? PARTS_META.find(p=>p.id===lastPlaced) : null;
  const isSidePhase    = phase==='exploding'||phase==='exploded'||phase==='assembling';
  const progress       = `${placedParts.size} / ${PLACE_IDS.length}`;

  return (
    <div style={{width:'100%',height:'100%',position:'relative',background:'#080810'}}>
      <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel}
        style={{width:'100%',height:'100%',display:'block',touchAction:'none',cursor:dragging.current?'grabbing':hudPart?'grab':'default'}}/>

      {/* HAND POINTER */}
      {gestureEnabled && handPointer && (
        <div style={{position:'fixed',left:handPointer.x,top:handPointer.y,transform:'translate(-50%,-50%)',zIndex:1000,pointerEvents:'none',transition:'left 0.04s linear,top 0.04s linear'}}>
          <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:handGesture==='pinch'?18:28,height:handGesture==='pinch'?18:28,borderRadius:'50%',border:`2px solid ${gesturePointerColor()}`,opacity:handGesture==='none'?0.35:0.7,transition:'width 0.1s,height 0.1s,border-color 0.15s',boxShadow:`0 0 12px ${gesturePointerColor()}88`}}/>
          <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:handGesture==='pinch'?6:8,height:handGesture==='pinch'?6:8,borderRadius:'50%',background:gesturePointerColor(),boxShadow:`0 0 8px ${gesturePointerColor()}`,transition:'width 0.1s,height 0.1s,background 0.15s'}}/>
          {handGesture!=='none'&&handGesture!=='index'&&(
            <div style={{position:'absolute',top:20,left:'50%',transform:'translateX(-50%)',fontFamily:"'JetBrains Mono',monospace",fontSize:'0.38rem',color:gesturePointerColor(),whiteSpace:'nowrap',opacity:0.8,textShadow:`0 0 6px ${gesturePointerColor()}`}}>
              {handGesture==='fist'&&'✊'}{handGesture==='open'&&'✋'}{handGesture==='pinch'&&'🤏'}
            </div>
          )}
        </div>
      )}

      {/* TOP BAR */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:200,display:'flex',gap:6,padding:'10px 14px',alignItems:'center',flexWrap:'wrap',background:'rgba(8,8,16,0.88)',backdropFilter:'blur(6px)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <button onClick={onBack} style={{fontFamily:"'Press Start 2P',cursive",background:'#000',border:'3px solid #FFBE0B',color:'#FFBE0B',padding:'7px 12px',fontSize:'0.48rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}><ArrowLeft size={11}/> EXIT</button>
        <button onClick={toggleRot} style={{background:autoRot?'rgba(6,255,165,0.18)':'#000',border:`3px solid ${autoRot?'#06FFA5':'#444'}`,color:autoRot?'#06FFA5':'#444',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><RotateCcw size={13}/></button>
        <button onClick={toggleGesture} style={{background:gestureEnabled?'rgba(6,255,165,0.18)':'#000',border:`3px solid ${gestureEnabled?'#06FFA5':'#555'}`,color:gestureEnabled?'#06FFA5':'#555',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Hand size={13}/></button>
        <button onClick={()=>nudgeZoom(-1)} style={{background:'#000',border:'2px solid #00d4ff',color:'#00d4ff',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><ZoomIn size={13}/></button>
        <button onClick={()=>nudgeZoom(+1)} style={{background:'#000',border:'2px solid #00d4ff',color:'#00d4ff',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><ZoomOut size={13}/></button>
        <button onClick={resetAll} style={{background:'#000',border:'2px solid #8338EC',color:'#8338EC',padding:'0 12px',height:36,fontFamily:"'JetBrains Mono',monospace",fontSize:'0.5rem',cursor:'pointer'}}>RESET</button>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.5rem',color:'#00d4ff',background:'rgba(0,0,0,0.6)',padding:'3px 8px',border:'1px solid #00d4ff33'}}>{displayZoom.toFixed(1)}×</div>
        <div style={{flex:1,textAlign:'center',pointerEvents:'none'}}>
          <span style={{fontFamily:"'Press Start 2P',cursive",fontSize:'clamp(0.45rem,1vw,0.7rem)',color:'#00d4ff',textShadow:'0 0 14px #00d4ff',letterSpacing:3}}>GH200 CHIP ASSEMBLER</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.5rem',color:'rgba(0,212,255,0.45)',marginLeft:14}}>
            {phase==='assembled'&&'DISMANTLE TO BEGIN'}{phase==='exploding'&&'DISMANTLING…'}{phase==='exploded'&&`DRAG PARTS ONTO BOARD · ${progress}`}{phase==='assembling'&&'ASSEMBLING…'}{phase==='done'&&'✓ FULLY ASSEMBLED'}
          </span>
        </div>
      </div>

      {/* DISMANTLE */}
      {phase==='assembled'&&(
        <div style={{position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:150,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'clamp(0.42rem,0.8vw,0.6rem)',color:'rgba(0,212,255,0.72)',lineHeight:1.9,background:'rgba(0,4,18,0.82)',padding:'10px 20px',border:'1px solid rgba(0,212,255,0.18)',borderRadius:4}}>
            Click <b style={{color:'#FF006E'}}>DISMANTLE</b> &nbsp;·&nbsp; or <span style={{color:'#ff8800'}}>✊</span> hold fist then <span style={{color:'#06FFA5'}}>✋</span> open palm
          </div>
          <button onClick={triggerExplode} style={{fontFamily:"'Press Start 2P',cursive",background:'linear-gradient(180deg,#FF006E,#c1004e)',border:'3px solid #000',color:'#fff',padding:'10px 24px',fontSize:'0.5rem',cursor:'pointer',boxShadow:'0 5px 0 #8B0040,0 5px 22px rgba(255,0,110,0.45)',letterSpacing:1}} onMouseDown={e=>{e.currentTarget.style.transform='translateY(4px)';e.currentTarget.style.boxShadow='0 1px 0 #8B0040';}} onMouseUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #8B0040,0 5px 22px rgba(255,0,110,0.45)';}}>
            💥 DISMANTLE
          </button>
        </div>
      )}

      {/* side labels */}
      {isSidePhase&&<>
        <div style={{position:'fixed',left:0,top:60,bottom:32,width:34,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',borderRight:'1px solid rgba(118,185,0,0.12)'}}><div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.3rem',color:'rgba(118,185,0,0.5)',letterSpacing:3,writingMode:'vertical-rl',transform:'rotate(180deg)'}}>CPU SIDE</div></div>
        <div style={{position:'fixed',right:0,top:60,bottom:32,width:34,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',borderLeft:'1px solid rgba(0,255,136,0.12)'}}><div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.3rem',color:'rgba(0,255,136,0.5)',letterSpacing:3,writingMode:'vertical-rl'}}>GPU SIDE</div></div>
      </>}

      {/* drop hint */}
      {phase==='exploded'&&(
        <div style={{position:'fixed',left:'22%',right:'22%',top:'30%',bottom:'18%',zIndex:20,border:'1px dashed rgba(0,212,255,0.12)',borderRadius:6,pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontFamily:"'Press Start 2P',cursive",fontSize:'0.35rem',color:'rgba(0,212,255,0.14)',letterSpacing:2,textAlign:'center',lineHeight:2.2}}>DRAG HERE<br/>TO PLACE</div>
        </div>
      )}

      {/* HUD tooltip */}
      {hudMeta&&hudScreen&&(
        <div style={{position:'fixed',left:hudScreen.x,top:hudScreen.y,transform:'translateX(-50%) translateY(-100%)',zIndex:500,pointerEvents:'none'}}>
          <div style={{background:'rgba(0,4,20,0.97)',border:`1px solid ${hudMeta.color}`,borderRadius:4,padding:'9px 13px',boxShadow:`0 4px 28px ${hudMeta.color}66`,maxWidth:240}}>
            <div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.4rem',color:hudMeta.color,marginBottom:4}}>{hudMeta.label}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.5rem',color:'rgba(150,210,255,0.65)',marginBottom:5}}>{hudMeta.sublabel}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.56rem',color:'rgba(200,235,255,0.88)',lineHeight:1.65}}>{hudMeta.info}</div>
            <div style={{marginTop:6,fontFamily:"'JetBrains Mono',monospace",fontSize:'0.4rem',color:hudMeta.color+'99'}}>{dragging.current===hudMeta.id?'↓ RELEASE IN CENTER TO PLACE':'← drag toward center →'}</div>
          </div>
          <div style={{width:0,height:0,borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderTop:`6px solid ${hudMeta.color}`,margin:'0 auto'}}/>
        </div>
      )}

      {/* LAST PLACED */}
      {lastPlacedMeta&&(
        <div style={{position:'fixed',bottom:48,left:44,zIndex:400,maxWidth:300,pointerEvents:'none',animation:'fadeInUp 0.3s ease'}}>
          <div style={{background:'rgba(0,6,24,0.97)',border:`2px solid ${lastPlacedMeta.color}`,borderRadius:6,padding:'14px 18px',boxShadow:`0 0 40px ${lastPlacedMeta.color}44`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><div style={{width:8,height:8,borderRadius:'50%',background:lastPlacedMeta.color,boxShadow:`0 0 8px ${lastPlacedMeta.color}`}}/><div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.45rem',color:lastPlacedMeta.color,letterSpacing:2}}>INSTALLED</div></div>
            <div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.5rem',color:'#fff',marginBottom:8,lineHeight:1.6}}>{lastPlacedMeta.label}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.65rem',color:'rgba(180,230,255,0.9)',lineHeight:1.7}}>{lastPlacedMeta.placed}</div>
            <div style={{marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:'0.4rem',color:`${lastPlacedMeta.color}88`}}>{placedParts.size} / {PLACE_IDS.length} COMPONENTS INSTALLED</div>
          </div>
        </div>
      )}

      {/* GESTURE LOG — always visible when enabled */}
      {gestureEnabled && (
        <div style={{position:'fixed',bottom:44,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,0.92)',border:'2px solid #06FFA5',padding:'6px 20px',minWidth:380,textAlign:'center',fontFamily:"'JetBrains Mono',monospace",fontSize:'0.58rem',color:'#06FFA5',zIndex:150,pointerEvents:'none',whiteSpace:'nowrap'}}>
          {gestureLog}
        </div>
      )}

      {/* Gesture quick ref card — shown in exploded phase */}
      {gestureEnabled && phase === 'exploded' && (
        <div style={{position:'fixed',bottom:90,right:40,zIndex:150,background:'rgba(0,0,0,0.88)',border:'1px solid rgba(0,212,255,0.25)',padding:'10px 14px',pointerEvents:'none',maxWidth:210}}>
          <div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.38rem',color:'#00d4ff',marginBottom:8,letterSpacing:1}}>GESTURE GUIDE</div>
          {[
            { icon:'✊', label:'Fist + drag', action:'Rotate all axes', color:'#FFBE0B' },
            { icon:'🤏', label:'Pinch left',  action:'Grab CPU-side part', color:'#FF006E' },
            { icon:'🤏', label:'Pinch right', action:'Grab GPU-side part', color:'#cc44ff' },
            { icon:'✋', label:'Open palm',   action:'Place grabbed part', color:'#06FFA5' },
          ].map((r,i)=>(
            <div key={i} style={{display:'flex',gap:7,alignItems:'flex-start',marginBottom:5}}>
              <span style={{fontSize:'0.75rem',lineHeight:1}}>{r.icon}</span>
              <div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.48rem',color:r.color}}>{r.label}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.42rem',color:'#888'}}>{r.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gesture quick ref card — assembled phase */}
      {gestureEnabled && (phase === 'assembled' || phase === 'done') && (
        <div style={{position:'fixed',bottom:90,right:40,zIndex:150,background:'rgba(0,0,0,0.88)',border:'1px solid rgba(0,212,255,0.25)',padding:'10px 14px',pointerEvents:'none',maxWidth:230}}>
          <div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'0.38rem',color:'#00d4ff',marginBottom:8,letterSpacing:1}}>GESTURE GUIDE</div>
          {[
            { icon:'✊', label:'Hold fist',    action:'Arms the blast', color:'#ff8800' },
            { icon:'✋', label:'Open palm',    action:'BLAST → Dismantle', color:'#06FFA5' },
          ].map((r,i)=>(
            <div key={i} style={{display:'flex',gap:7,alignItems:'flex-start',marginBottom:5}}>
              <span style={{fontSize:'0.75rem',lineHeight:1}}>{r.icon}</span>
              <div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.48rem',color:r.color}}>{r.label}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.42rem',color:'#888'}}>{r.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* progress pills */}
      {isSidePhase&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,display:'flex',flexWrap:'wrap',gap:3,padding:'5px 40px',background:'rgba(0,0,0,0.75)',borderTop:'1px solid rgba(255,255,255,0.04)',justifyContent:'center'}}>
          {PLACE_IDS.map(id=>{ const meta=PARTS_META.find(p=>p.id===id)!; const placed=placedParts.has(id); return(<div key={id} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'0.4rem',color:placed?meta.color:'rgba(255,255,255,0.2)',border:`1px solid ${placed?meta.color+'66':'rgba(255,255,255,0.08)'}`,padding:'2px 6px',borderRadius:2,transition:'all 0.3s'}}>{placed?'✓ ':''}{meta.label}</div>); })}
        </div>
      )}

      {/* success */}
      {showSuccess&&(
        <div style={{position:'fixed',top:'14%',left:'50%',transform:'translateX(-50%)',zIndex:400}}>
          <div style={{background:'rgba(1,12,5,0.98)',border:'2px solid #06FFA5',borderRadius:6,padding:'20px 40px',boxShadow:'0 0 90px rgba(6,255,165,0.55)',textAlign:'center'}}>
            <div style={{fontFamily:"'Press Start 2P',cursive",fontSize:'clamp(0.7rem,1.5vw,1.1rem)',color:'#06FFA5',textShadow:'0 0 30px #06FFA5',letterSpacing:4,marginBottom:8}}>✓ ASSEMBLED</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",color:'rgba(120,255,175,0.82)',fontSize:'0.7rem'}}>GH200 Grace Hopper Superchip — fully operational.</div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeInUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }`}</style>
    </div>
  );
}