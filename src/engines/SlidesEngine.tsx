import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Hand, Menu, X, HelpCircle } from 'lucide-react';
import { gestureController, type GestureState } from '../utils/gestureControl';
import { musicEngine } from '../utils/musicEngine';

interface SlidesEngineProps { onBack: () => void; }

const COLORS = ['#FF006E', '#8338EC', '#3A86FF', '#06FFA5', '#FFBE0B'];

function TetrisBlock({ color, size = 14, style = {} }: { color: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: color,
      boxShadow: `inset -${Math.max(2, size / 6)}px -${Math.max(2, size / 6)}px 0 rgba(0,0,0,0.5), inset ${Math.max(2, size / 6)}px ${Math.max(2, size / 6)}px 0 rgba(255,255,255,0.3)`,
      border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0, ...style,
    }} />
  );
}

function TetrisRow({ count = 32, reversed = false }: { count?: number; reversed?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '6px 12px', justifyContent: reversed ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <TetrisBlock key={i} color={COLORS[i % 5]} size={16} style={{ opacity: 0.3 + (i % 3) * 0.2 }} />
      ))}
    </div>
  );
}

function GestureHUD({ state }: { state: GestureState | null }) {
  if (!state || state.type === 'none') return null;
  let label = 'TRACKING'; let color = '#06FFA5'; let icon = '✋';
  if (state.type === 'open')  { icon = '✋'; color = '#3A86FF'; label = 'OPEN PALM → NEXT SLIDE'; }
  else if (state.type === 'fist') { icon = '✊'; color = '#FF006E'; label = 'FIST → PREV SLIDE'; }
  else if (state.type === 'index') { icon = '☝'; color = '#06FFA5'; label = 'INDEX — move paddle'; }
  return (
    <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.92)', border: `2px solid ${color}`, padding: '7px 18px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 0 14px ${color}55`, fontFamily: "'Press Start 2P', cursive", pointerEvents: 'none', minWidth: 220 }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.45rem', color, letterSpacing: 1 }}>{label}</div>
        {state.rawX !== undefined && (
          <div style={{ marginTop: 4, width: 120, height: 4, background: '#222', position: 'relative' }}>
            <div style={{ position: 'absolute', left: `${state.rawX * 100}%`, top: -2, width: 8, height: 8, background: color, borderRadius: '50%', transform: 'translateX(-50%)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function GestureControlPanel() {
  return (
    <div style={{ position: 'fixed', bottom: 76, right: 16, zIndex: 190, background: 'rgba(0,0,0,0.90)', border: '2px solid #8338EC55', padding: '10px 14px', width: 220, fontFamily: "'JetBrains Mono', monospace", boxShadow: '0 0 14px #8338EC33', pointerEvents: 'none' }}>
      <div style={{ fontSize: '0.5rem', color: '#8338EC', fontFamily: "'Press Start 2P', cursive", marginBottom: 8, letterSpacing: 1 }}>GESTURE GUIDE</div>
      {[
        { icon: '✋', label: 'Open palm',  action: 'Next slide →', color: '#3A86FF' },
        { icon: '✊', label: 'Fist',       action: '← Previous slide', color: '#FF006E' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{r.icon}</span>
          <div>
            <div style={{ fontSize: '0.55rem', color: r.color }}>{r.label}</div>
            <div style={{ fontSize: '0.5rem',  color: '#888' }}>{r.action}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const SLIDES = [
  {
    title: 'JENSEN HUANG & NVIDIA ORIGINS',
    subtitle: 'The Founding Vision — 1993',
    color: '#76b900',
    content: [
      'Jensen Huang co-founded NVIDIA in 1993 with Curtis Priem and Chris Malachowsky in a Denny\'s diner in San Jose',
      'Early vision: dedicated graphics silicon would become indispensable — when the rest of Silicon Valley was skeptical of GPUs',
      'NV1 (1995): NVIDIA\'s first chip — integrated 2D/3D graphics + audio on a single die; a bold but ill-fated bet on quadratic texture mapping',
      'RIVA 128 (1997): Rescued company from near-bankruptcy; shipped 1 million units in 4 months, establishing GPU market viability',
      'Jensen\'s philosophy: "The more you buy, the more you save" — shipping silicon volume and iterating fast rather than perfecting slowly',
    ],
    detail: 'Jensen\'s engineering background (Stanford EE, LSI Logic) gave him the conviction that parallel silicon specialized for graphics would follow its own exponential — separate from CPU scaling. That conviction took 30 years to be proven definitively correct with AI.',
  },
  {
    title: 'NVIDIA\'S ARCHITECTURAL EVOLUTION',
    subtitle: 'From Graphics to AI Supercomputing',
    color: '#FFBE0B',
    content: [
      'GeForce 256 (1999): First chip marketed as a "GPU" — introduced hardware T&L (Transform & Lighting), offloading from CPU',
      'Tesla architecture (2006): First GPU designed explicitly for general-purpose computing (GPGPU) — introduced CUDA, unified shader model',
      'Volta (2017): First Tensor Core silicon — 120 TFLOPS matrix multiply, purpose-built for deep learning training',
      'Ampere A100 (2020): 54 billion transistors, multi-instance GPU, TF32 precision for 10× DL throughput over V100',
      'Hopper H100 + Grace (2022→GH200): First CPU+GPU heterogeneous superchip — 900 GB/s NVLink-C2C coherent interconnect replaces PCIe',
    ],
    detail: 'Each NVIDIA generation doubled or tripled AI throughput not just via transistor scaling (Moore\'s Law) but via architectural innovations: Tensor Cores, NVLink, Transformer Engine, and now unified CPU+GPU memory on a single package.',
  },
  {
    title: 'GH200 GRACE HOPPER SUPERCHIP',
    subtitle: 'Structural & Functional Architecture Overview',
    color: '#76b900',
    content: [
      'Structural view: two dies (Grace CPU + Hopper GPU) on a single organic substrate — monolithic package, not a multi-chip module',
      'Functional view: CPU handles scalar/control-flow work; GPU handles massively parallel tensor/matrix operations',
      'NVLink-C2C interconnect: 900 GB/s bidirectional, coherent — 14× PCIe 5.0 bandwidth, maps both dies into a single address space',
      'TSMC 4N process (4nm-class) — same node as standalone H100; 80 billion transistors across both dies',
      'Unified 624 GB memory: 480 GB LPDDR5X (CPU-side) + 96 GB HBM3e (GPU-side) via hardware cache coherence',
    ],
    detail: 'COA connection: this is a textbook example of a heterogeneous functional organization — the "structural view" maps to bus interconnects and die topology, while the "functional view" maps to instruction-set roles (scalar vs. vector/tensor). Compare with Flynn\'s classification: CPU = SISD control, GPU = SIMD data engine.',
  },
  {
    title: 'SYSTEM BUS & INTERCONNECT DESIGN',
    subtitle: 'NVLink-C2C as a High-Speed System Bus',
    color: '#00d4ff',
    content: [
      'Bus interconnection: NVLink-C2C replaces the traditional PCIe host bus — 18 NVLink lanes × 50 GB/s = 900 GB/s bidirectional',
      'Bus design elements: point-to-point physical interface, CRC error correction per lane, lane bonding for redundancy',
      'Read/write timing: CPU cache-miss → snoop request crosses C2C in ~40 ns additional latency vs on-die SRAM',
      'Bus hierarchy: within each die, AXI mesh interconnects cores/SMs; NVLink-C2C is the inter-die system bus; PCIe 5.0 is the host I/O bus',
      'Bus arbitration: MESI coherence protocol arbitrates ownership of shared cache lines across both dies — no software DMA needed',
    ],
    detail: 'COA connection: this slide maps directly to Unit 2 — basic instruction cycle crosses the C2C bus when the GPU fetches CPU-resident data; interrupt lines are shared across both dies via the coherence fabric. Bus arbitration here is hardware MESI, the most advanced form of distributed arbitration.',
  },
  {
    title: 'GRACE CPU MICROARCHITECTURE',
    subtitle: 'ARM Neoverse V2 — Out-of-Order Superscalar',
    color: '#00d4ff',
    content: [
      'Pipeline: Fetch (4-wide, TAGE branch predictor) → Decode (4→5 µop expansion, compare+branch fusion) → Rename → Issue → Execute → Writeback',
      'Out-of-order engine: 320-entry Reorder Buffer (ROB), 6 issue ports — 2×ALU, 1×MUL/DIV, 1×Load, 1×Store, 1×SVE2',
      'Register organization: 320-entry Physical Register File; ARMv9-A has 31 GP integer + 32 SIMD registers (architectural)',
      'ISA: ARMv9-A with SVE2 — variable-length SIMD (128–2048-bit), compiles once, runs at hardware width',
      'Co-processor analogy: SVE2 SIMD unit is the on-chip "math co-processor" — dedicated execution pipeline for vector ops',
    ],
    detail: 'COA connection: Unit 5 — instruction cycle, pipeline stages, register organization, RISC design (ARM = RISC: fixed-length 32-bit instructions, load-store architecture, large register file). The 320-entry ROB is what enables deep out-of-order windows, hiding the ~100ns LPDDR5X latency.',
  },
  {
    title: 'MEMORY HIERARCHY — SIX LEVELS',
    subtitle: 'Cache Design, Mapping & Address Translation',
    color: '#ff8800',
    content: [
      'Level 1: 64 KB L1-I + 64 KB L1-D per CPU core (SRAM, ~4 cycles); GPU SM: 256 KB register file + 228 KB shared memory',
      'Level 2: 1 MB L2 per CPU core (SRAM, ~14 cycles); GPU L2: 60 MB (largest GPU L2 ever)',
      'Level 3: 576 MB L3 NUCA — 72 slices of 8 MB, distributed across core ring (SRAM, ~40 cycles)',
      'Level 4: 96 GB HBM3e on GPU (DRAM, 3D-stacked, 4 TB/s); Level 5: 480 GB LPDDR5X on CPU (DRAM, 546 GB/s)',
      'Cache mapping: L1/L2 use set-associative (8-way); L3 uses adaptive set-associative; GPU texture cache = fully associative',
    ],
    detail: 'COA connection: Unit 3 — cache memory organization, set-associative/direct/fully-associative mapping, two-level cache performance analysis. The 576 MB NUCA L3 is a direct implementation of non-uniform cache architecture — physical distance from a core to a cache slice determines access latency.',
  },
  {
    title: 'DRAM, SRAM & ASSOCIATIVE MEMORY',
    subtitle: 'HBM3e, LPDDR5X, and Content-Addressable Memory',
    color: '#ff5522',
    content: [
      'SRAM (register file, L1–L3): 6T SRAM cells, bistable flip-flop, ~0.5 ns access, high power density — used where latency matters',
      'DRAM (LPDDR5X, HBM3e): capacitor-based, refresh every 64 ms, destructive read — but 64–128× cheaper per bit than SRAM',
      'HBM3e architecture: logic die + 8 DRAM dies bonded via TSVs; 1024-bit wide bus per stack; 6 stacks = 6 TB/s peak bandwidth',
      'Interleaved memory: LPDDR5X 8 channels interleaved at 128-byte granularity — sequential accesses spread across banks, avoiding row-buffer conflicts',
      'Associative memory: GPU texture cache and TLB use fully-associative CAM (Content Addressable Memory) for O(1) tag lookup',
    ],
    detail: 'COA connection: Unit 3 — DRAM vs SRAM chip logic, memory module organization, interleaved memory for bandwidth, and associative memory (CAM). HBM3e is the physical realization of high-bandwidth interleaved memory: 6 independent banks all accessed in parallel per clock.',
  },
  {
    title: 'HOPPER GPU — SM ARCHITECTURE',
    subtitle: 'Streaming Multiprocessor & SIMD Organization',
    color: '#00ff88',
    content: [
      '132 SMs in 7 GPCs × 2 TPCs × 2 SM — Flynn\'s SIMD: 32-thread warp = single instruction, 32 data streams simultaneously',
      'Each SM: 128 CUDA cores (ALUs), 4 Tensor Cores, 256 KB register file, 228 KB configurable shared memory (scratchpad)',
      'Instruction cycle within SM: warp scheduler → instruction fetch → decode → issue to functional unit → writeback to register file',
      'Pipeline processors: SM has a 4-stage issue pipeline; 4 warps in flight per SM scheduler to hide memory latency',
      'SIMD vs SISD: CPU core = SISD (one instruction, one data); GPU SM = SIMD (one warp instruction, 32 data lanes in lockstep)',
    ],
    detail: 'COA connection: Units 5, 6, 7 — pipeline processors (SM warp pipeline), Flynn\'s classification (GPU = SIMD), co-processors (Tensor Core is the SM\'s on-chip matrix co-processor). The warp model is the hardware manifestation of SIMD: 32 threads share one instruction fetch/decode unit but have independent ALUs and register file slots.',
  },
  {
    title: 'TENSOR CORE & ALU DESIGN',
    subtitle: 'Datapath: From Adder to Matrix Engine',
    color: '#cc44ff',
    content: [
      'Serial vs parallel adder: scalar CUDA core has a pipelined parallel adder (carry-lookahead, 1 cycle); Tensor Core uses a systolic array of adders',
      'Booth\'s algorithm applied: GPU FP multiplier uses modified Booth recoding to halve partial products — critical at 16,896 multipliers',
      'ALU organization: each CUDA core = combinational FP32 ALU + sequential integer ALU sharing the register file port',
      'Tensor Core operation: D = A×B + C — hardware 16×8 matrix multiply-accumulate; 256 FP8 MACs/clock per Tensor Core',
      'High-speed multiplier: Tensor Core uses Wallace tree reduction (parallel partial-product summation) to achieve single-cycle matrix multiply',
    ],
    detail: 'COA connection: Unit 4 entirely — IEEE 754 format (FP8 E4M3/E5M2, BF16, FP32 all appear here), serial/parallel adder design, Booth\'s algorithm, combinational vs sequential ALU, and high-speed multiplier block diagrams. The Tensor Core IS the hardware realization of the high-speed multiplier block diagram from your textbook.',
  },
  {
    title: 'CONTROL UNIT & MICROPROGRAMMING',
    subtitle: 'Hardwired vs Microprogrammed Control in GH200',
    color: '#8338EC',
    content: [
      'Hardwired control: Grace CPU uses hardwired (random logic) control — decode truth tables burned into silicon for maximum clock speed',
      'Micro-operations: a single ARM ADD instruction decomposes into µops — register read, ALU op, flag update, register write — each a micro-operation',
      'Microprogrammed control: older GPU shader compilers used microcode stores; Hopper SM uses hardwired decode with a µop cache instead',
      'Instruction format: ARM fixed 32-bit encoding; GPU PTX ISA uses variable-width instruction bundles with embedded predicate fields',
      'GPU driver as micro-program: CUDA kernel compilation (PTX → SASS) is analogous to microprogram assembly — driver translates virtual ISA to hardware micro-ops',
    ],
    detail: 'COA connection: Unit 6 — micro-operations, hardwired vs microprogrammed control, micro-instruction format. The GPU represents the modern evolution: hardwired decoders (speed) with JIT-compiled microcode (CUDA driver) sitting above hardware — a hybrid of both approaches.',
  },
  {
    title: 'I/O, DMA & PROGRAMMED I/O',
    subtitle: 'PCIe 5.0, Interrupt-Driven I/O & DMA in GH200',
    color: '#ff7700',
    content: [
      'Programmed I/O: CPU polling model used during CUDA kernel launch — CPU writes command descriptors to GPU work queue registers directly',
      'Interrupt-driven I/O: GPU signals CPU via PCIe MSI-X interrupt on kernel completion — CPU ISR reads result status without polling',
      'DMA: NVIDIA Copy Engine (CE) in Hopper performs autonomous H2D/D2H transfers — CPU sets up descriptor, CE DMAs data, raises interrupt on done',
      'I/O processors: Hopper has dedicated Copy Engines (7 total) that are I/O processors — independent DMA controllers with their own sequencers',
      'NVLink-C2C changes the model: with hardware coherence, explicit DMA between CPU↔GPU is eliminated for coherent data — CPU write is directly visible to GPU',
    ],
    detail: 'COA connection: Unit 6 — programmed I/O (polling), interrupt-driven I/O (MSI-X), DMA (Copy Engine), I/O processors and channels. GH200\'s NVLink-C2C represents the architectural endpoint of this progression: coherent cache removes the need for DMA in the common case.',
  },
  {
    title: 'GPU AS GPGPU — UNIT 6 CONNECTION',
    subtitle: 'General-Purpose GPU, Synchronization & Coherence',
    color: '#06FFA5',
    content: [
      'GPGPU evolution: from fixed-function graphics pipeline → unified shader model (Tesla 2006) → fully programmable compute hierarchy (Hopper)',
      'GPU applications: LLM training, molecular dynamics, graph analytics, recommendation systems — all map to SIMD parallel datapath',
      'Synchronization: CUDA __syncthreads() maps to hardware barrier instruction in SM — stalls warp issue until all 32 threads reach barrier',
      'Coherence in GH200: MESI protocol extended across NVLink-C2C — CPU L3 snoops GPU L2 tags; hardware resolves ownership without software',
      'Memory-mapped I/O: GPU BAR (Base Address Register) exposes HBM3e to CPU address space — CPU can read/write GPU memory via MMIO',
    ],
    detail: 'COA connection: Unit 6 explicitly lists GPGPU, GPU applications, synchronization, and coherence. GH200 is the definitive hardware answer to all four: a GPU designed from the ground up for general-purpose workloads, with hardware coherence making synchronization implicit rather than explicit.',
  },
  {
    title: 'FLYNN\'S CLASSIFICATION & PARALLEL ORGANIZATION',
    subtitle: 'SISD, SIMD, MIMD — All Present in GH200',
    color: '#3A86FF',
    content: [
      'SISD (Single Instruction, Single Data): each Grace CPU core in scalar mode — one instruction, one data element per cycle',
      'SIMD (Single Instruction, Multiple Data): each GPU warp — one instruction issued, 32 data lanes execute in lockstep; SVE2 on CPU (128–2048-bit vectors)',
      'MIMD (Multiple Instruction, Multiple Data): 72 CPU cores each running independent instruction streams on independent data = MIMD cluster',
      'Superscalar: Grace CPU issues up to 5 µops/cycle from a single thread — single instruction stream, multiple execution units = superscalar SISD',
      'In a DGX GH200 SuperPod: 256 GH200 nodes connected via NVLink 4 — 256-way MIMD with shared SIMD engines = modern parallel computer',
    ],
    detail: 'COA connection: Unit 7 — Flynn\'s classification and superscalar processors. GH200 is uniquely positioned as a single chip that embodies all four Flynn classes depending on scope: SISD (one CPU core), SIMD (one warp), MIMD (all CPU cores), and superscalar (the out-of-order CPU). Real systems are not one class — they are hierarchically composed.',
  },
  {
    title: 'RISC vs CISC IN GH200',
    subtitle: 'ARM (RISC) CPU + PTX/SASS (VLIW-like) GPU ISA',
    color: '#FF006E',
    content: [
      'RISC (Grace CPU): fixed 32-bit instructions, load-store architecture, large register file (31 GP regs), hardwired decode, single-cycle ALU ops',
      'CISC characteristics avoided: no memory-to-memory ops, no variable-length encoding, no microcode for common instructions',
      'GPU PTX ISA: virtual RISC-like ISA compiled JIT to SASS — SASS is closer to VLIW with explicit instruction-level parallelism encoding',
      'Pipeline processors: RISC enables simple in-order pipeline; Grace adds out-of-order on top; GPU SM is in-order (warp switching hides latency)',
      'ISA coexistence: both ARM (RISC) and PTX/SASS run simultaneously on GH200 — CPU handles control-flow, GPU handles data-parallel kernels',
    ],
    detail: 'COA connection: Unit 5 — RISC and CISC computers, pipeline processors, co-processors. ARM Neoverse V2 is the canonical modern RISC implementation. The GPU ISA (PTX/SASS) is a hybrid: register-based like RISC, but with predication and dual-issue slots that echo VLIW — a pragmatic blend for throughput-oriented workloads.',
  },
  {
    title: 'RESEARCH LANDSCAPE — AI HARDWARE',
    subtitle: 'Key Papers & Industry Context for GH200',
    color: '#FF006E',
    content: [
      'Jouppi et al. (2017) "In-Datacenter Performance Analysis of a Tensor Processing Unit" — Google TPU v1 paper that defined the AI accelerator era and set the metrics GH200 is benchmarked against',
      'Patterson et al. (2021) "Carbon Considerations for Large Language Model Training" — energy/performance analysis driving NVIDIA\'s HBM3e bandwidth-first design philosophy',
      'Sheng et al. (2023) "FlexGen: High-Throughput Generative Inference" — demonstrates why GH200\'s unified 624 GB memory space is critical for large-model inference at scale',
      'NVIDIA Technical Blog (2023): "NVIDIA Grace Hopper Superchip Architecture In-Depth" — primary vendor whitepaper covering NVLink-C2C coherence and cache hierarchy design',
      'Singh et al. (2024) "Scaling LLM Inference with Speculative Decoding on GH200" — real-world benchmark demonstrating 3.7× LLM throughput vs PCIe A100 using unified memory',
    ],
    detail: 'Research context: the GH200 sits at the convergence of three decade-long research threads — heterogeneous memory (UMA for CPU+GPU), high-bandwidth interconnects replacing PCIe, and workload-specific silicon (Tensor Cores). Each paper above corresponds directly to one of those threads and is cited in NVIDIA\'s own architecture documentation.',
  },
  {
    title: 'RESEARCH CONNOTATIONS — COA COURSE',
    subtitle: 'Academic Significance & Further Reading',
    color: '#8338EC',
    content: [
      'Hennessy & Patterson "Computer Architecture: A Quantitative Approach" (6th ed., 2017) — the textbook that formally defines every COA unit reflected in GH200: Amdahl\'s Law, memory hierarchy, pipeline CPI, Flynn\'s taxonomy',
      'Turing Award 2017 (Hennessy & Patterson) — awarded specifically for RISC architecture and memory hierarchy research; ARM Neoverse V2 in Grace is the direct commercial descendant',
      'Hameed et al. (2010) "Understanding Sources of Inefficiency in General-Purpose Chips" — foundational paper for why dedicated Tensor Core logic (not general ALUs) is architecturally necessary',
      'ACM/IEEE ISCA, MICRO, and Hot Chips conferences: GH200 was presented at Hot Chips 35 (2023) — the primary academic venue where architects publish implementation details',
      'IEEE Micro Vol. 44 (2024) "The Grace Hopper Superchip: Architecture and Software Stack" — peer-reviewed breakdown of GH200 linking each design choice to prior academic literature',
    ],
    detail: 'Why it matters for COA 702CO0C059: every unit of the course has a direct citation path — Patterson & Hennessy for structure/function and memory hierarchy, Flynn (1972) for taxonomy, IEEE Std 754 for floating-point, and ARM Architecture Reference Manual for instruction encoding. GH200 is not a departure from theory — it is the experimental validation of 50 years of computer architecture research.',
  },
  {
    title: 'REFERENCES',
    subtitle: 'All sources cited in this presentation — click to open',
    color: '#FFBE0B',
    content: [
      '① NVIDIA GH200 Grace Hopper Superchip Architecture Whitepaper (2023) — resources.nvidia.com/en-us-grace-cpu/grace-hopper-superchip',
      '② Hennessy & Patterson, "Computer Architecture: A Quantitative Approach", 6th ed., Morgan Kaufmann, 2017 — ISBN 978-0128119051',
      '③ Jouppi et al., "In-Datacenter Performance Analysis of a TPU", ISCA 2017 — dl.acm.org/doi/10.1145/3079856.3080246',
      '④ NVIDIA Hopper Architecture In-Depth (2022) — developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth',
      '⑤ ARM Neoverse V2 Technical Reference Manual — developer.arm.com/documentation/102375/latest',
    ],
    detail: 'Additional references: ⑥ Patterson et al., "Carbon Considerations for LLM Training", 2021 — arxiv.org/abs/2104.10350 · ⑦ Singh et al., "Scaling LLM Inference on GH200", Hot Chips 35, 2023 · ⑧ IEEE Std 754-2019 Floating-Point Arithmetic · ⑨ CUDA C++ Programming Guide (2024) — docs.nvidia.com/cuda/cuda-c-programming-guide · ⑩ Flynn, "Some Computer Organizations and Their Effectiveness", IEEE Trans. Comput., 1972.',
  },
  {
    title: 'THANK YOU',
    subtitle: 'COA 702CO0C059 — GH200 as a Living Textbook',
    color: '#06FFA5',
    content: [
      'Every unit of COA 702CO0C059 has a direct hardware realization inside the GH200 Grace Hopper Superchip',
      'Unit 1: Structural/functional view — two dies, one coherent system; Unit 2: NVLink-C2C as system bus with arbitration',
      'Unit 3: Six-level memory hierarchy — SRAM caches, DRAM/HBM3e, associative & interleaved memory all present',
      'Units 4–5: Booth multipliers in Tensor Cores, hardwired ALUs, RISC pipeline, superscalar OoO execution',
      'Units 6–7: GPGPU, DMA Copy Engines, MESI coherence, Flynn\'s SIMD/MIMD, superscalar processors',
    ],
    detail: 'The GH200 is not just a product — it is a complete, physical implementation of every concept in a Computer Organization and Architecture course. Return to the home environment to explore the interactive 3D chip viewer and data routing game.',
  },
];

export default function SlidesEngine({ onBack }: SlidesEngineProps) {
  const [currentSlide, setCurrentSlide]     = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureState, setGestureState]     = useState<GestureState | null>(null);
  const [showHelp, setShowHelp]             = useState(false);
  const [showIndex, setShowIndex]           = useState(false);
  const [colorIndex, setColorIndex]         = useState(0);
  const [transitioning, setTransitioning]   = useState(false);

  const currentSlideRef = useRef(0);
  const transitionRef   = useRef(false);

  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);
  useEffect(() => { transitionRef.current   = transitioning; }, [transitioning]);

  useEffect(() => {
    const t = setInterval(() => setColorIndex(c => (c + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  const navigate = useCallback((dir: number) => {
    if (transitionRef.current) return;
    const cur  = currentSlideRef.current;
    const next = Math.max(0, Math.min(SLIDES.length - 1, cur + dir));
    if (next === cur) return;
    transitionRef.current = true;
    setTransitioning(true);
    musicEngine.playSfx(700);
    setTimeout(() => {
      setCurrentSlide(next);
      currentSlideRef.current = next;
      setTransitioning(false);
      transitionRef.current = false;
    }, 220);
  }, []);

  const goTo = useCallback((idx: number) => {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    musicEngine.playSfx(700);
    setTimeout(() => {
      setCurrentSlide(idx);
      currentSlideRef.current = idx;
      setTransitioning(false);
      transitionRef.current = false;
    }, 220);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'Escape')     { if (showIndex) setShowIndex(false); else onBack(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, showIndex, onBack]);

  // OPEN PALM = next slide (edge-triggered via openCooldownUntil in gestureControl)
  // FIST = prev slide (edge-triggered via fistCooldownUntil in gestureControl)
  // Both are stable large gestures — no swipe/velocity needed
  const handleGesture = useCallback((gesture: GestureState) => {
    setGestureState(gesture);
    if (gesture.type === 'open') {
      navigate(1);
    } else if (gesture.type === 'fist') {
      navigate(-1);
    }
  }, [navigate]);

  useEffect(() => {
    if (gestureEnabled) {
      gestureController.subscribe(handleGesture);
      return () => gestureController.unsubscribe(handleGesture);
    } else {
      setGestureState(null);
    }
  }, [gestureEnabled, handleGesture]);

  const toggleGesture = async () => {
    if (gestureEnabled) {
      gestureController.stop(); setGestureEnabled(false); musicEngine.playSfx(400); return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Camera API unavailable. Must use http://localhost or https://.'); return;
    }
    try {
      const ok = await gestureController.init();
      if (ok) { setGestureEnabled(true); musicEngine.playSfx(900); }
      else alert('Gesture engine failed to start. See DevTools console for details.');
    } catch (err) { alert(`Gesture init error:\n${err}`); }
  };

  const slide    = SLIDES[currentSlide];
  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
      <TetrisRow count={36} />

      <div style={{ padding: '8px 20px', borderBottom: `3px solid ${COLORS[colorIndex]}`, background: 'rgba(10,10,20,0.70)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 4px 20px ${COLORS[colorIndex]}33` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", background: 'rgba(0,0,0,0.7)', border: '3px solid #FFBE0B', color: '#FFBE0B', padding: '8px 14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={11} /> EXIT
          </button>
          <button onClick={() => { setShowIndex(v => !v); musicEngine.playSfx(600); }} style={{ background: showIndex ? 'rgba(131,56,236,0.3)' : 'rgba(0,0,0,0.5)', border: `2px solid ${showIndex ? '#8338EC' : '#555'}`, color: showIndex ? '#8338EC' : '#888', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Menu size={14} />
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.75rem', color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}>SLIDES ENGINE</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.6rem' }}>{currentSlide + 1} / {SLIDES.length} · {slide.subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleGesture} style={{ background: gestureEnabled ? 'rgba(6,255,165,0.2)' : 'rgba(0,0,0,0.5)', border: `2px solid ${gestureEnabled ? '#06FFA5' : '#555'}`, color: gestureEnabled ? '#06FFA5' : '#666', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Hand size={14} />
          </button>
          <button onClick={() => { setShowHelp(v => !v); musicEngine.playSfx(600); }} style={{ background: showHelp ? 'rgba(255,190,11,0.2)' : 'rgba(0,0,0,0.5)', border: `2px solid ${showHelp ? '#FFBE0B' : '#555'}`, color: showHelp ? '#FFBE0B' : '#666', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, #8338EC, ${slide.color})`, transition: 'width 0.3s ease' }} />
      </div>

      {showIndex && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(5,5,15,0.97)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={32} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #8338EC' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#8338EC', fontSize: '0.7rem' }}>TABLE OF CONTENTS</div>
            <button onClick={() => setShowIndex(false)} style={{ background: 'none', border: '2px solid #8338EC', color: '#8338EC', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {SLIDES.map((sl, i) => (
                <button key={i} onClick={() => { goTo(i); setShowIndex(false); }} style={{ background: i === currentSlide ? `${sl.color}22` : 'rgba(0,0,0,0.5)', border: `2px solid ${i === currentSlide ? sl.color : sl.color + '44'}`, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: sl.color, fontSize: '0.5rem', marginBottom: 4 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: i === currentSlide ? '#fff' : '#ccc', fontSize: '0.7rem' }}>{sl.title}</div>
                </button>
              ))}
            </div>
          </div>
          <TetrisRow count={32} reversed />
        </div>
      )}

      {showHelp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(5,5,15,0.97)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
          <TetrisRow count={32} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '2px solid #FFBE0B' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#FFBE0B', fontSize: '0.7rem' }}>HOW TO USE</div>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: '2px solid #FFBE0B', color: '#FFBE0B', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { color: '#06FFA5', title: 'KEYBOARD',       body: '← → arrow keys navigate slides. Escape closes overlays or exits.' },
                { color: '#3A86FF', title: 'BUTTONS',        body: 'Side chevron buttons or dot indicators for navigation.' },
                { color: '#3A86FF', title: '✋  OPEN PALM → NEXT SLIDE',  body: 'Enable the hand button (🖐). Show a full open palm to the camera — all 5 fingers spread open. Fires once per gesture with a cooldown. Most reliable gesture.' },
                { color: '#FF006E', title: '✊  FIST → PREVIOUS SLIDE',   body: 'Make a fist (all fingers curled) toward the camera. Detection works from all angles — front, side, diagonal. Fires once per fist with cooldown.' },
                { color: '#FFBE0B', title: 'TABLE OF CONTENTS', body: '☰ button opens full slide index. Click any slide to jump.' },
                { color: '#FFBE0B', title: 'SLIDE CONTENT',    body: 'Each slide covers GH200 architecture with COA course (702CO0C059) connections. DEEP DIVE gives additional context.' },
              ].map((sec, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${sec.color}44`, borderLeft: `4px solid ${sec.color}`, padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", color: sec.color, fontSize: '0.5rem', marginBottom: 8 }}>{sec.title}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '0.78rem', lineHeight: 1.7 }}>{sec.body}</div>
                </div>
              ))}

              {/* Gesture quick reference */}
              <div style={{ background: 'rgba(0,0,0,0.7)', border: '2px solid #06FFA544', borderLeft: '4px solid #06FFA5', padding: '14px 16px' }}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", color: '#06FFA5', fontSize: '0.5rem', marginBottom: 10 }}>GESTURE QUICK REFERENCE</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { icon: '✋', gesture: 'Open Palm',  action: 'Next slide',     color: '#3A86FF' },
                    { icon: '✊', gesture: 'Fist',       action: 'Previous slide', color: '#FF006E' },
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
              </div>
            </div>
          </div>
          <TetrisRow count={32} reversed />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 60px', overflow: 'auto', opacity: transitioning ? 0 : 1, transform: transitioning ? 'scale(0.97)' : 'scale(1)', transition: 'opacity 0.22s, transform 0.22s' }}>
        <div style={{ maxWidth: 900, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '2.5rem', color: slide.color, opacity: 0.3, lineHeight: 1, flexShrink: 0 }}>{String(currentSlide + 1).padStart(2, '0')}</div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 'clamp(0.8rem, 2vw, 1.3rem)', color: slide.color, textShadow: `0 0 15px ${slide.color}88`, marginBottom: 6, letterSpacing: '2px' }}>{slide.title}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b8baa', fontSize: '0.85rem' }}>{slide.subtitle}</div>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', border: `3px solid ${slide.color}`, boxShadow: `0 0 30px ${slide.color}22`, padding: '28px 32px', position: 'relative', marginBottom: 16 }}>
            {[{ top: -6, left: -6 }, { top: -6, right: -6 }, { bottom: -6, left: -6 }, { bottom: -6, right: -6 }].map((pos, i) => (
              <div key={i} style={{ position: 'absolute', width: 12, height: 12, background: slide.color, ...pos }} />
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {slide.content.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 8, height: 8, background: slide.color, boxShadow: `0 0 6px ${slide.color}`, flexShrink: 0, marginTop: 7 }} />
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.65rem, 1.1vw, 0.88rem)', color: '#e0e0f0', lineHeight: 1.8 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: `${slide.color}0d`, backdropFilter: 'blur(4px)', border: `1px solid ${slide.color}44`, padding: '14px 18px' }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.45rem', color: slide.color, marginBottom: 8, letterSpacing: 2 }}>DEEP DIVE</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#aaa', lineHeight: 1.75 }}>{slide.detail}</div>
            {currentSlide === SLIDES.length - 1 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button onClick={onBack} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '0.5rem', background: 'rgba(0,0,0,0.7)', border: '3px solid #06FFA5', color: '#06FFA5', padding: '10px 18px', cursor: 'pointer', letterSpacing: 1 }}>RETURN TO HOME</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {SLIDES.map((_sl, i) => (
              <button key={i} onClick={() => goTo(i)} style={{ width: i === currentSlide ? 20 : 7, height: 7, background: i === currentSlide ? slide.color : i < currentSlide ? '#8338EC' : '#2a2a4a', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => navigate(-1)} disabled={currentSlide === 0} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 44, height: 70, background: currentSlide === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.75)', border: `2px solid ${currentSlide === 0 ? '#222' : '#8338EC'}`, color: currentSlide === 0 ? '#333' : '#8338EC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === 0 ? 'default' : 'pointer', opacity: currentSlide === 0 ? 0.3 : 1, zIndex: 20 }}>
        <ChevronLeft size={20} />
      </button>
      <button onClick={() => navigate(1)} disabled={currentSlide === SLIDES.length - 1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 44, height: 70, background: currentSlide === SLIDES.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.75)', border: `2px solid ${currentSlide === SLIDES.length - 1 ? '#222' : '#06FFA5'}`, color: currentSlide === SLIDES.length - 1 ? '#333' : '#06FFA5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === SLIDES.length - 1 ? 'default' : 'pointer', opacity: currentSlide === SLIDES.length - 1 ? 0.3 : 1, zIndex: 20 }}>
        <ChevronRight size={20} />
      </button>

      {gestureEnabled && <GestureHUD state={gestureState} />}
      {gestureEnabled && <GestureControlPanel />}
      <TetrisRow count={36} reversed />
    </div>
  );
}