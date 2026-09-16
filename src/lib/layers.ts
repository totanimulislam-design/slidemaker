import type { Deck, ElementId, LayoutMap, SlideData } from "./types";
import { ELEMENT_LABELS } from "./types";
import { SHAPE_ICONS, SHAPE_LABELS, type ShapeItem } from "./shapes";
import { reorder, sortByZ, Z_BASE, type ZOp } from "./zorder";
import { alignShape, type AlignOp } from "./shapeAlign";
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
  hidden?: boolean;
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

/** Everything that is actually rendered on `slide`, unsorted. */
export function collectLayers(deck: Deck, slide: SlideData | undefined): LayerEntry[] {
  const out: LayerEntry[] = [];
  const layout = deck.theme.layout;

  const elementVisible = (id: ElementId) =>
    id === "logo" ? deck.header.showLogo && !!deck.header.logo
    : id === "note" ? !!slide?.note?.trim()
    : id === "bullet" ? deck.theme.showBullet && (deck.theme.bulletSeparate !== false || !!deck.theme.showNumber)
    : true;

  (Object.keys(ELEMENT_LABELS) as ElementId[]).forEach((id) => {
    out.push({
      ref: { kind: "element", id },
      key: `element:${id}`,
      z: elementZ(layout, id),
      label: ELEMENT_LABELS[id],
      icon: ELEMENT_ICONS[id],
      global: true,
      hidden: !elementVisible(id),
    });
  });

  const pushShape = (s: ShapeItem, global: boolean) =>
    out.push({
      ref: { kind: "shape", id: s.id },
      key: `shape:${s.id}`,
      z: Number.isFinite(s.z) ? s.z : Z_BASE,
      label: s.kind === "text" && s.text ? s.text.replace(/\n/g, " ").slice(0, 28) : SHAPE_LABELS[s.kind],
      icon: SHAPE_ICONS[s.kind],
      global,
      locked: s.locked,
    });
  (deck.globalShapes ?? []).forEach((s) => pushShape(s, true));
  (slide?.shapes ?? []).forEach((s) => pushShape(s, false));
  return out;
}

/** Bottom → top. */
export const sortedLayers = (deck: Deck, slide: SlideData | undefined) =>
  sortByZ(collectLayers(deck, slide).map((e) => ({ ...e, id: e.key })));

/**
 * Applies a z-order operation across the unified stack and returns the new deck.
 * Only entries whose z changes are written.
 */
/**
 * Bring/Send over the layers that are actually VISIBLE on the slide. Hidden
 * built-ins (no logo, empty footnote) are skipped so one click always produces
 * a visible change; they're re-slotted afterwards to keep every z distinct.
 */
export function reorderLayer(deck: Deck, slide: SlideData | undefined, ref: LayerRef, op: ZOp): Deck {
  const all = collectLayers(deck, slide);
  const visible = all.filter((e) => !e.hidden).map((e) => ({ id: e.key, z: e.z }));
  const key = layerKey(ref);
  if (!visible.some((v) => v.id === key)) return deck; // can't reorder a hidden layer
  const { changes } = reorder(visible, key, op);
  if (!Object.keys(changes).length) return deck;

  // park hidden layers above the visible stack so they never collide
  const top = Math.max(...visible.map((v) => changes[v.id] ?? v.z));
  all.filter((e) => e.hidden).forEach((e, i) => {
    changes[e.key] = top + 1 + i;
  });
  return applyZChanges(deck, changes);
}

/** stack used by UI to decide whether an op is possible (visible layers only) */
export function visibleStack(deck: Deck, slide: SlideData | undefined): { id: string; z: number }[] {
  return sortByZ(collectLayers(deck, slide).filter((e) => !e.hidden).map((e) => ({ ...e, id: e.key })));
}

export function applyZChanges(deck: Deck, changes: Record<string, number>): Deck {
  const layout = { ...deck.theme.layout };
  const shapeZ = new Map<string, number>();
  for (const key of Object.keys(changes)) {
    const ref = parseLayerKey(key);
    if (!ref) continue;
    if (ref.kind === "element") layout[ref.id] = { ...layout[ref.id], z: changes[key] };
    else shapeZ.set(ref.id, changes[key]);
  }
  const fix = (x: ShapeItem): ShapeItem => (shapeZ.has(x.id) ? { ...x, z: shapeZ.get(x.id)! } : x);
  return {
    ...deck,
    theme: { ...deck.theme, layout },
    globalShapes: deck.globalShapes?.map(fix),
    slides: deck.slides.map((s) => (s.shapes?.length ? { ...s, shapes: s.shapes.map(fix) } : s)),
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
