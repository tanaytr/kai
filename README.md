# 🚀 NVIDIA GH200 Grace Hopper Explorer

An interactive web application that brings the NVIDIA GH200 Grace Hopper Superchip to life with a collection of playful, educational engines covering everything from architecture, caches, instruction decoding, to an assembly sandbox, benchmarks, and gesture-driven interaction.

---

## ✨ What’s Inside

### 🧠 Engines (12 Total)

1. **📚 Slides** – Step through a full technical deck covering ISA, pipeline, cache, memory, and system architecture.
2. **🔬 3D Chip Viewer** – Explore a GH200 die model (GLTF + stencil modes) with 14 clickable hotspots.
3. **🧩 Chip Assembler** – Build / disassemble the GH200: drag parts onto a board and learn what each component does.
4. **⚡ Pipeline Animator** – Watch instructions flow through Fetch → Decode → Execute → Writeback.
5. **📊 Benchmark Arena** – Animated performance comparisons (GH200 vs GB200 vs MI300X vs H100).
6. **🧱 Memory Explorer** – Navigate the full hierarchy: Registers → L1 → L2 → L3 → LPDDR5X → HBM3e.
7. **🎮 Data Routing Game** – Interactive puzzle: route packets through the correct chip subsystems.
8. **⚙️ Architecture Visualizer** – Real-time system simulation across CPU/GPU/NVLink/HBM workloads.
9. **🧠 Cache Explorer** – Learn caching with 3 modes: diagrams, game, and hybrid view.
10. **🧩 ISA Decoder** – Decode ARMv9-A instructions: binary → assembly → micro-ops.
11. **💻 Assembly Compiler** – Write & run 8086/8085/8051 assembly and see registers update in real-time.
12. **📄 Research Viewer** – Read the project paper and case study PDFs (built-in zoom + page navigation).

---

## 🎮 Gesture & Input Controls

This app includes a gesture engine powered by **TensorFlow.js + MediaPipe Hands**.

- **Camera permission required** (no video is shown) for gesture control.
- **Slides**: swipe left/right with index finger.
- **3D viewer**: rotate with index finger, zoom with fist open/close.
- **Other screens**: still fully usable with mouse & keyboard.

> ⚠️ If camera access is blocked, gesture-driven screens will fall back to manual controls.

---

## 🎵 Music Engine

Built on **Web Audio API** with procedural synthesis:

- Multi-oscillator (sine + triangle + sawtooth)
- ADSR envelope + sequencer
- 6 themes: Oppenheimer, Interstellar, Jupiter, Für Elise, Harry Potter, F1 Theme.

## 🛠️ Installation
```bash
npm install
```
## 🏗️ Build
```bash
npm run build
```

## 💻 Development
```bash
npm run dev
```

Open http://localhost:5173



## 🚀 In Browser

Open https://gh-coa.web.app/ In Any Modern Browser

## Render

1. Connect GitHub repo
2. Build: `npm run build`
3. Publish: `dist`


## 🌐 Browser Support

- Chrome/Edge (best - full MediaPipe support)
- Firefox/Safari (limited gesture support)
- Modern browsers with Web Audio API

## 👥 Credits

**Created by:**
- Srishti Jain
- Diksha Rathi
- Tanay Trivedi

**Technologies:**
- React 18 + TypeScript
- Vite
- Three.js (3D rendering)
- MediaPipe (gesture control)
- Web Audio API (music)
- Recharts (visualizations)

## 📄 License

Educational project for Computer Organization & Architecture course.