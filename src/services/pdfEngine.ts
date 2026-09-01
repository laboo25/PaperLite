import * as pdfjsLib from 'pdfjs-dist';
import { PDFOutlineItem, SearchMatch } from '../types';

// Setup PDF.js worker
if (typeof window !== 'undefined') {
  try {
    // Set standard reliable worker source from CDN or local bundle
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF Worker setup note:', e);
  }
}

export interface RenderPageOptions {
  canvas: HTMLCanvasElement;
  pageNumber: number;
  scale: number;
  rotation?: number;
  renderQuality?: 'normal' | 'high';
}

export interface PageDimension {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface CanvasRenderSession {
  task: any | null;
  renderPromise: Promise<void> | null;
  cancelRequested: boolean;
}

class PDFEngineInstance {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  private pageDimensions: Map<number, PageDimension> = new Map();
  private pageTextCache: Map<number, string> = new Map();
  // Tracks active render sessions per HTMLCanvasElement
  private canvasSessions: WeakMap<HTMLCanvasElement, CanvasRenderSession> = new WeakMap();

  async loadDocument(data: ArrayBuffer | Uint8Array | string): Promise<{
    numPages: number;
    fingerprint: string;
    title?: string;
  }> {
    // Cancel any previous renders
    this.cancelAllRenders();
    this.pageDimensions.clear();
    this.pageTextCache.clear();

    const loadingTask = pdfjsLib.getDocument(
      typeof data === 'string' ? { url: data } : { data }
    );

    this.pdfDocument = await loadingTask.promise;
    const numPages = this.pdfDocument.numPages;
    const fingerprint = this.pdfDocument.fingerprints?.[0] || 'doc-' + Date.now();

    // Cache page 1 dimensions as default
    try {
      const firstPage = await this.pdfDocument.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      this.pageDimensions.set(1, {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / viewport.height
      });
    } catch (err) {
      console.warn('Could not pre-fetch first page dimensions:', err);
    }

    let title: string | undefined;
    try {
      const meta = await this.pdfDocument.getMetadata();
      const info = meta?.info as any;
      if (info?.Title) {
        title = info.Title;
      }
    } catch {
      // Ignore metadata parsing error
    }

    return {
      numPages,
      fingerprint,
      title
    };
  }

  get totalPages(): number {
    return this.pdfDocument ? this.pdfDocument.numPages : 0;
  }

  async getPageDimension(pageNumber: number): Promise<PageDimension> {
    if (this.pageDimensions.has(pageNumber)) {
      return this.pageDimensions.get(pageNumber)!;
    }
    if (!this.pdfDocument) {
      return { width: 595, height: 842, aspectRatio: 595 / 842 };
    }

    const page = await this.pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const dim: PageDimension = {
      width: viewport.width,
      height: viewport.height,
      aspectRatio: viewport.width / viewport.height
    };
    this.pageDimensions.set(pageNumber, dim);
    return dim;
  }

  async renderPage({
    canvas,
    pageNumber,
    scale,
    rotation = 0,
    renderQuality = 'high'
  }: RenderPageOptions): Promise<void> {
    if (!this.pdfDocument) return;

    // 1. If there's an ongoing render session on this canvas, cancel it and wait for it to cleanly finish
    if (this.canvasSessions.has(canvas)) {
      const prevSession = this.canvasSessions.get(canvas)!;
      prevSession.cancelRequested = true;
      if (prevSession.task) {
        try {
          prevSession.task.cancel();
        } catch {
          // Ignored
        }
      }
      if (prevSession.renderPromise) {
        try {
          await prevSession.renderPromise;
        } catch {
          // Ignored
        }
      }
    }

    // 2. Register new render session on this canvas
    const currentSession: CanvasRenderSession = {
      task: null,
      renderPromise: null,
      cancelRequested: false
    };
    this.canvasSessions.set(canvas, currentSession);

    const renderOperation = async () => {
      if (currentSession.cancelRequested || !this.pdfDocument) return;

      const page = await this.pdfDocument.getPage(pageNumber);
      if (currentSession.cancelRequested) return;

      // Device Pixel Ratio scaling for crisp text on retina / HiDPI monitors
      const pixelRatio = renderQuality === 'high' ? (window.devicePixelRatio || 1) : 1;
      const finalScale = scale * pixelRatio;

      const viewport = page.getViewport({
        scale: finalScale,
        rotation: (page.rotate + rotation) % 360
      });

      const displayViewport = page.getViewport({
        scale: scale,
        rotation: (page.rotate + rotation) % 360
      });

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx || currentSession.cancelRequested) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${displayViewport.width}px`;
      canvas.style.height = `${displayViewport.height}px`;

      // Fill clean background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (currentSession.cancelRequested) return;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });
      currentSession.task = renderTask;

      try {
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !currentSession.cancelRequested) {
          console.warn(`Page ${pageNumber} render notice:`, err?.message || err);
        }
      }
    };

    currentSession.renderPromise = renderOperation();
    await currentSession.renderPromise;
  }

  /**
   * Cleans up canvas bitmap memory when a page leaves the viewport
   */
  cleanupPageCanvas(canvas: HTMLCanvasElement | null, _pageNumber: number) {
    if (!canvas) return;

    if (this.canvasSessions.has(canvas)) {
      const session = this.canvasSessions.get(canvas)!;
      session.cancelRequested = true;
      if (session.task) {
        try {
          session.task.cancel();
        } catch {
          // Ignored
        }
      }
    }
  }

  async getPageText(pageNumber: number): Promise<string> {
    if (this.pageTextCache.has(pageNumber)) {
      return this.pageTextCache.get(pageNumber)!;
    }
    if (!this.pdfDocument) return '';

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      this.pageTextCache.set(pageNumber, text);
      return text;
    } catch (err) {
      console.warn(`Error extracting text for page ${pageNumber}:`, err);
      return '';
    }
  }

  async searchDocument(query: string): Promise<SearchMatch[]> {
    if (!this.pdfDocument || !query.trim()) return [];
    const lowerQuery = query.toLowerCase().trim();
    const matches: SearchMatch[] = [];

    const numPages = this.pdfDocument.numPages;
    for (let p = 1; p <= numPages; p++) {
      const text = await this.getPageText(p);
      const lowerText = text.toLowerCase();

      let matchIndex = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        // Create context snippet around match
        const start = Math.max(0, pos - 35);
        const end = Math.min(text.length, pos + lowerQuery.length + 45);
        let snippet = text.slice(start, end).replace(/\s+/g, ' ');
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        matches.push({
          pageNumber: p,
          matchIndex: matchIndex++,
          totalMatchesOnPage: 0,
          snippet
        });

        pos += lowerQuery.length;
      }
    }

    return matches;
  }

  async getOutline(): Promise<PDFOutlineItem[]> {
    if (!this.pdfDocument) return [];
    try {
      const outline = await this.pdfDocument.getOutline();
      if (!outline || outline.length === 0) {
        return [];
      }

      const convertOutline = async (items: any[]): Promise<PDFOutlineItem[]> => {
        const result: PDFOutlineItem[] = [];
        for (const item of items) {
          let pageNumber = 1;
          if (item.dest) {
            try {
              let ref = item.dest;
              if (typeof ref === 'string') {
                ref = await this.pdfDocument!.getDestination(ref);
              }
              if (Array.isArray(ref) && ref[0]) {
                const pageIndex = await this.pdfDocument!.getPageIndex(ref[0]);
                pageNumber = pageIndex + 1;
              }
            } catch {
              // fallback page 1
            }
          }

          let subItems: PDFOutlineItem[] | undefined;
          if (item.items && item.items.length > 0) {
            subItems = await convertOutline(item.items);
          }

          result.push({
            title: item.title,
            pageNumber,
            dest: item.dest,
            items: subItems
          });
        }
        return result;
      };

      return await convertOutline(outline);
    } catch (err) {
      console.warn('Error reading outline:', err);
      return [];
    }
  }

  async renderThumbnail(pageNumber: number, maxDimension = 160): Promise<string> {
    if (!this.pdfDocument) return '';
    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(
        maxDimension / unscaledViewport.width,
        maxDimension / unscaledViewport.height
      );
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Clean up temp canvas
      canvas.width = 1;
      canvas.height = 1;

      return dataUrl;
    } catch (e) {
      console.warn('Thumbnail generation error:', e);
      return '';
    }
  }

  cancelAllRenders() {
    this.canvasSessions = new WeakMap();
  }

  destroy() {
    this.cancelAllRenders();
    if (this.pdfDocument) {
      try {
        this.pdfDocument.destroy();
      } catch {
        // Ignored
      }
      this.pdfDocument = null;
    }
    this.pageDimensions.clear();
    this.pageTextCache.clear();
  }
}

export const pdfEngine = new PDFEngineInstance();
