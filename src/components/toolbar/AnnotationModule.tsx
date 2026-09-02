import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer,
  Highlighter,
  PenTool,
  MessageSquare,
  Check,
  ChevronDown,
  Palette
} from 'lucide-react';
import { AnnotationTool } from '../../types';
import { HIGHLIGHT_COLORS } from '../AnnotationToolbar';

interface AnnotationModuleProps {
  activeTool: AnnotationTool;
  activeColor: string;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
}

export const AnnotationModule: React.FC<AnnotationModuleProps> = ({
  activeTool,
  activeColor,
  onToolChange,
  onColorChange
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

  const getToolIcon = () => {
    switch (activeTool) {
      case 'highlight':
        return <Highlighter className="w-3.5 h-3.5 text-amber-600" />;
      case 'pen':
        return <PenTool className="w-3.5 h-3.5 text-blue-600" />;
      case 'note':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <MousePointer className="w-3.5 h-3.5 text-stone-700" />;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-annotation-popover"
        onClick={() => setIsOpen(!isOpen)}
        title="Annotation Studio (Highlighter, Pen, Notes, Colors)"
        aria-label="Annotation tools"
        className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
            : 'bg-stone-50 border-stone-200/90 text-stone-800 hover:bg-stone-100'
        }`}
      >
        {getToolIcon()}
        <span className="hidden sm:inline text-xs font-medium capitalize">
          {activeTool === 'select' ? 'Select' : activeTool}
        </span>
        {/* Active Color Dot */}
        <div
          className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-2xs shrink-0"
          style={{ backgroundColor: activeColor }}
        />
        <ChevronDown
          className={`w-2.5 h-2.5 opacity-60 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-68 p-3 bg-white/98 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/90 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-800">Edit & Annotation Studio</span>
            <span className="text-[10px] text-stone-400 uppercase font-mono tracking-wider">
              (V, H, P, N)
            </span>
          </div>

          {/* Tools Selection Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => {
                onToolChange('select');
                setIsOpen(false);
              }}
              className={`flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-semibold'
                  : 'hover:bg-stone-100 text-stone-600'
              }`}
              title="Select & Pan (V)"
            >
              <MousePointer className="w-4 h-4 mb-1" />
              <span>Select</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToolChange('highlight');
                setIsOpen(false);
              }}
              className={`flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                activeTool === 'highlight'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs font-semibold'
                  : 'hover:bg-stone-100 text-stone-600'
              }`}
              title="Text Highlighter (H)"
            >
              <Highlighter className="w-4 h-4 mb-1 text-amber-600" />
              <span>Highlight</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToolChange('pen');
                setIsOpen(false);
              }}
              className={`flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-semibold'
                  : 'hover:bg-stone-100 text-stone-600'
              }`}
              title="Freehand Pen (P)"
            >
              <PenTool className="w-4 h-4 mb-1 text-blue-600" />
              <span>Pen</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToolChange('note');
                setIsOpen(false);
              }}
              className={`flex flex-col items-center py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                activeTool === 'note'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold'
                  : 'hover:bg-stone-100 text-stone-600'
              }`}
              title="Sticky Note (N)"
            >
              <MessageSquare className="w-4 h-4 mb-1 text-indigo-600" />
              <span>Note</span>
            </button>
          </div>

          {/* Color Swatches */}
          <div className="pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between text-[11px] font-medium text-stone-500 mb-2">
              <span>Palette Color</span>
              <Palette className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-center justify-between gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onColorChange(c.value)}
                  title={c.name}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-115 flex items-center justify-center cursor-pointer shadow-2xs"
                  style={{ backgroundColor: c.value, border: `1.5px solid ${c.border}` }}
                >
                  {activeColor === c.value && (
                    <Check className="w-3 h-3 text-stone-900 stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
