import { useCallback, useEffect, useMemo, useState } from "react";
import Slide, { SLIDE_H, SLIDE_W, type SlideField } from "./components/Slide";
import {
  DEFAULT_FRAME,
  FREE_MAX,
  FREE_MIN,
  type Box,
  type DeckHeader,
  type ElementId,
  type LayoutMap,
  type ThemeSettings,
} from "./lib/types";
import { Stage, Thumb } from "./components/SlideViews";
import Inspector from "./components/Inspector";
import PasteModal from "./components/PasteModal";
import Presenter from "./components/Presenter";
import ExportModal, { type ExportSettings } from "./components/ExportModal";
import type { InspectorTab } from "./components/Inspector";
import type { InsertScope } from "./components/ShapesPanel";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, shrinkDataUrl, type ShapeItem, type ShapeKind } from "./lib/shapes";
import type { AlignOp } from "./lib/shapeAlign";
import { canMove, Z_LABELS, type ZOp } from "./lib/zorder";
import { collectLayers, layerKey, parseLayerKey, visibleStack, type LayerRef } from "./lib/layers";
import { boardLayerChain, groupOf, isWholeGroupOf, type Groupable } from "./lib/groups";
import { partInfo } from "./lib/parts";
import HistoryPanel from "./components/HistoryPanel";
import AnswerKeyModal from "./components/AnswerKeyModal";
import { Btn } from "./components/ui";
import { normalizeDeckZ, useDeck } from "./lib/useDeck";
import { useFontCoverage } from "./lib/useFontCoverage";
import { restoreCustomFonts } from "./lib/customFonts";
import { downloadDataUrl, exportZip, slideToPng } from "./lib/exporter";
import { convertMode, measureElement, measurePart } from "./lib/layoutMeasure";
import { effectiveBackground } from "./lib/background";
import { resolveFrameImageSrc } from "./lib/frameImages";
import { effectiveHeader, effectiveTheme } from "./lib/overrides";
import type { ApplySection } from "./lib/applyDesign";
import { exportPdf } from "./lib/exportPdf";
import { normalizeSource } from "./lib/richPaste";
import { cn } from "./utils/cn";

export default function App() {
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
    addAnswerCopies,
    addShape,
    addImage,
    copyShapeTo,
    updateShapeOnSlide,
    updateShapesOnSlide,
    updateShapes,
    groupLayers,
    ungroupLayers,
    patchPartLayoutScoped,
    updateLayerGeoOnSlide,
    resetParts,
    removeShapes,
    duplicateShapes,
    applyShapeDesign,
    reorderShape,
    reorderLayerOp,
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
  /**
   * Built-in elements (question, options block, title, badge, note…) are fully
   * selectable objects, so the selection holds a LIST of them: a marquee or a
   * group can contain several built-in elements next to parts and shapes.
   */
  const [selectedEls, setSelectedEls] = useState<ElementId[]>(["title"]);
  /** the primary element of the selection — what the layout inspector edits */
  const selectedEl: ElementId | null = selectedEls.length ? selectedEls[selectedEls.length - 1] : null;
  /** multi-selection of drawn items; a group is selected as a unit (all member ids) */
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  /**
   * multi-selection of the slide's BUILT-IN parts — option rows, option text,
   * option numbering markers, the number bullet, the title banner, the frame and
   * the decorative background layers (see lib/parts.ts). They are selected,
   * moved, resized, rotated and grouped exactly like drawn shapes.
   */
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [forceTab, setForceTab] = useState<InspectorTab | null>(null);
  const [editScope, setEditScope] = useState<"slide" | "selected" | "all">("slide");
  const [scopeSlideIds, setScopeSlideIds] = useState<string[]>([]);

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

  /** the "primary" selected drawn item — what the inspector edits */
  const selectedShape = selectedShapes.length ? selectedShapes[selectedShapes.length - 1] : null;

  /**
   * The WHOLE canvas selection as one list: built-in elements, built-in parts
   * and drawn shapes. Group / ungroup, the selection frame and every set
   * gesture work on this list, so any mix of layers behaves like one object.
   */
  const selectedRefs = useMemo<LayerRef[]>(
    () => [
      ...selectedEls.map((id) => ({ kind: "element", id }) as LayerRef),
      ...selectedParts.map((id) => ({ kind: "part", id }) as LayerRef),
      ...selectedShapes.map((id) => ({ kind: "shape", id }) as LayerRef),
    ],
    [selectedEls, selectedParts, selectedShapes],
  );

  /** the slide the canvas shows (kept here because the memos below need it) */
  const curSlide = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];

  /**
   * Every grouped layer of the current slide — a click on one member selects
   * all. Hidden built-ins (e.g. the number-bullet element while the bullet is
   * attached to the question) are left out so a default group only ever
   * contains what is actually painted.
   */
  const groupables = useMemo<Groupable[]>(
    () =>
      collectLayers(deck, curSlide)
        .filter((l) => !!l.groupId && !l.hidden)
        .map((l) => ({ kind: l.ref.kind, id: l.ref.id, groupId: l.groupId } as Groupable)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, current],
  );

  /** expands a selection so no group is ever half-selected */
  const expandGroupRefs = useCallback(
    (refs: LayerRef[]): LayerRef[] => {
      if (!groupables.length) return refs;
      const out = new Map<string, LayerRef>();
      refs.forEach((r) => out.set(layerKey(r), r));
      refs.forEach((r) => {
        const g = groupables.find((x) => x.kind === r.kind && x.id === r.id);
        if (!g?.groupId) return;
        groupOf(groupables, g).forEach((m) =>
          out.set(`${m.kind}:${m.id}`, { kind: m.kind, id: m.id } as LayerRef),
        );
      });
      return [...out.values()];
    },
    [groupables],
  );

  /** the primary layer of the selection — what the inspector / toolbar edit */
  const [primaryRef, setPrimaryRef] = useState<LayerRef | null>(null);

  /** writes one selection into the three stores and points the inspector at it */
  const applySelection = useCallback(
    (refs: LayerRef[]) => {
      setSelectedShapes(refs.filter((r) => r.kind === "shape").map((r) => r.id));
      setSelectedParts(refs.filter((r) => r.kind === "part").map((r) => r.id));
      const els = refs.filter((r) => r.kind === "element");
      setSelectedEls(els.map((r) => r.id as ElementId));

      // Which member does the inspector point at?
      //   • one WHOLE group → the most "content" member wins, so clicking the
      //     question (default group = number bullet + text) still opens the
      //     question editor, and clicking an option (row + numbering + text)
      //     opens that option's text;
      //   • anything else keeps the classic priority: shape → part → element.
      let primary: LayerRef | null = null;
      if (refs.length) {
        const whole = groupables.length ? isWholeGroupOf(groupables, refs) : false;
        if (whole && refs.length > 1) {
          const score = (r: LayerRef): number => {
            if (r.kind === "element") {
              if (r.id === "question" || r.id === "title" || r.id === "badge" || r.id === "note" || r.id === "brand") return 0;
              if (r.id === "logo") return 2;
              return 3;
            }
            if (r.kind === "part") {
              const k = partInfo(r.id).kind;
              if (k === "text") return 1;
              if (k === "shape") return 4;
              if (k === "row") return 5;
              return 6;
            }
            return 4;
          };
          primary = [...refs].sort((a, b) => score(a) - score(b))[0];
        } else {
          primary = refs.find((r) => r.kind === "shape") ?? refs.find((r) => r.kind === "part") ?? els[0] ?? null;
        }
      }
      setPrimaryRef(primary);
      if (!primary) {
        setActiveField(null);
        return;
      }
      if (primary.kind === "shape") {
        setForceTab("shapes");
        return;
      }
      if (primary.kind === "element") {
        setForceTab("layout");
        return;
      }
      const info = partInfo(primary.id);
      setForceTab(info.tab);
      setActiveField(info.field);
    },
    [groupables],
  );

  /** canvas selection callback — groups arrive expanded unless it is a dig-in */
  const selectRefs = useCallback(
    (refs: LayerRef[], opts?: { exact?: boolean }) => applySelection(opts?.exact ? refs : expandGroupRefs(refs)),
    [applySelection, expandGroupRefs],
  );

  const selectShapeIds = useCallback((ids: string[]) => applySelection(ids.map((id) => ({ kind: "shape", id }) as LayerRef)), [applySelection]);

  const insertImage = useCallback(
    (src: string, ratio: number, scope: InsertScope | boolean, at?: { x: number; y: number }) => {
      const id = addImage(src, ratio, resolveScope(scope), at);
      selectShapeIds([id]);
    },
    [addImage, resolveScope, selectShapeIds],
  );

  /** what's currently selected in the unified layer stack — the selection's primary member */
  const selectedLayer: LayerRef | null = primaryRef;

  /** unified stack (elements + built-in parts + drawn items) on the current slide */
  const currentStack = useMemo(() => visibleStack(deck, curSlide), [deck, curSlide]);

  /** layers-panel pick: always exact, so one member of a group stays reachable */
  const selectLayer = useCallback((ref: LayerRef) => applySelection([ref]), [applySelection]);

  /**
   * Alt+click on any layer: walks to the layer directly BENEATH the current
   * selection at that point — the practical way to grab an element that is
   * covered by another one (or by a background container). The chain reaches
   * built-in parts too (option text → marker → row → options block → artwork).
   */
  const cycleLayers = useCallback((clientX: number, clientY: number) => {
    const chain = boardLayerChain(clientX, clientY);
    if (!chain.length) return;
    const sel = new Set<string>(selectedRefs.map(layerKey));
    const idx = chain.findIndex((r) => sel.has(`${r.kind}:${r.id}`));
    const ref = idx < 0 ? chain[0] : chain[(idx + 1) % chain.length];
    selectLayer({ kind: ref.kind, id: ref.id } as LayerRef);
  }, [selectedRefs, selectLayer]);

  const reorderLayerRef = useCallback(
    (ref: LayerRef, op: ZOp) => {
      const sl = deck.slides[Math.min(current, Math.max(0, deck.slides.length - 1))];
      reorderLayerOp(ref, op, sl?.id ?? null);
    },
    [deck.slides, current, reorderLayerOp],
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
      selectShapeIds([id]);
    },
    [addShape, resolveScope, selectShapeIds],
  );

  const [offscreen, setOffscreen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const index = Math.min(current, Math.max(0, deck.slides.length - 1));
  const slide = deck.slides[index];
  const currentTheme = effectiveTheme(deck, slide);
  const currentHeader = effectiveHeader(deck, slide);
  const editorDeck = { ...deck, theme: currentTheme, header: currentHeader };
  // While editing, edits update the current slide live so user can preview their design
  const thisSlideId = useMemo(() => (slide ? [slide.id] : []), [slide]);
  const scopedTheme = useCallback(
    (patch: Partial<ThemeSettings>, coalesceKey?: string) =>
      setThemeScoped(patch, "slide", thisSlideId, coalesceKey),
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
  /** same, for a built-in PART (option row, option text, marker, banner, artwork…) */
  const scopedPatchPartLayout = useCallback(
    (id: string, patch: Partial<Box>, label?: string) =>
      patchPartLayoutScoped(id, patch, "slide", thisSlideId, label),
    [patchPartLayoutScoped, thisSlideId],
  );
  const movePart = useCallback(
    (id: string, patch: Partial<Box>) => scopedPatchPartLayout(id, patch),
    [scopedPatchPartLayout],
  );
  /** one batched geometry write for a mixed selection / group gesture */
  const moveLayers = useCallback(
    (updates: { ref: LayerRef; patch: Partial<Box> }[]) => {
      if (!slide) return;
      const n = updates.length;
      const key = Object.keys(updates[0]?.patch ?? {})[0];
      const label =
        key === "rot"
          ? `Rotate ${n} item${n === 1 ? "" : "s"}`
          : key === "w" || key === "h"
            ? `Resize ${n} item${n === 1 ? "" : "s"}`
            : `Move ${n} item${n === 1 ? "" : "s"}`;
      updateLayerGeoOnSlide(updates, slide.id, label);
    },
    [slide, updateLayerGeoOnSlide],
  );

  /**
   * Inline text editing on the canvas (double-click any text object): writes
   * straight into the field that object paints, so question / option / title /
   * badge / note editing keeps working exactly as it does from the inspector.
   */
  const setFieldText = useCallback(
    (field: SlideField, value: string) => {
      if (!slide) return;
      switch (field) {
        case "question":
          updateSlide(slide.id, { question: value });
          return;
        case "note":
          updateSlide(slide.id, { note: value });
          return;
        case "title":
          scopedHeader({ title: value });
          return;
        case "brandTop":
          scopedHeader({ brandTop: value });
          return;
        case "brandBottom":
          scopedHeader({ brandBottom: value });
          return;
        case "badge":
          scopedHeader({ badge: value });
          return;
        default: {
          const s = String(field);
          if (!s.startsWith("option:")) return;
          const i = Number(s.slice(7));
          if (!slide.options[i]) return;
          updateSlide(slide.id, {
            options: slide.options.map((o, j) => (j === i ? { ...o, text: value } : o)),
          });
        }
      }
    },
    [slide, updateSlide, scopedHeader],
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
        // Deck-level undo everywhere. Inside a text field the deck's history
        // already holds each typing burst (coalesced), so we blur the field to
        // keep React's controlled value authoritative and revert the deck.
        const isRedo = e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey);
        e.preventDefault();
        if (inField) (t as HTMLElement).blur();
        if (isRedo) redo();
        else undo();
        return;
      }
      if (inField) return;

      // Escape clears the whole selection (element + shapes + active field)
      if (e.key === "Escape") {
        applySelection([]);
        setActiveField(null);
        return;
      }

      // Ctrl/⌘+A selects every drawn item on this slide
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "a") {
        const ids = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].map((x) => x.id);
        if (ids.length) {
          e.preventDefault();
          selectShapeIds(ids);
        }
        return;
      }

      // Ctrl/⌘+Shift+A selects literally everything on the slide, built-ins included
      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        applySelection(currentStack.map((l) => parseLayerKey(l.id)).filter((r): r is LayerRef => !!r));
        return;
      }

      // Tab / Shift+Tab walks the unified layer stack (every element + shape),
      // so a covered item is always reachable without ungrouping anything.
      // Only hijacked on slides that actually have drawn items, so normal
      // keyboard focus travel is untouched everywhere else.
      const slideShapeCount = (deck.globalShapes?.length ?? 0) + (slide?.shapes?.length ?? 0);
      if (e.key === "Tab" && !mod && currentStack.length && slideShapeCount > 0) {
        e.preventDefault();
        const selKeys = new Set<string>(selectedRefs.map(layerKey));
        const step = e.shiftKey ? -1 : 1;
        let idx = currentStack.findIndex((s) => selKeys.has(s.id));
        if (idx < 0) idx = step === 1 ? -1 : currentStack.length;
        const next = currentStack[(idx + step + currentStack.length) % currentStack.length];
        const ref = parseLayerKey(next.id);
        if (ref) selectLayer(ref);
        return;
      }

      // Ctrl/⌘+G groups the selection; Ctrl/⌘+Shift+G ungroups it (lossless).
      // Groups can mix drawn shapes with built-in elements and built-in parts.
      if (mod && !e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedRefs.length) ungroupLayers(selectedRefs);
        } else if (selectedRefs.length >= 2) {
          groupLayers(selectedRefs);
        }
        return;
      }

      // shape shortcuts — single, group or multi-selection
      if (selectedShapes.length) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeShapes(selectedShapes);
          applySelection(selectedRefs.filter((r) => r.kind !== "shape"));
          return;
        }
        if (mod && e.key.toLowerCase() === "d") {
          e.preventDefault();
          const ids = duplicateShapes(selectedShapes);
          if (ids.length) selectShapeIds(ids);
          return;
        }
        // Ctrl+] / Ctrl+[ = forward / backward; add Shift for front / back
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
          // one batched update → every unlocked member of the selection nudges
          // together and undo steps back over the whole set at once
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

      // Ctrl+] / Ctrl+[ on a selected slide element (shapes handled above)
      if ((e.ctrlKey || e.metaKey) && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        reorderSelected(up ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
        return;
      }

      // Shift + arrows nudge the selection — built-in elements and built-in
      // parts together, in ONE undo step. Plain arrows still change slides.
      if (e.shiftKey && e.key.startsWith("Arrow") && selectedRefs.length) {
        const step = e.altKey ? 0.2 : 1;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
        const ups: { ref: LayerRef; patch: Partial<Box> }[] = [];
        selectedRefs.forEach((ref) => {
          if (ref.kind === "shape") return; // drawn items are nudged above
          const b =
            ref.kind === "part"
              ? currentTheme.partLayout?.[ref.id]
              : currentTheme.layout[ref.id as ElementId];
          const free = (b?.mode ?? "align") === "free";
          if (!free) {
            // still laid out by the slide: nudge it from where it is painted,
            // which promotes it to a free object (exactly like dragging it) —
            // group members always move the same amount, together
            const m = ref.kind === "part" ? measurePart(ref.id) : measureElement(ref.id as ElementId);
            if (!m) return;
            ups.push({
              ref,
              patch: {
                mode: "free",
                w: Math.round(m.w * 10) / 10,
                h: Math.round(m.h * 10) / 10,
                x: Math.max(FREE_MIN, Math.min(FREE_MAX, Math.round((m.left + dx) * 10) / 10)),
                y: Math.max(FREE_MIN, Math.min(FREE_MAX, Math.round((m.top + dy) * 10) / 10)),
              },
            });
            return;
          }
          if (!b) return;
          ups.push({
            ref,
            patch: {
              x: Math.max(FREE_MIN, Math.min(FREE_MAX, Math.round((b.x + dx) * 10) / 10)),
              y: Math.max(FREE_MIN, Math.min(FREE_MAX, Math.round((b.y + dy) * 10) / 10)),
            },
          });
        });
        if (ups.length) {
          e.preventDefault();
          moveLayers(ups);
        }
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
    selectedShapes,
    selectedRefs,
    currentStack,
    currentTheme,
    moveLayers,
    scopedPatchPartLayout,
    applySelection,
    setCurrent,
    selectShapeIds,
    selectLayer,
    groupLayers,
    ungroupLayers,
    patchPartLayoutScoped,
    updateLayerGeoOnSlide,
    resetParts,
    removeShapes,
    duplicateShapes,
    updateShapes,
    reorderSelected,
    undo,
    redo,
  ]);

  /* ------------------------------- exporting ----------------------------- */
  /** mounts every slide at full size off-screen so exporters can rasterise them */
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
    const name = (cfg.fileName || "mcq-slides").replace(/[\\/:*?"<>|]+/g, "").trim() || "mcq-slides";
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

  /** re-runs the formatting converter over stored text (repairs earlier pastes) */
  const fixFormatting = useCallback(
    (scope: "slide" | "all") => {
      // reflow is off here: a single field must never be split into new lines
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

  /* --------------------------- deck save / load -------------------------- */
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
                // decks exported with the retired frame collection keep working
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

  /**
   * Does the selection contain a grouped layer? Drives the Ungroup button for
   * ANY mix of drawn shapes, built-in elements and built-in parts.
   */
  const selectedGrouped = useMemo(() => {
    if (!selectedRefs.length) return false;
    const keys = new Set(selectedRefs.map(layerKey));
    return groupables.some((g) => !!g.groupId && keys.has(`${g.kind}:${g.id}`));
  }, [selectedRefs, groupables]);

  return (
    <>
      <div className="app-shell relative flex h-full flex-col bg-slate-950 text-slate-200">
        <HistoryPanel open={historyOpen} history={history} onClose={() => setHistoryOpen(false)} />
        {/* ------------------------------ top bar ----------------------------- */}
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
          {/* ---------------------------- slide rail --------------------------- */}
          <aside className="flex w-[230px] shrink-0 flex-col border-r border-white/10 bg-slate-950/60">
            <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Slides
              <span className="text-slate-600">{deck.slides.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
              {deck.slides.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrent(i);
                    setActiveField(null);
                  }}
                  className={cn(
                    "group relative cursor-pointer rounded-lg border p-1 transition-colors",
                    i === index ? "border-amber-400 bg-amber-400/10" : "border-white/10 hover:border-white/25",
                  )}
                >
                  <div className="pointer-events-none">
                    <Thumb width={196}>
                      <Slide
                        key={`t-${revision}`}
                        slide={s}
                        header={effectiveHeader(deck, s)}
                        theme={effectiveTheme(deck, s)}
                        globalShapes={deck.globalShapes}
                        background={effectiveBackground(deck, s)}
                      />
                    </Thumb>
                  </div>
                  <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-amber-300">
                    {i + 1}
                  </span>
                  <div className="absolute right-1.5 bottom-1.5 hidden gap-1 group-hover:flex">
                    {[
                      { t: "↑", fn: () => moveSlide(s.id, -1) },
                      { t: "↓", fn: () => moveSlide(s.id, 1) },
                      { t: "⧉", fn: () => duplicateSlide(s.id) },
                      { t: "✕", fn: () => removeSlide(s.id) },
                    ].map((b) => (
                      <button
                        key={b.t}
                        onClick={(e) => {
                          e.stopPropagation();
                          b.fn();
                        }}
                        className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-amber-400 hover:text-slate-950"
                      >
                        {b.t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!deck.slides.length && (
                <p className="px-1 py-6 text-center text-xs text-slate-600">
                  No slides yet. Use “Paste questions”.
                </p>
              )}
            </div>
          </aside>

          {/* ------------------------------ canvas ----------------------------- */}
          <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(60%_60%_at_50%_0%,#141a2b_0%,#020617_70%)]">
            {slide ? (
              <>
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
                    // Shift + drop → set as this slide's background instead of inserting a shape
                    if (e.shiftKey && files[0]?.type.startsWith("image/") && slide) {
                      void (async () => {
                        const { loadImageFile, shrinkDataUrl } = await import("./lib/shapes");
                        const { src } = await loadImageFile(files[0]);
                        setBackground({ src: await shrinkDataUrl(src, 2560, 0.85) }, "slide", slide.id);
                        setForceTab("background");
                      })();
                      return;
                    }
                    // drop position → % of the board, so the image lands under the cursor
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
                    slide={slide}
                    header={currentHeader}
                    theme={currentTheme}
                    onField={setActiveField}
                    activeField={activeField}
                    onLayoutChange={moveElement}
                    onPartChange={movePart}
                    selectedRefs={selectedRefs}
                    onSelectRefs={selectRefs}
                    globalShapes={deck.globalShapes}
                    onShapeChange={(id, patch) => slide && updateShapeOnSlide(id, patch, slide.id)}
                    onShapesChange={(updates) => slide && updateShapesOnSlide(updates, slide.id)}
                    onLayerGeo={moveLayers}
                    onGroupRefs={(refs) => groupLayers(refs)}
                    onUngroupRefs={(refs) => ungroupLayers(refs)}
                    groupables={groupables}
                    onTextChange={setFieldText}
                    onPartOptions={(id) => setForceTab(partInfo(id).tab)}
                    onFrameChange={(patch) =>
                      scopedTheme({ frame: { ...currentTheme.frame, ...patch } }, "frame-width")
                    }
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
                  {(["text", "rect", "rounded", "ellipse", "triangle", "diamond", "star", "line", "arrow"] as ShapeKind[]).map(
                    (k) => (
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
                    ),
                  )}
                  {selectedLayer && (
                    <>
                      <div className="mx-1 h-5 w-px bg-white/10" />
                      <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                        Align{selectedLayer.kind === "element" ? ` · ${selectedLayer.id}` : ""}
                      </span>
                      {(
                        [
                          ["left", "⇤", "Align to left edge of slide"],
                          ["hcenter", "⫿", "Center horizontally on slide"],
                          ["right", "⇥", "Align to right edge of slide"],
                          ["top", "⤒", "Align to top of slide"],
                          ["vcenter", "⩵", "Center vertically on slide"],
                          ["bottom", "⤓", "Align to bottom of slide"],
                          ["center", "✛", "Center on slide (both axes)"],
                        ] as [AlignOp | "center", string, string][]
                      ).map(([op, icon, title]) => (
                        <button
                          key={op}
                          title={title}
                          onClick={() => alignSelected(op)}
                          className="h-8 min-w-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10"
                        >
                          {icon}
                        </button>
                      ))}
                      <div className="mx-1 h-5 w-px bg-white/10" />
                      <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">Layer</span>
                      {(["back", "backward", "forward", "front"] as ZOp[]).map((op) => {
                        const enabled = canMove(currentStack, layerKey(selectedLayer), op);
                        return (
                          <button
                            key={op}
                            disabled={!enabled}
                            title={`${Z_LABELS[op].label} — ${Z_LABELS[op].hint}`}
                            onClick={() => reorderSelected(op)}
                            className="h-8 min-w-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {Z_LABELS[op].icon}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {selectedRefs.length > 0 && (
                    <>
                      <div className="mx-1 h-5 w-px bg-white/10" />
                      <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                        Selection{selectedRefs.length > 1 ? ` · ${selectedRefs.length}` : ""}
                      </span>
                      {selectedRefs.length >= 2 && !selectedGrouped && (
                        <Btn
                          size="sm"
                          variant="soft"
                          title="Combine the selected items into one group (Ctrl/⌘+G) — they then move, resize and rotate as a unit. Built-in parts (option rows, markers, banner…) can be grouped with shapes."
                          onClick={() => groupLayers(selectedRefs)}
                        >
                          ⧉ Group {selectedRefs.length}
                        </Btn>
                      )}
                      {selectedGrouped && (
                        <Btn
                          size="sm"
                          variant="soft"
                          title="Break the group (Ctrl/⌘+Shift+G) — every member keeps its exact position, size, rotation, style and content and becomes independently selectable"
                          onClick={() => ungroupLayers(selectedRefs)}
                        >
                          ⧉ Ungroup
                        </Btn>
                      )}
                      {selectedParts.length > 0 && (
                        <Btn
                          size="sm"
                          title="Put the selected built-in elements back where the design places them — the frame returns to its default thickness (nothing is deleted)"
                          onClick={() => {
                            const resettable = selectedParts.filter((id) => id !== "frame");
                            if (resettable.length) resetParts(resettable, slide?.id ?? null);
                            if (selectedParts.includes("frame")) {
                              scopedTheme({
                                frame: { ...currentTheme.frame, width: DEFAULT_FRAME.width },
                              });
                            }
                            applySelection(selectedRefs.filter((r) => r.kind !== "part"));
                          }}
                        >
                          ⟲ Reset position
                        </Btn>
                      )}
                    </>
                  )}
                  {selectedShapes.length > 0 && (
                    <>
                      <div className="mx-1 h-5 w-px bg-white/10" />
                      <Btn
                        size="sm"
                        onClick={() => {
                          const ids = duplicateShapes(selectedShapes);
                          if (ids.length) selectShapeIds(ids);
                        }}
                      >
                        ⧉ Duplicate
                      </Btn>
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          removeShapes(selectedShapes);
                          applySelection(selectedRefs.filter((r) => r.kind !== "shape"));
                        }}
                      >
                        ✕ Delete{selectedShapes.length > 1 ? ` ${selectedShapes.length}` : ""}
                      </Btn>
                    </>
                  )}
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

          {/* ----------------------------- inspector --------------------------- */}
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
            onFixFormatting={fixFormatting}
            scripts={scripts}
            selectedEl={selectedEl ?? "title"}
            onSelectEl={(id) => applySelection([{ kind: "element", id }])}
            selectedPart={primaryRef?.kind === "part" ? primaryRef.id : null}
            forceTab={forceTab}
            shapes={{
              slide: slide?.shapes ?? [],
              global: deck.globalShapes ?? [],
              selectedId: selectedShape,
              selectedIds: selectedShapes,
              // panel picks are exact: a group member can be selected alone
              onSelect: (id) => applySelection(id ? [{ kind: "shape", id }] : []),
              onGroup: (ids) => groupLayers(ids.map((id) => ({ kind: "shape", id }) as LayerRef)),
              onUngroup: (ids) => ungroupLayers(ids.map((id) => ({ kind: "shape", id }) as LayerRef)),
              onRemoveIds: (ids) => {
                removeShapes(ids);
                applySelection(selectedRefs.filter((r) => r.kind !== "shape"));
              },
              onDuplicateIds: (ids) => {
                const n = duplicateShapes(ids);
                selectShapeIds(n);
              },
              onAdd: (kind) => insertShape(kind, { mode: "this" }),
              onChange: (id, patch) => slide && updateShapeOnSlide(id, patch, slide.id),
              onRemove: (id) => {
                removeShape(id);
                applySelection(selectedRefs.filter((r) => !(r.kind === "shape" && r.id === id)));
              },
              onDuplicate: (id) => {
                const n = duplicateShape(id);
                if (n) selectShapeIds([n]);
              },
              onToggleScope: (id) => slide && toggleShapeScope(id, slide.id),
              onAddImage: (src, ratio) => insertImage(src, ratio, { mode: "this" }),
              onCopyShapeTo: (id, scope) => copyShapeTo(id, resolveScope(scope)),
              onReorder: (id, op) => reorderShape(id, op, slide?.id ?? null),
              onApplyDesign: (style, kind, exceptId) => applyShapeDesign(style, kind, exceptId, slide?.id ?? null),
            }}
            background={{
              // Background panel is a live editor for this slide. Distribution
              // happens only through the explicit Apply Changes button above.
              onSet: (patch) => setBackground(patch, "slide", slide?.id ?? null),
              onReset: () => resetBackground("slide", slide?.id ?? null),
              onClearSlide: clearSlideBackground,
            }}
            layers={{
              selected: selectedLayer,
              onSelect: selectLayer,
              onReorder: reorderLayerRef,
              onAlign: (ref, op, target) => alignLayerOp(ref, op, slide?.id ?? null, target),
              onDistribute: (refs, axis) => distributeLayersOp(refs, axis, slide?.id ?? null),
            }}
          />
        </div>
      </div>

      {/* ------------------------- offscreen render roots ---------------------- */}
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
