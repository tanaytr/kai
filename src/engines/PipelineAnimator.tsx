import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, HelpCircle, X } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface PipelineAnimatorProps {
  onBack: () => void;
}

const MODES = ['AI Inference', 'AI Training', 'HPC'] as const;
type Mode = typeof MODES[number];

interface Packet {
  id: number;
  x: number;
  y: number;
  stage: number;
  color: string;
  label: string;
}

const STAGES = [
  { name: 'CPU', x: 100, y: 200, color: '#76b900', desc: 'GRACE CPU\n72 cores' },
  { name: 'L3', x: 250, y: 200, color: '#ffbe0b', desc: 'L3 Cache\n576 MB' },
  { name: 'NVLink', x: 400, y: 200, color: '#00d4ff', desc: 'NVLink-C2C\n900 GB/s' },
  { name: 'GPU', x: 550, y: 200, color: '#00ff88', desc: 'H100 GPU\n132 SMs' },
  { name: 'Tensor', x: 700, y: 200, color: '#cc44ff', desc: 'Tensor Cores\n528 units' },
  { name: 'HBM3e', x: 850, y: 200, color: '#ff5522', desc: 'HBM3e\n96 GB' },
];

const PACKET_TYPES: Record<Mode, { label: string; color: string }> = {
  'AI Inference': { label: 'INFERENCE', color: '#3A86FF' },
  'AI Training': { label: 'TRAINING', color: '#FF006E' },
  'HPC': { label: 'HPC TASK', color: '#06FFA5' },
};

export default function PipelineAnimator({ onBack }: PipelineAnimatorProps) {
  const [mode, setMode] = useState<Mode>('AI Inference');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [stats, setStats] = useState({ processed: 0, inFlight: 0 });
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetIdRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        const pType = PACKET_TYPES[mode];
        setPackets(prev => [...prev, {
          id: packetIdRef.current++,
          x: STAGES[0].x,
          y: STAGES[0].y,
          stage: 0,
          color: pType.color,
          label: pType.label,
        }]);
      }

      setPackets(prev => {
        let processedCount = 0;
        const updated = prev.map(p => {
          const newStage = p.stage + 0.05 * speed;
          if (newStage >= STAGES.length) {
            processedCount++;
            return null as any;
          }
          
          const fromIdx = Math.floor(p.stage);
          const toIdx = Math.min(fromIdx + 1, STAGES.length - 1);
          const progress = newStage - fromIdx;
          
          return {
            ...p,
            stage: newStage,
            x: STAGES[fromIdx].x + (STAGES[toIdx].x - STAGES[fromIdx].x) * progress,
            y: STAGES[fromIdx].y + (STAGES[toIdx].y - STAGES[fromIdx].y) * progress + Math.sin(newStage * 2) * 10,
          };
        }).filter(Boolean);

        if (processedCount > 0) {
          setStats(s => ({ ...s, processed: s.processed + processedCount }));
        }

        setStats(s => ({ ...s, inFlight: updated.length }));
        return updated;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [playing, speed, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(131,56,236,0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    STAGES.forEach((stage, idx) => {
      const isHovered = hoveredStage === idx;
      
      ctx.fillStyle = stage.color + (isHovered ? '44' : '22');
      ctx.fillRect(stage.x - 50, stage.y - 40, 100, 80);
      ctx.strokeStyle = stage.color + (isHovered ? 'ff' : '88');
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeRect(stage.x - 50, stage.y - 40, 100, 80);
      
      ctx.fillStyle = stage.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(stage.name, stage.x, stage.y + 5);

      if (idx < STAGES.length - 1) {
        ctx.strokeStyle = 'rgba(131,56,236,0.3)';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(stage.x + 50, stage.y);
        ctx.lineTo(STAGES[idx + 1].x - 50, STAGES[idx + 1].y);
        ctx.stroke();
        ctx.setLineDash([]);

        const midX = (stage.x + STAGES[idx + 1].x) / 2;
        const midY = (stage.y + STAGES[idx + 1].y) / 2;
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.moveTo(midX + 10, midY);
        ctx.lineTo(midX - 5, midY - 5);
        ctx.lineTo(midX - 5, midY + 5);
        ctx.fill();
      }
    });

    packets.forEach(p => {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = p.color;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, p.y - 18);
    });

    if (hoveredStage !== null) {
      const stage = STAGES[hoveredStage];
      ctx.fillStyle = 'rgba(0,0,0,0.95)';
      ctx.strokeStyle = stage.color;
      ctx.lineWidth = 2;
      const tooltipX = stage.x;
      const tooltipY = stage.y - 80;
      const lines = stage.desc.split('\n');
      const width = 140;
      const height = 20 + lines.length * 18;
      
      ctx.fillRect(tooltipX - width/2, tooltipY - height/2, width, height);
      ctx.strokeRect(tooltipX - width/2, tooltipY - height/2, width, height);
      
      ctx.fillStyle = stage.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      lines.forEach((line, i) => {
        ctx.fillText(line, tooltipX, tooltipY - height/2 + 18 + i * 18);
      });
    }
  }, [packets, hoveredStage]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let foundStage = null;
    STAGES.forEach((stage, idx) => {
      if (x >= stage.x - 50 && x <= stage.x + 50 && y >= stage.y - 40 && y <= stage.y + 40) {
        foundStage = idx;
      }
    });
    
    setHoveredStage(foundStage);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a14', position: 'relative', zIndex: 10 }}>
      <div style={{ padding: '12px 24px', borderBottom: '4px solid #8338EC', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} className="pixel-btn" style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 16px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeft size={12} /> EXIT
          </button>
          <button onClick={() => setShowHelp(v => !v)} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
        </div>
        
        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.85rem', color: '#8338EC', textShadow: '0 0 10px #8338EC' }}>
          PIPELINE ANIMATOR
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: '#06FFA5', display: 'flex', gap: 16 }}>
            <span>PROCESSED: <b>{stats.processed}</b></span>
            <span>IN-FLIGHT: <b>{stats.inFlight}</b></span>
          </div>
          <button onClick={() => setPlaying(v => !v)} className="pixel-btn" style={{ background: playing ? '#06FFA5' : '#333', border: '2px solid #06FFA5', color: playing ? '#000' : '#06FFA5', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {[1, 2, 4].map(s => (
            <button key={s} onClick={() => setSpeed(s)} className="pixel-btn" style={{ background: speed === s ? '#FFBE0B' : '#333', border: '2px solid #FFBE0B', color: speed === s ? '#000' : '#FFBE0B', padding: '8px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem' }}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', gap: 12, justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderBottom: '2px solid rgba(131,56,236,0.3)' }}>
        {MODES.map(m => (
          <button key={m} onClick={() => { setMode(m); musicEngine.playSfx(600); setStats({ processed: 0, inFlight: 0 }); setPackets([]); }} className="pixel-btn" style={{ background: mode === m ? 'rgba(131,56,236,0.3)' : '#000', border: `2px solid ${mode === m ? '#8338EC' : '#555'}`, color: mode === m ? '#8338EC' : '#888', padding: '10px 20px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem' }}>
            {m}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas ref={canvasRef} width={1000} height={400} onMouseMove={handleCanvasMouseMove} onMouseLeave={() => setHoveredStage(null)} style={{ border: '2px solid #333', borderRadius: 4, boxShadow: '0 0 20px rgba(131,56,236,0.3)' }} />
      </div>

      <div style={{ padding: 16, background: 'rgba(0,0,0,0.8)', borderTop: '2px solid rgba(131,56,236,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#8b8baa', textAlign: 'center' }}>
        <b style={{ color: '#8338EC' }}>INFO:</b> Hover over components to see details · {PACKET_TYPES[mode].label} packets flow through GH200 architecture · Speed controls adjust throughput
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B', background: 'rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>PIPELINE ANIMATOR — HELP</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {[
                { color: '#06FFA5', title: 'PLAY/PAUSE', body: 'Click the play button to start the simulation. Data packets will flow through the GH200 pipeline stages.' },
                { color: '#3A86FF', title: 'SPEED CONTROL', body: 'Adjust simulation speed with 1×, 2×, or 4× buttons. Higher speeds show more packets flowing simultaneously.' },
                { color: '#8338EC', title: 'WORKLOAD MODES', body: 'Switch between AI Inference, AI Training, and HPC workloads. Each has different packet colors and flow patterns.' },
                { color: '#FF006E', title: 'STAGE HOVER', body: 'Hover over any pipeline stage (CPU, L3, NVLink, GPU, Tensor, HBM3e) to see detailed specifications in a tooltip.' },
                { color: '#FFBE0B', title: 'STATISTICS', body: 'Top-right shows PROCESSED (total packets completed) and IN-FLIGHT (currently traveling through pipeline).' },
                { color: '#00ff88', title: 'PIPELINE STAGES', body: 'CPU → L3 Cache → NVLink-C2C → GPU → Tensor Cores → HBM3e. Represents the data flow path in GH200 architecture.' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.48rem', marginBottom: 7 }}>{s.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.75rem', lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}