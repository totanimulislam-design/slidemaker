import type { CSSProperties } from "react";
import type { ThemeSettings } from "./types";
import { shade, withAlpha } from "./color";

export type OptionBulletShape =
  | "circle"
  | "roundedSquare"
  | "square"
  | "diamond"
  | "hexagon"
  | "octagon"
  | "pentagon"
  | "triangle"
  | "shield"
  | "star"
  | "burst"
  | "heart"
  | "drop"
  | "leaf"
  | "tag"
  | "badge"
  | "ring"
  | "doubleRing"
  | "outlineSquare"
  | "pill"
  | "paren"
  | "bracket"
  | "dot"
  | "plain";

export type OptionBulletTreatment = "auto" | "outlined" | "filled" | "soft" | "glow";

export interface OptionBulletShapeDef {
  id: OptionBulletShape;
  label: string;
  category: "classic" | "polygons" | "symbols" | "minimal";
  description: string;
}

export const OPTION_BULLET_SHAPES: OptionBulletShapeDef[] = [
  // Classic
  { id: "circle", label: "Circle (Default)", category: "classic", description: "Classic rounded circular badge" },
  { id: "ring", label: "Outline Ring", category: "classic", description: "Hollow circular stroke without background" },
  { id: "doubleRing", label: "Double Ring", category: "classic", description: "Two concentric circular rings" },
  { id: "roundedSquare", label: "Rounded Box", category: "classic", description: "Sleek squircle with rounded corners" },
  { id: "square", label: "Sharp Square", category: "classic", description: "Crisp architectural square box" },
  { id: "outlineSquare", label: "Outline Box", category: "classic", description: "Border-only square box" },
  { id: "pill", label: "Pill / Capsule", category: "classic", description: "Elongated smooth stadium pill" },

  // Polygons & Geometry
  { id: "diamond", label: "Diamond", category: "polygons", description: "45-degree diamond rhombus" },
  { id: "hexagon", label: "Hexagon", category: "polygons", description: "Six-sided honeycomb polygon" },
  { id: "octagon", label: "Octagon", category: "polygons", description: "Eight-sided stop-sign polygon" },
  { id: "pentagon", label: "Pentagon", category: "polygons", description: "Five-sided geometric crest" },
  { id: "triangle", label: "Triangle", category: "polygons", description: "Equilateral upward triangle" },
  { id: "shield", label: "Shield / Crest", category: "polygons", description: "Medieval heraldic shield" },
  { id: "tag", label: "Price / Arrow Tag", category: "polygons", description: "Pointed label tag shape" },

  // Symbols & Emblems
  { id: "star", label: "Star", category: "symbols", description: "5-point classic achievement star" },
  { id: "burst", label: "Starburst Seal", category: "symbols", description: "12-point certification rosette seal" },
  { id: "badge", label: "Medal Rosette", category: "symbols", description: "Conic gradient medal badge with rim" },
  { id: "heart", label: "Heart", category: "symbols", description: "Heart symbol silhouette" },
  { id: "drop", label: "Teardrop", category: "symbols", description: "Water droplet with pointed tip" },
  { id: "leaf", label: "Nature Leaf", category: "symbols", description: "Organic pointed botanic leaf" },

  // Minimal / Typography
  { id: "paren", label: "Parentheses (A)", category: "minimal", description: "Clean (A) with parentheses" },
  { id: "bracket", label: "Brackets [A]", category: "minimal", description: "Technical [A] with brackets" },
  { id: "dot", label: "Dotted A.", category: "minimal", description: "Academic A. followed by period" },
  { id: "plain", label: "Plain Text A", category: "minimal", description: "Clean bold letter without container" },
];

const CLIPS: Partial<Record<OptionBulletShape, string>> = {
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  shield: "polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)",
  tag: "polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  burst: "polygon(50% 0%,59% 12%,73% 6%,76% 20%,91% 20%,88% 34%,100% 42%,91% 54%,98% 68%,84% 72%,84% 88%,70% 84%,62% 97%,50% 87%,38% 97%,30% 84%,16% 88%,16% 72%,2% 68%,9% 54%,0% 42%,12% 34%,9% 20%,24% 20%,27% 6%,41% 12%)",
  leaf: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)",
  heart: "path('M50 90 L12 52 C-4 36 4 8 28 8 C38 8 46 14 50 22 C54 14 62 8 72 8 C96 8 104 36 88 52 Z')",
};

export const WIDE_OPTION_SHAPES: OptionBulletShape[] = ["pill", "paren", "bracket", "dot", "tag"];
export const isWideOptionBulletShape = (s: OptionBulletShape) => WIDE_OPTION_SHAPES.includes(s);

export const MINIMAL_OPTION_SHAPES: OptionBulletShape[] = ["paren", "bracket", "dot", "plain"];
export const isMinimalOptionBulletShape = (s: OptionBulletShape) => MINIMAL_OPTION_SHAPES.includes(s);

export function formatOptionKey(key: string, shape: OptionBulletShape): string {
  switch (shape) {
    case "paren":
      return `(${key})`;
    case "bracket":
      return `[${key}]`;
    case "dot":
      return `${key}.`;
    default:
      return key;
  }
}

export interface OptionBulletRender {
  style: CSSProperties;
  innerStyle?: CSSProperties;
  content: string;
}

export function renderOptionBulletMarker(
  shape: OptionBulletShape,
  theme: ThemeSettings,
  color: string,
  size: number,
  highlight: boolean,
  keyText: string,
): OptionBulletRender {
  const accent = theme.accent;
  const treatment = theme.optionBulletTreatment ?? "auto";
  const content = formatOptionKey(keyText, shape);

  // Minimal / Typography shapes (paren, bracket, dot, plain)
  if (isMinimalOptionBulletShape(shape)) {
    return {
      style: {
        width: "auto",
        minWidth: Math.round(size * 0.9),
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        color: highlight ? "#5cff9d" : color,
        fontWeight: 800,
        fontSize: Math.round(size * (shape === "plain" ? 0.8 : 0.68)),
        padding: "0 4px",
      },
      content,
    };
  }

  const isWide = isWideOptionBulletShape(shape);
  const width = isWide ? Math.round(size * 1.35) : size;
  const height = size;

  const base: CSSProperties = {
    width,
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    fontWeight: 700,
    fontSize: Math.round(size * (shape === "star" ? 0.5 : shape === "triangle" ? 0.52 : 0.7)),
    lineHeight: 1,
    paddingBottom: 2,
    boxSizing: "border-box",
    transition: "all 0.15s ease",
  };

  // Base background and border depending on treatment & highlight
  const isFilled =
    highlight ||
    treatment === "filled" ||
    (treatment === "auto" && ["soft", "pill", "glass", "gradient", "panel", "duo"].includes(theme.optionStyle as string));

  const isSoft =
    !highlight &&
    (treatment === "soft" || (treatment === "auto" && ["card", "shadowed", "boxed", "ticket", "neon"].includes(theme.optionStyle as string)));

  const isGlow = !highlight && treatment === "glow";

  let background: string;
  let border: string = "none";
  let colorValue: string;
  let boxShadow: string | undefined = undefined;

  if (highlight) {
    background = `radial-gradient(circle at 32% 28%, ${shade(accent, 0.45)}, ${accent} 70%)`;
    border = `${Math.max(2, size * 0.06)}px solid #ffffff`;
    boxShadow = `0 0 22px ${withAlpha(accent, 0.85)}, 0 0 0 2px ${withAlpha("#000000", 0.5)}`;
    colorValue = "#ffffff";
  } else if (isGlow) {
    background = withAlpha(color, 0.18);
    border = `2px solid ${color}`;
    boxShadow = `0 0 14px ${withAlpha(color, 0.75)}`;
    colorValue = color;
  } else if (isFilled) {
    background = `radial-gradient(circle at 32% 28%, ${shade(color, 0.35)}, ${color} 75%)`;
    border = `${Math.max(2, size * 0.06)}px solid ${withAlpha("#ffffff", 0.7)}`;
    boxShadow = `0 2px 8px ${withAlpha(color, 0.45)}`;
    colorValue = "#ffffff";
  } else if (isSoft) {
    background = withAlpha(color, 0.18);
    border = `1.5px solid ${withAlpha(color, 0.55)}`;
    colorValue = color;
  } else {
    // outlined (default)
    background = withAlpha("#ffffff", 0.04);
    border = `2.5px solid ${color}`;
    colorValue = color;
  }

  const style: CSSProperties = {
    ...base,
    background,
    border,
    color: colorValue,
    boxShadow,
  };

  let innerStyle: CSSProperties | undefined = undefined;

  // Apply shape geometry
  switch (shape) {
    case "circle":
      style.borderRadius = "50%";
      break;

    case "ring":
      style.borderRadius = "50%";
      style.background = "transparent";
      style.border = `${Math.max(2.5, size * 0.08)}px solid ${highlight ? "#ffffff" : color}`;
      if (highlight) style.background = accent;
      break;

    case "doubleRing":
      style.borderRadius = "50%";
      style.border = `2px solid ${highlight ? "#ffffff" : color}`;
      style.boxShadow = `0 0 0 2px ${withAlpha(color, 0.25)}, 0 0 0 ${Math.max(4, size * 0.12)}px ${highlight ? accent : color}`;
      break;

    case "roundedSquare":
      style.borderRadius = Math.round(size * 0.28);
      break;

    case "square":
      style.borderRadius = 0;
      break;

    case "outlineSquare":
      style.borderRadius = 4;
      style.background = highlight ? accent : "transparent";
      style.border = `${Math.max(2.5, size * 0.08)}px solid ${highlight ? "#ffffff" : color}`;
      break;

    case "pill":
      style.borderRadius = 999;
      break;

    case "badge":
      style.borderRadius = "50%";
      style.background = highlight
        ? accent
        : `conic-gradient(from 0deg, ${color}, ${shade(color, 0.4)}, ${color}, ${shade(color, -0.3)}, ${color})`;
      style.boxShadow = `inset 0 0 0 2px rgba(255,255,255,0.85), 0 3px 8px rgba(0,0,0,0.45)`;
      style.color = "#ffffff";
      break;

    case "drop":
      style.borderRadius = "50% 50% 50% 0";
      style.transform = "rotate(-45deg)";
      innerStyle = { transform: "rotate(45deg)", display: "inline-block" };
      break;

    case "diamond":
    case "hexagon":
    case "octagon":
    case "pentagon":
    case "triangle":
    case "shield":
    case "tag":
    case "star":
    case "burst":
    case "leaf":
    case "heart":
      if (CLIPS[shape]) {
        style.clipPath = CLIPS[shape];
        style.borderRadius = 0;
        style.border = "none"; // Clip-path handles the perimeter cleanly
        if (shape === "triangle") style.paddingTop = Math.round(size * 0.25);
        if (shape === "pentagon") style.paddingTop = Math.round(size * 0.1);
        if (shape === "shield" || shape === "leaf") style.paddingBottom = Math.round(size * 0.12);
        if (shape === "tag") style.paddingRight = Math.round(size * 0.18);
        if (shape === "heart") style.paddingBottom = Math.round(size * 0.14);
      }
      break;

    default:
      style.borderRadius = "50%";
      break;
  }

  return { style, innerStyle, content };
}
