/**
 * BinaryDocumentStorage
 * High-performance, memory-leak-safe, multi-tier binary persistence for PDF documents.
 * 
 * Tiers:
 * 1. Fast in-memory LRU Cache (limited to 15 documents to prevent memory bloat/leakage)
 * 2. Web standard Cache Storage API (caches.open)
 * 3. IndexedDB BLOB Object Store ('paperlite_pdf_blobs')
 */

export class BinaryDocumentStorage {
  private memoryCache = new Map<string, ArrayBuffer>();
  private memoryKeysQueue: string[] = [];
  private readonly MAX_MEMORY_DOCS = 15;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private cacheApiAvailable: boolean = typeof window !== 'undefined' && 'caches' in window;
  private idbAvailable: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.idbAvailable) {
      this.initIndexedDB();
    }
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open('paperlite_pdf_storage_v2', 1);

        request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('pdf_documents')) {
            const store = db.createObjectStore('pdf_documents', { keyPath: 'id' });
            store.createIndex('by_fingerprint', 'fingerprint', { unique: false });
            store.createIndex('by_name', 'name', { unique: false });
          }
        };

        request.onsuccess = (e) => {
          resolve((e.target as IDBOpenDBRequest).result);
        };

        request.onerror = (err) => {
          console.warn('[BinaryStorage] IndexedDB open error:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[BinaryStorage] IndexedDB initialization exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private setMemory(key: string, data: ArrayBuffer) {
    if (!key || !data || data.byteLength === 0) return;
    
    // Maintain LRU queue
    const idx = this.memoryKeysQueue.indexOf(key);
    if (idx >= 0) {
      this.memoryKeysQueue.splice(idx, 1);
    }
    this.memoryKeysQueue.push(key);
    this.memoryCache.set(key, data);

    // Evict oldest documents if exceeding MAX_MEMORY_DOCS to prevent memory bloat
    while (this.memoryKeysQueue.length > this.MAX_MEMORY_DOCS) {
      const oldestKey = this.memoryKeysQueue.shift();
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Persists binary PDF data in both memory and durable storage
   */
  async save(
    docId: string,
    fingerprint: string,
    data: ArrayBuffer,
    fileName?: string
  ): Promise<void> {
    if (!data || data.byteLength === 0) return;

    // 1. In-memory caching (cloned buffer to prevent detachment issues)
    const cloned = data.slice(0);
    if (docId) this.setMemory(`id:${docId}`, cloned);
    if (fingerprint) this.setMemory(`fp:${fingerprint}`, cloned);
    if (fileName) this.setMemory(`name:${fileName.toLowerCase().trim()}`, cloned);

    // 2. Cache API persistence
    if (this.cacheApiAvailable) {
      try {
        const cache = await window.caches.open('paperlite_pdf_blobs_v2');
        const blob = new Blob([cloned], { type: 'application/pdf' });

        if (docId) {
          await cache.put(
            `https://paperlite.local/docs/${encodeURIComponent(docId)}`,
            new Response(blob.slice(0), { headers: { 'Content-Type': 'application/pdf' } })
          );
        }
        if (fingerprint) {
          await cache.put(
            `https://paperlite.local/fps/${encodeURIComponent(fingerprint)}`,
            new Response(blob.slice(0), { headers: { 'Content-Type': 'application/pdf' } })
          );
        }
        if (fileName) {
          await cache.put(
            `https://paperlite.local/names/${encodeURIComponent(fileName.toLowerCase().trim())}`,
            new Response(blob.slice(0), { headers: { 'Content-Type': 'application/pdf' } })
          );
        }
      } catch (err) {
        console.warn('[BinaryStorage] Cache API save notice:', err);
      }
    }

    // 3. IndexedDB persistence
    if (this.idbAvailable) {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          const tx = db.transaction('pdf_documents', 'readwrite');
          const store = tx.objectStore('pdf_documents');
          const record = {
            id: docId,
            fingerprint: fingerprint || '',
            name: (fileName || '').toLowerCase().trim(),
            data: cloned,
            size: cloned.byteLength,
            updatedAt: Date.now()
          };
          store.put(record);
        }
      } catch (err) {
        console.warn('[BinaryStorage] IndexedDB save notice:', err);
      }
    }
  }

  /**
   * Retrieves binary PDF data from memory, Cache API, or IndexedDB
   */
  async get(
    docId?: string | null,
    fingerprint?: string | null,
    fileName?: string | null
  ): Promise<ArrayBuffer | null> {
    const cleanDocId = docId?.trim();
    const cleanFp = fingerprint?.trim();
    const cleanName = fileName?.toLowerCase().trim();

    // 1. Check in-memory Cache first (synchronous & zero I/O)
    if (cleanDocId && this.memoryCache.has(`id:${cleanDocId}`)) {
      return this.memoryCache.get(`id:${cleanDocId}`)!.slice(0);
    }
    if (cleanFp && this.memoryCache.has(`fp:${cleanFp}`)) {
      return this.memoryCache.get(`fp:${cleanFp}`)!.slice(0);
    }
    if (cleanName && this.memoryCache.has(`name:${cleanName}`)) {
      return this.memoryCache.get(`name:${cleanName}`)!.slice(0);
    }

    // 2. Check Cache API
    if (this.cacheApiAvailable) {
      try {
        const cache = await window.caches.open('paperlite_pdf_blobs_v2');

        if (cleanDocId) {
          const res = await cache.match(`https://paperlite.local/docs/${encodeURIComponent(cleanDocId)}`);
          if (res) {
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              this.setMemory(`id:${cleanDocId}`, buf.slice(0));
              if (cleanFp) this.setMemory(`fp:${cleanFp}`, buf.slice(0));
              return buf;
            }
          }
        }

        if (cleanFp) {
          const res = await cache.match(`https://paperlite.local/fps/${encodeURIComponent(cleanFp)}`);
          if (res) {
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              this.setMemory(`fp:${cleanFp}`, buf.slice(0));
              if (cleanDocId) this.setMemory(`id:${cleanDocId}`, buf.slice(0));
              return buf;
            }
          }
        }

        if (cleanName) {
          const res = await cache.match(`https://paperlite.local/names/${encodeURIComponent(cleanName)}`);
          if (res) {
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              this.setMemory(`name:${cleanName}`, buf.slice(0));
              return buf;
            }
          }
        }
      } catch (err) {
        console.warn('[BinaryStorage] Cache API read notice:', err);
      }
    }

    // 3. Check IndexedDB
    if (this.idbAvailable) {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          const tx = db.transaction('pdf_documents', 'readonly');
          const store = tx.objectStore('pdf_documents');

          // Search by primary key id
          if (cleanDocId) {
            const record = await new Promise<any>((resolve) => {
              const req = store.get(cleanDocId);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            if (record && record.data instanceof ArrayBuffer && record.data.byteLength > 0) {
              this.setMemory(`id:${cleanDocId}`, record.data.slice(0));
              return record.data.slice(0);
            }
          }

          // Search by fingerprint index
          if (cleanFp) {
            const fpIndex = store.index('by_fingerprint');
            const record = await new Promise<any>((resolve) => {
              const req = fpIndex.get(cleanFp);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            if (record && record.data instanceof ArrayBuffer && record.data.byteLength > 0) {
              this.setMemory(`fp:${cleanFp}`, record.data.slice(0));
              return record.data.slice(0);
            }
          }

          // Search by name index
          if (cleanName) {
            const nameIndex = store.index('by_name');
            const record = await new Promise<any>((resolve) => {
              const req = nameIndex.get(cleanName);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            if (record && record.data instanceof ArrayBuffer && record.data.byteLength > 0) {
              this.setMemory(`name:${cleanName}`, record.data.slice(0));
              return record.data.slice(0);
            }
          }
        }
      } catch (err) {
        console.warn('[BinaryStorage] IndexedDB read notice:', err);
      }
    }

    return null;
  }

  /**
   * Removes cached document binary from memory and storage
   */
  async delete(docId: string, fingerprint?: string, fileName?: string): Promise<void> {
    if (docId) this.memoryCache.delete(`id:${docId}`);
    if (fingerprint) this.memoryCache.delete(`fp:${fingerprint}`);
    if (fileName) this.memoryCache.delete(`name:${fileName.toLowerCase().trim()}`);

    if (this.cacheApiAvailable) {
      try {
        const cache = await window.caches.open('paperlite_pdf_blobs_v2');
        if (docId) await cache.delete(`https://paperlite.local/docs/${encodeURIComponent(docId)}`);
        if (fingerprint) await cache.delete(`https://paperlite.local/fps/${encodeURIComponent(fingerprint)}`);
        if (fileName) await cache.delete(`https://paperlite.local/names/${encodeURIComponent(fileName.toLowerCase().trim())}`);
      } catch {
        // ignore
      }
    }

    if (this.idbAvailable) {
      try {
        const db = await this.initIndexedDB();
        if (db && docId) {
          const tx = db.transaction('pdf_documents', 'readwrite');
          tx.objectStore('pdf_documents').delete(docId);
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Updates alias keys when a document is renamed
   */
  async updateDocumentName(docId: string, oldName: string, newName: string): Promise<void> {
    const cleanOld = oldName.toLowerCase().trim();
    const cleanNew = newName.toLowerCase().trim();

    const data = await this.get(docId, null, oldName);
    if (data) {
      this.memoryCache.delete(`name:${cleanOld}`);
      this.setMemory(`name:${cleanNew}`, data);
      await this.save(docId, '', data, newName);
    }
  }
}

export const binaryStorage = new BinaryDocumentStorage();
