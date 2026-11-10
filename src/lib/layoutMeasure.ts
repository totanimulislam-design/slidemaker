import type { Box, ElementId } from "./types";
import { FREE_MAX, FREE_MIN } from "./types";

export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface ContentRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Measures an element of the editable canvas in % of the board. */
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
  if (!w || !h) return null;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return {
    left: ((cx - w / 2 - b.left) / b.width) * 100,
    top: ((cy - h / 2 - b.top) / b.height) * 100,
    w: (w / b.width) * 100,
    h: (h / b.height) * 100,
  };
}

/**
 * Find the tight painted-content bounds for a built-in element. Text is
 * measured with Range (not its line/block boxes); image/vector/canvas bounds
 * and explicit painted plates/markers are unioned in. Returns null when the
 * browser cannot provide meaningful geometry (as in jsdom), letting callers
 * safely fall back to the layout box.
 */
export function measureContent(id: ElementId): ContentRect | null {
  if (typeof document === "undefined") return null;
  const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
  const el = document.querySelector<HTMLElement>(`.slide-editable [data-el="${id}"]`);
  const layout = measureElement(id);
  if (!board || !el || !layout) return null;
  const br = board.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (!br.width || !br.height || !er.width || !er.height) return null;
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(el, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (typeof range.getClientRects === "function") for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) rects.push(r);
  }
  const paintSelector = [
    "img", "svg", "canvas", "[data-banner]", "[data-banner-plate]", "[data-banner-layer]", "[data-banner-overlay]", "[data-text-bg]",
    "[data-bullet-body]", "[data-bullet-surface]", "[data-bullet-overlay]",
    "[data-bullet-outline]", "[data-bullet-behind]", "[data-bullet-mark]",
    "[data-option-marker]", "[data-badge-plate]",
  ].join(",");
  for (const item of Array.from(el.querySelectorAll<HTMLElement>(paintSelector))) {
    const r = item.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) rects.push(r);
  }
  // Include only visible backgrounds that actually paint a plate. This catches
  // chips and badge surfaces without treating every full-width row as content.
  for (const item of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
    const cs = getComputedStyle(item);
    const color = cs.backgroundColor.trim().toLowerCase();
    const alphaMatch = color.match(/^rgba?\([^)]*,\s*([\d.]+)\s*\)$/);
    const transparentColor = color === "transparent" || (!!alphaMatch && Number(alphaMatch[1]) === 0);
    if ((transparentColor || !color) && cs.backgroundImage === "none") continue;
    if (Number.parseFloat(cs.opacity || "1") === 0) continue;
    const r = item.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) rects.push(r);
  }
  if (!rects.length) return null;

  // Range and child rects are transformed by CSS rotation. Inverse-rotate the
  // four corners around the measured layout centre to recover the local frame.
  const angle = ((Number.parseFloat(el.dataset.rotation || "0") || 0) * Math.PI) / 180;
  // The layout's own CSS transform is not exposed as a data attribute; infer
  // it from the computed matrix, which is stable under zoom.
  const transform = getComputedStyle(el).transform;
  let theta = angle;
  if (transform && transform !== "none") {
    const match = transform.match(/^matrix\(([^)]+)\)$/);
    if (match) {
      const parts = match[1].split(",").map(Number);
      if (parts.length >= 2) theta = Math.atan2(parts[1], parts[0]);
    }
  }
  const cx = er.left + er.width / 2;
  const cy = er.top + er.height / 2;
  const c = Math.cos(-theta), s = Math.sin(-theta);
  const points: { x: number; y: number }[] = [];
  for (const r of rects) for (const [px, py] of [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]) {
    const x = px - cx, y = py - cy;
    points.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  const left = Math.min(...points.map((p) => p.x));
  const top = Math.min(...points.map((p) => p.y));
  const right = Math.max(...points.map((p) => p.x));
  const bottom = Math.max(...points.map((p) => p.y));
  const out = { x: ((left - br.left) / br.width) * 100, y: ((top - br.top) / br.height) * 100, w: ((right - left) / br.width) * 100, h: ((bottom - top) / br.height) * 100 };
  return out.w > 0 && out.h > 0 ? out : null;
}

/** Tight glyph/plate bounds for a drawn text shape; rotated shapes should fall back to their box. */
export function measureShapeContent(id: string): ContentRect | null {
  if (typeof document === "undefined") return null;
  const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
  const el = Array.from(document.querySelectorAll<HTMLElement>(".slide-editable [data-shape]" )).find((node) => node.dataset.shape === id) ?? null;
  if (!board || !el) return null;
  const br = board.getBoundingClientRect();
  if (!br.width || !br.height) return null;
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(el, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (typeof range.getClientRects === "function") for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) rects.push(r);
  }
  for (const item of Array.from(el.querySelectorAll<HTMLElement>("[data-text-bg], img, svg, canvas"))) {
    const r = item.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) rects.push(r);
  }
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const out = { x: ((left - br.left) / br.width) * 100, y: ((top - br.top) / br.height) * 100, w: ((right - left) / br.width) * 100, h: ((bottom - top) / br.height) * 100 };
  return out.w > 0 && out.h > 0 ? out : null;
}

/** Per-edge mismatch test; percentages are board-relative. */
export function contentMismatch(box: ContentRect, content: ContentRect, tolW = 1, tolH = 0.8): boolean {
  return Math.abs(box.x - content.x) > tolW || Math.abs(box.y - content.y) > tolH || Math.abs(box.w - content.w) > tolW || Math.abs(box.h - content.h) > tolH;
}

export function shouldFit(box: ContentRect, content: ContentRect, tolW = 1, tolH = 0.8): boolean {
  return contentMismatch(box, content, tolW, tolH);
}

/** Geometry patch that promotes a built-in element to free mode around content. */
export function fitBoxPatch(content: ContentRect, padding = { x: 0, y: 0 }): Partial<Box> {
  return { mode: "free", x: r1(content.x - padding.x), y: r1(content.y - padding.y), w: r1(content.w + padding.x * 2), h: r1(content.h + padding.y * 2) };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
export const clampFree = (v: number) => Math.max(FREE_MIN, Math.min(FREE_MAX, v));
export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/** Converts a box between align and free without the element visibly moving. */
export function convertMode(id: ElementId, box: Box, to: "align" | "free"): Box {
  const from = box.mode ?? "align";
  if (from === to) return box;
  const m = measureElement(id);
  if (to === "free") {
    const left = m ? m.left : (box.x * (100 - box.w)) / 100;
    const top = m ? m.top : box.y;
    const h = id === "logo" ? r1(m ? m.h : box.h ?? box.w * (16 / 9)) : box.h;
    return { ...box, mode: "free", x: r1(left), y: r1(top), w: r1(m ? m.w : box.w), h };
  }
  const w = m ? m.w : box.w;
  const h = m ? m.h : (box.h ?? 10);
  const freeX = 100 - w;
  const freeY = 100 - h;
  return { ...box, mode: "align", x: r1(clamp100(freeX > 0.01 ? (box.x / freeX) * 100 : 50)), y: r1(clamp100(freeY > 0.01 ? (box.y / freeY) * 100 : 50)), h: undefined, rot: box.rot };
}
