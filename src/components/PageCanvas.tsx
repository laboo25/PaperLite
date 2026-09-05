import React, { useEffect, useRef, useState } from 'react';
import { pdfEngine } from '../services/pdfEngine';
import { AnnotationTool, PDFAnnotation, ReaderTheme } from '../types';
import { MessageSquare, Trash2, X, Check } from 'lucide-react';

interface PageCanvasProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  theme: ReaderTheme;
  renderQuality: 'normal' | 'high';
  activeTool: AnnotationTool;
  activeColor: string;
  annotations: PDFAnnotation[];
  lowPowerMode?: boolean;
  resourceBoundaryEnabled?: boolean;
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
  lowPowerMode,
  resourceBoundaryEnabled,
  onAddAnnotation,
  onDeleteAnnotation,
  onVisibleChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(!onVisibleChange);
  const [isLoading, setIsLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 });

  // Pen Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  // Area Highlight Dragging state
  const [isHighlightDragging, setIsHighlightDragging] = useState(false);
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null);
  const [highlightCurrent, setHighlightCurrent] = useState<{ x: number; y: number } | null>(null);

  // Sticky Note state
  const [activeNotePopup, setActiveNotePopup] = useState<string | null>(null);
  const [newNotePos, setNewNotePos] = useState<{ x: number; y: number } | null>(null);
  const [newNoteText, setNewNoteText] = useState('');

  // Fetch page dimensions with current rotation
  useEffect(() => {
    let isMounted = true;
    pdfEngine.getPageDimension(pageNumber, rotation).then((dim) => {
      if (isMounted) {
        setDimensions({ width: dim.width, height: dim.height });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pageNumber, rotation]);

  // High-fidelity selectable text layer rendering with official PDF.js engine
  useEffect(() => {
    const textContainer = textLayerRef.current;
    if (!textContainer) return;

    if (!isVisible) {
      textContainer.replaceChildren();
      return;
    }

    let cancelObj: { cancel: () => void; promise: Promise<void> } | null = null;
    let isCancelled = false;

    // Small 70ms debounce so fast scrolling doesn't build text layers for pages scrolled past
    const timer = setTimeout(() => {
      if (isCancelled) return;
      pdfEngine
        .renderTextLayer({
          container: textContainer,
          pageNumber,
          scale,
          rotation
        })
        .then((res) => {
          if (isCancelled) {
            res?.cancel();
          } else {
            cancelObj = res;
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.warn('Text layer render notice:', err);
          }
        });
    }, 70);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (cancelObj) {
        cancelObj.cancel();
      }
      if (textContainer) {
        textContainer.replaceChildren();
      }
    };
  }, [pageNumber, scale, rotation, isVisible]);

  // Viewport virtualization & memory recycling
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
        rootMargin: '300px 0px 300px 0px',
        threshold: 0.01
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (onVisibleChange) {
        onVisibleChange(pageNumber, false);
      }
    };
  }, [pageNumber, onVisibleChange]);

  // Render canvas when visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isVisible) {
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
        renderQuality,
        lowPowerMode,
        resourceBoundaryEnabled
      })
      .then(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setIsLoading(false);
          console.warn(`Render page ${pageNumber} notice:`, err);
        }
      });

    return () => {
      isCancelled = true;
      pdfEngine.cleanupPageCanvas(canvas, pageNumber);
    };
  }, [pageNumber, scale, rotation, renderQuality, isVisible, lowPowerMode, resourceBoundaryEnabled]);

  // Redraw Pen Ink Canvas
  useEffect(() => {
    const dCanvas = drawCanvasRef.current;
    if (!dCanvas) return;

    if (!isVisible) {
      dCanvas.width = 0;
      dCanvas.height = 0;
      return;
    }

    dCanvas.width = dimensions.width * scale;
    dCanvas.height = dimensions.height * scale;
    const ctx = dCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dCanvas.width, dCanvas.height);

    // Draw saved ink strokes for this page
    const pageInks = annotations.filter(
      (a) => a.pageNumber === pageNumber && a.type === 'pen' && a.drawingPoints
    );

    for (const ink of pageInks) {
      if (!ink.drawingPoints || ink.drawingPoints.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = ink.color;
      ctx.lineWidth = (ink.strokeWidth || 2.5) * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(ink.drawingPoints[0].x * scale, ink.drawingPoints[0].y * scale);
      for (let i = 1; i < ink.drawingPoints.length; i++) {
        ctx.lineTo(ink.drawingPoints[i].x * scale, ink.drawingPoints[i].y * scale);
      }
      ctx.stroke();
    }

    // Draw active drawing stroke in real-time
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

    return () => {
      if (dCanvas) {
        dCanvas.width = 0;
        dCanvas.height = 0;
      }
    };
  }, [annotations, currentStroke, pageNumber, scale, dimensions, activeColor, isVisible]);

  // Pointer Down (Pen drawing / Sticky note / Area highlight)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (activeTool === 'pen') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (activeTool === 'note') {
      setNewNotePos({ x, y });
      setNewNoteText('');
    } else if (activeTool === 'highlight') {
      // Area box highlight: only if Shift key is pressed or clicked explicitly outside text
      const target = e.target as HTMLElement;
      const isSpan = target.tagName === 'SPAN' || target.closest('span');
      if (e.shiftKey && !isSpan) {
        setIsHighlightDragging(true);
        setHighlightStart({ x, y });
        setHighlightCurrent({ x, y });
      }
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (isDrawing && activeTool === 'pen') {
      setCurrentStroke((prev) => [...prev, { x, y }]);
    } else if (isHighlightDragging && activeTool === 'highlight') {
      setHighlightCurrent({ x, y });
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawing && activeTool === 'pen') {
      setIsDrawing(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
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
    } else if (isHighlightDragging && activeTool === 'highlight') {
      setIsHighlightDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }

      if (highlightStart && highlightCurrent) {
        const x1 = Math.min(highlightStart.x, highlightCurrent.x);
        const y1 = Math.min(highlightStart.y, highlightCurrent.y);
        const w = Math.abs(highlightCurrent.x - highlightStart.x);
        const h = Math.abs(highlightCurrent.y - highlightStart.y);

        // Only save if drag was meaningful (greater than 12x12px)
        if (w > 12 && h > 10) {
          onAddAnnotation({
            id: 'hl-box-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            pageNumber,
            type: 'highlight',
            color: activeColor,
            rects: [{ x: x1, y: y1, width: w, height: h }],
            createdAt: Date.now()
          });
        }
      }
      setHighlightStart(null);
      setHighlightCurrent(null);
    }
  };

  // Save new Sticky Note
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
  const highlightAnnotations = pageAnnotations.filter(
    (a) => (a.type === 'highlight' || a.type === 'underline') && a.rects && a.rects.length > 0
  );
  const noteAnnotations = pageAnnotations.filter((a) => a.type === 'note' && a.position);

  const displayWidth = dimensions.width * scale;
  const displayHeight = dimensions.height * scale;

  return (
    <div
      ref={containerRef}
      id={`page-container-${pageNumber}`}
      data-page-number={pageNumber}
      className={`relative mx-auto rounded-xs shadow-md transition-shadow group ${
        activeTool === 'pen'
          ? 'cursor-crosshair'
          : activeTool === 'note'
          ? 'cursor-cell'
          : activeTool === 'highlight'
          ? 'cursor-text'
          : 'cursor-text'
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
      onPointerCancel={handlePointerUp}
    >
      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/60 backdrop-blur-xs z-10">
          <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] font-mono text-stone-500 mt-2">Loading Page {pageNumber}...</span>
        </div>
      )}

      {/* Main High-DPI PDF.js Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 block rounded-xs select-none pointer-events-none"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`
        }}
      />

      {/* Saved Highlights, Underlines, Strikes, and Text Edits */}
      {highlightAnnotations.map((hl) => (
        <div key={hl.id} className="absolute inset-0 pointer-events-none z-15">
          {hl.rects?.map((r, rIdx) => {
            const isStrike = hl.type === 'strike';
            const isUnderline = hl.type === 'underline';
            const isHighlight = hl.type === 'highlight';

            return (
              <div
                key={rIdx}
                className={`absolute transition-opacity rounded-xs ${
                  activeTool === 'eraser'
                    ? 'pointer-events-auto cursor-pointer hover:opacity-100 hover:ring-2 hover:ring-rose-500'
                    : 'pointer-events-none'
                }`}
                style={{
                  left: `${r.x * scale}px`,
                  top: isStrike ? `${(r.y + r.height * 0.45) * scale}px` : `${r.y * scale}px`,
                  width: `${r.width * scale}px`,
                  height: isStrike ? '2.5px' : `${r.height * scale}px`,
                  backgroundColor: isStrike
                    ? (hl.color || '#EF4444')
                    : isHighlight
                    ? hl.color
                    : 'transparent',
                  borderBottom: isUnderline ? `2.5px solid ${hl.color}` : 'none',
                  opacity: isHighlight ? 0.45 : 1,
                  mixBlendMode: isHighlight ? 'multiply' : 'normal'
                }}
                title={hl.comment ? `${hl.comment} (${hl.text})` : (hl.text ? `"${hl.text}"` : 'Annotation')}
                onClick={(e) => {
                  if (activeTool === 'eraser') {
                    e.stopPropagation();
                    onDeleteAnnotation(hl.id);
                  }
                }}
              />
            );
          })}

          {/* Inline Edit Callout Badge for edited or annotated text */}
          {hl.comment && hl.rects && hl.rects.length > 0 && (
            <div
              className="absolute z-16 pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-medium shadow-xs cursor-pointer hover:scale-105 transition-transform"
              style={{
                left: `${(hl.rects[hl.rects.length - 1].x + hl.rects[hl.rects.length - 1].width) * scale + 4}px`,
                top: `${hl.rects[hl.rects.length - 1].y * scale}px`
              }}
              title={hl.comment}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'eraser') {
                  onDeleteAnnotation(hl.id);
                }
              }}
            >
              <span>{hl.comment.startsWith('Edit:') ? hl.comment : `✏️ ${hl.comment}`}</span>
            </div>
          )}
        </div>
      ))}

      {/* Official PDF.js High-Fidelity Selectable Text Layer */}
      <div
        ref={textLayerRef}
        className={`textLayer pdf-text-layer absolute inset-0 z-20 overflow-hidden leading-none select-text ${
          activeTool === 'pen' || activeTool === 'eraser'
            ? 'pointer-events-none select-none'
            : 'pointer-events-auto select-text cursor-text'
        }`}
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`
        }}
      />

      {/* Live Area Highlight Drag Preview */}
      {isHighlightDragging && highlightStart && highlightCurrent && (
        <div
          className="absolute z-25 pointer-events-none border border-dashed border-stone-800/40 rounded-xs"
          style={{
            left: `${Math.min(highlightStart.x, highlightCurrent.x) * scale}px`,
            top: `${Math.min(highlightStart.y, highlightCurrent.y) * scale}px`,
            width: `${Math.abs(highlightCurrent.x - highlightStart.x) * scale}px`,
            height: `${Math.abs(highlightCurrent.y - highlightStart.y) * scale}px`,
            backgroundColor: activeColor,
            opacity: 0.45,
            mixBlendMode: 'multiply'
          }}
        />
      )}

      {/* Pen Ink Overlay Canvas */}
      <canvas
        ref={drawCanvasRef}
        className={`absolute top-0 left-0 z-30 ${
          activeTool === 'pen' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
        }`}
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          touchAction: 'none'
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
            className="absolute z-40"
            style={{ left: `${left}px`, top: `${top}px` }}
          >
            {/* Note Pin Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'eraser') {
                  onDeleteAnnotation(note.id);
                  return;
                }
                setActiveNotePopup(isSelected ? null : note.id);
              }}
              className={`p-1.5 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform border border-black/10 ${
                activeTool === 'eraser' ? 'hover:bg-rose-500 hover:text-white' : ''
              }`}
              style={{ backgroundColor: activeTool === 'eraser' ? undefined : note.color }}
              title={activeTool === 'eraser' ? 'Click to delete note' : 'Click to read note'}
            >
              {activeTool === 'eraser' ? (
                <Trash2 className="w-3.5 h-3.5 text-rose-600 hover:text-white" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 text-stone-900 fill-stone-900/40" />
              )}
            </button>

            {/* Note Popup Window */}
            {isSelected && (
              <div
                className="absolute left-4 top-2 w-60 p-3 rounded-2xl bg-white shadow-2xl border border-stone-200 text-xs z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: note.color }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      Sticky Note
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDeleteAnnotation(note.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveNotePopup(null)}
                      className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-stone-800 text-xs leading-relaxed whitespace-pre-wrap font-normal">
                  {note.comment}
                </p>

                <div className="text-[9px] text-stone-400 font-mono pt-1 border-t border-stone-50">
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Page {pageNumber}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Adding a new sticky note popup modal */}
      {newNotePos && (
        <div
          className="absolute z-50 w-64 p-3 rounded-2xl bg-white shadow-2xl border border-blue-500/80 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${Math.min(displayWidth - 270, Math.max(10, newNotePos.x * scale))}px`,
            top: `${Math.min(displayHeight - 140, Math.max(10, newNotePos.y * scale))}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: activeColor }}
              />
              <span>New Sticky Note</span>
            </div>
            <button
              onClick={() => setNewNotePos(null)}
              className="text-stone-400 hover:text-stone-700 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                saveNewNote();
              }
            }}
            placeholder="Type your comment (Ctrl+Enter to save)..."
            rows={3}
            className="w-full p-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none bg-stone-50 text-stone-800"
            autoFocus
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-stone-400 font-mono">Page {pageNumber}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNewNotePos(null)}
                className="px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNewNote}
                disabled={!newNoteText.trim()}
                className="px-3 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 shadow-xs transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corner Page Number Indicator badge on hover */}
      <div className="absolute right-2 bottom-2 px-1.5 py-0.5 rounded-md bg-black/40 text-white text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none">
        {pageNumber}
      </div>
    </div>
  );
};
