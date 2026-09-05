import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore Vite asset URL query import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFOutlineItem, SearchMatch } from '../types';
import { resourceGovernor } from './resourceGovernor';

// Setup PDF.js worker using same-origin bundled local asset
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
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
  lowPowerMode?: boolean;
  resourceBoundaryEnabled?: boolean;
}

export interface PageDimension {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface PageTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface CanvasRenderSession {
  task: any | null;
  renderPromise: Promise<void> | null;
  cancelRequested: boolean;
}

export interface PDFDocumentSession {
  id: string;
  fingerprint: string;
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageDimensions: Map<number, PageDimension>;
  pageTextCache: Map<number, string>;
  pageItemsCache: Map<number, PageTextItem[]>;
  textContentCache: Map<number, any>;
  numPages: number;
  title?: string;
  outline?: PDFOutlineItem[];
  lastAccessed: number;
}

class PDFEngineInstance {
  private sessions: Map<string, PDFDocumentSession> = new Map();
  private activeSessionId: string | null = null;
  private maxSessions: number = 10;
  // Tracks active render sessions per HTMLCanvasElement
  private canvasSessions: WeakMap<HTMLCanvasElement, CanvasRenderSession> = new WeakMap();
  private canvasRegistrationIds: WeakMap<HTMLCanvasElement, string> = new WeakMap();

  // Resource Boundary Render Queue
  private activeRenderCount: number = 0;
  private renderQueue: {
    canvas: HTMLCanvasElement;
    pageNumber: number;
    execute: () => Promise<void>;
    cancel: () => void;
    isCancelled: boolean;
  }[] = [];

  constructor() {
    resourceGovernor.registerEmergencyPurgeHandler(() => {
      this.purgeUnusedMemory();
    });
  }

  private processRenderQueue(lowPowerMode?: boolean, boundaryEnabled?: boolean) {
    const maxConcurrency = resourceGovernor.getMaxConcurrency(lowPowerMode, boundaryEnabled !== false);
    while (this.activeRenderCount < maxConcurrency && this.renderQueue.length > 0) {
      const nextItem = this.renderQueue.shift();
      if (!nextItem) break;
      if (nextItem.isCancelled) continue;

      this.activeRenderCount++;
      nextItem
        .execute()
        .catch((e) => console.warn('Queued render error:', e))
        .finally(() => {
          this.activeRenderCount = Math.max(0, this.activeRenderCount - 1);
          this.processRenderQueue(lowPowerMode, boundaryEnabled);
        });
    }
  }

  private get activeSession(): PDFDocumentSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  get pdfDocument(): pdfjsLib.PDFDocumentProxy | null {
    return this.activeSession?.pdfDocument || null;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  hasDocument(sessionId: string, fingerprint?: string): boolean {
    if (this.sessions.has(sessionId)) return true;
    if (fingerprint) {
      for (const sess of this.sessions.values()) {
        if (sess.fingerprint === fingerprint) return true;
      }
    }
    return false;
  }

  switchDocument(sessionId: string, fingerprint?: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      this.sessions.get(sessionId)!.lastAccessed = Date.now();
      return true;
    }

    if (fingerprint) {
      for (const [sId, sess] of this.sessions.entries()) {
        if (sess.fingerprint === fingerprint) {
          sess.lastAccessed = Date.now();
          this.sessions.set(sessionId, sess);
          this.activeSessionId = sessionId;
          return true;
        }
      }
    }

    return false;
  }

  async loadDocument(
    data: ArrayBuffer | Uint8Array | string,
    sessionId?: string,
    fingerprintHint?: string
  ): Promise<{
    numPages: number;
    fingerprint: string;
    title?: string;
    fromCache?: boolean;
  }> {
    // 1. If this exact session ID is already loaded in memory
    if (sessionId && this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      existing.lastAccessed = Date.now();
      this.activeSessionId = sessionId;
      return {
        numPages: existing.numPages,
        fingerprint: existing.fingerprint,
        title: existing.title,
        fromCache: true
      };
    }

    // 2. If fingerprint matches an existing parsed session, reuse it
    if (fingerprintHint) {
      for (const [sId, sess] of this.sessions.entries()) {
        if (sess.fingerprint === fingerprintHint) {
          sess.lastAccessed = Date.now();
          if (sessionId && !this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, sess);
          }
          this.activeSessionId = sessionId || sId;
          return {
            numPages: sess.numPages,
            fingerprint: sess.fingerprint,
            title: sess.title,
            fromCache: true
          };
        }
      }
    }

    // 3. Evict oldest session if we have reached max capacity (memory protection)
    if (this.sessions.size >= this.maxSessions) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, sess] of this.sessions.entries()) {
        if (sess.lastAccessed < oldestTime && key !== this.activeSessionId) {
          oldestTime = sess.lastAccessed;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.unloadDocument(oldestKey);
      }
    }

    // 4. Parse document with PDF.js
    let docParams: any;
    if (typeof data === 'string') {
      docParams = {
        url: data,
        cMapPacked: true,
        disableAutoFetch: false,
        disableStream: false
      };
    } else {
      let uint8: Uint8Array;
      if (data instanceof Uint8Array) {
        uint8 = data;
      } else if (data instanceof ArrayBuffer) {
        uint8 = new Uint8Array(data);
      } else {
        uint8 = new Uint8Array(data);
      }
      docParams = {
        data: uint8,
        cMapPacked: true,
        disableAutoFetch: false,
        disableStream: false,
        isEvalSupported: false
      };
    }

    const loadingTask = pdfjsLib.getDocument(docParams);
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    const fingerprint = pdfDocument.fingerprints?.[0] || fingerprintHint || ('doc-' + Date.now());

    // Dynamically throttle maximum concurrent sessions if document has large page count
    if (numPages > 80) {
      this.maxSessions = 3;
    } else {
      this.maxSessions = 10;
    }

    let title: string | undefined;
    try {
      const meta = await pdfDocument.getMetadata();
      const info = meta?.info as any;
      if (info?.Title) {
        title = info.Title;
      }
    } catch {
      // Ignore metadata parsing error
    }

    const targetSessionId = sessionId || fingerprint;
    const newSession: PDFDocumentSession = {
      id: targetSessionId,
      fingerprint,
      pdfDocument,
      pageDimensions: new Map(),
      pageTextCache: new Map(),
      pageItemsCache: new Map(),
      textContentCache: new Map(),
      numPages,
      title,
      lastAccessed: Date.now()
    };

    // Pre-cache page 1 dimensions as default
    try {
      const firstPage = await pdfDocument.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      newSession.pageDimensions.set(1, {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / viewport.height
      });
    } catch (err) {
      console.warn('Could not pre-fetch first page dimensions:', err);
    }

    this.sessions.set(targetSessionId, newSession);
    this.activeSessionId = targetSessionId;

    return {
      numPages,
      fingerprint,
      title,
      fromCache: false
    };
  }

  unloadDocument(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Check if any other session points to the same PDFDocumentProxy
    let sharedCount = 0;
    for (const s of this.sessions.values()) {
      if (s.pdfDocument === session.pdfDocument) {
        sharedCount++;
      }
    }

    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    // Only destroy the underlying PDFDocumentProxy if no other session shares it
    if (sharedCount <= 1) {
      try {
        session.pdfDocument.destroy();
      } catch (e) {
        console.warn('Session pdfDocument destroy notice:', e);
      }
      session.pageDimensions.clear();
      session.pageTextCache.clear();
      session.pageItemsCache.clear();
      session.textContentCache.clear();
    }
  }

  get totalPages(): number {
    return this.activeSession?.numPages || 0;
  }

  getCachedPageDimension(pageNumber: number, rotation = 0): PageDimension | null {
    const session = this.activeSession;
    if (!session) return null;

    const cacheKey = (pageNumber * 1000) + ((rotation % 360 + 360) % 360);
    if (session.pageDimensions.has(cacheKey)) {
      return session.pageDimensions.get(cacheKey)!;
    }

    // Fallback to page 1's measured dimension if available
    const page1Key = 1000 + ((rotation % 360 + 360) % 360);
    if (session.pageDimensions.has(page1Key)) {
      return session.pageDimensions.get(page1Key)!;
    }

    return null;
  }

  async getPageDimension(pageNumber: number, rotation = 0): Promise<PageDimension> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument) {
      return { width: 595, height: 842, aspectRatio: 595 / 842 };
    }

    const cacheKey = (pageNumber * 1000) + ((rotation % 360 + 360) % 360);
    if (session.pageDimensions.has(cacheKey)) {
      return session.pageDimensions.get(cacheKey)!;
    }

    try {
      const page = await session.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({
        scale: 1.0,
        rotation: (page.rotate + rotation) % 360
      });
      const dim: PageDimension = {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / viewport.height
      };
      session.pageDimensions.set(cacheKey, dim);
      return dim;
    } catch (err) {
      console.warn(`Could not get page ${pageNumber} dimension:`, err);
      return { width: 595, height: 842, aspectRatio: 595 / 842 };
    }
  }

  async renderPage({
    canvas,
    pageNumber,
    scale,
    rotation = 0,
    renderQuality = 'high',
    lowPowerMode = false,
    resourceBoundaryEnabled = true
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

      const renderStartTime = performance.now();
      const page = await this.pdfDocument.getPage(pageNumber);
      if (currentSession.cancelRequested) return;

      // Device Pixel Ratio scaling: governed by resource governor to prevent RAM / GPU lag
      const pixelRatio = resourceGovernor.getEffectivePixelRatio(
        renderQuality,
        lowPowerMode,
        resourceBoundaryEnabled
      );
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

      // Register canvas footprint with Resource Governor
      const regId = `cvs-${pageNumber}-${Date.now()}`;
      this.canvasRegistrationIds.set(canvas, regId);
      resourceGovernor.registerCanvas(regId, viewport.width, viewport.height, pageNumber);

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
      } finally {
        const renderDuration = performance.now() - renderStartTime;
        resourceGovernor.recordRenderDuration(renderDuration);
        // Free internal operator lists and glyph caches in PDF.js for this page
        try {
          page.cleanup();
        } catch {
          // safe
        }
      }
    };

    // Enforce Concurrency Boundary: queue render if max concurrent renders are already in progress
    const concurrencyLimit = resourceGovernor.getMaxConcurrency(lowPowerMode, resourceBoundaryEnabled);
    if (this.activeRenderCount >= concurrencyLimit) {
      currentSession.renderPromise = new Promise<void>((resolve) => {
        const queueItem = {
          canvas,
          pageNumber,
          isCancelled: false,
          execute: async () => {
            if (queueItem.isCancelled || currentSession.cancelRequested) {
              resolve();
              return;
            }
            try {
              await renderOperation();
            } finally {
              resolve();
            }
          },
          cancel: () => {
            queueItem.isCancelled = true;
            resolve();
          }
        };
        this.renderQueue.push(queueItem);
      });
      await currentSession.renderPromise;
    } else {
      this.activeRenderCount++;
      currentSession.renderPromise = renderOperation();
      try {
        await currentSession.renderPromise;
      } finally {
        this.activeRenderCount = Math.max(0, this.activeRenderCount - 1);
        this.processRenderQueue(lowPowerMode, resourceBoundaryEnabled);
      }
    }
  }

  /**
   * Cleans up canvas bitmap memory when a page leaves the viewport
   */
  cleanupPageCanvas(canvas: HTMLCanvasElement | null, _pageNumber: number) {
    if (!canvas) return;

    // Discard from queued renders if waiting in queue
    this.renderQueue = this.renderQueue.filter((item) => {
      if (item.canvas === canvas) {
        item.isCancelled = true;
        item.cancel();
        return false;
      }
      return true;
    });

    // Unregister canvas memory footprint from Governor
    const regId = this.canvasRegistrationIds.get(canvas);
    if (regId) {
      resourceGovernor.unregisterCanvas(regId);
      this.canvasRegistrationIds.delete(canvas);
    }

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

    // Zero-out canvas dimensions to release underlying GPU backing store immediately
    try {
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      // safe
    }
  }

  async getPageText(pageNumber: number): Promise<string> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument) return '';

    if (session.pageTextCache.has(pageNumber)) {
      return session.pageTextCache.get(pageNumber)!;
    }

    try {
      const page = await session.pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      this.trimCaches(session);
      session.pageTextCache.set(pageNumber, text);
      return text;
    } catch (err) {
      console.warn(`Error extracting text for page ${pageNumber}:`, err);
      return '';
    }
  }

  async getPageTextItems(pageNumber: number): Promise<PageTextItem[]> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument) return [];

    if (session.pageItemsCache.has(pageNumber)) {
      return session.pageItemsCache.get(pageNumber)!;
    }

    try {
      const page = await session.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const items: PageTextItem[] = [];

      for (const rawItem of textContent.items as any[]) {
        if (!('str' in rawItem) || !rawItem.str) continue;
        const transform = rawItem.transform;
        const tx = transform[4];
        const ty = transform[5];
        const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

        // Font size calculation from affine transformation matrix
        const fontSize = Math.max(8, Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]));
        const height = rawItem.height || fontSize;
        const width = rawItem.width || (rawItem.str.length * fontSize * 0.55);

        // Screen top position (vy is baseline)
        const y = Math.max(0, vy - height);
        const x = Math.max(0, vx);

        items.push({
          str: rawItem.str,
          x,
          y,
          width,
          height,
          fontSize
        });
      }

      this.trimCaches(session);
      session.pageItemsCache.set(pageNumber, items);
      return items;
    } catch (err) {
      console.warn(`Error extracting text items for page ${pageNumber}:`, err);
      return [];
    }
  }

  /**
   * Renders high-fidelity, pixel-perfect selectable text layer using PDF.js official TextLayer engine
   */
  async renderTextLayer({
    container,
    pageNumber,
    scale,
    rotation = 0
  }: {
    container: HTMLElement;
    pageNumber: number;
    scale: number;
    rotation?: number;
  }): Promise<{ cancel: () => void; promise: Promise<void> } | null> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument || !container) return null;

    try {
      const page = await session.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({
        scale,
        rotation: (page.rotate + rotation) % 360
      });

      // Clear previous text layer content safely
      container.replaceChildren();

      // Configure required CSS custom variables and bounds for PDF.js TextLayer
      container.style.setProperty('--scale-factor', `${scale}`);
      container.style.setProperty('--total-scale-factor', `${scale}`);
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;

      let textContent = session.textContentCache.get(pageNumber);
      if (!textContent) {
        textContent = await page.getTextContent();
        this.trimCaches(session);
        session.textContentCache.set(pageNumber, textContent);
      }

      const textLayer = new (pdfjsLib as any).TextLayer({
        textContentSource: textContent,
        container,
        viewport
      });

      const promise = textLayer.render();
      return {
        cancel: () => {
          try {
            textLayer.cancel();
          } catch {
            // Cancel safe
          }
        },
        promise
      };
    } catch (err: any) {
      if (err?.name !== 'AbortException') {
        console.warn(`TextLayer error for page ${pageNumber}:`, err);
      }
      return null;
    }
  }

  async searchDocument(query: string): Promise<SearchMatch[]> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument || !query.trim()) return [];
    const lowerQuery = query.toLowerCase().trim();
    const matches: SearchMatch[] = [];

    const numPages = session.numPages;
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
    const session = this.activeSession;
    if (!session || !session.pdfDocument) return [];

    if (session.outline) {
      return session.outline;
    }

    try {
      const outline = await session.pdfDocument.getOutline();
      if (!outline || outline.length === 0) {
        session.outline = [];
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
                ref = await session.pdfDocument.getDestination(ref);
              }
              if (Array.isArray(ref) && ref[0]) {
                const pageIndex = await session.pdfDocument.getPageIndex(ref[0]);
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

      const parsedOutline = await convertOutline(outline);
      session.outline = parsedOutline;
      return parsedOutline;
    } catch (err) {
      console.warn('Error reading outline:', err);
      return [];
    }
  }

  async renderThumbnail(pageNumber: number, maxDimension = 160): Promise<string> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument) return '';
    try {
      const page = await session.pdfDocument.getPage(pageNumber);
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Clean up temp page and canvas bitmap memory immediately
      try {
        page.cleanup();
      } catch {
        // safe
      }
      canvas.width = 0;
      canvas.height = 0;

      return dataUrl;
    } catch (e) {
      console.warn('Thumbnail generation error:', e);
      return '';
    }
  }

  /**
   * Trims text and AST caches to prevent memory bloat on large documents
   */
  private trimCaches(session: PDFDocumentSession) {
    const MAX_CACHED_ITEMS = 30;
    if (session.textContentCache.size > MAX_CACHED_ITEMS) {
      const keys = Array.from(session.textContentCache.keys()).slice(0, 15);
      for (const k of keys) {
        session.textContentCache.delete(k);
        session.pageItemsCache.delete(k);
        session.pageTextCache.delete(k);
      }
    }
  }

  /**
   * Explicitly purges all cached text content and triggers engine cleanup for low-end devices
   */
  purgeUnusedMemory(): void {
    this.canvasSessions = new WeakMap();
    for (const session of this.sessions.values()) {
      session.textContentCache.clear();
      session.pageItemsCache.clear();
      session.pageTextCache.clear();
      try {
        session.pdfDocument.cleanup();
      } catch {
        // safe
      }
    }
  }

  /**
   * Retrieves raw binary data from active PDF session for Save As / Export operations
   */
  async getDocumentBinary(): Promise<Uint8Array | null> {
    const session = this.activeSession;
    if (!session || !session.pdfDocument) return null;
    try {
      if (typeof (session.pdfDocument as any).saveDocument === 'function') {
        return await (session.pdfDocument as any).saveDocument();
      }
      if (typeof (session.pdfDocument as any).getData === 'function') {
        return await (session.pdfDocument as any).getData();
      }
    } catch (err) {
      console.warn('saveDocument/getData notice:', err);
    }
    return null;
  }

  cancelAllRenders() {
    this.canvasSessions = new WeakMap();
  }

  destroy() {
    this.cancelAllRenders();
    const destroyedProxies = new Set<pdfjsLib.PDFDocumentProxy>();
    for (const session of this.sessions.values()) {
      if (!destroyedProxies.has(session.pdfDocument)) {
        try {
          session.pdfDocument.destroy();
        } catch {
          // Ignored
        }
        destroyedProxies.add(session.pdfDocument);
      }
      session.pageDimensions.clear();
      session.pageTextCache.clear();
      session.pageItemsCache.clear();
      session.textContentCache.clear();
    }
    this.sessions.clear();
    this.activeSessionId = null;
  }
}

export const pdfEngine = new PDFEngineInstance();
