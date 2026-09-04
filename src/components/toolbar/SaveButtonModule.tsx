import React, { useState, useRef, useEffect } from 'react';
import { Save, Check, ChevronDown, Download, Sparkles, FileDown } from 'lucide-react';

interface SaveButtonModuleProps {
  isDirty: boolean;
  isSaving?: boolean;
  lastSavedTime?: number | null;
  onSave: () => void;
  onSaveAs?: () => void;
}

export const SaveButtonModule: React.FC<SaveButtonModuleProps> = ({
  isDirty,
  isSaving = false,
  lastSavedTime,
  onSave,
  onSaveAs
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger brief green flash when clean after saving
  useEffect(() => {
    if (!isDirty && lastSavedTime) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isDirty, lastSavedTime]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
  const saveShortcut = isMac ? '⌘S' : 'Ctrl+S';
  const saveAsShortcut = isMac ? '⇧⌘S' : 'Ctrl+Shift+S';

  const handleMainSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave();
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Primary Save Button - Default Action */}
      <button
        type="button"
        id="btn-file-save"
        onClick={handleMainSave}
        disabled={isSaving}
        title={
          isDirty
            ? `Save changes to document (${saveShortcut}) - Unsaved Edits`
            : `All edits saved (${saveShortcut})`
        }
        aria-label="Save document changes"
        className={`h-7 px-2.5 rounded-l-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border ${
          isDirty
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-2xs animate-pulse-subtle'
            : justSaved
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : 'bg-stone-50 border-stone-200/90 text-stone-700 hover:bg-stone-100 hover:text-stone-900'
        }`}
      >
        {isSaving ? (
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isDirty ? (
          <>
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
          </>
        ) : justSaved ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline text-emerald-700">Saved</span>
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline font-medium text-stone-700">Save</span>
          </>
        )}
      </button>

      {/* Dropdown Options Button */}
      <button
        type="button"
        id="btn-save-options-dropdown"
        onClick={() => setIsOpen(!isOpen)}
        title="More Save & Export Options"
        aria-label="Save and Export options"
        className={`h-7 px-1 rounded-r-lg border-y border-r flex items-center justify-center transition-all cursor-pointer ${
          isDirty
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 border-l border-l-blue-500'
            : 'bg-stone-50 border-stone-200/90 text-stone-600 hover:bg-stone-100 border-l border-l-stone-200'
        }`}
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          data-no-drag="true"
          data-popover="true"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-full right-0 mt-1.5 w-64 p-2 bg-white/98 backdrop-blur-xl rounded-xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 space-y-1 select-none"
        >
          {/* Header Status */}
          <div className="px-2.5 py-1.5 pb-2 border-b border-stone-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-700">File Storage & Save</span>
            {isDirty ? (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unsaved Edits
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Up to Date
              </span>
            )}
          </div>

          {/* Option 1: Save (Default Option) */}
          <button
            type="button"
            id="menu-item-save-default"
            onClick={() => {
              onSave();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-stone-800 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Save className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="text-left flex items-center gap-1.5">
                <span className="font-semibold text-stone-900 group-hover:text-blue-700">Save</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-blue-100/70 text-blue-700 border border-blue-200/60">
                  Default
                </span>
              </div>
            </div>
            <span className="text-[10px] text-stone-400 font-mono font-medium group-hover:text-blue-600">
              {saveShortcut}
            </span>
          </button>

          {/* Option 2: Save As... with keyboard shortcut */}
          <button
            type="button"
            id="menu-item-save-as"
            onClick={() => {
              if (onSaveAs) onSaveAs();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-stone-800 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-medium text-stone-800 group-hover:text-stone-900">Save As...</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono font-medium group-hover:text-stone-600">
              {saveAsShortcut}
            </span>
          </button>

          {/* Option 3: Export Annotations Package */}
          <button
            type="button"
            id="menu-item-export-annotations"
            onClick={() => {
              if (onSaveAs) onSaveAs();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-stone-600">Export Annotations</span>
            </div>
            <span className="text-[9px] text-stone-400 font-mono uppercase">JSON</span>
          </button>

          {/* Footer Last Saved */}
          {lastSavedTime && (
            <div className="px-2.5 pt-1.5 pb-0.5 border-t border-stone-100 text-[10px] text-stone-400 font-mono flex items-center justify-between">
              <span>Last saved:</span>
              <span className="text-stone-600">
                {new Date(lastSavedTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
