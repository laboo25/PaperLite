import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scan,
  Scaling,
  ChevronDown
} from 'lucide-react';
import { ReaderSettings } from '../../types';

interface ZoomModuleProps {
  settings: ReaderSettings;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
}

export const ZoomModule: React.FC<ZoomModuleProps> = ({
  settings,
  onZoomChange,
  onFitWidth,
  onFitPage
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

  const zoomPercent = Math.round(settings.zoom * 100);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-zoom-popover"
        onClick={() => setIsOpen(!isOpen)}
        title="Zoom & Viewport Scale (Cmd+=, Cmd+-, Cmd+0)"
        aria-label="Zoom controls"
        className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-mono font-medium transition-all cursor-pointer ${
          isOpen
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
        }`}
      >
        <Scaling className="w-3.5 h-3.5" />
        <span>{zoomPercent}%</span>
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
          className="absolute top-full left-0 mt-1.5 w-64 p-3 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-800">Zoom & Viewport</span>
            <span className="text-xs font-mono font-bold text-blue-600">{zoomPercent}%</span>
          </div>

          {/* Stepper Buttons & Slider */}
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.35, settings.zoom - 0.15))}
              className="w-8 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={35}
              max={300}
              step={5}
              value={zoomPercent}
              onChange={(e) => onZoomChange(parseInt(e.target.value, 10) / 100)}
              className="flex-1 accent-blue-600 cursor-pointer"
            />

            <button
              type="button"
              onClick={() => onZoomChange(Math.min(3.0, settings.zoom + 0.15))}
              className="w-8 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1 mt-2.5">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onZoomChange(preset);
                  setIsOpen(false);
                }}
                className={`py-1 rounded-md text-[10px] font-mono font-medium transition-colors cursor-pointer ${
                  Math.abs(settings.zoom - preset) < 0.05
                    ? 'bg-blue-50 text-blue-600 font-bold border border-blue-200'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600'
                }`}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
          </div>

          {/* Fit Width & Fit Page */}
          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                onFitWidth();
                setIsOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                settings.fitMode === 'fit-width'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Fit Width</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onFitPage();
                setIsOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                settings.fitMode === 'fit-page'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fit Page</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
