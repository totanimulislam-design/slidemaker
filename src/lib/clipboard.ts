import type { ShapeItem } from "./shapes";

/**
 * The editor's internal shape clipboard.
 *
 * Copy / Cut / Paste work across the canvas like Canva's: what you copy is a
 * snapshot of the drawn items (shapes, text boxes, images), and pasting drops
 * fresh clones — offset a little and always above the current stack — on the
 * open slide. A Cut keeps the originals in place until the first paste, and
 * that paste removes them (so a cut item effectively *moves* once).
 */

export interface ShapeClipboard {
  items: ShapeItem[];
  /** true when these were put on the clipboard via Cut (they move once pasted) */
  cut: boolean;
  /** ids of the originals that the first paste must remove from the deck */
  cutIds: string[];
}

let clip: ShapeClipboard | null = null;

/** Snapshot the given drawn items onto the clipboard (optionally marked as Cut). */
export function setShapeClipboard(items: ShapeItem[], cut = false): void {
  clip = {
    items: items.map((s) => ({ ...s })),
    cut,
    cutIds: cut ? items.map((s) => s.id) : [],
  };
}

export function getShapeClipboard(): ShapeClipboard | null {
  return clip;
}

export function hasShapeClipboard(): boolean {
  return !!clip && clip.items.length > 0;
}

/**
 * After a cut-paste moves the originals, the clipboard degrades to an ordinary
 * copy so repeated pastes keep cloning instead of re-deleting.
 */
export function markCutPast(): void {
  if (clip?.cut) clip = { ...clip, cut: false, cutIds: [] };
}
