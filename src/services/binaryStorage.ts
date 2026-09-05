/**
 * BinaryDocumentStorage
 * High-performance, zero-waste binary persistence for PDF documents.
 * 
 * Storage Principles & Zero-Waste Guard:
 * 1. Local Files (Tauri / Local Disk):
 *    - If a PDF file already lives on the user's hard drive (`filePath` is present),
 *      it is NEVER duplicated into IndexedDB or CacheStorage.
 *    - It is kept exclusively in fast in-memory LRU cache during active use,
 *      ensuring 0 bytes of hidden AppData storage consumption.
 * 
 * 2. Web / Non-disk Temporary Files:
 *    - Files opened via web drag-and-drop (without native filesystem access)
 *      are saved with `isTemporary: true` in IndexedDB (single copy, not duplicated 3x in Cache API).
 *    - Automatically purged when tabs are closed or on app launch if no longer in open tabs.
 * 
 * 3. Cache Purge & Cleanup:
 *    - Provides automatic orphaned-blob cleanup and manual cache wipe capabilities.
 */

export interface StorageStats {
  totalBytes: number;
  docCount: number;
}

export class BinaryDocumentStorage {
  private memoryCache = new Map<string, ArrayBuffer>();
  private memoryKeysQueue: string[] = [];
  private readonly MAX_MEMORY_DOCS = 10;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private idbAvailable: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.idbAvailable) {
      this.initIndexedDB();
    }
    // Clean legacy bloated Cache API store if present from earlier versions
    this.cleanLegacyCaches();
  }

  private async cleanLegacyCaches(): Promise<void> {
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          if (name.includes('paperlite_pdf_blobs')) {
            await window.caches.delete(name);
          }
        }
      } catch (err) {
        console.warn('[BinaryStorage] Legacy cache sweep notice:', err);
      }
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
            store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
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

    const idx = this.memoryKeysQueue.indexOf(key);
    if (idx >= 0) {
      this.memoryKeysQueue.splice(idx, 1);
    }
    this.memoryKeysQueue.push(key);
    this.memoryCache.set(key, data);

    while (this.memoryKeysQueue.length > this.MAX_MEMORY_DOCS) {
      const oldestKey = this.memoryKeysQueue.shift();
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Persists binary PDF data with strict duplicate-prevention.
   * If `hasLocalPath` is true, it is stored ONLY in memory and NOT written to AppData / IndexedDB.
   */
  async save(
    docId: string,
    fingerprint: string,
    data: ArrayBuffer,
    fileName?: string,
    options?: { hasLocalPath?: boolean; isTemporary?: boolean }
  ): Promise<void> {
    if (!data || data.byteLength === 0) return;

    // 1. In-memory caching for active reading session
    const cloned = data.slice(0);
    if (docId) this.setMemory(`id:${docId}`, cloned);
    if (fingerprint) this.setMemory(`fp:${fingerprint}`, cloned);
    if (fileName) this.setMemory(`name:${fileName.toLowerCase().trim()}`, cloned);

    // 2. ZERO-STORAGE CONSUMPTION FOR LOCAL DISK FILES:
    // If the file already exists on the local hard drive (Tauri desktop / native path),
    // do NOT save a duplicate copy in IndexedDB / AppData!
    if (options?.hasLocalPath) {
      // If there was a previous temporary copy in IndexedDB for this ID, remove it
      this.deleteFromIndexedDB(docId).catch(() => {});
      return;
    }

    // 3. For web / temporary files only: store a single record in IndexedDB
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
            updatedAt: Date.now(),
            isTemporary: options?.isTemporary ?? true
          };
          store.put(record);
        }
      } catch (err) {
        console.warn('[BinaryStorage] IndexedDB save notice:', err);
      }
    }
  }

  /**
   * Retrieves binary PDF data from in-memory cache or IndexedDB
   */
  async get(
    docId?: string | null,
    fingerprint?: string | null,
    fileName?: string | null
  ): Promise<ArrayBuffer | null> {
    const cleanDocId = docId?.trim();
    const cleanFp = fingerprint?.trim();
    const cleanName = fileName?.toLowerCase().trim();

    // 1. Check in-memory cache first (instant, zero I/O)
    if (cleanDocId && this.memoryCache.has(`id:${cleanDocId}`)) {
      return this.memoryCache.get(`id:${cleanDocId}`)!.slice(0);
    }
    if (cleanFp && this.memoryCache.has(`fp:${cleanFp}`)) {
      return this.memoryCache.get(`fp:${cleanFp}`)!.slice(0);
    }
    if (cleanName && this.memoryCache.has(`name:${cleanName}`)) {
      return this.memoryCache.get(`name:${cleanName}`)!.slice(0);
    }

    // 2. Check IndexedDB for non-disk / web cached documents
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
   * Removes cached document binary from memory and IndexedDB
   */
  async delete(docId: string, fingerprint?: string, fileName?: string): Promise<void> {
    if (docId) this.memoryCache.delete(`id:${docId}`);
    if (fingerprint) this.memoryCache.delete(`fp:${fingerprint}`);
    if (fileName) this.memoryCache.delete(`name:${fileName.toLowerCase().trim()}`);

    await this.deleteFromIndexedDB(docId);
  }

  private async deleteFromIndexedDB(docId?: string): Promise<void> {
    if (!docId || !this.idbAvailable) return;
    try {
      const db = await this.initIndexedDB();
      if (db) {
        const tx = db.transaction('pdf_documents', 'readwrite');
        tx.objectStore('pdf_documents').delete(docId);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Purges temporary blobs from IndexedDB that do not belong to active tabs or pinned items.
   * Guarantees storage is not silently consumed.
   */
  async purgeOrphanedTemporaryBlobs(keepDocIds: string[]): Promise<number> {
    if (!this.idbAvailable) return 0;
    let purgedCount = 0;
    const keepSet = new Set(keepDocIds.filter(Boolean));

    try {
      const db = await this.initIndexedDB();
      if (!db) return 0;

      const tx = db.transaction('pdf_documents', 'readwrite');
      const store = tx.objectStore('pdf_documents');
      const req = store.openCursor();

      await new Promise<void>((resolve) => {
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const key = String(cursor.key);
            // If not in the active keep set, delete it immediately
            if (!keepSet.has(key)) {
              cursor.delete();
              purgedCount++;
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[BinaryStorage] Purge notice:', err);
    }

    return purgedCount;
  }

  /**
   * Completely wipes all cached temporary binary data from IndexedDB & Memory.
   */
  async clearAllTemporaryCache(): Promise<void> {
    this.memoryCache.clear();
    this.memoryKeysQueue = [];

    // Clear IndexedDB
    if (this.idbAvailable) {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          const tx = db.transaction('pdf_documents', 'readwrite');
          tx.objectStore('pdf_documents').clear();
        }
      } catch (err) {
        console.warn('[BinaryStorage] Clear all error:', err);
      }
    }

    // Clear legacy Cache API
    await this.cleanLegacyCaches();
  }

  /**
   * Computes current storage consumption of temporary cached PDF binaries in AppData / IndexedDB
   */
  async getStorageUsage(): Promise<StorageStats> {
    if (!this.idbAvailable) return { totalBytes: 0, docCount: 0 };

    try {
      const db = await this.initIndexedDB();
      if (!db) return { totalBytes: 0, docCount: 0 };

      const tx = db.transaction('pdf_documents', 'readonly');
      const store = tx.objectStore('pdf_documents');
      const req = store.openCursor();

      let totalBytes = 0;
      let docCount = 0;

      await new Promise<void>((resolve) => {
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const record = cursor.value;
            if (record && record.size) {
              totalBytes += record.size;
            } else if (record && record.data && record.data.byteLength) {
              totalBytes += record.data.byteLength;
            }
            docCount++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });

      return { totalBytes, docCount };
    } catch {
      return { totalBytes: 0, docCount: 0 };
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
