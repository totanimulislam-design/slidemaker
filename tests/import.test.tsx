/**
 * Imported pages become SEPARATE, PLAIN slides of the user's own, and the file
 * they came from is kept in Uploads AS A DOCUMENT.
 *
 * The bug this suite pins down: a page imported from a PDF used to be poured
 * into the project's template, so the deck's built-in design — frame, logo,
 * brand lines, title banner and badge — kept painting on top of the user's own
 * material. A page now arrives as its own slide with `plainPage` set: none of
 * the project's design is painted on it, the slide is merged into the deck ready
 * to be worked on, and one toggle (Slide background → "Deck design on this
 * slide") brings the project's design back on that slide alone.
 *
 * It also pins down what the Uploads library keeps: the PDF itself — one entry,
 * the file's own bytes, a cover picture and a page count — never one picture per
 * page. Clicking that entry reopens the document's page preview, where the pages
 * to add are picked.
 *
 * The picker is driven for real (open the dialog → pick pages → import); only
 * pdf.js is replaced, by tests/pdf-stub.ts (jsdom has no canvas).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { buildImportedSlides, importPageLabel } from "../src/lib/importSlides";
import { collectLayers } from "../src/lib/layers";
import { clearUploads, documentAsFile, getUploads, removeUpload } from "../src/lib/uploads";
import { openDeckUpload } from "../src/lib/uploadDocs";
import type { Deck, SlideData } from "../src/lib/types";
import { STUB_PAGE_COUNT, STUB_PAGES } from "./pdf-stub";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/* --------------------------------- helpers -------------------------------- */

const KEY = "mcq-slide-studio-v2";

const LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
const TITLE = "MCQ TITLE";
const BRAND_TOP = "LEARN WITH";
const BRAND_BOTTOM = "FAYSAL SIR";
const BADGE = "DAKHIL-26";

const deckNow = (): Deck => JSON.parse(localStorage.getItem(KEY) ?? "null") as Deck;
const slideAt = (i: number): SlideData | undefined => deckNow()?.slides?.[i];

const tick = async (ms = 20) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};
/** the deck writes to localStorage on a 400ms debounce */
const saved = () => tick(450);

/** the board the editor is showing (thumbnails and exports are not editable) */
const board = () => doc.querySelector<HTMLElement>(".slide-editable");
const boardHtml = () => board()?.innerHTML ?? "";
const boardText = () => board()?.textContent ?? "";

/** which pieces of the project's built-in design are painted right now */
const chrome = () => ({
  title: boardText().includes(TITLE),
  brandTop: boardText().includes(BRAND_TOP),
  brandBottom: boardText().includes(BRAND_BOTTOM),
  badge: boardText().includes(BADGE),
  logo: !!board()?.querySelector('img[alt="logo"]'),
  frame: !!board()?.querySelector("[data-frame-image]"),
});
const chromeOn = () => Object.values(chrome()).every(Boolean);
const chromeState = () =>
  Object.entries(chrome())
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(",");

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};
const fire = (target: EventTarget, t: string, x: number, y: number, buttons: number) => {
  act(() => {
    target.dispatchEvent(
      new win.PointerEvent(t, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  });
};
/** open a slide from the rail the way a user does: press, release, click */
const openCard = async (id: string) => {
  const card = doc.querySelector<HTMLElement>(`[data-slide-card="${id}"]`);
  fire(card!, "pointerdown", 20, 20, 1);
  fire(card!, "pointerup", 20, 20, 0);
  click(card);
  await tick();
};
const byText = (needle: RegExp | string) =>
  Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => {
    const t = (b.textContent ?? "").trim();
    return typeof needle === "string" ? t === needle : needle.test(t);
  }) ?? null;

/**
 * Hand a file to the app the way every entry point in the UI does: the toolbar
 * button, a drop or paste on the board and the panels' upload buttons all call
 * `openDeckUpload`, which saves the document to Uploads and opens its preview.
 */
const upload = async (name: string, type: string) => {
  const file = new win.File(["not really a document"], name, { type });
  await act(async () => {
    await openDeckUpload(file);
  });
  await tick(60);
};
/** the dialog's primary button: "Add 2 slides" / "Add 1 page to this slide" */
const importButton = () => byText(/^Add \d+ (slides?|page)/);

/* ---------------------------------- suite --------------------------------- */

export async function runImportTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    KEY,
    JSON.stringify({
      header: {
        title: TITLE,
        brandTop: BRAND_TOP,
        brandBottom: BRAND_BOTTOM,
        badge: BADGE,
        logo: LOGO,
        showLogo: true,
        showBanner: true,
      },
      theme: {
        showFrame: true,
        frame: { style: "wood", image: "/frames/frame-academic.svg", imagePlacement: "fit", color: "#e6a15c" },
        // a deck background design: it must NOT reach an imported page
        background: { design: "glow-top", designW: 100, designH: 100, designOpacity: 1 },
      },
      slides: [
        {
          id: "sl1",
          number: "1",
          question: "Alpha question one?",
          options: [
            { key: "A", text: "a1" },
            { key: "B", text: "b1" },
          ],
          answer: "A",
          scale: 1,
          showAnswer: false,
        },
      ],
    }),
  );

  let root: Root | null = null;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);

  act(() => {
    root = createRoot(doc.getElementById("root")!);
    root.render(createElement(App));
  });
  await tick(60);

  /* --------------------- the deck's own slide: design on -------------------- */
  out.push({
    name: "the project's slide paints its built-in design (frame, logo, brand, title, badge)",
    pass: chromeOn(),
    detail: chromeState() || "nothing painted",
  });
  const designOnOwnSlide = boardHtml().includes("svg+xml");
  out.push({
    name: "…including the deck's background design",
    pass: designOnOwnSlide,
  });

  /* --------------------------- import as background ------------------------ */
  await upload("chapter 2.pdf", "application/pdf");
  const btn = importButton();
  out.push({
    name: "an uploaded PDF opens the page picker with its pages ready to add",
    pass: !!btn,
    detail: btn?.textContent?.trim() ?? "no dialog",
  });

  click(btn);
  await tick(60);
  await saved();

  const deck = deckNow();
  out.push({
    name: "the pages are merged into the project as new slides of the deck",
    pass: deck?.slides.length === 3,
    detail: `slides=${deck?.slides.length}`,
  });
  const imported = slideAt(1);
  out.push({
    name: "each page becomes a separate slide of the user's own (plainPage, page as its background)",
    pass:
      !!imported?.plainPage &&
      imported?.background?.src === STUB_PAGES[0] &&
      imported?.background?.fit === "contain" &&
      imported?.question === "" &&
      imported?.options.length === 0 &&
      imported?.number === "2",
    detail: `plainPage=${imported?.plainPage} fit=${imported?.background?.fit} q="${imported?.question}" n=${imported?.number}`,
  });
  out.push({
    name: "the imported slide carries no deck gradient or vector design of its own",
    pass: !!imported?.background && imported.background.gradient.enabled === false && imported.background.design === "",
    detail: `gradient=${imported?.background?.gradient.enabled} design=${imported?.background?.design}`,
  });

  const onImported = boardHtml().includes("IMPORTEDPAGE1");
  out.push({
    name: "the editor follows the imported slide and paints the page",
    pass: onImported,
  });
  out.push({
    name: "the project's built-in design is NOT painted over the imported page",
    pass: chromeState() === "",
    detail: chromeState() || "clean",
  });
  out.push({
    name: "…and the deck's background design does not bleed through it either",
    pass: !boardHtml().includes("svg+xml"),
  });

  /* --------------------- the project's slide is untouched ------------------ */
  await openCard("sl1");
  out.push({
    name: "the project's own slide still wears its design after the import",
    pass: chromeOn() && boardHtml().includes("svg+xml"),
    detail: chromeState() || "nothing painted",
  });

  /* ------------------------------ layers stack ---------------------------- */
  const d2 = deckNow();
  const plainRows = collectLayers(d2, d2.slides[1]).filter((l) => l.ref.kind === "element");
  const absentOnPlain = plainRows.filter((l) => l.absent).map((l) => l.label);
  const ownRows = collectLayers(d2, d2.slides[0]).filter((l) => l.ref.kind === "element" && l.absent);
  out.push({
    name: "the Layers stack lists the design rows as absent on a plain page",
    pass:
      ["Logo", "Brand text", "Title", "Badge"].every((label) => absentOnPlain.includes(label)) &&
      !ownRows.some((l) => ["Logo", "Brand text", "Title", "Badge"].includes(l.label)),
    detail: `absent=${absentOnPlain.join("/")} own-absent=${ownRows.map((l) => l.label).join("/")}`,
  });

  /* ------------------------- the one toggle, per slide -------------------- */
  await openCard(d2.slides[1].id);
  click(doc.querySelector('[data-nav="background"]'));
  await tick();
  const toggle = byText("Deck design on this slide");
  out.push({
    name: "the Slide background panel offers the per-slide Deck design toggle",
    pass: !!toggle && !!doc.querySelector("[data-plain-page-toggle]"),
  });
  click(toggle);
  await tick();
  await saved();
  out.push({
    name: "one toggle puts the project's design back on that slide alone",
    pass: chromeOn() && slideAt(1)?.plainPage === false && slideAt(0)?.plainPage !== true,
    detail: `chrome=${chromeState()} plainPage=${slideAt(1)?.plainPage}`,
  });

  /* ------------------------- import as a picture layer -------------------- */
  const known = new Set(deckNow().slides.map((s) => s.id));
  const openId = deckNow().slides[1].id;
  await upload("chapter 2.pdf", "application/pdf");
  click(byText(/New slides · page as picture/) ?? null);
  await tick();
  click(importButton());
  await tick(60);
  await saved();
  const after = deckNow().slides;
  const added = after.filter((s) => !known.has(s.id));
  const pic = added[0];
  out.push({
    name: "the picture placement is a plain slide too, with the page as a movable layer",
    pass:
      added.length === 2 &&
      !!pic?.plainPage &&
      pic?.shapes?.length === 1 &&
      pic?.shapes?.[0].kind === "image" &&
      pic?.shapes?.[0].src === STUB_PAGES[0] &&
      pic?.shapes?.[0].name === "chapter 2 · page 1",
    detail: `added=${added.length} plainPage=${pic?.plainPage} shape=${pic?.shapes?.[0]?.kind}/${pic?.shapes?.[0]?.name}`,
  });
  out.push({
    name: "the imported slides land next to the slide being edited",
    pass: after.findIndex((s) => s.id === added[0]?.id) === after.findIndex((s) => s.id === openId) + 1,
    detail: `at=${after.findIndex((s) => s.id === added[0]?.id)} open=${after.findIndex((s) => s.id === openId)}`,
  });

  /* ------------- the document itself is what the library keeps ------------- */
  await act(async () => {
    clearUploads();
  });
  const pdfFile = new win.File(["a whole pdf file, kept whole"], "chapter 3.pdf", { type: "application/pdf" });
  await act(async () => {
    await openDeckUpload(pdfFile);
  });
  await tick(60);

  const lib = getUploads();
  const savedDoc = lib.find((u) => u.name === "chapter 3.pdf") ?? null;
  const label = (u: (typeof lib)[number]) => `${u.name}${u.doc ? `[${u.doc.kind}:${u.doc.pages}]` : "[picture]"}`;
  out.push({
    name: "an uploaded PDF is saved to the library as ONE document, not one picture per page",
    pass: lib.length === 1 && !!savedDoc?.doc && savedDoc.doc.kind === "pdf" && savedDoc.doc.pages === STUB_PAGE_COUNT,
    detail: `entries=${lib.map(label).join(",") || "none"}`,
  });
  out.push({
    name: "the library holds no per-page picture of it — only the document's own cover",
    pass: lib.every((u) => !!u.doc) && !lib.some((u) => /page \d/.test(u.name ?? "")),
    detail: `entries=${lib.map(label).join(",") || "none"}`,
  });
  out.push({
    name: "the entry keeps one cover picture (page 1) for its tile",
    pass: savedDoc?.src === STUB_PAGES[0],
    detail: String(savedDoc?.src ?? "no entry").slice(0, 40),
  });
  const back = savedDoc ? await documentAsFile(savedDoc) : null;
  out.push({
    name: "the library keeps the PDF's own bytes, readable back as the same file",
    pass: !!back && back.name === "chapter 3.pdf" && back.type === "application/pdf" && back.size === pdfFile.size,
    detail: `file=${back ? `${back.name}/${back.type}/${back.size}` : "nothing"}`,
  });

  /* -------------- clicking the saved PDF reopens its page preview ------------ */
  click(byText("Cancel"));
  await tick();
  click(doc.querySelector('aside nav button[data-nav="images"]'));
  await tick();
  const tile = doc.querySelector<HTMLButtonElement>(`aside [data-upload-doc="${savedDoc?.id}"]`);
  const tileTitle = tile?.closest("[data-upload-tile]")?.getAttribute("title") ?? "";
  out.push({
    name: "Uploads shows the PDF as one document tile, with its page count",
    pass: !!tile && /PDF/.test(tileTitle) && new RegExp(`${STUB_PAGE_COUNT} pages`).test(tileTitle),
    detail: tileTitle || "no tile",
  });

  click(tile);
  await tick(80);
  const preview = importButton();
  out.push({
    name: "clicking the PDF opens its page preview with the pages ready to pick",
    pass: !!preview && !!doc.querySelector('button[title^="Page 2 ·"]'),
    detail: preview?.textContent?.trim() ?? "no preview",
  });

  // pin the placement (the dialog remembers the last one) and pick one page
  // only: untick page 1, leaving page 2
  click(byText("New slides · page as background"));
  await tick();
  click(doc.querySelector('button[title^="Page 1 ·"]'));
  await tick();
  const onePage = importButton();
  out.push({
    name: "the preview lets a single page be chosen",
    pass: !!onePage && /^Add 1 slide$/.test(onePage.textContent?.trim() ?? ""),
    detail: onePage?.textContent?.trim() ?? "no button",
  });

  const knownIds = new Set(deckNow().slides.map((sl) => sl.id));
  click(onePage);
  await tick(60);
  await saved();
  const addedSlides = deckNow().slides.filter((sl) => !knownIds.has(sl.id));
  out.push({
    name: "only the chosen page is added — and the library still holds just the one PDF",
    pass:
      addedSlides.length === 1 &&
      addedSlides[0].background?.src === STUB_PAGES[1] &&
      (addedSlides[0].shapes ?? []).length === 0 &&
      getUploads().length === 1 &&
      !!getUploads()[0]?.doc,
    detail: `added=${addedSlides.length} bg=${(addedSlides[0]?.background?.src ?? "").slice(-14)} library=${getUploads()
      .map(label)
      .join(",")}`,
  });

  /* ------- a page dropped on the current slide is not filed as a picture ----- */
  await act(async () => {
    await openDeckUpload(pdfFile);
  });
  await tick(60);
  click(byText("Pictures on the current slide"));
  await tick();
  click(doc.querySelector('button[title^="Page 1 ·"]'));
  await tick();
  const ontoSlide = importButton();
  out.push({
    name: "the same document can be reopened from the library and its pages placed on a slide",
    pass: !!ontoSlide && /^Add 1 page to this slide$/.test(ontoSlide.textContent?.trim() ?? ""),
    detail: ontoSlide?.textContent?.trim() ?? "no button",
  });
  click(ontoSlide);
  await tick(60);
  await saved();
  const dropped = deckNow()
    .slides.flatMap((sl) => sl.shapes ?? [])
    .filter((sh) => sh.name === "chapter 3 · page 2");
  out.push({
    name: "…and that page is a page of the document, not another picture in the library",
    pass:
      dropped.length === 1 &&
      dropped[0].importedPage === true &&
      dropped[0].src === STUB_PAGES[1] &&
      getUploads().length === 1 &&
      !!getUploads()[0]?.doc,
    detail: `shapes=${dropped.length} importedPage=${dropped[0]?.importedPage} library=${getUploads()
      .map(label)
      .join(",")}`,
  });

  /* ---------------------- deleting the entry drops the file ----------------- */
  await act(async () => {
    if (savedDoc) removeUpload(savedDoc.id);
  });
  await tick();
  const stillThere = savedDoc ? await documentAsFile(savedDoc) : null;
  out.push({
    name: "deleting the entry drops the stored PDF with it",
    pass: getUploads().length === 0 && stillThere === null,
    detail: `library=${getUploads().map(label).join(",") || "empty"} bytes=${stillThere ? "still there" : "dropped"}`,
  });

  /* ------------------------------- pure units ---------------------------- */
  const built = buildImportedSlides(
    {
      placement: "slides-background",
      name: "chapter 2.pdf",
      pages: [
        { page: 7, src: "data:p7", ratio: 4 / 3 },
        { page: 8, src: "data:p8", ratio: 4 / 3 },
      ],
    },
    5,
  );
  out.push({
    name: "the builder numbers the new slides on from the deck and keeps them plain",
    pass:
      built.length === 2 &&
      built[0].number === "6" &&
      built[1].number === "7" &&
      built.every((s) => s.plainPage === true && s.question === "" && s.options.length === 0),
    detail: built.map((s) => `${s.number}:${s.plainPage}`).join(","),
  });
  out.push({
    name: "an imported page's name reads the same in Uploads and in the layer list",
    pass:
      importPageLabel("chapter 2.pdf", 4) === "chapter 2 · page 4" &&
      importPageLabel("Deck.pptx", 2) === "Deck · slide 2",
    detail: importPageLabel("chapter 2.pdf", 4),
  });

  out.push({ name: "no uncaught errors in the import suite", pass: errors.length === 0, detail: errors.join(" | ") });

  act(() => root?.unmount());
  win.removeEventListener("error", onErr as EventListener);
  return out;
}
