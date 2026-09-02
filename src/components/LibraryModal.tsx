import { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Star,
  Trash2,
  Edit2,
  HardDrive,
  Search,
  Check,
  X,
  Clock,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { PDFDocumentInfo } from '../types';
import { SAMPLE_DOCUMENTS } from '../data/samplePdfs';
import { PDFDocIcon } from './PDFDocIcon';

interface LibraryModalProps {
  isOpen: boolean;
  documents: PDFDocumentInfo[];
  currentDocId?: string;
  onSelectDocument: (doc: PDFDocumentInfo) => void;
  onSelectSample: (sampleId: string) => void;
  onOpenFile: () => void;
  onScanDirectory: () => void;
  onToggleFavorite: (docId: string) => void;
  onRenameDocument: (docId: string, newName: string) => void;
  onDeleteDocument: (docId: string) => void;
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  documents,
  currentDocId,
  onSelectDocument,
  onSelectSample,
  onOpenFile,
  onScanDirectory,
  onToggleFavorite,
  onRenameDocument,
  onDeleteDocument,
  onClose
}) => {
  const [filter, setFilter] = useState<'all' | 'favorites' | 'manuals' | 'samples'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const startRename = (doc: PDFDocumentInfo) => {
    setEditingDocId(doc.id);
    setEditingName(doc.name);
  };

  const saveRename = (docId: string) => {
    if (editingName.trim()) {
      onRenameDocument(docId, editingName.trim());
    }
    setEditingDocId(null);
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'favorites') return doc.isFavorite;
    if (filter === 'manuals') return doc.category === 'Manuals';
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-black/[0.06] flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Document Library</h2>
              <p className="text-xs text-stone-500">
                Secure local storage & Rust filesystem documents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onScanDirectory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 bg-stone-200/70 hover:bg-stone-300/70 transition-colors shadow-xs"
              title="Scan directory with Rust std::fs"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Scan Folder</span>
            </button>

            <button
              onClick={onOpenFile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-3 border-b border-black/[0.06] bg-stone-50/40 flex flex-wrap items-center justify-between gap-2">
          {/* Segmented Category Filter */}
          <div className="flex items-center p-0.5 rounded-xl bg-stone-200/70 border border-stone-300/40 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              All Documents ({documents.length})
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'favorites'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Favorites
            </button>
            <button
              onClick={() => setFilter('samples')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'samples'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Built-in Samples
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library documents..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* Document Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filter === 'samples' ? (
            /* Curated Sample Documents */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3.5">
              {SAMPLE_DOCUMENTS.map((sample) => (
                <div
                  key={sample.info.id}
                  onClick={() => {
                    onSelectSample(sample.info.id);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-stone-200/80 bg-white hover:border-blue-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate group-hover:text-blue-600">
                        {sample.info.name}
                      </h4>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {sample.info.totalPages} pages • {sample.info.category}
                      </p>
                      {sample.info.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {sample.info.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                    <span>Built-in local document</span>
                    <span className="font-semibold text-blue-600 group-hover:underline">Read now →</span>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDocs.length > 0 ? (
            /* Stored Library Documents */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDocs.map((doc) => {
                const isCurrent = doc.id === currentDocId;
                const progressPct =
                  doc.totalPages > 0
                    ? Math.round(((doc.lastPageRead || 1) / doc.totalPages) * 100)
                    : 0;

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      onSelectDocument(doc);
                      onClose();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-stone-200/80 bg-white hover:border-stone-400/80 hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top status bar */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <PDFDocIcon size={16} />
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-stone-100 text-stone-600">
                            {formatFileSize(doc.size)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(doc.id);
                            }}
                            title={doc.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                            className="p-1 text-stone-300 hover:text-amber-500 transition-colors"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                doc.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                              }`}
                            />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(doc);
                            }}
                            title="Rename"
                            className="p-1 text-stone-300 hover:text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDocument(doc.id);
                            }}
                            title="Delete from Library"
                            className="p-1 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Document Name */}
                      {editingDocId === doc.id ? (
                        <div
                          className="flex items-center gap-1 my-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded-lg focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRename(doc.id)}
                            className="p-1 bg-blue-600 text-white rounded-lg"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-xs font-bold text-stone-900 group-hover:text-blue-600 line-clamp-2 leading-snug">
                          {doc.name}
                        </h3>
                      )}

                      {/* File Path */}
                      <p className="text-[10px] text-stone-400 font-mono truncate mt-1">
                        {doc.path || 'Local sandbox document'}
                      </p>
                    </div>

                    {/* Progress Bar & Footer */}
                    <div className="mt-4 pt-2.5 border-t border-stone-100">
                      <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1 font-mono">
                        <span>Page {doc.lastPageRead || 1} of {doc.totalPages}</span>
                        <span>{progressPct}% read</span>
                      </div>
                      <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-stone-400 flex flex-col items-center gap-3">
              <PDFDocIcon size={48} className="opacity-70" />
              <div>
                <p className="text-sm font-semibold text-stone-700">No documents found</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Open a PDF from your computer or choose from the built-in sample library.
                </p>
              </div>
              <button
                onClick={onOpenFile}
                className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open PDF Document</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
