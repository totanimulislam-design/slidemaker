/**
 * PDF import — pages are rasterised with pdf.js so they can be used as
 * ordinary pictures (an image layer, a slide background, an Uploads item).
 *
 * The worker is bundled into the main thread on purpose: the app ships as a
 * single HTML file (vite-plugin-singlefile), so spawning a separate worker
 * script is unreliable there. Rendering a handful of pages is fast enough.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

export const isPdfFile = (f: File): boolean =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const isPptxFile = (f: File): boolean => f.type === PPTX_MIME || /\.pptx$/i.test(f.name);

/** PDF or PPTX — anything the "Import slides" picker can open. */
export const isDeckFile = (f: File): boolean => isPdfFile(f) || isPptxFile(f);

/** `accept` attribute for file inputs that take a ready-made deck. */
export const DECK_ACCEPT = `application/pdf,.pdf,${PPTX_MIME},.pptx`;

export interface PdfPageRender {
  src: string;
  /** width / height */
  ratio: number;
  width: number;
  height: number;
}

/**
 * Where the picked pages go:
 *
 *  • `slides-background` — every page becomes its OWN slide with the page as
 *    that slide's background. The slide is a PLAIN page (`plainPage`): the
 *    deck's built-in design stays off it, so the imported page is merged into
 *    the project as a separate slide of the user's own to work on.
 *  • `slides-image` — every page becomes its own plain slide carrying the page
 *    as a movable / croppable picture layer.
 *  • `current-slide` — the pages are dropped onto the slide being edited, on top
 *    of whatever design that slide already has.
 */
export type PdfPlacement = "slides-background" | "slides-image" | "current-slide";

/** The rendered pages the picker hands back to the app. */
export interface PdfImportResult {
  placement: PdfPlacement;
  pages: { page: number; src: string; ratio: number }[];
  /** the file's name — decides the labels and the Uploads entries */
  name: string;
}

export interface OpenedPdf {
  name: string;
  numPages: number;
  /** aspect ratio (w / h) of a page, without rendering it */
  pageRatio: (page: number) => Promise<number>;
  /** small JPEG preview for the picker grid */
  thumbnail: (page: number, maxSide?: number) => Promise<PdfPageRender>;
  /** full-quality render for the slide (longest side ≈ `maxSide` px) */
  render: (page: number, maxSide?: number) => Promise<PdfPageRender>;
  destroy: () => void;
}

let libPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function lib() {
  if (!libPromise) {
    libPromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // main-thread worker: pdf.js picks it up through globalThis.pdfjsWorker
      // @ts-expect-error — the worker bundle ships without type declarations
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = worker;
      return pdfjs;
    })();
  }
  return libPromise;
}

async function renderPage(doc: PDFDocumentProxy, pageNo: number, maxSide: number, quality: number, mime: string): Promise<PdfPageRender> {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const scale = maxSide / Math.max(base.width, base.height);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  // PDFs are transparent by default; a page is expected to be white paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const src = canvas.toDataURL(mime, quality);
  page.cleanup();
  return { src, ratio: canvas.width / canvas.height, width: canvas.width, height: canvas.height };
}

/** Opens a PDF or a PPTX with the matching renderer. */
export async function openDocument(file: File): Promise<OpenedPdf> {
  if (isPptxFile(file)) {
    const { openPptx } = await import("./pptx");
    return openPptx(file);
  }
  return openPdf(file);
}

export async function openPdf(file: File): Promise<OpenedPdf> {
  const pdfjs = await lib();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const thumbs = new Map<number, Promise<PdfPageRender>>();
  return {
    name: file.name,
    numPages: doc.numPages,
    pageRatio: async (n) => {
      const p = await doc.getPage(n);
      const vp = p.getViewport({ scale: 1 });
      return vp.width / vp.height;
    },
    thumbnail: (n, maxSide = 220) => {
      let t = thumbs.get(n);
      if (!t) {
        t = renderPage(doc, n, maxSide, 0.8, "image/jpeg");
        thumbs.set(n, t);
      }
      return t;
    },
    render: (n, maxSide = 2000) => renderPage(doc, n, maxSide, 0.9, "image/jpeg"),
    destroy: () => void task.destroy(),
  };
}

/**
 * Parses a page-range string ("1-3, 7, 10-") into sorted unique 1-based
 * page numbers clamped to `max`. Returns [] for empty / unparseable input.
 */
export function parsePageRange(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const raw of input.split(/[,\s;]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d*)\s*[-–]\s*(\d*)$/);
    if (m) {
      const a = m[1] ? parseInt(m[1], 10) : 1;
      const b = m[2] ? parseInt(m[2], 10) : max;
      if (!m[1] && !m[2]) continue;
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(max, Math.max(a, b));
      for (let i = lo; i <= hi; i++) out.add(i);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Inverse of parsePageRange: [1,2,3,5] → "1-3, 5" */
export function formatPageRange(pages: number[]): string {
  const s = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i + 1 ? `${s[i]}-${s[j]}` : j === i + 1 ? `${s[i]}, ${s[j]}` : `${s[i]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

/* ------------------------------------------------------------------ bus --- */
/**
 * Panels buried in the inspector can hand a PDF / PPTX to the app-level page picker
 * without threading a prop through every layer.
 */
const PDF_EVENT = "slidemaker:open-pdf";
export function requestPdfImport(file: File) {
  window.dispatchEvent(new CustomEvent<File>(PDF_EVENT, { detail: file }));
}
export function onPdfImportRequest(handler: (file: File) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<File>).detail);
  window.addEventListener(PDF_EVENT, fn);
  return () => window.removeEventListener(PDF_EVENT, fn);
}
