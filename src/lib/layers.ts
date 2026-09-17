import type { Deck, ElementId, LayoutMap, SlideData } from "./types";
import { ELEMENT_LABELS } from "./types";
import { SHAPE_ICONS, SHAPE_LABELS, type ShapeItem } from "./shapes";
import { reorder, sortByZ, Z_BASE, type ZOp } from "./zorder";
import { alignShape, type AlignOp } from "./shapeAlign";
import { effectiveTheme } from "./overrides";
import type { Box } from "./types";

/**
 * ONE stacking order for everything on a slide.
 *
 *   • built-in elements  (logo, brand, title, badge, question, options, note)
 *   • drawn items        (shapes, text boxes, images — per-slide or deck-wide)
 *
 * Every entry has a `z`. Built-ins store it in `theme.layout[id].z`, drawn
 * items in `shape.z`. Because they share the same number line, "Send to Back"
 * can put a rectangle under the question and "Bring to Front" can lift the
 * title over an image — exactly like PowerPoint.
 */

export type LayerRef = { kind: "element"; id: ElementId } | { kind: "shape"; id: string };

export interface LayerEntry {
  ref: LayerRef;
  key: string;
  z: number;
  label: string;
  icon: string;
  /** deck-wide (shows on every slide) */
  global: boolean;
  locked?: boolean;
  /**
   * Hidden by the user (the 👁 toggle). The layer KEEPS its slot in the stack,
   * stays listed and can still be reordered, selected and shown again — it is
   * simply not painted on the board or in exports.
   */
  hidden?: boolean;
  /**
   * Not painted on this slide at all, structurally: no logo uploaded, an empty
   * footnote, a bullet merged into the question. Those rows are listed for
   * completeness but have nothing to reorder.
   */
  absent?: boolean;
  /** drawn item: id of the group it belongs to, when grouped */
  groupId?: string;
  /** the drawn item behind this row (shapes / text boxes / images), for previews */
  shape?: ShapeItem;
}

export const layerKey = (r: LayerRef) => `${r.kind}:${r.id}`;
export const parseLayerKey = (k: string): LayerRef | null => {
  const i = k.indexOf(":");
  if (i < 0) return null;
  const kind = k.slice(0, i);
  const id = k.slice(i + 1);
  return kind === "element" ? { kind: "element", id: id as ElementId } : kind === "shape" ? { kind: "shape", id } : null;
};

/** default z for each built-in when a deck predates the unified stack */
export const ELEMENT_DEFAULT_Z: Record<ElementId, number> = {
  logo: 20,
  brand: 21,
  title: 22,
  badge: 23,
  bullet: 24,
  question: 25,
  options: 26,
  note: 27,
};

const ELEMENT_ICONS: Record<ElementId, string> = {
  logo: "◉",
  brand: "Aa",
  title: "T̲",
  badge: "▣",
  bullet: "❶",
  question: "?",
  options: "☰",
  note: "…",
};

export const elementZ = (layout: LayoutMap, id: ElementId): number => {
  const z = layout[id]?.z;
  return typeof z === "number" && Number.isFinite(z) ? z : ELEMENT_DEFAULT_Z[id];
};

/**
 * Everything that is actually rendered on `slide`, unsorted.
 *
 * Element z is read from the EFFECTIVE theme: a slide whose elements were moved
 * by hand carries its own `themeOverride.layout` copy, and that copy is what the
 * board paints — so the list, the drag drop slot and the canvas must all agree
 * on the same order.
 */
export function collectLayers(deck: Deck, slide: SlideData | undefined): LayerEntry[] {
  const out: LayerEntry[] = [];
  const layout = effectiveTheme(deck, slide).layout;

  /** structurally on the slide? (no logo uploaded, empty footnote, merged bullet) */
  const elementPresent = (id: ElementId) =>
    id === "logo" ? deck.header.showLogo && !!deck.header.logo
    : id === "note" ? !!slide?.note?.trim()
    : id === "bullet" ? deck.theme.showBullet && (deck.theme.bulletSeparate !== false || !!deck.theme.showNumber)
    : true;

  (Object.keys(ELEMENT_LABELS) as ElementId[]).forEach((id) => {
    const absent = !elementPresent(id);
    out.push({
      ref: { kind: "element", id },
      key: `element:${id}`,
      z: elementZ(layout, id),
      label: ELEMENT_LABELS[id],
      icon: ELEMENT_ICONS[id],
      global: true,
      absent,
      hidden: !!layout[id]?.hidden,
      locked: !!layout[id]?.locked,
    });
  });

  const pushShape = (s: ShapeItem, global: boolean) =>
    out.push({
      ref: { kind: "shape", id: s.id },
      key: `shape:${s.id}`,
      z: Number.isFinite(s.z) ? s.z : Z_BASE,
      label: layerLabel(s),
      icon: SHAPE_ICONS[s.kind],
      global,
      locked: s.locked,
      hidden: !!s.hidden,
      groupId: s.groupId,
      shape: s,
    });
  (deck.globalShapes ?? []).forEach((s) => pushShape(s, true));
  (slide?.shapes ?? []).forEach((s) => pushShape(s, false));
  return out;
}

/** Row name of a drawn item: its own name, else its text, else the kind. */
export const layerLabel = (s: ShapeItem): string =>
  s.name?.trim() ||
  (s.kind === "text" && s.text ? s.text.replace(/\s+/g, " ").trim().slice(0, 28) : "") ||
  SHAPE_LABELS[s.kind];

/** The drawn item behind a layer ref, wherever it lives (deck-wide or on the slide). */
export const findShape = (deck: Deck, slide: SlideData | undefined, id: string): ShapeItem | undefined =>
  [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].find((x) => x.id === id) ??
  deck.slides.flatMap((s) => s.shapes ?? []).find((x) => x.id === id);

/**
 * Whether a layer can actually be reordered: everything painted on the slide,
 * hidden-by-the-user layers included (Canva keeps those in the stack too). Only
 * built-ins this slide does not have at all are frozen.
 */
export const isStackable = (e: LayerEntry) => !e.absent;

/** Bottom → top. */
export const sortedLayers = (deck: Deck, slide: SlideData | undefined) =>
  sortByZ(collectLayers(deck, slide).map((e) => ({ ...e, id: e.key })));

/**
 * Applies a z-order operation across the unified stack and returns the new deck.
 * Only entries whose z changes are written.
 */
/**
 * Bring/Send over the layers that belong to this slide's stack — layers the
 * user hid with 👁 included, because they keep their slot exactly like in
 * Canva. Only built-ins the slide does not have AT ALL (no logo uploaded, empty
 * footnote, merged bullet) are skipped, and they are re-slotted above the stack
 * afterwards so every z stays distinct.
 */
export function reorderLayer(deck: Deck, slide: SlideData | undefined, ref: LayerRef, op: ZOp): Deck {
  const all = collectLayers(deck, slide);
  const stack = all.filter(isStackable).map((e) => ({ id: e.key, z: e.z }));
  const key = layerKey(ref);
  if (!stack.some((v) => v.id === key)) return deck; // not on this slide at all
  const { changes } = reorder(stack, key, op);
  if (!Object.keys(changes).length) return deck;

  // park the rows that are not on this slide above the stack so they never collide
  const top = Math.max(...stack.map((v) => changes[v.id] ?? v.z));
  all.filter((e) => !isStackable(e)).forEach((e, i) => {
    changes[e.key] = top + 1 + i;
  });
  return applyZChanges(deck, changes, slide?.id ?? null);
}

/**
 * Drag & drop: moves `ref` (or a whole set of refs) into an exact slot of the
 * slide's stack.
 *
 * `index` counts from the BOTTOM (0 = back … n-1 = front) and is clamped, so a
 * drop anywhere in the list — including past either end — always yields a
 * valid, gap-free stack. Rows that are not on this slide are parked above it,
 * exactly like `reorderLayer`, so every z stays distinct.
 *
 * Returns the deck unchanged when nothing would move, which lets callers treat
 * a drop on its own slot as a no-op (no undo step, no re-render).
 */
export function moveLayerTo(
  deck: Deck,
  slide: SlideData | undefined,
  ref: LayerRef | LayerRef[],
  index: number,
): Deck {
  const all = collectLayers(deck, slide);
  const stack = sortByZ(all.filter(isStackable).map((e) => ({ id: e.key, z: e.z })));
  if (stack.length < 2) return deck;

  /** the carried set, in their current bottom-up order (a multi-drag keeps it) */
  const keys = (Array.isArray(ref) ? ref : [ref]).map(layerKey);
  const moving = stack.filter((v) => keys.includes(v.id));
  if (!moving.length) return deck;

  const rest = stack.filter((v) => !keys.includes(v.id));
  const to = Math.max(0, Math.min(rest.length, Math.round(Number(index))));
  const next = [...rest.slice(0, to), ...moving, ...rest.slice(to)];

  const changes: Record<string, number> = {};
  next.forEach((it, i) => {
    const z = Z_BASE + i;
    if (it.z !== z) changes[it.id] = z;
  });
  if (!Object.keys(changes).length) return deck;

  // park the rows that are not on this slide above the stack so they never collide
  const top = Z_BASE + next.length - 1;
  all.filter((e) => !isStackable(e)).forEach((e, i) => {
    changes[e.key] = top + 1 + i;
  });
  return applyZChanges(deck, changes, slide?.id ?? null);
}

/**
 * The stack slot a dragged layer lands in, from the pointer's row index.
 *
 * The layer list is painted TOP-FIRST while the stack counts from the BOTTOM,
 * and the list also shows rows that are not on this slide and cannot be
 * reordered — so the drag source and the drop target are both counted over the
 * STACKABLE rows only and then flipped. One helper owns that mapping so the
 * panel and the tests agree on it.
 *
 * A multi-row drag carries its rows as one block: `movingCount` says how many
 * travel together, and the returned slot positions the BLOCK so its top-most
 * row lands on `overVisible`.
 *
 * @param rowCount      stackable rows in the list
 * @param fromVisible   the dragged row (top-most of the block), top-first
 * @param overVisible   the row the pointer hovers (its insertion point), top-first
 * @param movingCount   how many rows travel together (default 1)
 * @returns the bottom-up index to hand to `moveLayerTo`, or null when it is a no-op
 */
export function dropSlot(
  rowCount: number,
  fromVisible: number,
  overVisible: number,
  movingCount = 1,
): number | null {
  if (rowCount < 2) return null;
  const moving = Math.max(1, Math.min(rowCount, Math.round(movingCount)));
  const from = Math.max(0, Math.min(rowCount - 1, Math.round(fromVisible)));
  const over = Math.max(0, Math.min(rowCount - 1, Math.round(overVisible)));
  if (moving === 1 && over === from) return null;
  // top-first row → bottom-up stack slot, counted over the rows that stay put
  return Math.max(0, Math.min(rowCount - moving, rowCount - moving - over));
}

/** stack used by UI to decide whether an op is possible (this slide's layers) */
export function visibleStack(deck: Deck, slide: SlideData | undefined): { id: string; z: number }[] {
  return sortByZ(collectLayers(deck, slide).filter(isStackable).map((e) => ({ ...e, id: e.key })));
}

/**
 * The layers actually PAINTED right now: `visibleStack` minus the ones hidden
 * with 👁. This is what canvas-side navigation (Tab-walking, Alt+click layer
 * cycling) must use — you cannot select something that is not on the board.
 */
export function paintedStack(deck: Deck, slide: SlideData | undefined): { id: string; z: number }[] {
  return sortByZ(
    collectLayers(deck, slide)
      .filter((e) => isStackable(e) && !e.hidden)
      .map((e) => ({ ...e, id: e.key })),
  );
}

/* ------------------------------------------------------- layer properties */

/** What the Layers panel can toggle on any row, element or drawn item alike. */
export interface LayerPatch {
  /** 👁 — keep the slot in the stack, stop painting it */
  hidden?: boolean;
  /** 🔒 — no dragging, resizing or rotating on the board */
  locked?: boolean;
  /** the row's name (drawn items only; built-ins keep their fixed labels) */
  name?: string;
}

/**
 * Writes hidden / locked / name onto any set of layers.
 *
 * Elements live in `theme.layout`, and a slide that was arranged by hand
 * shadows that map with its own `themeOverride.layout` copy — so the patch has
 * to reach both, exactly like `applyZChanges`, or hiding the title would look
 * like it did nothing on precisely the slides the user has customised.
 */
export function patchLayers(
  deck: Deck,
  refs: LayerRef[],
  patch: LayerPatch,
  slideId?: string | null,
): Deck {
  if (!refs.length) return deck;
  const elementIds = refs.filter((r) => r.kind === "element").map((r) => r.id as ElementId);
  const shapeIds = new Set(refs.filter((r) => r.kind === "shape").map((r) => r.id));
  const boxPatch: Partial<Box> = {};
  if (patch.hidden !== undefined) boxPatch.hidden = patch.hidden;
  if (patch.locked !== undefined) boxPatch.locked = patch.locked;

  const layout = { ...deck.theme.layout };
  if (elementIds.length && Object.keys(boxPatch).length) {
    for (const id of elementIds) layout[id] = { ...layout[id], ...boxPatch };
  }

  const fix = (x: ShapeItem): ShapeItem => (shapeIds.has(x.id) ? { ...x, ...patch } : x);
  const fixSlide = (s: SlideData): SlideData => {
    const shapes = s.shapes?.length ? s.shapes.map(fix) : s.shapes;
    const over = s.id === slideId ? s.themeOverride?.layout : undefined;
    const themeOverride =
      over && elementIds.some((id) => over[id]) && Object.keys(boxPatch).length
        ? {
            ...s.themeOverride!,
            layout: {
              ...over,
              ...(Object.fromEntries(
                elementIds.filter((id) => over[id]).map((id) => [id, { ...over[id], ...boxPatch }]),
              ) as LayoutMap),
            },
          }
        : s.themeOverride;
    return shapes === s.shapes && themeOverride === s.themeOverride ? s : { ...s, shapes, themeOverride };
  };

  return {
    ...deck,
    theme: { ...deck.theme, layout },
    globalShapes: deck.globalShapes?.map(fix),
    slides: deck.slides.map(fixSlide),
  };
}

/**
 * Writes new z values into the deck.
 *
 * `slideId` matters: a slide whose elements were moved carries a
 * `themeOverride.layout` copy of the whole map, and that copy SHADOWS the
 * deck-level z. Reordering therefore has to write both, or the drop would look
 * like it did nothing on exactly the slides the user has arranged by hand.
 */
export function applyZChanges(deck: Deck, changes: Record<string, number>, slideId?: string | null): Deck {
  const layout = { ...deck.theme.layout };
  const shapeZ = new Map<string, number>();
  const elementZChanges = new Map<ElementId, number>();
  for (const key of Object.keys(changes)) {
    const ref = parseLayerKey(key);
    if (!ref) continue;
    if (ref.kind === "element") {
      layout[ref.id] = { ...layout[ref.id], z: changes[key] };
      elementZChanges.set(ref.id, changes[key]);
    } else shapeZ.set(ref.id, changes[key]);
  }
  const fix = (x: ShapeItem): ShapeItem => (shapeZ.has(x.id) ? { ...x, z: shapeZ.get(x.id)! } : x);
  const fixSlide = (s: SlideData): SlideData => {
    const shapes = s.shapes?.length ? s.shapes.map(fix) : s.shapes;
    const over = s.id === slideId ? s.themeOverride?.layout : undefined;
    const themeOverride =
      over && [...elementZChanges.keys()].some((id) => over[id])
        ? {
            ...s.themeOverride!,
            layout: {
              ...over,
              ...Object.fromEntries(
                [...elementZChanges.entries()].filter(([id]) => over[id]).map(([id, z]) => [id, { ...over[id], z }]),
              ) as LayoutMap,
            },
          }
        : s.themeOverride;
    return shapes === s.shapes && themeOverride === s.themeOverride ? s : { ...s, shapes, themeOverride };
  };
  return {
    ...deck,
    theme: { ...deck.theme, layout },
    globalShapes: deck.globalShapes?.map(fix),
    slides: deck.slides.map(fixSlide),
  };
}

/** Highest z anywhere in the deck (elements + all shapes). */
export function topZ(deck: Deck): number {
  const zs = [
    ...(Object.keys(ELEMENT_LABELS) as ElementId[]).map((id) => elementZ(deck.theme.layout, id)),
    ...(deck.globalShapes ?? []).map((s) => s.z),
    ...deck.slides.flatMap((s) => (s.shapes ?? []).map((x) => x.z)),
  ].filter((n) => Number.isFinite(n));
  return zs.length ? Math.max(...zs) : Z_BASE;
}

/**
 * Migration: gives every element/shape a distinct, positive z in a sensible
 * order. Legacy decks kept built-ins at 1..9 and shapes at 10+; shapes flagged
 * `behind` go under the built-ins, everything else above.
 */
export function normalizeUnifiedZ(deck: Deck): Deck {
  const elements = (Object.keys(ELEMENT_LABELS) as ElementId[]).map((id) => ({
    key: `element:${id}`,
    z: elementZ(deck.theme.layout, id),
    tier: 1,
  }));
  const shapes = [
    ...(deck.globalShapes ?? []),
    ...deck.slides.flatMap((s) => s.shapes ?? []),
  ].map((s) => ({ key: `shape:${s.id}`, z: Number.isFinite(s.z) ? s.z : Z_BASE, tier: s.behind ? 0 : 2 }));

  // A deck that has already been unified stores element z ≥ 20 (see
  // ELEMENT_DEFAULT_Z) or has been reordered; for those we keep the order as
  // is. Legacy decks kept elements at 1..9 and shapes at 10+, with "behind"
  // shapes meant to go under the elements — expressed here via tiers.
  // "unified" only when the stored (not defaulted) element z values are all ≥ Z_BASE
  const storedZ = (Object.keys(ELEMENT_LABELS) as ElementId[]).map((id) => deck.theme.layout[id]?.z);
  const alreadyUnified = storedZ.every((z) => typeof z === "number" && Number.isFinite(z) && z >= Z_BASE);
  const all = [...elements, ...shapes]
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => (alreadyUnified ? 0 : a.tier - b.tier) || a.z - b.z || a.i - b.i);

  const changes: Record<string, number> = {};
  const seen = new Set<string>();
  let z = Z_BASE;
  for (const e of all) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    changes[e.key] = z++;
  }
  const next = applyZChanges(deck, changes);
  // the `behind` flag is now expressed by position; drop it
  const strip = (x: ShapeItem): ShapeItem => (x.behind ? { ...x, behind: undefined } : x);
  return {
    ...next,
    globalShapes: next.globalShapes?.map(strip),
    slides: next.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.map(strip) } : s)),
  };
}


/* ------------------------------------------------------------- geometry */

export interface LayerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** free-mode rect of a layout box; `measured` supplies live size for aligned boxes */
export function boxToRect(b: Box, measured?: { left: number; top: number; w: number; h: number } | null): LayerRect {
  if ((b.mode ?? "align") === "free") return { x: b.x, y: b.y, w: b.w, h: b.h ?? measured?.h ?? 10 };
  if (measured) return { x: measured.left, y: measured.top, w: measured.w, h: measured.h };
  return { x: (b.x * (100 - b.w)) / 100, y: b.y, w: b.w, h: 10 };
}

/** current rect of any layer on `slide` (uses DOM measurement for elements when available) */
export function layerRect(
  deck: Deck,
  slide: SlideData | undefined,
  ref: LayerRef,
  measure?: (id: ElementId) => { left: number; top: number; w: number; h: number } | null,
): LayerRect | null {
  if (ref.kind === "element") {
    const b = deck.theme.layout[ref.id];
    return b ? boxToRect(b, measure?.(ref.id)) : null;
  }
  const sh = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].find((x) => x.id === ref.id);
  return sh ? { x: sh.x, y: sh.y, w: sh.w, h: sh.h } : null;
}

/**
 * Aligns one layer to a reference rect (the slide by default). Elements are
 * promoted to free mode so the result is exact.
 */
export function alignLayer(
  deck: Deck,
  slide: SlideData | undefined,
  ref: LayerRef,
  op: AlignOp,
  target: LayerRect = { x: 0, y: 0, w: 100, h: 100 },
  measure?: (id: ElementId) => { left: number; top: number; w: number; h: number } | null,
): Deck {
  const rect = layerRect(deck, slide, ref, measure);
  if (!rect) return deck;
  const patch = alignShape({ ...rect } as ShapeItem, op, target);
  if (ref.kind === "shape") {
    const fix = (x: ShapeItem): ShapeItem => (x.id === ref.id && !x.locked ? { ...x, ...patch } : x);
    return {
      ...deck,
      globalShapes: deck.globalShapes?.map(fix),
      slides: deck.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.map(fix) } : s)),
    };
  }
  const b = deck.theme.layout[ref.id];
  if (!b || b.locked) return deck; // a locked layer never moves
  const next: Box = { ...b, mode: "free", x: rect.x, y: rect.y, w: rect.w, h: b.h ?? rect.h, ...patch };
  return { ...deck, theme: { ...deck.theme, layout: { ...deck.theme.layout, [ref.id]: next } } };
}

/** Evenly distributes a set of layers along one axis (needs 3+). */
export function distributeLayers(
  deck: Deck,
  slide: SlideData | undefined,
  refs: LayerRef[],
  axis: "h" | "v",
  measure?: (id: ElementId) => { left: number; top: number; w: number; h: number } | null,
): Deck {
  const items = refs
    .map((ref) => ({ ref, rect: layerRect(deck, slide, ref, measure) }))
    .filter((x): x is { ref: LayerRef; rect: LayerRect } => !!x.rect);
  if (items.length < 3) return deck;
  const key = axis === "h" ? "x" : "y";
  const size = axis === "h" ? "w" : "h";
  const sorted = [...items].sort((a, b) => a.rect[key] - b.rect[key]);
  const first = sorted[0].rect;
  const last = sorted[sorted.length - 1].rect;
  const total = last[key] + last[size] - first[key];
  const occupied = sorted.reduce((sum, it) => sum + it.rect[size], 0);
  const gap = (total - occupied) / (sorted.length - 1);
  let cursor = first[key];
  let d = deck;
  for (const it of sorted) {
    const v = Math.round(cursor * 10) / 10;
    d = alignLayer(d, slide, it.ref, axis === "h" ? "left" : "top", { ...it.rect, [key]: v, [size]: it.rect[size] } as LayerRect, measure);
    cursor += it.rect[size] + gap;
  }
  return d;
}
