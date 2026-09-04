import React, { useState, useRef, useEffect } from 'react';
import { Undo2, Redo2, History, ChevronDown, Clock, CheckCircle2 } from 'lucide-react';
import { HistoryAction } from '../../services/historyTracker';

interface HistoryControlsModuleProps {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string | null;
  redoDescription?: string | null;
  historyStack?: HistoryAction[];
  onUndo: () => void;
  onRedo: () => void;
}

export const HistoryControlsModule: React.FC<HistoryControlsModuleProps> = ({
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  historyStack = [],
  onUndo,
  onRedo
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape
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

  const undoTooltip = canUndo
    ? `Undo: ${undoDescription || 'Last edit'} (Ctrl+Z / Cmd+Z)`
    : 'Nothing to Undo (Ctrl+Z)';

  const redoTooltip = canRedo
    ? `Redo: ${redoDescription || 'Last edit'} (Ctrl+Y / Cmd+Shift+Z)`
    : 'Nothing to Redo (Ctrl+Y)';

  return (
    <div ref={containerRef} className="relative flex items-center bg-stone-100/90 p-0.5 rounded-lg shrink-0">
      {/* Undo Button */}
      <button
        type="button"
        id="btn-history-undo"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoTooltip}
        aria-label="Undo annotation change"
        className="h-6 px-1.5 rounded-md flex items-center gap-1 text-stone-700 hover:text-stone-900 hover:bg-white active:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer text-xs font-medium"
      >
        <Undo2 className="w-3.5 h-3.5" />
        <span className="hidden xl:inline text-[11px]">Undo</span>
      </button>

      {/* Redo Button */}
      <button
        type="button"
        id="btn-history-redo"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoTooltip}
        aria-label="Redo annotation change"
        className="h-6 px-1.5 rounded-md flex items-center gap-1 text-stone-700 hover:text-stone-900 hover:bg-white active:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer text-xs font-medium"
      >
        <Redo2 className="w-3.5 h-3.5" />
        <span className="hidden xl:inline text-[11px]">Redo</span>
      </button>

      {/* History Activity Dropdown Trigger (Optional) */}
      {historyStack.length > 0 && (
        <button
          type="button"
          id="btn-history-log-popover"
          onClick={() => setIsOpen(!isOpen)}
          title={`Edit History (${historyStack.length} actions)`}
          aria-label="View Edit History Stack"
          className="h-6 w-4 flex items-center justify-center rounded-md hover:bg-white text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* History Stack Popover */}
      {isOpen && historyStack.length > 0 && (
        <div
          data-no-drag="true"
          data-popover="true"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-full right-0 mt-1.5 w-64 p-2.5 bg-white/98 backdrop-blur-xl rounded-xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 space-y-2 select-none"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit History Stack</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
              {historyStack.length} {historyStack.length === 1 ? 'Action' : 'Actions'}
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
            {[...historyStack].reverse().map((act, index) => (
              <div
                key={act.id}
                className={`flex items-start gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                  index === 0 ? 'bg-blue-50/70 text-blue-900 font-medium' : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {index === 0 ? (
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-stone-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] truncate leading-tight font-medium">{act.description}</p>
                  <p className="text-[9px] text-stone-400 mt-0.5 font-mono">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
