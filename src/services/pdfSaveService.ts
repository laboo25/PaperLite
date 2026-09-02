import { PDFAnnotation, PDFBookmark, PDFDocumentInfo } from '../types';
import { storageService } from './storageService';
import { tauriBridge } from './tauriBridge';

export interface SaveResult {
  success: boolean;
  timestamp: number;
  message: string;
  filePath?: string;
}

export class PDFSaveService {
  private dirtyDocuments: Set<string> = new Set();
  private saveListeners: Set<(fingerprint: string, isDirty: boolean) => void> = new Set();

  /**
   * Checks if a document has unsaved edits
   */
  isDirty(fingerprint: string): boolean {
    return this.dirtyDocuments.has(fingerprint);
  }

  /**
   * Marks a document as having unsaved modifications (e.g. highlight, pen, note added/deleted)
   */
  markDirty(fingerprint: string): void {
    if (!this.dirtyDocuments.has(fingerprint)) {
      this.dirtyDocuments.add(fingerprint);
      this.notifyListeners(fingerprint, true);
    }
  }

  /**
   * Marks a document as clean/saved
   */
  markClean(fingerprint: string): void {
    if (this.dirtyDocuments.has(fingerprint)) {
      this.dirtyDocuments.delete(fingerprint);
      this.notifyListeners(fingerprint, false);
    }
  }

  /**
   * Subscribe to dirty state changes
   */
  subscribe(listener: (fingerprint: string, isDirty: boolean) => void): () => void {
    this.saveListeners.add(listener);
    return () => {
      this.saveListeners.delete(listener);
    };
  }

  private notifyListeners(fingerprint: string, isDirty: boolean) {
    this.saveListeners.forEach((listener) => {
      try {
        listener(fingerprint, isDirty);
      } catch (e) {
        console.error('Error in saveListener:', e);
      }
    });
  }

  /**
   * Saves annotations, bookmarks, and document metadata to local storage & cache
   */
  async saveDocument(
    doc: PDFDocumentInfo,
    annotations: PDFAnnotation[],
    bookmarks: PDFBookmark[]
  ): Promise<SaveResult> {
    try {
      // 1. Save annotations & bookmarks
      storageService.saveAnnotations(doc.fingerprint, annotations);
      storageService.saveBookmarks(doc.fingerprint, bookmarks);

      // 2. Update document entry in library
      storageService.addOrUpdateDocument({
        ...doc,
        lastOpened: Date.now()
      });

      // 3. Mark clean
      this.markClean(doc.fingerprint);

      return {
        success: true,
        timestamp: Date.now(),
        message: `Saved all edits (${annotations.length} annotations) for ${doc.name}`
      };
    } catch (err: any) {
      console.error('Save document error:', err);
      return {
        success: false,
        timestamp: Date.now(),
        message: err?.message || 'Failed to save document modifications'
      };
    }
  }

  /**
   * Exports annotated data package / triggers download for web and disk write for desktop
   */
  async exportAnnotatedData(
    doc: PDFDocumentInfo,
    annotations: PDFAnnotation[],
    bookmarks: PDFBookmark[]
  ): Promise<SaveResult> {
    try {
      const exportPayload = {
        documentName: doc.name,
        fingerprint: doc.fingerprint,
        exportedAt: new Date().toISOString(),
        totalPages: doc.totalPages,
        annotationsCount: annotations.length,
        bookmarksCount: bookmarks.length,
        annotations,
        bookmarks
      };

      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name.replace(/\.pdf$/i, '')}_annotations.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.markClean(doc.fingerprint);

      return {
        success: true,
        timestamp: Date.now(),
        message: `Exported annotations for ${doc.name}`
      };
    } catch (err: any) {
      return {
        success: false,
        timestamp: Date.now(),
        message: 'Export failed: ' + (err?.message || 'Unknown error')
      };
    }
  }
}

export const pdfSaveService = new PDFSaveService();
