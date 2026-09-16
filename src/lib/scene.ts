import type {
  BackgroundSettings,
  Deck,
  DeckHeader,
  ElementId,
  SlideData,
  SlideField,
  ThemeSettings,
} from "./types";
import { DEFAULT_LAYOUT, ELEMENT_LABELS } from "./types";
import type { ShapeItem } from "./shapes";
import { SHAPE_ICONS, SHAPE_LABELS } from "./shapes";
import { cssBorder, hasGradientFill } from "./shapeDesign";
import { DEFAULT_PART_BOX, elementZ, partZ, type LayerRef } from "./layers";
import { BG_PART_IDS, PART_BG_BOARD, PART_BG_DESIGN, PART_FRAME, PART_QBULLET, collectParts, partInfo, type PartId } from "./parts";
import { Z_BASE } from "./zorder";

/**
 * SCENE — the ONE object model of the object interaction system.
 *
 * Everything a slide paints is described here as a `SceneObject`: the built-in
 * elements (logo, brand text, title, badge, number bullet, question, options,
 * footnote), the built-in parts (title banner, question bullet, option rows,
 * option bullets, option texts, the frame and every background layer) and the
 * drawn shapes / text boxes / images.
 *
 * The scene drives:
 *   • hit-testing  — which object a click selects (lib/hitTest.ts)
 *   • selection    — group expansion, whole-group checks, inspector routing
 *   • gestures     — what can be moved / resized / rotated (InteractionLayer)
 *   • grouping     — the group tag each object carries (lossless, see below)
 *
 * A "group" is only a tag (`groupId`) stored with the object's geometry:
 * members keep their own position, size, rotation, text, font, colour and every
 * other property, so grouping and ungrouping are inherently lossless and
 * ungrouped members become individually selectable / editable again.
 */

/* ------------------------------------------------------------ object keys */

/** Stable identity of any object: `"element:title"`, `"part:optionText:2"`, `"shape:s12"`. */
export type ObjKey = string;

export const objKey = (ref: LayerRef): ObjKey => `${ref.kind}:${ref.id}`;

export const parseObjKey = (key: ObjKey): LayerRef | null => {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  if (!id) return null;
  return kind === "element"
    ? { kind: "element", id: id as ElementId }
    : kind === "shape"
      ? { kind: "shape", id }
      : kind === "part"
        ? { kind: "part", id: id as PartId }
        : null;
};

/* --------------------------------------------------------- scene objects */

/** What double-clicking an object does. */
export type EditRoute =
  /** inline text editing of a slide field (title, question, option i …) */
  | { type: "field"; field: SlideField }
  /** inline text editing of a drawn shape's own text */
  | { type: "shape" }
  /** opens the object's edit options (logo, frame, background, bullets, banner) */
  | { type: "options" };

export interface SceneObject {
  ref: LayerRef;
  key: ObjKey;
  label: string;
  icon: string;
  /** stacking order on the unified number line (see lib/layers.ts) */
  z: number;
  /** group tag — objects sharing one move / resize / rotate together */
  groupId?: string;
  /** not painted on this slide (no logo, empty footnote, bullet attached …) */
  hidden: boolean;
  /** a locked drawn shape: visible in the layers panel, not grabbable */
  locked: boolean;
  /** can be dragged / resized freely on the board */
  movable: boolean;
  /** slide chrome that spans everything (frame, static background layers) */
  chrome: "frame" | "bgStatic" | null;
  /** what a double-click does */
  edit: EditRoute;
  /** inspector field routed when the object is selected (null = none) */
  inspectorField: SlideField | null;
  /** thin object (line / arrow) — resized with the two horizontal grips only */
  thin: boolean;
  /** drawn shapes only: the item itself (geometry + text + style) */
  shape?: ShapeItem;
  /** built-in element this part lives inside */
  parent?: ElementId;
}

/** Every built-in element that carries inline-editable text. */
const ELEMENT_TEXT_FIELD: Partial<Record<ElementId, SlideField>> = {
  title: "title",
  brand: "brandTop",
  badge: "badge",
  question: "question",
  note: "note",
  options: "option:0",
};

/** Field routed to the inspector when an element is selected. */
export const ELEMENT_FIELD: Record<ElementId, SlideField> = {
  logo: "logo",
  brand: "brandTop",
  title: "title",
  badge: "badge",
  question: "question",
  options: "option:0",
  note: "note",
  bullet: "question",
};

const ELEMENT_ICONS: Record<ElementId, string> = {
  logo: "◉",
  brand: "Aa",
  title: "T̲",
  badge: "▣",
  bullet: "❶",
  question: "?",
  options: "☰",
  note: "…",
};

export interface SceneInput {
  theme: ThemeSettings;
  slide: SlideData | undefined;
  header: DeckHeader;
  background?: BackgroundSettings;
  globalShapes?: ShapeItem[];
}

/** Is this element actually painted on the slide? */
export function elementShown(id: ElementId, header: DeckHeader, slide: SlideData | undefined): boolean {
  if (id === "logo") return !!(header.showLogo && header.logo);
  if (id === "note") return !!slide?.note?.trim();
  return true;
}

/**
 * Builds the full object list of one slide — bottom → top by z, with hidden
 * objects flagged (never selectable) and every group tag resolved.
 */
export function buildScene(inp: SceneInput): SceneObject[] {
  const { theme, slide, header, background } = inp;
  const out: SceneObject[] = [];

  (Object.keys(ELEMENT_LABELS) as ElementId[]).forEach((id) => {
    const shown = elementShown(id, header, slide);
    const textField = ELEMENT_TEXT_FIELD[id];
    out.push({
      ref: { kind: "element", id },
      key: `element:${id}`,
      label: ELEMENT_LABELS[id],
      icon: ELEMENT_ICONS[id],
      z: elementZ(theme.layout, id),
      groupId: theme.layout[id]?.groupId || undefined,
      hidden: !shown,
      locked: false,
      movable: shown,
      chrome: null,
      edit: id === "logo" ? { type: "options" } : id === "bullet" ? { type: "options" } : textField ? { type: "field", field: textField } : { type: "options" },
      inspectorField: ELEMENT_FIELD[id],
      thin: false,
    });
  });

  collectParts(theme, slide, header, background).forEach((p) => {
    const isFrame = p.id === PART_FRAME;
    const bgStatic = BG_PART_IDS.includes(p.id) && p.id !== PART_BG_BOARD && p.id !== PART_BG_DESIGN;
    const isText = p.kind === "text" && !!p.field;
    out.push({
      ref: { kind: "part", id: p.id },
      key: `part:${p.id}`,
      label: p.label,
      icon: p.icon,
      z: partZ(theme, p.id),
      groupId: theme.partLayout?.[p.id]?.groupId || undefined,
      hidden: false,
      locked: false,
      movable: p.movable && !isFrame,
      chrome: isFrame ? "frame" : bgStatic ? "bgStatic" : null,
      edit: isText ? { type: "field", field: p.field! } : { type: "options" },
      inspectorField: p.field,
      thin: false,
      parent: p.parent,
    });
  });

  const pushShape = (s: ShapeItem) => {
    out.push({
      ref: { kind: "shape", id: s.id },
      key: `shape:${s.id}`,
      label: s.kind === "text" && s.text ? s.text.replace(/\n/g, " ").slice(0, 28) : SHAPE_LABELS[s.kind],
      icon: SHAPE_ICONS[s.kind],
      z: Number.isFinite(s.z) ? s.z : Z_BASE,
      groupId: s.groupId || undefined,
      hidden: false,
      locked: !!s.locked,
      movable: !s.locked,
      chrome: null,
      edit: s.kind === "text" || s.text ? { type: "shape" } : { type: "options" },
      inspectorField: null,
      thin: s.kind === "line" || s.kind === "arrow",
      shape: s,
    });
  };
  (inp.globalShapes ?? []).forEach(pushShape);
  (slide?.shapes ?? []).forEach(pushShape);

  return out.sort((a, b) => a.z - b.z);
}

/* -------------------------------------------------------------- lookups */

export const sceneMap = (scene: SceneObject[]) => new Map(scene.map((o) => [o.key, o]));

export const objByKey = (scene: SceneObject[], key: ObjKey) => scene.find((o) => o.key === key);

/**
 * Whether a drawn shape captures pointer events over its WHOLE box ("solid")
 * or only over its painted pixels. Images, filled shapes and text boxes with a
 * background keep the classic behaviour; outline-only shapes and transparent
 * containers let clicks fall through to the objects below, so no invisible
 * container can ever block selection of an editable object.
 */
export function shapeCapturesBox(s: ShapeItem): boolean {
  if (s.kind === "image" || s.kind === "line" || s.kind === "arrow") return true;
  if (hasGradientFill(s)) return true;
  if (s.fill && (s.fillOpacity ?? 1) > 0.06) return true;
  if (s.kind === "text") return !!cssBorder(s);
  return false;
}

/* --------------------------------------------------------------- groups */

let gn = 0;
export const groupUid = () => `grp${Date.now().toString(36)}${(gn++).toString(36)}`;

/**
 * The groups every deck starts with (seeded by `migrateDefaultGroups`):
 *   • the QUESTION — number bullet + question text move/resize as one unit
 *   • every OPTION — row background + numbering + option text, per index
 *
 * They are plain group tags, so the whole group/ungroup machine works on them
 * with no special casing, and breaking one is lossless. `groupId: ""` means
 * "explicitly ungrouped by the user": the migration never re-adds a group that
 * was deliberately broken.
 */
export const DEFAULT_QUESTION_GROUP = "def:question";
export const defaultOptionGroup = (i: number): ObjKey => `def:opt:${i}`;
export const isDefaultGroup = (gid: string | undefined): boolean =>
  !!gid && (gid === DEFAULT_QUESTION_GROUP || gid.startsWith("def:opt:"));

/** Every member of the group `ref` belongs to (just `ref` when ungrouped). */
export function membersOf(scene: SceneObject[], ref: LayerRef): LayerRef[] {
  const o = scene.find((x) => x.key === objKey(ref));
  if (!o?.groupId) return [ref];
  return scene.filter((x) => x.groupId === o.groupId && !x.hidden).map((x) => x.ref);
}

/** Expands a selection so no group is ever half-selected. */
export function expandSelection(scene: SceneObject[], refs: LayerRef[]): LayerRef[] {
  const out = new Map<ObjKey, LayerRef>();
  refs.forEach((r) => out.set(objKey(r), r));
  refs.forEach((r) => {
    const o = scene.find((x) => x.key === objKey(r));
    if (!o?.groupId) return;
    membersOf(scene, r).forEach((m) => out.set(objKey(m), m));
  });
  return [...out.values()];
}

/** True when `refs` is exactly one whole group. */
export function isWholeGroup(scene: SceneObject[], refs: LayerRef[]): boolean {
  if (refs.length < 2) return false;
  const keys = new Set(refs.map(objKey));
  const gid = scene.find((o) => keys.has(o.key))?.groupId;
  if (!gid) return false;
  if (!refs.every((r) => scene.find((o) => o.key === objKey(r))?.groupId === gid)) return false;
  return scene.filter((o) => o.groupId === gid && !o.hidden).length === refs.length;
}

/** True when any of `refs` carries a group tag (so Ungroup makes sense). */
export function anyGrouped(scene: SceneObject[], refs: LayerRef[]): boolean {
  const keys = new Set(refs.map(objKey));
  return scene.some((o) => keys.has(o.key) && !!o.groupId);
}

/**
 * The member the inspector points at for a selection:
 *   • one WHOLE group → the most "content" member wins, so clicking the
 *     question (default group = number bullet + text) opens the question
 *     editor and clicking an option opens that option's text;
 *   • anything else keeps the priority shape → part → element.
 */
export function primaryOf(scene: SceneObject[], refs: LayerRef[]): LayerRef | null {
  if (!refs.length) return null;
  if (refs.length > 1 && isWholeGroup(scene, refs)) {
    const score = (r: LayerRef): number => {
      if (r.kind === "element") {
        if (r.id === "question" || r.id === "title" || r.id === "badge" || r.id === "note" || r.id === "brand") return 0;
        if (r.id === "logo") return 2;
        return 3;
      }
      if (r.kind === "part") {
        const k = partInfo(r.id).kind;
        if (k === "text") return 1;
        if (k === "shape") return 4;
        if (k === "row") return 5;
        return 6;
      }
      return 4;
    };
    return [...refs].sort((a, b) => score(a) - score(b))[0];
  }
  return refs.find((r) => r.kind === "shape") ?? refs.find((r) => r.kind === "part") ?? refs[0] ?? null;
}

/* --------------------------------------------- deck-level group storage */

/** Anything that can carry a group tag, with the tag it currently carries. */
export interface Groupable {
  kind: LayerRef["kind"];
  id: string;
  groupId?: string;
}

/** Every groupable layer of a whole deck (used by the deck store's writers). */
export function allGroupables(d: Deck): Groupable[] {
  const out: Groupable[] = [];
  (Object.keys(d.theme.layout) as ElementId[]).forEach((id) => {
    out.push({ kind: "element", id, groupId: d.theme.layout[id]?.groupId });
  });
  Object.entries(d.theme.partLayout ?? {}).forEach(([id, b]) => {
    if (b?.groupId) out.push({ kind: "part", id, groupId: b.groupId });
  });
  (d.globalShapes ?? []).forEach((s) => out.push({ kind: "shape", id: s.id, groupId: s.groupId }));
  d.slides.forEach((s) => (s.shapes ?? []).forEach((x) => out.push({ kind: "shape", id: x.id, groupId: x.groupId })));
  return out;
}

/** Every member of the group `g` belongs to (over the deck-wide groupable list). */
export function groupOf(all: Groupable[], g: Groupable): Groupable[] {
  if (!g.groupId) return [g];
  return all.filter((o) => o.groupId === g.groupId);
}

/** True when `refs` is exactly one whole group (deck-wide lookup). */
export function isWholeGroupOf(all: Groupable[], refs: { kind: LayerRef["kind"]; id: string }[]): boolean {
  if (refs.length < 2) return false;
  const gidOf = (r: { kind: LayerRef["kind"]; id: string }): string | undefined =>
    all.find((g) => g.kind === r.kind && g.id === r.id)?.groupId;
  const gid = gidOf(refs[0]);
  if (!gid) return false;
  if (!refs.every((r) => gidOf(r) === gid)) return false;
  return all.filter((x) => x.groupId === gid).length === refs.length;
}

/**
 * Seeds the BUILT-IN default groups every deck starts with:
 *   • Question = number bullet + question text
 *   • Option i = row background + numbering + option text (for every i)
 *
 * A member already carrying a group tag — including the explicit "" marker
 * written by an Ungroup — is left untouched, so this is safe to re-run and can
 * never resurrect a group the user broke. New option indices get their default
 * group automatically.
 */
export function migrateDefaultGroups(d: Deck): Deck {
  const maxOpt = Math.min(8, d.slides.reduce((m, s) => Math.max(m, s.options.length), 0));
  const layout = { ...d.theme.layout };
  const partLayout = { ...(d.theme.partLayout ?? {}) };
  let changed = false;

  const tagElement = (id: ElementId) => {
    const cur = layout[id] ?? DEFAULT_LAYOUT[id];
    if (cur.groupId === undefined) {
      layout[id] = { ...cur, groupId: DEFAULT_QUESTION_GROUP };
      changed = true;
    }
  };
  const tagPart = (id: string, gid: string) => {
    const cur = partLayout[id];
    if (!cur || cur.groupId === undefined) {
      partLayout[id] = { ...(cur ?? DEFAULT_PART_BOX), groupId: gid };
      changed = true;
    }
  };

  tagElement("question");
  tagElement("bullet"); // covers "Separate number bullet" mode
  tagPart(PART_QBULLET, DEFAULT_QUESTION_GROUP);
  for (let i = 0; i < maxOpt; i++) {
    const gid = defaultOptionGroup(i);
    tagPart(`option:${i}`, gid);
    tagPart(`optionBullet:${i}`, gid);
    tagPart(`optionText:${i}`, gid);
  }

  if (!changed) return d;
  return { ...d, theme: { ...d.theme, layout, partLayout } };
}


