import type { LayerRef } from "./layers";
import { parseObjKey, type ObjKey } from "./scene";

/**
 * HIT-TESTING — the pointer half of the object interaction system.
 *
 * Selection never trusts containers: the chain below is built from the browser's
 * real paint order (`document.elementsFromPoint`), so the object that ACTUALLY
 * receives the click is the one that gets selected. Transparent parents,
 * invisible overlays, group wrappers and background layers are simply further
 * down the chain — they can never block an editable object above them, and
 * Alt+click walks the chain to dig to whatever is underneath.
 *
 * Every selectable node on the canvas carries `data-obj="<kind>:<id>"`; locked
 * shapes and non-interactive renders use `pointer-events: none`, which removes
 * them from the chain automatically.
 */

/** All selectable objects under a viewport point, front → back. */
export function hitChain(clientX: number, clientY: number): LayerRef[] {
  if (typeof document === "undefined") return [];
  const out: LayerRef[] = [];
  const seen = new Set<ObjKey>();
  let els: Element[] = [];
  try {
    els = document.elementsFromPoint(clientX, clientY);
  } catch {
    return out;
  }
  for (const el of els) {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const key = node.getAttribute?.("data-obj");
      if (key && !seen.has(key)) {
        seen.add(key);
        const ref = parseObjKey(key);
        if (ref) out.push(ref);
      }
      node = node.parentElement;
    }
  }
  return out;
}

/**
 * Alt+click cycling: given the chain under the cursor and the current
 * selection, returns the next object to select — the topmost one on a fresh
 * click, the one directly BENEATH the current selection when Alt+clicking
 * again, wrapping around at the bottom.
 */
export function nextInChain(chain: LayerRef[], selected: Set<ObjKey>): LayerRef | null {
  if (!chain.length) return null;
  const idx = chain.findIndex((r) => selected.has(`${r.kind}:${r.id}`));
  return idx < 0 ? chain[0] : chain[(idx + 1) % chain.length];
}
