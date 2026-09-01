import { useState } from 'react';
import { Share2, FileDown, Printer, Copy, Check, X, FileText } from 'lucide-react';
import { PDFAnnotation, PDFBookmark, PDFDocumentInfo } from '../types';
import { tauriBridge } from '../services/tauriBridge';

interface ExportModalProps {
  isOpen: boolean;
  currentDoc: PDFDocumentInfo | null;
  annotations: PDFAnnotation[];
  bookmarks: PDFBookmark[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  currentDoc,
  annotations,
  bookmarks,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !currentDoc) return null;

  const generateMarkdownSummary = (): string => {
    let md = `# Reading Notes: ${currentDoc.name}\n\n`;
    md += `**Document:** ${currentDoc.name}\n`;
    md += `**Total Pages:** ${currentDoc.totalPages}\n`;
    md += `**Exported At:** ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;

    if (bookmarks.length > 0) {
      md += `## 🔖 Bookmarked Pages\n\n`;
      bookmarks.forEach((b) => {
        md += `- **Page ${b.pageNumber}**: ${b.title}\n`;
      });
      md += `\n---\n\n`;
    }

    if (annotations.length > 0) {
      md += `## ✏️ Highlights & Annotations (${annotations.length})\n\n`;
      annotations.forEach((ann, idx) => {
        md += `### ${idx + 1}. Page ${ann.pageNumber} (${ann.type.toUpperCase()})\n`;
        if (ann.text) {
          md += `> "${ann.text}"\n\n`;
        }
        if (ann.comment) {
          md += `**Note / Thought:** ${ann.comment}\n\n`;
        }
        md += `*Logged on ${new Date(ann.createdAt).toLocaleDateString()}*\n\n`;
      });
    } else {
      md += `*No highlights or notes recorded for this document.*\n`;
    }

    return md;
  };

  const handleCopyMarkdown = () => {
    const md = generateMarkdownSummary();
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadMarkdown = async () => {
    const md = generateMarkdownSummary();
    const fileName = `${currentDoc.name.replace(/\.pdf$/i, '')}_Notes.md`;
    await tauriBridge.saveFileToDisk(fileName, md);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-black/[0.06] flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-stone-900">Export & Share Notes</h2>
              <p className="text-[11px] text-stone-500">
                Extract highlights, bookmarks, and summary to Markdown or Print
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Action 1: Export Markdown */}
            <button
              onClick={handleDownloadMarkdown}
              className="p-4 rounded-xl border border-stone-200 hover:border-blue-500 hover:bg-blue-50/30 text-left transition-all group flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-600 mb-2">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 group-hover:text-blue-600">
                  Save Markdown (.md)
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Export structured notes file for Obsidian, Notion, or local disk.
                </p>
              </div>
            </button>

            {/* Action 2: Print */}
            <button
              onClick={handlePrint}
              className="p-4 rounded-xl border border-stone-200 hover:border-blue-500 hover:bg-blue-50/30 text-left transition-all group flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-stone-100 text-stone-700 mb-2">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 group-hover:text-blue-600">
                  Print Document
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Send current document to system printer or PDF printer.
                </p>
              </div>
            </button>
          </div>

          {/* Notes Preview Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                Notes Summary Preview
              </span>
              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy All'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] font-mono text-stone-700 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
              {generateMarkdownSummary()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/[0.06] bg-stone-50/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
