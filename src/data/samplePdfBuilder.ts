/**
 * Minimalist, zero-dependency PDF 1.4 Binary Generator
 * Generates valid multi-page standard PDF ArrayBuffers with text, vector formatting, and metadata
 */

export function generateSamplePdf(type: 'guide' | 'typography' | 'swift' | 'minimalism'): ArrayBuffer {
  let pagesContent: string[] = [];
  let title = 'PaperLite Document';

  if (type === 'guide') {
    title = 'PaperLite User Manual & Architecture';
    pagesContent = [
      `BT
/F1 24 Tf
50 720 Td
(PaperLite PDF Reader) Tj
0 -36 Td
/F2 13 Tf
(A Lightweight iOS-Style Desktop Reader for Tauri & Rust) Tj
0 -40 Td
/F1 16 Tf
(1. Key Features & Capabilities) Tj
0 -26 Td
/F2 11 Tf
(- High-Performance Page Virtualization: Zero memory leaks with dynamic canvas recycling.) Tj
0 -18 Td
(- Native Rust File System Access: High throughput disk I/O and secure sandboxing.) Tj
0 -18 Td
(- iOS Human Interface Design: Translucent frosted glass bars, rounded controls, gesture zoom.) Tj
0 -18 Td
(- Annotations & Markups: Multi-color text highlighting, freehand ink, notes, and bookmarks.) Tj
0 -18 Td
(- Instant Full-Text Search: Fast inverted-index scanning across all document pages.) Tj
0 -18 Td
(- Paper Color Modes: Natural Day, Warm Sepia, Soft Paper, and Dark Contrast themes.) Tj
0 -40 Td
/F1 16 Tf
(2. Keyboard Shortcuts) Tj
0 -24 Td
/F2 11 Tf
(  [Right Arrow / Space]     Next page) Tj
0 -18 Td
(  [Left Arrow / Shift+Space] Previous page) Tj
0 -18 Td
(  [Cmd/Ctrl + +]             Zoom In) Tj
0 -18 Td
(  [Cmd/Ctrl + -]             Zoom Out) Tj
0 -18 Td
(  [Cmd/Ctrl + 0]             Reset Zoom to Fit Width) Tj
0 -18 Td
(  [Cmd/Ctrl + F]             Find in Document) Tj
0 -18 Td
(  [Cmd/Ctrl + B]             Toggle Sidebar) Tj
0 -18 Td
(  [Cmd/Ctrl + D]             Bookmark Current Page) Tj
ET`,
      `BT
/F1 20 Tf
50 720 Td
(3. Memory Architecture & Performance) Tj
0 -32 Td
/F2 11 Tf
(Traditional web PDF viewers often experience severe memory leaks when scrolling) Tj
0 -18 Td
(through large 500+ page documents because rendered canvas bitmaps remain allocated) Tj
0 -18 Td
(in GPU memory indefinitely. PaperLite implements a strict Viewport Virtualizer:) Tj
0 -28 Td
/F1 13 Tf
(Virtual Page Recycling Pipeline:) Tj
0 -22 Td
/F2 11 Tf
(1. Intersection Observer monitors visible page coordinates with a 1-page prefetch margin.) Tj
0 -18 Td
(2. Active pages initialize a high-DPI HTML5 canvas context scaled to devicePixelRatio.) Tj
0 -18 Td
(3. Off-screen pages immediately discard their 2D canvas buffer (width=0, height=0),) Tj
0 -18 Td
(   freeing up to 95% of volatile VRAM.) Tj
0 -18 Td
(4. Text layers and annotations are preserved in lightweight JSON metadata.) Tj
0 -40 Td
/F1 16 Tf
(4. Local SQLite & Tauri IPC Bridge) Tj
0 -24 Td
/F2 11 Tf
(All reading states, annotation rects, and library indexes are persisted securely) Tj
0 -18 Td
(to disk using structured local storage and native Tauri invoke calls.) Tj
ET`,
      `BT
/F1 20 Tf
50 720 Td
(5. Typography & Eye Comfort) Tj
0 -32 Td
/F2 11 Tf
(PaperLite incorporates optical reading standards inspired by Apple Books and paper printing:) Tj
0 -28 Td
/F1 13 Tf
(Color Science:) Tj
0 -22 Td
/F2 11 Tf
(- Sepia Mode: Calibrated 2800K warm tint that eliminates blue light strain at night.) Tj
0 -18 Td
(- Warm Paper: High-fidelity natural bleached pulp simulation with 92% reflectance.) Tj
0 -18 Td
(- Dark Contrast: High contrast deep charcoal background for low-light environments.) Tj
0 -36 Td
/F1 16 Tf
(6. Export & Portability) Tj
0 -24 Td
/F2 11 Tf
(You can export your annotated PDFs, extract note summaries into Markdown, or) Tj
0 -18 Td
(print directly with all highlights and ink vectors composited at native 300 DPI.) Tj
0 -40 Td
/F2 10 Tf
(Thank you for choosing PaperLite PDF. Enjoy your distraction-free reading experience!) Tj
ET`
    ];
  } else if (type === 'typography') {
    title = 'The Elements of Typographic Style';
    pagesContent = [
      `BT
/F1 24 Tf
50 720 Td
(The Elements of Typographic Style) Tj
0 -36 Td
/F2 13 Tf
(Reflections on Craft, Form, and Spatial Harmony) Tj
0 -44 Td
/F1 16 Tf
(Chapter I: The Grand Design) Tj
0 -26 Td
/F2 11 Tf
(Typography exists to honor content. Like bread making or architecture,) Tj
0 -18 Td
(it is an ancient craft with practical functions and profound aesthetic dimension.) Tj
0 -18 Td
(In a world overflowing with visual noise, well-set type brings clarity and poise.) Tj
0 -32 Td
/F1 14 Tf
(Proportion and Optical Balance) Tj
0 -22 Td
/F2 11 Tf
(The relationship between line height (leading), measure (line length), and font size) Tj
0 -18 Td
(must form a musical proportion. A standard measure of 65 to 75 characters per line) Tj
0 -18 Td
(provides the ideal cadence for the human saccadic eye movement.) Tj
ET`,
      `BT
/F1 20 Tf
50 720 Td
(Chapter II: Rhythm & Proportion) Tj
0 -32 Td
/F2 11 Tf
(Spacing is the essence of typography. What is unprinted matters just as much) Tj
0 -18 Td
(as the ink deposited on the page.) Tj
0 -28 Td
/F1 14 Tf
(Hierarchy without Clutter) Tj
0 -22 Td
/F2 11 Tf
(Achieve contrast through weight, scale, and spatial distribution rather than) Tj
0 -18 Td
(mixing discordant typefaces. Good design is as little design as possible.) Tj
ET`
    ];
  } else if (type === 'minimalism') {
    title = 'Principles of Minimalist Software';
    pagesContent = [
      `BT
/F1 24 Tf
50 720 Td
(Principles of Minimalist Software) Tj
0 -36 Td
/F2 13 Tf
(Designing Fast, Focused, and Humane Tools) Tj
0 -44 Td
/F1 16 Tf
(1. The Value of Constraints) Tj
0 -26 Td
/F2 11 Tf
(Modern desktop applications have grown bloated. A simple document viewer) Tj
0 -18 Td
(frequently consumes hundreds of megabytes of RAM and displays dozens of) Tj
0 -18 Td
(irrelevant toolbar buttons.) Tj
0 -32 Td
/F1 14 Tf
(2. Zero-Friction User Experience) Tj
0 -22 Td
/F2 11 Tf
(A document reader should disappear behind the document itself. The typography,) Tj
0 -18 Td
(page turning, and annotations should feel as immediate as physical paper.) Tj
ET`,
      `BT
/F1 20 Tf
50 720 Td
(3. Offline-First & Data Sovereignty) Tj
0 -32 Td
/F2 11 Tf
(Your personal documents belong strictly on your local disk. They should not) Tj
0 -18 Td
(be uploaded to opaque cloud servers without explicit user instruction.) Tj
0 -24 Td
/F2 11 Tf
(PaperLite utilizes local native Rust filesystem channels to ensure 100% privacy.) Tj
ET`
    ];
  } else {
    title = 'Swift & Rust Modern Systems Design';
    pagesContent = [
      `BT
/F1 24 Tf
50 720 Td
(Modern Systems Programming) Tj
0 -36 Td
/F2 13 Tf
(Architecture for High-Performance Desktop Apps) Tj
0 -44 Td
/F1 16 Tf
(Memory Safety & Zero-Cost Abstractions) Tj
0 -26 Td
/F2 11 Tf
(Rust provides memory safety guarantees without a garbage collector through) Tj
0 -18 Td
(its strict ownership model. Combined with Tauri and a lightweight WebView,) Tj
0 -18 Td
(it delivers desktop apps that start in milliseconds and use minimal RAM.) Tj
ET`
    ];
  }

  return assemblePdf(title, pagesContent);
}

function assemblePdf(title: string, pages: string[]): ArrayBuffer {
  const pageObjects: string[] = [];
  const contentObjects: string[] = [];

  const pageObjIds: number[] = [];
  let currentObjId = 4; // 1: Catalog, 2: Outlines, 3: Pages

  for (let i = 0; i < pages.length; i++) {
    const pageObjId = currentObjId++;
    const contentObjId = currentObjId++;
    pageObjIds.push(pageObjId);

    const streamData = pages[i];
    const streamLen = streamData.length;

    contentObjects.push(
      `${contentObjId} 0 obj\r\n<<\r\n  /Length ${streamLen}\r\n>>\r\nstream\r\n${streamData}\r\nendstream\r\nendobj`
    );

    pageObjects.push(
      `${pageObjId} 0 obj\r\n<<\r\n  /Type /Page\r\n  /Parent 3 0 R\r\n  /MediaBox [ 0 0 612 792 ]\r\n  /Contents ${contentObjId} 0 R\r\n  /Resources <<\r\n    /Font <<\r\n      /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\r\n      /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\r\n    >>\r\n  >>\r\n>>\r\nendobj`
    );
  }

  const catalog = `1 0 obj\r\n<<\r\n  /Type /Catalog\r\n  /Pages 3 0 R\r\n  /Outlines 2 0 R\r\n>>\r\nendobj`;
  const outlines = `2 0 obj\r\n<<\r\n  /Type /Outlines\r\n  /Count 0\r\n>>\r\nendobj`;
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  const pagesRoot = `3 0 obj\r\n<<\r\n  /Type /Pages\r\n  /Kids [ ${kidsStr} ]\r\n  /Count ${pages.length}\r\n>>\r\nendobj`;

  const allObjs = [
    catalog,
    outlines,
    pagesRoot,
    ...pageObjects,
    ...contentObjects
  ];

  let body = '%PDF-1.4\r\n%\xE2\xE3\xCF\xD3\r\n';
  const xrefOffsets: number[] = [0];

  for (let i = 0; i < allObjs.length; i++) {
    xrefOffsets.push(body.length);
    body += allObjs[i] + '\r\n';
  }

  const xrefStart = body.length;
  body += `xref\r\n0 ${allObjs.length + 1}\r\n`;
  body += `0000000000 65535 f \r\n`;
  for (let i = 1; i <= allObjs.length; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
    body += `${offsetStr} 00000 n \r\n`;
  }

  const hexHash = Array.from(title).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(32, '0').slice(0, 32);
  body += `trailer\r\n<<\r\n  /Size ${allObjs.length + 1}\r\n  /Root 1 0 R\r\n  /Info << /Title (${title}) >>\r\n  /ID [ <${hexHash}> <${hexHash}> ]\r\n>>\r\nstartxref\r\n${xrefStart}\r\n%%EOF\r\n`;

  const buffer = new ArrayBuffer(body.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < body.length; i++) {
    view[i] = body.charCodeAt(i) & 0xff;
  }
  return buffer;
}
