import type { ShapeItem } from "./shapes";

export type AlignOp =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom"
  | "fill-w"
  | "fill-h"
  | "fit-board";

export type DistributeOp = "h" | "v";

/**
 * Aligns `shape` inside `ref` (the board = {0,0,100,100} or another shape's
 * bounding box). Returns only the fields that change.
 */
export function alignShape(
  shape: ShapeItem,
  op: AlignOp,
  ref: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 100, h: 100 },
): Partial<ShapeItem> {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  switch (op) {
    case "left":
      return { x: r1(ref.x) };
    case "hcenter":
      return { x: r1(ref.x + (ref.w - shape.w) / 2) };
    case "right":
      return { x: r1(ref.x + ref.w - shape.w) };
    case "top":
      return { y: r1(ref.y) };
    case "vcenter":
      return { y: r1(ref.y + (ref.h - shape.h) / 2) };
    case "bottom":
      return { y: r1(ref.y + ref.h - shape.h) };
    case "fill-w":
      return { x: r1(ref.x), w: r1(ref.w) };
    case "fill-h":
      return { y: r1(ref.y), h: r1(ref.h) };
    case "fit-board":
      return { x: 0, y: 0, w: 100, h: 100 };
  }
}

/** Evenly spaces 3+ shapes between the first and last along one axis. */
export function distributeShapes(items: ShapeItem[], op: DistributeOp): { id: string; patch: Partial<ShapeItem> }[] {
  if (items.length < 3) return [];
  const key = op === "h" ? "x" : "y";
  const size = op === "h" ? "w" : "h";
  const sorted = [...items].sort((a, b) => a[key] - b[key]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const total = last[key] + last[size] - first[key];
  const occupied = sorted.reduce((sum, s) => sum + s[size], 0);
  const gap = (total - occupied) / (sorted.length - 1);
  let cursor = first[key];
  return sorted.map((s) => {
    const patch = { [key]: Math.round(cursor * 10) / 10 } as Partial<ShapeItem>;
    cursor += s[size] + gap;
    return { id: s.id, patch };
  });
}

/** Bounding box that encloses every given shape. */
export function boundsOf(items: ShapeItem[]) {
  const x = Math.min(...items.map((s) => s.x));
  const y = Math.min(...items.map((s) => s.y));
  const x2 = Math.max(...items.map((s) => s.x + s.w));
  const y2 = Math.max(...items.map((s) => s.y + s.h));
  return { x, y, w: x2 - x, h: y2 - y };
}
