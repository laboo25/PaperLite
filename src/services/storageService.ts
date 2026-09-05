import { PDFAnnotation, PDFBookmark, PDFDocumentInfo, ReaderSettings } from '../types';
import { SAMPLE_DOCUMENTS } from '../data/samplePdfs';
import { binaryStorage } from './binaryStorage';

const STORAGE_KEYS = {
  LIBRARY: 'paperlite_library_index_v1',
  OPEN_TABS: 'paperlite_open_tabs_v1',
  ACTIVE_TAB: 'paperlite_active_tab_v1',
  SETTINGS: 'paperlite_reader_settings_v1',
  ANNOTATIONS_PREFIX: 'paperlite_annotations_',
  BOOKMARKS_PREFIX: 'paperlite_bookmarks_',
  PROGRESS_PREFIX: 'paperlite_progress_'
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  viewMode: 'continuous',
  fitMode: 'fit-width',
  zoom: 1.0,
  rotation: 0,
  showSidebar: true,
  sidebarTab: 'thumbnails',
  smoothScrolling: true,
  renderQuality: 'high',
  autoSaveProgress: true,
  lowPowerMode: false,
  resourceBoundaryEnabled: true,
  autoPurgeCacheOnTabClose: true
};

export class StorageService {
  /**
   * Initializes library with sample documents on first load
   */
  getLibrary(): PDFDocumentInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LIBRARY);
      if (raw) {
        return JSON.parse(raw);
      }
      // Populate defaults from SAMPLE_DOCUMENTS
      const defaults = SAMPLE_DOCUMENTS.map((s) => s.info);
      this.saveLibrary(defaults);
      return defaults;
    } catch {
      return SAMPLE_DOCUMENTS.map((s) => s.info);
    }
  }

  saveLibrary(docs: PDFDocumentInfo[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(docs));
    } catch (e) {
      console.error('Failed to save library index:', e);
    }
  }

  addOrUpdateDocument(doc: PDFDocumentInfo): void {
    const library = this.getLibrary();
    const existingIndex = library.findIndex(
      (d) =>
        d.id === doc.id ||
        (doc.fingerprint && d.fingerprint === doc.fingerprint) ||
        (doc.name && d.name.toLowerCase() === doc.name.toLowerCase() && (d.size === doc.size || !doc.size || !d.size))
    );
    if (existingIndex >= 0) {
      const existing = library[existingIndex];
      // Keep stable ID if already established
      const resolvedId = existing.id || doc.id;
      library[existingIndex] = {
        ...existing,
        ...doc,
        id: resolvedId,
        lastOpened: Date.now(),
        lastPageRead: doc.lastPageRead || existing.lastPageRead || 1,
        totalPages: doc.totalPages || existing.totalPages || 1
      };
    } else {
      library.unshift({ ...doc, lastOpened: Date.now() });
    }
    this.saveLibrary(library);
  }

  removeDocument(docId: string): void {
    const doc = this.getLibrary().find((d) => d.id === docId);
    const library = this.getLibrary().filter((d) => d.id !== docId);
    this.saveLibrary(library);

    // Clean up persistent binary storage
    if (doc) {
      binaryStorage.delete(docId, doc.fingerprint, doc.name);
    } else {
      binaryStorage.delete(docId);
    }
  }

  toggleFavorite(docId: string): void {
    const library = this.getLibrary().map((d) => {
      if (d.id === docId) {
        return { ...d, isFavorite: !d.isFavorite };
      }
      return d;
    });
    this.saveLibrary(library);
  }

  renameDocument(docId: string, newName: string): void {
    let oldName = '';
    const library = this.getLibrary().map((d) => {
      if (d.id === docId) {
        oldName = d.name;
        return { ...d, name: newName };
      }
      return d;
    });
    this.saveLibrary(library);

    // Update binary storage alias
    if (oldName) {
      binaryStorage.updateDocumentName(docId, oldName, newName);
    }
  }

  /**
   * Persists binary PDF data in persistent multi-tier storage.
   * If `hasLocalPath` is true, data is kept ONLY in memory and NOT written to disk/AppData.
   */
  async saveDocumentData(
    docId: string,
    fingerprint: string,
    data: ArrayBuffer,
    fileName?: string,
    options?: { hasLocalPath?: boolean; isTemporary?: boolean }
  ): Promise<void> {
    await binaryStorage.save(docId, fingerprint, data, fileName, options);
  }

  /**
   * Retrieves binary PDF data from storage
   */
  async getDocumentData(
    docId?: string | null,
    fingerprint?: string | null,
    fileName?: string | null
  ): Promise<ArrayBuffer | null> {
    return await binaryStorage.get(docId, fingerprint, fileName);
  }

  /**
   * Deletes document binary from storage
   */
  async deleteDocumentData(
    docId: string,
    fingerprint?: string,
    fileName?: string
  ): Promise<void> {
    await binaryStorage.delete(docId, fingerprint, fileName);
  }

  /**
   * Purges orphaned temporary binaries that no longer belong to open tabs or saved documents
   */
  async purgeOrphanedTemporaryData(activeDocIds: string[]): Promise<number> {
    return await binaryStorage.purgeOrphanedTemporaryBlobs(activeDocIds);
  }

  /**
   * Wipes all cached binary blobs from storage
   */
  async clearAllCachedBinaries(): Promise<void> {
    await binaryStorage.clearAllTemporaryCache();
  }

  /**
   * Returns current storage consumption in AppData / IndexedDB
   */
  async getStorageStats(): Promise<{ totalBytes: number; docCount: number }> {
    return await binaryStorage.getStorageUsage();
  }

  getOpenTabs(): PDFDocumentInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OPEN_TABS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse open tabs:', e);
    }
    return [];
  }

  saveOpenTabs(tabs: PDFDocumentInfo[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OPEN_TABS, JSON.stringify(tabs));
    } catch (e) {
      console.error('Failed to save open tabs:', e);
    }
  }

  getActiveTabId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    } catch {
      return null;
    }
  }

  saveActiveTabId(tabId: string | null): void {
    try {
      if (tabId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
      }
    } catch (e) {
      console.error('Failed to save active tab id:', e);
    }
  }

  getSettings(): ReaderSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: Partial<ReaderSettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  getAnnotations(docFingerprint: string): PDFAnnotation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ANNOTATIONS_PREFIX + docFingerprint);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading annotations:', e);
    }
    return [];
  }

  saveAnnotations(docFingerprint: string, annotations: PDFAnnotation[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ANNOTATIONS_PREFIX + docFingerprint, JSON.stringify(annotations));
    } catch (e) {
      console.error('Error saving annotations:', e);
    }
  }

  addAnnotation(docFingerprint: string, annotation: PDFAnnotation): void {
    const list = this.getAnnotations(docFingerprint);
    list.push(annotation);
    this.saveAnnotations(docFingerprint, list);
  }

  deleteAnnotation(docFingerprint: string, annotationId: string): void {
    const list = this.getAnnotations(docFingerprint).filter((a) => a.id !== annotationId);
    this.saveAnnotations(docFingerprint, list);
  }

  getBookmarks(docFingerprint: string): PDFBookmark[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS_PREFIX + docFingerprint);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading bookmarks:', e);
    }
    return [];
  }

  saveBookmarks(docFingerprint: string, bookmarks: PDFBookmark[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS_PREFIX + docFingerprint, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Error saving bookmarks:', e);
    }
  }

  toggleBookmark(docFingerprint: string, pageNumber: number, title?: string): boolean {
    const bookmarks = this.getBookmarks(docFingerprint);
    const existingIndex = bookmarks.findIndex((b) => b.pageNumber === pageNumber);
    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1);
      this.saveBookmarks(docFingerprint, bookmarks);
      return false; // unbookmarked
    } else {
      bookmarks.push({
        id: 'bm-' + Date.now(),
        pageNumber,
        title: title || `Page ${pageNumber}`,
        createdAt: Date.now()
      });
      bookmarks.sort((a, b) => a.pageNumber - b.pageNumber);
      this.saveBookmarks(docFingerprint, bookmarks);
      return true; // bookmarked
    }
  }

  getLastReadPage(docFingerprint: string): number {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.PROGRESS_PREFIX + docFingerprint);
      return val ? parseInt(val, 10) : 1;
    } catch {
      return 1;
    }
  }

  saveLastReadPage(docFingerprint: string, pageNumber: number): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS_PREFIX + docFingerprint, pageNumber.toString());
      // Also update in library item if found
      const library = this.getLibrary();
      const item = library.find((d) => d.fingerprint === docFingerprint);
      if (item) {
        item.lastPageRead = pageNumber;
        item.lastOpened = Date.now();
        this.saveLibrary(library);
      }
    } catch (e) {
      console.error('Error saving progress:', e);
    }
  }
}

export const storageService = new StorageService();
