import { useState } from 'react';
import {
  Layers,
  ListTree,
  Bookmark as BookmarkIcon,
  Highlighter,
  Search as SearchIcon,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  Clock
} from 'lucide-react';
import {
  PDFAnnotation,
  PDFBookmark,
  PDFOutlineItem,
  ReaderSettings,
  SearchMatch
} from '../types';

interface SidebarProps {
  isOpen: boolean;
  currentPage: number;
  totalPages: number;
  thumbnails: Map<number, string>;
  outline: PDFOutlineItem[];
  bookmarks: PDFBookmark[];
  annotations: PDFAnnotation[];
  searchMatches: SearchMatch[];
  searchQuery: string;
  isSearching: boolean;
  activeTab: ReaderSettings['sidebarTab'];
  onTabChange: (tab: ReaderSettings['sidebarTab']) => void;
  onPageSelect: (pageNumber: number) => void;
  onSearchQueryChange: (query: string) => void;
  onDeleteBookmark: (pageNumber: number) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  currentPage,
  totalPages,
  thumbnails,
  outline,
  bookmarks,
  annotations,
  searchMatches,
  searchQuery,
  isSearching,
  activeTab,
  onTabChange,
  onPageSelect,
  onSearchQueryChange,
  onDeleteBookmark,
  onDeleteAnnotation,
  onClose
}) => {
  const [expandedOutlineNodes, setExpandedOutlineNodes] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleOutlineNode = (title: string) => {
    setExpandedOutlineNodes((prev) => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const renderOutlineTree = (items: PDFOutlineItem[], depth = 0) => {
    if (!items || items.length === 0) return null;

    return (
      <ul className="space-y-0.5">
        {items.map((item, idx) => {
          const hasChildren = item.items && item.items.length > 0;
          const isExpanded = expandedOutlineNodes[item.title] ?? true;
          const isCurrent = item.pageNumber === currentPage;

          return (
            <li key={`${item.title}-${idx}`}>
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-blue-500/10 text-blue-600 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                }`}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
                onClick={() => onPageSelect(item.pageNumber)}
              >
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOutlineNode(item.title);
                    }}
                    className="p-0.5 text-stone-400 hover:text-stone-600 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                ) : (
                  <span className="w-3" />
                )}
                <span className="truncate flex-1">{item.title}</span>
                <span className="text-[10px] text-stone-400 font-mono shrink-0 ml-1">
                  p.{item.pageNumber}
                </span>
              </div>
              {hasChildren && isExpanded && renderOutlineTree(item.items!, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside
      id="reader-sidebar"
      className="w-72 sm:w-80 h-full border-r border-black/[0.08] bg-[#FAF9F7]/95 backdrop-blur-md flex flex-col shrink-0 select-none z-20 transition-all duration-200"
    >
      {/* iOS Segmented Navigation Header */}
      <div className="p-3 border-b border-black/[0.06] flex items-center justify-between">
        <div className="flex items-center p-0.5 rounded-xl bg-stone-200/70 border border-stone-300/40 w-full max-w-[240px]">
          <button
            onClick={() => onTabChange('thumbnails')}
            title="Thumbnails"
            className={`flex-1 py-1 px-1 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
              activeTab === 'thumbnails'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTabChange('outline')}
            title="Table of Contents"
            className={`flex-1 py-1 px-1 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
              activeTab === 'outline'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTabChange('bookmarks')}
            title="Bookmarks"
            className={`flex-1 py-1 px-1 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
              activeTab === 'bookmarks'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTabChange('annotations')}
            title="Highlights & Notes"
            className={`flex-1 py-1 px-1 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
              activeTab === 'annotations'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTabChange('search')}
            title="Search"
            className={`flex-1 py-1 px-1 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
              activeTab === 'search'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <SearchIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors ml-1"
          title="Close Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Panels */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* TAB 1: THUMBNAILS */}
        {activeTab === 'thumbnails' && (
          <div className="grid grid-cols-2 gap-3 pb-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isSelected = pageNum === currentPage;
              const thumbUrl = thumbnails.get(pageNum);

              return (
                <div
                  key={pageNum}
                  onClick={() => onPageSelect(pageNum)}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-500/10 ring-2 ring-blue-500 shadow-xs'
                      : 'hover:bg-stone-200/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] bg-white rounded-lg border border-stone-200/80 shadow-xs overflow-hidden flex items-center justify-center relative">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Page ${pageNum}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-stone-300">
                        <FileText className="w-6 h-6 stroke-[1.2]" />
                        <span className="text-[10px] font-mono text-stone-400">Page {pageNum}</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-mono font-medium ${
                      isSelected ? 'text-blue-600 font-bold' : 'text-stone-500 group-hover:text-stone-800'
                    }`}
                  >
                    {pageNum}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: OUTLINE / TABLE OF CONTENTS */}
        {activeTab === 'outline' && (
          <div>
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
              Table of Contents
            </div>
            {outline.length > 0 ? (
              renderOutlineTree(outline)
            ) : (
              <div className="py-12 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
                <ListTree className="w-8 h-8 stroke-[1.2] text-stone-300" />
                <p>This document does not contain an embedded outline.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BOOKMARKS */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5 px-1 flex items-center justify-between">
              <span>Bookmarked Pages</span>
              <span className="font-mono text-stone-500">{bookmarks.length}</span>
            </div>

            {bookmarks.length > 0 ? (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => onPageSelect(bm.pageNumber)}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-amber-400/60 hover:shadow-xs cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookmarkIcon className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-stone-800 truncate">{bm.title}</div>
                      <div className="text-[10px] text-stone-400 flex items-center gap-1 font-mono">
                        <span>Page {bm.pageNumber}</span>
                        <span>•</span>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(bm.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBookmark(bm.pageNumber);
                    }}
                    title="Remove Bookmark"
                    className="p-1 rounded-md text-stone-300 group-hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
                <BookmarkIcon className="w-8 h-8 stroke-[1.2] text-stone-300" />
                <p>No bookmarks added yet.</p>
                <p className="text-[11px] text-stone-400">Click the bookmark icon in the title bar or press Cmd+D.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ANNOTATIONS & NOTES */}
        {activeTab === 'annotations' && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5 px-1 flex items-center justify-between">
              <span>Highlights & Markups</span>
              <span className="font-mono text-stone-500">{annotations.length}</span>
            </div>

            {annotations.length > 0 ? (
              annotations.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => onPageSelect(ann.pageNumber)}
                  className="group flex flex-col gap-1.5 p-2.5 rounded-xl bg-white border border-stone-200/70 hover:border-blue-400/60 hover:shadow-xs cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0 border border-black/10"
                        style={{ backgroundColor: ann.color }}
                      />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                        {ann.type} • Page {ann.pageNumber}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(ann.id);
                      }}
                      title="Delete Annotation"
                      className="p-1 rounded-md text-stone-300 group-hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {ann.text && (
                    <p className="text-xs text-stone-700 italic border-l-2 border-stone-300 pl-2 line-clamp-2">
                      "{ann.text}"
                    </p>
                  )}

                  {ann.comment && (
                    <p className="text-xs text-stone-900 bg-stone-50 p-1.5 rounded-lg border border-stone-200/50">
                      💬 {ann.comment}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
                <Highlighter className="w-8 h-8 stroke-[1.2] text-stone-300" />
                <p>No highlights or notes yet.</p>
                <p className="text-[11px] text-stone-400">Use the floating bottom toolbar to highlight or draw.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search across pages..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-stone-200/50 border border-stone-300/60 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                autoFocus
              />
              <SearchIcon className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  onClick={() => onSearchQueryChange('')}
                  className="p-0.5 text-stone-400 hover:text-stone-600 absolute right-2 top-2"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {isSearching ? (
              <div className="py-8 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Scanning document...</span>
              </div>
            ) : searchQuery.trim() ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Results</span>
                  <span className="font-mono text-stone-600 font-bold">{searchMatches.length} matches</span>
                </div>

                {searchMatches.length > 0 ? (
                  searchMatches.map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => onPageSelect(m.pageNumber)}
                      className="p-2 rounded-xl bg-white border border-stone-200/80 hover:border-blue-400 hover:shadow-xs cursor-pointer text-xs space-y-1 transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-blue-600 font-semibold">
                        <span>PAGE {m.pageNumber}</span>
                        <ChevronRight className="w-3 h-3 text-stone-400" />
                      </div>
                      <p className="text-stone-700 line-clamp-2 leading-relaxed">
                        {m.snippet}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No matching occurrences found.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-400">
                Type keywords to scan the entire PDF.
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
