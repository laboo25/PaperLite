import React from 'react';
import {
  FolderOpen,
  Plus,
  BookOpen,
  Clock,
  Star,
  HardDrive,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { PDFDocumentInfo } from '../types';
import { SAMPLE_DOCUMENTS } from '../data/samplePdfs';
import { PDFDocIcon } from './PDFDocIcon';

interface HomeViewProps {
  recentDocs: PDFDocumentInfo[];
  onOpenDoc: (doc: PDFDocumentInfo) => void;
  onOpenSample: (sampleId: string) => void;
  onOpenFile: () => void;
  onOpenLibrary: () => void;
  onScanDirectory: () => void;
  onToggleFavorite: (docId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  recentDocs,
  onOpenDoc,
  onOpenSample,
  onOpenFile,
  onOpenLibrary,
  onScanDirectory,
  onToggleFavorite
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatLastOpened = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-stone-50/60 p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Workspace Action Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shadow-2xs">
              <PDFDocIcon size={20} />
            </div>
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
              onClick={onOpenFile}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
              title="Open PDF file from computer (Cmd+O)"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </button>

            <button
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

        {/* Built-in Sample Documents (1-Click Read) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Quick Sample Documents
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {SAMPLE_DOCUMENTS.map((sample) => (
              <div
                key={sample.info.id}
                onClick={() => onOpenSample(sample.info.id)}
                className="group relative p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                    <PDFDocIcon size={20} />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                    {sample.info.totalPages} pages
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="text-xs font-bold text-stone-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {sample.info.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                    {sample.info.category || 'Sample Document'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Documents Table / Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-500" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Recent Documents ({recentDocs.length})
              </h2>
            </div>
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
              {recentDocs.slice(0, 8).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onOpenDoc(doc)}
                  className="group flex items-center justify-between p-3.5 hover:bg-stone-50/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors">
                      <PDFDocIcon size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-900 group-hover:text-blue-600 truncate transition-colors">
                          {doc.name}
                        </span>
                        {doc.isFavorite && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-stone-500 font-mono mt-0.5">
                        <span>{doc.totalPages} pages</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>Read to page {doc.lastPageRead || 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-[11px] text-stone-400">
                      {formatLastOpened(doc.lastOpened)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(doc.id);
                      }}
                      className="p-1 rounded-md text-stone-400 hover:text-amber-500 transition-colors"
                      title={doc.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          doc.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                        }`}
                      />
                    </button>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
