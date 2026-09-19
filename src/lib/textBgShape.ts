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
  { id: "starburst", label: "Starburst", family: "poly", points: [[50,0],[58.3,19.1],[75,6.7],[72.6,27.4],[93.3,25],[80.9,41.7],[100,50],[80.9,58.3],[93.3,75],[72.6,72.6],[75,93.3],[58.3,80.9],[50,100],[41.7,80.9],[25,93.3],[27.4,72.6],[6.7,75],[19.1,58.3],[0,50],[19.1,41.7],[6.7,25],[27.4,27.4],[25,6.7],[41.7,19.1]], padHint: [1.6, 1.6] },
  { id: "starburst8", label: "Burst 8", family: "poly", points: [[50,0],[60.7,24.1],[85.4,14.6],[75.9,39.3],[100,50],[75.9,60.7],[85.4,85.4],[60.7,75.9],[50,100],[39.3,75.9],[14.6,85.4],[24.1,60.7],[0,50],[24.1,39.3],[14.6,14.6],[39.3,24.1]], padHint: [1.5, 1.5] },
  { id: "tagRight", label: "Tag ▶", family: "poly", points: [[0,0],[85,0],[100,50],[85,100],[0,100]], padHint: [1.4, 1] },
  { id: "tagLeft", label: "Tag ◀", family: "poly", points: [[15,0],[100,0],[100,100],[15,100],[0,50]], padHint: [1.4, 1] },
  { id: "ticket", label: "Ticket", family: "poly", points: [[0,0],[100,0],[100,35],[92,50],[100,65],[100,100],[0,100],[0,65],[8,50],[0,35]], padHint: [1.3, 1] },
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

export type TextBgPresetGroup = "Bangladesh edu" | "Canva classics" | "Bold & broadcast" | "Soft & minimal" | "Marks & stickers" | "Exam focus" | "Sticker pack";

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
 *
 * New expanded groups "Marks & stickers", "Exam focus" and "Sticker pack"
 * are inspired by popular educational platforms' thumbnail language —
 * highlighter strokes, brush underlines, hand-drawn circles, washi tape,
 * starbursts, price tags, admission ribbons — but without naming any brand.
 */
export const TEXT_BG_PRESETS: TextBgPreset[] = [
  /* ------------------------------ Bangladesh edu ---------------------- */
  { id: "acsViolet", label: "Violet pill", group: "Bangladesh edu", hint: "Electric-violet capsule with glow", shape: { kind: "pill", gradient: grad(135, "#a936f5", "#6d1fd6"), color: "#a936f5", effect: "glow", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "acsCapsule", label: "White capsule", group: "Bangladesh edu", hint: "White pill with soft shadow — pair with red text", shape: { kind: "pill", color: "#ffffff", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "acsCourse", label: "Course plate", group: "Bangladesh edu", hint: "Slanted white plate — bold course title", shape: { kind: "rounded", radius: 8, color: "#ffffff", skew: -8, effect: "pop", effectColor: "#0f172a", effectIntensity: 35, padX: 20, padY: 6 } },
  { id: "udvashCard", label: "Steel card", group: "Bangladesh edu", hint: "Steel blue with a white rim", shape: { kind: "rounded", radius: 10, color: "#3a6186", borderColor: "#ffffff", borderWidth: 2, effect: "shadow", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "udvashMaroon", label: "Maroon ribbon", group: "Bangladesh edu", hint: "Burnt-umber ribbon for admission batches", shape: { kind: "ribbon", color: "#89253e", effect: "lift", effectIntensity: 50, padX: 30, padY: 7 } },
  { id: "tenMsRed", label: "Crimson chevron", group: "Bangladesh edu", hint: "Crimson chevron with hard shadow", shape: { kind: "chevron", color: "#eb2026", effect: "pop", effectColor: "#7f0c10", effectIntensity: 30, padX: 30, padY: 7 } },
  { id: "tenMsSky", label: "Sky tab", group: "Bangladesh edu", hint: "Dodger-blue tab with navy bottom bar", shape: { kind: "tabTop", radius: 12, color: "#39b0f9", effect: "bottomBar", effectColor: "#1e3a8a", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "tenMsGreen", label: "Green slab", group: "Bangladesh edu", hint: "Deep green slab with yellow left bar", shape: { kind: "rect", color: "#0b6b33", effect: "leftBar", effectColor: "#ffd633", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "deshGreenRed", label: "Flag green & red", group: "Bangladesh edu", hint: "Bottle green with flag red left bar", shape: { kind: "rounded", radius: 6, color: "#006a4e", effect: "leftBar", effectColor: "#f42a41", effectIntensity: 60, padX: 22, padY: 8 } },
  { id: "boardNavy", label: "Board navy", group: "Bangladesh edu", hint: "Navy card with gold rim — classic question plate", shape: { kind: "rounded", radius: 8, color: "#0f2a5f", borderColor: "#ffd633", borderWidth: 2, effect: "innerShadow", effectIntensity: 40, padX: 22, padY: 10 } },
  { id: "chalkboard", label: "Chalkboard", group: "Bangladesh edu", hint: "Blackboard green with chalk-dashed frame", shape: { kind: "rounded", radius: 4, color: "#1f3b2d", borderColor: "#e2e8f0", borderStyle: "dashed", borderWidth: 2, padX: 20, padY: 10 } },
  { id: "coachingOrange", label: "Coaching slant", group: "Bangladesh edu", hint: "Orange slanted plate with hard shadow", shape: { kind: "parallelogram", color: "#f97316", effect: "pop", effectColor: "#7c2d12", effectIntensity: 35, padX: 28, padY: 7 } },
  { id: "optionPill", label: "Option pill", group: "Bangladesh edu", hint: "Translucent white pill for option rows", shape: { kind: "pill", color: "#ffffff", opacity: 30, gradient: undefined, borderColor: "#ffffff", borderWidth: 1.5, effect: "glass", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "answerGreen", label: "Answer green", group: "Bangladesh edu", hint: "Glowing green capsule for correct answer", shape: { kind: "pill", color: "#16a34a", effect: "glow", effectIntensity: 50, padX: 22, padY: 6 } },
  /* --- extra Bangladesh edu — admission / medical / engineering vibes without naming --- */
  { id: "admissionCrimson", label: "Admission crimson", group: "Bangladesh edu", hint: "Crimson pill with white sticker edge", shape: { kind: "pill", color: "#dc2626", effect: "sticker", effectColor: "#ffffff", effectIntensity: 50, padX: 24, padY: 7 } },
  { id: "admissionNavyGold", label: "Navy gold bar", group: "Bangladesh edu", hint: "Navy with gold bottom bar — exam title", shape: { kind: "rect", color: "#0f172a", effect: "bottomBar", effectColor: "#facc15", effectIntensity: 70, padX: 22, padY: 8 } },
  { id: "medicalMint", label: "Medical mint", group: "Bangladesh edu", hint: "Mint green with teal ring", shape: { kind: "pill", color: "#10b981", effect: "ring", effectColor: "#065f46", effectIntensity: 50, padX: 22, padY: 6 } },
  { id: "medicalBlue", label: "Medical blue", group: "Bangladesh edu", hint: "Clinical blue with soft glow", shape: { kind: "rounded", radius: 12, color: "#0e7490", effect: "glow", effectColor: "#22d3ee", effectIntensity: 45, padX: 22, padY: 8 } },
  { id: "engineeringOrange", label: "Engineering orange", group: "Bangladesh edu", hint: "Safety orange slant for engineering batches", shape: { kind: "slantRight", color: "#ea580c", effect: "shadow", effectIntensity: 45, padX: 26, padY: 7 } },
  { id: "varsityViolet", label: "Varsity violet", group: "Bangladesh edu", hint: "Violet pill with glossy highlight", shape: { kind: "pill", color: "#7c3aed", effect: "gloss", effectIntensity: 55, padX: 22, padY: 6 } },
  { id: "hscGreen", label: "HSC green badge", group: "Bangladesh edu", hint: "Forest green tag for HSC batches", shape: { kind: "tagRight", color: "#15803d", effect: "shadow", effectIntensity: 40, padX: 26, padY: 6 } },
  { id: "sscBlue", label: "SSC blue badge", group: "Bangladesh edu", hint: "Royal blue tag for SSC batches", shape: { kind: "tagRight", color: "#1d4ed8", effect: "shadow", effectIntensity: 40, padX: 26, padY: 6 } },
  { id: "liveRed", label: "Live red", group: "Bangladesh edu", hint: "Live class red with neon glow", shape: { kind: "rounded", radius: 6, color: "#ef4444", effect: "neon", effectIntensity: 55, padX: 20, padY: 6 } },
  { id: "recordedIndigo", label: "Recorded indigo", group: "Bangladesh edu", hint: "Indigo with inner shadow for recorded", shape: { kind: "rounded", radius: 8, color: "#4338ca", effect: "innerShadow", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "modelTestGold", label: "Model test gold", group: "Bangladesh edu", hint: "Gold bevel for model tests", shape: { kind: "rounded", radius: 8, gradient: grad(180, "#fef08a", "#facc15", "#a16207"), color: "#facc15", effect: "bevel", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "suggestionPink", label: "Suggestion pink", group: "Bangladesh edu", hint: "Hot pink with white sticker — suggestion", shape: { kind: "pill", color: "#db2777", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: -2, padX: 22, padY: 6 } },
  { id: "freeClassCyan", label: "Free class cyan", group: "Bangladesh edu", hint: "Cyan ticket for free classes", shape: { kind: "ticket", color: "#06b6d4", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },
  { id: "paidOrange", label: "Premium orange", group: "Bangladesh edu", hint: "Orange with pop shadow — premium", shape: { kind: "rounded", radius: 10, color: "#f97316", effect: "pop", effectColor: "#7c2d12", effectIntensity: 40, padX: 22, padY: 8 } },
  { id: "physicsBlue", label: "Physics blue", group: "Bangladesh edu", hint: "Electric blue with grid — physics", shape: { kind: "rounded", radius: 6, color: "#2563eb", effect: "grid", effectColor: "#93c5fd", effectIntensity: 45, padX: 22, padY: 8 } },
  { id: "chemistryGreen", label: "Chemistry green", group: "Bangladesh edu", hint: "Lab green with dots", shape: { kind: "rounded", radius: 8, color: "#16a34a", effect: "dots", effectColor: "#bbf7d0", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "mathViolet", label: "Math violet", group: "Bangladesh edu", hint: "Math violet with sheen", shape: { kind: "parallelogram", color: "#7c3aed", effect: "sheen", effectIntensity: 50, padX: 26, padY: 7 } },
  { id: "biologyEmerald", label: "Biology emerald", group: "Bangladesh edu", hint: "Emerald with leaf shape", shape: { kind: "leaf", radius: 18, color: "#059669", effect: "lift", effectIntensity: 45, padX: 22, padY: 8 } },
  { id: "englishRed", label: "English maroon", group: "Bangladesh edu", hint: "Maroon ribbon for English", shape: { kind: "ribbon", color: "#991b1b", effect: "shadow", effectIntensity: 45, padX: 28, padY: 7 } },
  { id: "ictTeal", label: "ICT teal", group: "Bangladesh edu", hint: "Teal hexagon for ICT", shape: { kind: "hexagon", color: "#0d9488", borderColor: "#5eead4", borderWidth: 1.5, effect: "glow", effectIntensity: 40, padX: 28, padY: 7 } },

  /* ------------------------------ Canva classics ---------------------- */
  { id: "highlighter", label: "Highlighter", group: "Canva classics", hint: "Yellow marker stroke under the words", shape: { kind: "highlight", color: "#ffd633", radius: 3, opacity: 85, padX: 6, padY: 2 } },
  { id: "stickyNote", label: "Sticky note", group: "Canva classics", hint: "Pale yellow note with folded corner", shape: { kind: "rect", color: "#fde68a", effect: "cornerFold", effectIntensity: 50, rotate: -2, padX: 18, padY: 10 } },
  { id: "glassCard", label: "Glass card", group: "Canva classics", hint: "Frosted glass over the slide", shape: { kind: "rounded", radius: 14, color: "#ffffff", opacity: 35, borderColor: "#ffffff", borderWidth: 1, effect: "glass", effectIntensity: 60, padX: 22, padY: 10 } },
  { id: "neonFrame", label: "Neon frame", group: "Canva classics", hint: "No fill, glowing cyan tube", shape: { kind: "rounded", radius: 10, color: "", borderColor: "#22d3ee", borderWidth: 2, effect: "neon", effectIntensity: 55, padX: 22, padY: 8 } },
  { id: "goldPlate", label: "Gold plate", group: "Canva classics", hint: "Bevelled gold", shape: { kind: "rounded", radius: 8, gradient: grad(180, "#fff1b8", "#ffcc33", "#b8860b"), color: "#ffcc33", borderColor: "#7a5300", borderWidth: 1, effect: "bevel", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "sunsetPill", label: "Sunset pill", group: "Canva classics", hint: "Orange-to-pink capsule", shape: { kind: "pill", gradient: grad(90, "#f97316", "#ec4899"), color: "#f97316", effect: "shadow", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "oceanCard", label: "Ocean card", group: "Canva classics", hint: "Sky-to-navy gradient card", shape: { kind: "rounded", radius: 12, gradient: grad(135, "#38bdf8", "#1e3a8a"), color: "#38bdf8", effect: "lift", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "darkGold", label: "Dark & gold", group: "Canva classics", hint: "Midnight card with double gold rim", shape: { kind: "rounded", radius: 10, color: "#0b1220", borderColor: "#d4af37", borderStyle: "double", borderWidth: 4, effect: "shadow", effectIntensity: 40, padX: 22, padY: 10 } },
  { id: "dashedOutline", label: "Dashed outline", group: "Canva classics", hint: "No fill, dashed white frame", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#ffffff", borderStyle: "dashed", borderWidth: 2, padX: 20, padY: 8 } },
  { id: "speechBubble", label: "Speech bubble", group: "Canva classics", hint: "White bubble with sharp corner", shape: { kind: "bubble", radius: 14, color: "#ffffff", effect: "shadow", effectIntensity: 40, padX: 20, padY: 8 } },
  { id: "blueprint", label: "Blueprint", group: "Canva classics", hint: "Graph-paper lines on deep blue", shape: { kind: "rounded", radius: 4, color: "#1e3a8a", borderColor: "#93c5fd", borderWidth: 1, effect: "grid", effectColor: "#93c5fd", effectIntensity: 50, padX: 20, padY: 8 } },
  { id: "spotlightCard", label: "Spotlight card", group: "Canva classics", hint: "Slate card lit from the middle", shape: { kind: "rounded", radius: 12, color: "#0f172a", borderColor: "#334155", borderWidth: 1, effect: "spotlight", effectIntensity: 55, padX: 22, padY: 10 } },

  /* ------------------------------ Bold & broadcast --------------------- */
  { id: "popArt", label: "Pop art", group: "Bold & broadcast", hint: "White plate, black frame, hard black shadow", shape: { kind: "rect", color: "#ffffff", borderColor: "#000000", borderWidth: 3, effect: "pop", effectColor: "#000000", effectIntensity: 50, padX: 18, padY: 8 } },
  { id: "materialFlat", label: "Material flat", group: "Bold & broadcast", hint: "Flat blue with long stepped shadow", shape: { kind: "rect", color: "#3b82f6", effect: "longShadow", effectColor: "#1e3a8a", effectIntensity: 60, padX: 20, padY: 8 } },
  { id: "redRibbon", label: "Red ribbon", group: "Bold & broadcast", hint: "Swallow-tailed red ribbon", shape: { kind: "ribbon", color: "#dc2626", effect: "shadow", effectIntensity: 45, padX: 32, padY: 7 } },
  { id: "arrowBanner", label: "Arrow banner", group: "Bold & broadcast", hint: "Blue banner pointing right", shape: { kind: "arrow", color: "#2563eb", effect: "lift", effectIntensity: 50, padX: 26, padY: 7 } },
  { id: "lowerThird", label: "Lower third", group: "Bold & broadcast", hint: "TV-style red plate cut on the right, fine stripes", shape: { kind: "slantRight", color: "#dc2626", effect: "stripes", effectColor: "#ffffff", effectIntensity: 25, padX: 24, padY: 7 } },
  { id: "hexTech", label: "Hex tech", group: "Bold & broadcast", hint: "Teal hexagon with cyan glow", shape: { kind: "hexagon", color: "#0e7490", borderColor: "#67e8f9", borderWidth: 2, effect: "glow", effectIntensity: 45, padX: 30, padY: 8 } },
  { id: "diamondGold", label: "Diamond", group: "Bold & broadcast", hint: "Amber diamond — for single word", shape: { kind: "diamond", color: "#f59e0b", effect: "shadow", effectIntensity: 45, padX: 36, padY: 16 } },
  { id: "breadcrumb", label: "Breadcrumb", group: "Bold & broadcast", hint: "Slate chevron with light rim", shape: { kind: "chevron", color: "#475569", borderColor: "#94a3b8", borderWidth: 1, padX: 26, padY: 6 } },
  { id: "fadeBar", label: "Fade bar", group: "Bold & broadcast", hint: "Full-width violet bar fading right", shape: { kind: "rect", color: "#7c3aed", effect: "fadeRight", effectIntensity: 60, width: "fill", padX: 18, padY: 8 } },
  { id: "flagTag", label: "Flag tag", group: "Bold & broadcast", hint: "Emerald flag with notched end", shape: { kind: "flag", color: "#059669", effect: "shadow", effectIntensity: 40, padX: 26, padY: 7 } },

  /* ------------------------------ Soft & minimal ---------------------- */
  { id: "silverEmboss", label: "Silver emboss", group: "Soft & minimal", hint: "Raised brushed-silver plate", shape: { kind: "rounded", radius: 10, gradient: grad(180, "#f8fafc", "#cbd5e1"), color: "#e2e8f0", effect: "emboss", effectIntensity: 50, padX: 22, padY: 8 } },
  { id: "paperStack", label: "Paper stack", group: "Soft & minimal", hint: "Two paper copies stacked behind", shape: { kind: "rounded", radius: 6, color: "#f1f5f9", effect: "stack", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "softBlob", label: "Soft blob", group: "Soft & minimal", hint: "Blurred colour blob behind words", shape: { kind: "ellipse", color: "#6366f1", opacity: 80, effect: "blur", effectIntensity: 60, padX: 34, padY: 14 } },
  { id: "leafCard", label: "Leaf card", group: "Soft & minimal", hint: "Two opposite corners rounded — MCQ template", shape: { kind: "leaf", radius: 22, color: "#0ea5e9", effect: "lift", effectIntensity: 40, padX: 22, padY: 8 } },
  { id: "whisper", label: "Whisper", group: "Soft & minimal", hint: "Barely-there white tint", shape: { kind: "rounded", radius: 10, color: "#ffffff", opacity: 14, padX: 18, padY: 6 } },
  { id: "glossPill", label: "Glossy pill", group: "Soft & minimal", hint: "Candy-glossy pink capsule", shape: { kind: "pill", color: "#ec4899", effect: "gloss", effectIntensity: 55, padX: 22, padY: 6 } },

  /* ------------------------------ Marks & stickers — core -------------------- */
  { id: "underlineRed", label: "Red underline", group: "Marks & stickers", hint: "Thick red rule under line", shape: { kind: "underline", color: "#ef4444", padX: 2, padY: 4 } },
  { id: "quoteBar", label: "Quote bar", group: "Marks & stickers", hint: "Amber bar down left side", shape: { kind: "sideBar", color: "#fbbf24", padX: 14, padY: 2 } },
  { id: "stickerPink", label: "Sticker pink", group: "Marks & stickers", hint: "Die-cut pink sticker with white edge", shape: { kind: "pill", color: "#ec4899", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -3, padX: 22, padY: 6 } },
  { id: "ringTag", label: "Ring tag", group: "Marks & stickers", hint: "Violet capsule with outer ring", shape: { kind: "pill", color: "#7c3aed", effect: "ring", effectIntensity: 45, padX: 22, padY: 6 } },
  { id: "offsetSketch", label: "Offset sketch", group: "Marks & stickers", hint: "Hand-drawn shifted outline copy", shape: { kind: "rounded", radius: 6, color: "#facc15", effect: "offsetOutline", effectColor: "#ffffff", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "dottedNote", label: "Dotted note", group: "Marks & stickers", hint: "Polka dots on teal", shape: { kind: "rounded", radius: 10, color: "#0d9488", effect: "dots", effectIntensity: 45, padX: 20, padY: 8 } },

  /* --- MASSIVE expansion: highlighters (inspired by classroom marker culture) --- */
  { id: "hlYellow", label: "Marker yellow", group: "Marks & stickers", hint: "Classic yellow highlighter stroke", shape: { kind: "highlight", color: "#fde047", radius: 4, opacity: 90, padX: 8, padY: 2 } },
  { id: "hlPink", label: "Marker pink", group: "Marks & stickers", hint: "Neon pink highlighter", shape: { kind: "highlight", color: "#f472b6", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlGreen", label: "Marker green", group: "Marks & stickers", hint: "Mint green highlighter", shape: { kind: "highlight", color: "#86efac", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlBlue", label: "Marker blue", group: "Marks & stickers", hint: "Sky blue highlighter", shape: { kind: "highlight", color: "#7dd3fc", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlOrange", label: "Marker orange", group: "Marks & stickers", hint: "Orange highlighter for emphasis", shape: { kind: "highlight", color: "#fdba74", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlViolet", label: "Marker violet", group: "Marks & stickers", hint: "Violet highlighter — key point", shape: { kind: "highlight", color: "#c4b5fd", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlCyan", label: "Marker cyan", group: "Marks & stickers", hint: "Cyan marker stroke", shape: { kind: "highlight", color: "#67e8f9", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlLime", label: "Marker lime", group: "Marks & stickers", hint: "Lime highlighter — formula highlight", shape: { kind: "highlight", color: "#bef264", radius: 4, opacity: 90, padX: 8, padY: 2 } },
  { id: "hlRose", label: "Marker rose", group: "Marks & stickers", hint: "Rose highlighter — important", shape: { kind: "highlight", color: "#fda4af", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlSky", label: "Marker sky", group: "Marks & stickers", hint: "Light sky marker", shape: { kind: "highlight", color: "#bae6fd", radius: 4, opacity: 88, padX: 8, padY: 2 } },
  { id: "hlDoubleYellow", label: "Double marker", group: "Marks & stickers", hint: "Double stacked yellow marker", shape: { kind: "highlight", color: "#fde047", radius: 4, opacity: 85, effect: "stack", effectIntensity: 40, padX: 8, padY: 2 } },
  { id: "hlTiltYellow", label: "Tilted marker", group: "Marks & stickers", hint: "Slightly tilted yellow stroke", shape: { kind: "highlight", color: "#facc15", radius: 4, opacity: 88, rotate: -1.5, padX: 8, padY: 2 } },

  /* --- underlines — exam correction style --- */
  { id: "ulRed", label: "Underline red", group: "Marks & stickers", hint: "Thick red underline — correction style", shape: { kind: "underline", color: "#ef4444", radius: 3, padX: 2, padY: 3 } },
  { id: "ulBlue", label: "Underline blue", group: "Marks & stickers", hint: "Blue underline — teacher mark", shape: { kind: "underline", color: "#3b82f6", radius: 3, padX: 2, padY: 3 } },
  { id: "ulGreen", label: "Underline green", group: "Marks & stickers", hint: "Green underline — correct", shape: { kind: "underline", color: "#22c55e", radius: 3, padX: 2, padY: 3 } },
  { id: "ulOrange", label: "Underline orange", group: "Marks & stickers", hint: "Orange underline — focus", shape: { kind: "underline", color: "#f97316", radius: 3, padX: 2, padY: 3 } },
  { id: "ulViolet", label: "Underline violet", group: "Marks & stickers", hint: "Violet underline — key term", shape: { kind: "underline", color: "#8b5cf6", radius: 3, padX: 2, padY: 3 } },
  { id: "ulYellow", label: "Underline yellow", group: "Marks & stickers", hint: "Yellow thick underline", shape: { kind: "underline", color: "#eab308", radius: 3, padX: 2, padY: 3 } },
  { id: "ulDoubleRed", label: "Double underline", group: "Marks & stickers", hint: "Double red line — very important", shape: { kind: "underline", color: "#dc2626", radius: 3, effect: "bottomBar", effectColor: "#dc2626", effectIntensity: 30, padX: 2, padY: 5 } },
  { id: "ulWavy", label: "Wavy underline", group: "Marks & stickers", hint: "Wavy style underline with dots", shape: { kind: "underline", color: "#3b82f6", radius: 3, effect: "dots", effectIntensity: 50, padX: 2, padY: 4 } },

  /* --- side bars — quote / formula bars --- */
  { id: "sbRed", label: "Side bar red", group: "Marks & stickers", hint: "Red side bar — important note", shape: { kind: "sideBar", color: "#ef4444", padX: 14, padY: 2 } },
  { id: "sbBlue", label: "Side bar blue", group: "Marks & stickers", hint: "Blue side bar — formula", shape: { kind: "sideBar", color: "#3b82f6", padX: 14, padY: 2 } },
  { id: "sbGreen", label: "Side bar green", group: "Marks & stickers", hint: "Green side bar — correct point", shape: { kind: "sideBar", color: "#22c55e", padX: 14, padY: 2 } },
  { id: "sbYellow", label: "Side bar yellow", group: "Marks & stickers", hint: "Yellow side bar — highlight", shape: { kind: "sideBar", color: "#facc15", padX: 14, padY: 2 } },
  { id: "sbViolet", label: "Side bar violet", group: "Marks & stickers", hint: "Violet side bar — definition", shape: { kind: "sideBar", color: "#8b5cf6", padX: 14, padY: 2 } },
  { id: "sbOrange", label: "Side bar orange", group: "Marks & stickers", hint: "Orange side bar — example", shape: { kind: "sideBar", color: "#f97316", padX: 14, padY: 2 } },
  { id: "sbPink", label: "Side bar pink", group: "Marks & stickers", hint: "Pink side bar — tip", shape: { kind: "sideBar", color: "#ec4899", padX: 14, padY: 2 } },
  { id: "sbThickRed", label: "Thick bar red", group: "Marks & stickers", hint: "Extra thick red bar", shape: { kind: "sideBar", color: "#dc2626", effect: "glow", effectIntensity: 20, padX: 18, padY: 2 } },
  { id: "sbDoubleBlue", label: "Double bar", group: "Marks & stickers", hint: "Blue bar with offset outline", shape: { kind: "sideBar", color: "#2563eb", effect: "offsetOutline", effectColor: "#93c5fd", effectIntensity: 45, padX: 14, padY: 2 } },

  /* --- marker boxes — hand-drawn boxes --- */
  { id: "boxBlack", label: "Box black", group: "Marks & stickers", hint: "Hand-drawn black box", shape: { kind: "rounded", radius: 6, color: "", borderColor: "#000000", borderWidth: 2.5, padX: 14, padY: 6 } },
  { id: "boxRed", label: "Box red", group: "Marks & stickers", hint: "Red marker box — correction", shape: { kind: "rounded", radius: 6, color: "", borderColor: "#ef4444", borderWidth: 2.5, padX: 14, padY: 6 } },
  { id: "boxBlue", label: "Box blue", group: "Marks & stickers", hint: "Blue marker box", shape: { kind: "rounded", radius: 6, color: "", borderColor: "#3b82f6", borderWidth: 2.5, padX: 14, padY: 6 } },
  { id: "boxGreen", label: "Box green", group: "Marks & stickers", hint: "Green marker box — correct", shape: { kind: "rounded", radius: 6, color: "", borderColor: "#22c55e", borderWidth: 2.5, padX: 14, padY: 6 } },
  { id: "boxDashed", label: "Box dashed", group: "Marks & stickers", hint: "Dashed outline box — draft", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#64748b", borderStyle: "dashed", borderWidth: 2, padX: 16, padY: 8 } },
  { id: "boxDotted", label: "Box dotted", group: "Marks & stickers", hint: "Dotted box — optional", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#94a3b8", borderStyle: "dotted", borderWidth: 2.5, padX: 16, padY: 8 } },
  { id: "boxDouble", label: "Box double", group: "Marks & stickers", hint: "Double border box — important", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#0f172a", borderStyle: "double", borderWidth: 4, padX: 16, padY: 8 } },
  { id: "boxChalk", label: "Chalk box", group: "Marks & stickers", hint: "Chalk-style dashed white on dark", shape: { kind: "rounded", radius: 4, color: "#1e293b", borderColor: "#e2e8f0", borderStyle: "dashed", borderWidth: 2, effect: "lift", effectIntensity: 30, padX: 16, padY: 8 } },

  /* --- stickers — die-cut style, inspired by edu thumbnail stickers --- */
  { id: "stickerWhiteRed", label: "Sticker white/red", group: "Marks & stickers", hint: "White sticker with red pop shadow", shape: { kind: "pill", color: "#ffffff", effect: "pop", effectColor: "#ef4444", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "stickerWhiteBlue", label: "Sticker white/blue", group: "Marks & stickers", hint: "White with blue pop", shape: { kind: "pill", color: "#ffffff", effect: "pop", effectColor: "#3b82f6", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "stickerWhiteGreen", label: "Sticker white/green", group: "Marks & stickers", hint: "White with green pop", shape: { kind: "pill", color: "#ffffff", effect: "pop", effectColor: "#22c55e", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "stickerYellowTilt", label: "Sticker yellow tilt", group: "Marks & stickers", hint: "Yellow sticker tilted", shape: { kind: "pill", color: "#fde047", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -4, padX: 22, padY: 6 } },
  { id: "stickerPinkTilt", label: "Sticker pink tilt", group: "Marks & stickers", hint: "Pink tilted sticker", shape: { kind: "pill", color: "#f9a8d4", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: 3, padX: 22, padY: 6 } },
  { id: "stickerBlueTilt", label: "Sticker blue tilt", group: "Marks & stickers", hint: "Blue tilted sticker", shape: { kind: "pill", color: "#7dd3fc", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -3, padX: 22, padY: 6 } },
  { id: "stickerGreenTilt", label: "Sticker green tilt", group: "Marks & stickers", hint: "Green tilted sticker", shape: { kind: "pill", color: "#86efac", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: 2, padX: 22, padY: 6 } },
  { id: "stickerVioletTilt", label: "Sticker violet tilt", group: "Marks & stickers", hint: "Violet tilted sticker", shape: { kind: "pill", color: "#c4b5fd", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -2, padX: 22, padY: 6 } },
  { id: "stickerOrangeTilt", label: "Sticker orange tilt", group: "Marks & stickers", hint: "Orange tilted sticker", shape: { kind: "pill", color: "#fdba74", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: 3, padX: 22, padY: 6 } },
  { id: "stickerCyanTilt", label: "Sticker cyan tilt", group: "Marks & stickers", hint: "Cyan tilted sticker", shape: { kind: "pill", color: "#67e8f9", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, rotate: -3, padX: 22, padY: 6 } },
  { id: "stickerRedHot", label: "Sticker hot red", group: "Marks & stickers", hint: "Hot red sticker with white edge", shape: { kind: "pill", color: "#ef4444", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: -2, padX: 22, padY: 6 } },
  { id: "stickerNeonGreen", label: "Sticker neon green", group: "Marks & stickers", hint: "Neon green with glow", shape: { kind: "pill", color: "#22c55e", effect: "glow", effectIntensity: 50, padX: 22, padY: 6 } },
  { id: "stickerNeonViolet", label: "Sticker neon violet", group: "Marks & stickers", hint: "Violet with neon glow", shape: { kind: "pill", color: "#8b5cf6", effect: "neon", effectIntensity: 50, padX: 22, padY: 6 } },

  /* --- starbursts / bursts — for NEW, HOT, LIVE tags --- */
  { id: "burstYellow", label: "Burst yellow", group: "Marks & stickers", hint: "Yellow starburst for NEW", shape: { kind: "starburst", color: "#facc15", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstRed", label: "Burst red", group: "Marks & stickers", hint: "Red burst for HOT", shape: { kind: "starburst", color: "#ef4444", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstBlue", label: "Burst blue", group: "Marks & stickers", hint: "Blue burst for LIVE", shape: { kind: "starburst", color: "#3b82f6", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstGreen", label: "Burst green", group: "Marks & stickers", hint: "Green burst for FREE", shape: { kind: "starburst", color: "#22c55e", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstViolet", label: "Burst violet", group: "Marks & stickers", hint: "Violet burst", shape: { kind: "starburst", color: "#8b5cf6", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstPink", label: "Burst pink", group: "Marks & stickers", hint: "Pink burst", shape: { kind: "starburst", color: "#ec4899", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burstOrange", label: "Burst orange", group: "Marks & stickers", hint: "Orange burst", shape: { kind: "starburst", color: "#f97316", effect: "shadow", effectIntensity: 45, padX: 28, padY: 14 } },
  { id: "burst8Yellow", label: "Burst 8 yellow", group: "Marks & stickers", hint: "8-point yellow burst", shape: { kind: "starburst8", color: "#fde047", effect: "pop", effectColor: "#a16207", effectIntensity: 40, padX: 26, padY: 12 } },
  { id: "burst8Red", label: "Burst 8 red", group: "Marks & stickers", hint: "8-point red burst", shape: { kind: "starburst8", color: "#f87171", effect: "pop", effectColor: "#7f1d1d", effectIntensity: 40, padX: 26, padY: 12 } },
  { id: "burstSticker", label: "Burst sticker", group: "Marks & stickers", hint: "Starburst with sticker edge", shape: { kind: "starburst", color: "#facc15", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 30, padY: 16 } },

  /* --- tags — price / batch tags --- */
  { id: "tagRed", label: "Tag red", group: "Marks & stickers", hint: "Red price tag", shape: { kind: "tagRight", color: "#ef4444", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagBlue", label: "Tag blue", group: "Marks & stickers", hint: "Blue batch tag", shape: { kind: "tagRight", color: "#3b82f6", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagGreen", label: "Tag green", group: "Marks & stickers", hint: "Green tag", shape: { kind: "tagRight", color: "#22c55e", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagYellow", label: "Tag yellow", group: "Marks & stickers", hint: "Yellow tag", shape: { kind: "tagRight", color: "#facc15", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagViolet", label: "Tag violet", group: "Marks & stickers", hint: "Violet tag", shape: { kind: "tagRight", color: "#8b5cf6", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagOrange", label: "Tag orange", group: "Marks & stickers", hint: "Orange tag", shape: { kind: "tagRight", color: "#f97316", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagPink", label: "Tag pink", group: "Marks & stickers", hint: "Pink tag", shape: { kind: "tagRight", color: "#ec4899", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagLeftBlue", label: "Tag left blue", group: "Marks & stickers", hint: "Left-pointing blue tag", shape: { kind: "tagLeft", color: "#3b82f6", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },
  { id: "tagLeftRed", label: "Tag left red", group: "Marks & stickers", hint: "Left-pointing red tag", shape: { kind: "tagLeft", color: "#ef4444", effect: "shadow", effectIntensity: 40, padX: 24, padY: 6 } },

  /* --- tickets — for free class / coupon --- */
  { id: "ticketWhite", label: "Ticket white", group: "Marks & stickers", hint: "White ticket stub", shape: { kind: "ticket", color: "#ffffff", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },
  { id: "ticketYellow", label: "Ticket yellow", group: "Marks & stickers", hint: "Yellow ticket", shape: { kind: "ticket", color: "#fde047", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },
  { id: "ticketBlue", label: "Ticket blue", group: "Marks & stickers", hint: "Blue ticket", shape: { kind: "ticket", color: "#7dd3fc", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },
  { id: "ticketGreen", label: "Ticket green", group: "Marks & stickers", hint: "Green ticket", shape: { kind: "ticket", color: "#86efac", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },
  { id: "ticketViolet", label: "Ticket violet", group: "Marks & stickers", hint: "Violet ticket", shape: { kind: "ticket", color: "#c4b5fd", effect: "shadow", effectIntensity: 40, padX: 22, padY: 7 } },

  /* --- tape / washi — classroom tape look --- */
  { id: "tapeYellow", label: "Tape yellow", group: "Marks & stickers", hint: "Washi tape yellow — tilted", shape: { kind: "pill", color: "#fde68a", opacity: 75, rotate: -6, effect: "shadow", effectIntensity: 30, padX: 28, padY: 4 } },
  { id: "tapeBlue", label: "Tape blue", group: "Marks & stickers", hint: "Blue tape", shape: { kind: "pill", color: "#93c5fd", opacity: 70, rotate: 5, effect: "shadow", effectIntensity: 30, padX: 28, padY: 4 } },
  { id: "tapePink", label: "Tape pink", group: "Marks & stickers", hint: "Pink tape", shape: { kind: "pill", color: "#f9a8d4", opacity: 70, rotate: -4, effect: "shadow", effectIntensity: 30, padX: 28, padY: 4 } },
  { id: "tapeGreen", label: "Tape green", group: "Marks & stickers", hint: "Green tape", shape: { kind: "pill", color: "#86efac", opacity: 70, rotate: 4, effect: "shadow", effectIntensity: 30, padX: 28, padY: 4 } },
  { id: "tapeViolet", label: "Tape violet", group: "Marks & stickers", hint: "Violet tape", shape: { kind: "pill", color: "#c4b5fd", opacity: 70, rotate: -5, effect: "shadow", effectIntensity: 30, padX: 28, padY: 4 } },

  /* --- chalk / hand-drawn circles — teacher circling --- */
  { id: "circleRed", label: "Circle red", group: "Marks & stickers", hint: "Hand-drawn red circle", shape: { kind: "ellipse", color: "", borderColor: "#ef4444", borderWidth: 2.5, padX: 18, padY: 8 } },
  { id: "circleBlue", label: "Circle blue", group: "Marks & stickers", hint: "Blue circle", shape: { kind: "ellipse", color: "", borderColor: "#3b82f6", borderWidth: 2.5, padX: 18, padY: 8 } },
  { id: "circleGreen", label: "Circle green", group: "Marks & stickers", hint: "Green circle — correct", shape: { kind: "ellipse", color: "", borderColor: "#22c55e", borderWidth: 2.5, padX: 18, padY: 8 } },
  { id: "circleDashedRed", label: "Dashed circle red", group: "Marks & stickers", hint: "Dashed red circle", shape: { kind: "ellipse", color: "", borderColor: "#ef4444", borderStyle: "dashed", borderWidth: 2, padX: 18, padY: 8 } },
  { id: "circleDoubleBlue", label: "Double circle blue", group: "Marks & stickers", hint: "Double border blue circle", shape: { kind: "ellipse", color: "", borderColor: "#3b82f6", borderStyle: "double", borderWidth: 4, padX: 18, padY: 8 } },
  { id: "circleThickYellow", label: "Thick circle yellow", group: "Marks & stickers", hint: "Thick yellow circle", shape: { kind: "ellipse", color: "", borderColor: "#facc15", borderWidth: 4, padX: 18, padY: 8 } },

  /* --- brush strokes — paint swipe --- */
  { id: "brushRed", label: "Brush red", group: "Marks & stickers", hint: "Red paint swipe", shape: { kind: "parallelogram", color: "#ef4444", opacity: 85, skew: -8, padX: 24, padY: 6 } },
  { id: "brushBlue", label: "Brush blue", group: "Marks & stickers", hint: "Blue paint swipe", shape: { kind: "parallelogram", color: "#3b82f6", opacity: 85, skew: -8, padX: 24, padY: 6 } },
  { id: "brushYellow", label: "Brush yellow", group: "Marks & stickers", hint: "Yellow paint swipe", shape: { kind: "parallelogram", color: "#facc15", opacity: 85, skew: -8, padX: 24, padY: 6 } },
  { id: "brushGreen", label: "Brush green", group: "Marks & stickers", hint: "Green paint swipe", shape: { kind: "parallelogram", color: "#22c55e", opacity: 85, skew: -8, padX: 24, padY: 6 } },
  { id: "brushViolet", label: "Brush violet", group: "Marks & stickers", hint: "Violet paint swipe", shape: { kind: "parallelogram", color: "#8b5cf6", opacity: 85, skew: -8, padX: 24, padY: 6 } },
  { id: "brushOrange", label: "Brush orange", group: "Marks & stickers", hint: "Orange paint swipe", shape: { kind: "parallelogramLeft", color: "#f97316", opacity: 85, skew: 8, padX: 24, padY: 6 } },

  /* --- stamps — APPROVED / IMPORTANT style --- */
  { id: "stampRed", label: "Stamp red", group: "Marks & stickers", hint: "Red stamp — dashed border", shape: { kind: "rounded", radius: 4, color: "", borderColor: "#ef4444", borderStyle: "dashed", borderWidth: 2.5, rotate: -4, padX: 16, padY: 6 } },
  { id: "stampBlue", label: "Stamp blue", group: "Marks & stickers", hint: "Blue stamp", shape: { kind: "rounded", radius: 4, color: "", borderColor: "#3b82f6", borderStyle: "dashed", borderWidth: 2.5, rotate: -4, padX: 16, padY: 6 } },
  { id: "stampGreen", label: "Stamp green", group: "Marks & stickers", hint: "Green approved stamp", shape: { kind: "rounded", radius: 4, color: "", borderColor: "#22c55e", borderStyle: "dashed", borderWidth: 2.5, rotate: -4, padX: 16, padY: 6 } },
  { id: "stampViolet", label: "Stamp violet", group: "Marks & stickers", hint: "Violet stamp", shape: { kind: "rounded", radius: 4, color: "", borderColor: "#8b5cf6", borderStyle: "dashed", borderWidth: 2.5, rotate: -4, padX: 16, padY: 6 } },
  { id: "stampDoubleRed", label: "Double stamp red", group: "Marks & stickers", hint: "Double border red stamp", shape: { kind: "rounded", radius: 4, color: "", borderColor: "#ef4444", borderStyle: "double", borderWidth: 4, rotate: -3, padX: 16, padY: 6 } },

  /* --- check / cross / star — tiny badge shapes --- */
  { id: "checkGreen", label: "Check green", group: "Marks & stickers", hint: "Green diamond check badge", shape: { kind: "diamond", color: "#22c55e", effect: "shadow", effectIntensity: 40, padX: 20, padY: 10 } },
  { id: "crossRed", label: "Cross red", group: "Marks & stickers", hint: "Red diamond cross badge", shape: { kind: "diamond", color: "#ef4444", effect: "shadow", effectIntensity: 40, padX: 20, padY: 10 } },
  { id: "starGold", label: "Star gold", group: "Marks & stickers", hint: "Gold star burst", shape: { kind: "starburst8", color: "#facc15", effect: "shadow", effectIntensity: 45, padX: 20, padY: 10 } },
  { id: "starViolet", label: "Star violet", group: "Marks & stickers", hint: "Violet star", shape: { kind: "starburst8", color: "#8b5cf6", effect: "shadow", effectIntensity: 45, padX: 20, padY: 10 } },
  { id: "lightningYellow", label: "Lightning yellow", group: "Marks & stickers", hint: "Yellow lightning — quick tip", shape: { kind: "hexagon", color: "#facc15", effect: "pop", effectColor: "#a16207", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "fireOrange", label: "Fire orange", group: "Marks & stickers", hint: "Orange fire — trending", shape: { kind: "octagon", color: "#f97316", effect: "glow", effectColor: "#fb923c", effectIntensity: 45, padX: 22, padY: 6 } },

  /* --- exam focus — new group for admission/medical style plates --- */
  { id: "examRedPill", label: "Exam red pill", group: "Exam focus", hint: "Red pill for exam alerts", shape: { kind: "pill", color: "#dc2626", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examBluePill", label: "Exam blue pill", group: "Exam focus", hint: "Blue pill for class time", shape: { kind: "pill", color: "#2563eb", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examGreenPill", label: "Exam green pill", group: "Exam focus", hint: "Green pill for solved", shape: { kind: "pill", color: "#16a34a", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examYellowPill", label: "Exam yellow pill", group: "Exam focus", hint: "Yellow pill for revision", shape: { kind: "pill", color: "#eab308", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examVioletPill", label: "Exam violet pill", group: "Exam focus", hint: "Violet pill for new chapter", shape: { kind: "pill", color: "#7c3aed", effect: "shadow", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examWhitePill", label: "Exam white pill", group: "Exam focus", hint: "White pill with dark pop", shape: { kind: "pill", color: "#ffffff", effect: "pop", effectColor: "#0f172a", effectIntensity: 40, padX: 22, padY: 6 } },
  { id: "examRibbonRed", label: "Ribbon red", group: "Exam focus", hint: "Red ribbon for top batch", shape: { kind: "ribbon", color: "#dc2626", effect: "lift", effectIntensity: 45, padX: 30, padY: 7 } },
  { id: "examRibbonBlue", label: "Ribbon blue", group: "Exam focus", hint: "Blue ribbon", shape: { kind: "ribbon", color: "#2563eb", effect: "lift", effectIntensity: 45, padX: 30, padY: 7 } },
  { id: "examRibbonGreen", label: "Ribbon green", group: "Exam focus", hint: "Green ribbon", shape: { kind: "ribbon", color: "#16a34a", effect: "lift", effectIntensity: 45, padX: 30, padY: 7 } },
  { id: "examRibbonViolet", label: "Ribbon violet", group: "Exam focus", hint: "Violet ribbon", shape: { kind: "ribbon", color: "#7c3aed", effect: "lift", effectIntensity: 45, padX: 30, padY: 7 } },
  { id: "examArrowRed", label: "Arrow red", group: "Exam focus", hint: "Red arrow banner — next class", shape: { kind: "arrow", color: "#dc2626", effect: "pop", effectColor: "#7f1d1d", effectIntensity: 35, padX: 26, padY: 7 } },
  { id: "examArrowBlue", label: "Arrow blue", group: "Exam focus", hint: "Blue arrow", shape: { kind: "arrow", color: "#2563eb", effect: "pop", effectColor: "#1e3a8a", effectIntensity: 35, padX: 26, padY: 7 } },
  { id: "examFlagGreen", label: "Flag green", group: "Exam focus", hint: "Green flag tag", shape: { kind: "flag", color: "#16a34a", effect: "shadow", effectIntensity: 40, padX: 26, padY: 7 } },
  { id: "examFlagRed", label: "Flag red", group: "Exam focus", hint: "Red flag tag", shape: { kind: "flag", color: "#dc2626", effect: "shadow", effectIntensity: 40, padX: 26, padY: 7 } },
  { id: "examCutBlue", label: "Cut blue", group: "Exam focus", hint: "Cut edge blue plate", shape: { kind: "slantRight", color: "#2563eb", effect: "shadow", effectIntensity: 40, padX: 24, padY: 7 } },
  { id: "examSlantOrange", label: "Slant orange", group: "Exam focus", hint: "Orange slant for batch", shape: { kind: "parallelogram", color: "#f97316", effect: "pop", effectColor: "#7c2d12", effectIntensity: 35, padX: 28, padY: 7 } },
  { id: "examTabSky", label: "Tab sky", group: "Exam focus", hint: "Sky tab with bottom bar", shape: { kind: "tabTop", radius: 10, color: "#0ea5e9", effect: "bottomBar", effectColor: "#0c4a6e", effectIntensity: 50, padX: 20, padY: 8 } },
  { id: "examTabGreen", label: "Tab green", group: "Exam focus", hint: "Green tab", shape: { kind: "tabTop", radius: 10, color: "#16a34a", effect: "bottomBar", effectColor: "#14532d", effectIntensity: 50, padX: 20, padY: 8 } },
  { id: "examCardNavy", label: "Card navy", group: "Exam focus", hint: "Navy card with gold rim", shape: { kind: "rounded", radius: 8, color: "#0f172a", borderColor: "#facc15", borderWidth: 2, effect: "shadow", effectIntensity: 40, padX: 22, padY: 8 } },
  { id: "examCardWhite", label: "Card white", group: "Exam focus", hint: "White card with pop", shape: { kind: "rounded", radius: 10, color: "#ffffff", effect: "pop", effectColor: "#0f172a", effectIntensity: 35, padX: 22, padY: 8 } },
  { id: "examGlass", label: "Glass white", group: "Exam focus", hint: "Glass morphism white", shape: { kind: "rounded", radius: 12, color: "#ffffff", opacity: 30, borderColor: "#ffffff", borderWidth: 1, effect: "glass", effectIntensity: 60, padX: 22, padY: 8 } },
  { id: "examNeon", label: "Neon cyan", group: "Exam focus", hint: "Neon cyan frame", shape: { kind: "rounded", radius: 8, color: "", borderColor: "#22d3ee", borderWidth: 2, effect: "neon", effectIntensity: 60, padX: 20, padY: 8 } },

  /* --- sticker pack — playful stickers like edu thumbnails --- */
  { id: "spNewYellow", label: "NEW yellow", group: "Sticker pack", hint: "NEW burst yellow", shape: { kind: "starburst", color: "#facc15", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: -3, padX: 28, padY: 14 } },
  { id: "spHotRed", label: "HOT red", group: "Sticker pack", hint: "HOT burst red", shape: { kind: "starburst", color: "#ef4444", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: 2, padX: 28, padY: 14 } },
  { id: "spLiveBlue", label: "LIVE blue", group: "Sticker pack", hint: "LIVE blue burst", shape: { kind: "starburst", color: "#3b82f6", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 28, padY: 14 } },
  { id: "spFreeGreen", label: "FREE green", group: "Sticker pack", hint: "FREE green burst", shape: { kind: "starburst", color: "#22c55e", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 28, padY: 14 } },
  { id: "spOfferOrange", label: "OFFER orange", group: "Sticker pack", hint: "OFFER orange burst", shape: { kind: "starburst", color: "#f97316", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 28, padY: 14 } },
  { id: "spSalePink", label: "SALE pink", group: "Sticker pack", hint: "SALE pink burst", shape: { kind: "starburst", color: "#ec4899", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 28, padY: 14 } },
  { id: "spTopViolet", label: "TOP violet", group: "Sticker pack", hint: "TOP violet burst", shape: { kind: "starburst8", color: "#8b5cf6", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 26, padY: 12 } },
  { id: "spBestGold", label: "BEST gold", group: "Sticker pack", hint: "BEST gold burst", shape: { kind: "starburst8", color: "#facc15", gradient: grad(135, "#fde047", "#f59e0b"), effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, padX: 26, padY: 12 } },
  { id: "sp100Green", label: "100% green", group: "Sticker pack", hint: "100% green sticker", shape: { kind: "pill", color: "#22c55e", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: -2, padX: 22, padY: 6 } },
  { id: "spProBlue", label: "PRO blue", group: "Sticker pack", hint: "PRO blue sticker", shape: { kind: "pill", color: "#3b82f6", effect: "sticker", effectColor: "#ffffff", effectIntensity: 60, rotate: 2, padX: 22, padY: 6 } },
  { id: "spVipGold", label: "VIP gold", group: "Sticker pack", hint: "VIP gold sticker", shape: { kind: "pill", color: "#facc15", effect: "sticker", effectColor: "#000000", effectIntensity: 50, rotate: -2, padX: 22, padY: 6 } },
  { id: "spLimitedRed", label: "Limited red", group: "Sticker pack", hint: "Limited red tag", shape: { kind: "tagRight", color: "#ef4444", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, padX: 24, padY: 6 } },
  { id: "spTrendingBlue", label: "Trending blue", group: "Sticker pack", hint: "Trending blue tag", shape: { kind: "tagRight", color: "#0ea5e9", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, padX: 24, padY: 6 } },
  { id: "spUpdatedGreen", label: "Updated green", group: "Sticker pack", hint: "Updated green tag", shape: { kind: "tagRight", color: "#16a34a", effect: "sticker", effectColor: "#ffffff", effectIntensity: 55, padX: 24, padY: 6 } },
  { id: "spNoteYellow", label: "Note yellow", group: "Sticker pack", hint: "Sticky note yellow with fold", shape: { kind: "rect", color: "#fde68a", effect: "cornerFold", effectIntensity: 50, rotate: -2, padX: 18, padY: 10 } },
  { id: "spNotePink", label: "Note pink", group: "Sticker pack", hint: "Sticky note pink", shape: { kind: "rect", color: "#f9a8d4", effect: "cornerFold", effectIntensity: 50, rotate: 2, padX: 18, padY: 10 } },
  { id: "spNoteBlue", label: "Note blue", group: "Sticker pack", hint: "Sticky note blue", shape: { kind: "rect", color: "#93c5fd", effect: "cornerFold", effectIntensity: 50, rotate: -1, padX: 18, padY: 10 } },
  { id: "spNoteGreen", label: "Note green", group: "Sticker pack", hint: "Sticky note green", shape: { kind: "rect", color: "#86efac", effect: "cornerFold", effectIntensity: 50, rotate: 1, padX: 18, padY: 10 } },
  { id: "spTapeTop", label: "Tape top", group: "Sticker pack", hint: "Top tape accent", shape: { kind: "pill", color: "#fde68a", opacity: 80, effect: "topBar", effectColor: "#f59e0b", effectIntensity: 60, rotate: -2, padX: 22, padY: 8 } },
  { id: "spBottomBar", label: "Bottom accent", group: "Sticker pack", hint: "Bottom bar accent", shape: { kind: "rounded", radius: 6, color: "#ffffff", effect: "bottomBar", effectColor: "#ef4444", effectIntensity: 70, padX: 20, padY: 8 } },
  { id: "spLeftBar", label: "Left accent", group: "Sticker pack", hint: "Left bar accent", shape: { kind: "rounded", radius: 6, color: "#ffffff", effect: "leftBar", effectColor: "#22c55e", effectIntensity: 70, padX: 20, padY: 8 } },
  { id: "spRingYellow", label: "Ring yellow", group: "Sticker pack", hint: "Yellow ring tag", shape: { kind: "pill", color: "#facc15", effect: "ring", effectColor: "#a16207", effectIntensity: 50, padX: 22, padY: 6 } },
  { id: "spOffsetWhite", label: "Offset white", group: "Sticker pack", hint: "White with offset outline", shape: { kind: "rounded", radius: 8, color: "#ffffff", effect: "offsetOutline", effectColor: "#0f172a", effectIntensity: 50, padX: 20, padY: 8 } },
  { id: "spStackWhite", label: "Stack white", group: "Sticker pack", hint: "Stacked paper white", shape: { kind: "rounded", radius: 8, color: "#ffffff", effect: "stack", effectIntensity: 45, padX: 20, padY: 8 } },
  { id: "spGlowRed", label: "Glow red", group: "Sticker pack", hint: "Red glow pill", shape: { kind: "pill", color: "#ef4444", effect: "glow", effectIntensity: 60, padX: 22, padY: 6 } },
  { id: "spGlowBlue", label: "Glow blue", group: "Sticker pack", hint: "Blue glow pill", shape: { kind: "pill", color: "#3b82f6", effect: "glow", effectIntensity: 60, padX: 22, padY: 6 } },
  { id: "spGlowGreen", label: "Glow green", group: "Sticker pack", hint: "Green glow pill", shape: { kind: "pill", color: "#22c55e", effect: "glow", effectIntensity: 60, padX: 22, padY: 6 } },
  { id: "spHaloViolet", label: "Halo violet", group: "Sticker pack", hint: "Violet halo", shape: { kind: "pill", color: "#8b5cf6", effect: "halo", effectIntensity: 60, padX: 22, padY: 6 } },
];

export const TEXT_BG_PRESET_BY_ID = new Map(TEXT_BG_PRESETS.map((p) => [p.id, p]));

export const TEXT_BG_PRESET_GROUPS: TextBgPresetGroup[] = ["Bangladesh edu", "Canva classics", "Bold & broadcast", "Soft & minimal", "Marks & stickers", "Exam focus", "Sticker pack"];

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
  "#fde047", "#f472b6", "#86efac", "#7dd3fc", "#fdba74", "#c4b5fd", "#67e8f9", "#bef264",
];
