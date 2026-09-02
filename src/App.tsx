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
import { pdfEngine } from './services/pdfEngine';
import { storageService } from './services/storageService';
import { tauriBridge } from './services/tauriBridge';
import { historyTracker } from './services/historyTracker';
import { pdfSaveService } from './services/pdfSaveService';
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
  const [isHomeActive, setIsHomeActive] = useState(false);

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

  const searchDebounceRef = useRef<any>(null);

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

    // 1. Check if application was launched with a PDF file argument (e.g. Windows double-click association)
    tauriBridge.getLaunchFile().then((launchFile) => {
      if (launchFile) {
        openPdfFromPath(launchFile);
        return;
      }

      // If no launch file argument, restore previous session or open first doc
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
          loadDocumentFromInfo(targetDoc);
          return;
        }
      }

      if (docs.length > 0) {
        // Auto-open first document
        loadDocumentFromInfo(docs[0]);
      } else {
        loadSample(SAMPLE_DOCUMENTS[0].info.id);
      }
    });

    // 2. Listen for runtime file open events (e.g. user double-clicks another PDF while app is already running)
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
    if (tabs.length > 0) {
      storageService.saveOpenTabs(tabs.map((t) => t.doc));
    }
    if (activeTabId) {
      storageService.saveActiveTabId(activeTabId);
    }
  }, [tabs, activeTabId]);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      storageService.saveSettings(updated);
      return updated;
    });
  };

  // Load PDF Binary Buffer into PDF Engine & manage tab state
  const loadPDFBuffer = async (data: ArrayBuffer, docInfo: PDFDocumentInfo) => {
    setIsLoadingDoc(true);
    setErrorMessage(null);
    setThumbnails(new Map());
    setOutline([]);

    try {
      const result = await pdfEngine.loadDocument(data);
      const numPages = result.numPages;
      setTotalPages(numPages);

      const tabId = docInfo.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
      const fingerprint = docInfo.fingerprint || result.fingerprint || tabId;
      const lastPage = storageService.getLastReadPage(fingerprint) || 1;
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
        const existingIdx = prevTabs.findIndex((t) => t.id === tabId);
        const newTabItem: PDFTabItem = {
          id: tabId,
          doc: updatedInfo,
          data,
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
      pdfEngine.getOutline().then((items) => setOutline(items));

      // Generate initial thumbnails in background
      generateInitialThumbnails(numPages);
    } catch (err: any) {
      console.error('Failed to parse PDF document:', err);
      setErrorMessage(err?.message || 'Could not load PDF document. Please verify the file format.');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const generateInitialThumbnails = async (numPages: number) => {
    const limit = Math.min(numPages, 16);
    const newThumbs = new Map<number, string>();
    for (let i = 1; i <= limit; i++) {
      try {
        const url = await pdfEngine.renderThumbnail(i, 140);
        if (url) {
          newThumbs.set(i, url);
          setThumbnails(new Map(newThumbs));
        }
      } catch {
        // Ignored
      }
    }
  };

  // Load Document from Library Info
  const loadDocumentFromInfo = async (docInfo: PDFDocumentInfo) => {
    // Check if already in tabs
    const existingTab = tabs.find((t) => t.id === docInfo.id);
    if (existingTab && existingTab.data) {
      handleSelectTab(existingTab.id);
      return;
    }

    // Check if it's one of the built-in sample docs
    const sample = SAMPLE_DOCUMENTS.find(
      (s) => s.info.id === docInfo.id || s.info.fingerprint === docInfo.fingerprint
    );
    if (sample) {
      const buffer = sample.getData();
      await loadPDFBuffer(buffer, docInfo);
      return;
    }

    // Try reading via Tauri Rust fs or fallback sample
    if (docInfo.path) {
      const bin = await tauriBridge.readBinaryFile(docInfo.path);
      if (bin) {
        await loadPDFBuffer(bin, docInfo);
        return;
      }
    }

    // Fallback: generate default guide sample
    const fallbackBuffer = SAMPLE_DOCUMENTS[0].getData();
    await loadPDFBuffer(fallbackBuffer, docInfo);
  };

  // Open PDF directly from local disk path (e.g. Windows file association double-click, CLI argument, or event)
  const openPdfFromPath = async (filePath: string) => {
    if (!filePath) return false;
    try {
      const fileName = filePath.split(/[\\/]/).pop() || 'Document.pdf';
      const binary = await tauriBridge.readBinaryFile(filePath);
      if (binary && binary.byteLength > 0) {
        const uniqueId = 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const docInfo: PDFDocumentInfo = {
          id: uniqueId,
          name: fileName,
          path: filePath,
          size: binary.byteLength,
          totalPages: 1,
          lastOpened: Date.now(),
          lastPageRead: 1,
          fingerprint: 'fp-' + fileName + '-' + binary.byteLength + '-' + uniqueId,
          category: 'Imported',
          tags: ['Default Reader', 'Local']
        };
        await loadPDFBuffer(binary, docInfo);
        return true;
      }
    } catch (err) {
      console.error('Failed to open PDF from path:', filePath, err);
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
    const file = await tauriBridge.pickPdfFile();
    if (file) {
      const uniqueId = 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const docInfo: PDFDocumentInfo = {
        id: uniqueId,
        name: file.name,
        path: file.path,
        size: file.size,
        totalPages: 1,
        lastOpened: Date.now(),
        lastPageRead: 1,
        fingerprint: 'fp-' + file.name + '-' + file.size + '-' + uniqueId,
        category: 'Imported',
        tags: ['Local']
      };
      await loadPDFBuffer(file.data, docInfo);
    }
  };

  // Tab Switching Handler
  const handleSelectTab = async (tabId: string) => {
    if (activeTabId === tabId && !isHomeActive) return;

    // Save current progress on active tab before switching
    if (currentDoc) {
      storageService.saveLastReadPage(currentDoc.fingerprint, currentPage);
    }

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    setActiveTabId(tabId);
    setIsHomeActive(false);
    setCurrentDoc(targetTab.doc);
    setTotalPages(targetTab.totalPages);
    setCurrentPage(targetTab.currentPage || 1);

    // If data buffer is cached, load it into engine
    if (targetTab.data) {
      setIsLoadingDoc(true);
      try {
        await pdfEngine.loadDocument(targetTab.data);
        const savedAnnotations = storageService.getAnnotations(targetTab.fingerprint);
        const savedBookmarks = storageService.getBookmarks(targetTab.fingerprint);
        setAnnotations(savedAnnotations);
        setBookmarks(savedBookmarks);

        // Fetch outline & thumbnails
        pdfEngine.getOutline().then((items) => setOutline(items));
        generateInitialThumbnails(targetTab.totalPages);
      } catch (e) {
        console.error('Error reloading tab document buffer:', e);
      } finally {
        setIsLoadingDoc(false);
      }
    } else {
      await loadDocumentFromInfo(targetTab.doc);
    }
  };

  // Close Tab Handler
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // Save current tab progress if closing the active document
    if (currentDoc && currentDoc.id === tabId) {
      storageService.saveLastReadPage(currentDoc.fingerprint, currentPage);
    }

    setTabs((prevTabs) => {
      const remainingTabs = prevTabs.filter((t) => t.id !== tabId);
      storageService.saveOpenTabs(remainingTabs.map((t) => t.doc));

      if (activeTabId === tabId) {
        if (remainingTabs.length > 0) {
          const closedIdx = prevTabs.findIndex((t) => t.id === tabId);
          const nextIdx = Math.max(0, Math.min(closedIdx, remainingTabs.length - 1));
          const nextTab = remainingTabs[nextIdx];
          setTimeout(() => {
            handleSelectTab(nextTab.id);
          }, 0);
        } else {
          setActiveTabId(null);
          setCurrentDoc(null);
          setIsHomeActive(true);
          storageService.saveActiveTabId(null);
        }
      }
      return remainingTabs;
    });
  };

  // Toggle Home View
  const handleToggleHome = () => {
    setIsHomeActive(!isHomeActive);
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
      addToast(`Undid: ${action.description}`, 'info', 'Redo', handleRedo);
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
      addToast(`Restored: ${action.description}`, 'info', 'Undo', handleUndo);
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
      addToast(`Redid: ${action.description}`, 'info', 'Undo', handleUndo);
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
      addToast(`Redid: ${action.description}`, 'info', 'Undo', handleUndo);
    }
  }, [currentDoc, activeTabId, addToast]);

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
      const res = await pdfSaveService.exportAnnotatedData(currentDoc, annotations, bookmarks);
      if (res.success) {
        setLastSavedTime(res.timestamp);
        if (activeTabId) {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
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

    addToast(desc, 'info', 'Undo', handleUndo);
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
      addToast(desc, 'info', 'Undo', handleUndo);
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

  const handleRenameDocument = (docId: string, newName: string) => {
    storageService.renameDocument(docId, newName);
    setLibraryDocs(storageService.getLibrary());
    if (currentDoc && currentDoc.id === docId) {
      setCurrentDoc({ ...currentDoc, name: newName });
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === docId ? { ...t, doc: { ...t.doc, name: newName } } : t
      )
    );
  };

  const handleDeleteDocument = (docId: string) => {
    storageService.removeDocument(docId);
    const updated = storageService.getLibrary();
    setLibraryDocs(updated);
    // Remove from open tabs
    setTabs((prev) => prev.filter((t) => t.id !== docId));
    if (currentDoc && currentDoc.id === docId) {
      if (updated.length > 0) {
        loadDocumentFromInfo(updated[0]);
      } else {
        setActiveTabId(null);
        setCurrentDoc(null);
        setIsHomeActive(true);
      }
    }
  };

  // Scan local directory
  const handleScanDirectory = async () => {
    const scanned = await tauriBridge.scanDirectoryForPdfs('/local/documents');
    if (scanned.length > 0) {
      const samplePdfs = SAMPLE_DOCUMENTS;
      scanned.forEach((f, idx) => {
        const sampleToUse = samplePdfs[idx % samplePdfs.length];
        const newDoc: PDFDocumentInfo = {
          id: 'scanned-' + idx + '-' + Date.now(),
          name: f.name,
          path: f.path,
          size: f.size,
          totalPages: sampleToUse.info.totalPages,
          lastOpened: f.lastModified,
          lastPageRead: 1,
          fingerprint: 'scanned-' + f.name,
          category: 'Scanned',
          tags: ['Rust FS']
        };
        storageService.addOrUpdateDocument(newDoc);
      });
      setLibraryDocs(storageService.getLibrary());
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
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleOpenFile();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
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
    handleUndo,
    handleRedo
  ]);

  // Drag and Drop PDF File into window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      const buffer = await file.arrayBuffer();
      const docInfo: PDFDocumentInfo = {
        id: 'doc-dropped-' + Date.now(),
        name: file.name,
        path: `/local/dropped/${file.name}`,
        size: file.size,
        totalPages: 1,
        lastOpened: Date.now(),
        lastPageRead: 1,
        fingerprint: 'fp-' + file.name + '-' + file.size,
        category: 'Imported',
        tags: ['Dropped']
      };
      await loadPDFBuffer(buffer, docInfo);
    }
  };

  const isCurrentDocDirty = currentDoc ? pdfSaveService.isDirty(currentDoc.fingerprint) : false;
  const canUndo = currentDoc ? historyTracker.canUndo(currentDoc.fingerprint) : false;
  const canRedo = currentDoc ? historyTracker.canRedo(currentDoc.fingerprint) : false;
  const undoDescription = currentDoc ? historyTracker.getUndoDescription(currentDoc.fingerprint) : null;
  const redoDescription = currentDoc ? historyTracker.getRedoDescription(currentDoc.fingerprint) : null;
  const historyStack = currentDoc ? historyTracker.getHistoryStack(currentDoc.fingerprint) : [];

  return (
    <div
      id="paperlite-root"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-screen w-screen flex flex-col overflow-hidden theme-${settings.theme} select-none`}
    >
      {/* 1. Top Window Controller Bar: Home Page Button + Browser / WPS Office Multi-Document Tabs + Window Controls */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        isHomeActive={isHomeActive}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleOpenFile}
        onToggleHome={handleToggleHome}
      />

      {/* 2. Secondary Sub-Bar: Clean Minimal Icon-Only Controller Tools Bar Below Top Bar */}
      {!isHomeActive && currentDoc && totalPages > 0 && !isLoadingDoc && (
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
      <div className="flex-1 flex overflow-hidden relative">
        {isHomeActive ? (
          <HomeView
            recentDocs={libraryDocs}
            onOpenDoc={loadDocumentFromInfo}
            onOpenSample={loadSample}
            onOpenFile={handleOpenFile}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onScanDirectory={handleScanDirectory}
            onToggleFavorite={handleToggleFavorite}
          />
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
              onClose={() => handleUpdateSettings({ showSidebar: false })}
            />

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
          </>
        )}
      </div>

      {/* 4. Drag and Drop File Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex flex-col items-center justify-center text-blue-900 animate-in fade-in">
          <FileUp className="w-16 h-16 animate-bounce" />
          <h3 className="text-lg font-bold mt-2">Drop PDF File to Read Instantly</h3>
          <p className="text-xs text-blue-700 font-mono">
            Fast Rust filesystem parsing & local indexing
          </p>
        </div>
      )}

      {/* 5. Modals */}
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

      {/* 6. Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
