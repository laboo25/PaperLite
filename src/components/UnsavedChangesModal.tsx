import React, { useEffect } from 'react';
import { AlertCircle, FileText, Save, Trash2, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  documentName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  documentName,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false
}) => {
  // Keyboard navigation: Escape cancels, Enter saves
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        // Only trigger Enter save if not focusing on Discard button
        const active = document.activeElement;
        if (active?.id === 'btn-confirm-discard' || active?.id === 'btn-confirm-cancel') {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onCancel, onSave]);

  if (!isOpen) return null;

  return (
    <div
      id="unsaved-changes-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onCancel}
    >
      <div
        id="unsaved-changes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-modal-title"
        aria-describedby="unsaved-modal-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-stone-900"
      >
        {/* Header & Warning Banner */}
        <div className="p-5 pb-4 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center shrink-0 text-amber-600 shadow-xs">
            <AlertCircle className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="unsaved-modal-title" className="text-base font-bold text-stone-900 leading-snug">
              Save changes before closing?
            </h2>

            {/* Document Chip */}
            <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-100/90 border border-stone-200/60 max-w-full">
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-semibold text-stone-800 truncate" title={documentName}>
                {documentName}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-unsaved-modal"
            onClick={onCancel}
            title="Cancel and keep tab open (Esc)"
            aria-label="Cancel"
            className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 pb-4">
          <p id="unsaved-modal-desc" className="text-xs sm:text-[13px] text-stone-600 leading-relaxed">
            This document has unsaved annotations, highlights, or bookmarks. If you close without saving, these modifications will be permanently lost.
          </p>
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-stone-50/90 border-t border-stone-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
          <button
            type="button"
            id="btn-confirm-cancel"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 active:bg-stone-300 transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-confirm-discard"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 active:bg-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Don't Save</span>
          </button>

          <button
            type="button"
            id="btn-confirm-save"
            onClick={onSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
