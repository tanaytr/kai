import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, HelpCircle, X, Zap } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface MemoryExplorerProps {
  onBack: () => void;
}

const MEMORY_LEVELS = [
  { 
    name: 'Registers', 
    size: '32 KB', 
    latency: '<1 cycle', 
    bandwidth: 'N/A', 
    color: '#ff006e', 
    expanded: false,
    details: [
      '32 general-purpose registers per ARM core',
      'Used for immediate computations and temporary storage',
      'Fastest access in the entire hierarchy',
      'Part of ARMv9-A ISA specification',
      'Zero-latency access for direct CPU operations',
    ]
  },
  { 
    name: 'L1 Cache', 
    size: '64 KB (I) + 64 KB (D)', 
    latency: '4 cycles', 
    bandwidth: '~8 TB/s', 
    color: '#8338ec', 
    expanded: false,
    details: [
      'Split instruction/data cache (Harvard architecture)',
      '128-byte cache line size',
      'Virtually indexed, physically tagged (VIPT)',
      '4-way set associative',
      'Write-back policy for data cache',
    ]
  },
  { 
    name: 'L2 Cache', 
    size: '60 MB (GPU) / Private (CPU)', 
    latency: '~30 cycles', 
    bandwidth: '~4 TB/s', 
    color: '#3a86ff', 
    expanded: false,
    details: [
      'GPU: 60 MB shared across all SMs',
      'CPU: Private L2 per core (ARM design)',
      'Victim cache for L1 evictions',
      '16-way set associative',
      'Unified instruction + data',
    ]
  },
  { 
    name: 'L3 Cache', 
    size: '576 MB (CPU unified)', 
    latency: '~60 cycles', 
    bandwidth: '~2 TB/s', 
    color: '#00d4ff', 
    expanded: false,
    details: [
      '576 MB unified across all 72 CPU cores',
      'NUCA (Non-Uniform Cache Architecture)',
      'Distributed slices for parallel access',
      'Reduces DRAM accesses by ~40%',
      'Coherent with GPU via NVLink-C2C',
    ]
  },
  { 
    name: 'LPDDR5X', 
    size: '480 GB', 
    latency: '~100 cycles', 
    bandwidth: '546 GB/s', 
    color: '#ffaa00', 
    expanded: false,
    details: [
      '480 GB on-package LPDDR5X (8-channel)',
      '50% lower power consumption vs DDR5',
      'On-package design: ~100 cycle access latency',
      'Revolutionary: LPDDR (mobile tech) in datacenter',
      'Unified memory with GPU via NVLink-C2C',
    ]
  },
  { 
    name: 'HBM3e', 
    size: '96 GB', 
    latency: '~120 cycles', 
    bandwidth: '4 TB/s', 
    color: '#ff5522', 
    expanded: false,
    details: [
      '6 stacks of HBM3e memory',
      '1024-bit bus per stack via TSVs (Through-Silicon Vias)',
      '4 TB/s aggregate bandwidth',
      'ECC SECDED (Single Error Correction, Double Error Detection)',
      'Directly bonded to GPU silicon interposer',
    ]
  },
];

export default function MemoryExplorer({ onBack }: MemoryExplorerProps) {
  const [levels, setLevels] = useState(MEMORY_LEVELS);
  const [quizMode, setQuizMode] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const QUIZ_QUESTIONS = [
    {
      question: 'Which memory level has the highest bandwidth?',
      options: ['L1 Cache (~8 TB/s)', 'HBM3e (4 TB/s)', 'LPDDR5X (546 GB/s)', 'L3 Cache (~2 TB/s)'],
      correct: 0,
      explanation: 'L1 Cache has the highest bandwidth at ~8 TB/s due to its proximity to the CPU cores and wide data paths.'
    },
    {
      question: 'What makes LPDDR5X revolutionary in GH200?',
      options: ['Highest bandwidth', 'Mobile tech in datacenter', 'Largest capacity', 'Fastest latency'],
      correct: 1,
      explanation: 'LPDDR5X is revolutionary because it brings mobile/laptop memory technology to the datacenter, offering 50% lower power vs DDR5.'
    },
    {
      question: 'How many HBM3e stacks does GH200 have?',
      options: ['4 stacks', '6 stacks', '8 stacks', '12 stacks'],
      correct: 1,
      explanation: 'GH200 has 6 HBM3e stacks, each with a 1024-bit bus, providing 4 TB/s aggregate bandwidth.'
    },
    {
      question: 'What does NUCA stand for in L3 cache?',
      options: ['New Unified Cache Array', 'Non-Uniform Cache Architecture', 'NVIDIA Unified Cache Accelerator', 'Next-gen Ultra Cache'],
      correct: 1,
      explanation: 'NUCA = Non-Uniform Cache Architecture. Cache slices closer to a core have lower latency than distant slices.'
    },
    {
      question: 'What is the total unified memory in GH200?',
      options: ['480 GB', '576 GB', '624 GB', '720 GB'],
      correct: 2,
      explanation: '624 GB total: 480 GB LPDDR5X + 96 GB HBM3e + 48 GB reserved, all coherent via NVLink-C2C.'
    },
  ];

  const toggleExpand = (idx: number) => {
    setLevels(prev => prev.map((level, i) => 
      i === idx ? { ...level, expanded: !level.expanded } : level
    ));
    musicEngine.playSfx(600);
  };

  const expandAll = () => {
    setLevels(prev => prev.map(level => ({ ...level, expanded: true })));
    musicEngine.playSfx(800);
  };

  const collapseAll = () => {
    setLevels(prev => prev.map(level => ({ ...level, expanded: false })));
    musicEngine.playSfx(400);
  };

  const startQuiz = () => {
    setQuizMode(true);
    setCurrentQuestion(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);
    musicEngine.playSfx(900);
  };

  const answerQuestion = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
    const correct = idx === QUIZ_QUESTIONS[currentQuestion].correct;
    if (correct) {
      setScore(s => s + 20);
      musicEngine.playSfx(1100, 'sine', 0.15);
    } else {
      musicEngine.playSfx(250, 'square', 0.12);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(q => q + 1);
      setAnswered(false);
      setSelectedAnswer(null);
      musicEngine.playSfx(700);
    } else {
      setQuizMode(false);
      musicEngine.playSfx(1200);
    }
  };

  const currentQ = QUIZ_QUESTIONS[currentQuestion];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
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
          MEMORY EXPLORER
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {!quizMode && (
            <>
              <button onClick={startQuiz} style={{ background: 'linear-gradient(180deg, #06FFA5 0%, #05CC84 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #048F5F', color: '#000', padding: '8px 14px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={12} /> QUIZ
              </button>
              <button onClick={expandAll} className="pixel-btn" style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '2px solid #06FFA5', color: '#06FFA5', padding: '8px 12px', fontSize: '0.5rem' }}>
                EXPAND
              </button>
              <button onClick={collapseAll} className="pixel-btn" style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '2px solid #FF006E', color: '#FF006E', padding: '8px 12px', fontSize: '0.5rem' }}>
                COLLAPSE
              </button>
            </>
          )}
          {quizMode && (
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', color: '#06FFA5' }}>
              SCORE: {score}
            </div>
          )}
        </div>
      </div>

      {!quizMode ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 40 }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ background: 'rgba(131,56,236,0.1)', border: '2px solid rgba(131,56,236,0.3)', padding: 16, marginBottom: 24, borderRadius: 4 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', color: '#8338EC', marginBottom: 8 }}>
                MEMORY HIERARCHY OVERVIEW
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: '#ccc', lineHeight: 1.7 }}>
                GH200 features a sophisticated memory hierarchy from ultra-fast registers to massive HBM3e pools. Each level trades capacity for speed. Click any level to explore details, or start the QUIZ to test your knowledge!
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {levels.map((level, idx) => (
                <div key={level.name} style={{ background: 'rgba(0,0,0,0.6)', border: `3px solid ${level.color}`, borderLeft: `8px solid ${level.color}`, overflow: 'hidden', transition: 'all 0.3s', boxShadow: level.expanded ? `0 0 20px ${level.color}44` : 'none' }}>
                  <button onClick={() => toggleExpand(idx)} style={{ width: '100%', padding: 20, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: level.color, marginBottom: 8, textShadow: `0 0 8px ${level.color}` }}>
                        {level.name}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: '#ccc', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        <span><b style={{ color: level.color }}>Size:</b> {level.size}</span>
                        <span><b style={{ color: level.color }}>Latency:</b> {level.latency}</span>
                        <span><b style={{ color: level.color }}>Bandwidth:</b> {level.bandwidth}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 20, flexShrink: 0 }}>
                      {level.expanded ? <ChevronDown size={24} color={level.color} /> : <ChevronRight size={24} color={level.color} />}
                    </div>
                  </button>

                  {level.expanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: `2px solid ${level.color}33`, animation: 'fadeIn 0.3s ease' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        {level.details.map((detail, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 8, height: 8, background: level.color, boxShadow: `0 0 6px ${level.color}`, flexShrink: 0, marginTop: 6 }} />
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: '#e0e0f0', lineHeight: 1.7 }}>
                              {detail}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 16, padding: 12, background: `${level.color}11`, border: `1px solid ${level.color}33`, borderRadius: 4 }}>
                        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', color: level.color, marginBottom: 8 }}>
                          ACCESS PATTERN
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#aaa', lineHeight: 1.6 }}>
                          {idx === 0 && 'Direct CPU register access via instruction operands'}
                          {idx === 1 && 'Cache hit/miss → Load/store from L2 on miss'}
                          {idx === 2 && 'Shared across cores/SMs → Victim cache → L3/DRAM on miss'}
                          {idx === 3 && 'Distributed slices → NUCA routing → Main memory on miss'}
                          {idx === 4 && 'CPU main memory → Coherent with GPU via NVLink-C2C'}
                          {idx === 5 && 'GPU main memory → Direct access from SMs → ECC protected'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, background: 'rgba(0,0,0,0.8)', border: '3px solid #76b900', padding: 20, borderRadius: 4 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.65rem', color: '#76b900', marginBottom: 12, textShadow: '0 0 8px #76b900' }}>
                💡 KEY INSIGHT: UNIFIED MEMORY
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: '#e0e0f0', lineHeight: 1.8 }}>
                GH200's revolutionary NVLink-C2C creates a <b style={{ color: '#00d4ff' }}>624 GB unified, coherent memory address space</b> spanning both LPDDR5X (480 GB) and HBM3e (96 GB + 48 GB reserved). The CPU can directly access GPU memory and vice versa with hardware cache coherency, eliminating expensive PCIe transfers. This enables zero-copy data sharing between CPU and GPU workloads.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 700, width: '100%' }}>
            <div style={{ background: 'rgba(0,0,0,0.8)', border: '3px solid #06FFA5', padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', color: '#555', marginBottom: 8 }}>
                QUESTION {currentQuestion + 1} / {QUIZ_QUESTIONS.length}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.95rem', color: '#e0e0f0', lineHeight: 1.8 }}>
                {currentQ.question}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {currentQ.options.map((opt, idx) => {
                let bg = 'rgba(0,0,0,0.5)';
                let border = '#333';
                let color = '#ccc';

                if (answered) {
                  if (idx === currentQ.correct) {
                    bg = 'rgba(6,255,165,0.2)';
                    border = '#06FFA5';
                    color = '#06FFA5';
                  } else if (idx === selectedAnswer) {
                    bg = 'rgba(255,0,110,0.2)';
                    border = '#FF006E';
                    color = '#FF006E';
                  }
                }

                return (
                  <button key={idx} onClick={() => answerQuestion(idx)} disabled={answered}
                    style={{ background: bg, border: `3px solid ${border}`, color, padding: '14px 18px', textAlign: 'left', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', cursor: answered ? 'default' : 'pointer', transition: 'all 0.2s', lineHeight: 1.6 }}>
                    <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', marginRight: 10 }}>{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div style={{ background: 'rgba(0,0,0,0.7)', border: `3px solid ${selectedAnswer === currentQ.correct ? '#06FFA5' : '#FF006E'}`, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.55rem', color: selectedAnswer === currentQ.correct ? '#06FFA5' : '#FF006E', marginBottom: 10 }}>
                  {selectedAnswer === currentQ.correct ? '✓ CORRECT! +20 PTS' : '✗ WRONG'}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#ccc', lineHeight: 1.7 }}>
                  {currentQ.explanation}
                </div>
              </div>
            )}

            {answered && (
              <button onClick={nextQuestion}
                style={{ width: '100%', background: 'linear-gradient(180deg, #8338EC 0%, #6420C7 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #4A1B9E', color: '#fff', padding: '14px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.6rem', cursor: 'pointer' }}>
                {currentQuestion < QUIZ_QUESTIONS.length - 1 ? 'NEXT QUESTION →' : 'FINISH QUIZ'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B', background: 'rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>MEMORY EXPLORER — HELP</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {[
                { color: '#06FFA5', title: 'EXPAND/COLLAPSE', body: 'Click any memory level card to expand and view detailed technical specs. Use EXPAND ALL and COLLAPSE buttons for quick navigation.' },
                { color: '#3A86FF', title: 'QUIZ MODE', body: 'Click QUIZ button to test your knowledge! Answer 5 questions about GH200 memory hierarchy. Correct = +20 pts, Wrong = 0 pts.' },
                { color: '#8338EC', title: 'MEMORY LEVELS', body: 'Six levels from fastest (Registers) to largest (HBM3e). Each level shows Size, Latency, and Bandwidth specifications.' },
                { color: '#FF006E', title: 'ACCESS PATTERNS', body: 'Each expanded level shows how data flows through that memory tier and what happens on cache miss/hit.' },
                { color: '#FFBE0B', title: 'UNIFIED MEMORY', body: 'The key insight box explains how NVLink-C2C creates 624 GB of coherent unified memory across CPU and GPU.' },
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