import type { Box, ElementId } from "./types";
import { FREE_MAX, FREE_MIN } from "./types";
import type { ObjKey } from "./scene";

/**
 * GEOMETRY — the measurement half of the object interaction system.
 *
 * Every object on the editable canvas is tagged with a single attribute,
 * `data-obj="<kind>:<id>"` (see lib/scene.ts for the object model). This module
 * turns those tags into board-relative rectangles so the interaction layer can
 * select, move, resize and rotate anything — built-in element, built-in part or
 * drawn shape — with one code path.
 *
 * All rectangles are percentages of the board (the 1280×720 slide surface).
 */

export interface Rect {
  /** left edge, % of the board width */
  left: number;
  /** top edge, % of the board height */
  top: number;
  /** width, % of the board width */
  w: number;
  /** height, % of the board height */
  h: number;
}

/**
 * Measures any tagged object of the *editable* canvas in % of the board.
 *
 * Rotation is removed first: getBoundingClientRect() returns the rotated
 * axis-aligned box, which is larger than the object itself and would make drags
 * drift and resizes balloon. The un-rotated layout box is reconstructed from
 * offsetWidth/offsetHeight (scaled by the canvas zoom) around the same centre.
 */
export function measureObj(key: ObjKey): Rect | null {
  if (typeof document === "undefined") return null;
  const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
  if (!board) return null;
  const safe = key.replace(/["\\]/g, "\\$&");
  const el = board.querySelector<HTMLElement>(`[data-obj="${safe}"]`);
  if (!el) return null;
  const b = board.getBoundingClientRect();
  if (!b.width || !b.height) return null;

  const r = el.getBoundingClientRect();
  const scale = b.width / (board.offsetWidth || b.width); // canvas zoom factor
  const w = el.offsetWidth * scale;
  const h = el.offsetHeight * scale;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return {
    left: ((cx - w / 2 - b.left) / b.width) * 100,
    top: ((cy - h / 2 - b.top) / b.height) * 100,
    w: (w / b.width) * 100,
    h: (h / b.height) * 100,
  };
}

/** Measures a built-in element (logo, title, question …) of the editable canvas. */
export function measureElement(id: ElementId): Rect | null {
  return measureObj(`element:${id}`);
}

/** Measures a built-in part (option row, marker, banner, artwork …) of the editable canvas. */
export function measurePart(id: string): Rect | null {
  return measureObj(`part:${id}`);
}

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const clampFree = (v: number) => Math.max(FREE_MIN, Math.min(FREE_MAX, v));
export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Converts a box between "align" and "free" positioning without the object
 * visibly moving. `m` is the live measurement of its node; `fixedHeight` keeps
 * an explicit height (images) so the box never depends on a bitmap loading.
 */
export function convertBoxMode(
  box: Box,
  to: "align" | "free",
  m: Rect | null,
  opts?: { fixedHeight?: boolean },
): Box {
  const from = box.mode ?? "align";
  if (from === to) return box;

  if (to === "free") {
    const left = m ? m.left : (box.x * (100 - box.w)) / 100;
    const top = m ? m.top : box.y;
    const h = opts?.fixedHeight ? r1(m ? m.h : box.h ?? box.w * (16 / 9)) : box.h ?? (m ? r1(m.h) : undefined);
    return { ...box, mode: "free", x: r1(left), y: r1(top), w: r1(m ? m.w : box.w), h };
  }

  // free → align
  const w = m ? m.w : box.w;
  const h = m ? m.h : (box.h ?? 10);
  const freeX = 100 - w;
  const freeY = 100 - h;
  return {
    ...box,
    mode: "align",
    x: r1(clamp100(freeX > 0.01 ? (box.x / freeX) * 100 : 50)),
    y: r1(clamp100(freeY > 0.01 ? (box.y / freeY) * 100 : 50)),
    h: undefined,
    rot: box.rot,
  };
}

/** Mode conversion for a built-in element, measured live from the canvas. */
export function convertMode(id: ElementId, box: Box, to: "align" | "free"): Box {
  return convertBoxMode(box, to, measureElement(id), { fixedHeight: id === "logo" });
}
