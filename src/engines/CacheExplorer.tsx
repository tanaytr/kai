import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, HelpCircle, X, Play, Square, RotateCcw, Zap, Activity, Trophy, Target, BookOpen, Gamepad2, Layers, Grid } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface CacheExplorerProps { onBack: () => void; }

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 14, style = {} }: { color: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: color, flexShrink: 0,
      boxShadow: `inset -${Math.max(2, size / 6)}px -${Math.max(2, size / 6)}px 0 rgba(0,0,0,0.5), inset ${Math.max(2, size / 6)}px ${Math.max(2, size / 6)}px 0 rgba(255,255,255,0.3), 0 0 ${size / 2}px ${color}55`,
      border: '1px solid rgba(0,0,0,0.3)', ...style,
    }} />
  );
}

function TetrisRow({ count = 30, reversed = false }: { count?: number; reversed?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '5px 10px', justifyContent: reversed ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <TetrisBlock key={i} color={COLORS[i % 5]} size={14} style={{ opacity: 0.25 + (i % 3) * 0.15 }} />
      ))}
    </div>
  );
}

type CacheType = 'direct' | 'set2' | 'fully';
type Policy = 'LRU' | 'FIFO' | 'Random';
type ViewMode = 'interactive' | 'diagram' | 'hybrid';
type InteractiveTab = 'manual' | 'quiz' | 'challenge';

interface CacheLine { tag: number | null; valid: boolean; data: number; lastUsed: number; insertOrder: number; age: number; }
interface AccessResult { type: 'HIT' | 'MISS'; address: number; index: number; tag: number; offset: number; evicted?: number; setIndex?: number; wayIndex?: number; }

const NUM_SETS_DIRECT = 8;
const NUM_SETS_2WAY = 4;
const CACHE_SIZE_FULLY = 4;

function formatAddr(addr: number) { return `0x${addr.toString(16).toUpperCase().padStart(3, '0')}`; }

// Predefined challenge sequences
const CHALLENGES = [
  {
    name: 'THRASH TEST',
    description: 'Direct-mapped conflict: addresses 0x00 and 0x08 keep evicting each other!',
    sequence: [0x00, 0x08, 0x00, 0x08, 0x00, 0x08, 0x04, 0x0C],
    cacheType: 'direct' as CacheType,
    policy: 'LRU' as Policy,
    targetHitRate: 25,
    tip: 'Notice 0x00 and 0x08 both map to set 0 — they thrash each other.',
  },
  {
    name: 'LOCALITY WIN',
    description: 'Temporal locality: repeat accesses hit the cache!',
    sequence: [0x01, 0x02, 0x03, 0x01, 0x02, 0x03, 0x01, 0x02],
    cacheType: 'fully' as CacheType,
    policy: 'LRU' as Policy,
    targetHitRate: 60,
    tip: 'After the first 3 misses, the cache is warm — next accesses all hit!',
  },
  {
    name: 'LRU VS FIFO',
    description: 'See how replacement policy changes results on same access pattern.',
    sequence: [0x00, 0x01, 0x02, 0x03, 0x00, 0x01, 0x04, 0x00],
    cacheType: 'fully' as CacheType,
    policy: 'LRU' as Policy,
    targetHitRate: 30,
    tip: 'LRU keeps the most recently used lines — 0x00 and 0x01 get hits on the second pass.',
  },
  {
    name: '2-WAY RESCUE',
    description: 'Same conflicting addresses — but 2-way set associativity saves the day.',
    sequence: [0x00, 0x04, 0x00, 0x04, 0x00, 0x04, 0x08, 0x00],
    cacheType: 'set2' as CacheType,
    policy: 'LRU' as Policy,
    targetHitRate: 50,
    tip: '2-way gives each set two slots — 0x00 and 0x04 both fit in set 0 simultaneously.',
  },
];

export default function CacheExplorer({ onBack }: CacheExplorerProps) {
  const [cacheType, setCacheType] = useState<CacheType>('direct');
  const [policy, setPolicy] = useState<Policy>('LRU');
  const [viewMode, setViewMode] = useState<ViewMode>('interactive');
  const [interactiveTab, setInteractiveTab] = useState<InteractiveTab>('manual');
  const [showHelp, setShowHelp] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [accessLog, setAccessLog] = useState<AccessResult[]>([]);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [lastResult, setLastResult] = useState<AccessResult | null>(null);
  const [animFlash, setAnimFlash] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  
  // Diagram-specific state
  const [currentAddress, setCurrentAddress] = useState<number | null>(null);
  const [animatingPath, setAnimatingPath] = useState(false);
  const [highlightedCacheLine, setHighlightedCacheLine] = useState<number | null>(null);
  const [highlightedMemBlock, setHighlightedMemBlock] = useState<number | null>(null);
  
  // Auto demo
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoSequence, setAutoSequence] = useState<number[]>([]);
  const [autoStep, setAutoStep] = useState(0);
  const autoIntervalRef = useRef<number | null>(null);

  // Challenge state
  const [activeChallengeIdx, setActiveChallengeIdx] = useState<number | null>(null);
  const [challengeStep, setChallengeStep] = useState(0);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [challengeScore, setChallengeScore] = useState(0);

  // Quiz state
  const [quizAddr, setQuizAddr] = useState<number | null>(null);
  const [quizPrediction, setQuizPrediction] = useState<'HIT' | 'MISS' | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);

  const tickRef = useRef(0);
  const insertRef = useRef(0);

  // Cache states
  const [directCache, setDirectCache] = useState<CacheLine[]>(
    Array.from({ length: NUM_SETS_DIRECT }, () => ({ tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 }))
  );
  const [twoWayCache, setTwoWayCache] = useState<CacheLine[][]>(
    Array.from({ length: NUM_SETS_2WAY }, () => [
      { tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 },
      { tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 },
    ])
  );
  const [fullyCache, setFullyCache] = useState<CacheLine[]>(
    Array.from({ length: CACHE_SIZE_FULLY }, () => ({ tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 }))
  );

  useEffect(() => {
    const t = setInterval(() => setColorIndex(c => (c + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const threshold = level * 100;
    if (xp >= threshold) {
      setLevel(l => l + 1);
      musicEngine.playSfx(1400, 'sine', 0.2);
    }
  }, [xp, level]);

  const resetCache = useCallback(() => {
    setDirectCache(Array.from({ length: NUM_SETS_DIRECT }, () => ({ tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 })));
    setTwoWayCache(Array.from({ length: NUM_SETS_2WAY }, () => [
      { tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 },
      { tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 },
    ]));
    setFullyCache(Array.from({ length: CACHE_SIZE_FULLY }, () => ({ tag: null, valid: false, data: 0, lastUsed: 0, insertOrder: 0, age: 0 })));
    setAccessLog([]);
    setLastResult(null);
    setCurrentAddress(null);
    setHighlightedCacheLine(null);
    setHighlightedMemBlock(null);
    tickRef.current = 0;
    insertRef.current = 0;
    musicEngine.playSfx(300);
  }, []);

  const fullReset = useCallback(() => {
    resetCache();
    setScore(0);
    setHits(0);
    setMisses(0);
    setStreak(0);
    setBestStreak(0);
    setActiveChallengeIdx(null);
    setChallengeStep(0);
    setChallengeComplete(false);
    setChallengeScore(0);
    setQuizAddr(null);
    setQuizPrediction(null);
    setQuizRevealed(false);
  }, [resetCache]);

  const parseAddress = useCallback((addr: number): { tag: number; index: number; offset: number } => {
    const offset = addr & 0x03;
    
    if (cacheType === 'direct') {
      const indexBits = Math.log2(NUM_SETS_DIRECT);
      const index = (addr >> 2) & ((1 << indexBits) - 1);
      const tag = addr >> (2 + indexBits);
      return { tag, index, offset };
    } else if (cacheType === 'set2') {
      const indexBits = Math.log2(NUM_SETS_2WAY);
      const index = (addr >> 2) & ((1 << indexBits) - 1);
      const tag = addr >> (2 + indexBits);
      return { tag, index, offset };
    } else {
      const tag = addr >> 2;
      return { tag, index: 0, offset };
    }
  }, [cacheType]);

  const evictWay = useCallback((ways: CacheLine[]): number => {
    if (policy === 'LRU') return ways[0].lastUsed <= ways[1].lastUsed ? 0 : 1;
    if (policy === 'FIFO') return ways[0].insertOrder <= ways[1].insertOrder ? 0 : 1;
    return Math.random() < 0.5 ? 0 : 1;
  }, [policy]);

  const accessDirect = useCallback((addr: number): AccessResult => {
    const { tag, index, offset } = parseAddress(addr);
    tickRef.current++;
    const line = directCache[index];
    const isHit = line.valid && line.tag === tag;
    const result: AccessResult = { 
      type: isHit ? 'HIT' : 'MISS', 
      address: addr, 
      index, 
      tag, 
      offset,
      evicted: (!isHit && line.valid) ? line.tag! : undefined 
    };
    
    if (!isHit) {
      insertRef.current++;
      setDirectCache(prev => {
        const next = [...prev];
        next[index] = { tag, valid: true, data: addr * 7 % 256, lastUsed: tickRef.current, insertOrder: insertRef.current, age: tickRef.current };
        return next;
      });
    } else {
      setDirectCache(prev => {
        const next = [...prev];
        next[index] = { ...next[index], lastUsed: tickRef.current, age: tickRef.current };
        return next;
      });
    }
    return result;
  }, [directCache, parseAddress]);

  const access2Way = useCallback((addr: number): AccessResult => {
    const { tag, index, offset } = parseAddress(addr);
    tickRef.current++;
    const set = twoWayCache[index];
    const hitWay = set.findIndex(w => w.valid && w.tag === tag);
    const isHit = hitWay >= 0;
    let evicted: number | undefined;
    
    if (isHit) {
      setTwoWayCache(prev => {
        const next = prev.map(s => [...s]);
        next[index][hitWay] = { ...next[index][hitWay], lastUsed: tickRef.current, age: tickRef.current };
        return next;
      });
    } else {
      insertRef.current++;
      const emptyWay = set.findIndex(w => !w.valid);
      const replaceWay = emptyWay >= 0 ? emptyWay : evictWay(set);
      if (set[replaceWay].valid) evicted = set[replaceWay].tag!;
      setTwoWayCache(prev => {
        const next = prev.map(s => [...s]);
        next[index][replaceWay] = { tag, valid: true, data: addr * 7 % 256, lastUsed: tickRef.current, insertOrder: insertRef.current, age: tickRef.current };
        return next;
      });
    }
    return { type: isHit ? 'HIT' : 'MISS', address: addr, index, tag, offset, evicted, setIndex: index, wayIndex: hitWay >= 0 ? hitWay : undefined };
  }, [twoWayCache, evictWay, parseAddress]);

  const accessFully = useCallback((addr: number): AccessResult => {
    const { tag, offset } = parseAddress(addr);
    tickRef.current++;
    const hitIdx = fullyCache.findIndex(l => l.valid && l.tag === tag);
    const isHit = hitIdx >= 0;
    let evicted: number | undefined;
    
    if (isHit) {
      setFullyCache(prev => {
        const next = [...prev];
        next[hitIdx] = { ...next[hitIdx], lastUsed: tickRef.current, age: tickRef.current };
        return next;
      });
    } else {
      insertRef.current++;
      const emptyIdx = fullyCache.findIndex(l => !l.valid);
      let replaceIdx = emptyIdx;
      if (replaceIdx < 0) {
        if (policy === 'LRU') replaceIdx = fullyCache.reduce((mi, l, i, a) => l.lastUsed < a[mi].lastUsed ? i : mi, 0);
        else if (policy === 'FIFO') replaceIdx = fullyCache.reduce((mi, l, i, a) => l.insertOrder < a[mi].insertOrder ? i : mi, 0);
        else replaceIdx = Math.floor(Math.random() * CACHE_SIZE_FULLY);
      }
      if (fullyCache[replaceIdx]?.valid) evicted = fullyCache[replaceIdx].tag!;
      setFullyCache(prev => {
        const next = [...prev];
        next[replaceIdx] = { tag, valid: true, data: addr * 7 % 256, lastUsed: tickRef.current, insertOrder: insertRef.current, age: tickRef.current };
        return next;
      });
    }
    return { type: isHit ? 'HIT' : 'MISS', address: addr, index: 0, tag, offset, evicted, wayIndex: hitIdx >= 0 ? hitIdx : undefined };
  }, [fullyCache, policy, parseAddress]);

  const doAccess = useCallback((addr: number): AccessResult => {
    if (cacheType === 'direct') return accessDirect(addr);
    if (cacheType === 'set2') return access2Way(addr);
    return accessFully(addr);
  }, [cacheType, accessDirect, access2Way, accessFully]);

  const applyResult = useCallback((result: AccessResult, bonusPoints = 0) => {
    setLastResult(result);
    setAnimFlash(result.type === 'HIT' ? 1 : 2);
    setTimeout(() => setAnimFlash(null), 600);

    if (result.type === 'HIT') {
      setHits(h => h + 1);
      setStreak(s => {
        const newStreak = s + 1;
        setBestStreak(b => Math.max(b, newStreak));
        const bonus = newStreak >= 3 ? newStreak * 2 : 0;
        setScore(sc => sc + 10 + bonus + bonusPoints);
        setXp(x => x + 5 + bonus);
        return newStreak;
      });
      musicEngine.playSfx(1000, 'sine', 0.15);
    } else {
      setMisses(m => m + 1);
      setStreak(0);
      setScore(sc => Math.max(0, sc - 2 + bonusPoints));
      setXp(x => x + 1);
      musicEngine.playSfx(250, 'square', 0.12);
    }
    setAccessLog(prev => [result, ...prev.slice(0, 29)]);
  }, []);

  const handleAccess = useCallback((addr?: number) => {
    const raw = addr ?? parseInt(addressInput, 16);
    if (isNaN(raw) || raw < 0 || raw > 0xFFF) {
      musicEngine.playSfx(200);
      return;
    }
    
    // For diagram view
    setCurrentAddress(raw);
    setAnimatingPath(true);
    setHighlightedMemBlock(raw >> 2);
    
    const result = doAccess(raw);
    setHighlightedCacheLine(result.wayIndex !== undefined ? result.wayIndex : result.index);
    
    applyResult(result);
    setAddressInput('');
    
    setTimeout(() => {
      setAnimatingPath(false);
      setHighlightedMemBlock(null);
    }, 1000);
  }, [addressInput, doAccess, applyResult]);

  const startAutoDemo = useCallback((sequence: number[]) => {
    setAutoSequence(sequence);
    setAutoStep(0);
    setIsAutoRunning(true);
    resetCache();
    
    let step = 0;
    autoIntervalRef.current = window.setInterval(() => {
      if (step >= sequence.length) {
        setIsAutoRunning(false);
        if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
        musicEngine.playSfx(1200, 'sine', 0.2);
        return;
      }
      
      handleAccess(sequence[step]);
      setAutoStep(step + 1);
      step++;
    }, 1500);
  }, [resetCache, handleAccess]);

  const stopAutoDemo = useCallback(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    setIsAutoRunning(false);
    musicEngine.playSfx(600);
  }, []);

  const startChallenge = useCallback((idx: number) => {
    const ch = CHALLENGES[idx];
    setCacheType(ch.cacheType);
    setPolicy(ch.policy);
    resetCache();
    setActiveChallengeIdx(idx);
    setChallengeStep(0);
    setChallengeComplete(false);
    setChallengeScore(0);
    musicEngine.playSfx(700);
  }, [resetCache]);

  const stepChallenge = useCallback(() => {
    if (activeChallengeIdx === null) return;
    const ch = CHALLENGES[activeChallengeIdx];
    if (challengeStep >= ch.sequence.length) return;

    const addr = ch.sequence[challengeStep];
    handleAccess(addr);
    setChallengeScore(s => s + (lastResult?.type === 'HIT' ? 20 : 0));
    setChallengeStep(s => {
      const next = s + 1;
      if (next >= ch.sequence.length) {
        setChallengeComplete(true);
        musicEngine.playSfx(1200, 'sine', 0.2);
      }
      return next;
    });
  }, [activeChallengeIdx, challengeStep, handleAccess, lastResult]);

  const generateQuiz = useCallback(() => {
    const addr = Math.floor(Math.random() * 0x20);
    setQuizAddr(addr);
    setQuizPrediction(null);
    setQuizRevealed(false);
    musicEngine.playSfx(600);
  }, []);

  const submitPrediction = useCallback((pred: 'HIT' | 'MISS') => {
    if (quizAddr === null) return;
    setQuizPrediction(pred);
    handleAccess(quizAddr);
    setQuizRevealed(true);
    const correct = pred === lastResult?.type;
    if (correct) {
      setScore(s => s + 25);
      musicEngine.playSfx(1200, 'sine', 0.2);
    } else {
      setScore(s => Math.max(0, s - 10));
      musicEngine.playSfx(180, 'square', 0.15);
    }
  }, [quizAddr, handleAccess, lastResult]);

  useEffect(() => {
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : '0.0';
  const xpForNextLevel = level * 100;
  const xpProgress = (xp % xpForNextLevel) / xpForNextLevel * 100;

  // Render cache state (Interactive view)
  const renderCacheState = () => {
    if (cacheType === 'direct') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {directCache.map((line, i) => {
            const isActive = lastResult?.index === i;
            const isHit = isActive && lastResult?.type === 'HIT';
            const isMiss = isActive && lastResult?.type === 'MISS';
            return (
              <div key={i} style={{
                background: isHit ? 'rgba(6,255,165,0.2)' : isMiss ? 'rgba(255,0,110,0.2)' : line.valid ? 'rgba(131,56,236,0.12)' : 'rgba(0,0,0,0.4)',
                border: `2px solid ${isHit ? '#06FFA5' : isMiss ? '#FF006E' : line.valid ? '#8338EC88' : '#1a1a2e'}`,
                padding: '8px 10px',
                transition: 'all 0.25s',
                boxShadow: isHit ? '0 0 12px #06FFA544' : isMiss ? '0 0 12px #FF006E44' : 'none',
              }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#444', fontSize: '0.38rem', marginBottom: 4 }}>SET {i}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: line.valid ? '#e0e0f0' : '#333', fontSize: '0.68rem', fontWeight: 'bold' }}>
                  {line.valid ? formatAddr(line.tag ?? 0) : '---'}
                </div>
                {line.valid && (
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.3rem', marginTop: 3 }}>
                    T:{line.lastUsed}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (cacheType === 'set2') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {twoWayCache.map((set, si) => (
            <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#555', fontSize: '0.38rem', width: 38, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                SET {si}
              </div>
              {set.map((way, wi) => {
                const isActive = lastResult?.index === si;
                const isHit = isActive && lastResult?.type === 'HIT';
                const isMiss = isActive && lastResult?.type === 'MISS';
                return (
                  <div key={wi} style={{
                    flex: 1,
                    background: isHit ? 'rgba(6,255,165,0.2)' : isMiss ? 'rgba(255,0,110,0.2)' : way.valid ? 'rgba(131,56,236,0.12)' : 'rgba(0,0,0,0.4)',
                    border: `2px solid ${isHit ? '#06FFA5' : isMiss ? '#FF006E' : way.valid ? '#8338EC88' : '#1a1a2e'}`,
                    padding: '8px 10px',
                    transition: 'all 0.25s',
                  }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#444', fontSize: '0.33rem', marginBottom: 3 }}>WAY {wi}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: way.valid ? '#e0e0f0' : '#333', fontSize: '0.68rem', fontWeight: 'bold' }}>
                      {way.valid ? formatAddr(way.tag ?? 0) : '---'}
                    </div>
                    {way.valid && (
                      <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.3rem', marginTop: 3 }}>T:{way.lastUsed}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {fullyCache.map((line, i) => {
          const isLRU = policy === 'LRU' && fullyCache.every(l => l.valid) && line.lastUsed === Math.min(...fullyCache.map(l => l.lastUsed));
          return (
            <div key={i} style={{
              background: line.valid ? 'rgba(0,212,255,0.1)' : 'rgba(0,0,0,0.4)',
              border: `2px solid ${line.valid ? '#00d4ff88' : '#1a1a2e'}`,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.25s',
            }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#444', fontSize: '0.38rem' }}>LINE {i}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: line.valid ? '#e0e0f0' : '#333', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {line.valid ? formatAddr(line.tag!) : '— EMPTY —'}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {line.valid && <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.32rem' }}>T:{line.lastUsed}</div>}
                {isLRU && <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FF006E', fontSize: '0.3rem', border: '1px solid #FF006E', padding: '2px 4px' }}>EVICT NEXT</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render intricate diagrams (Diagram view)
  const renderDirectMappingDiagram = () => {
    const addr = currentAddress ?? 0;
    const { tag, index, offset } = parseAddress(addr);
    
    return (
      <svg width="100%" height="100%" viewBox="0 0 1000 600" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <text x="500" y="30" fill="#06FFA5" fontSize="24" fontFamily="'Press Start 2P', cursive" textAnchor="middle">DIRECT MAPPING</text>
        
        <g transform="translate(100, 60)">
          <text x="0" y="0" fill="#8338EC" fontSize="12" fontFamily="'Press Start 2P', cursive">Memory address</text>
          <rect x="0" y="10" width="280" height="40" fill="none" stroke="#666" strokeWidth="2" />
          <rect x="0" y="10" width="100" height="40" fill={animatingPath ? 'rgba(58,134,255,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#3A86FF" strokeWidth="2" />
          <text x="50" y="35" fill="#3A86FF" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Tag</text>
          <text x="50" y="60" fill="#3A86FF" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{tag.toString(2).padStart(8, '0')}</text>
          <rect x="100" y="10" width="100" height="40" fill={animatingPath ? 'rgba(131,56,236,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#8338EC" strokeWidth="2" />
          <text x="150" y="35" fill="#8338EC" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Line</text>
          <text x="150" y="60" fill="#8338EC" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{index.toString(2).padStart(3, '0')}</text>
          <rect x="200" y="10" width="80" height="40" fill={animatingPath ? 'rgba(255,190,11,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#FFBE0B" strokeWidth="2" />
          <text x="240" y="35" fill="#FFBE0B" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Word</text>
          <text x="240" y="60" fill="#FFBE0B" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{offset.toString(2).padStart(2, '0')}</text>
        </g>
        
        <path d="M 150 120 L 150 180" stroke="#3A86FF" strokeWidth="3" fill="none" markerEnd="url(#arrowBlue)" opacity={animatingPath ? 1 : 0.5} />
        <path d="M 250 120 Q 250 200 400 280" stroke="#8338EC" strokeWidth="3" fill="none" markerEnd="url(#arrowPurple)" opacity={animatingPath ? 1 : 0.5} />
        <path d="M 330 120 Q 400 160 700 420" stroke="#FFBE0B" strokeWidth="3" fill="none" markerEnd="url(#arrowYellow)" opacity={animatingPath ? 1 : 0.5} />
        
        <g transform="translate(100, 180)">
          <polygon points="0,0 80,0 100,30 80,60 0,60" fill={animatingPath ? 'rgba(58,134,255,0.2)' : 'rgba(0,0,0,0.5)'} stroke="#3A86FF" strokeWidth="2" />
          <text x="50" y="35" fill="#3A86FF" fontSize="12" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Compare</text>
        </g>
        
        <path d="M 150 240 L 150 520" stroke="#06FFA5" strokeWidth="2" fill="none" opacity={lastResult?.type === 'HIT' ? 1 : 0.3} />
        <text x="160" y="380" fill="#06FFA5" fontSize="10" fontFamily="'JetBrains Mono', monospace">1 if match</text>
        <text x="160" y="395" fill="#06FFA5" fontSize="10" fontFamily="'JetBrains Mono', monospace">(Hit in cache)</text>
        <path d="M 150 240 L 150 540" stroke="#FF006E" strokeWidth="2" fill="none" opacity={lastResult?.type === 'MISS' ? 1 : 0.3} />
        <text x="160" y="500" fill="#FF006E" fontSize="10" fontFamily="'JetBrains Mono', monospace">0 if no match</text>
        <text x="160" y="515" fill="#FF006E" fontSize="10" fontFamily="'JetBrains Mono', monospace">(Miss in cache)</text>
        
        <g transform="translate(400, 200)">
          <text x="60" y="-10" fill="#8338EC" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Cache</text>
          <rect x="0" y="0" width="180" height="250" fill="rgba(0,0,0,0.5)" stroke="#8338EC" strokeWidth="2" />
          {directCache.slice(0, 8).map((line, i) => {
            const isHighlighted = highlightedCacheLine === i && animatingPath;
            return (
              <g key={i} transform={`translate(10, ${10 + i * 28})`}>
                <rect width="160" height="24" fill={isHighlighted ? 'rgba(6,255,165,0.3)' : line.valid ? 'rgba(131,56,236,0.2)' : 'rgba(0,0,0,0.7)'} stroke={isHighlighted ? '#06FFA5' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                <rect x="2" y="2" width="50" height="20" fill="rgba(58,134,255,0.2)" stroke="#3A86FF" strokeWidth="1" />
                <text x="27" y="15" fill="#3A86FF" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                  {line.valid && line.tag !== null ? line.tag.toString(16).toUpperCase().padStart(2, '0') : '--'}
                </text>
                <rect x="54" y="2" width="104" height="20" fill="rgba(6,255,165,0.1)" stroke="#06FFA5" strokeWidth="1" />
                <text x="106" y="15" fill="#06FFA5" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                  {line.valid ? `Data[${i}]` : 'Empty'}
                </text>
                <text x="-8" y="15" fill="#8338EC" fontSize="8" fontFamily="'Press Start 2P', cursive">L{i}</text>
              </g>
            );
          })}
        </g>
        
        <g transform="translate(750, 200)">
          <text x="60" y="-10" fill="#FFBE0B" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Main memory</text>
          <rect x="0" y="0" width="120" height="250" fill="rgba(0,0,0,0.5)" stroke="#FFBE0B" strokeWidth="2" />
          {Array.from({ length: 16 }).map((_, i) => {
            const isHighlighted = highlightedMemBlock === i && animatingPath;
            return (
              <g key={i} transform={`translate(10, ${10 + i * 14})`}>
                <rect width="100" height="12" fill={isHighlighted ? 'rgba(255,190,11,0.4)' : 'rgba(255,190,11,0.1)'} stroke={isHighlighted ? '#FFBE0B' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                <text x="10" y="9" fill="#FFBE0B" fontSize="7" fontFamily="'JetBrains Mono', monospace">W{i}</text>
                <text x="90" y="9" fill="#666" fontSize="6" fontFamily="'JetBrains Mono', monospace" textAnchor="end">R{Math.floor(i / 4)}</text>
              </g>
            );
          })}
        </g>
        
        {lastResult?.type === 'MISS' && (
          <path d="M 580 320 L 750 320" stroke="#FF006E" strokeWidth="3" fill="none" markerEnd="url(#arrowRed)" opacity={animatingPath ? 1 : 0.3}>
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
          </path>
        )}
        
        <defs>
          <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#3A86FF" />
          </marker>
          <marker id="arrowPurple" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#8338EC" />
          </marker>
          <marker id="arrowYellow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#FFBE0B" />
          </marker>
          <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#FF006E" />
          </marker>
          <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#06FFA5" />
          </marker>
        </defs>
        
        <g transform="translate(700, 400)">
          <polygon points="0,20 0,60 40,40" fill="rgba(6,255,165,0.2)" stroke="#06FFA5" strokeWidth="2" />
          <circle cx="40" cy="40" r="15" fill={lastResult?.type === 'HIT' ? 'rgba(6,255,165,0.4)' : 'rgba(255,0,110,0.2)'} stroke={lastResult?.type === 'HIT' ? '#06FFA5' : '#FF006E'} strokeWidth="2" />
          <text x="40" y="45" fill={lastResult?.type === 'HIT' ? '#06FFA5' : '#FF006E'} fontSize="10" fontFamily="'Press Start 2P', cursive" textAnchor="middle">
            {lastResult?.type === 'HIT' ? '1' : '0'}
          </text>
        </g>
      </svg>
    );
  };

  const renderFullyAssociativeDiagram = () => {
    const addr = currentAddress ?? 0;
    const { tag, offset } = parseAddress(addr);
    
    return (
      <svg width="100%" height="100%" viewBox="0 0 1000 600" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <text x="500" y="30" fill="#06FFA5" fontSize="24" fontFamily="'Press Start 2P', cursive" textAnchor="middle">FULLY ASSOCIATIVE</text>
        
        <g transform="translate(150, 60)">
          <text x="0" y="0" fill="#8338EC" fontSize="12" fontFamily="'Press Start 2P', cursive">Memory address</text>
          <rect x="0" y="10" width="200" height="40" fill="none" stroke="#666" strokeWidth="2" />
          <rect x="0" y="10" width="140" height="40" fill={animatingPath ? 'rgba(58,134,255,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#3A86FF" strokeWidth="2" />
          <text x="70" y="35" fill="#3A86FF" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Tag</text>
          <text x="70" y="60" fill="#3A86FF" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{tag.toString(2).padStart(10, '0')}</text>
          <rect x="140" y="10" width="60" height="40" fill={animatingPath ? 'rgba(255,190,11,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#FFBE0B" strokeWidth="2" />
          <text x="170" y="35" fill="#FFBE0B" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Offset</text>
          <text x="170" y="60" fill="#FFBE0B" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{offset.toString(2).padStart(2, '0')}</text>
        </g>
        
        <g transform="translate(100, 150)">
          <text x="100" y="-10" fill="#3A86FF" fontSize="12" fontFamily="'Press Start 2P', cursive">Parallel Comparators</text>
          {Array.from({ length: 4 }).map((_, i) => {
            const line = fullyCache[i];
            const isMatch = line.valid && line.tag === tag;
            return (
              <g key={i} transform={`translate(0, ${i * 50})`}>
                <rect width="200" height="40" fill={isMatch && animatingPath ? 'rgba(6,255,165,0.3)' : 'rgba(58,134,255,0.1)'} stroke={isMatch ? '#06FFA5' : '#3A86FF'} strokeWidth={isMatch ? 3 : 1} />
                <text x="10" y="25" fill="#3A86FF" fontSize="10" fontFamily="'Press Start 2P', cursive">CMP{i}</text>
                <text x="100" y="25" fill={isMatch ? '#06FFA5' : '#666'} fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                  {line.valid ? `Tag: ${line.tag?.toString(16).toUpperCase() || '--'}` : 'Empty'}
                </text>
                <circle cx="180" cy="20" r="10" fill={isMatch && animatingPath ? '#06FFA5' : 'rgba(0,0,0,0.5)'} stroke={isMatch ? '#06FFA5' : '#666'} strokeWidth="2" />
              </g>
            );
          })}
        </g>
        
        <g transform="translate(400, 150)">
          <text x="80" y="-10" fill="#8338EC" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Cache</text>
          <rect x="0" y="0" width="200" height="200" fill="rgba(0,0,0,0.5)" stroke="#8338EC" strokeWidth="2" />
          {fullyCache.map((line, i) => {
            const isHighlighted = highlightedCacheLine === i && animatingPath;
            return (
              <g key={i} transform={`translate(10, ${10 + i * 45})`}>
                <rect width="180" height="40" fill={isHighlighted ? 'rgba(6,255,165,0.3)' : line.valid ? 'rgba(131,56,236,0.2)' : 'rgba(0,0,0,0.7)'} stroke={isHighlighted ? '#06FFA5' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                <text x="10" y="15" fill="#8338EC" fontSize="8" fontFamily="'Press Start 2P', cursive">Block {i}</text>
                <text x="10" y="30" fill="#3A86FF" fontSize="8" fontFamily="'JetBrains Mono', monospace">
                  Tag: {line.valid && line.tag !== null ? line.tag.toString(16).toUpperCase().padStart(3, '0') : '---'}
                </text>
                <text x="100" y="30" fill="#06FFA5" fontSize="8" fontFamily="'JetBrains Mono', monospace">{line.valid ? `Data` : 'Empty'}</text>
                <text x="150" y="15" fill="#FFBE0B" fontSize="7" fontFamily="'JetBrains Mono', monospace">LRU:{line.age}</text>
              </g>
            );
          })}
        </g>
        
        <g transform="translate(750, 150)">
          <text x="60" y="-10" fill="#FFBE0B" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Main memory</text>
          <rect x="0" y="0" width="120" height="200" fill="rgba(0,0,0,0.5)" stroke="#FFBE0B" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const isHighlighted = highlightedMemBlock === i && animatingPath;
            return (
              <g key={i} transform={`translate(10, ${10 + i * 15})`}>
                <rect width="100" height="13" fill={isHighlighted ? 'rgba(255,190,11,0.4)' : 'rgba(255,190,11,0.1)'} stroke={isHighlighted ? '#FFBE0B' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                <text x="10" y="10" fill="#FFBE0B" fontSize="7" fontFamily="'JetBrains Mono', monospace">Block {i}</text>
              </g>
            );
          })}
        </g>
        
        {animatingPath && (
          <>
            <path d="M 250 200 Q 350 200 400 200" stroke="#06FFA5" strokeWidth="2" fill="none" opacity="0.6" markerEnd="url(#arrowGreen)" />
            <path d="M 250 250 Q 350 250 400 250" stroke="#06FFA5" strokeWidth="2" fill="none" opacity="0.4" markerEnd="url(#arrowGreen)" />
          </>
        )}
        
        <defs>
          <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#06FFA5" />
          </marker>
        </defs>
      </svg>
    );
  };

  const renderSetAssociativeDiagram = () => {
    const addr = currentAddress ?? 0;
    const { tag, index, offset } = parseAddress(addr);
    
    return (
      <svg width="100%" height="100%" viewBox="0 0 1000 600" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <text x="500" y="30" fill="#06FFA5" fontSize="24" fontFamily="'Press Start 2P', cursive" textAnchor="middle">SET ASSOCIATIVE (2-WAY)</text>
        
        <g transform="translate(120, 60)">
          <text x="0" y="0" fill="#8338EC" fontSize="12" fontFamily="'Press Start 2P', cursive">Memory address</text>
          <rect x="0" y="10" width="250" height="40" fill="none" stroke="#666" strokeWidth="2" />
          <rect x="0" y="10" width="90" height="40" fill={animatingPath ? 'rgba(58,134,255,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#3A86FF" strokeWidth="2" />
          <text x="45" y="35" fill="#3A86FF" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Tag</text>
          <text x="45" y="60" fill="#3A86FF" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{tag.toString(2).padStart(6, '0')}</text>
          <rect x="90" y="10" width="90" height="40" fill={animatingPath ? 'rgba(131,56,236,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#8338EC" strokeWidth="2" />
          <text x="135" y="35" fill="#8338EC" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Set</text>
          <text x="135" y="60" fill="#8338EC" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{index.toString(2).padStart(2, '0')}</text>
          <rect x="180" y="10" width="70" height="40" fill={animatingPath ? 'rgba(255,190,11,0.3)' : 'rgba(0,0,0,0.5)'} stroke="#FFBE0B" strokeWidth="2" />
          <text x="215" y="35" fill="#FFBE0B" fontSize="14" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">Offset</text>
          <text x="215" y="60" fill="#FFBE0B" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{offset.toString(2).padStart(2, '0')}</text>
        </g>
        
        <path d="M 210 120 Q 210 160 350 200" stroke="#8338EC" strokeWidth="3" fill="none" markerEnd="url(#arrowPurple)" opacity={animatingPath ? 1 : 0.5} />
        
        <g transform="translate(350, 150)">
          <text x="100" y="-10" fill="#8338EC" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Cache (Sets)</text>
          <rect x="0" y="0" width="280" height="320" fill="rgba(0,0,0,0.5)" stroke="#8338EC" strokeWidth="2" />
          {twoWayCache.map((set, si) => {
            const isSetSelected = index === si && animatingPath;
            return (
              <g key={si} transform={`translate(10, ${10 + si * 75})`}>
                <rect width="260" height="70" fill={isSetSelected ? 'rgba(131,56,236,0.2)' : 'rgba(0,0,0,0.6)'} stroke={isSetSelected ? '#8338EC' : '#444'} strokeWidth={isSetSelected ? 2 : 1} />
                <text x="5" y="15" fill="#8338EC" fontSize="10" fontFamily="'Press Start 2P', cursive">Set {si}</text>
                {set.map((line, wi) => {
                  const isHighlighted = isSetSelected && highlightedCacheLine === wi;
                  return (
                    <g key={wi} transform={`translate(5, ${25 + wi * 22})`}>
                      <rect width="250" height="20" fill={isHighlighted ? 'rgba(6,255,165,0.3)' : line.valid ? 'rgba(131,56,236,0.15)' : 'rgba(0,0,0,0.8)'} stroke={isHighlighted ? '#06FFA5' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                      <text x="5" y="14" fill="#3A86FF" fontSize="7" fontFamily="'Press Start 2P', cursive">Way{wi}</text>
                      <text x="60" y="14" fill="#3A86FF" fontSize="7" fontFamily="'JetBrains Mono', monospace">
                        Tag: {line.valid && line.tag !== null ? line.tag.toString(16).toUpperCase().padStart(2, '0') : '--'}
                      </text>
                      <text x="140" y="14" fill="#06FFA5" fontSize="7" fontFamily="'JetBrains Mono', monospace">{line.valid ? `Data` : 'Empty'}</text>
                      <text x="200" y="14" fill="#FFBE0B" fontSize="6" fontFamily="'JetBrains Mono', monospace">LRU:{line.age}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
        
        <g transform="translate(750, 150)">
          <text x="60" y="-10" fill="#FFBE0B" fontSize="14" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Main memory</text>
          <rect x="0" y="0" width="120" height="320" fill="rgba(0,0,0,0.5)" stroke="#FFBE0B" strokeWidth="2" />
          {Array.from({ length: 20 }).map((_, i) => {
            const isHighlighted = highlightedMemBlock === i && animatingPath;
            return (
              <g key={i} transform={`translate(10, ${10 + i * 15})`}>
                <rect width="100" height="13" fill={isHighlighted ? 'rgba(255,190,11,0.4)' : 'rgba(255,190,11,0.1)'} stroke={isHighlighted ? '#FFBE0B' : '#666'} strokeWidth={isHighlighted ? 2 : 1} />
                <text x="10" y="10" fill="#FFBE0B" fontSize="7" fontFamily="'JetBrains Mono', monospace">Block {i}</text>
                <text x="90" y="10" fill="#666" fontSize="6" fontFamily="'JetBrains Mono', monospace" textAnchor="end">Set{i % NUM_SETS_2WAY}</text>
              </g>
            );
          })}
        </g>
        
        {animatingPath && (
          <g transform="translate(120, 300)">
            <polygon points="0,0 80,0 100,25 80,50 0,50" fill="rgba(58,134,255,0.2)" stroke="#3A86FF" strokeWidth="2" />
            <text x="50" y="30" fill="#3A86FF" fontSize="10" fontFamily="'Press Start 2P', cursive" textAnchor="middle">Compare</text>
            <text x="50" y="70" fill="#8338EC" fontSize="8" fontFamily="'JetBrains Mono', monospace">in Set {index}</text>
          </g>
        )}
        
        <defs>
          <marker id="arrowPurple" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#8338EC" />
          </marker>
        </defs>
      </svg>
    );
  };

  const HELP_SECTIONS = [
    { color: '#06FFA5', title: 'CACHE EXPLORER', body: 'Three view modes: INTERACTIVE (gamified learning with quiz & challenges), DIAGRAM (intricate SVG circuit diagrams), HYBRID (split-screen combining both). Switch modes anytime to learn cache behavior AND understand hardware internals!' },
    { color: '#3A86FF', title: 'INTERACTIVE MODE', body: 'Manual access with scoring (+10 pts for HIT, -2 for MISS, streak bonuses). Quiz mode: predict HIT/MISS before accessing (+25 pts correct, -10 wrong). Challenge mode: step through pre-built scenarios that demonstrate thrashing, locality, and policy differences.' },
    { color: '#8338EC', title: 'DIAGRAM MODE', body: 'Watch intricate SVG diagrams showing address breakdown, comparator logic, tag comparison, and data flow through cache hardware. Animated paths light up during access. See exactly how Direct/Fully/Set-Associative mapping works at the circuit level!' },
    { color: '#FF006E', title: 'HYBRID MODE', body: 'Best of both worlds! Left: Live diagram updates as you access addresses. Right: Interactive controls with scoring. See the hardware visualization while playing quiz/challenge modes. Ultimate learning experience!' },
    { color: '#FFBE0B', title: 'DIRECT-MAPPED', body: 'Each address maps to exactly ONE cache line. Lightning fast but causes conflict misses (thrashing) when two addresses compete for the same line. Index = (Address / BlockSize) % NumLines.' },
    { color: '#06FFA5', title: 'FULLY ASSOCIATIVE', body: 'Any block can go in ANY cache line. Zero conflict misses, perfect flexibility. Requires parallel tag comparison of ALL lines. Expensive in silicon — only used for small structures like TLBs.' },
    { color: '#3A86FF', title: 'SET ASSOCIATIVE', body: 'Cache divided into sets, each with N ways. Block maps to a set but can use any way within that set. 2-way to 8-way common in real CPUs. Best balance of speed, flexibility, and silicon cost.' },
    { color: '#8338EC', title: 'SCORING & XP', body: 'Earn points and XP to level up! Manual: HIT = +10, MISS = -2. Streak bonus: 3+ hits in a row = 2x multiplier per streak count. Quiz: Correct prediction = +25. Challenge: Each HIT = +20. Level up every 100 XP!' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a14', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
      <TetrisRow count={32} />

      {/* HELP OVERLAY */}
      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TetrisRow count={30} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '3px solid #FFBE0B', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={14} /> CACHE EXPLORER — GUIDE
            </div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {HELP_SECTIONS.map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.45rem', marginBottom: 7, letterSpacing: 1 }}>{s.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.72rem', lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
          <TetrisRow count={30} reversed />
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '8px 16px', borderBottom: `3px solid ${COLORS[colorIndex]}`, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 4px 20px ${COLORS[colorIndex]}33` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={11} /> EXIT
          </button>
          <button onClick={fullReset} style={{ background: '#000', border: '2px solid #FF006E', color: '#FF006E', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Full Reset">
            <RotateCcw size={14} />
          </button>
          <button onClick={resetCache} style={{ background: '#000', border: '2px solid #8338EC', color: '#8338EC', padding: '0 10px', height: 36, fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: 'pointer' }} title="Reset Cache Only">
            CLR CACHE
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}>
            CACHE EXPLORER
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.6rem' }}>
            SCORE: {score} · LVL {level} · HIT RATE: {hitRate}%
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 80 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.35rem' }}>XP {xp % xpForNextLevel}/{xpForNextLevel}</div>
            <div style={{ background: '#1a1a2e', height: 6, width: '100%', border: '1px solid #333' }}>
              <div style={{ background: '#FFBE0B', height: '100%', width: `${xpProgress}%`, transition: 'width 0.3s', boxShadow: '0 0 6px #FFBE0B' }} />
            </div>
          </div>
          <button onClick={() => setShowHelp(true)} style={{ background: '#000', border: `2px solid ${COLORS[colorIndex]}`, color: COLORS[colorIndex], width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* VIEW MODE SELECTOR */}
      <div style={{ padding: '8px 16px', borderBottom: '2px solid #1a1a2e', background: 'rgba(0,0,0,0.7)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#76b900', fontSize: '0.44rem', marginRight: 8 }}>VIEW:</div>
        {(['interactive', 'diagram', 'hybrid'] as ViewMode[]).map(mode => {
          const labels = { interactive: 'INTERACTIVE', diagram: 'DIAGRAM', hybrid: 'HYBRID' };
          const icons = { interactive: <Gamepad2 size={11} />, diagram: <Layers size={11} />, hybrid: <Grid size={11} /> };
          const colors = { interactive: '#FF006E', diagram: '#3A86FF', hybrid: '#8338EC' };
          return (
            <button key={mode} onClick={() => { setViewMode(mode); musicEngine.playSfx(700); }}
              style={{
                background: viewMode === mode ? `${colors[mode]}22` : 'rgba(0,0,0,0.5)',
                border: `2px solid ${viewMode === mode ? colors[mode] : colors[mode] + '44'}`,
                color: viewMode === mode ? colors[mode] : '#666',
                padding: '6px 14px',
                fontFamily: "'Press Start 2P', cursive",
                fontSize: '0.4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                letterSpacing: 1
              }}>
              {icons[mode]}
              {viewMode === mode ? '▶ ' : '  '}{labels[mode]}
            </button>
          );
        })}
      </div>

      {/* CACHE TYPE & POLICY */}
      <div style={{ padding: '8px 16px', borderBottom: '2px solid #1a1a2e', background: 'rgba(0,0,0,0.6)', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.44rem' }}>CACHE:</div>
        {(['direct', 'set2', 'fully'] as CacheType[]).map((t, i) => {
          const labels = ['DIRECT', '2-WAY', 'FULLY'];
          const colors = ['#06FFA5', '#8338EC', '#00d4ff'];
          return (
            <button key={t} onClick={() => { setCacheType(t); resetCache(); musicEngine.playSfx(600); }}
              style={{ padding: '6px 12px', background: cacheType === t ? `${colors[i]}22` : 'rgba(0,0,0,0.4)', border: `2px solid ${cacheType === t ? colors[i] : colors[i] + '44'}`, color: colors[i], fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: 'pointer' }}>
              {cacheType === t ? '▶ ' : '  '}{labels[i]}
            </button>
          );
        })}
        
        {cacheType !== 'direct' && (
          <>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.44rem', marginLeft: 12 }}>POLICY:</div>
            {(['LRU', 'FIFO', 'Random'] as Policy[]).map(p => (
              <button key={p} onClick={() => { setPolicy(p); musicEngine.playSfx(500); }}
                style={{ padding: '6px 10px', background: policy === p ? 'rgba(255,190,11,0.2)' : 'rgba(0,0,0,0.3)', border: `2px solid ${policy === p ? '#FFBE0B' : '#333'}`, color: policy === p ? '#FFBE0B' : '#666', fontFamily: "'Press Start 2P', cursive", fontSize: '0.36rem', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </>
        )}
        
        {viewMode === 'diagram' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => startAutoDemo([0x00, 0x04, 0x08, 0x0C, 0x00, 0x04, 0x08, 0x0C])} disabled={isAutoRunning}
              style={{ background: 'rgba(6,255,165,0.2)', border: '2px solid #06FFA5', color: '#06FFA5', padding: '6px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: isAutoRunning ? 'not-allowed' : 'pointer', opacity: isAutoRunning ? 0.5 : 1 }}>
              <Activity size={10} style={{ display: 'inline', marginRight: 4 }} /> LOCALITY
            </button>
            <button onClick={() => startAutoDemo([0x00, 0x40, 0x00, 0x40, 0x00, 0x40, 0x00, 0x40])} disabled={isAutoRunning}
              style={{ background: 'rgba(255,0,110,0.2)', border: '2px solid #FF006E', color: '#FF006E', padding: '6px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: isAutoRunning ? 'not-allowed' : 'pointer', opacity: isAutoRunning ? 0.5 : 1 }}>
              <Zap size={10} style={{ display: 'inline', marginRight: 4 }} /> THRASH
            </button>
            {isAutoRunning && (
              <button onClick={stopAutoDemo}
                style={{ background: 'rgba(255,190,11,0.2)', border: '2px solid #FFBE0B', color: '#FFBE0B', padding: '6px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: 'pointer' }}>
                <Square size={10} style={{ display: 'inline', marginRight: 4 }} /> STOP
              </button>
            )}
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      {viewMode === 'interactive' && (
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
          {/* LEFT: Config + Stats */}
          <div style={{ width: 240, flexShrink: 0, borderRight: '2px solid #1a1a2e', background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a2e' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.44rem', marginBottom: 8 }}>STATS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {[
                  { label: 'SCORE', value: score, color: '#FFBE0B' },
                  { label: 'LEVEL', value: level, color: '#8338EC' },
                  { label: 'HITS', value: hits, color: '#06FFA5' },
                  { label: 'MISSES', value: misses, color: '#FF006E' },
                  { label: 'HIT RATE', value: `${hitRate}%`, color: '#3A86FF' },
                  { label: 'STREAK', value: `${streak}🔥`, color: '#FFBE0B' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${s.color}33`, borderLeft: `3px solid ${s.color}` }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#444', fontSize: '0.33rem', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color, fontSize: '0.75rem', fontWeight: 'bold' }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {bestStreak > 0 && (
                <div style={{ marginTop: 6, padding: '5px 8px', background: 'rgba(255,190,11,0.08)', border: '1px solid #FFBE0B44', fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.35rem' }}>
                  <Trophy size={8} style={{ display: 'inline', marginRight: 4 }} />BEST: {bestStreak}
                </div>
              )}
            </div>

            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#3A86FF', fontSize: '0.44rem', marginBottom: 8 }}>QUICK HIT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[0x00, 0x01, 0x02, 0x08, 0x10, 0x04].map((addr) => (
                  <button key={addr} onClick={() => handleAccess(addr)}
                    style={{ background: 'rgba(58,134,255,0.15)', border: '1px solid #3A86FF66', color: '#3A86FF', padding: '5px 7px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', cursor: 'pointer' }}>
                    {formatAddr(addr)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Cache + Tabs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '12px 16px', gap: 12 }}>
            {lastResult && (
              <div style={{
                padding: '10px 16px',
                textAlign: 'center',
                background: lastResult.type === 'HIT' ? 'rgba(6,255,165,0.12)' : 'rgba(255,0,110,0.12)',
                border: `3px solid ${lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E'}`,
                boxShadow: `0 0 20px ${lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E'}44`,
                flexShrink: 0,
                opacity: animFlash ? 1 : 0.7,
                transition: 'all 0.3s',
              }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.85rem', color: lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E', letterSpacing: 3 }}>
                  {lastResult.type === 'HIT' ? `✓ CACHE HIT!${streak >= 3 ? ` 🔥 ${streak}x` : ' +10'}` : '✗ CACHE MISS -2'}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', fontSize: '0.65rem', marginTop: 4 }}>
                  ADDR: {formatAddr(lastResult.address)} · IDX: {lastResult.index} · TAG: 0x{lastResult.tag.toString(16).toUpperCase()}
                  {lastResult.evicted !== undefined && ` · EVICT: 0x${lastResult.evicted.toString(16).toUpperCase()}`}
                </div>
              </div>
            )}

            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#76b900', fontSize: '0.5rem', flexShrink: 0 }}>
              {cacheType === 'direct' ? 'DIRECT — 8 SETS' : cacheType === 'set2' ? '2-WAY — 4 SETS × 2 WAYS' : `FULLY — 4 LINES · ${policy}`}
            </div>

            <div style={{ flexShrink: 0 }}>{renderCacheState()}</div>

            <div style={{ display: 'flex', gap: 0, flexShrink: 0, borderBottom: '2px solid #1a1a2e' }}>
              {(['manual', 'quiz', 'challenge'] as InteractiveTab[]).map((tab) => {
                const labels = { manual: '⌨ MANUAL', quiz: '⚡ QUIZ', challenge: '🏆 CHALLENGES' };
                const colors = { manual: '#3A86FF', quiz: '#FFBE0B', challenge: '#FF006E' };
                return (
                  <button key={tab} onClick={() => setInteractiveTab(tab)}
                    style={{ flex: 1, padding: '10px', background: interactiveTab === tab ? `${colors[tab]}22` : 'transparent', border: 'none', borderBottom: `3px solid ${interactiveTab === tab ? colors[tab] : 'transparent'}`, color: interactiveTab === tab ? colors[tab] : '#444', fontFamily: "'Press Start 2P', cursive", fontSize: '0.44rem', cursor: 'pointer' }}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {interactiveTab === 'manual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={addressInput} onChange={e => setAddressInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAccess()}
                      placeholder="hex address (0x000–0xFFF)"
                      style={{ flex: 1, background: '#000', border: '2px solid #3A86FF', color: '#fff', padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }} />
                    <button onClick={() => handleAccess()}
                      style={{ background: 'linear-gradient(180deg,#3A86FF 0%,#2A6FDD 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #1A4FA0', color: '#fff', padding: '10px 18px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={12} /> GO
                    </button>
                  </div>

                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#3A86FF', fontSize: '0.44rem' }}>ACCESS LOG</div>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #1a1a2e', maxHeight: 220, overflowY: 'auto' }}>
                    {accessLog.length === 0 ? (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#333', fontSize: '0.7rem', textAlign: 'center', padding: 24 }}>No accesses yet</div>
                    ) : accessLog.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 8px', borderBottom: '1px solid #1a1a2e', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', background: i === 0 ? (r.type === 'HIT' ? 'rgba(6,255,165,0.07)' : 'rgba(255,0,110,0.07)') : 'transparent' }}>
                        <span style={{ color: r.type === 'HIT' ? '#06FFA5' : '#FF006E', width: 36, fontWeight: 'bold' }}>{r.type}</span>
                        <span style={{ color: '#FFBE0B' }}>{formatAddr(r.address)}</span>
                        <span style={{ color: '#8b8baa' }}>idx:{r.index} tag:{r.tag.toString(16).toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {interactiveTab === 'quiz' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#888', fontSize: '0.72rem', lineHeight: 1.6 }}>
                    Predict if address will HIT or MISS. Correct = <span style={{ color: '#06FFA5' }}>+25 pts</span>, Wrong = <span style={{ color: '#FF006E' }}>-10 pts</span>
                  </div>

                  {quizAddr === null ? (
                    <button onClick={generateQuiz}
                      style={{ background: 'linear-gradient(180deg,#FFBE0B 0%,#D99E00 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #A07700', color: '#000', padding: '14px 28px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={14} /> GENERATE CHALLENGE
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ padding: '14px 18px', background: 'rgba(255,190,11,0.1)', border: '2px solid #FFBE0B', fontFamily: "'JetBrains Mono', monospace", fontSize: '1rem', color: '#fff' }}>
                        Accessing <span style={{ color: '#FFBE0B', fontWeight: 'bold' }}>{formatAddr(quizAddr)}</span> — HIT or MISS?
                      </div>

                      {!quizRevealed ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => submitPrediction('HIT')}
                            style={{ flex: 1, background: 'rgba(6,255,165,0.15)', border: '3px solid #06FFA5', color: '#06FFA5', padding: '14px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', cursor: 'pointer' }}>
                            ✓ HIT
                          </button>
                          <button onClick={() => submitPrediction('MISS')}
                            style={{ flex: 1, background: 'rgba(255,0,110,0.15)', border: '3px solid #FF006E', color: '#FF006E', padding: '14px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', cursor: 'pointer' }}>
                            ✗ MISS
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ padding: '12px', background: lastResult?.type === quizPrediction ? 'rgba(6,255,165,0.15)' : 'rgba(255,0,110,0.15)', border: `2px solid ${lastResult?.type === quizPrediction ? '#06FFA5' : '#FF006E'}`, fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', color: lastResult?.type === quizPrediction ? '#06FFA5' : '#FF006E' }}>
                            {lastResult?.type === quizPrediction ? '✓ CORRECT! +25' : '✗ WRONG! -10'} — Was: {lastResult?.type}
                          </div>
                          <button onClick={generateQuiz}
                            style={{ background: 'rgba(255,190,11,0.2)', border: '2px solid #FFBE0B', color: '#FFBE0B', padding: '10px 18px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            NEXT →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {interactiveTab === 'challenge' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeChallengeIdx === null ? (
                    <>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#888', fontSize: '0.72rem', lineHeight: 1.6, marginBottom: 4 }}>
                        Step through scenarios that demonstrate cache concepts.
                      </div>
                      {CHALLENGES.map((ch, i) => (
                        <button key={i} onClick={() => startChallenge(i)}
                          style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #FF006E44', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#FF006E')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#FF006E44')}>
                          <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FF006E', fontSize: '0.48rem', marginBottom: 5 }}>{ch.name}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', fontSize: '0.68rem', marginBottom: 4 }}>{ch.description}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#555', fontSize: '0.62rem' }}>
                            {ch.sequence.map(a => formatAddr(a)).join(' → ')} · Target: {ch.targetHitRate}%
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FF006E', fontSize: '0.5rem' }}>
                          {CHALLENGES[activeChallengeIdx].name}
                        </div>
                        <button onClick={() => { setActiveChallengeIdx(null); resetCache(); }}
                          style={{ background: 'none', border: '1px solid #555', color: '#555', padding: '4px 10px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', cursor: 'pointer' }}>
                          ← BACK
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {CHALLENGES[activeChallengeIdx].sequence.map((addr, i) => (
                          <div key={i} style={{
                            padding: '5px 8px',
                            background: i < challengeStep ? (accessLog[challengeStep - 1 - i]?.type === 'HIT' ? 'rgba(6,255,165,0.2)' : 'rgba(255,0,110,0.2)') : i === challengeStep ? 'rgba(255,190,11,0.2)' : 'rgba(0,0,0,0.3)',
                            border: `2px solid ${i < challengeStep ? (accessLog[challengeStep - 1 - i]?.type === 'HIT' ? '#06FFA5' : '#FF006E') : i === challengeStep ? '#FFBE0B' : '#333'}`,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.65rem',
                            color: i <= challengeStep ? '#fff' : '#444',
                          }}>
                            {formatAddr(addr)}
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: '8px 12px', background: 'rgba(131,56,236,0.1)', border: '1px solid #8338EC44', fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.68rem', lineHeight: 1.6 }}>
                        💡 {CHALLENGES[activeChallengeIdx].tip}
                      </div>

                      {!challengeComplete ? (
                        <button onClick={stepChallenge}
                          style={{ background: 'linear-gradient(180deg,#FF006E 0%,#CC0055 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #880033', color: '#fff', padding: '12px 24px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Zap size={12} /> STEP {challengeStep + 1}/{CHALLENGES[activeChallengeIdx].sequence.length}
                        </button>
                      ) : (
                        <div style={{ padding: '14px', background: 'rgba(6,255,165,0.12)', border: '2px solid #06FFA5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.6rem' }}>
                            <Trophy size={14} style={{ display: 'inline', marginRight: 6 }} />COMPLETE!
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.72rem' }}>
                            Score: +{challengeScore} · Hit rate: {hitRate}%
                          </div>
                          <button onClick={() => { setActiveChallengeIdx(null); resetCache(); }}
                            style={{ background: 'rgba(6,255,165,0.2)', border: '2px solid #06FFA5', color: '#06FFA5', padding: '8px 16px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.44rem', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            TRY ANOTHER →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'diagram' && (
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
          <div style={{ width: 280, flexShrink: 0, borderRight: '2px solid #1a1a2e', background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #1a1a2e' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.44rem', marginBottom: 8 }}>ACCESS ADDRESS</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={addressInput} onChange={e => setAddressInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAccess()}
                  placeholder="0x00" disabled={isAutoRunning}
                  style={{ flex: 1, background: '#000', border: '2px solid #06FFA5', color: '#06FFA5', padding: '8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', textTransform: 'uppercase' }} />
                <button onClick={() => handleAccess()} disabled={isAutoRunning}
                  style={{ background: 'linear-gradient(180deg, #06FFA5 0%, #05CC84 100%)', border: '3px solid #000', boxShadow: '0 3px 0 #048F5F', color: '#000', padding: '0 16px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.4rem', cursor: isAutoRunning ? 'not-allowed' : 'pointer', opacity: isAutoRunning ? 0.5 : 1 }}>
                  GO
                </button>
              </div>
            </div>

            {lastResult && (
              <div style={{ padding: '12px', borderBottom: '1px solid #1a1a2e', background: lastResult.type === 'HIT' ? 'rgba(6,255,165,0.08)' : 'rgba(255,0,110,0.08)' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E', fontSize: '0.5rem', marginBottom: 6 }}>
                  {lastResult.type === 'HIT' ? '✓ HIT!' : '✗ MISS'}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: '#ccc', lineHeight: 1.6 }}>
                  <div>Addr: 0x{lastResult.address.toString(16).toUpperCase().padStart(2, '0')}</div>
                  <div style={{ color: '#3A86FF' }}>Tag: 0x{lastResult.tag.toString(16).toUpperCase()}</div>
                  <div style={{ color: '#8338EC' }}>Index: {lastResult.index}</div>
                  <div style={{ color: '#FFBE0B' }}>Offset: {lastResult.offset}</div>
                </div>
              </div>
            )}

            <div style={{ padding: '12px', borderBottom: '1px solid #1a1a2e' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.44rem', marginBottom: 8 }}>STATS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'HIT RATE', value: `${hitRate}%`, color: '#06FFA5' },
                  { label: 'TOTAL', value: hits + misses, color: '#3A86FF' },
                  { label: 'HITS', value: hits, color: '#06FFA5' },
                  { label: 'MISSES', value: misses, color: '#FF006E' },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '8px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${stat.color}33`, borderLeft: `3px solid ${stat.color}` }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.35rem', color: '#666', marginBottom: 3 }}>{stat.label}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: stat.color, fontWeight: 'bold' }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', minHeight: 200 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.44rem', marginBottom: 8 }}>ACCESS LOG</div>
              <div style={{ flex: 1, background: '#000', border: '2px solid #1a1a2e', padding: '8px', overflow: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem' }}>
                {accessLog.length === 0 ? (
                  <div style={{ color: '#333', textAlign: 'center', padding: 20 }}>No accesses yet</div>
                ) : (
                  accessLog.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #1a1a2e22', color: r.type === 'HIT' ? '#06FFA5' : '#FF006E' }}>
                      <span style={{ width: 30 }}>{r.type}</span>
                      <span style={{ color: '#FFBE0B' }}>0x{r.address.toString(16).toUpperCase().padStart(2, '0')}</span>
                      <span style={{ color: '#666', fontSize: '0.6rem' }}>T:{r.tag} I:{r.index}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
            {cacheType === 'direct' && renderDirectMappingDiagram()}
            {cacheType === 'fully' && renderFullyAssociativeDiagram()}
            {cacheType === 'set2' && renderSetAssociativeDiagram()}
          </div>
        </div>
      )}

      {viewMode === 'hybrid' && (
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
          <div style={{ width: '50%', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', borderRight: '2px solid #1a1a2e' }}>
            {cacheType === 'direct' && renderDirectMappingDiagram()}
            {cacheType === 'fully' && renderFullyAssociativeDiagram()}
            {cacheType === 'set2' && renderSetAssociativeDiagram()}
          </div>

          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '12px 16px', gap: 12 }}>
            {lastResult && (
              <div style={{
                padding: '10px 16px',
                textAlign: 'center',
                background: lastResult.type === 'HIT' ? 'rgba(6,255,165,0.12)' : 'rgba(255,0,110,0.12)',
                border: `3px solid ${lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E'}`,
                flexShrink: 0,
              }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: lastResult.type === 'HIT' ? '#06FFA5' : '#FF006E' }}>
                  {lastResult.type === 'HIT' ? `✓ HIT!${streak >= 3 ? ` 🔥${streak}x` : ' +10'}` : '✗ MISS -2'}
                </div>
              </div>
            )}

            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#76b900', fontSize: '0.5rem', flexShrink: 0 }}>
              {cacheType === 'direct' ? 'DIRECT — 8 SETS' : cacheType === 'set2' ? '2-WAY — 4 SETS × 2 WAYS' : `FULLY — 4 LINES · ${policy}`}
            </div>

            <div style={{ flexShrink: 0 }}>{renderCacheState()}</div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <input value={addressInput} onChange={e => setAddressInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAccess()}
                placeholder="hex address"
                style={{ flex: 1, background: '#000', border: '2px solid #3A86FF', color: '#fff', padding: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }} />
              <button onClick={() => handleAccess()}
                style={{ background: 'linear-gradient(180deg,#3A86FF 0%,#2A6FDD 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #1A4FA0', color: '#fff', padding: '10px 18px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer' }}>
                <Zap size={12} /> GO
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flexShrink: 0 }}>
              {[
                { label: 'SCORE', value: score, color: '#FFBE0B' },
                { label: 'HIT RATE', value: `${hitRate}%`, color: '#06FFA5' },
                { label: 'HITS', value: hits, color: '#06FFA5' },
                { label: 'MISSES', value: misses, color: '#FF006E' },
              ].map(s => (
                <div key={s.label} style={{ padding: '8px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${s.color}33`, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.35rem', color: '#666', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: s.color, fontWeight: 'bold' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <TetrisRow count={32} reversed />
    </div>
  );
}