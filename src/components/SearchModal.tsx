import React, { useState, useEffect } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { SearchMatch } from '../types';
import { PDFDocIcon } from './PDFDocIcon';

interface SearchModalProps {
  isOpen: boolean;
  searchMatches: SearchMatch[];
  searchQuery: string;
  isSearching: boolean;
  onSearchQueryChange: (query: string) => void;
  onSelectMatch: (pageNumber: number) => void;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  searchMatches,
  searchQuery,
  isSearching,
  onSearchQueryChange,
  onSelectMatch,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchMatches]);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(searchMatches.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && searchMatches[selectedIndex]) {
      e.preventDefault();
      onSelectMatch(searchMatches[selectedIndex].pageNumber);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-black/[0.06] flex items-center gap-2.5 bg-stone-50/90">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search text in this document..."
            className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200/70 text-stone-500">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar space-y-1">
          {isSearching ? (
            <div className="py-10 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Scanning document pages...</span>
            </div>
          ) : searchMatches.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                <span>{searchMatches.length} Matches Found</span>
                <span className="text-stone-400">Use ↑ ↓ to navigate, Enter to jump</span>
              </div>
              {searchMatches.map((m, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectMatch(m.pageNumber);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-blue-50 text-blue-950 ring-1 ring-blue-500/30'
                        : 'text-stone-700 hover:bg-stone-100/70'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-blue-600 mb-0.5">
                        <PDFDocIcon size={13} />
                        <span>PAGE {m.pageNumber}</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-stone-800">
                        {m.snippet}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 mt-2" />
                  </div>
                );
              })}
            </div>
          ) : searchQuery.trim() ? (
            <div className="py-10 text-center text-xs text-stone-400">
              No matching occurrences found for "{searchQuery}".
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-stone-400">
              Type words to search within the entire document.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
