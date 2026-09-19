import type { CSSProperties } from "react";
import type { ShapeItem } from "./shapes";
import type { Gradient } from "./types";
import { gradientCss } from "./banner";
import { withAlpha } from "./color";
import { effectIsOn, textEffectStyles } from "./textEffects";

/* ----------------------------------------------------------- helpers */

export const shapeFill = (s: ShapeItem): string => {
  if (s.gradient?.enabled) return gradientCss(s.gradient, s.fill || "#000");
  return s.fill ? withAlpha(s.fill, s.fillOpacity) : "none";
};

export const hasGradientFill = (s: ShapeItem) => !!s.gradient?.enabled && s.gradient.stops.length >= 2;

/** SVG stroke-dasharray for the chosen line style */
export function dashArray(s: ShapeItem): string | undefined {
  const w = Math.max(1, s.strokeWidth);
  const style = s.lineStyle ?? (s.dash ? "dashed" : "solid");
  if (style === "dashed") return `${w * 3} ${w * 2}`;
  if (style === "dotted") return `${w * 0.1} ${w * 2}`;
  return undefined;
}

/** CSS border style string */
export function cssBorder(s: ShapeItem): string | undefined {
  if (!s.stroke || s.strokeWidth <= 0) return undefined;
  const style = s.lineStyle ?? (s.dash ? "dashed" : "solid");
  return `${s.strokeWidth}px ${style} ${s.stroke}`;
}

/** filter: drop-shadow + glow — works for SVG shapes, text and images alike */
export function effectFilter(s: ShapeItem): string | undefined {
  const parts: string[] = [];
  const sh = s.shadow2;
  if (sh?.enabled) parts.push(`drop-shadow(${sh.x}px ${sh.y}px ${sh.blur}px ${withAlpha(sh.color, sh.opacity)})`);
  const g = s.glow;
  if (g?.enabled && g.size > 0) {
    // two stacked shadows give a fuller glow than one
    parts.push(`drop-shadow(0 0 ${g.size}px ${withAlpha(g.color, g.opacity)})`);
    parts.push(`drop-shadow(0 0 ${Math.round(g.size * 0.4)}px ${withAlpha(g.color, g.opacity * 0.8)})`);
  }
  return parts.length ? parts.join(" ") : undefined;
}

/** wrapper-level styles applied to the whole item */
export function itemStyle(s: ShapeItem): CSSProperties {
  return {
    opacity: s.itemOpacity ?? 1,
    mixBlendMode: s.blend && s.blend !== "normal" ? s.blend : undefined,
    filter: effectFilter(s),
  };
}

/** text styles derived from the design fields */
export function textStyle(s: ShapeItem): CSSProperties {
  const transform = s.textTransform ?? (s.uppercase ? "uppercase" : s.lowercase ? "lowercase" : undefined);
  const glowShadow = s.textGlow ? `drop-shadow(0 0 ${s.textGlow}px rgba(255,255,255,.8))` : undefined;
  const shadow = s.textShadow === false ? undefined : "0 2px 6px rgba(0,0,0,.55)";
  const opacity = s.textOpacity !== undefined ? (s.textOpacity > 1 ? s.textOpacity / 100 : s.textOpacity) : undefined;

  const base: CSSProperties = {
    fontFamily: s.fontFamily ? `'${s.fontFamily}', sans-serif` : undefined,
    textDecoration: [s.underline && "underline", s.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
    letterSpacing: s.letterSpacing !== undefined ? `${s.letterSpacing}px` : undefined,
    lineHeight: s.lineHeight ?? 1.4,
    textTransform: transform,
    opacity,
    textShadow: glowShadow ? undefined : shadow,
    filter: glowShadow,
    WebkitTextStroke:
      s.textStroke?.enabled && s.textStroke.width > 0 ? `${s.textStroke.width}px ${s.textStroke.color}` : undefined,
  };
  const tg = s.textGradient;
  const out: CSSProperties =
    tg?.enabled && tg.stops.length >= 2
      ? {
          ...base,
          backgroundImage: gradientCss(tg, s.textColor),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextFillColor: "transparent",
          textShadow: undefined,
          filter: glowShadow || (s.textShadow === false ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,.55))"),
        }
      : { ...base, color: s.textColor };
  // the Canva-style effect paints last: it owns the shadow / stroke channels
  if (effectIsOn(s.textEffect)) Object.assign(out, textEffectStyles(s.textEffect, s.textColor).css);
  // the text's nudge inside its box
  if (s.textOffsetX || s.textOffsetY) out.transform = `translate(${s.textOffsetX ?? 0}px, ${s.textOffsetY ?? 0}px)`;
  return out;
}

/** the inline-wrapper CSS of a text box's effect (the background plate), if any */
export function textInlineStyle(s: ShapeItem): CSSProperties | undefined {
  if (!effectIsOn(s.textEffect)) return undefined;
  return textEffectStyles(s.textEffect, s.textColor).inline;
}

/* ----------------------------------------------------------- presets */

export interface StylePreset {
  name: string;
  swatch: string;
  /** applied on top of the item; geometry & text content untouched */
  style: Partial<ShapeItem>;
}

const grad = (angle: number, ...colors: string[]): Gradient => ({
  enabled: true,
  type: "linear",
  angle,
  stops: colors.map((c, i) => ({ color: c, at: Math.round((i / (colors.length - 1)) * 100) })),
});
const off: Gradient = { enabled: false, type: "linear", angle: 90, stops: [{ color: "#ffffff", at: 0 }, { color: "#000000", at: 100 }] };

export const SHAPE_STYLE_PRESETS: StylePreset[] = [
  {
    name: "Flat",
    swatch: "#2f4fff",
    style: { gradient: off, fillOpacity: 1, stroke: "", strokeWidth: 0, shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 }, itemOpacity: 1, blend: "normal" },
  },
  {
    name: "Outline",
    swatch: "linear-gradient(#0000,#0000) padding-box, #ffd633",
    style: { fill: "", gradient: off, stroke: "#ffd633", strokeWidth: 3, lineStyle: "solid", shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 } },
  },
  {
    name: "Soft card",
    swatch: "#1e293b",
    style: { fill: "#1e293b", gradient: off, fillOpacity: 0.92, stroke: "#ffffff", strokeWidth: 1, lineStyle: "solid", cornerRadius: 16, shadow2: { enabled: true, color: "#000000", blur: 18, x: 0, y: 8, opacity: 0.5 }, glow: { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 } },
  },
  {
    name: "Glass",
    swatch: "linear-gradient(135deg,rgba(255,255,255,.35),rgba(255,255,255,.08))",
    style: { fill: "#ffffff", gradient: { ...grad(135, "#ffffff", "#ffffff"), stops: [{ color: "#ffffff", at: 0 }, { color: "#dbeafe", at: 100 }] }, fillOpacity: 0.18, itemOpacity: 0.85, stroke: "#ffffff", strokeWidth: 1.5, cornerRadius: 18, shadow2: { enabled: true, color: "#000000", blur: 20, x: 0, y: 10, opacity: 0.35 }, glow: { enabled: false, color: "#ffffff", size: 10, opacity: 0.5 }, blend: "screen" },
  },
  {
    name: "Neon",
    swatch: "#06b6d4",
    style: { fill: "", gradient: off, stroke: "#22d3ee", strokeWidth: 3, lineStyle: "solid", glow: { enabled: true, color: "#22d3ee", size: 20, opacity: 0.9 }, shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 } },
  },
  {
    name: "Gold",
    swatch: "linear-gradient(180deg,#ffe38a,#b8860b)",
    style: { gradient: grad(180, "#fff1b8", "#ffcc33", "#b8860b"), fillOpacity: 1, stroke: "#7a5300", strokeWidth: 1.5, lineStyle: "solid", shadow2: { enabled: true, color: "#000000", blur: 10, x: 0, y: 5, opacity: 0.5 }, glow: { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 } },
  },
  {
    name: "Sunset",
    swatch: "linear-gradient(90deg,#f97316,#ec4899)",
    style: { gradient: grad(90, "#f97316", "#ec4899"), fillOpacity: 1, stroke: "", strokeWidth: 0, shadow2: { enabled: true, color: "#ec4899", blur: 16, x: 0, y: 6, opacity: 0.4 }, glow: { enabled: false, color: "#ec4899", size: 18, opacity: 0.8 } },
  },
  {
    name: "Ocean",
    swatch: "linear-gradient(135deg,#0ea5e9,#1e3a8a)",
    style: { gradient: grad(135, "#38bdf8", "#1e3a8a"), fillOpacity: 1, stroke: "", strokeWidth: 0, shadow2: { enabled: true, color: "#000000", blur: 14, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#38bdf8", size: 18, opacity: 0.8 } },
  },
  {
    name: "Emerald",
    swatch: "linear-gradient(160deg,#34d399,#065f46)",
    style: { gradient: grad(160, "#6ee7b7", "#065f46"), fillOpacity: 1, stroke: "", strokeWidth: 0, shadow2: { enabled: true, color: "#000000", blur: 14, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#34d399", size: 18, opacity: 0.8 } },
  },
  {
    name: "Highlighter",
    swatch: "#ffd633",
    style: { fill: "#ffd633", gradient: off, fillOpacity: 0.35, stroke: "", strokeWidth: 0, blend: "screen", cornerRadius: 6, shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 } },
  },
  {
    name: "Dashed note",
    swatch: "repeating-linear-gradient(90deg,#fff 0 6px,#0000 6px 12px)",
    style: { fill: "#000000", gradient: off, fillOpacity: 0.35, stroke: "#ffffff", strokeWidth: 2, lineStyle: "dashed", cornerRadius: 10, shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: false, color: "#ffffff", size: 18, opacity: 0.8 } },
  },
  {
    name: "Chalk",
    swatch: "#f8fafc",
    style: { fill: "", gradient: off, stroke: "#f8fafc", strokeWidth: 2.5, lineStyle: "dotted", shadow2: { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 }, glow: { enabled: true, color: "#ffffff", size: 4, opacity: 0.35 } },
  },
];

/** text-only presets (for text boxes and labels) */
export const TEXT_STYLE_PRESETS: StylePreset[] = [
  { name: "Plain", swatch: "#ffffff", style: { textColor: "#ffffff", textGradient: off, bold: true, italic: false, textStroke: { enabled: false, color: "#000", width: 1 }, textShadow: true, uppercase: false, letterSpacing: 0 } },
  { name: "Headline", swatch: "#ffd633", style: { textColor: "#ffd633", textGradient: off, bold: true, uppercase: true, letterSpacing: 2, textShadow: true, fontFamily: "Anton" } },
  { name: "Gold text", swatch: "linear-gradient(180deg,#fff2a8,#ffb800)", style: { textGradient: grad(180, "#fff2a8", "#ffb800"), bold: true, textShadow: true } },
  { name: "Outlined", swatch: "#0000", style: { textColor: "#ffffff", textGradient: off, textStroke: { enabled: true, color: "#000000", width: 1.5 }, bold: true } },
  { name: "Neon text", swatch: "#22d3ee", style: { textColor: "#22d3ee", textGradient: off, glow: { enabled: true, color: "#22d3ee", size: 14, opacity: 0.9 }, bold: true } },
  { name: "Subtle", swatch: "#94a3b8", style: { textColor: "#cbd5e1", textGradient: off, bold: false, italic: true, textShadow: false, letterSpacing: 0, fontFamily: "Merriweather" } },
];

export const DEFAULT_SHADOW = { enabled: false, color: "#000000", blur: 12, x: 0, y: 6, opacity: 0.45 };
export const DEFAULT_GLOW = { enabled: false, color: "#ffd633", size: 18, opacity: 0.8 };
export const DEFAULT_TEXT_STROKE = { enabled: false, color: "#000000", width: 1 };
