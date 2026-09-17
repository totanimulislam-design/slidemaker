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
import Presenter from "./components/Presenter";
import ExportModal, { type ExportSettings } from "./components/ExportModal";
import type { InspectorTab } from "./components/Inspector";
import type { InsertScope } from "./components/ShapesPanel";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, shrinkDataUrl, type ShapeItem, type ShapeKind } from "./lib/shapes";
import type { AlignOp } from "./lib/shapeAlign";
import { type ZOp } from "./lib/zorder";
import { paintedStack, parseLayerKey, visibleStack, type LayerPatch, type LayerRef } from "./lib/layers";
import { boardLayerChain, selectionBounds, moveMembers } from "./lib/groups";
import HistoryPanel from "./components/HistoryPanel";
import AnswerKeyModal from "./components/AnswerKeyModal";
import { Btn } from "./components/ui";
import { normalizeDeckZ, useDeck } from "./lib/useDeck";
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
    insertBlank,
    removeSlide,
    duplicateSlide,
    moveSlide,
    moveSlideTo,
    addAnswerCopies,
    addShape,
    addImage,
    copyShapeTo,
    updateShapeOnSlide,
    updateShapesOnSlide,
    updateShapes,
    groupShapes,
    ungroupShapes,
    removeShapes,
    duplicateShapes,
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
   * (Answer key, Insert images, Insert shapes) get their related tools there.
   * Mirrors `tabRequest`, so canvas clicks and navigation picks always agree.
   */
  const [activeNav, setActiveNav] = useState<InspectorTab | null>(null);
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
    (src: string, ratio: number, scope: InsertScope | boolean, at?: { x: number; y: number }) => {
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
        // a lone picture opens "Insert images"; anything else opens "Insert shapes"
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
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return false;
      setBusy(`Loading ${imgs.length} image${imgs.length > 1 ? "s" : ""}…`);
      try {
        for (const f of imgs) {
          const { src, ratio } = await loadImageFile(f);
          insertImage(await shrinkDataUrl(src), ratio, false, at);
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
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        void importImageFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importImageFiles, presenting, pasteOpen, exportOpen]);

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
    // the destinations that do not depend on a selection (Answer key, Insert
    // images, Insert shapes) stay open across slides — their tools apply to the
    // slide you just moved to; every other destination needs its element back
    setActiveNav((nav) =>
      nav === "answerKey" || nav === "images" || nav === "shapes" || nav === "layers" ? nav : null,
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
          updateShapes(updates, "Move shape");
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
    updateShapes,
    reorderSelected,
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
            onCurrent={setCurrent}
            onClearField={() => setActiveField(null)}
            onMoveTo={moveSlideTo}
            onStep={(id, dir) => moveSlide(id, dir)}
            onDuplicate={duplicateSlide}
            onRemove={removeSlide}
          />

          <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(60%_60%_at_50%_0%,#141a2b_0%,#020617_70%)]">
            {slide ? (
              <>
                {(surface || selectedLayer || activeNav === "answerKey" || activeNav === "images" || activeNav === "shapes" || activeNav === "layers") && <ContextToolbar
                  key={`${slide.id}:${surface}:${selectedEl}:${activeNav}:${selectedShapes.join(',')}`}
                  shape={[...(slide.shapes ?? []), ...(deck.globalShapes ?? [])].find(s => s.id === selectedShape)}
                  element={selectedEl} surface={surface} count={selectedShapes.length} grouped={selectedGrouped}
                  nav={activeNav}
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
                    if (Array.from(e.dataTransfer.types).includes("Files")) {
                      e.preventDefault();
                      setDropHint(true);
                    }
                  }}
                  onDragLeave={() => setDropHint(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropHint(false);
                    const files = Array.from(e.dataTransfer.files);
                    if (e.shiftKey && files[0]?.type.startsWith("image/") && slide) {
                      void (async () => {
                        const { loadImageFile, shrinkDataUrl } = await import("./lib/shapes");
                        const { src } = await loadImageFile(files[0]);
                        setBackground({ src: await shrinkDataUrl(src, 2560, 0.85) }, "slide", slide.id);
                        requestTab("background");
                      })();
                      return;
                    }
                    const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
                    let at: { x: number; y: number } | undefined;
                    if (board) {
                      const r = board.getBoundingClientRect();
                      at = {
                        x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
                        y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
                      };
                    }
                    void importImageFiles(files, at);
                  }}
                >
                  {dropHint && (
                    <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 bg-sky-400/10 text-lg font-semibold text-sky-200">
                      Drop image to place it on the slide · hold Shift to set as background
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
                    onGestureEnd={history.commit}
                    background={effectiveBackground(deck, slide)}
                  />
                </Stage>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-t border-white/10 bg-slate-950/50 px-4 py-1.5">
                  <span className="mr-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">Insert</span>
                  <label
                    title="Insert image"
                    className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border border-sky-400/40 bg-sky-400/10 px-2 text-sm text-sky-200 hover:bg-sky-400/20"
                  >
                    🖼
                    <input
                      type="file"
                      accept="image/*"
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
                      className={cn(
                        "h-8 min-w-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10",
                        k === "text" && "font-serif font-bold",
                      )}
                    >
                      {SHAPE_ICONS[k]}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-slate-950/70 px-4 py-2.5">
                  <Btn size="sm" onClick={() => setCurrent(Math.max(0, index - 1))} disabled={index === 0}>
                    ←
                  </Btn>
                  <span className="min-w-[74px] text-center text-xs text-slate-400 tabular-nums">
                    {index + 1} / {deck.slides.length}
                  </span>
                  <Btn
                    size="sm"
                    onClick={() => setCurrent(Math.min(deck.slides.length - 1, index + 1))}
                    disabled={index >= deck.slides.length - 1}
                  >
                    →
                  </Btn>
                  <div className="mx-2 h-5 w-px bg-white/10" />
                  {(() => {
                    const ids = Object.keys(currentTheme.layout) as ElementId[];
                    const allFree = ids.every((id) => (currentTheme.layout[id].mode ?? "align") === "free");
                    return (
                      <Btn
                        size="sm"
                        variant={allFree ? "primary" : "ghost"}
                        title="Free align: drag anything anywhere, resize with the corner grip, rotate"
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
                        ✥ Free align {allFree ? "on" : "off"}
                      </Btn>
                    );
                  })()}
                  <Btn
                    size="sm"
                    variant={slide.showAnswer ? "primary" : "ghost"}
                    onClick={() => updateSlide(slide.id, { showAnswer: !slide.showAnswer })}
                  >
                    {slide.showAnswer ? "✓ Answer shown" : "Show answer"}
                  </Btn>
                  <Btn size="sm" onClick={() => duplicateSlide(slide.id)}>
                    Duplicate
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => removeSlide(slide.id)}>
                    Delete
                  </Btn>
                  <span className="ml-2 hidden text-[11px] text-slate-500 lg:block">
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
