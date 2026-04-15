// musicEngine.ts — Multi-oscillator synthesis with 6 themes
const TEMPO = 80;
const BEAT = 60 / TEMPO;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

export type MusicTheme = 'oppenheimer' | 'interstellar' | 'jupiter_40' | 'fur_elise' | 'harry_potter' | 'f1_theme';

interface MusicNote { notes: string[]; duration: number; }

export const THEME_META: Record<MusicTheme, { label: string; emoji: string; desc: string; color: string }> = {
  oppenheimer:  { label: 'Oppenheimer',   emoji: '☢️', desc: 'Ludwig Göransson — Tension & Dread',   color: '#FFBE0B' },
  interstellar: { label: 'Interstellar',  emoji: '🌌', desc: 'Hans Zimmer — Cosmic & Cinematic',     color: '#3A86FF' },
  jupiter_40:   { label: 'Jupiter Op.40', emoji: '🪐', desc: 'Mozart — Grand & Triumphant',           color: '#06FFA5' },
  fur_elise:    { label: 'Für Elise',     emoji: '🎹', desc: 'Beethoven — Delicate & Melancholic',   color: '#FF006E' },
  harry_potter: { label: 'Harry Potter',  emoji: '⚡', desc: 'John Williams — Magical & Epic',       color: '#8338EC' },
  f1_theme:     { label: 'F1 Theme',      emoji: '🏎️', desc: 'Brian Tyler — Pulse & Adrenaline',    color: '#FF4400' },
};

const NOTE_TO_FREQ: Record<string, number> = {
  'A2': 110.00, 'A#2': 116.54, 'Bb2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65,
  'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30,
  'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
  'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'A5': 880.00,
  'B5': 987.77, 'D2': 73.42, 'G2': 98.00, 'F2': 87.31,
};

const MUSIC_SEQUENCES: Record<MusicTheme, MusicNote[]> = {
  oppenheimer: [
    { notes: ['A2'], duration: SIXTEENTH }, { notes: ['E3'], duration: SIXTEENTH },
    { notes: ['A3'], duration: SIXTEENTH }, { notes: ['C4'], duration: SIXTEENTH },
    { notes: ['E4'], duration: SIXTEENTH }, { notes: ['A3'], duration: SIXTEENTH },
    { notes: ['C4'], duration: SIXTEENTH }, { notes: ['E4'], duration: SIXTEENTH },
    { notes: ['G2'], duration: SIXTEENTH }, { notes: ['D3'], duration: SIXTEENTH },
    { notes: ['G3'], duration: SIXTEENTH }, { notes: ['B3'], duration: SIXTEENTH },
    { notes: ['D4'], duration: SIXTEENTH }, { notes: ['G3'], duration: SIXTEENTH },
    { notes: ['B3'], duration: SIXTEENTH }, { notes: ['D4'], duration: SIXTEENTH },
    { notes: ['C3'], duration: SIXTEENTH }, { notes: ['G3'], duration: SIXTEENTH },
    { notes: ['C4'], duration: SIXTEENTH }, { notes: ['E4'], duration: SIXTEENTH },
    { notes: ['G4'], duration: SIXTEENTH }, { notes: ['C4'], duration: SIXTEENTH },
    { notes: ['E4'], duration: SIXTEENTH }, { notes: ['G4'], duration: SIXTEENTH },
    { notes: ['F2'], duration: SIXTEENTH }, { notes: ['C3'], duration: SIXTEENTH },
    { notes: ['F3'], duration: SIXTEENTH }, { notes: ['A3'], duration: SIXTEENTH },
    { notes: ['C4'], duration: SIXTEENTH }, { notes: ['F3'], duration: SIXTEENTH },
    { notes: ['A3'], duration: SIXTEENTH }, { notes: ['C4'], duration: SIXTEENTH },
  ],
  interstellar: [
    { notes: ['A2', 'E3', 'A3'], duration: BEAT }, { notes: ['E3', 'A3', 'C4'], duration: BEAT },
    { notes: ['A2', 'E3', 'A3'], duration: BEAT }, { notes: ['E3', 'A3', 'C4'], duration: BEAT },
    { notes: ['F2', 'C3', 'F3'], duration: BEAT }, { notes: ['C3', 'F3', 'A3'], duration: BEAT },
    { notes: ['F2', 'C3', 'F3'], duration: BEAT }, { notes: ['C3', 'F3', 'A3'], duration: BEAT },
    { notes: ['G2', 'D3', 'G3'], duration: BEAT }, { notes: ['D3', 'G3', 'B3'], duration: BEAT },
    { notes: ['G2', 'D3', 'G3'], duration: BEAT }, { notes: ['D3', 'G3', 'B3'], duration: BEAT },
    { notes: ['A2', 'E3', 'A3'], duration: BEAT }, { notes: ['E3', 'A3', 'C4'], duration: BEAT },
    { notes: ['A2', 'E3', 'A3'], duration: BEAT }, { notes: ['E3', 'A3', 'C4'], duration: BEAT },
  ],
  jupiter_40: [
    { notes: ['Eb4', 'Bb2', 'Eb3'], duration: BEAT }, { notes: [], duration: EIGHTH },
    { notes: ['Bb3'], duration: EIGHTH }, { notes: ['Eb4', 'C3', 'G3'], duration: BEAT },
    { notes: ['F4'], duration: BEAT }, { notes: ['G4', 'G2', 'D3'], duration: BEAT },
    { notes: ['Ab4'], duration: BEAT }, { notes: ['Bb4', 'Bb2', 'F3'], duration: BEAT },
    { notes: ['G4'], duration: BEAT }, { notes: ['Ab4', 'F2', 'C3'], duration: EIGHTH },
    { notes: ['G4'], duration: EIGHTH }, { notes: ['F4'], duration: EIGHTH },
    { notes: ['Eb4'], duration: EIGHTH }, { notes: ['F4', 'Bb2', 'F3'], duration: BEAT },
    { notes: ['G4'], duration: BEAT }, { notes: ['Ab4', 'Eb3', 'Bb3'], duration: BEAT },
    { notes: ['Eb4'], duration: BEAT }, { notes: ['Bb3', 'Bb2', 'F3'], duration: BEAT * 2 },
    { notes: [], duration: BEAT },
  ],
  fur_elise: [
    { notes: ['E5'], duration: EIGHTH }, { notes: ['D#5'], duration: EIGHTH },
    { notes: ['E5', 'A3', 'E4'], duration: EIGHTH }, { notes: ['D#5'], duration: EIGHTH },
    { notes: ['E5'], duration: EIGHTH }, { notes: ['B4'], duration: EIGHTH },
    { notes: ['D5'], duration: EIGHTH }, { notes: ['C5'], duration: EIGHTH },
    { notes: ['A4', 'C4', 'E4'], duration: BEAT }, { notes: [], duration: EIGHTH },
    { notes: ['C4'], duration: EIGHTH }, { notes: ['E4'], duration: EIGHTH },
    { notes: ['A4'], duration: EIGHTH }, { notes: ['B4', 'E4', 'G#4'], duration: BEAT },
    { notes: [], duration: EIGHTH }, { notes: ['E4'], duration: EIGHTH },
    { notes: ['G#4'], duration: EIGHTH }, { notes: ['B4'], duration: EIGHTH },
    { notes: ['C5', 'A3', 'E4'], duration: BEAT }, { notes: [], duration: EIGHTH },
    { notes: ['E4'], duration: EIGHTH }, { notes: ['E5'], duration: EIGHTH },
    { notes: ['D#5'], duration: EIGHTH }, { notes: ['E5', 'A3', 'E4'], duration: EIGHTH },
    { notes: ['D#5'], duration: EIGHTH }, { notes: ['E5'], duration: EIGHTH },
    { notes: ['B4'], duration: EIGHTH }, { notes: ['D5'], duration: EIGHTH },
    { notes: ['C5'], duration: EIGHTH }, { notes: ['A4', 'C4', 'E4'], duration: BEAT },
    { notes: [], duration: EIGHTH }, { notes: ['C4'], duration: EIGHTH },
    { notes: ['E4'], duration: EIGHTH }, { notes: ['A4'], duration: EIGHTH },
    { notes: ['B4', 'E4', 'G#4'], duration: BEAT }, { notes: [], duration: EIGHTH },
    { notes: ['E4'], duration: EIGHTH }, { notes: ['C5'], duration: EIGHTH },
    { notes: ['B4'], duration: EIGHTH }, { notes: ['A4', 'A3', 'E4'], duration: BEAT * 2 },
    { notes: [], duration: BEAT },
  ],
  harry_potter: [
    { notes: ['B4'], duration: BEAT }, { notes: ['E5', 'G4', 'B4'], duration: BEAT + EIGHTH },
    { notes: ['G5'], duration: EIGHTH }, { notes: ['F#5'], duration: BEAT },
    { notes: ['E5', 'E4', 'G4', 'B4'], duration: BEAT * 2 }, { notes: ['B5'], duration: BEAT },
    { notes: ['A5', 'C5', 'E5'], duration: BEAT * 2 }, { notes: ['F#5'], duration: BEAT * 3 },
    { notes: ['E5', 'G4', 'B4'], duration: BEAT + EIGHTH }, { notes: ['G5'], duration: EIGHTH },
    { notes: ['F#5'], duration: BEAT }, { notes: ['D#5', 'E4', 'G4', 'B4'], duration: BEAT * 2 },
    { notes: ['F5'], duration: BEAT }, { notes: ['C5', 'E4', 'A4'], duration: BEAT * 3 },
    { notes: [], duration: BEAT },
  ],
  f1_theme: [
    { notes: [], duration: BEAT }, { notes: ['D4', 'D2'], duration: EIGHTH },
    { notes: ['D4'], duration: EIGHTH }, { notes: ['D4'], duration: EIGHTH },
    { notes: [], duration: EIGHTH }, { notes: ['D4', 'D2'], duration: EIGHTH },
    { notes: ['D4'], duration: EIGHTH }, { notes: ['D4'], duration: EIGHTH },
    { notes: [], duration: EIGHTH }, { notes: ['D4', 'D2'], duration: SIXTEENTH },
    { notes: ['D4'], duration: SIXTEENTH }, { notes: ['D4'], duration: SIXTEENTH },
    { notes: ['D4'], duration: SIXTEENTH }, { notes: ['G4', 'G2'], duration: BEAT },
    { notes: ['A#4', 'A#2'], duration: BEAT }, { notes: ['D5', 'D3'], duration: BEAT * 2 },
    { notes: [], duration: BEAT },
  ],
};

class MusicEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private schedulerTimer: number | null = null;
  private currentTheme: MusicTheme = 'oppenheimer';
  private muted: boolean = false;
  private initialized: boolean = false;

  init(): boolean {
    if (this.initialized) return true;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;

    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.bgmGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0;
    this.sfxGain.gain.value = 1;
    this.bgmGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this.initialized = true;
    return true;
  }

  playTheme(theme: MusicTheme) {
    if (!this.ctx || !this.bgmGain) return;

    // Stop old scheduler
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.currentTheme = theme;
    const bg = this.bgmGain;
    const ctx = this.ctx;

    // Fade out then start new
    bg.gain.setTargetAtTime(0, ctx.currentTime, 0.1);

    setTimeout(() => {
      if (!this.ctx || !this.bgmGain) return;
      this.bgmGain.gain.setTargetAtTime(this.muted ? 0 : 0.4, this.ctx.currentTime, 0.5);

      const sequence = MUSIC_SEQUENCES[theme];
      let noteIdx = 0;
      let nextTime = this.ctx.currentTime + 0.05;

      const tick = () => {
        if (!this.ctx || !this.bgmGain) return;
        while (nextTime < this.ctx.currentTime + 0.25) {
          const item = sequence[noteIdx];
          this.playNotes(item.notes.map(n => NOTE_TO_FREQ[n] || 0).filter(f => f > 0), nextTime);
          nextTime += item.duration;
          noteIdx = (noteIdx + 1) % sequence.length;
        }
        this.schedulerTimer = window.setTimeout(tick, 80);
      };
      tick();
    }, 220);
  }

  private playNotes(freqs: number[], time: number) {
    if (!this.ctx || !this.bgmGain || freqs.length === 0) return;
    const ctx = this.ctx;
    const bg = this.bgmGain;
    const noteGain = 0.5 / Math.sqrt(freqs.length);

    freqs.forEach(freq => {
      const osc  = ctx.createOscillator(); osc.type  = 'sine';     osc.frequency.setValueAtTime(freq,     time);
      const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 2, time);
      const osc3 = ctx.createOscillator(); osc3.type = 'sawtooth'; osc3.frequency.setValueAtTime(freq * 3, time);

      const osc2g = ctx.createGain(); osc2g.gain.value = 0.3;
      const osc3g = ctx.createGain(); osc3g.gain.value = 0.1;

      const env = ctx.createGain(); env.connect(bg);
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(noteGain, time + 0.05);
      env.gain.setTargetAtTime(noteGain * 0.4, time + 0.05, 0.2);
      env.gain.setTargetAtTime(0.0001, time + 0.25, 1.5);

      osc.connect(env);
      osc2.connect(osc2g); osc2g.connect(env);
      osc3.connect(osc3g); osc3g.connect(env);

      const stop = time + 3;
      osc.start(time); osc2.start(time); osc3.start(time);
      osc.stop(stop);  osc2.stop(stop);  osc3.stop(stop);
    });
  }

  getCurrentTheme(): MusicTheme { return this.currentTheme; }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.bgmGain) return;
    this.bgmGain.gain.setTargetAtTime(muted ? 0 : 0.4, this.ctx.currentTime, 0.3);
  }

  playSfx(freq: number, type: OscillatorType = 'square', dur = 0.12, vol = 0.15) {
    if (!this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  stop() {
    if (this.schedulerTimer) { clearTimeout(this.schedulerTimer); this.schedulerTimer = null; }
  }
}

export const musicEngine = new MusicEngine();