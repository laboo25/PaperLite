import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  BookOpen,
  Clock,
  Star,
  HardDrive,
  Sparkles,
  ChevronRight,
  MoreVertical,
  Edit3,
  FileMinus,
  Trash2,
  AlertTriangle,
  FileText,
  X,
  Check
} from 'lucide-react';
import { PDFDocumentInfo } from '../types';
import { PDFDocIcon } from './PDFDocIcon';

interface HomeViewProps {
  recentDocs: PDFDocumentInfo[];
  onOpenDoc: (doc: PDFDocumentInfo) => void;
  onOpenSample?: (sampleId: string) => void;
  onOpenFile: () => void;
  onOpenLibrary: () => void;
  onScanDirectory: () => void;
  onToggleFavorite: (docId: string) => void;
  onRemoveFromApp: (docId: string) => void;
  onRenameDoc: (docId: string, newName: string) => void;
  onDeleteFromStorage: (doc: PDFDocumentInfo) => Promise<void> | void;
}

interface ContextMenuState {
  x: number;
  y: number;
  doc: PDFDocumentInfo;
}

export const HomeView: React.FC<HomeViewProps> = ({
  recentDocs,
  onOpenDoc,
  onOpenSample,
  onOpenFile,
  onOpenLibrary,
  onScanDirectory,
  onToggleFavorite,
  onRemoveFromApp,
  onRenameDoc,
  onDeleteFromStorage
}) => {
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Modal States
  const [renameTargetDoc, setRenameTargetDoc] = useState<PDFDocumentInfo | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [deleteStorageTargetDoc, setDeleteStorageTargetDoc] = useState<PDFDocumentInfo | null>(null);
  const [removeFromAppTargetDoc, setRemoveFromAppTargetDoc] = useState<PDFDocumentInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const renameInputRef = useRef<HTMLInputElement>(null);

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format Last Opened
  const formatLastOpened = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Close context menu on global click or Escape key, preventing memory leaks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        if (!isDeleting) {
          setRenameTargetDoc(null);
          setDeleteStorageTargetDoc(null);
          setRemoveFromAppTargetDoc(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting]);

  // Focus and select input text when rename modal opens
  useEffect(() => {
    if (renameTargetDoc) {
      // Remove .pdf extension for clean editing
      const baseName = renameTargetDoc.name.replace(/\.pdf$/i, '');
      setRenameInputValue(baseName);
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
        }
      }, 50);
    }
  }, [renameTargetDoc]);

  // Open context menu anchored to button or at cursor position
  const openContextMenuFromButton = (e: React.MouseEvent, doc: PDFDocumentInfo) => {
    e.stopPropagation();
    e.preventDefault();
    const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = 280;

    let x = buttonRect.right - menuWidth;
    if (x < 12) x = Math.max(12, buttonRect.left);
    let y = buttonRect.bottom + 6;
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, buttonRect.top - menuHeight - 6);
    }

    setContextMenu({ x, y, doc });
  };

  const openContextMenuFromRightClick = (e: React.MouseEvent, doc: PDFDocumentInfo) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 240;
    const menuHeight = 280;

    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth - 12) {
      x = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, window.innerHeight - menuHeight - 12);
    }

    setContextMenu({ x, y, doc });
  };

  // Handlers for menu actions
  const handleTriggerRename = (doc: PDFDocumentInfo) => {
    setContextMenu(null);
    setRenameTargetDoc(doc);
  };

  const handleConfirmRename = () => {
    if (!renameTargetDoc) return;
    const trimmed = renameInputValue.trim();
    if (trimmed.length > 0) {
      const finalName = trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
      onRenameDoc(renameTargetDoc.id, finalName);
    }
    setRenameTargetDoc(null);
  };

  const handleTriggerRemoveFromApp = (doc: PDFDocumentInfo) => {
    setContextMenu(null);
    setRemoveFromAppTargetDoc(doc);
  };

  const handleConfirmRemoveFromApp = () => {
    if (removeFromAppTargetDoc) {
      onRemoveFromApp(removeFromAppTargetDoc.id);
      setRemoveFromAppTargetDoc(null);
    }
  };

  const handleTriggerDeleteFromStorage = (doc: PDFDocumentInfo) => {
    setContextMenu(null);
    setDeleteStorageTargetDoc(doc);
  };

  const handleConfirmDeleteFromStorage = async () => {
    if (!deleteStorageTargetDoc) return;
    setIsDeleting(true);
    try {
      await onDeleteFromStorage(deleteStorageTargetDoc);
    } finally {
      setIsDeleting(false);
      setDeleteStorageTargetDoc(null);
    }
  };

  const favoriteDocs = recentDocs.filter((d) => Boolean(d.isFavorite));

  return (
    <div
      className="flex-1 w-full h-full overflow-y-auto bg-stone-50/60 p-4 sm:p-6 md:p-8 select-none relative"
      onContextMenu={(e) => {
        // Prevent default browser context menu on empty space
        e.preventDefault();
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Workspace Action Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200/80">
          <div className="flex items-center gap-2.5">
            <PDFDocIcon size={24} className="shrink-0" />
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">
                Document Workspace
              </h1>
              <p className="text-xs text-stone-500 font-mono">
                {recentDocs.length} {recentDocs.length === 1 ? 'file' : 'files'} in library
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="home-open-pdf-btn"
              onClick={onOpenFile}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
              title="Open PDF file from computer (Cmd+O)"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </button>

            <button
              id="home-library-btn"
              onClick={onOpenLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Browse full library collection"
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Library</span>
            </button>
          </div>
        </div>

        {/* Quick Launch Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Open Local File */}
          <div
            id="card-open-file"
            onClick={onOpenFile}
            className="group p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-stone-900 group-hover:text-blue-600 transition-colors">
                Open New File
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                Select PDF from computer
              </p>
            </div>
          </div>

          {/* Card 2: Browse Sample Library */}
          <div
            id="card-browse-library"
            onClick={onOpenLibrary}
            className="group p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-stone-900 group-hover:text-indigo-600 transition-colors">
                Document Library
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                View books & documents
              </p>
            </div>
          </div>

          {/* Card 3: Fast Scan Storage */}
          <div
            id="card-scan-storage"
            onClick={onScanDirectory}
            className="group p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <HardDrive className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-stone-900 group-hover:text-emerald-600 transition-colors">
                Scan Storage
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                Scan local directory
              </p>
            </div>
          </div>
        </div>

        {/* Favorite Documents Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Favorite Documents ({favoriteDocs.length})
              </h2>
            </div>
            {favoriteDocs.length > 0 && (
              <span className="text-[11px] text-stone-400 hidden sm:inline font-medium">
                Quick access to starred files
              </span>
            )}
          </div>

          {favoriteDocs.length === 0 ? (
            <div className="p-5 rounded-2xl bg-white/70 border border-stone-200/80 text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-500 flex items-center justify-center mb-2">
                <Star className="w-4.5 h-4.5 text-amber-500 stroke-[1.8]" />
              </div>
              <p className="text-xs font-semibold text-stone-700">No favorite documents yet</p>
              <p className="text-[11px] text-stone-400 max-w-sm mt-0.5">
                Click the star icon (★) on any document in the list below to pin it here for quick access
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {favoriteDocs.map((doc) => (
                <div
                  key={doc.id}
                  id={`favorite-card-${doc.id}`}
                  onClick={() => onOpenDoc(doc)}
                  onContextMenu={(e) => openContextMenuFromRightClick(e, doc)}
                  className="group relative p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  title="Click to open • Right-click for options"
                >
                  <div className="flex items-start justify-between gap-2">
                    <PDFDocIcon size={24} className="shrink-0" />
                    <div className="flex items-center gap-1">
                      {/* Unfavorite button */}
                      <button
                        id={`fav-card-toggle-${doc.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(doc.id);
                        }}
                        className="p-1 rounded-lg text-amber-500 hover:text-stone-400 hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Remove from favorites"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      </button>

                      {/* 3-Dot Menu */}
                      <button
                        id={`fav-card-menu-${doc.id}`}
                        onClick={(e) => openContextMenuFromButton(e, doc)}
                        className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                        title="File options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-xs font-bold text-stone-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {doc.name}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono mt-1.5">
                      <span>{doc.totalPages} pages</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-sans font-medium">
                        Page {doc.lastPageRead || 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Documents Section with 3-Dot & Context Menu */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-500" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Recent Documents ({recentDocs.length})
              </h2>
            </div>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Right-click or click ••• for file options
            </p>
          </div>

          {recentDocs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-stone-200/80 text-center flex flex-col items-center justify-center">
              <PDFDocIcon size={48} className="mb-2 opacity-80" />
              <p className="text-sm font-medium text-stone-600">No recent documents opened</p>
              <p className="text-xs text-stone-400 mt-0.5">
                Open a PDF or choose a sample to start reading
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs divide-y divide-stone-100">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  id={`recent-doc-row-${doc.id}`}
                  onClick={() => onOpenDoc(doc)}
                  onContextMenu={(e) => openContextMenuFromRightClick(e, doc)}
                  className="group flex items-center justify-between p-3.5 hover:bg-stone-50/90 active:bg-stone-100/70 transition-colors cursor-pointer"
                  title="Click to open • Right-click for options"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <PDFDocIcon size={22} className="shrink-0" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-900 group-hover:text-blue-600 truncate transition-colors">
                          {doc.name}
                        </span>
                        {doc.isFavorite && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-stone-500 font-mono mt-0.5">
                        <span>{doc.totalPages} pages</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>Page {doc.lastPageRead || 1}</span>
                        {doc.path && (
                          <>
                            <span className="hidden md:inline">•</span>
                            <span className="hidden md:inline text-stone-400 truncate max-w-[200px]" title={doc.path}>
                              {doc.path}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Area: Timestamp + Favorite + 3-Dot Options + Chevron */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-3">
                    <span className="text-[11px] text-stone-400 hidden sm:inline mr-1">
                      {formatLastOpened(doc.lastOpened)}
                    </span>

                    {/* Star Favorite Button */}
                    <button
                      id={`favorite-btn-${doc.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(doc.id);
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-amber-500 hover:bg-stone-100 transition-colors cursor-pointer"
                      title={doc.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          doc.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                        }`}
                      />
                    </button>

                    {/* 3-DOT MENU BUTTON (iOS / Material 3 style) */}
                    <button
                      id={`doc-menu-btn-${doc.id}`}
                      onClick={(e) => openContextMenuFromButton(e, doc)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 active:scale-95 transition-all cursor-pointer"
                      title="File options (Rename, Remove, Delete)"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-600 transition-colors hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM CONTEXT MENU (iOS / Material 3 Style Popover) */}
      {contextMenu && (
        <>
          {/* Backdrop for dismiss on click or right click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          <div
            id="pdf-custom-context-menu"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`
            }}
            className="fixed z-50 w-[240px] bg-white/95 backdrop-blur-xl border border-stone-200/90 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none text-stone-800 ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Context Menu Header: File info */}
            <div className="px-2.5 py-2 border-b border-stone-100 flex items-center gap-2 mb-1">
              <PDFDocIcon size={18} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-900 truncate leading-tight">
                  {contextMenu.doc.name}
                </p>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {formatFileSize(contextMenu.doc.size)} • {contextMenu.doc.totalPages} pages
                </p>
              </div>
            </div>

            {/* Item 1: Open Document */}
            <button
              id="context-menu-open-btn"
              onClick={() => {
                setContextMenu(null);
                onOpenDoc(contextMenu.doc);
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl hover:bg-blue-50 text-stone-700 hover:text-blue-600 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-stone-500 group-hover:text-blue-600" />
              <span>Open Document</span>
            </button>

            {/* Item 2: Toggle Favorite */}
            <button
              id="context-menu-favorite-btn"
              onClick={() => {
                onToggleFavorite(contextMenu.doc.id);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl hover:bg-amber-50 text-stone-700 hover:text-amber-600 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  contextMenu.doc.isFavorite
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-stone-500'
                }`}
              />
              <span>
                {contextMenu.doc.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
              </span>
            </button>

            <div className="my-1 border-t border-stone-100" />

            {/* Item 3: Rename This PDF */}
            <button
              id="context-menu-rename-btn"
              onClick={() => handleTriggerRename(contextMenu.doc)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Rename this PDF</span>
            </button>

            {/* Item 4: Remove from App (Keeps file on disk storage) */}
            <button
              id="context-menu-remove-btn"
              onClick={() => handleTriggerRemoveFromApp(contextMenu.doc)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors text-left cursor-pointer"
            >
              <FileMinus className="w-3.5 h-3.5 text-stone-500" />
              <div className="flex flex-col text-left">
                <span>Remove from app</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  Keeps file on disk
                </span>
              </div>
            </button>

            <div className="my-1 border-t border-stone-100" />

            {/* Item 5: Delete PDF from Storage (Permanently deletes from disk) */}
            <button
              id="context-menu-delete-storage-btn"
              onClick={() => handleTriggerDeleteFromStorage(contextMenu.doc)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl hover:bg-red-50 text-red-600 text-xs font-semibold transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <div className="flex flex-col text-left">
                <span>Delete PDF from storage</span>
                <span className="text-[10px] text-red-400 font-normal">
                  Permanently delete from disk
                </span>
              </div>
            </button>
          </div>
        </>
      )}

      {/* RENAME MODAL (iOS / Material 3 Style) */}
      {renameTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200/90 p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Rename PDF Document</h3>
                  <p className="text-[11px] text-stone-500">Update file title and storage name</p>
                </div>
              </div>
              <button
                onClick={() => setRenameTargetDoc(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renameTargetDoc.path && (
              <div className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-100 text-[11px] font-mono text-stone-500 truncate" title={renameTargetDoc.path}>
                Path: {renameTargetDoc.path}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                New PDF Name
              </label>
              <div className="relative flex items-center">
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmRename();
                    if (e.key === 'Escape') setRenameTargetDoc(null);
                  }}
                  placeholder="Enter new file name..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                />
                <span className="absolute right-3 text-xs font-mono text-stone-400 pointer-events-none select-none">
                  .pdf
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setRenameTargetDoc(null)}
                className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-rename-btn"
                onClick={handleConfirmRename}
                disabled={renameInputValue.trim().length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Rename</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE FROM APP CONFIRMATION MODAL */}
      {removeFromAppTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200/90 p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                <FileMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Remove from App?</h3>
                <p className="text-[11px] text-stone-500">Remove from recent list and library</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-stone-900 font-semibold">{removeFromAppTargetDoc.name}</strong> from PaperLite? The actual PDF file will remain safe and untouched on your computer storage.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setRemoveFromAppTargetDoc(null)}
                className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-remove-from-app-btn"
                onClick={handleConfirmRemoveFromApp}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                Remove from App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FROM STORAGE CONFIRMATION MODAL (Material 3 Destructive Alert) */}
      {deleteStorageTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-200/80 p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-950">Delete PDF from Storage?</h3>
                <p className="text-[11px] text-red-600 font-medium">Permanent deletion from disk</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-50/70 border border-red-100 text-xs text-red-800 space-y-1">
              <p className="font-semibold text-red-900">
                Warning: This action cannot be undone.
              </p>
              <p className="text-[11px] text-red-700">
                This will permanently delete <strong>{deleteStorageTargetDoc.name}</strong> directly from your computer storage / hard disk.
              </p>
              {deleteStorageTargetDoc.path && (
                <p className="font-mono text-[10px] text-red-800 truncate pt-1 border-t border-red-200/60" title={deleteStorageTargetDoc.path}>
                  Location: {deleteStorageTargetDoc.path}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setDeleteStorageTargetDoc(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-storage-btn"
                onClick={handleConfirmDeleteFromStorage}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
