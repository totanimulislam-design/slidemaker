import type { CSSProperties } from "react";
import type { BoxFontId, BoxFonts, BoxTypeface, ElementId, ThemeSettings } from "./types";
import { DEFAULT_THEME } from "./types";
import { FONT_BY_FAMILY, toSingleFamily, universalStack } from "./fonts";
import { effectIsOn, textEffectStyles } from "./textEffects";

/** Which deck font a box uses when it has no override. */
export const BOX_DEFAULT_SCRIPT: Record<BoxFontId, NonNullable<BoxTypeface["script"]>> = {
  logo: "latin",
  brand: "latin",
  brandTop: "latin",
  brandBottom: "latin",
  title: "bangla",
  badge: "latin",
  bullet: "latin",
  question: "bangla",
  options: "bangla",
  optionBullet: "bangla",
  note: "bangla",
};

export const BOX_FONT_IDS: ElementId[] = ["title", "brand", "badge", "question", "options", "note", "bullet"];

/** every text part with a typeface of its own, in board-reading order */
export const TEXT_PART_IDS: BoxFontId[] = [
  "brandTop", "brandBottom", "title", "badge", "bullet", "question", "optionBullet", "options", "note",
];

/** what each text part is called in the panels and the toolbar */
export const TEXT_PART_LABELS: Record<BoxFontId, string> = {
  logo: "Logo",
  brand: "Badge block",
  brandTop: "Badge 1",
  brandBottom: "Badge 2",
  title: "Title text",
  badge: "Badge 3",
  bullet: "Question bullet text",
  question: "Question text",
  options: "Option text",
  optionBullet: "Option bullet text",
  note: "Footnote",
};

/** the board element a text part is painted inside */
export const TEXT_PART_ELEMENT: Record<BoxFontId, ElementId> = {
  logo: "logo",
  brand: "brand",
  brandTop: "brand",
  brandBottom: "brand",
  title: "title",
  badge: "badge",
  bullet: "bullet",
  question: "question",
  options: "options",
  optionBullet: "options",
  note: "note",
};

export function boxTypeface(theme: ThemeSettings, id: BoxFontId): BoxTypeface {
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
export function boxStack(theme: ThemeSettings, id: BoxFontId): string {
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
export function deckStack(theme: ThemeSettings, id: BoxFontId): string {
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

/* ------------------------------------------------------------------ *
 * Typeface → CSS
 * ------------------------------------------------------------------ */

/**
 * The CSS of one typeface on top of a renderer's base styles. Pure: the same
 * numbers paint the board, the thumbnails and the export. `fontFamily` is the
 * resolved stack (see boxStack), so callers that merge several typefaces
 * (the brand lines) can hand in the right one.
 *
 * The text's own offset (`offsetX` / `offsetY`) is deliberately NOT emitted
 * here — it is a transform, and a transform on a positioned element box would
 * move the box. Renderers put `offsetCss()` on the text node instead.
 */
export function typefaceCss(tf: BoxTypeface, extras: CSSProperties = {}, fontFamily?: string): CSSProperties {
  const out: CSSProperties = { ...extras };
  if (fontFamily) out.fontFamily = fontFamily;
  if (tf.color) { out.color = tf.color; out.WebkitTextFillColor = tf.color; }
  if (tf.underline !== undefined || tf.strikethrough !== undefined) {
    out.textDecoration = [tf.underline && "underline", tf.strikethrough && "line-through"].filter(Boolean).join(" ") || "none";
  }
  if (tf.weight) out.fontWeight = tf.weight;
  if (tf.italic !== undefined) out.fontStyle = tf.italic ? "italic" : "normal";
  if (tf.textTransform) {
    out.textTransform = tf.textTransform;
  } else if (tf.uppercase === true) {
    out.textTransform = "uppercase";
  } else if (tf.uppercase === "lowercase" || (tf.uppercase as any) === "lowercase") {
    out.textTransform = "lowercase";
  } else if (tf.uppercase === false || tf.uppercase === "normal") {
    out.textTransform = "none";
  }
  if (tf.align) out.textAlign = tf.align;
  if (tf.letterSpacing !== undefined) out.letterSpacing = tf.letterSpacing;
  if (tf.lineHeight !== undefined) out.lineHeight = tf.lineHeight;
  if (tf.opacity !== undefined) out.opacity = tf.opacity > 1 ? tf.opacity / 100 : tf.opacity;

  if (tf.fontSize !== undefined) {
    out.fontSize = tf.fontSize;
  } else if (tf.scale && tf.scale !== 1 && typeof extras.fontSize === "number") {
    out.fontSize = extras.fontSize * tf.scale;
  }

  if (tf.textShadow) {
    out.textShadow = "0 2px 6px rgba(0,0,0,0.6)";
  }
  if (tf.textGlow) {
    out.filter = `drop-shadow(0 0 ${tf.textGlow}px rgba(255,255,255,0.8))`;
  }
  if (tf.textStroke?.enabled) {
    out.WebkitTextStroke = `${tf.textStroke.width}px ${tf.textStroke.color}`;
  }

  // the Canva-style effect paints last: it owns the shadow / stroke channels
  if (effectIsOn(tf.effect)) {
    const ink = typeof out.color === "string" ? out.color : undefined;
    Object.assign(out, textEffectStyles(tf.effect, ink).css);
  }

  return out;
}

/** the CSS an inline wrapper around the glyphs needs (the background plate), if any */
export function typefaceInlineCss(tf: BoxTypeface): CSSProperties | undefined {
  if (!effectIsOn(tf.effect)) return undefined;
  return textEffectStyles(tf.effect, tf.color).inline;
}

/** the text's nudge inside its box — a transform for the TEXT NODE only */
export function offsetCss(tf: BoxTypeface, base?: string): CSSProperties | undefined {
  const x = tf.offsetX ?? 0;
  const y = tf.offsetY ?? 0;
  if (!x && !y) return base ? { transform: base } : undefined;
  return { transform: [base, `translate(${x}px, ${y}px)`].filter(Boolean).join(" ") };
}

export const hasOffset = (tf: BoxTypeface): boolean => !!(tf.offsetX || tf.offsetY);

export function boxFontCss(theme: ThemeSettings, id: BoxFontId, extras: CSSProperties = {}): CSSProperties {
  return typefaceCss(boxTypeface(theme, id), extras, boxStack(theme, id));
}

/** the inline-wrapper CSS of a box's effect (background plate), if any */
export function boxInlineCss(theme: ThemeSettings, id: BoxFontId): CSSProperties | undefined {
  return typefaceInlineCss(boxTypeface(theme, id));
}

/* ------------------------------------------------------------------ *
 * Parts painted inside a merged element
 * ------------------------------------------------------------------ */

/**
 * Badge 1 / Badge 2 — the two lines of the brand block. Each line's own
 * typeface sits on top of the block-wide one (`boxFonts.brand`, kept for the
 * decks that styled both lines at once), so an old deck renders unchanged and
 * a new per-line pick wins where it is set.
 */
export function brandLineTypeface(theme: ThemeSettings, line: "top" | "bottom"): BoxTypeface {
  return { ...boxTypeface(theme, "brand"), ...boxTypeface(theme, line === "top" ? "brandTop" : "brandBottom") };
}

/** the font-family stack of one brand line */
export function brandLineStack(theme: ThemeSettings, line: "top" | "bottom"): string {
  const tf = brandLineTypeface(theme, line);
  if (tf.family) return universalStack(`'${tf.family}'`, theme.arabicFont);
  return scriptStack(theme, tf.script ?? BOX_DEFAULT_SCRIPT.brand);
}

/**
 * The letter inside every option marker. The flat theme fields the marker
 * always had (`optionBulletFontFamily`, `optionBulletTextWeight`,
 * `optionBulletTextSize`, `optionBulletUppercase`) are folded in underneath
 * the letter's own typeface (`boxFonts.optionBullet`), so both the old panel
 * fields and the new per-part controls paint the same letter. The ink is NOT
 * folded in: the marker's palette (answer highlight, custom ink / fill rules)
 * decides it, and only an explicit `boxFonts.optionBullet.color` overrides.
 */
export function optionBulletTypeface(theme: ThemeSettings): BoxTypeface {
  const own = boxTypeface(theme, "optionBullet");
  const legacy: BoxTypeface = {};
  if (theme.optionBulletFontFamily) legacy.family = theme.optionBulletFontFamily;
  if (theme.optionBulletTextWeight) legacy.weight = theme.optionBulletTextWeight;
  if (theme.optionBulletUppercase) legacy.uppercase = true;
  const pct = theme.optionBulletTextSize ?? 100;
  if (pct !== 100) legacy.scale = pct / 100;
  return { ...legacy, ...own };
}

/**
 * The typeface a text part is painted with — every layer resolved, so a panel
 * or toolbar reads exactly what the board draws.
 */
export function textPartTypeface(theme: ThemeSettings, id: BoxFontId): BoxTypeface {
  if (id === "brandTop" || id === "brandBottom") return brandLineTypeface(theme, id === "brandTop" ? "top" : "bottom");
  if (id === "optionBullet") return optionBulletTypeface(theme);
  return boxTypeface(theme, id);
}

/**
 * ONE write path for a text part's typeface, whichever surface asks.
 *
 * Every field goes to the single place the renderer reads it from, so the
 * panel and the toolbar can never shadow each other:
 *   · colour → the element's ink field (see setElementInk)
 *   · the option-marker letter's family / weight / size % / case → the flat
 *     `optionBullet*` theme fields the marker always had
 *   · everything else → `boxFonts[id]`
 */
export function patchTextPart(theme: ThemeSettings, id: BoxFontId, patch: Partial<BoxTypeface>): Partial<ThemeSettings> {
  const { color, ...rest } = patch;
  let out: Partial<ThemeSettings> = {};
  let fonts = theme.boxFonts;
  if ("color" in patch) {
    if (color) {
      out = { ...out, ...setElementInk(theme, id, color) };
      if (out.boxFonts) fonts = out.boxFonts;
    } else {
      // back to auto: an optional field (a brand line, the marker letter) is
      // cleared so it follows its shared colour again; a required deck colour
      // (title, question…) returns to the deck default
      const field = ELEMENT_INK_FIELD[id];
      if (field) {
        const fallback = DEFAULT_THEME[field];
        out = { ...out, [field]: typeof fallback === "string" && fallback ? fallback : "" } as Partial<ThemeSettings>;
      }
      fonts = setBoxFont(fonts, id, { color: undefined });
    }
  }
  if (id === "optionBullet") {
    const own: Partial<BoxTypeface> = { ...rest };
    if ("family" in own) {
      out.optionBulletFontFamily = own.family || "";
      delete own.family;
    }
    if ("weight" in own) {
      out.optionBulletTextWeight = own.weight || 0;
      delete own.weight;
    }
    if ("scale" in own) {
      out.optionBulletTextSize = Math.max(0, Math.round((own.scale ?? 1) * 100));
      delete own.scale;
    }
    if ("textTransform" in own || "uppercase" in own) {
      // UPPERCASE lives in the flat field; only "lowercase" needs the typeface
      const mode =
        own.textTransform ?? (own.uppercase === true ? "uppercase" : own.uppercase === "lowercase" ? "lowercase" : "none");
      out.optionBulletUppercase = mode === "uppercase";
      fonts = setBoxFont(fonts, id, { textTransform: mode === "lowercase" ? "lowercase" : undefined, uppercase: undefined });
      delete own.textTransform;
      delete own.uppercase;
    }
    if (Object.keys(own).length) fonts = setBoxFont(fonts, id, own);
  } else if (Object.keys(rest).length) {
    fonts = setBoxFont(fonts, id, rest);
  }
  if (fonts !== theme.boxFonts) out.boxFonts = fonts;
  return out;
}

/** true when a part carries any override of its own (for the reset buttons) */
export function textPartHasOverride(theme: ThemeSettings, id: BoxFontId): boolean {
  const own = theme.boxFonts?.[id];
  if (own && Object.keys(own).length) return true;
  if (id === "optionBullet") {
    return !!(theme.optionBulletFontFamily || theme.optionBulletTextWeight || theme.optionBulletUppercase || (theme.optionBulletTextSize ?? 100) !== 100);
  }
  return false;
}

/** the theme patch that clears every override of a part */
export function resetTextPart(theme: ThemeSettings, id: BoxFontId): Partial<ThemeSettings> {
  const out: Partial<ThemeSettings> = { boxFonts: clearBoxFont(theme.boxFonts, id) };
  if (id === "optionBullet") {
    out.optionBulletFontFamily = "";
    out.optionBulletTextWeight = 0;
    out.optionBulletUppercase = false;
    out.optionBulletTextSize = 100;
  }
  return out;
}

export function setBoxFont(fonts: BoxFonts | undefined, id: BoxFontId, patch: Partial<BoxTypeface>): BoxFonts {
  const prev = fonts?.[id] ?? {};
  const next: BoxTypeface = { ...prev, ...patch };
  if (next.family === "") delete next.family;
  // "no override" must be the ABSENCE of the key, not an explicit undefined:
  // a stored `color: undefined` still shadows the deck field once it is merged
  // into a per-slide override (see lib/overrides).
  for (const k of Object.keys(next) as (keyof BoxTypeface)[]) {
    if (next[k] === undefined) delete next[k];
  }
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
export const ELEMENT_INK_FIELD: Partial<Record<BoxFontId, keyof ThemeSettings>> = {
  title: "titleColor",
  badge: "badgeColor",
  brand: "brandColor",
  question: "questionColor",
  options: "optionTextColor",
  note: "noteColor",
  brandTop: "brandTopColor",
  brandBottom: "brandBottomColor",
  optionBullet: "optionBulletInk",
};

/**
 * Boxes whose text is rendered through `boxFontCss`, where a per-box
 * `color` override really does paint over the deck field. Option text is
 * deliberately absent: it is painted with its own explicit inline colour
 * (`optionTextColor`), so a box override there paints nothing.
 */
const INK_FROM_BOX_CSS = new Set<BoxFontId>(["title", "badge", "brand", "question", "note", "bullet", "brandTop", "brandBottom", "optionBullet"]);

/** The colour actually painted on a box's text ("" when it has none of its own). */
export function elementInk(theme: ThemeSettings, id: BoxFontId): string {
  const tf = boxTypeface(theme, id);
  if (INK_FROM_BOX_CSS.has(id) && tf.color) return tf.color;
  const field = ELEMENT_INK_FIELD[id];
  const own = field ? String(theme[field] ?? "") : "";
  // the brand lines fall back to the shared brand colour
  if (!own && (id === "brandTop" || id === "brandBottom")) return elementInk(theme, "brand");
  return own;
}

/**
 * The theme patch that paints `color` on a box's text, whichever surface asked
 * for it. A box with a deck field of its own writes that field and drops any
 * stale per-box override, so the pick can never be shadowed; a box without one
 * (the question bullet's number) keeps using its typeface override.
 */
export function setElementInk(theme: ThemeSettings, id: BoxFontId, color: string): Partial<ThemeSettings> {
  const field = ELEMENT_INK_FIELD[id];
  if (!field) return { boxFonts: setBoxFont(theme.boxFonts, id, { color }) };
  const patch = { [field]: color } as Partial<ThemeSettings>;
  if (boxTypeface(theme, id).color) patch.boxFonts = setBoxFont(theme.boxFonts, id, { color: undefined });
  return patch;
}

export function clearBoxFont(fonts: BoxFonts | undefined, id: BoxFontId): BoxFonts {
  const next = { ...(fonts ?? {}) };
  delete next[id];
  return next;
}

export function boxFontLabel(theme: ThemeSettings, id: BoxFontId): string {
  const tf =
    id === "brandTop" || id === "brandBottom"
      ? brandLineTypeface(theme, id === "brandTop" ? "top" : "bottom")
      : id === "optionBullet"
        ? optionBulletTypeface(theme)
        : boxTypeface(theme, id);
  if (tf.family) return tf.family;
  const script = tf.script ?? BOX_DEFAULT_SCRIPT[id];
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
