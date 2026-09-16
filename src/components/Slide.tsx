import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  Box,
  DeckHeader,
  ElementId,
  SlideData,
  SlideField,
  ThemeSettings,
} from "../lib/types";
import { shade, withAlpha } from "../lib/color";
import { isWideNumberStyle, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { effectiveOptionLabel } from "../lib/plainNumbering";
import { optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import OptionBulletMarker from "./OptionBulletMarker";
import { isRtlText } from "../lib/fonts";
import { boxFontCss, boxStack, boxTypeface, deckStack, optionTextStack } from "../lib/boxFonts";
import { BAND_CONTENT, BAND_UI, safeZ } from "../lib/zorder";
import { ELEMENT_DEFAULT_Z, detachedPartBox, partZ, type LayerRef } from "../lib/layers";
import { bannerCss } from "../lib/banner";
import { backgroundLayers } from "../lib/background";
import type { BackgroundSettings } from "../lib/types";
import { DEFAULT_BANNER, DEFAULT_FRAME } from "../lib/types";
import { computeFrameCss } from "../lib/frameDesigns";
import { resolveFrameImageSrc } from "../lib/frameImages";
import {
  boxesOverlap,
  groupOf,
  moveMembers,
  rotateMembers,
  scaleMembers,
  selectionBounds,
  type BoxRect,
  type Groupable,
  type MemberGeo,
} from "../lib/groups";
import {
  HANDLES,
  applyMove,
  applyResize,
  applyRotate,
  type Gesture as FreeGesture,
  type Handle,
} from "../lib/freeTransform";
import { measureElement, measurePart } from "../lib/layoutMeasure";
import {
  BG_PART_IDS,
  PART_BANNER,
  PART_BG_DESIGN,
  PART_FRAME,
  PART_QBULLET,
  collectParts,
  optionBulletId,
  optionRowId,
  optionTextId,
  partInfo,
  partLabel,
  type PartId,
} from "../lib/parts";
import MathText from "./MathText";
import ShapeLayer from "./ShapeLayer";
import type { ShapeItem } from "../lib/shapes";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

/** re-exported so existing importers (`App`, `Inspector`) keep working */
export type { SlideField };

const FIELD_OF: Record<ElementId, SlideField> = {
  logo: "logo",
  brand: "brandTop",
  title: "title",
  badge: "badge",
  question: "question",
  options: "option:0",
  note: "note",
  bullet: "question",
};

/** which built-in elements carry text that can be edited right on the canvas */
const ELEMENT_TEXT_FIELD: Partial<Record<ElementId, SlideField>> = {
  title: "title",
  badge: "badge",
  question: "question",
  note: "note",
  options: "option:0",
};

interface Props {
  slide: SlideData;
  header: DeckHeader;
  theme: ThemeSettings;
  onField?: (field: SlideField | null) => void;
  activeField?: SlideField | null;
  total?: number;
  index?: number;
  /** enables drag-to-position and reports the new box of a built-in element */
  onLayoutChange?: (id: ElementId, patch: Partial<Box>) => void;
  /** same, for a built-in PART (option row / option text / marker / banner / artwork …) */
  onPartChange?: (id: PartId, patch: Partial<Box>) => void;
  /**
   * The unified canvas selection: built-in elements, built-in parts and drawn
   * shapes all live in ONE list, so a group can mix any of them.
   */
  selectedRefs?: LayerRef[];
  onSelectRefs?: (refs: LayerRef[], opts?: { exact?: boolean }) => void;
  /** deck-wide shapes rendered beneath the slide's own */
  globalShapes?: ShapeItem[];
  onShapeChange?: (id: string, patch: Partial<ShapeItem>) => void;
  /** batched patches from group / multi-selection gestures */
  onShapesChange?: (updates: { id: string; patch: Partial<ShapeItem> }[]) => void;
  /** batched geometry for ANY mix of layers — one undo step for the whole gesture */
  onLayerGeo?: (updates: { ref: LayerRef; patch: Partial<Box> }[]) => void;
  onGroupRefs?: (refs: LayerRef[]) => void;
  onUngroupRefs?: (refs: LayerRef[]) => void;
  /** every groupable layer of this slide + its group tag (group expansion) */
  groupables?: Groupable[];
  /** inline text editing (double-click) of a built-in text field */
  onTextChange?: (field: SlideField, value: string) => void;
  /** Alt+click on any layer: select the layer beneath it (overlap navigation) */
  onLayerCycle?: (clientX: number, clientY: number) => void;
  /** called when a drag/resize/rotate finishes — closes the undo coalescing window */
  onGestureEnd?: () => void;
  /** effective background for this slide (deck default merged with the slide override) */
  background?: BackgroundSettings;
}

const SNAP = [0, 25, 50, 75, 100];
const snapAnchor = (v: number, tol = 1.8) => {
  const hit = SNAP.find((t) => Math.abs(v - t) < tol);
  return hit === undefined ? v : hit;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const keyOf = (ref: LayerRef) => `${ref.kind}:${ref.id}`;
const ELEMENT_LABEL: Record<ElementId, string> = {
  logo: "Logo", brand: "Brand", title: "Title", badge: "Badge", bullet: "Number bullet", question: "Question", options: "Options", note: "Footnote",
};

interface FreeBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/**
 * A gesture that transforms a whole SET of layers (a group or a multi-selection)
 * at once. Members can be drawn shapes, built-in elements and built-in parts —
 * each keeps its own geometry, so the set transform is always lossless.
 */
type SetGesture =
  | { mode: "move"; refs: LayerRef[]; start: Record<string, MemberGeo>; px0: number; py0: number }
  | {
      mode: "resize";
      refs: LayerRef[];
      start: Record<string, MemberGeo>;
      handle: Handle;
      sx: number;
      sy: number;
      bounds: BoxRect;
    }
  | {
      mode: "rotate";
      refs: LayerRef[];
      start: Record<string, MemberGeo>;
      cx: number;
      cy: number;
      startAngle: number;
      board: { left: number; top: number; width: number; height: number };
    };

/** what the inline text editor is editing right now */
interface EditTarget {
  ref: LayerRef;
  /** built-in text field, or null when editing a drawn shape's own text */
  field: SlideField | null;
}

function SlideBase({
  slide,
  header,
  theme,
  onField,
  activeField,
  total,
  index,
  onLayoutChange,
  onPartChange,
  selectedRefs,
  onSelectRefs,
  globalShapes,
  onShapeChange,
  onShapesChange,
  onLayerGeo,
  onGroupRefs,
  onUngroupRefs,
  groupables,
  onTextChange,
  onLayerCycle,
  onGestureEnd,
  background,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<(FreeGesture & { id: string }) | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  // drag-marquee (rubber-band selection) state
  const marq = useRef<{
    x0: number; y0: number; x1: number; y1: number; px: number; py: number; moved: boolean;
    /** background layer hit by the press (a plain click selects it) */
    bg: PartId | null;
  } | null>(null);
  const [marqRect, setMarqRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** inline text editor (double-click on any text object) */
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const editable = !!onField;
  const movable = !!onLayoutChange || !!onPartChange;
  const L = theme.layout;
  const PL = theme.partLayout;
  const isFree = (id: ElementId) => (L[id].mode ?? "align") === "free";

  const allShapes = [...(globalShapes ?? []), ...(slide.shapes ?? [])];
  const selRefs = selectedRefs ?? [];
  const selKeys = new Set(selRefs.map(keyOf));
  const selectedEl = (selRefs.find((r) => r.kind === "element")?.id ?? null) as ElementId | null;
  const selectedShapeIds = selRefs.filter((r) => r.kind === "shape").map((r) => r.id);
  const selectedPartIds = selRefs.filter((r) => r.kind === "part").map((r) => r.id);
  /** every built-in part actually painted on this slide */
  const parts = collectParts(theme, slide, header, background);
  const partById = new Map(parts.map((p) => [p.id, p]));

  /* ------------------------------ selection ------------------------------ */

  /** a click on one group member selects the whole group (any mix of layers) */
  const expandRefs = (refs: LayerRef[]): LayerRef[] => {
    if (!groupables?.length) return refs;
    const out = new Map<string, LayerRef>();
    refs.forEach((r) => out.set(keyOf(r), r));
    refs.forEach((r) => {
      const g = groupables.find((x) => x.kind === r.kind && x.id === r.id);
      if (!g?.groupId) return;
      groupOf(groupables, g).forEach((m) => out.set(`${m.kind}:${m.id}`, { kind: m.kind, id: m.id } as LayerRef));
    });
    return [...out.values()];
  };

  const select = (refs: LayerRef[], opts?: { exact?: boolean }) => {
    onSelectRefs?.(opts?.exact ? refs : expandRefs(refs), opts);
  };
  const selectOne = (ref: LayerRef, opts?: { exact?: boolean }) => select([ref], opts);

  /** all members of the group a ref belongs to (itself when ungrouped) */
  const groupRefsOf = (ref: LayerRef): LayerRef[] => {
    const g = groupables?.find((x) => x.kind === ref.kind && x.id === ref.id);
    if (!g?.groupId) return [ref];
    return groupOf(groupables!, g).map((m) => ({ kind: m.kind, id: m.id }) as LayerRef);
  };
  const isGrouped = (ref: LayerRef) => groupRefsOf(ref).length > 1;

  /* ------------------------------ positioning ------------------------------ */
  const boxStyle = (id: ElementId, extra?: CSSProperties): CSSProperties => {
    const b = L[id];
    const free = (b.mode ?? "align") === "free";
    const rot = b.rot ? ` rotate(${b.rot}deg)` : "";
    return {
      position: "absolute",
      left: `${b.x}%`,
      top: `${b.y}%`,
      width: `${b.w}%`,
      height: free && b.h ? `${b.h}%` : undefined,
      transform: free ? (rot || undefined) : `translate(-${b.x}%, -${b.y}%)${rot}`,
      transformOrigin: "center center",
      // one shared number line with drawn shapes (see lib/layers.ts)
      zIndex: BAND_CONTENT + safeZ(b.z, ELEMENT_DEFAULT_Z[id]),
      textAlign: b.align,
      boxSizing: "border-box",
      ...(editable
        ? {
            cursor: movable ? "move" : "pointer",
            outline:
              activeField === FIELD_OF[id] && selectedEl !== id ? "2px dashed rgba(255,255,255,.4)" : "2px dashed transparent",
            outlineOffset: 6,
            borderRadius: 10,
            touchAction: "none",
          }
        : {}),
      ...extra,
    };
  };

  /** rect frozen at gesture start — mid-drag DOM reads would see a moving/rotated box */
  const frozenRect = useRef<{ id: string; rect: FreeBox } | null>(null);

  /**
   * Current geometry of a built-in element in "free" terms (own top-left edge,
   * % of the board). Aligned elements are measured live so the first drag is
   * seamless.
   */
  const freeRectOf = (id: ElementId): FreeBox => {
    const fz = frozenRect.current;
    if (fz && fz.id === `element:${id}`) return { ...fz.rect, rot: L[id].rot ?? fz.rect.rot };
    const b = L[id];
    if ((b.mode ?? "align") === "free") {
      const m = b.h ? null : measureElement(id);
      return { x: b.x, y: b.y, w: b.w, h: b.h ?? m?.h ?? 10, rot: b.rot ?? 0 };
    }
    const m = measureElement(id);
    return {
      x: m ? m.left : (b.x * (100 - b.w)) / 100,
      y: m ? m.top : b.y,
      w: m ? m.w : b.w,
      h: m ? m.h : 10,
      rot: b.rot ?? 0,
    };
  };

  /**
   * Current geometry of a built-in PART. A part that was never moved is still
   * laid out by the slide, so it is measured live — the first drag therefore
   * starts exactly where the part is painted and nothing jumps.
   */
  const partRectOf = (id: PartId): FreeBox => {
    const fz = frozenRect.current;
    if (fz && fz.id === `part:${id}`) return { ...fz.rect, rot: PL?.[id]?.rot ?? fz.rect.rot };
    const b = detachedPartBox(theme, id);
    if (b) {
      const m = b.h ? null : measurePart(id);
      return { x: b.x, y: b.y, w: b.w, h: b.h ?? m?.h ?? 6, rot: b.rot ?? 0 };
    }
    const m = measurePart(id);
    if (m && m.w > 0.05) return { x: m.left, y: m.top, w: m.w, h: m.h, rot: PL?.[id]?.rot ?? 0 };
    // full-bleed chrome (frame, background layers) covers the whole board
    return { x: 0, y: 0, w: 100, h: 100, rot: 0 };
  };

  const shapeRectOf = (id: string): FreeBox | null => {
    const s = allShapes.find((x) => x.id === id);
    return s ? { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot } : null;
  };

  const rectOfRef = (ref: LayerRef): FreeBox | null =>
    ref.kind === "element"
      ? freeRectOf(ref.id as ElementId)
      : ref.kind === "part"
        ? partRectOf(ref.id)
        : shapeRectOf(ref.id);

  const boxOfRef = (ref: LayerRef): Box | undefined =>
    ref.kind === "element" ? L[ref.id as ElementId] : ref.kind === "part" ? PL?.[ref.id] : undefined;

  const canMoveRef = (ref: LayerRef): boolean => {
    if (ref.kind === "shape") return !!onShapeChange && !allShapes.find((x) => x.id === ref.id)?.locked;
    if (ref.kind === "part") return !!onPartChange && !!partById.get(ref.id)?.movable;
    return !!onLayoutChange && elementShown(ref.id as ElementId);
  };

  /**
   * Freezes the geometry a gesture starts from, so snapping and resizing stay
   * stable while the object is being transformed.
   *
   * Deliberately writes NOTHING: a click that selects an object must not turn
   * it into a free-positioned one. Promotion happens with the first real move
   * (see `promotionOf`), folded into the same deck write.
   */
  const freezeRef = (ref: LayerRef): FreeBox => {
    const r = rectOfRef(ref) ?? { x: 0, y: 0, w: 10, h: 10, rot: 0 };
    frozenRect.current = { id: keyOf(ref), rect: r };
    return r;
  };

  /**
   * The extra fields that turn a laid-out layer into a free object — {} when it
   * already is one. Merged into the SAME patch as the first move/resize/rotate,
   * so selecting never writes to the deck and a drag stays ONE undo step.
   * The logo (an image) keeps an explicit height so its box never depends on
   * the bitmap finishing loading; a detached part always gets one because it
   * has left the flow that used to size it.
   */
  const promotionOf = (ref: LayerRef, geo: MemberGeo): Partial<Box> => {
    if (ref.kind === "element") {
      const id = ref.id as ElementId;
      if (isFree(id) && (id !== "logo" || !!L[id].h)) return {};
      return {
        mode: "free",
        x: r1(geo.x),
        y: r1(geo.y),
        w: r1(geo.w),
        ...(id === "logo" ? { h: r1(geo.h) } : {}),
      };
    }
    if (ref.kind === "part") {
      if (detachedPartBox(theme, ref.id)?.h) return {};
      // a detached part always keeps an explicit height: it has left the flow
      // that used to size it
      return { mode: "free", x: r1(geo.x), y: r1(geo.y), w: r1(geo.w), h: r1(geo.h) };
    }
    return {};
  };

  const writeRef = (ref: LayerRef, patch: Partial<Box>) => {
    if (ref.kind === "element") onLayoutChange?.(ref.id as ElementId, patch);
    else if (ref.kind === "part") onPartChange?.(ref.id, patch);
    else onShapeChange?.(ref.id, patch as Partial<ShapeItem>);
  };

  /**
   * One batched write for any mix of layers — a group gesture stays a SINGLE
   * undo step. Kept in a ref so the window-level listeners of a running set
   * gesture always call the freshest writer.
   */
  const emitGeoRef = useRef<(updates: { ref: LayerRef; patch: Partial<Box> }[]) => void>(() => {});
  emitGeoRef.current = (updates) => {
    if (!updates.length) return;
    if (onLayerGeo) {
      onLayerGeo(updates);
      return;
    }
    const shapes = updates.filter((u) => u.ref.kind === "shape");
    if (shapes.length && onShapesChange) onShapesChange(shapes.map((u) => ({ id: u.ref.id, patch: u.patch as Partial<ShapeItem> })));
    else shapes.forEach((u) => onShapeChange?.(u.ref.id, u.patch as Partial<ShapeItem>));
    updates.filter((u) => u.ref.kind !== "shape").forEach((u) => writeRef(u.ref, u.patch));
  };

  const elementShown = (id: ElementId) =>
    id === "logo" ? !!(header.showLogo && header.logo) : id === "note" ? !!slide.note?.trim() : true;

  const snapTargets = (except: string) => {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    (Object.keys(L) as ElementId[]).forEach((id) => {
      if (`element:${id}` === except) return;
      if (!elementShown(id)) return;
      const r = freeRectOf(id);
      out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
    });
    // detached built-in parts are real objects on the board — snap to them too
    Object.keys(PL ?? {}).forEach((id) => {
      if (`part:${id}` === except) return;
      const b = detachedPartBox(theme, id);
      if (!b) return;
      out.push({ x: b.x, y: b.y, w: b.w, h: b.h ?? 4 });
    });
    allShapes.forEach((sh) => {
      if (`shape:${sh.id}` !== except) out.push({ x: sh.x, y: sh.y, w: sh.w, h: sh.h });
    });
    return out;
  };

  const gridSnap = theme.snapEnabled
    ? (v: number) => {
        const step = Math.max(0.1, theme.snapStep || 1);
        return snapAnchor(Math.round(v / step) * step, 1.2);
      }
    : undefined;

  /* --------------------- single-layer gestures (elements & parts) --------- */

  const startDragRef = (ref: LayerRef) => (e: React.PointerEvent<HTMLElement>) => {
    if (editing) return; // never drag while typing in the inline editor
    if (editable) {
      e.stopPropagation();
      if (e.altKey) {
        // Alt+click digs to the layer beneath this one
        onLayerCycle?.(e.clientX, e.clientY);
        return;
      }
      const group = groupRefsOf(ref);
      if (group.length > 1 && selKeys.has(keyOf(ref))) {
        // already selected (as part of its group) → keep the exact selection
      } else if (e.shiftKey) {
        const additive = selRefs.some((r) => keyOf(r) === keyOf(ref))
          ? selRefs.filter((r) => keyOf(r) !== keyOf(ref))
          : [...selRefs, ...group];
        select(additive, { exact: true });
        return;
      } else {
        select(group.length > 1 ? group : [ref]);
      }
      if (ref.kind === "element") onField?.(FIELD_OF[ref.id as ElementId]);
      else if (ref.kind === "part") {
        const f = partInfo(ref.id).field;
        if (f) onField?.(f);
      }
    }
    if (e.button !== 0 || !canMoveRef(ref)) return;
    const b = boardRef.current?.getBoundingClientRect();
    if (!b) return;
    // a grouped layer always drags the whole group
    const members = groupRefsOf(ref).filter(canMoveRef);
    if (members.length > 1) {
      startSetMove(members, e.clientX, e.clientY);
      return;
    }
    const r = freezeRef(ref);
    gesture.current = {
      kind: "move",
      id: keyOf(ref),
      dx: e.clientX - (b.left + (r.x / 100) * b.width),
      dy: e.clientY - (b.top + (r.y / 100) * b.height),
    };
    trackGesture(e.currentTarget, e.pointerId);
  };

  const startResizeRef = (ref: LayerRef, handle: Handle) => (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!movable || e.button !== 0) return;
    const r = freezeRef(ref);
    gesture.current = {
      kind: "resize",
      id: keyOf(ref),
      handle,
      sx: e.clientX,
      sy: e.clientY,
      start: r,
      ratio: r.h > 0 ? r.w / r.h : 1,
    };
    trackGesture(e.currentTarget, e.pointerId);
  };

  const startRotateRef = (ref: LayerRef) => (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!movable || e.button !== 0) return;
    const b = boardRef.current?.getBoundingClientRect();
    if (!b) return;
    const r = freezeRef(ref);
    const cx = b.left + ((r.x + r.w / 2) / 100) * b.width;
    const cy = b.top + ((r.y + r.h / 2) / 100) * b.height;
    gesture.current = {
      kind: "rotate",
      id: keyOf(ref),
      cx,
      cy,
      start: Math.atan2(e.clientY - cy, e.clientX - cx),
      rot0: r.rot,
    };
    trackGesture(e.currentTarget, e.pointerId);
  };

  const refOfKey = (key: string): LayerRef | null => {
    const i = key.indexOf(":");
    if (i < 0) return null;
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    return kind === "element" || kind === "part" || kind === "shape" ? ({ kind, id } as LayerRef) : null;
  };

  /**
   * Applies one step of the current single-object gesture.
   * Coordinate driven (not event driven) so it can be called from the window
   * listeners below as well as from a React handler.
   */
  const applyGesture = (
    clientX: number,
    clientY: number,
    opts: { altKey?: boolean; shiftKey?: boolean } = {},
  ) => {
    const g = gesture.current;
    const b = boardRef.current?.getBoundingClientRect();
    if (!g || !b) return;
    const ref = refOfKey(g.id);
    if (!ref) return;
    const freeMove = !!opts.altKey;

    if (g.kind === "move") {
      const r = rectOfRef(ref) ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 }; // frozen size → stable snapping
      const rawX = ((clientX - g.dx - b.left) / b.width) * 100;
      const rawY = ((clientY - g.dy - b.top) / b.height) * 100;
      const res = applyMove(r, rawX, rawY, {
        grid: gridSnap,
        others: theme.smartGuides === false ? undefined : snapTargets(g.id),
        free: freeMove,
      });
      setGuides({ x: res.gx, y: res.gy });
      writeRef(ref, { ...promotionOf(ref, r), x: res.x, y: res.y });
      return;
    }
    if (g.kind === "resize") {
      const dx = ((clientX - g.sx) / b.width) * 100;
      const dy = ((clientY - g.sy) / b.height) * 100;
      const isLogo = ref.kind === "element" && ref.id === "logo";
      const keepRatio = isLogo ? !opts.shiftKey : !!opts.shiftKey;
      const r = applyResize(g, dx, dy, { keepRatio, grid: gridSnap, free: freeMove, minW: 2, minH: 2 });
      writeRef(ref, { ...promotionOf(ref, g.start), x: r.x, y: r.y, w: r.w, h: r.h });
      return;
    }
    const geo = frozenRect.current?.rect ?? rectOfRef(ref) ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
    writeRef(ref, { ...promotionOf(ref, geo), rot: applyRotate(g, clientX, clientY, !!opts.shiftKey) });
  };

  /**
   * The gesture is tracked on the window, NOT on the pressed node.
   *
   * Dragging a built-in part for the first time promotes it to free mode, which
   * swaps its DOM node mid-gesture (in-flow span → absolutely painted object).
   * Pointer capture is implicitly released when the captured node unmounts, so
   * a node-bound gesture would silently stop. Window listeners survive any
   * re-render and keep move / resize / rotate working for every object kind.
   */
  const gestureCleanup = useRef<(() => void) | null>(null);
  const trackGesture = (node?: Element, pointerId?: number) => {
    gestureCleanup.current?.();
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      applyGesture(ev.clientX, ev.clientY, ev);
    };
    const onUp = () => finishGesture();
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    gestureCleanup.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      gestureCleanup.current = null;
    };
    try {
      if (node && pointerId !== undefined) node.setPointerCapture(pointerId);
    } catch {
      /* capture unsupported — window listeners still drive the gesture */
    }
  };

  const finishGesture = () => {
    const wasActive = !!gesture.current;
    gestureCleanup.current?.();
    gesture.current = null;
    frozenRect.current = null;
    setGuides({ x: null, y: null });
    if (wasActive) onGestureEnd?.();
  };

  const endGesture = (e: React.PointerEvent<HTMLElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    finishGesture();
  };

  // never leave window listeners behind
  useEffect(() => () => gestureCleanup.current?.(), []);

  /* ------------------------- set (group) gestures ------------------------- */

  const setG = useRef<SetGesture | null>(null);
  const [setActive, setSetActive] = useState(false);

  const snapshotGeo = (refs: LayerRef[]): Record<string, MemberGeo> => {
    const out: Record<string, MemberGeo> = {};
    refs.forEach((ref) => {
      const r = rectOfRef(ref);
      if (r) out[keyOf(ref)] = { x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot };
    });
    return out;
  };

  const memberList = (g: SetGesture) =>
    g.refs
      .map((ref) => ({ ref, geo: g.start[keyOf(ref)] }))
      .filter((m): m is { ref: LayerRef; geo: MemberGeo } => !!m.geo);

  /**
   * Promotions owed by the running set gesture, keyed by layer. They are folded
   * into the first geometry write of the gesture instead of being written when
   * the press starts: selecting a group must not move anything or add an undo
   * step, and the first drag has to stay ONE undo step.
   */
  const setPromotions = useRef<Record<string, Partial<Box>>>({});
  const collectPromotions = (refs: LayerRef[], start: Record<string, MemberGeo>) => {
    const out: Record<string, Partial<Box>> = {};
    refs.forEach((ref) => {
      if (ref.kind === "shape") return;
      const geo = start[keyOf(ref)];
      if (!geo) return;
      const promo = promotionOf(ref, geo);
      if (Object.keys(promo).length) out[keyOf(ref)] = promo;
    });
    setPromotions.current = out;
  };
  /** folds the owed promotions into a batch and clears them */
  const withPromotions = (ups: { ref: LayerRef; patch: Partial<Box> }[]) => {
    const owed = setPromotions.current;
    if (!Object.keys(owed).length) return ups;
    setPromotions.current = {};
    return ups.map((u) => {
      const promo = owed[keyOf(u.ref)];
      return promo ? { ref: u.ref, patch: { ...promo, ...u.patch } } : u;
    });
  };

  /** begins a whole-selection move (used by this layer AND by ShapeLayer) */
  const startSetMove = (refs: LayerRef[], clientX: number, clientY: number) => {
    const movableRefs = refs.filter(canMoveRef);
    if (!movableRefs.length || !movable) return;
    const start = snapshotGeo(movableRefs);
    collectPromotions(movableRefs, start);
    setG.current = { mode: "move", refs: movableRefs, start, px0: clientX, py0: clientY };
    setSetActive(true);
  };

  const startSetResize = (handle: Handle) => (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.button !== 0 || !movable) return;
    const refs = selRefs.filter(canMoveRef);
    if (!refs.length) return;
    const start = snapshotGeo(refs);
    collectPromotions(refs, start);
    const bounds = selectionBounds(Object.values(start));
    setG.current = { mode: "resize", refs, start, handle, sx: e.clientX, sy: e.clientY, bounds };
    setSetActive(true);
  };

  const startSetRotate = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.button !== 0 || !movable) return;
    const b = boardRef.current?.getBoundingClientRect();
    if (!b) return;
    const refs = selRefs.filter(canMoveRef);
    if (!refs.length) return;
    const start = snapshotGeo(refs);
    collectPromotions(refs, start);
    const bd = selectionBounds(Object.values(start));
    const cx = b.left + ((bd.x + bd.w / 2) / 100) * b.width;
    const cy = b.top + ((bd.y + bd.h / 2) / 100) * b.height;
    setG.current = {
      mode: "rotate",
      refs,
      start,
      cx,
      cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      board: { left: b.left, top: b.top, width: b.width, height: b.height },
    };
    setSetActive(true);
  };

  // window-level listeners so a set gesture keeps running even when the pointer
  // leaves the (small) handle it started on
  useEffect(() => {
    if (!setActive) return;
    const onMove = (e: PointerEvent) => {
      const g = setG.current;
      const b = boardRef.current?.getBoundingClientRect();
      if (!g || !b) return;
      e.preventDefault();
      const freeMove = e.altKey;
      const list = memberList(g);

      if (g.mode === "move") {
        const dx = ((e.clientX - g.px0) / b.width) * 100;
        const dy = ((e.clientY - g.py0) / b.height) * 100;
        let gx: number | null = null;
        let gy: number | null = null;
        const ups = moveMembers(list.map((m) => ({ id: keyOf(m.ref), geo: m.geo })), dx, dy).map((u) => {
          const ref = g.refs.find((r) => keyOf(r) === u.id)!;
          return { ref, patch: u.patch };
        });
        if (!freeMove && theme.smartGuides !== false && list.length) {
          const first = list[0].geo;
          const others = snapTargets("");
          const anchorX = first.x + dx;
          const anchorY = first.y + dy;
          const sx = smartSnapLocal(anchorX, first.w, others, "x");
          const sy = smartSnapLocal(anchorY, first.h, others, "y");
          if (sx.guide !== null || sy.guide !== null) {
            const offX = sx.v - anchorX;
            const offY = sy.v - anchorY;
            ups.forEach((u) => {
              u.patch = { ...u.patch, x: r1((u.patch.x ?? 0) + offX), y: r1((u.patch.y ?? 0) + offY) };
            });
            gx = sx.guide;
            gy = sy.guide;
          }
        }
        setGuides({ x: gx, y: gy });
        emitGeoRef.current(withPromotions(ups));
        return;
      }

      if (g.mode === "resize") {
        const dx = ((e.clientX - g.sx) / b.width) * 100;
        const dy = ((e.clientY - g.sy) / b.height) * 100;
        const nb = applyResize(
          { kind: "resize", id: "selection", handle: g.handle, sx: g.sx, sy: g.sy, start: { ...g.bounds, rot: 0 }, ratio: g.bounds.h > 0 ? g.bounds.w / g.bounds.h : 1 },
          dx,
          dy,
          { keepRatio: e.shiftKey, free: true, minW: 2, minH: 0.6 },
        );
        const scaled = scaleMembers(list.map((m) => ({ id: keyOf(m.ref), geo: m.geo })), g.bounds, nb);
        emitGeoRef.current(
          withPromotions(scaled.map((u) => ({ ref: g.refs.find((r) => keyOf(r) === u.id)!, patch: u.patch }))),
        );
        return;
      }

      const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      let delta = ((a - g.startAngle) * 180) / Math.PI;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      const rotated = rotateMembers(
        list.map((m) => ({ id: keyOf(m.ref), geo: m.geo })),
        { x: g.cx - g.board.left, y: g.cy - g.board.top },
        delta,
        g.board,
      );
      emitGeoRef.current(
        withPromotions(rotated.map((u) => ({ ref: g.refs.find((r) => keyOf(r) === u.id)!, patch: u.patch }))),
      );
    };
    const onUp = () => {
      if (setG.current) onGestureEnd?.();
      setG.current = null;
      setPromotions.current = {};
      frozenRect.current = null;
      setGuides({ x: null, y: null });
      setSetActive(false);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // the gesture reads frozen geometry + the latest callbacks through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActive]);

  /* --------------------------- inline text editing ------------------------ */

  const fieldText = (field: SlideField): string => {
    switch (field) {
      case "title":
        return header.title ?? "";
      case "brandTop":
        return header.brandTop ?? "";
      case "brandBottom":
        return header.brandBottom ?? "";
      case "badge":
        return slide.badge ?? header.badge ?? "";
      case "question":
        return slide.question ?? "";
      case "note":
        return slide.note ?? "";
      default: {
        const s = String(field);
        if (s.startsWith("option:")) return slide.options[Number(s.slice(7))]?.text ?? "";
        return "";
      }
    }
  };

  const editValue = (): string => {
    if (!editing) return "";
    if (editing.field) return fieldText(editing.field);
    if (editing.ref.kind === "shape") return allShapes.find((s) => s.id === editing.ref.id)?.text ?? "";
    return "";
  };

  const commitEdit = (value: string) => {
    if (!editing) return;
    if (editing.field) onTextChange?.(editing.field, value);
    else if (editing.ref.kind === "shape") onShapeChange?.(editing.ref.id, { text: value });
  };

  /** opens the inline editor over any text object (double-click) */
  const openEditor = (ref: LayerRef) => {
    if (!editable || !onTextChange) return;
    if (ref.kind === "shape") {
      const s = allShapes.find((x) => x.id === ref.id);
      if (!s || s.locked) return;
      setEditing({ ref, field: null });
      return;
    }
    const field = ref.kind === "element" ? ELEMENT_TEXT_FIELD[ref.id as ElementId] : partInfo(ref.id).field;
    if (!field) return;
    if (ref.kind === "element" && ref.id === "logo") return;
    setEditing({ ref, field });
  };

  /* ------------------------------- handlers ------------------------------ */

  const handlers = editable
    ? (id: ElementId) => ({
        "data-el": id,
        onPointerDown: startDragRef({ kind: "element", id }),
        onPointerUp: endGesture,
        onPointerCancel: endGesture,
        onDoubleClick: (e: React.MouseEvent<HTMLElement>) => {
          e.stopPropagation();
          const ref: LayerRef = { kind: "element", id };
          // first double-click digs into a group, the next one edits the text
          if (isGrouped(ref) && !(selRefs.length === 1 && selKeys.has(keyOf(ref)))) {
            selectOne(ref, { exact: true });
            return;
          }
          openEditor(ref);
        },
      })
    : (id: ElementId) => ({ "data-el": id });

  /** props that make a built-in part selectable exactly like a drawn shape */
  const partHandlers = (id: PartId) =>
    editable
      ? {
          "data-part": id,
          onPointerDown: startDragRef({ kind: "part", id }),
          onPointerUp: endGesture,
          onPointerCancel: endGesture,
          onDoubleClick: (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            const ref: LayerRef = { kind: "part", id };
            if (isGrouped(ref) && !(selRefs.length === 1 && selKeys.has(keyOf(ref)))) {
              selectOne(ref, { exact: true });
              return;
            }
            openEditor(ref);
          },
        }
      : { "data-part": id };

  /** pointer style shared by every selectable part */
  const partPointerCss = (id: PartId, selected: boolean): CSSProperties =>
    editable
      ? {
          cursor: movable && partInfo(id).movable ? "move" : "pointer",
          touchAction: "none",
          pointerEvents: "auto",
          outline: selected ? "2px dashed rgba(94,242,255,.55)" : "2px dashed transparent",
          outlineOffset: 2,
        }
      : { pointerEvents: "none" };

  const handleBase: CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 3,
    background: "#ffd633",
    border: "2px solid #0a0a0c",
    boxShadow: "0 1px 4px rgba(0,0,0,.6)",
    zIndex: BAND_UI + 20,
    touchAction: "none",
    pointerEvents: "auto",
  };

  const chipStyle: CSSProperties = {
    padding: "3px 8px",
    borderRadius: 6,
    background: "rgba(10,10,12,.85)",
    border: "1px solid rgba(255,214,51,.55)",
    color: "#ffd633",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    pointerEvents: "auto",
  };

  /* -------------------------------- sizing -------------------------------- */
  const optionCount = Math.max(slide.options.length, 1);
  const twoCol = theme.optionsLayout === "two-col" || theme.optionsLayout === "grid";

  const qLen = slide.question.replace(/\$/g, "").length;
  const autoQ = qLen > 300 ? 0.66 : qLen > 230 ? 0.74 : qLen > 170 ? 0.83 : qLen > 115 ? 0.91 : 1;
  const qSize = theme.questionSize * slide.scale * autoQ * (boxTypeface(theme, "question").scale ?? 1);

  const maxOptLen = slide.options.reduce((m, o) => Math.max(m, o.text.replace(/\$/g, "").length), 0);
  const perCol = (L.options.w / (twoCol ? 2 : 1)) * 0.36; // rough chars that fit
  const autoO = maxOptLen > perCol * 2.4 ? 0.62 : maxOptLen > perCol * 1.6 ? 0.74 : maxOptLen > perCol ? 0.86 : 1;
  const optSize = theme.optionSize * slide.scale * autoO * (boxTypeface(theme, "options").scale ?? 1);
  const circle = Math.round(Math.max(optSize * 1.45, 32));
  const baseGap = optionCount > 4 ? Math.max(10, 34 - (optionCount - 4) * 8) : optionCount === 4 ? 24 : 32;
  // user-set spacing (optionGap in % of board height) overrides the auto tight packing
  const optLineH = theme.optionLineHeight ?? 1.45;
  const rowGap = theme.optionGap
    ? Math.round((theme.optionGap / 100) * SLIDE_H)
    : Math.round(baseGap * (autoO < 1 ? 0.7 : 1));

  const shapeSnap = theme.snapEnabled
    ? (v: number) => {
        const step = Math.max(0.1, theme.snapStep || 1);
        return snapAnchor(Math.round(v / step) * step, 1.2);
      }
    : undefined;

  /* ---------------------- drag-marquee selection ---------------------- */
  const pctPoint = (clientX: number, clientY: number) => {
    const b = boardRef.current?.getBoundingClientRect();
    if (!b || !b.width || !b.height) return null;
    return { x: ((clientX - b.left) / b.width) * 100, y: ((clientY - b.top) / b.height) * 100 };
  };
  const boardDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || e.button !== 0) return;
    const p = pctPoint(e.clientX, e.clientY);
    if (!p) return;
    // a press that lands on a background layer remembers it: a plain click
    // (no drag) then selects that decorative layer instead of clearing
    const bgEl = (e.target as HTMLElement | null)?.closest?.("[data-part]");
    const bgId = bgEl?.getAttribute("data-part") ?? null;
    marq.current = {
      x0: p.x, y0: p.y, x1: p.x, y1: p.y, px: e.clientX, py: e.clientY, moved: false,
      bg: bgId && BG_PART_IDS.includes(bgId) ? bgId : null,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — marquee just won't extend past the board */
    }
  };
  const boardMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = marq.current;
    if (!m) return;
    if (!m.moved && Math.hypot(e.clientX - m.px, e.clientY - m.py) < 4) return;
    m.moved = true;
    const p = pctPoint(e.clientX, e.clientY);
    if (!p) return;
    m.x1 = p.x;
    m.y1 = p.y;
    setMarqRect({ x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) });
    e.preventDefault();
  };
  const boardUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = marq.current;
    marq.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!m) return;
    if (!m.moved) {
      // a plain click on the empty slide selects the background layer that was
      // hit (decorative artwork, image, tint…) or clears the whole selection
      if (m.bg) {
        selectOne({ kind: "part", id: m.bg });
        return;
      }
      setMarqRect(null);
      setEditing(null);
      onSelectRefs?.([], { exact: true });
      onField?.(null);
      return;
    }
    const r = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
    setMarqRect(null);
    // everything the band touches joins the set: drawn shapes (locked ones
    // included), built-in elements and built-in parts. Group members are pulled
    // in together, so a marquee never tears a group apart.
    const hit: LayerRef[] = [];
    allShapes.forEach((s) => {
      if (boxesOverlap(r, { x: s.x, y: s.y, w: s.w, h: s.h })) hit.push({ kind: "shape", id: s.id });
    });
    (Object.keys(L) as ElementId[]).forEach((id) => {
      if (!elementShown(id)) return;
      const b = freeRectOf(id);
      if (boxesOverlap(r, b)) hit.push({ kind: "element", id });
    });
    parts.forEach((p) => {
      if (!p.movable) return; // full-bleed chrome is not marquee-selectable
      const b = partRectOf(p.id);
      if (b.w >= 100 && b.h >= 100) return;
      if (boxesOverlap(r, b)) hit.push({ kind: "part", id: p.id });
    });
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? selRefs : [];
    select([...base, ...hit]);
  };

  const bodyStack = boxStack(theme, "question");
  /**
   * Option text only — applied directly to the element that paints an option's
   * text, never to the options container or the slide, so the choice cannot
   * inherit into the question, header, title, note or any shape.
   */
  const optionStack = optionTextStack(theme);
  /** The marker / plain numbering keep the deck face, independent of the option font. */
  const optionMarkerStack = deckStack(theme, "options");
  const qRtl = isRtlText(slide.question);

  const frame = theme.frame ?? DEFAULT_FRAME;
  const frameOn = theme.showFrame && frame.style !== "none";
  const frameCss = computeFrameCss(frame, frameOn);

  // If a frame image is chosen, check its placement mode (defaults to "fit" so it NEVER overlaps slide content)
  const frameImageSrc = resolveFrameImageSrc(frame.image);
  const hasFrameImage = !!frameImageSrc;
  const isImageOverlayMode = frame.imagePlacement === "overlay";
  const imageInsetPct = hasFrameImage && !isImageOverlayMode ? (frame.imageInset ?? 10) : 0;
  // Convert percentage inset into pixels for 1280x720:
  const imageInsetX = Math.round((imageInsetPct / 100) * SLIDE_W);
  const imageInsetY = Math.round((imageInsetPct / 100) * SLIDE_H);
  const frameSelectable = editable && partById.has(PART_FRAME);

  /** frame clicks land on the slide root / ring padding, never on the board */
  const frameHandlers = frameSelectable
    ? {
        "data-part": PART_FRAME,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return; // only the frame ring itself
          e.stopPropagation();
          if (e.altKey) {
            onLayerCycle?.(e.clientX, e.clientY);
            return;
          }
          selectOne({ kind: "part", id: PART_FRAME });
        },
        onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return;
          e.stopPropagation();
          selectOne({ kind: "part", id: PART_FRAME });
        },
        style: { cursor: "pointer" } as CSSProperties,
      }
    : {};

  /* ------------------------- background layer order ----------------------- */
  const bgLayers = background ? backgroundLayers(background, theme.board) : [];
  // stacking of the decorative layers follows the unified z (reordering them in
  // the layers panel really changes what is painted on top)
  const bgOrder = [...bgLayers]
    .map((l) => ({ id: l.id, z: partZ(theme, l.id) }))
    .sort((a, b) => a.z - b.z)
    .map((x, i) => [x.id, i] as const);
  const bgZ = new Map(bgOrder);
  const bgDesignBox = detachedPartBox(theme, PART_BG_DESIGN);

  /* ---------------------------- detached parts ---------------------------- */
  /** built-in parts the user moved: painted straight onto the board */
  const detached: React.ReactNode[] = [];
  const detachedStyle = (id: PartId, b: Box, extra?: CSSProperties): CSSProperties => ({
    position: "absolute",
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w}%`,
    height: b.h ? `${b.h}%` : undefined,
    transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
    transformOrigin: "center center",
    zIndex: BAND_CONTENT + safeZ(b.z, partZ(theme, id)),
    boxSizing: "border-box",
    ...extra,
  });

  const BulletGraphic = ({
    theme: t,
    slide: sl,
    size,
    partProps,
  }: {
    theme: ThemeSettings;
    slide: SlideData;
    size: number;
    partProps?: React.HTMLAttributes<HTMLDivElement> & { "data-part"?: string };
  }) => {
    const id = (t.numberStyle ?? "circle") as NumberStyle;
    const r = renderNumberStyle(id, t, size, sl.number);
    const slash = id === "slash";
    return (
      <div
        {...partProps}
        style={{ ...r.style, fontSize: size * r.fontScale, color: r.color, fontFamily: boxStack(t, "bullet"), ...(partProps?.style ?? {}) }}
      >
        {r.content}
        {slash && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: size * 0.14,
              top: size * 0.08,
              width: Math.max(2, size * 0.05),
              height: size * 0.84,
              background: `linear-gradient(160deg, ${shade(t.accent, 0.3)}, ${t.accent})`,
              transform: "rotate(22deg)",
              borderRadius: 999,
            }}
          />
        )}
      </div>
    );
  };

  /* ------------------------------- overlays ------------------------------- */

  /** selection frame + 8 handles + rotate for ONE selected element or part */
  const boxOverlay = (layerRef: LayerRef) => {
    const isElement = layerRef.kind === "element";
    const id = layerRef.id;
    if (!movable || selRefs.length !== 1) return null;
    if (isElement && !elementShown(id as ElementId)) return null;
    if (!isElement && !partById.has(id)) return null;
    // full-bleed chrome (frame, background layers) has its own outline
    if (!isElement && !partInfo(id).movable) return null;
    const movableLayer = canMoveRef(layerRef);
    const b = boxOfRef(layerRef);
    const free = isElement ? isFree(id as ElementId) : !!detachedPartBox(theme, id);
    const r = rectOfRef(layerRef) ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
    const label = isElement ? ELEMENT_LABEL[id as ElementId] : partLabel(id);
    const style: CSSProperties = free
      ? {
          left: `${b?.x ?? r.x}%`,
          top: `${b?.y ?? r.y}%`,
          width: `${b?.w ?? r.w}%`,
          height: b?.h ? `${b.h}%` : `${r.h}%`,
        }
      : { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` };
    const rot = b?.rot ?? 0;
    return (
      <div
        data-overlay={keyOf(layerRef)}
        style={{
          position: "absolute",
          ...style,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: "center center",
          zIndex: BAND_UI + 15,
          pointerEvents: "none",
          outline: "1.5px solid rgba(94,242,255,.95)",
          outlineOffset: 3,
          boxSizing: "border-box",
        }}
      >
        {isGrouped(layerRef) && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -30,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(94,242,255,.9)",
              color: "#0a0a0c",
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ⧉ grouped — double-click edits this item alone
          </div>
        )}
        {movableLayer && (
          <>
            {HANDLES.map(({ h, cursor, style: hs }) => (
              <div
                key={h}
                data-handle={h}
                title="Drag to resize · Shift keeps ratio · Alt disables snapping"
                onPointerDown={startResizeRef(layerRef, h)}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                style={{ ...handleBase, ...hs, cursor, background: "#5ef2ff", borderRadius: h.length === 1 ? 8 : 3 }}
              />
            ))}
            <div
              data-rotate=""
              title="Rotate · Shift snaps to 15°"
              onPointerDown={startRotateRef(layerRef)}
              onPointerUp={endGesture}
              onPointerCancel={endGesture}
              style={{ ...handleBase, left: "50%", top: -34, marginLeft: -8, borderRadius: "50%", background: "#5ef2ff", cursor: "grab" }}
            />
            <div style={{ position: "absolute", left: "50%", top: -18, width: 2, height: 16, marginLeft: -1, background: "rgba(94,242,255,.8)" }} />
          </>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: -30,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,.75)",
            color: "#5ef2ff",
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
            transform: rot ? `rotate(${-rot}deg)` : undefined,
            transformOrigin: "left top",
          }}
        >
          {label}
          {movableLayer ? ` · ${r1(r.x)}, ${r1(r.y)} · ${r1(r.w)}×${r1(r.h)}${rot ? ` · ${rot}°` : ""}${free ? "" : " · auto"}` : " · full bleed"}
        </div>
      </div>
    );
  };

  /** frame / background layers: selection outline that spans the whole board */
  const fullBleedOverlay = (id: PartId) => {
    if (!editable || selRefs.length !== 1) return null;
    if (partInfo(id).movable) return null; // handled by BoxOverlay
    const sel = selRefs[0];
    if (sel.kind !== "part" || sel.id !== id) return null;
    const r = partRectOf(id);
    return (
      <div
        key={`fb-${id}`}
        data-overlay={`part:${id}`}
        style={{
          position: "absolute",
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.w}%`,
          height: `${r.h}%`,
          zIndex: BAND_UI + 15,
          pointerEvents: "none",
          outline: "1.5px solid rgba(94,242,255,.95)",
          outlineOffset: -3,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,.78)",
            color: "#5ef2ff",
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          {partLabel(id)} · {partInfo(id).movable ? "drag to place" : "edited in its panel"}
        </div>
      </div>
    );
  };

  /** multi-selection / group frame: bounds + handles transform the whole set */
  const setOverlay = () => {
    if (!editable || selRefs.length < 2 || !movable) return null;
    const members = selRefs
      .map((ref) => ({ ref, r: rectOfRef(ref) }))
      .filter((m): m is { ref: LayerRef; r: FreeBox } => !!m.r);
    if (!members.length) return null;
    const bounds = selectionBounds(members.map((m) => m.r));
    const grouped = members.some((m) => isGrouped(m.ref));
    const movableMembers = members.filter((m) => canMoveRef(m.ref));
    return (
      <>
        {members.map((m) => (
          <div
            key={`m-${keyOf(m.ref)}`}
            data-member={keyOf(m.ref)}
            style={{
              position: "absolute",
              left: `${m.r.x}%`,
              top: `${m.r.y}%`,
              width: `${m.r.w}%`,
              height: `${m.r.h}%`,
              transform: m.r.rot ? `rotate(${m.r.rot}deg)` : undefined,
              transformOrigin: "center center",
              zIndex: BAND_UI + 13,
              pointerEvents: "none",
              outline: "1.5px dashed rgba(255,214,51,.8)",
              boxSizing: "border-box",
            }}
          />
        ))}
        <div
          data-set-frame=""
          style={{
            position: "absolute",
            left: `${bounds.x}%`,
            top: `${bounds.y}%`,
            width: `${bounds.w}%`,
            height: `${bounds.h}%`,
            zIndex: BAND_UI + 15,
            pointerEvents: "none",
            outline: "1.5px solid rgba(255,214,51,.95)",
            outlineOffset: 3,
            boxSizing: "border-box",
          }}
        >
          <div style={{ position: "absolute", right: 0, top: -34, display: "flex", gap: 4 }}>
            {grouped && onUngroupRefs && (
              <button
                data-chip="ungroup"
                title="Break this group — every member becomes independently selectable (Ctrl/⌘+Shift+G)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onUngroupRefs(selRefs)}
                style={chipStyle}
              >
                ⧉ Ungroup
              </button>
            )}
            {onGroupRefs && !grouped && movableMembers.length > 1 && (
              <button
                data-chip="group"
                title="Combine the selected items into one group (Ctrl/⌘+G) — built-in parts and shapes can be grouped together"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onGroupRefs(members.map((m) => m.ref))}
                style={chipStyle}
              >
                ⧉ Group {members.length}
              </button>
            )}
          </div>
          {movableMembers.length > 0 && (
            <>
              {HANDLES.map(({ h, cursor, style: hs }) => (
                <div
                  key={h}
                  data-handle={h}
                  title="Drag to resize the whole selection"
                  onPointerDown={startSetResize(h)}
                  style={{ ...handleBase, ...hs, cursor, borderRadius: h.length === 1 ? 8 : 3 }}
                />
              ))}
              <div
                data-rotate=""
                title="Rotate the whole selection · Shift snaps to 15°"
                onPointerDown={startSetRotate}
                style={{ ...handleBase, left: "50%", top: -34, marginLeft: -8, borderRadius: "50%", background: "#5ef2ff", cursor: "grab" }}
              />
              <div style={{ position: "absolute", left: "50%", top: -18, width: 2, height: 16, marginLeft: -1, background: "rgba(94,242,255,.8)" }} />
            </>
          )}
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: -30,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(0,0,0,.75)",
              color: "#ffd633",
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            {members.length} items{grouped ? " · grouped" : " · selected"} · drag to move all
          </div>
        </div>
      </>
    );
  };

  /* --------------------------- inline text editor -------------------------- */
  const inlineEditor = () => {
    if (!editing || !editable) return null;
    const r = rectOfRef(editing.ref);
    if (!r) return null;
    const size =
      editing.ref.kind === "shape"
        ? (allShapes.find((s) => s.id === editing.ref.id)?.fontSize ?? 24)
        : editing.field === "question"
          ? qSize
          : editing.field?.startsWith("option:")
            ? optSize
            : editing.field === "title"
              ? 54
              : editing.field === "badge"
                ? 36
                : editing.field === "note"
                  ? 20
                  : 25;
    const singleLine = !!editing.field && editing.field !== "question" && editing.field !== "note";
    return (
      <textarea
        data-inline-edit=""
        autoFocus
        value={editValue()}
        rows={singleLine ? 1 : 3}
        onChange={(e) => commitEdit(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || (e.key === "Enter" && singleLine && !e.shiftKey)) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        onBlur={() => {
          setEditing(null);
          onGestureEnd?.();
        }}
        style={{
          position: "absolute",
          left: `${Math.max(-20, r.x)}%`,
          top: `${Math.max(-20, r.y)}%`,
          width: `${Math.max(8, Math.min(140, r.w))}%`,
          minHeight: `${Math.max(4, r.h)}%`,
          transform: r.rot ? `rotate(${r.rot}deg)` : undefined,
          transformOrigin: "center center",
          zIndex: BAND_UI + 40,
          boxSizing: "border-box",
          resize: "none",
          overflow: "hidden",
          background: "rgba(5,5,9,.94)",
          color: "#fff8dc",
          border: "1.5px solid rgba(94,242,255,.9)",
          borderRadius: 6,
          outline: "none",
          padding: 6,
          fontFamily: bodyStack,
          fontSize: Math.max(12, size),
          lineHeight: 1.35,
          textAlign: "left",
          direction: "ltr",
          userSelect: "text",
          WebkitUserSelect: "text",
          cursor: "text",
          touchAction: "auto",
          boxShadow: "0 10px 30px rgba(0,0,0,.6)",
        }}
      />
    );
  };

  /* -------------------------------- render -------------------------------- */

  const renderOptions = () => {
    const inFlow: React.ReactNode[] = [];
    slide.options.forEach((opt, i) => {
      const correct = slide.showAnswer && slide.answer === opt.key;
      const highlight = correct && theme.answerStyle !== "tick";
      // effective label: manual edits always win; auto uses plain numbering
      const markerText = effectiveOptionLabel(opt.labelMode, opt.key, theme.plainNumbering, i);
      const rtl = isRtlText(opt.text);
      const oStyle = (theme.optionStyle ?? "plain") as OptionStyle;
      const oColor = theme.optionAccent || theme.accent;
      const chrome = optionRowStyle(oStyle, theme, oColor, highlight);

      const rowId = optionRowId(i);
      const bulletId = optionBulletId(i);
      const textId = optionTextId(i);
      const rowBox = detachedPartBox(theme, rowId);
      const bulletBox = detachedPartBox(theme, bulletId);
      const textBox = detachedPartBox(theme, textId);

      const textStyle: CSSProperties = {
        color: correct ? "#5cff9d" : theme.optionTextColor,
        // the OPTION TEXT FONT lands here and nowhere else — this
        // element is the only consumer of `optionStack`
        fontFamily: optionStack,
        fontSize: optSize,
        fontWeight: 700,
        lineHeight: optLineH,
        textShadow: correct ? "0 0 18px rgba(92,255,157,.5)" : "0 2px 5px rgba(0,0,0,.6)",
        textAlign: rtl ? "right" : "left",
      };

      /* ---- the option's numbering / bullet marker (its own selectable part) ---- */
      const marker = (extra?: CSSProperties, asPart = true) => (
        <OptionBulletMarker
          theme={theme}
          color={oColor}
          size={circle}
          keyText={markerText}
          highlight={highlight}
          optionStyle={oStyle}
          // the marker / plain numbering keep the deck face: the
          // option text font must not reach them
          fontFamily={optionMarkerStack}
          wrapperProps={
            asPart
              ? ({
                  ...partHandlers(bulletId),
                  style: {
                    flex: "0 0 auto",
                    position: "relative",
                    zIndex: 2,
                    ...partPointerCss(bulletId, selKeys.has(`part:${bulletId}`)),
                    ...extra,
                  },
                } as React.HTMLAttributes<HTMLSpanElement>)
              : ({ style: { flex: "0 0 auto", ...extra } } as React.HTMLAttributes<HTMLSpanElement>)
          }
        />
      );

      /* ---- the option's text (its own selectable part) ---- */
      const text = (asPart = true) => (
        <MathText
          text={opt.text}
          style={{
            ...textStyle,
            ...(asPart
              ? {
                  position: "relative",
                  display: "block",
                  minWidth: 0,
                  zIndex: 3,
                  ...partPointerCss(textId, selKeys.has(`part:${textId}`)),
                }
              : {}),
          }}
          domProps={asPart ? (partHandlers(textId) as React.HTMLAttributes<HTMLSpanElement>) : undefined}
        />
      );

      const tick =
        correct && theme.answerStyle === "tick" ? (
          <span style={{ color: "#5cff9d", fontSize: optSize, fontWeight: 800 }}>✓</span>
        ) : null;

      const rowCss: CSSProperties = {
        ...chrome.row,
        flexDirection: rtl ? "row-reverse" : "row",
        justifyContent:
          L.options.align === "center" ? "center" : L.options.align === "right" ? "flex-end" : chrome.row.justifyContent,
      };

      // a detached marker / text is painted straight onto the board
      if (bulletBox) {
        detached.push(
          <div
            key={`d-${bulletId}`}
            {...partHandlers(bulletId)}
            style={detachedStyle(bulletId, bulletBox, {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...partPointerCss(bulletId, selKeys.has(`part:${bulletId}`)),
            })}
          >
            {marker(undefined, false)}
          </div>,
        );
      }
      if (textBox) {
        detached.push(
          <div
            key={`d-${textId}`}
            {...partHandlers(textId)}
            style={detachedStyle(textId, textBox, {
              ...textStyle,
              width: "100%",
              overflow: "visible",
              ...partPointerCss(textId, selKeys.has(`part:${textId}`)),
            })}
          >
            <MathText text={opt.text} style={{ ...textStyle, display: "block", width: "100%" }} />
          </div>,
        );
      }

      const inner = (
        <>
          {bulletBox ? null : marker()}
          {textBox ? null : text()}
          {tick}
        </>
      );

      if (rowBox) {
        // the row was moved: it leaves the grid and becomes a free object
        detached.push(
          <div
            key={`d-${rowId}`}
            {...partHandlers(rowId)}
            style={detachedStyle(rowId, rowBox, {
              ...rowCss,
              display: "flex",
              alignItems: "center",
              overflow: "visible",
              ...partPointerCss(rowId, selKeys.has(`part:${rowId}`)),
            })}
          >
            {inner}
          </div>,
        );
        return;
      }

      inFlow.push(
        <div
          key={rowId}
          {...partHandlers(rowId)}
          style={{
            ...rowCss,
            position: "relative",
            zIndex: 1,
            ...partPointerCss(rowId, selKeys.has(`part:${rowId}`)),
          }}
        >
          {inner}
        </div>,
      );
    });
    return inFlow;
  };

  const optionRows = renderOptions();

  /* --------------------------------- JSX --------------------------------- */
  return (
    <div
      className={editable ? "slide-editable" : undefined}
      {...frameHandlers}
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        background: theme.frameOuter,
        padding: hasFrameImage && !isImageOverlayMode
          ? `${imageInsetY}px ${imageInsetX}px`
          : frameCss.outerPadding,
        boxSizing: "border-box",
        fontFamily: bodyStack,
        position: "relative",
        overflow: "hidden",
        ...(frameHandlers.style ?? {}),
      }}
    >
      {/* If a frame image is active, render it BEHIND the board in "fit" mode so it never covers slide elements */}
      {hasFrameImage && (
        <div
          aria-hidden
          data-frame-image=""
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: isImageOverlayMode ? 80 : 0,
            backgroundImage: `url(${frameImageSrc})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            ...(isImageOverlayMode && frameImageSrc?.toLowerCase().match(/\.(jpg|jpeg|png)(\?|$)/)
              ? {
                  padding: `${frame.imageInset ?? 10}%`,
                  WebkitMask: "linear-gradient(#fff,#fff) content-box, linear-gradient(#fff,#fff)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff,#fff) content-box, linear-gradient(#fff,#fff)",
                  maskComposite: "exclude",
                }
              : {}),
          }}
        />
      )}

      {/* selection outline of the frame itself (it lives outside the board) */}
      {frameSelectable && selectedPartIds.includes(PART_FRAME) && selRefs.length === 1 && (
        <div
          data-overlay={`part:${PART_FRAME}`}
          style={{
            position: "absolute",
            inset: 2,
            zIndex: BAND_UI + 40,
            pointerEvents: "none",
            border: "1.5px solid rgba(94,242,255,.95)",
            borderRadius: frameCss.outerRadius,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 6,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(0,0,0,.78)",
              color: "#5ef2ff",
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            Frame · styled in the Frame panel
          </div>
        </div>
      )}

      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding: hasFrameImage && !isImageOverlayMode ? 0 : frameCss.outerPadding,
          borderRadius: hasFrameImage && !isImageOverlayMode ? 0 : frameCss.outerRadius,
          background: hasFrameImage && !isImageOverlayMode ? "transparent" : frameCss.ringBackground,
          boxShadow: hasFrameImage && !isImageOverlayMode ? "none" : frameCss.ringBoxShadow,
          border: hasFrameImage && !isImageOverlayMode ? "none" : frameCss.ringBorder,
          position: "relative",
          zIndex: 1,
          ...(frameSelectable ? { cursor: "pointer" } : {}),
        }}
        {...(frameSelectable
          ? {
              "data-part": PART_FRAME,
              onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
                if (e.target !== e.currentTarget) return; // only the frame ring itself
                e.stopPropagation();
                if (e.altKey) {
                  onLayerCycle?.(e.clientX, e.clientY);
                  return;
                }
                selectOne({ kind: "part", id: PART_FRAME });
              },
            }
          : {})}
      >
        {/* ------------------------------- board ------------------------------ */}
        <div
          ref={boardRef}
          data-board=""
          onPointerDown={boardDown}
          onPointerMove={boardMove}
          onPointerUp={boardUp}
          onPointerCancel={boardUp}
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            borderRadius: frameCss.innerRadius,
            background: `radial-gradient(120% 90% at 50% -10%, ${shade(theme.board, 0.16)} 0%, ${theme.board} 62%)`,
            position: "relative",
            overflow: "hidden",
            // isolated stacking context: a child can never end up behind this background
            isolation: "isolate",
            zIndex: 1,
          }}
        >
          {/* ------------------------------ background ------------------------- */}
          {bgLayers.map((l) => {
            const isDesign = l.id === PART_BG_DESIGN;
            const sel = selKeys.has(`part:${l.id}`);
            // the artwork is a real object (drag / resize it); every other
            // background layer only joins the hit-test chain, so it can be
            // picked with a click or Alt+click but never blocks anything
            const grabbable = editable && isDesign;
            // the artwork can be dragged / resized like any other object; the
            // other layers stay full-bleed and are edited in the Background panel
            const artBox = isDesign ? bgDesignBox : null;
            const artStyle: CSSProperties =
              isDesign && artBox
                ? {
                    ...l.style,
                    inset: undefined,
                    left: `${artBox.x}%`,
                    top: `${artBox.y}%`,
                    width: `${artBox.w}%`,
                    height: `${artBox.h ?? 100}%`,
                    backgroundSize: "100% 100%",
                    backgroundPosition: "left top",
                    backgroundRepeat: "no-repeat",
                    transform: artBox.rot ? `rotate(${artBox.rot}deg)` : undefined,
                    transformOrigin: "center center",
                  }
                : l.style;
            return (
              <div
                key={`bg-${l.id}`}
                data-bg=""
                {...(grabbable ? partHandlers(l.id) : { "data-part": l.id })}
                style={{
                  ...artStyle,
                  zIndex: bgZ.get(l.id) ?? 0,
                  // decorative layers sit under everything, so they only ever
                  // receive clicks that no other object claimed — they can never
                  // block the built-in elements above them
                  pointerEvents: editable ? "auto" : "none",
                  cursor: editable ? (isDesign ? "move" : "pointer") : undefined,
                  touchAction: editable ? "none" : undefined,
                  outline: sel ? "1.5px dashed rgba(94,242,255,.6)" : undefined,
                  outlineOffset: sel ? -2 : undefined,
                }}
              />
            );
          })}

          {/* alignment guides while dragging */}
          {guides.x !== null && (
            <div
              style={{
                position: "absolute", top: 0, bottom: 0, left: `${guides.x}%`,
                width: 1, background: "rgba(255,214,51,.85)", zIndex: BAND_UI, pointerEvents: "none",
              }}
            />
          )}
          {guides.y !== null && (
            <div
              style={{
                position: "absolute", left: 0, right: 0, top: `${guides.y}%`,
                height: 1, background: "rgba(255,214,51,.85)", zIndex: BAND_UI, pointerEvents: "none",
              }}
            />
          )}

          {/* rubber-band marquee while dragging over empty slide */}
          {editable && marqRect && marqRect.w > 0.2 && marqRect.h > 0.2 && (
            <div
              data-marquee=""
              style={{
                position: "absolute",
                left: `${marqRect.x}%`,
                top: `${marqRect.y}%`,
                width: `${marqRect.w}%`,
                height: `${marqRect.h}%`,
                border: "1.5px dashed rgba(94,242,255,.95)",
                background: "rgba(94,242,255,.10)",
                pointerEvents: "none",
                zIndex: BAND_UI + 30,
                boxSizing: "border-box",
              }}
            />
          )}

          {/* -------------------------------- logo ---------------------------- */}
          {header.showLogo && header.logo && (
            <div {...handlers("logo")} style={boxStyle("logo", { lineHeight: 0 })}>
              <img
                src={header.logo}
                alt="logo"
                draggable={false}
                style={{
                  width: "100%",
                  // aligned mode / no stored height: let the bitmap define it; free mode: fill the box
                  height: isFree("logo") && L.logo.h ? "100%" : "auto",
                  objectFit: "contain",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
          )}

          {/* -------------------------------- brand --------------------------- */}
          <div
            {...handlers("brand")}
            style={boxStyle("brand", boxFontCss(theme, "brand", {
              color: theme.brandColor,
              textTransform: "uppercase",
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: 0.4,
            }))}
          >
            <div style={{ fontSize: 25 }}>{header.brandTop}</div>
            <div style={{ fontSize: 27 }}>{header.brandBottom}</div>
          </div>

          {/* -------------------------------- title --------------------------- */}
          {(() => {
            const bset = { ...DEFAULT_BANNER, ...(theme.banner ?? {}), color: theme.banner?.color ?? theme.titleBanner };
            const css = bannerCss(bset, theme.titleColor);
            const bannerBox = detachedPartBox(theme, PART_BANNER);
            const bannerInside = (asPart: boolean) => (
              <>
                {header.showBanner && css.halo && <div style={css.halo} />}
                {header.showBanner && (
                  <div
                    className={bset.shimmer ? "banner-shimmer" : undefined}
                    style={{
                      ...css.box,
                      ...(asPart
                        ? {
                            pointerEvents: editable ? "auto" : "none",
                            cursor: editable ? "move" : undefined,
                          }
                        : {}),
                    }}
                  />
                )}
              </>
            );
            // a banner the user moved is painted onto the board as its own object
            if (bannerBox) {
              detached.push(
                <div
                  key={`d-${PART_BANNER}`}
                  {...partHandlers(PART_BANNER)}
                  style={detachedStyle(PART_BANNER, bannerBox, {
                    pointerEvents: editable ? "auto" : "none",
                    cursor: editable ? "move" : undefined,
                    touchAction: editable ? "none" : undefined,
                  })}
                >
                  {bannerInside(false)}
                </div>,
              );
            }
            return (
              <div
                {...handlers("title")}
                style={boxStyle("title", { position: "absolute" })}
              >
                <div style={{ position: "relative", padding: css.padding }}>
                  {!bannerBox && partById.has(PART_BANNER) && (
                    // wrapper keeps the banner's own inset percentages resolving
                    // against exactly the same box as before → pixel-identical
                    <div
                      {...partHandlers(PART_BANNER)}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        pointerEvents: editable ? "auto" : "none",
                        cursor: editable ? "move" : undefined,
                        touchAction: editable ? "none" : undefined,
                        outline: selKeys.has(`part:${PART_BANNER}`) ? "1.5px dashed rgba(94,242,255,.6)" : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      {bannerInside(false)}
                    </div>
                  )}
                  <div
                    style={boxFontCss(theme, "title", {
                      position: "relative",
                      zIndex: 1,
                      fontSize: 54,
                      fontWeight: 800,
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      ...css.text,
                    })}
                  >
                    {header.title}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* -------------------------------- badge --------------------------- */}
          <div
            {...handlers("badge")}
            style={boxStyle("badge", boxFontCss(theme, "badge", {
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: 0.5,
              color: theme.badgeColor,
              textTransform: "uppercase",
              textShadow: "0 2px 6px rgba(0,0,0,.6)",
              lineHeight: 1.15,
            }))}
          >
            <span>{slide.badge?.trim() || header.badge}</span>
          </div>

          {/* ------------------------ number bullet (own element) ------------- */}
          {theme.bulletSeparate && theme.showBullet && (() => {
            const id = (theme.numberStyle ?? "circle") as NumberStyle;
            const size = theme.bulletSize ?? 54;
            const aspect = isWideNumberStyle(id) ? 1.6 : 1;
            return (
              <div
                {...handlers("bullet")}
                style={boxStyle("bullet", {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(aspect !== 1 ? { width: `${((size * aspect) / SLIDE_W) * 100}%` } : {}),
                })}
              >
                <BulletGraphic theme={theme} slide={slide} size={size} />
              </div>
            );
          })()}

          {/* ------------------------------- question -------------------------- */}
          {(() => {
            const qBulletBox = detachedPartBox(theme, PART_QBULLET);
            const qBullet = (size: number) => (
              <BulletGraphic
                theme={theme}
                slide={slide}
                size={size}
                partProps={
                  partById.has(PART_QBULLET) && !qBulletBox
                    ? ({
                        ...partHandlers(PART_QBULLET),
                        style: {
                          flex: "0 0 auto",
                          position: "relative",
                          zIndex: 2,
                          cursor: editable ? "move" : undefined,
                          touchAction: editable ? "none" : undefined,
                          pointerEvents: editable ? "auto" : "none",
                          outline: selKeys.has(`part:${PART_QBULLET}`)
                            ? "1.5px dashed rgba(94,242,255,.6)"
                            : undefined,
                          outlineOffset: 2,
                        },
                      } as React.HTMLAttributes<HTMLDivElement>)
                    : undefined
                }
              />
            );
            if (qBulletBox) {
              detached.push(
                <div
                  key={`d-${PART_QBULLET}`}
                  {...partHandlers(PART_QBULLET)}
                  style={detachedStyle(PART_QBULLET, qBulletBox, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: editable ? "auto" : "none",
                    cursor: editable ? "move" : undefined,
                    touchAction: editable ? "none" : undefined,
                  })}
                >
                  {qBullet(theme.bulletSize ?? 54)}
                </div>,
              );
            }
            return (
              <div
                {...handlers("question")}
                style={boxStyle("question", {
                  display: "flex",
                  flexDirection: qRtl ? "row-reverse" : "row",
                  alignItems: "flex-start",
                  gap: 22,
                })}
              >
                {!theme.bulletSeparate && theme.showBullet && !qBulletBox && qBullet(theme.bulletSize ?? 54)}
                <MathText
                  text={slide.question}
                  style={boxFontCss(theme, "question", {
                    color: theme.questionColor,
                    fontSize: qSize,
                    fontWeight: 600,
                    lineHeight: 1.6,
                    letterSpacing: 0.2,
                    textShadow: "0 2px 6px rgba(0,0,0,.6)",
                    flex: 1,
                    textAlign: qRtl ? "right" : L.question.align,
                  })}
                />
              </div>
            );
          })()}

          {/* -------------------------------- options -------------------------- */}
          <div
            {...handlers("options")}
            style={boxStyle("options", {
              display: "grid",
              gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
              columnGap: 44,
              rowGap,
              alignContent: "center",
            })}
          >
            {optionRows}
          </div>

          {/* -------------------------------- note ----------------------------- */}
          {slide.note?.trim() ? (
            <div
              {...handlers("note")}
              style={boxStyle("note", boxFontCss(theme, "note", {
                color: withAlpha("#ffffff", 0.72),
                fontSize: 20,
                fontWeight: 500,
              }))}
            >
              <MathText text={slide.note} />
            </div>
          ) : null}

          {/* ---- built-in parts the user detached from their parent's flow ---- */}
          {detached}

          {/* ------------------------- shapes & text boxes --------------------- */}
          {allShapes.length > 0 && (
            <ShapeLayer
              shapes={allShapes}
              boardRef={boardRef}
              editable={editable}
              selectedIds={selectedShapeIds}
              onSelect={(ids, opts) => onSelectRefs?.(ids.map((id) => ({ kind: "shape" as const, id })), opts)}
              onSelectRefs={onSelectRefs}
              onChange={onShapeChange}
              onBatchChange={onShapesChange}
              onGroup={onGroupRefs ? (ids) => onGroupRefs(ids.map((id) => ({ kind: "shape" as const, id }))) : undefined}
              onUngroup={onUngroupRefs ? (ids) => onUngroupRefs(ids.map((id) => ({ kind: "shape" as const, id }))) : undefined}
              onLayerCycle={onLayerCycle}
              fontFamily={bodyStack}
              snap={shapeSnap}
              smartGuides={theme.smartGuides ?? true}
              extraTargets={theme.smartGuides === false ? [] : snapTargets("")}
              onGestureEnd={onGestureEnd}
              // a mixed / multi selection is framed by the slide itself, so the
              // shape layer only draws its own frame for a single shape
              externalFrame={selRefs.length > 1}
              groupRefs={(id) => groupRefsOf({ kind: "shape", id })}
              extraSelection={selRefs.filter((r) => r.kind !== "shape")}
              onExternalSetMove={(e, refs) => startSetMove(refs, e.clientX, e.clientY)}
              onEditText={(id) => openEditor({ kind: "shape", id })}
            />
          )}

          {/* selection UI: built-in elements + built-in parts + groups */}
          {movable && selRefs.length === 1 && boxOverlay(selRefs[0])}
          {BG_PART_IDS.map((id) => fullBleedOverlay(id))}
          {setOverlay()}
          {inlineEditor()}

          {typeof index === "number" && typeof total === "number" && (
            <div
              style={{
                position: "absolute",
                right: 26,
                bottom: 14,
                color: withAlpha("#ffffff", 0.35),
                fontFamily: boxStack(theme, "badge"),
                fontSize: 18,
                letterSpacing: 1,
                pointerEvents: "none",
              }}
            >
              {index + 1}/{total}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/** finds a nearby edge/centre of another object (or the board) to snap to */
function smartSnapLocal(
  v: number,
  size: number,
  others: { x: number; y: number; w: number; h: number }[],
  axis: "x" | "y",
): { v: number; guide: number | null } {
  const TOL = 0.8;
  const cands: number[] = [0, 50, 100];
  for (const o of others) {
    const a = axis === "x" ? o.x : o.y;
    const s = axis === "x" ? o.w : o.h;
    cands.push(a, a + s / 2, a + s);
  }
  const mine = [
    { off: 0, val: v },
    { off: size / 2, val: v + size / 2 },
    { off: size, val: v + size },
  ];
  let best: { d: number; v: number; guide: number } | null = null;
  for (const c of cands)
    for (const m of mine) {
      const d = Math.abs(m.val - c);
      if (d < TOL && (!best || d < best.d)) best = { d, v: c - m.off, guide: c };
    }
  return best ? { v: best.v, guide: best.guide } : { v, guide: null };
}

/** memoised so large decks keep their thumbnails cheap to re-render */
export default memo(SlideBase);
