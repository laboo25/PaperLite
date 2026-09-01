import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PageCanvas } from './PageCanvas';
import { AnnotationTool, PDFAnnotation, ReaderSettings } from '../types';
import { HIGHLIGHT_COLORS } from './AnnotationToolbar';
import {
  Highlighter,
  Underline as UnderlineIcon,
  MessageSquare,
  Copy,
  Search,
  Check,
  X
} from 'lucide-react';

interface PDFViewerProps {
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
  } | null>(null);

  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteComment, setNoteComment] = useState('');

  // Track visible pages to sync active currentPage in continuous mode
  const visiblePagesMap = useRef<Map<number, boolean>>(new Map());

  const handleVisibleChange = useCallback(
    (pageNumber: number, isVisible: boolean) => {
      visiblePagesMap.current.set(pageNumber, isVisible);
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

  // Smooth scroll to page when currentPage changes in continuous mode
  useEffect(() => {
    if (settings.viewMode === 'continuous') {
      const el = document.getElementById(`page-container-${currentPage}`);
      if (el && containerRef.current) {
        const container = containerRef.current;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Only scroll if outside viewing bounds
        if (rect.top < containerRect.top || rect.bottom > containerRect.bottom + 200) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [currentPage, settings.viewMode]);

  // Handle native text selection and show custom context menu
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!showNoteInput) {
        setSelectedTextPopup(null);
      }
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length === 0) {
      if (!showNoteInput) {
        setSelectedTextPopup(null);
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    if (clientRects.length === 0) return;

    // Determine page container from anchor or range commonAncestor
    let targetEl: HTMLElement | null =
      (selection.anchorNode as HTMLElement) || (range.commonAncestorContainer as HTMLElement);
    if (targetEl && targetEl.nodeType === Node.TEXT_NODE) {
      targetEl = targetEl.parentElement;
    }
    while (targetEl && !targetEl.getAttribute?.('data-page-number')) {
      targetEl = targetEl.parentElement;
    }

    const pageNum = targetEl
      ? parseInt(targetEl.getAttribute('data-page-number') || '1', 10)
      : currentPage;

    const pageContainer = targetEl || document.getElementById(`page-container-${pageNum}`);
    const pageRect = pageContainer ? pageContainer.getBoundingClientRect() : null;

    // Convert client rects to unscaled page coordinates
    const scale = settings.zoom || 1.0;
    const unscaledRects: { x: number; y: number; width: number; height: number }[] = [];

    if (pageRect) {
      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i];
        if (cr.width <= 0 || cr.height <= 0) continue;
        unscaledRects.push({
          x: (cr.left - pageRect.left) / scale,
          y: (cr.top - pageRect.top) / scale,
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

    // Anchor popup centered above the selection
    const firstRect = clientRects[0];
    const lastRect = clientRects[clientRects.length - 1];
    const popupX = Math.max(120, Math.min(window.innerWidth - 140, (firstRect.left + lastRect.right) / 2));
    const popupY = Math.max(70, firstRect.top - 12);

    setSelectedTextPopup({
      text,
      x: popupX,
      y: popupY,
      pageNumber: pageNum,
      rects: unscaledRects
    });
    setShowNoteInput(false);
    setNoteComment('');
  };

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
        <div className="py-8 px-4 flex justify-center items-center min-h-full">
          <PageCanvas
            key={`single-page-${currentPage}`}
            pageNumber={currentPage}
            scale={settings.zoom}
            rotation={settings.rotation}
            theme={settings.theme}
            renderQuality={settings.renderQuality}
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
        <div className="py-8 px-4 flex justify-center items-center gap-2 sm:gap-4 min-h-full">
          <PageCanvas
            key={`two-page-left-${leftPage}`}
            pageNumber={leftPage}
            scale={settings.zoom}
            rotation={settings.rotation}
            theme={settings.theme}
            renderQuality={settings.renderQuality}
            activeTool={activeTool}
            activeColor={activeColor}
            annotations={annotations}
            onAddAnnotation={onAddAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
          />
          {rightPage <= totalPages && (
            <PageCanvas
              key={`two-page-right-${rightPage}`}
              pageNumber={rightPage}
              scale={settings.zoom}
              rotation={settings.rotation}
              theme={settings.theme}
              renderQuality={settings.renderQuality}
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

    // Default: Continuous scrolling mode
    return (
      <div className="py-8 space-y-6 flex flex-col items-center">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
          <PageCanvas
            key={pageNum}
            pageNumber={pageNum}
            scale={settings.zoom}
            rotation={settings.rotation}
            theme={settings.theme}
            renderQuality={settings.renderQuality}
            activeTool={activeTool}
            activeColor={activeColor}
            annotations={annotations}
            onAddAnnotation={onAddAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onVisibleChange={handleVisibleChange}
          />
        ))}
      </div>
    );
  };

  return (
    <main
      ref={containerRef}
      id="pdf-viewport"
      onMouseUp={handleMouseUp}
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

      {/* Sleek Floating Custom Context Menu for Selected Text */}
      {selectedTextPopup && (
        <div
          className="fixed z-50 p-1.5 rounded-2xl bg-white/95 backdrop-blur-2xl shadow-2xl border border-black/10 flex flex-col gap-2 -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-150 select-none max-w-sm"
          style={{ left: `${selectedTextPopup.x}px`, top: `${selectedTextPopup.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {!showNoteInput ? (
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
