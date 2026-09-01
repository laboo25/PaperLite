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
  isWindowMaximized
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
  onOpenSettingsModal,
  onOpenExportModal
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const isTwoPage = settings.viewMode === 'two-page';
  const currentLeft = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  const currentRight = currentLeft + 1;

  useEffect(() => {
    isWindowMaximized().then(setIsMaximized);

    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      className="h-10 w-full flex items-center justify-between px-2.5 sm:px-3 select-none z-30 border-b border-black/[0.07] bg-white/95 backdrop-blur-xl transition-colors cursor-default"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left section: App Branding + Nav/File Actions (No window control dots here) */}
      <div
        className="flex items-center gap-1.5 sm:gap-2 shrink-0"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* App Logo / Brand */}
        <div className="flex items-center gap-1.5 mr-1 select-none">
          <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-2xs">
            <FileText className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span className="text-xs font-semibold text-stone-800 tracking-tight hidden sm:inline">
            PaperLite
          </span>
        </div>

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

      {/* Center section: Document Title & Page Counter (Draggable region) */}
      <div
        data-tauri-drag-region
        className="flex-1 max-w-md mx-2 flex items-center justify-center min-w-0"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 max-w-full px-2.5 py-0.5 rounded-lg bg-stone-100/90 border border-stone-200/70 text-xs text-stone-800 shadow-2xs select-none"
        >
          <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <span className="font-medium truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px]">
            {currentDoc ? currentDoc.name : 'No Document Opened'}
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

      {/* Right section: Toolbar actions + Single Unified Window Controller Buttons */}
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
          <Search className="w-3.5 h-3.5" />
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
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500' : ''}`} />
        </button>

        {/* Export / Share */}
        <button
          id="btn-export"
          onClick={onOpenExportModal}
          title="Export Notes & Bookmarks"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all hidden sm:block"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Reader Preferences / Settings */}
        <button
          id="btn-settings"
          onClick={onOpenSettingsModal}
          title="Reader Preferences"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Unified App Window Controls (Minimize, Maximize/Restore, Close) */}
        <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-stone-200">
          {/* Minimize Button */}
          <button
            id="window-control-minimize"
            onClick={handleMinimize}
            title="Minimize"
            aria-label="Minimize Window"
            className="w-7 h-7 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 rounded-md transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            id="window-control-maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
            className="w-7 h-7 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 rounded-md transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 stroke-[2]" />
            ) : (
              <Square className="w-3 h-3 stroke-[2]" />
            )}
          </button>

          {/* Close Button */}
          <button
            id="window-control-close"
            onClick={handleClose}
            title="Close Application"
            aria-label="Close Application"
            className="w-7 h-7 flex items-center justify-center text-stone-600 hover:text-white hover:bg-rose-500 active:bg-rose-600 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </header>
  );
};
