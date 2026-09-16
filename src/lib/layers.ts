import type { Deck, ElementId, LayoutMap, SlideData, ThemeSettings } from "./types";
import { ELEMENT_LABELS } from "./types";
import { SHAPE_ICONS, SHAPE_LABELS, type ShapeItem } from "./shapes";
import { reorder, sortByZ, Z_BASE, type ZOp } from "./zorder";
import { alignShape, type AlignOp } from "./shapeAlign";
import type { Box } from "./types";
import { collectParts, partInfo, type PartId } from "./parts";
import { effectiveHeader, effectiveTheme } from "./overrides";
import { effectiveBackground } from "./background";
import { measurePart } from "./layoutMeasure";

/**
 * ONE stacking order for everything on a slide.
 *
 *   • built-in elements  (logo, brand, title, badge, question, options, note)
 *   • built-in parts     (option rows, option text/markers, banner, frame,
 *                         background artwork — see lib/parts.ts)
 *   • drawn items        (shapes, text boxes, images — per-slide or deck-wide)
 *
 * Every entry has a `z`. Built-ins store it in `theme.layout[id].z`, parts in
 * `theme.partLayout[id].z`, drawn items in `shape.z`. Because they share the
 * same number line, "Send to Back" can put a rectangle under the question and
 * "Bring to Front" can lift the title over an image — exactly like PowerPoint.
 */

export type LayerRef =
  | { kind: "element"; id: ElementId }
  | { kind: "shape"; id: string }
  /** a built-in part of the slide (option row, marker, banner, frame…) */
  | { kind: "part"; id: PartId };

export const refKey = (r: LayerRef) => `${r.kind}:${r.id}`;

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
  /** drawn item / part: id of the group it belongs to, when grouped */
  groupId?: string;
  /** built-in element this layer lives inside (parts only) */
  parent?: ElementId;
  /** set for layers that cannot be moved freely (full-bleed background, frame) */
  fixed?: boolean;
}

export const layerKey = (r: LayerRef) => `${r.kind}:${r.id}`;
export const parseLayerKey = (k: string): LayerRef | null => {
  const i = k.indexOf(":");
  if (i < 0) return null;
  const kind = k.slice(0, i);
  const id = k.slice(i + 1);
  if (!id) return null;
  return kind === "element"
    ? { kind: "element", id: id as ElementId }
    : kind === "shape"
      ? { kind: "shape", id }
      : kind === "part"
        ? { kind: "part", id }
        : null;
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

/**
 * Placeholder box written when only a part's stacking order is known (it has
 * never been moved). `mode: "align"` + `w: 0` means "no geometry override" —
 * the slide keeps laying the part out itself (see `detachedPartBox`).
 */
export const DEFAULT_PART_BOX: Box = { x: 0, y: 0, w: 0, align: "left", mode: "align" };

/**
 * The part's own box, but ONLY once it has been detached from its parent's
 * layout flow by a move/resize. Anything else means "render as built in".
 */
export function detachedPartBox(theme: ThemeSettings, id: PartId): Box | null {
  const b = theme.partLayout?.[id];
  if (!b) return null;
  if ((b.mode ?? "align") !== "free") return null;
  if (!(b.w > 0)) return null;
  return b;
}

export const elementZ = (layout: LayoutMap, id: ElementId): number => {
  const z = layout[id]?.z;
  return typeof z === "number" && Number.isFinite(z) ? z : ELEMENT_DEFAULT_Z[id];
};

/**
 * Stacking order of a built-in part. A stored z always wins; otherwise the
 * part sits half a step above the element it belongs to (so the list order
 * matches what is painted) and the slide chrome stays at the very bottom.
 */
export function partZ(theme: ThemeSettings, id: PartId): number {
  const stored = theme.partLayout?.[id]?.z;
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const info = partInfo(id);
  if (!info.parent) return info.z;
  return elementZ(theme.layout, info.parent) + 0.5;
}

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
      groupId: deck.theme.layout[id]?.groupId,
    });
  });

  // built-in parts: option rows, option text/markers, banner, frame, background
  const theme = effectiveTheme(deck, slide);
  collectParts(theme, slide, effectiveHeader(deck, slide), effectiveBackground(deck, slide)).forEach((p) => {
    out.push({
      ref: { kind: "part", id: p.id },
      key: `part:${p.id}`,
      z: partZ(theme, p.id),
      label: p.label,
      icon: p.icon,
      global: false,
      hidden: false,
      fixed: !p.movable,
      parent: p.parent,
      groupId: theme.partLayout?.[p.id]?.groupId,
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
      groupId: s.groupId,
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
  const partLayout = { ...(deck.theme.partLayout ?? {}) };
  const shapeZ = new Map<string, number>();
  for (const key of Object.keys(changes)) {
    const ref = parseLayerKey(key);
    if (!ref) continue;
    if (ref.kind === "element") layout[ref.id] = { ...layout[ref.id], z: changes[key] };
    else if (ref.kind === "part") {
      const cur = partLayout[ref.id];
      partLayout[ref.id] = cur ? { ...cur, z: changes[key] } : { ...(DEFAULT_PART_BOX as Box), z: changes[key] };
    } else shapeZ.set(ref.id, changes[key]);
  }
  const fix = (x: ShapeItem): ShapeItem => (shapeZ.has(x.id) ? { ...x, z: shapeZ.get(x.id)! } : x);
  return {
    ...deck,
    theme: { ...deck.theme, layout, partLayout },
    globalShapes: deck.globalShapes?.map(fix),
    slides: deck.slides.map((s) => (s.shapes?.length ? { ...s, shapes: s.shapes.map(fix) } : s)),
  };
}

/** Highest z anywhere in the deck (elements + parts + all shapes). */
export function topZ(deck: Deck): number {
  const zs = [
    ...(Object.keys(ELEMENT_LABELS) as ElementId[]).map((id) => elementZ(deck.theme.layout, id)),
    ...Object.values(deck.theme.partLayout ?? {}).map((b) => b?.z ?? -Infinity),
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
  if (ref.kind === "part") {
    const theme = effectiveTheme(deck, slide);
    const b = detachedPartBox(theme, ref.id);
    if (b) return boxToRect(b, null);
    // still in flow: measure the live DOM node so align/distribute are exact
    const m = measurePart(ref.id);
    return m ? { x: m.left, y: m.top, w: m.w, h: m.h } : null;
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
  if (ref.kind === "part") {
    if (!partInfo(ref.id).movable) return deck; // full-bleed chrome cannot be aligned
    const theme = effectiveTheme(deck, slide);
    const cur = theme.partLayout?.[ref.id] ?? DEFAULT_PART_BOX;
    const next: Box = { ...cur, mode: "free", x: rect.x, y: rect.y, w: rect.w, h: cur.h ?? rect.h, ...patch };
    return {
      ...deck,
      theme: { ...deck.theme, partLayout: { ...(deck.theme.partLayout ?? {}), [ref.id]: next } },
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
