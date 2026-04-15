import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, HelpCircle, X, Zap, GitBranch } from 'lucide-react';
import { musicEngine } from '../utils/musicEngine';

interface ISADecoderProps { onBack: () => void; }

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 14, style = {} }: { color: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: color, flexShrink: 0,
      boxShadow: `inset -${Math.max(2, size/6)}px -${Math.max(2, size/6)}px 0 rgba(0,0,0,0.5), inset ${Math.max(2, size/6)}px ${Math.max(2, size/6)}px 0 rgba(255,255,255,0.3)`,
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

interface ARMInstruction {
  hex: string;
  binary: string;
  mnemonic: string;
  type: string;
  fields: { name: string; bits: string; value: string; meaning: string; color: string }[];
  description: string;
  microOps: string[];
  pipelineStages: string[];
  registers: { name: string; before: string; after: string }[];
  quiz: { question: string; options: string[]; correct: number; explanation: string };
}

const ARM_INSTRUCTIONS: ARMInstruction[] = [
  {
    hex: '0x8B010000',
    binary: '1000 1011 0000 0001 0000 0000 0000 0000',
    mnemonic: 'ADD X0, X0, X1',
    type: 'Data Processing — Integer',
    fields: [
      { name: 'sf', bits: '[31]', value: '1', meaning: '64-bit operation', color: '#FF006E' },
      { name: 'op', bits: '[30]', value: '0', meaning: 'ADD (not SUB)', color: '#8338EC' },
      { name: 'S', bits: '[29]', value: '0', meaning: 'No flags update', color: '#3A86FF' },
      { name: 'opcode', bits: '[28:24]', value: '01011', meaning: 'Add shifted register', color: '#06FFA5' },
      { name: 'Rm', bits: '[20:16]', value: '00001', meaning: 'X1 (source 2)', color: '#FFBE0B' },
      { name: 'shift/imm', bits: '[15:10]', value: '000000', meaning: 'No shift', color: '#FF006E' },
      { name: 'Rn', bits: '[9:5]', value: '00000', meaning: 'X0 (source 1)', color: '#8338EC' },
      { name: 'Rd', bits: '[4:0]', value: '00000', meaning: 'X0 (destination)', color: '#3A86FF' },
    ],
    description: 'Adds the values in X0 and X1, stores result in X0. 64-bit integer ADD using shifted register format. No NZCV flags updated.',
    microOps: ['Read X0 from register file', 'Read X1 from register file', 'Route both to ALU add port', 'Execute: result = X0 + X1', 'Write result to X0 register file'],
    pipelineStages: ['FETCH: Read 4 bytes from PC', 'DECODE: Identify ADD, extract Rn=X0 Rm=X1 Rd=X0', 'ISSUE: Wait for X0, X1 to be ready (RAW check)', 'EXECUTE: ALU ADD in 1 cycle', 'WRITEBACK: Update X0 in ROB, commit'],
    registers: [{ name: 'X0', before: '0x0000...A', after: '0x0000...A+B' }, { name: 'X1', before: '0x0000...B', after: '0x0000...B' }],
    quiz: { question: 'This instruction uses the "shifted register" encoding. What does the shift/imm field value 000000 mean?', options: ['Shift X1 left by 0 (no shift)', 'Immediate value is 0', 'Memory offset = 0', 'Flags are cleared'], correct: 0, explanation: 'In the shifted register format, bits [15:10] encode the shift amount. 000000 means LSL #0 — shift left by zero, i.e., no shift. X1 is used as-is.' },
  },
  {
    hex: '0xF9400001',
    binary: '1111 1001 0100 0000 0000 0000 0000 0001',
    mnemonic: 'LDR X1, [X0]',
    type: 'Load/Store — Load Register',
    fields: [
      { name: 'size', bits: '[31:30]', value: '11', meaning: '64-bit load', color: '#FF006E' },
      { name: 'V', bits: '[26]', value: '0', meaning: 'GPR not SIMD', color: '#8338EC' },
      { name: 'opc', bits: '[23:22]', value: '01', meaning: 'Load (not store)', color: '#3A86FF' },
      { name: 'imm12', bits: '[21:10]', value: '000000000000', meaning: 'Offset = 0 bytes', color: '#06FFA5' },
      { name: 'Rn', bits: '[9:5]', value: '00000', meaning: 'X0 (base address)', color: '#FFBE0B' },
      { name: 'Rt', bits: '[4:0]', value: '00001', meaning: 'X1 (destination)', color: '#FF006E' },
    ],
    description: 'Loads a 64-bit value from memory address in X0, stores into X1. Uses unsigned offset addressing mode with 0 byte offset.',
    microOps: ['Read X0 (base register) from register file', 'Compute EA = X0 + 0 (zero offset)', 'Issue load to D-cache (L1D)', 'L1D hit: ~4 cycles, L2 miss: ~12, L3 miss: ~60', 'Write loaded 64-bit value into X1'],
    pipelineStages: ['FETCH: Read LDR encoding', 'DECODE: Identify load, Rn=X0 Rt=X1 imm=0', 'ISSUE: Check X0 ready, dispatch to load unit', 'EXECUTE: AGU computes EA = X0 + 0', 'MEMORY: Send EA to L1 D-cache, await data', 'WRITEBACK: Place data in X1 when cache responds'],
    registers: [{ name: 'X0', before: '0xFFFF8001000', after: '0xFFFF8001000 (unchanged)' }, { name: 'X1', before: '(any)', after: 'Mem[X0]' }],
    quiz: { question: 'This LDR uses imm12 = 0. What is the maximum byte offset encodable in imm12 with 64-bit (size=11) transfers?', options: ['4095 bytes', '32760 bytes', '32767 bytes', '4096 bytes'], correct: 1, explanation: 'For 64-bit loads (size=11), the 12-bit unsigned offset is scaled by 8 (transfer size). Max = (2¹²−1) × 8 = 4095 × 8 = 32760 bytes.' },
  },
  {
    hex: '0x4E21D420',
    binary: '0100 1110 0010 0001 1101 0100 0010 0000',
    mnemonic: 'FADD V0.4S, V1.4S, V1.4S',
    type: 'SIMD — Advanced SIMD Floating Point Add',
    fields: [
      { name: 'Q', bits: '[30]', value: '1', meaning: '128-bit vector (4 lanes)', color: '#FF006E' },
      { name: 'U', bits: '[29]', value: '0', meaning: 'Signed/float operation', color: '#8338EC' },
      { name: 'size', bits: '[23:22]', value: '00', meaning: 'Single precision (32-bit)', color: '#3A86FF' },
      { name: 'Rm', bits: '[20:16]', value: '00001', meaning: 'V1 (source 2)', color: '#06FFA5' },
      { name: 'opcode', bits: '[15:11]', value: '11010', meaning: 'FADD operation', color: '#FFBE0B' },
      { name: 'Rn', bits: '[9:5]', value: '00001', meaning: 'V1 (source 1)', color: '#FF006E' },
      { name: 'Rd', bits: '[4:0]', value: '00000', meaning: 'V0 (destination)', color: '#8338EC' },
    ],
    description: 'SIMD floating-point add. Adds 4 single-precision (FP32) floats from V1 to 4 floats from V1 (itself), storing 4 results in V0. Part of NEON/AdvSIMD ISA.',
    microOps: ['Read 128-bit V1 from SIMD register file', 'Route to SIMD FP add unit (4 lanes in parallel)', 'Execute 4× FP32 adds simultaneously (1 cycle)', 'Write 128-bit result to V0 SIMD register'],
    pipelineStages: ['FETCH: Read SIMD encoding', 'DECODE: Identify AdvSIMD FADD, Q=1 → 4S', 'ISSUE: Dispatch to SIMD/FP execution unit', 'EXECUTE: 4 FP32 adds in parallel (single pipeline beat)', 'WRITEBACK: Write 128-bit result to V0'],
    registers: [{ name: 'V0', before: '[any 4×FP32]', after: '[V1[0]+V1[0], V1[1]+V1[1], ...]' }, { name: 'V1', before: '[a, b, c, d]', after: '[a, b, c, d] (unchanged)' }],
    quiz: { question: 'The Q bit = 1 means 128-bit. If Q=0, this would be FADD V0.2S — how many FP32 values would that process?', options: ['1 value (scalar)', '2 values (64-bit, 2 lanes)', '4 values (same as Q=1)', '8 values (double)'], correct: 1, explanation: 'Q=0 → 64-bit register half. For 32-bit (single) elements: 64/32 = 2 lanes. FADD V0.2S adds 2 FP32 values in parallel.' },
  },
  {
    hex: '0xD65F03C0',
    binary: '1101 0110 0101 1111 0000 0011 1100 0000',
    mnemonic: 'RET',
    type: 'Branch — Return from Subroutine',
    fields: [
      { name: 'opc', bits: '[31:29]', value: '110', meaning: 'Unconditional branch to register', color: '#FF006E' },
      { name: 'op2', bits: '[28:21]', value: '10110', meaning: 'Return type', color: '#8338EC' },
      { name: 'op3', bits: '[20:16]', value: '11111', meaning: 'No PAC auth', color: '#3A86FF' },
      { name: 'Rn', bits: '[9:5]', value: '11110', meaning: 'X30 (link register)', color: '#06FFA5' },
      { name: 'Rm', bits: '[4:0]', value: '00000', meaning: 'Not used', color: '#FFBE0B' },
    ],
    description: 'Returns from a subroutine by branching to the address in X30 (link register). The link register was set by the CALL instruction (BL/BLR). Implicitly uses X30 as return address.',
    microOps: ['Read X30 (LR) from register file', 'Validate return address (branch predictor uses return address stack)', 'Flush pipeline if mispredicted, else zero-cycle return', 'Set PC = X30', 'Continue fetching from new PC'],
    pipelineStages: ['FETCH: Read RET encoding', 'DECODE: Identify indirect branch, Rn=X30', 'ISSUE: Read X30, consult Return Address Stack (RAS) in branch predictor', 'EXECUTE: PC ← X30', 'FLUSH or CONTINUE: If RAS predicted correctly (>99%), no flush needed'],
    registers: [{ name: 'PC', before: 'Current addr', after: 'Value of X30' }, { name: 'X30', before: 'Return addr', after: 'Return addr (unchanged)' }],
    quiz: { question: 'ARMv9-A adds Pointer Authentication (PAC). What would RETAA do differently from plain RET?', options: ['Return to X29 instead of X30', 'Authenticate the return address in X30 using PAC before branching', 'Set flags before returning', 'Flush the entire cache before return'], correct: 1, explanation: 'RETAA authenticates the pointer in X30 using the A key before using it as the return address. This prevents Return-Oriented Programming (ROP) attacks by detecting tampered return addresses.' },
  },
  {
    hex: '0xEB01001F',
    binary: '1110 1011 0000 0001 0000 0000 0001 1111',
    mnemonic: 'CMP X0, X1',
    type: 'Data Processing — Compare (SUBS to XZR)',
    fields: [
      { name: 'sf', bits: '[31]', value: '1', meaning: '64-bit operands', color: '#FF006E' },
      { name: 'op', bits: '[30]', value: '1', meaning: 'SUB operation', color: '#8338EC' },
      { name: 'S', bits: '[29]', value: '1', meaning: 'Update NZCV flags', color: '#3A86FF' },
      { name: 'opcode', bits: '[28:24]', value: '01011', meaning: 'Subtract shifted register', color: '#06FFA5' },
      { name: 'Rm', bits: '[20:16]', value: '00001', meaning: 'X1 (comparand)', color: '#FFBE0B' },
      { name: 'Rn', bits: '[9:5]', value: '00000', meaning: 'X0 (base)', color: '#FF006E' },
      { name: 'Rd', bits: '[4:0]', value: '11111', meaning: 'XZR (discard result)', color: '#8338EC' },
    ],
    description: 'Compares X0 and X1 by computing X0-X1 and discarding the result, but UPDATING the NZCV condition flags. Rd=XZR (register 31) means the subtraction result is thrown away.',
    microOps: ['Read X0 from register file', 'Read X1 from register file', 'Execute: tmp = X0 - X1', 'Update NZCV flags based on result', 'Write nothing (Rd = XZR → discard)'],
    pipelineStages: ['FETCH: Read encoding', 'DECODE: Detect CMP = SUBS Rd=XZR; extract Rn=X0 Rm=X1', 'ISSUE: Check X0, X1 ready; dispatch to ALU', 'EXECUTE: SUB, compute NZCV flags', 'WRITEBACK: Update condition flags, discard result'],
    registers: [{ name: 'X0', before: 'A', after: 'A (unchanged)' }, { name: 'X1', before: 'B', after: 'B (unchanged)' }, { name: 'NZCV', before: '(any)', after: 'Based on A-B' }],
    quiz: { question: 'The N flag in NZCV is set when...', options: ['Result is zero', 'Result is negative (MSB = 1)', 'Unsigned overflow occurred', 'Signed overflow occurred'], correct: 1, explanation: 'N = Negative flag. Set to the MSB (sign bit) of the result. For 64-bit: N = result[63]. Used by conditional branches like BLT, BGE.' },
  },
];

type Mode = 'decode' | 'quiz' | 'pipeline';

export default function ISADecoder({ onBack }: ISADecoderProps) {
  const [instrIndex, setInstrIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('decode');
  const [showHelp, setShowHelp] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [highlightedField, setHighlightedField] = useState<number | null>(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const instr = ARM_INSTRUCTIONS[instrIndex];

  useEffect(() => {
    const t = setInterval(() => setColorIndex(c => (c + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setQuizAnswer(null); setQuizRevealed(false); setPipelineStep(0); setPipelineRunning(false); setHighlightedField(null);
  }, [instrIndex, mode]);

  const runPipeline = useCallback(() => {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    setPipelineStep(0);
    const steps = instr.pipelineStages.length;
    let step = 0;
    const tick = () => {
      if (step >= steps) { setPipelineRunning(false); musicEngine.playSfx(900, 'sine', 0.15); return; }
      setPipelineStep(step + 1);
      musicEngine.playSfx(400 + step * 100, 'sine', 0.1);
      step++;
      setTimeout(tick, 700);
    };
    tick();
  }, [pipelineRunning, instr]);

  const submitQuiz = useCallback((optionIdx: number) => {
    if (quizRevealed) return;
    setQuizAnswer(optionIdx);
    setQuizRevealed(true);
    const correct = optionIdx === instr.quiz.correct;
    if (correct) { setScore(s => s + 30); musicEngine.playSfx(1100, 'sine', 0.15); }
    else { setScore(s => Math.max(0, s - 10)); musicEngine.playSfx(220, 'square', 0.12); }
  }, [quizRevealed, instr]);

  // Highlight binary bits based on selected field
  const renderBinaryWithHighlight = () => {
    const bits = instr.binary.replace(/\s/g, '');
    const field = highlightedField !== null ? instr.fields[highlightedField] : null;
    let highlightRange: [number, number] | null = null;
    if (field) {
      const match = field.bits.match(/\[(\d+):(\d+)\]/) || field.bits.match(/\[(\d+)\]/);
      if (match) {
        const hi = parseInt(match[1]);
        const lo = match[2] ? parseInt(match[2]) : hi;
        highlightRange = [31 - hi, 31 - lo];
      }
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem' }}>
        {bits.split('').map((bit, i) => {
          const hl = highlightRange && i >= highlightRange[0] && i <= highlightRange[1];
          const fieldIdx = instr.fields.findIndex(f => {
            const match = f.bits.match(/\[(\d+):(\d+)\]/) || f.bits.match(/\[(\d+)\]/);
            if (!match) return false;
            const hi = parseInt(match[1]);
            const lo = match[2] ? parseInt(match[2]) : hi;
            return i >= (31 - hi) && i <= (31 - lo);
          });
          return (
            <span key={i} style={{
              width: 14, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hl ? (field?.color + '44') : fieldIdx >= 0 ? (COLORS[fieldIdx % 5] + '22') : 'rgba(0,0,0,0.3)',
              color: hl ? field?.color : fieldIdx >= 0 ? COLORS[fieldIdx % 5] : '#8b8baa',
              border: hl ? `1px solid ${field?.color}` : '1px solid transparent',
              transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: hl ? 'bold' : 'normal',
              marginRight: (i + 1) % 4 === 0 ? 6 : 0,
            }}>
              {bit}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a14', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
      <TetrisRow count={32} />

      {/* Header */}
      <div style={{ padding: '8px 20px', borderBottom: `3px solid ${COLORS[colorIndex]}`, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 4px 20px ${COLORS[colorIndex]}33` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: '#000', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={11} /> EXIT
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}>ISA DECODER</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.6rem' }}>ARMv9-A · GRACE CPU · SCORE: {score}</div>
        </div>
        <button onClick={() => setShowHelp(v => !v)} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : '#000', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#555', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <HelpCircle size={14} />
        </button>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={30} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>ISA DECODER — HELP</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { color: '#44FFAA', title: 'WHAT IS AN ISA?', body: 'The Instruction Set Architecture (ISA) is the contract between software and hardware. It defines the binary encoding of every instruction the CPU can execute. The Grace CPU uses ARMv9-A — the newest 64-bit ARM ISA with SVE2, MTE, and PAC extensions.' },
                { color: '#3A86FF', title: 'FIXED-WIDTH ENCODING', body: 'ARM instructions are always exactly 32 bits (4 bytes). Unlike x86 which has variable-length instructions (1-15 bytes), fixed-width encoding means the CPU always knows where the next instruction starts — simplifying the fetch and decode stages.' },
                { color: '#8338EC', title: 'FIELD DECODING MODE', body: 'Click any field in the instruction breakdown table. The corresponding bits will highlight in the binary display above. This shows you exactly which bits encode which information in the instruction word.' },
                { color: '#FF006E', title: 'QUIZ MODE', body: 'Each instruction has an expert question about its encoding or behavior. Correct = +30 pts. Wrong = -10 pts. The explanations teach you the deeper COA concepts behind each answer.' },
                { color: '#FFBE0B', title: 'PIPELINE MODE', body: 'Watch the instruction travel through the Grace CPU pipeline stage by stage. Click RUN PIPELINE to animate each stage — from fetch to writeback. Observe out-of-order hazard detection and execution.' },
                { color: '#06FFA5', title: 'INSTRUCTION TYPES', body: 'The 5 instructions cover: Integer arithmetic (ADD, CMP), Memory access (LDR), SIMD floating-point (FADD with NEON), and Control flow (RET with Pointer Auth). These are the core instruction classes of the ARMv9-A ISA.' },
                { color: '#44FFAA', title: 'GH200 CONNECTION', body: 'All instructions shown are real ARMv9-A encodings that run on the 72 Neoverse V2 cores in the Grace CPU. The FADD V0.4S instruction is particularly relevant — the GPU Tensor Cores perform similar parallel FP operations but at 16×16 matrix granularity.' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${s.color}44`, borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: s.color, fontSize: '0.48rem', marginBottom: 7 }}>{s.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.75rem', lineHeight: 1.7 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
          <TetrisRow count={30} reversed />
        </div>
      )}

      {/* Instruction selector */}
      <div style={{ padding: '8px 16px', borderBottom: '2px solid #1a1a2e', background: 'rgba(0,0,0,0.7)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {ARM_INSTRUCTIONS.map((ins, i) => (
          <button key={i} onClick={() => { setInstrIndex(i); musicEngine.playSfx(600 + i * 50); }}
            style={{ background: instrIndex === i ? 'rgba(68,255,170,0.2)' : 'rgba(0,0,0,0.5)', border: `2px solid ${instrIndex === i ? '#44FFAA' : '#333'}`, color: instrIndex === i ? '#44FFAA' : '#666', padding: '6px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {ins.mnemonic.split(',')[0]}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['decode', 'quiz', 'pipeline'] as Mode[]).map(m => {
            const colors = { decode: '#44FFAA', quiz: '#FFBE0B', pipeline: '#8338EC' };
            return (
              <button key={m} onClick={() => { setMode(m); musicEngine.playSfx(700); }}
                style={{ background: mode === m ? `${colors[m]}22` : 'rgba(0,0,0,0.5)', border: `2px solid ${mode === m ? colors[m] : colors[m] + '44'}`, color: colors[m], padding: '6px 12px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.42rem', cursor: 'pointer', letterSpacing: 1 }}>
                {m.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Instruction header */}
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '3px solid #44FFAA', padding: '14px 18px', marginBottom: 14, boxShadow: '0 0 20px rgba(68,255,170,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#44FFAA', fontSize: '1rem', marginBottom: 4 }}>{instr.mnemonic}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.75rem' }}>{instr.type}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#FFBE0B', fontSize: '0.85rem' }}>{instr.hex}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#555', fontSize: '0.6rem' }}>32-bit ARMv9-A encoding</div>
            </div>
          </div>
        </div>

        {mode === 'decode' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 14 }}>
            {/* Binary display */}
            <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #333', padding: '14px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#44FFAA', fontSize: '0.48rem', marginBottom: 10, letterSpacing: 2 }}>BINARY ENCODING — HOVER FIELD TO HIGHLIGHT</div>
              {renderBinaryWithHighlight()}
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#444', fontSize: '0.38rem', marginTop: 8 }}>
                [31] → [0] · MSB first
              </div>
            </div>

            {/* Field table */}
            <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #333', padding: '14px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#3A86FF', fontSize: '0.48rem', marginBottom: 10, letterSpacing: 2 }}>INSTRUCTION FIELDS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {instr.fields.map((field, fi) => (
                  <div key={fi}
                    onMouseEnter={() => setHighlightedField(fi)}
                    onMouseLeave={() => setHighlightedField(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      background: highlightedField === fi ? `${field.color}22` : 'rgba(0,0,0,0.3)',
                      border: `1px solid ${highlightedField === fi ? field.color : field.color + '33'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <div style={{ width: 8, height: 8, background: field.color, flexShrink: 0 }} />
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: field.color, fontSize: '0.7rem', width: 60, flexShrink: 0 }}>{field.name}</div>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#555', fontSize: '0.38rem', width: 70, flexShrink: 0 }}>{field.bits}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#FFBE0B', fontSize: '0.7rem', width: 50, flexShrink: 0 }}>{field.value}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', fontSize: '0.65rem' }}>{field.meaning}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description + micro-ops */}
            <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #333', padding: '14px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FF006E', fontSize: '0.48rem', marginBottom: 8, letterSpacing: 2 }}>DESCRIPTION</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 12 }}>{instr.description}</div>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.48rem', marginBottom: 8, letterSpacing: 2 }}>MICRO-OPS</div>
              {instr.microOps.map((op, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 18, height: 18, background: '#8338EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Press Start 2P', cursive", fontSize: '0.38rem', color: '#fff', flexShrink: 0 }}>{i}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', fontSize: '0.68rem', lineHeight: 1.6 }}>{op}</div>
                </div>
              ))}
            </div>

            {/* Registers */}
            <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #333', padding: '14px' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.48rem', marginBottom: 10, letterSpacing: 2 }}>REGISTER STATE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {instr.registers.map((reg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid #FFBE0B33' }}>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.5rem', width: 40, flexShrink: 0 }}>{reg.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#666', fontSize: '0.65rem' }}>{reg.before}</div>
                    <div style={{ color: '#555' }}>→</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#44FFAA', fontSize: '0.65rem' }}>{reg.after}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'quiz' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ background: 'rgba(0,0,0,0.8)', border: '3px solid #FFBE0B', padding: '20px 24px', marginBottom: 14, boxShadow: '0 0 20px rgba(255,190,11,0.2)' }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.5rem', marginBottom: 12, letterSpacing: 2 }}>QUESTION</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e0e0f0', fontSize: '0.9rem', lineHeight: 1.8 }}>{instr.quiz.question}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {instr.quiz.options.map((opt, i) => {
                let bg = 'rgba(0,0,0,0.5)', border = '#333', color = '#ccc';
                if (quizRevealed) {
                  if (i === instr.quiz.correct) { bg = 'rgba(6,255,165,0.2)'; border = '#06FFA5'; color = '#06FFA5'; }
                  else if (i === quizAnswer && quizAnswer !== instr.quiz.correct) { bg = 'rgba(255,0,110,0.2)'; border = '#FF006E'; color = '#FF006E'; }
                }
                return (
                  <button key={i} onClick={() => submitQuiz(i)} disabled={quizRevealed}
                    style={{ background: bg, border: `2px solid ${border}`, color, padding: '14px 18px', textAlign: 'left', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', cursor: quizRevealed ? 'default' : 'pointer', transition: 'all 0.2s', lineHeight: 1.6 }}>
                    <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', marginRight: 10 }}>{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {quizRevealed && (
              <div style={{ background: 'rgba(0,0,0,0.7)', border: `2px solid ${quizAnswer === instr.quiz.correct ? '#06FFA5' : '#FF006E'}`, padding: '14px 18px', marginTop: 14 }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: quizAnswer === instr.quiz.correct ? '#06FFA5' : '#FF006E', fontSize: '0.5rem', marginBottom: 8 }}>
                  {quizAnswer === instr.quiz.correct ? '✓ CORRECT! +30 PTS' : '✗ WRONG -10 PTS'}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.78rem', lineHeight: 1.7 }}>{instr.quiz.explanation}</div>
                <button onClick={() => { const next = (instrIndex + 1) % ARM_INSTRUCTIONS.length; setInstrIndex(next); }}
                  style={{ marginTop: 12, background: 'rgba(68,255,170,0.2)', border: '2px solid #44FFAA', color: '#44FFAA', padding: '8px 16px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', cursor: 'pointer' }}>
                  NEXT INSTRUCTION →
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'pipeline' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.6rem', letterSpacing: 2 }}>GRACE CPU PIPELINE ANIMATION</div>
              <button onClick={runPipeline} disabled={pipelineRunning}
                style={{ background: pipelineRunning ? 'rgba(0,0,0,0.5)' : 'linear-gradient(180deg, #8338EC 0%, #6420C7 100%)', border: '3px solid #000', boxShadow: '0 4px 0 #4A1B9E', color: '#fff', padding: '10px 20px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', cursor: pipelineRunning ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={12} /> {pipelineRunning ? 'RUNNING...' : 'RUN PIPELINE'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {instr.pipelineStages.map((stage, i) => {
                const active = pipelineStep > i;
                const current = pipelineStep === i + 1;
                const stageTitles = ['FETCH', 'DECODE', 'ISSUE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
                const stageColors = ['#3A86FF', '#8338EC', '#FF006E', '#FFBE0B', '#06FFA5', '#44FFAA'];
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
                    background: current ? `${stageColors[i % stageColors.length]}22` : active ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
                    border: `2px solid ${current ? stageColors[i % stageColors.length] : active ? stageColors[i % stageColors.length] + '44' : '#222'}`,
                    boxShadow: current ? `0 0 15px ${stageColors[i % stageColors.length]}44` : 'none',
                    transition: 'all 0.3s',
                  }}>
                    <div style={{ width: 70, flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Press Start 2P', cursive", color: active ? stageColors[i % stageColors.length] : '#333', fontSize: '0.45rem', letterSpacing: 1 }}>{stageTitles[i] || `STAGE ${i}`}</div>
                      {active && <div style={{ width: '100%', height: 3, background: stageColors[i % stageColors.length], marginTop: 4, boxShadow: `0 0 6px ${stageColors[i % stageColors.length]}` }} />}
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: active ? '#e0e0f0' : '#333', fontSize: '0.75rem', lineHeight: 1.7, transition: 'color 0.3s' }}>
                      {stage}
                    </div>
                    {current && (
                      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <div style={{ width: 12, height: 12, background: stageColors[i % stageColors.length], animation: 'float 1s ease-in-out infinite', boxShadow: `0 0 8px ${stageColors[i % stageColors.length]}` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {pipelineStep === instr.pipelineStages.length && (
              <div style={{ marginTop: 14, padding: '14px', background: 'rgba(68,255,170,0.15)', border: '2px solid #44FFAA', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#44FFAA', fontSize: '0.6rem', marginBottom: 6 }}>✓ PIPELINE COMPLETE</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', fontSize: '0.72rem' }}>
                  {instr.mnemonic} executed successfully in {instr.pipelineStages.length} stages
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <TetrisRow count={32} reversed />
      <style>{`@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
    </div>
  );
}