import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-converter';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';

export type GestureType = 'fist' | 'index' | 'open' | 'peace' | 'pinch' | 'none';
export type GestureDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface GestureState {
  type: GestureType;
  direction: GestureDirection;
  confidence: number;
  rawX?: number;
  rawY?: number;
  velX?: number;
  velY?: number;
  blastFired?: boolean;
  fistDX?: number;
  fistDY?: number;
}

type GestureCallback = (g: GestureState) => void;

const VW = 320;
const VH = 240;

// ── Loading Overlay — pure DOM, lives entirely inside this file ───────────────

let _overlayEl:        HTMLDivElement | null = null;
let _overlayHideTimer: ReturnType<typeof setTimeout> | null = null;

function _getOverlay(): HTMLDivElement {
  if (!_overlayEl) {
    _overlayEl = document.createElement('div');
    _overlayEl.id = '__gesture_loading_overlay__';
    _overlayEl.style.cssText =
      'position:fixed;inset:0;z-index:99999;pointer-events:none;display:none;';
    document.body.appendChild(_overlayEl);
  }
  return _overlayEl;
}

function _renderOverlay(progress: number, message: string, visible: boolean) {
  const el = _getOverlay();

  if (!visible) {
    el.style.display    = 'none';
    el.style.pointerEvents = 'none';
    return;
  }

  el.style.display    = 'block';
  el.style.pointerEvents = 'all';

  const isError = progress === 0 && message.length > 0;
  const isDone  = progress === 100;
  const color   = isError ? '#FF006E' : isDone ? '#06FFA5' : '#00d4ff';

  const steps: [number, string][] = [
    [5,   'Camera'],
    [20,  'TensorFlow WebGL'],
    [35,  'Video stream'],
    [50,  'Downloading model'],
    [85,  'Warming up'],
    [100, 'Ready'],
  ];

  const stepsHtml = (!isError && progress < 100)
    ? steps.map(([pct, label]) => {
        const done = progress >= pct;
        return `<div style="color:${done ? 'rgba(6,255,165,0.7)' : 'rgba(255,255,255,0.2)'};font-family:'JetBrains Mono',monospace;font-size:0.58rem;text-align:center;margin-bottom:3px;">${done ? '✓' : '○'} ${label}</div>`;
      }).join('')
    : '';

  const shimmer = (!isError && progress < 100)
    ? `<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);animation:__glo_shimmer 1.2s linear infinite;overflow:hidden;"></div>`
    : '';

  el.innerHTML = `
    <style>@keyframes __glo_shimmer{from{transform:translateX(-100%)}to{transform:translateX(200%)}}</style>
    <div style="position:fixed;inset:0;background:rgba(5,5,20,0.95);backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;">
      <div style="font-size:2.8rem;line-height:1;">${isError ? '❌' : isDone ? '✅' : '🖐'}</div>
      <div style="font-family:'Press Start 2P',cursive;font-size:clamp(0.48rem,1.2vw,0.82rem);color:${color};text-shadow:0 0 16px ${color};letter-spacing:3px;text-align:center;">
        ${isError ? 'GESTURE ENGINE ERROR' : isDone ? 'GESTURE READY' : 'LOADING GESTURE ENGINE'}
      </div>
      <div style="width:clamp(260px,40vw,480px);height:10px;background:rgba(255,255,255,0.07);border:1px solid ${color}44;border-radius:5px;overflow:hidden;position:relative;">
        <div style="height:100%;width:${isError ? 100 : progress}%;background:${isError ? 'linear-gradient(90deg,#FF006E,#cc0055)' : isDone ? 'linear-gradient(90deg,#06FFA5,#00cc88)' : 'linear-gradient(90deg,#00d4ff,#8338EC)'};border-radius:5px;transition:width 0.35s ease;box-shadow:0 0 12px ${color}88;position:relative;"></div>
        ${shimmer}
      </div>
      ${!isError ? `<div style="font-family:'JetBrains Mono',monospace;font-size:clamp(0.7rem,1.5vw,1rem);color:${color};letter-spacing:2px;">${progress}%</div>` : ''}
      <div style="font-family:'JetBrains Mono',monospace;font-size:clamp(0.55rem,1vw,0.76rem);color:rgba(180,210,255,0.75);text-align:center;max-width:400px;line-height:1.6;">${message}</div>
      <div>${stepsHtml}</div>
    </div>
  `;
}

function _updateOverlay(progress: number, message: string) {
  if (_overlayHideTimer) { clearTimeout(_overlayHideTimer); _overlayHideTimer = null; }

  if (progress > 0 && progress < 100) {
    _renderOverlay(progress, message, true);
  } else if (progress === 100) {
    _renderOverlay(100, message, true);
    _overlayHideTimer = setTimeout(() => _renderOverlay(0, '', false), 900);
  } else {
    // error
    _renderOverlay(0, message, true);
    _overlayHideTimer = setTimeout(() => _renderOverlay(0, '', false), 2500);
  }
}

// ── GestureController ─────────────────────────────────────────────────────────

class GestureController {
  private initialized  = false;
  private running      = false;
  private subscribers: Set<GestureCallback> = new Set();
  private videoEl: HTMLVideoElement | null = null;
  private stream:   MediaStream | null = null;
  private detector: handPoseDetection.HandDetector | null = null;
  private loopHandle: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;

  // Position smoothing
  private smoothX = 0.5;
  private smoothY = 0.5;
  private readonly POS_ALPHA = 0.25;
  private prevSmX = 0.5;
  private prevSmY = 0.5;
  private smoothVX = 0;
  private smoothVY = 0;
  private readonly VEL_ALPHA = 0.35;

  // Blast
  private blastFist0 = 0;
  private blastArmed = false;
  private readonly BLAST_WINDOW_MS   = 2500;
  private readonly BLAST_FIST_MIN_MS = 100;

  // Peace edge-triggered
  private lastPeaceEmitted   = false;
  private peaceCooldownUntil = 0;
  private readonly PEACE_COOLDOWN_MS = 800;

  // Pinch edge-triggered
  private lastPinchEmitted   = false;
  private pinchCooldownUntil = 0;
  private readonly PINCH_COOLDOWN_MS = 600;
  private readonly PINCH_THRESHOLD   = 0.10;

  // Open edge-triggered
  private lastOpenEmitted   = false;
  private openCooldownUntil = 0;
  private readonly OPEN_COOLDOWN_MS = 700;

  // Fist edge-triggered
  private lastFistEmitted   = false;
  private fistCooldownUntil = 0;
  private readonly FIST_EDGE_COOLDOWN_MS = 700;

  // Fist drag
  private fistPrevRawX = 0;
  private fistPrevRawY = 0;
  private fistDragging = false;

  // Distance-based fist (works all angles)
  private readonly FIST_DIST_RATIO = 0.55;

  // Swipe (index — kept for legacy use)
  private xHistory: { x: number; t: number }[] = [];
  private swipeCooldownUntil = 0;
  private readonly SWIPE_WINDOW_MS   = 400;
  private readonly SWIPE_THRESHOLD   = 0.12;
  private readonly SWIPE_COOLDOWN_MS = 600;

  private readonly LOOP_MS = 40;

  get isRunning() { return this.running; }

  async init(): Promise<boolean> {
    if (this.initialized && this.running) return true;
    try {
      _updateOverlay(5, 'Requesting camera access…');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VW, height: VH, facingMode: 'user' },
        });
      } catch (e) {
        console.error('[Gesture] Camera denied:', e);
        _updateOverlay(0, 'Camera access denied');
        return false;
      }

      _updateOverlay(20, 'Initialising TensorFlow WebGL backend…');
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('[Gesture] TF backend:', tf.getBackend());

      _updateOverlay(35, 'Setting up video stream…');
      this.videoEl = document.createElement('video');
      this.videoEl.srcObject = this.stream;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.videoEl.width  = VW;
      this.videoEl.height = VH;
      this.videoEl.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;' +
        'opacity:0;pointer-events:none;z-index:-9999;';
      document.body.appendChild(this.videoEl);
      await this.videoEl.play();

      _updateOverlay(50, 'Downloading MediaPipe Hands model…');
      this.detector = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        { runtime: 'tfjs', modelType: 'lite', maxHands: 1 }
      );

      _updateOverlay(85, 'Warming up inference engine…');
      try {
        await this.detector.estimateHands(this.videoEl, { flipHorizontal: false });
      } catch (_) {}

      _updateOverlay(100, 'Gesture engine ready!');
      this.initialized = true;
      this.running     = true;
      this.scheduleLoop();
      console.log('[Gesture] ready ✓');
      return true;
    } catch (err) {
      console.error('[Gesture] init error:', err);
      _updateOverlay(0, 'Failed to initialise gesture engine');
      this.cleanup();
      return false;
    }
  }

  private scheduleLoop() {
    if (!this.running) return;
    this.loopHandle = setTimeout(() => this.runFrame(), this.LOOP_MS);
  }

  private async runFrame() {
    if (!this.running || !this.detector || !this.videoEl) return;
    if (this.isProcessing)           { this.scheduleLoop(); return; }
    if (this.videoEl.readyState < 2) { this.scheduleLoop(); return; }
    this.isProcessing = true;
    try {
      const hands = await this.detector.estimateHands(this.videoEl, { flipHorizontal: false });
      this.processHands(hands);
    } catch (_) {}
    finally {
      this.isProcessing = false;
      this.scheduleLoop();
    }
  }

  private processHands(hands: handPoseDetection.Hand[]) {
    if (!hands.length) {
      this.xHistory         = [];
      this.smoothVX         = 0;
      this.smoothVY         = 0;
      this.blastArmed       = false;
      this.blastFist0       = 0;
      this.lastPeaceEmitted = false;
      this.lastPinchEmitted = false;
      this.lastOpenEmitted  = false;
      this.lastFistEmitted  = false;
      if (this.fistDragging) this.fistDragging = false;
      this.emit({ type: 'none', direction: 'none', confidence: 0 });
      return;
    }

    const kp = hands[0].keypoints;
    if (!kp || kp.length < 21) {
      this.emit({ type: 'none', direction: 'none', confidence: 0 });
      return;
    }

    const nx = (i: number) => kp[i].x / VW;
    const ny = (i: number) => kp[i].y / VH;

    const iTipX = nx(8);  const iTipY = ny(8);  const iPipY = ny(6);
    const tTipX = nx(4);  const tTipY = ny(4);
    const mTipY = ny(12); const mPipY = ny(10);
    const rTipY = ny(16); const rPipY = ny(14);
    const pTipY = ny(20); const pPipY = ny(18);
    const wristX = nx(0); const wristY = ny(0);

    // Palm size = wrist to middle-finger MCP
    const palmSize = Math.sqrt((nx(9) - wristX) ** 2 + (ny(9) - wristY) ** 2);
    const distToWrist = (i: number) =>
      Math.sqrt((nx(i) - wristX) ** 2 + (ny(i) - wristY) ** 2);

    const threshold  = palmSize * this.FIST_DIST_RATIO;
    const isDistFist = distToWrist(8)  < threshold &&
                       distToWrist(12) < threshold &&
                       distToWrist(16) < threshold &&
                       distToWrist(20) < threshold;

    const E  = 0.04;
    const iU = iTipY < iPipY - E;
    const mU = mTipY < mPipY - E;
    const rU = rTipY < rPipY - E;
    const pU = pTipY < pPipY - E;

    const pinchDist  = Math.sqrt((iTipX - tTipX) ** 2 + (iTipY - tTipY) ** 2);
    const isPinching = pinchDist < this.PINCH_THRESHOLD && !mU && !rU && !pU && !isDistFist;

    const rawX  = 1 - iTipX;
    const rawY  = iTipY;
    const score = hands[0].score ?? 0.85;

    this.emit(this.classify(iU, mU, rU, pU, isPinching, isDistFist, rawX, rawY, wristX, wristY, score));
  }

  private classify(
    iU: boolean, mU: boolean, rU: boolean, pU: boolean,
    isPinching: boolean, isDistFist: boolean,
    rawX: number, rawY: number,
    wristX: number, wristY: number,
    score: number
  ): GestureState {
    const now = Date.now();

    // PEACE
    if (iU && mU && !rU && !pU && !isDistFist) {
      this.blastArmed = false; this.blastFist0 = 0;
      this.fistDragging = false; this.xHistory = [];
      this.smoothVX = 0; this.smoothVY = 0;
      this.lastFistEmitted = false; this.lastOpenEmitted = false;
      if (!this.lastPeaceEmitted && now > this.peaceCooldownUntil) {
        this.lastPeaceEmitted   = true;
        this.peaceCooldownUntil = now + this.PEACE_COOLDOWN_MS;
        return { type: 'peace', direction: 'none', confidence: score, rawX, rawY };
      }
      return { type: 'none', direction: 'none', confidence: 0, rawX, rawY };
    }
    this.lastPeaceEmitted = false;

    // PINCH
    if (isPinching) {
      this.blastArmed = false; this.blastFist0 = 0;
      this.fistDragging = false; this.xHistory = [];
      this.smoothVX = 0; this.smoothVY = 0;
      this.lastFistEmitted = false; this.lastOpenEmitted = false;
      if (!this.lastPinchEmitted && now > this.pinchCooldownUntil) {
        this.lastPinchEmitted   = true;
        this.pinchCooldownUntil = now + this.PINCH_COOLDOWN_MS;
        return { type: 'pinch', direction: 'none', confidence: score, rawX, rawY };
      }
      return { type: 'none', direction: 'none', confidence: 0, rawX, rawY };
    }
    this.lastPinchEmitted = false;

    // FIST — distance-based, all angles
    if (isDistFist) {
      if (!this.blastArmed) { this.blastFist0 = now; this.blastArmed = true; }
      this.xHistory = []; this.smoothVX = 0; this.smoothVY = 0;
      this.lastOpenEmitted = false;

      let fistDX = 0, fistDY = 0;
      if (!this.fistDragging) {
        this.fistDragging = true;
        this.fistPrevRawX = wristX;
        this.fistPrevRawY = wristY;
      } else {
        fistDX = wristX - this.fistPrevRawX;
        fistDY = wristY - this.fistPrevRawY;
        this.fistPrevRawX = wristX;
        this.fistPrevRawY = wristY;
      }

      if (!this.lastFistEmitted && now > this.fistCooldownUntil) {
        this.lastFistEmitted   = true;
        this.fistCooldownUntil = now + this.FIST_EDGE_COOLDOWN_MS;
      }

      return { type: 'fist', direction: 'none', confidence: score, rawX, rawY, fistDX, fistDY };
    }
    if (this.fistDragging) this.fistDragging = false;
    this.lastFistEmitted = false;

    // OPEN PALM
    if (iU && mU && rU && pU) {
      let blastFired = false;
      if (
        this.blastArmed &&
        now - this.blastFist0 >= this.BLAST_FIST_MIN_MS &&
        now - this.blastFist0 <  this.BLAST_WINDOW_MS
      ) {
        blastFired = true; this.blastArmed = false; this.blastFist0 = 0;
      } else {
        this.blastArmed = false; this.blastFist0 = 0;
      }
      this.xHistory = []; this.smoothVX = 0; this.smoothVY = 0;
      this.lastFistEmitted = false;

      if (!this.lastOpenEmitted && now > this.openCooldownUntil) {
        this.lastOpenEmitted   = true;
        this.openCooldownUntil = now + this.OPEN_COOLDOWN_MS;
      }

      return { type: 'open', direction: 'none', confidence: score, rawX, rawY, blastFired };
    }
    this.lastOpenEmitted = false;

    // INDEX only
    if (iU && !mU && !rU && !pU) {
      this.blastArmed = false; this.blastFist0 = 0;
      this.lastFistEmitted = false; this.lastOpenEmitted = false;

      this.smoothX += (rawX - this.smoothX) * this.POS_ALPHA;
      this.smoothY += (rawY - this.smoothY) * this.POS_ALPHA;
      const frameVX = this.smoothX - this.prevSmX;
      const frameVY = this.smoothY - this.prevSmY;
      this.smoothVX += (frameVX - this.smoothVX) * this.VEL_ALPHA;
      this.smoothVY += (frameVY - this.smoothVY) * this.VEL_ALPHA;
      this.prevSmX = this.smoothX;
      this.prevSmY = this.smoothY;

      this.xHistory.push({ x: rawX, t: Date.now() });
      this.xHistory = this.xHistory.filter(h => h.t >= Date.now() - this.SWIPE_WINDOW_MS);

      let dir: GestureDirection = 'none';
      if (Date.now() > this.swipeCooldownUntil && this.xHistory.length >= 5) {
        const delta = this.xHistory[this.xHistory.length - 1].x - this.xHistory[0].x;
        if (Math.abs(delta) >= this.SWIPE_THRESHOLD) {
          dir = delta > 0 ? 'right' : 'left';
          this.xHistory = [];
          this.swipeCooldownUntil = Date.now() + this.SWIPE_COOLDOWN_MS;
        }
      }

      return {
        type: 'index', direction: dir, confidence: score,
        rawX: this.smoothX, rawY: this.smoothY,
        velX: this.smoothVX, velY: this.smoothVY,
      };
    }

    // Unrecognised
    this.blastArmed = false; this.blastFist0 = 0;
    this.xHistory = []; this.smoothVX = 0; this.smoothVY = 0;
    this.lastFistEmitted = false; this.lastOpenEmitted = false;
    return { type: 'none', direction: 'none', confidence: 0, rawX, rawY };
  }

  subscribe(cb: GestureCallback)   { this.subscribers.add(cb); }
  unsubscribe(cb: GestureCallback) { this.subscribers.delete(cb); }
  private emit(g: GestureState)    { this.subscribers.forEach(cb => cb(g)); }

  private cleanup() {
    if (this.loopHandle) { clearTimeout(this.loopHandle); this.loopHandle = null; }
    if (this.stream)     { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.videoEl)    { this.videoEl.remove(); this.videoEl = null; }
    this.isProcessing = false;
  }

  stop() {
    this.running     = false;
    this.initialized = false;
    this.cleanup();
    if (this.detector) {
      try { this.detector.dispose(); } catch (_) {}
      this.detector = null;
    }
    this.xHistory           = [];
    this.smoothX            = 0.5; this.smoothY = 0.5;
    this.prevSmX            = 0.5; this.prevSmY = 0.5;
    this.smoothVX           = 0;   this.smoothVY = 0;
    this.blastArmed         = false; this.blastFist0 = 0;
    this.lastPeaceEmitted   = false; this.lastPinchEmitted = false;
    this.lastOpenEmitted    = false; this.lastFistEmitted  = false;
    this.peaceCooldownUntil = 0; this.pinchCooldownUntil = 0;
    this.openCooldownUntil  = 0; this.fistCooldownUntil  = 0;
    this.swipeCooldownUntil = 0;
    this.fistDragging       = false;
    this.fistPrevRawX       = 0; this.fistPrevRawY = 0;
    console.log('[Gesture] stopped + reset');
  }
}

export const gestureController = new GestureController();