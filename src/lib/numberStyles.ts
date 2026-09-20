import type { CSSProperties } from "react";
import type { NumberBorderStyle, ThemeSettings } from "./types";
import { shade, withAlpha } from "./color";
import { BULLET_COLOR_NONE, normalizeBulletColor } from "./optionBulletColors";

export type { NumberBorderStyle } from "./types";

/**
 * Numbering designs for the question bullet — the marker every question wears.
 *
 * A design is a pure function of (theme, size, number) → a box, the paint of
 * its silhouette and its digits, so it renders identically on the canvas, in
 * the thumbnails and in PNG / PDF exports. Two layers come out of it:
 *
 *   style    the marker's box — size, centring, padding, nudge
 *   surface  the silhouette itself — fill, outline, corners, shadow, and the
 *            body's own transparency. It is painted on a layer of its own, so
 *            fading the marker never fades the number.
 *
 * The catalogue is data: `NUMBER_STYLES` carries the label, the group, the
 * silhouette (a `clip-path` polygon for the cut shapes) and the look its own
 * paint derives from `theme.accent`. On top of every design the teacher can set
 * their own channels — fill colour, outline colour, outline style, corner
 * radius, outline weight and transparency — through the same tri-state
 * convention the option marker uses:
 *
 *   ""            → auto: the design paints itself
 *   "transparent" → paint nothing there
 *   "#rrggbb"     → the picked colour
 */

export type NumberStyle =
  | "circle" | "ring" | "glow" | "gradient" | "square" | "rounded"
  | "diamond" | "hexagon" | "kite" | "star" | "burst" | "shield"
  | "ribbon" | "banner" | "pill" | "bracket" | "underline" | "bar"
  | "slash" | "none"
  /* silhouettes that answer markers wear all over the place: soft squares,
     chipped cards, coins, arches, stamps, tags, ribbons and star bursts */
  | "squircle" | "coin" | "arch" | "blob" | "cutCorner" | "ticket"
  | "bookmark" | "hexPoint" | "slant" | "step" | "sparkle" | "scallop"
  | "gear" | "speech";

export type NumberStyleCategory = "curve" | "cards" | "polygons" | "seals" | "marks";

export interface NumberStyleDef {
  id: NumberStyle;
  label: string;
  category: NumberStyleCategory;
  hint: string;
  /** the silhouette, in a 0–100 box (x right, y down): cut with clip-path and stroked in SVG */
  points?: [number, number][];
  /** the shape's own corner radius as a fraction of the marker size (box family) */
  radius?: number | string;
  /** the shape's own outline weight as a fraction of the marker size */
  line?: number;
  /** how much wider than tall the marker is (1 = square) */
  aspect?: number;
}

export const NUMBER_STYLE_CATEGORIES: { id: NumberStyleCategory; label: string }[] = [
  { id: "curve", label: "Round & soft" },
  { id: "cards", label: "Cards & chips" },
  { id: "polygons", label: "Polygons" },
  { id: "seals", label: "Seals & stars" },
  { id: "marks", label: "Marks" },
];

/* ------------------------------------------------------------------ */
/*  Silhouettes                                                        */
/* ------------------------------------------------------------------ */

const r1 = (n: number) => Math.round(n * 10) / 10;

const pt = (deg: number, radius: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r1(50 + radius * Math.cos(a)), r1(50 + radius * Math.sin(a))];
};

/** a circle whose edge ripples `count` times — the seal / flower stamp silhouette */
function lobes(count: number, base: number, amplitude: number): [number, number][] {
  const steps = count * 6;
  const out: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const deg = (i * 360) / steps;
    out.push(pt(deg, base + amplitude * Math.cos((count * deg * Math.PI) / 180)));
  }
  return out;
}

/** a cog: flat outer arcs joined by straight tooth walls */
function cog(teeth: number, outer: number, inner: number): [number, number][] {
  const out: [number, number][] = [];
  const span = 360 / teeth;
  const half = span * 0.25;
  const wall = span * 0.12;
  for (let i = 0; i < teeth; i++) {
    const c = i * span;
    out.push(pt(c - half, outer), pt(c + half, outer), pt(c + half + wall, inner), pt(c + span - half - wall, inner));
  }
  return out;
}

export const NUMBER_STYLES: NumberStyleDef[] = [
  /* --- round & soft ------------------------------------------------------ */
  { id: "circle", label: "Circle", category: "curve", hint: "Classic disc with a hairline rim — the default", line: 0.07, radius: "50%" },
  { id: "ring", label: "Ring", category: "curve", hint: "Hollow circle: a bold outline with a tinted centre", line: 0.1, radius: "50%" },
  { id: "coin", label: "Coin", category: "curve", hint: "Disc with an inner rim, like a struck medal", line: 0.05, radius: "50%" },
  { id: "squircle", label: "Squircle", category: "curve", hint: "App-icon square with soft, continuous corners", radius: 0.34 },
  { id: "arch", label: "Arch", category: "curve", hint: "Tombstone: round shoulders, flat base", radius: "50% 50% 8% 8% / 46% 46% 8% 8%", line: 0.05 },
  { id: "blob", label: "Blob", category: "curve", hint: "Organic, hand-pulled curve", radius: "42% 58% 63% 37% / 46% 41% 59% 54%" },
  { id: "gradient", label: "Gradient", category: "curve", hint: "Glossy sphere lit from the top left", radius: "50%" },
  { id: "glow", label: "Glow", category: "curve", hint: "Soft halo with no hard edge", radius: "50%" },

  /* --- cards & chips ----------------------------------------------------- */
  { id: "square", label: "Square", category: "cards", hint: "Crisp architectural tile" },
  { id: "rounded", label: "Rounded", category: "cards", hint: "Soft-cornered card", radius: 0.3 },
  { id: "pill", label: "Pill", category: "cards", hint: "Capsule label — wide, stadium ends", radius: 999, aspect: 1.6 },
  { id: "cutCorner", label: "Cut corner", category: "cards", hint: "Card with its top-right corner sliced off", points: [[0, 0], [74, 0], [100, 26], [100, 100], [0, 100]] },
  { id: "ticket", label: "Ticket", category: "cards", hint: "Admit-one stub with side notches", points: [[0, 0], [100, 0], [100, 36], [93, 50], [100, 64], [100, 100], [0, 100], [0, 64], [7, 50], [0, 36]], aspect: 1.3 },
  { id: "bookmark", label: "Bookmark", category: "cards", hint: "Tab with a V cut out of its base", points: [[0, 0], [100, 0], [100, 100], [50, 76], [0, 100]] },
  { id: "speech", label: "Speech", category: "cards", hint: "Bubble with a tail at the bottom left", points: [[0, 0], [100, 0], [100, 78], [32, 78], [18, 98], [18, 78], [0, 78]], aspect: 1.15 },

  /* --- polygons ---------------------------------------------------------- */
  { id: "diamond", label: "Diamond", category: "polygons", hint: "45° rhombus", points: [[50, 0], [100, 50], [50, 100], [0, 50]] },
  { id: "hexagon", label: "Hexagon", category: "polygons", hint: "Six sides, flat top and base", points: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]] },
  { id: "hexPoint", label: "Hexagon ▲", category: "polygons", hint: "Six sides standing on a point", points: [[50, 0], [100, 25], [100, 75], [50, 100], [0, 75], [0, 25]] },
  { id: "kite", label: "Kite", category: "polygons", hint: "Tall rhombus with a high waist", points: [[50, 0], [100, 38], [50, 100], [0, 38]] },
  { id: "shield", label: "Shield", category: "polygons", hint: "Heraldic crest with a pointed base", points: [[50, 0], [100, 12], [100, 62], [50, 100], [0, 62], [0, 12]] },
  { id: "slant", label: "Slant", category: "polygons", hint: "Parallelogram swept to the right", points: [[14, 0], [100, 0], [86, 100], [0, 100]] },
  { id: "step", label: "Step", category: "polygons", hint: "Chevron chip — a step in a sequence", points: [[0, 0], [74, 0], [100, 50], [74, 100], [0, 100], [26, 50]], aspect: 1.25 },
  { id: "ribbon", label: "Ribbon", category: "polygons", hint: "Award ribbon with notched ends", points: [[0, 0], [100, 0], [92, 50], [100, 100], [0, 100], [8, 50]], aspect: 1.3 },
  { id: "banner", label: "Banner", category: "polygons", hint: "Flag with a swallow-tail base", points: [[0, 0], [100, 0], [100, 100], [55, 100], [50, 82], [45, 100], [0, 100]], aspect: 1.25 },

  /* --- seals & stars ----------------------------------------------------- */
  { id: "star", label: "Star", category: "seals", hint: "Five-point achievement star", points: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]] },
  { id: "sparkle", label: "Sparkle", category: "seals", hint: "Four-point glint", points: [[50, 0], [57, 40], [100, 50], [57, 60], [50, 100], [43, 60], [0, 50], [43, 40]] },
  { id: "burst", label: "Burst", category: "seals", hint: "Sixteen-point certification rosette", points: [[50, 0], [59, 12], [73, 6], [76, 20], [91, 20], [88, 34], [100, 42], [91, 54], [98, 68], [84, 72], [84, 88], [70, 84], [62, 97], [50, 87], [38, 97], [30, 84], [16, 88], [16, 72], [2, 68], [9, 54], [0, 42], [12, 34], [9, 20], [24, 20], [27, 6], [41, 12]] },
  { id: "scallop", label: "Scallop", category: "seals", hint: "Twelve-lobed stamp", points: lobes(12, 43, 6) },
  { id: "gear", label: "Gear", category: "seals", hint: "Cog with eight flat teeth", points: cog(8, 49, 38) },

  /* --- marks ------------------------------------------------------------- */
  { id: "bracket", label: "Bracket", category: "marks", hint: "Corner rule holding the number" },
  { id: "underline", label: "Underline", category: "marks", hint: "A rule instead of a shape" },
  { id: "bar", label: "Bar", category: "marks", hint: "A slim vertical bar beside the question" },
  { id: "slash", label: "Slashed", category: "marks", hint: "Number with a slanted tick", aspect: 1.15 },
  { id: "none", label: "None", category: "marks", hint: "No marker at all" },
];

const DEF_BY_ID = new Map<NumberStyle, NumberStyleDef>(NUMBER_STYLES.map((d) => [d.id, d]));

export const numberStyleDef = (id: NumberStyle): NumberStyleDef => DEF_BY_ID.get(id) ?? NUMBER_STYLES[0];

export const DEFAULT_NUMBER_STYLE: NumberStyle = "circle";

/** styles whose box is wider than it is tall */
export const numberStyleAspect = (id: NumberStyle): number => numberStyleDef(id).aspect ?? 1;
export const isWideNumberStyle = (id: NumberStyle) => numberStyleAspect(id) > 1;

/** the corners the design itself draws, in px — the "auto" end of the radius control */
export function numberStyleRadius(id: NumberStyle, size: number): number {
  const r = numberStyleDef(id).radius;
  if (r === undefined) return 0;
  if (typeof r === "number") return Math.round(r >= 999 ? size / 2 : r * size);
  return Math.round(size / 2);
}

/** the outline weight the design itself draws, in px — the "auto" end of the weight control */
export const numberStyleLineWeight = (id: NumberStyle, size: number): number => {
  const l = numberStyleDef(id).line;
  return l === undefined ? 0 : Math.round(Math.max(1.5, l * size) * 10) / 10;
};

/** designs that show no number */
const BLANK: NumberStyle[] = ["underline", "bar", "none"];
export const showsNumber = (id: NumberStyle) => !BLANK.includes(id);

/** the silhouette's points, when the design is cut with clip-path */
export const numberStylePoints = (id: NumberStyle): [number, number][] | undefined => numberStyleDef(id).points;

export const polygonPointsAttr = (points: [number, number][]): string => points.map(([x, y]) => `${x},${y}`).join(" ");

/** a polygon pulled towards its centre — the second line of a double outline */
export const insetPoints = (points: [number, number][], scale: number): [number, number][] =>
  points.map(([x, y]) => [r1(50 + (x - 50) * scale), r1(50 + (y - 50) * scale)]);

/** dash pattern for a stroked silhouette (SVG stroke-dasharray) */
export function strokeDash(style: NumberBorderStyle, width: number): string | undefined {
  const w = Math.max(1, width);
  if (style === "dashed") return `${r1(w * 3)} ${r1(w * 2)}`;
  if (style === "dotted") return `0.1 ${r1(w * 2)}`;
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Render                                                            */
/* ------------------------------------------------------------------ */

/** the outline of a cut silhouette, stroked over it as an SVG polygon */
export interface NumberOutline {
  points: [number, number][];
  /** line weight in px */
  width: number;
  color: string;
  /** "solid" · "dashed" · "dotted" · "double" */
  style: NumberBorderStyle;
  /** stroke-dasharray, when the line is dashed or dotted */
  dash?: string;
}

export interface NumberRender {
  /** the marker's box: size, centring, padding, nudge */
  style: CSSProperties;
  /** the silhouette's paint — fill, line, corners, shadow, body transparency */
  surface: CSSProperties;
  /** the perimeter of a cut silhouette, stroked over it in SVG */
  outline?: NumberOutline;
  /** decorative marks painted inside the box (the slashed design's tick) */
  marks?: CSSProperties[];
  /** text drawn inside (already resolved against showNumber) */
  content: string;
  /** font size as a factor of the marker size */
  fontScale: number;
  color: string;
  /** how much wider than tall the box is */
  aspect: number;
}

/** one design's own paint, before the teacher's channels are applied over it */
interface Draft {
  style: CSSProperties;
  surface: CSSProperties;
  /** the line the design itself draws (its colour and weight) */
  line?: { color: string; width: number; sides?: "left-bottom" };
  /** the text drawn inside (already resolved against showNumber) */
  content: string;
  color: string;
  fontScale: number;
  aspect: number;
  marks?: CSSProperties[];
}

export function renderNumberStyle(
  id: NumberStyle,
  theme: ThemeSettings,
  size: number,
  rawNumber: string,
): NumberRender {
  const accent = theme.accent;
  const text = theme.showNumber && showsNumber(id) ? rawNumber : "";
  const def = numberStyleDef(id);
  const aspect = def.aspect ?? 1;
  const wide = aspect > 1 ? size * aspect : size;

  const box = (w: number, h: number, font: number): CSSProperties => ({
    width: w,
    height: h,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    position: "relative",
    fontWeight: 700,
    fontSize: font,
    lineHeight: 1,
    boxSizing: "border-box",
  });

  const draft = ((): Draft => {
    switch (id) {
      case "none":
        return { style: { display: "none" }, surface: {}, content: "", color: accent, fontScale: 0, aspect: 1 };

      case "circle":
        return {
          style: box(size, size, Math.round(size * 0.44)),
          surface: {
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 28%, ${shade(accent, 0.45)}, ${accent} 70%)`,
            boxShadow: `0 0 0 2px ${withAlpha("#000000", 0.55)}, 0 4px 12px ${withAlpha(accent, 0.5)}`,
          },
          line: { color: "#ffffff", width: Math.max(2, size * 0.07) },
          content: text, fontScale: 0.44, color: "#ffffff", aspect: 1,
        };

      case "ring":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: { borderRadius: "50%", background: withAlpha(accent, 0.14), boxShadow: `0 0 14px ${withAlpha(accent, 0.4)}` },
          line: { color: accent, width: Math.max(3, size * 0.1) },
          content: text, fontScale: 0.42, color: accent, aspect: 1,
        };

      case "coin":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: "50%",
            background: `radial-gradient(circle at 34% 26%, ${shade(accent, 0.4)}, ${accent} 72%)`,
            boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.045)}px ${withAlpha("#ffffff", 0.85)}, inset 0 0 0 ${Math.max(4, size * 0.09)}px ${withAlpha("#000000", 0.18)}, 0 4px 12px ${withAlpha(accent, 0.45)}`,
          },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "glow":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 25%, ${withAlpha(accent, 0.5)}, ${withAlpha(accent, 0.1)} 72%)`,
            boxShadow: `0 0 ${size * 0.45}px ${withAlpha(accent, 0.6)}`,
          },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "gradient":
        return {
          style: box(size, size, Math.round(size * 0.44)),
          surface: {
            borderRadius: "50%",
            background: `linear-gradient(145deg, ${shade(accent, 0.42)}, ${accent} 55%, ${shade(accent, -0.25)})`,
            boxShadow: `0 5px 14px ${withAlpha(accent, 0.5)}`,
          },
          content: text, fontScale: 0.44, color: "#ffffff", aspect: 1,
        };

      case "squircle":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: `${Math.round(size * 0.34)}px`,
            background: `linear-gradient(150deg, ${shade(accent, 0.34)}, ${accent} 70%)`,
            boxShadow: `0 5px 14px ${withAlpha(accent, 0.45)}`,
          },
          line: { color: withAlpha("#ffffff", 0.5), width: Math.max(1.5, size * 0.045) },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "arch":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: "50% 50% 8% 8% / 46% 46% 8% 8%",
            background: `linear-gradient(180deg, ${shade(accent, 0.3)}, ${accent} 78%)`,
            boxShadow: `0 4px 12px ${withAlpha(accent, 0.45)}`,
          },
          line: { color: withAlpha("#ffffff", 0.55), width: Math.max(1.5, size * 0.05) },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "blob":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: "42% 58% 63% 37% / 46% 41% 59% 54%",
            background: `linear-gradient(140deg, ${shade(accent, 0.32)}, ${accent})`,
            boxShadow: `0 4px 12px ${withAlpha(accent, 0.4)}`,
          },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "square":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: { background: accent, boxShadow: `0 3px 10px ${withAlpha(accent, 0.5)}` },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "rounded":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {
            borderRadius: `${Math.round(size * 0.3)}px`,
            background: `linear-gradient(140deg, ${shade(accent, 0.3)}, ${accent})`,
            boxShadow: `0 4px 12px ${withAlpha(accent, 0.5)}`,
          },
          content: text, fontScale: 0.42, color: "#ffffff", aspect: 1,
        };

      case "pill":
        return {
          style: box(wide, size, Math.round(size * 0.4)),
          surface: {
            borderRadius: 999,
            background: `linear-gradient(135deg, ${shade(accent, 0.28)}, ${accent})`,
            boxShadow: `0 4px 14px ${withAlpha(accent, 0.45)}`,
          },
          line: { color: withAlpha("#ffffff", 0.45), width: Math.max(1.5, size * 0.04) },
          content: text, fontScale: 0.4, color: "#ffffff", aspect: 1.6,
        };

      case "cutCorner":
      case "ticket":
      case "bookmark":
      case "speech":
      case "diamond":
      case "hexagon":
      case "hexPoint":
      case "kite":
      case "star":
      case "sparkle":
      case "burst":
      case "scallop":
      case "gear":
      case "shield":
      case "slant":
      case "step":
      case "ribbon":
      case "banner": {
        const clip = `polygon(${(def.points ?? []).map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
        return {
          style: {
            ...box(wide, size, Math.round(size * (id === "star" ? 0.5 : id === "sparkle" ? 0.46 : id === "kite" ? 0.36 : id === "burst" ? 0.32 : 0.4))),
            paddingLeft: id === "star" || id === "burst" || id === "scallop" || id === "gear" ? Math.round(size * 0.08) : 0,
            paddingRight: id === "gear" || id === "scallop" ? Math.round(size * 0.08) : 0,
            paddingTop: id === "sparkle" || id === "hexPoint" ? Math.round(size * 0.1) : 0,
            paddingBottom: id === "banner" ? Math.round(size * 0.16) : id === "bookmark" ? Math.round(size * 0.08) : id === "sparkle" ? Math.round(size * 0.08) : 0,
          },
          surface: {
            clipPath: clip,
            background: `linear-gradient(150deg, ${shade(accent, 0.32)}, ${accent})`,
          },
          content: text,
          fontScale: id === "star" ? 0.5 : id === "sparkle" ? 0.46 : id === "kite" ? 0.36 : id === "burst" ? 0.32 : 0.4,
          color: "#ffffff",
          aspect,
        };
      }

      case "bracket":
        return {
          style: { ...box(size * 0.75, size, Math.round(size * 0.42)), justifyContent: "flex-end", paddingRight: Math.round(size * 0.1) },
          surface: { borderRadius: `0 0 0 ${Math.round(size * 0.3)}px` },
          line: { color: accent, width: Math.max(3, size * 0.1), sides: "left-bottom" },
          content: text, fontScale: 0.42, color: accent, aspect: 1,
        };

      case "underline":
        return {
          style: box(size, Math.max(5, size * 0.14), 0),
          surface: {
            borderRadius: 999,
            background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.2)})`,
          },
          content: "", fontScale: 0, color: accent, aspect: 1,
        };

      case "bar":
        return {
          style: box(Math.max(6, size * 0.18), size * 1.05, 0),
          surface: {
            borderRadius: 999,
            background: `linear-gradient(180deg, ${shade(accent, 0.32)}, ${accent})`,
            boxShadow: `0 3px 10px ${withAlpha(accent, 0.45)}`,
          },
          content: "", fontScale: 0, color: accent, aspect: 0.2,
        };

      case "slash":
        return {
          style: { ...box(wide, size, Math.round(size * 0.46)), gap: Math.round(size * 0.12), justifyContent: "flex-start", paddingLeft: Math.round(size * 0.06) },
          surface: {},
          content: text, fontScale: 0.46, color: accent, aspect: 1.15,
          marks: [
            {
              position: "absolute",
              right: Math.round(size * 0.12),
              top: Math.round(size * 0.08),
              width: Math.max(2, size * 0.05),
              height: Math.round(size * 0.84),
              background: `linear-gradient(160deg, ${shade(accent, 0.3)}, ${accent})`,
              transform: "rotate(22deg)",
              borderRadius: 999,
            },
          ],
        };

      default:
        return { style: { display: "none" }, surface: {}, content: "", color: accent, fontScale: 0, aspect: 1 };
    }
  })();

  const surface: CSSProperties = { ...draft.surface };
  const outline = applyChannels(def, draft, theme, size, surface, accent);
  const style: CSSProperties = { ...draft.style };
  const nudge = nudgeOf(theme);
  if (nudge) style.transform = nudge;

  return {
    style,
    surface,
    content: draft.content,
    fontScale: draft.fontScale,
    color: draft.color,
    aspect: draft.aspect,
    outline,
    marks: draft.marks,
  };
}

/* ------------------------------------------------------------------ */
/*  The teacher's channels                                             */
/* ------------------------------------------------------------------ */

/** the whole marker shifted by the position nudge (works attached or detached) */
function nudgeOf(theme: ThemeSettings): string | undefined {
  const x = theme.bulletNudgeX ?? 0;
  const y = theme.bulletNudgeY ?? 0;
  if (!x && !y) return undefined;
  return `translate(${x}px, ${y}px)`;
}

const cssLineStyle = (style: NumberBorderStyle): "solid" | "dashed" | "dotted" | "double" =>
  style === "dashed" || style === "dotted" || style === "double" ? style : "solid";

/**
 * Multiply a colour's own alpha — the design's lines are a mix of hex and
 * `rgba()`, and fading the body has to work for both.
 */
function fadeColor(color: string, opacity: number): string {
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (!rgba) return withAlpha(color, opacity);
  const parts = rgba[1].split(",").map((p) => p.trim());
  const alpha = parts.length > 3 ? Number(parts[3]) : 1;
  const a = Number.isFinite(alpha) ? alpha : 1;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${Math.round(a * opacity * 1000) / 1000})`;
}

/**
 * Apply the marker's own channels over the design's paint and return the
 * perimeter stroke for cut silhouettes. A design's line is always the
 * fallback, so picking only a weight (or only a dash) keeps the colour the
 * design was drawn with, and picking nothing at all leaves it untouched.
 */
function applyChannels(
  def: NumberStyleDef,
  draft: Draft,
  theme: ThemeSettings,
  size: number,
  surface: CSSProperties,
  accent: string,
): NumberOutline | undefined {
  const style = theme.bulletBorderStyle ?? "auto";
  const ring = normalizeBulletColor(theme.bulletBorder);
  const weight = theme.bulletBorderWeight;
  const off = style === "none" || ring === BULLET_COLOR_NONE;
  const asked = !!ring || weight !== undefined || style !== "auto";
  const line = draft.line;

  /* --- fill ------------------------------------------------------------- */
  const fill = normalizeBulletColor(theme.bulletFill);
  if (fill === BULLET_COLOR_NONE) delete surface.background;
  else if (fill) surface.background = fill;

  /* --- corners ---------------------------------------------------------- */
  const radius = theme.bulletRadius;
  if (radius !== undefined && radius !== null && !def.points) surface.borderRadius = `${Math.max(0, radius)}px`;

  /* --- body transparency (the number keeps its own ink) ------------------ */
  const opacity = theme.bulletOpacity;
  const faded = opacity !== undefined && opacity !== null && opacity < 100;
  if (faded) surface.opacity = Math.max(0, opacity) / 100;

  if (off) {
    delete surface.border;
    delete surface.borderLeft;
    delete surface.borderBottom;
    return undefined;
  }

  if (!line && !asked) return undefined;

  const color = ring ?? line?.color ?? shade(accent, 0.5);
  const width = weight ?? line?.width ?? Math.max(1.5, size * 0.06);
  /** the body's transparency fades its line with it (the number stays crisp) */
  const ink = faded ? fadeColor(color, Math.max(0, (opacity ?? 100) / 100)) : color;

  if (def.points) {
    const stroke: NumberOutline = { points: def.points, width, color: ink, style: style === "auto" ? "solid" : style };
    stroke.dash = strokeDash(stroke.style, width);
    return stroke;
  }

  if (line?.sides === "left-bottom") {
    surface.borderLeft = `${width}px ${cssLineStyle(style)} ${ink}`;
    surface.borderBottom = `${width}px ${cssLineStyle(style)} ${ink}`;
  } else {
    surface.border = `${width}px ${cssLineStyle(style)} ${ink}`;
  }
  return undefined;
}
