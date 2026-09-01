import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PageCanvas } from './PageCanvas';
import { AnnotationTool, PDFAnnotation, ReaderSettings } from '../types';

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
  onDeleteAnnotation
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTextPopup, setSelectedTextPopup] = useState<{
    text: string;
    x: number;
    y: number;
    pageNumber: number;
  } | null>(null);

  // Track visible pages to sync active currentPage in continuous mode
  const visiblePagesMap = useRef<Map<number, boolean>>(new Map());

  const handleVisibleChange = useCallback(
    (pageNumber: number, isVisible: boolean) => {
      visiblePagesMap.current.set(pageNumber, isVisible);
      if (isVisible && settings.viewMode === 'continuous') {
        // Find smallest visible page number
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

  // Handle native text selection for quick highlight
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedTextPopup(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectedTextPopup(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Determine page from anchor node
    let targetEl: HTMLElement | null = selection.anchorNode as HTMLElement;
    while (targetEl && !targetEl.getAttribute?.('data-page-number')) {
      targetEl = targetEl.parentElement;
    }

    const pageNum = targetEl
      ? parseInt(targetEl.getAttribute('data-page-number') || '1', 10)
      : currentPage;

    setSelectedTextPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      pageNumber: pageNum
    });
  };

  const applyTextHighlight = (color: string) => {
    if (!selectedTextPopup) return;

    onAddAnnotation({
      id: 'hl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      pageNumber: selectedTextPopup.pageNumber,
      type: 'highlight',
      color,
      text: selectedTextPopup.text,
      createdAt: Date.now()
    });

    window.getSelection()?.removeAllRanges();
    setSelectedTextPopup(null);
  };

  // Render pages according to ViewMode
  const renderPagesContent = () => {
    if (totalPages <= 0) return null;

    if (settings.viewMode === 'single') {
      return (
        <div className="py-6 px-4 flex justify-center items-center min-h-full">
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
        <div className="py-6 px-4 flex justify-center items-center gap-1.5 sm:gap-2 min-h-full">
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

      {/* Floating Selection Quick Highlighter Menu */}
      {selectedTextPopup && (
        <div
          className="fixed z-40 p-1 rounded-xl bg-white shadow-2xl border border-stone-200 flex items-center gap-1.5 -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: `${selectedTextPopup.x}px`, top: `${selectedTextPopup.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-stone-500 uppercase px-1.5">
            Highlight:
          </span>
          {['#FDE047', '#86EFAC', '#93C5FD', '#F472B6', '#FDBA74'].map((color) => (
            <button
              key={color}
              onClick={() => applyTextHighlight(color)}
              className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </main>
  );
};
