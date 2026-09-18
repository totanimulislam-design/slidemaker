/**
 * Test double for `src/lib/pdf.ts`, used by the import suite.
 *
 * The suite drives the REAL page picker inside the real App, but jsdom has no
 * canvas, so pdf.js cannot rasterise a page here. Everything but the document
 * opener is the real module (`export *`); `openDocument` is replaced by a
 * renderer that hands back fixed data-URLs. The suite asserts the picker showed
 * these pages, which is also the proof that this double — and not pdf.js — was
 * the one in play.
 */
export * from "../src/lib/pdf";

/** The "rendered" pages the picker will offer, one per document page. */
export const STUB_PAGES = ["data:image/jpeg;base64,IMPORTEDPAGE1", "data:image/jpeg;base64,IMPORTEDPAGE2"];

/** what the double reports for every page: 4:3, 800×600 */
export const STUB_RATIO = 4 / 3;

const page = (n: number) => ({
  src: STUB_PAGES[Math.min(Math.max(n, 1), STUB_PAGES.length) - 1],
  ratio: STUB_RATIO,
  width: 800,
  height: 600,
});

/** how many pages every "document" the double opens has */
export const STUB_PAGE_COUNT = STUB_PAGES.length;

export async function openDocument(file: File) {
  return {
    name: file.name,
    numPages: STUB_PAGE_COUNT,
    pageRatio: async () => STUB_RATIO,
    thumbnail: async (n: number) => page(n),
    render: async (n: number) => page(n),
    destroy: () => {},
  };
}
