import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContextToolbar from "./components/ContextToolbar";
import Slide, { SLIDE_H, SLIDE_W, type SlideField } from "./components/Slide";
import {
  FREE_MAX,
  FREE_MIN,
  type Box,
  type DeckHeader,
  type ElementId,
  type LayoutMap,
  type ThemeSettings,
} from "./lib/types";
import { Stage } from "./components/SlideViews";
import Inspector from "./components/Inspector";
import SlideStack from "./components/SlideStack";
import SlidePicker from "./components/SlidePicker";
import PasteModal from "./components/PasteModal";
import PdfImportModal, { type PdfImportResult } from "./components/PdfImportModal";
import { DECK_ACCEPT, isDeckFile, onPdfImportRequest } from "./lib/pdf";
import { openDeckUpload } from "./lib/uploadDocs";
import { buildImportedSlides, importPageLabel } from "./lib/importSlides";
import Presenter from "./components/Presenter";
import ExportModal, { type ExportSettings } from "./components/ExportModal";
import type { InspectorTab } from "./components/Inspector";
import type { InsertScope } from "./components/ShapesPanel";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, shrinkDataUrl, shapeId, type ShapeItem, type ShapeKind } from "./lib/shapes";
import type { AlignOp } from "./lib/shapeAlign";
import { type ZOp } from "./lib/zorder";
import { paintedStack, parseLayerKey, visibleStack, type LayerPatch, type LayerRef } from "./lib/layers";
import { boardLayerChain, selectionBounds, moveMembers } from "./lib/groups";
import ContextMenu, { type MenuAction } from "./components/ContextMenu";
import {
  getShapeClipboard,
  hasShapeClipboard,
  markCutPast,
  setShapeClipboard,
} from "./lib/clipboard";
import HistoryPanel from "./components/HistoryPanel";
import AnswerKeyModal from "./components/AnswerKeyModal";
import { Btn } from "./components/ui";
import { normalizeDeckZ, useDeck } from "./lib/useDeck";
import { addUpload, seedUploadsFromDeck } from "./lib/uploads";

/** glyph / names for the right-click Layer submenu (mirrors lib/zorder) */
const Z_LABEL_Glyph: Record<ZOp, string> = {
  front: "⏫",
  forward: "▲",
  backward: "▼",
  back: "⏬",
};
const Z_LABEL_Menu: Record<ZOp, string> = {
  front: "Bring to front",
  forward: "Bring forward",
  backward: "Send backward",
  back: "Send to back",
};
import { useFontCoverage } from "./lib/useFontCoverage";
import { restoreCustomFonts } from "./lib/customFonts";
import { downloadDataUrl, exportZip, slideToPng } from "./lib/exporter";
import { convertMode } from "./lib/layoutMeasure";
import { effectiveBackground } from "./lib/background";
import { resolveFrameImageSrc } from "./lib/frameImages";
import { effectiveHeader, effectiveTheme } from "./lib/overrides";
import type { ApplySection } from "./lib/applyDesign";
import { exportPdf } from "./lib/exportPdf";
import { normalizeSource } from "./lib/richPaste";
import { cn } from "./utils/cn";
import { FontPreviewProvider, useFontPreview } from "./lib/fontPreview";

function AppContent() {
  const {
    deck,
    setDeck,
    current,
    setCurrent,
    setHeaderScoped,
    setThemeScoped,
    patchLayoutScoped,
    transformLayoutScoped,
    updateSlide,
    updateAll,
    transformAll,
    addSlides,
    insertSlidesAfter,
    insertBlank,
    removeSlide,
    duplicateSlide,
    removeSlides,
    duplicateSlides,
    moveSlide,
    moveSlideTo,
    addAnswerCopies,
    addShape,
    addImage,
    copyShapeTo,
    updateShapeOnSlide,
    updateShapesOnSlide,
    updateShapesBatch,
    groupShapes,
    ungroupShapes,
    removeShapes,
    removeShapesOnSlide,
    duplicateShapes,
    duplicateShapesOnSlide,
    applyShapeDesign,
    reorderShape,
    reorderLayerOp,
    moveLayerToOp,
    patchLayersOp,
    duplicateLayersOp,
    removeLayersOp,
    alignLayerOp,
    distributeLayersOp,
    removeShape,
    duplicateShape,
    toggleShapeScope,
    applyAnswers,
    setBackground,
    resetBackground,
    clearSlideBackground,
    applyDesign,
    revertDesign,
    renumber,
    resetAll,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
  } = useDeck();

  const { preview } = useFontPreview();

  // loads any extra font files the content needs (CJK, Hebrew, Thai…)
  const { scripts, revision } = useFontCoverage(deck);

  // re-register the user's uploaded fonts (survives reloads)
  useEffect(() => {
    void restoreCustomFonts();
  }, []);

  const [pasteOpen, setPasteOpen] = useState(false);
  /** PDF waiting in the "Import PDF" page picker (null = closed) */
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [activeField, setActiveField] = useState<SlideField | null>(null);
  const [selectedEl, setSelectedEl] = useState<ElementId | null>(null);
  /** multi-selection of drawn items; a group is selected as a unit (all member ids) */
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [surface, setSurface] = useState<"frame" | "background" | null>(null);
  /**
   * An externally requested inspector tab. Carried with a nonce so asking for
   * the tab that is already recorded still re-opens it (a plain string state
   * would be swallowed by React's "same value" bailout).
   */
  const [tabRequest, setTabRequest] = useState<{ tab: InspectorTab; n: number } | null>(null);
  /**
   * The navigation destination that is currently open. It drives the context
   * toolbar above the slide: the destinations that own no single board element
   * (Answer key, Uploads, Insert shapes) get their related tools there.
   * Mirrors `tabRequest`, so canvas clicks and navigation picks always agree.
   */
  const [activeNav, setActiveNav] = useState<InspectorTab | null>(null);
  /** Canva-style right-click menu state (a snapshot of where + what was clicked) */
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; shapeId: string | null; elementId: ElementId | null; surface: "frame" | "background" | null;
  } | null>(null);
  const requestTab = useCallback((tab: InspectorTab) => {
    setTabRequest((r) => ({ tab, n: (r?.n ?? 0) + 1 }));
    setActiveNav(tab);
  }, []);
  /**
   * Latest navigation destination, readable from callbacks without re-binding
   * them. The Layers destination is a list of the WHOLE board, so selecting
   * something — in the list or on the canvas — must not navigate away from it
   * (Canva keeps its layers panel open the same way); every other destination
   * still follows the selection.
   */
  const activeNavRef = useRef<InspectorTab | null>(null);
  useEffect(() => {
    activeNavRef.current = activeNav;
  }, [activeNav]);

  /** opens a destination as a consequence of a selection (Layers stays put) */
  const openTabForSelection = useCallback(
    (tab: InspectorTab) => {
      if (activeNavRef.current === "layers") return;
      requestTab(tab);
    },
    [requestTab],
  );

  const [editScope, setEditScope] = useState<"slide" | "selected" | "all">("slide");
  const [scopeSlideIds, setScopeSlideIds] = useState<string[]>([]);

  // Seed user's Uploads library from any images on the deck
  useEffect(() => {
    seedUploadsFromDeck(deck);
  }, [deck]);

  /**
   * The slide rail's ticked slides. One list feeds every bulk action: the
   * rail's own duplicate / delete bar and the inspector's “Selected slides”
   * scope, so ticking cards in the rail is enough to restyle them together.
   * A real multi-tick moves the scope onto “Selected” while it is still on the
   * default “This slide”; a lone tick (what a plain card click leaves behind)
   * and any explicit scope choice leave the scope where the user put it.
   */
  const handleSlideSelection = useCallback((ids: string[]) => {
    setScopeSlideIds(ids);
    if (ids.length > 1) setEditScope((s) => (s === "slide" ? "selected" : s));
  }, []);

  /** drop ticks whose slide is gone (deleted, replaced by a new deck, undone) */
  useEffect(() => {
    setScopeSlideIds((prev) => {
      if (!prev.length) return prev;
      const alive = new Set(deck.slides.map((s) => s.id));
      const kept = prev.filter((id) => alive.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [deck.slides]);

  /**
   * Which navigation entry edits a given board element. Selecting a layer (or an
   * element on the canvas) therefore opens the panel that actually styles it,
   * instead of dumping everything into one generic layout tab.
   */
  const tabOfElement = (id: ElementId): InspectorTab =>
    ({
      logo: "logo",
      brand: "badge1",
      title: "titleText",
      badge: "badge3",
      bullet: "questionBullet",
      question: "questionText",
      options: "optionText",
      note: "footnote",
    })[id] ?? "shapes";

  /** resolves the Shapes-panel scope into a deck target (null = all, id, or id[]) */
  const resolveScope = useCallback(
    (scope: InsertScope | boolean): null | string | string[] => {
      const sl = deck.slides[Math.min(current, deck.slides.length - 1)];
      if (typeof scope === "boolean") return scope ? null : (sl?.id ?? null);
      if (scope.mode === "all") return null;
      if (scope.mode === "selected") return scope.ids.length ? scope.ids : (sl?.id ?? null);
      return sl?.id ?? null;
    },
    [current, deck.slides],
  );

  const insertImage = useCallback(
    (src: string, ratio: number, scope: InsertScope | boolean, at?: { x: number; y: number }, name?: string) => {
      addUpload(src, ratio, name);
      const id = addImage(src, ratio, resolveScope(scope), at);
      setSurface(null);
      setSelectedEl(null);
      setSelectedShapes([id]);
      requestTab("images");
    },
    [addImage, resolveScope, requestTab],
  );

  /** the "primary" selected drawn item — what the inspector edits */
  const selectedShape = selectedShapes.length ? selectedShapes[selectedShapes.length - 1] : null;

  /** select shapes from the canvas; a group arrives already expanded */
  const selectShapeIds = useCallback(
    (ids: string[]) => {
      if (ids.length) setSurface(null);
      setSelectedShapes(ids);
      // selecting a drawn shape clears any built-in element selection
      if (ids.length) {
        setSelectedEl(null);
        // a lone picture opens "Uploads"; anything else opens "Insert shapes"
        const cur = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
        const pool = [...(deck.globalShapes ?? []), ...(cur?.shapes ?? [])];
        const only = ids.length === 1 ? pool.find((x) => x.id === ids[0]) : undefined;
        openTabForSelection(only?.kind === "image" ? "images" : "shapes");
      }
    },
    [deck.globalShapes, deck.slides, current, openTabForSelection],
  );

  /**
   * Picking a navigation entry also selects the matching content on the slide,
   * so the panel and the canvas always point at the same thing. The active
   * field is cleared: it would otherwise re-drive the inspector's tab from a
   * stale canvas click and undo the navigation choice.
   */
  const handleNavSelect = useCallback((target: {
    element?: ElementId;
    surface?: "frame" | "background";
    nav?: InspectorTab;
    keepSelection?: boolean;
  }) => {
    setActiveField(null);
    setActiveNav(target.nav ?? null);
    // the Layers destination lists whatever is selected, so opening it must not
    // clear the selection it is about to show
    if (target.keepSelection) {
      setSurface(null);
      return;
    }
    if (target.element) {
      setSelectedEl(target.element);
      setSelectedShapes([]);
      setSurface(null);
    } else if (target.surface) {
      setSurface(target.surface);
      setSelectedEl(null);
      setSelectedShapes([]);
    } else {
      // the insert tabs keep any selected picture / shape so it stays editable
      setSurface(null);
      setSelectedEl(null);
    }
  }, []);

  /** what's currently selected in the unified layer stack */
  const selectedLayer: LayerRef | null = useMemo(
    () => (selectedShape ? { kind: "shape", id: selectedShape } : selectedEl ? { kind: "element", id: selectedEl } : null),
    [selectedShape, selectedEl],
  );

  /** unified stack (elements + drawn items) on the current slide */
  const currentStack = useMemo(() => {
    const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
    return visibleStack(deck, sl);
  }, [deck, current]);

  /** …and the subset actually painted: what Tab-walking can land on */
  const paintedLayers = useMemo(() => {
    const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
    return paintedStack(deck, sl);
  }, [deck, current]);

  const selectLayer = useCallback(
    /**
     * `additive` (Ctrl/⌘/Shift+click in the layer list) extends the drawn-item
     * selection instead of replacing it, so several layers can be hidden,
     * locked, duplicated or dragged as one block — exactly like the canvas.
     */
    (ref: LayerRef, additive = false) => {
      setSurface(null);
      if (ref.kind === "shape") {
        setSelectedEl(null);
        setSelectedShapes((prev) =>
          additive ? (prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id]) : [ref.id],
        );
        const cur = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
        const pool = [...(deck.globalShapes ?? []), ...(cur?.shapes ?? [])];
        openTabForSelection(pool.find((x) => x.id === ref.id)?.kind === "image" ? "images" : "shapes");
      } else {
        setSelectedShapes([]);
        setSelectedEl(ref.id);
        openTabForSelection(tabOfElement(ref.id));
      }
    },
    [deck.globalShapes, deck.slides, current, openTabForSelection],
  );

  /**
   * Alt+click on any layer: walks to the layer directly BENEATH the current
   * selection at that point — the practical way to grab an element that is
   * covered by another one (or by a background container).
   */
  const cycleLayers = useCallback((clientX: number, clientY: number) => {
    const chain = boardLayerChain(clientX, clientY);
    if (!chain.length) return;
    const sel = new Set<string>([
      ...selectedShapes.map((id) => `shape:${id}`),
      ...(selectedEl ? [`element:${selectedEl}`] : []),
    ]);
    const idx = chain.findIndex((r) => sel.has(`${r.kind}:${r.id}`));
    const ref = idx < 0 ? chain[0] : chain[(idx + 1) % chain.length];
    if (ref.kind === "shape") selectLayer({ kind: "shape", id: ref.id });
    else selectLayer({ kind: "element", id: ref.id as ElementId });
  }, [selectedShapes, selectedEl, selectLayer]);

  const reorderLayerRef = useCallback(
    (ref: LayerRef, op: ZOp) => {
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      reorderLayerOp(ref, op, sl?.id ?? null);
    },
    [deck.slides, current, reorderLayerOp],
  );

  /** a layer row (or a whole multi-selection) was dragged into a new slot */
  const moveLayerToSlot = useCallback(
    (refs: LayerRef[], index: number) => {
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      moveLayerToOp(refs, index, sl?.id ?? null);
    },
    [deck.slides, current, moveLayerToOp],
  );

  /** 👁 / 🔒 / rename from the Layers panel */
  const patchLayersRef = useCallback(
    (refs: LayerRef[], patch: LayerPatch) => {
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      patchLayersOp(refs, patch, sl?.id ?? null);
      // a layer you just hid can no longer be edited on the board, so it also
      // leaves the canvas selection (its outline and handles go with it)
      if (patch.hidden) {
        const ids = new Set(refs.filter((r) => r.kind === "shape").map((r) => r.id));
        if (ids.size) setSelectedShapes((prev) => prev.filter((id) => !ids.has(id)));
        if (refs.some((r) => r.kind === "element" && r.id === selectedEl)) setSelectedEl(null);
      }
    },
    [deck.slides, current, patchLayersOp, selectedEl],
  );

  /** ⧉ duplicate from the Layers panel — the clones become the selection */
  const duplicateLayersRef = useCallback(
    (refs: LayerRef[]) => {
      const ids = duplicateLayersOp(refs);
      if (ids.length) {
        setSelectedEl(null);
        setSelectedShapes(ids);
      }
    },
    [duplicateLayersOp],
  );

  /** 🗑 delete from the Layers panel (a built-in element is hidden instead) */
  const removeLayersRef = useCallback(
    (refs: LayerRef[]) => {
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      removeLayersOp(refs, sl?.id ?? null);
      const gone = new Set(refs.filter((r) => r.kind === "shape").map((r) => r.id));
      if (gone.size) setSelectedShapes((prev) => prev.filter((id) => !gone.has(id)));
      if (refs.some((r) => r.kind === "element" && r.id === selectedEl)) setSelectedEl(null);
    },
    [deck.slides, current, removeLayersOp, selectedEl],
  );

  const reorderSelected = useCallback(
    (op: ZOp) => selectedLayer && reorderLayerRef(selectedLayer, op),
    [selectedLayer, reorderLayerRef],
  );

  const alignSelected = useCallback(
    (op: AlignOp | "center") => {
      if (!selectedLayer) return;
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      if (op === "center") {
        alignLayerOp(selectedLayer, "hcenter", sl?.id ?? null);
        alignLayerOp(selectedLayer, "vcenter", sl?.id ?? null);
      } else alignLayerOp(selectedLayer, op, sl?.id ?? null);
    },
    [selectedLayer, deck.slides, current, alignLayerOp],
  );

  /** image files from clipboard / drag-drop → slide */
  const importImageFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      // a PDF / PPTX is saved to Uploads as the document itself and opens its
      // page preview (whole document or chosen pages)
      const pdf = files.find(isDeckFile);
      if (pdf) void openDeckUpload(pdf);
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return !!pdf;
      setBusy(`Loading ${imgs.length} image${imgs.length > 1 ? "s" : ""}…`);
      try {
        for (const f of imgs) {
          const { src, ratio } = await loadImageFile(f);
          const small = await shrinkDataUrl(src);
          addUpload(small, ratio, f.name);
          insertImage(small, ratio, false, at, f.name);
        }
      } finally {
        setBusy(null);
      }
      return true;
    },
    [insertImage],
  );

  // Ctrl+V with an image on the clipboard drops it onto the current slide
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (presenting || pasteOpen || exportOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/") || isDeckFile(f))) {
        e.preventDefault();
        void importImageFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importImageFiles, presenting, pasteOpen, exportOpen]);

  /**
   * PDF pages / PPTX slides picked in the import dialog → deck. The pages arrive
   * already rendered to data-URLs and are rendered into the deck only: the
   * Uploads library keeps the DOCUMENT (saved by lib/uploadDocs when the file
   * came in), never a picture per page.
   *
   * Pages that become slides are merged in as PLAIN pages (lib/importSlides):
   * separate slides of the user's own, without the project's built-in design on
   * top of them, ready to be drawn on.
   */
  const importPdfPages = useCallback(
    (res: PdfImportResult) => {
      const pptx = /\.pptx$/i.test(res.name);
      if (res.placement === "current-slide") {
        const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
        if (!sl) return;
        let last: string | null = null;
        res.pages.forEach((p, i) => {
          // cascade so several pages don't land exactly on top of each other;
          // `importedPage` keeps the page out of the Uploads library, where the
          // document itself is what is saved
          last = addImage(p.src, p.ratio, sl.id, i ? { x: 50 + i * 2, y: 50 + i * 2 } : undefined, {
            importedPage: true,
            name: importPageLabel(res.name, p.page),
          });
        });
        if (last) {
          setSurface(null);
          setSelectedEl(null);
          setSelectedShapes([last]);
          requestTab("images");
        }
        return;
      }
      const n0 = deck.slides.length;
      const slides = buildImportedSlides(res, n0);
      const after = n0 ? Math.min(current, n0 - 1) : -1;
      insertSlidesAfter(slides, after, `Import ${slides.length} ${pptx ? "PowerPoint slide" : "PDF page"}${slides.length === 1 ? "" : "s"}`);
    },
    [deck.slides, current, addImage, insertSlidesAfter, requestTab],
  );

  // inspector panels (Uploads / Shapes) hand PDFs over through a window event
  useEffect(() => onPdfImportRequest((f) => setPdfFile(f)), []);

  const [dropHint, setDropHint] = useState(false);

  const insertShape = useCallback(
    (kind: ShapeKind, scope: InsertScope | boolean) => {
      const id = addShape(kind, resolveScope(scope));
      setSurface(null);
      setSelectedEl(null);
      setSelectedShapes([id]);
      requestTab(kind === "image" ? "images" : "shapes");
    },
    [addShape, resolveScope, requestTab],
  );

  const [offscreen, setOffscreen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const index = Math.min(current, Math.max(0, deck.slides.length - 1));
  const slide = deck.slides[index];

  useEffect(() => {
    setSelectedShapes([]);
    setSelectedEl(null);
    setSurface(null);
    setActiveField(null);
    // the destinations that do not depend on a selection (Answer key, Uploads,
    // Insert shapes, Layers, and the selection-free Design/Layout panels) stay
    // open across slides — their tools apply to the slide you just moved to;
    // every other destination needs its element back
    setActiveNav((nav) =>
      nav === "answerKey" || nav === "images" || nav === "shapes" || nav === "layers" || nav === "theme" || nav === "layout" ? nav : null,
    );
  }, [current]);

  const rawTheme = effectiveTheme(deck, slide);
  const currentHeader = effectiveHeader(deck, slide);

  // ---- font hover preview -------------------------------------------------
  // When the user hovers a font family in any FontPicker, the related text
  // on the slide previews that family live. The preview is ephemeral and
  // never writes to the deck.
  const previewedTheme = useMemo<ThemeSettings>(() => {
    if (!preview) return rawTheme;
    const fam = preview.family;
    const t = preview.target;
    let next = { ...rawTheme, boxFonts: { ...(rawTheme.boxFonts ?? {}) } } as ThemeSettings;

    if (t.startsWith("box:")) {
      const boxId = t.slice(4) as ElementId;
      const prev = next.boxFonts[boxId] ?? {};
      next.boxFonts = { ...next.boxFonts, [boxId]: { ...prev, family: fam } };
      return next;
    }
    if (t === "deck:bengali") {
      next.bengaliFont = `'${fam}', sans-serif`;
      return next;
    }
    if (t === "deck:latin") {
      next.latinFont = `'${fam}', sans-serif`;
      return next;
    }
    if (t === "deck:arabic") {
      next.arabicFont = `'${fam}'`;
      return next;
    }
    if (t === "optionBullet") {
      next.optionBulletFontFamily = fam;
      return next;
    }
    // deck fonts that affect multiple boxes are handled above;
    // any other target leaves theme untouched
    return next;
  }, [rawTheme, preview]);

  const currentTheme = previewedTheme;

  /** every drawn item on the open slide, deck-wide + slide-local (order kept) */
  const slideShapes = useMemo(
    () => [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])],
    [deck.globalShapes, slide?.shapes],
  );

  /** paste the internal shape clipboard onto the open slide; returns the new ids */
  const pasteShapesAt = useCallback(
    (slideId: string, at?: { x: number; y: number }): string[] => {
      const data = getShapeClipboard();
      if (!data || !data.items.length || !slideId) return [];
      const ids = data.items.map(() => shapeId());
      const zTop = Math.max(
        ...slideShapes.map((s) => (Number.isFinite(s.z) ? s.z : 10)),
        ...(Object.values(currentTheme.layout).map((b) => (typeof b.z === "number" ? (b.z as number) : 0))),
        0,
      );
      setSelectedEl(null);
      setSurface(null);
      if (data.cut) {
        setDeck(
          (d) => {
            const gone = new Set(data.cutIds);
            const dx = at ? at.x - data.items[0].x : 0;
            const dy = at ? at.y - data.items[0].y : 0;
            const slides = d.slides.map((s) => {
              const filtered = s.shapes?.filter((x) => !gone.has(x.id));
              if (s.id !== slideId) return filtered !== s.shapes ? { ...s, shapes: filtered } : s;
              const moved = data.items.map((it, i) => ({
                ...it,
                id: ids[i],
                x: Math.round((it.x + dx) * 10) / 10,
                y: Math.round((it.y + dy) * 10) / 10,
                z: zTop + 1 + i,
                groupId:
                  it.groupId && data.items.length > 1 && data.items.every((o) => o.groupId === it.groupId)
                    ? it.groupId
                    : undefined,
              }));
              return { ...s, shapes: [...(filtered ?? []), ...moved] };
            });
            return { ...d, globalShapes: d.globalShapes?.filter((g) => !gone.has(g.id)), slides };
          },
          "Cut & paste",
        );
        markCutPast();
      } else {
        setDeck(
          (d) => {
            const clones = data.items.map((it, i) => ({
              ...it,
              id: ids[i],
              x: Math.round(((at ? at.x : it.x + 3) + (i ? 3 : 0)) * 10) / 10,
              y: Math.round(((at ? at.y : it.y + 3) + (i ? 3 : 0)) * 10) / 10,
              z: zTop + 1 + i,
            }));
            return {
              ...d,
              slides: d.slides.map((s) => (s.id === slideId ? { ...s, shapes: [...(s.shapes ?? []), ...clones] } : s)),
            };
          },
          "Paste",
        );
      }
      if (activeNavRef.current !== "layers") requestTab(data.items[0]?.kind === "image" ? "images" : "shapes");
      setSelectedShapes(ids);
      return ids;
    },
    [slideShapes, currentTheme.layout, setDeck, requestTab],
  );

  // preview for shapes (text boxes)
  const previewedGlobalShapes = useMemo(() => {
    if (!preview || !preview.target.startsWith("shape:")) return deck.globalShapes;
    const id = preview.target.slice(6);
    return (deck.globalShapes ?? []).map((sh) => (sh.id === id ? { ...sh, fontFamily: preview.family } : sh));
  }, [deck.globalShapes, preview]);

  const previewedSlideShapes = useMemo(() => {
    if (!preview || !preview.target.startsWith("shape:")) return slide?.shapes;
    const id = preview.target.slice(6);
    return (slide?.shapes ?? []).map((sh) => (sh.id === id ? { ...sh, fontFamily: preview.family } : sh));
  }, [slide?.shapes, preview]);

  // merged slide used for main canvas (includes previewed shapes)
  const previewedSlideForCanvas = useMemo(() => {
    if (!slide) return slide;
    if (!preview || !preview.target.startsWith("shape:")) return slide;
    return { ...slide, shapes: previewedSlideShapes };
  }, [slide, previewedSlideShapes, preview]);

  const editorDeck = { ...deck, theme: currentTheme, header: currentHeader, globalShapes: previewedGlobalShapes as any };
  // While editing, edits update the current slide live so user can preview their design
  const thisSlideId = useMemo(() => (slide ? [slide.id] : []), [slide]);
  const scopedTheme = useCallback(
    (patch: Partial<ThemeSettings>) => setThemeScoped(patch, "slide", thisSlideId),
    [setThemeScoped, thisSlideId],
  );
  const scopedHeader = useCallback(
    (patch: Partial<DeckHeader>) => setHeaderScoped(patch, "slide", thisSlideId),
    [setHeaderScoped, thisSlideId],
  );
  const scopedPatchLayout = useCallback(
    (id: ElementId, patch: Partial<Box>, label?: string) =>
      patchLayoutScoped(id, patch, "slide", thisSlideId, label),
    [patchLayoutScoped, thisSlideId],
  );
  const scopedTransformLayout = useCallback(
    (fn: (layout: LayoutMap) => LayoutMap, label?: string) =>
      transformLayoutScoped(fn, "slide", thisSlideId, label),
    [transformLayoutScoped, thisSlideId],
  );
  /** Canvas movement updates the current slide live */
  const moveElement = useCallback(
    (id: ElementId, patch: Partial<Box>) => scopedPatchLayout(id, patch),
    [scopedPatchLayout],
  );

  const handleApplyDesign = useCallback(
    (scope: "slide" | "selected" | "all", targetSlideIds: string[], section: ApplySection = "all") => {
      if (!slide) return;
      applyDesign(slide.id, scope, targetSlideIds, section);
    },
    [slide, applyDesign],
  );

  const handleRevertDesign = useCallback(
    (slideIds: string[]) => {
      revertDesign(slideIds);
    },
    [revertDesign],
  );

  /* ----------------------------- keyboard nav ---------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (presenting || pasteOpen || answersOpen) return;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      // ---- undo / redo: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y -------------------
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        const isRedo = e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey);
        e.preventDefault();
        if (inField) (t as HTMLElement).blur();
        if (isRedo) redo();
        else undo();
        return;
      }
      // ---- Canva-style copy / cut / paste of the drawn items (text fields
      //      keep their native clipboard behaviour) -------------------------
      if (mod && !e.altKey && !inField) {
        const k = e.key.toLowerCase();
        if (k === "c" || k === "x" || k === "v") {
          if (k === "v") {
            const data = getShapeClipboard();
            if (data?.items.length && slide) {
              e.preventDefault();
              pasteShapesAt(slide.id);
              return;
            }
          } else if (selectedShapes.length) {
            e.preventDefault();
            const items = slideShapes.filter((s) => selectedShapes.includes(s.id));
            if (items.length) setShapeClipboard(items, k === "x");
            return;
          }
        }
      }
      if (inField) return;

      const inLayerList = typeof t?.closest === "function" && !!t.closest("[data-layer-list]");
      if (
        inLayerList &&
        (e.key === "Tab" || e.key === "F2" || e.key === "Delete" || e.key === "Backspace" || e.key.startsWith("Arrow"))
      )
        return;

      if (e.key === "Escape") {
        setSurface(null);
        setSelectedShapes([]);
        setSelectedEl(null);
        setActiveField(null);
        setActiveNav(null);
        setScopeSlideIds([]);
        return;
      }

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "a") {
        const ids = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].map((x) => x.id);
        if (ids.length) {
          e.preventDefault();
          selectShapeIds(ids);
        }
        return;
      }

      const slideShapeCount = (deck.globalShapes?.length ?? 0) + (slide?.shapes?.length ?? 0);
      if (e.key === "Tab" && !mod && paintedLayers.length && slideShapeCount > 0) {
        e.preventDefault();
        const selKeys = new Set<string>([
          ...selectedShapes.map((id) => `shape:${id}`),
          ...(selectedEl ? [`element:${selectedEl}`] : []),
        ]);
        const step = e.shiftKey ? -1 : 1;
        let idx = paintedLayers.findIndex((s) => selKeys.has(s.id));
        if (idx < 0) idx = step === 1 ? -1 : paintedLayers.length;
        const next = paintedLayers[(idx + step + paintedLayers.length) % paintedLayers.length];
        const ref = parseLayerKey(next.id);
        if (ref) selectLayer(ref);
        return;
      }

      if (mod && !e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedShapes.length) ungroupShapes(selectedShapes);
        } else if (selectedShapes.length >= 2) {
          groupShapes(selectedShapes);
        }
        return;
      }

      if (selectedShapes.length) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeShapes(selectedShapes);
          setSelectedShapes([]);
          return;
        }
        if (mod && e.key.toLowerCase() === "d") {
          e.preventDefault();
          const ids = duplicateShapes(selectedShapes);
          if (ids.length) setSelectedShapes(ids);
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "]" || e.key === "[" || e.code === "BracketRight" || e.code === "BracketLeft")) {
          e.preventDefault();
          const up = e.key === "]" || e.code === "BracketRight";
          reorderSelected(up ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
          return;
        }
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 5 : e.altKey ? 0.2 : 1;
          const all = [...(deck.globalShapes ?? []), ...deck.slides.flatMap((x) => x.shapes ?? [])];
          const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
          const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
          const updates = selectedShapes
            .map((id) => all.find((x) => x.id === id))
            .filter((sh): sh is ShapeItem => !!sh && !sh.locked)
            .map((sh) => ({
              id: sh.id,
              patch: { x: Math.round((sh.x + dx) * 10) / 10, y: Math.round((sh.y + dy) * 10) / 10 },
            }));
          updateShapesBatch(updates, "Move shape");
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        reorderSelected(up ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
        return;
      }

      if (e.shiftKey && e.key.startsWith("Arrow") && selectedEl) {
        e.preventDefault();
        const step = e.altKey ? 0.2 : 1;
        const b = deck.theme.layout[selectedEl];
        if (!b) return;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
        const free = (b.mode ?? "align") === "free";
        const lo = free ? FREE_MIN : 0;
        const hi = free ? FREE_MAX : 100;
        moveElement(selectedEl, {
          x: Math.max(lo, Math.min(hi, Math.round((b.x + dx) * 10) / 10)),
          y: Math.max(lo, Math.min(hi, Math.round((b.y + dy) * 10) / 10)),
        });
        return;
      }
      if (e.key === "ArrowRight") setCurrent(Math.min(deck.slides.length - 1, index + 1));
      if (e.key === "ArrowLeft") setCurrent(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    deck.slides,
    deck.globalShapes,
    deck.theme.layout,
    slide,
    index,
    presenting,
    pasteOpen,
    answersOpen,
    selectedEl,
    selectedShapes,
    currentStack,
    paintedLayers,
    moveElement,
    setCurrent,
    selectShapeIds,
    selectLayer,
    groupShapes,
    ungroupShapes,
    removeShapes,
    duplicateShapes,
    updateShapesBatch,
    reorderSelected,
    slideShapes,
    pasteShapesAt,
    undo,
    redo,
  ]);

  /* ------------------------------- exporting ----------------------------- */
  const mountOffscreen = useCallback(async () => {
    setOffscreen(true);
    await new Promise((r) => requestAnimationFrame(() => window.setTimeout(r, 450)));
  }, []);

  const nodesFor = (scope: "all" | "current") =>
    (scope === "current" && slide ? [slide] : deck.slides)
      .map((sl, i) => {
        const node = document.getElementById(`export-${sl.id}`);
        return node ? { node, name: `${String(i + 1).padStart(2, "0")}-slide.png` } : null;
      })
      .filter(Boolean) as { node: HTMLElement; name: string }[];

  const runExport = async (cfg: ExportSettings) => {
    const name = (cfg.fileName || "mcq-slides").replace(/[\\/:*?\"<>|]+/g, "").trim() || "mcq-slides";
    try {
      setBusy("Preparing slides…");
      await mountOffscreen();

      if (cfg.format === "png") {
        const node = slide && document.getElementById(`export-${slide.id}`);
        if (node) downloadDataUrl(await slideToPng(node, cfg.quality), `${name}.png`);
      } else if (cfg.format === "zip") {
        await exportZip(nodesFor("all"), (d, t) => setBusy(`Rendering ${d}/${t}…`), cfg.quality);
      } else {
        await exportPdf(nodesFor("all"), {
          quality: cfg.quality,
          fileName: `${name}.pdf`,
          onProgress: (d, t) => setBusy(`Rendering page ${d}/${t}…`),
        });
      }
      setExportOpen(false);
    } catch (err) {
      console.error(err);
      alert("Export failed. Try a lower resolution or fewer slides.");
    } finally {
      setOffscreen(false);
      setBusy(null);
    }
  };

  const fixFormatting = useCallback(
    (scope: "slide" | "all") => {
      const fix = (s: (typeof deck.slides)[number]) => ({
        ...s,
        question: normalizeSource(s.question, { reflow: false }).text,
        options: s.options.map((o) => ({
          ...o,
          text: normalizeSource(o.text, { reflow: false }).text.replace(/\n+/g, " "),
        })),
      });
      if (scope === "all") transformAll(fix);
      else if (slide) updateSlide(slide.id, fix(slide));
    },
    [deck.slides, slide, transformAll, updateSlide],
  );

  const saveJson = () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "mcq-deck.json");
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const loadJson = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data?.slides?.length) throw new Error("bad file");
        setDeck(
          normalizeDeckZ({
            header: { ...deck.header, ...data.header },
            theme: {
              ...deck.theme,
              ...data.theme,
              layout: {
                ...deck.theme.layout,
                ...(data.theme?.layout ?? {}),
                bullet: { ...deck.theme.layout.bullet, ...(data.theme?.layout?.bullet ?? {}) },
              },
              banner: {
                ...deck.theme.banner,
                ...(data.theme?.banner ?? {}),
                color: data.theme?.banner?.color ?? data.theme?.titleBanner ?? deck.theme.banner.color,
              },
              background: { ...deck.theme.background, ...(data.theme?.background ?? {}) },
              boxFonts: { ...deck.theme.boxFonts, ...(data.theme?.boxFonts ?? {}) },
              frame: (() => {
                const f = {
                  ...deck.theme.frame,
                  ...(data.theme?.frame ?? {}),
                  color: data.theme?.frame?.color ?? data.theme?.frameInner ?? deck.theme.frame.color,
                };
                f.image = resolveFrameImageSrc(f.image);
                return f;
              })(),
            },
            slides: data.slides,
            globalShapes: data.globalShapes ?? [],
          }),
          "Open deck file",
        );
        setCurrent(0);
      } catch {
        alert("That file could not be read as a deck.");
      }
    };
    reader.readAsText(file);
  };

  const stats = useMemo(() => {
    const withAnswer = deck.slides.filter((s) => s.answer).length;
    return { total: deck.slides.length, withAnswer };
  }, [deck.slides]);

  const selectedGrouped = useMemo(() => {
    if (!selectedShapes.length) return false;
    const set = new Set(selectedShapes);
    return [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].some((x) => set.has(x.id) && !!x.groupId);
  }, [selectedShapes, deck.globalShapes, slide]);

  /* ---------------------------------------------------------------------- *
   * Canva-style right-click menu
   * ---------------------------------------------------------------------- */
  /** align N shapes as one block to the slide */
  const alignShapesToSlide = useCallback(
    (ids: string[], op: AlignOp) => {
      const items = slideShapes.filter((s) => ids.includes(s.id));
      if (items.length < 2 || items.some((s) => s.locked) || !slide) return;
      const rect = selectionBounds(items);
      const dx = op === "left" ? -rect.x : op === "right" ? 100 - rect.x - rect.w : op === "hcenter" ? 50 - rect.x - rect.w / 2 : 0;
      const dy = op === "top" ? -rect.y : op === "bottom" ? 100 - rect.y - rect.h : op === "vcenter" ? 50 - rect.y - rect.h / 2 : 0;
      updateShapesOnSlide(moveMembers(items.map((s) => ({ id: s.id, geo: s })), dx, dy), slide.id);
    },
    [slideShapes, slide, updateShapesOnSlide],
  );

  /* ----------------------------- menu builders ---------------------------- */
  const zEntry = (id: string, op: ZOp): MenuAction => ({
    id,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="w-3.5 text-center text-[10px] text-slate-500">{Z_LABEL_Glyph[op]}</span>
        {Z_LABEL_Menu[op]}
      </span>
    ),
    onPick: () => reorderSelected(op),
  });

  const alignEntry = (onPick: () => void, op: AlignOp, glyph: string, label: string): MenuAction => ({
    id: `align:${op}`,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="w-3.5 text-center text-[10px] text-slate-500">{glyph}</span>
        {label}
      </span>
    ),
    onPick,
  });

  /** the menu a drawn item (or a set of them) shows */
  const buildShapeMenu = useCallback(
    (ids: string[]): MenuAction[] => {
      const items = slideShapes.filter((s) => ids.includes(s.id));
      if (!items.length) return [];
      const locked = items.some((s) => s.locked);
      const single = items.length === 1;
      const allGrouped = !single && items.every((s) => !!s.groupId && s.groupId === items[0].groupId);
      const hasClip = hasShapeClipboard();
      const menu: MenuAction[] = [];
      menu.push({ id: "copy", label: "Copy", shortcut: "Ctrl+C", onPick: () => setShapeClipboard(items) });
      menu.push({ id: "cut", label: "Cut", shortcut: "Ctrl+X", onPick: () => setShapeClipboard(items, true) });
      menu.push({
        id: "paste",
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: !hasClip,
        onPick: () => {
          if (!slide) return;
          pasteShapesAt(slide.id, { x: items[0].x + items[0].w / 2, y: items[0].y + items[0].h / 2 });
        },
      });
      menu.push({
        id: "duplicate",
        label: "Duplicate",
        shortcut: "Ctrl+D",
        onPick: () => {
          if (!slide) return;
          setSelectedShapes(duplicateShapesOnSlide(ids, slide.id));
        },
      });
      menu.push({
        id: "delete",
        label: "Delete",
        shortcut: "Del",
        danger: true,
        disabled: locked,
        onPick: () => {
          if (!slide) return;
          removeShapesOnSlide(ids, slide.id);
          setSelectedShapes([]);
        },
      });
      menu.push({
        id: "layer",
        label: "Layer",
        sub: [zEntry("layer:front", "front"), zEntry("layer:forward", "forward"), zEntry("layer:backward", "backward"), zEntry("layer:back", "back")],
      });
      menu.push({
        id: "align",
        label: "Align element",
        sub: [
          alignEntry(() => (single ? alignSelected("left") : alignShapesToSlide(ids, "left")), "left", "⇤", "Align left"),
          alignEntry(() => (single ? alignSelected("hcenter") : alignShapesToSlide(ids, "hcenter")), "hcenter", "↔", "Center horizontally"),
          alignEntry(() => (single ? alignSelected("right") : alignShapesToSlide(ids, "right")), "right", "⇥", "Align right"),
          alignEntry(() => (single ? alignSelected("top") : alignShapesToSlide(ids, "top")), "top", "⤒", "Align top"),
          alignEntry(() => (single ? alignSelected("vcenter") : alignShapesToSlide(ids, "vcenter")), "vcenter", "↕", "Center vertically"),
          alignEntry(() => (single ? alignSelected("bottom") : alignShapesToSlide(ids, "bottom")), "bottom", "⤓", "Align bottom"),
        ],
      });
      if (!single) {
        menu.push({
          id: allGrouped ? "ungroup" : "group",
          label: allGrouped ? "Ungroup" : "Group",
          shortcut: "Ctrl+G",
          onPick: () => {
            if (locked) return;
            if (allGrouped) {
              ungroupShapes(ids);
              setSelectedShapes([]);
            } else {
              const byGroup = new Map<string, string[]>();
              const loose: string[] = [];
              items.forEach((s) => (s.groupId ? byGroup.set(s.groupId, [...(byGroup.get(s.groupId) ?? []), s.id]) : loose.push(s.id)));
              [...byGroup.values()].forEach((g) => ungroupShapes(g));
              groupShapes(loose.length >= 2 ? loose : []);
            }
          },
        });
      }
      return menu;
    },
    [slideShapes, slide, alignSelected, alignShapesToSlide, groupShapes, ungroupShapes, duplicateShapesOnSlide, removeShapesOnSlide, pasteShapesAt],
  );

  /** the menu a built-in slide element shows */
  const buildElementMenu = useCallback(
    (el: ElementId): MenuAction[] => {
      if (!slide) return [];
      const box = currentTheme.layout[el];
      const locked = !!box?.locked;
      const hidden = !!box?.hidden;
      const hasClip = hasShapeClipboard();
      const menu: MenuAction[] = [];
      menu.push({
        id: "paste",
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: !hasClip,
        onPick: () => pasteShapesAt(slide.id),
      });
      menu.push({
        id: "hide",
        label: hidden ? "Show layer" : "Hide layer",
        onPick: () => patchLayersOp([{ kind: "element", id: el }], { hidden: !hidden }, slide.id),
      });
      menu.push({
        id: "lock",
        label: locked ? "Unlock" : "Lock",
        onPick: () => patchLayersOp([{ kind: "element", id: el }], { locked: !locked }, slide.id),
      });
      menu.push({
        id: "layer",
        label: "Layer",
        sub: [zEntry("layer:front", "front"), zEntry("layer:forward", "forward"), zEntry("layer:backward", "backward"), zEntry("layer:back", "back")],
      });
      menu.push({
        id: "align",
        label: "Align element",
        sub: [
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "left", slide.id), "left", "⇤", "Align left"),
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "hcenter", slide.id), "hcenter", "↔", "Center horizontally"),
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "right", slide.id), "right", "⇥", "Align right"),
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "top", slide.id), "top", "⤒", "Align top"),
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "vcenter", slide.id), "vcenter", "↕", "Center vertically"),
          alignEntry(() => alignLayerOp({ kind: "element", id: el }, "bottom", slide.id), "bottom", "⤓", "Align bottom"),
          { id: "align:center", label: "Center", onPick: () => alignSelected("center") },
        ],
      });
      return menu;
    },
    [slide, currentTheme.layout, alignSelected, alignLayerOp, patchLayersOp, pasteShapesAt],
  );

  /** the menu for the empty board / slide surface */
  const buildBoardMenu = useCallback((): MenuAction[] => {
    if (!slide) return [];
    const menu: MenuAction[] = [];
    menu.push({
      id: "paste",
      label: "Paste",
      shortcut: "Ctrl+V",
      disabled: !hasShapeClipboard(),
      onPick: () => pasteShapesAt(slide.id),
    });
    menu.push({ id: "paste-questions", label: "Paste questions…", onPick: () => setPasteOpen(true) });
    menu.push({
      id: "sel-all",
      label: "Select all",
      shortcut: "Ctrl+A",
      onPick: () => {
        const ids = slideShapes.map((s) => s.id);
        if (ids.length) selectShapeIds(ids);
      },
    });
    menu.push({
      id: "insert",
      label: "Insert shape",
      sub: [
        { id: "ins:text", label: "Text box", onPick: () => insertShape("text", false) },
        { id: "ins:rect", label: "Rectangle", onPick: () => insertShape("rect", false) },
        { id: "ins:ellipse", label: "Circle", onPick: () => insertShape("ellipse", false) },
        { id: "ins:image", label: "Image…", onPick: () => requestTab("images") },
      ],
    });
    return menu;
  }, [slide, slideShapes, selectShapeIds, insertShape, requestTab, pasteShapesAt, setPasteOpen]);

  /* -------- the actual event handlers (wired onto the Slide below) -------- */
  const onShapeContextMenu = useCallback(
    (shapeId: string, x: number, y: number) => {
      if (!slide) return;
      const hit = slideShapes.find((s) => s.id === shapeId);
      let targets: string[];
      if (selectedShapes.includes(shapeId) && selectedShapes.length > 1) {
        targets = [...selectedShapes];
      } else if (hit?.groupId) {
        targets = slideShapes.filter((s) => s.groupId === hit.groupId).map((s) => s.id);
      } else {
        targets = [shapeId];
      }
      setSurface(null);
      setSelectedEl(null);
      setSelectedShapes(targets);
      setCtxMenu({ x, y, shapeId, elementId: null, surface: null });
    },
    [slide, selectedShapes, slideShapes],
  );

  const onElementContextMenu = useCallback(
    (el: ElementId, x: number, y: number) => {
      if (!slide) return;
      setSurface(null);
      setSelectedShapes([]);
      setSelectedEl(el);
      setCtxMenu({ x, y, shapeId: null, elementId: el, surface: null });
    },
    [slide],
  );

  const onBoardContextMenu = useCallback(
    (x: number, y: number) => {
      if (!slide) return;
      setSelectedShapes([]);
      setSelectedEl(null);
      setSurface("background");
      setCtxMenu({ x, y, shapeId: null, elementId: null, surface: "background" });
    },
    [slide],
  );

  /** what the open menu shows, resolved from its snapshot */
  const ctxActions: MenuAction[] = useMemo(() => {
    if (!ctxMenu || !slide) return [];
    if (ctxMenu.shapeId) {
      const targets = selectedShapes.length > 1 && selectedShapes.includes(ctxMenu.shapeId) ? selectedShapes : [ctxMenu.shapeId];
      return buildShapeMenu(targets);
    }
    if (ctxMenu.elementId) return buildElementMenu(ctxMenu.elementId);
    return buildBoardMenu();
  }, [ctxMenu, slide, selectedShapes, buildShapeMenu, buildElementMenu, buildBoardMenu]);

  return (
    <>
      <div className="app-shell relative flex h-full flex-col bg-slate-950 text-slate-200">
        <HistoryPanel open={historyOpen} history={history} onClose={() => setHistoryOpen(false)} />
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-slate-950/90 px-4 py-2.5">
          <div className="mr-2 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-lg font-black text-slate-950 shadow-[0_2px_14px_rgba(251,191,36,.35)]">
              ক
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold text-slate-100">MCQ Slide Studio</h1>
              <p className="text-[11px] text-slate-500">
                {stats.total} slides · {stats.withAnswer} with answers
              </p>
            </div>
          </div>

          <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
            <button
              onClick={undo}
              disabled={!canUndo}
              title={canUndo ? `Undo: ${history.undoLabel} (Ctrl+Z)` : "Nothing to undo"}
              className="rounded-l-lg px-2.5 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title={canRedo ? `Redo: ${history.redoLabel} (Ctrl+Y)` : "Nothing to redo"}
              className="border-l border-white/10 px-2.5 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↷
            </button>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              title="History"
              className={cn(
                "rounded-r-lg border-l border-white/10 px-2.5 py-2 text-xs hover:bg-white/10",
                historyOpen ? "bg-amber-400 text-slate-950" : "text-slate-300",
              )}
            >
              🕘
            </button>
          </div>

          <Btn variant="primary" onClick={() => setPasteOpen(true)}>
            ＋ Paste questions
          </Btn>
          <Btn
            variant="soft"
            onClick={() => setAnswersOpen(true)}
            disabled={!deck.slides.length}
            title="Paste an answer key (1. ঘ 2. গ …) and apply it to all slides"
          >
            ✓ Paste answers
          </Btn>
          <Btn onClick={insertBlank}>Blank slide</Btn>
          <label
            title="Import a PDF or PowerPoint (.pptx) — add the whole document or specific pages as slides, or drop pages onto the current slide"
            className="inline-flex cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            📄 Import PDF / PPTX
            <input
              type="file"
              accept={DECK_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void openDeckUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          <Btn onClick={renumber} title="Renumber all slides 1..n">
            Renumber
          </Btn>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Btn variant="success" onClick={() => setExportOpen(true)} disabled={!deck.slides.length || !!busy}>
            ⬇ Export — PDF · PNG
          </Btn>
          <Btn variant="soft" onClick={() => setPresenting(true)} disabled={!slide}>
            ▶ Present
          </Btn>

          <div className="ml-auto flex items-center gap-2">
            <SlidePicker deck={deck} current={index} revision={revision} onCurrent={setCurrent} />
            {busy && (
              <span className="rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs text-amber-200">{busy}</span>
            )}
            <Btn onClick={saveJson} title="Download the deck as a .json project file">
              Save
            </Btn>
            <label className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
              Open
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => loadJson(e.target.files?.[0])}
              />
            </label>
            <Btn
              variant="danger"
              onClick={() => {
                if (confirm("Reset deck to the sample questions and default theme?")) resetAll();
              }}
            >
              Reset
            </Btn>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <SlideStack
            deck={deck}
            current={index}
            revision={revision}
            selected={scopeSlideIds}
            onSelected={handleSlideSelection}
            onCurrent={setCurrent}
            onClearField={() => setActiveField(null)}
            onMoveTo={moveSlideTo}
            onStep={(id, dir) => moveSlide(id, dir)}
            onDuplicate={duplicateSlide}
            onRemove={removeSlide}
            onDuplicateSelected={duplicateSlides}
            onRemoveSelected={(ids) => {
              removeSlides(ids);
              setScopeSlideIds([]);
            }}
          />

          <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(60%_60%_at_50%_0%,#141a2b_0%,#020617_70%)]">
            {slide ? (
              <>
                {(surface || selectedLayer || activeNav === "answerKey" || activeNav === "images" || activeNav === "shapes" || activeNav === "layers" || activeNav === "theme" || activeNav === "layout") && <ContextToolbar
                  key={`${slide.id}:${surface}:${selectedEl}:${activeNav}:${selectedShapes.join(',')}`}
                  shape={[...(slide.shapes ?? []), ...(deck.globalShapes ?? [])].find(s => s.id === selectedShape)}
                  element={selectedEl} surface={surface} count={selectedShapes.length} grouped={selectedGrouped}
                  nav={activeNav}
                  onPickElement={id => { setSelectedEl(id); setSelectedShapes([]); setSurface(null); }}
                  insertShape={kind => insertShape(kind, { mode: "this" })}
                  onAddImages={files => void importImageFiles(files)}
                  layerTools={activeNav === "layers" ? { total: currentStack.length } : undefined}
                  answerKey={activeNav === "answerKey" ? {
                    answer: slide.answer,
                    showAnswer: slide.showAnswer,
                    options: slide.options,
                    onSetAnswer: (key) => updateSlide(slide.id, { answer: key, showAnswer: key ? slide.showAnswer : false }),
                    onToggleReveal: () => updateSlide(slide.id, { showAnswer: !slide.showAnswer }),
                    onRevealAll: () => updateAll({ showAnswer: true }),
                    onHideAll: () => updateAll({ showAnswer: false }),
                    onClearAll: () => updateAll({ answer: null, showAnswer: false }),
                    onPaste: () => setAnswersOpen(true),
                    onCopies: addAnswerCopies,
                  } : undefined}
                  header={currentHeader}
                  theme={currentTheme} background={effectiveBackground(deck, slide)}
                  patchShape={patch => selectedShape && updateShapeOnSlide(selectedShape, patch, slide.id)}
                  patchTheme={patch => setThemeScoped(patch, "slide", [slide.id])}
                  patchHeader={scopedHeader}
                  patchBox={patch => selectedEl && patchLayoutScoped(selectedEl, patch, "slide", [slide.id])}
                  patchBackground={patch => setBackground(patch, "slide", slide.id)}
                  align={op => {
                    if (selectedShapes.length < 2) { alignSelected(op); return; }
                    const members = [...(slide.shapes ?? []), ...(deck.globalShapes ?? [])].filter(s => selectedShapes.includes(s.id));
                    if (members.some(s => s.locked)) return;
                    const b = selectionBounds(members);
                    if (!b) return;
                    const dx = op === 'left' ? -b.x : op === 'right' ? 100-b.x-b.w : op === 'hcenter' ? 50-b.x-b.w/2 : 0;
                    const dy = op === 'top' ? -b.y : op === 'bottom' ? 100-b.y-b.h : op === 'vcenter' ? 50-b.y-b.h/2 : 0;
                    updateShapesOnSlide(moveMembers(members.map(s => ({id:s.id, geo:s})), dx, dy), slide.id);
                  }}
                  reorder={op => {
                    if (selectedShapes.length < 2) { reorderSelected(op); return; }
                    const keys = currentStack.map(l => parseLayerKey(l.id)).filter((ref): ref is LayerRef => !!ref && ref.kind === 'shape' && selectedShapes.includes(ref.id));
                    if (op === 'back' || op === 'forward') keys.reverse();
                    keys.forEach(ref => reorderLayerRef(ref, op));
                  }}
                  group={() => groupShapes(selectedShapes)} ungroup={() => { ungroupShapes(selectedShapes); setSelectedShapes([]); }}
                  duplicate={() => setSelectedShapes(duplicateShapes(selectedShapes))}
                  remove={() => { removeShapes(selectedShapes); setSelectedShapes([]); }}
                />}
                <div
                  className="relative flex min-h-0 flex-1 flex-col"
                  onDragOver={(e) => {
                    const types = Array.from(e.dataTransfer.types);
                    if (types.includes("Files") || types.includes("application/json")) {
                      e.preventDefault();
                      setDropHint(true);
                    }
                  }}
                  onDragLeave={() => setDropHint(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropHint(false);
                    const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
                    let at: { x: number; y: number } | undefined;
                    if (board) {
                      const r = board.getBoundingClientRect();
                      at = {
                        x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
                        y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
                      };
                    }

                    // Check if dragged from Uploads panel
                    const json = e.dataTransfer.getData("application/json");
                    if (json) {
                      try {
                        const parsed = JSON.parse(json);
                        if (parsed?.type === "slidemaker-upload" && parsed.src) {
                          insertImage(parsed.src, parsed.ratio || 1, false, at, parsed.name);
                          return;
                        }
                      } catch {
                        // ignore
                      }
                    }

                    const files = Array.from(e.dataTransfer.files);
                    if (e.shiftKey && files[0]?.type.startsWith("image/") && slide) {
                      void (async () => {
                        const { loadImageFile, shrinkDataUrl } = await import("./lib/shapes");
                        const { src } = await loadImageFile(files[0]);
                        const shrunk = await shrinkDataUrl(src, 2560, 0.85);
                        addUpload(shrunk, 16 / 9, files[0].name);
                        setBackground({ src: shrunk }, "slide", slide.id);
                        requestTab("background");
                      })();
                      return;
                    }
                    void importImageFiles(files, at);
                  }}
                >
                  {dropHint && (
                    <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 bg-sky-400/10 text-lg font-semibold text-sky-200">
                      Drop images, a PDF or a PowerPoint to place them on the slide · hold Shift to set as background
                    </div>
                  )}
                <Stage>
                  <Slide
                    key={`main-${revision}`}
                    slide={previewedSlideForCanvas ?? slide}
                    header={currentHeader}
                    theme={currentTheme}
                    onField={setActiveField}
                    activeField={activeField}
                    onLayoutChange={moveElement}
                    selected={selectedEl}
                    onSelect={id => {
                      setSelectedEl(id);
                      if (id) {
                        setSurface(null);
                        setSelectedShapes([]);
                        openTabForSelection(tabOfElement(id));
                      }
                    }}
                    onSurfaceSelect={value => { setSurface(value); setSelectedEl(null); setSelectedShapes([]); setActiveField(null); }}
                    globalShapes={previewedGlobalShapes as any}
                    selectedShapeIds={selectedShapes}
                    onSelectShapeIds={selectShapeIds}
                    onShapeChange={(id, patch) => slide && updateShapeOnSlide(id, patch, slide.id)}
                    onShapesChange={(updates) => slide && updateShapesOnSlide(updates, slide.id)}
                    onGroupShapes={(ids) => groupShapes(ids)}
                    onUngroupShapes={(ids) => ungroupShapes(ids)}
                    onLayerCycle={cycleLayers}
                    onShapeContextMenu={(id, x, y) => onShapeContextMenu(id, x, y)}
                    onElementContextMenu={(el, x, y) => onElementContextMenu(el, x, y)}
                    onBoardContextMenu={(x, y) => onBoardContextMenu(x, y)}
                    onGestureEnd={history.commit}
                    background={effectiveBackground(deck, slide)}
                  />
                </Stage>
                </div>
                <div
                  role="toolbar"
                  aria-label="Insert objects"
                  className="flex shrink-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto border-t border-white/10 bg-slate-950/50 px-2 py-1.5"
                >
                  <span className="ml-auto mr-1 shrink-0 text-[10px] font-medium tracking-wide text-slate-500 uppercase">Insert</span>
                  <label
                    title="Upload image, PDF or PowerPoint"
                    aria-label="Upload image, PDF or PowerPoint"
                    className="flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-sky-400/40 bg-sky-400/10 px-2 text-sm text-sky-200 hover:bg-sky-400/20"
                  >
                    📤
                    <input
                      type="file"
                      accept={`image/*,${DECK_ACCEPT}`}
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void importImageFiles(Array.from(e.target.files ?? []));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {([
                    "text",
                    "rect",
                    "rounded",
                    "ellipse",
                    "triangle",
                    "diamond",
                    "star",
                    "line",
                    "arrow",
                  ] as ShapeKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => insertShape(k, false)}
                      title={SHAPE_LABELS[k]}
                      aria-label={SHAPE_LABELS[k]}
                      className={cn(
                        "h-8 min-w-8 shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-slate-200 last:mr-auto hover:border-amber-400/60 hover:bg-white/10",
                        k === "text" && "font-serif font-bold",
                      )}
                    >
                      {SHAPE_ICONS[k]}
                    </button>
                  ))}
                </div>
                <div
                  role="toolbar"
                  aria-label="Slide controls"
                  className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5 border-t border-white/10 bg-slate-950/70 px-2 py-2"
                >
                  <Btn
                    size="sm"
                    title="Previous slide"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => setCurrent(Math.max(0, index - 1))}
                    disabled={index === 0}
                  >
                    <span aria-hidden="true">←</span>
                    <span className="sr-only">Previous slide</span>
                  </Btn>
                  <span className="min-w-[62px] shrink-0 text-center text-xs text-slate-400 tabular-nums">
                    {index + 1} / {deck.slides.length}
                  </span>
                  <Btn
                    size="sm"
                    title="Next slide"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => setCurrent(Math.min(deck.slides.length - 1, index + 1))}
                    disabled={index >= deck.slides.length - 1}
                  >
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">Next slide</span>
                  </Btn>
                  <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
                  {(() => {
                    const ids = Object.keys(currentTheme.layout) as ElementId[];
                    const allFree = ids.every((id) => (currentTheme.layout[id].mode ?? "align") === "free");
                    return (
                      <Btn
                        size="sm"
                        variant={allFree ? "primary" : "ghost"}
                        title={`Free align ${allFree ? "on" : "off"}: drag anything anywhere, resize with the corner grip, rotate`}
                        className="h-8 w-8 shrink-0 p-0"
                        onClick={() => {
                          const mode = allFree ? "align" : "free";
                          scopedTransformLayout((layout) => {
                            const next = { ...layout };
                            ids.forEach((id) => {
                              next[id] = convertMode(id, next[id], mode);
                            });
                            return next;
                          }, `Free align ${mode === "free" ? "on" : "off"}`);
                        }}
                      >
                        <span aria-hidden="true">✥</span>
                        <span className="sr-only">Free align {allFree ? "on" : "off"}</span>
                      </Btn>
                    );
                  })()}
                  <Btn
                    size="sm"
                    variant={slide.showAnswer ? "primary" : "ghost"}
                    title={slide.showAnswer ? "Hide answer" : "Show answer"}
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => updateSlide(slide.id, { showAnswer: !slide.showAnswer })}
                  >
                    <span aria-hidden="true">{slide.showAnswer ? "✓" : "👁"}</span>
                    <span className="sr-only">{slide.showAnswer ? "Answer shown" : "Show answer"}</span>
                  </Btn>
                  <Btn
                    size="sm"
                    title="Duplicate slide"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => duplicateSlide(slide.id)}
                  >
                    <span aria-hidden="true">⧉</span>
                    <span className="sr-only">Duplicate slide</span>
                  </Btn>
                  <Btn
                    size="sm"
                    variant="danger"
                    title="Delete slide"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => removeSlide(slide.id)}
                  >
                    <span aria-hidden="true">🗑</span>
                    <span className="sr-only">Delete slide</span>
                  </Btn>
                  <span className="ml-2 hidden min-w-0 truncate whitespace-nowrap text-[11px] text-slate-500 2xl:block">
                    Drag to move · corner grip to resize · Shift+arrows to nudge · ← → change slides
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <p className="text-slate-400">Your deck is empty.</p>
                <Btn variant="primary" onClick={() => setPasteOpen(true)}>
                  Paste questions to start
                </Btn>
              </div>
            )}
          </main>

          <Inspector
            deck={editorDeck}
            slide={slide}
            activeField={activeField}
            setHeader={scopedHeader}
            setTheme={scopedTheme}
            patchLayout={scopedPatchLayout}
            transformLayout={scopedTransformLayout}
            editScope={editScope}
            onEditScope={setEditScope}
            scopeSlideIds={scopeSlideIds}
            onScopeSlideIds={setScopeSlideIds}
            onApplyDesign={handleApplyDesign}
            onRevertDesign={handleRevertDesign}
            updateSlide={updateSlide}
            updateAll={updateAll}
            onAnswerCopies={addAnswerCopies}
            onPasteAnswers={() => setAnswersOpen(true)}
            onJumpToSlide={setCurrent}
            onFixFormatting={fixFormatting}
            scripts={scripts}
            selectedEl={selectedEl ?? "title"}
            onSelectEl={id => { setSelectedEl(id); setSelectedShapes([]); setSurface(null); }}
            onNavSelect={handleNavSelect}
            forceTab={tabRequest?.tab ?? null}
            forceToken={tabRequest?.n ?? 0}
            shapes={{
              slide: slide?.shapes ?? [],
              global: deck.globalShapes ?? [],
              selectedId: selectedShape,
              selectedIds: selectedShapes,
              onSelect: (id) => selectShapeIds(id ? [id] : []),
              onGroup: (ids) => groupShapes(ids),
              onUngroup: (ids) => ungroupShapes(ids),
              onRemoveIds: (ids) => {
                removeShapes(ids);
                setSelectedShapes([]);
              },
              onDuplicateIds: (ids) => {
                const n = duplicateShapes(ids);
                setSelectedShapes(n);
              },
              onAdd: (kind) => insertShape(kind, { mode: "this" }),
              onChange: (id, patch) => slide && updateShapeOnSlide(id, patch, slide.id),
              onRemove: (id) => {
                removeShape(id);
                setSelectedShapes([]);
              },
              onDuplicate: (id) => {
                const n = duplicateShape(id);
                if (n) setSelectedShapes([n]);
              },
              onToggleScope: (id) => slide && toggleShapeScope(id, slide.id),
              onAddImage: (src, ratio) => insertImage(src, ratio, { mode: "this" }),
              onCopyShapeTo: (id, scope) => copyShapeTo(id, resolveScope(scope)),
              onReorder: (id, op) => reorderShape(id, op, slide?.id ?? null),
              onApplyDesign: (style, kind, exceptId) => applyShapeDesign(style, kind, exceptId, slide?.id ?? null),
            }}
            background={{
              onSet: (patch) => setBackground(patch, "slide", slide?.id ?? null),
              onReset: () => resetBackground("slide", slide?.id ?? null),
              onClearSlide: clearSlideBackground,
            }}
            layers={{
              selected: selectedLayer,
              selectedIds: selectedShapes,
              onSelect: selectLayer,
              onReorder: reorderLayerRef,
              onMoveTo: moveLayerToSlot,
              onPatch: patchLayersRef,
              onDuplicate: duplicateLayersRef,
              onDelete: removeLayersRef,
              onAlign: (ref, op, target) => alignLayerOp(ref, op, slide?.id ?? null, target),
              onDistribute: (refs, axis) => distributeLayersOp(refs, axis, slide?.id ?? null),
            }}
          />
        </div>
      </div>

      {offscreen && (
        <div
          className="offscreen-root"
          style={{ position: "fixed", left: -99999, top: 0, width: SLIDE_W, zIndex: -1, opacity: 1 }}
        >
          {deck.slides.map((s) => (
            <div key={s.id} id={`export-${s.id}`} style={{ width: SLIDE_W, height: SLIDE_H }}>
              <Slide
                key={`e-${revision}`}
                slide={s}
                header={effectiveHeader(deck, s)}
                theme={effectiveTheme(deck, s)}
                globalShapes={deck.globalShapes}
                background={effectiveBackground(deck, s)}
              />
            </div>
          ))}
        </div>
      )}

      <ContextMenu
        menu={ctxMenu ? { x: ctxMenu.x, y: ctxMenu.y } : null}
        actions={ctxActions}
        onClose={() => setCtxMenu(null)}
      />

      <ExportModal
        open={exportOpen}
        deck={deck}
        busy={busy}
        onClose={() => !busy && setExportOpen(false)}
        onExport={runExport}
      />

      <AnswerKeyModal
        open={answersOpen}
        slides={deck.slides}
        currentIndex={index}
        onClose={() => setAnswersOpen(false)}
        onApply={applyAnswers}
      />

      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        existingCount={deck.slides.length}
        onImport={(slides, mode) => {
          addSlides(slides, mode);
          setCurrent(mode === "replace" ? 0 : deck.slides.length);
        }}
      />

      <PdfImportModal file={pdfFile} onClose={() => setPdfFile(null)} onImport={importPdfPages} />

      {presenting && slide && (
        <Presenter
          deck={deck}
          index={index}
          onIndex={setCurrent}
          onToggleAnswer={() => updateSlide(slide.id, { showAnswer: !slide.showAnswer })}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <FontPreviewProvider>
      <AppContent />
    </FontPreviewProvider>
  );
}
