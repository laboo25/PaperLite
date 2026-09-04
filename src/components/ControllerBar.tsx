import React, { useState, useEffect } from 'react';
import {
  AnnotationTool,
  ReaderSettings
} from '../types';
import { ViewOptionsSection } from './toolbar/ViewOptionsSection';
import { EditOptionsSection } from './toolbar/EditOptionsSection';
import { HistoryAction } from '../services/historyTracker';
import { startDraggingWindow, toggleMaximizeWindow } from '../services/tauriWindow';

interface ControllerBarProps {
  currentPage: number;
  totalPages: number;
  settings: ReaderSettings;
  activeTool: AnnotationTool;
  activeColor: string;
  isBookmarked: boolean;
  isDirty: boolean;
  isSaving?: boolean;
  lastSavedTime?: number | null;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string | null;
  redoDescription?: string | null;
  historyStack?: HistoryAction[];
  onToggleSidebar: () => void;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotate: () => void;
  onToggleBookmark: () => void;
  onOpenSearch: () => void;
  onOpenExportModal: () => void;
  onOpenSettingsModal: () => void;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const ControllerBar: React.FC<ControllerBarProps> = ({
  currentPage,
  totalPages,
  settings,
  activeTool,
  activeColor,
  isBookmarked,
  isDirty,
  isSaving = false,
  lastSavedTime,
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  historyStack = [],
  onToggleSidebar,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onRotate,
  onToggleBookmark,
  onOpenSearch,
  onOpenExportModal,
  onOpenSettingsModal,
  onUpdateSettings,
  onToolChange,
  onColorChange,
  onSave,
  onSaveAs,
  onUndo,
  onRedo
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Global mouseup listener to clear dragging cursor state
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

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
    await toggleMaximizeWindow();
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
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
      // ignore
    } finally {
      setIsDragging(false);
      document.body.style.cursor = '';
    }
  };

  return (
    <div
      id="app-controller-bar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => {
        // Toolbar is not a drop area; ignore and reject OS file drops
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
      className={`w-full h-9 bg-white/95 backdrop-blur-md border-b border-black/[0.07] px-2 flex items-center justify-between gap-2 select-none z-30 shadow-2xs relative overflow-visible ${
        isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
      }`}
      style={{ WebkitAppRegion: 'drag' } as any}
      title="Click and hold to move window • Double-click to maximize"
    >
      {/* Left Side: View & Display Options */}
      <div
        data-no-drag="true"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="flex items-center relative overflow-visible z-30"
      >
        <ViewOptionsSection
          currentPage={currentPage}
          totalPages={totalPages}
          settings={settings}
          onToggleSidebar={onToggleSidebar}
          onPageChange={onPageChange}
          onZoomChange={onZoomChange}
          onFitWidth={onFitWidth}
          onFitPage={onFitPage}
          onRotate={onRotate}
          onUpdateSettings={onUpdateSettings}
        />
      </div>

      {/* Center Flexible Window Dragging Space */}
      <div
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as any}
        className={`flex-1 h-full min-w-[20px] ${
          isDragging ? 'cursor-move' : 'cursor-default active:cursor-move'
        }`}
        title="Click and hold to move window • Double-click to maximize"
      />

      {/* Right Side: Edit & Annotation Tools (Highlighter, Pen, Note, Save & History) */}
      <div
        data-no-drag="true"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="flex items-center relative overflow-visible z-30"
      >
        <EditOptionsSection
          activeTool={activeTool}
          activeColor={activeColor}
          isBookmarked={isBookmarked}
          isDirty={isDirty}
          isSaving={isSaving}
          lastSavedTime={lastSavedTime}
          canUndo={canUndo}
          canRedo={canRedo}
          undoDescription={undoDescription}
          redoDescription={redoDescription}
          historyStack={historyStack}
          onToolChange={onToolChange}
          onColorChange={onColorChange}
          onToggleBookmark={onToggleBookmark}
          onOpenSearch={onOpenSearch}
          onOpenExportModal={onOpenExportModal}
          onOpenSettingsModal={onOpenSettingsModal}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      </div>
    </div>
  );
};
