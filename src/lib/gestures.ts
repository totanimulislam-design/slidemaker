import type { CSSProperties } from "react";

/**
 * GESTURES — the transform maths of the object interaction system.
 *
 * One engine for every object kind (built-in elements, built-in parts, drawn
 * shapes) and for whole selections / groups: a gesture snapshots each member's
 * rectangle, computes the new rectangle(s) from the pointer travel and emits
 * geometry patches. All geometry is in % of the board; `FreeRect` uses the
 * object's own top-left edge ("free" terms).
 */

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** The 8 resize grips, with their handle position and cursor. */
export const HANDLES: { h: Handle; cursor: string; style: CSSProperties }[] = [
  { h: "nw", cursor: "nwse-resize", style: { left: -8, top: -8 } },
  { h: "n", cursor: "ns-resize", style: { left: "50%", top: -8, marginLeft: -8 } },
  { h: "ne", cursor: "nesw-resize", style: { right: -8, top: -8 } },
  { h: "e", cursor: "ew-resize", style: { right: -8, top: "50%", marginTop: -8 } },
  { h: "se", cursor: "nwse-resize", style: { right: -8, bottom: -8 } },
  { h: "s", cursor: "ns-resize", style: { left: "50%", bottom: -8, marginLeft: -8 } },
  { h: "sw", cursor: "nesw-resize", style: { left: -8, bottom: -8 } },
  { h: "w", cursor: "ew-resize", style: { left: -8, top: "50%", marginTop: -8 } },
];

export const r1 = (v: number) => Math.round(v * 10) / 10;

/** Axis-aligned bounding box (in % of the board) over a set of rectangles. */
export function boundsOf(rects: BoxRect[]): BoxRect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Do two boxes (in board %) overlap? Used by the drag-marquee selection. */
export function boxesOverlap(a: BoxRect, b: BoxRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ---------------------------------------------------------------- snapping */

const SNAP_ANCHORS = [0, 25, 50, 75, 100];

/** Grid snap: round to `step`, then magnetise to the board anchors (0/25/50/75/100). */
export function makeGridSnap(step: number): (v: number) => number {
  const s = Math.max(0.1, step || 1);
  return (v: number) => {
    const rounded = Math.round(v / s) * s;
    const hit = SNAP_ANCHORS.find((t) => Math.abs(rounded - t) < 1.2);
    return hit === undefined ? rounded : hit;
  };
}

/**
 * Smart guides: finds a nearby edge/centre of another object (or of the board)
 * to snap `v` (the object's leading edge) to, given the object's `size`.
 */
export function smartSnap(
  v: number,
  size: number,
  others: BoxRect[],
  axis: "x" | "y",
  tol = 0.8,
): { v: number; guide: number | null } {
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
      if (d < tol && (!best || d < best.d)) best = { d, v: c - m.off, guide: c };
    }
  return best ? { v: best.v, guide: best.guide } : { v, guide: null };
}

/* ------------------------------------------------------------ single move */

export interface MoveOptions {
  /** grid snap (already includes the board anchors) */
  grid?: (v: number) => number;
  /** other objects to align edges/centres with */
  others?: BoxRect[];
  /** bypass all snapping (Alt) */
  free?: boolean;
}

/** New top-left for a move gesture, snapped; `gx`/`gy` are the guide lines to draw. */
export function moveRect(
  rect: FreeRect,
  rawX: number,
  rawY: number,
  opts: MoveOptions,
): { x: number; y: number; gx: number | null; gy: number | null } {
  let x = rawX;
  let y = rawY;
  let gx: number | null = null;
  let gy: number | null = null;
  if (!opts.free) {
    if (opts.grid) {
      x = opts.grid(x);
      y = opts.grid(y);
    }
    if (opts.others) {
      const sx = smartSnap(x, rect.w, opts.others, "x");
      const sy = smartSnap(y, rect.h, opts.others, "y");
      x = sx.v;
      y = sy.v;
      gx = sx.guide;
      gy = sy.guide;
    }
  }
  return { x: r1(Math.max(-50, Math.min(150, x))), y: r1(Math.max(-50, Math.min(150, y))), gx, gy };
}

/* --------------------------------------------------------- single resize */

export interface ResizeOptions {
  keepRatio: boolean;
  grid?: (v: number) => number;
  free?: boolean;
  minW?: number;
  minH?: number;
}

/** New rectangle for a resize gesture from one of the 8 handles. */
export function resizeRect(
  start: FreeRect,
  handle: Handle,
  dx: number,
  dy: number,
  opts: ResizeOptions,
): BoxRect {
  const minW = opts.minW ?? 1;
  const minH = opts.minH ?? 0.3;
  let { x, y, w } = start;
  let h = start.h;
  const ratio = start.h > 0 ? start.w / start.h : 1;

  if (handle.includes("e")) w = start.w + dx;
  if (handle.includes("s")) h = start.h + dy;
  if (handle.includes("w")) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (handle.includes("n")) {
    h = start.h - dy;
    y = start.y + dy;
  }

  if (opts.keepRatio && handle.length === 2 && ratio > 0) {
    const byW = Math.abs(w - start.w) >= Math.abs(h - start.h) * ratio;
    if (byW) h = w / ratio;
    else w = h * ratio;
    if (handle.includes("w")) x = start.x + start.w - w;
    if (handle.includes("n")) y = start.y + start.h - h;
  }

  if (w < minW) {
    if (handle.includes("w")) x = start.x + start.w - minW;
    w = minW;
  }
  if (h < minH) {
    if (handle.includes("n")) y = start.y + start.h - minH;
    h = minH;
  }

  if (!opts.free && opts.grid) {
    if (handle.includes("w")) {
      const nx = opts.grid(x);
      w += x - nx;
      x = nx;
    } else if (handle.includes("e")) w = opts.grid(x + w) - x;
    if (handle.includes("n")) {
      const ny = opts.grid(y);
      h += y - ny;
      y = ny;
    } else if (handle.includes("s")) h = opts.grid(y + h) - y;
  }
  return { x: r1(x), y: r1(y), w: r1(Math.max(minW, w)), h: r1(Math.max(minH, h)) };
}

/* ---------------------------------------------------------- single rotate */

/** Rotation (deg) from a drag around the object centre; Shift snaps to 15°. */
export function rotateAngle(
  cx: number,
  cy: number,
  startAngle: number,
  rot0: number,
  px: number,
  py: number,
  snap15: boolean,
): number {
  const a = Math.atan2(py - cy, px - cx);
  let deg = rot0 + ((a - startAngle) * 180) / Math.PI;
  if (snap15) deg = Math.round(deg / 15) * 15;
  return ((Math.round(deg) + 540) % 360) - 180;
}

/* ------------------------------------------------------------ set (group) */

export interface MemberGeo {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Translates every member of a selection/group by the same delta (% of board). */
export function translateSet(
  members: { id: string; geo: MemberGeo }[],
  dx: number,
  dy: number,
): { id: string; patch: { x: number; y: number } }[] {
  return members.map(({ id, geo }) => ({ id, patch: { x: r1(geo.x + dx), y: r1(geo.y + dy) } }));
}

/** Scales every member from the `from` bounds to the `to` bounds (anchored AABB scale). */
export function scaleSet(
  members: { id: string; geo: MemberGeo }[],
  from: BoxRect,
  to: BoxRect,
): { id: string; patch: BoxRect }[] {
  const fx = from.w > 0.001 ? Math.max(0.02, to.w / from.w) : 1;
  const fy = from.h > 0.001 ? Math.max(0.02, to.h / from.h) : 1;
  // anchor = the bounds edge(s) the drag moved away from
  const ax = fx !== 1 && to.x > from.x + 0.001 ? from.x + from.w : from.x;
  const ay = fy !== 1 && to.y > from.y + 0.001 ? from.y + from.h : from.y;
  return members.map(({ id, geo }) => ({
    id,
    patch: {
      x: r1(ax + (geo.x - ax) * fx),
      y: r1(ay + (geo.y - ay) * fy),
      w: r1(Math.max(0.5, geo.w * fx)),
      h: r1(Math.max(0.2, geo.h * fy)),
    },
  }));
}

/**
 * Rotates every member around a pivot by `delta` degrees: member centres orbit
 * the pivot and each member spins by the same angle. Maths run in board pixels
 * so the 16:9 board doesn't skew the angle.
 */
export function rotateSet(
  members: { id: string; geo: MemberGeo }[],
  pivot: { x: number; y: number },
  delta: number,
  board: { width: number; height: number },
): { id: string; patch: { x: number; y: number; rot: number } }[] {
  const rad = (delta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return members.map(({ id, geo }) => {
    const cx = ((geo.x + geo.w / 2) / 100) * board.width;
    const cy = ((geo.y + geo.h / 2) / 100) * board.height;
    const ox = cx - pivot.x;
    const oy = cy - pivot.y;
    const nx = pivot.x + ox * cos - oy * sin;
    const ny = pivot.y + ox * sin + oy * cos;
    const rot = geo.rot + delta;
    return {
      id,
      patch: {
        x: r1((nx / board.width) * 100 - geo.w / 2),
        y: r1((ny / board.height) * 100 - geo.h / 2),
        rot: ((Math.round(rot) + 540) % 360) - 180,
      },
    };
  });
}
