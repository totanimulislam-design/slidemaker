import type { CSSProperties } from "react";
import type { Gradient, NumberBorderStyle, ThemeSettings } from "./types";
import { shade, withAlpha } from "./color";
import { gradientCss } from "./banner";
import { bulletEffectPaint, type BulletEffectPaint } from "./bulletEffects";
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
 * paint derives from `theme.accent`. It opens with the two families the
 * **Bullet point presets** tab lists — the classic **bullet points** (dot,
 * hollow dot, square, dash, arrowhead, check…), which stand in for the number
 * the way a list bullet does, and the **numbering** presets ("7." · "(7)" ·
 * "Q7" · "07"), which keep the number and add its punctuation — followed by
 * the marker **shapes** the *Shape* tab lists (`NUMBER_SHAPES`): round & soft,
 * cards & chips, polygons, arrows, seals & stars, callouts, flowchart, the
 * sticker pack and the marks. Picking a shape changes the silhouette only; the
 * paint the teacher has set stays. On top of every design the teacher can set
 * their own channels — fill colour, outline colour, outline style, corner
 * radius, outline weight and transparency — through the same tri-state
 * convention the option marker uses:
 *
 *   ""            → auto: the design paints itself
 *   "transparent" → paint nothing there
 *   "#rrggbb"     → the picked colour
 */

export type NumberStyle =
  /* classic bullet points — the list bullets every slide tool's "Bullets"
     preset row offers (they replace the number, like a bullet does) */
  | "dot" | "hollowDot" | "squareDot" | "hollowSquare" | "diamondDot" | "triangleDot"
  | "dash" | "arrowhead" | "chevron" | "check" | "starDot"
  /* numbering presets — the number with its own punctuation, no shape */
  | "numDot" | "numParen" | "numParens" | "numColon" | "numZero" | "numQ" | "numHash" | "numBar"
  | "circle" | "ring" | "glow" | "gradient" | "square" | "rounded"
  | "diamond" | "hexagon" | "kite" | "star" | "burst" | "shield"
  | "ribbon" | "banner" | "pill" | "bracket" | "underline" | "bar"
  | "slash" | "none"
  /* silhouettes that answer markers wear all over the place: soft squares,
     chipped cards, coins, arches, stamps, tags, ribbons and star bursts */
  | "squircle" | "coin" | "arch" | "blob" | "cutCorner" | "ticket"
  | "bookmark" | "hexPoint" | "slant" | "step" | "sparkle" | "scallop"
  | "gear" | "speech"
  /* round & soft, extended */
  | "disc" | "doubleRing" | "dottedRing" | "target" | "drop" | "leaf" | "cloud" | "wavy"
  /* cards & chips, extended */
  | "tab" | "tag" | "coupon" | "stamp" | "washi" | "notch"
  /* polygons, extended */
  | "triangle" | "triangleDown" | "trapezoid" | "pentagon" | "octagon" | "cross" | "arrowRight" | "hourglass"
  /* seals & stars, extended */
  | "rosette" | "capSeal" | "star6" | "star8" | "sunburst" | "medal"
  /* stickers & icons — the classroom sticker pack */
  | "bulb" | "book" | "gradCap" | "trophy" | "bolt" | "flame" | "rocket"
  | "crown" | "heart" | "pin" | "bubbleRound"
  /* marks, extended */
  | "brackets" | "dots3" | "cornerTick"
  /* round & soft — the shape families of a proper shape library */
  | "oval" | "egg" | "dome" | "lens" | "softTriangle" | "softDiamond" | "softHexagon"
  /* cards & chips, the label family */
  | "plaque" | "frame" | "chamfer" | "folder" | "tagLeft" | "label" | "slot"
  /* polygons: every regular polygon and the slanted / mirrored cuts */
  | "rightTriangle" | "heptagon" | "nonagon" | "decagon" | "dodecagon" | "rhombus"
  | "slantLeft" | "trapezoidDown" | "stepLeft" | "house" | "gem" | "hexWide"
  /* arrows — block arrows in every direction */
  | "arrowLeft" | "arrowUp" | "arrowDown" | "blockRight" | "blockLeft" | "arrowBoth"
  | "arrowUpDown" | "notchedArrow" | "triangleRight" | "triangleLeft"
  /* seals & stars, extended */
  | "star4" | "star7" | "star10" | "star16" | "explosion" | "flower" | "softStar"
  /* callouts — a plate with a tail on each side */
  | "calloutDown" | "calloutUp" | "calloutLeft" | "calloutRight" | "roundCallout"
  /* flowchart — the diagram symbols */
  | "document" | "delay" | "display" | "manualInput" | "offPage" | "cylinder" | "subroutine" | "loopLimit"
  /* stickers, extended */
  | "bell" | "lock" | "flask" | "trefoil" | "quatrefoil"
  /* marks, extended */
  | "parens";

export type NumberStyleCategory =
  | "bullets"
  | "numbering"
  | "curve"
  | "cards"
  | "polygons"
  | "arrows"
  | "seals"
  | "callouts"
  | "flowchart"
  | "stickers"
  | "marks";

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
  /** the colour of that line (default: a half-white rim over the fill) */
  lineColor?: (accent: string) => string;
  /** how much wider than tall the marker is (1 = square) */
  aspect?: number;
  /** the number's size as a factor of the marker size (default 0.4) */
  font?: number;
  /** room the silhouette wants around the number, as factors of the size: [top, right, bottom, left] */
  pad?: [number, number, number, number];
  /** the silhouette's own paint, over the shared default (a gloss, a rim, rings…) */
  paint?: (accent: string, size: number) => CSSProperties;
  /** the number's own ink when the design paints a light body (default white) */
  ink?: (accent: string) => string;
  /** force the box path (CSS corners) for a design with no `points` of its own */
  generic?: boolean;
  /**
   * a numbering preset: the number is painted with its own punctuation
   * ("7." · "(7)" · "Q7" · "07") and no shape at all
   */
  format?: (number: string) => string;
}

export const NUMBER_STYLE_CATEGORIES: { id: NumberStyleCategory; label: string }[] = [
  { id: "bullets", label: "Bullet points" },
  { id: "numbering", label: "Numbering" },
  { id: "curve", label: "Round & soft" },
  { id: "cards", label: "Cards & chips" },
  { id: "polygons", label: "Polygons" },
  { id: "arrows", label: "Arrows" },
  { id: "seals", label: "Seals & stars" },
  { id: "callouts", label: "Callouts" },
  { id: "flowchart", label: "Flowchart" },
  { id: "stickers", label: "Stickers & icons" },
  { id: "marks", label: "Marks" },
];

/**
 * The two families that are *presets* rather than shapes — the classic bullet
 * points and the numbering formats. They are listed on the Bullet point
 * presets tab next to the one-click looks (`lib/bulletStyles`); every other
 * category is a marker **shape** and is listed on the Shape tab.
 */
export const PRESET_CATEGORIES: NumberStyleCategory[] = ["bullets", "numbering"];
export const isPresetCategory = (c: NumberStyleCategory) => PRESET_CATEGORIES.includes(c);

/** the Shape tab's groups — every family except the two preset ones */
export const SHAPE_CATEGORIES = NUMBER_STYLE_CATEGORIES.filter((c) => !isPresetCategory(c.id));

/* ------------------------------------------------------------------ */
/*  Silhouettes                                                        */
/* ------------------------------------------------------------------ */

const r1 = (n: number) => Math.round(n * 10) / 10;

const pt = (deg: number, radius: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r1(50 + radius * Math.cos(a)), r1(50 + radius * Math.sin(a))];
};

/**
 * a circle whose edge ripples `count` times — the seal / flower stamp
 * silhouette; `per` points per lobe, and `phase` turns the first lobe (0 = it
 * points right, 90 = it points up)
 */
function lobes(count: number, base: number, amplitude: number, per = 6, phase = 0): [number, number][] {
  const steps = count * per;
  const out: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const deg = (i * 360) / steps;
    out.push(pt(deg, base + amplitude * Math.cos((count * (deg + phase) * Math.PI) / 180)));
  }
  return out;
}

/**
 * The same polygon with its corners rounded off: every vertex becomes a short
 * arc (a quadratic curve from one edge onto the next, `steps` points long),
 * pulled in by at most `radius` — the soft triangle, diamond, hexagon, star and
 * the rounded callout come out of it.
 */
function soften(points: [number, number][], radius: number, steps = 4): [number, number][] {
  const n = points.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[(i - 1 + n) % n];
    const b = points[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const d = Math.min(radius, da / 2, db / 2);
    const t1 = [p[0] + ((a[0] - p[0]) / da) * d, p[1] + ((a[1] - p[1]) / da) * d];
    const t2 = [p[0] + ((b[0] - p[0]) / db) * d, p[1] + ((b[1] - p[1]) / db) * d];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push([r1(u * u * t1[0] + 2 * u * t * p[0] + t * t * t2[0]), r1(u * u * t1[1] + 2 * u * t * p[1] + t * t * t2[1])]);
    }
  }
  return out;
}

/** a burst whose spikes are all different lengths — the comic "explosion" */
function jagged(outers: number[], inner: number): [number, number][] {
  const n = outers.length;
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    out.push(pt(-90 + (k * 360) / n, outers[k]));
    out.push(pt(-90 + ((k + 0.5) * 360) / n, inner + (k % 3) * 3));
  }
  return out;
}

/** a rectangle whose four corners are scooped inwards — the plaque / certificate plate */
function plaque(r: number, steps = 5): [number, number][] {
  const corners: [number, number, number][] = [[0, 0, 90], [100, 0, 180], [100, 100, 270], [0, 100, 360]];
  const out: [number, number][] = [];
  for (const [cx, cy, from] of corners) {
    for (let k = 0; k <= steps; k++) {
      const a = ((from - (90 * k) / steps) * Math.PI) / 180;
      out.push([r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))]);
    }
  }
  return out;
}

/** two arcs meeting at the sides — a lens / eye, `bulge` tall above the middle line */
function lens(bulge: number, steps = 14): [number, number][] {
  const R = (2500 + bulge * bulge) / (2 * bulge);
  const c = R - bulge;
  const upper: [number, number][] = [];
  for (let k = 0; k <= steps; k++) {
    const x = (k * 100) / steps;
    upper.push([r1(x), r1(50 + c - Math.sqrt(Math.max(0, R * R - (x - 50) * (x - 50))))]);
  }
  const lower = upper.slice(1, -1).reverse().map(([x, y]): [number, number] => [x, r1(100 - y)]);
  return [...upper, ...lower];
}

/** a sheet whose bottom edge waves — the flowchart "document" */
function documentSheet(): [number, number][] {
  const out: [number, number][] = [[0, 0], [100, 0]];
  for (let k = 10; k >= 0; k--) {
    const x = k * 10;
    out.push([x, r1(86 + 8 * Math.sin((2 * Math.PI * x) / 100))]);
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

/** a regular polygon standing on a point (rot −90°) or on a flat base */
function poly(sides: number, radius = 48, rot = -90): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < sides; k++) out.push(pt(rot + (k * 360) / sides, radius));
  return out;
}

/** an n-pointed star — the award / burst family */
function starPoints(points: number, outer = 49, inner = 20, rot = -90): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < points * 2; k++) out.push(pt(rot + (k * 180) / points, k % 2 === 0 ? outer : inner));
  return out;
}

/** a rectangle whose four edges bite in and out — a perforated stamp edge */
function zigRect(teeth: number, amp: number): [number, number][] {
  const corners: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const out: [number, number][] = [];
  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let k = 0; k < teeth; k++) {
      out.push([r1(a[0] + dx * (k / teeth)), r1(a[1] + dy * (k / teeth))]);
      out.push([r1(a[0] + dx * ((k + 0.5) / teeth) + nx * amp), r1(a[1] + dy * ((k + 0.5) / teeth) + ny * amp)]);
    }
  }
  return out;
}

/** a band with torn (zig-zag) short ends — washi tape, a stub, a coupon */
function tornBand(zigs: number, amp: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k <= zigs; k++) {
    const y = (k * 100) / zigs;
    out.push([k % 2 === 0 ? 0 : amp, r1(y)]);
  }
  for (let k = zigs; k >= 0; k--) {
    const y = (k * 100) / zigs;
    out.push([k % 2 === 0 ? 100 : 100 - amp, r1(y)]);
  }
  return out;
}

/* hand-authored silhouettes, in the same 0–100 box */
const DROP: [number, number][] = [[50, 2], [61, 24], [74, 42], [83, 58], [86, 70], [80, 84], [66, 94], [50, 97], [34, 94], [20, 84], [14, 70], [17, 58], [26, 42], [39, 24]];
const LEAF: [number, number][] = [[4, 96], [12, 58], [30, 28], [56, 8], [94, 2], [90, 40], [72, 70], [44, 90]];
const CLOUD: [number, number][] = [[16, 82], [6, 72], [4, 58], [12, 47], [23, 45], [27, 31], [41, 23], [55, 27], [63, 19], [77, 21], [86, 33], [96, 39], [98, 55], [91, 68], [92, 82]];
const HEART: [number, number][] = [[50, 94], [26, 72], [10, 56], [4, 40], [6, 26], [16, 16], [28, 14], [38, 20], [46, 30], [50, 36], [54, 30], [62, 20], [72, 14], [84, 16], [94, 26], [96, 40], [90, 56], [74, 72]];
const BULB: [number, number][] = [[50, 2], [66, 8], [78, 20], [82, 36], [76, 52], [68, 62], [68, 76], [60, 86], [40, 86], [32, 76], [32, 62], [24, 52], [18, 36], [22, 20], [34, 8]];
const BOOK: [number, number][] = [[4, 10], [50, 2], [96, 10], [96, 82], [50, 96], [4, 82]];
const GRADCAP: [number, number][] = [[50, 4], [99, 28], [78, 38], [78, 62], [50, 78], [22, 62], [22, 38], [1, 28]];
const TROPHY: [number, number][] = [[22, 4], [78, 4], [74, 28], [64, 44], [57, 50], [57, 64], [72, 72], [76, 92], [24, 92], [28, 72], [43, 64], [43, 50], [36, 44], [26, 28]];
const BOLT: [number, number][] = [[60, 0], [24, 52], [44, 52], [36, 100], [76, 42], [54, 42], [72, 0]];
const FLAME: [number, number][] = [[50, 2], [68, 26], [82, 48], [84, 68], [74, 88], [56, 97], [38, 95], [22, 82], [16, 62], [24, 42], [38, 24], [46, 36], [52, 18]];
const ROCKET: [number, number][] = [[50, 0], [64, 16], [72, 36], [74, 58], [88, 74], [72, 74], [66, 92], [50, 84], [34, 92], [28, 74], [12, 74], [26, 58], [28, 36], [36, 16]];
const CROWN: [number, number][] = [[4, 88], [8, 32], [28, 54], [40, 18], [50, 44], [60, 18], [72, 54], [92, 32], [96, 88]];
const PIN: [number, number][] = [[50, 0], [70, 8], [84, 24], [86, 46], [70, 68], [56, 92], [50, 100], [44, 92], [30, 68], [14, 46], [16, 24], [30, 8]];
const BUBBLEROUND: [number, number][] = [[50, 2], [78, 10], [95, 30], [96, 54], [84, 74], [64, 86], [40, 88], [26, 98], [24, 84], [10, 70], [4, 50], [12, 28], [28, 12]];
const MEDAL: [number, number][] = [[50, 0], [70, 5], [86, 18], [94, 38], [92, 58], [82, 74], [88, 100], [68, 92], [50, 99], [32, 92], [12, 100], [18, 74], [8, 58], [6, 38], [14, 18], [30, 5]];
const TAG: [number, number][] = [[0, 0], [72, 0], [100, 50], [72, 100], [0, 100]];
const COUPON: [number, number][] = [[0, 0], [100, 0], [100, 38], [94, 44], [94, 56], [100, 62], [100, 100], [0, 100], [0, 62], [6, 56], [6, 44], [0, 38]];
const NOTCH: [number, number][] = [[12, 0], [100, 0], [100, 88], [88, 100], [0, 100], [0, 12]];
const CROSS: [number, number][] = [[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]];
const ARROWRIGHT: [number, number][] = [[0, 0], [62, 0], [100, 50], [62, 100], [0, 100], [24, 50]];
const HOURGLASS: [number, number][] = [[0, 0], [100, 0], [58, 50], [100, 100], [0, 100], [42, 50]];
const TRAPEZOID: [number, number][] = [[14, 0], [86, 0], [100, 100], [0, 100]];
const OCTAGON: [number, number][] = [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]];
const TRIUP: [number, number][] = [[50, 4], [98, 96], [2, 96]];
const TRIDOWN: [number, number][] = [[2, 4], [98, 4], [50, 96]];
const HEXAGON: [number, number][] = [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]];
const DIAMOND: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]];
const STAR: [number, number][] = [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]];

/* the shape library: arrows, callouts, flowchart symbols and the rest */
const ARROWLEFT: [number, number][] = [[100, 0], [38, 0], [0, 50], [38, 100], [100, 100], [76, 50]];
const ARROWUP: [number, number][] = [[50, 0], [100, 42], [70, 42], [70, 100], [30, 100], [30, 42], [0, 42]];
const ARROWDOWN: [number, number][] = [[30, 0], [70, 0], [70, 58], [100, 58], [50, 100], [0, 58], [30, 58]];
const BLOCKRIGHT: [number, number][] = [[0, 26], [58, 26], [58, 0], [100, 50], [58, 100], [58, 74], [0, 74]];
const BLOCKLEFT: [number, number][] = [[100, 26], [42, 26], [42, 0], [0, 50], [42, 100], [42, 74], [100, 74]];
const ARROWBOTH: [number, number][] = [[0, 50], [24, 0], [24, 28], [76, 28], [76, 0], [100, 50], [76, 100], [76, 72], [24, 72], [24, 100]];
const ARROWUPDOWN: [number, number][] = [[50, 0], [100, 24], [72, 24], [72, 76], [100, 76], [50, 100], [0, 76], [28, 76], [28, 24], [0, 24]];
const NOTCHEDARROW: [number, number][] = [[0, 18], [58, 18], [58, 0], [100, 50], [58, 100], [58, 82], [0, 82], [14, 50]];
const TRIRIGHT: [number, number][] = [[2, 4], [98, 50], [2, 96]];
const TRILEFT: [number, number][] = [[98, 4], [2, 50], [98, 96]];
const RIGHTTRI: [number, number][] = [[0, 0], [100, 100], [0, 100]];
const SLANTLEFT: [number, number][] = [[0, 0], [86, 0], [100, 100], [14, 100]];
const TRAPDOWN: [number, number][] = [[0, 0], [100, 0], [86, 100], [14, 100]];
const STEPLEFT: [number, number][] = [[26, 0], [100, 0], [74, 50], [100, 100], [26, 100], [0, 50]];
const HOUSE: [number, number][] = [[50, 0], [100, 38], [100, 100], [0, 100], [0, 38]];
const GEM: [number, number][] = [[22, 0], [78, 0], [100, 32], [50, 100], [0, 32]];
const HEXWIDE: [number, number][] = [[16, 0], [84, 0], [100, 50], [84, 100], [16, 100], [0, 50]];
const CHAMFER: [number, number][] = [[14, 0], [86, 0], [100, 14], [100, 86], [86, 100], [14, 100], [0, 86], [0, 14]];
const FOLDER: [number, number][] = [[0, 0], [40, 0], [48, 12], [100, 12], [100, 100], [0, 100]];
const TAGLEFT: [number, number][] = [[28, 0], [100, 0], [100, 100], [28, 100], [0, 50]];
const LABEL: [number, number][] = [[20, 0], [80, 0], [100, 50], [80, 100], [20, 100], [0, 50]];
const SLOT: [number, number][] = [[0, 0], [34, 0], [40, 14], [60, 14], [66, 0], [100, 0], [100, 100], [0, 100]];
const CALLOUTDOWN: [number, number][] = [[0, 0], [100, 0], [100, 76], [62, 76], [50, 98], [38, 76], [0, 76]];
const CALLOUTUP: [number, number][] = [[0, 24], [38, 24], [50, 2], [62, 24], [100, 24], [100, 100], [0, 100]];
const CALLOUTRIGHT: [number, number][] = [[0, 0], [76, 0], [76, 36], [98, 50], [76, 64], [76, 100], [0, 100]];
const CALLOUTLEFT: [number, number][] = [[24, 0], [100, 0], [100, 100], [24, 100], [24, 64], [2, 50], [24, 36]];
const ROUNDCALLOUT: [number, number][] = soften([[0, 0], [100, 0], [100, 76], [36, 76], [20, 98], [20, 76], [0, 76]], 12);
const DISPLAY: [number, number][] = [[0, 50], [16, 0], [82, 0], [94, 6], [100, 20], [100, 80], [94, 94], [82, 100], [16, 100]];
const MANUALINPUT: [number, number][] = [[0, 26], [100, 0], [100, 100], [0, 100]];
const OFFPAGE: [number, number][] = [[0, 0], [100, 0], [100, 70], [50, 100], [0, 70]];
const LOOPLIMIT: [number, number][] = [[16, 0], [84, 0], [100, 20], [100, 100], [0, 100], [0, 20]];
const CYLINDER: [number, number][] = [[0, 10], [8, 5], [20, 2], [35, 0.5], [50, 0], [65, 0.5], [80, 2], [92, 5], [100, 10], [100, 90], [92, 95], [80, 98], [65, 99.5], [50, 100], [35, 99.5], [20, 98], [8, 95], [0, 90]];
const BELL: [number, number][] = [[50, 2], [60, 5], [68, 13], [73, 25], [75, 44], [79, 62], [92, 76], [92, 84], [62, 84], [58, 94], [50, 98], [42, 94], [38, 84], [8, 84], [8, 76], [21, 62], [25, 44], [27, 25], [32, 13], [40, 5]];
const LOCK: [number, number][] = [[12, 40], [30, 40], [30, 24], [36, 12], [50, 6], [64, 12], [70, 24], [70, 40], [88, 40], [88, 98], [12, 98]];
const FLASK: [number, number][] = [[38, 0], [62, 0], [62, 34], [92, 86], [88, 100], [12, 100], [8, 86], [38, 34]];
const EXPLOSION: [number, number][] = jagged([50, 40, 48, 36, 50, 42, 46, 38, 50, 44, 47, 39], 26);

/*
 * The classic bullet points, drawn small in the middle of the marker's box so
 * they sit on the question's first line exactly where a disc would — the
 * round dot, its hollow twin, the square, the diamond, the triangle, the dash,
 * the arrowhead, the chevron, the check mark and the star every slide tool's
 * bullet row offers.
 */
const DOT: [number, number][] = poly(36, 22);
const SQUARE_DOT: [number, number][] = [[30, 30], [70, 30], [70, 70], [30, 70]];
const DIAMOND_DOT: [number, number][] = [[50, 23], [77, 50], [50, 77], [23, 50]];
const TRIANGLE_DOT: [number, number][] = [[31, 25], [77, 50], [31, 75]];
const DASH: [number, number][] = [[20, 44], [80, 44], [80, 56], [20, 56]];
const ARROWHEAD: [number, number][] = [[24, 22], [80, 50], [24, 78], [37, 50]];
const CHEVRON: [number, number][] = [[34, 20], [47, 20], [75, 50], [47, 80], [34, 80], [62, 50]];
const CHECK: [number, number][] = [[14, 54], [27, 41], [42, 56], [74, 22], [87, 35], [42, 80]];
const STAR_DOT: [number, number][] = starPoints(5, 28, 12);

/* a hollow bullet: no body of its own — only the line the design draws */
const hollow = (): CSSProperties => ({ background: "transparent" });
/* a hollow frame: a tinted centre inside the bold line the design draws */
const hollowFrame = (accent: string): CSSProperties => ({ background: withAlpha(accent, 0.14) });

/**
 * "01": a leading zero in the number's own script, so a Bengali "৭" becomes
 * "০৭" and a Latin "7" becomes "07". Two digits and more are left alone.
 */
const ZERO_OF: [RegExp, string][] = [
  [/^[0-9]$/, "0"],
  [/^[০-৯]$/, "০"],
  [/^[०-९]$/, "०"],
  [/^[٠-٩]$/, "٠"],
  [/^[۰-۹]$/, "۰"],
];
export function zeroPadNumber(number: string): string {
  const n = number.trim();
  for (const [re, zero] of ZERO_OF) if (re.test(n)) return zero + n;
  return number;
}

/* a paint every "flat" design can share: no gloss, no rim, just the colour */
const flat = (accent: string): CSSProperties => ({ background: accent });
/* two concentric rims — the double-ring look */
const doubleRim = (accent: string, size: number): CSSProperties => ({
  background: withAlpha(accent, 0.16),
  boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.045)}px ${accent}, inset 0 0 0 ${Math.max(3, size * 0.09)}px ${withAlpha("#ffffff", 0.55)}, inset 0 0 0 ${Math.max(4.5, size * 0.13)}px ${accent}`,
});
/* a bullseye: rings of the accent and the board */
const bullseye = (accent: string, size: number): CSSProperties => ({
  background: `radial-gradient(circle at 50% 50%, #ffffff 0 ${Math.max(2, size * 0.1)}px, ${accent} ${Math.max(2, size * 0.1)}px ${Math.max(4, size * 0.2)}px, #ffffff ${Math.max(4, size * 0.2)}px ${Math.max(6, size * 0.3)}px, ${accent} ${Math.max(6, size * 0.3)}px)`,
});
/* a dotted rim drawn as a dashed inset ring */
const dottedRim = (accent: string, size: number): CSSProperties => ({
  background: withAlpha(accent, 0.12),
  boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.06)}px ${withAlpha(accent, 0.25)}`,
});
/* a cylinder: the lit rim of its top face over a side-lit body */
const cylinderPaint = (accent: string): CSSProperties => ({
  background: `radial-gradient(ellipse 50% 10% at 50% 10%, ${withAlpha("#ffffff", 0.4)} 0 96%, ${withAlpha("#ffffff", 0)} 100%), linear-gradient(90deg, ${shade(accent, -0.18)}, ${shade(accent, 0.3)} 42%, ${accent})`,
});
/* the flowchart subroutine: a box with a rule down each side */
const subroutinePaint = (accent: string): CSSProperties => ({
  background: `linear-gradient(90deg, transparent 0 10%, ${withAlpha("#ffffff", 0.6)} 10% 13.5%, transparent 13.5% 86.5%, ${withAlpha("#ffffff", 0.6)} 86.5% 90%, transparent 90%), linear-gradient(145deg, ${shade(accent, 0.3)}, ${accent})`,
});

export const NUMBER_STYLES: NumberStyleDef[] = [
  /* --- bullet points: the classic list bullets (they replace the number) --- */
  { id: "dot", label: "Dot", category: "bullets", hint: "The classic round bullet — a plain dot, no number", points: DOT },
  { id: "hollowDot", label: "Hollow dot", category: "bullets", hint: "An open ring bullet — no number", points: DOT, line: 0.07, lineColor: (a) => a, paint: hollow },
  { id: "squareDot", label: "Small square", category: "bullets", hint: "A solid square bullet — no number", points: SQUARE_DOT },
  { id: "hollowSquare", label: "Hollow square", category: "bullets", hint: "An open square bullet — no number", points: SQUARE_DOT, line: 0.07, lineColor: (a) => a, paint: hollow },
  { id: "diamondDot", label: "Small diamond", category: "bullets", hint: "A diamond bullet — no number", points: DIAMOND_DOT },
  { id: "triangleDot", label: "Small triangle", category: "bullets", hint: "A triangle pointing at the question — no number", points: TRIANGLE_DOT },
  { id: "dash", label: "Dash", category: "bullets", hint: "A dash bullet — no number", points: DASH },
  { id: "arrowhead", label: "Arrowhead", category: "bullets", hint: "An arrowhead bullet — no number", points: ARROWHEAD },
  { id: "chevron", label: "Chevron", category: "bullets", hint: "A chevron bullet, like ›  — no number", points: CHEVRON },
  { id: "check", label: "Check mark", category: "bullets", hint: "A check-mark bullet — no number", points: CHECK },
  { id: "starDot", label: "Small star", category: "bullets", hint: "A star bullet — no number", points: STAR_DOT },

  /* --- numbering: the number with its own punctuation, no shape ------------ */
  { id: "numDot", label: "1.", category: "numbering", hint: "The number with a full stop — 1. 2. 3.", format: (n) => `${n}.`, aspect: 1.1, font: 0.46 },
  { id: "numParen", label: "1)", category: "numbering", hint: "The number with a closing bracket — 1) 2) 3)", format: (n) => `${n})`, aspect: 1.1, font: 0.46 },
  { id: "numParens", label: "(1)", category: "numbering", hint: "The number in round brackets — (1) (2) (3)", format: (n) => `(${n})`, aspect: 1.35, font: 0.46 },
  { id: "numColon", label: "1:", category: "numbering", hint: "The number with a colon — 1: 2: 3:", format: (n) => `${n}:`, aspect: 1.1, font: 0.46 },
  { id: "numZero", label: "01", category: "numbering", hint: "Two digits with a leading zero — 01 02 03", format: zeroPadNumber, aspect: 1.3, font: 0.46 },
  { id: "numQ", label: "Q1", category: "numbering", hint: "Q before the number — Q1 Q2 Q3", format: (n) => `Q${n}`, aspect: 1.4, font: 0.46 },
  { id: "numHash", label: "#1", category: "numbering", hint: "A hash before the number — #1 #2 #3", format: (n) => `#${n}`, aspect: 1.3, font: 0.46 },
  { id: "numBar", label: "1 |", category: "numbering", hint: "The number with an upright divider — 1 | 2 | 3 |", format: (n) => `${n} |`, aspect: 1.35, font: 0.46 },

  /* --- round & soft ------------------------------------------------------ */
  { id: "circle", label: "Circle", category: "curve", hint: "Classic disc with a hairline rim — the default", line: 0.07, radius: "50%" },
  { id: "ring", label: "Ring", category: "curve", hint: "Hollow circle: a bold outline with a tinted centre", line: 0.1, radius: "50%" },
  { id: "coin", label: "Coin", category: "curve", hint: "Disc with an inner rim, like a struck medal", line: 0.05, radius: "50%" },
  { id: "squircle", label: "Squircle", category: "curve", hint: "App-icon square with soft, continuous corners", radius: 0.34 },
  { id: "arch", label: "Arch", category: "curve", hint: "Tombstone: round shoulders, flat base", radius: "50% 50% 8% 8% / 46% 46% 8% 8%", line: 0.05 },
  { id: "blob", label: "Blob", category: "curve", hint: "Organic, hand-pulled curve", radius: "42% 58% 63% 37% / 46% 41% 59% 54%" },
  { id: "gradient", label: "Gradient", category: "curve", hint: "Glossy sphere lit from the top left", radius: "50%" },
  { id: "glow", label: "Glow", category: "curve", hint: "Soft halo with no hard edge", radius: "50%" },
  { id: "disc", label: "Flat disc", category: "curve", hint: "A flat circle — no rim, no gloss", radius: "50%", paint: flat },
  { id: "doubleRing", label: "Double ring", category: "curve", hint: "Two concentric rims around a tinted centre", radius: "50%", paint: doubleRim, ink: (a) => a },
  { id: "dottedRing", label: "Dotted ring", category: "curve", hint: "A dotted rim — the hand-drawn look", radius: "50%", line: 0.06, paint: dottedRim, ink: (a) => a },
  { id: "target", label: "Bullseye", category: "curve", hint: "Ringed target — a mark that reads at a glance", radius: "50%", paint: bullseye },
  { id: "wavy", label: "Wavy rim", category: "curve", hint: "A sticker whose edge ripples all round", points: lobes(22, 42, 6), font: 0.38 },
  { id: "drop", label: "Teardrop", category: "curve", hint: "A drop with a pointed tip", points: DROP, font: 0.34, pad: [0.12, 0, 0.04, 0] },
  { id: "leaf", label: "Leaf", category: "curve", hint: "A leaf laid diagonally", points: LEAF, font: 0.32 },
  { id: "cloud", label: "Cloud", category: "curve", hint: "A soft thought cloud", points: CLOUD, font: 0.34, pad: [0.1, 0, 0.14, 0] },
  { id: "oval", label: "Oval", category: "curve", hint: "An ellipse, wider than it is tall", radius: "50%", aspect: 1.35, font: 0.4 },
  { id: "egg", label: "Egg", category: "curve", hint: "An egg — narrow at the top, full at the base", radius: "50% 50% 50% 50% / 62% 62% 38% 38%", font: 0.4 },
  { id: "dome", label: "Dome", category: "curve", hint: "A half-circle standing on its flat base", radius: "50% 50% 0 0 / 100% 100% 0 0", aspect: 1.3, font: 0.38, pad: [0.14, 0, 0, 0] },
  { id: "lens", label: "Lens", category: "curve", hint: "Two arcs meeting at the sides — an eye", points: lens(40), aspect: 1.3, font: 0.38 },
  { id: "softTriangle", label: "Soft triangle", category: "curve", hint: "A triangle with rounded corners", points: soften(TRIUP, 18), font: 0.32, pad: [0.2, 0, 0.02, 0] },
  { id: "softDiamond", label: "Soft diamond", category: "curve", hint: "A diamond with rounded corners", points: soften(DIAMOND, 16), font: 0.36 },
  { id: "softHexagon", label: "Soft hexagon", category: "curve", hint: "A hexagon with rounded corners", points: soften(HEXAGON, 12), font: 0.4 },

  /* --- cards & chips ----------------------------------------------------- */
  { id: "square", label: "Square", category: "cards", hint: "Crisp architectural tile" },
  { id: "rounded", label: "Rounded", category: "cards", hint: "Soft-cornered card", radius: 0.3 },
  { id: "pill", label: "Pill", category: "cards", hint: "Capsule label — wide, stadium ends", radius: 999, aspect: 1.6 },
  { id: "cutCorner", label: "Cut corner", category: "cards", hint: "Card with its top-right corner sliced off", points: [[0, 0], [74, 0], [100, 26], [100, 100], [0, 100]] },
  { id: "ticket", label: "Ticket", category: "cards", hint: "Admit-one stub with side notches", points: [[0, 0], [100, 0], [100, 36], [93, 50], [100, 64], [100, 100], [0, 100], [0, 64], [7, 50], [0, 36]], aspect: 1.3 },
  { id: "bookmark", label: "Bookmark", category: "cards", hint: "Tab with a V cut out of its base", points: [[0, 0], [100, 0], [100, 100], [50, 76], [0, 100]], pad: [0, 0, 0.08, 0] },
  { id: "tab", label: "Tab", category: "cards", hint: "A folder tab — round shoulders, square base", radius: "36% 36% 8% 8%", line: 0.05 },
  { id: "notch", label: "Notched", category: "cards", hint: "A card with two opposite corners cut", points: NOTCH, font: 0.4 },
  { id: "tag", label: "Tag", category: "cards", hint: "A price tag pointing right", points: TAG, aspect: 1.25, font: 0.38 },
  { id: "coupon", label: "Coupon", category: "cards", hint: "A stub with round notches top and bottom", points: COUPON, aspect: 1.4, font: 0.38 },
  { id: "stamp", label: "Stamp", category: "cards", hint: "A perforated postage edge all round", points: zigRect(7, 5), aspect: 1.15, font: 0.36 },
  { id: "washi", label: "Tape", category: "cards", hint: "A strip of tape with torn ends", points: tornBand(4, 8), aspect: 1.8, font: 0.36 },
  { id: "plaque", label: "Plaque", category: "cards", hint: "A plate with its four corners scooped in", points: plaque(16), font: 0.4 },
  { id: "frame", label: "Frame", category: "cards", hint: "A hollow square — a bold outline with a tinted centre", generic: true, radius: 0.12, line: 0.1, lineColor: (a) => a, paint: hollowFrame, ink: (a) => a },
  { id: "chamfer", label: "Chamfer", category: "cards", hint: "A card with all four corners bevelled", points: CHAMFER, font: 0.4 },
  { id: "folder", label: "Folder", category: "cards", hint: "A file folder with its tab at the top left", points: FOLDER, font: 0.38, pad: [0.1, 0, 0, 0] },
  { id: "tagLeft", label: "Tag ◀", category: "cards", hint: "A price tag pointing left", points: TAGLEFT, aspect: 1.25, font: 0.38, pad: [0, 0, 0, 0.12] },
  { id: "label", label: "Label", category: "cards", hint: "A label pointed at both ends", points: LABEL, aspect: 1.5, font: 0.38 },
  { id: "slot", label: "Slot", category: "cards", hint: "A card with a slot cut into its top edge", points: SLOT, font: 0.38, pad: [0.1, 0, 0, 0] },

  /* --- polygons ---------------------------------------------------------- */
  { id: "diamond", label: "Diamond", category: "polygons", hint: "45° rhombus", points: [[50, 0], [100, 50], [50, 100], [0, 50]] },
  { id: "hexagon", label: "Hexagon", category: "polygons", hint: "Six sides, flat top and base", points: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]] },
  { id: "hexPoint", label: "Hexagon ▲", category: "polygons", hint: "Six sides standing on a point", points: [[50, 0], [100, 25], [100, 75], [50, 100], [0, 75], [0, 25]], pad: [0.1, 0, 0, 0] },
  { id: "kite", label: "Kite", category: "polygons", hint: "Tall rhombus with a high waist", points: [[50, 0], [100, 38], [50, 100], [0, 38]], font: 0.36 },
  { id: "shield", label: "Shield", category: "polygons", hint: "Heraldic crest with a pointed base", points: [[50, 0], [100, 12], [100, 62], [50, 100], [0, 62], [0, 12]] },
  { id: "slant", label: "Slant", category: "polygons", hint: "Parallelogram swept to the right", points: [[14, 0], [100, 0], [86, 100], [0, 100]] },
  { id: "step", label: "Step", category: "polygons", hint: "Chevron chip — a step in a sequence", points: [[0, 0], [74, 0], [100, 50], [74, 100], [0, 100], [26, 50]], aspect: 1.25 },
  { id: "ribbon", label: "Ribbon", category: "polygons", hint: "Award ribbon with notched ends", points: [[0, 0], [100, 0], [92, 50], [100, 100], [0, 100], [8, 50]], aspect: 1.3 },
  { id: "banner", label: "Banner", category: "polygons", hint: "Flag with a swallow-tail base", points: [[0, 0], [100, 0], [100, 100], [55, 100], [50, 82], [45, 100], [0, 100]], aspect: 1.25, pad: [0, 0, 0.16, 0] },
  { id: "triangle", label: "Triangle", category: "polygons", hint: "Standing on its base", points: TRIUP, font: 0.32, pad: [0.22, 0, 0.04, 0] },
  { id: "triangleDown", label: "Triangle ▼", category: "polygons", hint: "Hanging from its base", points: TRIDOWN, font: 0.32, pad: [0.04, 0, 0.22, 0] },
  { id: "trapezoid", label: "Trapezoid", category: "polygons", hint: "A plinth that widens to its base", points: TRAPEZOID, font: 0.38 },
  { id: "pentagon", label: "Pentagon", category: "polygons", hint: "Five sides standing on a point", points: poly(5, 49), font: 0.36 },
  { id: "octagon", label: "Octagon", category: "polygons", hint: "Eight sides — the stop sign", points: OCTAGON, font: 0.38 },
  { id: "cross", label: "Plus", category: "polygons", hint: "A cross / plus block", points: CROSS, font: 0.34 },
  { id: "hourglass", label: "Hourglass", category: "polygons", hint: "Pinched in the middle", points: HOURGLASS, font: 0.3 },
  { id: "rightTriangle", label: "Right triangle", category: "polygons", hint: "A right angle in the bottom-left corner", points: RIGHTTRI, font: 0.3, pad: [0.34, 0.34, 0, 0] },
  { id: "heptagon", label: "Heptagon", category: "polygons", hint: "Seven sides", points: poly(7, 49), font: 0.36 },
  { id: "nonagon", label: "Nonagon", category: "polygons", hint: "Nine sides", points: poly(9, 49), font: 0.38 },
  { id: "decagon", label: "Decagon", category: "polygons", hint: "Ten sides", points: poly(10, 49), font: 0.38 },
  { id: "dodecagon", label: "Dodecagon", category: "polygons", hint: "Twelve sides — almost a coin", points: poly(12, 49), font: 0.4 },
  { id: "rhombus", label: "Rhombus", category: "polygons", hint: "A wide diamond", points: DIAMOND, aspect: 1.4, font: 0.34 },
  { id: "slantLeft", label: "Slant ◣", category: "polygons", hint: "Parallelogram swept to the left", points: SLANTLEFT },
  { id: "trapezoidDown", label: "Trapezoid ▼", category: "polygons", hint: "A plinth that narrows to its base", points: TRAPDOWN, font: 0.38 },
  { id: "stepLeft", label: "Step ◀", category: "polygons", hint: "Chevron chip pointing left", points: STEPLEFT, aspect: 1.25 },
  { id: "house", label: "House", category: "polygons", hint: "A pentagon with a flat base — a house", points: HOUSE, font: 0.36, pad: [0.2, 0, 0, 0] },
  { id: "gem", label: "Gem", category: "polygons", hint: "A cut jewel, pointed at its base", points: GEM, font: 0.34, pad: [0, 0, 0.2, 0] },
  { id: "hexWide", label: "Hexagon ▬", category: "polygons", hint: "A wide hexagon", points: HEXWIDE, aspect: 1.4, font: 0.38 },

  /* --- arrows ------------------------------------------------------------ */
  { id: "arrowRight", label: "Arrow ▶", category: "arrows", hint: "A chevron arrow pointing at the question", points: ARROWRIGHT, aspect: 1.3, font: 0.36 },
  { id: "arrowLeft", label: "Arrow ◀", category: "arrows", hint: "A chevron arrow pointing left", points: ARROWLEFT, aspect: 1.3, font: 0.36 },
  { id: "arrowUp", label: "Arrow ▲", category: "arrows", hint: "A block arrow pointing up", points: ARROWUP, font: 0.28, pad: [0.42, 0, 0, 0] },
  { id: "arrowDown", label: "Arrow ▼", category: "arrows", hint: "A block arrow pointing down", points: ARROWDOWN, font: 0.28, pad: [0, 0, 0.42, 0] },
  { id: "blockRight", label: "Block arrow ▶", category: "arrows", hint: "A block arrow pointing right", points: BLOCKRIGHT, aspect: 1.4, font: 0.3, pad: [0, 0.42, 0, 0] },
  { id: "blockLeft", label: "Block arrow ◀", category: "arrows", hint: "A block arrow pointing left", points: BLOCKLEFT, aspect: 1.4, font: 0.3, pad: [0, 0, 0, 0.42] },
  { id: "arrowBoth", label: "Arrow ◀▶", category: "arrows", hint: "A two-headed arrow, left and right", points: ARROWBOTH, aspect: 1.6, font: 0.3 },
  { id: "arrowUpDown", label: "Arrow ▲▼", category: "arrows", hint: "A two-headed arrow, up and down", points: ARROWUPDOWN, font: 0.3 },
  { id: "notchedArrow", label: "Notched arrow", category: "arrows", hint: "A block arrow with a notched tail", points: NOTCHEDARROW, aspect: 1.4, font: 0.3, pad: [0, 0.42, 0, 0.1] },
  { id: "triangleRight", label: "Triangle ▶", category: "arrows", hint: "A play button — a triangle pointing right", points: TRIRIGHT, font: 0.32, pad: [0, 0.3, 0, 0] },
  { id: "triangleLeft", label: "Triangle ◀", category: "arrows", hint: "A triangle pointing left", points: TRILEFT, font: 0.32, pad: [0, 0, 0, 0.3] },

  /* --- seals & stars ----------------------------------------------------- */
  { id: "star", label: "Star", category: "seals", hint: "Five-point achievement star", points: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]], font: 0.5, pad: [0, 0, 0, 0.08] },
  { id: "sparkle", label: "Sparkle", category: "seals", hint: "Four-point glint", points: [[50, 0], [57, 40], [100, 50], [57, 60], [50, 100], [43, 60], [0, 50], [43, 40]], font: 0.46, pad: [0.1, 0, 0.08, 0] },
  { id: "burst", label: "Burst", category: "seals", hint: "Sixteen-point certification rosette", points: [[50, 0], [59, 12], [73, 6], [76, 20], [91, 20], [88, 34], [100, 42], [91, 54], [98, 68], [84, 72], [84, 88], [70, 84], [62, 97], [50, 87], [38, 97], [30, 84], [16, 88], [16, 72], [2, 68], [9, 54], [0, 42], [12, 34], [9, 20], [24, 20], [27, 6], [41, 12]], font: 0.32, pad: [0, 0, 0, 0.08] },
  { id: "scallop", label: "Scallop", category: "seals", hint: "Twelve-lobed stamp", points: lobes(12, 43, 6), pad: [0, 0.08, 0, 0.08] },
  { id: "gear", label: "Gear", category: "seals", hint: "Cog with eight flat teeth", points: cog(8, 49, 38), pad: [0, 0.08, 0, 0.08] },
  { id: "rosette", label: "Rosette", category: "seals", hint: "A sixteen-lobed award rosette", points: lobes(16, 41, 6), font: 0.34 },
  { id: "capSeal", label: "Cap seal", category: "seals", hint: "A serrated bottle-cap edge", points: starPoints(20, 49, 43), font: 0.36 },
  { id: "star6", label: "Star 6", category: "seals", hint: "A six-point star", points: starPoints(6, 49, 24), font: 0.34 },
  { id: "star8", label: "Star 8", category: "seals", hint: "An eight-point compass star", points: starPoints(8, 49, 21), font: 0.34 },
  { id: "sunburst", label: "Sunburst", category: "seals", hint: "Twelve rays — a promo burst", points: starPoints(12, 49, 34), font: 0.34 },
  { id: "medal", label: "Medal", category: "seals", hint: "A seal with two ribbon tails", points: MEDAL, font: 0.34, pad: [0.02, 0, 0.14, 0] },
  { id: "star4", label: "Star 4", category: "seals", hint: "A four-point star", points: starPoints(4, 49, 21), font: 0.3 },
  { id: "star7", label: "Star 7", category: "seals", hint: "A seven-point star", points: starPoints(7, 49, 27), font: 0.34 },
  { id: "star10", label: "Star 10", category: "seals", hint: "A ten-point star", points: starPoints(10, 49, 36), font: 0.36 },
  { id: "star16", label: "Star 16", category: "seals", hint: "A sixteen-point seal", points: starPoints(16, 49, 39), font: 0.36 },
  { id: "explosion", label: "Explosion", category: "seals", hint: "A comic burst with spikes of every length", points: EXPLOSION, font: 0.32 },
  { id: "flower", label: "Flower", category: "seals", hint: "Six round petals", points: lobes(6, 39, 10, 8), font: 0.36 },
  { id: "softStar", label: "Soft star", category: "seals", hint: "A five-point star with rounded tips", points: soften(STAR, 7), font: 0.4, pad: [0.1, 0, 0, 0] },

  /* --- callouts ---------------------------------------------------------- */
  { id: "speech", label: "Speech", category: "callouts", hint: "Bubble with a tail at the bottom left", points: [[0, 0], [100, 0], [100, 78], [32, 78], [18, 98], [18, 78], [0, 78]], aspect: 1.15 },
  { id: "bubbleRound", label: "Bubble", category: "callouts", hint: "A round speech bubble with a tail", points: BUBBLEROUND, font: 0.32 },
  { id: "calloutDown", label: "Callout ▼", category: "callouts", hint: "A plate with its tail pointing down", points: CALLOUTDOWN, aspect: 1.1, font: 0.38, pad: [0, 0, 0.24, 0] },
  { id: "calloutUp", label: "Callout ▲", category: "callouts", hint: "A plate with its tail pointing up", points: CALLOUTUP, aspect: 1.1, font: 0.38, pad: [0.24, 0, 0, 0] },
  { id: "calloutRight", label: "Callout ▶", category: "callouts", hint: "A plate with its tail pointing right", points: CALLOUTRIGHT, aspect: 1.2, font: 0.38, pad: [0, 0.24, 0, 0] },
  { id: "calloutLeft", label: "Callout ◀", category: "callouts", hint: "A plate with its tail pointing left", points: CALLOUTLEFT, aspect: 1.2, font: 0.38, pad: [0, 0, 0, 0.24] },
  { id: "roundCallout", label: "Rounded callout", category: "callouts", hint: "A rounded plate with a tail at the bottom left", points: ROUNDCALLOUT, aspect: 1.1, font: 0.38, pad: [0, 0, 0.24, 0] },

  /* --- flowchart --------------------------------------------------------- */
  { id: "document", label: "Document", category: "flowchart", hint: "A sheet with a wavy bottom edge", points: documentSheet(), aspect: 1.15, font: 0.38, pad: [0, 0, 0.12, 0] },
  { id: "delay", label: "Delay", category: "flowchart", hint: "A D — flat on the left, round on the right", radius: "0 50% 50% 0 / 0 50% 50% 0", aspect: 1.15, font: 0.4, pad: [0, 0.08, 0, 0] },
  { id: "display", label: "Display", category: "flowchart", hint: "Pointed on the left, rounded on the right", points: DISPLAY, aspect: 1.3, font: 0.38, pad: [0, 0, 0, 0.12] },
  { id: "manualInput", label: "Manual input", category: "flowchart", hint: "A box with a sloping top", points: MANUALINPUT, font: 0.38, pad: [0.14, 0, 0, 0] },
  { id: "offPage", label: "Off-page", category: "flowchart", hint: "A pentagon pointing down — the off-page connector", points: OFFPAGE, font: 0.38, pad: [0, 0, 0.2, 0] },
  { id: "cylinder", label: "Cylinder", category: "flowchart", hint: "A database cylinder with a lit top rim", points: CYLINDER, font: 0.36, pad: [0.1, 0, 0, 0], paint: cylinderPaint },
  { id: "subroutine", label: "Subroutine", category: "flowchart", hint: "A box with a rule down each side", generic: true, aspect: 1.25, font: 0.38, paint: subroutinePaint },
  { id: "loopLimit", label: "Loop limit", category: "flowchart", hint: "A box with its top corners cut", points: LOOPLIMIT, font: 0.4 },

  /* --- stickers & icons --------------------------------------------------- */
  { id: "bulb", label: "Bulb", category: "stickers", hint: "A light bulb — an idea sticker", points: BULB, font: 0.3, pad: [0.06, 0, 0.16, 0] },
  { id: "book", label: "Book", category: "stickers", hint: "An open book", points: BOOK, font: 0.32 },
  { id: "gradCap", label: "Grad cap", category: "stickers", hint: "A mortarboard — results and admissions", points: GRADCAP, font: 0.28, pad: [0.1, 0, 0.2, 0] },
  { id: "trophy", label: "Trophy", category: "stickers", hint: "A winner's cup", points: TROPHY, font: 0.28, pad: [0.06, 0, 0.2, 0] },
  { id: "bolt", label: "Bolt", category: "stickers", hint: "A lightning flash — quick fire", points: BOLT, font: 0.3 },
  { id: "flame", label: "Flame", category: "stickers", hint: "A hot streak", points: FLAME, font: 0.3, pad: [0.06, 0, 0.08, 0] },
  { id: "rocket", label: "Rocket", category: "stickers", hint: "A launch — crash courses", points: ROCKET, font: 0.28, pad: [0.06, 0, 0.16, 0] },
  { id: "crown", label: "Crown", category: "stickers", hint: "A crown — top of the class", points: CROWN, font: 0.3, pad: [0.1, 0, 0.16, 0] },
  { id: "heart", label: "Heart", category: "stickers", hint: "A favourite / liked marker", points: HEART, font: 0.3, pad: [0.1, 0, 0.1, 0] },
  { id: "pin", label: "Pin", category: "stickers", hint: "A map pin — a place in the syllabus", points: PIN, font: 0.32, pad: [0.04, 0, 0.18, 0] },
  { id: "bell", label: "Bell", category: "stickers", hint: "A bell — a reminder", points: BELL, font: 0.28, pad: [0.1, 0, 0.22, 0] },
  { id: "lock", label: "Padlock", category: "stickers", hint: "A padlock — a locked or bonus question", points: LOCK, font: 0.3, pad: [0.4, 0, 0, 0] },
  { id: "flask", label: "Flask", category: "stickers", hint: "A conical flask — the science round", points: FLASK, font: 0.28, pad: [0.42, 0, 0, 0] },
  { id: "trefoil", label: "Trefoil", category: "stickers", hint: "Three round lobes", points: lobes(3, 37, 12, 14, 90), font: 0.32 },
  { id: "quatrefoil", label: "Clover", category: "stickers", hint: "Four round lobes — a clover", points: lobes(4, 37, 12, 12), font: 0.34 },

  /* --- marks ------------------------------------------------------------- */
  { id: "bracket", label: "Bracket", category: "marks", hint: "Corner rule holding the number" },
  { id: "underline", label: "Underline", category: "marks", hint: "A rule instead of a shape" },
  { id: "bar", label: "Bar", category: "marks", hint: "A slim vertical bar beside the question" },
  { id: "slash", label: "Slashed", category: "marks", hint: "Number with a slanted tick", aspect: 1.15 },
  { id: "brackets", label: "Brackets", category: "marks", hint: "Two rules holding the number, like [7]" },
  { id: "dots3", label: "Three dots", category: "marks", hint: "The number over three small dots" },
  { id: "cornerTick", label: "Corner tick", category: "marks", hint: "A folded corner tick behind the number" },
  { id: "parens", label: "Parens", category: "marks", hint: "Two round rules holding the number, like (7)" },
  { id: "none", label: "None", category: "marks", hint: "No marker at all" },
];

const DEF_BY_ID = new Map<NumberStyle, NumberStyleDef>(NUMBER_STYLES.map((d) => [d.id, d]));

/** the Shape tab's catalogue — every silhouette that is not a bullet point or a numbering format */
export const NUMBER_SHAPES: NumberStyleDef[] = NUMBER_STYLES.filter((d) => !isPresetCategory(d.category));

export const DEFAULT_NUMBER_STYLE: NumberStyle = "circle";

/** an id the catalogue doesn't know (an older deck, a typo) falls back to the default disc */
const FALLBACK_DEF: NumberStyleDef = DEF_BY_ID.get(DEFAULT_NUMBER_STYLE) ?? NUMBER_STYLES[0];

export const numberStyleDef = (id: NumberStyle): NumberStyleDef => DEF_BY_ID.get(id) ?? FALLBACK_DEF;

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

/** designs that show no number — the rules, and the classic bullets that stand in for it */
const BLANK: NumberStyle[] = [
  "underline", "bar", "none",
  "dot", "hollowDot", "squareDot", "hollowSquare", "diamondDot", "triangleDot",
  "dash", "arrowhead", "chevron", "check", "starDot",
];
export const showsNumber = (id: NumberStyle) => !BLANK.includes(id);

/** the classic bullet points — a glyph instead of a number */
export const isBulletPoint = (id: NumberStyle) => numberStyleDef(id).category === "bullets";
/** the numbering presets — the number with its own punctuation */
export const isNumberingPreset = (id: NumberStyle) => !!numberStyleDef(id).format;
/** a marker shape — anything the Shape tab lists (neither a bullet point nor a numbering format) */
export const isNumberShape = (id: NumberStyle) => !isPresetCategory(numberStyleDef(id).category);

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
  /** a gradient paints the stroke instead of `color` (SVG gradient stops) */
  gradient?: Gradient;
}

/** how a silhouette is cut — the overlay / behind / reflection passes follow it */
export interface NumberClip {
  borderRadius?: string;
  clipPath?: string;
  /** the polygon's own points, when the silhouette is cut with clip-path */
  points?: [number, number][];
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
  /** how the silhouette is cut, so an effect's own passes follow it */
  clip?: NumberClip;
  /** the marker's shape effect (lib/bulletEffects) — undefined when none is on */
  effect?: BulletEffectPaint;
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

      /* --- the marks that are rules / decorations rather than a silhouette -- */
      case "brackets":
      case "parens": {
        /* square rules hold the number like [7]; round ones curve like (7) */
        const w = Math.max(2, Math.round(size * 0.07));
        const round = id === "parens";
        const corner = Math.round(size * (round ? 0.4 : 0.1));
        const bar = (side: "left" | "right"): CSSProperties => ({
          position: "absolute",
          [side]: 0,
          top: Math.round(size * 0.1),
          width: Math.round(size * (round ? 0.2 : 0.24)),
          height: Math.round(size * 0.8),
          boxSizing: "border-box",
          borderTop: `${w}px solid ${accent}`,
          borderBottom: `${w}px solid ${accent}`,
          ...(side === "left"
            ? { borderLeft: `${w}px solid ${accent}`, borderRadius: `${corner}px 0 0 ${corner}px` }
            : { borderRight: `${w}px solid ${accent}`, borderRadius: `0 ${corner}px ${corner}px 0` }),
        });
        return {
          style: box(size * 1.15, size, Math.round(size * 0.42)),
          surface: {},
          content: text, fontScale: 0.42, color: accent, aspect: 1.15,
          marks: [bar("left"), bar("right")],
        };
      }

      case "dots3": {
        const d = Math.max(3, Math.round(size * 0.1));
        return {
          style: { ...box(size, size, Math.round(size * 0.4)), paddingBottom: Math.round(size * 0.2) },
          surface: {},
          content: text, fontScale: 0.4, color: accent, aspect: 1,
          marks: [0, 1, 2].map((k) => ({
            position: "absolute",
            bottom: 0,
            left: `${Math.round(16 + k * 27)}%`,
            width: d,
            height: d,
            borderRadius: 999,
            background: accent,
            opacity: k === 1 ? 1 : 0.65,
          })),
        };
      }

      case "cornerTick":
        return {
          style: box(size, size, Math.round(size * 0.42)),
          surface: {},
          content: text, fontScale: 0.42, color: accent, aspect: 1,
          marks: [
            {
              position: "absolute",
              right: 0,
              bottom: 0,
              width: Math.round(size * 0.42),
              height: Math.round(size * 0.42),
              background: `linear-gradient(150deg, ${shade(accent, 0.3)}, ${accent})`,
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              opacity: 0.9,
            },
          ],
        };

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

      /* --- every cut silhouette shares one path ---------------------------- */
      default: {
        /* --- a numbering preset: the number and its punctuation, no shape --- */
        if (def.format) {
          const fontScale = def.font ?? 0.46;
          return {
            style: { ...box(wide, size, Math.round(size * fontScale)), whiteSpace: "nowrap" },
            surface: {},
            content: text ? def.format(text) : "",
            fontScale,
            color: accent,
            aspect,
          };
        }

        if (def.points) {
          const fontScale = def.font ?? 0.4;
          const pad = def.pad;
          const painted = def.paint ? def.paint(accent, size) : {};
          const base: CSSProperties = {
            clipPath: `polygon(${def.points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`,
            background: `linear-gradient(150deg, ${shade(accent, 0.32)}, ${accent})`,
          };
          if (painted.background || painted.backgroundImage) delete base.background;
          return {
            style: {
              ...box(wide, size, Math.round(size * fontScale)),
              paddingTop: pad ? Math.round(size * pad[0]) : 0,
              paddingRight: pad ? Math.round(size * pad[1]) : 0,
              paddingBottom: pad ? Math.round(size * pad[2]) : 0,
              paddingLeft: pad ? Math.round(size * pad[3]) : 0,
            },
            surface: { ...base, ...painted },
            /* a cut silhouette's own line (the hollow bullets) is stroked over the clip in SVG */
            line: def.line
              ? { color: def.lineColor ? def.lineColor(accent) : withAlpha("#ffffff", 0.5), width: Math.max(1.5, def.line * size) }
              : undefined,
            content: text,
            fontScale,
            color: def.ink ? def.ink(accent) : "#ffffff",
            aspect,
          };
        }

        /* --- a box silhouette the catalogue describes on its own ------------- */
        if (def.generic || def.radius !== undefined || def.paint) {
          const fontScale = def.font ?? 0.42;
          const radiusCss =
            typeof def.radius === "string"
              ? def.radius
              : def.radius === undefined
                ? "0px"
                : def.radius >= 999
                  ? `${Math.round(size / 2)}px`
                  : `${Math.round(def.radius * size)}px`;
          const painted = def.paint ? def.paint(accent, size) : {};
          const base: CSSProperties = {
            borderRadius: radiusCss,
            background: `linear-gradient(145deg, ${shade(accent, 0.3)}, ${accent})`,
            boxShadow: `0 4px 12px ${withAlpha(accent, 0.45)}`,
          };
          if (painted.background || painted.backgroundImage) delete base.background;
          if (painted.backgroundImage || painted.boxShadow) delete base.boxShadow;
          return {
            style: box(wide, size, Math.round(size * fontScale)),
            surface: { ...base, ...painted },
            line: def.line
              ? { color: def.lineColor ? def.lineColor(accent) : withAlpha("#ffffff", 0.5), width: Math.max(1.5, def.line * size) }
              : undefined,
            content: text,
            fontScale,
            color: def.ink ? def.ink(accent) : "#ffffff",
            aspect,
          };
        }

        return { style: { display: "none" }, surface: {}, content: "", color: accent, fontScale: 0, aspect: 1 };
      }
    }
  })();

  const surface: CSSProperties = { ...draft.surface };
  const outline = applyChannels(def, draft, theme, size, surface, accent);
  const style: CSSProperties = { ...draft.style };
  const nudge = nudgeOf(theme);
  if (nudge) style.transform = nudge;

  /* how the silhouette is cut, so an effect's own passes follow it */
  const clip: NumberClip = {};
  if (surface.borderRadius !== undefined) clip.borderRadius = String(surface.borderRadius);
  if (surface.clipPath) clip.clipPath = String(surface.clipPath);
  if (def.points) clip.points = def.points;

  /* the marker's shape effect — its body only, never the number */
  const height = typeof style.height === "number" ? style.height : size;
  const effect = bulletEffectPaint(theme, size, accent, markerPlate(surface, accent), height);
  if (effect?.layer && typeof effect.layer.filter === "string" && !clip.clipPath) {
    /**
     * With no clip-path to cut a shadow away, the filter rides on the body
     * itself — so the body's own transparency fades the shadow with it, exactly
     * like the fill. A cut silhouette keeps the filter on the wrapper instead.
     */
    effect.surface = { ...(effect.surface ?? {}), filter: effect.layer.filter };
    delete effect.layer.filter;
    if (!Object.keys(effect.layer).length) effect.layer = undefined;
  }

  return {
    style,
    surface,
    content: draft.content,
    fontScale: draft.fontScale,
    color: draft.color,
    aspect: draft.aspect,
    outline,
    marks: draft.marks,
    clip: Object.keys(clip).length ? clip : undefined,
    effect,
  };
}

/** the colour a marker reads as — the fill it ended up with, else the accent */
function markerPlate(surface: CSSProperties, accent: string): string {
  for (const value of [surface.background, surface.backgroundImage]) {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) continue;
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    const hex = /#[0-9a-f]{6}/i.exec(v);
    if (hex) return hex[0];
    const rgba = /rgba?\([^)]*\)/i.exec(v);
    if (rgba) return rgba[0];
  }
  return accent;
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

  /* --- fill: a solid colour, or the gradient the colour card built ------- */
  const fill = normalizeBulletColor(theme.bulletFill);
  const fillGrad = enabledGradient(theme.bulletFillGradient);
  if (fill === BULLET_COLOR_NONE) {
    delete surface.background;
    delete surface.backgroundImage;
  } else if (fillGrad) {
    delete surface.backgroundImage;
    surface.background = gradientCss(fillGrad, fill || accent);
  } else if (fill) {
    delete surface.backgroundImage;
    surface.background = fill;
  }

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

  const borderGrad = enabledGradient(theme.bulletBorderGradient);

  if (def.points) {
    const stroke: NumberOutline = {
      points: def.points,
      width,
      color: ink,
      style: style === "auto" ? "solid" : style,
      gradient: borderGrad,
    };
    stroke.dash = strokeDash(stroke.style, width);
    return stroke;
  }

  if (line?.sides === "left-bottom") {
    /* a gradient cannot follow two sides only — the bracket keeps its solid line */
    surface.borderLeft = `${width}px ${cssLineStyle(style)} ${ink}`;
    surface.borderBottom = `${width}px ${cssLineStyle(style)} ${ink}`;
    return undefined;
  }

  if (borderGrad) {
    /**
     * A gradient line: the border itself goes transparent and the box paints
     * two background layers — the body clipped to the padding box, the line
     * clipped to the border box — so the gradient follows the corner radius.
     */
    const fillLayer = backgroundLayerCss(surface);
    delete surface.background;
    delete surface.backgroundImage;
    surface.backgroundImage = `${fillLayer}, ${gradientCss(borderGrad, color)}`;
    surface.backgroundOrigin = "border-box";
    surface.backgroundClip = "padding-box, border-box";
    surface.border = `${width}px ${cssLineStyle(style)} transparent`;
    return undefined;
  }

  surface.border = `${width}px ${cssLineStyle(style)} ${ink}`;
  return undefined;
}

/** a gradient the picker actually switched on (two stops or more) */
function enabledGradient(g: Gradient | undefined): Gradient | undefined {
  return g?.enabled && (g.stops?.length ?? 0) >= 2 ? g : undefined;
}

/** the body's own paint expressed as ONE background-image layer */
function backgroundLayerCss(surface: CSSProperties): string {
  const none = "linear-gradient(transparent, transparent)";
  for (const value of [surface.backgroundImage, surface.background]) {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) continue;
    if (v.includes("gradient")) return v;
    if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(v)) return `linear-gradient(${v}, ${v})`;
  }
  return none;
}
