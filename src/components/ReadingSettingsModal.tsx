import { X, Check, Eye, Cpu, ShieldCheck, Keyboard } from 'lucide-react';
import { ReaderSettings, ReaderTheme, ViewMode } from '../types';
import { PDFDocIcon } from './PDFDocIcon';

interface ReadingSettingsModalProps {
  isOpen: boolean;
  settings: ReaderSettings;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
  onClose: () => void;
}

export const ReadingSettingsModal: React.FC<ReadingSettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose
}) => {
  if (!isOpen) return null;

  const themes: { id: ReaderTheme; title: string; desc: string; bg: string; border: string; text: string }[] = [
    {
      id: 'light',
      title: 'Studio Light',
      desc: 'Clean, crisp neutral daylight background',
      bg: '#F4F4F6',
      border: '#E4E4E7',
      text: '#18181B'
    },
    {
      id: 'sepia',
      title: 'Warm Sepia',
      desc: 'Soft 2800K amber tint for reduced eye strain',
      bg: '#F2E8D5',
      border: '#D8C6A5',
      text: '#442B15'
    },
    {
      id: 'warm-paper',
      title: 'Natural Paper',
      desc: 'Book pulp texture with 92% balanced reflectance',
      bg: '#EAE6DF',
      border: '#D0C9BE',
      text: '#292524'
    },
    {
      id: 'dark-accent',
      title: 'Midnight Dark',
      desc: 'Deep OLED charcoal background for low light',
      bg: '#1C1C1E',
      border: '#3A3A3C',
      text: '#F2F2F7'
    }
  ];

  const viewModes: { id: ViewMode; title: string; desc: string }[] = [
    { id: 'continuous', title: 'Continuous Scroll', desc: 'Seamless vertical page feed' },
    { id: 'single', title: 'Single Page', desc: 'Distraction-free focused presentation' },
    { id: 'two-page', title: 'Two-Page Spread', desc: 'Book reading layout with side-by-side pages' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-black/[0.06] flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-stone-900">Reader Preferences & Performance</h2>
              <p className="text-[11px] text-stone-500">
                Tailor typography, color temperature, and hardware acceleration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 max-h-[70vh] custom-scrollbar">
          {/* Section 1: Color Themes */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 block">
              Paper & Reading Backgrounds
            </label>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => onUpdateSettings({ theme: t.id })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                    style={{ backgroundColor: t.bg }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                      style={{ borderColor: t.border, backgroundColor: isSelected ? '#2563EB' : 'transparent' }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: t.text }}>
                        {t.title}
                      </h4>
                      <p className="text-[10px] mt-0.5 opacity-80" style={{ color: t.text }}>
                        {t.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: View Modes */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 block">
              Page Layout Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {viewModes.map((vm) => (
                <div
                  key={vm.id}
                  onClick={() => onUpdateSettings({ viewMode: vm.id })}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    settings.viewMode === vm.id
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                      : 'border-stone-200 hover:border-stone-400 bg-stone-50/40'
                  }`}
                >
                  <h5 className="text-xs font-bold text-stone-900">{vm.title}</h5>
                  <p className="text-[10px] text-stone-500 mt-1">{vm.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Hardware Acceleration & Rendering */}
          <div className="p-3.5 rounded-xl bg-stone-100/70 border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Memory Virtualization & Canvas Recycling</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-stone-800">High-DPI Retina Rendering</span>
                <p className="text-[11px] text-stone-500">
                  Renders vector fonts and diagrams at 2x/3x native device pixel density.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({
                    renderQuality: settings.renderQuality === 'high' ? 'normal' : 'high'
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.renderQuality === 'high' ? 'bg-blue-600' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.renderQuality === 'high' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-stone-200/60 text-[11px] text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero-Leak Viewport Active: Scrolled-out pages purge canvas VRAM memory dynamically.</span>
            </div>
          </div>

          {/* Section 4: Windows Default PDF Reader & File Association */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <PDFDocIcon size={18} />
                <span>Windows Default PDF Reader Integration</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                Active (.pdf)
              </span>
            </div>

            <div className="text-[11px] text-blue-950 space-y-1.5 leading-relaxed">
              <p>
                <strong>MIME Type:</strong> <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">application/pdf</code> &nbsp;|&nbsp; <strong>Extension:</strong> <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">.pdf</code>
              </p>
              <p>
                <strong>Custom Icons:</strong> Application uses <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">icon.ico</code> and PDF document files display with custom <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">pdf-icon.ico</code> in Windows File Explorer.
              </p>
              <p className="text-blue-800">
                <strong>To set as default on Windows:</strong> Right-click any PDF file → <em>Open with</em> → <em>Choose another app</em> → Select <em>PaperLite PDF Reader</em> → Check <em>Always use this app to open .pdf files</em>.
              </p>
            </div>
          </div>

          {/* Section 5: Keyboard Shortcuts */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                <span className="text-stone-600">Next / Previous Page</span>
                <span className="font-mono text-stone-800 font-bold">Right / Left</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                <span className="text-stone-600">Zoom In / Zoom Out</span>
                <span className="font-mono text-stone-800 font-bold">Cmd + / Cmd -</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                <span className="text-stone-600">Toggle Navigation Sidebar</span>
                <span className="font-mono text-stone-800 font-bold">Cmd + B</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                <span className="text-stone-600">Bookmark Current Page</span>
                <span className="font-mono text-stone-800 font-bold">Cmd + D</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/[0.06] bg-stone-50/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
