import React, { useEffect, useRef, useState } from 'react';
import { pdfEngine } from '../services/pdfEngine';
import { AnnotationTool, PDFAnnotation, ReaderTheme } from '../types';
import { MessageSquare, Trash2, X } from 'lucide-react';

interface PageCanvasProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  theme: ReaderTheme;
  renderQuality: 'normal' | 'high';
  activeTool: AnnotationTool;
  activeColor: string;
  annotations: PDFAnnotation[];
  onAddAnnotation: (annotation: PDFAnnotation) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onVisibleChange?: (pageNumber: number, isVisible: boolean) => void;
}

export const PageCanvas: React.FC<PageCanvasProps> = ({
  pageNumber,
  scale,
  rotation,
  theme,
  renderQuality,
  activeTool,
  activeColor,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onVisibleChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isVisible, setIsVisible] = useState(!onVisibleChange);
  const [isLoading, setIsLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [activeNotePopup, setActiveNotePopup] = useState<string | null>(null);

  // New Note state
  const [newNotePos, setNewNotePos] = useState<{ x: number; y: number } | null>(null);
  const [newNoteText, setNewNoteText] = useState('');

  // Fetch dimensions once
  useEffect(() => {
    let isMounted = true;
    pdfEngine.getPageDimension(pageNumber).then((dim) => {
      if (isMounted) {
        setDimensions({ width: dim.width, height: dim.height });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [pageNumber]);

  // Setup Intersection Observer for viewport virtualization & memory recycling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        if (onVisibleChange) {
          onVisibleChange(pageNumber, visible);
        }
      },
      {
        root: null,
        rootMargin: '300px 0px 300px 0px', // Buffer 300px above and below
        threshold: 0.01
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [pageNumber, onVisibleChange]);

  // Render canvas when visible; recycle memory when off-screen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isVisible) {
      // Free VRAM when scrolled out
      pdfEngine.cleanupPageCanvas(canvas, pageNumber);
      return;
    }

    setIsLoading(true);
    let isCancelled = false;

    pdfEngine
      .renderPage({
        canvas,
        pageNumber,
        scale,
        rotation,
        renderQuality
      })
      .then(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setIsLoading(false);
          console.warn(`Render page ${pageNumber} caught:`, err);
        }
      });

    return () => {
      isCancelled = true;
      pdfEngine.cleanupPageCanvas(canvas, pageNumber);
    };
  }, [pageNumber, scale, rotation, renderQuality, isVisible]);

  // Redraw annotation ink canvas
  useEffect(() => {
    const dCanvas = drawCanvasRef.current;
    if (!dCanvas) return;

    dCanvas.width = dimensions.width * scale;
    dCanvas.height = dimensions.height * scale;
    const ctx = dCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dCanvas.width, dCanvas.height);

    // Draw saved ink strokes
    const pageInks = annotations.filter((a) => a.pageNumber === pageNumber && a.type === 'pen' && a.drawingPoints);
    for (const ink of pageInks) {
      if (!ink.drawingPoints || ink.drawingPoints.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = ink.color;
      ctx.lineWidth = (ink.strokeWidth || 2) * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(ink.drawingPoints[0].x * scale, ink.drawingPoints[0].y * scale);
      for (let i = 1; i < ink.drawingPoints.length; i++) {
        ctx.lineTo(ink.drawingPoints[i].x * scale, ink.drawingPoints[i].y * scale);
      }
      ctx.stroke();
    }

    // Draw current active stroke
    if (currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2.5 * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(currentStroke[0].x * scale, currentStroke[0].y * scale);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x * scale, currentStroke[i].y * scale);
      }
      ctx.stroke();
    }
  }, [annotations, currentStroke, pageNumber, scale, dimensions, activeColor]);

  // Handle pointer drawing & interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'pen') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (activeTool === 'note') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      setNewNotePos({ x, y });
      setNewNoteText('');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawing && activeTool === 'pen') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      setCurrentStroke((prev) => [...prev, { x, y }]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawing && activeTool === 'pen') {
      setIsDrawing(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (currentStroke.length > 1) {
        onAddAnnotation({
          id: 'ink-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          pageNumber,
          type: 'pen',
          color: activeColor,
          drawingPoints: currentStroke,
          strokeWidth: 2.5,
          createdAt: Date.now()
        });
      }
      setCurrentStroke([]);
    }
  };

  // Submit Note
  const saveNewNote = () => {
    if (!newNotePos || !newNoteText.trim()) {
      setNewNotePos(null);
      return;
    }

    onAddAnnotation({
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber,
      type: 'note',
      color: activeColor,
      comment: newNoteText.trim(),
      position: newNotePos,
      createdAt: Date.now()
    });

    setNewNotePos(null);
    setNewNoteText('');
  };

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);
  const noteAnnotations = pageAnnotations.filter((a) => a.type === 'note' && a.position);

  const displayWidth = dimensions.width * scale;
  const displayHeight = dimensions.height * scale;

  return (
    <div
      ref={containerRef}
      id={`page-container-${pageNumber}`}
      data-page-number={pageNumber}
      className={`relative mx-auto rounded-xs shadow-md transition-shadow select-none group ${
        activeTool === 'pen' ? 'cursor-crosshair' : activeTool === 'note' ? 'cursor-cell' : 'cursor-text'
      }`}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        backgroundColor: theme === 'dark-accent' ? '#2C2C2E' : '#FFFFFF',
        boxShadow: 'var(--page-shadow)'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/60 backdrop-blur-xs z-10">
          <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] font-mono text-stone-500 mt-2">Loading Page {pageNumber}...</span>
        </div>
      )}

      {/* Main High-DPI PDF.js Render Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 block rounded-xs"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`
        }}
      />

      {/* Ink Drawing Overlay Canvas */}
      <canvas
        ref={drawCanvasRef}
        className="absolute top-0 left-0 pointer-events-none z-10"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`
        }}
      />

      {/* Sticky Note Pins Overlay */}
      {noteAnnotations.map((note) => {
        const isSelected = activeNotePopup === note.id;
        const left = (note.position?.x || 0) * scale;
        const top = (note.position?.y || 0) * scale;

        return (
          <div
            key={note.id}
            className="absolute z-20"
            style={{ left: `${left}px`, top: `${top}px` }}
          >
            {/* Note Pin Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveNotePopup(isSelected ? null : note.id);
              }}
              className="p-1 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
              style={{ backgroundColor: note.color }}
            >
              <MessageSquare className="w-3.5 h-3.5 text-stone-900 fill-stone-900/40" />
            </button>

            {/* Note Popup Window */}
            {isSelected && (
              <div
                className="absolute left-4 top-2 w-56 p-2.5 rounded-xl bg-white shadow-xl border border-stone-200 text-xs z-30 space-y-2 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Sticky Note
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDeleteAnnotation(note.id)}
                      className="p-0.5 text-stone-400 hover:text-rose-500 rounded"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setActiveNotePopup(null)}
                      className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-stone-800 text-xs leading-relaxed whitespace-pre-wrap">
                  {note.comment}
                </p>

                <div className="text-[9px] text-stone-400 font-mono">
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Adding a new sticky note popup */}
      {newNotePos && (
        <div
          className="absolute z-30 w-60 p-2.5 rounded-xl bg-white shadow-2xl border border-blue-400/80 text-xs space-y-2"
          style={{
            left: `${Math.min(displayWidth - 250, Math.max(10, newNotePos.x * scale))}px`,
            top: `${Math.min(displayHeight - 120, Math.max(10, newNotePos.y * scale))}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold text-stone-600">
            <span>New Note</span>
            <button
              onClick={() => setNewNotePos(null)}
              className="text-stone-400 hover:text-stone-700"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Type your comment or thoughts..."
            rows={3}
            className="w-full p-2 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-stone-50"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setNewNotePos(null)}
              className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={saveNewNote}
              disabled={!newNoteText.trim()}
              className="px-2.5 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-40"
            >
              Add Note
            </button>
          </div>
        </div>
      )}

      {/* Corner Page Number Indicator badge on hover */}
      <div className="absolute right-2 bottom-2 px-1.5 py-0.5 rounded-md bg-black/40 text-white text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {pageNumber}
      </div>
    </div>
  );
};
