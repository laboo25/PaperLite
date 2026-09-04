import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown
} from 'lucide-react';

interface PageNavModuleProps {
  currentPage: number;
  totalPages: number;
  isTwoPage: boolean;
  onPageChange: (page: number) => void;
}

export const PageNavModule: React.FC<PageNavModuleProps> = ({
  currentPage,
  totalPages,
  isTwoPage,
  onPageChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLeft = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  const currentRight = currentLeft + 1;

  const [pageInput, setPageInput] = useState(
    isTwoPage
      ? currentRight <= totalPages
        ? `${currentLeft}-${currentRight}`
        : `${currentLeft}`
      : currentPage.toString()
  );

  useEffect(() => {
    if (isTwoPage) {
      const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
      const right = left + 1;
      setPageInput(right <= totalPages ? `${left}-${right}` : `${left}`);
    } else {
      setPageInput(currentPage.toString());
    }
  }, [currentPage, totalPages, isTwoPage]);

  // Click outside and Esc listener
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

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = pageInput.split('-')[0].trim();
    const p = parseInt(cleanInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
      setIsOpen(false);
    } else {
      if (isTwoPage) {
        const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
        const right = left + 1;
        setPageInput(right <= totalPages ? `${left}-${right}` : `${left}`);
      } else {
        setPageInput(currentPage.toString());
      }
    }
  };

  const isPrevDisabled = isTwoPage ? currentLeft <= 1 : currentPage <= 1;
  const isNextDisabled = isTwoPage
    ? currentRight >= totalPages || currentLeft >= totalPages
    : currentPage >= totalPages;

  const handlePrevPage = () => {
    if (isTwoPage) {
      onPageChange(Math.max(1, currentLeft - 2));
    } else {
      onPageChange(Math.max(1, currentPage - 1));
    }
  };

  const handleNextPage = () => {
    if (isTwoPage) {
      onPageChange(Math.min(totalPages, currentLeft + 2));
    } else {
      onPageChange(Math.min(totalPages, currentPage + 1));
    }
  };

  const progressPercent = Math.round((currentPage / (totalPages || 1)) * 100);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Group Pill */}
      <div className="flex items-center h-7 bg-stone-100/90 hover:bg-stone-100 border border-stone-200/90 rounded-lg p-0.5 transition-colors shadow-2xs">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={isPrevDisabled}
          title="Previous Page (Left Arrow)"
          aria-label="Previous Page"
          className="w-5.5 h-5.5 flex items-center justify-center rounded-md text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>

        <button
          type="button"
          id="btn-nav-popover"
          onClick={() => setIsOpen(!isOpen)}
          title="Click to jump to page or scrub"
          aria-label="Page navigation menu"
          className={`flex items-center gap-1 px-1.5 h-5.5 rounded-md text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isOpen
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-stone-800 hover:bg-white'
          }`}
        >
          <span>{pageInput}</span>
          <span className="text-stone-400 font-normal">/</span>
          <span className="text-stone-500 font-normal">{totalPages}</span>
          <ChevronDown
            className={`w-2.5 h-2.5 ml-0.5 opacity-60 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={handleNextPage}
          disabled={isNextDisabled}
          title="Next Page (Right Arrow)"
          aria-label="Next Page"
          className="w-5.5 h-5.5 flex items-center justify-center rounded-md text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Popover Card */}
      {isOpen && (
        <div
          data-no-drag="true"
          data-popover="true"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-1.5 w-72 p-3 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-800">Page Navigation</span>
            <span className="text-[11px] font-mono text-blue-600 font-semibold">
              {progressPercent}% read
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Jump Form */}
          <form onSubmit={handlePageSubmit} className="mt-3 flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder={`1-${totalPages}`}
              className="flex-1 h-7 text-center font-mono text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white text-stone-800"
              autoFocus
            />
            <button
              type="submit"
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Jump
            </button>
          </form>

          {/* Range Slider */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-stone-400">
              <span>Page 1</span>
              <span>Page {totalPages}</span>
            </div>
            <input
              type="range"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => onPageChange(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* First / Prev / Next / Last Buttons */}
          <div className="grid grid-cols-4 gap-1 mt-3 pt-2.5 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                onPageChange(1);
                setIsOpen(false);
              }}
              disabled={currentPage <= 1}
              className="flex flex-col items-center py-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-35 text-stone-700 transition-colors text-[10px] font-medium cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5 mb-0.5" />
              <span>First</span>
            </button>
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={isPrevDisabled}
              className="flex flex-col items-center py-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-35 text-stone-700 transition-colors text-[10px] font-medium cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 mb-0.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={isNextDisabled}
              className="flex flex-col items-center py-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-35 text-stone-700 transition-colors text-[10px] font-medium cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 mb-0.5" />
              <span>Next</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onPageChange(totalPages);
                setIsOpen(false);
              }}
              disabled={currentPage >= totalPages}
              className="flex flex-col items-center py-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-35 text-stone-700 transition-colors text-[10px] font-medium cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5 mb-0.5" />
              <span>Last</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
