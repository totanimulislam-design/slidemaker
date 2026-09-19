import type { CSSProperties } from "react";
import type { TextEffect, TextEffectKind } from "./types";
import { shade } from "./color";

export type { TextEffect, TextEffectKind } from "./types";

/**
 * Canva-style text effects.
 *
 * One effect at a time, each with the same handful of settings Canva exposes
 * for it. Everything is expressed in `em` so an effect scales with the text
 * it decorates — the same numbers look right on a 20px footnote and a 90px
 * title — and it is plain CSS, so the board, the thumbnails and the PNG/PDF
 * export all paint it identically.
 *
 *   shadow      an offset, blurred copy in the effect colour
 *   lift        a soft shadow straight below, as if the text floats
 *   hollow      only the outline of the glyphs, in the text colour
 *   splice      hollow glyphs with a solid offset copy behind them
 *   outline     a stroke around the filled glyphs
 *   echo        two fading copies trailing off in one direction
 *   glitch      the two RGB-split copies of a broken screen
 *   neon        a lighter tube of text with a glow of its own colour
 *   background  a rounded plate hugging every line
 */
/** every setting an effect can expose (the deprecated `transparency` is not one) */
export type TextEffectField = Exclude<keyof Omit<TextEffect, "kind">, "transparency">;

export interface TextEffectDef {
  id: TextEffectKind;
  label: string;
  /** which settings the effect uses, in panel order */
  fields: TextEffectField[];
  hint: string;
}

export const TEXT_EFFECTS: TextEffectDef[] = [
  { id: "none", label: "None", fields: [], hint: "Plain text" },
  { id: "shadow", label: "Shadow", fields: ["offset", "direction", "blur", "opacity", "color"], hint: "An offset, blurred copy behind the text" },
  { id: "lift", label: "Lift", fields: ["intensity"], hint: "A soft shadow straight below — the text floats" },
  { id: "hollow", label: "Hollow", fields: ["thickness"], hint: "Only the outline of the glyphs" },
  { id: "splice", label: "Splice", fields: ["thickness", "offset", "direction", "color"], hint: "Hollow glyphs with a solid copy behind them" },
  { id: "outline", label: "Outline", fields: ["thickness", "color"], hint: "A stroke around the filled glyphs" },
  { id: "echo", label: "Echo", fields: ["offset", "direction", "color"], hint: "Two fading copies trailing off" },
  { id: "glitch", label: "Glitch", fields: ["offset", "direction", "color"], hint: "The RGB split of a broken screen" },
  { id: "neon", label: "Neon", fields: ["intensity"], hint: "A glowing tube in the text's own colour" },
  { id: "background", label: "Background", fields: ["roundness", "spread", "opacity", "color"], hint: "A plate hugging every line" },
];

export const TEXT_EFFECT_BY_ID = new Map(TEXT_EFFECTS.map((e) => [e.id, e]));

/** the settings every effect starts from (Canva's own defaults) */
export const EFFECT_DEFAULTS: Record<TextEffectKind, Partial<Omit<TextEffect, "kind">>> = {
  none: {},
  shadow: { offset: 50, direction: 45, blur: 0, opacity: 60, color: "#000000" },
  lift: { intensity: 50 },
  hollow: { thickness: 50 },
  splice: { thickness: 50, offset: 50, direction: 45, color: "#808080" },
  outline: { thickness: 50, color: "#000000" },
  echo: { offset: 50, direction: 45, color: "#808080" },
  glitch: { offset: 50, direction: 0, color: "#00ffff" },
  neon: { intensity: 50 },
  background: { roundness: 50, spread: 50, opacity: 100, color: "#ffd633" },
};

/** label · range · step for every effect setting */
export const EFFECT_FIELD_META: Record<TextEffectField, { label: string; min: number; max: number; step: number }> = {
  offset: { label: "Offset", min: 0, max: 100, step: 1 },
  direction: { label: "Direction °", min: -180, max: 180, step: 1 },
  blur: { label: "Blur", min: 0, max: 100, step: 1 },
  opacity: { label: "Opacity", min: 0, max: 100, step: 1 },
  thickness: { label: "Thickness", min: 1, max: 100, step: 1 },
  intensity: { label: "Intensity", min: 0, max: 100, step: 1 },
  roundness: { label: "Roundness", min: 0, max: 100, step: 1 },
  spread: { label: "Spread", min: 0, max: 100, step: 1 },
  color: { label: "Colour", min: 0, max: 0, step: 0 },
};

/**
 * A full effect: the chosen kind with its defaults underneath whatever was set.
 *
 * Decks written before the flip stored the copy's `transparency` (0 = solid,
 * 100 = gone). That number is read once, here, as its visibility — so an old
 * deck keeps painting exactly the shadow / plate it always did, with the
 * control now reading 100 = fully visible like every other opacity in the app.
 */
export function effectWithDefaults(effect: TextEffect | undefined): TextEffect {
  const kind = effect?.kind ?? "none";
  const full: TextEffect = { ...EFFECT_DEFAULTS[kind], ...(effect ?? {}), kind };
  if (full.opacity === undefined && typeof effect?.transparency === "number") {
    full.opacity = Math.max(0, Math.min(100, 100 - effect.transparency));
  }
  return full;
}

/** switching effects keeps the settings the new one shares with the old one */
export function switchEffect(prev: TextEffect | undefined, kind: TextEffectKind): TextEffect {
  const keep = TEXT_EFFECT_BY_ID.get(kind)?.fields ?? [];
  const next: TextEffect = { ...EFFECT_DEFAULTS[kind], kind };
  for (const f of keep) {
    const v = prev?.[f];
    // colours are per-effect (a shadow is black, a glitch is cyan) — only
    // geometry carries over
    if (v !== undefined && f !== "color") (next as unknown as Record<string, unknown>)[f] = v;
  }
  return next;
}

export const effectIsOn = (effect: TextEffect | undefined): boolean => !!effect && effect.kind !== "none";

/* ----------------------------- colour helpers ------------------------------ */

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** #rgb / #rrggbb / rgb() / rgba() → [r, g, b] (null for anything else, e.g. "currentColor") */
export function parseColor(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const v = value.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return m[1].split("").map((c) => parseInt(c + c, 16)) as [number, number, number];
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;

/** mix two colours: t = 0 → a, t = 1 → b */
export function mixColors(a: string, b: string, t: number): string {
  const pa = parseColor(a) ?? [255, 255, 255];
  const pb = parseColor(b) ?? [255, 255, 255];
  const k = Math.max(0, Math.min(1, t));
  return toHex([pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k, pa[2] + (pb[2] - pa[2]) * k]);
}

/** rotate a colour's hue (degrees) — the glitch's second copy is 120° round the wheel */
export function rotateHue(color: string, degrees: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (((h + degrees) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}

/** an rgba() string for any colour we can parse; the colour itself otherwise */
function alpha(color: string, a: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000})`;
}

/* -------------------------------- the CSS ---------------------------------- */

const round = (n: number) => Math.round(n * 1000) / 1000;

/** the x / y of an offset in `em`: distance 0–100 → up to 0.6em, direction in degrees */
function vector(offset: number, direction: number): [number, number] {
  const len = (Math.max(0, offset) / 100) * 0.6;
  const rad = (direction * Math.PI) / 180;
  return [round(len * Math.cos(rad)), round(len * Math.sin(rad))];
}

export interface TextEffectStyles {
  /** on the text node itself */
  css: CSSProperties;
  /**
   * on an INLINE wrapper around the glyphs — only the background plate needs
   * one, so it hugs each line instead of filling the box
   */
  inline?: CSSProperties;
}

/**
 * The CSS of an effect. `textColor` is the colour the glyphs are painted with
 * (hollow, splice and neon are built from it); anything unparseable falls back
 * to white for the derived tints while the stroke keeps `currentColor`.
 */
export function textEffectStyles(effect: TextEffect | undefined, textColor?: string): TextEffectStyles {
  if (!effectIsOn(effect)) return { css: {} };
  const e = effectWithDefaults(effect);
  const ink = textColor && parseColor(textColor) ? textColor : undefined;
  const inkOr = ink ?? "currentColor";
  const fx = e.color ?? EFFECT_DEFAULTS[e.kind].color ?? "#000000";
  const thickness = round(0.005 + (Math.max(1, e.thickness ?? 50) / 100) * 0.07);
  const [dx, dy] = vector(e.offset ?? 50, e.direction ?? 45);

  switch (e.kind) {
    case "shadow": {
      const blur = round(((e.blur ?? 0) / 100) * 0.5);
      return { css: { textShadow: `${dx}em ${dy}em ${blur}em ${alpha(fx, (e.opacity ?? 60) / 100)}` } };
    }
    case "lift": {
      const i = (e.intensity ?? 50) / 100;
      return {
        css: {
          textShadow: `0 ${round(0.03 + 0.09 * i)}em ${round(0.06 + 0.3 * i)}em rgba(0, 0, 0, ${round(0.2 + 0.5 * i)})`,
        },
      };
    }
    case "hollow":
      return {
        css: {
          WebkitTextStroke: `${thickness}em ${inkOr}`,
          WebkitTextFillColor: "transparent",
          textShadow: "none",
        },
      };
    case "splice":
      return {
        css: {
          WebkitTextStroke: `${thickness}em ${inkOr}`,
          WebkitTextFillColor: "transparent",
          textShadow: `${dx}em ${dy}em 0 ${fx}`,
        },
      };
    case "outline":
      return {
        css: {
          WebkitTextStroke: `${round(thickness * 1.6)}em ${fx}`,
          // the stroke goes BEHIND the fill where the browser can do so, so a
          // thick outline never eats into the letter shapes
          paintOrder: "stroke fill",
          ...(ink ? { WebkitTextFillColor: ink } : {}),
        },
      };
    case "echo":
      return {
        css: {
          textShadow: `${dx}em ${dy}em 0 ${alpha(fx, 0.55)}, ${round(dx * 2)}em ${round(dy * 2)}em 0 ${alpha(fx, 0.28)}`,
        },
      };
    case "glitch": {
      const second = rotateHue(fx, 120);
      const [gx, gy] = vector(Math.max(8, (e.offset ?? 50) * 0.5), e.direction ?? 0);
      return { css: { textShadow: `${-gx}em ${-gy}em 0 ${fx}, ${gx}em ${gy}em 0 ${second}` } };
    }
    case "neon": {
      const i = (e.intensity ?? 50) / 100;
      const glow = ink ?? "#ffffff";
      const tube = ink ? mixColors(ink, "#ffffff", 0.25 + 0.45 * i) : undefined;
      return {
        css: {
          ...(tube ? { WebkitTextFillColor: tube } : {}),
          textShadow: [
            `0 0 ${round(0.02 + 0.03 * i)}em ${alpha(glow, 0.9)}`,
            `0 0 ${round(0.08 + 0.14 * i)}em ${alpha(glow, 0.75)}`,
            `0 0 ${round(0.2 + 0.4 * i)}em ${alpha(glow, 0.55)}`,
            `0 0 ${round(0.45 + 0.8 * i)}em ${alpha(shade(glow, 0.1), 0.35 * i)}`,
          ].join(", "),
        },
      };
    }
    case "background": {
      const r = (e.roundness ?? 50) / 100;
      const s = (e.spread ?? 50) / 100;
      return {
        css: {},
        inline: {
          background: alpha(fx, (e.opacity ?? 100) / 100),
          borderRadius: `${round(0.05 + r * 0.55)}em`,
          padding: `${round(0.02 + s * 0.16)}em ${round(0.1 + s * 0.3)}em`,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        },
      };
    }
    default:
      return { css: {} };
  }
}

/** just the text-node CSS (most call sites) */
export const textEffectCss = (effect: TextEffect | undefined, textColor?: string): CSSProperties =>
  textEffectStyles(effect, textColor).css;

/** a short readable summary for captions and history rows */
export function describeEffect(effect: TextEffect | undefined): string {
  if (!effectIsOn(effect)) return "None";
  return TEXT_EFFECT_BY_ID.get(effect!.kind)?.label ?? effect!.kind;
}
