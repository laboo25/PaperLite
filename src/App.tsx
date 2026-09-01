import { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { ControllerBar } from './components/ControllerBar';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { AnnotationToolbar } from './components/AnnotationToolbar';
import { LibraryModal } from './components/LibraryModal';
import { ReadingSettingsModal } from './components/ReadingSettingsModal';
import { ExportModal } from './components/ExportModal';
import { SearchModal } from './components/SearchModal';
import { pdfEngine } from './services/pdfEngine';
import { storageService } from './services/storageService';
import { tauriBridge } from './services/tauriBridge';
import { SAMPLE_DOCUMENTS } from './data/samplePdfs';
import {
  AnnotationTool,
  PDFAnnotation,
  PDFBookmark,
  PDFDocumentInfo,
  PDFOutlineItem,
  ReaderSettings,
  SearchMatch
} from './types';
import { FileUp, Loader2 } from 'lucide-react';

export default function App() {
  // Document State
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
  const [isControllerBarOpen, setIsControllerBarOpen] = useState(true);

  // Modals & Drawers
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Library State
  const [libraryDocs, setLibraryDocs] = useState<PDFDocumentInfo[]>([]);

  const searchDebounceRef = useRef<any>(null);

  // Load Library on startup
  useEffect(() => {
    const docs = storageService.getLibrary();
    setLibraryDocs(docs);

    // Auto-open first document or manual
    if (docs.length > 0) {
      loadDocumentFromInfo(docs[0]);
    } else {
      loadSample(SAMPLE_DOCUMENTS[0].info.id);
    }
  }, []);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      storageService.saveSettings(updated);
      return updated;
    });
  };

  // Load PDF Binary Buffer into PDF Engine
  const loadPDFBuffer = async (data: ArrayBuffer, docInfo: PDFDocumentInfo) => {
    setIsLoadingDoc(true);
    setErrorMessage(null);
    setThumbnails(new Map());
    setOutline([]);

    try {
      const result = await pdfEngine.loadDocument(data);
      setTotalPages(result.numPages);

      const fingerprint = result.fingerprint || docInfo.fingerprint;
      const lastPage = storageService.getLastReadPage(fingerprint) || 1;
      const validPage = Math.min(result.numPages, Math.max(1, lastPage));

      const updatedInfo: PDFDocumentInfo = {
        ...docInfo,
        totalPages: result.numPages,
        fingerprint,
        name: result.title || docInfo.name
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

      // Fetch Outline
      pdfEngine.getOutline().then((items) => setOutline(items));

      // Generate initial thumbnails in background
      generateInitialThumbnails(result.numPages);
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
    // Check if it's one of the built-in sample docs
    const sample = SAMPLE_DOCUMENTS.find((s) => s.info.id === docInfo.id || s.info.fingerprint === docInfo.fingerprint);
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
      const docInfo: PDFDocumentInfo = {
        id: 'doc-' + Date.now(),
        name: file.name,
        path: file.path,
        size: file.size,
        totalPages: 1,
        lastOpened: Date.now(),
        lastPageRead: 1,
        fingerprint: 'fp-' + file.name + '-' + file.size,
        category: 'Imported',
        tags: ['Local']
      };
      await loadPDFBuffer(file.data, docInfo);
    }
  };

  // Scan local directory simulation (Rust std::fs)
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
      const availableWidth = isTwoPage ? (containerWidth - 56) / 2 : containerWidth - 48;
      const availableHeight = containerHeight - 48;

      const scaleW = availableWidth / dim.width;
      const scaleH = availableHeight / dim.height;
      const optimalScale = Math.max(0.35, Math.min(2.5, Math.min(scaleW, scaleH)));

      handleUpdateSettings({
        zoom: Number(optimalScale.toFixed(2)),
        fitMode: 'fit-page'
      });
    } else {
      const availableWidth = isTwoPage ? (containerWidth - 56) / 2 : containerWidth - 48;
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
    },
    [totalPages, currentDoc]
  );

  // Bookmarks
  const isCurrentPageBookmarked = bookmarks.some((b) => b.pageNumber === currentPage);

  const handleToggleBookmark = () => {
    if (!currentDoc) return;
    storageService.toggleBookmark(currentDoc.fingerprint, currentPage);
    setBookmarks(storageService.getBookmarks(currentDoc.fingerprint));
  };

  const handleDeleteBookmark = (pageNumber: number) => {
    if (!currentDoc) return;
    storageService.toggleBookmark(currentDoc.fingerprint, pageNumber);
    setBookmarks(storageService.getBookmarks(currentDoc.fingerprint));
  };

  // Annotations
  const handleAddAnnotation = (annotation: PDFAnnotation) => {
    if (!currentDoc) return;
    storageService.addAnnotation(currentDoc.fingerprint, annotation);
    setAnnotations(storageService.getAnnotations(currentDoc.fingerprint));
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    if (!currentDoc) return;
    storageService.deleteAnnotation(currentDoc.fingerprint, annotationId);
    setAnnotations(storageService.getAnnotations(currentDoc.fingerprint));
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
  };

  const handleDeleteDocument = (docId: string) => {
    storageService.removeDocument(docId);
    const updated = storageService.getLibrary();
    setLibraryDocs(updated);
    if (currentDoc && currentDoc.id === docId) {
      if (updated.length > 0) {
        loadDocumentFromInfo(updated[0]);
      } else {
        loadSample(SAMPLE_DOCUMENTS[0].info.id);
      }
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
      // Ignore if typing inside input / textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
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
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (settings.viewMode === 'two-page') {
          const left = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
          handlePageChange(Math.max(1, left - 2));
        } else {
          handlePageChange(Math.max(1, currentPage - 1));
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === '9') {
        e.preventDefault();
        calculateFit('fit-page');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        calculateFit('fit-width');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        handleUpdateSettings({ showSidebar: !settings.showSidebar });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
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
  }, [currentPage, settings, handlePageChange]);

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

  return (
    <div
      id="paperlite-root"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-screen w-screen flex flex-col overflow-hidden theme-${settings.theme} select-none`}
    >
      {/* 1. iOS Title Bar */}
      <TitleBar
        currentDoc={currentDoc}
        currentPage={currentPage}
        totalPages={totalPages}
        settings={settings}
        isBookmarked={isCurrentPageBookmarked}
        isControllerBarOpen={isControllerBarOpen}
        onToggleSidebar={() =>
          handleUpdateSettings({ showSidebar: !settings.showSidebar })
        }
        onToggleControllerBar={() => setIsControllerBarOpen(!isControllerBarOpen)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenFile={handleOpenFile}
        onToggleBookmark={handleToggleBookmark}
        onOpenSearch={() => {
          handleUpdateSettings({ showSidebar: true, sidebarTab: 'search' });
        }}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenExportModal={() => setIsExportOpen(true)}
      />

      {/* 1b. Top Sub-Bar: Clean ControllerBar */}
      {isControllerBarOpen && totalPages > 0 && !isLoadingDoc && (
        <ControllerBar
          currentPage={currentPage}
          totalPages={totalPages}
          settings={settings}
          activeTool={activeTool}
          activeColor={activeColor}
          isBookmarked={isCurrentPageBookmarked}
          onPageChange={handlePageChange}
          onZoomChange={(z) => handleUpdateSettings({ zoom: z, fitMode: 'custom' })}
          onFitWidth={() => calculateFit('fit-width')}
          onFitPage={() => calculateFit('fit-page')}
          onRotate={() =>
            handleUpdateSettings({ rotation: (settings.rotation + 90) % 360 })
          }
          onToggleBookmark={handleToggleBookmark}
          onUpdateSettings={handleUpdateSettings}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
        />
      )}

      {/* 2. Main Workspace (Sidebar + PDF Viewport) */}
      <div className="flex-1 flex overflow-hidden relative">
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
              className="mt-4 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-xs"
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

        {/* Floating Annotation & Zoom Toolbar (iOS Capsule HUD) */}
        {!isLoadingDoc && totalPages > 0 && (
          <AnnotationToolbar
            currentPage={currentPage}
            totalPages={totalPages}
            viewMode={settings.viewMode}
            zoom={settings.zoom}
            isVisible={isToolbarVisible}
            activeTool={activeTool}
            activeColor={activeColor}
            onPageChange={handlePageChange}
            onZoomChange={(z) => handleUpdateSettings({ zoom: z, fitMode: 'custom' })}
            onFitWidth={() => calculateFit('fit-width')}
            onFitPage={() => calculateFit('fit-page')}
            onToggleVisibility={() => setIsToolbarVisible(!isToolbarVisible)}
            onToolChange={setActiveTool}
            onColorChange={setActiveColor}
          />
        )}
      </div>

      {/* 3. Drag and Drop File Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex flex-col items-center justify-center text-blue-900 animate-in fade-in">
          <FileUp className="w-16 h-16 animate-bounce" />
          <h3 className="text-lg font-bold mt-2">Drop PDF File to Read Instantly</h3>
          <p className="text-xs text-blue-700 font-mono">
            Fast Rust filesystem parsing & local indexing
          </p>
        </div>
      )}

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
    </div>
  );
}
