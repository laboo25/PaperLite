import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Plus,
  X,
  Minus,
  Square,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { PDFTabItem } from '../types';
import { PDFDocIcon } from './PDFDocIcon';
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized
} from '../services/tauriWindow';

interface TitleBarProps {
  tabs: PDFTabItem[];
  activeTabId: string | null;
  isHomeActive: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onToggleHome: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  tabs,
  activeTabId,
  isHomeActive,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleHome
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isWindowMaximized().then(setIsMaximized);

    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized);
      checkScroll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkScroll = () => {
    if (tabsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkScroll();
  }, [tabs, activeTabId]);

  // Scroll active tab into view smoothly
  useEffect(() => {
    if (activeTabId && tabsScrollRef.current) {
      const activeEl = tabsScrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const delta = direction === 'left' ? -180 : 180;
      tabsScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await closeWindow();
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await minimizeWindow();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const state = await toggleMaximizeWindow();
    setIsMaximized(state);
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    const state = await toggleMaximizeWindow();
    setIsMaximized(state);
  };

  return (
    <header
      id="app-titlebar"
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="h-11 w-full flex items-center justify-between px-2 py-1 select-none z-30 border-b border-black/[0.08] bg-stone-100/95 backdrop-blur-xl transition-colors cursor-default relative"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left Section: Home Page Button */}
      <div
        className="flex items-center gap-1.5 shrink-0 mr-1.5"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          id="btn-home-tab"
          onClick={onToggleHome}
          title="Home & Document Workspace (Cmd+H)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isHomeActive
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-stone-700 hover:bg-stone-200/80 active:bg-stone-300/80'
          }`}
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Home</span>
        </button>

        <div className="h-4 w-px bg-stone-300/80 mx-0.5" />
      </div>

      {/* Middle Section: Fully Responsive Tabs Strip with Scroll Controls */}
      <div
        className="flex-1 flex items-center min-w-0 relative overflow-hidden py-1"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Left Scroll Chevron */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-7 bg-stone-100/90 hover:bg-white shadow-xs rounded-r-lg flex items-center justify-center text-stone-600 hover:text-stone-900 border-r border-stone-300/60 transition-colors cursor-pointer"
            title="Scroll tabs left"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {/* Scrollable Tabs Track */}
        <div
          ref={tabsScrollRef}
          onScroll={checkScroll}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1.5 py-0.5"
        >
          {tabs.map((tab) => {
            const isActive =
              !isHomeActive &&
              Boolean(activeTabId) &&
              Boolean(tab.id) &&
              tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => onSelectTab(tab.id)}
                title={`${tab.doc.name} (Page ${tab.currentPage} of ${tab.totalPages})`}
                className={`group relative flex items-center gap-2 h-7.5 min-w-[70px] sm:min-w-[95px] md:min-w-[130px] max-w-[200px] flex-1 sm:flex-initial px-2.5 rounded-xl text-xs transition-all cursor-pointer select-none border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500/30 z-10'
                    : 'bg-stone-200/50 text-stone-600 border-stone-300/30 hover:bg-stone-200/85 hover:text-stone-800 hover:border-stone-300/60'
                }`}
              >
                {/* Document Icon (Multi-resolution bundle icon) */}
                <PDFDocIcon size={15} className="shrink-0" />

                {/* Tab Title */}
                <span
                  className={`truncate flex-1 text-[11px] leading-tight ${
                    isActive ? 'font-semibold text-white' : 'font-medium text-stone-600'
                  }`}
                >
                  {tab.doc.name}
                </span>

                {/* Unsaved Edits Indicator Dot */}
                {tab.isDirty && (
                  <span
                    title="Unsaved changes (Ctrl+S)"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
                      isActive ? 'bg-amber-300' : 'bg-amber-500'
                    }`}
                  />
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onCloseTab(tab.id, e);
                  }}
                  title="Close Tab"
                  aria-label="Close Tab"
                  className={`w-4 h-4 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white/80 hover:text-white hover:bg-blue-700/80 active:bg-blue-800'
                      : 'text-stone-400 opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-stone-300/60'
                  }`}
                >
                  <X className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            );
          })}

          {/* New Tab (+) Button */}
          <button
            id="btn-new-tab"
            onClick={onNewTab}
            title="Open New PDF in New Tab (Cmd+T / Cmd+O)"
            aria-label="New Tab"
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-stone-200/40 hover:bg-white hover:shadow-2xs text-stone-600 hover:text-stone-900 border border-stone-300/40 hover:border-stone-300 active:bg-stone-300 transition-all shrink-0 cursor-pointer ml-0.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Right Scroll Chevron */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-5 h-7 bg-stone-100/90 hover:bg-white shadow-xs rounded-l-lg flex items-center justify-center text-stone-600 hover:text-stone-900 border-l border-stone-300/60 transition-colors cursor-pointer"
            title="Scroll tabs right"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Right Section: Window Controller Buttons */}
      <div
        className="flex items-center gap-0.5 shrink-0 pl-1.5 border-l border-stone-300/80"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          id="window-control-minimize"
          onClick={handleMinimize}
          title="Minimize Window"
          aria-label="Minimize Window"
          className="w-6.5 h-6.5 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 active:bg-stone-300 rounded-md transition-colors cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          id="window-control-maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore Window' : 'Maximize Window'}
          aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
          className="w-6.5 h-6.5 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 active:bg-stone-300 rounded-md transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-2.5 h-2.5 stroke-[2]" />
          ) : (
            <Square className="w-2.5 h-2.5 stroke-[2]" />
          )}
        </button>

        <button
          id="window-control-close"
          onClick={handleClose}
          title="Close Application"
          aria-label="Close Application"
          className="w-6.5 h-6.5 flex items-center justify-center text-stone-600 hover:text-white hover:bg-rose-500 active:bg-rose-600 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-3 h-3 stroke-[2.2]" />
        </button>
      </div>
    </header>
  );
};
