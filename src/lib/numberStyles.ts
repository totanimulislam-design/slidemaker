import type { CSSProperties } from "react";
import type { ThemeSettings } from "./types";
import { shade, withAlpha } from "./color";

/**
 * Numbering styles for the question bullet.
 *
 * A style is a pure function of (theme, size, number) → styles + content, so it
 * renders identically on the canvas, in thumbnails and in PNG/PDF exports.
 * Everything derives from `theme.accent`, so recolouring the deck restyles all.
 */

export type NumberStyle =
  | "circle" | "ring" | "glow" | "gradient" | "square" | "rounded"
  | "diamond" | "hexagon" | "kite" | "star" | "burst" | "shield"
  | "ribbon" | "banner" | "pill" | "bracket" | "underline" | "bar"
  | "slash" | "none";

export interface NumberRender {
  style: CSSProperties;
  /** text drawn inside (already resolved against showNumber) */
  content: string;
  /** font size as a factor of the bullet size */
  fontScale: number;
  color: string;
  /** how much wider than tall the box is */
  aspect: number;
}

export interface NumberStyleDef {
  id: NumberStyle;
  label: string;
}

export const NUMBER_STYLES: NumberStyleDef[] = [
  { id: "circle", label: "Circle" },
  { id: "ring", label: "Ring" },
  { id: "glow", label: "Glow" },
  { id: "gradient", label: "Gradient" },
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" },
  { id: "kite", label: "Kite" },
  { id: "star", label: "Star" },
  { id: "burst", label: "Burst" },
  { id: "shield", label: "Shield" },
  { id: "ribbon", label: "Ribbon" },
  { id: "banner", label: "Banner" },
  { id: "pill", label: "Pill" },
  { id: "bracket", label: "Bracket" },
  { id: "underline", label: "Underline" },
  { id: "bar", label: "Bar" },
  { id: "slash", label: "Slashed" },
  { id: "none", label: "None" },
];

export const DEFAULT_NUMBER_STYLE: NumberStyle = "circle";

const CLIP: Partial<Record<NumberStyle, string>> = {
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  kite: "polygon(50% 0%, 100% 38%, 50% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  burst: "polygon(50% 0%,59% 12%,73% 6%,76% 20%,91% 20%,88% 34%,100% 42%,91% 54%,98% 68%,84% 72%,84% 88%,70% 84%,62% 97%,50% 87%,38% 97%,30% 84%,16% 88%,16% 72%,2% 68%,9% 54%,0% 42%,12% 34%,9% 20%,24% 20%,27% 6%,41% 12%)",
  shield: "polygon(50% 0%, 100% 12%, 100% 62%, 50% 100%, 0% 62%, 0% 12%)",
  ribbon: "polygon(0% 0%, 100% 0%, 92% 50%, 100% 100%, 0% 100%, 8% 50%)",
  banner: "polygon(0% 0%, 100% 0%, 100% 100%, 55% 100%, 50% 82%, 45% 100%, 0% 100%)",
};

/** styles whose box is wider than it is tall */
const WIDE: NumberStyle[] = ["pill", "banner", "ribbon", "slash", "underline"];
export const isWideNumberStyle = (id: NumberStyle) => WIDE.includes(id);

/** designs that show no number */
const BLANK: NumberStyle[] = ["underline", "bar", "none"];
export const showsNumber = (id: NumberStyle) => !BLANK.includes(id);

export function renderNumberStyle(
  id: NumberStyle,
  theme: ThemeSettings,
  size: number,
  rawNumber: string,
): NumberRender {
  const accent = theme.accent;
  const text = theme.showNumber && showsNumber(id) ? rawNumber : "";
  const base: CSSProperties = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    lineHeight: 1,
    boxSizing: "border-box",
    flex: "0 0 auto",
  };

  switch (id) {
    case "none":
      return { style: { ...base, display: "none" }, content: "", fontScale: 0, color: accent, aspect: 1 };

    case "circle":
      return {
        style: {
          ...base, borderRadius: "50%",
          background: `radial-gradient(circle at 32% 28%, ${shade(accent, 0.45)}, ${accent} 70%)`,
          border: `${Math.max(2, size * 0.07)}px solid #ffffff`,
          boxShadow: `0 0 0 2px ${withAlpha("#000000", 0.55)}, 0 4px 12px ${withAlpha(accent, 0.5)}`,
        },
        content: text, fontScale: 0.44, color: "#ffffff", aspect: 1,
      };

    case "ring":
      return {
        style: {
          ...base, borderRadius: "50%",
          border: `${Math.max(3, size * 0.1)}px solid ${accent}`,
          background: withAlpha(accent, 0.14),
          boxShadow: `0 0 14px ${withAlpha(accent, 0.4)}`,
        },
        content: text, fontScale: 0.42, color: accent, aspect: 1,
      };

    case "glow":
      return {
        style: {
          ...base, borderRadius: "50%",
          background: `radial-gradient(circle at 30% 25%, ${withAlpha(accent, 0.5)}, ${withAlpha(accent, 0.1)} 72%)`,
          boxShadow: `0 0 ${size * 0.45}px ${withAlpha(accent, 0.6)}`,
        },
        content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
      };

    case "gradient":
      return {
        style: {
          ...base, borderRadius: "50%",
          background: `linear-gradient(145deg, ${shade(accent, 0.42)}, ${accent} 55%, ${shade(accent, -0.25)})`,
          boxShadow: `0 5px 14px ${withAlpha(accent, 0.5)}`,
        },
        content: text, fontScale: 0.44, color: "#ffffff", aspect: 1,
      };

    case "square":
      return {
        style: { ...base, background: accent, boxShadow: `0 3px 10px ${withAlpha(accent, 0.5)}` },
        content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
      };

    case "rounded":
      return {
        style: {
          ...base, borderRadius: size * 0.3,
          background: `linear-gradient(140deg, ${shade(accent, 0.3)}, ${accent})`,
          boxShadow: `0 4px 12px ${withAlpha(accent, 0.5)}`,
        },
        content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
      };

    case "diamond":
    case "hexagon":
    case "kite":
    case "star":
    case "burst":
    case "shield":
    case "ribbon":
    case "banner":
      return {
        style: {
          ...base,
          clipPath: CLIP[id],
          background: `linear-gradient(150deg, ${shade(accent, 0.32)}, ${accent})`,
          paddingLeft: id === "star" || id === "burst" ? size * 0.1 : 0,
          paddingBottom: id === "banner" ? size * 0.16 : 0,
          justifyContent: id === "ribbon" ? "center" : undefined,
        },
        content: text,
        fontScale: id === "star" || id === "burst" ? 0.32 : id === "kite" ? 0.36 : id === "shield" ? 0.4 : 0.4,
        color: "#ffffff",
        aspect: id === "ribbon" ? 1.3 : id === "banner" ? 1.25 : 1,
      };

    case "pill":
      return {
        style: {
          ...base, borderRadius: 999,
          background: `linear-gradient(135deg, ${shade(accent, 0.28)}, ${accent})`,
          boxShadow: `0 4px 14px ${withAlpha(accent, 0.45)}`,
          gap: size * 0.08,
        },
        content: text, fontScale: 0.4, color: "#ffffff", aspect: 1.6,
      };

    case "bracket":
      return {
        style: {
          ...base, width: size * 0.75,
          borderLeft: `${Math.max(3, size * 0.1)}px solid ${accent}`,
          borderBottom: `${Math.max(3, size * 0.1)}px solid ${accent}`,
          borderRadius: `0 0 0 ${size * 0.3}px`,
          justifyContent: "flex-end",
          paddingRight: size * 0.1,
        },
        content: text, fontScale: 0.42, color: accent, aspect: 1,
      };

    case "underline":
      return {
        style: {
          ...base, height: Math.max(5, size * 0.14),
          borderRadius: 999,
          background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.2)})`,
        },
        content: "", fontScale: 0, color: accent, aspect: 1,
      };

    case "bar":
      return {
        style: {
          ...base, width: Math.max(6, size * 0.18), height: size * 1.05,
          borderRadius: 999,
          background: `linear-gradient(180deg, ${shade(accent, 0.32)}, ${accent})`,
          boxShadow: `0 3px 10px ${withAlpha(accent, 0.45)}`,
        },
        content: "", fontScale: 0, color: accent, aspect: 0.2,
      };

    case "slash":
      return {
        style: {
          ...base, width: size * 1.15,
          gap: size * 0.12,
          justifyContent: "flex-start",
        },
        content: text, fontScale: 0.46, color: accent, aspect: 1.15,
      };

    default:
      return renderNumberStyle("circle", theme, size, rawNumber);
  }
}
