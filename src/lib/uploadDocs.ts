/**
 * Bringing a PDF / PowerPoint into the app.
 *
 * The file is saved to the Uploads library **as the document itself** — one
 * entry, holding the .pdf (or .pptx) bytes, a cover picture and the page count.
 * It is NOT cut up into one picture per page in the library: the pages you pick
 * in the preview go to the deck, and the document stays there whole, so its
 * preview can be reopened at any time to add other pages.
 *
 * Every entry point uses `openDeckUpload`: the toolbar's 📄 Import PDF / PPTX,
 * a drop or paste on the board, and the upload buttons in the Uploads and
 * Insert shapes panels.
 */
import { openDocument, requestPdfImport } from "./pdf";
import { addDocumentUpload, type UploadedItem } from "./uploads";

/**
 * Saves the file to the library as a document, rendering a small cover picture
 * of its first page for the tile. A file that cannot be read is still kept —
 * the page preview reports the problem, and re-uploading replaces the entry.
 */
export async function saveDocumentUpload(file: File): Promise<UploadedItem> {
  let pages = 0;
  let cover: string | undefined;
  let ratio: number | undefined;
  try {
    const doc = await openDocument(file);
    pages = doc.numPages;
    try {
      const t = await doc.thumbnail(1, 320);
      cover = t.src;
      ratio = t.ratio;
    } catch {
      /* no preview for page 1 — the tile falls back to a PDF badge */
    }
    doc.destroy();
  } catch {
    /* unreadable here, still worth keeping in the library */
  }
  return addDocumentUpload(file, { pages, cover, ratio });
}

/**
 * Saves the document to Uploads and opens its page preview, where the user
 * picks the pages to add. Returns the saving promise so callers that care
 * (the tests) can wait for the entry to be in the library.
 */
export function openDeckUpload(file: File): Promise<UploadedItem> {
  const saving = saveDocumentUpload(file);
  requestPdfImport(file);
  return saving;
}
