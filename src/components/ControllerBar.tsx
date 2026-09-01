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
  Maximize2,
  Minimize2,
  RotateCw,
  Columns,
  Square,
  ScrollText,
  Bookmark,
  Sun,
  Moon,
  Coffee,
  FileText
} from 'lucide-react';
import { AnnotationTool, HighlightColor, ReaderSettings, ReaderTheme, ViewMode } from '../types';
import { HIGHLIGHT_COLORS } from './AnnotationToolbar';

interface ControllerBarProps {
  currentPage: number;
  totalPages: number;
  settings: ReaderSettings;
  activeTool: AnnotationTool;
  activeColor: string;
  isBookmarked: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotate: () => void;
  onToggleBookmark: () => void;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
}

export const ControllerBar: React.FC<ControllerBarProps> = ({
  currentPage,
  totalPages,
  settings,
  activeTool,
  activeColor,
  isBookmarked,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onRotate,
  onToggleBookmark,
  onUpdateSettings,
  onToolChange,
  onColorChange
}) => {
  const isTwoPage = settings.viewMode === 'two-page';
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

  const viewModes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'continuous', label: 'Continuous Vertical Scroll', icon: <ScrollText className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'single', label: 'Single Page Focus', icon: <Square className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'two-page', label: 'Two-Page Book Spread', icon: <Columns className="w-3.5 h-3.5 shrink-0" /> }
  ];

  const themes: { id: ReaderTheme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" /> },
    { id: 'sepia', label: 'Sepia', icon: <Coffee className="w-3.5 h-3.5 text-amber-800 shrink-0" /> },
    { id: 'warm-paper', label: 'Paper', icon: <FileText className="w-3.5 h-3.5 text-stone-700 shrink-0" /> },
    { id: 'dark-accent', label: 'Dark', icon: <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> }
  ];

  return (
    <div
      id="app-controller-bar"
      className="w-full bg-white/90 backdrop-blur-md border-b border-black/[0.06] px-3 py-1.5 flex items-center justify-between gap-2 select-none z-20 overflow-x-auto shadow-2xs"
    >
      {/* Group 1: Page Navigation */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg">
          <button
            onClick={handlePrevPage}
            disabled={isPrevDisabled}
            title={isTwoPage ? 'Previous 2 Pages (Left Arrow)' : 'Previous Page (Left Arrow)'}
            className="p-1 rounded-md text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
                isTwoPage ? 'w-12' : 'w-8'
              } text-center font-mono font-semibold bg-transparent text-stone-800 focus:outline-none focus:bg-white rounded py-0.5`}
            />
            <span className="text-stone-400 font-mono text-[11px] px-1">/ {totalPages || 1}</span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={isNextDisabled}
            title={isTwoPage ? 'Next 2 Pages (Right Arrow)' : 'Next Page (Right Arrow)'}
            className="p-1 rounded-md text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bookmark Quick Toggle */}
        <button
          onClick={onToggleBookmark}
          title={isBookmarked ? 'Remove Bookmark (Cmd+D)' : 'Bookmark Page (Cmd+D)'}
          className={`p-1.5 rounded-lg border transition-all ${
            isBookmarked
              ? 'text-amber-500 bg-amber-50 border-amber-300'
              : 'text-stone-600 border-stone-200/70 hover:bg-stone-100'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500' : ''}`} />
        </button>
      </div>

      {/* Group 2: Zoom & Fit Options */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg">
          <button
            onClick={() => onZoomChange(Math.max(0.4, settings.zoom - 0.15))}
            title="Zoom Out (Cmd+-)"
            className="p-1 rounded-md text-stone-600 hover:text-stone-900 hover:bg-white transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 text-[11px] font-mono font-medium text-stone-700 select-none">
            {Math.round(settings.zoom * 100)}%
          </span>

          <button
            onClick={() => onZoomChange(Math.min(3.0, settings.zoom + 0.15))}
            title="Zoom In (Cmd++)"
            className="p-1 rounded-md text-stone-600 hover:text-stone-900 hover:bg-white transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fit Page & Fit Width Buttons */}
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg text-xs">
          <button
            onClick={onFitPage}
            title="Fit Entire Page to Window (Cmd+9)"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
              settings.fitMode === 'fit-page'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Page</span>
          </button>

          <button
            onClick={onFitWidth}
            title="Fit Page Width (Cmd+0)"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
              settings.fitMode === 'fit-width'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="hidden sm:inline">Fit Width</span>
            <span className="sm:hidden">Width</span>
          </button>
        </div>

        {/* Rotate Button */}
        <button
          onClick={onRotate}
          title="Rotate Page 90°"
          className="p-1.5 rounded-lg border border-stone-200/70 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Group 3: Markup & Annotation Tools */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg">
          <button
            onClick={() => onToolChange('select')}
            title="Select & Scroll Mode"
            className={`p-1.5 rounded-md transition-all ${
              activeTool === 'select'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('highlight')}
            title="Text Highlighter"
            className={`p-1.5 rounded-md transition-all ${
              activeTool === 'highlight'
                ? 'bg-white text-amber-500 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('pen')}
            title="Pen & Drawing Markup"
            className={`p-1.5 rounded-md transition-all ${
              activeTool === 'pen'
                ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onToolChange('note')}
            title="Sticky Note Pin"
            className={`p-1.5 rounded-md transition-all ${
              activeTool === 'note'
                ? 'bg-white text-indigo-500 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color Palette (Active when tool != select) */}
        {activeTool !== 'select' && (
          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200/70 p-1 rounded-lg animate-in fade-in zoom-in-95">
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
      </div>

      {/* Group 4: Layout Mode & Themes */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Layout Modes */}
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onUpdateSettings({ viewMode: mode.id })}
              title={mode.label}
              className={`p-1 rounded-md transition-all ${
                settings.viewMode === mode.id
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {mode.icon}
            </button>
          ))}
        </div>

        {/* Reader Themes */}
        <div className="flex items-center bg-stone-100 border border-stone-200/70 p-0.5 rounded-lg">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => onUpdateSettings({ theme: t.id })}
              title={`Theme: ${t.label}`}
              className={`p-1 rounded-md transition-all ${
                settings.theme === t.id
                  ? 'bg-white shadow-2xs scale-105'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
