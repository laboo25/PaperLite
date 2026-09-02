import React from 'react';
import {
  Search,
  Bookmark,
  Share2,
  Sliders,
  Edit3
} from 'lucide-react';
import { AnnotationTool } from '../../types';
import { AnnotationModule } from './AnnotationModule';
import { SaveButtonModule } from './SaveButtonModule';
import { HistoryControlsModule } from './HistoryControlsModule';
import { HistoryAction } from '../../services/historyTracker';

interface EditOptionsSectionProps {
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
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onToggleBookmark: () => void;
  onOpenSearch: () => void;
  onOpenExportModal: () => void;
  onOpenSettingsModal: () => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const EditOptionsSection: React.FC<EditOptionsSectionProps> = ({
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
  onToolChange,
  onColorChange,
  onToggleBookmark,
  onOpenSearch,
  onOpenExportModal,
  onOpenSettingsModal,
  onSave,
  onSaveAs,
  onUndo,
  onRedo
}) => {
  return (
    <div
      id="toolbar-edit-options-group"
      className="flex items-center gap-1.5 shrink-0"
    >
      {/* 1. File Save Module with Status & Dirty indicator */}
      <SaveButtonModule
        isDirty={isDirty}
        isSaving={isSaving}
        lastSavedTime={lastSavedTime}
        onSave={onSave}
        onSaveAs={onSaveAs}
      />

      {/* 2. History Tracker Undo / Redo Module */}
      <HistoryControlsModule
        canUndo={canUndo}
        canRedo={canRedo}
        undoDescription={undoDescription}
        redoDescription={redoDescription}
        historyStack={historyStack}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      <div className="h-3.5 w-px bg-stone-200" />

      {/* 3. Annotation Studio Module (Highlighter, Pen, Notes + Color Palette) */}
      <AnnotationModule
        activeTool={activeTool}
        activeColor={activeColor}
        onToolChange={onToolChange}
        onColorChange={onColorChange}
      />

      <div className="h-3.5 w-px bg-stone-200" />

      {/* 4. Search in Document Button */}
      <button
        type="button"
        id="tool-search"
        onClick={onOpenSearch}
        title="Search in Document (Cmd+F)"
        aria-label="Search Document"
        className="h-7 px-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 transition-colors flex items-center justify-center cursor-pointer"
      >
        <Search className="w-3.5 h-3.5" />
      </button>

      {/* 5. Bookmark Current Page Button */}
      <button
        type="button"
        id="tool-bookmark"
        onClick={onToggleBookmark}
        title={isBookmarked ? 'Remove Bookmark (Cmd+D)' : 'Bookmark Page (Cmd+D)'}
        aria-label="Bookmark Page"
        className={`h-7 px-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
          isBookmarked
            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 active:bg-amber-200'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200'
        }`}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500' : ''}`} />
      </button>

      {/* 6. Export Notes & Highlights Button */}
      <button
        type="button"
        id="tool-export-notes"
        onClick={onOpenExportModal}
        title="Export Notes & Highlights"
        aria-label="Export Notes"
        className="h-7 px-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 transition-colors flex items-center justify-center cursor-pointer"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {/* 7. Reader Preferences & Settings Button */}
      <button
        type="button"
        id="tool-preferences"
        onClick={onOpenSettingsModal}
        title="Reader Settings & Preferences"
        aria-label="Reader Preferences"
        className="h-7 px-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 transition-colors flex items-center justify-center cursor-pointer"
      >
        <Sliders className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
