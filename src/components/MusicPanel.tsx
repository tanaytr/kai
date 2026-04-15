import { useState, useEffect } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import type { MusicTheme } from '../utils/musicEngine';
import { THEME_META } from '../utils/musicEngine';

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, background: color, flexShrink: 0,
      boxShadow: `inset -${size/6}px -${size/6}px 0 rgba(0,0,0,0.5), inset ${size/6}px ${size/6}px 0 rgba(255,255,255,0.2)`,
      border: '1px solid rgba(0,0,0,0.3)',
    }} />
  );
}

interface MusicPanelProps {
  open: boolean;
  onClose: () => void;
  currentTheme: MusicTheme;
  bgmMuted: boolean;
  onSelectTheme: (t: MusicTheme) => void;
  onToggleMute: () => void;
}

export default function MusicPanel({ open, onClose, currentTheme, bgmMuted, onSelectTheme, onToggleMute }: MusicPanelProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bars, setBars] = useState<number[]>(Array(16).fill(4));

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (bgmMuted) { setBars(Array(16).fill(2)); return; }
    const interval = setInterval(() => {
      setBars(prev => prev.map((_, i) => {
        const base = [8, 14, 10, 18, 12, 20, 9, 16, 11, 15, 13, 19, 7, 17, 10, 14][i];
        return Math.max(2, Math.min(32, base + Math.floor(Math.random() * 10 - 5)));
      }));
    }, 120);
    return () => clearInterval(interval);
  }, [bgmMuted]);

  if (!mounted) return null;

  const accent = THEME_META[currentTheme].color;
  const themes = Object.keys(THEME_META) as MusicTheme[];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: `rgba(0,0,0,${visible ? 0.96 : 0})`,
      backdropFilter: 'blur(12px)',
      transition: 'background 0.4s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)', pointerEvents: 'none' }} />

      {/* Top tetris row */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', transform: `translateY(${visible ? 0 : -60}px)`, transition: 'transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)', flexShrink: 0, zIndex: 1 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <TetrisBlock key={i} color={[accent, '#FF006E', '#FFBE0B', '#06FFA5', '#3A86FF'][i % 5]} size={18} />
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: `3px solid ${accent}`, background: 'rgba(0,0,0,0.85)', transform: `translateY(${visible ? 0 : -40}px)`, transition: 'transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 0.05s', flexShrink: 0, zIndex: 1 }}>
        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.9rem', color: accent, textShadow: `0 0 10px ${accent}`, letterSpacing: 4 }}>♪ MUSIC ENGINE</div>
        <button onClick={onClose} style={{ background: 'none', border: `2px solid ${accent}`, color: accent, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 8px ${accent}44` }}>
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', transform: `translateY(${visible ? 0 : 30}px)`, opacity: visible ? 1 : 0, transition: 'transform 0.4s ease 0.1s, opacity 0.4s ease 0.1s', zIndex: 1 }}>
        <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>

          {/* Visualizer bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, height: 48, marginBottom: 32 }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                width: 14, height: h * 1.5,
                background: bgmMuted ? 'rgba(100,100,100,0.3)' : `linear-gradient(to top, ${accent}, ${accent}66)`,
                boxShadow: bgmMuted ? 'inset -2px -2px 0 rgba(0,0,0,0.4)' : `0 0 6px ${accent}88, inset -2px -2px 0 rgba(0,0,0,0.4)`,
                transition: 'height 0.12s ease, background 0.3s',
                flexShrink: 0,
              }} />
            ))}
          </div>

          {/* Now playing */}
          <div style={{ background: 'rgba(0,0,0,0.7)', border: `3px solid ${accent}`, boxShadow: `0 0 20px ${accent}44`, padding: '16px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: '2rem' }}>{THEME_META[currentTheme].emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: '#555', letterSpacing: 3, marginBottom: 4 }}>{bgmMuted ? 'PAUSED' : 'NOW PLAYING'}</div>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: accent, textShadow: `0 0 8px ${accent}` }}>{THEME_META[currentTheme].label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#8b8baa', marginTop: 4 }}>{THEME_META[currentTheme].desc}</div>
            </div>
            <button onClick={onToggleMute} style={{ background: 'rgba(0,0,0,0.8)', border: `2px solid ${bgmMuted ? '#444' : accent}`, color: bgmMuted ? '#555' : accent, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: bgmMuted ? 'none' : `0 0 12px ${accent}55`, transition: 'all 0.2s', flexShrink: 0 }}>
              {bgmMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* Theme grid */}
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', color: '#555', letterSpacing: 3, marginBottom: 16 }}>SELECT TRACK</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {themes.map(theme => {
              const meta = THEME_META[theme];
              const isActive = theme === currentTheme;
              return (
                <button key={theme} onClick={() => onSelectTheme(theme)} style={{
                  background: isActive ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.5)',
                  border: `3px solid ${isActive ? meta.color : meta.color + '44'}`,
                  boxShadow: isActive ? `0 0 18px ${meta.color}55, inset 0 0 20px ${meta.color}11` : 'none',
                  padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                }}>
                  {isActive && <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 28px 28px 0', borderColor: `transparent ${meta.color} transparent transparent` }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.4rem' }}>{meta.emoji}</span>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', color: isActive ? meta.color : '#ccc', textShadow: isActive ? `0 0 8px ${meta.color}` : 'none' }}>{meta.label}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#666', lineHeight: 1.4 }}>{meta.desc}</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: isActive ? meta.color : 'transparent', boxShadow: isActive ? `0 0 8px ${meta.color}` : 'none', transition: 'all 0.2s' }} />
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 32, fontFamily: "'Press Start 2P', cursive", fontSize: '0.42rem', color: '#333', letterSpacing: 2, textAlign: 'center', lineHeight: 2 }}>
            ALL MUSIC GENERATED IN REAL-TIME VIA WEB AUDIO API · MULTI-OSCILLATOR SYNTHESIS<br />
            SINE + TRIANGLE + SAWTOOTH · ADSR ENVELOPE · PROCEDURAL SCHEDULER
          </div>
        </div>
      </div>

      {/* Bottom tetris row */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', justifyContent: 'flex-end', transform: `translateY(${visible ? 0 : 60}px)`, transition: 'transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)', flexShrink: 0, zIndex: 1 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <TetrisBlock key={i} color={['#3A86FF', '#06FFA5', '#FFBE0B', '#FF006E', accent][i % 5]} size={18} />
        ))}
      </div>
    </div>
  );
}