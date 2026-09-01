import React, { useState } from 'react';
import {
  FolderOpen,
  Library,
  Sidebar as SidebarIcon,
  Search,
  Bookmark,
  Sun,
  Moon,
  Coffee,
  FileText,
  Sliders,
  Share2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PDFDocumentInfo, ReaderSettings } from '../types';

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isTwoPage = settings.viewMode === 'two-page';
  const currentLeft = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  const currentRight = currentLeft + 1;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header
      id="app-titlebar"
      className="h-11 w-full flex items-center justify-between px-3 select-none z-30 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl transition-colors"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left section: iOS/macOS Window dots + Sidebar toggle + Library + Open File */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* macOS Style Traffic Dots */}
        <div className="flex items-center gap-1.5 mr-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] inline-block shadow-2xs hover:opacity-80 cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] inline-block shadow-2xs hover:opacity-80 cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] inline-block shadow-2xs hover:opacity-80 cursor-pointer" />
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

      {/* Center section: Document Title & Reading Position */}
      <div className="flex-1 max-w-lg mx-2 sm:mx-4 flex items-center justify-center min-w-0" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-2 max-w-full px-3 py-1 rounded-lg bg-stone-100/90 border border-stone-200/70 text-xs text-stone-800 shadow-2xs">
          <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <span className="font-medium truncate max-w-[150px] sm:max-w-[240px] md:max-w-xs">
            {currentDoc ? currentDoc.name : 'No Document'}
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

      {/* Right section: Quick Controls, ControllerBar Toggle & Modal Openers */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
          <span className="hidden lg:inline">{isControllerBarOpen ? 'Controls' : 'Controls'}</span>
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

        {/* Fullscreen */}
        <button
          id="btn-fullscreen"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
