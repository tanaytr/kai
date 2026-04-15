import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';
import { gestureController, type GestureState } from '../utils/gestureControl';

interface DataRoutingGameProps { onBack: () => void; }

const CANVAS_W = 800;
const CANVAS_H = 600;

const PACKET_TYPES = [
  { id: 'cpu',    label: 'CPU INSTR',  col: '#76b900', zone: 'cpu' },
  { id: 'tensor', label: 'AI TENSOR',  col: '#cc44ff', zone: 'tc'  },
  { id: 'memory', label: 'MEM REQ',    col: '#ff2244', zone: 'hbm' },
  { id: 'cache',  label: 'CACHE DATA', col: '#ff7700', zone: 'l3'  },
  { id: 'c2c',    label: 'C2C DATA',   col: '#00e5ff', zone: 'c2c' },
];

// Paddle step sizes for fist/open gesture
const FIST_OPEN_STEP = 28; // px per frame while gesture is held

function GestureHUD({ state }: { state: GestureState | null }) {
  if (!state) return null;
  let label = 'NO HAND'; let color = '#555'; let icon = '✋';
  if (state.type === 'fist') {
    icon = '✊'; color = '#FF006E'; label = '← FIST = MOVE LEFT';
  } else if (state.type === 'open') {
    icon = '✋'; color = '#3A86FF'; label = 'OPEN PALM = MOVE RIGHT →';
  } else if (state.type === 'index') {
    icon = '☝'; color = '#06FFA5'; label = 'INDEX — DIRECT POSITION';
  }
  return (
    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', border: `2px solid ${color}`, padding: '5px 14px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 0 12px ${color}55`, fontFamily: "'Press Start 2P', cursive", pointerEvents: 'none', minWidth: 250 }}>
      <span style={{ fontSize: '0.9rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.4rem', color, letterSpacing: 1 }}>{label}</div>
        {state.rawX !== undefined && (
          <div style={{ marginTop: 3, width: 110, height: 3, background: '#222', position: 'relative' }}>
            <div style={{ position: 'absolute', left: `${state.rawX * 100}%`, top: -2, width: 7, height: 7, background: color, borderRadius: '50%', transform: 'translateX(-50%)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function GestureControlPanel() {
  return (
    <div style={{ position: 'absolute', bottom: 50, right: 8, zIndex: 190, background: 'rgba(0,0,0,0.88)', border: '2px solid #06FFA555', padding: '10px 14px', width: 210, fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>
      <div style={{ fontSize: '0.45rem', color: '#06FFA5', fontFamily: "'Press Start 2P', cursive", marginBottom: 8, letterSpacing: 1 }}>GESTURE GUIDE</div>
      {[
        { icon: '✊', label: 'Fist',       action: 'Move paddle LEFT ←',  color: '#FF006E' },
        { icon: '✋', label: 'Open palm',  action: 'Move paddle RIGHT →',  color: '#3A86FF' },
        { icon: '☝', label: 'Index only', action: 'Direct position track', color: '#06FFA5' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontSize: '0.85rem', lineHeight: 1, minWidth: 16 }}>{r.icon}</span>
          <div>
            <div style={{ fontSize: '0.5rem', color: r.color }}>{r.label}</div>
            <div style={{ fontSize: '0.45rem', color: '#888' }}>{r.action}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DataRoutingGame({ onBack }: DataRoutingGameProps) {
  const [score, setScore]             = useState(0);
  const [lives, setLives]             = useState(3);
  const [level, setLevel]             = useState(1);
  const [streak, setStreak]           = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver]       = useState(false);
  const [paddleX, setPaddleX]         = useState(400);
  const [highScore, setHighScore]     = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureState, setGestureState]     = useState<GestureState | null>(null);
  const [showHelp, setShowHelp]       = useState(false);

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const packetsRef     = useRef<any[]>([]);
  const zonesRef       = useRef<any[]>([]);
  const particlesRef   = useRef<any[]>([]);
  const animFrameRef   = useRef<number | null>(null);
  const spawnTimerRef  = useRef(0);

  const paddleXRef    = useRef(400);
  const scoreRef      = useRef(0);
  const livesRef      = useRef(3);
  const levelRef      = useRef(1);
  const streakRef     = useRef(0);
  const gameOnRef     = useRef(false);

  // Current gesture type held — used for continuous fist/open movement
  const heldGestureRef = useRef<'fist' | 'open' | 'none'>('none');

  useEffect(() => { paddleXRef.current = paddleX; }, [paddleX]);
  useEffect(() => { gameOnRef.current  = gameStarted && !gameOver; }, [gameStarted, gameOver]);

  useEffect(() => {
    const zW = CANVAS_W / 5;
    zonesRef.current = [
      { id: 'cpu', label: 'GRACE CPU',    col: '#76b900', x: 0,      y: CANVAS_H - 70, w: zW, h: 70 },
      { id: 'tc',  label: 'TENSOR CORES', col: '#cc44ff', x: zW,     y: CANVAS_H - 70, w: zW, h: 70 },
      { id: 'hbm', label: 'HBM3e',        col: '#ff2244', x: zW * 2, y: CANVAS_H - 70, w: zW, h: 70 },
      { id: 'l3',  label: 'L3 CACHE',     col: '#ff7700', x: zW * 3, y: CANVAS_H - 70, w: zW, h: 70 },
      { id: 'c2c', label: 'NVLink-C2C',   col: '#00e5ff', x: zW * 4, y: CANVAS_H - 70, w: zW, h: 70 },
    ];
  }, []);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const burst = (x: number, y: number, col: string, n: number) => {
      for (let i = 0; i < n; i++) {
        particlesRef.current.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 1) * 8, life: 1, col, r: Math.random() * 3 + 1 });
      }
    };

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply continuous fist/open movement each frame
      const held = heldGestureRef.current;
      if (held === 'fist') {
        const v = Math.max(50, paddleXRef.current - FIST_OPEN_STEP);
        paddleXRef.current = v; setPaddleX(v);
      } else if (held === 'open') {
        const v = Math.min(CANVAS_W - 50, paddleXRef.current + FIST_OPEN_STEP);
        paddleXRef.current = v; setPaddleX(v);
      }

      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid lines
      ctx.strokeStyle = 'rgba(118,185,0,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
      for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }

      const px = paddleXRef.current;

      // Spawn packets
      spawnTimerRef.current++;
      const spawnRate = Math.max(30, 80 - levelRef.current * 5);
      if (spawnTimerRef.current >= spawnRate) {
        spawnTimerRef.current = 0;
        const t = PACKET_TYPES[Math.floor(Math.random() * PACKET_TYPES.length)];
        packetsRef.current.push({ x: Math.random() * (CANVAS_W - 60) + 30, y: -30, w: 80, h: 28, vy: 1.5 + levelRef.current * 0.3, type: t, alive: true, caught: false, catchVx: 0 });
      }

      // Update & draw packets
      packetsRef.current = packetsRef.current.filter(p => {
        if (!p.alive) return false;
        if (!p.caught) {
          p.y += p.vy;
          const pCX = p.x + p.w / 2;
          const pCY = p.y + p.h / 2;
          if (pCY > CANVAS_H - 100 - 7 && pCY < CANVAS_H - 100 + 7 && pCX > px - 50 && pCX < px + 50) {
            p.caught = true; p.catchVx = (pCX - px) / 50 * 3; musicEngine.playSfx(800);
          }
          if (p.y > CANVAS_H + 40) {
            p.alive = false;
            livesRef.current = Math.max(0, livesRef.current - 1);
            setLives(livesRef.current);
            if (livesRef.current <= 0) { setGameOver(true); setGameStarted(false); }
            streakRef.current = 0; setStreak(0); musicEngine.playSfx(300);
            burst(p.x + p.w / 2, CANVAS_H - 50, '#ff2244', 14);
          }
        } else {
          p.y += p.vy * 1.5; p.x += p.catchVx;
          if (p.y + p.h > CANVAS_H - 70) {
            zonesRef.current.forEach(z => {
              const pCX = p.x + p.w / 2;
              if (pCX > z.x && pCX < z.x + z.w) {
                if (z.id === p.type.zone) {
                  streakRef.current++;
                  const bonus = 10 * (1 + Math.floor(streakRef.current / 5));
                  scoreRef.current += bonus; setScore(scoreRef.current); setStreak(streakRef.current);
                  if (streakRef.current % 10 === 0) { levelRef.current++; setLevel(levelRef.current); }
                  musicEngine.playSfx(1200); burst(pCX, CANVAS_H - 50, p.type.col, 18);
                } else {
                  livesRef.current = Math.max(0, livesRef.current - 1); setLives(livesRef.current);
                  if (livesRef.current <= 0) { setGameOver(true); setGameStarted(false); }
                  streakRef.current = 0; setStreak(0); musicEngine.playSfx(400);
                  burst(pCX, CANVAS_H - 50, '#ff2244', 14);
                }
                p.alive = false;
              }
            });
            if (p.alive && p.y + p.h > CANVAS_H) p.alive = false;
          }
        }

        if (!p.alive) return false;
        ctx.fillStyle = p.type.col + '22';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = p.type.col;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = p.type.col;
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(p.type.label, p.x + p.w / 2, p.y + p.h / 2 + 4);
        return true;
      });

      // Zones
      zonesRef.current.forEach(z => {
        ctx.fillStyle = z.col + '18';
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = z.col + '88';
        ctx.lineWidth = 2;
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = z.col;
        ctx.font = "bold 8px 'Press Start 2P', cursive";
        ctx.textAlign = 'center';
        ctx.fillText(z.label, z.x + z.w / 2, z.y + 28);
      });

      // Paddle
      const pw = 100, ph = 16;
      const grad = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
      grad.addColorStop(0, '#8338EC'); grad.addColorStop(0.5, '#06FFA5'); grad.addColorStop(1, '#8338EC');
      ctx.fillStyle = grad;
      ctx.fillRect(px - pw / 2, CANVAS_H - 100, pw, ph);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(px - pw / 2, CANVAS_H - 100, pw, ph);

      // Particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.04;
        if (p.life > 0) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.col + Math.floor(p.life * 200).toString(16).padStart(2, '0');
          ctx.fill();
        }
        return p.life > 0;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [gameStarted, gameOver]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(50, Math.min(CANVAS_W - 50, (e.clientX - rect.left) * (CANVAS_W / rect.width)));
    setPaddleX(x); paddleXRef.current = x;
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const handleKey = (e: KeyboardEvent) => {
      const step = 22;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
        const v = Math.max(50, paddleXRef.current - step); setPaddleX(v); paddleXRef.current = v;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        const v = Math.min(CANVAS_W - 50, paddleXRef.current + step); setPaddleX(v); paddleXRef.current = v;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameStarted, gameOver]);

  // FIST = continuous left, OPEN = continuous right, INDEX = direct position
  // heldGestureRef is read every animation frame so movement is smooth
  const handleGesture = useCallback((gesture: GestureState) => {
    setGestureState(gesture);
    if (!gameOnRef.current) return;

    if (gesture.type === 'fist') {
      heldGestureRef.current = 'fist';
    } else if (gesture.type === 'open') {
      heldGestureRef.current = 'open';
    } else {
      heldGestureRef.current = 'none';
    }

    // Index finger still provides direct position as backup
    if (gesture.type === 'index' && gesture.rawX !== undefined) {
      const x = Math.max(50, Math.min(CANVAS_W - 50, gesture.rawX * CANVAS_W));
      paddleXRef.current = x;
      setPaddleX(x);
    }
  }, []);

  useEffect(() => {
    if (gestureEnabled) {
      gestureController.subscribe(handleGesture);
      return () => { gestureController.unsubscribe(handleGesture); heldGestureRef.current = 'none'; };
    } else {
      setGestureState(null);
      heldGestureRef.current = 'none';
    }
  }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) { gestureController.stop(); setGestureEnabled(false); musicEngine.playSfx(400); return; }
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera API unavailable.'); return; }
    try {
      const ok = await gestureController.init();
      if (ok) { setGestureEnabled(true); musicEngine.playSfx(900); }
      else alert('Gesture engine failed. Check DevTools console.');
    } catch (err) { alert(`Gesture init error:\n${err}`); }
  };

  const startGame = () => {
    setScore(0);  scoreRef.current  = 0;
    setLives(3);  livesRef.current  = 3;
    setLevel(1);  levelRef.current  = 1;
    setStreak(0); streakRef.current = 0;
    setGameStarted(true); setGameOver(false);
    packetsRef.current = []; particlesRef.current = []; spawnTimerRef.current = 0;
    heldGestureRef.current = 'none';
    musicEngine.playSfx(900);
  };

  useEffect(() => {
    if (gameOver && score > highScore) setHighScore(score);
  }, [gameOver]); // eslint-disable-line

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', position: 'relative', zIndex: 10 }}>
      <div style={{ padding: '12px 24px', borderBottom: '4px solid #8338EC', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 16px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <ArrowLeft size={12} /> EXIT
          </button>
          <button onClick={() => setShowHelp(v => !v)} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
          <button onClick={toggleGesture} style={{ background: gestureEnabled ? 'rgba(6,255,165,0.2)' : '#000', border: `3px solid ${gestureEnabled ? '#06FFA5' : '#555'}`, color: gestureEnabled ? '#06FFA5' : '#555', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem' }}>
            🖐
          </button>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.85rem', color: '#8338EC', textShadow: '0 0 10px #8338EC' }}>DATA ROUTING GAME</div>
        {gameStarted && !gameOver ? (
          <div style={{ display: 'flex', gap: 16, fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', flexWrap: 'wrap' }}>
            <span>SCORE: <span style={{ color: '#06FFA5' }}>{score}</span></span>
            <span>LIVES: <span style={{ color: '#FF006E' }}>{lives}</span></span>
            <span>LEVEL: <span style={{ color: '#FFBE0B' }}>{level}</span></span>
            <span>STREAK: <span style={{ color: '#8338EC' }}>{streak}</span></span>
          </div>
        ) : <div style={{ width: 200 }} />}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
        {!gameStarted && !gameOver ? (
          <div style={{ textAlign: 'center', maxWidth: 600, padding: 40 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '1.8rem', color: '#76b900', marginBottom: 20, textShadow: '4px 4px 0 #000, 0 0 20px #76b900' }}>DATA ROUTING</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: '#8b8baa', marginBottom: 30, lineHeight: 1.8 }}>
              Route data packets to the correct GH200 component.<br />
              Move your paddle with <b style={{ color: '#06FFA5' }}>MOUSE</b>, <b style={{ color: '#FFBE0B' }}>ARROW KEYS</b>,<br />
              or <b style={{ color: '#FF006E' }}>GESTURE</b>: <b style={{ color: '#FF006E' }}>✊ FIST</b> = left · <b style={{ color: '#3A86FF' }}>✋ OPEN</b> = right
            </div>
            <div style={{ background: 'rgba(131,56,236,0.1)', border: '2px solid #8338EC', padding: 16, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', color: '#8338EC', marginBottom: 12 }}>ROUTING TABLE:</div>
              {PACKET_TYPES.map(t => (
                <div key={t.id} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.col, marginBottom: 6 }}>
                  → {t.label} <span style={{ color: '#666' }}>→</span> <span style={{ color: '#ccc' }}>{zonesRef.current.find(z => z.id === t.zone)?.label ?? t.zone}</span>
                </div>
              ))}
            </div>
            <button onClick={startGame} style={{ fontFamily: "'Press Start 2P', cursive", background: 'linear-gradient(180deg, #76b900 0%, #5a8e00 100%)', border: '6px solid #000', color: '#fff', padding: '20px 40px', fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 6px 0 #3a5a00' }}>▶ START GAME</button>
          </div>
        ) : gameOver ? (
          <div style={{ textAlign: 'center', maxWidth: 600, padding: 40 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '1.5rem', color: '#FF006E', marginBottom: 20 }}>ROUTING HALTED</div>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '2.5rem', color: '#06FFA5', marginBottom: 10 }}>{score}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: '#555', marginBottom: 20 }}>PACKETS ROUTED</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: '#8b8baa', marginBottom: 30 }}>HI-SCORE: <span style={{ color: '#FFBE0B' }}>{highScore}</span></div>
            <button onClick={startGame} style={{ fontFamily: "'Press Start 2P', cursive", background: '#76b900', border: '4px solid #000', color: '#000', padding: '16px 32px', fontSize: '0.7rem', cursor: 'pointer' }}>⟳ RESTART</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onMouseMove={handleMouseMove} style={{ border: '4px solid #76b900', boxShadow: '0 0 20px rgba(118,185,0,0.5)', cursor: 'none', display: 'block', maxWidth: '100%' }} />
            {gestureEnabled && <GestureHUD state={gestureState} />}
            {gestureEnabled && <GestureControlPanel />}
          </div>
        )}
      </div>

      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B', background: 'rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>DATA ROUTING GAME — HELP</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {[
                  { color: '#06FFA5', title: 'OBJECTIVE',     body: 'Catch falling data packets with your paddle, then guide them to the correct chip component zone at the bottom.' },
                  { color: '#3A86FF', title: 'MOUSE CONTROL', body: 'Move your mouse over the game canvas. Paddle follows cursor horizontally.' },
                  { color: '#8338EC', title: 'KEYBOARD',      body: 'Arrow keys ← → or A/D keys move the paddle 22 pixels per press.' },
                  { color: '#FFBE0B', title: 'SCORING',       body: 'Correct: +10 pts × (1 + streak÷5). Wrong zone or missed: −1 life, streak reset. Every 10 streak = level up!' },
                  { color: '#cc44ff', title: 'ROUTING TABLE', body: 'CPU INSTR→GRACE CPU · AI TENSOR→TENSOR CORES · MEM REQ→HBM3e · CACHE DATA→L3 CACHE · C2C DATA→NVLink-C2C' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.48rem', marginBottom: 7 }}>{s.title}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.75rem', lineHeight: 1.7 }}>{s.body}</div>
                  </div>
                ))}
              </div>

              {/* Gesture guide */}
              <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #06FFA544', borderLeft: '4px solid #06FFA5', padding: '14px 16px' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.48rem', marginBottom: 10 }}>GESTURE CONTROL (enable 🖐 button)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {[
                    { icon: '✊', gesture: 'Fist',        action: 'Continuously move paddle LEFT ←',   color: '#FF006E' },
                    { icon: '✋', gesture: 'Open Palm',   action: 'Continuously move paddle RIGHT →',  color: '#3A86FF' },
                    { icon: '☝', gesture: 'Index finger', action: 'Direct position mapping (backup)',  color: '#06FFA5' },
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
                  Tip: Fist and open palm are detected from all angles — distance-based detection, not axis-dependent.
                  Hold the gesture continuously to keep moving the paddle.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}