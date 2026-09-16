import type { ShapeItem } from "./shapes";
import { cssBorder, hasGradientFill } from "./shapeDesign";

/**
 * Selection helpers shared by the canvas (ShapeLayer / Slide) and the deck
 * store (useDeck): group membership, multi-selection bounds, the transforms a
 * group gesture applies to every member, and hit-testing used to dig through
 * overlapping layers.
 *
 * A "group" is only a tag — `ShapeItem.groupId`. Members keep their own
 * x/y/w/h/rot/style/content, so ungrouping is inherently lossless and exports
 * need no special casing (they simply draw each member).
 */

let gn = 0;
export const groupUid = () => `grp${Date.now().toString(36)}${(gn++).toString(36)}`;

/** ids of every shape sharing the clicked shape's group (or just itself). */
export function groupMembersOf(shapes: ShapeItem[], id: string): string[] {
  const s = shapes.find((x) => x.id === id);
  if (!s?.groupId) return [id];
  return shapes.filter((o) => o.groupId === s.groupId).map((o) => o.id);
}

/** true when `ids` is exactly one whole group. */
export function isWholeGroup(shapes: ShapeItem[], ids: string[]): boolean {
  if (ids.length < 2) return false;
  const set = new Set(ids);
  const items = shapes.filter((x) => set.has(x.id));
  const gid = items[0]?.groupId;
  if (!gid) return false;
  if (!items.every((x) => x.groupId === gid)) return false;
  return shapes.filter((x) => x.groupId === gid).length === items.length;
}

/** true when any selected shape belongs to a group (so Ungroup makes sense). */
export function anyGrouped(shapes: ShapeItem[], ids: string[]): boolean {
  const set = new Set(ids);
  return shapes.some((x) => set.has(x.id) && x.groupId);
}

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounding box (in % of the board) over a set of boxes. */
export function selectionBounds(items: BoxRect[]): BoxRect {
  if (!items.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...items.map((s) => s.x));
  const y = Math.min(...items.map((s) => s.y));
  const x2 = Math.max(...items.map((s) => s.x + s.w));
  const y2 = Math.max(...items.map((s) => s.y + s.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Whether a shape captures pointer events over its whole box ("solid"), or
 * only over its painted pixels. Anything that paints the box (images, filled
 * shapes, text boxes with a background) keeps the classic behaviour; outline-
 * only shapes and transparent containers let clicks fall through to the
 * layers below so they never block selection.
 */
export function fillsBox(s: ShapeItem): boolean {
  if (s.kind === "image" || s.kind === "line" || s.kind === "arrow") return true;
  if (hasGradientFill(s)) return true;
  if (s.fill && (s.fillOpacity ?? 1) > 0.06) return true;
  // a text box with a CSS border paints its whole frame → still a solid box
  if (s.kind === "text") return !!cssBorder(s);
  return false;
}

/** Do two boxes (in board %) overlap? Used by the drag-marquee selection. */
export function boxesOverlap(a: BoxRect, b: BoxRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ------------------------------------------------ group-set transforms */

export interface MemberGeo {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Scale every member from `from` bounds to `to` bounds (anchored AABB scale). */
export function scaleMembers(
  members: { id: string; geo: MemberGeo }[],
  from: BoxRect,
  to: BoxRect,
): { id: string; patch: Partial<ShapeItem> }[] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
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
 * Rotate every member around the selection centre by `delta` degrees:
 * member centres orbit the pivot, each member also spins by the same angle.
 * Maths run in board pixels so the 16:9 board doesn't skew the angle.
 */
export function rotateMembers(
  members: { id: string; geo: MemberGeo }[],
  pivot: { x: number; y: number },
  delta: number,
  board: { left: number; top: number; width: number; height: number },
): { id: string; patch: Partial<ShapeItem> }[] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
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

/** Translate every member by the same delta (in % of the board). */
export function moveMembers(
  members: { id: string; geo: MemberGeo }[],
  dx: number,
  dy: number,
): { id: string; patch: Partial<ShapeItem> }[] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return members.map(({ id, geo }) => ({
    id,
    patch: { x: r1(geo.x + dx), y: r1(geo.y + dy) },
  }));
}

/* ------------------------------------------------------ layer hit-testing */

export interface BoardHit {
  kind: "shape" | "element";
  id: string;
}

/**
 * All selectable layers under a viewport point, front → back. Built from the
 * real paint order (elementsFromPoint), so it also reaches elements covered by
 * another one — Alt+click walks this list to pick the intended layer.
 * Locked / transparent shapes are skipped automatically because they render
 * with `pointer-events: none`.
 */
export function boardLayerChain(clientX: number, clientY: number): BoardHit[] {
  if (typeof document === "undefined") return [];
  const out: BoardHit[] = [];
  const seen = new Set<string>();
  let els: Element[] = [];
  try {
    els = document.elementsFromPoint(clientX, clientY);
  } catch {
    return out;
  }
  for (const el of els) {
    const hitEl = el.closest?.("[data-shape],[data-el]");
    if (!hitEl) continue;
    const shapeId = hitEl.getAttribute("data-shape");
    const elId = hitEl.getAttribute("data-el");
    const ref: BoardHit = shapeId !== null ? { kind: "shape", id: shapeId } : { kind: "element", id: elId! };
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
