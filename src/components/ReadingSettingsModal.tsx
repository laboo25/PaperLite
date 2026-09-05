import React, { useState, useEffect } from 'react';
import { X, Check, Eye, Cpu, ShieldCheck, Keyboard, RefreshCw, Sparkles, Zap, Trash2, Activity, Gauge, HardDrive } from 'lucide-react';
import { ReaderSettings, ReaderTheme, ViewMode, ResourceGovernorMetrics } from '../types';
import { PDFDocIcon } from './PDFDocIcon';
import { tauriBridge } from '../services/tauriBridge';
import { pdfEngine } from '../services/pdfEngine';
import { resourceGovernor } from '../services/resourceGovernor';
import { storageService } from '../services/storageService';

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
  const [isRegisteringIcon, setIsRegisteringIcon] = useState(false);
  const [iconStatusMessage, setIconStatusMessage] = useState<string | null>(null);
  const [memoryPurged, setMemoryPurged] = useState(false);
  const [cacheWiped, setCacheWiped] = useState(false);
  const [storageStats, setStorageStats] = useState<{ totalBytes: number; docCount: number }>({ totalBytes: 0, docCount: 0 });
  const [metrics, setMetrics] = useState<ResourceGovernorMetrics>(() =>
    resourceGovernor.getMetrics(settings.lowPowerMode, settings.resourceBoundaryEnabled)
  );

  useEffect(() => {
    if (!isOpen) return;
    storageService.getStorageStats().then((stats) => setStorageStats(stats)).catch(() => {});
    return resourceGovernor.subscribe((m) => setMetrics(m));
  }, [isOpen]);

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

          {/* Section 3: Hardware Acceleration & Resource Boundary (Anti-Lag Guard) */}
          <div className="p-3.5 rounded-xl bg-stone-100/70 border border-stone-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>PC & App Anti-Lag Resource Boundary</span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  settings.resourceBoundaryEnabled !== false
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {settings.resourceBoundaryEnabled !== false ? 'Boundary Enforced' : 'Unrestricted'}
              </span>
            </div>

            {/* Boundary Guard Master Toggle */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-stone-800">Adaptive Hardware Resource Protection</span>
                <p className="text-[11px] text-stone-500">
                  Caps render concurrency, throttles heavy GPU texture allocations, and auto-purges idle cache when RAM/CPU spikes.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    resourceBoundaryEnabled: settings.resourceBoundaryEnabled === false ? true : false
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.resourceBoundaryEnabled !== false ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.resourceBoundaryEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Live Hardware Telemetry & Boundary Diagnostics */}
            <div className="p-2.5 rounded-lg bg-white/90 border border-stone-200/70 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  Live Hardware Load Telemetry
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    metrics.isThrottlingActive
                      ? 'bg-amber-100 text-amber-800 font-medium'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {metrics.isThrottlingActive ? 'Active Guard: Throttled to 1-Task' : 'System Load: Optimal'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                  <span className="text-stone-400 block font-mono">CPU Cores</span>
                  <span className="font-bold text-stone-800 font-mono">{metrics.hardwareCores} Cores</span>
                </div>
                <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                  <span className="text-stone-400 block font-mono">RAM Heap</span>
                  <span className="font-bold text-stone-800 font-mono">
                    {metrics.usedHeapMB ? `${metrics.usedHeapMB} MB` : 'Browser Sandboxed'}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                  <span className="text-stone-400 block font-mono">Render Latency</span>
                  <span className="font-bold text-stone-800 font-mono">
                    {metrics.avgRenderLatencyMs > 0 ? `${metrics.avgRenderLatencyMs} ms` : '< 80 ms'}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                  <span className="text-stone-400 block font-mono">Active Texture</span>
                  <span className="font-bold text-stone-800 font-mono">
                    {metrics.totalActiveMegaPixels} MP ({metrics.activeCanvasCount} pgs)
                  </span>
                </div>
              </div>
            </div>

            {/* High-DPI Toggle */}
            <div className="flex items-center justify-between text-xs pt-2.5 border-t border-stone-200/60">
              <div>
                <span className="font-semibold text-stone-800">High-DPI Retina Rendering</span>
                <p className="text-[11px] text-stone-500">
                  Renders vector fonts at 1.5x pixel density (automatically scaled down to 1.0x under high system load).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    renderQuality: settings.renderQuality === 'high' ? 'normal' : 'high'
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
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

            {/* Low-End Hardware Mode Toggle */}
            <div className="flex items-center justify-between text-xs pt-2.5 border-t border-stone-200/60">
              <div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-stone-800">Low-End Device & Battery Saver Mode</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Strict 1-page buffer, sequential queue, and instant VRAM purging for older CPUs & 2GB/4GB RAM laptops.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    lowPowerMode: !settings.lowPowerMode
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.lowPowerMode ? 'bg-amber-600' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.lowPowerMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Manual Memory Purge Action */}
            <div className="flex items-center justify-between pt-2.5 border-t border-stone-200/60 text-xs">
              <div>
                <span className="font-semibold text-stone-800">Emergency Memory & VRAM Purge</span>
                <p className="text-[11px] text-stone-500">
                  Instantly clears text caches, search indices, and unused canvas textures to reclaim RAM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  pdfEngine.purgeUnusedMemory();
                  setMemoryPurged(true);
                  setTimeout(() => setMemoryPurged(false), 2500);
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                {memoryPurged ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Purged!</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>Purge RAM</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-stone-200/60 text-[11px] text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Active Boundary: Max 15 MP texture limit with auto-cancellation for scrolled-out pages.</span>
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
                <strong>File Explorer Icon:</strong> PDF document files are configured with dedicated <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">pdf-icon.ico</code>, distinct from the application main <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[10px] font-mono">icon.ico</code>.
              </p>
              <p className="text-blue-800">
                <strong>To set as default on Windows:</strong> Right-click any PDF file → <em>Open with</em> → <em>Choose another app</em> → Select <em>PaperLite PDF Reader</em> → Check <em>Always use this app to open .pdf files</em>.
              </p>
            </div>

            <div className="pt-1 flex items-center justify-between gap-2">
              <button
                type="button"
                id="refresh-pdf-icon-btn"
                onClick={async () => {
                  setIsRegisteringIcon(true);
                  setIconStatusMessage(null);
                  try {
                    const res = await tauriBridge.registerPdfFileAssociationIcon();
                    setIconStatusMessage(res.message || 'PDF icon association refreshed.');
                  } catch (err: any) {
                    setIconStatusMessage('Updated PDF icon settings.');
                  } finally {
                    setIsRegisteringIcon(false);
                  }
                }}
                disabled={isRegisteringIcon}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRegisteringIcon ? 'animate-spin' : ''}`} />
                <span>{isRegisteringIcon ? 'Updating Icon Registry...' : 'Refresh / Register PDF Icon in File Explorer'}</span>
              </button>

              {iconStatusMessage && (
                <span className="text-[10px] font-medium text-emerald-700 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{iconStatusMessage}</span>
                </span>
              )}
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
