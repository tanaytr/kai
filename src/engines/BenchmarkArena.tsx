import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, HelpCircle, X, Zap, Trophy } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface BenchmarkArenaProps {
  onBack: () => void;
}

const CHIP_COLORS: Record<string, string> = {
  'GB200':  '#00d4ff',
  'GH200':  '#76b900',
  'MI300X': '#FF006E',
  'H100':   '#8338EC',
  'A100':   '#FFBE0B',
};

const CHIP_BG: Record<string, string> = {
  'GB200':  'rgba(0,212,255,0.18)',
  'GH200':  'rgba(118,185,0,0.18)',
  'MI300X': 'rgba(255,0,110,0.18)',
  'H100':   'rgba(131,56,236,0.18)',
  'A100':   'rgba(255,190,11,0.18)',
};

const BENCHMARKS = {
  'AI Training (TFLOPS FP8)': [
    { name: 'GH200',  value: 3958 },
    { name: 'GB200',  value: 5200 },
    { name: 'MI300X', value: 2600 },
    { name: 'H100',   value: 2000 },
    { name: 'A100',   value: 624  },
  ],
  'Memory BW (GB/s)': [
    { name: 'GH200',  value: 4000 },
    { name: 'GB200',  value: 8000 },
    { name: 'MI300X', value: 5300 },
    { name: 'H100',   value: 3350 },
    { name: 'A100',   value: 1935 },
  ],
  'CPU-GPU Link (GB/s)': [
    { name: 'GH200',  value: 900  },
    { name: 'GB200',  value: 1800 },
    { name: 'MI300X', value: 128  },
    { name: 'H100',   value: 128  },
    { name: 'A100',   value: 64   },
  ],
  'Power Efficiency (rel.)': [
    { name: 'GH200',  value: 85 },
    { name: 'GB200',  value: 92 },
    { name: 'MI300X', value: 70 },
    { name: 'H100',   value: 68 },
    { name: 'A100',   value: 52 },
  ],
  'Total Memory (GB)': [
    { name: 'GH200',  value: 624  },
    { name: 'GB200',  value: 1440 },
    { name: 'MI300X', value: 192  },
    { name: 'H100',   value: 80   },
    { name: 'A100',   value: 80   },
  ],
};

type BenchKey = keyof typeof BENCHMARKS;

const SPEC_TABLE = [
  { chip: 'GH200',  cpu: '72-core ARM V2',    gpu: 'H100 (132 SM)',     memory: '624 GB',      link: '900 GB/s NVLink-C2C',  process: 'TSMC 4N',  tdp: '1000W' },
  { chip: 'GB200',  cpu: '2× 72-core ARM V2', gpu: '2× B200',          memory: '1440 GB',     link: '1800 GB/s NVLink-C2C', process: 'TSMC 4N',  tdp: '2700W' },
  { chip: 'MI300X', cpu: 'Zen 4 (24-core)',   gpu: 'CDNA3 (304 CU)',   memory: '192 GB HBM3', link: '128 GB/s Infinity Fab', process: 'TSMC 5nm', tdp: '750W'  },
  { chip: 'H100',   cpu: 'PCIe / NVLink',     gpu: 'Hopper (132 SM)',  memory: '80 GB HBM3',  link: '128 GB/s PCIe 5.0',    process: 'TSMC 4N',  tdp: '700W'  },
  { chip: 'A100',   cpu: 'PCIe / NVLink',     gpu: 'Ampere (108 SM)',  memory: '80 GB HBM2e', link: '64 GB/s PCIe 4.0',     process: 'TSMC 7nm', tdp: '400W'  },
];

// Race speeds — proportional to performance tier
const RACE_SPEED: Record<string, number> = {
  'GB200': 1.0, 'GH200': 0.85, 'MI300X': 0.70, 'H100': 0.60, 'A100': 0.38,
};

function TetrisBlock({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, background: color, flexShrink: 0,
      boxShadow: `inset -${Math.max(2, size / 6)}px -${Math.max(2, size / 6)}px 0 rgba(0,0,0,0.5), inset ${Math.max(2, size / 6)}px ${Math.max(2, size / 6)}px 0 rgba(255,255,255,0.3), 0 0 ${size / 2}px ${color}55`,
      border: '1px solid rgba(0,0,0,0.3)',
    }} />
  );
}

const TETRIS_COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];
function TetrisRow({ count = 32, reversed = false }: { count?: number; reversed?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '5px 10px', justifyContent: reversed ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <TetrisBlock key={i} color={TETRIS_COLORS[i % 5]} size={14} />
      ))}
    </div>
  );
}

export default function BenchmarkArena({ onBack }: BenchmarkArenaProps) {
  const [category, setCategory] = useState<BenchKey>('AI Training (TFLOPS FP8)');
  const [barWidths, setBarWidths] = useState<Record<string, number>>({});
  const [raceMode, setRaceMode] = useState(false);
  const [raceProgress, setRaceProgress] = useState<Record<string, number>>({});
  const [raceFinished, setRaceFinished] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);
  const [colorIdx, setColorIdx] = useState(0);
  const raceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setColorIdx(c => (c + 1) % TETRIS_COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  // Animate bars on category change
  useEffect(() => {
    const data = BENCHMARKS[category];
    const max = Math.max(...data.map(d => d.value));
    let frame = 0;
    const frames = 35;
    const id = setInterval(() => {
      frame++;
      const t = Math.min(frame / frames, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const w: Record<string, number> = {};
      data.forEach(d => { w[d.name] = (d.value / max) * 100 * eased; });
      setBarWidths(w);
      if (frame >= frames) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [category]);

  const startRace = () => {
    if (raceMode) return;
    if (raceRef.current) clearInterval(raceRef.current);
    setRaceMode(true);
    setRaceFinished(false);
    const data = BENCHMARKS[category];
    const max = Math.max(...data.map(d => d.value));
    const init: Record<string, number> = {};
    data.forEach(d => { init[d.name] = 0; });
    setRaceProgress(init);
    musicEngine.playSfx(700);

    raceRef.current = setInterval(() => {
      setRaceProgress(prev => {
        const next: Record<string, number> = {};
        let allDone = true;
        data.forEach(d => {
          const spd = RACE_SPEED[d.name] ?? 0.5;
          const target = (d.value / max) * 100;
          const newVal = Math.min(target, (prev[d.name] ?? 0) + target * spd * 0.025);
          next[d.name] = newVal;
          if (newVal < target - 0.1) allDone = false;
        });
        if (allDone) {
          if (raceRef.current) clearInterval(raceRef.current);
          setRaceFinished(true);
          setTimeout(() => { setRaceMode(false); setRaceFinished(false); }, 3000);
          musicEngine.playSfx(1200, 'sine', 0.2);
        }
        return next;
      });
    }, 40);
  };

  useEffect(() => () => { if (raceRef.current) clearInterval(raceRef.current); }, []);

  const data = BENCHMARKS[category];
  const max = Math.max(...data.map(d => d.value));
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const gh200Val = data.find(d => d.name === 'GH200')?.value ?? 1;

  const displayWidths = raceMode ? raceProgress : barWidths;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a14', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
      <TetrisRow count={32} />

      {/* HELP OVERLAY */}
      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={30} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '3px solid #FFBE0B', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>BENCHMARK ARENA — GUIDE</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { color: '#06FFA5', title: 'RACE MODE', body: 'Hit START RACE to watch all five chips race across the screen in real time. Bar speeds are proportional to actual performance. GB200 always wins — but watch how GH200 crushes H100 and A100.' },
                { color: '#3A86FF', title: 'CATEGORIES', body: 'Five benchmarks: AI Training TFLOPS (FP8), Memory Bandwidth, CPU-GPU Interconnect Speed, Power Efficiency (relative), and Total Memory capacity.' },
                { color: '#8338EC', title: 'HOVER TO INSPECT', body: 'Hover any chip\'s bar to see its exact value, percentage of the leader, and how it compares to GH200 as a baseline.' },
                { color: '#FF006E', title: 'LEADERBOARD TABLE', body: 'The table below the bars ranks all chips for the active category — sorted by value, highlighted by color.' },
                { color: '#FFBE0B', title: 'GH200 ADVANTAGE', body: 'GH200\'s NVLink-C2C gives it 7× CPU-GPU link advantage over PCIe competitors. Its 624 GB unified memory is 7× more than H100/A100 — enabling models too large for any competing single chip.' },
                { color: '#00d4ff', title: 'SPEC TABLE', body: 'Bottom section shows raw hardware specs. Notice GH200 pairs an ARM V2 CPU directly on-package — AMD and Intel still rely on separate host CPUs over slow PCIe.' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.46rem', marginBottom: 7 }}>{s.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.72rem', lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
          <TetrisRow count={30} reversed />
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '10px 20px', borderBottom: `3px solid ${TETRIS_COLORS[colorIdx]}`, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 4px 20px ${TETRIS_COLORS[colorIdx]}33` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={11} /> EXIT
          </button>
          <button onClick={() => setShowHelp(v => !v)} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.8rem', color: TETRIS_COLORS[colorIdx], textShadow: `0 0 10px ${TETRIS_COLORS[colorIdx]}` }}>
            BENCHMARK ARENA
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.6rem', marginTop: 2 }}>
            GPU Superchip Showdown
          </div>
        </div>

        <button
          onClick={startRace}
          disabled={raceMode}
          style={{
            background: raceMode ? '#1a1a2e' : 'linear-gradient(180deg,#06FFA5 0%,#05CC84 100%)',
            border: `3px solid ${raceMode ? '#333' : '#000'}`,
            boxShadow: raceMode ? 'none' : '0 4px 0 #048F5F',
            color: raceMode ? '#555' : '#000',
            padding: '10px 18px',
            fontFamily: "'Press Start 2P', cursive",
            fontSize: '0.5rem',
            cursor: raceMode ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Zap size={12} />
          {raceFinished ? '🏆 DONE!' : raceMode ? 'RACING...' : 'START RACE'}
        </button>
      </div>

      {/* CATEGORY SELECTOR */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderBottom: '2px solid rgba(131,56,236,0.3)', flexShrink: 0 }}>
        {(Object.keys(BENCHMARKS) as BenchKey[]).map((cat, i) => {
          const accent = TETRIS_COLORS[i % TETRIS_COLORS.length];
          const active = category === cat;
          return (
            <button key={cat} onClick={() => { setCategory(cat); musicEngine.playSfx(600); }}
              style={{
                background: active ? `${accent}22` : '#000',
                border: `2px solid ${active ? accent : accent + '44'}`,
                color: active ? accent : accent + '99',
                padding: '8px 14px',
                fontFamily: "'Press Start 2P', cursive",
                fontSize: '0.42rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: active ? `0 0 10px ${accent}44` : 'none',
              }}>
              {active ? '▶ ' : ''}{cat}
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '16px 20px', gap: 14 }}>

        {/* RACE / BAR CHART */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #1a1a2e', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.5rem', marginBottom: 16, letterSpacing: 1 }}>
            {raceMode ? '⚡ RACE IN PROGRESS...' : `📊 ${category}`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((chip) => {
              const color = CHIP_COLORS[chip.name];
              const bg = CHIP_BG[chip.name];
              const w = displayWidths[chip.name] ?? 0;
              const isHovered = hoveredChip === chip.name;
              const rank = sorted.findIndex(s => s.name === chip.name) + 1;
              const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

              return (
                <div
                  key={chip.name}
                  onMouseEnter={() => setHoveredChip(chip.name)}
                  onMouseLeave={() => setHoveredChip(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}
                >
                  {/* Chip name label */}
                  <div style={{
                    width: 72, flexShrink: 0, textAlign: 'right',
                    fontFamily: "'Press Start 2P', cursive",
                    fontSize: '0.42rem',
                    color,
                    textShadow: isHovered ? `0 0 8px ${color}` : 'none',
                  }}>
                    {chip.name}
                  </div>

                  {/* Bar track */}
                  <div style={{ flex: 1, height: 34, background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}33`, position: 'relative', overflow: 'visible' }}>
                    {/* Filled bar */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${w}%`,
                      background: `linear-gradient(90deg, ${bg} 0%, ${color}cc 100%)`,
                      borderRight: `3px solid ${color}`,
                      boxShadow: isHovered ? `0 0 16px ${color}88, inset 0 0 20px ${color}22` : `0 0 8px ${color}44`,
                      transition: raceMode ? 'none' : 'width 0.05s linear',
                    }} />

                    {/* Tetris-style block pattern overlay on bar */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${w}%`,
                      backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 28px, rgba(0,0,0,0.25) 28px, rgba(0,0,0,0.25) 30px)`,
                      pointerEvents: 'none',
                    }} />

                    {/* Value label on bar */}
                    {w > 15 && (
                      <div style={{
                        position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.72rem',
                        color: '#fff',
                        fontWeight: 'bold',
                        textShadow: '0 0 6px rgba(0,0,0,0.9)',
                        pointerEvents: 'none',
                      }}>
                        {chip.value.toLocaleString()}
                      </div>
                    )}

                    {/* Hover tooltip */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute', left: `${Math.min(w, 80)}%`, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.95)',
                        border: `2px solid ${color}`,
                        padding: '6px 10px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.65rem',
                        color,
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        boxShadow: `0 0 14px ${color}66`,
                      }}>
                        {chip.value.toLocaleString()} · {((chip.value / max) * 100).toFixed(1)}% of leader · {((chip.value / gh200Val) * 100).toFixed(0)}% vs GH200
                      </div>
                    )}
                  </div>

                  {/* Rank badge */}
                  <div style={{ width: 36, flexShrink: 0, textAlign: 'center', fontSize: '0.9rem' }}>{rankEmoji}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEADERBOARD TABLE */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #8338EC44', flexShrink: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '2px solid #8338EC44', fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.48rem', letterSpacing: 1 }}>
            🏆 LEADERBOARD
          </div>
          <table style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1a1a2e' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem' }}>RANK</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem' }}>CHIP</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem' }}>VALUE</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem' }}>% LEADER</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem' }}>VS GH200</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const color = CHIP_COLORS[item.name];
                const pct = ((item.value / max) * 100).toFixed(1);
                const vsGH200 = ((item.value / gh200Val) * 100).toFixed(0);
                const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `  #${idx + 1}`;
                return (
                  <tr key={item.name} style={{ borderBottom: '1px solid #1a1a2e', background: CHIP_BG[item.name] + '55' }}>
                    <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>{rankEmoji}</td>
                    <td style={{ padding: '10px 12px', color, fontFamily: "'Press Start 2P', cursive", fontSize: '0.44rem', fontWeight: 'bold' }}>
                      {item.name === 'GH200' ? '★ ' : ''}{item.name}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>{item.value.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ color: pct === '100.0' ? '#06FFA5' : '#aaa' }}>{pct}%</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{
                        color: item.name === 'GH200' ? '#76b900' : Number(vsGH200) > 100 ? '#06FFA5' : '#888',
                        fontWeight: item.name === 'GH200' ? 'bold' : 'normal',
                      }}>
                        {Number(vsGH200) > 100 ? '+' : ''}{vsGH200}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SPEC TABLE */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #FFBE0B44', flexShrink: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '2px solid #FFBE0B44', fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.48rem', letterSpacing: 1 }}>
            📋 FULL SPECIFICATIONS
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #FFBE0B33' }}>
                  {['CHIP', 'CPU', 'GPU', 'MEMORY', 'CPU-GPU LINK', 'PROCESS', 'TDP'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#FFBE0B', fontFamily: "'Press Start 2P', cursive", fontSize: '0.35rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SPEC_TABLE.map((spec) => {
                  const color = CHIP_COLORS[spec.chip];
                  return (
                    <tr key={spec.chip} style={{ borderBottom: '1px solid #1a1a2e', background: CHIP_BG[spec.chip] + '44' }}>
                      <td style={{ padding: '9px 10px', color, fontFamily: "'Press Start 2P', cursive", fontSize: '0.4rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {spec.chip === 'GH200' ? '★ ' : ''}{spec.chip}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#ccc', whiteSpace: 'nowrap' }}>{spec.cpu}</td>
                      <td style={{ padding: '9px 10px', color: '#ccc', whiteSpace: 'nowrap' }}>{spec.gpu}</td>
                      <td style={{ padding: '9px 10px', color: '#ccc', whiteSpace: 'nowrap' }}>{spec.memory}</td>
                      <td style={{ padding: '9px 10px', color, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{spec.link}</td>
                      <td style={{ padding: '9px 10px', color: '#aaa', whiteSpace: 'nowrap' }}>{spec.process}</td>
                      <td style={{ padding: '9px 10px', color: '#aaa', whiteSpace: 'nowrap' }}>{spec.tdp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TetrisRow count={32} reversed />

       <style>{`
        @keyframes barPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
      `}</style>
    </div>
  );
} 