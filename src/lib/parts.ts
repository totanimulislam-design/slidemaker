import type {
  BackgroundSettings,
  Box,
  DeckHeader,
  ElementId,
  PartLayoutMap,
  SlideData,
  SlideField,
  ThemeSettings,
} from "./types";
import { DEFAULT_FRAME } from "./types";

/**
 * BUILT-IN PARTS — every editable object a slide draws on its own.
 *
 * A "part" is a sub-element of the slide that lives inside one of the eight
 * built-in elements (`ElementId`) or in the slide chrome, but must still be
 * selectable, movable, resizable, groupable and text-editable on its own:
 *
 *   frame            the slide frame ring / frame image
 *   bgGradient       background gradient layer
 *   bgDesign         decorative background artwork (vector design)
 *   bgImage          background photo layer
 *   bgOverlay        background colour tint
 *   bgVignette       background edge darkening
 *   banner           the title banner shape painted behind the title text
 *   questionBullet   the number bullet while it is attached to the question
 *   option:{i}       one whole option row (background + marker + text)
 *   optionBullet:{i} the option's numbering / bullet marker alone
 *   optionText:{i}   the option's text alone
 *
 * Parts are NOT rendered from a separate model: the slide keeps drawing them
 * exactly as before. A part only leaves its parent's layout flow once the user
 * moves or resizes it, which writes a free-mode `Box` into `theme.partLayout`
 * (per-slide through `themeOverride.partLayout`). Until then `partBox()`
 * returns `undefined` and the visual output is byte-for-byte the old one.
 */

export type PartId = string;

/** what a part is — drives the cursor, the inspector tab and hit behaviour */
export type PartKind = "text" | "shape" | "decor" | "row" | "frame";

export type PartTab =
  | "question"
  | "header"
  | "title"
  | "background"
  | "frame"
  | "questionBullet"
  | "optionBullet"
  | "optionText"
  | "shapes";

export interface PartInfo {
  id: PartId;
  label: string;
  icon: string;
  kind: PartKind;
  /** default stacking order on the unified layer stack (see lib/layers.ts) */
  z: number;
  /** text field this part edits — null when it carries no text */
  field: SlideField | null;
  /** inspector tab opened when the part is selected */
  tab: PartTab;
  /** can it be dragged / resized freely? (full-bleed layers cannot) */
  movable: boolean;
  /** built-in element this part belongs to */
  parent?: ElementId;
  /** option index for per-option parts */
  option?: number;
}

/* ------------------------------------------------------------ fixed parts */

export const PART_FRAME = "frame";
export const PART_BANNER = "banner";
export const PART_QBULLET = "questionBullet";
/** the slide's own base background (the board's gradient) — selectable + resizable */
export const PART_BG_BOARD = "bgBoard";
export const PART_BG_GRADIENT = "bgGradient";
export const PART_BG_DESIGN = "bgDesign";
export const PART_BG_IMAGE = "bgImage";
export const PART_BG_OVERLAY = "bgOverlay";
export const PART_BG_VIGNETTE = "bgVignette";

/** every background layer part, bottom → top (matches lib/background.ts order) */
export const BG_PART_IDS: PartId[] = [
  PART_BG_BOARD,
  PART_BG_GRADIENT,
  PART_BG_DESIGN,
  PART_BG_IMAGE,
  PART_BG_OVERLAY,
  PART_BG_VIGNETTE,
];

/* ------------------------------------------------------- per-option parts */

export const optionRowId = (i: number): PartId => `option:${i}`;
export const optionTextId = (i: number): PartId => `optionText:${i}`;
export const optionBulletId = (i: number): PartId => `optionBullet:${i}`;

export const isOptionPart = (id: PartId) =>
  id.startsWith("option:") || id.startsWith("optionText:") || id.startsWith("optionBullet:");

/** option index a part belongs to (null for chrome parts) */
export function partOptionIndex(id: PartId): number | null {
  if (!isOptionPart(id)) return null;
  const n = Number(id.slice(id.lastIndexOf(":") + 1));
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------- metadata --- */

interface StaticDef extends Omit<PartInfo, "id"> {
  label: string;
}

const STATIC: Record<string, StaticDef> = {
  [PART_FRAME]: {
    label: "Frame",
    icon: "▣",
    kind: "frame",
    z: 6,
    field: null,
    tab: "frame",
    movable: false,
  },
  [PART_BG_BOARD]: {
    label: "Slide background",
    icon: "▦",
    kind: "decor",
    z: 0,
    field: null,
    tab: "background",
    // the base board background is a real object: it can be moved and scaled
    // (its box is written into partLayout) without touching the slide itself
    movable: true,
  },
  [PART_BG_GRADIENT]: {
    label: "Background gradient",
    icon: "▧",
    kind: "decor",
    z: 1,
    field: null,
    tab: "background",
    movable: false,
  },
  [PART_BG_DESIGN]: {
    label: "Background artwork",
    icon: "❋",
    kind: "decor",
    z: 2,
    field: null,
    tab: "background",
    // the artwork is sized by designW/designH and centred — it can be moved
    // and scaled, which writes back into the background settings
    movable: true,
  },
  [PART_BG_IMAGE]: {
    label: "Background image",
    icon: "🖼",
    kind: "decor",
    z: 3,
    field: null,
    tab: "background",
    movable: false,
  },
  [PART_BG_OVERLAY]: {
    label: "Background tint",
    icon: "▨",
    kind: "decor",
    z: 4,
    field: null,
    tab: "background",
    movable: false,
  },
  [PART_BG_VIGNETTE]: {
    label: "Background vignette",
    icon: "◐",
    kind: "decor",
    z: 5,
    field: null,
    tab: "background",
    movable: false,
  },
  [PART_BANNER]: {
    label: "Title banner",
    icon: "▬",
    kind: "shape",
    z: 22,
    field: null,
    tab: "title",
    movable: true,
    parent: "title",
  },
  [PART_QBULLET]: {
    label: "Number bullet",
    icon: "❶",
    kind: "shape",
    z: 25,
    field: "question",
    tab: "questionBullet",
    movable: true,
    parent: "question",
  },
};

/** Metadata of ANY part id (per-option ids are generated on the fly). */
export function partInfo(id: PartId): PartInfo {
  const st = STATIC[id];
  if (st) return { id, ...st };
  const opt = partOptionIndex(id);
  if (opt !== null) {
    if (id.startsWith("optionText:"))
      return {
        id,
        label: `Option ${opt + 1} text`,
        icon: "T",
        kind: "text",
        z: 26,
        field: `option:${opt}` as SlideField,
        tab: "optionText",
        movable: true,
        parent: "options",
        option: opt,
      };
    if (id.startsWith("optionBullet:"))
      return {
        id,
        label: `Option ${opt + 1} bullet`,
        icon: "◉",
        kind: "shape",
        z: 26,
        field: `option:${opt}` as SlideField,
        tab: "optionBullet",
        movable: true,
        parent: "options",
        option: opt,
      };
    return {
      id,
      label: `Option ${opt + 1}`,
      icon: "☰",
      kind: "row",
      z: 26,
      field: `option:${opt}` as SlideField,
      tab: "optionText",
      movable: true,
      parent: "options",
      option: opt,
    };
  }
  return { id, label: id, icon: "◇", kind: "shape", z: 26, field: null, tab: "shapes", movable: true };
}

export const partLabel = (id: PartId) => partInfo(id).label;
export const partDefaultZ = (id: PartId) => partInfo(id).z;
export const partIsMovable = (id: PartId) => partInfo(id).movable;
/** true when double-clicking this part should open a text editor */
export const partIsText = (id: PartId) => !!partInfo(id).field;

/* ------------------------------------------------------------- collection */

/**
 * Every part that is actually painted on `slide`, bottom → top. Used by the
 * layers panel, Tab-cycling, marquee selection and the hit-test chain, so a
 * part can never be listed (or selected) when it isn't rendered.
 */
export function collectParts(
  theme: ThemeSettings,
  slide: SlideData | undefined,
  header?: DeckHeader,
  background?: BackgroundSettings,
): PartInfo[] {
  const out: PartInfo[] = [];
  const frame = theme.frame ?? DEFAULT_FRAME;
  const frameOn = theme.showFrame && frame.style !== "none";

  // the board's base background is always painted → always selectable
  out.push(partInfo(PART_BG_BOARD));

  if (background) {
    if (background.gradient?.enabled) out.push(partInfo(PART_BG_GRADIENT));
    if (background.design) out.push(partInfo(PART_BG_DESIGN));
    if (background.src) out.push(partInfo(PART_BG_IMAGE));
    if (background.overlay?.enabled && background.overlay.opacity > 0) out.push(partInfo(PART_BG_OVERLAY));
    if ((background.vignette ?? 0) > 0) out.push(partInfo(PART_BG_VIGNETTE));
  }
  if (frameOn || !!frame.image) out.push(partInfo(PART_FRAME));

  const bannerShape = theme.banner?.shape ?? "glow";
  const showBanner = header ? header.showBanner !== false : true;
  if (showBanner && bannerShape !== "none") out.push(partInfo(PART_BANNER));

  if (theme.showBullet && !theme.bulletSeparate) out.push(partInfo(PART_QBULLET));

  const n = slide?.options.length ?? 0;
  for (let i = 0; i < n; i++) {
    out.push(partInfo(optionRowId(i)));
    out.push(partInfo(optionBulletId(i)));
    out.push(partInfo(optionTextId(i)));
  }
  return out;
}

/* --------------------------------------------------------------- geometry */

/**
 * The layer a part is PAINTED inside while it is still in flow (null = it is
 * already a top-level object). Used by Ungroup: a member that is nested inside
 * another member of the broken group must come out of that nesting (with its
 * live geometry) so it can finally move on its own:
 *
 *   number bullet   → inside the question element
 *   option numbering / option text → inside the option row
 *   option row      → inside the options element
 *   title banner    → inside the title element
 */
export function partContainer(id: PartId): { kind: "element" | "part"; id: string } | null {
  if (id === PART_QBULLET) return { kind: "element", id: "question" };
  if (id === PART_BANNER) return { kind: "element", id: "title" };
  const opt = partOptionIndex(id);
  if (opt === null) return null;
  if (id.startsWith("optionBullet:") || id.startsWith("optionText:")) return { kind: "part", id: optionRowId(opt) };
  if (id.startsWith("option:")) return { kind: "element", id: "options" };
  return null;
}

/** stored override box of a part (undefined = still laid out by the slide) */
export function partBox(theme: ThemeSettings, id: PartId): Box | undefined {
  return theme.partLayout?.[id];
}

/** true once the part has been detached from its parent's layout flow */
export const isDetached = (theme: ThemeSettings, id: PartId) => (partBox(theme, id)?.mode ?? "align") === "free";

/** merges a patch into a part-layout map (pure) */
export function patchPartLayout(map: PartLayoutMap | undefined, id: PartId, patch: Partial<Box>): PartLayoutMap {
  const cur = map?.[id];
  const next: Box = cur ? { ...cur, ...patch } : { x: 0, y: 0, w: 20, align: "left", mode: "free", ...patch };
  return { ...(map ?? {}), [id]: next };
}

/** drops parts that no longer exist on a slide (option removed, frame off…) */
export function prunePartLayout(map: PartLayoutMap | undefined, valid: PartId[]): PartLayoutMap | undefined {
  if (!map) return map;
  const keep = new Set(valid);
  const out: PartLayoutMap = {};
  let changed = false;
  for (const [k, v] of Object.entries(map)) {
    if (keep.has(k)) out[k] = v;
    else changed = true;
  }
  return changed ? out : map;
}

/** the text field a part edits (used to route inline editing + the inspector) */
export const partField = (id: PartId): SlideField | null => partInfo(id).field;
/** inspector tab a part belongs to */
export const partTab = (id: PartId): PartTab => partInfo(id).tab;
