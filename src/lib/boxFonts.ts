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

/** CSS font-family stack for a box, honouring its override then the deck defaults. */
export function boxStack(theme: ThemeSettings, id: ElementId): string {
  const tf = boxTypeface(theme, id);
  const script = tf.script ?? BOX_DEFAULT_SCRIPT[id] ?? "bangla";
  const family = tf.family;
  const primary =
    family
      ? `'${family}'`
      : script === "latin"
        ? theme.latinFont
        : script === "arabic"
          ? theme.arabicFont
          : theme.bengaliFont;
  return universalStack(primary, theme.arabicFont);
}

export function boxFontCss(theme: ThemeSettings, id: ElementId, extras: CSSProperties = {}): CSSProperties {
  const tf = boxTypeface(theme, id);
  const out: CSSProperties = { ...extras, fontFamily: boxStack(theme, id) };
  if (tf.weight) out.fontWeight = tf.weight;
  if (tf.italic) out.fontStyle = "italic";
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
  return { ...(fonts ?? {}), [id]: next };
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
