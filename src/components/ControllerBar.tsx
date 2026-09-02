import React from 'react';
import {
  AnnotationTool,
  ReaderSettings
} from '../types';
import { ViewOptionsSection } from './toolbar/ViewOptionsSection';
import { EditOptionsSection } from './toolbar/EditOptionsSection';
import { HistoryAction } from '../services/historyTracker';

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
  return (
    <div
      id="app-controller-bar"
      className="w-full h-9 bg-white/95 backdrop-blur-md border-b border-black/[0.07] px-2 flex items-center justify-between gap-2 select-none z-20 shadow-2xs relative overflow-visible"
    >
      {/* Left Side: View & Display Options */}
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

      {/* Right Side: Edit & Annotation Tools (Highlighter, Pen, Note, Save & History) */}
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
  );
};
