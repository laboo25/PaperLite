import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PageCanvas } from './PageCanvas';
import { AnnotationTool, PDFAnnotation, ReaderSettings } from '../types';
import { pdfEngine } from '../services/pdfEngine';
import { resourceGovernor } from '../services/resourceGovernor';
import { HIGHLIGHT_COLORS } from './AnnotationToolbar';
import {
  Highlighter,
  Underline as UnderlineIcon,
  Strikethrough,
  Edit3,
  MessageSquare,
  Copy,
  Search,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PagePlaceholderProps {
  pageNumber: number;
  width: number;
  height: number;
  rotation?: number;
  scale?: number;
  onVisibleChange: (pageNumber: number, isVisible: boolean) => void;
}

const PagePlaceholder: React.FC<PagePlaceholderProps> = ({
  pageNumber,
  width,
  height,
  rotation = 0,
  scale = 1,
  onVisibleChange
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0].isIntersecting;
        onVisibleChange(pageNumber, visible);
      },
      {
        root: null,
        rootMargin: '350px 0px 350px 0px',
        threshold: 0.01
      }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      onVisibleChange(pageNumber, false);
    };
  }, [pageNumber, onVisibleChange]);

  // Use individual measured page dimensions if cached in engine for 100% precision
  const cachedDim = pdfEngine.getCachedPageDimension(pageNumber, rotation);
  const finalWidth = cachedDim ? cachedDim.width * scale : width;
  const finalHeight = cachedDim ? cachedDim.height * scale : height;

  return (
    <div
      ref={ref}
      id={`page-container-${pageNumber}`}
      data-page-number={pageNumber}
      style={{
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        maxWidth: '100%'
      }}
      className="relative flex flex-col items-center justify-center bg-white/70 rounded-xl border border-stone-200/60 shadow-xs text-stone-400 select-none"
    >
      <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-stone-100/60 border border-stone-200/50">
        <span className="text-xs font-mono font-bold text-stone-500">Page {pageNumber}</span>
        <span className="text-[10px] text-stone-400 font-sans">Scroll to view</span>
      </div>
    </div>
  );
};

interface PDFViewerProps {
  documentId?: string;
  totalPages: number;
  currentPage: number;
  settings: ReaderSettings;
  activeTool: AnnotationTool;
  activeColor: string;
  annotations: PDFAnnotation[];
  onPageChange: (page: number) => void;
  onAddAnnotation: (annotation: PDFAnnotation) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onSearchQuery?: (query: string) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  documentId,
  totalPages,
  currentPage,
  settings,
  activeTool,
  activeColor,
  annotations,
  onPageChange,
  onAddAnnotation,
  onDeleteAnnotation,
  onSearchQuery
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTextPopup, setSelectedTextPopup] = useState<{
    text: string;
    x: number;
    y: number;
    pageNumber: number;
    rects: { x: number; y: number; width: number; height: number }[];
    placement?: 'above' | 'below';
  } | null>(null);

  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteComment, setNoteComment] = useState('');
  const [showEditInput, setShowEditInput] = useState(false);
  const [editText, setEditText] = useState('');

  // Track default page dimensions for virtualization placeholder sizing
  const [estimatedDim, setEstimatedDim] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  useEffect(() => {
    let isMounted = true;
    pdfEngine.getPageDimension(1, settings.rotation).then((dim) => {
      if (isMounted && dim) {
        setEstimatedDim({ width: dim.width, height: dim.height });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [documentId, settings.rotation]);

  // Track visible pages to sync active currentPage in continuous mode
  const visiblePagesMap = useRef<Map<number, boolean>>(new Map());
  const lastScrolledPageRef = useRef<number>(currentPage);

  // Clear visible tracking when document changes
  useEffect(() => {
    visiblePagesMap.current.clear();
  }, [documentId]);

  const handleVisibleChange = useCallback(
    (pageNumber: number, isVisible: boolean) => {
      if (isVisible) {
        visiblePagesMap.current.set(pageNumber, true);
      } else {
        visiblePagesMap.current.delete(pageNumber);
      }

      if (isVisible && settings.viewMode === 'continuous') {
        let firstVisible = totalPages;
        visiblePagesMap.current.forEach((vis, p) => {
          if (vis && p < firstVisible) {
            firstVisible = p;
          }
        });
        if (firstVisible !== currentPage && firstVisible <= totalPages) {
          onPageChange(firstVisible);
        }
      }
    },
    [currentPage, totalPages, settings.viewMode, onPageChange]
  );

  // Scroll to page when currentPage changes in continuous mode
  useEffect(() => {
    if (settings.viewMode === 'continuous') {
      const el = document.getElementById(`page-container-${currentPage}`);
      if (el && containerRef.current) {
        const container = containerRef.current;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Only scroll if outside viewing bounds
        if (rect.top < containerRect.top || rect.bottom > containerRect.bottom + 200) {
          const isFarJump = Math.abs((lastScrolledPageRef.current || 1) - currentPage) > 3;
          el.scrollIntoView({ behavior: isFarJump ? 'auto' : 'smooth', block: 'start' });
        }
      }
    }
    lastScrolledPageRef.current = currentPage;
  }, [currentPage, settings.viewMode]);

  // Handle native text selection and show custom context menu
  const checkAndHandleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (!showNoteInput && !showEditInput) {
        setSelectedTextPopup(null);
      }
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length === 0) {
      if (!showNoteInput && !showEditInput) {
        setSelectedTextPopup(null);
      }
      return;
    }

    const range = selection.getRangeAt(0);
    let rawRects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0
    );

    // Fallback if individual clientRects are empty across spans
    if (rawRects.length === 0) {
      const bound = range.getBoundingClientRect();
      if (bound && bound.width > 0 && bound.height > 0) {
        rawRects = [bound];
      }
    }

    if (rawRects.length === 0) return;

    // Determine target page container from candidate selection nodes
    const candidateNodes: (Node | null)[] = [
      selection.anchorNode,
      selection.focusNode,
      range.startContainer,
      range.endContainer,
      range.commonAncestorContainer
    ];

    let pageContainer: HTMLElement | null = null;
    let pageNum = currentPage;

    for (const node of candidateNodes) {
      if (!node) continue;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
      const container = el?.closest?.('[data-page-number]') as HTMLElement | null;
      if (container) {
        pageContainer = container;
        const parsed = parseInt(container.getAttribute('data-page-number') || '', 10);
        if (!isNaN(parsed) && parsed > 0) {
          pageNum = parsed;
          break;
        }
      }
    }

    if (!pageContainer) {
      pageContainer = document.getElementById(`page-container-${pageNum}`);
    }
    const pageRect = pageContainer ? pageContainer.getBoundingClientRect() : null;

    // Convert client rects to unscaled page coordinates
    const scale = settings.zoom || 1.0;
    const unscaledRects: { x: number; y: number; width: number; height: number }[] = [];

    if (pageRect) {
      for (const cr of rawRects) {
        unscaledRects.push({
          x: (cr.left - pageRect.left) / scale,
          y: (cr.top - pageRect.top) / scale,
          width: cr.width / scale,
          height: cr.height / scale
        });
      }
    } else {
      for (const cr of rawRects) {
        unscaledRects.push({
          x: cr.left / scale,
          y: cr.top / scale,
          width: cr.width / scale,
          height: cr.height / scale
        });
      }
    }

    // Auto-highlight if activeTool === 'highlight'
    if (activeTool === 'highlight' && unscaledRects.length > 0) {
      onAddAnnotation({
        id: 'hl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        pageNumber: pageNum,
        type: 'highlight',
        color: activeColor,
        text,
        rects: unscaledRects,
        createdAt: Date.now()
      });
      window.getSelection()?.removeAllRanges();
      setSelectedTextPopup(null);
      return;
    }

    // Anchor popup safely within viewport boundaries
    const firstRect = rawRects[0];
    const lastRect = rawRects[rawRects.length - 1];
    const popupX = Math.max(160, Math.min(window.innerWidth - 160, (firstRect.left + lastRect.right) / 2));

    // If text is near top of viewport, position context popup below selection
    const isNearTop = firstRect.top < 95;
    const popupY = isNearTop
      ? Math.min(window.innerHeight - 60, lastRect.bottom + 8)
      : Math.max(50, firstRect.top - 8);

    setSelectedTextPopup({
      text,
      x: popupX,
      y: popupY,
      pageNumber: pageNum,
      rects: unscaledRects,
      placement: isNearTop ? 'below' : 'above'
    });
    setShowNoteInput(false);
    setShowEditInput(false);
    setNoteComment('');
    setEditText('');
  }, [activeTool, activeColor, currentPage, onAddAnnotation, settings.zoom, showEditInput, showNoteInput]);

  // Global document mouseup ensures selection is captured anywhere in the window
  useEffect(() => {
    const onDocMouseUp = (e: MouseEvent) => {
      const popupEl = document.getElementById('selected-text-context-popup');
      if (popupEl && popupEl.contains(e.target as Node)) {
        return;
      }
      setTimeout(checkAndHandleSelection, 20);
    };

    document.addEventListener('mouseup', onDocMouseUp);
    return () => {
      document.removeEventListener('mouseup', onDocMouseUp);
    };
  }, [checkAndHandleSelection]);

  const applyTextHighlight = (color: string) => {
    if (!selectedTextPopup) return;

    onAddAnnotation({
      id: 'hl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'highlight',
      color,
      text: selectedTextPopup.text,
      rects: selectedTextPopup.rects,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
    setShowNoteInput(false);
  };

  const applyTextUnderline = (color: string) => {
    if (!selectedTextPopup) return;

    onAddAnnotation({
      id: 'ul-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'underline',
      color,
      text: selectedTextPopup.text,
      rects: selectedTextPopup.rects,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
    setShowNoteInput(false);
  };

  const applyTextStrike = (color: string) => {
    if (!selectedTextPopup) return;

    onAddAnnotation({
      id: 'st-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'strike',
      color: color || '#EF4444',
      text: selectedTextPopup.text,
      rects: selectedTextPopup.rects,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
    setShowNoteInput(false);
    setShowEditInput(false);
  };

  const handleSaveTextEdit = () => {
    if (!selectedTextPopup || !editText.trim()) return;

    onAddAnnotation({
      id: 'edit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'strike',
      color: '#EF4444',
      comment: `Edit: "${editText.trim()}"`,
      text: selectedTextPopup.text,
      rects: selectedTextPopup.rects,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
    setShowEditInput(false);
    setEditText('');
  };

  const handleCopyText = async () => {
    if (!selectedTextPopup) return;
    try {
      await navigator.clipboard.writeText(selectedTextPopup.text);
      setCopiedFeedback(true);
      setTimeout(() => {
        setCopiedFeedback(false);
        window.getSelection()?.removeAllRanges();
        setSelectedTextPopup(null);
      }, 800);
    } catch {
      // Fallback
    }
  };

  const handleSaveTextNote = () => {
    if (!selectedTextPopup || !noteComment.trim()) return;

    const firstRect = selectedTextPopup.rects[0] || { x: 50, y: 50 };

    onAddAnnotation({
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'note',
      color: activeColor,
      comment: noteComment.trim(),
      position: { x: firstRect.x, y: Math.max(0, firstRect.y - 20) },
      text: selectedTextPopup.text,
      createdAt: Date.now()
    });

    // Also highlight the text in soft color
    onAddAnnotation({
      id: 'hl-note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'highlight',
      color: activeColor,
      text: selectedTextPopup.text,
      rects: selectedTextPopup.rects,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
    setShowNoteInput(false);
    setNoteComment('');
  };

  const handleSearchSelection = () => {
    if (!selectedTextPopup || !onSearchQuery) return;
    onSearchQuery(selectedTextPopup.text);
    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
  };

  // Render pages according to ViewMode
  const renderPagesContent = () => {
    if (totalPages <= 0) return null;

    if (settings.viewMode === 'single') {
      return (
        <div className="py-2.5 px-2 flex justify-center items-center min-h-full">
          <PageCanvas
            key={`${documentId || 'doc'}-single-page-${currentPage}`}
            pageNumber={currentPage}
            scale={settings.zoom}
            rotation={settings.rotation}
            theme={settings.theme}
            renderQuality={settings.renderQuality}
            lowPowerMode={settings.lowPowerMode}
            resourceBoundaryEnabled={settings.resourceBoundaryEnabled}
            activeTool={activeTool}
            activeColor={activeColor}
            annotations={annotations}
            onAddAnnotation={onAddAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
          />
        </div>
      );
    }

    if (settings.viewMode === 'two-page') {
      const leftPage = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
      const rightPage = leftPage + 1;

      return (
        <div className="py-2.5 px-2 flex justify-center items-center gap-2 sm:gap-3 min-h-full">
          <PageCanvas
            key={`${documentId || 'doc'}-two-page-left-${leftPage}`}
            pageNumber={leftPage}
            scale={settings.zoom}
            rotation={settings.rotation}
            theme={settings.theme}
            renderQuality={settings.renderQuality}
            lowPowerMode={settings.lowPowerMode}
            resourceBoundaryEnabled={settings.resourceBoundaryEnabled}
            activeTool={activeTool}
            activeColor={activeColor}
            annotations={annotations}
            onAddAnnotation={onAddAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
          />
          {rightPage <= totalPages && (
            <PageCanvas
              key={`${documentId || 'doc'}-two-page-right-${rightPage}`}
              pageNumber={rightPage}
              scale={settings.zoom}
              rotation={settings.rotation}
              theme={settings.theme}
              renderQuality={settings.renderQuality}
              lowPowerMode={settings.lowPowerMode}
              resourceBoundaryEnabled={settings.resourceBoundaryEnabled}
              activeTool={activeTool}
              activeColor={activeColor}
              annotations={annotations}
              onAddAnnotation={onAddAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
            />
          )}
        </div>
      );
    }

    // Default: Continuous scrolling mode with memory-efficient windowed virtualization
    const isRotated90 = settings.rotation % 180 !== 0;
    const baseWidth = isRotated90 ? estimatedDim.height : estimatedDim.width;
    const baseHeight = isRotated90 ? estimatedDim.width : estimatedDim.height;
    const displayWidth = baseWidth * settings.zoom;
    const displayHeight = baseHeight * settings.zoom;

    // Buffer window around current page (governed dynamically by resource governor to eliminate PC lag)
    const windowBuffer = resourceGovernor.getWindowBuffer(
      totalPages,
      settings.lowPowerMode,
      settings.resourceBoundaryEnabled
    );
    const renderStart = Math.max(1, currentPage - windowBuffer);
    const renderEnd = Math.min(totalPages, currentPage + windowBuffer);

    return (
      <div className="py-3 space-y-3 flex flex-col items-center">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const isWithinWindow = pageNum >= renderStart && pageNum <= renderEnd;
          if (isWithinWindow || totalPages <= 4) {
            return (
              <PageCanvas
                key={`${documentId || 'doc'}-page-${pageNum}`}
                pageNumber={pageNum}
                scale={settings.zoom}
                rotation={settings.rotation}
                theme={settings.theme}
                renderQuality={settings.renderQuality}
                lowPowerMode={settings.lowPowerMode}
                resourceBoundaryEnabled={settings.resourceBoundaryEnabled}
                activeTool={activeTool}
                activeColor={activeColor}
                annotations={annotations}
                onAddAnnotation={onAddAnnotation}
                onDeleteAnnotation={onDeleteAnnotation}
                onVisibleChange={handleVisibleChange}
              />
            );
          }
          return (
            <PagePlaceholder
              key={`${documentId || 'doc'}-placeholder-${pageNum}`}
              pageNumber={pageNum}
              width={displayWidth}
              height={displayHeight}
              rotation={settings.rotation}
              scale={settings.zoom}
              onVisibleChange={handleVisibleChange}
            />
          );
        })}
      </div>
    );
  };

  return (
    <main
      ref={containerRef}
      id="pdf-viewport"
      onMouseUp={checkAndHandleSelection}
      className={`flex-1 h-full overflow-y-auto overflow-x-auto relative transition-colors ${
        settings.theme === 'sepia'
          ? 'bg-[#F2E8D5]'
          : settings.theme === 'warm-paper'
          ? 'bg-[#EAE6DF]'
          : settings.theme === 'dark-accent'
          ? 'bg-[#1C1C1E]'
          : 'bg-[#F4F4F6]'
      }`}
    >
      {renderPagesContent()}

      {/* Floating Minimalist Reader Navigation HUD for Large Documents */}
      {totalPages > 1 && (
        <div
          id="reader-floating-nav-hud"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900/85 backdrop-blur-md text-white shadow-xl border border-white/15 text-xs select-none transition-all duration-200 hover:opacity-100 opacity-80"
        >
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            title="Previous Page"
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] font-medium px-1 tracking-tight">
            {currentPage} <span className="opacity-45">/</span> {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            title="Next Page"
            className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sleek Floating Custom Context Menu for Selected Text */}
      {selectedTextPopup && (
        <div
          id="selected-text-context-popup"
          className={`fixed z-50 p-1.5 rounded-2xl bg-white/95 backdrop-blur-2xl shadow-2xl border border-black/10 flex flex-col gap-2 -translate-x-1/2 ${
            selectedTextPopup.placement === 'below' ? 'mt-2' : '-translate-y-full mb-2'
          } animate-in fade-in zoom-in-95 duration-150 select-none max-w-sm`}
          style={{ left: `${selectedTextPopup.x}px`, top: `${selectedTextPopup.y}px` }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!showNoteInput && !showEditInput ? (
            <div className="flex items-center gap-1.5">
              {/* Highlight Palette Buttons */}
              <div className="flex items-center gap-1 px-1 border-r border-stone-200">
                <Highlighter className="w-3.5 h-3.5 text-stone-500 mr-0.5" />
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => applyTextHighlight(c.value)}
                    title={`Highlight in ${c.name}`}
                    className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Underline Action */}
              <button
                onClick={() => applyTextUnderline(activeColor)}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Underline Text"
              >
                <UnderlineIcon className="w-3.5 h-3.5 text-stone-700" />
              </button>

              {/* Strike-Through Action */}
              <button
                onClick={() => applyTextStrike(activeColor)}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Strikethrough Text"
              >
                <Strikethrough className="w-3.5 h-3.5 text-stone-700" />
              </button>

              {/* Edit / Replace Text Action */}
              <button
                onClick={() => {
                  setEditText(selectedTextPopup.text);
                  setShowEditInput(true);
                }}
                className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Edit / Replace Text"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              </button>

              {/* Add Note Action */}
              <button
                onClick={() => setShowNoteInput(true)}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Add Note to Text"
              >
                <MessageSquare className="w-3.5 h-3.5 text-stone-700" />
              </button>

              {/* Copy Text Action */}
              <button
                onClick={handleCopyText}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Copy to Clipboard"
              >
                {copiedFeedback ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-stone-700" />
                )}
              </button>

              {/* Search Text Action */}
              {onSearchQuery && (
                <button
                  onClick={handleSearchSelection}
                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Search in Document"
                >
                  <Search className="w-3.5 h-3.5 text-stone-700" />
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={() => {
                  window.getSelection()?.removeAllRanges();
                  setSelectedTextPopup(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors ml-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : showEditInput ? (
            /* Edit / Replace Text input inside floating menu */
            <div className="w-72 p-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
                <span className="flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  Edit / Replace Text
                </span>
                <button
                  onClick={() => setShowEditInput(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-1.5 bg-stone-100 rounded-lg text-[11px] text-stone-500 line-through truncate max-h-12 font-mono">
                {selectedTextPopup.text}
              </div>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTextEdit();
                  }
                }}
                placeholder="New replacement text..."
                className="w-full p-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50 text-stone-800"
                autoFocus
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  onClick={() => setShowEditInput(false)}
                  className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveTextEdit}
                  disabled={!editText.trim()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-40"
                >
                  Save Replacement
                </button>
              </div>
            </div>
          ) : (
            /* Note comment input inside floating menu */
            <div className="w-64 p-1.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
                <span className="truncate max-w-[180px]">Note on &quot;{selectedTextPopup.text}&quot;</span>
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <textarea
                value={noteComment}
                onChange={(e) => setNoteComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleSaveTextNote();
                  }
                }}
                placeholder="Type your comment..."
                rows={2}
                className="w-full p-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none bg-stone-50 text-stone-800"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveTextNote}
                  disabled={!noteComment.trim()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
                >
                  Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
