import type { Box, ElementId } from "./types";
import { FREE_MAX, FREE_MIN } from "./types";

export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

/** Measures an element of the *editable* canvas in % of the board. */
/**
 * Measures an element of the editable canvas in % of the board.
 *
 * Rotation is removed first: getBoundingClientRect() returns the rotated
 * axis-aligned box, which is larger than the element and would make drags drift
 * and resizes balloon (the logo, being an image with its own aspect, showed
 * this most visibly). We use the un-rotated layout box instead:
 *   centre stays where it is, size = offsetWidth/Height × board scale.
 */
export function measureElement(id: ElementId): Rect | null {
  if (typeof document === "undefined") return null;
  const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
  const el = document.querySelector<HTMLElement>(`.slide-editable [data-el="${id}"]`);
  if (!board || !el) return null;
  const b = board.getBoundingClientRect();
  if (!b.width || !b.height) return null;

  const r = el.getBoundingClientRect();
  const scale = b.width / (board.offsetWidth || b.width); // canvas zoom
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

const r1 = (v: number) => Math.round(v * 10) / 10;
export const clampFree = (v: number) => Math.max(FREE_MIN, Math.min(FREE_MAX, v));
export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Converts a box between "align" and "free" without the element visibly
 * moving. Uses the live DOM size when available, a width-only estimate otherwise.
 */
export function convertMode(id: ElementId, box: Box, to: "align" | "free"): Box {
  const from = box.mode ?? "align";
  if (from === to) return box;
  const m = measureElement(id);

  if (to === "free") {
    const left = m ? m.left : (box.x * (100 - box.w)) / 100;
    const top = m ? m.top : box.y;
    // images (logo) need an explicit height so the box doesn't depend on bitmap loading
    const h = id === "logo" ? r1(m ? m.h : box.h ?? box.w * (16 / 9)) : box.h;
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
