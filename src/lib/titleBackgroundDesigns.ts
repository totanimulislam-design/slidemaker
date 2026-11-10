/**
 * Title background ▸ Design presets — the studio collection.
 *
 * The original sixty academy / platform looks live in `lib/banner.ts`. This
 * module adds **120 more one-click title plates**, arranged as twelve design
 * families of ten colourways each. A family is a complete recipe: silhouette,
 * paint (solid · linear · radial · mesh · conic · reflected · glass · metallic
 * · pattern), outline, effects, corners, padding and heading accents. Every
 * palette changes the recipe's colours, angle, radius and finishing values, so
 * all 120 looks have their own fingerprint as well as their own live tile.
 *
 * The recipes deliberately use the same `BannerSettings` channels the cards
 * edit — nothing here is a special renderer. `bannerPresetPatch()` applies one
 * of these exactly like a hand-authored preset, and `bannerCss()` paints the
 * board, the inspector preview, the toolbar thumbnail and the export.
 */

import {
  DEFAULT_BANNER_EFFECTS,
  type BannerBorder,
  type BannerBorderStyle,
  type BannerEffects,
  type BannerPatternKind,
  type BannerSettings,
  type BannerShape,
  type BannerShapeFx,
  type Gradient,
  type GradientType,
} from "./types";
import type { BannerPreset, BannerPresetGroup } from "./banner";

type Stop = [string, number];

interface StudioPalette {
  name: string;
  /** the body's first / deepest / brightest colours */
  a: string;
  b: string;
  c: string;
  /** light heading ink for dark plates */
  ink: string;
  light: string;
  /** dark heading ink for pale plates */
  deep: string;
  /** a contrasting light, rim or decoration */
  accent: string;
}

interface StudioRecipe {
  group: BannerPresetGroup;
  /** the style name appended to each colourway */
  label: string;
  hint: string;
  keywords: string;
  shapes: BannerShape[];
  build: (p: StudioPalette, i: number, shape: BannerShape) => Partial<BannerSettings>;
}

/** ten colourways — each recipe dresses all ten, once each */
const STUDIO_PALETTES: StudioPalette[] = [
  { name: "Violet Haze", a: "#6d28d9", b: "#a855f7", c: "#f0abfc", ink: "#fff7ed", light: "#f5d0fe", deep: "#2e1065", accent: "#38bdf8" },
  { name: "Coral Bloom", a: "#be123c", b: "#fb7185", c: "#fed7aa", ink: "#fffaf0", light: "#ffe4e6", deep: "#4c0519", accent: "#facc15" },
  { name: "Lagoon Mint", a: "#0f766e", b: "#14b8a6", c: "#a7f3d0", ink: "#ecfeff", light: "#ccfbf1", deep: "#134e4a", accent: "#fbbf24" },
  { name: "Solar Amber", a: "#b45309", b: "#f59e0b", c: "#fde68a", ink: "#fffbeb", light: "#fef3c7", deep: "#451a03", accent: "#0ea5e9" },
  { name: "Midnight Cobalt", a: "#1e3a8a", b: "#2563eb", c: "#93c5fd", ink: "#eff6ff", light: "#bfdbfe", deep: "#0f172a", accent: "#f472b6" },
  { name: "Rose Quartz", a: "#9d174d", b: "#ec4899", c: "#fbcfe8", ink: "#fff1f2", light: "#fce7f3", deep: "#500724", accent: "#a78bfa" },
  { name: "Forest Lime", a: "#14532d", b: "#16a34a", c: "#bbf7d0", ink: "#f7fee7", light: "#dcfce7", deep: "#052e16", accent: "#facc15" },
  { name: "Arctic Silver", a: "#334155", b: "#94a3b8", c: "#e2e8f0", ink: "#f8fafc", light: "#f1f5f9", deep: "#0f172a", accent: "#22d3ee" },
  { name: "Tangerine Ink", a: "#9a3412", b: "#f97316", c: "#fdba74", ink: "#fff7ed", light: "#ffedd5", deep: "#431407", accent: "#818cf8" },
  { name: "Aqua Neon", a: "#0e7490", b: "#06b6d4", c: "#67e8f9", ink: "#ecfeff", light: "#cffafe", deep: "#083344", accent: "#f0abfc" },
];

/* --------------------------------------------------------------- helpers */

function fx(part: Omit<Partial<BannerEffects>, "shape"> & { shape?: Partial<BannerShapeFx> }): BannerEffects {
  return {
    ...part,
    shape: { ...DEFAULT_BANNER_EFFECTS.shape, ...(part.shape ?? {}) },
  };
}

function grad(type: GradientType, angle: number, stops: Stop[], cx?: number, cy?: number): Gradient {
  return {
    enabled: true,
    type,
    angle,
    stops: stops.map(([color, at]) => ({ color, at })),
    ...(cx === undefined ? {} : { cx, cy }),
  };
}

function lin(angle: number, ...stops: Stop[]): Gradient {
  return grad("linear", angle, stops);
}

function radGrad(cx: number, cy: number, ...stops: Stop[]): Gradient {
  return grad("radial", 90, stops, cx, cy);
}

function meshGrad(colors: string[]): Gradient {
  const step = 100 / Math.max(1, colors.length - 1);
  return grad("mesh", 90, colors.map((color, i): Stop => [color, Math.round(i * step)]));
}

function conicGrad(angle: number, ...stops: Stop[]): Gradient {
  return grad("conic", angle, stops);
}

function reflGrad(angle: number, ...stops: Stop[]): Gradient {
  return grad("reflected", angle, stops);
}

/** a switched-off ramp that still remembers the colourway, ready to switch on */
function offGrad(p: StudioPalette): Gradient {
  return { enabled: false, type: "linear", angle: 90, stops: [{ color: p.a, at: 0 }, { color: p.b, at: 100 }] };
}

const BORDER_STYLES: BannerBorderStyle[] = ["solid", "dashed", "dotted", "double", "none"];
const PATTERN_KINDS: BannerPatternKind[] = ["dots", "stripes", "lines", "grid", "checker", "diamonds", "rays", "rings"];
const GLASS_KINDS = ["glass", "frosted", "acrylic", "clearGlass", "glassEdge", "tinted", "glass", "frosted", "acrylic", "glassEdge"] as const;
const GLOW_KINDS = ["outer", "neon", "soft", "halo", "backlight", "aurora", "outlineGlow", "inner", "outer", "neon"] as const;
const SHADOW_KINDS = ["drop", "soft", "hard", "long", "inner", "floating", "offset", "colored", "double", "surround", "layered", "cast"] as const;
const HIGHLIGHT_KINDS = ["highlight", "gloss", "sheen", "shine", "reflection", "spotlight", "rimLight", "edgeHighlight", "innerHighlight", "outerHighlight"] as const;
const DECOR_KINDS = ["vignette", "texture", "pattern", "dots", "grid", "stitch", "sunburst", "gradientShadow", "colorShadow", "edgeDarkening", "stripes", "checker", "fadeRight", "fadeEdges", "ring", "offsetOutline", "sticker", "stack", "topBar", "bottomBar", "leftBar", "cornerFold"] as const;
const MODERN_KINDS = ["noise", "softGradient", "mesh", "holographic", "metallic", "duotone", "softUi"] as const;
const BEVEL_KINDS = ["bevel", "innerBevel", "outerBevel", "emboss", "ridge", "groove", "pillow"] as const;
const THREE_D_KINDS = ["extrusion", "depth", "layered3d", "perspective", "tilt", "pop", "raised", "pressed", "isometric"] as const;

function studioBorder(p: StudioPalette, i: number, style: BannerBorderStyle, glow = false, on = true): BannerBorder {
  return {
    enabled: on,
    color: glow ? p.accent : p.light,
    width: 1 + (i % 3) * 0.5,
    style,
    opacity: 0.72 + (i % 5) * 0.06,
    ...(glow ? { glow: { enabled: true, size: 8 + i * 2, intensity: 48 + (i % 5) * 8, color: p.accent } } : {}),
  };
}

/**
 * The channels every studio look writes. A recipe supplies its own paint and
 * effects, then may override the line, corners or heading ink in `extras`.
 */
function studioBase(
  p: StudioPalette,
  i: number,
  shape: BannerShape,
  paint: Partial<BannerSettings>,
  effects: BannerEffects,
  extras: Partial<BannerSettings> = {},
): Partial<BannerSettings> {
  return {
    shape,
    color: p.deep,
    gradient: lin(90 + (i * 9) % 100, [p.a, 0], [p.b, 50], [p.c, 100]),
    opacity: 1,
    padX: 3 + (i % 5),
    padY: 9 + (i % 6),
    radius: 10 + (i * 7) % 34,
    halo: (i * 3) % 26,
    border: studioBorder(p, i, BORDER_STYLES[i % BORDER_STYLES.length], i % 3 === 0),
    effects,
    textGradient: lin(180, [p.ink, 0], [p.light, 100]),
    textGlow: (i % 4) * 5,
    textShadow: i % 2 === 0,
    shimmer: i % 4 === 0,
    ...paint,
    ...extras,
  };
}

const darkInk = (p: StudioPalette) => lin(180, [p.deep, 0], [p.a, 100]);
const lightInk = (p: StudioPalette) => lin(180, [p.ink, 0], [p.light, 100]);

/* --------------------------------------------------------------- recipes */

const STUDIO_RECIPES: StudioRecipe[] = [
  {
    group: "Aurora Glass",
    label: "Aurora Pane",
    hint: "frosted aurora panes with soft glass rims",
    keywords: "glass frosted acrylic translucent glow pane",
    shapes: ["glassPlate", "rounded", "softRounded", "pill", "capsule", "arch", "wavePlate", "organicPlate", "outlineBanner", "floatingPlate"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "glass",
          color: p.a,
          glass: { color: p.deep, opacity: 52 + i * 2, frost: 48 + i * 3 },
          gradient: offGrad(p),
        },
        fx({
          glass: { kind: GLASS_KINDS[i], intensity: 42 + i * 3, blur: 7 + i, color: p.b },
          glow: { kind: "aurora", intensity: 38 + i * 4, blur: 10 + i * 2, color: p.accent },
          highlight: { kind: "innerHighlight", intensity: 35 + i * 2, blur: 8 + i, angle: 180, color: p.light },
        }),
        {
          radius: 18 + i * 2,
          halo: 8 + i * 2,
          border: studioBorder(p, i, "solid", true),
          textGradient: lightInk(p),
        },
      ),
  },
  {
    group: "Neon Arcade",
    label: "Arcade Flash",
    hint: "conic neon plates with hard arcade edges",
    keywords: "neon arcade conic glow hard edge cyber",
    shapes: ["hex", "burstPlate", "sunburstPlate", "chevron", "swoosh", "cutCorner", "octagonBanner", "asymmetricBanner", "angledBanner", "steppedBanner"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: conicGrad(20 + i * 18, [p.deep, 0], [p.a, 28], [p.accent, 66], [p.deep, 100]),
        },
        fx({
          glow: { kind: GLOW_KINDS[i], intensity: 55 + i * 3, blur: 6 + i * 2, color: p.accent },
          shadow: { kind: SHADOW_KINDS[(i + 2) % SHADOW_KINDS.length], x: 5 + i, y: 6 + i, blur: 0, spread: 0, opacity: 50 + i, color: p.deep },
          highlight: { kind: HIGHLIGHT_KINDS[i], intensity: 45 + i * 2, blur: 4 + i, angle: 35 + i * 10, color: p.light },
          decor: { kind: "ring", intensity: 28 + i * 3, color: p.accent },
        }),
        {
          halo: 14 + i * 2,
          border: studioBorder(p, i, i % 2 ? "solid" : "dotted", true),
          cornersIndependent: i % 3 === 0,
          ...(i % 3 === 0 ? { corners: { tl: 4 + i, tr: 22 + i, br: 4 + i, bl: 22 + i } } : {}),
          textGradient: lightInk(p),
        },
      ),
  },
  {
    group: "Editorial Ink",
    label: "Editorial Bar",
    hint: "magazine head bands, rules and split bars",
    keywords: "editorial magazine ink rule split bar print",
    shapes: ["rect", "split", "titleBanner", "offsetLine", "underline", "classicBanner", "tab", "halfRound", "softSquare", "frame"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: lin(85 + i * 7, [p.deep, 0], [p.a, 65], [p.b, 100]),
        },
        fx({
          decor: { kind: DECOR_KINDS[(i * 2) % DECOR_KINDS.length], intensity: 32 + i * 3, color: p.accent },
          highlight: { kind: "sheen", intensity: 28 + i * 2, blur: 12 + i, angle: 20 + i * 8, color: p.light },
          shadow: { kind: "soft", x: 0, y: 6 + i, blur: 18 + i * 2, spread: 0, opacity: 32 + i, color: p.deep },
        }),
        {
          radius: 3 + i * 2,
          halo: 0,
          border: studioBorder(p, i, i % 2 ? "double" : "solid", false),
          textGradient: lightInk(p),
          textShadow: true,
          shimmer: false,
        },
      ),
  },
  {
    group: "Chrome Lab",
    label: "Chrome Cut",
    hint: "brushed chrome cuts with a bevelled edge",
    keywords: "chrome metallic bevel cut corner 3d silver",
    shapes: ["cutCorner", "chamferedBanner", "singleCut", "doubleCut", "octagonBanner", "trapezoidBanner", "plate3d", "geoPlate", "skewedRect", "angledBanner"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "metallic",
          color: p.deep,
          metallic: { color: p.light, angle: 100 + i * 7, polish: 64 + i * 2 },
          gradient: offGrad(p),
        },
        fx({
          bevel: { kind: BEVEL_KINDS[i % BEVEL_KINDS.length], intensity: 38 + i * 3, blur: 1 + (i % 4), angle: 0, color: "#ffffff" },
          highlight: { kind: HIGHLIGHT_KINDS[(i + 3) % HIGHLIGHT_KINDS.length], intensity: 42 + i * 2, blur: 3 + i, angle: 25 + i * 9, color: "#ffffff" },
          threeD: { kind: "extrusion", intensity: 24 + i * 2, blur: 0, angle: 120 + i * 5, color: p.deep },
        }),
        {
          border: studioBorder(p, i, "solid", false),
          textGradient: darkInk(p),
          textGlow: 0,
          textShadow: false,
          halo: 4 + (i % 4) * 3,
        },
      ),
  },
  {
    group: "Soft UI Studio",
    label: "Soft Card",
    hint: "quiet soft-UI cards with light and shadow",
    keywords: "soft ui neumorphism minimal card quiet pastel",
    shapes: ["softRounded", "rounded", "softSquare", "curvedRect", "halfRound", "ovalPlate", "pill", "floatingPlate", "glassPlate", "roundedBlob"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "solid",
          color: p.c,
          gradient: offGrad(p),
        },
        fx({
          modern: { kind: "softUi", intensity: 45 + i * 3, color: p.b, blur: 10 + i },
          shadow: { kind: SHADOW_KINDS[(i + 5) % SHADOW_KINDS.length], x: 4 + i, y: 7 + i, blur: 18 + i * 2, spread: 2, opacity: 26 + i, color: p.deep },
          highlight: { kind: "innerHighlight", intensity: 30 + i * 2, blur: 10 + i, angle: 180, color: "#ffffff" },
        }),
        {
          opacity: 0.97,
          radius: 22 + i * 3,
          halo: 0,
          border: studioBorder(p, i, "solid", false, i % 3 === 0),
          textGradient: darkInk(p),
          textGlow: 0,
          textShadow: false,
          shimmer: false,
        },
      ),
  },
  {
    group: "Retro Print",
    label: "Retro Ticket",
    hint: "two-ink print, tickets and patterned ribbons",
    keywords: "retro print ticket ribbon pattern texture halftone",
    shapes: ["ribbon", "ticketBanner", "scrollBanner", "badgeBanner", "foldedBanner", "flagBanner", "doubleRibbon", "tripleLayer", "sealBadge", "emblemPlate"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "pattern",
          color: p.deep,
          pattern: { kind: PATTERN_KINDS[i % PATTERN_KINDS.length], color: p.deep, back: p.c, scale: 34 + i * 4 },
          gradient: offGrad(p),
        },
        fx({
          decor: { kind: DECOR_KINDS[(i + 1) % DECOR_KINDS.length], intensity: 35 + i * 3, color: p.a },
          shadow: { kind: i % 2 ? "double" : "offset", x: 7 + i, y: 7 + i, blur: 0, spread: 0, opacity: 45 + i, color: p.deep },
          modern: { kind: "duotone", intensity: 26 + i * 2, color: p.b, blur: 4 + i },
        }),
        {
          radius: 6 + i * 2,
          border: studioBorder(p, i, i % 3 === 0 ? "dotted" : i % 3 === 1 ? "dashed" : "double", false),
          textGradient: darkInk(p),
          textShadow: false,
          halo: 0,
        },
      ),
  },
  {
    group: "Botanical Calm",
    label: "Botanical Bloom",
    hint: "organic blobs with radial light and soft curves",
    keywords: "botanical organic blob cloud calm radial leaf",
    shapes: ["organicBlob", "abstractBlob", "wavyBlob", "cloudShape", "liquidShape", "amoebaShape", "freeformBlob", "organicPlate", "abstractPlate", "highlightBlob"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: radGrad(28 + (i % 4) * 14, 45 + (i % 3) * 8, [p.light, 0], [p.b, 52], [p.a, 100]),
        },
        fx(
          {
            glow: { kind: i % 2 ? "soft" : "halo", intensity: 32 + i * 3, blur: 14 + i * 2, color: p.accent },
            modern: { kind: MODERN_KINDS[i % MODERN_KINDS.length], intensity: 28 + i * 2, color: p.b, blur: 8 + i },
            decor: { kind: "vignette", intensity: 22 + i * 2, color: p.deep },
            shape: { wave: i * 2, curve: i * 2, rotation: (i % 3) - 1 },
          },
        ),
        {
          radius: 24 + i * 2,
          border: studioBorder(p, i, i % 2 ? "dotted" : "solid", false),
          textGradient: darkInk(p),
          textShadow: false,
        },
      ),
  },
  {
    group: "Cosmic Mesh",
    label: "Cosmic Pour",
    hint: "mesh gradients, holographic pours and star light",
    keywords: "cosmic mesh holographic aurora neon gradient space",
    shapes: ["liquidShape", "wavePlate", "domeBanner", "arch", "swoosh", "splashShape", "burstPlate", "sunburstPlate", "asymmetricBlob", "abstractPlate"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: meshGrad([p.deep, p.a, p.accent, p.b, p.light]),
        },
        fx({
          modern: { kind: i % 2 ? "holographic" : "mesh", intensity: 42 + i * 3, color: p.accent, blur: 9 + i },
          glow: { kind: "aurora", intensity: 45 + i * 3, blur: 12 + i * 2, color: p.accent },
          highlight: { kind: "shine", intensity: 38 + i * 2, blur: 8 + i, angle: 40 + i * 8, color: "#ffffff" },
          threeD: { kind: THREE_D_KINDS[i % THREE_D_KINDS.length], intensity: 18 + i * 2, blur: 0, angle: 90 + i * 9, color: p.deep },
        }),
        {
          halo: 12 + i * 2,
          border: studioBorder(p, i, "solid", true),
          cornersIndependent: i % 2 === 0,
          ...(i % 2 === 0 ? { corners: { tl: 20 + i, tr: 6 + i, br: 20 + i, bl: 6 + i } } : {}),
          textGradient: lightInk(p),
          textGlow: 8 + (i % 3) * 3,
        },
      ),
  },
  {
    group: "Paper Craft",
    label: "Paper Fold",
    hint: "stacked paper, folds, stitches and cut layers",
    keywords: "paper craft fold stack stitch layered notebook",
    shapes: ["stack", "frame", "accent", "longShadow", "gradStack", "sheen", "gloss", "stripes", "foldedBanner", "ticketBanner"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: reflGrad(170 + i * 5, [p.light, 0], [p.c, 48], [p.b, 100]),
        },
        fx({
          decor: { kind: DECOR_KINDS[(i * 3) % DECOR_KINDS.length], intensity: 30 + i * 3, color: p.a },
          shadow: { kind: i % 2 ? "layered" : "cast", x: 6 + i, y: 10 + i, blur: 10 + i, spread: 0, opacity: 34 + i, color: p.deep },
          modern: { kind: "noise", intensity: 20 + i * 2, color: p.deep, blur: 3 + i },
          shape: { rotation: (i % 3) - 1, distortion: i - 5 },
        }),
        {
          border: studioBorder(p, i, i % 2 ? "dashed" : "solid", false),
          textGradient: darkInk(p),
          textShadow: false,
          cornersIndependent: i % 2 === 0,
          ...(i % 2 === 0 ? { corners: { tl: 2 + i, tr: 18 + i, br: 2 + i, bl: 18 + i } } : {}),
        },
      ),
  },
  {
    group: "Heritage Gold",
    label: "Gilt Crest",
    hint: "ornate metallic crests with embossed 3D edges",
    keywords: "heritage gold gilt crest emboss ornate metallic luxury",
    shapes: ["doubleRibbon", "tripleLayer", "plate3d", "sealBadge", "emblemPlate", "frame", "badgeBanner", "scrollBanner", "octagonBanner", "chamferedBanner"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "metallic",
          color: p.deep,
          metallic: { color: p.c, angle: 118 + i * 6, polish: 72 + i * 2 },
          gradient: offGrad(p),
        },
        fx({
          bevel: { kind: BEVEL_KINDS[(i + 2) % BEVEL_KINDS.length], intensity: 46 + i * 3, blur: 2 + (i % 3), angle: 0, color: "#ffffff" },
          threeD: { kind: i % 2 ? "layered3d" : "isometric", intensity: 30 + i * 3, blur: 0, angle: 110 + i * 6, color: p.deep },
          highlight: { kind: "rimLight", intensity: 40 + i * 2, blur: 3 + i, angle: 30 + i * 7, color: p.accent },
          decor: { kind: "sunburst", intensity: 24 + i * 2, color: p.accent },
        }),
        {
          halo: 8 + i * 2,
          border: studioBorder(p, i, i % 2 ? "double" : "solid", i % 3 === 0),
          textGradient: darkInk(p),
          textGlow: 0,
          textShadow: false,
        },
      ),
  },
  {
    group: "Sports Desk",
    label: "Varsity Slant",
    hint: "varsity slants, hard shadows and speed stripes",
    keywords: "sports varsity slant chevron speed stripe bold",
    shapes: ["slant", "diagonalBanner", "skewedRect", "chevron", "swallow", "tab", "hex", "split", "steppedBanner", "pointedBanner"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "gradient",
          gradient: lin(100 + i * 8, [p.deep, 0], [p.a, 52], [p.accent, 100]),
        },
        fx({
          shadow: { kind: i % 2 ? "hard" : "long", x: 9 + i, y: 9 + i, blur: 0, spread: 8 + i, opacity: 48 + i, color: p.deep },
          threeD: { kind: "extrusion", intensity: 25 + i * 3, blur: 0, angle: 135, color: p.deep },
          highlight: { kind: "shine", intensity: 40 + i * 2, blur: 5 + i, angle: 25 + i * 6, color: p.light },
          decor: { kind: "stripes", intensity: 28 + i * 2, color: p.light },
          shape: { slant: i * 2, skew: (i % 5) - 2, rotation: (i % 3) - 1, flipH: i % 4 === 0 },
        }),
        {
          radius: 2 + (i % 5) * 3,
          halo: 0,
          border: studioBorder(p, i, i % 2 ? "solid" : "double", false),
          textGradient: lightInk(p),
          textShadow: true,
        },
      ),
  },
  {
    group: "Minimal Line",
    label: "Fine Rule",
    hint: "hairline rules, hollow plates and quiet accents",
    keywords: "minimal line rule hollow underline clean subtle",
    shapes: ["underline", "outlineBanner", "offsetLine", "titleBanner", "rect", "rounded", "halfRound", "pill", "softRounded", "curvedRect"],
    build: (p, i, shape) =>
      studioBase(
        p,
        i,
        shape,
        {
          fillMode: "solid",
          color: p.a,
          gradient: offGrad(p),
        },
        fx({
          highlight: { kind: HIGHLIGHT_KINDS[(i + 6) % HIGHLIGHT_KINDS.length], intensity: 22 + i * 2, blur: 2 + i, angle: 90 + i * 8, color: p.light },
          decor: { kind: DECOR_KINDS[(i + 13) % DECOR_KINDS.length], intensity: 18 + i * 2, color: p.accent },
          shadow: { kind: "soft", x: 0, y: 3 + i, blur: 10 + i, spread: 0, opacity: 18 + i, color: p.deep },
        }),
        {
          opacity: 0.92,
          radius: 2 + i * 2,
          halo: 0,
          padY: 8 + (i % 4),
          border: studioBorder(p, i, BORDER_STYLES[(i + 1) % 4], false),
          textGradient: lightInk(p),
          textGlow: 0,
          textShadow: i % 2 === 0,
          shimmer: false,
        },
      ),
  },
];

/** the twelve new gallery headings, in the order the recipes appear */
export const STUDIO_TITLE_PRESET_GROUPS: BannerPresetGroup[] = STUDIO_RECIPES.map((r) => r.group);

/** short headings beside each group in the gallery */
export const STUDIO_TITLE_GROUP_HINTS: Record<string, string> = Object.fromEntries(
  STUDIO_RECIPES.map((r) => [r.group, r.hint]),
) as Record<string, string>;

/** 120 distinct one-click title plates, ten in each new family */
export const STUDIO_TITLE_PRESETS: BannerPreset[] = STUDIO_RECIPES.flatMap((recipe, recipeIndex) =>
  STUDIO_PALETTES.map((palette, paletteIndex): BannerPreset => ({
    name: `${palette.name} ${recipe.label}`,
    group: recipe.group,
    swatch: `linear-gradient(${90 + recipeIndex * 13}deg,${palette.a},${palette.b},${palette.c})`,
    hint: `${recipe.hint} · ${recipe.keywords} · ${palette.name}`,
    banner: recipe.build(palette, paletteIndex, recipe.shapes[paletteIndex]),
  })),
);

export const STUDIO_TITLE_PRESET_COUNT = STUDIO_TITLE_PRESETS.length;
