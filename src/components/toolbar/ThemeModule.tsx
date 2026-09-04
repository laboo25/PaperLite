import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Coffee,
  FileText,
  Moon,
  ChevronDown
} from 'lucide-react';
import { ReaderTheme, ReaderSettings } from '../../types';

interface ThemeModuleProps {
  settings: ReaderSettings;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
}

export const ThemeModule: React.FC<ThemeModuleProps> = ({
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

  const themes: { id: ReaderTheme; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'light', label: 'Light', desc: 'Standard crisp high-contrast mode', icon: <Sun className="w-3.5 h-3.5 text-amber-600" /> },
    { id: 'sepia', label: 'Sepia', desc: 'Warm tinted tone for eye comfort', icon: <Coffee className="w-3.5 h-3.5 text-amber-800" /> },
    { id: 'warm-paper', label: 'Paper', desc: 'Physical book reading ambiance', icon: <FileText className="w-3.5 h-3.5 text-stone-700" /> },
    { id: 'dark-accent', label: 'Dark', desc: 'Low-light luxury dark display', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> }
  ];

  const getCurrentThemeIcon = () => {
    switch (settings.theme) {
      case 'sepia':
        return <Coffee className="w-3.5 h-3.5 text-amber-800" />;
      case 'warm-paper':
        return <FileText className="w-3.5 h-3.5 text-stone-700" />;
      case 'dark-accent':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Sun className="w-3.5 h-3.5 text-amber-600" />;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-theme-popover"
        onClick={() => setIsOpen(!isOpen)}
        title="Reader Color & Display Atmosphere"
        aria-label="Reader Theme"
        className={`h-7 px-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
          isOpen
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
        }`}
      >
        {getCurrentThemeIcon()}
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
          className="absolute top-full left-0 mt-1.5 w-60 p-2.5 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/90 z-[100] animate-in fade-in zoom-in-95 duration-150 space-y-1 select-none"
        >
          <div className="px-2 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Reader Color Atmosphere
          </div>
          <div className="grid grid-cols-2 gap-1">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onUpdateSettings({ theme: t.id });
                  setIsOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  settings.theme === t.id
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                    : 'text-stone-700 hover:bg-stone-100 border border-transparent'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
