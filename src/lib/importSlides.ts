/**
 * Turn the pages picked in the import dialog into slides of the deck.
 *
 * A page that becomes a slide is a PLAIN page (`plainPage: true`): the deck's
 * built-in design — frame, logo, brand lines, title banner and badge — is not
 * painted on it. That is the whole point of the import: the user's own material
 * is merged into the project as a separate slide they can work on, instead of
 * being poured into the project's template and covered by its chrome.
 *
 * The slide is otherwise an ordinary slide: draw shapes and text boxes on it,
 * change its background, add a footnote, or switch the deck design back on with
 * the "Deck design" toggle in the Slide background panel.
 */
import { emptySlide } from "./parse";
import { makeImageShape } from "./shapes";
import { cloneBackground, type SlideData } from "./types";
import type { PdfImportResult } from "./pdf";

/** The file's own name without its extension — used for layer / Uploads labels. */
export const importBaseName = (fileName: string): string => fileName.replace(/\.(pdf|pptx)$/i, "");

/** "slide" for a PowerPoint, "page" for a PDF — the wording the UI uses. */
export const importUnit = (fileName: string): "slide" | "page" => (/\.pptx$/i.test(fileName) ? "slide" : "page");

/**
 * One imported page's name — "chapter 2 · page 4". Used for the Uploads entry
 * and for the picture layer, so the same page reads the same everywhere.
 */
export const importPageLabel = (fileName: string, page: number): string =>
  `${importBaseName(fileName)} · ${importUnit(fileName)} ${page}`;

/**
 * Build the slides for the pages imported as NEW slides (both placements).
 *
 * `startIndex` is the deck length before the insert, so the new slides are
 * numbered on from the slides already there.
 */
export function buildImportedSlides(res: PdfImportResult, startIndex: number): SlideData[] {
  return res.pages.map((p, i) => {
    const s = emptySlide(startIndex + i + 1);
    // a page of the user's own — no question, no options, no footnote, and none
    // of the deck's built-in design on top of it
    s.question = "";
    s.options = [];
    s.note = "";
    s.plainPage = true;
    if (res.placement === "slides-background") {
      // the page IS the slide: a background override that also clears the deck's
      // gradient / vector design, so nothing of the template shows through
      s.background = { ...cloneBackground(), src: p.src, fit: "contain" };
      // no question is painted, so the number bullet has nothing to number
      s.themeOverride = { ...(s.themeOverride ?? {}), showBullet: false, showNumber: false };
    } else {
      // a picture on an otherwise empty slide — movable, croppable, resizable
      const img = makeImageShape(p.src, p.ratio, 60);
      s.shapes = [{ ...img, name: importPageLabel(res.name, p.page), importedPage: true }];
      s.themeOverride = { ...(s.themeOverride ?? {}), showBullet: false, showNumber: false };
    }
    return s;
  });
}
