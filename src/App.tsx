import { useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import HomeScreen from './components/HomeScreen';
import SlidesEngine from './engines/SlidesEngine';
import ChipViewer from './engines/ChipViewer';
import PipelineAnimator from './engines/PipelineAnimator';
import BenchmarkArena from './engines/BenchmarkArena';
import MemoryExplorer from './engines/MemoryExplorer';
import DataRoutingGame from './engines/DataRoutingGame';
import ArchitectureVisualizer from './engines/ArchitectureVisualizer';
import CacheExplorer from './engines/CacheExplorer';
import ISADecoder from './engines/ISADecoder';
import PaperModal from './engines/PaperModal';
import MusicPanel from './components/MusicPanel';
import ChipAssembler from './engines/ChipAssembler';
import AssemblyCompiler from './engines/AssemblyCompiler';
import { musicEngine, type MusicTheme, THEME_META } from './utils/musicEngine';

type Screen = 'home' | 'slides' | 'chip' | 'pipeline' | 'benchmark' | 'memory' | 'game' | 'arch' | 'cache' | 'isa' | 'paper' | 'assembler' | 'asmcompiler';

export default function App() {
  const [screen, setScreen]               = useState<Screen>('home');
  const [bgmMuted, setBgmMuted]           = useState(false);
  const [currentTheme, setCurrentTheme]   = useState<MusicTheme>('oppenheimer');
  const [audioStarted, setAudioStarted]   = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);

  const bootstrapAudio = useCallback(() => {
    if (audioStarted) return;
    const ok = musicEngine.init();
    if (!ok) return;
    setAudioStarted(true);
    setTimeout(() => {
      musicEngine.playTheme(currentTheme);
      musicEngine.setMuted(false);
    }, 300);
  }, [audioStarted, currentTheme]);

  const handleToggleMute = useCallback(() => {
    setBgmMuted(m => {
      musicEngine.setMuted(!m);
      musicEngine.playSfx(500, 'square', 0.08);
      return !m;
    });
  }, []);

  const handleSelectTheme = useCallback((theme: MusicTheme) => {
    setCurrentTheme(theme);
    musicEngine.playSfx(700, 'square', 0.08);
    musicEngine.playTheme(theme);
  }, []);

  const navigate = useCallback((to: Screen) => {
    musicEngine.playSfx(600);
    setScreen(to);
  }, []);

  const goHome = useCallback(() => {
    musicEngine.playSfx(400);
    setScreen('home');
  }, []);

  const accent       = THEME_META[currentTheme]?.color ?? '#06FFA5';
  const screenProps  = { onBack: goHome };
  const isHome       = screen === 'home';

  return (
    <div
      onClick={bootstrapAudio}
      className="app-container"
      style={{
        // On non-home screens keep overflow hidden (3D canvas etc)
        // On home screen allow natural scroll
        overflow: isHome ? 'auto' : 'hidden',
      }}
    >
      {/* CSS effect layers */}
      <div className="arcade-grid" />
      <div className="crt-overlay" />
      <div className="scanline" />
      <div className="telemetry-bar" />

      {/* Screen content */}
      <div style={{
        width: '100%',
        // Home screen: height auto to allow scrolling; others: full height
        height: isHome ? 'auto' : '100%',
        minHeight: '100%',
        position: 'relative',
        zIndex: 10,
      }}>
        {screen === 'home'      && <HomeScreen onNavigate={navigate} />}
        {screen === 'slides'    && <SlidesEngine {...screenProps} />}
        {screen === 'chip'      && <ChipViewer {...screenProps} />}
        {screen === 'assembler' && <ChipAssembler {...screenProps} />}
        {screen === 'pipeline'  && <PipelineAnimator {...screenProps} />}
        {screen === 'benchmark' && <BenchmarkArena {...screenProps} />}
        {screen === 'memory'    && <MemoryExplorer {...screenProps} />}
        {screen === 'game'      && <DataRoutingGame {...screenProps} />}
        {screen === 'arch'      && <ArchitectureVisualizer {...screenProps} />}
        {screen === 'cache'     && <CacheExplorer {...screenProps} />}
        {screen === 'isa'       && <ISADecoder {...screenProps} />}
        {screen === 'asmcompiler' && <AssemblyCompiler {...screenProps} />}
        {screen === 'paper'     && <PaperModal {...screenProps} />}
      </div>

      {/* Global floating controls */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <button
          onClick={(e) => { e.stopPropagation(); bootstrapAudio(); musicEngine.playSfx(600); setShowMusicPanel(v => !v); }}
          style={{ width: 44, height: 44, background: showMusicPanel ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.85)', border: `2px solid ${showMusicPanel ? accent : accent + '88'}`, color: showMusicPanel ? accent : accent + 'bb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: showMusicPanel ? `0 0 16px ${accent}66` : `0 0 6px ${accent}33`, transition: 'all 0.2s', fontSize: '1.2rem' }}>
          ♪
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
          style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.85)', border: `2px solid ${bgmMuted ? '#444' : '#06FFA5'}`, color: bgmMuted ? '#555' : '#06FFA5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: bgmMuted ? 'none' : '0 0 8px #06FFA544', transition: 'all 0.2s' }}>
          {bgmMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Music panel overlay */}
      <MusicPanel
        open={showMusicPanel}
        onClose={() => setShowMusicPanel(false)}
        currentTheme={currentTheme}
        bgmMuted={bgmMuted}
        onSelectTheme={handleSelectTheme}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}