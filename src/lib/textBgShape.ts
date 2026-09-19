import type { CSSProperties } from "react";
import type { Gradient, TextBgBorderStyle, TextBgEffectKind, TextBgShape, TextBgShapeKind } from "./types";
import { gradientCss } from "./banner";
import { parseColor } from "./textEffects";

export type { TextBgBorderStyle, TextBgEffectKind, TextBgShape, TextBgShapeKind } from "./types";

/**
 * Background shapes for text — the plate painted behind a title, a question,
 * a badge line, the number inside the bullet, an option's text or a custom
 * text box.
 *
 * Everything in here is pure: the catalogue (silhouettes, effects, presets)
 * and the CSS builders the renderer (`components/TextBgShape.tsx`) turns into
 * DOM. The board, the thumbnails and the PNG / PDF export therefore paint
 * exactly the same plate.
 *
 * A plate is built from four passes, all inside one absolutely positioned
 * layer under the glyphs:
 *
 *   behind   extra silhouettes (a ring, an offset outline, a paper stack)
 *   fill     the plate itself — solid or gradient, cut to the silhouette
 *   overlay  an effect painted INSIDE the silhouette (gloss, stripes, bevel…)
 *   border   the outline: CSS borders on box shapes, an SVG stroke on polygons
 *
 * and the layer as a whole carries the opacity, the position (nudge, skew,
 * rotation) and the filter / mask effects (shadows, glows, fades).
 */

/* ------------------------------------------------------------------ */
/*  Silhouettes                                                        */
/* ------------------------------------------------------------------ */

export type TextBgFamily = "box" | "poly" | "mark";

export interface TextBgKindDef {
  id: TextBgShapeKind;
  label: string;
  family: TextBgFamily;
  /** box / mark family: the corner radii for a radius setting `r` (px) */
  radii?: (r: number) => string;
  /** poly family: the silhouette, in % of the plate (x right, y down) */
  points?: [number, number][];
  /** mark family: where the mark sits inside the plate's layer */
  inset?: CSSProperties;
  /** pointed / slanted shapes need more room at their ends: multipliers of the default padding (x, y) */
  padHint?: [number, number];
}

const px = (n: number) => `${Math.max(0, Math.round(n * 10) / 10)}px`;

export const TEXT_BG_KINDS: TextBgKindDef[] = [
  /* --- box family: CSS corners, every border style + radius apply ------- */
  { id: "rect", label: "Box", family: "box", radii: () => "0px" },
  { id: "rounded", label: "Rounded", family: "box", radii: (r) => px(r) },
  { id: "pill", label: "Pill", family: "box", radii: () => "999px" },
  { id: "ellipse", label: "Ellipse", family: "box", radii: () => "50%", padHint: [1.8, 1.6] },
  { id: "leaf", label: "Leaf", family: "box", radii: (r) => `${px(Math.max(r, 4))} 3px` },
  { id: "leafAlt", label: "Leaf ↘", family: "box", radii: (r) => `3px ${px(Math.max(r, 4))}` },
  { id: "tabTop", label: "Tab ▲", family: "box", radii: (r) => `${px(r)} ${px(r)} 0 0` },
  { id: "tabBottom", label: "Tab ▼", family: "box", radii: (r) => `0 0 ${px(r)} ${px(r)}` },
  { id: "tabLeft", label: "Tab ◀", family: "box", radii: (r) => `${px(r)} 0 0 ${px(r)}` },
  { id: "tabRight", label: "Tab ▶", family: "box", radii: (r) => `0 ${px(r)} ${px(r)} 0` },
  { id: "bubble", label: "Bubble", family: "box", radii: (r) => `${px(r)} ${px(r)} ${px(r)} 2px` },
  { id: "bubbleRight", label: "Bubble ▶", family: "box", radii: (r) => `${px(r)} ${px(r)} 2px ${px(r)}` },
  /* --- poly family: a polygon silhouette, SVG-stroked border ------------ */
  { id: "parallelogram", label: "Slant", family: "poly", points: [[12, 0], [100, 0], [88, 100], [0, 100]], padHint: [1.5, 1] },
  { id: "parallelogramLeft", label: "Slant ◣", family: "poly", points: [[0, 0], [88, 0], [100, 100], [12, 100]], padHint: [1.5, 1] },
  { id: "slantRight", label: "Cut ▶", family: "poly", points: [[0, 0], [100, 0], [92, 100], [0, 100]], padHint: [1.3, 1] },
  { id: "slantLeft", label: "Cut ◀", family: "poly", points: [[8, 0], [100, 0], [100, 100], [0, 100]], padHint: [1.3, 1] },
  { id: "trapezoid", label: "Trapezoid", family: "poly", points: [[8, 0], [92, 0], [100, 100], [0, 100]], padHint: [1.4, 1] },
  { id: "chevron", label: "Chevron", family: "poly", points: [[0, 0], [90, 0], [100, 50], [90, 100], [0, 100], [10, 50]], padHint: [1.8, 1] },
  { id: "arrow", label: "Arrow", family: "poly", points: [[0, 0], [90, 0], [100, 50], [90, 100], [0, 100]], padHint: [1.6, 1] },
  { id: "arrowLeft", label: "Arrow ◀", family: "poly", points: [[10, 0], [100, 0], [100, 100], [10, 100], [0, 50]], padHint: [1.6, 1] },
  { id: "ribbon", label: "Ribbon", family: "poly", points: [[0, 0], [100, 0], [92, 50], [100, 100], [0, 100], [8, 50]], padHint: [1.9, 1] },
  { id: "flag", label: "Flag", family: "poly", points: [[0, 0], [100, 0], [92, 50], [100, 100], [0, 100]], padHint: [1.6, 1] },
  { id: "flagLeft", label: "Flag ◀", family: "poly", points: [[0, 0], [100, 0], [100, 100], [0, 100], [8, 50]], padHint: [1.6, 1] },
  { id: "hexagon", label: "Hexagon", family: "poly", points: [[8, 0], [92, 0], [100, 50], [92, 100], [8, 100], [0, 50]], padHint: [1.8, 1] },
  { id: "octagon", label: "Octagon", family: "poly", points: [[8, 0], [92, 0], [100, 25], [100, 75], [92, 100], [8, 100], [0, 75], [0, 25]], padHint: [1.4, 1.1] },
  { id: "diamond", label: "Diamond", family: "poly", points: [[50, 0], [100, 50], [50, 100], [0, 50]], padHint: [2.4, 2.2] },
  { id: "cutCorners", label: "Cut corners", family: "poly", points: [[12, 0], [100, 0], [100, 72], [88, 100], [0, 100], [0, 28]], padHint: [1.4, 1] },
  /* --- marks --------------------------------------------------------- */
  { id: "highlight", label: "Highlighter", family: "mark", radii: (r) => px(Math.min(r, 6)), inset: { top: "46%" } },
  { id: "underline", label: "Underline", family: "mark", radii: (r) => px(Math.min(r, 4)), inset: { top: "auto", height: "0.16em" } },
  { id: "sideBar", label: "Side bar", family: "mark", radii: (r) => px(Math.min(r, 4)), inset: { right: "auto", width: "0.18em" } },
];

export const TEXT_BG_KIND_BY_ID = new Map(TEXT_BG_KINDS.map((k) => [k.id, k]));

export const bgKindDef = (kind: TextBgShapeKind): TextBgKindDef => TEXT_BG_KIND_BY_ID.get(kind) ?? TEXT_BG_KINDS[1];

/** the corner-radius control only means something on box / mark silhouettes */
export const bgKindHasRadius = (kind: TextBgShapeKind): boolean => bgKindDef(kind).family !== "poly";

/** CSS clip-path of a polygon silhouette */
export const polygonClip = (points: [number, number][]): string => `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;

/** SVG `points` of a polygon silhouette (viewBox 0 0 100 100) */
export const polygonPointsAttr = (points: [number, number][]): string => points.map(([x, y]) => `${x},${y}`).join(" ");

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

/** what the effect's colour falls back to when none is picked */
export type TextBgEffectAuto = "dark" | "light" | "plate";

export interface TextBgEffectDef {
  id: TextBgEffectKind;
  label: string;
  hint: string;
  /** whether the effect has a colour of its own */
  color: boolean;
  auto: TextBgEffectAuto;
}

export const TEXT_BG_EFFECTS: TextBgEffectDef[] = [
  { id: "none", label: "None", hint: "The plain plate", color: false, auto: "dark" },
  { id: "shadow", label: "Shadow", hint: "A soft shadow below the plate", color: true, auto: "dark" },
  { id: "pop", label: "Pop", hint: "A hard offset shadow — comic / sticker look", color: true, auto: "dark" },
  { id: "lift", label: "Lift", hint: "A subtle shadow, the plate floats a little", color: false, auto: "dark" },
  { id: "float", label: "Float", hint: "A large soft shadow far below", color: false, auto: "dark" },
  { id: "longShadow", label: "Long shadow", hint: "A flat stepped shadow (material style)", color: true, auto: "dark" },
  { id: "glow", label: "Glow", hint: "A tight glow around the plate", color: true, auto: "plate" },
  { id: "halo", label: "Halo", hint: "A wide, soft glow", color: true, auto: "plate" },
  { id: "neon", label: "Neon", hint: "A neon tube: bright edge, coloured glow", color: true, auto: "plate" },
  { id: "innerShadow", label: "Inner shadow", hint: "The plate looks pressed in", color: false, auto: "dark" },
  { id: "innerGlow", label: "Inner glow", hint: "A glow inside the plate's edge", color: true, auto: "light" },
  { id: "bevel", label: "Bevel", hint: "Light top-left edge, dark bottom-right edge", color: false, auto: "dark" },
  { id: "emboss", label: "Emboss", hint: "A raised plate with a highlight and a lip", color: false, auto: "dark" },
  { id: "gloss", label: "Gloss", hint: "A glossy highlight over the top half", color: false, auto: "light" },
  { id: "sheen", label: "Sheen", hint: "A diagonal light streak", color: false, auto: "light" },
  { id: "spotlight", label: "Spotlight", hint: "A soft light in the middle", color: false, auto: "light" },
  { id: "stripes", label: "Stripes", hint: "Diagonal stripes over the plate", color: true, auto: "light" },
  { id: "dots", label: "Dots", hint: "A polka-dot pattern", color: true, auto: "light" },
  { id: "grid", label: "Grid", hint: "Graph-paper lines", color: true, auto: "light" },
  { id: "checker", label: "Checker", hint: "A checkerboard pattern", color: true, auto: "light" },
  { id: "glass", label: "Glass", hint: "Frosted glass: blurred backdrop, light rim", color: false, auto: "light" },
  { id: "blur", label: "Blur", hint: "The plate itself blurred into a soft blob", color: false, auto: "dark" },
  { id: "fadeRight", label: "Fade →", hint: "The plate fades out to the right", color: false, auto: "dark" },
  { id: "fadeEdges", label: "Fade edges", hint: "The plate fades out at both ends", color: false, auto: "dark" },
  { id: "ring", label: "Ring", hint: "A thin outline ring outside the plate", color: true, auto: "plate" },
  { id: "offsetOutline", label: "Offset outline", hint: "An outline copy shifted down-right", color: true, auto: "light" },
  { id: "sticker", label: "Sticker", hint: "A thick pale outline all round (die-cut sticker)", color: true, auto: "light" },
  { id: "stack", label: "Stack", hint: "Two paper copies stacked behind", color: true, auto: "plate" },
  { id: "topBar", label: "Top bar", hint: "An accent strip along the top edge", color: true, auto: "light" },
  { id: "bottomBar", label: "Bottom bar", hint: "An accent strip along the bottom edge", color: true, auto: "light" },
  { id: "leftBar", label: "Left bar", hint: "An accent strip along the left edge", color: true, auto: "light" },
  { id: "cornerFold", label: "Corner fold", hint: "A folded top-right corner (sticky note)", color: false, auto: "dark" },
];

export const TEXT_BG_EFFECT_BY_ID = new Map(TEXT_BG_EFFECTS.map((e) => [e.id, e]));

/* ------------------------------------------------------------------ */
/*  Defaults & helpers                                                 */
/* ------------------------------------------------------------------ */

export const DEFAULT_TEXT_BG_SHAPE: TextBgShape = {
  enabled: true,
  kind: "rounded",
  color: "#1f5fd0",
  borderColor: "",
  borderStyle: "solid",
  borderWidth: 0,
  radius: 12,
  opacity: 100,
  effect: "none",
  effectIntensity: 50,
  padX: 18,
  padY: 6,
  offsetX: 0,
  offsetY: 0,
  scope: "block",
  width: "hug",
  skew: 0,
  rotate: 0,
};

/** every field filled in, so old / partial settings paint predictably */
export function bgShapeWithDefaults(v: Partial<TextBgShape> | undefined): TextBgShape {
  return { ...DEFAULT_TEXT_BG_SHAPE, ...(v ?? {}) };
}

/** does this part paint a background shape at all? */
export const bgShapeIsOn = (v: TextBgShape | undefined): boolean => !!v && v.enabled !== false;

/** the new plate a part gets when Background shape is switched on with no history */
export const freshBgShape = (accent = DEFAULT_TEXT_BG_SHAPE.color): TextBgShape => ({ ...DEFAULT_TEXT_BG_SHAPE, color: accent });

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n * 100) / 100;

/** rgba() of any colour we can parse (hex / rgb); the colour itself otherwise */
export function bgAlpha(color: string, a: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${round(clamp(a, 0, 1))})`;
}

/** the plate's dominant colour — the first gradient stop, else the solid fill, else the border */
export function bgPlateColor(s: TextBgShape): string {
  if (s.gradient?.enabled && s.gradient.stops.length) {
    const first = [...s.gradient.stops].sort((a, b) => a.at - b.at)[0];
    if (first?.color) return first.color;
  }
  return s.color || s.borderColor || "#ffffff";
}

/** true when the plate is light enough that dark glyphs read better on it (the preset tiles use it) */
export function bgPlateIsLight(s: TextBgShape): boolean {
  const rgb = parseColor(bgPlateColor(s));
  if (!rgb) return false;
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  // a fill that is mostly see-through takes the board's darkness with it
  return lum > 0.62 && (s.color !== "" || !!s.gradient?.enabled) && s.opacity > 45;
}

/** the colour an effect paints with — its own, else the plate's / a light / a dark tone */
export function bgEffectColor(s: TextBgShape): string {
  if (s.effectColor) return s.effectColor;
  const def = TEXT_BG_EFFECT_BY_ID.get(s.effect);
  switch (def?.auto) {
    case "plate":
      return s.effect === "neon" && s.borderColor ? s.borderColor : bgPlateColor(s);
    case "light":
      return "#ffffff";
    default:
      return "#000000";
  }
}

/** the CSS `background` of the plate ("" when it has no fill) */
export function bgFillCss(s: TextBgShape): string {
  if (s.gradient?.enabled && s.gradient.stops.length >= 2) return gradientCss(s.gradient, s.color || "#000000");
  return s.color || "";
}

/** dash pattern of an SVG stroke for a border style (px, host coordinates) */
export function bgStrokeDash(style: TextBgBorderStyle, width: number): string | undefined {
  const w = Math.max(1, width);
  if (style === "dashed") return `${round(w * 3)} ${round(w * 2)}`;
  if (style === "dotted") return `0.1 ${round(w * 2)}`;
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  The CSS of a plate                                                 */
/* ------------------------------------------------------------------ */

/** a silhouette painted behind the plate by an effect (ring · offset outline · stack) */
export interface TextBgBehindLayer {
  /** where it sits relative to the plate's layer */
  css: CSSProperties;
  /** solid fill; "" = outline only */
  fill: string;
  /** outline colour; "" = none */
  stroke: string;
  strokeWidth: number;
}

export interface TextBgBorderSpec {
  color: string;
  width: number;
  style: TextBgBorderStyle;
}

export interface TextBgRender {
  kind: TextBgKindDef;
  /** the wrapper around the glyphs (padding, display) */
  wrapper: CSSProperties;
  /** the whole plate layer: opacity, transform, filter, mask */
  layer: CSSProperties;
  /** the fill pass — background + silhouette */
  fill: CSSProperties;
  /** the effect overlay painted inside the silhouette, if the effect has one */
  overlay?: CSSProperties;
  /** the border pass — CSS border (box / mark) or an SVG stroke (poly) */
  border?: TextBgBorderSpec;
  behind: TextBgBehindLayer[];
  /** how the fill / overlay are cut to the silhouette */
  clip: { radius?: string; clipPath?: string; inset?: CSSProperties };
}

/** cut an absolutely positioned pass to the silhouette */
function silhouetteCss(kind: TextBgKindDef, radius: number): { radius?: string; clipPath?: string; inset?: CSSProperties } {
  if (kind.family === "poly" && kind.points) return { clipPath: polygonClip(kind.points) };
  return { radius: kind.radii?.(radius) ?? px(radius), inset: kind.inset };
}

/**
 * Everything the renderer needs for one plate. Pure — the same numbers paint
 * the board, the thumbnails and the export.
 */
export function textBgRender(input: TextBgShape | undefined): TextBgRender | null {
  if (!bgShapeIsOn(input)) return null;
  const s = bgShapeWithDefaults(input);
  const kind = bgKindDef(s.kind);
  const clip = silhouetteCss(kind, s.radius);
  const i = clamp(s.effectIntensity, 0, 100) / 100;
  const fx = bgEffectColor(s);
  const plate = bgPlateColor(s);
  const fillCss = bgFillCss(s);

  const wrapper: CSSProperties = {
    position: "relative",
    display: s.width === "fill" ? "block" : "inline-block",
    isolation: "isolate",
    padding: `${px(s.padY)} ${px(s.padX)}`,
    boxSizing: "border-box",
    maxWidth: "100%",
  };

  const transforms: string[] = [];
  if (s.offsetX || s.offsetY) transforms.push(`translate(${round(s.offsetX)}px, ${round(s.offsetY)}px)`);
  if (s.skew) transforms.push(`skewX(${round(clamp(s.skew, -60, 60))}deg)`);
  if (s.rotate) transforms.push(`rotate(${round(clamp(s.rotate, -180, 180))}deg)`);

  const layer: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    opacity: clamp(s.opacity, 0, 100) / 100,
    ...(transforms.length ? { transform: transforms.join(" "), transformOrigin: "center" } : {}),
  };

  const fill: CSSProperties = {
    position: "absolute",
    inset: 0,
    ...(clip.inset ?? {}),
    ...(fillCss ? { background: fillCss } : {}),
    ...(clip.radius ? { borderRadius: clip.radius } : {}),
    ...(clip.clipPath ? { clipPath: clip.clipPath } : {}),
  };

  let overlay: CSSProperties | undefined;
  const behind: TextBgBehindLayer[] = [];
  const filters: string[] = [];
  const setOverlay = (css: CSSProperties) => {
    overlay = {
      position: "absolute",
      inset: 0,
      ...(clip.inset ?? {}),
      ...(clip.radius ? { borderRadius: clip.radius } : {}),
      ...(clip.clipPath ? { clipPath: clip.clipPath } : {}),
      ...css,
    };
  };

  switch (s.effect) {
    case "shadow":
      filters.push(`drop-shadow(0 ${round(2 + 8 * i)}px ${round(4 + 16 * i)}px ${bgAlpha(fx, 0.25 + 0.45 * i)})`);
      break;
    case "pop": {
      const d = round(3 + 9 * i);
      filters.push(`drop-shadow(${d}px ${d}px 0 ${fx})`);
      break;
    }
    case "lift":
      filters.push(`drop-shadow(0 ${round(1 + 3 * i)}px ${round(2 + 6 * i)}px rgba(0, 0, 0, ${round(0.25 + 0.25 * i)}))`);
      break;
    case "float":
      filters.push(`drop-shadow(0 ${round(10 + 20 * i)}px ${round(14 + 26 * i)}px rgba(0, 0, 0, ${round(0.3 + 0.3 * i)}))`);
      break;
    case "longShadow": {
      const steps = 3 + Math.round(9 * i);
      for (let k = 0; k < steps; k++) filters.push(`drop-shadow(2px 2px 0 ${fx})`);
      break;
    }
    case "glow":
      filters.push(`drop-shadow(0 0 ${round(4 + 10 * i)}px ${fx})`, `drop-shadow(0 0 ${round(2 + 4 * i)}px ${fx})`);
      break;
    case "halo":
      filters.push(`drop-shadow(0 0 ${round(14 + 26 * i)}px ${bgAlpha(fx, 0.65)})`, `drop-shadow(0 0 ${round(30 + 40 * i)}px ${bgAlpha(fx, 0.4)})`);
      break;
    case "neon":
      filters.push(
        `drop-shadow(0 0 2px rgba(255, 255, 255, 0.85))`,
        `drop-shadow(0 0 ${round(6 + 10 * i)}px ${fx})`,
        `drop-shadow(0 0 ${round(16 + 24 * i)}px ${bgAlpha(fx, 0.8)})`,
      );
      setOverlay({ boxShadow: `inset 0 0 ${round(8 + 12 * i)}px ${bgAlpha(fx, 0.6)}` });
      break;
    case "innerShadow":
      setOverlay({ boxShadow: `inset 0 ${round(2 + 6 * i)}px ${round(6 + 14 * i)}px rgba(0, 0, 0, ${round(0.3 + 0.4 * i)})` });
      break;
    case "innerGlow":
      setOverlay({ boxShadow: `inset 0 0 ${round(8 + 24 * i)}px ${bgAlpha(fx, 0.5 + 0.4 * i)}` });
      break;
    case "bevel": {
      const d = round(1 + 3 * i);
      const b = round(2 + 4 * i);
      setOverlay({ boxShadow: `inset ${d}px ${d}px ${b}px rgba(255, 255, 255, 0.45), inset -${d}px -${d}px ${b}px rgba(0, 0, 0, 0.45)` });
      break;
    }
    case "emboss": {
      const d = round(2 + 4 * i);
      setOverlay({ boxShadow: `inset 0 ${d}px 0 rgba(255, 255, 255, 0.35), inset 0 -${d}px 0 rgba(0, 0, 0, 0.35)` });
      filters.push(`drop-shadow(0 ${round(1 + 2 * i)}px ${round(2 + 3 * i)}px rgba(0, 0, 0, 0.35))`);
      break;
    }
    case "gloss":
      setOverlay({ background: `linear-gradient(180deg, rgba(255, 255, 255, ${round(0.3 + 0.35 * i)}) 0%, rgba(255, 255, 255, 0.08) 48%, transparent 52%)` });
      break;
    case "sheen":
      setOverlay({
        background: `linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, ${round(0.18 + 0.35 * i)}) 45%, rgba(255, 255, 255, ${round(0.22 + 0.4 * i)}) 50%, transparent 65%)`,
      });
      break;
    case "spotlight":
      setOverlay({ background: `radial-gradient(ellipse at 50% 35%, rgba(255, 255, 255, ${round(0.22 + 0.38 * i)}), transparent 65%)` });
      break;
    case "stripes":
      setOverlay({ background: `repeating-linear-gradient(135deg, ${bgAlpha(fx, 0.16 + 0.28 * i)} 0 6px, transparent 6px 14px)` });
      break;
    case "dots":
      setOverlay({ backgroundImage: `radial-gradient(${bgAlpha(fx, 0.25 + 0.4 * i)} 1.4px, transparent 1.7px)`, backgroundSize: "9px 9px" });
      break;
    case "grid":
      setOverlay({
        backgroundImage: `linear-gradient(${bgAlpha(fx, 0.16 + 0.24 * i)} 1px, transparent 1px), linear-gradient(90deg, ${bgAlpha(fx, 0.16 + 0.24 * i)} 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
      });
      break;
    case "checker":
      setOverlay({ background: `repeating-conic-gradient(${bgAlpha(fx, 0.14 + 0.24 * i)} 0% 25%, transparent 0% 50%) 50% / 14px 14px` });
      break;
    case "glass":
      fill.backdropFilter = `blur(${round(4 + 10 * i)}px)`;
      (fill as Record<string, unknown>).WebkitBackdropFilter = fill.backdropFilter;
      setOverlay({
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06))",
        boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, ${round(0.25 + 0.3 * i)})`,
      });
      break;
    case "blur":
      filters.push(`blur(${round(2 + 10 * i)}px)`);
      break;
    case "fadeRight": {
      const mask = `linear-gradient(90deg, #000 ${round(70 - 55 * i)}%, transparent 100%)`;
      layer.maskImage = mask;
      (layer as Record<string, unknown>).WebkitMaskImage = mask;
      break;
    }
    case "fadeEdges": {
      const a = round(4 + 26 * i);
      const mask = `linear-gradient(90deg, transparent, #000 ${a}%, #000 ${100 - a}%, transparent)`;
      layer.maskImage = mask;
      (layer as Record<string, unknown>).WebkitMaskImage = mask;
      break;
    }
    case "ring": {
      const gap = round(2 + 6 * i);
      behind.push({ css: { position: "absolute", inset: -gap }, fill: "", stroke: fx, strokeWidth: 2 });
      break;
    }
    case "offsetOutline": {
      const d = round(3 + 9 * i);
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d}px, ${d}px)` }, fill: "", stroke: fx, strokeWidth: 2 });
      break;
    }
    case "sticker": {
      const w = round(2 + 4 * i);
      filters.push(
        `drop-shadow(${w}px 0 0 ${fx})`,
        `drop-shadow(-${w}px 0 0 ${fx})`,
        `drop-shadow(0 ${w}px 0 ${fx})`,
        `drop-shadow(0 -${w}px 0 ${fx})`,
      );
      break;
    }
    case "stack": {
      const d = round(3 + 5 * i);
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d * 2}px, ${d * 2}px)`, opacity: 0.3 }, fill: fx || plate, stroke: "", strokeWidth: 0 });
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d}px, ${d}px)`, opacity: 0.55 }, fill: fx || plate, stroke: "", strokeWidth: 0 });
      break;
    }
    case "topBar":
      setOverlay({ borderTop: `${round(3 + 7 * i)}px solid ${fx}` });
      break;
    case "bottomBar":
      setOverlay({ borderBottom: `${round(3 + 7 * i)}px solid ${fx}` });
      break;
    case "leftBar":
      setOverlay({ borderLeft: `${round(3 + 7 * i)}px solid ${fx}` });
      break;
    case "cornerFold": {
      const size = round(10 + 12 * i);
      setOverlay({
        background: `linear-gradient(225deg, rgba(0, 0, 0, 0.5) 0 ${size}px, rgba(255, 255, 255, 0.28) ${size}px ${round(size * 1.45)}px, transparent ${round(size * 1.45)}px)`,
      });
      break;
    }
    default:
      break;
  }
  if (filters.length) layer.filter = filters.join(" ");

  const border: TextBgBorderSpec | undefined =
    s.borderColor && s.borderStyle !== "none" && s.borderWidth > 0
      ? { color: s.borderColor, width: s.borderWidth, style: s.borderStyle }
      : undefined;

  return { kind, wrapper, layer, fill, overlay, border, behind, clip };
}

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */

export type TextBgPresetGroup = "Bangladesh edu" | "Canva classics" | "Bold & broadcast" | "Soft & minimal" | "Marks & stickers";

export interface TextBgPreset {
  id: string;
  label: string;
  group: TextBgPresetGroup;
  hint: string;
  shape: Partial<TextBgShape>;
}

const grad = (angle: number, ...colors: string[]): Gradient => ({
  enabled: true,
  type: "linear",
  angle,
  stops: colors.map((c, i) => ({ color: c, at: Math.round((i / (colors.length - 1)) * 100) })),
});

/**
 * The starting points. The first group borrows the looks of the big
 * Bangladeshi edu platforms' slides and thumbnails — the ACS violet
 * (#a936f5) capsules and white "course" plates, Udvash's steel blue
 * (#3a6186) / maroon (#89253e), 10 Minute School's red (#eb2026), sky
 * (#39b0f9) and green (#0b6b33) — the others the plates every Canva deck
 * reaches for: highlighter, sticky note, glass, gold, neon, ribbons, arrows,
 * lower thirds.
 */
export const TEXT_BG_PRESETS: TextBgPreset[] = [
  /* ------------------------------ Bangladesh edu ---------------------- */
  { id: "acsViolet", label: "ACS violet pill", group: "Bangladesh edu", hint: "ACS Future School's electric-violet capsule", shape: { kind: "pill", gradient: grad(135, "#a936f5", "#6d1fd6"), color: "#a936f5", effect: "glow", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "acsCapsule", label: "ACS white capsule", group: "Bangladesh edu", hint: "The white SSC'27 pill from ACS thumbnails — pair with red text", shape: { kind: "pill", color: "#ffffff", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "acsCourse", label: "ACS course plate", group: "Bangladesh edu", hint: "The slanted white 'MASTER COURSE' plate — pair with navy text", shape: { kind: "rounded", radius: 8, color: "#ffffff", skew: -8, effect: "pop", effectColor: "#0f172a", effectIntensity: 35, padX: 20, padY: 6 } },
  { id: "udvashCard", label: "Udvash steel card", group: "Bangladesh edu", hint: "Udvash's chambray blue with a white rim", shape: { kind: "rounded", radius: 10, color: "#3a6186", borderColor: "#ffffff", borderWidth: 2, effect: "shadow", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "udvashMaroon", label: "Udvash maroon ribbon", group: "Bangladesh edu", hint: "Udvash's burnt-umber ribbon", shape: { kind: "ribbon", color: "#89253e", effect: "lift", effectIntensity: 50, padX: 30, padY: 7 } },
  { id: "tenMsRed", label: "10MS red chevron", group: "Bangladesh edu", hint: "10 Minute School's crimson, cut as a chevron", shape: { kind: "chevron", color: "#eb2026", effect: "pop", effectColor: "#7f0c10", effectIntensity: 30, padX: 30, padY: 7 } },
  { id: "tenMsSky", label: "10MS sky tab", group: "Bangladesh edu", hint: "Dodger-blue tab with a navy bottom bar", shape: { kind: "tabTop", radius: 12, color: "#39b0f9", effect: "bottomBar", effectColor: "#1e3a8a", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "tenMsGreen", label: "10MS green slab", group: "Bangladesh edu", hint: "Deep green slab with a yellow left bar", shape: { kind: "rect", color: "#0b6b33", effect: "leftBar", effectColor: "#ffd633", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "deshGreenRed", label: "Desh green & red", group: "Bangladesh edu", hint: "Bottle green with the flag's red as a left bar", shape: { kind: "rounded", radius: 6, color: "#006a4e", effect: "leftBar", effectColor: "#f42a41", effectIntensity: 60, padX: 22, padY: 8 } },
  { id: "boardNavy", label: "Board exam navy", group: "Bangladesh edu", hint: "Navy card with a gold rim — the classic question plate", shape: { kind: "rounded", radius: 8, color: "#0f2a5f", borderColor: "#ffd633", borderWidth: 2, effect: "innerShadow", effectIntensity: 40, padX: 22, padY: 10 } },
  { id: "chalkboard", label: "Chalkboard", group: "Bangladesh edu", hint: "Blackboard green with a chalk-dashed frame", shape: { kind: "rounded", radius: 4, color: "#1f3b2d", borderColor: "#e2e8f0", borderStyle: "dashed", borderWidth: 2, padX: 20, padY: 10 } },
  { id: "coachingOrange", label: "Coaching orange slant", group: "Bangladesh edu", hint: "Orange slanted plate with a hard shadow", shape: { kind: "parallelogram", color: "#f97316", effect: "pop", effectColor: "#7c2d12", effectIntensity: 35, padX: 28, padY: 7 } },
  { id: "optionPill", label: "Option pill", group: "Bangladesh edu", hint: "Translucent white pill with a fine rim — for option rows", shape: { kind: "pill", color: "#ffffff", opacity: 30, gradient: undefined, borderColor: "#ffffff", borderWidth: 1.5, effect: "glass", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "answerGreen", label: "Answer green", group: "Bangladesh edu", hint: "Glowing green capsule for the correct answer", shape: { kind: "pill", color: "#16a34a", effect: "glow", effectIntensity: 50, padX: 22, padY: 6 } },
  /* ------------------------------ Canva classics ---------------------- */
  { id: "highlighter", label: "Highlighter", group: "Canva classics", hint: "A yellow marker stroke under the words", shape: { kind: "highlight", color: "#ffd633", radius: 3, opacity: 85, padX: 6, padY: 2 } },
  { id: "stickyNote", label: "Sticky note", group: "Canva classics", hint: "A pale yellow note with a folded corner", shape: { kind: "rect", color: "#fde68a", effect: "cornerFold", effectIntensity: 50, rotate: -2, padX: 18, padY: 10 } },
  { id: "glassCard", label: "Glass card", group: "Canva classics", hint: "Frosted glass over the slide", shape: { kind: "rounded", radius: 14, color: "#ffffff", opacity: 35, borderColor: "#ffffff", borderWidth: 1, effect: "glass", effectIntensity: 60, padX: 22, padY: 10 } },
  { id: "neonFrame", label: "Neon frame", group: "Canva classics", hint: "No fill, a glowing cyan tube", shape: { kind: "rounded", radius: 10, color: "", borderColor: "#22d3ee", borderWidth: 2, effect: "neon", effectIntensity: 55, padX: 22, padY: 8 } },
  { id: "goldPlate", label: "Gold plate", group: "Canva classics", hint: "Bevelled gold", shape: { kind: "rounded", radius: 8, gradient: grad(180, "#fff1b8", "#ffcc33", "#b8860b"), color: "#ffcc33", borderColor: "#7a5300", borderWidth: 1, effect: "bevel", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "sunsetPill", label: "Sunset pill", group: "Canva classics", hint: "Orange-to-pink capsule", shape: { kind: "pill", gradient: grad(90, "#f97316", "#ec4899"), color: "#f97316", effect: "shadow", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "oceanCard", label: "Ocean card", group: "Canva classics", hint: "Sky-to-navy gradient card", shape: { kind: "rounded", radius: 12, gradient: grad(135, "#38bdf8", "#1e3a8a"), color: "#38bdf8", effect: "lift", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "darkGold", label: "Dark & gold", group: "Canva classics", hint: "Midnight card with a double gold rim", shape: { kind: "rounded", radius: 10, color: "#0b1220", borderColor: "#d4af37", borderStyle: "double", borderWidth: 4, effect: "shadow", effectIntensity: 40, padX: 22, padY: 10 } },
  { id: "dashedOutline", label: "Dashed outline", group: "Canva classics", hint: "No fill, a dashed white frame", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#ffffff", borderStyle: "dashed", borderWidth: 2, padX: 20, padY: 8 } },
  { id: "speechBubble", label: "Speech bubble", group: "Canva classics", hint: "White bubble with a sharp corner", shape: { kind: "bubble", radius: 14, color: "#ffffff", effect: "shadow", effectIntensity: 40, padX: 20, padY: 8 } },
  { id: "blueprint", label: "Blueprint", group: "Canva classics", hint: "Graph-paper lines on deep blue", shape: { kind: "rounded", radius: 4, color: "#1e3a8a", borderColor: "#93c5fd", borderWidth: 1, effect: "grid", effectColor: "#93c5fd", effectIntensity: 50, padX: 20, padY: 8 } },
  { id: "spotlightCard", label: "Spotlight card", group: "Canva classics", hint: "Slate card lit from the middle", shape: { kind: "rounded", radius: 12, color: "#0f172a", borderColor: "#334155", borderWidth: 1, effect: "spotlight", effectIntensity: 55, padX: 22, padY: 10 } },
  /* ------------------------------ Bold & broadcast --------------------- */
  { id: "popArt", label: "Pop art", group: "Bold & broadcast", hint: "White plate, black frame, hard black shadow", shape: { kind: "rect", color: "#ffffff", borderColor: "#000000", borderWidth: 3, effect: "pop", effectColor: "#000000", effectIntensity: 50, padX: 18, padY: 8 } },
  { id: "materialFlat", label: "Material flat", group: "Bold & broadcast", hint: "Flat blue with a long stepped shadow", shape: { kind: "rect", color: "#3b82f6", effect: "longShadow", effectColor: "#1e3a8a", effectIntensity: 60, padX: 20, padY: 8 } },
  { id: "redRibbon", label: "Red ribbon", group: "Bold & broadcast", hint: "Swallow-tailed red ribbon", shape: { kind: "ribbon", color: "#dc2626", effect: "shadow", effectIntensity: 45, padX: 32, padY: 7 } },
  { id: "arrowBanner", label: "Arrow banner", group: "Bold & broadcast", hint: "Blue banner pointing right", shape: { kind: "arrow", color: "#2563eb", effect: "lift", effectIntensity: 50, padX: 26, padY: 7 } },
  { id: "lowerThird", label: "Lower third", group: "Bold & broadcast", hint: "TV-style red plate cut on the right, fine stripes", shape: { kind: "slantRight", color: "#dc2626", effect: "stripes", effectColor: "#ffffff", effectIntensity: 25, padX: 24, padY: 7 } },
  { id: "hexTech", label: "Hex tech", group: "Bold & broadcast", hint: "Teal hexagon with a cyan glow", shape: { kind: "hexagon", color: "#0e7490", borderColor: "#67e8f9", borderWidth: 2, effect: "glow", effectIntensity: 45, padX: 30, padY: 8 } },
  { id: "diamondGold", label: "Diamond", group: "Bold & broadcast", hint: "Amber diamond — for a single number or word", shape: { kind: "diamond", color: "#f59e0b", effect: "shadow", effectIntensity: 45, padX: 36, padY: 16 } },
  { id: "breadcrumb", label: "Breadcrumb", group: "Bold & broadcast", hint: "Slate chevron with a light rim", shape: { kind: "chevron", color: "#475569", borderColor: "#94a3b8", borderWidth: 1, padX: 26, padY: 6 } },
  { id: "fadeBar", label: "Fade bar", group: "Bold & broadcast", hint: "Full-width violet bar fading out to the right", shape: { kind: "rect", color: "#7c3aed", effect: "fadeRight", effectIntensity: 60, width: "fill", padX: 18, padY: 8 } },
  { id: "flagTag", label: "Flag tag", group: "Bold & broadcast", hint: "Emerald flag with a notched end", shape: { kind: "flag", color: "#059669", effect: "shadow", effectIntensity: 40, padX: 26, padY: 7 } },
  /* ------------------------------ Soft & minimal ---------------------- */
  { id: "silverEmboss", label: "Silver emboss", group: "Soft & minimal", hint: "Raised brushed-silver plate", shape: { kind: "rounded", radius: 10, gradient: grad(180, "#f8fafc", "#cbd5e1"), color: "#e2e8f0", effect: "emboss", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "paperStack", label: "Paper stack", group: "Soft & minimal", hint: "Two paper copies stacked behind", shape: { kind: "rounded", radius: 6, color: "#f1f5f9", effect: "stack", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "softBlob", label: "Soft blob", group: "Soft & minimal", hint: "A blurred colour blob behind the words", shape: { kind: "ellipse", color: "#6366f1", opacity: 80, effect: "blur", effectIntensity: 60, padX: 34, padY: 14 } },
  { id: "leafCard", label: "Leaf card", group: "Soft & minimal", hint: "Two opposite corners rounded — the MCQ template look", shape: { kind: "leaf", radius: 22, color: "#0ea5e9", effect: "lift", effectIntensity: 40, padX: 22, padY: 8 } },
  { id: "whisper", label: "Whisper", group: "Soft & minimal", hint: "A barely-there white tint", shape: { kind: "rounded", radius: 10, color: "#ffffff", opacity: 14, padX: 18, padY: 6 } },
  { id: "glossPill", label: "Glossy pill", group: "Soft & minimal", hint: "Candy-glossy pink capsule", shape: { kind: "pill", color: "#ec4899", effect: "gloss", effectIntensity: 55, padX: 22, padY: 6 } },
  /* ------------------------------ Marks & stickers -------------------- */
  { id: "underlineRed", label: "Red underline", group: "Marks & stickers", hint: "A thick red rule under the line", shape: { kind: "underline", color: "#ef4444", padX: 2, padY: 4 } },
  { id: "quoteBar", label: "Quote bar", group: "Marks & stickers", hint: "An amber bar down the left side", shape: { kind: "sideBar", color: "#fbbf24", padX: 14, padY: 2 } },
  { id: "stickerPink", label: "Sticker", group: "Marks & stickers", hint: "Die-cut sticker with a white edge, slightly tilted", shape: { kind: "pill", color: "#ec4899", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -3, padX: 22, padY: 6 } },
  { id: "ringTag", label: "Ring tag", group: "Marks & stickers", hint: "A thin ring outside a violet capsule", shape: { kind: "pill", color: "#7c3aed", effect: "ring", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "offsetSketch", label: "Offset sketch", group: "Marks & stickers", hint: "A hand-drawn feel: a shifted outline copy", shape: { kind: "rounded", radius: 6, color: "#facc15", effect: "offsetOutline", effectColor: "#ffffff", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "dottedNote", label: "Dotted note", group: "Marks & stickers", hint: "Polka dots on teal", shape: { kind: "rounded", radius: 10, color: "#0d9488", effect: "dots", effectIntensity: 45, padX: 20, padY: 8 } },
];

export const TEXT_BG_PRESET_BY_ID = new Map(TEXT_BG_PRESETS.map((p) => [p.id, p]));

export const TEXT_BG_PRESET_GROUPS: TextBgPresetGroup[] = ["Bangladesh edu", "Canva classics", "Bold & broadcast", "Soft & minimal", "Marks & stickers"];

/** the full settings a preset produces (a fresh plate, tagged with the preset) */
export function bgShapeFromPreset(preset: TextBgPreset): TextBgShape {
  // explicit `undefined`s in a preset (no gradient) must clear the field, so
  // the spread runs over the defaults and the result is cleaned afterwards
  const merged = { ...DEFAULT_TEXT_BG_SHAPE, ...preset.shape, enabled: true, preset: preset.id } as TextBgShape;
  for (const k of Object.keys(merged) as (keyof TextBgShape)[]) if (merged[k] === undefined) delete merged[k];
  return merged;
}

/** a short readable summary for captions */
export function describeBgShape(v: TextBgShape | undefined): string {
  if (!bgShapeIsOn(v)) return "Off";
  const s = bgShapeWithDefaults(v);
  const preset = s.preset ? TEXT_BG_PRESET_BY_ID.get(s.preset)?.label : undefined;
  return preset ?? bgKindDef(s.kind).label;
}

/** a small palette of quick colours — the edu brands first, then the basics */
export const TEXT_BG_SWATCHES = [
  "#a936f5", "#3a6186", "#89253e", "#eb2026", "#39b0f9", "#0b6b33", "#006a4e", "#f42a41",
  "#1f5fd0", "#ffd633", "#f97316", "#16a34a", "#0f172a", "#ffffff", "#000000",
];
