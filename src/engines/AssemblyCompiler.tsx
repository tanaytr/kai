import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, X, Play, StepForward, Square, RotateCcw, Zap, Cpu, FileCode, Eye, Code, Sun, Moon, Terminal } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
type ArchType  = '8086' | '8085' | '8051';
type ExecState = 'idle' | 'running' | 'paused' | 'error' | 'compiled' | 'done';
type ViewMode  = 'code' | 'execution';
type AddrMode  = 'immediate' | 'direct' | 'indirect' | 'register' | 'indexed';

interface Flags { Z: boolean; C: boolean; S: boolean; O: boolean; P: boolean; AC: boolean; }

interface MemPreload {
  id: number; addrRaw: string; valRaw: string; addrErr: string; valErr: string;
}

interface InputDef {
  id: number; name: string; dest: string; bits: 8 | 16; valRaw: string; valErr: string;
}

interface ExecContext {
  regs:   Record<string, number>;
  flags:  Flags;
  mem:    Record<number, number>;
  stack:  number[];
  output: string[];
  pc:     number;
  cycles: number;
}

interface Snapshot {
  step: number; memDirty: Record<number, number>;
  regs: Record<string, number>; pc: number;
  instr: string; annotation: string; addrMode: AddrMode; instrCycles: number;
}

interface ParsedInstr {
  label?: string; op: string; operands: string[]; raw: string; srcLine: number;
}

interface ExecResult {
  ctx: ExecContext; callStack: number[]; halt: boolean; annotation: string; instrCycles: number;
}

interface ThemeColors {
  bg: string; panel: string; border: string; text: string;
  sub: string; code: string; comment: string; editor: string; output: string;
}

// ─── Audio ────────────────────────────────────────────────
const playSfx = (freq: number, type: OscillatorType = 'square', vol = 0.08): void => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch { /* ignore */ }
};

const COLORS = ['#FF006E','#8338EC','#3A86FF','#06FFA5','#FFBE0B'];

// ─── Cycle counts ─────────────────────────────────────────
const CYCLE_COUNTS_8086: Record<string,number> = {
  MOV:4,XCHG:4,LEA:2,PUSH:15,POP:12,PUSHF:14,POPF:12,LAHF:4,SAHF:4,
  ADD:3,ADC:3,SUB:3,SBB:3,MUL:70,IMUL:80,DIV:80,IDIV:100,
  INC:3,DEC:3,NEG:3,CMP:3,CBW:2,CWD:5,
  AND:3,OR:3,XOR:3,NOT:3,TEST:3,
  SHL:2,SHR:2,SAR:2,SAL:2,ROL:2,ROR:2,RCL:2,RCR:2,
  JMP:15,JE:16,JNE:16,JZ:16,JNZ:16,JC:16,JNC:16,JB:16,JNB:16,
  JA:16,JBE:16,JG:16,JGE:16,JL:16,JLE:16,JS:16,JNS:16,
  JO:16,JNO:16,JP:16,JNP:16,JPE:16,JPO:16,JCXZ:18,
  LOOP:17,LOOPE:18,LOOPNE:19,LOOPZ:18,LOOPNZ:19,
  CALL:23,RET:20,HLT:2,NOP:3,
  MOVSB:18,MOVSW:26,STOSB:11,STOSW:15,LODSB:12,LODSW:16,
  CMPSB:22,CMPSW:30,SCASB:15,SCASW:19,
  CLC:2,STC:2,CMC:2,CLD:2,STD:2,CLI:2,STI:2,
  DAA:4,DAS:4,AAA:8,AAS:7,AAM:83,AAD:60,
  IN:10,OUT:10,INT:51,IRET:32,
};
const CYCLE_COUNTS_8085: Record<string,number> = {
  MVI:7,MOV:4,LXI:10,LDA:13,STA:13,LHLD:16,SHLD:16,LDAX:7,STAX:7,XCHG:4,
  ADD:4,ADC:4,ADI:7,ACI:7,SUB:4,SBB:4,SUI:7,SBI:7,INR:5,DCR:5,INX:5,DCX:5,DAD:10,
  ANA:4,ANI:7,ORA:4,ORI:7,XRA:4,XRI:7,CMA:4,CMP:4,CPI:7,
  RLC:4,RRC:4,RAL:4,RAR:4,PUSH:11,POP:10,CALL:17,RET:10,JMP:10,
  JZ:10,JNZ:10,JC:10,JNC:10,JM:10,JP:10,JPE:10,JPO:10,HLT:4,NOP:4,EI:4,DI:4,IN:10,OUT:10,
};
const CYCLE_COUNTS_8051: Record<string,number> = {
  MOV:1,MOVX:2,MOVC:2,ADD:1,ADDC:1,SUBB:1,MUL:4,DIV:4,INC:1,DEC:1,
  ANL:1,ORL:1,XRL:1,CLR:1,CPL:1,SETB:1,RL:1,RR:1,RLC:1,RRC:1,
  SWAP:1,XCH:1,XCHD:1,PUSH:2,POP:2,SJMP:2,AJMP:2,LJMP:2,JMP:2,
  JZ:2,JNZ:2,JC:2,JNC:2,JB:2,JNB:2,JBC:2,DJNZ:2,CJNE:2,
  LCALL:2,ACALL:2,CALL:2,RET:2,RETI:2,NOP:1,
};

const ADDR_INFO: Record<AddrMode,{label:string;color:string;desc:string}> = {
  immediate:{ label:'Immediate', color:'#FFBE0B', desc:'Value encoded directly in instruction (e.g. MOV AX, 5)' },
  direct:   { label:'Direct',    color:'#3A86FF', desc:'Memory address given directly (e.g. MOV [0010H], AX)' },
  indirect: { label:'Indirect',  color:'#FF006E', desc:'Register holds address of operand (e.g. MOV AX, [SI])' },
  register: { label:'Register',  color:'#06FFA5', desc:'Operand is a CPU register (e.g. ADD AX, BX)' },
  indexed:  { label:'Indexed',   color:'#8338EC', desc:'Address = base register + displacement (e.g. MOV AX, [BX+2])' },
};

// ─── 16-bit register names ────────────────────────────────
const REG16 = new Set(['AX','BX','CX','DX','SI','DI','BP','SP','CS','DS','SS','ES','IP']);
const REG8_HIGH = new Set(['AH','BH','CH','DH']);
const REG8_LOW  = new Set(['AL','BL','CL','DL']);

// ─── Memory helpers ───────────────────────────────────────
const MEM_PAGE = 16;
const MEM_MAX  = 0xFFFF;
function memGet(mem: Record<number,number>, addr: number): number { return mem[addr & MEM_MAX] ?? 0; }
function memSet(mem: Record<number,number>, addr: number, val: number): void {
  const a = addr & MEM_MAX;
  if ((val & 0xFF) === 0) { delete mem[a]; } else { mem[a] = val & 0xFF; }
}
// Read 16-bit word (little-endian)
function memGet16(mem: Record<number,number>, addr: number): number {
  return memGet(mem, addr) | (memGet(mem, addr + 1) << 8);
}
// Write 16-bit word (little-endian)
function memSet16(mem: Record<number,number>, addr: number, val: number): void {
  memSet(mem, addr,     val & 0xFF);
  memSet(mem, addr + 1, (val >> 8) & 0xFF);
}
function emptyMem(): Record<number,number> { return {}; }

function parseAnyAddr(s: string): number {
  s = s.trim().toUpperCase().replace(/\s/g,'');
  if (!s) return NaN;
  if (s.startsWith('0X')) return parseInt(s.slice(2), 16);
  if (s.startsWith('0B')) return parseInt(s.slice(2), 2);
  if (s.endsWith('H'))    return parseInt(s.slice(0,-1), 16);
  if (/^[0-9A-F]+$/.test(s) && /[A-F]/.test(s)) return parseInt(s, 16);
  return parseInt(s, 10);
}

function parseNum(s: string): number {
  s = s.trim().toUpperCase();
  if (!s) return 0;
  if (s.endsWith('H'))    return parseInt(s.slice(0,-1), 16) || 0;
  if (s.startsWith('0X')) return parseInt(s.slice(2), 16) || 0;
  if (/^[0-9A-F]+$/.test(s) && /[A-F]/.test(s)) return parseInt(s, 16) || 0;
  return parseInt(s, 10) || 0;
}

// ─── Determine if operand refers to a 16-bit register destination ──
function is16BitDest(tok: string): boolean {
  return REG16.has(tok.trim().toUpperCase());
}

// ─── Resolve memory address from bracket expression ──────
function resolveAddr(tok: string, regs: Record<string,number>): number | null {
  const u = tok.trim().toUpperCase();
  const idxM = u.match(/^\[([A-Z0-9]+)\s*([+\-])\s*([0-9A-FXH]+)\]$/);
  if (idxM) {
    const base = regs[idxM[1]] ?? 0;
    const off  = parseNum(idxM[3]);
    return idxM[2] === '+' ? base + off : base - off;
  }
  const indM = u.match(/^\[([A-Z0-9]+)\]$/);
  if (indM) return regs[indM[1]] ?? 0;
  const dirM = u.match(/^\[([0-9A-FXH]+)\]$/);
  if (dirM) return parseNum(dirM[1]);
  return null;
}

// ─── resolveVal: respects 8 vs 16 bit based on destination ──
function resolveVal(tok: string, regs: Record<string,number>, mem: Record<number,number>, dest = ''): number {
  tok = tok.trim();
  const u   = tok.toUpperCase();
  const dst = dest.trim().toUpperCase();

  // Immediate
  if (tok.startsWith('#')) return parseNum(tok.slice(1)) & 0xFFFF;

  // Memory reference — use 16-bit read if destination is 16-bit reg
  const addr = resolveAddr(tok, regs);
  if (addr !== null) {
    if (is16BitDest(dst)) return memGet16(mem, addr);
    return memGet(mem, addr);
  }

  // @Rn indirect (8051)
  if (tok.startsWith('@')) return memGet(mem, regs[u.slice(1)] ?? 0);

  // Register
  if (Object.prototype.hasOwnProperty.call(regs, u)) return regs[u];

  // Numeric literal
  return parseNum(tok);
}

function setDest(tok: string, val: number, regs: Record<string,number>, mem: Record<number,number>, bits: 8|16 = 16): void {
  tok = tok.trim();
  const u = tok.toUpperCase();
  val = val & (bits === 16 ? 0xFFFF : 0xFF);

  // Memory destinations
  const addr = resolveAddr(tok, regs);
  if (addr !== null) {
    if (bits === 16) { memSet16(mem, addr, val); } else { memSet(mem, addr, val); }
    return;
  }
  if (tok.startsWith('@')) { memSet(mem, regs[u.slice(1)] ?? 0, val); return; }

  // 8-bit sub-registers — keep parent in sync
  if (u === 'AL') { regs['AX'] = (regs['AX'] & 0xFF00) | (val & 0xFF); regs['AL'] = val & 0xFF; return; }
  if (u === 'AH') { regs['AX'] = (regs['AX'] & 0x00FF) | ((val & 0xFF) << 8); regs['AH'] = val & 0xFF; return; }
  if (u === 'BL') { regs['BX'] = (regs['BX'] & 0xFF00) | (val & 0xFF); regs['BL'] = val & 0xFF; return; }
  if (u === 'BH') { regs['BX'] = (regs['BX'] & 0x00FF) | ((val & 0xFF) << 8); regs['BH'] = val & 0xFF; return; }
  if (u === 'CL') { regs['CX'] = (regs['CX'] & 0xFF00) | (val & 0xFF); regs['CL'] = val & 0xFF; return; }
  if (u === 'CH') { regs['CX'] = (regs['CX'] & 0x00FF) | ((val & 0xFF) << 8); regs['CH'] = val & 0xFF; return; }
  if (u === 'DL') { regs['DX'] = (regs['DX'] & 0xFF00) | (val & 0xFF); regs['DL'] = val & 0xFF; return; }
  if (u === 'DH') { regs['DX'] = (regs['DX'] & 0x00FF) | ((val & 0xFF) << 8); regs['DH'] = val & 0xFF; return; }

  regs[u] = val;
}

function calcFlags(result: number, carry: boolean, bits: 8|16): Flags {
  const mask    = bits === 16 ? 0xFFFF : 0xFF;
  const v       = result & mask;
  const signBit = bits === 16 ? 0x8000 : 0x80;
  const ones    = v.toString(2).split('1').length - 1;
  return { Z: v===0, C: carry, S: (v & signBit)!==0, O: false, P: ones%2===0, AC: false };
}

function detectAddrMode(op: string, operands: string[], arch: ArchType): AddrMode {
  const src = (operands[1] ?? operands[0] ?? '').trim();
  const dst = (operands[0] ?? '').trim();
  if (/\[.+[+\-].+\]/.test(src) || /\[.+[+\-].+\]/.test(dst)) return 'indexed';
  if (/\[.*\]/.test(src) || /\[.*\]/.test(dst)) return 'indirect';
  if (src.startsWith('@') || dst.startsWith('@')) return 'indirect';
  if (src.startsWith('#')) return 'immediate';
  const SFR = /^[0-9A-F]{1,2}H?$/i;
  if (arch==='8085' && ['LDA','STA','SHLD','LHLD'].includes(op)) return 'direct';
  if (arch==='8051') {
    if (['LCALL','LJMP','SJMP','AJMP','ACALL'].includes(op)) return 'immediate';
    if (op==='MOV' && (SFR.test(src)||SFR.test(dst))) return 'direct';
  }
  if (arch==='8086' && /^\[.+\]$/.test(dst)) return 'direct';
  const R86 = new Set('AX BX CX DX SI DI BP SP CS DS SS ES IP AL AH BL BH CL CH DL DH'.split(' '));
  const R85 = new Set('A B C D E H L SP PC M PSW'.split(' '));
  const R51 = new Set('A B R0 R1 R2 R3 R4 R5 R6 R7 DPTR PC SP ACC'.split(' '));
  const isReg = (s: string): boolean => {
    const uu = s.toUpperCase();
    if (arch==='8086') return R86.has(uu);
    if (arch==='8085') return R85.has(uu);
    return R51.has(uu);
  };
  if (/^[0-9A-F]+H?$/i.test(src) && !isReg(src)) return 'immediate';
  return 'register';
}

function parseProgram(src: string): { instrs: ParsedInstr[]; labels: Record<string,number>; errors: string[]; startPC: number } {
  const instrs: ParsedInstr[]          = [];
  const labels: Record<string,number>  = {};
  const errors: string[]               = [];
  let startPC = 0;
  for (let lineNo = 0; lineNo < src.split('\n').length; lineNo++) {
    let line = src.split('\n')[lineNo].split(';')[0].trim();
    if (!line) continue;
    const orgM = line.match(/^ORG\s+([0-9A-FXH]+)/i);
    if (orgM) { startPC = parseAnyAddr(orgM[1]); continue; }
    if (/^(DB|DW|EQU|END)\b/i.test(line)) continue;
    let label: string|undefined;
    const lM = line.match(/^([A-Z_][A-Z0-9_]*):\s*/i);
    if (lM) { label = lM[1].toUpperCase(); line = line.slice(lM[0].length).trim(); if (!line){ labels[label]=instrs.length; continue; } }
    if (!line) continue;
    const spIdx = line.search(/[\s,]/);
    let op: string, rest: string;
    if (spIdx===-1) { op=line.toUpperCase(); rest=''; } else { op=line.slice(0,spIdx).toUpperCase(); rest=line.slice(spIdx).trim(); }
    const operands: string[] = [];
    if (rest) {
      let cur='', depth=0;
      for (const ch of rest) {
        if (ch==='['||ch==='(') depth++;
        else if (ch===']'||ch===')') depth--;
        else if (ch===','&&depth===0){ operands.push(cur.trim()); cur=''; continue; }
        cur+=ch;
      }
      if (cur.trim()) operands.push(cur.trim());
    }
    if (label) labels[label]=instrs.length;
    instrs.push({ label, op, operands, raw:`${op}${operands.length?' '+operands.join(', '):''}`, srcLine:lineNo });
  }
  return { instrs, labels, errors, startPC };
}

const defaultRegs = (arch: ArchType): Record<string,number> => {
  if (arch==='8086') return { AX:0,BX:0,CX:0,DX:0,SI:0,DI:0,BP:0,SP:0xFFFE,CS:0,DS:0,SS:0,ES:0,IP:0,AL:0,AH:0,BL:0,BH:0,CL:0,CH:0,DL:0,DH:0 };
  if (arch==='8085') return { A:0,B:0,C:0,D:0,E:0,H:0,L:0,SP:0xFFFF,PC:0 };
  return { A:0,B:0,R0:0,R1:0,R2:0,R3:0,R4:0,R5:0,R6:0,R7:0,DPTR:0,PC:0,SP:0x07 };
};
const defaultFlags = (): Flags => ({ Z:false,C:false,S:false,O:false,P:false,AC:false });

const EXAMPLES: Record<ArchType,string> = {
  '8086': `; 8086 — Array Sum Example
; Preload: mem[0200H]=05H (count), mem[0201H..0205H]=values
ORG 0100H
START:
    MOV SI, 0202H       ; SI points to first element
    MOV BL, [0200H]     ; BL = N (8-bit read)
    MOV BH, 00H
    MOV CX, BX          ; CX = N
    MOV AX, 0000H       ; AX = sum
SUM_LOOP:
    ADD AX, [SI]        ; sum += mem[SI] (8-bit, safe)
    INC SI
    LOOP SUM_LOOP
    MOV [0300H], AX
    HLT`,
  '8085': `; 8085 — Loop example
ORG 2000H
START:
    MVI A, 00H
    MVI B, 05H
    LXI H, 3000H
    MVI M, 0AH
LOOP_TOP:
    ADD M
    INX H
    MOV M, A
    DCR B
    JNZ LOOP_TOP
    STA 4000H
    HLT`,
  '8051': `; 8051 — Loop example
ORG 0000H
START:
    MOV A, #00H
    MOV R7, #05H
    MOV R0, #30H
    MOV @R0, #0AH
LOOP_TOP:
    ADD A, @R0
    INC R0
    DJNZ R7, LOOP_TOP
    MOV 40H, A
    SJMP END_PROG
END_PROG:
    SJMP END_PROG`,
};

// ═══════════════════════════════════════════════════════════
// 8086 EXECUTOR
// ═══════════════════════════════════════════════════════════
function exec8086(instr: ParsedInstr, ctx: ExecContext, _i: ParsedInstr[], labels: Record<string,number>, callStack: number[]): ExecResult {
  const { op, operands } = instr;
  const r  = { ...ctx.regs };
  const m  = { ...ctx.mem };
  const fl = { ...ctx.flags };
  const st = [...ctx.stack];
  const out= [...ctx.output];
  const cs = [...callStack];
  let pc   = ctx.pc + 1;
  let halt = false;
  let ann  = '';
  const cyc = CYCLE_COUNTS_8086[op] ?? 4;

  // syncBytes: keep AH/AL/BH/BL etc in sync with word regs
  const syncBytes = (): void => {
    r.AL=(r.AX??0)&0xFF; r.AH=((r.AX??0)>>8)&0xFF;
    r.BL=(r.BX??0)&0xFF; r.BH=((r.BX??0)>>8)&0xFF;
    r.CL=(r.CX??0)&0xFF; r.CH=((r.CX??0)>>8)&0xFF;
    r.DL=(r.DX??0)&0xFF; r.DH=((r.DX??0)>>8)&0xFF;
  };

  // V: resolve value, pass destination so 16-bit mem reads work
  const V  = (s: string, dst = ''): number => resolveVal(s, r, m, dst);
  const SD = (d: string, v: number): void => {
    const bits: 8|16 = (REG8_HIGH.has(d.toUpperCase()) || REG8_LOW.has(d.toUpperCase())) ? 8 : 16;
    setDest(d, v, r, m, bits);
  };
  const jumpTo = (label: string): void => {
    const t = labels[label.toUpperCase()];
    if (t===undefined) throw new Error(`Undefined label: ${label}`);
    pc = t;
  };

  try {
    switch(op) {
      // ── Data Transfer ──
      case 'MOV': {
        const dst = operands[0];
        const v   = V(operands[1], dst);   // pass dst so 16-bit read works
        SD(dst, v);
        ann = `${dst}←0x${v.toString(16).toUpperCase()}`;
        break;
      }
      case 'XCHG': { const u0=operands[0].toUpperCase(),u1=operands[1].toUpperCase(); const tmp=r[u0]??0; r[u0]=r[u1]??0; r[u1]=tmp; ann=`${u0}↔${u1}`; break; }
      case 'LEA':  { const u0=operands[0].toUpperCase(); const a=resolveAddr(operands[1],r); if(a!==null)r[u0]=a; ann=`LEA ${u0}=0x${(r[u0]??0).toString(16).toUpperCase()}`; break; }
      case 'PUSH': { const v=V(operands[0],operands[0]); st.push(v); r.SP=((r.SP??0)-2)&0xFFFF; ann=`PUSH 0x${v.toString(16).toUpperCase()}`; break; }
      case 'POP':  { const v=st.pop()??0; SD(operands[0],v); r.SP=((r.SP??0)+2)&0xFFFF; ann=`POP→${operands[0]}=0x${v.toString(16).toUpperCase()}`; break; }
      case 'PUSHF':{ st.push((fl.Z?0x40:0)|(fl.C?0x01:0)|(fl.S?0x80:0)); r.SP=((r.SP??0)-2)&0xFFFF; ann='PUSHF'; break; }
      case 'POPF': { const f=st.pop()??0; fl.Z=(f&0x40)!==0;fl.C=(f&0x01)!==0;fl.S=(f&0x80)!==0; r.SP=((r.SP??0)+2)&0xFFFF; ann='POPF'; break; }
      case 'LAHF': { r.AH=(fl.S?0x80:0)|(fl.Z?0x40:0)|(fl.AC?0x10:0)|(fl.P?0x04:0)|(fl.C?0x01:0); r.AX=((r.AH??0)<<8)|((r.AX??0)&0xFF); ann=`LAHF AH=${r.AH}`; break; }
      case 'SAHF': { const ah=((r.AX??0)>>8)&0xFF; fl.S=(ah&0x80)!==0;fl.Z=(ah&0x40)!==0;fl.AC=(ah&0x10)!==0;fl.P=(ah&0x04)!==0;fl.C=(ah&0x01)!==0; ann='SAHF'; break; }
      // ── Arithmetic ──
      case 'ADD':  { const d=operands[0]; const a=V(d,d),b=V(operands[1],d); const res=a+b; SD(d,res); Object.assign(fl,calcFlags(res,res>0xFFFF,16)); ann=`${d}:${a}+${b}=${res&0xFFFF}`; break; }
      case 'ADC':  { const d=operands[0]; const a=V(d,d),b=V(operands[1],d); const res=a+b+(fl.C?1:0); SD(d,res); Object.assign(fl,calcFlags(res,res>0xFFFF,16)); ann=`ADC=${res&0xFFFF}`; break; }
      case 'SUB':  { const d=operands[0]; const a=V(d,d),b=V(operands[1],d); const res=a-b; SD(d,res); Object.assign(fl,calcFlags(res,res<0,16)); ann=`${d}:${a}-${b}=${res&0xFFFF}`; break; }
      case 'SBB':  { const d=operands[0]; const a=V(d,d),b=V(operands[1],d); const res=a-b-(fl.C?1:0); SD(d,res); Object.assign(fl,calcFlags(res,res<0,16)); ann=`SBB=${res&0xFFFF}`; break; }
      case 'MUL':  { const v=V(operands[0],operands[0]); const res=(r.AX??0)*v; r.AX=res&0xFFFF; r.DX=(res>>16)&0xFFFF; fl.C=fl.O=res>0xFFFF; ann=`AX*${v}=0x${res.toString(16).toUpperCase()}`; break; }
      case 'IMUL': { const v=V(operands[0],operands[0]); const res=((r.AX??0)|0)*(v|0); r.AX=res&0xFFFF; r.DX=(res>>16)&0xFFFF; ann=`IMUL=${res}`; break; }
      case 'DIV':  { const v=V(operands[0],operands[0]); if(!v){out.push('>> ERROR: DIV/0');halt=true;break;} const n=((r.DX??0)<<16)|(r.AX??0); r.AX=Math.floor(n/v)&0xFFFF; r.DX=n%v; ann=`DIV AX=${r.AX} DX=${r.DX}`; break; }
      case 'IDIV': { const v=V(operands[0],operands[0]); if(!v){out.push('>> ERROR: DIV/0');halt=true;break;} r.AX=Math.trunc((r.AX??0)/v)&0xFFFF; r.DX=(r.AX??0)%v; ann=`IDIV ${v}`; break; }
      case 'INC':  { const d=operands[0]; const v=V(d,d)+1; SD(d,v); Object.assign(fl,calcFlags(v,fl.C,16)); ann=`${d}++=${v&0xFFFF}`; break; }
      case 'DEC':  { const d=operands[0]; const v=V(d,d)-1; SD(d,v); Object.assign(fl,calcFlags(v,fl.C,16)); ann=`${d}--=${v&0xFFFF}`; break; }
      case 'NEG':  { const d=operands[0]; const v=(-V(d,d))&0xFFFF; SD(d,v); Object.assign(fl,calcFlags(v,v!==0,16)); ann=`NEG ${d}=0x${v.toString(16).toUpperCase()}`; break; }
      case 'CMP':  { const a=V(operands[0],operands[0]),b=V(operands[1],operands[0]); const res=a-b; Object.assign(fl,calcFlags(res,res<0,16)); ann=`CMP ${a}-${b} Z=${fl.Z}`; break; }
      case 'CBW':  { r.AX=(r.AX??0)&0xFF; if(r.AX&0x80)r.AX|=0xFF00; ann='CBW'; break; }
      case 'CWD':  { r.DX=((r.AX??0)&0x8000)?0xFFFF:0; ann='CWD'; break; }
      // ── Logic ──
      case 'AND':  { const d=operands[0]; const v=V(d,d)&V(operands[1],d); SD(d,v); Object.assign(fl,calcFlags(v,false,16)); ann=`${d}&=0x${v.toString(16).toUpperCase()}`; break; }
      case 'OR':   { const d=operands[0]; const v=V(d,d)|V(operands[1],d); SD(d,v); Object.assign(fl,calcFlags(v,false,16)); ann=`${d}|=0x${v.toString(16).toUpperCase()}`; break; }
      case 'XOR':  { const d=operands[0]; const v=V(d,d)^V(operands[1],d); SD(d,v); Object.assign(fl,calcFlags(v,false,16)); ann=`${d}^=0x${v.toString(16).toUpperCase()}`; break; }
      case 'NOT':  { const d=operands[0]; const v=(~V(d,d))&0xFFFF; SD(d,v); ann=`~${d}=0x${v.toString(16).toUpperCase()}`; break; }
      case 'TEST': { const v=V(operands[0],operands[0])&V(operands[1],operands[0]); Object.assign(fl,calcFlags(v,false,16)); ann=`TEST=0x${v.toString(16).toUpperCase()}`; break; }
      // ── Shifts ──
      case 'SHL': case 'SAL': { const d=operands[0]; const n=V(operands[1])&0x1F; const ov=V(d,d); fl.C=n>0?(ov>>(16-n)&1)!==0:fl.C; const v=(ov<<n)&0xFFFF; SD(d,v); Object.assign(fl,{...fl,...calcFlags(v,fl.C,16)}); ann=`${d}<<=  ${n}=0x${v.toString(16).toUpperCase()} C=${fl.C?1:0}`; break; }
      case 'SHR':  { const d=operands[0]; const n=V(operands[1])&0x1F; const ov=V(d,d); fl.C=n>0?(ov>>(n-1)&1)!==0:fl.C; const v=ov>>>n; SD(d,v); Object.assign(fl,{...fl,...calcFlags(v,fl.C,16)}); ann=`${d}>>=${n}=0x${v.toString(16).toUpperCase()} C=${fl.C?1:0}`; break; }
      case 'SAR':  { const d=operands[0]; const n=V(operands[1])&0x1F; const ov=V(d,d); const signed=ov&0x8000?ov-0x10000:ov; const v=(signed>>n)&0xFFFF; SD(d,v); ann=`SAR ${d}=0x${v.toString(16).toUpperCase()}`; break; }
      case 'ROL':  { const d=operands[0]; const n=V(operands[1])%16; const ov=V(d,d); const v=((ov<<n)|(ov>>(16-n)))&0xFFFF; SD(d,v); fl.C=(v&1)!==0; ann=`ROL`; break; }
      case 'ROR':  { const d=operands[0]; const n=V(operands[1])%16; const ov=V(d,d); const v=((ov>>n)|(ov<<(16-n)))&0xFFFF; SD(d,v); fl.C=(v&0x8000)!==0; ann=`ROR`; break; }
      case 'RCL':  { const d=operands[0]; const n=V(operands[1])%17; let v=V(d,d)|((fl.C?1:0)<<16); v=((v<<n)|(v>>(17-n)))&0x1FFFF; fl.C=(v>>16)!==0; SD(d,v&0xFFFF); ann=`RCL`; break; }
      case 'RCR':  { const d=operands[0]; const n=V(operands[1])%17; let v=V(d,d)|((fl.C?1:0)<<16); v=((v>>n)|(v<<(17-n)))&0x1FFFF; fl.C=(v>>16)!==0; SD(d,v&0xFFFF); ann=`RCR`; break; }
      // ── Jumps ──
      case 'JMP': case 'JMPS': case 'JMPF': { jumpTo(operands[0]); ann=`JMP`; break; }
      case 'JE':  case 'JZ':   { if(fl.Z) { jumpTo(operands[0]); ann='JZ taken'; }  else ann='JZ skip';  break; }
      case 'JNE': case 'JNZ':  { if(!fl.Z){ jumpTo(operands[0]); ann='JNZ taken'; } else ann='JNZ skip'; break; }
      case 'JC':  case 'JB':  case 'JNAE': { if(fl.C) { jumpTo(operands[0]); ann='JC taken';  } else ann='JC skip';  break; }
      case 'JNC': case 'JNB': case 'JAE':  { if(!fl.C){ jumpTo(operands[0]); ann='JNC taken'; } else ann='JNC skip'; break; }
      case 'JS':  { if(fl.S) { jumpTo(operands[0]); ann='JS taken';  } else ann='JS skip';  break; }
      case 'JNS': { if(!fl.S){ jumpTo(operands[0]); ann='JNS taken'; } else ann='JNS skip'; break; }
      case 'JO':  { if(fl.O) { jumpTo(operands[0]); ann='JO taken';  } else ann='JO skip';  break; }
      case 'JNO': { if(!fl.O){ jumpTo(operands[0]); ann='JNO taken'; } else ann='JNO skip'; break; }
      case 'JP':  case 'JPE': { if(fl.P) { jumpTo(operands[0]); ann='JP taken';  } else ann='JP skip';  break; }
      case 'JNP': case 'JPO': { if(!fl.P){ jumpTo(operands[0]); ann='JNP taken'; } else ann='JNP skip'; break; }
      case 'JA':  case 'JNBE': { if(!fl.C&&!fl.Z){ jumpTo(operands[0]); ann='JA taken';  } else ann='JA skip';  break; }
      case 'JNA': case 'JBE':  { if(fl.C||fl.Z)  { jumpTo(operands[0]); ann='JBE taken'; } else ann='JBE skip'; break; }
      case 'JG':  case 'JNLE': { if(!fl.Z&&fl.S===fl.O){ jumpTo(operands[0]); ann='JG taken';  } else ann='JG skip';  break; }
      case 'JGE': case 'JNL':  { if(fl.S===fl.O)        { jumpTo(operands[0]); ann='JGE taken'; } else ann='JGE skip'; break; }
      case 'JL':  case 'JNGE': { if(fl.S!==fl.O)        { jumpTo(operands[0]); ann='JL taken';  } else ann='JL skip';  break; }
      case 'JLE': case 'JNG':  { if(fl.Z||fl.S!==fl.O)  { jumpTo(operands[0]); ann='JLE taken'; } else ann='JLE skip'; break; }
      case 'JCXZ':   { if((r.CX??0)===0){ jumpTo(operands[0]); ann='JCXZ taken'; } else ann='JCXZ skip'; break; }
      case 'LOOP':   { r.CX=((r.CX??0)-1)&0xFFFF; if(r.CX!==0){ jumpTo(operands[0]); ann=`LOOP CX=${r.CX}`; } else ann='LOOP end'; break; }
      case 'LOOPE':  case 'LOOPZ':  { r.CX=((r.CX??0)-1)&0xFFFF; if(r.CX!==0&&fl.Z) { jumpTo(operands[0]); ann='LOOPE taken'; } else ann='LOOPE end'; break; }
      case 'LOOPNE': case 'LOOPNZ': { r.CX=((r.CX??0)-1)&0xFFFF; if(r.CX!==0&&!fl.Z){ jumpTo(operands[0]); ann='LOOPNZ taken';} else ann='LOOPNZ end'; break; }
      // ── Subroutine ──
      case 'CALL': case 'CALLF': { cs.push(pc); jumpTo(operands[0]); ann=`CALL`; break; }
      case 'RET':  case 'RETN': case 'RETF': { if(cs.length){ pc=cs.pop()!; ann=`RET→${pc}`; } else { halt=true; ann='RET halt'; } break; }
      // ── String ──
      case 'MOVSB': { memSet(m,r.DI??0,memGet(m,r.SI??0)); r.SI=((r.SI??0)+1)&0xFFFF; r.DI=((r.DI??0)+1)&0xFFFF; ann='MOVSB'; break; }
      case 'MOVSW': { memSet16(m,r.DI??0,memGet16(m,r.SI??0)); r.SI=((r.SI??0)+2)&0xFFFF; r.DI=((r.DI??0)+2)&0xFFFF; ann='MOVSW'; break; }
      case 'STOSB': { memSet(m,r.DI??0,(r.AX??0)&0xFF); r.DI=((r.DI??0)+1)&0xFFFF; ann='STOSB'; break; }
      case 'STOSW': { memSet16(m,r.DI??0,r.AX??0); r.DI=((r.DI??0)+2)&0xFFFF; ann='STOSW'; break; }
      case 'LODSB': { r.AX=((r.AX??0)&0xFF00)|memGet(m,r.SI??0); r.AL=r.AX&0xFF; r.SI=((r.SI??0)+1)&0xFFFF; ann='LODSB'; break; }
      case 'LODSW': { r.AX=memGet16(m,r.SI??0); r.SI=((r.SI??0)+2)&0xFFFF; ann='LODSW'; break; }
      case 'CMPSB': { const a=memGet(m,r.SI??0),b=memGet(m,r.DI??0); Object.assign(fl,calcFlags(a-b,a<b,8)); r.SI=((r.SI??0)+1)&0xFFFF; r.DI=((r.DI??0)+1)&0xFFFF; ann=`CMPSB Z=${fl.Z}`; break; }
      case 'SCASB': { const b=memGet(m,r.DI??0); Object.assign(fl,calcFlags(((r.AX??0)&0xFF)-b,((r.AX??0)&0xFF)<b,8)); r.DI=((r.DI??0)+1)&0xFFFF; ann='SCASB'; break; }
      case 'REP': case 'REPE': case 'REPNE': { r.CX=((r.CX??0)-1)&0xFFFF; ann=`${op} CX=${r.CX}`; break; }
      // ── Flags ──
      case 'CLC': { fl.C=false; ann='CLC'; break; }
      case 'STC': { fl.C=true;  ann='STC'; break; }
      case 'CMC': { fl.C=!fl.C; ann=`CMC C=${fl.C?1:0}`; break; }
      case 'CLD': { ann='CLD'; break; }
      case 'STD': { ann='STD'; break; }
      case 'CLI': { ann='CLI'; break; }
      case 'STI': { ann='STI'; break; }
      // ── I/O ──
      case 'IN':  { r[operands[0].toUpperCase()]=0; out.push(`>> IN ${operands[0]}←port ${operands[1]}=0 (simulated)`); ann='IN=0'; break; }
      case 'OUT': { const v=V(operands[1],operands[1]); out.push(`>> OUT port ${operands[0]}←${v} (0x${v.toString(16).toUpperCase()})`); ann='OUT'; break; }
      case 'INT': { out.push(`>> INT ${operands[0]} (simulated)`); ann=`INT`; break; }
      case 'IRET':{ if(cs.length){ pc=cs.pop()!; ann='IRET'; } else ann='IRET no-op'; break; }
      case 'NOP': { ann='NOP'; break; }
      case 'HLT': { halt=true; out.push('>> HLT — program halted'); ann='HLT'; break; }
      // ── BCD ──
      case 'DAA': { let al=(r.AX??0)&0xFF,oa=al; if((al&0xF)>9||fl.AC){al=(al+6)&0xFF;fl.AC=true;}else fl.AC=false; if(al>0x9F||fl.C){al=(al+0x60)&0xFF;fl.C=true;}else if(oa<=0x99)fl.C=false; r.AX=((r.AX??0)&0xFF00)|al;r.AL=al; ann=`DAA AL=0x${al.toString(16).toUpperCase()}`; break; }
      case 'DAS': { let al2=(r.AX??0)&0xFF; if((al2&0xF)>9||fl.AC){al2=(al2-6)&0xFF;fl.AC=true;}else fl.AC=false; if(al2>0x9F||fl.C){al2=(al2-0x60)&0xFF;fl.C=true;} r.AX=((r.AX??0)&0xFF00)|al2;r.AL=al2; ann=`DAS AL=0x${al2.toString(16).toUpperCase()}`; break; }
      case 'AAA': { if(((r.AX??0)&0xF)>9||fl.AC){r.AX=(((r.AX??0)+0x106)&0xFF0F);fl.AC=true;fl.C=true;}else{fl.AC=false;fl.C=false;} r.AL=(r.AX??0)&0xFF;r.AH=((r.AX??0)>>8)&0xFF; ann='AAA'; break; }
      case 'AAS': { if(((r.AX??0)&0xF)>9||fl.AC){r.AX=(((r.AX??0)-6)&0xFF);r.AH=((r.AH??0)-1)&0xFF;fl.AC=true;fl.C=true;}else{fl.AC=false;fl.C=false;} r.AL=(r.AX??0)&0xFF; ann='AAS'; break; }
      case 'AAM': { const base=operands[0]?V(operands[0]):10; const al=(r.AX??0)&0xFF; r.AH=Math.floor(al/base)&0xFF; r.AX=(r.AH<<8)|(al%base); r.AL=r.AX&0xFF; Object.assign(fl,calcFlags(r.AL,false,8)); ann='AAM'; break; }
      case 'AAD': { const base=operands[0]?V(operands[0]):10; const ah=((r.AX??0)>>8)&0xFF,al=(r.AX??0)&0xFF; r.AX=(ah*base+al)&0xFF; r.AH=0;r.AL=r.AX; Object.assign(fl,calcFlags(r.AL,false,8)); ann='AAD'; break; }
      default: throw new Error(`Unknown 8086 instruction: ${op}`);
    }
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    out.push(`>> ERROR line ${instr.srcLine+1}: ${msg}`);
    halt=true; ann=`ERROR: ${msg}`;
  }

  syncBytes();
  r.IP = pc;
  return { ctx:{...ctx,regs:r,mem:m,flags:fl,stack:st,output:out,pc,cycles:ctx.cycles+cyc}, callStack:cs, halt, annotation:ann, instrCycles:cyc };
}

// ═══════════════════════════════════════════════════════════
// 8085 EXECUTOR
// ═══════════════════════════════════════════════════════════
function exec8085(instr: ParsedInstr, ctx: ExecContext, _i: ParsedInstr[], labels: Record<string,number>, callStack: number[]): ExecResult {
  const { op, operands } = instr;
  const r=({...ctx.regs}); const m=({...ctx.mem}); const fl=({...ctx.flags});
  const st=[...ctx.stack]; const out=[...ctx.output]; const cs=[...callStack];
  let pc=ctx.pc+1; let halt=false; let ann='';
  const cyc=CYCLE_COUNTS_8085[op]??4;
  const getHL=()=>((r.H??0)<<8)|(r.L??0);
  const setHL=(v:number)=>{r.H=(v>>8)&0xFF;r.L=v&0xFF;};
  const getBC=()=>((r.B??0)<<8)|(r.C??0);
  const setBC=(v:number)=>{r.B=(v>>8)&0xFF;r.C=v&0xFF;};
  const getDE=()=>((r.D??0)<<8)|(r.E??0);
  const setDE=(v:number)=>{r.D=(v>>8)&0xFF;r.E=v&0xFF;};
  const regVal=(s:string):number=>{ const u=s.trim().toUpperCase(); if(u==='M')return memGet(m,getHL()); if(u.startsWith('#'))return parseNum(u.slice(1))&0xFF; if(u.endsWith('H')||/^[0-9]+$/.test(u))return parseNum(u)&0xFF; return r[u]??0; };
  const jumpTo=(label:string):void=>{ const t=labels[label.toUpperCase()]; if(t===undefined)throw new Error(`Undefined label: ${label}`); pc=t; };
  try {
    switch(op){
      case 'MVI': { const d=operands[0].toUpperCase(); const v=parseNum(operands[1])&0xFF; if(d==='M')memSet(m,getHL(),v);else r[d]=v; ann=`${d}←${v}`; break; }
      case 'MOV': { const d=operands[0].toUpperCase(),s=operands[1].toUpperCase(); const v=regVal(s); if(d==='M')memSet(m,getHL(),v&0xFF);else r[d]=v&0xFF; ann=`${d}←${v}`; break; }
      case 'LXI': { const p=operands[0].toUpperCase(); const v=parseNum(operands[1])&0xFFFF; if(p==='H')setHL(v);else if(p==='B')setBC(v);else if(p==='D')setDE(v);else if(p==='SP')r.SP=v; ann=`${p}←0x${v.toString(16).toUpperCase()}`; break; }
      case 'LDA':  { const a=parseNum(operands[0])&0xFFFF; r.A=memGet(m,a); ann=`A←mem[${a}]=${r.A}`; break; }
      case 'STA':  { const a=parseNum(operands[0])&0xFFFF; memSet(m,a,r.A??0); ann=`mem[${a}]←A`; break; }
      case 'LHLD': { const a=parseNum(operands[0])&0xFFFF; r.L=memGet(m,a);r.H=memGet(m,(a+1)&0xFFFF); ann='LHLD'; break; }
      case 'SHLD': { const a=parseNum(operands[0])&0xFFFF; memSet(m,a,r.L??0);memSet(m,(a+1)&0xFFFF,r.H??0); ann='SHLD'; break; }
      case 'LDAX': { const p=operands[0].toUpperCase(); r.A=memGet(m,p==='B'?getBC():getDE()); ann=`A←${r.A}`; break; }
      case 'STAX': { const p=operands[0].toUpperCase(); memSet(m,p==='B'?getBC():getDE(),r.A??0); ann='STAX'; break; }
      case 'XCHG': { const tH=r.H??0,tL=r.L??0; r.H=r.D??0;r.L=r.E??0;r.D=tH;r.E=tL; ann='HL↔DE'; break; }
      case 'ADD':  { const v=regVal(operands[0]); const res=(r.A??0)+v; fl.C=res>0xFF; r.A=res&0xFF; Object.assign(fl,{...fl,...calcFlags(res,fl.C,8)}); ann=`A+${v}=${r.A}`; break; }
      case 'ADC':  { const v=regVal(operands[0]); const res=(r.A??0)+v+(fl.C?1:0); fl.C=res>0xFF; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A+${v}+C=${r.A}`; break; }
      case 'ADI':  { const v=parseNum(operands[0])&0xFF; const res=(r.A??0)+v; fl.C=res>0xFF; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A+${v}=${r.A}`; break; }
      case 'ACI':  { const v=parseNum(operands[0])&0xFF; const res=(r.A??0)+v+(fl.C?1:0); fl.C=res>0xFF; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A+${v}+C=${r.A}`; break; }
      case 'SUB':  { const v=regVal(operands[0]); const res=(r.A??0)-v; fl.C=res<0; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A-${v}=${r.A}`; break; }
      case 'SBB':  { const v=regVal(operands[0]); const res=(r.A??0)-v-(fl.C?1:0); fl.C=res<0; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A-${v}-C=${r.A}`; break; }
      case 'SUI':  { const v=parseNum(operands[0])&0xFF; const res=(r.A??0)-v; fl.C=res<0; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A-${v}=${r.A}`; break; }
      case 'SBI':  { const v=parseNum(operands[0])&0xFF; const res=(r.A??0)-v-(fl.C?1:0); r.A=res&0xFF; Object.assign(fl,calcFlags(res,res<0,8)); ann=`A-${v}-C=${r.A}`; break; }
      case 'INR':  { const d=operands[0].toUpperCase(); const old=d==='M'?memGet(m,getHL()):r[d]??0; const nv=(old+1)&0xFF; if(d==='M')memSet(m,getHL(),nv);else r[d]=nv; Object.assign(fl,{...fl,...calcFlags(nv,fl.C,8)}); ann=`${d}++=${nv}`; break; }
      case 'DCR':  { const d=operands[0].toUpperCase(); const old=d==='M'?memGet(m,getHL()):r[d]??0; const nv=(old-1)&0xFF; if(d==='M')memSet(m,getHL(),nv);else r[d]=nv; Object.assign(fl,{...fl,...calcFlags(nv,fl.C,8)}); ann=`${d}--=${nv}`; break; }
      case 'INX':  { const p=operands[0].toUpperCase(); if(p==='H')setHL((getHL()+1)&0xFFFF);else if(p==='B')setBC((getBC()+1)&0xFFFF);else if(p==='D')setDE((getDE()+1)&0xFFFF);else if(p==='SP')r.SP=((r.SP??0)+1)&0xFFFF; ann=`${p}++`; break; }
      case 'DCX':  { const p=operands[0].toUpperCase(); if(p==='H')setHL((getHL()-1)&0xFFFF);else if(p==='B')setBC((getBC()-1)&0xFFFF);else if(p==='D')setDE((getDE()-1)&0xFFFF);else if(p==='SP')r.SP=((r.SP??0)-1)&0xFFFF; ann=`${p}--`; break; }
      case 'DAD':  { const p=operands[0].toUpperCase(); let v16=0; if(p==='H')v16=getHL();else if(p==='B')v16=getBC();else if(p==='D')v16=getDE();else if(p==='SP')v16=r.SP??0; const res=getHL()+v16; fl.C=res>0xFFFF; setHL(res&0xFFFF); ann=`HL+=${p}`; break; }
      case 'ANA':  { const v=regVal(operands[0]); r.A=((r.A??0)&v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A&=${v}`; break; }
      case 'ANI':  { const v=parseNum(operands[0])&0xFF; r.A=((r.A??0)&v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A&=${v}`; break; }
      case 'ORA':  { const v=regVal(operands[0]); r.A=((r.A??0)|v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A|=${v}`; break; }
      case 'ORI':  { const v=parseNum(operands[0])&0xFF; r.A=((r.A??0)|v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A|=${v}`; break; }
      case 'XRA':  { const v=regVal(operands[0]); r.A=((r.A??0)^v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A^=${v}`; break; }
      case 'XRI':  { const v=parseNum(operands[0])&0xFF; r.A=((r.A??0)^v)&0xFF; Object.assign(fl,calcFlags(r.A,false,8)); ann=`A^=${v}`; break; }
      case 'CMA':  { r.A=~(r.A??0)&0xFF; ann=`~A=${r.A}`; break; }
      case 'CMP':  { const v=regVal(operands[0]); const res=(r.A??0)-v; Object.assign(fl,calcFlags(res,res<0,8)); ann=`CMP Z=${fl.Z}`; break; }
      case 'CPI':  { const v=parseNum(operands[0])&0xFF; const res=(r.A??0)-v; Object.assign(fl,calcFlags(res,res<0,8)); ann=`CPI Z=${fl.Z}`; break; }
      case 'RLC':  { const b=((r.A??0)>>7)&1; r.A=(((r.A??0)<<1)|b)&0xFF; fl.C=b===1; ann=`RLC A=${r.A}`; break; }
      case 'RRC':  { const b=(r.A??0)&1; r.A=(((r.A??0)>>1)|(b<<7))&0xFF; fl.C=b===1; ann=`RRC A=${r.A}`; break; }
      case 'RAL':  { const c=fl.C?1:0; fl.C=((r.A??0)>>7)!==0; r.A=(((r.A??0)<<1)|c)&0xFF; ann=`RAL A=${r.A}`; break; }
      case 'RAR':  { const c=fl.C?1:0; fl.C=((r.A??0)&1)!==0; r.A=(((r.A??0)>>1)|(c<<7))&0xFF; ann=`RAR A=${r.A}`; break; }
      case 'PUSH': { const p=operands[0].toUpperCase(); let hi=0,lo=0; if(p==='B'){hi=r.B??0;lo=r.C??0;}else if(p==='D'){hi=r.D??0;lo=r.E??0;}else if(p==='H'){hi=r.H??0;lo=r.L??0;}else if(p==='PSW'){hi=r.A??0;lo=0;} st.push(hi);st.push(lo);r.SP=((r.SP??0)-2)&0xFFFF; ann=`PUSH ${p}`; break; }
      case 'POP':  { const p=operands[0].toUpperCase(); const lo=st.pop()??0,hi=st.pop()??0; if(p==='B'){r.B=hi;r.C=lo;}else if(p==='D'){r.D=hi;r.E=lo;}else if(p==='H'){r.H=hi;r.L=lo;}else if(p==='PSW'){r.A=hi;} r.SP=((r.SP??0)+2)&0xFFFF; ann=`POP ${p}`; break; }
      case 'JMP':  { jumpTo(operands[0]); ann='JMP'; break; }
      case 'JZ':  case 'JE':  { if(fl.Z) { jumpTo(operands[0]); ann='JZ taken'; }  else ann='JZ skip';  break; }
      case 'JNZ': case 'JNE': { if(!fl.Z){ jumpTo(operands[0]); ann='JNZ taken'; } else ann='JNZ skip'; break; }
      case 'JC':  case 'JB':  { if(fl.C) { jumpTo(operands[0]); ann='JC taken';  } else ann='JC skip';  break; }
      case 'JNC': case 'JNB': { if(!fl.C){ jumpTo(operands[0]); ann='JNC taken'; } else ann='JNC skip'; break; }
      case 'JM':  { if(fl.S) { jumpTo(operands[0]); ann='JM taken';  } else ann='JM skip';  break; }
      case 'JP':  { if(!fl.S){ jumpTo(operands[0]); ann='JP taken';  } else ann='JP skip';  break; }
      case 'JPE': { if(fl.P) { jumpTo(operands[0]); ann='JPE taken'; } else ann='JPE skip'; break; }
      case 'JPO': { if(!fl.P){ jumpTo(operands[0]); ann='JPO taken'; } else ann='JPO skip'; break; }
      case 'CALL': { cs.push(pc); jumpTo(operands[0]); ann='CALL'; break; }
      case 'CC':   { if(fl.C) { cs.push(pc); jumpTo(operands[0]); ann='CC taken';  } else ann='CC skip';  break; }
      case 'CNC':  { if(!fl.C){ cs.push(pc); jumpTo(operands[0]); ann='CNC taken'; } else ann='CNC skip'; break; }
      case 'CZ':   { if(fl.Z) { cs.push(pc); jumpTo(operands[0]); ann='CZ taken';  } else ann='CZ skip';  break; }
      case 'CNZ':  { if(!fl.Z){ cs.push(pc); jumpTo(operands[0]); ann='CNZ taken'; } else ann='CNZ skip'; break; }
      case 'CM':   { if(fl.S) { cs.push(pc); jumpTo(operands[0]); ann='CM taken';  } else ann='CM skip';  break; }
      case 'CP':   { if(!fl.S){ cs.push(pc); jumpTo(operands[0]); ann='CP taken';  } else ann='CP skip';  break; }
      case 'RET':  { if(cs.length){ pc=cs.pop()!; ann='RET'; } else { halt=true; ann='RET halt'; } break; }
      case 'RC':   { if(fl.C&&cs.length) { pc=cs.pop()!; ann='RC taken';  } else ann='RC skip';  break; }
      case 'RNC':  { if(!fl.C&&cs.length){ pc=cs.pop()!; ann='RNC taken'; } else ann='RNC skip'; break; }
      case 'RZ':   { if(fl.Z&&cs.length) { pc=cs.pop()!; ann='RZ taken';  } else ann='RZ skip';  break; }
      case 'RNZ':  { if(!fl.Z&&cs.length){ pc=cs.pop()!; ann='RNZ taken'; } else ann='RNZ skip'; break; }
      case 'RM':   { if(fl.S&&cs.length) { pc=cs.pop()!; ann='RM taken';  } else ann='RM skip';  break; }
      case 'RP':   { if(!fl.S&&cs.length){ pc=cs.pop()!; ann='RP taken';  } else ann='RP skip';  break; }
      case 'RST':  { const n=parseNum(operands[0])&0x07; cs.push(pc); pc=n*8; ann=`RST ${n}`; break; }
      case 'PCHL': { r.PC=getHL(); pc=r.PC; ann='PC←HL'; break; }
      case 'SPHL': { r.SP=getHL(); ann='SP←HL'; break; }
      case 'XTHL': { const tH=r.H??0,tL=r.L??0; if(st.length>=2){r.H=st[st.length-2];r.L=st[st.length-1];st[st.length-2]=tH;st[st.length-1]=tL;} ann='HL↔stack'; break; }
      case 'STC':  { fl.C=true; ann='STC'; break; }
      case 'CMC':  { fl.C=!fl.C; ann=`CMC C=${fl.C?1:0}`; break; }
      case 'EI':   { out.push('>> EI: interrupts enabled'); ann='EI'; break; }
      case 'DI':   { out.push('>> DI: interrupts disabled'); ann='DI'; break; }
      case 'NOP':  { ann='NOP'; break; }
      case 'HLT':  { halt=true; out.push('>> HLT — halted'); ann='HLT'; break; }
      case 'IN':   { r.A=0; out.push(`>> IN port ${operands[0]}=0 (sim)`); ann='IN=0'; break; }
      case 'OUT':  { out.push(`>> OUT port ${operands[0]}←A=${r.A??0}`); ann='OUT'; break; }
      default: throw new Error(`Unknown 8085 instruction: ${op}`);
    }
  } catch(e:unknown){ const msg=e instanceof Error?e.message:String(e); out.push(`>> ERROR line ${instr.srcLine+1}: ${msg}`); halt=true; ann=`ERROR: ${msg}`; }
  r.PC=pc;
  return { ctx:{...ctx,regs:r,mem:m,flags:fl,stack:st,output:out,pc,cycles:ctx.cycles+cyc}, callStack:cs, halt, annotation:ann, instrCycles:cyc };
}

// ═══════════════════════════════════════════════════════════
// 8051 EXECUTOR
// ═══════════════════════════════════════════════════════════
function exec8051(instr: ParsedInstr, ctx: ExecContext, _i: ParsedInstr[], labels: Record<string,number>, callStack: number[]): ExecResult {
  const { op, operands } = instr;
  const r=({...ctx.regs}); const m=({...ctx.mem}); const fl=({...ctx.flags});
  const st=[...ctx.stack]; const out=[...ctx.output]; const cs=[...callStack];
  let pc=ctx.pc+1; let halt=false; let ann='';
  const cyc=CYCLE_COUNTS_8051[op]??1;
  const V=(s:string):number=>{ const u=s.trim().toUpperCase(); if(u==='ACC'||u==='A')return r.A??0; if(u==='B')return r.B??0; if(u.startsWith('#'))return parseNum(u.slice(1))&0xFF; if(u.startsWith('@'))return memGet(m,(r[u.slice(1)]??0)&0xFF); if(/^R[0-7]$/.test(u))return r[u]??0; if(u==='DPTR')return r.DPTR??0; if(u==='C')return fl.C?1:0; return parseNum(u)&0xFF; };
  const jumpTo=(label:string):void=>{ const key=label.trim().toUpperCase(); if(key==='$'){halt=true;out.push('>> SJMP $ — halted');return;} const t=labels[key]; if(t===undefined)throw new Error(`Undefined label: ${label}`); pc=t; };
  try {
    switch(op){
      case 'MOV': { const dst=operands[0].trim().toUpperCase(); const val=V(operands[1]??'0')&0xFF; if(dst==='A'||dst==='ACC'){r.A=val;ann=`A←${val}`;}else if(dst==='B'){r.B=val;ann=`B←${val}`;}else if(dst==='DPTR'){r.DPTR=parseNum(operands[1].startsWith('#')?operands[1].slice(1):operands[1])&0xFFFF;ann=`DPTR←${r.DPTR}`;}else if(/^R[0-7]$/.test(dst)){r[dst]=val;ann=`${dst}←${val}`;}else if(dst.startsWith('@')){const addr=(r[dst.slice(1)]??0)&0xFF;memSet(m,addr,val);ann=`mem[${dst.slice(1)}]←${val}`;}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,val);ann=`mem[0x${addr.toString(16).toUpperCase()}]←${val}`;} break; }
      case 'MOVX': { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){r.A=memGet(m,r.DPTR??0);ann='A←XMEM';}else{memSet(m,r.DPTR??0,r.A??0);ann='XMEM←A';} break; }
      case 'MOVC': { r.A=memGet(m,((r.DPTR??0)+(r.A??0))&0xFFFF); ann='A←CODE'; break; }
      case 'XCH':  { const dst=operands[1].trim().toUpperCase(); const tmp=r.A??0; if(/^R[0-7]$/.test(dst)){r.A=r[dst]??0;r[dst]=tmp;}else if(dst.startsWith('@')){const addr=(r[dst.slice(1)]??0)&0xFF;r.A=memGet(m,addr);memSet(m,addr,tmp);}else{const addr=parseNum(operands[1])&0xFF;r.A=memGet(m,addr);memSet(m,addr,tmp);} ann='XCH'; break; }
      case 'PUSH': { const src=operands[0].trim().toUpperCase(); let val=0; if(src==='ACC'||src==='A')val=r.A??0;else if(src==='B')val=r.B??0;else if(/^R[0-7]$/.test(src))val=r[src]??0;else val=memGet(m,parseNum(operands[0])&0xFF); st.push(val);r.SP=((r.SP??0)+1)&0xFF; ann=`PUSH ${src}`; break; }
      case 'POP':  { const dst=operands[0].trim().toUpperCase(); const val=st.pop()??0; if(dst==='ACC'||dst==='A')r.A=val;else if(dst==='B')r.B=val;else if(/^R[0-7]$/.test(dst))r[dst]=val;else memSet(m,parseNum(operands[0])&0xFF,val); r.SP=((r.SP??0)-1)&0xFF; ann=`POP→${dst}`; break; }
      case 'ADD':  { const v=V(operands[1]??'0')&0xFF; const old=r.A??0,res=old+v; fl.C=res>0xFF;fl.AC=((old&0xF)+(v&0xF))>0xF; r.A=res&0xFF; Object.assign(fl,{...fl,...calcFlags(res,fl.C,8)}); ann=`A:${old}+${v}=${r.A}`; break; }
      case 'ADDC': { const v=V(operands[1]??'0')&0xFF; const res=(r.A??0)+v+(fl.C?1:0); fl.C=res>0xFF; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A+${v}+C=${r.A}`; break; }
      case 'SUBB': { const v=V(operands[1]??'0')&0xFF; const res=(r.A??0)-v-(fl.C?1:0); fl.C=res<0; r.A=res&0xFF; Object.assign(fl,calcFlags(res,fl.C,8)); ann=`A-${v}-C=${r.A}`; break; }
      case 'INC':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){r.A=((r.A??0)+1)&0xFF;ann='A++';}else if(dst==='DPTR'){r.DPTR=((r.DPTR??0)+1)&0xFFFF;ann='DPTR++';}else if(/^R[0-7]$/.test(dst)){r[dst]=((r[dst]??0)+1)&0xFF;ann=`${dst}++`;}else if(dst.startsWith('@')){const addr=(r[dst.slice(1)]??0)&0xFF;memSet(m,addr,(memGet(m,addr)+1)&0xFF);ann='mem++';}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,(memGet(m,addr)+1)&0xFF);ann='mem++';} break; }
      case 'DEC':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){r.A=((r.A??0)-1)&0xFF;ann='A--';}else if(/^R[0-7]$/.test(dst)){r[dst]=((r[dst]??0)-1)&0xFF;ann=`${dst}--`;}else if(dst.startsWith('@')){const addr=(r[dst.slice(1)]??0)&0xFF;memSet(m,addr,(memGet(m,addr)-1)&0xFF);ann='mem--';}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,(memGet(m,addr)-1)&0xFF);ann='mem--';} break; }
      case 'MUL':  { const res=(r.A??0)*(r.B??0); r.A=res&0xFF;r.B=(res>>8)&0xFF;fl.C=false;fl.O=res>0xFF; ann=`A*B`; break; }
      case 'DIV':  { if(!(r.B??0)){out.push('>> ERROR: DIV/0');halt=true;break;} r.A=Math.floor((r.A??0)/(r.B??1))&0xFF;r.B=(r.A??0)%(r.B??1);fl.C=false; ann='A/B'; break; }
      case 'DA':   { let a2=r.A??0; if((a2&0xF)>9||fl.AC)a2=(a2+6)&0xFF; if(a2>0x99||fl.C){a2=(a2+0x60)&0xFF;fl.C=true;} r.A=a2; ann=`DA A=${r.A}`; break; }
      case 'ANL':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){const v=V(operands[1]??'0')&0xFF;r.A=((r.A??0)&v)&0xFF;ann=`A&=${v}`;}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,memGet(m,addr)&(V(operands[1]??'0')&0xFF));ann='mem&=';} break; }
      case 'ORL':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){const v=V(operands[1]??'0')&0xFF;r.A=((r.A??0)|v)&0xFF;ann=`A|=${v}`;}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,memGet(m,addr)|(V(operands[1]??'0')&0xFF));ann='mem|=';} break; }
      case 'XRL':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){const v=V(operands[1]??'0')&0xFF;r.A=((r.A??0)^v)&0xFF;ann=`A^=${v}`;}else{const addr=parseNum(operands[0])&0xFF;memSet(m,addr,memGet(m,addr)^(V(operands[1]??'0')&0xFF));ann='mem^=';} break; }
      case 'CLR':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){r.A=0;ann='A=0';}else if(dst==='C'){fl.C=false;ann='CY=0';}else{memSet(m,parseNum(operands[0])&0xFF,0);ann='mem=0';} break; }
      case 'CPL':  { const dst=operands[0].trim().toUpperCase(); if(dst==='A'||dst==='ACC'){r.A=~(r.A??0)&0xFF;ann=`~A=${r.A}`;}else if(dst==='C'){fl.C=!fl.C;ann=`CY=${fl.C?1:0}`;} break; }
      case 'SETB': { if(operands[0].trim().toUpperCase()==='C')fl.C=true; ann='SETB'; break; }
      case 'SWAP': { r.A=((r.A??0)&0x0F)<<4|(((r.A??0)&0xF0)>>4); ann='SWAP'; break; }
      case 'RL':   { const b=((r.A??0)>>7)&1; r.A=(((r.A??0)<<1)|b)&0xFF; ann=`RL A=${r.A}`; break; }
      case 'RR':   { const b=(r.A??0)&1; r.A=(((r.A??0)>>1)|(b<<7))&0xFF; ann=`RR A=${r.A}`; break; }
      case 'RLC':  { const b=((r.A??0)>>7)&1,c=fl.C?1:0; fl.C=b===1; r.A=(((r.A??0)<<1)|c)&0xFF; ann=`RLC A=${r.A}`; break; }
      case 'RRC':  { const b=(r.A??0)&1,c=fl.C?1:0; fl.C=b===1; r.A=(((r.A??0)>>1)|(c<<7))&0xFF; ann=`RRC A=${r.A}`; break; }
      case 'SJMP': case 'AJMP': case 'LJMP': case 'JMP': { jumpTo(operands[0]); ann=op; break; }
      case 'JZ':   { if((r.A??0)===0){ jumpTo(operands[0]);ann='JZ taken'; }else ann='JZ skip'; break; }
      case 'JNZ':  { if((r.A??0)!==0){ jumpTo(operands[0]);ann='JNZ taken';}else ann='JNZ skip'; break; }
      case 'JC':   { if(fl.C){ jumpTo(operands[0]);ann='JC taken'; }else ann='JC skip'; break; }
      case 'JNC':  { if(!fl.C){jumpTo(operands[0]);ann='JNC taken';}else ann='JNC skip'; break; }
      case 'JB':   { const bn=parseNum(operands[0])&0x07,bv=((r.A??0)>>bn)&1; if(bv){jumpTo(operands[1]);ann=`JB bit${bn}=1`;}else ann=`JB skip`; break; }
      case 'JNB':  { const bn=parseNum(operands[0])&0x07,bv=((r.A??0)>>bn)&1; if(!bv){jumpTo(operands[1]);ann=`JNB bit${bn}=0`;}else ann='JNB skip'; break; }
      case 'JBC':  { const bn=parseNum(operands[0])&0x07,bv=((r.A??0)>>bn)&1; if(bv){r.A=(r.A??0)&~(1<<bn);jumpTo(operands[1]);ann='JBC taken';}else ann='JBC skip'; break; }
      case 'DJNZ': { const dst=operands[0].trim().toUpperCase(); if(/^R[0-7]$/.test(dst)){r[dst]=((r[dst]??0)-1)&0xFF;if(r[dst]!==0){jumpTo(operands[1]);ann=`DJNZ ${dst}=${r[dst]}`;}else ann='DJNZ end';}else{const addr=parseNum(operands[0])&0xFF;const v=(memGet(m,addr)-1)&0xFF;memSet(m,addr,v);if(v!==0){jumpTo(operands[1]);ann=`DJNZ mem=${v}`;}else ann='DJNZ end';} break; }
      case 'CJNE': { const a=V(operands[0])&0xFF,b=V(operands[1])&0xFF; fl.C=a<b;fl.Z=a===b; if(a!==b){jumpTo(operands[2]);ann=`CJNE ${a}≠${b}`;}else ann='CJNE equal'; break; }
      case 'LCALL': case 'ACALL': case 'CALL': { cs.push(pc); jumpTo(operands[0]); ann=op; break; }
      case 'RET': case 'RETI': { if(cs.length){pc=cs.pop()!;ann=op;}else{halt=true;ann=`${op} halt`;} break; }
      case 'NOP':  { ann='NOP'; break; }
      default: throw new Error(`Unknown 8051 instruction: ${op}`);
    }
  } catch(e:unknown){ const msg=e instanceof Error?e.message:String(e); out.push(`>> ERROR line ${instr.srcLine+1}: ${msg}`); halt=true; ann=`ERROR: ${msg}`; }
  r.PC=pc;
  return { ctx:{...ctx,regs:r,mem:m,flags:fl,stack:st,output:out,pc,cycles:ctx.cycles+cyc}, callStack:cs, halt, annotation:ann, instrCycles:cyc };
}

// ─── Decorative ───────────────────────────────────────────
function TetrisBlock({ color, size=14, style={} }: { color:string; size?:number; style?:React.CSSProperties }) {
  return <div style={{ width:size, height:size, background:color, flexShrink:0, boxShadow:`inset -2px -2px 0 rgba(0,0,0,.5),inset 2px 2px 0 rgba(255,255,255,.3)`, border:'1px solid rgba(0,0,0,.3)', ...style }} />;
}
function TetrisRow({ count=32, reversed=false }: { count?:number; reversed?:boolean }) {
  return (
    <div style={{ display:'flex', gap:3, padding:'4px 10px', justifyContent:reversed?'flex-end':'flex-start', flexShrink:0 }}>
      {Array.from({length:count}).map((_,i) => <TetrisBlock key={i} color={COLORS[i%5]} size={12} style={{ opacity:0.2+(i%3)*0.12 }} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
interface Props { onBack?: () => void; }

export default function AssemblyCompiler({ onBack }: Props) {
  const [arch, setArch]             = useState<ArchType>('8086');
  const [code, setCode]             = useState<string>(EXAMPLES['8086']);
  const [execState, setExecState]   = useState<ExecState>('idle');
  const [viewMode, setViewMode]     = useState<ViewMode>('code');
  const [addrMode, setAddrMode]     = useState<AddrMode>('immediate');
  const [showHelp, setShowHelp]     = useState(false);
  const [darkMode, setDarkMode]     = useState(true);
  const [colorIdx, setColorIdx]     = useState(0);
  const [error, setError]           = useState<string|null>(null);
  const [hlReg, setHlReg]           = useState<string|null>(null);
  const [snapshots, setSnapshots]   = useState<Snapshot[]>([]);
  const [showMemEditor, setShowMemEditor] = useState(false);
  const [showInputEditor, setShowInputEditor] = useState(false);
  const [memPreloads, setMemPreloads] = useState<MemPreload[]>([
    { id:1, addrRaw:'0200H', valRaw:'05H', addrErr:'', valErr:'' },
    { id:2, addrRaw:'0201H', valRaw:'00H', addrErr:'', valErr:'' },
  ]);
  const [preloadIdCtr, setPreloadIdCtr] = useState(3);
  // Register Inputs: pre-set register values before execution
  const [regInputs, setRegInputs] = useState<InputDef[]>([]);
  const [regInputIdCtr, setRegInputIdCtr] = useState(1);

  const [memViewBase, setMemViewBase]   = useState(0x0200);
  const [memViewInput, setMemViewInput] = useState('0200H');
  const [preloadedCells, setPreloadedCells] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell]   = useState<{addr:number;val:string}|null>(null);
  const [lastCyc, setLastCyc]           = useState(0);

  const [instrs, setInstrs]   = useState<ParsedInstr[]>([]);
  const [labels, setLabels]   = useState<Record<string,number>>({});
  const [callStack, setCallStack] = useState<number[]>([]);

  const [ctx, setCtx] = useState<ExecContext>({
    regs:defaultRegs('8086'), flags:defaultFlags(), mem:emptyMem(),
    stack:[], output:[], pc:0, cycles:0,
  });

  const execRef   = useRef<ReturnType<typeof setTimeout>|null>(null);
  const ctxRef    = useRef<ExecContext>(ctx);
  const csRef     = useRef<number[]>(callStack);
  const outputRef = useRef<HTMLDivElement>(null);
  ctxRef.current  = ctx;
  csRef.current   = callStack;

  useEffect(() => { const t=setInterval(()=>setColorIdx(c=>(c+1)%COLORS.length),300); return ()=>clearInterval(t); }, []);
  useEffect(() => { if(outputRef.current) outputRef.current.scrollTop=outputRef.current.scrollHeight; }, [ctx.output]);

  const flash = (reg: string): void => { setHlReg(reg.toUpperCase()); setTimeout(()=>setHlReg(null),500); };

  const T: ThemeColors = darkMode
    ? { bg:'#0a0a14', panel:'rgba(0,0,0,0.5)', border:'#1a1a2e', text:'#ccc', sub:'#555', code:'#06FFA5', comment:'#444', editor:'#000', output:'#000' }
    : { bg:'#f0f4ff', panel:'rgba(255,255,255,0.8)', border:'#dde', text:'#111', sub:'#888', code:'#006630', comment:'#999', editor:'#fff', output:'#f8f8ff' };

  const reset = useCallback((): void => {
    if(execRef.current){ clearTimeout(execRef.current); execRef.current=null; }
    setCtx({ regs:defaultRegs(arch), flags:defaultFlags(), mem:emptyMem(), stack:[], output:[], pc:0, cycles:0 });
    setCallStack([]); setInstrs([]); setLabels({}); setSnapshots([]);
    setExecState('idle'); setError(null); setPreloadedCells(new Set()); setLastCyc(0);
    playSfx(300);
  }, [arch]);

  const switchArch = (a: ArchType): void => {
    if(execRef.current){ clearTimeout(execRef.current); execRef.current=null; }
    setArch(a); setCode(EXAMPLES[a]);
    setCtx({ regs:defaultRegs(a), flags:defaultFlags(), mem:emptyMem(), stack:[], output:[], pc:0, cycles:0 });
    setCallStack([]); setInstrs([]); setLabels({}); setSnapshots([]);
    setExecState('idle'); setError(null); setPreloadedCells(new Set()); setLastCyc(0);
    playSfx(600,'sine');
  };

  const applyPreloads = (baseMem: Record<number,number>): { mem:Record<number,number>; log:string[]; cells:Set<number> } => {
    const mem={ ...baseMem }; const log:string[]=[]; const cells=new Set<number>();
    memPreloads.forEach(p => {
      const addr=parseAnyAddr(p.addrRaw); const val=parseAnyAddr(p.valRaw);
      if(isNaN(addr)||addr<0||addr>0xFFFF){ log.push(`>> PRELOAD SKIP: bad addr "${p.addrRaw}"`); return; }
      if(isNaN(val)||val<0||val>0xFF)     { log.push(`>> PRELOAD SKIP: bad val "${p.valRaw}"`);   return; }
      memSet(mem,addr,val); cells.add(addr);
      log.push(`>> PRELOAD mem[${addr.toString(16).toUpperCase().padStart(4,'0')}H] ← ${val.toString(16).toUpperCase().padStart(2,'0')}H (${val}d)`);
    });
    return { mem, log, cells };
  };

  // Apply register inputs to initial register state
  const applyRegInputs = (baseRegs: Record<string,number>): { regs:Record<string,number>; log:string[] } => {
    const regs={ ...baseRegs }; const log:string[]=[];
    regInputs.forEach(ri => {
      const dst=ri.dest.trim().toUpperCase();
      const val=parseAnyAddr(ri.valRaw);
      if(!dst||isNaN(val)||val<0){ log.push(`>> INPUT SKIP: bad value for ${dst}`); return; }
      const max=ri.bits===16?0xFFFF:0xFF;
      if(val>max){ log.push(`>> INPUT SKIP: ${dst} value ${val} out of range for ${ri.bits}-bit`); return; }
      // Write to register and keep sub-regs in sync
      regs[dst]=val;
      if(dst==='AX'){regs.AL=val&0xFF;regs.AH=(val>>8)&0xFF;}
      if(dst==='BX'){regs.BL=val&0xFF;regs.BH=(val>>8)&0xFF;}
      if(dst==='CX'){regs.CL=val&0xFF;regs.CH=(val>>8)&0xFF;}
      if(dst==='DX'){regs.DL=val&0xFF;regs.DH=(val>>8)&0xFF;}
      if(dst==='AL'){regs.AX=(regs.AX&0xFF00)|val;} if(dst==='AH'){regs.AX=(regs.AX&0x00FF)|(val<<8);}
      if(dst==='BL'){regs.BX=(regs.BX&0xFF00)|val;} if(dst==='BH'){regs.BX=(regs.BX&0x00FF)|(val<<8);}
      if(dst==='CL'){regs.CX=(regs.CX&0xFF00)|val;} if(dst==='CH'){regs.CX=(regs.CX&0x00FF)|(val<<8);}
      if(dst==='DL'){regs.DX=(regs.DX&0xFF00)|val;} if(dst==='DH'){regs.DX=(regs.DX&0x00FF)|(val<<8);}
      log.push(`>> INPUT ${dst} ← ${val.toString(16).toUpperCase().padStart(ri.bits===16?4:2,'0')}H (${val}d)`);
    });
    return { regs, log };
  };

  const updatePreload = (id:number, field:'addrRaw'|'valRaw', raw:string): void => {
    setMemPreloads(prev=>prev.map(p=>{
      if(p.id!==id)return p;
      const u={ ...p, [field]:raw };
      if(field==='addrRaw'){ const v=parseAnyAddr(raw); u.addrErr=raw.trim()===''?'':(isNaN(v)||v<0||v>0xFFFF)?'Range: 0000H–FFFFH':''; }
      else                  { const v=parseAnyAddr(raw); u.valErr =raw.trim()===''?'':(isNaN(v)||v<0||v>0xFF)?'Range: 00H–FFH':''; }
      return u;
    }));
  };
  const addPreload    = (): void => { setMemPreloads(prev=>[...prev,{id:preloadIdCtr,addrRaw:'',valRaw:'',addrErr:'',valErr:''}]); setPreloadIdCtr(c=>c+1); };
  const removePreload = (id:number): void => setMemPreloads(prev=>prev.filter(p=>p.id!==id));

  // Register input helpers
  const REG_OPTIONS_8086 = ['AX','BX','CX','DX','SI','DI','BP','SP','AL','AH','BL','BH','CL','CH','DL','DH'];
  const REG_OPTIONS_8085 = ['A','B','C','D','E','H','L','SP'];
  const REG_OPTIONS_8051 = ['A','B','R0','R1','R2','R3','R4','R5','R6','R7'];
  const regOptions = arch==='8086'?REG_OPTIONS_8086:arch==='8085'?REG_OPTIONS_8085:REG_OPTIONS_8051;

  const addRegInput = (): void => {
    const def = regOptions[0];
    const bits: 8|16 = (REG8_HIGH.has(def)||REG8_LOW.has(def)||arch!=='8086') ? 8 : 16;
    setRegInputs(prev=>[...prev,{id:regInputIdCtr,name:`Input ${regInputIdCtr}`,dest:def,bits,valRaw:'',valErr:''}]);
    setRegInputIdCtr(c=>c+1);
  };
  const updateRegInput = (id:number, field:string, val:string): void => {
    setRegInputs(prev=>prev.map(ri=>{
      if(ri.id!==id)return ri;
      const u={ ...ri, [field]:val };
      if(field==='dest'){
        u.bits=(REG8_HIGH.has(val.toUpperCase())||REG8_LOW.has(val.toUpperCase())||(arch!=='8086'))?8:16;
      }
      if(field==='valRaw'){
        const v=parseAnyAddr(val);
        const max=u.bits===16?0xFFFF:0xFF;
        u.valErr=val.trim()===''?'':(isNaN(v)||v<0||v>max)?`Range: 0–${max.toString(16).toUpperCase()}H`:'';
      }
      return u;
    }));
  };
  const removeRegInput = (id:number): void => setRegInputs(prev=>prev.filter(r=>r.id!==id));

  const compile = useCallback((): void => {
    setError(null);
    const { instrs:pI, labels:pL, errors, startPC:sPC } = parseProgram(code);
    if(pI.length===0){ setError('No executable instructions found!'); playSfx(200,'square',.15); return; }
    if(errors.length){ setError(errors[0]); playSfx(200,'square',.15); return; }
    setInstrs(pI); setLabels(pL); setCallStack([]);
    const { mem:initMem, log:mLog, cells } = applyPreloads(emptyMem());
    const { regs:initRegs, log:rLog } = applyRegInputs(defaultRegs(arch));
    setPreloadedCells(cells);
    const initCtx: ExecContext = {
      regs:initRegs, flags:defaultFlags(), mem:initMem,
      stack:[], output:[
        `>> Compiled OK — ${arch} | 64KB RAM (0000H–FFFFH)`,
        `>> ${pI.length} instructions | Labels: ${Object.keys(pL).join(', ')||'none'}`,
        `>> ORG: 0x${sPC.toString(16).toUpperCase().padStart(4,'0')}`,
        ...(rLog.length?rLog:['>> No register inputs']),
        ...(mLog.length?mLog:['>> No memory preloads']),
        `>> Ready — STEP or RUN`,
      ], pc:0, cycles:0,
    };
    setCtx(initCtx);
    setSnapshots([{ step:0, memDirty:{...initMem}, regs:{...initRegs}, pc:0, instr:'(start)', annotation:'Compiled', addrMode:'register', instrCycles:0 }]);
    setExecState('compiled');
    playSfx(900,'sine',.15);
  }, [code, arch, memPreloads, regInputs]); // eslint-disable-line

  const doStep = useCallback((curCtx: ExecContext, curCs: number[]): boolean => {
    if(curCtx.pc>=instrs.length){
      setCtx(prev=>({...prev,output:[...prev.output,'>> End of program']}));
      setExecState('done'); playSfx(1100,'sine',.2); return true;
    }
    const instr=instrs[curCtx.pc];
    const mode=detectAddrMode(instr.op,instr.operands,arch);
    let result: ExecResult;
    if(arch==='8086')      result=exec8086(instr,curCtx,instrs,labels,curCs);
    else if(arch==='8085') result=exec8085(instr,curCtx,instrs,labels,curCs);
    else                   result=exec8051(instr,curCtx,instrs,labels,curCs);
    setCtx(result.ctx); setCallStack(result.callStack); setLastCyc(result.instrCycles);
    const changed=Object.entries(result.ctx.regs).filter(([k,v])=>curCtx.regs[k]!==v);
    if(changed.length) flash(changed[0][0]);
    setSnapshots(prev=>[...prev,{ step:prev.length, memDirty:{...result.ctx.mem}, regs:{...result.ctx.regs}, pc:curCtx.pc, instr:instr.raw, annotation:result.annotation, addrMode:mode, instrCycles:result.instrCycles }]);
    playSfx(400+(result.ctx.cycles%5)*80,'square',.06);
    if(result.halt){
      setExecState(result.ctx.output.some((l:string)=>l.includes('ERROR'))?'error':'done');
      playSfx(800,'sine',.15);
    }
    return result.halt;
  }, [arch,instrs,labels]);

  const stepNext     = useCallback(():void=>{ if(execState!=='compiled')return; doStep(ctxRef.current,csRef.current); },[execState,doStep]);
  const runProgram   = useCallback(():void=>{ if(execState!=='compiled')return; setExecState('running'); playSfx(1000,'sine',.15); const loop=():void=>{ const halt=doStep(ctxRef.current,csRef.current); if(!halt)execRef.current=setTimeout(loop,40); }; loop(); },[execState,doStep]);
  const stopExecution= useCallback(():void=>{ if(execRef.current){clearTimeout(execRef.current);execRef.current=null;} if(execState==='running'){setExecState('compiled');playSfx(600,'square',.1);} },[execState]);
  useEffect(()=>()=>{if(execRef.current)clearTimeout(execRef.current);},[]);

  // ── Register panel with sub-register split ────────────────
  const renderRegisters = (): React.ReactNode => {
    if (arch === '8086') {
      const pairs: [string,string,string][] = [['AX','AH','AL'],['BX','BH','BL'],['CX','CH','CL'],['DX','DH','DL']];
      const simple = ['SI','DI','BP','SP'];
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {/* 16-bit with sub-register split */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
            {pairs.map(([w,hi,lo])=>{
              const hl=hlReg===w||hlReg===hi||hlReg===lo;
              const wv=(ctx.regs as Record<string,number>)[w]??0;
              const hv=(wv>>8)&0xFF; const lv=wv&0xFF;
              return (
                <div key={w} style={{ background:hl?'rgba(6,255,165,0.12)':T.panel, border:`2px solid ${hl?'#06FFA5':T.border}`, padding:'6px 8px', transition:'all 0.3s' }}>
                  <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.38rem', marginBottom:3 }}>{w}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", color:hl?'#06FFA5':'#FFBE0B', fontSize:'0.82rem', fontWeight:'bold' }}>{wv.toString(16).toUpperCase().padStart(4,'0')}H</div>
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <div style={{ flex:1, background:'rgba(131,56,236,0.1)', border:'1px solid #8338EC44', padding:'2px 5px', borderRadius:2 }}>
                      <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.28rem' }}>{hi}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#cc88ff', fontSize:'0.62rem' }}>{hv.toString(16).toUpperCase().padStart(2,'0')}H</div>
                    </div>
                    <div style={{ flex:1, background:'rgba(58,134,255,0.1)', border:'1px solid #3A86FF44', padding:'2px 5px', borderRadius:2 }}>
                      <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#3A86FF', fontSize:'0.28rem' }}>{lo}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#88aaff', fontSize:'0.62rem' }}>{lv.toString(16).toUpperCase().padStart(2,'0')}H</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
            {simple.map(k=>{ const hl=hlReg===k; const v=(ctx.regs as Record<string,number>)[k]??0; return (
              <div key={k} style={{ background:hl?'rgba(6,255,165,0.12)':T.panel, border:`2px solid ${hl?'#06FFA5':T.border}`, padding:'5px 7px', transition:'all 0.3s' }}>
                <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.34rem', marginBottom:2 }}>{k}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", color:hl?'#06FFA5':'#FFBE0B', fontSize:'0.7rem', fontWeight:'bold' }}>{v.toString(16).toUpperCase().padStart(4,'0')}H</div>
                <div style={{ color:T.sub, fontSize:'0.52rem' }}>{v}</div>
              </div>
            ); })}
          </div>
        </div>
      );
    }
    // 8085 / 8051
    let entries: string[] = arch==='8085'?['A','B','C','D','E','H','L','SP']:['A','B','R0','R1','R2','R3','R4','R5','R6','R7'];
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
        {entries.map(k=>{ const hl=hlReg===k; const v=(ctx.regs as Record<string,number>)[k]??0; return (
          <div key={k} style={{ background:hl?'rgba(6,255,165,0.12)':T.panel, border:`2px solid ${hl?'#06FFA5':T.border}`, padding:'6px 10px', transition:'all 0.3s' }}>
            <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.38rem', marginBottom:2 }}>{k}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", color:hl?'#06FFA5':'#FFBE0B', fontSize:'0.82rem', fontWeight:'bold' }}>{v.toString(16).toUpperCase().padStart(2,'0')}H</div>
            <div style={{ color:T.sub, fontSize:'0.55rem' }}>{v}</div>
          </div>
        ); })}
      </div>
    );
  };

  const renderCode = (): React.ReactNode => {
    const lines=code.split('\n'); let ec=-1;
    return (
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.8rem', lineHeight:2 }}>
        {lines.map((line,idx)=>{
          const tr=line.trim(); const isCmt=tr.startsWith(';'); const isEmpty=!tr;
          const isDir=/^(ORG|DB|DW|EQU|END)\b/i.test(tr); const isLbl=/^[A-Z_][A-Z0-9_]*:\s*$/i.test(tr);
          const isAct=!isCmt&&!isEmpty&&!isDir&&!isLbl; if(isAct)ec++;
          const isCur=isAct&&ec===ctx.pc;
          return (
            <div key={idx} style={{ background:isCur?'rgba(6,255,165,0.12)':'transparent', borderLeft:`3px solid ${isCur?'#06FFA5':'transparent'}`, paddingLeft:8, paddingRight:8, paddingTop:1, paddingBottom:1, transition:'background 0.15s' }}>
              <span style={{ color:T.sub, marginRight:10, userSelect:'none', display:'inline-block', width:26, fontSize:'0.7rem' }}>{idx+1}</span>
              <span style={{ color:isCmt?T.comment:isLbl?'#FFBE0B':isDir?'#8338EC':isCur?'#fff':T.code }}>{line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMemGrid = (): React.ReactNode => (
    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem' }}>
      <div style={{ display:'grid', gridTemplateColumns:`54px repeat(${MEM_PAGE},1fr)`, gap:2, marginBottom:3 }}>
        <div style={{ color:T.sub, textAlign:'right', paddingRight:6, fontSize:'0.42rem' }}>addr</div>
        {Array.from({length:MEM_PAGE},(_,c)=><div key={c} style={{ textAlign:'center', color:'#3A86FF66', fontSize:'0.4rem' }}>+{c.toString(16).toUpperCase()}</div>)}
      </div>
      {[0,1,2,3].map(row=>(
        <div key={row} style={{ display:'grid', gridTemplateColumns:`54px repeat(${MEM_PAGE},1fr)`, gap:2, marginBottom:2 }}>
          <div style={{ color:'#3A86FF88', fontSize:'0.44rem', textAlign:'right', paddingRight:6, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
            {(memViewBase+row*MEM_PAGE).toString(16).toUpperCase().padStart(4,'0')}H
          </div>
          {Array.from({length:MEM_PAGE},(_,col)=>{
            const addr=memViewBase+row*MEM_PAGE+col;
            if(addr>0xFFFF)return <div key={col}/>;
            const byte=memGet(ctx.mem,addr);
            const isPre=preloadedCells.has(addr); const isEd=editingCell?.addr===addr; const nz=byte!==0;
            return (
              <div key={col}
                title={`0x${addr.toString(16).toUpperCase().padStart(4,'0')} = ${byte}d = ${byte.toString(16).toUpperCase().padStart(2,'0')}H = ${byte.toString(2).padStart(8,'0')}b`}
                onClick={()=>{ if(execState!=='idle')setEditingCell({addr,val:byte.toString(16).toUpperCase().padStart(2,'0')}); }}
                style={{ background:isEd?'#FFBE0B22':isPre?'rgba(6,255,165,0.1)':nz?'rgba(58,134,255,0.07)':darkMode?'rgba(0,0,0,0.4)':'rgba(240,244,255,0.7)', border:isEd?'1px solid #FFBE0B':isPre?'1px solid #06FFA555':nz?'1px solid #3A86FF33':'1px solid rgba(0,0,0,0.08)', padding:'3px 0', textAlign:'center', color:isEd?'#FFBE0B':isPre?'#06FFA5':nz?'#3A86FF':T.sub, cursor:execState!=='idle'?'pointer':'default', position:'relative', minHeight:16 }}
              >
                {isEd?(
                  <input autoFocus value={editingCell!.val}
                    onChange={e=>setEditingCell({addr,val:e.target.value.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,2)})}
                    onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Tab'){const v=parseInt(editingCell!.val||'0',16);if(!isNaN(v)&&v>=0&&v<=0xFF)setCtx(prev=>{const nm={...prev.mem};memSet(nm,addr,v);return{...prev,mem:nm};});setEditingCell(null);e.preventDefault();}else if(e.key==='Escape')setEditingCell(null); }}
                    onBlur={()=>{ const v=parseInt(editingCell!.val||'0',16);if(!isNaN(v)&&v>=0&&v<=0xFF)setCtx(prev=>{const nm={...prev.mem};memSet(nm,addr,v);return{...prev,mem:nm};});setEditingCell(null); }}
                    style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'#FFBE0B', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.5rem', textAlign:'center' }}
                  />
                ):byte.toString(16).toUpperCase().padStart(2,'0')}
                {isPre&&!isEd&&<div style={{ position:'absolute', top:0, right:0, width:3, height:3, background:'#06FFA5', borderRadius:'50%' }}/>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const accent=COLORS[colorIdx]; const canRun=execState==='compiled'; const canStep=execState==='compiled'; const canStop=execState==='running';
  const flagKeys=(Object.keys(defaultFlags()) as (keyof Flags)[]);
  const ami=ADDR_INFO[addrMode];

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:T.bg, overflow:'hidden' }}>
      <TetrisRow count={32}/>

      {/* HELP */}
      {showHelp&&(
        <div style={{ position:'absolute', inset:0, zIndex:300, background:darkMode?'rgba(0,0,0,0.97)':'rgba(255,255,255,0.97)', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <TetrisRow count={30}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:'3px solid #FFBE0B', flexShrink:0 }}>
            <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.65rem' }}>HELP</div>
            <button onClick={()=>setShowHelp(false)} style={{ background:'none', border:'2px solid #FFBE0B', color:'#FFBE0B', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={13}/></button>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'16px 24px', color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.7rem', lineHeight:2 }}>
            <b style={{color:'#06FFA5'}}>KEY FIXES IN THIS VERSION:</b><br/>
            • <b>16-bit memory reads fixed:</b> MOV AX,[addr] now correctly reads 2 bytes (little-endian)<br/>
            • <b>Register sub-split:</b> AX shows AH/AL, BX shows BH/BL etc. in the register panel<br/>
            • <b>Register Inputs:</b> Pre-set any register value before compile (like AX=1234H for Task 4)<br/>
            • <b>Memory Preloads:</b> Write bytes to RAM before execution<br/>
            • <b>Live cell edit:</b> Click any memory cell during execution to change it<br/>
            • <b>ORG directive</b> supported<br/><br/>
            <b style={{color:'#FFBE0B'}}>REGISTER INPUTS vs MEMORY PRELOADS:</b><br/>
            Use <b>Register Inputs</b> when your program reads from a register directly (e.g. Task 4: MOV AX,1234H equivalent — set AX=1234H as input)<br/>
            Use <b>Memory Preloads</b> when your program reads from a memory address (e.g. MOV AL,[0200H])<br/><br/>
            <b style={{color:'#FFBE0B'}}>ADDRESS FORMATS:</b><br/>
            Addresses: 0200H · 0x0200 · 512 decimal · Range 0000H–FFFFH<br/>
            Values: 05H · 0x05 · 5 decimal · Range 00H–FFH (memory) or 0000H–FFFFH (16-bit reg)<br/><br/>
            <b style={{color:'#FFBE0B'}}>16-BIT MEMORY READS — IMPORTANT:</b><br/>
            MOV AX,[0200H] reads mem[0200H] as low byte AND mem[0201H] as high byte.<br/>
            If you only store 1 byte at 0200H, always set 0201H=00H as a zero guard preload.
          </div>
          <TetrisRow count={30} reversed/>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding:'7px 14px', borderBottom:`3px solid ${accent}`, background:darkMode?'rgba(0,0,0,0.9)':T.panel, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {onBack&&<button onClick={onBack} style={{ background:'transparent', border:'2px solid #FFBE0B', color:'#FFBE0B', padding:'4px 10px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.38rem', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>← BACK</button>}
          <button onClick={reset} style={{ background:'transparent', border:'2px solid #FF006E', color:'#FF006E', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} title="Reset"><RotateCcw size={13}/></button>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.68rem', color:accent }}>ASSEMBLY SIMULATOR</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.sub, fontSize:'0.55rem' }}>
            {arch} · PC={ctx.pc} · CYCLES={ctx.cycles}{lastCyc>0?` (+${lastCyc})`:''}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>setDarkMode(d=>!d)} style={{ background:'transparent', border:`2px solid ${accent}`, color:accent, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            {darkMode?<Sun size={13}/>:<Moon size={13}/>}
          </button>
          <button onClick={()=>setShowHelp(true)} style={{ background:'transparent', border:`2px solid ${accent}`, color:accent, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><HelpCircle size={13}/></button>
        </div>
      </div>

      {/* ARCH + MODE + VIEW */}
      <div style={{ padding:'5px 14px', borderBottom:`1px solid ${T.border}`, background:darkMode?'rgba(0,0,0,0.7)':T.panel, display:'flex', gap:6, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#76b900', fontSize:'0.36rem' }}>ARCH:</div>
        {(['8086','8085','8051'] as ArchType[]).map(a=>(
          <button key={a} onClick={()=>switchArch(a)} disabled={canStop}
            style={{ background:arch===a?'rgba(118,185,0,0.15)':'transparent', border:`2px solid ${arch===a?'#76b900':'#76b90033'}`, color:arch===a?'#76b900':T.sub, padding:'4px 10px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.34rem', cursor:canStop?'not-allowed':'pointer' }}>
            {arch===a?'▶ ':''}{a}
          </button>
        ))}
        <div style={{ width:1, height:18, background:T.border, margin:'0 3px' }}/>
        <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.36rem' }}>MODE:</div>
        {(Object.entries(ADDR_INFO) as [AddrMode,typeof ADDR_INFO[AddrMode]][]).map(([k,v])=>(
          <button key={k} onClick={()=>setAddrMode(k)} title={v.desc}
            style={{ background:addrMode===k?`${v.color}18`:'transparent', border:`2px solid ${addrMode===k?v.color:`${v.color}33`}`, color:addrMode===k?v.color:T.sub, padding:'4px 8px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.3rem', cursor:'pointer' }}>
            {v.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
          {(['code','execution'] as ViewMode[]).map(m=>{
            const lbl=m==='code'?'CODE':'EXEC'; const col=m==='code'?'#3A86FF':'#06FFA5';
            const icon=m==='code'?<Code size={10}/>:<Eye size={10}/>;
            return <button key={m} onClick={()=>setViewMode(m)} style={{ background:viewMode===m?`${col}25`:'transparent', border:`2px solid ${viewMode===m?col:`${col}33`}`, color:viewMode===m?col:T.sub, padding:'4px 10px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.32rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>{icon} {lbl}</button>;
          })}
        </div>
      </div>

      {/* ADDR MODE BANNER */}
      <div style={{ padding:'3px 14px', background:`${ami.color}0e`, borderBottom:`1px solid ${ami.color}22`, display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:ami.color }}/>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", color:ami.color, fontSize:'0.58rem' }}><b>{ami.label}</b> — {ami.desc}</div>
      </div>

      {/* MAIN */}
      {viewMode==='code'?(
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {/* EDITOR */}
          <div style={{ width:'50%', display:'flex', flexDirection:'column', borderRight:`2px solid ${T.border}`, background:T.panel }}>
            <div style={{ padding:'6px 10px', borderBottom:`1px solid ${T.border}`, display:'flex', gap:5, flexWrap:'wrap', background:darkMode?'rgba(0,0,0,0.6)':T.panel, flexShrink:0 }}>
              {([
                { label:'COMPILE', icon:<FileCode size={11}/>, action:compile,       color:'#06FFA5', disabled:canStop },
                { label:'RUN',     icon:<Play size={11}/>,     action:runProgram,    color:'#3A86FF', disabled:!canRun },
                { label:'STEP',    icon:<StepForward size={11}/>, action:stepNext,   color:'#FFBE0B', disabled:!canStep },
                { label:'STOP',    icon:<Square size={11}/>,   action:stopExecution, color:'#FF006E', disabled:!canStop },
              ] as {label:string;icon:React.ReactNode;action:()=>void;color:string;disabled:boolean}[]).map(btn=>(
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                  style={{ background:btn.disabled?'transparent':`${btn.color}18`, border:`2px solid ${btn.disabled?`${btn.color}22`:btn.color}`, color:btn.disabled?T.sub:btn.color, padding:'5px 12px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.36rem', cursor:btn.disabled?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:4, opacity:btn.disabled?0.4:1 }}>
                  {btn.icon} {btn.label}
                </button>
              ))}
              {canStop&&<div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}><div style={{ width:7,height:7,background:'#06FFA5',borderRadius:'50%',animation:'pulse 1s infinite' }}/><span style={{ fontFamily:"'Press Start 2P',cursive",color:'#06FFA5',fontSize:'0.32rem' }}>RUNNING</span></div>}
              {execState==='done'&&<div style={{ marginLeft:'auto', fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.32rem', display:'flex', alignItems:'center' }}>✓ DONE</div>}
            </div>
            <div style={{ flex:1, overflow:'auto', background:T.editor, padding:10 }}>
              {execState!=='idle'
                ?<div style={{ pointerEvents:'none' }}>{renderCode()}</div>
                :<textarea value={code} onChange={e=>setCode(e.target.value)}
                    style={{ width:'100%', height:'100%', background:'transparent', border:'none', outline:'none', color:T.code, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.8rem', lineHeight:2, resize:'none', whiteSpace:'pre', overflowWrap:'normal', overflowX:'auto' }}
                    spellCheck={false} placeholder="; Write 8086/8085/8051 assembly here..."/>
              }
            </div>
            {error&&<div style={{ padding:'7px 10px', background:'rgba(255,0,110,0.12)', borderTop:'2px solid #FF006E', flexShrink:0 }}><div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FF006E', fontSize:'0.32rem', marginBottom:2 }}>ERROR</div><div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#FF006E', fontSize:'0.62rem' }}>{error}</div></div>}
          </div>

          {/* STATE PANEL */}
          <div style={{ width:'50%', display:'flex', flexDirection:'column', overflow:'auto', background:T.panel }}>
            {/* Registers */}
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#8338EC', fontSize:'0.44rem', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}><Cpu size={11}/> REGISTERS</div>
              {renderRegisters()}
            </div>
            {/* Flags */}
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#06FFA5', fontSize:'0.44rem', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}><Zap size={11}/> FLAGS</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:5 }}>
                {flagKeys.map(n=>{ const v=ctx.flags[n]; const full:Record<keyof Flags,string>={Z:'Zero',C:'Carry',S:'Sign',O:'Overflow',P:'Parity',AC:'Aux Carry'}; return (
                  <div key={n} title={full[n]} style={{ background:v?'rgba(6,255,165,0.15)':T.panel, border:`2px solid ${v?'#06FFA5':T.border}`, padding:'5px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ fontFamily:"'Press Start 2P',cursive", color:v?'#06FFA5':T.sub, fontSize:'0.36rem' }}>{n}</div>
                    <div style={{ width:10, height:10, background:v?'#06FFA5':'transparent', border:`2px solid ${v?'#06FFA5':T.border}`, transition:'all 0.3s' }}/>
                  </div>
                ); })}
              </div>
            </div>

            {/* ── REGISTER INPUTS ── */}
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Terminal size={11} color="#FF006E"/>
                  <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FF006E', fontSize:'0.42rem' }}>REGISTER INPUTS</div>
                  <button onClick={()=>setShowInputEditor(v=>!v)} style={{ background:showInputEditor?'rgba(255,0,110,0.15)':'transparent', border:`2px solid ${showInputEditor?'#FF006E':'#FF006E33'}`, color:showInputEditor?'#FF006E':T.sub, padding:'2px 7px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.27rem', cursor:'pointer' }}>
                    {showInputEditor?'▲':'▼'}
                  </button>
                </div>
                {showInputEditor&&<button onClick={addRegInput} style={{ background:'rgba(255,0,110,0.12)', border:'2px solid #FF006E', color:'#FF006E', padding:'2px 8px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.27rem', cursor:'pointer' }}>+ ADD</button>}
              </div>
              {showInputEditor&&(
                <div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.sub, fontSize:'0.54rem', marginBottom:6, lineHeight:1.6 }}>
                    Pre-set register values before COMPILE. Use for tasks where values go directly into registers.<br/>
                    <span style={{color:'#FF006E88'}}>E.g. AX=1234H for two's complement task (instead of reading from memory)</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto' }}>
                    {regInputs.map((ri,idx)=>{
                      const vn=parseAnyAddr(ri.valRaw); const max=ri.bits===16?0xFFFF:0xFF;
                      const vok=!isNaN(vn)&&vn>=0&&vn<=max&&ri.valRaw.trim()!=='';
                      return (
                        <div key={ri.id} style={{ display:'grid', gridTemplateColumns:'16px auto 1fr auto', gap:5, alignItems:'center' }}>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.sub, fontSize:'0.5rem', textAlign:'center' }}>{idx+1}</div>
                          <select value={ri.dest} onChange={e=>updateRegInput(ri.id,'dest',e.target.value)}
                            style={{ background:T.editor, border:'1px solid #FF006E44', color:'#FF006E', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.68rem', padding:'4px 6px', outline:'none', cursor:'pointer' }}>
                            {regOptions.map(ro=><option key={ro} value={ro}>{ro}</option>)}
                          </select>
                          <div>
                            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                              <input value={ri.valRaw} onChange={e=>updateRegInput(ri.id,'valRaw',e.target.value)} placeholder={ri.bits===16?'1234H':'0AH'}
                                style={{ flex:1, background:T.editor, border:`1px solid ${vok?'#FF006E55':ri.valRaw.trim()?'#FF006E88':'#333'}`, color:vok?'#FF006E':'#FF006E66', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.68rem', padding:'4px 7px', outline:'none' }}/>
                              {vok&&<span style={{ color:'#FF006E44', fontSize:'0.46rem', minWidth:44 }}>=0x{vn.toString(16).toUpperCase().padStart(ri.bits===16?4:2,'0')}</span>}
                            </div>
                            {ri.valErr&&<div style={{ color:'#FF006E', fontSize:'0.46rem', marginTop:1 }}>{ri.valErr}</div>}
                          </div>
                          <button onClick={()=>removeRegInput(ri.id)} style={{ background:'transparent', border:'1px solid #FF006E33', color:'#FF006E88', width:22, height:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                        </div>
                      );
                    })}
                    {regInputs.length===0&&<div style={{ color:T.sub, fontSize:'0.58rem', textAlign:'center', padding:'8px 0' }}>No register inputs. Click + ADD.</div>}
                  </div>
                  {regInputs.some(r=>r.valRaw.trim())&&(
                    <div style={{ marginTop:7, display:'flex', flexWrap:'wrap', gap:5 }}>
                      {regInputs.map(ri=>{ const v=parseAnyAddr(ri.valRaw); const ok=!isNaN(v)&&v>=0&&v<=(ri.bits===16?0xFFFF:0xFF);
                        return ok?<span key={ri.id} style={{ fontFamily:"'JetBrains Mono',monospace", color:'#FF006E', fontSize:'0.56rem', background:'rgba(255,0,110,0.07)', padding:'2px 6px', border:'1px solid #FF006E22' }}>{ri.dest}={v.toString(16).toUpperCase().padStart(ri.bits===16?4:2,'0')}H</span>:<span key={ri.id} style={{ color:'#FF006E33', fontSize:'0.5rem' }}>⚠</span>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── MEMORY ── */}
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#3A86FF', fontSize:'0.4rem' }}>
                  MEMORY <span style={{ color:'#3A86FF44', fontSize:'0.28rem' }}>64KB · {Object.keys(ctx.mem).length} non-zero</span>
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <button onClick={()=>setMemViewBase(b=>Math.max(0,b-MEM_PAGE*4))} disabled={memViewBase===0} style={{ background:'transparent', border:'1px solid #3A86FF44', color:memViewBase===0?T.sub:'#3A86FF', width:20, height:20, cursor:'pointer', fontSize:'0.8rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
                  <input value={memViewInput} onChange={e=>setMemViewInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){const v=parseAnyAddr(memViewInput);if(!isNaN(v)&&v>=0&&v<=0xFFFF)setMemViewBase(Math.floor(v/(MEM_PAGE*4))*(MEM_PAGE*4));} }}
                    style={{ width:62, background:T.editor, border:'1px solid #3A86FF44', color:'#3A86FF', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.58rem', padding:'2px 4px', outline:'none', textAlign:'center' }}/>
                  <button onClick={()=>{const v=parseAnyAddr(memViewInput);if(!isNaN(v)&&v>=0&&v<=0xFFFF)setMemViewBase(Math.floor(v/(MEM_PAGE*4))*(MEM_PAGE*4));}} style={{ background:'rgba(58,134,255,0.15)', border:'1px solid #3A86FF44', color:'#3A86FF', padding:'2px 6px', fontSize:'0.56rem', cursor:'pointer' }}>GO</button>
                  <button onClick={()=>setMemViewBase(b=>Math.min(0xFFFF-MEM_PAGE*4+1,b+MEM_PAGE*4))} style={{ background:'transparent', border:'1px solid #3A86FF44', color:'#3A86FF', width:20, height:20, cursor:'pointer', fontSize:'0.8rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
                  <button onClick={()=>setShowMemEditor(v=>!v)} style={{ background:showMemEditor?'rgba(255,190,11,0.15)':'transparent', border:`2px solid ${showMemEditor?'#FFBE0B':'#FFBE0B33'}`, color:showMemEditor?'#FFBE0B':T.sub, padding:'2px 7px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.26rem', cursor:'pointer' }}>
                    {showMemEditor?'▲':'▼'} PRELOADS
                  </button>
                </div>
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", color:'#3A86FF55', fontSize:'0.48rem', marginBottom:5 }}>
                {memViewBase.toString(16).toUpperCase().padStart(4,'0')}H–{Math.min(0xFFFF,memViewBase+MEM_PAGE*4-1).toString(16).toUpperCase().padStart(4,'0')}H
                {execState!=='idle'&&<span style={{ color:T.sub, marginLeft:12 }}>click cell to edit</span>}
              </div>
              {renderMemGrid()}

              {showMemEditor&&(
                <div style={{ marginTop:10, background:darkMode?'rgba(255,190,11,0.04)':'rgba(255,190,11,0.06)', border:'2px solid #FFBE0B33', padding:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                    <div>
                      <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.34rem' }}>MEMORY PRELOADS</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.sub, fontSize:'0.52rem', marginTop:2 }}>Written to 64KB RAM on COMPILE. ● = preloaded cell.</div>
                    </div>
                    <button onClick={addPreload} style={{ background:'rgba(255,190,11,0.12)', border:'2px solid #FFBE0B', color:'#FFBE0B', padding:'3px 10px', fontFamily:"'Press Start 2P',cursive", fontSize:'0.27rem', cursor:'pointer' }}>+ ADD</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'16px 1fr 1fr auto', gap:5, marginBottom:4 }}>
                    <div/><div style={{ fontFamily:"'Press Start 2P',cursive", color:'#3A86FF44', fontSize:'0.26rem' }}>ADDRESS (0000H–FFFFH)</div><div style={{ fontFamily:"'Press Start 2P',cursive", color:'#06FFA544', fontSize:'0.26rem' }}>VALUE (00H–FFH)</div><div/>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:220, overflowY:'auto' }}>
                    {memPreloads.map((p,idx)=>{
                      const an=parseAnyAddr(p.addrRaw),vn=parseAnyAddr(p.valRaw);
                      const aok=!isNaN(an)&&an>=0&&an<=0xFFFF&&p.addrRaw.trim()!=='';
                      const vok=!isNaN(vn)&&vn>=0&&vn<=0xFF&&p.valRaw.trim()!=='';
                      return (
                        <div key={p.id}>
                          <div style={{ display:'grid', gridTemplateColumns:'16px 1fr 1fr auto', gap:5, alignItems:'center' }}>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.sub, fontSize:'0.5rem', textAlign:'center' }}>{idx+1}</div>
                            <div>
                              <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                                <input value={p.addrRaw} onChange={e=>updatePreload(p.id,'addrRaw',e.target.value)} placeholder="0200H"
                                  style={{ flex:1, background:T.editor, border:`1px solid ${aok?'#3A86FF55':p.addrRaw.trim()?'#FF006E55':'#333'}`, color:aok?'#3A86FF':'#FF006E88', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.66rem', padding:'4px 7px', outline:'none' }}/>
                                {aok&&<span style={{ color:'#3A86FF44', fontSize:'0.46rem', minWidth:40 }}>=0x{an.toString(16).toUpperCase().padStart(4,'0')}</span>}
                              </div>
                              {p.addrErr&&<div style={{ color:'#FF006E', fontSize:'0.46rem', marginTop:1 }}>{p.addrErr}</div>}
                            </div>
                            <div>
                              <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                                <input value={p.valRaw} onChange={e=>updatePreload(p.id,'valRaw',e.target.value)} placeholder="0AH"
                                  style={{ flex:1, background:T.editor, border:`1px solid ${vok?'#06FFA555':p.valRaw.trim()?'#FF006E55':'#333'}`, color:vok?'#06FFA5':'#FF006E88', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.66rem', padding:'4px 7px', outline:'none' }}/>
                                {vok&&<span style={{ color:'#06FFA544', fontSize:'0.46rem', minWidth:24 }}>{vn}d</span>}
                              </div>
                              {p.valErr&&<div style={{ color:'#FF006E', fontSize:'0.46rem', marginTop:1 }}>{p.valErr}</div>}
                            </div>
                            <button onClick={()=>removePreload(p.id)} style={{ background:'transparent', border:'1px solid #FF006E33', color:'#FF006E88', width:22, height:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                          </div>
                        </div>
                      );
                    })}
                    {memPreloads.length===0&&<div style={{ color:T.sub, fontSize:'0.58rem', textAlign:'center', padding:'10px 0' }}>No preloads. Click + ADD.</div>}
                  </div>
                  {memPreloads.some(p=>p.addrRaw.trim())&&(
                    <div style={{ marginTop:7, display:'flex', flexWrap:'wrap', gap:5 }}>
                      {memPreloads.map(p=>{ const a=parseAnyAddr(p.addrRaw),v=parseAnyAddr(p.valRaw); const ok=!isNaN(a)&&!isNaN(v)&&a>=0&&a<=0xFFFF&&v>=0&&v<=0xFF;
                        return ok?<span key={p.id} style={{ fontFamily:"'JetBrains Mono',monospace", color:'#06FFA5', fontSize:'0.56rem', background:'rgba(6,255,165,0.07)', padding:'2px 5px', border:'1px solid #06FFA522' }}>mem[{a.toString(16).toUpperCase().padStart(4,'0')}H]={v.toString(16).toUpperCase().padStart(2,'0')}H</span>:<span key={p.id} style={{ color:'#FF006E33', fontSize:'0.5rem' }}>⚠</span>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stack */}
            {ctx.stack.length>0&&<div style={{ padding:'8px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FF006E', fontSize:'0.4rem', marginBottom:4 }}>STACK</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {ctx.stack.map((v:number,i:number)=><div key={i} style={{ fontFamily:"'JetBrains Mono',monospace", color:'#FF006E', background:'rgba(255,0,110,0.08)', border:'1px solid #FF006E33', padding:'2px 7px', fontSize:'0.66rem' }}>{v.toString(16).toUpperCase().padStart(4,'0')}H</div>)}
              </div>
            </div>}
            {callStack.length>0&&<div style={{ padding:'8px 14px', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#FFBE0B', fontSize:'0.4rem', marginBottom:4 }}>CALL STACK</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {callStack.map((v:number,i:number)=><div key={i} style={{ fontFamily:"'JetBrains Mono',monospace", color:'#FFBE0B', background:'rgba(255,190,11,0.08)', border:'1px solid #FFBE0B33', padding:'2px 7px', fontSize:'0.66rem' }}>@{v}</div>)}
              </div>
            </div>}

            {/* Output */}
            <div style={{ flex:1, padding:'10px 14px', display:'flex', flexDirection:'column', minHeight:110 }}>
              <div style={{ fontFamily:"'Press Start 2P',cursive", color:'#06FFA5', fontSize:'0.42rem', marginBottom:6 }}>OUTPUT</div>
              <div ref={outputRef} style={{ flex:1, background:T.output, border:'2px solid #06FFA533', padding:8, overflow:'auto', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.66rem', lineHeight:1.9 }}>
                {ctx.output.length===0?<div style={{ color:T.sub }}>No output yet...</div>:ctx.output.map((line:string,i:number)=>(
                  <div key={i} style={{ color:line.includes('ERROR')?'#FF006E':line.startsWith('>>')?'#06FFA5':'#8b8baa', marginBottom:1 }}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ):(
        /* EXECUTION VIEW */
        <div style={{ flex:1, overflow:'auto', background:T.bg }}>
          {snapshots.length===0
            ?<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12 }}>
               <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.5rem', color:T.sub }}>NO SNAPSHOTS YET</div>
               <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.66rem', color:T.sub }}>Compile and step/run to see snapshots.</div>
             </div>
            :<div style={{ padding:14, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
               {snapshots.slice(-6).map((snap:Snapshot,idx:number)=>{
                 const sr=snap.regs as Record<string,number>;
                 let regE: [string,number][]=[];
                 if(arch==='8086') regE=[['IP',sr.IP??0],['AX',sr.AX??0],['BX',sr.BX??0]];
                 else if(arch==='8085') regE=[['PC',sr.PC??0],['A',sr.A??0],['HL',((sr.H??0)<<8)|(sr.L??0)]];
                 else regE=[['PC',sr.PC??0],['A',sr.A??0],['B',sr.B??0]];
                 const mi=ADDR_INFO[snap.addrMode];
                 return (
                   <div key={idx} style={{ background:T.panel, border:'3px solid #8338EC', padding:10, display:'flex', flexDirection:'column', gap:8 }}>
                     <div style={{ fontFamily:"'Press Start 2P',cursive", fontSize:'0.4rem', color:'#06FFA5', textAlign:'center', padding:'5px', background:'rgba(6,255,165,0.08)', border:'2px solid #06FFA533' }}>
                       Step {snap.step}
                       {mi&&<div style={{ color:mi.color, marginTop:3, fontSize:'0.32rem' }}>{mi.label}</div>}
                       {snap.instrCycles>0&&<div style={{ color:'#FFBE0B88', marginTop:2, fontSize:'0.3rem' }}>{snap.instrCycles} cyc</div>}
                     </div>
                     <div style={{ background:'rgba(58,134,255,0.07)', border:'1px solid #3A86FF33', padding:5, fontSize:'0.52rem', fontFamily:"'JetBrains Mono',monospace", maxHeight:70, overflowY:'auto', display:'grid', gridTemplateColumns:'auto 1fr', gap:'1px 6px' }}>
                       {Object.entries(snap.memDirty).slice(0,6).map(([a,v])=>(
                         <React.Fragment key={a}><div style={{ color:T.sub }}>0x{parseInt(a).toString(16).toUpperCase().padStart(4,'0')}</div><div style={{ color:'#3A86FF' }}>{(v as number).toString(16).toUpperCase().padStart(2,'0')}H</div></React.Fragment>
                       ))}
                       {Object.keys(snap.memDirty).length===0&&<div style={{ color:T.sub, gridColumn:'span 2' }}>all zero</div>}
                     </div>
                     <div style={{ background:'rgba(255,190,11,0.07)', border:'1px solid #FFBE0B33', padding:5, display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, fontSize:'0.52rem', fontFamily:"'JetBrains Mono',monospace" }}>
                       {regE.map(([n,v])=>(<div key={n} style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:T.sub }}>{n}</span><span style={{ color:'#FFBE0B' }}>{v.toString(16).toUpperCase().padStart(4,'0')}H</span></div>))}
                     </div>
                     <div style={{ background:'rgba(6,255,165,0.07)', border:'1px solid #06FFA533', padding:7, fontSize:'0.52rem', fontFamily:"'JetBrains Mono',monospace", color:'#06FFA5', textAlign:'center' }}>
                       <div>{snap.instr}</div>
                       {snap.annotation&&<div style={{ color:'#8338EC', marginTop:3, fontSize:'0.46rem' }}>{snap.annotation}</div>}
                     </div>
                   </div>
                 );
               })}
             </div>
          }
        </div>
      )}

      <TetrisRow count={32} reversed/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  );
}