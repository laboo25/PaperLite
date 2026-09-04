import React, { useState, useEffect } from 'react';
import {
  MousePointer,
  Highlighter,
  PenTool,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Scan,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  Save
} from 'lucide-react';
import { AnnotationTool, HighlightColor, ViewMode } from '../types';

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { name: 'Sun Yellow', value: '#FDE047', border: '#EAB308', bgRgba: 'rgba(253, 224, 71, 0.4)' },
  { name: 'Mint Green', value: '#86EFAC', border: '#22C55E', bgRgba: 'rgba(134, 239, 172, 0.4)' },
  { name: 'Sky Blue', value: '#93C5FD', border: '#3B82F6', bgRgba: 'rgba(147, 197, 253, 0.4)' },
  { name: 'Rose Pink', value: '#F472B6', border: '#EC4899', bgRgba: 'rgba(244, 114, 182, 0.4)' },
  { name: 'Tangerine', value: '#FDBA74', border: '#F97316', bgRgba: 'rgba(253, 186, 116, 0.4)' }
];

interface AnnotationToolbarProps {
  currentPage: number;
  totalPages: number;
  viewMode: ViewMode;
  zoom: number;
  isVisible: boolean;
  activeTool: AnnotationTool;
  activeColor: string;
  isDirty?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onToggleVisibility: () => void;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  currentPage,
  totalPages,
  viewMode,
  zoom,
  isVisible,
  activeTool,
  activeColor,
  isDirty = false,
  canUndo = false,
  canRedo = false,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onToggleVisibility,
  onToolChange,
  onColorChange,
  onSave,
  onUndo,
  onRedo
}) => {
  const isTwoPage = viewMode === 'two-page';
  const currentLeft = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  const currentRight = currentLeft + 1;

  const [pageInput, setPageInput] = useState(
    isTwoPage
      ? currentRight <= totalPages
        ? `${currentLeft}-${currentRight}`
        : `${currentLeft}`
      : currentPage.toString()
  );

  useEffect(() => {
    if (isTwoPage) {
      const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
      const right = left + 1;
      setPageInput(right <= totalPages ? `${left}-${right}` : `${left}`);
    } else {
      setPageInput(currentPage.toString());
    }
  }, [currentPage, totalPages, isTwoPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = pageInput.split('-')[0].trim();
    const p = parseInt(cleanInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
    } else {
      if (isTwoPage) {
        const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
        const right = left + 1;
        setPageInput(right <= totalPages ? `${left}-${right}` : `${left}`);
      } else {
        setPageInput(currentPage.toString());
      }
    }
  };

  const isPrevDisabled = isTwoPage ? currentLeft <= 1 : currentPage <= 1;
  const isNextDisabled = isTwoPage
    ? currentRight >= totalPages || currentLeft >= totalPages
    : currentPage >= totalPages;

  const handlePrevPage = () => {
    if (isTwoPage) {
      onPageChange(Math.max(1, currentLeft - 2));
    } else {
      onPageChange(Math.max(1, currentPage - 1));
    }
  };

  const handleNextPage = () => {
    if (isTwoPage) {
      onPageChange(Math.min(totalPages, currentLeft + 2));
    } else {
      onPageChange(Math.min(totalPages, currentPage + 1));
    }
  };

  if (!isVisible) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-auto"
      >
        <button
          id="btn-restore-toolbar"
          onClick={onToggleVisibility}
          title="Show Quick Floating HUD"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 text-stone-700 backdrop-blur-xl border border-black/10 shadow-xl hover:scale-105 transition-all text-xs font-medium"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-mono text-[11px]">
            {isTwoPage && currentRight <= totalPages
              ? `Pages ${currentLeft}-${currentRight} of ${totalPages}`
              : `Page ${currentPage} of ${totalPages}`}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-30 select-none max-w-[calc(100vw-24px)] pointer-events-auto"
    >
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-2xl overflow-x-auto no-scrollbar">
        {/* Navigation */}
        <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl shrink-0">
          <button
            onClick={handlePrevPage}
            disabled={isPrevDisabled}
            title={isTwoPage ? 'Previous 2 Pages (Left Arrow)' : 'Previous Page (Left Arrow)'}
            className="p-1 rounded-lg text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center px-1 text-xs">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              className={`${
                isTwoPage ? 'w-11 sm:w-12' : 'w-7 sm:w-8'
              } text-center font-mono font-semibold bg-transparent text-stone-800 focus:outline-none focus:bg-white rounded py-0.5`}
            />
            <span className="text-stone-400 font-mono text-[11px] px-0.5 sm:px-1">/ {totalPages || 1}</span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={isNextDisabled}
            title={isTwoPage ? 'Next 2 Pages (Right Arrow)' : 'Next Page (Right Arrow)'}
            className="p-1 rounded-lg text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

        {/* Zoom */}
        <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl shrink-0">
          <button
            onClick={() => onZoomChange(Math.max(0.4, zoom - 0.15))}
            title="Zoom Out (Cmd+-)"
            className="p-1 rounded-lg text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onFitPage}
            title="Fit Page in Screen (Cmd+9)"
            className="px-1.5 sm:px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:text-blue-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Scan className="w-3 h-3 text-stone-500" />
            <span className="hidden sm:inline">Fit</span>
          </button>

          <button
            onClick={onFitWidth}
            title="Fit Width (Cmd+0)"
            className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-stone-700 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={() => onZoomChange(Math.min(3.0, zoom + 0.15))}
            title="Zoom In (Cmd++)"
            className="p-1 rounded-lg text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0 hidden xs:block" />

        {/* Tools */}
        <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl shrink-0">
          <button
            onClick={() => onToolChange('select')}
            title="Select & Scroll"
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'select'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('highlight')}
            title="Highlighter"
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'highlight'
                ? 'bg-white text-amber-500 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('pen')}
            title="Pen Markup"
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'pen'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('note')}
            title="Sticky Note"
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'note'
                ? 'bg-white text-indigo-500 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Colors */}
        {activeTool !== 'select' && (
          <div className="flex items-center gap-1 pl-0.5 shrink-0">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => onColorChange(c.value)}
                title={c.name}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  activeColor === c.value
                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-125'
                    : 'hover:scale-110 opacity-80'
                }`}
                style={{ backgroundColor: c.value, borderColor: c.border, borderWidth: 1 }}
              />
            ))}
          </div>
        )}

        <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

        {/* Undo / Redo / Save Quick Actions */}
        <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl shrink-0 gap-0.5">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo Annotation (Ctrl+Z)"
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo Annotation (Ctrl+Y)"
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onSave && (
            <button
              onClick={onSave}
              title={isDirty ? 'Save Changes (Ctrl+S) - Unsaved Edits' : 'Save Document (Ctrl+S)'}
              className={`p-1.5 rounded-lg transition-all ${
                isDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

        {/* Minimize Button */}
        <button
          onClick={onToggleVisibility}
          title="Minimize toolbar"
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100/80 transition-colors shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
