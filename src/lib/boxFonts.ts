import type { CSSProperties } from "react";
import type { BoxFonts, BoxTypeface, ElementId, ThemeSettings } from "./types";
import { FONT_BY_FAMILY, toSingleFamily, universalStack } from "./fonts";

/** Which deck font a box uses when it has no override. */
export const BOX_DEFAULT_SCRIPT: Record<ElementId, NonNullable<BoxTypeface["script"]>> = {
  logo: "latin",
  brand: "latin",
  title: "bangla",
  badge: "latin",
  bullet: "latin",
  question: "bangla",
  options: "bangla",
  note: "bangla",
};

export const BOX_FONT_IDS: ElementId[] = ["title", "brand", "badge", "question", "options", "note", "bullet"];

export function boxTypeface(theme: ThemeSettings, id: ElementId): BoxTypeface {
  return theme.boxFonts?.[id] ?? {};
}

/** The deck face a script uses — the fallback every box starts from. */
export function scriptStack(
  theme: ThemeSettings,
  script: NonNullable<BoxTypeface["script"]>,
): string {
  const primary =
    script === "latin" ? theme.latinFont : script === "arabic" ? theme.arabicFont : theme.bengaliFont;
  return universalStack(primary, theme.arabicFont);
}

/** CSS font-family stack for a box, honouring its override then the deck defaults. */
export function boxStack(theme: ThemeSettings, id: ElementId): string {
  const tf = boxTypeface(theme, id);
  if (tf.family) return universalStack(`'${tf.family}'`, theme.arabicFont);
  return scriptStack(theme, tf.script ?? BOX_DEFAULT_SCRIPT[id] ?? "bangla");
}

/**
 * The deck face of a box *ignoring* that box's own typeface override.
 *
 * Parts that belong to a box but are not its text — option markers, plain
 * numbering — resolve their face here, so a per-box font override stays scoped
 * to the text it was picked for and never reaches the numbering.
 */
export function deckStack(theme: ThemeSettings, id: ElementId): string {
  return scriptStack(theme, boxTypeface(theme, id).script ?? BOX_DEFAULT_SCRIPT[id] ?? "bangla");
}

/**
 * The option-text face and nothing else.
 *
 * Strictly scoped: this is applied to the single element that renders an
 * option's text, never to the option container, a parent group or the slide —
 * that is what made the old deck-wide `bengaliFont` assignment repaint the
 * whole board. Question, header, title, note and the option markers each
 * resolve their own face and are unaffected by it.
 */
export function optionTextStack(theme: ThemeSettings): string {
  return boxStack(theme, "options");
}

export function boxFontCss(theme: ThemeSettings, id: ElementId, extras: CSSProperties = {}): CSSProperties {
  const tf = boxTypeface(theme, id);
  const out: CSSProperties = { ...extras, fontFamily: boxStack(theme, id) };
  if (tf.color) { out.color = tf.color; out.WebkitTextFillColor = tf.color; }
  if (tf.underline !== undefined || tf.strikethrough !== undefined) out.textDecoration = [tf.underline && "underline", tf.strikethrough && "line-through"].filter(Boolean).join(" ") || "none";
  if (tf.weight) out.fontWeight = tf.weight;
  if (tf.italic !== undefined) out.fontStyle = tf.italic ? "italic" : "normal";
  if (tf.letterSpacing !== undefined) out.letterSpacing = tf.letterSpacing;
  if (tf.uppercase === true) out.textTransform = "uppercase";
  if (tf.uppercase === false) out.textTransform = "none";
  if (tf.scale && tf.scale !== 1 && typeof extras.fontSize === "number") {
    out.fontSize = extras.fontSize * tf.scale;
  }
  return out;
}

export function setBoxFont(fonts: BoxFonts | undefined, id: ElementId, patch: Partial<BoxTypeface>): BoxFonts {
  const prev = fonts?.[id] ?? {};
  const next: BoxTypeface = { ...prev, ...patch };
  if (next.family === "") delete next.family;
  // "no override" must be the ABSENCE of the key, not an explicit undefined:
  // a stored `color: undefined` still shadows the deck field once it is merged
  // into a per-slide override (see lib/overrides).
  if (next.color === undefined) delete next.color;
  return { ...(fonts ?? {}), [id]: next };
}

/* ------------------------------------------------------------------ *
 * Text ink — ONE source of truth per box
 * ------------------------------------------------------------------ *
 * An element's colour used to be reachable from two different places: the
 * deck field the renderer reads (`questionColor`, `optionTextColor`, …) and
 * the per-box typeface override (`boxFonts[id].color`). Whichever one the
 * renderer consults LAST silently wins, so a colour picked in one panel could
 * do nothing at all — picking "Question colour" in the Question text panel
 * after the toolbar had written a box override left the stem unchanged.
 *
 * These two helpers give every surface the same answer: `elementInk` reads the
 * colour that is actually painted, and `setElementInk` writes the one field
 * that paints it — clearing the override that would otherwise shadow it.
 */

/** the deck field that paints each box's text */
export const ELEMENT_INK_FIELD: Partial<Record<ElementId, keyof ThemeSettings>> = {
  title: "titleColor",
  badge: "badgeColor",
  brand: "brandColor",
  question: "questionColor",
  options: "optionTextColor",
  note: "noteColor",
};

/**
 * Boxes whose text is rendered through `boxFontCss`, where a per-box
 * `color` override really does paint over the deck field. Option text is
 * deliberately absent: it is painted with its own explicit inline colour
 * (`optionTextColor`), so a box override there paints nothing.
 */
const INK_FROM_BOX_CSS = new Set<ElementId>(["title", "badge", "brand", "question", "note", "bullet"]);

/** The colour actually painted on a box's text ("" when it has none of its own). */
export function elementInk(theme: ThemeSettings, id: ElementId): string {
  const tf = boxTypeface(theme, id);
  if (INK_FROM_BOX_CSS.has(id) && tf.color) return tf.color;
  const field = ELEMENT_INK_FIELD[id];
  return field ? String(theme[field] ?? "") : "";
}

/**
 * The theme patch that paints `color` on a box's text, whichever surface asked
 * for it. A box with a deck field of its own writes that field and drops any
 * stale per-box override, so the pick can never be shadowed; a box without one
 * (the question bullet's number) keeps using its typeface override.
 */
export function setElementInk(theme: ThemeSettings, id: ElementId, color: string): Partial<ThemeSettings> {
  const field = ELEMENT_INK_FIELD[id];
  if (!field) return { boxFonts: setBoxFont(theme.boxFonts, id, { color }) };
  const patch = { [field]: color } as Partial<ThemeSettings>;
  if (boxTypeface(theme, id).color) patch.boxFonts = setBoxFont(theme.boxFonts, id, { color: undefined });
  return patch;
}

export function clearBoxFont(fonts: BoxFonts | undefined, id: ElementId): BoxFonts {
  const next = { ...(fonts ?? {}) };
  delete next[id];
  return next;
}

export function boxFontLabel(theme: ThemeSettings, id: ElementId): string {
  const tf = boxTypeface(theme, id);
  if (tf.family) return tf.family;
  const script = BOX_DEFAULT_SCRIPT[id];
  const raw = script === "latin" ? theme.latinFont : script === "arabic" ? theme.arabicFont : theme.bengaliFont;
  return toSingleFamily(raw) || "Default";
}

export const WEIGHTS = [
  { v: 400, l: "Regular" },
  { v: 500, l: "Medium" },
  { v: 600, l: "Semi" },
  { v: 700, l: "Bold" },
  { v: 800, l: "Extra" },
];

export function fontMeta(family?: string) {
  return family ? FONT_BY_FAMILY.get(family.toLowerCase()) : undefined;
}
