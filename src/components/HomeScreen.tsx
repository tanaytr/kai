import { useState, useEffect } from 'react';
import { Cpu, BookOpen, Activity, BarChart3, Layers, Gamepad2, Zap, Cpu as CpuIcon, GitBranch, FileText, FileCode } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (screen: 'slides' | 'chip' | 'pipeline' | 'benchmark' | 'memory' | 'game' | 'arch' | 'cache' | 'isa' | 'paper' | 'assembler' | 'asmcompiler') => void;
}

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 20, style = {} }: { color: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: color,
      boxShadow: `inset -${size / 6}px -${size / 6}px 0 rgba(0,0,0,0.5), inset ${size / 6}px ${size / 6}px 0 rgba(255,255,255,0.3), 0 0 ${size / 2}px ${color}88`,
      border: '1px solid rgba(0,0,0,0.4)', flexShrink: 0, ...style,
    }} />
  );
}

function AnimatedTitle() {
  const [colorIndex, setColorIndex] = useState(0);
  const [glitch, setGlitch]         = useState(false);

  useEffect(() => {
    const ci = setInterval(() => setColorIndex(c => (c + 1) % COLORS.length), 200);
    const gi = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 150); }, 4500);
    return () => { clearInterval(ci); clearInterval(gi); };
  }, []);

  const c  = COLORS[colorIndex];
  const c2 = COLORS[(colorIndex + 1) % COLORS.length];
  const c3 = COLORS[(colorIndex + 2) % COLORS.length];

  return (
    <div style={{ position: 'relative', marginBottom: 30, userSelect: 'none', padding: '0 20px' }}>
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(1.2rem, 4vw, 2.8rem)', color: c, textShadow: `4px 4px 0 #000, -2px -2px 0 ${c2}, 0 0 40px ${c}, 0 0 80px ${c3}`, letterSpacing: '0.08em', lineHeight: 1.3, textAlign: 'center', transform: glitch ? 'translate(2px, -1px)' : 'none', transition: 'transform 0.05s' }}>
        NVIDIA GH200
      </div>
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.45rem, 1.2vw, 0.75rem)', color: '#00d4ff', textShadow: '2px 2px 0 #000, 0 0 10px #00d4ff', textAlign: 'center', marginTop: 8, letterSpacing: '2px' }}>
        GRACE HOPPER SUPERCHIP
      </div>
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.35rem, 0.7vw, 0.45rem)', color: '#8338EC', textAlign: 'center', marginTop: 6, letterSpacing: '1px', lineHeight: 1.8 }}>
        AN INTERACTIVE EXPLORATION
      </div>
      {/* Floating tetris blocks behind the title */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        {COLORS.map((col, i) => (
          <div key={i} style={{ position: 'absolute', left: `${i * 18 + 3}%`, top: `${(i % 3) * 28}%`, animation: `float ${3 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.5}s` }}>
            <TetrisBlock color={col} size={12 + (i % 3) * 3} />
          </div>
        ))}
        {[0, 1, 2, 3].map(i => (
          <div key={`r${i}`} style={{ position: 'absolute', right: `${i * 15 + 4}%`, top: `${20 + i * 20}%`, animation: `float ${2.5 + i * 0.6}s ease-in-out infinite`, animationDelay: `${i * 0.7 + 0.3}s` }}>
            <TetrisBlock color={COLORS[(i + 2) % COLORS.length]} size={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const engines = [
    { id: 'slides',    icon: BookOpen,  title: 'SLIDES',     subtitle: 'GH200 PRESENTATION',  desc: '12 technical slides: ISA, pipeline, cache, memory & architecture',              color: '#FF006E', gradient: 'linear-gradient(180deg, #FF006E 0%, #C1004E 100%)', shadow: '0 8px 0 #8B0040, 0 8px 20px rgba(255,0,110,0.5)' },
    { id: 'chip',      icon: Cpu,       title: '3D CHIP',    subtitle: 'INTERACTIVE MODEL',    desc: 'Explore GH200 die layout — stencil & GLTF modes, 14 clickable hotspots',       color: '#06FFA5', gradient: 'linear-gradient(180deg, #06FFA5 0%, #05CC84 100%)', shadow: '0 8px 0 #048F5F, 0 8px 20px rgba(6,255,165,0.5)' },
    { id: 'pipeline',  icon: Activity,  title: 'PIPELINE',   subtitle: 'DATA FLOW SIM',        desc: 'Watch instructions travel through Fetch→Decode→Execute→Writeback',             color: '#8338EC', gradient: 'linear-gradient(180deg, #8338EC 0%, #6420C7 100%)', shadow: '0 8px 0 #4A1B9E, 0 8px 20px rgba(131,56,236,0.5)' },
    { id: 'benchmark', icon: BarChart3, title: 'BENCHMARK',  subtitle: 'PERFORMANCE RACE',     desc: 'GH200 vs GB200, MI300X, H100 — animated performance comparison',               color: '#3A86FF', gradient: 'linear-gradient(180deg, #3A86FF 0%, #2A6FDD 100%)', shadow: '0 8px 0 #1A4FA0, 0 8px 20px rgba(58,134,255,0.5)' },
    { id: 'memory',    icon: Layers,    title: 'MEMORY',     subtitle: 'HIERARCHY EXPLORER',   desc: 'Navigate Registers→L1→L2→L3→LPDDR5X→HBM3e with specs',                       color: '#FFBE0B', gradient: 'linear-gradient(180deg, #FFBE0B 0%, #D99E00 100%)', shadow: '0 8px 0 #A07700, 0 8px 20px rgba(255,190,11,0.5)' },
    { id: 'game',      icon: Gamepad2,  title: 'ROUTING',    subtitle: 'INTERACTIVE GAME',     desc: 'Route data packets to correct chip components — test your knowledge',           color: '#00D4FF', gradient: 'linear-gradient(180deg, #00D4FF 0%, #00A8CC 100%)', shadow: '0 8px 0 #007B99, 0 8px 20px rgba(0,212,255,0.5)' },
    { id: 'arch',      icon: Zap,       title: 'ARCH VIZ',   subtitle: 'SYSTEM SIMULATOR',     desc: 'Real-time GH200 workload simulation across CPU/GPU/NVLink/HBM',                color: '#CC44FF', gradient: 'linear-gradient(180deg, #CC44FF 0%, #9933CC 100%)', shadow: '0 8px 0 #7722AA, 0 8px 20px rgba(204,68,255,0.5)' },
    { id: 'cache',     icon: Layers,    title: 'CACHE EXPLORER', subtitle: '3-MODE LEARNING', desc: 'Interactive gameplay, intricate diagrams & hybrid view — master cache mapping!', color: '#00D4FF', gradient: 'linear-gradient(180deg, #00D4FF 0%, #00A8CC 100%)', shadow: '0 8px 0 #007B99, 0 8px 20px rgba(0,212,255,0.5)' },
    { id: 'isa',       icon: GitBranch, title: 'ISA DECODER',subtitle: 'ARM EXPLORER',          desc: 'Decode ARMv9-A instructions — binary → assembly → micro-ops',                  color: '#44FFAA', gradient: 'linear-gradient(180deg, #44FFAA 0%, #22CC88 100%)', shadow: '0 8px 0 #119966, 0 8px 20px rgba(68,255,170,0.5)' },
    { id: 'asmcompiler', icon: FileCode, title: 'ASM COMPILER', subtitle: '8086/8085/8051 EMU', desc: 'Write, compile & execute assembly code — watch registers update in real-time!', color: '#FF1493', gradient: 'linear-gradient(180deg, #FF1493 0%, #C71585 100%)', shadow: '0 8px 0 #8B0A50, 0 8px 20px rgba(255,20,147,0.5)' },
    { id: 'assembler', icon: Cpu,       title: 'ASSEMBLER', subtitle: 'BUILD YOUR GH200', desc: 'Dismantle & reassemble the GH200 — drag parts onto the board, learn what each does', color: '#FF006E', gradient: 'linear-gradient(180deg, #FF006E 0%, #C1004E 100%)', shadow: '0 8px 0 #8B0040, 0 8px 20px rgba(255,0,110,0.5)' },
    { id: 'paper',     icon: FileText,  title: 'RESEARCH', subtitle: 'PAPER & CASE STUDY', desc: 'Read our technical paper & case study — dual PDF viewer with zoom controls', color: '#8338EC', gradient: 'linear-gradient(180deg, #8338EC 0%, #6420C7 100%)', shadow: '0 8px 0 #4A1B9E, 0 8px 20px rgba(131,56,236,0.5)' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as any, position: 'relative', zIndex: 10 }}>

      {/* Ambient glows */}
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: '#8338EC', filter: 'blur(120px)', opacity: 0.07, top: '5%', left: '5%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: '#FFBE0B', filter: 'blur(140px)', opacity: 0.05, bottom: '5%', right: '5%', pointerEvents: 'none', zIndex: 0 }} />

      {/* Top tetris decorative row */}
      <div style={{ display: 'flex', gap: 3, padding: '6px 12px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 5 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <TetrisBlock key={i} color={COLORS[i % 5]} size={14}
            style={{ opacity: 0.2 + (i % 3) * 0.1, animation: `float ${2 + (i % 4) * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      {/* Main centred content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 30px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1280px', width: '100%', textAlign: 'center' }}>

          <AnimatedTitle />

          {/* 3 × 4 engine grid (now 12 engines) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            padding: '0 10px',
            maxWidth: '900px',
            margin: '0 auto 24px',
          }}>
            {engines.map((engine, idx) => {
              const Icon     = engine.icon;
              const isHovered = hoveredId === engine.id;
              return (
                <button
                  key={engine.id}
                  onClick={() => onNavigate(engine.id as any)}
                  onMouseEnter={() => setHoveredId(engine.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: engine.gradient,
                    border: '5px solid #000',
                    boxShadow: isHovered ? `0 4px 0 ${engine.color}88, 0 4px 30px ${engine.color}88` : engine.shadow,
                    padding: '18px 14px', borderRadius: '6px',
                    animation: `fadeIn 0.4s ease ${idx * 0.05}s both`,
                    textAlign: 'left', cursor: 'pointer',
                    transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative', overflow: 'hidden', minHeight: '140px',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2, padding: 4 }}>
                    {[0, 1, 2].map(i => <TetrisBlock key={i} color="rgba(0,0,0,0.3)" size={6} />)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Icon size={24} color="#fff" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.4rem, 0.7vw, 0.55rem)', color: '#fff', marginBottom: 3 }}>{engine.title}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.35rem, 0.65vw, 0.45rem)', color: 'rgba(255,255,255,0.7)' }}>{engine.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.4rem, 0.7vw, 0.52rem)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{engine.desc}</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 1, padding: '3px 4px' }}>
                    {Array.from({ length: 10 }).map((_, i) => <TetrisBlock key={i} color="rgba(0,0,0,0.25)" size={5} />)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom tetris row */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
            {COLORS.map((c, i) => (
              <TetrisBlock key={i} color={c} size={14}
                style={{ opacity: 0.7, animation: `float ${3 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>

          {/* Credits */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.35rem, 0.7vw, 0.45rem)', color: '#8338EC', textShadow: '2px 2px 0 #000, 0 0 10px #8338EC', letterSpacing: '1px', lineHeight: 1.8, marginBottom: 10 }}>
              AN EXPERIENCE HANDCRAFTED BY
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
              {['SRISHTI JAIN •', ' DIKSHA RATHI •', ' TANAY TRIVEDI'].map((name, i) => (
                <div key={i} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.35rem, 0.9vw, 0.6rem)', color: '#00d4ff', textShadow: '2px 2px 0 #000, 0 0 10px #00d4ff', letterSpacing: '2px' }}>{name}</div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes float  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) { div[style*="repeat(3, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { div[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}