import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Plus,
  X,
  Minus,
  Square,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowLeftToLine,
  ArrowRightToLine,
  FileMinus
} from 'lucide-react';
import { PDFTabItem } from '../types';
import { PDFDocIcon } from './PDFDocIcon';
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  startDraggingWindow
} from '../services/tauriWindow';

interface TitleBarProps {
  tabs: PDFTabItem[];
  activeTabId: string | null;
  isHomeActive: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onToggleHome: () => void;
  onMoveTab?: (fromIndex: number, toIndex: number) => void;
  onMoveTabRelative?: (tabId: string, direction: 'left' | 'right' | 'start' | 'end') => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseTabsToLeft?: (tabId: string) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseWindow?: () => void;
}

interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string;
  tabIndex: number;
  tabName: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  tabs,
  activeTabId,
  isHomeActive,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleHome,
  onMoveTab,
  onMoveTabRelative,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseTabsToLeft,
  onDuplicateTab,
  onCloseWindow
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Tab Drag and Drop Reordering State (Browser Tab Behavior)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // Custom Tab Context Menu State
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  useEffect(() => {
    isWindowMaximized().then(setIsMaximized);

    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized);
      checkScroll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global mouse up listener to clear drag cursor state
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Context Menu Dismiss Listeners (Prevent Memory Leaks)
  useEffect(() => {
    if (!contextMenu) return;

    const handleCloseMenu = (e: MouseEvent | KeyboardEvent) => {
      if ('key' in e && e.key !== 'Escape') return;
      setContextMenu(null);
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('keydown', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('keydown', handleCloseMenu);
    };
  }, [contextMenu]);

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

  // Tab Drag and Drop Reordering Handlers (Browser Tab Behavior)
  const handleTabDragStart = (e: React.DragEvent, tabId: string, index: number) => {
    // Only primary left button drag
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    setDraggedTabId(tabId);
    setDraggedIndex(index);
    setContextMenu(null);
  };

  const handleTabDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const pos = e.clientX < midX ? 'before' : 'after';

    if (dragOverIndex !== index || dropPosition !== pos) {
      setDragOverIndex(index);
      setDropPosition(pos);
    }

    // Auto-scroll when near scroll edges
    if (tabsScrollRef.current) {
      const scrollRect = tabsScrollRef.current.getBoundingClientRect();
      if (e.clientX - scrollRect.left < 50) {
        tabsScrollRef.current.scrollLeft -= 10;
      } else if (scrollRect.right - e.clientX < 50) {
        tabsScrollRef.current.scrollLeft += 10;
      }
    }
  };

  const handleTabDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === undefined) {
      handleTabDragEnd();
      return;
    }

    let toIndex = dropIndex;
    if (dropPosition === 'after') {
      toIndex = dropIndex + 1;
    }
    // Shifting adjustment when removing element before insertion
    if (draggedIndex < toIndex) {
      toIndex -= 1;
    }

    toIndex = Math.max(0, Math.min(tabs.length - 1, toIndex));

    if (toIndex !== draggedIndex && onMoveTab) {
      onMoveTab(draggedIndex, toIndex);
    }

    handleTabDragEnd();
  };

  const handleTabDragEnd = () => {
    setDraggedTabId(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTrackDrop = (e: React.DragEvent) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== tabs.length - 1 && onMoveTab) {
      onMoveTab(draggedIndex, tabs.length - 1);
    }
    handleTabDragEnd();
  };

  const handleTabContextMenu = (e: React.MouseEvent, tab: PDFTabItem, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 230;
    const menuHeight = 350;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    setContextMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      tabId: tab.id,
      tabIndex: index,
      tabName: tab.doc.name
    });
  };

  const handleTabAuxClick = (e: React.MouseEvent, tabId: string) => {
    // Middle-click closes tab (standard browser tab shortcut)
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onCloseTab(tabId, e);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onCloseWindow) {
      onCloseWindow();
    } else {
      await closeWindow();
    }
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

  // Windows standard behavior: Double-click control bar to maximize / restore window
  const handleDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[data-no-drag="true"]') ||
      target.closest('[data-popover="true"]')
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const state = await toggleMaximizeWindow();
    setIsMaximized(state);
  };

  // Windows standard behavior: Click and hold control bar to move window position & update cursor
  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only primary left button initiates window move
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Don't drag if user clicked a button, input, or an interactive element
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[data-no-drag="true"]') ||
      target.closest('[data-popover="true"]')
    ) {
      return;
    }

    setIsDragging(true);
    document.body.style.cursor = 'move';

    try {
      await startDraggingWindow();
    } catch {
      // Ignored if non-tauri
    } finally {
      setIsDragging(false);
      document.body.style.cursor = '';
    }
  };

  return (
    <header
      id="app-titlebar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => {
        // Title bar is not a drop area; ignore and reject OS file drops
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'none';
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`h-11 w-full flex items-center justify-between px-2 py-1 select-none z-40 border-b border-black/[0.08] bg-stone-100/95 backdrop-blur-xl transition-colors relative ${
        isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
      }`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left Section: Home Page Button */}
      <div
        className="flex items-center gap-1.5 shrink-0 mr-1.5"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          id="btn-home-tab"
          onClick={onToggleHome}
          aria-label="Home & Document Workspace"
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

      {/* Middle Section: Fully Responsive Draggable Tabs Strip with Dedicated Drag Space */}
      <div
        className={`flex-1 flex items-center min-w-0 relative overflow-hidden py-1 h-full ${
          isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
        }`}
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as any}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Left Scroll Chevron */}
        {canScrollLeft && (
          <button
            data-no-drag="true"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-7 bg-stone-100/90 hover:bg-white shadow-xs rounded-r-lg flex items-center justify-center text-stone-600 hover:text-stone-900 border-r border-stone-300/60 transition-colors cursor-pointer"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {/* Scrollable Tabs Track */}
        <div
          ref={tabsScrollRef}
          onScroll={checkScroll}
          onDragOver={handleTrackDragOver}
          onDrop={handleTrackDrop}
          data-tauri-drag-region
          style={{ WebkitAppRegion: 'drag' } as any}
          className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1.5 py-0.5 max-w-full ${
            isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
          }`}
        >
          {tabs.map((tab, index) => {
            const isActive =
              !isHomeActive &&
              Boolean(activeTabId) &&
              Boolean(tab.id) &&
              tab.id === activeTabId;

            const isBeingDragged = draggedTabId === tab.id;
            const showDropBefore =
              draggedTabId !== null &&
              draggedTabId !== tab.id &&
              dragOverIndex === index &&
              dropPosition === 'before';
            const showDropAfter =
              draggedTabId !== null &&
              draggedTabId !== tab.id &&
              dragOverIndex === index &&
              dropPosition === 'after';

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                data-tab-index={index}
                data-no-drag="true"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: 'no-drag' } as any}
                draggable={true}
                onDragStart={(e) => handleTabDragStart(e, tab.id, index)}
                onDragOver={(e) => handleTabDragOver(e, index)}
                onDrop={(e) => handleTabDrop(e, index)}
                onDragEnd={handleTabDragEnd}
                onContextMenu={(e) => handleTabContextMenu(e, tab, index)}
                onAuxClick={(e) => handleTabAuxClick(e, tab.id)}
                onClick={() => onSelectTab(tab.id)}
                aria-label={tab.doc.name}
                className={`group relative flex items-center gap-1.5 h-7.5 min-w-[70px] sm:min-w-[95px] md:min-w-[130px] max-w-[210px] flex-1 sm:flex-initial px-2 rounded-xl text-xs transition-all cursor-pointer select-none border ${
                  isBeingDragged
                    ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/60 scale-95 shadow-inner ring-1 ring-blue-300'
                    : isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500/30 z-10'
                    : 'bg-stone-200/50 text-stone-600 border-stone-300/30 hover:bg-stone-200/85 hover:text-stone-800 hover:border-stone-300/60'
                }`}
              >
                {/* Visual Drop Insertion Indicators (Browser Tab Behavior) */}
                {showDropBefore && (
                  <div
                    aria-hidden="true"
                    className="absolute -left-1 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full shadow-md z-30 pointer-events-none ring-2 ring-blue-300 animate-pulse"
                  />
                )}
                {showDropAfter && (
                  <div
                    aria-hidden="true"
                    className="absolute -right-1 top-1 bottom-1 w-[3px] bg-blue-500 rounded-full shadow-md z-30 pointer-events-none ring-2 ring-blue-300 animate-pulse"
                  />
                )}

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
                    aria-label="Unsaved changes"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
                      isActive ? 'bg-amber-300' : 'bg-amber-500'
                    }`}
                  />
                )}

                {/* Quick Move Left / Right Controls on Hover (Browser Tab Behavior) */}
                {tabs.length > 1 && onMoveTab && (
                  <div
                    data-no-drag="true"
                    className="hidden group-hover:flex items-center gap-0.5 shrink-0 transition-opacity"
                  >
                    <button
                      type="button"
                      data-no-drag="true"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onMoveTab(index, index - 1);
                      }}
                      aria-label="Move tab left"
                      className={`w-3.5 h-4 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        index === 0
                          ? 'opacity-20 cursor-not-allowed'
                          : isActive
                          ? 'text-white/80 hover:text-white hover:bg-blue-700/80 active:bg-blue-800'
                          : 'text-stone-500 hover:text-stone-900 hover:bg-stone-300/70'
                      }`}
                    >
                      <ChevronLeft className="w-2.5 h-2.5 stroke-[2.5]" />
                    </button>

                    <button
                      type="button"
                      data-no-drag="true"
                      disabled={index === tabs.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onMoveTab(index, index + 1);
                      }}
                      aria-label="Move tab right"
                      className={`w-3.5 h-4 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        index === tabs.length - 1
                          ? 'opacity-20 cursor-not-allowed'
                          : isActive
                          ? 'text-white/80 hover:text-white hover:bg-blue-700/80 active:bg-blue-800'
                          : 'text-stone-500 hover:text-stone-900 hover:bg-stone-300/70'
                      }`}
                    >
                      <ChevronRight className="w-2.5 h-2.5 stroke-[2.5]" />
                    </button>
                  </div>
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onCloseTab(tab.id, e);
                  }}
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
            data-no-drag="true"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={onNewTab}
            aria-label="New Tab"
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-stone-200/40 hover:bg-white hover:shadow-2xs text-stone-600 hover:text-stone-900 border border-stone-300/40 hover:border-stone-300 active:bg-stone-300 transition-all shrink-0 cursor-pointer ml-0.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Dedicated Window Dragging Region / Space (Always available when window is smaller) */}
        <div
          data-tauri-drag-region
          style={{ WebkitAppRegion: 'drag' } as any}
          className={`flex-1 h-full min-w-[28px] flex items-center justify-center ${
            isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
          }`}
        >
          {/* Subtle drag handle indicator when window is small */}
          <div className="w-6 h-1 rounded-full bg-stone-300/40 hover:bg-stone-400/50 transition-colors" />
        </div>

        {/* Right Scroll Chevron */}
        {canScrollRight && (
          <button
            data-no-drag="true"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-5 h-7 bg-stone-100/90 hover:bg-white shadow-xs rounded-l-lg flex items-center justify-center text-stone-600 hover:text-stone-900 border-l border-stone-300/60 transition-colors cursor-pointer"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Right Section: Window Controller Buttons */}
      <div
        className="flex items-center gap-0.5 shrink-0 pl-1.5 border-l border-stone-300/80"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          id="window-control-minimize"
          onClick={handleMinimize}
          aria-label="Minimize Window"
          className="w-6.5 h-6.5 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 active:bg-stone-300 rounded-md transition-colors cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          id="window-control-maximize"
          onClick={handleMaximize}
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
          aria-label="Close Application"
          className="w-6.5 h-6.5 flex items-center justify-center text-stone-600 hover:text-white hover:bg-rose-500 active:bg-rose-600 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-3 h-3 stroke-[2.2]" />
        </button>
      </div>

      {/* CUSTOM TAB CONTEXT MENU (Browser Tab Behavior, iOS / Material 3 Style Popover) */}
      {contextMenu && (
        <>
          {/* Backdrop for dismiss */}
          <div
            className="fixed inset-0 z-40 bg-black/5"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          <div
            id="tab-custom-context-menu"
            data-no-drag="true"
            data-popover="true"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              WebkitAppRegion: 'no-drag'
            } as any}
            className="fixed z-50 w-[240px] bg-white/98 backdrop-blur-xl border border-stone-200/90 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none text-stone-800 ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Header: Tab information */}
            <div className="px-2.5 py-1.5 border-b border-stone-100 flex items-center gap-2 mb-1">
              <PDFDocIcon size={16} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-stone-900 truncate leading-tight">
                  {contextMenu.tabName}
                </p>
                <p className="text-[10px] text-stone-400 font-mono">
                  Tab {contextMenu.tabIndex + 1} of {tabs.length}
                </p>
              </div>
            </div>

            {/* Move Tab Left */}
            <button
              type="button"
              id="context-menu-move-left"
              disabled={contextMenu.tabIndex === 0}
              onClick={() => {
                if (onMoveTab && contextMenu.tabIndex > 0) {
                  onMoveTab(contextMenu.tabIndex, contextMenu.tabIndex - 1);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 hover:bg-blue-50 hover:text-blue-600 disabled:hover:bg-transparent disabled:hover:text-stone-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">Move Tab Left</span>
              <span className="text-[10px] text-stone-400 font-mono">Ctrl+Shift+←</span>
            </button>

            {/* Move Tab Right */}
            <button
              type="button"
              id="context-menu-move-right"
              disabled={contextMenu.tabIndex === tabs.length - 1}
              onClick={() => {
                if (onMoveTab && contextMenu.tabIndex < tabs.length - 1) {
                  onMoveTab(contextMenu.tabIndex, contextMenu.tabIndex + 1);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 hover:bg-blue-50 hover:text-blue-600 disabled:hover:bg-transparent disabled:hover:text-stone-700"
            >
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">Move Tab Right</span>
              <span className="text-[10px] text-stone-400 font-mono">Ctrl+Shift+→</span>
            </button>

            {/* Move to First Position */}
            <button
              type="button"
              id="context-menu-move-first"
              disabled={contextMenu.tabIndex === 0}
              onClick={() => {
                if (onMoveTab && contextMenu.tabIndex > 0) {
                  onMoveTab(contextMenu.tabIndex, 0);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 hover:bg-stone-100 disabled:hover:bg-transparent"
            >
              <ArrowLeftToLine className="w-3.5 h-3.5 shrink-0 text-stone-500" />
              <span className="flex-1">Move to Start</span>
              <span className="text-[10px] text-stone-400 font-mono">Ctrl+Shift+Home</span>
            </button>

            {/* Move to Last Position */}
            <button
              type="button"
              id="context-menu-move-last"
              disabled={contextMenu.tabIndex === tabs.length - 1}
              onClick={() => {
                if (onMoveTab && contextMenu.tabIndex < tabs.length - 1) {
                  onMoveTab(contextMenu.tabIndex, tabs.length - 1);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 hover:bg-stone-100 disabled:hover:bg-transparent"
            >
              <ArrowRightToLine className="w-3.5 h-3.5 shrink-0 text-stone-500" />
              <span className="flex-1">Move to End</span>
              <span className="text-[10px] text-stone-400 font-mono">Ctrl+Shift+End</span>
            </button>

            <div className="my-1 border-t border-stone-100" />

            {/* Duplicate Tab */}
            <button
              type="button"
              id="context-menu-duplicate"
              onClick={() => {
                if (onDuplicateTab) {
                  onDuplicateTab(contextMenu.tabId);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-stone-500" />
              <span>Duplicate Tab</span>
            </button>

            <div className="my-1 border-t border-stone-100" />

            {/* Close Tab */}
            <button
              type="button"
              id="context-menu-close-tab"
              onClick={(e) => {
                onCloseTab(contextMenu.tabId, e);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-stone-700 hover:text-rose-600 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span className="flex-1">Close Tab</span>
              <span className="text-[10px] text-stone-400 font-mono">Ctrl+W</span>
            </button>

            {/* Close Other Tabs */}
            {tabs.length > 1 && (
              <button
                type="button"
                id="context-menu-close-others"
                onClick={() => {
                  if (onCloseOtherTabs) {
                    onCloseOtherTabs(contextMenu.tabId);
                  }
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
              >
                <FileMinus className="w-3.5 h-3.5 text-stone-500" />
                <span>Close Other Tabs</span>
              </button>
            )}

            {/* Close Tabs to the Right */}
            {contextMenu.tabIndex < tabs.length - 1 && (
              <button
                type="button"
                id="context-menu-close-right"
                onClick={() => {
                  if (onCloseTabsToRight) {
                    onCloseTabsToRight(contextMenu.tabId);
                  }
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                <span>Close Tabs to the Right</span>
              </button>
            )}

            {/* Close Tabs to the Left */}
            {contextMenu.tabIndex > 0 && (
              <button
                type="button"
                id="context-menu-close-left"
                onClick={() => {
                  if (onCloseTabsToLeft) {
                    onCloseTabsToLeft(contextMenu.tabId);
                  }
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-stone-400" />
                <span>Close Tabs to the Left</span>
              </button>
            )}

            <div className="my-1 border-t border-stone-100" />

            {/* New Tab */}
            <button
              type="button"
              id="context-menu-new-tab"
              onClick={() => {
                onNewTab();
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-blue-50 text-blue-600 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="flex-1">New Tab</span>
              <span className="text-[10px] text-blue-400 font-mono">Ctrl+T</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
};
