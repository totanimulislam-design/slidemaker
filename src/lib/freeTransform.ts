/**
 * Shared free-transform gesture engine used by BOTH drawn shapes and the
 * built-in slide elements, so every item on the board moves, resizes (8 handles),
 * rotates and snaps identically.
 *
 * All geometry is in % of the board. `Rect` is {x, y, w, h, rot} with x/y as the
 * element's own top-left edge (i.e. "free" mode).
 */

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Pixels the pointer must travel after mousedown before a move-drag starts. */
export const DRAG_THRESHOLD_PX = 4;

export const HANDLES: { h: Handle; cursor: string; style: React.CSSProperties }[] = [
  { h: "nw", cursor: "nwse-resize", style: { left: -8, top: -8 } },
  { h: "n", cursor: "ns-resize", style: { left: "50%", top: -8, marginLeft: -8 } },
  { h: "ne", cursor: "nesw-resize", style: { right: -8, top: -8 } },
  { h: "e", cursor: "ew-resize", style: { right: -8, top: "50%", marginTop: -8 } },
  { h: "se", cursor: "nwse-resize", style: { right: -8, bottom: -8 } },
  { h: "s", cursor: "ns-resize", style: { left: "50%", bottom: -8, marginLeft: -8 } },
  { h: "sw", cursor: "nesw-resize", style: { left: -8, bottom: -8 } },
  { h: "w", cursor: "ew-resize", style: { left: -8, top: "50%", marginTop: -8 } },
];

export type Gesture =
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; start: FreeRect; ratio: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; start: number; rot0: number };

export interface SnapTarget {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveOptions {
  /** grid snap fn (already includes 0/25/50/75/100 anchors) */
  grid?: (v: number) => number;
  /** other items to align edges/centres with */
  others?: SnapTarget[];
  /** bypass all snapping (Alt) */
  free?: boolean;
  /** tolerance in % of board */
  tol?: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

function smartSnap(v: number, size: number, others: SnapTarget[], axis: "x" | "y", tol: number) {
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
  for (const c of cands) for (const m of mine) {
    const d = Math.abs(m.val - c);
    if (d < tol && (!best || d < best.d)) best = { d, v: c - m.off, guide: c };
  }
  return best ? { v: best.v, guide: best.guide } : { v, guide: null as number | null };
}

/** Computes the new position for a move gesture. */
export function applyMove(
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
      const tol = opts.tol ?? 0.8;
      const sx = smartSnap(x, rect.w, opts.others, "x", tol);
      const sy = smartSnap(y, rect.h, opts.others, "y", tol);
      x = sx.v;
      y = sy.v;
      gx = sx.guide;
      gy = sy.guide;
    }
  }
  return { x: r1(Math.max(-50, Math.min(150, x))), y: r1(Math.max(-50, Math.min(150, y))), gx, gy };
}

/** Computes the new rect for a resize gesture from one of the 8 handles. */
export function applyResize(
  g: Extract<Gesture, { kind: "resize" }>,
  dx: number,
  dy: number,
  opts: { keepRatio: boolean; grid?: (v: number) => number; free?: boolean; minW?: number; minH?: number },
): Pick<FreeRect, "x" | "y" | "w" | "h"> {
  const { start: s0, handle: h } = g;
  let { x, y, w, h: hh } = s0;
  const minW = opts.minW ?? 1;
  const minH = opts.minH ?? 0.3;

  if (h.includes("e")) w = s0.w + dx;
  if (h.includes("s")) hh = s0.h + dy;
  if (h.includes("w")) {
    w = s0.w - dx;
    x = s0.x + dx;
  }
  if (h.includes("n")) {
    hh = s0.h - dy;
    y = s0.y + dy;
  }

  if (opts.keepRatio && h.length === 2 && g.ratio > 0) {
    const byW = Math.abs(w - s0.w) >= Math.abs(hh - s0.h) * g.ratio;
    if (byW) hh = w / g.ratio;
    else w = hh * g.ratio;
    if (h.includes("w")) x = s0.x + s0.w - w;
    if (h.includes("n")) y = s0.y + s0.h - hh;
  }

  if (w < minW) {
    if (h.includes("w")) x = s0.x + s0.w - minW;
    w = minW;
  }
  if (hh < minH) {
    if (h.includes("n")) y = s0.y + s0.h - minH;
    hh = minH;
  }

  if (!opts.free && opts.grid) {
    if (h.includes("w")) {
      const nx = opts.grid(x);
      w += x - nx;
      x = nx;
    } else if (h.includes("e")) w = opts.grid(x + w) - x;
    if (h.includes("n")) {
      const ny = opts.grid(y);
      hh += y - ny;
      y = ny;
    } else if (h.includes("s")) hh = opts.grid(y + hh) - y;
  }
  return { x: r1(x), y: r1(y), w: r1(Math.max(minW, w)), h: r1(Math.max(minH, hh)) };
}

/** Rotation from a drag around the centre, Shift snaps to 15°. */
export function applyRotate(g: Extract<Gesture, { kind: "rotate" }>, px: number, py: number, snap15: boolean): number {
  const a = Math.atan2(py - g.cy, px - g.cx);
  let deg = g.rot0 + ((a - g.start) * 180) / Math.PI;
  if (snap15) deg = Math.round(deg / 15) * 15;
  return ((Math.round(deg) + 540) % 360) - 180;
}
