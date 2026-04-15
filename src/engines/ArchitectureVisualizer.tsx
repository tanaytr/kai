import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, Zap, HelpCircle, X } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface ArchitectureVisualizerProps {
  onBack: () => void;
}

interface DataPacket {
  id: number;
  type: 'cpu_compute' | 'gpu_compute' | 'memory_load' | 'memory_store' | 'cache_access' | 'nvlink_transfer';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  label: string;
  progress: number;
  speed: number;
}

interface Component {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  active: boolean;
  workload: number;
  temp: number;
}

const COMPONENTS: Component[] = [
  { id: 'grace_cpu', name: 'GRACE CPU\n72 Cores', x: 100, y: 150, width: 160, height: 120, color: '#76b900', active: false, workload: 0, temp: 45 },
  { id: 'l3_cache', name: 'L3 CACHE\n576 MB', x: 100, y: 300, width: 160, height: 80, color: '#ffbe0b', active: false, workload: 0, temp: 40 },
  { id: 'lpddr5x', name: 'LPDDR5X\n480 GB', x: 100, y: 410, width: 160, height: 80, color: '#ff7700', active: false, workload: 0, temp: 35 },
  { id: 'nvlink_c2c', name: 'NVLink-C2C\n900 GB/s', x: 300, y: 250, width: 120, height: 100, color: '#00d4ff', active: false, workload: 0, temp: 50 },
  { id: 'hopper_gpu', name: 'HOPPER GPU\nH100 • 132 SM', x: 460, y: 150, width: 160, height: 120, color: '#00ff88', active: false, workload: 0, temp: 60 },
  { id: 'tensor_cores', name: 'TENSOR CORES\n528 Units', x: 460, y: 300, width: 160, height: 80, color: '#cc44ff', active: false, workload: 0, temp: 65 },
  { id: 'hbm3e', name: 'HBM3e\n96 GB • 4 TB/s', x: 660, y: 200, width: 120, height: 180, color: '#ff5522', active: false, workload: 0, temp: 55 },
];

const WORKLOAD_SCENARIOS = {
  'AI Training': {
    description: 'Large Language Model Training - GPT-style transformer',
    operations: [
      { from: 'grace_cpu', to: 'nvlink_c2c', type: 'nvlink_transfer' as const, label: 'BATCH DATA', freq: 0.3 },
      { from: 'nvlink_c2c', to: 'hopper_gpu', type: 'nvlink_transfer' as const, label: 'BATCH DATA', freq: 0.3 },
      { from: 'hopper_gpu', to: 'tensor_cores', type: 'gpu_compute' as const, label: 'FP8 MATMUL', freq: 0.8 },
      { from: 'tensor_cores', to: 'hbm3e', type: 'memory_store' as const, label: 'STORE GRAD', freq: 0.6 },
      { from: 'hbm3e', to: 'tensor_cores', type: 'memory_load' as const, label: 'LOAD WEIGHTS', freq: 0.7 },
      { from: 'hopper_gpu', to: 'hbm3e', type: 'memory_store' as const, label: 'ACTIVATIONS', freq: 0.5 },
    ],
    activeComponents: ['grace_cpu', 'nvlink_c2c', 'hopper_gpu', 'tensor_cores', 'hbm3e'],
  },
  'AI Inference': {
    description: 'Real-time AI inference serving multiple requests',
    operations: [
      { from: 'grace_cpu', to: 'nvlink_c2c', type: 'nvlink_transfer' as const, label: 'QUERY', freq: 0.5 },
      { from: 'nvlink_c2c', to: 'hopper_gpu', type: 'nvlink_transfer' as const, label: 'QUERY', freq: 0.5 },
      { from: 'hopper_gpu', to: 'tensor_cores', type: 'gpu_compute' as const, label: 'INFERENCE', freq: 0.9 },
      { from: 'hbm3e', to: 'tensor_cores', type: 'memory_load' as const, label: 'MODEL WGTS', freq: 0.8 },
      { from: 'tensor_cores', to: 'hopper_gpu', type: 'gpu_compute' as const, label: 'RESULT', freq: 0.6 },
      { from: 'hopper_gpu', to: 'nvlink_c2c', type: 'nvlink_transfer' as const, label: 'RESPONSE', freq: 0.4 },
    ],
    activeComponents: ['grace_cpu', 'nvlink_c2c', 'hopper_gpu', 'tensor_cores', 'hbm3e'],
  },
  'HPC Simulation': {
    description: 'Scientific computation with CPU-GPU collaboration',
    operations: [
      { from: 'grace_cpu', to: 'l3_cache', type: 'cache_access' as const, label: 'MESH DATA', freq: 0.7 },
      { from: 'l3_cache', to: 'lpddr5x', type: 'memory_load' as const, label: 'LOAD DATA', freq: 0.5 },
      { from: 'grace_cpu', to: 'nvlink_c2c', type: 'nvlink_transfer' as const, label: 'COMPUTE TASK', freq: 0.4 },
      { from: 'nvlink_c2c', to: 'hopper_gpu', type: 'nvlink_transfer' as const, label: 'COMPUTE TASK', freq: 0.4 },
      { from: 'hopper_gpu', to: 'hbm3e', type: 'memory_store' as const, label: 'RESULTS', freq: 0.6 },
      { from: 'hbm3e', to: 'hopper_gpu', type: 'memory_load' as const, label: 'PREV ITER', freq: 0.5 },
    ],
    activeComponents: ['grace_cpu', 'l3_cache', 'lpddr5x', 'nvlink_c2c', 'hopper_gpu', 'hbm3e'],
  },
  'Database Query': {
    description: 'High-performance database with GPU acceleration',
    operations: [
      { from: 'grace_cpu', to: 'l3_cache', type: 'cache_access' as const, label: 'INDEX LOOKUP', freq: 0.9 },
      { from: 'l3_cache', to: 'lpddr5x', type: 'memory_load' as const, label: 'TABLE SCAN', freq: 0.6 },
      { from: 'grace_cpu', to: 'nvlink_c2c', type: 'nvlink_transfer' as const, label: 'QUERY PLAN', freq: 0.3 },
      { from: 'nvlink_c2c', to: 'hopper_gpu', type: 'nvlink_transfer' as const, label: 'QUERY PLAN', freq: 0.3 },
      { from: 'hopper_gpu', to: 'hbm3e', type: 'memory_load' as const, label: 'HASH JOIN', freq: 0.7 },
      { from: 'lpddr5x', to: 'grace_cpu', type: 'memory_load' as const, label: 'RESULT SET', freq: 0.4 },
    ],
    activeComponents: ['grace_cpu', 'l3_cache', 'lpddr5x', 'nvlink_c2c', 'hopper_gpu', 'hbm3e'],
  },
};

type WorkloadType = keyof typeof WORKLOAD_SCENARIOS;

export default function ArchitectureVisualizer({ onBack }: ArchitectureVisualizerProps) {
  const [workload, setWorkload] = useState<WorkloadType>('AI Training');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [packets, setPackets] = useState<DataPacket[]>([]);
  const [components, setComponents] = useState<Component[]>(COMPONENTS);
  const [stats, setStats] = useState({ totalOps: 0, bandwidth: 0, utilization: 0 });
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetIdRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!playing) return;

    const scenario = WORKLOAD_SCENARIOS[workload];

    const interval = setInterval(() => {
      timeRef.current += 0.016 * speed;

      scenario.operations.forEach(op => {
        if (Math.random() < op.freq * 0.05 * speed) {
          const fromComp = components.find(c => c.id === op.from);
          const toComp = components.find(c => c.id === op.to);

          if (fromComp && toComp) {
            const color = {
              'cpu_compute': '#76b900',
              'gpu_compute': '#00ff88',
              'memory_load': '#ff5522',
              'memory_store': '#ff7700',
              'cache_access': '#ffbe0b',
              'nvlink_transfer': '#00d4ff',
            }[op.type];

            setPackets(prev => [...prev, {
              id: packetIdRef.current++,
              type: op.type,
              x: fromComp.x + fromComp.width / 2,
              y: fromComp.y + fromComp.height / 2,
              targetX: toComp.x + toComp.width / 2,
              targetY: toComp.y + toComp.height / 2,
              color,
              label: op.label,
              progress: 0,
              speed: 0.02 * speed,
            }]);

            setStats(s => ({ ...s, totalOps: s.totalOps + 1 }));
          }
        }
      });

      setPackets(prev => prev.map(p => {
        const newProgress = p.progress + p.speed;
        if (newProgress >= 1) return null as any;
        return {
          ...p,
          progress: newProgress,
          x: p.x + (p.targetX - p.x) * p.speed,
          y: p.y + (p.targetY - p.y) * p.speed,
        };
      }).filter(Boolean));

      setComponents(prev => prev.map(comp => {
        const isActive = scenario.activeComponents.includes(comp.id);
        const relatedPackets = packets.filter(p => {
          const toComp = COMPONENTS.find(c => c.x + c.width / 2 === p.targetX && c.y + c.height / 2 === p.targetY);
          return toComp?.id === comp.id;
        });

        const workloadVal = Math.min(100, relatedPackets.length * 20);
        const tempIncrease = workloadVal * 0.3;

        return {
          ...comp,
          active: isActive && relatedPackets.length > 0,
          workload: workloadVal,
          temp: Math.min(85, comp.temp + tempIncrease * 0.01),
        };
      }));

      const avgUtil = components.reduce((sum, c) => sum + c.workload, 0) / components.length;
      const totalBW = packets.length * 50;
      setStats(s => ({ ...s, bandwidth: totalBW, utilization: Math.round(avgUtil) }));

    }, 50);

    return () => clearInterval(interval);
  }, [playing, speed, workload, components, packets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 820;
    const H = 540;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(131,56,236,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const scenario = WORKLOAD_SCENARIOS[workload];
    scenario.operations.forEach(op => {
      const fromComp = components.find(c => c.id === op.from);
      const toComp = components.find(c => c.id === op.to);
      if (fromComp && toComp) {
        ctx.strokeStyle = 'rgba(131,56,236,0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(fromComp.x + fromComp.width / 2, fromComp.y + fromComp.height / 2);
        ctx.lineTo(toComp.x + toComp.width / 2, toComp.y + toComp.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    components.forEach(comp => {
      const isHovered = hoveredComponent === comp.id;
      const glowIntensity = comp.active ? 0.6 : 0.2;

      ctx.fillStyle = comp.color + (isHovered ? '33' : '22');
      ctx.fillRect(comp.x, comp.y, comp.width, comp.height);

      ctx.strokeStyle = comp.color + (isHovered ? 'ff' : comp.active ? 'cc' : '66');
      ctx.lineWidth = isHovered ? 4 : comp.active ? 3 : 2;
      ctx.strokeRect(comp.x, comp.y, comp.width, comp.height);

      if (comp.active) {
        ctx.shadowColor = comp.color;
        ctx.shadowBlur = 20 * glowIntensity;
        ctx.strokeRect(comp.x, comp.y, comp.width, comp.height);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = comp.color;
      ctx.fillRect(comp.x, comp.y, comp.width, 3);

      ctx.fillStyle = comp.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      const lines = comp.name.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, comp.x + comp.width / 2, comp.y + 20 + i * 14);
      });

      if (comp.workload > 0) {
        const barWidth = comp.width - 20;
        const barHeight = 6;
        const barX = comp.x + 10;
        const barY = comp.y + comp.height - 16;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = comp.color;
        ctx.fillRect(barX, barY, barWidth * (comp.workload / 100), barHeight);
        ctx.strokeStyle = comp.color + '88';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = comp.color;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(comp.workload)}%`, comp.x + comp.width / 2, barY - 4);
      }

      if (isHovered) {
        const tooltipLines = [
          comp.name.replace('\n', ' '),
          `Workload: ${Math.round(comp.workload)}%`,
          `Temp: ${Math.round(comp.temp)}°C`,
          `Status: ${comp.active ? 'ACTIVE' : 'IDLE'}`,
        ];
        const tooltipWidth = 180;
        const tooltipHeight = 20 + tooltipLines.length * 16;
        const tooltipX = comp.x + comp.width + 20;
        const tooltipY = comp.y;

        ctx.fillStyle = 'rgba(0,0,0,0.95)';
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        ctx.strokeStyle = comp.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        ctx.fillStyle = comp.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        tooltipLines.forEach((line, i) => {
          ctx.fillText(line, tooltipX + 10, tooltipY + 18 + i * 16);
        });
      }
    });

    packets.forEach(p => {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, p.y - 14);
      ctx.strokeStyle = p.color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(10, H - 50, W - 20, 40);
    ctx.strokeStyle = '#8338EC';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, H - 50, W - 20, 40);
    ctx.fillStyle = '#8338EC';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`OPS: ${stats.totalOps}`, 20, H - 28);
    ctx.fillText(`BW: ${stats.bandwidth} GB/s`, 140, H - 28);
    ctx.fillText(`UTIL: ${stats.utilization}%`, 300, H - 28);
    ctx.fillText(`SCENARIO: ${workload}`, 450, H - 28);

  }, [components, packets, hoveredComponent, workload, stats]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let found: string | null = null;
    components.forEach(comp => {
      if (x >= comp.x && x <= comp.x + comp.width && y >= comp.y && y <= comp.y + comp.height) {
        found = comp.id;
      }
    });
    setHoveredComponent(found);
  };

  const HELP_SECTIONS = [
    {
      color: '#8338EC',
      title: 'WHAT IS THIS?',
      body: 'This visualizer simulates real data movement inside the NVIDIA GH200 Grace Hopper Superchip. Colored packets represent actual data transfers between silicon components in real-time.',
    },
    {
      color: '#76b900',
      title: 'GRACE CPU (GREEN)',
      body: 'NVIDIA\'s ARM-based 72-core CPU built on TSMC N4. Handles system orchestration, data preparation, and host-side logic. Connects to the GPU via NVLink-C2C at 900 GB/s — 7× faster than PCIe 5.0.',
    },
    {
      color: '#ffbe0b',
      title: 'L3 CACHE + LPDDR5X (YELLOW/ORANGE)',
      body: '576 MB of shared L3 cache sits between the CPU cores and 480 GB of LPDDR5X system memory. The huge memory capacity enables CPU-side dataset hosting without constant NVLink transfers.',
    },
    {
      color: '#00d4ff',
      title: 'NVLINK-C2C (CYAN)',
      body: 'The coherent chip-to-chip interconnect fusing CPU and GPU into one unified memory space. 900 GB/s bidirectional bandwidth with full cache coherence — the GH200\'s secret weapon for AI workloads.',
    },
    {
      color: '#00ff88',
      title: 'HOPPER GPU + TENSOR CORES (GREEN/PURPLE)',
      body: 'H100 GPU with 132 Streaming Multiprocessors. 528 4th-gen Tensor Cores accelerate FP8/FP16/BF16 matrix math. Capable of 4 PFLOPS FP8 for transformer inference.',
    },
    {
      color: '#ff5522',
      title: 'HBM3e MEMORY (RED)',
      body: '96 GB of High Bandwidth Memory with 4 TB/s bandwidth. The GPU\'s private scratchpad for weights, activations, and KV-cache. Bandwidth is the #1 bottleneck for LLM inference — HBM3e addresses this.',
    },
    {
      color: '#8338EC',
      title: 'WORKLOAD SCENARIOS',
      body: 'Each scenario changes which components are active and how data flows. AI Training stresses GPU↔HBM bandwidth. Inference is GPU-bound with fast query turnaround. HPC uses the CPU heavily alongside GPU. Database relies on CPU cache hierarchy.',
    },
    {
      color: '#FFBE0B',
      title: 'CONTROLS',
      body: 'Press ▶ to start the simulation. Use 1×/2×/4× to change simulation speed. Hover over any component block to see live workload %, temperature, and status. Switch scenarios at any time — packets reset automatically.',
    },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a14', position: 'relative', zIndex: 10 }}>

      {/* HELP OVERLAY */}
      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '3px solid #8338EC', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.75rem', textShadow: '0 0 10px #8338EC', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={16} /> ARCHITECTURE GUIDE
            </div>
            <button
              onClick={() => setShowHelp(false)}
              style={{ background: 'none', border: '2px solid #8338EC', color: '#8338EC', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {HELP_SECTIONS.map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.46rem', marginBottom: 8, letterSpacing: 1 }}>{s.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.72rem', lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>

            {/* Color legend in help */}
            <div style={{ maxWidth: 860, margin: '20px auto 0', background: 'rgba(0,0,0,0.6)', border: '2px solid #8338EC44', borderLeft: '4px solid #8338EC', padding: '14px 16px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.46rem', marginBottom: 12, letterSpacing: 1 }}>PACKET COLOR LEGEND</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {[
                  { color: '#76b900', label: 'CPU Compute' },
                  { color: '#00ff88', label: 'GPU Compute' },
                  { color: '#ff5522', label: 'Memory Load' },
                  { color: '#ff7700', label: 'Memory Store' },
                  { color: '#ffbe0b', label: 'Cache Access' },
                  { color: '#00d4ff', label: 'NVLink Transfer' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: '#ccc' }}>
                    <div style={{ width: 14, height: 14, background: l.color, border: '1px solid rgba(255,255,255,0.3)', boxShadow: `0 0 6px ${l.color}` }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '12px 24px', borderBottom: '4px solid #8338EC', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} className="pixel-btn" style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 16px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <ArrowLeft size={12} /> EXIT
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.85rem', color: '#8338EC', textShadow: '0 0 10px #8338EC', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Zap size={16} /> ARCHITECTURE VISUALIZER
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.65rem' }}>
            Live System Simulation
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowHelp(true)}
            style={{ background: '#000', border: '2px solid #8338EC', color: '#8338EC', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <HelpCircle size={16} />
          </button>
          <button onClick={() => setPlaying(v => !v)} className="pixel-btn" style={{ background: playing ? '#06FFA5' : '#333', border: '2px solid #06FFA5', color: playing ? '#000' : '#06FFA5', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {[1, 2, 4].map(s => (
            <button key={s} onClick={() => setSpeed(s)} className="pixel-btn" style={{ background: speed === s ? '#FFBE0B' : '#333', border: '2px solid #FFBE0B', color: speed === s ? '#000' : '#FFBE0B', padding: '8px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer' }}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* SCENARIO SELECTOR */}
      <div style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderBottom: '2px solid rgba(131,56,236,0.3)' }}>
        {Object.keys(WORKLOAD_SCENARIOS).map(w => (
          <button key={w} onClick={() => { setWorkload(w as WorkloadType); musicEngine.playSfx(600); setPackets([]); setStats({ totalOps: 0, bandwidth: 0, utilization: 0 }); }} className="pixel-btn" style={{ background: workload === w ? 'rgba(131,56,236,0.3)' : '#000', border: `2px solid ${workload === w ? '#8338EC' : '#555'}`, color: workload === w ? '#8338EC' : '#888', padding: '10px 16px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer' }}>
            {w}
          </button>
        ))}
      </div>

      {/* SCENARIO DESCRIPTION */}
      <div style={{ padding: 16, background: 'rgba(0,0,0,0.6)', borderBottom: '2px solid rgba(131,56,236,0.3)' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: '#ccc', lineHeight: 1.6, maxWidth: 900, margin: '0 auto' }}>
          <b style={{ color: '#8338EC' }}>SCENARIO:</b> {WORKLOAD_SCENARIOS[workload].description}
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <canvas
          ref={canvasRef}
          width={820}
          height={540}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredComponent(null)}
          style={{
            border: '3px solid #8338EC',
            borderRadius: 4,
            boxShadow: '0 0 30px rgba(131,56,236,0.5)',
            cursor: hoveredComponent ? 'pointer' : 'default',
          }}
        />
      </div>

      {/* LEGEND */}
      <div style={{ padding: 16, background: 'rgba(0,0,0,0.8)', borderTop: '2px solid #8338EC' }}>
        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', color: '#8338EC', marginBottom: 8, textAlign: 'center' }}>
          LEGEND
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#76b900', border: '1px solid #fff' }} /> CPU Compute</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#00ff88', border: '1px solid #fff' }} /> GPU Compute</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#ff5522', border: '1px solid #fff' }} /> Memory Load</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#ff7700', border: '1px solid #fff' }} /> Memory Store</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#ffbe0b', border: '1px solid #fff' }} /> Cache Access</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, background: '#00d4ff', border: '1px solid #fff' }} /> NVLink Transfer</div>
        </div>
      </div>
    </div>
  );
}