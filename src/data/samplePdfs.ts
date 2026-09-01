import { PDFDocumentInfo } from '../types';
import { generateSamplePdf } from './samplePdfBuilder';

export interface SampleDocumentItem {
  info: PDFDocumentInfo;
  getData: () => ArrayBuffer;
}

export const SAMPLE_DOCUMENTS: SampleDocumentItem[] = [
  {
    info: {
      id: 'sample-paperlite-manual',
      name: 'PaperLite User Manual & Architecture.pdf',
      path: '/local/documents/PaperLite_User_Manual.pdf',
      size: 148200,
      totalPages: 3,
      lastOpened: Date.now() - 1000 * 60 * 15,
      lastPageRead: 1,
      fingerprint: 'manual-fp-001',
      isFavorite: true,
      category: 'Manuals',
      tags: ['Tauri', 'Architecture', 'iOS Style', 'Shortcuts']
    },
    getData: () => generateSamplePdf('guide')
  },
  {
    info: {
      id: 'sample-typography-guide',
      name: 'The Elements of Typographic Style.pdf',
      path: '/local/books/Elements_of_Typographic_Style.pdf',
      size: 96400,
      totalPages: 2,
      lastOpened: Date.now() - 1000 * 60 * 60 * 2,
      lastPageRead: 1,
      fingerprint: 'typo-fp-002',
      isFavorite: true,
      category: 'Design',
      tags: ['Typography', 'Minimalism', 'Books']
    },
    getData: () => generateSamplePdf('typography')
  },
  {
    info: {
      id: 'sample-minimalist-software',
      name: 'Principles of Minimalist Software.pdf',
      path: '/local/research/Minimalist_Software_Design.pdf',
      size: 84300,
      totalPages: 2,
      lastOpened: Date.now() - 1000 * 60 * 60 * 24,
      lastPageRead: 1,
      fingerprint: 'minimal-fp-003',
      isFavorite: false,
      category: 'Research',
      tags: ['Software', 'Simplicity', 'Clean Code']
    },
    getData: () => generateSamplePdf('minimalism')
  },
  {
    info: {
      id: 'sample-modern-systems',
      name: 'Modern Systems Programming with Rust.pdf',
      path: '/local/papers/Modern_Systems_Programming.pdf',
      size: 72100,
      totalPages: 1,
      lastOpened: Date.now() - 1000 * 60 * 60 * 48,
      lastPageRead: 1,
      fingerprint: 'systems-fp-004',
      isFavorite: false,
      category: 'Technical',
      tags: ['Rust', 'Tauri', 'Performance']
    },
    getData: () => generateSamplePdf('swift')
  }
];
