import { useState, useEffect } from 'react';
import { BookOpen, Cpu, Compass, HelpCircle, X, Radio } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface HomeScreenProps {
  onNavigate: (screen: 'presentation' | 'circuit' | 'explore' | 'experience') => void;
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
      {/* Main title */}
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(1.4rem, 5vw, 3.2rem)', color: c, textShadow: `4px 4px 0 #000, -2px -2px 0 ${c2}, 0 0 40px ${c}, 0 0 80px ${c3}`, letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center', transform: glitch ? 'translate(2px, -1px)' : 'none', transition: 'transform 0.05s' }}>
        PROJECT KAI
      </div>
      {/* Subtitle */}
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.45rem, 1.3vw, 0.8rem)', color: '#06FFA5', textShadow: '2px 2px 0 #000, 0 0 10px #06FFA5', textAlign: 'center', marginTop: 10, letterSpacing: '2px' }}>
        KINETIC ARTIFICIAL INTELLIGENCE
      </div>
      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.3rem, 0.7vw, 0.44rem)', color: '#8338EC', textAlign: 'center', marginTop: 6, letterSpacing: '1px', lineHeight: 1.9 }}>
        YOUR PRESENCE, EXTENDED.
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.35rem, 0.7vw, 0.5rem)', color: 'rgba(0,212,255,0.65)', textAlign: 'center', marginTop: 4, letterSpacing: '1.5px' }}>
        ESP32 · 5 SENSORS · DUAL-CORE · BLYNK IoT
      </div>
      {/* Floating tetris blocks */}
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
  const [showHelp, setShowHelp]   = useState(false);

  const engines = [
    {
      id: 'presentation',
      icon: BookOpen,
      title: 'REPORT',
      subtitle: 'KAI PRESENTATION',
      desc: '16 technical slides: ESP32 dual-core, 5 sensors, actuators, state machine, Blynk IoT & results',
      color: '#FF006E',
      gradient: 'linear-gradient(180deg, #FF006E 0%, #C1004E 100%)',
      shadow: '0 8px 0 #8B0040, 0 8px 20px rgba(255,0,110,0.5)',
    },
    {
      id: 'circuit',
      icon: Cpu,
      title: 'CIRCUIT',
      subtitle: 'INTERACTIVE PIN DIAGRAM',
      desc: 'KAI Sentinel unified pin diagram — click ESP32, all 5 sensors & 5 actuator groups for GPIO specs',
      color: '#06FFA5',
      gradient: 'linear-gradient(180deg, #06FFA5 0%, #05CC84 100%)',
      shadow: '0 8px 0 #048F5F, 0 8px 20px rgba(6,255,165,0.5)',
    },
    {
      id: 'explore',
      icon: Compass,
      title: 'EXPLORE',
      subtitle: '3D MODEL + BLAST',
      desc: 'Auto-rotating KAI robot with clickable hotspots. BLAST it apart — reassemble breadboard, sensors & MCU',
      color: '#8338EC',
      gradient: 'linear-gradient(180deg, #8338EC 0%, #6420C7 100%)',
      shadow: '0 8px 0 #4A1B9E, 0 8px 20px rgba(131,56,236,0.5)',
    },
    {
      id: 'experience',
      icon: Radio,
      title: 'EXPERIENCE',
      subtitle: 'PH-4 DIGITAL TWIN',
      desc: 'Interactive simulator. Stress-test KAI with virtual gas (MQ-2), night cycles (LDR), and summon calls (N20)',
      color: '#3A86FF',
      gradient: 'linear-gradient(180deg, #3A86FF 0%, #0056D4 100%)',
      shadow: '0 8px 0 #003B91, 0 8px 20px rgba(58,134,255,0.5)',
    },
  ];

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as any, position: 'relative', zIndex: 10 }}>

      {/* Ambient glows */}
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: '#06FFA5', filter: 'blur(130px)', opacity: 0.06, top: '5%', left: '5%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: '#8338EC', filter: 'blur(150px)', opacity: 0.05, bottom: '5%', right: '5%', pointerEvents: 'none', zIndex: 0 }} />

      {/* Top tetris decorative row */}
      <div style={{ display: 'flex', gap: 3, padding: '6px 12px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 5 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <TetrisBlock key={i} color={COLORS[i % 5]} size={14}
            style={{ opacity: 0.2 + (i % 3) * 0.1, animation: `float ${2 + (i % 4) * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      {/* Main centred content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 30px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '960px', width: '100%', textAlign: 'center' }}>

          <AnimatedTitle />

          {/* 3-engine grid - Enlarged and more prominent */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            padding: '10px',
            maxWidth: '1400px',
            margin: '0 auto 40px',
          }}>
            {engines.map((engine, idx) => {
              const Icon      = engine.icon;
              const isHovered = hoveredId === engine.id;
              return (
                <button
                  key={engine.id}
                  id={`engine-${engine.id}`}
                  onClick={() => onNavigate(engine.id as any)}
                  onMouseEnter={() => setHoveredId(engine.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: engine.gradient,
                    border: '5px solid #000',
                    boxShadow: isHovered ? `0 8px 0 ${engine.color}88, 0 12px 40px ${engine.color}66` : engine.shadow,
                    padding: '25px 18px', borderRadius: '12px',
                    animation: `fadeIn 0.6s ease ${idx * 0.15}s both`,
                    textAlign: 'left', cursor: 'pointer',
                    transform: isHovered ? 'translateY(-10px) scale(1.04)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'relative', overflow: 'hidden', minHeight: '300px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2, padding: 8 }}>
                    {[0, 1, 2, 3].map(i => <TetrisBlock key={i} color="rgba(0,0,0,0.2)" size={8} />)}
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20 }}>
                      <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={32} color="#fff" style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.8))', flexShrink: 0 }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.6rem, 1.1vw, 0.85rem)', color: '#fff', marginBottom: 6, letterSpacing: '1px' }}>{engine.title}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.45rem, 0.8vw, 0.6rem)', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '2px' }}>{engine.subtitle}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.5rem, 0.85vw, 0.7rem)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.8, marginBottom: 20 }}>{engine.desc}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ height: 2, flex: 1, background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: '#fff' }}>INIT_ENGINE</div>
                    <div style={{ height: 2, flex: 1, background: 'rgba(255,255,255,0.2)' }} />
                  </div>

                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 1, padding: '4px 6px' }}>
                    {Array.from({ length: 20 }).map((_, i) => <TetrisBlock key={i} color="rgba(0,0,0,0.15)" size={6} />)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* New Decorative Telemetry Dashboard Section to fill space */}
          <div style={{ 
            width: '100%', 
            maxWidth: '1100px', 
            margin: '0 auto 50px', 
            background: 'rgba(0,10,30,0.4)', 
            border: '2px solid rgba(131,56,236,0.3)', 
            borderRadius: '15px',
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            animation: 'fadeIn 0.8s ease 0.4s both',
            backdropFilter: 'blur(10px)'
          }}>
            {[
              { label: 'CORES', val: 'DUAL_LX7', col: '#FF006E' },
              { label: 'SENSORS', val: '5 ACTIVE', col: '#06FFA5' },
              { label: 'UPLINK', val: 'BLYNK_IOT', col: '#3A86FF' },
              { label: 'STATUS', val: 'SYSTEM_OK', col: '#FFBE0B' }
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'left', borderLeft: `3px solid ${stat.col}`, paddingLeft: '15px' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: stat.col, fontWeight: 'bold', letterSpacing: '1px' }}>{stat.val}</div>
              </div>
            ))}
          </div>

          {/* Institution tag */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.35rem, 0.65vw, 0.45rem)', color: 'rgba(0,212,255,0.6)', letterSpacing: '2px', marginBottom: 8 }}>
              SVKM'S NMIMS INDORE · DEPT. OF COMPUTER ENGINEERING · 2025-26
            </div>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.35rem, 0.65vw, 0.45rem)', color: '#8338EC', letterSpacing: '1px', marginBottom: 12 }}>
              702CO0C072 — MICROPROCESSORS & MICROCONTROLLERS · DR. NIRMAL K GUPTA
            </div>
          </div>

          {/* Credits */}
          <div style={{ marginTop: 10, paddingBottom: 40 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.4rem, 0.7vw, 0.5rem)', color: '#8338EC', textShadow: '0 0 10px #8338EC88', letterSpacing: '2px', marginBottom: 15 }}>
              EXPERIENCE HANDCRAFTED BY
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px 40px' }}>
              {['SRISHTI JAIN (F149)', 'DIKSHA RATHI (F118)', 'TANAY TRIVEDI (F061)'].map((name, i) => (
                <div key={i} style={{ 
                  fontFamily: "'Press Start 2P', cursive", 
                  fontSize: 'clamp(0.45rem, 0.9vw, 0.65rem)', 
                  color: '#00d4ff', 
                  textShadow: '0 0 15px #00d4ffaa', 
                  letterSpacing: '2px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '8px 16px',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: '4px'
                }}>{name}</div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <button onClick={() => { setShowHelp(true); musicEngine.playSfx(600); }} style={{ position: 'fixed', bottom: 20, left: 20, background: 'rgba(0,0,0,0.8)', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100, boxShadow: '0 0 15px rgba(255,190,11,0.3)' }}>
        <HelpCircle size={20} />
      </button>

      {showHelp && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(5,5,15,0.92)', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ maxWidth:600, width:'100%', background:'rgba(0,0,0,0.85)', border:'3px solid #FFBE0B', padding:30, position:'relative', boxShadow:'0 0 50px rgba(255,190,11,0.2)' }}>
            <button onClick={()=>setShowHelp(false)} style={{ position:'absolute', top:15, right:15, background:'none', border:'none', color:'#FFBE0B', cursor:'pointer' }}><X size={20}/></button>
            <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.8rem', marginBottom:20, textAlign:'center' }}>KAI EXPLORER HELP</div>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {[
                { title: 'REPORT MODE', text: 'Step-by-step technical presentation covering dual-core implementation, sensor specs, and project results.' },
                { title: 'CIRCUIT MODE', text: 'Interactive pin diagram of the ESP32 and all peripherals. Click blocks to see GPIO mapping.' },
                { title: 'EXPLORE MODE', text: '3D structural breakdown of the KAI robot. Explode the model to see individual components.' },
                { title: 'EXPERIENCE MODE', text: 'Living Digital Twin. Interact with virtual matches and night cycles to stress-test KAI\'s behavioral logic.' }
              ].map((item, i) => (
                <div key={i} style={{ borderLeft: '4px solid #FFBE0B', paddingLeft: 15 }}>
                  <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.5rem', marginBottom:8 }}>{item.title}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#ddd', fontSize:'0.75rem', lineHeight:1.6 }}>{item.text}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowHelp(false)} style={{ marginTop:30, width:'100%', fontFamily:"'Press Start 2P',cursive", background:'#FFBE0B', border:'none', color:'#000', padding:10, fontSize:'0.5rem', cursor:'pointer' }}>START EXPLORING</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1000px) { div[style*="repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px) { div[style*="repeat(4, 1fr)"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}