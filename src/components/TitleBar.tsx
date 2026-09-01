import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Library,
  Sidebar as SidebarIcon,
  Search,
  Bookmark,
  FileText,
  Sliders,
  Share2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Minus,
  Square,
  Copy
} from 'lucide-react';
import { PDFDocumentInfo, ReaderSettings } from '../types';
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  startDraggingWindow
} from '../services/tauriWindow';

interface TitleBarProps {
  currentDoc: PDFDocumentInfo | null;
  currentPage: number;
  totalPages: number;
  settings: ReaderSettings;
  isBookmarked: boolean;
  isControllerBarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleControllerBar: () => void;
  onOpenLibrary: () => void;
  onOpenFile: () => void;
  onToggleBookmark: () => void;
  onOpenSearch: () => void;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
  onOpenSettingsModal: () => void;
  onOpenExportModal: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentDoc,
  currentPage,
  totalPages,
  settings,
  isBookmarked,
  isControllerBarOpen,
  onToggleSidebar,
  onToggleControllerBar,
  onOpenLibrary,
  onOpenFile,
  onToggleBookmark,
  onOpenSearch,
  onUpdateSettings,
  onOpenSettingsModal,
  onOpenExportModal
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHoveringDots, setIsHoveringDots] = useState(false);

  const isTwoPage = settings.viewMode === 'two-page';
  const currentLeft = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  const currentRight = currentLeft + 1;

  useEffect(() => {
    // Check initial maximized state
    isWindowMaximized().then(setIsMaximized);

    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await closeWindow();
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await minimizeWindow();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const state = await toggleMaximizeWindow();
    setIsMaximized(state);
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    // Double click titlebar to toggle maximize
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
      className="h-11 w-full flex items-center justify-between px-3 select-none z-30 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl transition-colors cursor-default"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left section: App Window Controller Buttons (Close, Minimize, Maximize) + Sidebar toggle + Library + Open File */}
      <div
        className="flex items-center gap-1.5 sm:gap-2 shrink-0"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* macOS / iOS Style Traffic Light Window Controls */}
        <div
          className="flex items-center gap-2 mr-2 group py-1 px-1 rounded-md"
          onMouseEnter={() => setIsHoveringDots(true)}
          onMouseLeave={() => setIsHoveringDots(false)}
        >
          {/* Close Window (Red) */}
          <button
            id="window-btn-close"
            onClick={handleClose}
            title="Close Application"
            className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E] shadow-2xs hover:brightness-90 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {isHoveringDots && <X className="w-2.5 h-2.5 text-[#4C0000] stroke-[3]" />}
          </button>

          {/* Minimize Window (Yellow) */}
          <button
            id="window-btn-minimize"
            onClick={handleMinimize}
            title="Minimize Application"
            className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123] shadow-2xs hover:brightness-90 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {isHoveringDots && <Minus className="w-2.5 h-2.5 text-[#5C3C00] stroke-[3]" />}
          </button>

          {/* Maximize / Restore Window (Green) */}
          <button
            id="window-btn-maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            className="w-3.5 h-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29] shadow-2xs hover:brightness-90 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {isHoveringDots && (
              isMaximized ? (
                <Minimize2 className="w-2.5 h-2.5 text-[#004D00] stroke-[3]" />
              ) : (
                <Maximize2 className="w-2 h-2 text-[#004D00] stroke-[3]" />
              )
            )}
          </button>
        </div>

        {/* Vertical divider */}
        <div className="h-4 w-px bg-stone-200 mx-0.5" />

        {/* Sidebar Toggle Button */}
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          title="Toggle Navigation Sidebar (Cmd+B)"
          className={`p-1.5 rounded-lg transition-all ${
            settings.showSidebar
              ? 'bg-stone-200 text-stone-900 shadow-2xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <SidebarIcon className="w-4 h-4" />
        </button>

        {/* Library Button */}
        <button
          id="btn-open-library"
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-700 bg-stone-100/90 hover:bg-stone-200/80 border border-stone-200/80 transition-all shadow-2xs"
          title="Browse PDF Library (Cmd+L)"
        >
          <Library className="w-3.5 h-3.5 text-stone-600" />
          <span className="hidden sm:inline">Library</span>
        </button>

        {/* Open File Button */}
        <button
          id="btn-open-file"
          onClick={onOpenFile}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-700 bg-stone-100/90 hover:bg-stone-200/80 border border-stone-200/80 transition-all shadow-2xs"
          title="Open PDF from Computer (Cmd+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-stone-600" />
          <span className="hidden md:inline">Open</span>
        </button>
      </div>

      {/* Center section: Document Title & Reading Position (Draggable area) */}
      <div
        data-tauri-drag-region
        className="flex-1 max-w-lg mx-2 sm:mx-4 flex items-center justify-center min-w-0"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 max-w-full px-3 py-1 rounded-lg bg-stone-100/90 border border-stone-200/70 text-xs text-stone-800 shadow-2xs select-none"
        >
          <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <span className="font-medium truncate max-w-[140px] sm:max-w-[220px] md:max-w-xs">
            {currentDoc ? currentDoc.name : 'PaperLite PDF Reader'}
          </span>
          {totalPages > 0 && (
            <span className="text-[11px] text-stone-500 font-mono shrink-0 pl-1.5 border-l border-stone-300">
              {isTwoPage && currentRight <= totalPages
                ? `${currentLeft}-${currentRight}`
                : currentPage}{' '}
              / {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Right section: Quick Controls, ControllerBar Toggle, Modal Openers & Windows Style Window Controls */}
      <div
        className="flex items-center gap-1 sm:gap-1.5 shrink-0"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Toggle Controller Bar Toolbar */}
        <button
          id="btn-toggle-controllerbar"
          onClick={onToggleControllerBar}
          title={isControllerBarOpen ? 'Hide Control Toolbar' : 'Show Control Toolbar'}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
            isControllerBarOpen
              ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs'
              : 'bg-stone-100 text-stone-600 border border-stone-200/80 hover:bg-stone-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Controls</span>
          {isControllerBarOpen ? (
            <ChevronUp className="w-3 h-3 text-blue-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-stone-400" />
          )}
        </button>

        {/* Search button */}
        <button
          id="btn-search"
          onClick={onOpenSearch}
          title="Search in document (Cmd+F)"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Bookmark toggle */}
        <button
          id="btn-bookmark"
          onClick={onToggleBookmark}
          title={isBookmarked ? 'Remove Bookmark (Cmd+D)' : 'Bookmark Page (Cmd+D)'}
          className={`p-1.5 rounded-lg transition-all ${
            isBookmarked
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500' : ''}`} />
        </button>

        {/* Export / Share */}
        <button
          id="btn-export"
          onClick={onOpenExportModal}
          title="Export Notes & Bookmarks"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all hidden sm:block"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Reader Preferences / Settings */}
        <button
          id="btn-settings"
          onClick={onOpenSettingsModal}
          title="Reader Preferences"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Secondary Window Control Actions for Windows/Linux Users */}
        <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-stone-200 hidden md:flex">
          {/* Minimize */}
          <button
            id="win-ctrl-minimize"
            onClick={handleMinimize}
            title="Minimize"
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            id="win-ctrl-maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3 h-3 stroke-[2.2]" />
            )}
          </button>

          {/* Close */}
          <button
            id="win-ctrl-close"
            onClick={handleClose}
            title="Close"
            className="p-1.5 text-stone-500 hover:text-white hover:bg-rose-500 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
