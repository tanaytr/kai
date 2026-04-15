import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  new URL("pdfjs-dist/build/pdf.worker.js", import.meta.url).toString();

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Download, FileText, BookOpen } from 'lucide-react';

interface PaperModalProps {
  onBack: () => void;
}

type DocumentMode = 'paper' | 'case';

export default function PaperModal({ onBack }: PaperModalProps) {
  const [mode, setMode] = useState<DocumentMode>('paper');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const currentPdf = mode === 'paper' ? '/paper.pdf' : '/case.pdf';

  // Load PDF when mode changes
  useEffect(() => {
    setLoading(true);
    setError(false);
    setCurrentPage(1);
    
    pdfjsLib.getDocument(currentPdf).promise
      .then((pdf: any) => {
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [currentPdf]);

  // Render page — keep scroll centered on zoom
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || loading) return;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }

      const page = await pdfDocRef.current.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = { canvasContext: ctx, viewport };
      renderTaskRef.current = page.render(renderContext);

      try {
        await renderTaskRef.current.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') console.error(e);
      }
    };

    renderPage();
  }, [currentPage, scale, loading]);

  // Re-center scroll after zoom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [scale]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(numPages, p + 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage(p => Math.max(1, p - 1));
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(3, s + 0.2));
      if (e.key === '-') setScale(s => Math.max(0.4, s - 0.2));
      if (e.key === 'Escape') onBack();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [numPages, onBack]);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setFullscreen(v => !v);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}
    >

      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '3px solid #8338EC',
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 8,
        flexWrap: 'wrap',
      }}>

        <button
          onClick={onBack}
          style={{
            fontFamily: "'Press Start 2P', cursive",
            background: '#000',
            border: '3px solid #FFBE0B',
            color: '#FFBE0B',
            padding: '8px 14px',
            fontSize: '0.55rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ArrowLeft size={11} /> EXIT
        </button>

        {/* Mode Selector - Center */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <button
            onClick={() => setMode('paper')}
            style={{
              fontFamily: "'Press Start 2P', cursive",
              background: mode === 'paper' ? 'rgba(131,56,236,0.3)' : 'rgba(0,0,0,0.5)',
              border: `3px solid ${mode === 'paper' ? '#8338EC' : '#444'}`,
              color: mode === 'paper' ? '#8338EC' : '#666',
              padding: '8px 16px',
              fontSize: '0.48rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: 1,
              boxShadow: mode === 'paper' ? '0 0 12px #8338EC66' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <FileText size={12} /> {mode === 'paper' ? '▶ ' : ''}PAPER
          </button>

          <button
            onClick={() => setMode('case')}
            style={{
              fontFamily: "'Press Start 2P', cursive",
              background: mode === 'case' ? 'rgba(6,255,165,0.3)' : 'rgba(0,0,0,0.5)',
              border: `3px solid ${mode === 'case' ? '#06FFA5' : '#444'}`,
              color: mode === 'case' ? '#06FFA5' : '#666',
              padding: '8px 16px',
              fontSize: '0.48rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: 1,
              boxShadow: mode === 'case' ? '0 0 12px #06FFA566' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <BookOpen size={12} /> {mode === 'case' ? '▶ ' : ''}CASE STUDY
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>

          <button
            onClick={() => setScale(s => Math.max(0.4, s - 0.2))}
            style={{
              background: '#000',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ZoomOut size={14} />
          </button>

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            color: '#00d4ff',
            minWidth: 40,
            textAlign: 'center'
          }}>
            {Math.round(scale * 100)}%
          </div>

          <button
            onClick={() => setScale(s => Math.min(3, s + 0.2))}
            style={{
              background: '#000',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ZoomIn size={14} />
          </button>

          <a href={currentPdf} download>
            <button
              style={{
                background: '#000',
                border: '2px solid #06FFA5',
                color: '#06FFA5',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
            </button>
          </a>

          <button
            onClick={toggleFullscreen}
            style={{
              background: fullscreen ? 'rgba(131,56,236,0.3)' : '#000',
              border: `2px solid ${fullscreen ? '#8338EC' : '#555'}`,
              color: fullscreen ? '#8338EC' : '#888',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Maximize2 size={14} />
          </button>

        </div>
      </div>

      {/* Page indicator - below header */}
      {!loading && !error && (
        <div style={{
          padding: '6px 0',
          background: 'rgba(0,0,0,0.7)',
          borderBottom: '1px solid #333',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: mode === 'paper' ? '#8338EC' : '#06FFA5',
            fontSize: '0.65rem',
          }}>
            PAGE {currentPage} / {numPages}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Prev — fixed to viewport */}
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          style={{
            position: 'fixed',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            width: 44,
            height: 70,
            background: 'rgba(0,0,0,0.85)',
            border: '2px solid #8338EC',
            color: '#8338EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.3 : 1,
          }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Next — fixed to viewport */}
        <button
          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          style={{
            position: 'fixed',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            width: 44,
            height: 70,
            background: 'rgba(0,0,0,0.85)',
            border: '2px solid #06FFA5',
            color: '#06FFA5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentPage >= numPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= numPages ? 0.3 : 1,
          }}
        >
          <ChevronRight size={20} />
        </button>

        {/* Scrollable canvas area */}
        <div
          ref={scrollContainerRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'auto',
          }}
        >
          <div style={{
            minWidth: '100%',
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
            boxSizing: 'border-box',
          }}>

            {loading && (
              <div style={{ 
                color: mode === 'paper' ? '#8338EC' : '#06FFA5', 
                fontFamily: "'Press Start 2P', cursive",
                fontSize: '0.5rem',
                letterSpacing: 2,
              }}>
                LOADING {mode === 'paper' ? 'PAPER' : 'CASE STUDY'}...
              </div>
            )}

            {error && (
              <div style={{ 
                color: '#FF006E', 
                fontFamily: "'Press Start 2P', cursive",
                fontSize: '0.45rem',
                textAlign: 'center',
                lineHeight: 1.8,
              }}>
                PDF NOT FOUND<br/>
                <span style={{ fontSize: '0.35rem', color: '#666' }}>
                  Place {mode === 'paper' ? 'paper.pdf' : 'case.pdf'} in /public
                </span>
              </div>
            )}

            {!loading && !error && (
              <div style={{
                boxShadow: '0 8px 60px rgba(0,0,0,0.8)',
                background: '#fff',
                display: 'inline-block',
                flexShrink: 0,
              }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}