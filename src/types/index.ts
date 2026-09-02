export interface PDFDocumentInfo {
  id: string;
  name: string;
  path?: string;
  size: number;
  totalPages: number;
  lastOpened: number;
  lastPageRead: number;
  fingerprint: string;
  isFavorite?: boolean;
  category?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

export type ViewMode = 'single' | 'two-page' | 'continuous';

export type ReaderTheme = 'light' | 'sepia' | 'warm-paper' | 'dark-accent';

export type AnnotationTool = 'select' | 'highlight' | 'underline' | 'strike' | 'pen' | 'note' | 'eraser';

export interface HighlightColor {
  name: string;
  value: string;
  border: string;
  bgRgba: string;
}

export interface PDFAnnotation {
  id: string;
  pageNumber: number;
  type: 'highlight' | 'underline' | 'strike' | 'pen' | 'note';
  color: string;
  text?: string;
  comment?: string;
  createdAt: number;
  rects?: { x: number; y: number; width: number; height: number }[];
  drawingPoints?: { x: number; y: number }[];
  strokeWidth?: number;
  position?: { x: number; y: number };
}

export interface PDFBookmark {
  id: string;
  pageNumber: number;
  title: string;
  createdAt: number;
}

export interface PDFOutlineItem {
  title: string;
  pageNumber: number;
  dest?: any;
  items?: PDFOutlineItem[];
}

export interface PDFTabItem {
  id: string;
  doc: PDFDocumentInfo;
  data?: ArrayBuffer;
  currentPage: number;
  totalPages: number;
  fingerprint: string;
  thumbnails?: Map<number, string>;
  outline?: PDFOutlineItem[];
  bookmarks?: PDFBookmark[];
  annotations?: PDFAnnotation[];
  isDirty?: boolean;
}

export interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
  totalMatchesOnPage: number;
  snippet: string;
}

export interface ReaderSettings {
  theme: ReaderTheme;
  viewMode: ViewMode;
  fitMode: 'custom' | 'fit-width' | 'fit-page';
  zoom: number;
  rotation: number;
  showSidebar: boolean;
  sidebarTab: 'thumbnails' | 'outline' | 'bookmarks' | 'annotations' | 'search';
  smoothScrolling: boolean;
  renderQuality: 'normal' | 'high';
  autoSaveProgress: boolean;
}
