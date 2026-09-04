import React, { useState, useEffect, useRef } from 'react';
import {
  Square,
  Columns,
  ScrollText,
  Check,
  ChevronDown
} from 'lucide-react';
import { ViewMode, ReaderSettings } from '../../types';

interface LayoutModuleProps {
  settings: ReaderSettings;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
}

export const LayoutModule: React.FC<LayoutModuleProps> = ({
  settings,
  onUpdateSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const getViewModeIcon = () => {
    switch (settings.viewMode) {
      case 'single':
        return <Square className="w-3.5 h-3.5" />;
      case 'two-page':
        return <Columns className="w-3.5 h-3.5" />;
      default:
        return <ScrollText className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-layout-popover"
        onClick={() => setIsOpen(!isOpen)}
        title="Document Layout & View Mode"
        aria-label="View mode layout"
        className={`h-7 px-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
          isOpen
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
        }`}
      >
        {getViewModeIcon()}
        <ChevronDown
          className={`w-2.5 h-2.5 opacity-60 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          data-no-drag="true"
          data-popover="true"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-1.5 w-56 p-2 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 space-y-1 select-none"
        >
          <div className="px-2 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Document Layout
          </div>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ viewMode: 'continuous' });
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              settings.viewMode === 'continuous'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-stone-500" />
              <span>Continuous Scroll</span>
            </div>
            {settings.viewMode === 'continuous' && (
              <Check className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ viewMode: 'single' });
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              settings.viewMode === 'single'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Square className="w-4 h-4 text-stone-500" />
              <span>Single Page Focus</span>
            </div>
            {settings.viewMode === 'single' && (
              <Check className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ viewMode: 'two-page' });
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              settings.viewMode === 'two-page'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-stone-500" />
              <span>Two-Page Spread</span>
            </div>
            {settings.viewMode === 'two-page' && (
              <Check className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
