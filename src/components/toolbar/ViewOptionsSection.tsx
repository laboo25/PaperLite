import React from 'react';
import {
  Sidebar as SidebarIcon,
  RotateCw,
  Eye
} from 'lucide-react';
import { ReaderSettings } from '../../types';
import { PageNavModule } from './PageNavModule';
import { ZoomModule } from './ZoomModule';
import { LayoutModule } from './LayoutModule';
import { ThemeModule } from './ThemeModule';

interface ViewOptionsSectionProps {
  currentPage: number;
  totalPages: number;
  settings: ReaderSettings;
  onToggleSidebar: () => void;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotate: () => void;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
}

export const ViewOptionsSection: React.FC<ViewOptionsSectionProps> = ({
  currentPage,
  totalPages,
  settings,
  onToggleSidebar,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onRotate,
  onUpdateSettings
}) => {
  return (
    <div
      id="toolbar-view-options-group"
      className="flex items-center gap-1.5 shrink-0"
    >
      {/* 1. Sidebar Toggle Button */}
      <button
        type="button"
        id="tool-toggle-sidebar"
        onClick={onToggleSidebar}
        title={settings.showSidebar ? 'Hide Sidebar (Cmd+B)' : 'Show Sidebar (Cmd+B)'}
        aria-label="Toggle Sidebar"
        className={`h-7 px-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          settings.showSidebar
            ? 'bg-stone-200/90 text-stone-900 shadow-2xs'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
        }`}
      >
        <SidebarIcon className="w-3.5 h-3.5" />
      </button>

      {/* 2. Visual View Badge */}
      <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold tracking-wide uppercase select-none">
        <Eye className="w-3 h-3" />
        <span>View</span>
      </div>

      <div className="h-3.5 w-px bg-stone-200" />

      {/* 3. Page Navigation Module */}
      <PageNavModule
        currentPage={currentPage}
        totalPages={totalPages}
        isTwoPage={settings.viewMode === 'two-page'}
        onPageChange={onPageChange}
      />

      {/* 4. Zoom & Scale Module */}
      <ZoomModule
        settings={settings}
        onZoomChange={onZoomChange}
        onFitWidth={onFitWidth}
        onFitPage={onFitPage}
      />

      {/* 5. View Mode Layout Module */}
      <LayoutModule
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* 6. Rotate 90° Button */}
      <button
        type="button"
        id="tool-rotate-page"
        onClick={onRotate}
        title="Rotate Page 90° Clockwise (R)"
        aria-label="Rotate Page"
        className="h-7 px-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 transition-colors flex items-center justify-center cursor-pointer"
      >
        <RotateCw className="w-3.5 h-3.5" />
      </button>

      {/* 7. Theme Module */}
      <ThemeModule
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
