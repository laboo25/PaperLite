import { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { ControllerBar } from './components/ControllerBar';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnnotationToolbar } from './components/AnnotationToolbar';
import { HomeView } from './components/HomeView';
import { LibraryModal } from './components/LibraryModal';
import { ReadingSettingsModal } from './components/ReadingSettingsModal';
import { ExportModal } from './components/ExportModal';
import { SearchModal } from './components/SearchModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { pdfEngine } from './services/pdfEngine';
import { storageService } from './services/storageService';
import { tauriBridge } from './services/tauriBridge';
import { historyTracker } from './services/historyTracker';
import { pdfSaveService } from './services/pdfSaveService';
import { closeWindow } from './services/tauriWindow';
import { ToastNotification, ToastItem } from './components/ToastNotification';
import { SAMPLE_DOCUMENTS } from './data/samplePdfs';
import {
  AnnotationTool,
  PDFAnnotation,
  PDFBookmark,
  PDFDocumentInfo,
  PDFOutlineItem,
  PDFTabItem,
  ReaderSettings,
  SearchMatch
} from './types';
import { FileUp, Loader2 } from 'lucide-react';

export default function App() {
  // Tabs State (Browser / WPS Office Multi-Document Engine)
  const [tabs, setTabs] = useState<PDFTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isHomeActive, setIsHomeActive] = useState(true);

  // Active Document State
  const [currentDoc, setCurrentDoc] = useState<PDFDocumentInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Document Metadata & Structure
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [outline, setOutline] = useState<PDFOutlineItem[]>([]);
  const [bookmarks, setBookmarks] = useState<PDFBookmark[]>([]);
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Settings & Tools
  const [settings, setSettings] = useState<ReaderSettings>(storageService.getSettings());
  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#FDE047');
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  // Modals & Drawers
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Library State
  const [libraryDocs, setLibraryDocs] = useState<PDFDocumentInfo[]>([]);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Document Dirty / Save & History State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  // Unsaved Document Close Confirmation State
  const [pendingCloseState, setPendingCloseState] = useState<{
    tab: PDFTabItem;
    allTargetTabIds: string[];
    preferredActiveTabId?: string;
  } | null>(null);
  const [isModalSaving, setIsModalSaving] = useState(false);

  const searchDebounceRef = useRef<any>(null);
  const activeTabIdRef = useRef<string | null>(null);
  activeTabIdRef.current = activeTabId;
  const readerDragCounterRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const handleUndoRef = useRef<() => void>(() => {});
  const handleRedoRef = useRef<() => void>(() => {});

  // Helper Toast Triggers
  const addToast = useCallback(
    (
      message: string,
      type: 'success' | 'info' | 'warning' | 'error' = 'info',
      actionLabel?: string,
      onAction?: () => void
    ) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      setToasts((prev) => [...prev.slice(-3), { id, message, type, actionLabel, onAction }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load Library on startup and initialize tabs from persistent storage
  useEffect(() => {
    const docs = storageService.getLibrary();
    setLibraryDocs(docs);

    const initStartupDocument = async () => {
      // 1. Check if application was launched with a PDF file argument (e.g. Windows double-click association)
      try {
        const launchFile = await tauriBridge.getLaunchFile();
        if (launchFile) {
          const opened = await openPdfFromPath(launchFile);
          if (opened) {
            return;
          }
        }
      } catch (err) {
        console.warn('Startup launch file check failed:', err);
      }

      // 2. If no launch file argument or file could not be read, restore previous session
      const savedOpenDocs = storageService.getOpenTabs();
      const savedActiveId = storageService.getActiveTabId();

      if (savedOpenDocs && savedOpenDocs.length > 0) {
        // Restore all previously open tabs, ensuring uniqueness by ID
        const uniqueDocs: PDFDocumentInfo[] = [];
        const seenIds = new Set<string>();
        for (const doc of savedOpenDocs) {
          if (doc && doc.id && !seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            uniqueDocs.push(doc);
          }
        }

        if (uniqueDocs.length > 0) {
          const initialTabs: PDFTabItem[] = uniqueDocs.map((doc) => ({
            id: doc.id,
            doc,
            currentPage: doc.lastPageRead || 1,
            totalPages: doc.totalPages || 1,
            fingerprint: doc.fingerprint,
            bookmarks: storageService.getBookmarks(doc.fingerprint),
            annotations: storageService.getAnnotations(doc.fingerprint)
          }));
          setTabs(initialTabs);

          const targetDoc = uniqueDocs.find((d) => d.id === savedActiveId) || uniqueDocs[0];
          await loadDocumentFromInfo(targetDoc);

          // Preload binary buffers for remaining tabs in background
          uniqueDocs.forEach(async (d) => {
            if (d.id !== targetDoc.id) {
              const buf = await storageService.getDocumentData(d.id, d.fingerprint, d.name);
              if (buf) {
                setTabs((curr) =>
                  curr.map((t) => (t.id === d.id ? { ...t, data: buf.slice(0) } : t))
                );
              }
            }
          });
          // Background sweep orphaned temporary storage left behind by closed or crashed sessions
          const openDocIds = uniqueDocs.map((d) => d.id);
          storageService.purgeOrphanedTemporaryData(openDocIds).catch(() => {});

          isInitializedRef.current = true;
          return;
        }
      }

      // Sweep any orphaned temporary blobs if starting on Home page
      storageService.purgeOrphanedTemporaryData([]).catch(() => {});

      // If no tabs were restored, default to showing Home page
      setIsHomeActive(true);
      isInitializedRef.current = true;
    };

    initStartupDocument();

    // 3. Listen for runtime file open events (e.g. user double-clicks another PDF while app is already running)
    let unlistenFileEvents: (() => void) | null = null;
    tauriBridge.listenToFileOpenEvents((filePath) => {
      if (filePath) {
        openPdfFromPath(filePath);
      }
    }).then((unlisten) => {
      unlistenFileEvents = unlisten;
    });

    return () => {
      if (unlistenFileEvents) {
        unlistenFileEvents();
      }
    };
  }, []);

  // Sync open tabs to storage so tabs are never removed until user explicitly removes them
  useEffect(() => {
    if (!isInitializedRef.current) return;
    storageService.saveOpenTabs(tabs.map((t) => t.doc));
    storageService.saveActiveTabId(activeTabId);
  }, [tabs, activeTabId]);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      storageService.saveSettings(updated);
      return updated;
    });
  };

  // Hidden File Input Ref for rock-solid cross-platform file picking
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Check if this file is ALREADY OPEN in one of the tabs
      const existingTab = tabs.find(
        (t) =>
          t.doc.name.toLowerCase() === file.name.toLowerCase() &&
          (t.doc.size === file.size || !t.doc.size)
      );
      if (existingTab && existingTab.data && existingTab.data.byteLength > 0) {
        await handleSelectTab(existingTab.id);
        addToast(`Switched to open tab: ${file.name}`, 'info');
        return;
      }

      const buffer = await file.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        const existingInLib = libraryDocs.find(
          (d) =>
            d.name.toLowerCase() === file.name.toLowerCase() &&
            (d.size === file.size || !d.size)
        );
        const uniqueId = existingTab?.id || existingInLib?.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        const fingerprint = existingTab?.fingerprint || existingInLib?.fingerprint || ('fp-' + encodeURIComponent(file.name) + '-' + file.size);
        const docInfo: PDFDocumentInfo = {
          id: uniqueId,
          name: file.name,
          path: (file as any).path || file.name,
          size: file.size,
          totalPages: existingInLib?.totalPages || 1,
          lastOpened: Date.now(),
          lastPageRead: existingInLib?.lastPageRead || 1,
          fingerprint,
          category: existingInLib?.category || 'Imported',
          tags: existingInLib?.tags || ['Local']
        };
        await loadPDFBuffer(buffer, docInfo);
        addToast(`Opened ${file.name}`, 'success');
      }
    } catch (err: any) {
      console.error('Error reading selected file:', err);
      addToast('Failed to open PDF: ' + (err?.message || 'File read error'), 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Load PDF Binary Buffer into PDF Engine & manage tab state
  const loadPDFBuffer = async (data: ArrayBuffer, docInfo: PDFDocumentInfo) => {
    setIsLoadingDoc(true);
    setErrorMessage(null);
    setThumbnails(new Map());
    setOutline([]);

    try {
      // Ensure we keep an un-detached clone for tab state & storage
      const dataClone = data.slice(0);
      const tabId = docInfo.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
      const result = await pdfEngine.loadDocument(dataClone, tabId, docInfo.fingerprint);
      const numPages = result.numPages;
      setTotalPages(numPages);

      const fingerprint = docInfo.fingerprint || result.fingerprint || tabId;
      const lastPage = storageService.getLastReadPage(fingerprint) || docInfo.lastPageRead || 1;
      const validPage = Math.min(numPages, Math.max(1, lastPage));

      const updatedInfo: PDFDocumentInfo = {
        ...docInfo,
        id: tabId,
        totalPages: numPages,
        fingerprint,
        name: docInfo.name || result.title || 'Untitled Document.pdf'
      };

      setCurrentDoc(updatedInfo);
      setCurrentPage(validPage);

      // Persist binary data into durable multi-tier storage
      // ZERO-DUPLICATE GUARD: If file already exists on local disk (path present),
      // keep it ONLY in memory and do NOT write a duplicate 50MB-500MB copy to AppData / IndexedDB!
      const hasLocalPath = Boolean(updatedInfo.path && updatedInfo.path.trim());
      storageService.saveDocumentData(tabId, fingerprint, data.slice(0), updatedInfo.name, {
        hasLocalPath,
        isTemporary: !hasLocalPath
      }).catch((err) => {
        console.warn('Failed to persist document binary:', err);
      });

      // Load Saved Annotations & Bookmarks for this document
      const savedAnnotations = storageService.getAnnotations(fingerprint);
      const savedBookmarks = storageService.getBookmarks(fingerprint);
      setAnnotations(savedAnnotations);
      setBookmarks(savedBookmarks);

      // Save to library index
      storageService.addOrUpdateDocument(updatedInfo);
      setLibraryDocs(storageService.getLibrary());

      // Update / Create Tab strictly by tabId
      setTabs((prevTabs) => {
        const existingIdx = prevTabs.findIndex(
          (t) =>
            t.id === tabId ||
            (fingerprint && t.fingerprint === fingerprint) ||
            (t.doc.name && updatedInfo.name && t.doc.name.toLowerCase() === updatedInfo.name.toLowerCase())
        );
        const newTabItem: PDFTabItem = {
          id: existingIdx >= 0 ? prevTabs[existingIdx].id : tabId,
          doc: updatedInfo,
          data: data.slice(0),
          currentPage: validPage,
          totalPages: numPages,
          fingerprint,
          bookmarks: savedBookmarks,
          annotations: savedAnnotations
        };

        if (existingIdx >= 0) {
          const updated = [...prevTabs];
          updated[existingIdx] = newTabItem;
          return updated;
        } else {
          return [...prevTabs, newTabItem];
        }
      });

      setActiveTabId(tabId);
      setIsHomeActive(false);

      // Fetch Outline
      pdfEngine.getOutline().then((items) => {
        if (!tabId || activeTabIdRef.current === tabId) {
          setOutline(items);
        }
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, outline: items } : t)));
      });

      // Generate initial thumbnails in background
      generateInitialThumbnails(numPages, tabId);
    } catch (err: any) {
      console.error('Failed to parse PDF document:', err);
      setErrorMessage(err?.message || 'Could not load PDF document. Please verify the file format.');
      addToast('Could not load PDF document', 'error');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const pendingThumbnailRequests = useRef<Set<number>>(new Set());

  const handleRequestThumbnail = useCallback(
    async (pageNumber: number) => {
      if (thumbnails.has(pageNumber) || pendingThumbnailRequests.current.has(pageNumber)) {
        return;
      }
      pendingThumbnailRequests.current.add(pageNumber);
      try {
        const url = await pdfEngine.renderThumbnail(pageNumber, 140);
        if (url) {
          setThumbnails((prev) => {
            const next = new Map(prev);
            next.set(pageNumber, url);
            return next;
          });
        }
      } catch (err) {
        console.warn(`Thumbnail request failed for page ${pageNumber}:`, err);
      } finally {
        pendingThumbnailRequests.current.delete(pageNumber);
      }
    },
    [thumbnails]
  );

  const generateInitialThumbnails = async (numPages: number, forTabId?: string) => {
    // Keep initial batch small on large documents for instant startup responsiveness
    const limit = numPages > 50 ? 8 : Math.min(numPages, 16);
    const newThumbs = new Map<number, string>();
    for (let i = 1; i <= limit; i++) {
      try {
        const url = await pdfEngine.renderThumbnail(i, 140);
        if (url) {
          newThumbs.set(i, url);
          if (!forTabId || activeTabIdRef.current === forTabId) {
            setThumbnails(new Map(newThumbs));
          }
        }
      } catch {
        // Ignored
      }
    }
    if (forTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === forTabId ? { ...t, thumbnails: new Map(newThumbs) } : t))
      );
    }
  };

  // Load Document from Library Info (Recent documents, Library modal, or Tab click)
  const loadDocumentFromInfo = async (docInfo: PDFDocumentInfo) => {
    setIsLoadingDoc(true);
    setErrorMessage(null);

    // 1. Check if already open in tabs
    const existingTab = tabs.find(
      (t) =>
        t.id === docInfo.id ||
        (docInfo.fingerprint && t.fingerprint === docInfo.fingerprint) ||
        (docInfo.name && t.doc.name && t.doc.name.toLowerCase() === docInfo.name.toLowerCase()) ||
        (docInfo.path && t.doc.path && t.doc.path.toLowerCase() === docInfo.path.toLowerCase())
    );

    if (existingTab && existingTab.data && existingTab.data.byteLength > 0) {
      await handleSelectTab(existingTab.id);
      setIsLoadingDoc(false);
      return;
    }

    // 2. If path is available on disk, read directly from local disk (zero AppData duplicate storage)
    let buffer: ArrayBuffer | null = null;
    if (docInfo.path) {
      try {
        const bin = await tauriBridge.readBinaryFile(docInfo.path);
        if (bin && bin.byteLength > 0) {
          buffer = bin;
        }
      } catch (err) {
        console.warn('tauriBridge readBinaryFile error:', err);
      }
    }

    // 3. If not on local disk, check if existingTab had cached buffer or if another tab has it
    if (!buffer && existingTab && existingTab.data && existingTab.data.byteLength > 0) {
      buffer = existingTab.data.slice(0);
    }

    // 4. Fetch binary buffer from storage if not already loaded from disk
    if (!buffer) {
      try {
        buffer = await storageService.getDocumentData(docInfo.id, docInfo.fingerprint, docInfo.name);
      } catch (e) {
        console.warn('Error reading from storageService binary store:', e);
      }
    }

    // 4. Check if it's one of the built-in sample docs (by ID, fingerprint, or name)
    if (!buffer) {
      const sample = SAMPLE_DOCUMENTS.find(
        (s) =>
          s.info.id === docInfo.id ||
          s.info.fingerprint === docInfo.fingerprint ||
          s.info.name.toLowerCase() === docInfo.name.toLowerCase() ||
          (docInfo.path && s.info.path.toLowerCase() === docInfo.path.toLowerCase())
      );
      if (sample) {
        buffer = sample.getData();
      }
    }

    // 5. Try reading via Tauri Rust fs or filesystem fallback if path is available
    if (!buffer && docInfo.path) {
      try {
        const bin = await tauriBridge.readBinaryFile(docInfo.path);
        if (bin && bin.byteLength > 0) {
          buffer = bin;
        }
      } catch (err) {
        console.warn('tauriBridge readBinaryFile error:', err);
      }
    }

    // 6. Check scanned directory templates or generate sample fallback if it's a known demo item
    if (!buffer && docInfo.name) {
      const matchedSample = SAMPLE_DOCUMENTS.find((s) =>
        docInfo.name.toLowerCase().includes(s.info.name.toLowerCase().replace('.pdf', '')) ||
        s.info.name.toLowerCase().includes(docInfo.name.toLowerCase().replace('.pdf', ''))
      );
      if (matchedSample) {
        buffer = matchedSample.getData();
      }
    }

    // 7. If buffer was retrieved successfully, load and display it!
    if (buffer && buffer.byteLength > 0) {
      const targetId = existingTab ? existingTab.id : docInfo.id;
      const resolvedInfo: PDFDocumentInfo = {
        ...docInfo,
        id: targetId
      };
      await loadPDFBuffer(buffer, resolvedInfo);
      return;
    }

    // 8. If file truly could not be loaded, inform user
    setIsLoadingDoc(false);
    setErrorMessage(`Could not reload '${docInfo.name}'. Please re-open the file.`);
    addToast(`Could not reload '${docInfo.name}'. Please re-open the file.`, 'error');
  };

  // Open PDF directly from local disk path (e.g. Windows file association double-click, CLI argument, or event)
  const openPdfFromPath = async (filePath: string): Promise<boolean> => {
    if (!filePath || typeof filePath !== 'string') return false;
    const cleanPath = filePath.trim().replace(/^"|"$/g, '');
    if (!cleanPath) return false;

    try {
      const fileName = cleanPath.split(/[\\/]/).pop() || 'Document.pdf';

      // Check if this path or file is already open in an existing tab
      const existingTab = tabs.find(
        (t) =>
          (t.doc.path && t.doc.path.toLowerCase() === cleanPath.toLowerCase()) ||
          (t.doc.name && t.doc.name.toLowerCase() === fileName.toLowerCase())
      );
      if (existingTab) {
        await handleSelectTab(existingTab.id);
        return true;
      }

      const binary = await tauriBridge.readBinaryFile(cleanPath);
      if (binary && binary.byteLength > 0) {
        const existingInLib = libraryDocs.find(
          (d) =>
            (d.path && d.path.toLowerCase() === cleanPath.toLowerCase()) ||
            (d.name.toLowerCase() === fileName.toLowerCase() && (d.size === binary.byteLength || !d.size))
        );
        const uniqueId = existingInLib?.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        const fingerprint = existingInLib?.fingerprint || ('fp-' + encodeURIComponent(fileName) + '-' + binary.byteLength);
        const docInfo: PDFDocumentInfo = {
          id: uniqueId,
          name: fileName,
          path: cleanPath,
          size: binary.byteLength,
          totalPages: existingInLib?.totalPages || 1,
          lastOpened: Date.now(),
          lastPageRead: existingInLib?.lastPageRead || 1,
          fingerprint,
          category: existingInLib?.category || 'Imported',
          tags: existingInLib?.tags || ['Default Reader', 'Local']
        };
        await loadPDFBuffer(binary, docInfo);
        addToast(`Opened ${fileName}`, 'success');
        return true;
      } else {
        console.warn('Could not read binary from path:', cleanPath);
      }
    } catch (err) {
      console.error('Failed to open PDF from path:', cleanPath, err);
    }
    return false;
  };

  // Load Built-in Sample
  const loadSample = async (sampleId: string) => {
    const sample = SAMPLE_DOCUMENTS.find((s) => s.info.id === sampleId) || SAMPLE_DOCUMENTS[0];
    const buffer = sample.getData();
    await loadPDFBuffer(buffer, sample.info);
  };

  // Open Native / File Picker
  const handleOpenFile = async () => {
    if (tauriBridge.isNativeDesktop()) {
      try {
        const file = await tauriBridge.pickPdfFile();
        if (file && file.data && file.data.byteLength > 0) {
          const existingTab = tabs.find(
            (t) =>
              t.doc.name.toLowerCase() === file.name.toLowerCase() &&
              (t.doc.size === file.size || !t.doc.size)
          );
          if (existingTab && existingTab.data && existingTab.data.byteLength > 0) {
            await handleSelectTab(existingTab.id);
            addToast(`Switched to open tab: ${file.name}`, 'info');
            return;
          }

          const existingInLib = libraryDocs.find(
            (d) =>
              d.name.toLowerCase() === file.name.toLowerCase() &&
              (d.size === file.size || !d.size)
          );
          const uniqueId = existingTab?.id || existingInLib?.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
          const fingerprint = existingTab?.fingerprint || existingInLib?.fingerprint || ('fp-' + encodeURIComponent(file.name) + '-' + file.size);
          const docInfo: PDFDocumentInfo = {
            id: uniqueId,
            name: file.name,
            path: file.path,
            size: file.size,
            totalPages: existingInLib?.totalPages || 1,
            lastOpened: Date.now(),
            lastPageRead: existingInLib?.lastPageRead || 1,
            fingerprint,
            category: existingInLib?.category || 'Imported',
            tags: ['Local']
          };
          await loadPDFBuffer(file.data, docInfo);
          addToast(`Opened ${file.name}`, 'success');
          return;
        }
      } catch (err) {
        console.warn('Native picker notice:', err);
      }
    }

    // Trigger mounted file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const fallback = await tauriBridge.pickPdfFile();
      if (fallback && fallback.data && fallback.data.byteLength > 0) {
        const existingTab = tabs.find(
          (t) =>
            t.doc.name.toLowerCase() === fallback.name.toLowerCase() &&
            (t.doc.size === fallback.size || !t.doc.size)
        );
        if (existingTab && existingTab.data && existingTab.data.byteLength > 0) {
          await handleSelectTab(existingTab.id);
          addToast(`Switched to open tab: ${fallback.name}`, 'info');
          return;
        }

        const existingInLib = libraryDocs.find(
          (d) =>
            d.name.toLowerCase() === fallback.name.toLowerCase() &&
            (d.size === fallback.size || !d.size)
        );
        const uniqueId = existingTab?.id || existingInLib?.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        const fingerprint = existingTab?.fingerprint || existingInLib?.fingerprint || ('fp-' + encodeURIComponent(fallback.name) + '-' + fallback.size);
        const docInfo: PDFDocumentInfo = {
          id: uniqueId,
          name: fallback.name,
          path: fallback.path,
          size: fallback.size,
          totalPages: existingInLib?.totalPages || 1,
          lastOpened: Date.now(),
          lastPageRead: existingInLib?.lastPageRead || 1,
          fingerprint,
          category: existingInLib?.category || 'Imported',
          tags: ['Local']
        };
        await loadPDFBuffer(fallback.data, docInfo);
        addToast(`Opened ${fallback.name}`, 'success');
      }
    }
  };

  // Tab Switching Handler
  const handleSelectTab = async (tabId: string) => {
    if (activeTabId === tabId && !isHomeActive) return;

    // Save current progress, thumbnails, outline, bookmarks, annotations on outgoing tab before switching
    if (activeTabId && currentDoc) {
      storageService.saveLastReadPage(currentDoc.fingerprint, currentPage);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                currentPage,
                thumbnails: new Map(thumbnails),
                outline,
                bookmarks,
                annotations
              }
            : t
        )
      );
    }

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    setActiveTabId(tabId);
    setIsHomeActive(false);
    setCurrentDoc(targetTab.doc);
    setTotalPages(targetTab.totalPages);
    setCurrentPage(targetTab.currentPage || 1);

    // 1. FAST ZERO-RELOAD PATH: Document is already in memory in pdfEngine!
    if (pdfEngine.hasDocument(tabId, targetTab.fingerprint)) {
      pdfEngine.switchDocument(tabId, targetTab.fingerprint);

      // Restore saved annotations & bookmarks immediately
      const savedAnnotations = targetTab.annotations || storageService.getAnnotations(targetTab.fingerprint);
      const savedBookmarks = targetTab.bookmarks || storageService.getBookmarks(targetTab.fingerprint);
      setAnnotations(savedAnnotations);
      setBookmarks(savedBookmarks);

      // Restore cached outline immediately (instant, zero delay)
      if (targetTab.outline && targetTab.outline.length > 0) {
        setOutline(targetTab.outline);
      } else {
        pdfEngine.getOutline().then((items) => {
          if (activeTabIdRef.current === tabId) {
            setOutline(items);
          }
          setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, outline: items } : t)));
        });
      }

      // Restore cached thumbnails immediately (instant, zero delay)
      if (targetTab.thumbnails && targetTab.thumbnails.size > 0) {
        setThumbnails(targetTab.thumbnails);
      } else {
        generateInitialThumbnails(targetTab.totalPages, tabId);
      }

      // Instant seamless switch without any loading spinner!
      return;
    }

    // 2. Cold Tab: If data buffer is cached, load it into engine
    if (targetTab.data && targetTab.data.byteLength > 0) {
      setIsLoadingDoc(true);
      try {
        await pdfEngine.loadDocument(targetTab.data.slice(0), targetTab.id, targetTab.fingerprint);
        const savedAnnotations = storageService.getAnnotations(targetTab.fingerprint);
        const savedBookmarks = storageService.getBookmarks(targetTab.fingerprint);
        setAnnotations(savedAnnotations);
        setBookmarks(savedBookmarks);

        // Fetch outline & thumbnails in background
        pdfEngine.getOutline().then((items) => {
          if (activeTabIdRef.current === tabId) {
            setOutline(items);
          }
          setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, outline: items } : t)));
        });
        generateInitialThumbnails(targetTab.totalPages, tabId);
      } catch (e) {
        console.error('Error reloading tab document buffer:', e);
      } finally {
        setIsLoadingDoc(false);
      }
    } else {
      await loadDocumentFromInfo(targetTab.doc);
    }
  };

  // Core Tab Close Execution (Unloads from PDF engine, saves progress, switches active tab)
  const executeCloseTabs = useCallback(
    (tabIds: string[], preferredActiveTabId?: string) => {
      if (tabIds.length === 0) return;

      // Save current tab progress if closing the active document
      if (currentDoc && tabIds.includes(currentDoc.id)) {
        storageService.saveLastReadPage(currentDoc.fingerprint, currentPage);
      }

      // Clean up memory from pdfEngine for all closing tabs to prevent memory leaks
      tabIds.forEach((id) => pdfEngine.unloadDocument(id));

      // ZERO-STORAGE CONSUMPTION: Auto-purge temporary cached binary data when closing tabs
      if (settings.autoPurgeCacheOnTabClose !== false) {
        tabs.filter((t) => tabIds.includes(t.id)).forEach((closingTab) => {
          // If the document has no persistent local path or is not pinned in the permanent library, delete temporary binary from IndexedDB
          const isInLibrary = libraryDocs.some(
            (d) => d.id === closingTab.id || (d.fingerprint && d.fingerprint === closingTab.fingerprint)
          );
          if (!closingTab.doc.path || !isInLibrary) {
            storageService.deleteDocumentData(closingTab.id, closingTab.fingerprint, closingTab.doc.name);
          }
        });
      }

      setTabs((prevTabs) => {
        const remainingTabs = prevTabs.filter((t) => !tabIds.includes(t.id));
        storageService.saveOpenTabs(remainingTabs.map((t) => t.doc));

        if (remainingTabs.length === 0) {
          setActiveTabId(null);
          setCurrentDoc(null);
          setIsHomeActive(true);
          storageService.saveActiveTabId(null);
        } else if (activeTabId && tabIds.includes(activeTabId)) {
          // Determine next tab
          let nextTab: PDFTabItem | undefined;
          if (preferredActiveTabId && remainingTabs.some((t) => t.id === preferredActiveTabId)) {
            nextTab = remainingTabs.find((t) => t.id === preferredActiveTabId);
          } else {
            const closedIdx = prevTabs.findIndex((t) => t.id === activeTabId);
            const nextIdx = Math.max(0, Math.min(closedIdx, remainingTabs.length - 1));
            nextTab = remainingTabs[nextIdx];
          }
          if (nextTab) {
            const targetId = nextTab.id;
            setTimeout(() => {
              handleSelectTab(targetId);
            }, 0);
          }
        }
        return remainingTabs;
      });
    },
    [currentDoc, currentPage, activeTabId, handleSelectTab]
  );

  const executeCloseTab = useCallback(
    (tabId: string) => executeCloseTabs([tabId]),
    [executeCloseTabs]
  );

  // Protected Tab Close Request: Intercepts tabs with unsaved changes and prompts confirmation modal
  const requestCloseTabs = useCallback(
    (tabIdsToClose: string[], preferredActiveTabId?: string) => {
      if (tabIdsToClose.length === 0) return;

      const targetTabs = tabs.filter((t) => tabIdsToClose.includes(t.id));
      if (targetTabs.length === 0) return;

      // Find any dirty documents in the requested batch
      const dirtyTabs = targetTabs.filter((t) => {
        const inService = pdfSaveService.isDirty(t.fingerprint);
        const inTab = Boolean(t.isDirty);
        const isActiveDoc = currentDoc && (t.id === currentDoc.id || t.fingerprint === currentDoc.fingerprint);
        const isActiveDirty = isActiveDoc && pdfSaveService.isDirty(currentDoc.fingerprint);
        return inService || inTab || isActiveDirty;
      });

      if (dirtyTabs.length === 0) {
        // No unsaved modifications - close immediately in batch
        executeCloseTabs(tabIdsToClose, preferredActiveTabId);
        return;
      }

      // Prompt confirmation modal for first dirty tab
      setPendingCloseState({
        tab: dirtyTabs[0],
        allTargetTabIds: tabIdsToClose,
        preferredActiveTabId
      });
    },
    [tabs, currentDoc, executeCloseTabs]
  );

  // Close Tab Handler
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    requestCloseTabs([tabId]);
  };

  // Move / Reorder Tab Handler (Drag & Drop or Direct Position Change)
  const handleMoveTab = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setTabs((prevTabs) => {
      if (fromIndex >= prevTabs.length || toIndex >= prevTabs.length) return prevTabs;
      const updated = [...prevTabs];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      storageService.saveOpenTabs(updated.map((t) => t.doc));
      return updated;
    });
  };

  // Move Tab Relatively (Left, Right, Start, End)
  const handleMoveTabRelative = (tabId: string, direction: 'left' | 'right' | 'start' | 'end') => {
    setTabs((prevTabs) => {
      const idx = prevTabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return prevTabs;

      let targetIdx = idx;
      if (direction === 'left') targetIdx = Math.max(0, idx - 1);
      else if (direction === 'right') targetIdx = Math.min(prevTabs.length - 1, idx + 1);
      else if (direction === 'start') targetIdx = 0;
      else if (direction === 'end') targetIdx = prevTabs.length - 1;

      if (targetIdx === idx) return prevTabs;

      const updated = [...prevTabs];
      const [movedItem] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, movedItem);
      storageService.saveOpenTabs(updated.map((t) => t.doc));
      return updated;
    });
  };

  // Close All Other Tabs (Protected against unsaved modifications)
  const handleCloseOtherTabs = (tabId: string) => {
    const tabsToClose = tabs.filter((t) => t.id !== tabId).map((t) => t.id);
    requestCloseTabs(tabsToClose, tabId);
  };

  // Close Tabs to the Right of Target Tab
  const handleCloseTabsToRight = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1 || idx === tabs.length - 1) return;
    const tabsToClose = tabs.slice(idx + 1).map((t) => t.id);
    requestCloseTabs(tabsToClose, tabId);
  };

  // Close Tabs to the Left of Target Tab
  const handleCloseTabsToLeft = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx <= 0) return;
    const tabsToClose = tabs.slice(0, idx).map((t) => t.id);
    requestCloseTabs(tabsToClose, tabId);
  };

  // Close Window Request Protection
  const handleCloseWindowRequest = async () => {
    const dirtyTabs = tabs.filter((t) => {
      const inService = pdfSaveService.isDirty(t.fingerprint);
      const inTab = Boolean(t.isDirty);
      const isActiveDoc = currentDoc && (t.id === currentDoc.id || t.fingerprint === currentDoc.fingerprint);
      const isActiveDirty = isActiveDoc && pdfSaveService.isDirty(currentDoc.fingerprint);
      return inService || inTab || isActiveDirty;
    });

    if (dirtyTabs.length > 0) {
      requestCloseTabs(tabs.map((t) => t.id));
      return;
    }
    await closeWindow();
  };

  // Unsaved Document Close Modal Handlers
  const handleCancelCloseModal = useCallback(() => {
    setPendingCloseState(null);
    setIsModalSaving(false);
  }, []);

  const handleDiscardCloseModal = useCallback(() => {
    if (!pendingCloseState) return;
    const closingTab = pendingCloseState.tab;
    const allTargets = pendingCloseState.allTargetTabIds;
    const preferredActive = pendingCloseState.preferredActiveTabId;

    // Discard modifications for this tab
    pdfSaveService.markClean(closingTab.fingerprint);
    executeCloseTab(closingTab.id);

    const remainingTargets = allTargets.filter((id) => id !== closingTab.id);
    const nextDirtyTabs = tabs.filter(
      (t) =>
        remainingTargets.includes(t.id) &&
        (t.isDirty || pdfSaveService.isDirty(t.fingerprint))
    );

    if (nextDirtyTabs.length > 0) {
      setPendingCloseState({
        tab: nextDirtyTabs[0],
        allTargetTabIds: remainingTargets,
        preferredActiveTabId: preferredActive
      });
    } else {
      executeCloseTabs(remainingTargets, preferredActive);
      setPendingCloseState(null);
    }
  }, [pendingCloseState, tabs, executeCloseTab, executeCloseTabs]);

  const handleSaveCloseModal = useCallback(async () => {
    if (!pendingCloseState) return;
    const closingTab = pendingCloseState.tab;
    const allTargets = pendingCloseState.allTargetTabIds;
    const preferredActive = pendingCloseState.preferredActiveTabId;

    setIsModalSaving(true);
    try {
      const annotationsToSave =
        closingTab.id === activeTabId
          ? annotations
          : closingTab.annotations || storageService.getAnnotations(closingTab.fingerprint);
      const bookmarksToSave =
        closingTab.id === activeTabId
          ? bookmarks
          : closingTab.bookmarks || storageService.getBookmarks(closingTab.fingerprint);

      const res = await pdfSaveService.saveDocument(
        closingTab.doc,
        annotationsToSave,
        bookmarksToSave
      );

      if (res.success) {
        addToast(`Saved changes for ${closingTab.doc.name}`, 'success');
      } else {
        addToast(res.message, 'error');
      }

      pdfSaveService.markClean(closingTab.fingerprint);
      executeCloseTab(closingTab.id);

      const remainingTargets = allTargets.filter((id) => id !== closingTab.id);
      const nextDirtyTabs = tabs.filter(
        (t) =>
          remainingTargets.includes(t.id) &&
          (t.isDirty || pdfSaveService.isDirty(t.fingerprint))
      );

      if (nextDirtyTabs.length > 0) {
        setPendingCloseState({
          tab: nextDirtyTabs[0],
          allTargetTabIds: remainingTargets,
          preferredActiveTabId: preferredActive
        });
      } else {
        executeCloseTabs(remainingTargets, preferredActive);
        setPendingCloseState(null);
      }
    } catch (err: any) {
      addToast(`Error saving document: ${err?.message || 'Save failed'}`, 'error');
      setPendingCloseState(null);
    } finally {
      setIsModalSaving(false);
    }
  }, [pendingCloseState, activeTabId, annotations, bookmarks, tabs, executeCloseTab, executeCloseTabs, addToast]);

  // Duplicate Tab
  const handleDuplicateTab = (tabId: string) => {
    setTabs((prevTabs) => {
      const idx = prevTabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return prevTabs;
      const orig = prevTabs[idx];
      const newTabId = `${orig.doc.id}_dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const duplicatedTab: PDFTabItem = {
        ...orig,
        id: newTabId,
        data: orig.data ? orig.data.slice(0) : undefined
      };
      const updated = [...prevTabs];
      updated.splice(idx + 1, 0, duplicatedTab);
      storageService.saveOpenTabs(updated.map((t) => t.doc));
      setTimeout(() => {
        handleSelectTab(newTabId);
      }, 0);
      return updated;
    });
  };

  // Switch to Next / Previous Tab (Ctrl+Tab, Ctrl+Shift+Tab)
  const handleCycleTab = (direction: 'next' | 'prev') => {
    if (tabs.length <= 1) return;
    const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
    let targetIdx = 0;
    if (currentIdx !== -1) {
      if (direction === 'next') {
        targetIdx = (currentIdx + 1) % tabs.length;
      } else {
        targetIdx = (currentIdx - 1 + tabs.length) % tabs.length;
      }
    }
    handleSelectTab(tabs[targetIdx].id);
  };

  // Toggle Home View
  const handleToggleHome = () => {
    if (tabs.length === 0 || !currentDoc) {
      setIsHomeActive(true);
      return;
    }
    setIsHomeActive((prev) => !prev);
  };

  // Smart Viewport Fit Calculations (Fit Entire Page or Fit Width)
  const calculateFit = async (type: 'fit-page' | 'fit-width') => {
    const viewportEl = document.getElementById('pdf-viewport');
    if (!viewportEl) return;

    const containerWidth = viewportEl.clientWidth;
    const containerHeight = viewportEl.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const dim = await pdfEngine.getPageDimension(currentPage || 1);
    const isTwoPage = settings.viewMode === 'two-page';

    if (type === 'fit-page') {
      const availableWidth = isTwoPage ? (containerWidth - 28) / 2 : containerWidth - 16;
      const availableHeight = containerHeight - 20;

      const scaleW = availableWidth / dim.width;
      const scaleH = availableHeight / dim.height;
      const optimalScale = Math.max(0.35, Math.min(2.5, Math.min(scaleW, scaleH)));

      handleUpdateSettings({
        zoom: Number(optimalScale.toFixed(2)),
        fitMode: 'fit-page'
      });
    } else {
      const availableWidth = isTwoPage ? (containerWidth - 28) / 2 : containerWidth - 16;
      const optimalScale = Math.max(0.35, Math.min(3.0, availableWidth / dim.width));

      handleUpdateSettings({
        zoom: Number(optimalScale.toFixed(2)),
        fitMode: 'fit-width'
      });
    }
  };

  // Recalculate fit on window resize
  useEffect(() => {
    const onResize = () => {
      if (settings.fitMode === 'fit-page') {
        calculateFit('fit-page');
      } else if (settings.fitMode === 'fit-width') {
        calculateFit('fit-width');
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [settings.fitMode, settings.viewMode, currentPage]);

  // Page Navigation
  const handlePageChange = useCallback(
    (page: number) => {
      const validPage = Math.min(totalPages, Math.max(1, page));
      setCurrentPage(validPage);
      if (currentDoc) {
        storageService.saveLastReadPage(currentDoc.fingerprint, validPage);
      }
      // Also update in active tab
      if (activeTabId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, currentPage: validPage } : t))
        );
      }
    },
    [totalPages, currentDoc, activeTabId]
  );

  // Bookmarks
  const isCurrentPageBookmarked = bookmarks.some((b) => b.pageNumber === currentPage);

  const handleToggleBookmark = () => {
    if (!currentDoc) return;
    storageService.toggleBookmark(currentDoc.fingerprint, currentPage);
    const updated = storageService.getBookmarks(currentDoc.fingerprint);
    setBookmarks(updated);
    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, bookmarks: updated } : t))
      );
    }
  };

  const handleDeleteBookmark = (pageNumber: number) => {
    if (!currentDoc) return;
    storageService.toggleBookmark(currentDoc.fingerprint, pageNumber);
    const updated = storageService.getBookmarks(currentDoc.fingerprint);
    setBookmarks(updated);
    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, bookmarks: updated } : t))
      );
    }
  };

  const getToolDescription = (tool: string) => {
    switch (tool) {
      case 'highlight':
        return 'Highlight';
      case 'pen':
        return 'Pen Drawing';
      case 'note':
        return 'Sticky Note';
      case 'underline':
        return 'Underline';
      case 'strike':
        return 'Strikethrough';
      default:
        return 'Annotation';
    }
  };

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (!currentDoc) return;
    const action = historyTracker.undo(currentDoc.fingerprint);
    if (!action) return;

    setHistoryVersion((v) => v + 1);

    if (action.type === 'add_annotation' && action.annotation) {
      // Inverse: delete the annotation
      storageService.deleteAnnotation(currentDoc.fingerprint, action.annotation.id);
      const updated = storageService.getAnnotations(currentDoc.fingerprint);
      setAnnotations(updated);
      pdfSaveService.markDirty(currentDoc.fingerprint);
      if (activeTabId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
        );
      }
      addToast(`Undid: ${action.description}`, 'info', 'Redo', () => handleRedoRef.current());
    } else if (action.type === 'delete_annotation' && action.annotation) {
      // Inverse: restore the annotation
      storageService.addAnnotation(currentDoc.fingerprint, action.annotation);
      const updated = storageService.getAnnotations(currentDoc.fingerprint);
      setAnnotations(updated);
      pdfSaveService.markDirty(currentDoc.fingerprint);
      if (activeTabId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
        );
      }
      addToast(`Restored: ${action.description}`, 'info', 'Undo', () => handleUndoRef.current());
    }
  }, [currentDoc, activeTabId, addToast]);

  const handleRedo = useCallback(() => {
    if (!currentDoc) return;
    const action = historyTracker.redo(currentDoc.fingerprint);
    if (!action) return;

    setHistoryVersion((v) => v + 1);

    if (action.type === 'add_annotation' && action.annotation) {
      // Re-apply: add the annotation back
      storageService.addAnnotation(currentDoc.fingerprint, action.annotation);
      const updated = storageService.getAnnotations(currentDoc.fingerprint);
      setAnnotations(updated);
      pdfSaveService.markDirty(currentDoc.fingerprint);
      if (activeTabId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
        );
      }
      addToast(`Redid: ${action.description}`, 'info', 'Undo', () => handleUndoRef.current());
    } else if (action.type === 'delete_annotation' && action.annotation) {
      // Re-apply: delete the annotation
      storageService.deleteAnnotation(currentDoc.fingerprint, action.annotation.id);
      const updated = storageService.getAnnotations(currentDoc.fingerprint);
      setAnnotations(updated);
      pdfSaveService.markDirty(currentDoc.fingerprint);
      if (activeTabId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
        );
      }
      addToast(`Redid: ${action.description}`, 'info', 'Undo', () => handleUndoRef.current());
    }
  }, [currentDoc, activeTabId, addToast]);

  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  // File Save Handlers
  const handleSaveFile = async () => {
    if (!currentDoc) return;
    setIsSaving(true);
    try {
      const res = await pdfSaveService.saveDocument(currentDoc, annotations, bookmarks);
      if (res.success) {
        setLastSavedTime(res.timestamp);
        if (activeTabId) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId ? { ...t, isDirty: false, annotations, bookmarks } : t
            )
          );
        }
        addToast(res.message, 'success');
      } else {
        addToast(res.message, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsFile = async () => {
    if (!currentDoc) return;
    setIsSaving(true);
    try {
      // 1. Obtain binary from pdfEngine or active tab buffer
      const activeTab = tabs.find((t) => t.id === activeTabId);
      let binary: Uint8Array | null = await pdfEngine.getDocumentBinary();
      if (!binary && activeTab?.data) {
        binary = new Uint8Array(activeTab.data);
      }

      let saveResult: { success: boolean; message: string; timestamp?: number };

      if (binary && binary.byteLength > 0) {
        const blob = new Blob([binary], { type: 'application/pdf' });
        const defaultName = currentDoc.name.toLowerCase().endsWith('.pdf')
          ? currentDoc.name.replace(/\.pdf$/i, '_copy.pdf')
          : `${currentDoc.name}_copy.pdf`;

        const saved = await tauriBridge.saveFileToDisk(defaultName, blob);
        saveResult = {
          success: saved,
          message: saved ? `Saved copy as ${defaultName}` : 'Save copy cancelled'
        };
      } else {
        saveResult = await pdfSaveService.exportAnnotatedData(currentDoc, annotations, bookmarks);
      }

      if (saveResult.success) {
        // Also persist annotations to ensure synchronization
        await pdfSaveService.saveDocument(currentDoc, annotations, bookmarks);
        setLastSavedTime(Date.now());
        if (activeTabId) {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
          );
        }
        addToast(saveResult.message || `Saved copy of ${currentDoc.name}`, 'success');
      } else {
        addToast(saveResult.message || 'Failed to save file copy', 'error');
      }
    } catch (err: any) {
      addToast(`Save As error: ${err?.message || 'Failed to save copy'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Annotations
  const handleAddAnnotation = (annotation: PDFAnnotation) => {
    if (!currentDoc) return;
    storageService.addAnnotation(currentDoc.fingerprint, annotation);
    const updated = storageService.getAnnotations(currentDoc.fingerprint);
    setAnnotations(updated);

    const desc = `Added ${getToolDescription(annotation.type)} (Page ${annotation.pageNumber})`;
    historyTracker.pushAction(currentDoc.fingerprint, {
      type: 'add_annotation',
      description: desc,
      annotation,
      pageNumber: annotation.pageNumber
    });
    setHistoryVersion((v) => v + 1);
    pdfSaveService.markDirty(currentDoc.fingerprint);

    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
      );
    }

    addToast(desc, 'info', 'Undo', () => handleUndoRef.current());
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    if (!currentDoc) return;
    const toDelete = annotations.find((a) => a.id === annotationId);
    storageService.deleteAnnotation(currentDoc.fingerprint, annotationId);
    const updated = storageService.getAnnotations(currentDoc.fingerprint);
    setAnnotations(updated);

    if (toDelete) {
      const desc = `Deleted ${getToolDescription(toDelete.type)} (Page ${toDelete.pageNumber})`;
      historyTracker.pushAction(currentDoc.fingerprint, {
        type: 'delete_annotation',
        description: desc,
        annotation: toDelete,
        pageNumber: toDelete.pageNumber
      });
      setHistoryVersion((v) => v + 1);
      addToast(desc, 'info', 'Undo', () => handleUndoRef.current());
    }

    pdfSaveService.markDirty(currentDoc.fingerprint);

    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true, annotations: updated } : t))
      );
    }
  };

  // Library Document actions
  const handleToggleFavorite = (docId: string) => {
    storageService.toggleFavorite(docId);
    setLibraryDocs(storageService.getLibrary());
  };

  const handleRenameDocument = async (docId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const cleanName = trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
    const doc = libraryDocs.find((d) => d.id === docId);
    let updatedPath = doc?.path;

    // If native file on local storage, rename file on disk via Tauri
    if (doc?.path && !doc.path.startsWith('sample-') && !doc.path.startsWith('blob:') && !doc.path.startsWith('/local/dropped/')) {
      const result = await tauriBridge.renamePdfFile(doc.path, cleanName);
      if (result.success && result.newPath) {
        updatedPath = result.newPath;
      }
    }

    storageService.renameDocument(docId, cleanName);
    let updatedLib = storageService.getLibrary();
    if (updatedPath && doc && updatedPath !== doc.path) {
      updatedLib = updatedLib.map((d) => (d.id === docId ? { ...d, path: updatedPath! } : d));
      storageService.saveLibrary(updatedLib);
    }
    setLibraryDocs(updatedLib);

    if (currentDoc && currentDoc.id === docId) {
      setCurrentDoc((prev) => (prev ? { ...prev, name: cleanName, path: updatedPath || prev.path } : null));
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === docId ? { ...t, doc: { ...t.doc, name: cleanName, path: updatedPath || t.doc.path } } : t
      )
    );
    addToast(`Renamed to "${cleanName}"`, 'success');
  };

  const handleRemoveFromApp = (docId: string) => {
    const doc = libraryDocs.find((d) => d.id === docId);
    storageService.removeDocument(docId);
    const updated = storageService.getLibrary();
    setLibraryDocs(updated);

    // Remove from open tabs if open
    setTabs((prev) => {
      const remainingTabs = prev.filter((t) => t.id !== docId);
      storageService.saveOpenTabs(remainingTabs.map((t) => t.doc));

      if (activeTabId === docId) {
        if (remainingTabs.length > 0) {
          setTimeout(() => handleSelectTab(remainingTabs[0].id), 0);
        } else {
          setActiveTabId(null);
          setCurrentDoc(null);
          setIsHomeActive(true);
          storageService.saveActiveTabId(null);
        }
      }
      return remainingTabs;
    });

    addToast(`Removed "${doc?.name || 'document'}" from app`, 'info');
  };

  const handleDeleteFromStorage = async (doc: PDFDocumentInfo) => {
    // Delete file from disk storage via Tauri Rust command
    if (doc.path && !doc.path.startsWith('sample-') && !doc.path.startsWith('blob:') && !doc.path.startsWith('/local/dropped/')) {
      const result = await tauriBridge.deletePdfFromStorage(doc.path);
      if (!result.success) {
        addToast(`Failed to delete from disk: ${result.error || 'Permission error'}`, 'error');
        return;
      }
    }

    storageService.removeDocument(doc.id);
    const updated = storageService.getLibrary();
    setLibraryDocs(updated);

    setTabs((prev) => {
      const remainingTabs = prev.filter((t) => t.id !== doc.id);
      storageService.saveOpenTabs(remainingTabs.map((t) => t.doc));

      if (activeTabId === doc.id) {
        if (remainingTabs.length > 0) {
          setTimeout(() => handleSelectTab(remainingTabs[0].id), 0);
        } else {
          setActiveTabId(null);
          setCurrentDoc(null);
          setIsHomeActive(true);
          storageService.saveActiveTabId(null);
        }
      }
      return remainingTabs;
    });

    addToast(`Permanently deleted "${doc.name}" from storage`, 'success');
  };

  const handleDeleteDocument = (docId: string) => {
    handleRemoveFromApp(docId);
  };

  // Scan local directory
  const handleScanDirectory = async () => {
    const scanned = await tauriBridge.scanDirectoryForPdfs('/local/documents');
    if (scanned.length > 0) {
      const samplePdfs = SAMPLE_DOCUMENTS;
      for (let idx = 0; idx < scanned.length; idx++) {
        const f = scanned[idx];
        const sampleToUse = samplePdfs[idx % samplePdfs.length];
        const newDocId = 'scanned-' + idx + '-' + Date.now();
        const fingerprint = 'scanned-' + encodeURIComponent(f.name);
        const sampleData = sampleToUse.getData();

        const newDoc: PDFDocumentInfo = {
          id: newDocId,
          name: f.name,
          path: f.path,
          size: f.size,
          totalPages: sampleToUse.info.totalPages,
          lastOpened: f.lastModified,
          lastPageRead: 1,
          fingerprint,
          category: 'Scanned',
          tags: ['Rust FS']
        };

        storageService.addOrUpdateDocument(newDoc);
        // Persist binary buffer so clicking in Recent or Library will load instantly
        await storageService.saveDocumentData(newDocId, fingerprint, sampleData, f.name);
      }
      setLibraryDocs(storageService.getLibrary());
      addToast(`Scanned ${scanned.length} PDF documents`, 'success');
    }
  };

  // Live Text Search
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query.trim()) {
      setSearchMatches([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await pdfEngine.searchDocument(query);
      setSearchMatches(results);
      setIsSearching(false);
    }, 250);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleOpenFile();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAsFile();
        } else {
          handleSaveFile();
        }
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId, e as any);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleToggleHome();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'PageUp' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        if (activeTabId) {
          handleMoveTabRelative(activeTabId, 'left');
        }
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'PageDown' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (activeTabId) {
          handleMoveTabRelative(activeTabId, 'right');
        }
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Home') {
        e.preventDefault();
        if (activeTabId) {
          handleMoveTabRelative(activeTabId, 'start');
        }
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'End') {
        e.preventDefault();
        if (activeTabId) {
          handleMoveTabRelative(activeTabId, 'end');
        }
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        handleCycleTab('next');
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        handleCycleTab('prev');
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        if (!isHomeActive) {
          e.preventDefault();
          if (settings.viewMode === 'two-page') {
            const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
            if (left + 2 <= totalPages) {
              handlePageChange(left + 2);
            } else if (left + 1 <= totalPages) {
              handlePageChange(totalPages);
            }
          } else {
            handlePageChange(Math.min(totalPages, currentPage + 1));
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (!isHomeActive) {
          e.preventDefault();
          if (settings.viewMode === 'two-page') {
            const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
            handlePageChange(Math.max(1, left - 2));
          } else {
            handlePageChange(Math.max(1, currentPage - 1));
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === '9') {
        e.preventDefault();
        calculateFit('fit-page');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        calculateFit('fit-width');
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleUpdateSettings({ showSidebar: !settings.showSidebar });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleToggleBookmark();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleUpdateSettings({ zoom: Math.min(3.0, settings.zoom + 0.15), fitMode: 'custom' });
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleUpdateSettings({ zoom: Math.max(0.5, settings.zoom - 0.15), fitMode: 'custom' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPage,
    totalPages,
    settings,
    activeTabId,
    isHomeActive,
    handlePageChange,
    handleSaveFile,
    handleSaveAsFile,
    handleUndo,
    handleRedo
  ]);

  // Validate that the drag action originates from external OS files, NOT internal tab or UI element dragging
  const isFileDrag = (e: React.DragEvent): boolean => {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  };

  const handleReaderDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    readerDragCounterRef.current += 1;
    if (readerDragCounterRef.current === 1) {
      setIsDraggingFile(true);
    }
  };

  const handleReaderDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleReaderDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    readerDragCounterRef.current = Math.max(0, readerDragCounterRef.current - 1);
    if (readerDragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleReaderDrop = async (e: React.DragEvent) => {
    readerDragCounterRef.current = 0;
    setIsDraggingFile(false);

    if (!isFileDrag(e)) return;

    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      try {
        const existingTab = tabs.find(
          (t) =>
            t.doc.name.toLowerCase() === file.name.toLowerCase() &&
            (t.doc.size === file.size || !t.doc.size)
        );
        if (existingTab && existingTab.data && existingTab.data.byteLength > 0) {
          await handleSelectTab(existingTab.id);
          addToast(`Switched to open tab: ${file.name}`, 'info');
          return;
        }

        const buffer = await file.arrayBuffer();
        const existingInLib = libraryDocs.find(
          (d) =>
            d.name.toLowerCase() === file.name.toLowerCase() &&
            (d.size === file.size || !d.size)
        );
        const uniqueId =
          existingTab?.id ||
          existingInLib?.id ||
          ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        const fingerprint =
          existingTab?.fingerprint ||
          existingInLib?.fingerprint ||
          ('fp-' + encodeURIComponent(file.name) + '-' + file.size);
        const docInfo: PDFDocumentInfo = {
          id: uniqueId,
          name: file.name,
          path: (file as any).path || `/local/dropped/${file.name}`,
          size: file.size,
          totalPages: existingInLib?.totalPages || 1,
          lastOpened: Date.now(),
          lastPageRead: existingInLib?.lastPageRead || 1,
          fingerprint,
          category: existingInLib?.category || 'Imported',
          tags: ['Dropped', 'Local']
        };
        await loadPDFBuffer(buffer, docInfo);
        addToast(`Opened ${file.name}`, 'success');
      } catch (err: any) {
        console.error('Error opening dropped file:', err);
        addToast('Failed to open dropped PDF', 'error');
      }
    }
  };

  const isCurrentDocDirty = currentDoc ? pdfSaveService.isDirty(currentDoc.fingerprint) : false;
  const canUndo = currentDoc ? historyTracker.canUndo(currentDoc.fingerprint) : false;
  const canRedo = currentDoc ? historyTracker.canRedo(currentDoc.fingerprint) : false;
  const undoDescription = currentDoc ? historyTracker.getUndoDescription(currentDoc.fingerprint) : null;
  const redoDescription = currentDoc ? historyTracker.getRedoDescription(currentDoc.fingerprint) : null;
  const historyStack = currentDoc ? historyTracker.getHistoryStack(currentDoc.fingerprint) : [];

  // Always show Home page if explicitly active, or if no file is currently open in tabs
  const shouldShowHome = isHomeActive || tabs.length === 0 || !currentDoc;

  return (
    <div
      id="paperlite-root"
      className={`h-screen w-screen flex flex-col overflow-hidden theme-${settings.theme} select-none`}
    >
      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 1. Top Window Controller Bar: Home Page Button + Browser / WPS Office Multi-Document Tabs + Window Controls */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        isHomeActive={shouldShowHome}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleOpenFile}
        onToggleHome={handleToggleHome}
        onMoveTab={handleMoveTab}
        onMoveTabRelative={handleMoveTabRelative}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseTabsToRight={handleCloseTabsToRight}
        onCloseTabsToLeft={handleCloseTabsToLeft}
        onDuplicateTab={handleDuplicateTab}
        onCloseWindow={handleCloseWindowRequest}
      />

      {/* 2. Secondary Sub-Bar: Clean Minimal Icon-Only Controller Tools Bar Below Top Bar */}
      {!shouldShowHome && currentDoc && totalPages > 0 && !isLoadingDoc && (
        <ControllerBar
          currentPage={currentPage}
          totalPages={totalPages}
          settings={settings}
          activeTool={activeTool}
          activeColor={activeColor}
          isBookmarked={isCurrentPageBookmarked}
          isDirty={isCurrentDocDirty}
          isSaving={isSaving}
          lastSavedTime={lastSavedTime}
          canUndo={canUndo}
          canRedo={canRedo}
          undoDescription={undoDescription}
          redoDescription={redoDescription}
          historyStack={historyStack}
          onToggleSidebar={() =>
            handleUpdateSettings({ showSidebar: !settings.showSidebar })
          }
          onPageChange={handlePageChange}
          onZoomChange={(z) => handleUpdateSettings({ zoom: z, fitMode: 'custom' })}
          onFitWidth={() => calculateFit('fit-width')}
          onFitPage={() => calculateFit('fit-page')}
          onRotate={() =>
            handleUpdateSettings({ rotation: (settings.rotation + 90) % 360 })
          }
          onToggleBookmark={handleToggleBookmark}
          onOpenSearch={() => {
            handleUpdateSettings({ showSidebar: true, sidebarTab: 'search' });
          }}
          onOpenExportModal={() => setIsExportOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          onUpdateSettings={handleUpdateSettings}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
          onSave={handleSaveFile}
          onSaveAs={handleSaveAsFile}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      )}

      {/* 3. Main Workspace: Home View OR Document Viewer (Sidebar + PDF Viewport) */}
      <div id="main-workspace-container" className="flex-1 flex overflow-hidden relative z-0 isolate">
        {shouldShowHome ? (
          <div
            id="home-workspace-area"
            onDragEnter={handleReaderDragEnter}
            onDragOver={handleReaderDragOver}
            onDragLeave={handleReaderDragLeave}
            onDrop={handleReaderDrop}
            className="flex-1 flex flex-col relative overflow-hidden h-full"
          >
            <HomeView
              recentDocs={libraryDocs}
              onOpenDoc={loadDocumentFromInfo}
              onOpenFile={handleOpenFile}
              onOpenLibrary={() => setIsLibraryOpen(true)}
              onScanDirectory={handleScanDirectory}
              onToggleFavorite={handleToggleFavorite}
              onRemoveFromApp={handleRemoveFromApp}
              onRenameDoc={handleRenameDocument}
              onDeleteFromStorage={handleDeleteFromStorage}
            />

            {/* Home Workspace File Drop Indicator */}
            {isDraggingFile && (
              <div className="absolute inset-0 z-40 bg-blue-600/15 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-2xl m-3 flex flex-col items-center justify-center text-blue-900 pointer-events-none animate-in fade-in duration-150">
                <div className="p-5 rounded-2xl bg-white/95 shadow-xl border border-blue-200/80 flex flex-col items-center max-w-xs text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                    <FileUp className="w-6 h-6 animate-bounce" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">Drop PDF to Open</h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Release to import & read document
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Navigation Sidebar */}
            <Sidebar
              isOpen={settings.showSidebar}
              currentPage={currentPage}
              totalPages={totalPages}
              thumbnails={thumbnails}
              outline={outline}
              bookmarks={bookmarks}
              annotations={annotations}
              searchMatches={searchMatches}
              searchQuery={searchQuery}
              isSearching={isSearching}
              activeTab={settings.sidebarTab}
              onTabChange={(tab) => handleUpdateSettings({ sidebarTab: tab })}
              onPageSelect={handlePageChange}
              onSearchQueryChange={handleSearchQueryChange}
              onDeleteBookmark={handleDeleteBookmark}
              onDeleteAnnotation={handleDeleteAnnotation}
              onRequestThumbnail={handleRequestThumbnail}
              onClose={() => handleUpdateSettings({ showSidebar: false })}
            />

            {/* Dedicated Reader Area: Viewport + Drop Target for PDF files */}
            <div
              id="pdf-reader-area"
              onDragEnter={handleReaderDragEnter}
              onDragOver={handleReaderDragOver}
              onDragLeave={handleReaderDragLeave}
              onDrop={handleReaderDrop}
              className="flex-1 flex flex-col relative overflow-hidden h-full"
            >
              {/* Loading / Error States or Main PDF Viewport */}
              {isLoadingDoc ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-stone-100/50">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-mono text-stone-600 mt-3">
                    Decoding PDF structure & vector streams...
                  </p>
                </div>
              ) : errorMessage ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-3">
                    <FileUp className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">Unable to Render PDF</h3>
                  <p className="text-xs text-stone-500 max-w-sm mt-1">{errorMessage}</p>
                  <button
                    onClick={handleOpenFile}
                    className="mt-4 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    Choose Another Document
                  </button>
                </div>
              ) : (
                <PDFViewer
                  documentId={activeTabId || currentDoc?.id || currentDoc?.fingerprint}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  settings={settings}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  annotations={annotations}
                  onPageChange={handlePageChange}
                  onAddAnnotation={handleAddAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onSearchQuery={(q) => {
                    handleSearchQueryChange(q);
                    handleUpdateSettings({ showSidebar: true, sidebarTab: 'search' });
                  }}
                />
              )}

              {/* Optional Floating HUD Toolbar (when visible) */}
              {!isLoadingDoc && totalPages > 0 && isToolbarVisible && (
                <AnnotationToolbar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  viewMode={settings.viewMode}
                  zoom={settings.zoom}
                  isVisible={isToolbarVisible}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  isDirty={isCurrentDocDirty}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onPageChange={handlePageChange}
                  onZoomChange={(z) => handleUpdateSettings({ zoom: z, fitMode: 'custom' })}
                  onFitWidth={() => calculateFit('fit-width')}
                  onFitPage={() => calculateFit('fit-page')}
                  onToggleVisibility={() => setIsToolbarVisible(!isToolbarVisible)}
                  onToolChange={setActiveTool}
                  onColorChange={setActiveColor}
                  onSave={handleSaveFile}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                />
              )}

              {/* Reader Area File Drop Indicator */}
              {isDraggingFile && (
                <div className="absolute inset-0 z-40 bg-blue-600/15 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-2xl m-3 flex flex-col items-center justify-center text-blue-900 pointer-events-none animate-in fade-in duration-150">
                  <div className="p-5 rounded-2xl bg-white/95 shadow-xl border border-blue-200/80 flex flex-col items-center max-w-xs text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                      <FileUp className="w-6 h-6 animate-bounce" />
                    </div>
                    <h3 className="text-sm font-bold text-stone-900">Drop PDF to Read</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Release anywhere in reader to load document
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 4. Modals */}
      <LibraryModal
        isOpen={isLibraryOpen}
        documents={libraryDocs}
        currentDocId={currentDoc?.id}
        onSelectDocument={loadDocumentFromInfo}
        onSelectSample={loadSample}
        onOpenFile={handleOpenFile}
        onScanDirectory={handleScanDirectory}
        onToggleFavorite={handleToggleFavorite}
        onRenameDocument={handleRenameDocument}
        onDeleteDocument={handleDeleteDocument}
        onClose={() => setIsLibraryOpen(false)}
      />

      <ReadingSettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ExportModal
        isOpen={isExportOpen}
        currentDoc={currentDoc}
        annotations={annotations}
        bookmarks={bookmarks}
        onClose={() => setIsExportOpen(false)}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        searchMatches={searchMatches}
        searchQuery={searchQuery}
        isSearching={isSearching}
        onSearchQueryChange={handleSearchQueryChange}
        onSelectMatch={handlePageChange}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* Confirmation Modal when attempting to close tab or window with unsaved changes */}
      <UnsavedChangesModal
        isOpen={Boolean(pendingCloseState)}
        documentName={pendingCloseState?.tab.doc.name || ''}
        isSaving={isModalSaving}
        onSave={handleSaveCloseModal}
        onDiscard={handleDiscardCloseModal}
        onCancel={handleCancelCloseModal}
      />

      {/* 6. Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
