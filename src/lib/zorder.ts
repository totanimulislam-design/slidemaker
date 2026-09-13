/**
 * Stacking-order operations for shapes / text boxes / images.
 *
 * Items are ordered by `z`. Instead of nudging `z` by ±1 (which breaks as soon
 * as two items share a value or have gaps), every operation works on the
 * *sorted list*, moves the item to its new index, and re-numbers the whole
 * stack 10, 11, 12 … so results are always consistent and predictable.
 *
 * The ten built-in slide elements (question, options …) sit at z 2–3, so user
 * items start at Z_BASE = 10 and always stay above them.
 */

export type ZOp = "forward" | "front" | "backward" | "back";

export const Z_BASE = 10;

/**
 * Render-time bands. Stored `z` values are small integers; the renderer adds a
 * band offset so the three groups never interleave by accident:
 *
 *   BAND_BEHIND   shapes flagged "behind slide text"   (highlight boxes, backdrops)
 *   BAND_CONTENT  built-in slide elements (title, question, options …)
 *   BAND_SHAPES   normal shapes, text boxes, images
 *   BAND_UI       guides, selection frames, handles — always on top
 */
export const BAND_CONTENT = 1000; // every slide element AND drawn item: 1000 + z
export const BAND_UI = 9000; // guides, selection frames, handles — always on top

/** clamps any stored z into a safe positive integer */
export const safeZ = (z: unknown, fallback = Z_BASE): number => {
  const n = typeof z === "number" && Number.isFinite(z) ? Math.round(z) : fallback;
  return Math.max(1, Math.min(7999, n));
};

export interface ZItem {
  id: string;
  z: number;
}

export interface ZResult {
  /** new z per item id — only items whose z actually changed */
  changes: Record<string, number>;
  /** index of the target in the resulting stack (0 = bottom) */
  index: number;
  count: number;
}

/** Sorts bottom → top, breaking ties by the original array order (stable). */
export function sortByZ<T extends ZItem>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.z - b.it.z || a.i - b.i)
    .map((x) => x.it);
}

/** Position of `id` in the stack: 0 = bottom … n-1 = top. */
export function zIndexOf(items: ZItem[], id: string): number {
  return sortByZ(items).findIndex((x) => x.id === id);
}

export function canMove(items: ZItem[], id: string, op: ZOp): boolean {
  const n = items.length;
  const i = zIndexOf(items, id);
  if (i < 0 || n < 2) return false;
  return op === "forward" || op === "front" ? i < n - 1 : i > 0;
}

export function reorder(items: ZItem[], id: string, op: ZOp): ZResult {
  const stack = sortByZ(items);
  const from = stack.findIndex((x) => x.id === id);
  const n = stack.length;
  if (from < 0) return { changes: {}, index: -1, count: n };

  const to =
    op === "front" ? n - 1
    : op === "back" ? 0
    : op === "forward" ? Math.min(n - 1, from + 1)
    : Math.max(0, from - 1);

  const next = [...stack];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);

  const changes: Record<string, number> = {};
  next.forEach((it, i) => {
    const z = Z_BASE + i;
    if (it.z !== z) changes[it.id] = z;
  });
  return { changes, index: to, count: n };
}

/** Assigns 10, 11, 12 … to an existing stack (used when adding items). */
export function normalize(items: ZItem[]): Record<string, number> {
  return reorder(items, items[0]?.id ?? "", "forward").changes;
}

export const Z_LABELS: Record<ZOp, { label: string; icon: string; hint: string }> = {
  forward: { label: "Bring Forward", icon: "▲", hint: "One step up (Ctrl+])" },
  front: { label: "Bring to Front", icon: "⏫", hint: "Above everything (Ctrl+Shift+])" },
  backward: { label: "Send Backward", icon: "▼", hint: "One step down (Ctrl+[)" },
  back: { label: "Send to Back", icon: "⏬", hint: "Below everything (Ctrl+Shift+[)" },
};
