import { PDFDocumentInfo } from '../types';

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  multiple?: boolean;
  filters?: FileDialogFilter[];
  directory?: boolean;
  title?: string;
}

export interface TauriScannedFile {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  extension: string;
}

export class TauriBridge {
  private isTauriAvailable = false;

  constructor() {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      this.isTauriAvailable = true;
    }
  }

  isNativeDesktop(): boolean {
    return this.isTauriAvailable;
  }

  /**
   * Invokes native Rust Tauri command
   */
  async invokeRustCommand<T = any>(command: string, args: Record<string, any> = {}): Promise<T> {
    if (this.isTauriAvailable) {
      const tauri = (window as any).__TAURI__;
      return await tauri.core.invoke(command, args);
    }
    // Simulation / fallback
    console.debug(`[Rust Tauri Mock Bridge] invoke('${command}', ${JSON.stringify(args)})`);
    return null as any;
  }

  /**
   * Opens native system file dialog to pick PDF files
   */
  async pickPdfFile(): Promise<{ name: string; path?: string; data: ArrayBuffer; size: number } | null> {
    if (this.isTauriAvailable) {
      try {
        const dialog = (window as any).__TAURI__.dialog;
        const fs = (window as any).__TAURI__.fs;
        const selected = await dialog.open({
          multiple: false,
          filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
        });

        if (typeof selected === 'string') {
          const contents = await fs.readFile(selected);
          const name = selected.split(/[\\/]/).pop() || 'Document.pdf';
          return {
            name,
            path: selected,
            data: contents.buffer,
            size: contents.byteLength
          };
        }
      } catch (err) {
        console.warn('Native dialog failed, falling back to web file picker:', err);
      }
    }

    // Standard HTML5 File picker fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.style.display = 'none';
      
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          const buffer = await file.arrayBuffer();
          resolve({
            name: file.name,
            path: `/local/imported/${file.name}`,
            data: buffer,
            size: file.size
          });
        } else {
          resolve(null);
        }
        document.body.removeChild(input);
      };

      input.oncancel = () => {
        resolve(null);
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Checks if the app was launched with a PDF file argument (e.g. Windows double-click association)
   */
  async getLaunchFile(): Promise<string | null> {
    if (this.isTauriAvailable) {
      try {
        const file = await this.invokeRustCommand<string | null>('get_cli_launch_file');
        if (file) return file;
      } catch (err) {
        console.warn('Failed to get CLI launch file:', err);
      }
    }
    
    // Check URL parameters fallback (e.g. ?file=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fileParam = params.get('file') || params.get('pdf');
      if (fileParam) return fileParam;
    }

    return null;
  }

  /**
   * Sets up listeners for external file open events (Windows double-click when app is already open, or drag-and-drop)
   */
  async listenToFileOpenEvents(callback: (filePath: string) => void): Promise<() => void> {
    const unlisteners: Array<() => void> = [];

    if (this.isTauriAvailable) {
      try {
        const event = (window as any).__TAURI__?.event;
        if (event && typeof event.listen === 'function') {
          const unlisten = await event.listen('open-pdf-file', (e: any) => {
            if (e && e.payload && typeof e.payload === 'string') {
              callback(e.payload);
            }
          });
          unlisteners.push(unlisten);
        }
      } catch (err) {
        console.warn('Could not register Tauri file event listener:', err);
      }
    }

    return () => {
      unlisteners.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }

  /**
   * Reads raw binary from local filesystem path via Tauri Rust fs module or invoke
   */
  async readBinaryFile(filePath: string): Promise<ArrayBuffer | null> {
    if (this.isTauriAvailable) {
      try {
        // Try native Rust command first
        const rawBytes = await this.invokeRustCommand<number[]>('read_pdf_file_binary', { path: filePath });
        if (rawBytes && Array.isArray(rawBytes)) {
          const uint8 = new Uint8Array(rawBytes);
          return uint8.buffer;
        }

        const fs = (window as any).__TAURI__?.fs;
        if (fs && typeof fs.readFile === 'function') {
          const uint8 = await fs.readFile(filePath);
          return uint8.buffer;
        }
      } catch (err) {
        console.error('Tauri readBinaryFile error:', err);
      }
    }
    return null;
  }

  /**
   * Scans a directory for PDF files (simulating Rust std::fs::read_dir or native Tauri)
   */
  async scanDirectoryForPdfs(dirPath: string): Promise<TauriScannedFile[]> {
    if (this.isTauriAvailable) {
      try {
        return await this.invokeRustCommand<TauriScannedFile[]>('scan_pdf_directory', { dirPath });
      } catch (err) {
        console.warn('Failed native scan_pdf_directory:', err);
      }
    }

    // Return structured simulated scanned files
    return [
      {
        name: 'Design_System_Specification.pdf',
        path: `${dirPath}/Design_System_Specification.pdf`,
        size: 218500,
        lastModified: Date.now() - 3600000 * 5,
        extension: 'pdf'
      },
      {
        name: 'Rust_Async_Handbook.pdf',
        path: `${dirPath}/Rust_Async_Handbook.pdf`,
        size: 512000,
        lastModified: Date.now() - 3600000 * 20,
        extension: 'pdf'
      },
      {
        name: 'Quarterly_Research_Report.pdf',
        path: `${dirPath}/Quarterly_Research_Report.pdf`,
        size: 340100,
        lastModified: Date.now() - 3600000 * 72,
        extension: 'pdf'
      }
    ];
  }

  /**
   * Saves text or binary data to disk
   */
  async saveFileToDisk(fileName: string, content: Blob | string, defaultPath?: string): Promise<boolean> {
    if (this.isTauriAvailable) {
      try {
        const dialog = (window as any).__TAURI__.dialog;
        const fs = (window as any).__TAURI__.fs;
        const filePath = await dialog.save({
          defaultPath: defaultPath || fileName,
          filters: [{ name: 'Document', extensions: [fileName.split('.').pop() || 'txt'] }]
        });

        if (filePath) {
          if (typeof content === 'string') {
            await fs.writeTextFile(filePath, content);
          } else {
            const buffer = await content.arrayBuffer();
            await fs.writeFile(filePath, new Uint8Array(buffer));
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error('Tauri saveFile error:', err);
      }
    }

    // Web download fallback
    try {
      const url = typeof content === 'string'
        ? URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
        : URL.createObjectURL(content);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const tauriBridge = new TauriBridge();
