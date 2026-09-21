/**
 * Slide design presets — one click paints a whole slide look.
 *
 * The Design destination is a gallery of complete looks. Every preset writes,
 * in a single deck patch, the thirteen things that make a slide read as
 * "designed" rather than "typed":
 *
 *   1. Badge 1                 the upper brand line (ink · size · face · case)
 *   2. Badge 2                 the lower brand line
 *   3. Badge 3                 the right-hand tag, plate included
 *   4. Title text              the heading's ink, size, face, weight, effect
 *   5. Title background        the plate behind it (shape · gradient · glow)
 *   6. Question bullet         the number marker's shape, fill, ring, effect
 *   7. Question text           the stem's ink, size, face, weight
 *   8. Option text             the choices' ink, size, face, weight
 *   9. Option bullet marker    the choice marker's silhouette and colours
 *  10. Option bullet background the plate behind the marker, or behind the row
 *  11. Option row               the row container style, gap and leading
 *  12. Board background         the board colour, gradient and pattern art
 *  13. Frame                    the frame's material, colour and thickness
 *
 * Where the looks come from
 * ------------------------
 * They are distilled from the slide language of Bangladeshi coaching,
 * admission-prep and classroom video lessons — the boards students see every
 * day: the near-black board with a gold title pill and a bright marker chip in
 * the corner, the green chalkboard with chalk-white text in a wooden frame, the
 * white exam sheet with a red head band and square outline markers, the mint
 * medical-admission sheet, the neon night board, the mesh-gradient glass deck,
 * the cream notebook page. Each family below keeps that structure and every
 * design inside it changes palette, plate silhouette, marker shape, row style
 * and frame material, so no two designs paint the same slide. Nothing here is
 * named after, or credited to, any platform: these are looks, not logos.
 */

import { BG_PRESETS, type BgDesignPreset } from "./backgroundDesigns";
import { readableOn, shade } from "./color";
import { ensureFontStylesheet, fontChoiceFor, type FontChoice } from "./fonts";
import type { NumberStyle } from "./numberStyles";
import type { OptionBulletShape, OptionBulletTreatment } from "./optionBulletShapes";
import type { OptionStyle } from "./optionStyles";
import {
  cloneBanner,
  cloneBadgePlate,
  cloneFrame,
  DEFAULT_THEME,
  type BackgroundSettings,
  type BannerSettings,
  type BannerShape,
  type BoxFonts,
  type BoxTypeface,
  type FrameSettings,
  type FrameStyleId,
  type Gradient,
  type OptionBulletBgScope,
  type OptionBulletBgShape,
  type ShapeEffectKind,
  type TextEffect,
  type ThemeSettings,
} from "./types";

/* ============================================================== vocabulary */

/** The look families the gallery is browsed by. */
export type DesignFamilyId =
  | "classic"
  | "chalk"
  | "neon"
  | "paper"
  | "royal"
  | "medical"
  | "mesh"
  | "sunset"
  | "campus"
  | "gilt"
  | "notebook"
  | "mono"
  | "cyber"
  | "pastel"
  | "forest"
  | "retro";

export interface DesignFamily {
  id: DesignFamilyId;
  label: string;
  /** what the family's slides look like — shown as the group's hint */
  hint: string;
}

export const DESIGN_FAMILIES: DesignFamily[] = [
  { id: "classic", label: "Classic board", hint: "Dark board, glowing title plate, bright marker chip" },
  { id: "chalk", label: "Chalk & slate", hint: "Chalkboard greens and slates with chalk-white type" },
  { id: "neon", label: "Neon night", hint: "Near-black boards with neon rings and glass rows" },
  { id: "paper", label: "Exam paper", hint: "White question sheets with a coloured head band" },
  { id: "royal", label: "Royal luxe", hint: "Maroon, emerald and sapphire with gilt frames" },
  { id: "medical", label: "Medical mint", hint: "Clean mint and teal sheets for admission prep" },
  { id: "mesh", label: "Mesh gradient", hint: "Soft colour-mesh boards with frosted cards" },
  { id: "sunset", label: "Sunset energy", hint: "Ember, amber and crimson over warm slate" },
  { id: "campus", label: "Campus blue", hint: "Bright blue school look with white cards" },
  { id: "gilt", label: "Gilt arabesque", hint: "Midnight and emerald with gold pattern art" },
  { id: "notebook", label: "Notebook", hint: "Ruled and gridded paper pages, ink and margin red" },
  { id: "mono", label: "Minimal mono", hint: "Quiet off-white sheets, hairline rules, dot markers" },
  { id: "cyber", label: "Cyber grid", hint: "Blueprint grids, synth horizons, terminal greens" },
  { id: "pastel", label: "Pastel junior", hint: "Soft pastels and rounded shapes for young classes" },
  { id: "forest", label: "Deep forest", hint: "Green science boards with lime and gold accents" },
  { id: "retro", label: "Retro print", hint: "Kraft, newsprint and two-colour poster inks" },
];

/**
 * A design's palette. Short keys keep 128 recipes readable: every design is
 * one line of colour plus, when it differs from its family, one line of shape.
 */
export interface Palette {
  /** board base colour — painted under every background layer */
  bd: string;
  /** background preset id (gradient + pattern art), "" = the flat board */
  bg?: string;
  /** pattern-art opacity 0–1 (default 1) */
  bgInk?: number;
  /** edge darkening 0–100 */
  vg?: number;
  /** frame material colour (default: the accent) */
  fr?: string;
  /** title ink */
  ti: string;
  /** title plate colour */
  bn: string;
  /** title plate gradient's far stop (default: a darker `bn`) */
  bn2?: string;
  /** question stem ink */
  q: string;
  /** option text ink */
  o: string;
  /** accent — markers, question bullet, row highlights */
  ac: string;
  /** Badge 1 + Badge 2 ink */
  br: string;
  /** Badge 2 ink when it differs from Badge 1 */
  br2?: string;
  /** Badge 3 ink (default: `br`) */
  b3?: string;
  /** Badge 3 plate colour (undefined = no plate) */
  chip?: string;
  /** footnote ink (default: the option ink) */
  nt?: string;
}

/** What the marker's own colour channels resolve to. */
type MarkerChannel = "accent" | "none" | "soft" | "ink" | "board";

/**
 * A design's structure: silhouettes, sizes, faces and effects. Families supply
 * the defaults; a design overrides only what makes it different.
 */
export interface Kit {
  /* ---- title background (5) ---- */
  bannerShape: BannerShape;
  bannerGradient: boolean;
  bannerAngle: number;
  bannerRadius: number;
  bannerGlow: number;
  bannerHalo: number;
  bannerBorder: boolean;
  bannerBorderWidth: number;
  bannerBorderInk?: string;
  bannerPadY: number;
  /* ---- title text (4) ---- */
  titleSize: number;
  titleFamily?: string;
  titleWeight: number;
  titleCase: boolean;
  titleSpacing: number;
  titleGradient: boolean;
  titleGlow: number;
  titleShadow: boolean;
  titleEffect?: TextEffect;
  /* ---- badges 1 · 2 · 3 ---- */
  badgeFamily?: string;
  badgeWeight: number;
  badgeCase: boolean;
  badgeSpacing: number;
  b1Size: number;
  b2Size: number;
  b3Size: number;
  chip: boolean;
  chipRadius: number;
  chipPadX: number;
  chipBorder: boolean;
  /* ---- question bullet (6) ---- */
  numberStyle: NumberStyle;
  bulletSize: number;
  bulletGradient: boolean;
  bulletBorder: boolean;
  bulletBorderInk?: string;
  bulletBorderWeight: number;
  bulletRadius?: number;
  bulletEffect?: ShapeEffectKind;
  bulletEffectIntensity: number;
  bulletInk: string;
  bulletFamily?: string;
  bulletWeight: number;
  bulletScale: number;
  showBullet: boolean;
  /* ---- question text (7) ---- */
  questionSize: number;
  questionFamily?: string;
  questionWeight: number;
  /* ---- option text (8) ---- */
  optionSize: number;
  optionFamily?: string;
  optionWeight: number;
  /* ---- option marker (9) ---- */
  markerShape: OptionBulletShape;
  markerTreatment: OptionBulletTreatment;
  markerFill: MarkerChannel;
  markerRing: MarkerChannel;
  markerInk?: string;
  markerTextSize: number;
  markerWeight: number;
  markerFamily?: string;
  /* ---- marker background (10) ---- */
  markerBg: boolean;
  markerBgInk?: MarkerChannel;
  markerBgShape: OptionBulletBgShape;
  markerBgScope: OptionBulletBgScope;
  markerBgSize: number;
  markerBgOpacity: number;
  /* ---- option row (11) ---- */
  rowStyle: OptionStyle;
  rowGap: number;
  rowLine: number;
  /* ---- frame (13) ---- */
  frameStyle: FrameStyleId;
  frameWidth: number;
  frameRadius: number;
  frameShadow: boolean;
  frameGradient: boolean;
  showFrame: boolean;
  /* ---- footnote + answer ---- */
  noteSize: number;
  noteOpacity: number;
  answerStyle: "glow" | "tick" | "fill";
}

export interface SlideDesignPreset {
  /** stable id — also the analytics / test handle */
  id: string;
  name: string;
  family: DesignFamilyId;
  /** one line describing the look */
  hint: string;
  /** palette strip painted on the gallery card */
  swatch: string[];
  /** the whole look, as one deck patch */
  theme: Partial<ThemeSettings>;
}

/* ================================================================= defaults */

const BASE_KIT: Kit = {
  bannerShape: "pill",
  bannerGradient: true,
  bannerAngle: 100,
  bannerRadius: 999,
  bannerGlow: 55,
  bannerHalo: 0,
  bannerBorder: false,
  bannerBorderWidth: 2,
  bannerPadY: 26,
  titleSize: 54,
  titleWeight: 700,
  titleCase: false,
  titleSpacing: 0,
  titleGradient: false,
  titleGlow: 20,
  titleShadow: true,
  badgeWeight: 700,
  badgeCase: true,
  badgeSpacing: 1.2,
  b1Size: 25,
  b2Size: 27,
  b3Size: 36,
  chip: false,
  chipRadius: 999,
  chipPadX: 18,
  chipBorder: false,
  numberStyle: "circle",
  bulletSize: 54,
  bulletGradient: true,
  bulletBorder: false,
  bulletBorderWeight: 2,
  bulletEffectIntensity: 45,
  bulletInk: "#ffffff",
  bulletWeight: 700,
  bulletScale: 1,
  showBullet: true,
  questionSize: 34,
  questionWeight: 600,
  optionSize: 30,
  optionWeight: 500,
  markerShape: "circle",
  markerTreatment: "filled",
  markerFill: "accent",
  markerRing: "none",
  markerTextSize: 100,
  markerWeight: 700,
  markerBg: false,
  markerBgShape: "match",
  markerBgScope: "marker",
  markerBgSize: 150,
  markerBgOpacity: 30,
  rowStyle: "soft",
  rowGap: 0,
  rowLine: 1.45,
  frameStyle: "thin",
  frameWidth: 14,
  frameRadius: 12,
  frameShadow: true,
  frameGradient: false,
  showFrame: true,
  noteSize: 20,
  noteOpacity: 72,
  answerStyle: "glow",
};

/** what each family paints unless a design says otherwise */
const FAMILY_KIT: Record<DesignFamilyId, Partial<Kit>> = {
  classic: {
    bannerShape: "pill",
    bannerGradient: true,
    bannerGlow: 60,
    titleSize: 54,
    titleFamily: "Oswald",
    titleCase: true,
    titleSpacing: 0.6,
    numberStyle: "circle",
    bulletGradient: true,
    bulletEffect: "glow",
    markerShape: "circle",
    markerTreatment: "filled",
    rowStyle: "soft",
    frameStyle: "thin",
    frameWidth: 12,
    badgeFamily: "Oswald",
    chip: true,
  },
  chalk: {
    bannerShape: "underline",
    bannerGradient: false,
    bannerGlow: 30,
    titleSize: 56,
    titleFamily: "Kalam",
    titleWeight: 700,
    titleShadow: false,
    titleGlow: 0,
    numberStyle: "dottedRing",
    bulletGradient: false,
    bulletEffect: undefined,
    bulletBorder: true,
    bulletBorderWeight: 2,
    markerShape: "ring",
    markerTreatment: "outlined",
    markerFill: "none",
    markerRing: "accent",
    rowStyle: "plain",
    frameStyle: "wood",
    frameWidth: 26,
    frameRadius: 14,
    badgeFamily: "Kalam",
    badgeCase: false,
    questionFamily: "Hind Siliguri",
    optionFamily: "Hind Siliguri",
  },
  neon: {
    bannerShape: "rounded",
    bannerGradient: true,
    bannerGlow: 85,
    bannerHalo: 40,
    bannerRadius: 18,
    titleSize: 54,
    titleFamily: "Orbitron",
    titleCase: true,
    titleGlow: 60,
    numberStyle: "ring",
    bulletGradient: false,
    bulletBorder: true,
    bulletBorderWeight: 3,
    bulletEffect: "neon",
    bulletEffectIntensity: 70,
    markerShape: "ring",
    markerTreatment: "glow",
    markerFill: "none",
    markerRing: "accent",
    markerBg: true,
    markerBgShape: "soft",
    markerBgOpacity: 26,
    rowStyle: "neon",
    frameStyle: "neon",
    frameWidth: 16,
    frameRadius: 18,
    badgeFamily: "Orbitron",
  },
  paper: {
    bannerShape: "rect",
    bannerGradient: false,
    bannerGlow: 0,
    bannerRadius: 4,
    bannerPadY: 18,
    titleSize: 48,
    titleFamily: "Roboto Condensed",
    titleCase: true,
    titleShadow: false,
    titleGlow: 0,
    numberStyle: "square",
    bulletGradient: false,
    bulletEffect: undefined,
    bulletRadius: 4,
    markerShape: "square",
    markerTreatment: "outlined",
    markerFill: "none",
    markerRing: "accent",
    rowStyle: "outline",
    rowGap: 1,
    frameStyle: "thin",
    frameWidth: 8,
    frameRadius: 4,
    frameShadow: false,
    badgeFamily: "Roboto Condensed",
    questionFamily: "Noto Serif Bengali",
    questionWeight: 600,
    optionFamily: "Noto Sans Bengali",
  },
  royal: {
    bannerShape: "ribbon",
    bannerGradient: true,
    bannerGlow: 45,
    bannerRadius: 10,
    titleSize: 56,
    titleFamily: "Cinzel",
    titleCase: true,
    titleSpacing: 1.4,
    titleGradient: true,
    titleGlow: 25,
    numberStyle: "shield",
    bulletGradient: true,
    bulletBorder: true,
    bulletBorderWeight: 2,
    bulletEffect: "bevel",
    markerShape: "shield",
    markerTreatment: "filled",
    rowStyle: "panel",
    frameStyle: "gold",
    frameWidth: 26,
    frameRadius: 14,
    badgeFamily: "Cinzel",
    chip: true,
    chipBorder: true,
    questionFamily: "Noto Serif Bengali",
  },
  medical: {
    bannerShape: "rounded",
    bannerGradient: true,
    bannerGlow: 25,
    bannerRadius: 16,
    titleSize: 50,
    titleFamily: "Barlow Condensed",
    titleCase: true,
    titleShadow: false,
    numberStyle: "rounded",
    bulletGradient: true,
    bulletEffect: "lift",
    bulletEffectIntensity: 40,
    bulletRadius: 12,
    markerShape: "roundedSquare",
    markerTreatment: "soft",
    rowStyle: "card",
    rowGap: 1,
    frameStyle: "thin",
    frameWidth: 10,
    frameRadius: 16,
    badgeFamily: "Barlow Condensed",
    chip: true,
    chipRadius: 12,
    questionFamily: "Hind Siliguri",
    optionFamily: "Hind Siliguri",
  },
  mesh: {
    bannerShape: "rounded",
    bannerGradient: true,
    bannerGlow: 30,
    bannerRadius: 22,
    titleSize: 52,
    titleFamily: "Poppins",
    titleWeight: 700,
    numberStyle: "squircle",
    bulletGradient: true,
    bulletEffect: "glass",
    markerShape: "roundedSquare",
    markerTreatment: "soft",
    markerBg: true,
    markerBgShape: "soft",
    markerBgScope: "marker",
    markerBgOpacity: 24,
    rowStyle: "glass",
    rowGap: 1.5,
    frameStyle: "glass",
    frameWidth: 14,
    frameRadius: 22,
    badgeFamily: "Poppins",
    chip: true,
    chipRadius: 14,
  },
  sunset: {
    bannerShape: "pill",
    bannerGradient: true,
    bannerAngle: 90,
    bannerGlow: 60,
    titleSize: 54,
    titleFamily: "Anton",
    titleCase: true,
    titleSpacing: 0.4,
    numberStyle: "flame",
    bulletGradient: true,
    bulletEffect: "glow",
    bulletEffectIntensity: 55,
    markerShape: "drop",
    markerTreatment: "filled",
    rowStyle: "gradient",
    frameStyle: "lava",
    frameWidth: 18,
    frameRadius: 14,
    badgeFamily: "Anton",
    chip: true,
  },
  campus: {
    bannerShape: "rounded",
    bannerGradient: true,
    bannerGlow: 20,
    bannerRadius: 14,
    titleSize: 50,
    titleFamily: "Saira Condensed",
    titleCase: true,
    titleShadow: false,
    numberStyle: "rounded",
    bulletGradient: false,
    bulletEffect: "shadow",
    bulletEffectIntensity: 35,
    markerShape: "circle",
    markerTreatment: "filled",
    rowStyle: "card",
    rowGap: 1,
    frameStyle: "solid",
    frameWidth: 10,
    frameRadius: 10,
    frameShadow: false,
    badgeFamily: "Saira Condensed",
    chip: true,
    chipRadius: 8,
    questionFamily: "Anek Bangla",
    optionFamily: "Anek Bangla",
  },
  gilt: {
    bannerShape: "glow",
    bannerGradient: true,
    bannerGlow: 70,
    bannerRadius: 18,
    titleSize: 56,
    titleFamily: "Amiri",
    titleWeight: 700,
    titleGradient: true,
    titleGlow: 30,
    numberStyle: "arch",
    bulletGradient: true,
    bulletBorder: true,
    bulletEffect: "glow",
    markerShape: "hexagon",
    markerTreatment: "filled",
    rowStyle: "panel",
    frameStyle: "baroque",
    frameWidth: 28,
    frameRadius: 12,
    badgeFamily: "Cinzel",
    chip: true,
    chipBorder: true,
    questionFamily: "Noto Serif Bengali",
  },
  notebook: {
    bannerShape: "underline",
    bannerGradient: false,
    bannerGlow: 0,
    titleSize: 50,
    titleFamily: "Kalam",
    titleShadow: false,
    titleGlow: 0,
    numberStyle: "washi",
    bulletGradient: false,
    bulletEffect: "sticker",
    bulletEffectIntensity: 40,
    markerShape: "roundedSquare",
    markerTreatment: "soft",
    markerBg: true,
    markerBgShape: "rounded",
    markerBgOpacity: 30,
    rowStyle: "underline",
    frameStyle: "paper",
    frameWidth: 16,
    frameRadius: 6,
    frameShadow: false,
    badgeFamily: "Kalam",
    badgeCase: false,
    questionFamily: "Baloo Da 2",
    optionFamily: "Hind Siliguri",
  },
  mono: {
    bannerShape: "none",
    bannerGradient: false,
    bannerGlow: 0,
    titleSize: 50,
    titleFamily: "Archivo Black",
    titleCase: true,
    titleSpacing: 0.2,
    titleShadow: false,
    titleGlow: 0,
    numberStyle: "dot",
    bulletGradient: false,
    bulletEffect: undefined,
    bulletSize: 34,
    markerShape: "dot",
    markerTreatment: "outlined",
    markerFill: "none",
    markerRing: "ink",
    rowStyle: "minimal",
    rowGap: 1.5,
    frameStyle: "thin",
    frameWidth: 6,
    frameRadius: 2,
    frameShadow: false,
    badgeFamily: "Inter",
    chip: false,
    questionFamily: "Noto Sans Bengali",
    optionFamily: "Noto Sans Bengali",
    questionWeight: 500,
  },
  cyber: {
    bannerShape: "rect",
    bannerGradient: true,
    bannerAngle: 90,
    bannerGlow: 70,
    bannerRadius: 2,
    titleSize: 52,
    titleFamily: "Orbitron",
    titleCase: true,
    titleSpacing: 2,
    titleGlow: 45,
    numberStyle: "hexagon",
    bulletGradient: true,
    bulletBorder: true,
    bulletBorderWeight: 2,
    bulletEffect: "neon",
    markerShape: "hexagon",
    markerTreatment: "glow",
    markerFill: "soft",
    markerRing: "accent",
    markerBg: true,
    markerBgShape: "hexagon",
    markerBgOpacity: 22,
    rowStyle: "glass",
    frameStyle: "carbon",
    frameWidth: 16,
    frameRadius: 4,
    badgeFamily: "Orbitron",
    chip: true,
    chipRadius: 2,
  },
  pastel: {
    bannerShape: "pill",
    bannerGradient: true,
    bannerGlow: 20,
    titleSize: 52,
    titleFamily: "Baloo Da 2",
    titleWeight: 700,
    titleShadow: false,
    numberStyle: "cloud",
    bulletGradient: true,
    bulletEffect: "pop",
    bulletEffectIntensity: 35,
    markerShape: "heart",
    markerTreatment: "soft",
    markerBg: true,
    markerBgShape: "soft",
    markerBgOpacity: 30,
    rowStyle: "pill",
    rowGap: 1.5,
    frameStyle: "rainbow",
    frameWidth: 18,
    frameRadius: 24,
    badgeFamily: "Fredoka",
    chip: true,
    chipRadius: 999,
    questionFamily: "Baloo Da 2",
    optionFamily: "Baloo Da 2",
  },
  forest: {
    bannerShape: "rounded",
    bannerGradient: true,
    bannerGlow: 35,
    bannerRadius: 12,
    titleSize: 52,
    titleFamily: "Bree Serif",
    titleWeight: 400,
    numberStyle: "leaf",
    bulletGradient: true,
    bulletEffect: "lift",
    markerShape: "leaf",
    markerTreatment: "filled",
    rowStyle: "leftBar",
    frameStyle: "emerald",
    frameWidth: 20,
    frameRadius: 12,
    badgeFamily: "Bree Serif",
    badgeCase: false,
    chip: true,
    chipRadius: 10,
    questionFamily: "Anek Bangla",
  },
  retro: {
    bannerShape: "ribbon",
    bannerGradient: false,
    bannerGlow: 0,
    bannerRadius: 6,
    titleSize: 54,
    titleFamily: "Alfa Slab One",
    titleCase: true,
    titleShadow: true,
    numberStyle: "stamp",
    bulletGradient: false,
    bulletEffect: "longShadow",
    bulletEffectIntensity: 40,
    markerShape: "tag",
    markerTreatment: "filled",
    rowStyle: "striped",
    frameStyle: "vintage",
    frameWidth: 22,
    frameRadius: 8,
    badgeFamily: "Bebas Neue",
    chip: true,
    chipRadius: 4,
    questionFamily: "Tiro Bangla",
    optionFamily: "Hind Siliguri",
  },
};

const kitOf = (family: DesignFamilyId, over: Partial<Kit> = {}): Kit => ({
  ...BASE_KIT,
  ...FAMILY_KIT[family],
  ...over,
});

/* ================================================================== builder */

const BG_BY_ID = new Map<string, BgDesignPreset>(BG_PRESETS.map((p) => [p.id, p]));

/** drop the keys a JSON round-trip would drop anyway, so fingerprints match */
const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const lin = (angle: number, from: string, to: string): Gradient => ({
  enabled: true,
  type: "linear",
  angle,
  stops: [
    { color: from, at: 0 },
    { color: to, at: 100 },
  ],
  cx: 50,
  cy: 50,
});

const noGradient = (): Gradient => ({ ...cloneBanner().gradient, enabled: false });

/** resolve one of the marker's tri-state colour channels */
function channel(mode: MarkerChannel, p: Palette): string {
  switch (mode) {
    case "none":
      return "transparent";
    case "soft":
      return shade(p.ac, -0.55);
    case "ink":
      return p.o;
    case "board":
      return p.bd;
    default:
      return p.ac;
  }
}

/* ------------------------------------------------------------- readability */

function luminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return 0.5;
  const chan = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG contrast ratio of two colours (1 = identical, 21 = black on white) */
export function contrastOf(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** the least a text ink must reach against the surface it is painted on */
const MIN_INK_CONTRAST = 2.2;

/**
 * An ink that would disappear on its surface is replaced by one that reads.
 * Designs are authored as palettes; this is the guard that keeps a pale badge
 * off a pale plate (or white stems off a white sheet) from ever shipping.
 */
const inkOn = (ink: string, surface: string): string =>
  contrastOf(ink, surface) >= MIN_INK_CONTRAST ? ink : readableOn(surface);

/**
 * The whole look as one deck patch: every field the thirteen design aspects
 * read, always written, so applying a design never leaves a stale channel
 * behind (and so the gallery can recognise the design in use).
 */
function themeOf(p: Palette, k: Kit): Partial<ThemeSettings> {
  const bg = p.bg ? BG_BY_ID.get(p.bg) : undefined;
  const frameColor = p.fr ?? p.ac;
  const markerFill = channel(k.markerFill, p);
  const markerRing = channel(k.markerRing, p);

  /* every ink is checked against the surface it is really painted on: the
     board shows its gradient (not the base colour) and a filled title plate
     shows its own first stop, so the guard reads what the slide will read. */
  const boardSurface = bg?.gradient.enabled && bg.gradient.stops[0]?.color ? bg.gradient.stops[0].color : p.bd;
  const plateSurface =
    k.bannerShape === "none" || k.bannerShape === "underline"
      ? boardSurface
      : k.bannerGradient
        ? shade(p.bn, 0.22)
        : p.bn;
  const chipOn = k.chip && !!p.chip;
  const chipColor = p.chip ?? p.ac;

  const titleInk = inkOn(p.ti, plateSurface);
  const brandInk = inkOn(p.br, boardSurface);
  const brandInk2 = inkOn(p.br2 ?? p.br, boardSurface);
  const chipInk = inkOn(p.b3 ?? p.br, chipOn ? chipColor : boardSurface);
  const questionInk = inkOn(p.q, boardSurface);
  const optionInk = inkOn(p.o, boardSurface);
  const noteInk = inkOn(p.nt ?? p.o, boardSurface);
  const markerSurface = /^#[0-9a-f]{3,6}$/i.test(markerFill) ? markerFill : boardSurface;
  const markerInk = inkOn(k.markerInk ?? readableOn(p.ac), markerSurface);
  const bulletInk = inkOn(k.bulletInk, k.bulletGradient ? shade(p.ac, -0.1) : p.ac);

  /* 12 · board background ------------------------------------------------ */
  const background: BackgroundSettings = {
    ...cloneFrameBackground(),
    gradient: bg ? { ...bg.gradient, stops: bg.gradient.stops.map((s) => ({ ...s })) } : noGradient(),
    design: bg?.design ?? "",
    designW: 100,
    designH: 100,
    designOpacity: p.bgInk ?? 1,
    overlay: { enabled: false, color: "#000000", opacity: 0.35 },
    vignette: p.vg ?? 0,
  };

  /* 5 · title background ------------------------------------------------- */
  const banner: BannerSettings = {
    ...cloneBanner(),
    shape: k.bannerShape,
    color: p.bn,
    gradient: k.bannerGradient ? lin(k.bannerAngle, shade(p.bn, 0.22), p.bn2 ?? shade(p.bn, -0.4)) : noGradient(),
    opacity: 1,
    glow: k.bannerGlow,
    halo: k.bannerHalo,
    padX: 6,
    padY: k.bannerPadY,
    radius: k.bannerRadius,
    border: {
      enabled: k.bannerBorder,
      color: k.bannerBorderInk ?? titleInk,
      width: k.bannerBorderWidth,
    },
    textGradient: k.titleGradient ? lin(180, shade(titleInk, 0.35), titleInk) : noGradient(),
    textGlow: k.titleGlow,
    textShadow: k.titleShadow,
    shimmer: false,
  };

  /* 13 · frame ----------------------------------------------------------- */
  const frame: FrameSettings = {
    ...cloneFrame(),
    style: k.frameStyle,
    color: frameColor,
    gradient: {
      enabled: k.frameGradient,
      angle: 145,
      from: shade(frameColor, 0.3),
      to: shade(frameColor, -0.35),
    },
    width: k.frameWidth,
    radius: k.frameRadius,
    shadow: k.frameShadow,
  };

  /* 3 · badge 3 plate ---------------------------------------------------- */
  const badgePlate = {
    ...cloneBadgePlate(),
    enabled: chipOn,
    color: chipColor,
    opacity: 1,
    radius: k.chipRadius,
    padX: k.chipPadX,
    padY: 6,
    border: {
      enabled: k.chipBorder,
      color: titleInk,
      width: 2,
    },
  };

  /* 1 · 2 · 4 · 6 · 7 · 8 · 9 — the typefaces ---------------------------- */
  const boxFonts: BoxFonts = {
    brandTop: clean<BoxTypeface>({
      family: k.badgeFamily,
      weight: k.badgeWeight,
      letterSpacing: k.badgeSpacing,
      textTransform: k.badgeCase ? "uppercase" : "none",
      color: brandInk,
    }),
    brandBottom: clean<BoxTypeface>({
      family: k.badgeFamily,
      weight: k.badgeWeight,
      letterSpacing: k.badgeSpacing,
      textTransform: k.badgeCase ? "uppercase" : "none",
      color: brandInk2,
    }),
    badge: clean<BoxTypeface>({
      family: k.badgeFamily,
      weight: k.badgeWeight,
      letterSpacing: k.badgeSpacing,
      color: chipInk,
    }),
    title: clean<BoxTypeface>({
      family: k.titleFamily,
      weight: k.titleWeight,
      letterSpacing: k.titleSpacing,
      textTransform: k.titleCase ? "uppercase" : "none",
      effect: k.titleEffect,
    }),
    bullet: clean<BoxTypeface>({
      family: k.bulletFamily ?? k.titleFamily,
      weight: k.bulletWeight,
      color: bulletInk,
      scale: k.bulletScale,
    }),
    question: clean<BoxTypeface>({
      family: k.questionFamily,
      weight: k.questionWeight,
    }),
    options: clean<BoxTypeface>({
      family: k.optionFamily,
      weight: k.optionWeight,
    }),
    optionBullet: clean<BoxTypeface>({
      family: k.markerFamily,
      weight: k.markerWeight,
    }),
    note: clean<BoxTypeface>({
      family: k.optionFamily,
      weight: 400,
    }),
  };

  return {
    /* 12 · board background */
    board: p.bd,
    background,
    /* 13 · frame */
    frame,
    frameOuter: shade(p.bd, -0.55),
    frameInner: frameColor,
    showFrame: k.showFrame,
    /* 4 · title text + 5 · title background */
    titleColor: titleInk,
    titleSize: k.titleSize,
    titleBanner: p.bn,
    banner,
    /* 1 · 2 · badges */
    brandColor: brandInk,
    brandTopColor: brandInk,
    brandBottomColor: brandInk2,
    brandTopSize: k.b1Size,
    brandBottomSize: k.b2Size,
    showBrandTop: true,
    showBrandBottom: true,
    /* 3 · badge 3 */
    badgeColor: chipInk,
    badgeSize: k.b3Size,
    badgePlate,
    /* 6 · question bullet */
    showBullet: k.showBullet,
    numberStyle: k.numberStyle,
    bulletSize: k.bulletSize,
    bulletFill: k.bulletGradient ? "" : p.ac,
    bulletFillGradient: k.bulletGradient ? lin(150, shade(p.ac, 0.3), shade(p.ac, -0.45)) : undefined,
    bulletBorder: k.bulletBorder ? (k.bulletBorderInk ?? shade(p.ac, 0.55)) : "",
    bulletBorderGradient: undefined,
    bulletBorderStyle: k.bulletBorder ? "solid" : "auto",
    bulletBorderWeight: k.bulletBorder ? k.bulletBorderWeight : undefined,
    bulletRadius: k.bulletRadius,
    bulletOpacity: 100,
    bulletEffect: k.bulletEffect,
    bulletEffectIntensity: k.bulletEffect ? k.bulletEffectIntensity : undefined,
    bulletEffectColor: undefined,
    bulletStylePreset: "",
    /* 7 · question text */
    questionColor: questionInk,
    questionSize: k.questionSize,
    /* 8 · option text + 11 · option row */
    optionTextColor: optionInk,
    optionSize: k.optionSize,
    optionStyle: k.rowStyle,
    optionAccent: p.ac,
    optionGap: k.rowGap,
    optionLineHeight: k.rowLine,
    /* 9 · option marker */
    optionBulletShape: k.markerShape,
    optionBulletTreatment: k.markerTreatment,
    optionBulletInk: markerInk,
    optionBulletFill: markerFill,
    optionBulletBorder: markerRing,
    optionBulletCustomOnAnswer: false,
    optionBulletFontFamily: k.markerFamily ?? "",
    optionBulletTextSize: k.markerTextSize,
    optionBulletTextWeight: k.markerWeight,
    optionBulletUppercase: false,
    /* 10 · marker background */
    optionBulletBgColor: k.markerBg ? (k.markerBgInk ? channel(k.markerBgInk, p) : p.ac) : "",
    optionBulletBgScope: k.markerBgScope,
    optionBulletBgShape: k.markerBgShape,
    optionBulletBgSize: k.markerBgSize,
    optionBulletBgOpacity: k.markerBgOpacity,
    /* footnote */
    noteColor: noteInk,
    noteOpacity: k.noteOpacity,
    noteSize: k.noteSize,
    showNote: true,
    /* deck-wide */
    accent: p.ac,
    answerStyle: k.answerStyle,
    boxFonts,
  };
}

/** the background fields a design never touches (a user's own photo stays) */
function cloneFrameBackground(): BackgroundSettings {
  return {
    src: "",
    fit: "cover",
    posX: 50,
    posY: 50,
    opacity: 1,
    blur: 0,
    zoom: 0,
    flipH: false,
    overlay: { enabled: false, color: "#000000", opacity: 0.35 },
    gradient: noGradient(),
    vignette: 0,
    design: "",
    designW: 100,
    designH: 100,
    designOpacity: 1,
  };
}

/* ==================================================================== recipes */

/** one design = a palette + (optionally) the shapes that differ from its family */
function D(
  family: DesignFamilyId,
  id: string,
  name: string,
  hint: string,
  p: Palette,
  over: Partial<Kit> = {},
): SlideDesignPreset {
  const k = kitOf(family, over);
  const theme = themeOf(p, k);
  return {
    id,
    name,
    family,
    hint,
    swatch: [p.bd, p.bn, p.ac, p.ti],
    theme,
  };
}

export const SLIDE_DESIGNS: SlideDesignPreset[] = [
  /* ============================================================ 1 · classic
     The board every coaching class grew up on: a dark field, a glowing title
     plate, a bright corner tag and round markers in the accent.               */
  D("classic", "midnight-gold-pill", "Midnight Gold Pill",
    "Navy board, gold title riding a glowing blue pill, a red corner tag",
    { bd: "#0b1226", bg: "clean-slate", fr: "#d9b45b", ti: "#ffd633", bn: "#1f5fd0", bn2: "#0a2f7d",
      q: "#ffe9a8", o: "#ffffff", ac: "#2f6bff", br: "#ffffff", b3: "#ffffff", chip: "#e30613" }),
  D("classic", "ink-navy-shield", "Ink Navy Shield",
    "Deep ink navy, crimson shield markers on soft cards, a double rule frame",
    { bd: "#0a1230", bg: "stripe-accent", fr: "#9fb4e8", ti: "#ffffff", bn: "#132a63", bn2: "#071436",
      q: "#eaf0ff", o: "#f4f7ff", ac: "#e30613", br: "#ffd166", chip: "#1b3a8f" },
    { numberStyle: "shield", markerShape: "shield", rowStyle: "card", frameStyle: "double", frameWidth: 18 }),
  D("classic", "royal-blue-hex", "Royal Blue Hex",
    "Indigo triangles behind a sapphire plate, honeycomb markers",
    { bd: "#0f172a", bg: "geo-tri-dark", fr: "#38bdf8", ti: "#7dd3fc", bn: "#1d4ed8", bn2: "#0b2a7a",
      q: "#e0f2fe", o: "#f8fafc", ac: "#00b3ff", br: "#bae6fd", chip: "#f59e0b" },
    { numberStyle: "hexagon", markerShape: "hexagon", frameStyle: "sapphire", frameWidth: 18 }),
  D("classic", "slate-steel-chevron", "Slate Steel Chevron",
    "Executive slate, a sheened ribbon plate, chevrons down the option rows",
    { bd: "#111827", bg: "slate-executive", fr: "#cbd5e1", ti: "#f8fafc", bn: "#334155", bn2: "#0f172a",
      q: "#e2e8f0", o: "#f1f5f9", ac: "#f59e0b", br: "#94a3b8", chip: "#0ea5e9" },
    { bannerShape: "ribbon", numberStyle: "chevron", markerShape: "pill", rowStyle: "chevron", frameStyle: "solid", frameWidth: 10 }),
  D("classic", "indigo-glass-squircle", "Indigo Glass Squircle",
    "Burst indigo, frosted rows, soft squircle markers with a halo",
    { bd: "#1e1b4b", bg: "indigo-burst", fr: "#a5b4fc", ti: "#ffffff", bn: "#4338ca", bn2: "#241d78",
      q: "#e0e7ff", o: "#eef2ff", ac: "#8b5cf6", br: "#c7d2fe", chip: "#22d3ee" },
    { bannerShape: "rounded", bannerRadius: 22, numberStyle: "squircle", markerShape: "roundedSquare",
      markerTreatment: "soft", markerBg: true, markerBgShape: "soft", markerBgOpacity: 28,
      rowStyle: "glass", frameStyle: "glass", frameWidth: 14 }),
  D("classic", "deep-ocean-coin", "Deep Ocean Coin",
    "Diamond lattice over teal navy, coin markers, panel rows",
    { bd: "#082f49", bg: "diamond-lattice", fr: "#67e8f9", ti: "#a5f3fc", bn: "#0e7490", bn2: "#083344",
      q: "#cffafe", o: "#ecfeff", ac: "#00d3a7", br: "#7dd3fc", chip: "#f472b6" },
    { numberStyle: "coin", rowStyle: "panel", frameStyle: "thin", frameWidth: 10 }),
  D("classic", "noir-amber-rule", "Noir Amber Rule",
    "Pure noir with the title underlined in amber, ringed markers",
    { bd: "#0a0a0c", bg: "charcoal-luxe", fr: "#f59e0b", ti: "#fbbf24", bn: "#1c1917", bn2: "#0c0a09",
      q: "#fef3c7", o: "#fafaf9", ac: "#ffb020", br: "#a8a29e", chip: "#292524" },
    { bannerShape: "underline", bannerGlow: 40, numberStyle: "ring", markerShape: "ring",
      markerTreatment: "outlined", markerFill: "none", markerRing: "accent", rowStyle: "underline",
      frameStyle: "obsidian", frameWidth: 16 }),
  D("classic", "crimson-ticket-board", "Crimson Ticket Board",
    "Charcoal luxe with crimson ticket markers and a ruby frame",
    { bd: "#1a1c22", bg: "charcoal-luxe", fr: "#f43f5e", ti: "#ffe4e6", bn: "#7a0f22", bn2: "#3f0713",
      q: "#fecdd3", o: "#fff1f2", ac: "#ff3b5c", br: "#fda4af", chip: "#0f172a" },
    { numberStyle: "ticket", markerShape: "tag", rowStyle: "ticket", frameStyle: "ruby", frameWidth: 18 }),

  /* =============================================================== 2 · chalk
     Chalkboard: a dusty dark green or slate field, chalk-white type, a wooden
     frame and markers drawn as outlines rather than fills.                    */
  D("chalk", "green-chalkboard", "Green Chalkboard",
    "Classroom green with chalk dust, teak frame, chalk-white underlined title",
    { bd: "#0d2a1d", bg: "chalkboard", fr: "#c69558", ti: "#fff6d8", bn: "#1d3b2f", q: "#eafff2",
      o: "#f4fff8", ac: "#ffe27a", br: "#d9f2e3", chip: "#8a5a2b" },
    { chip: false }),
  D("chalk", "charcoal-slate-chalk", "Charcoal Slate Chalk",
    "Grey slate board, cyan chalk accents, chalk frame",
    { bd: "#1f2937", bg: "dots-dark", fr: "#e5e7eb", ti: "#f9fafb", bn: "#374151", q: "#e5e7eb",
      o: "#f3f4f6", ac: "#5eead4", br: "#cbd5e1" },
    { frameStyle: "chalk", frameWidth: 20, markerRing: "accent" }),
  D("chalk", "blackboard-amber", "Blackboard Amber",
    "Near-black board, amber chalk title, wooden frame, dotted rings",
    { bd: "#14100c", bg: "linen-night", fr: "#a86a24", ti: "#ffcf6b", bn: "#2a1f14", q: "#ffe9bf",
      o: "#fdf6e7", ac: "#f0a92e", br: "#e7d7b6" },
    { frameStyle: "walnut", frameWidth: 26, numberStyle: "dottedRing" }),
  D("chalk", "forest-chalk-lime", "Forest Chalk Lime",
    "Deep forest board with lime chalk marks and a bamboo frame",
    { bd: "#052e16", bg: "doodle-checks-dark", fr: "#a3e635", ti: "#ecfccb", bn: "#14532d", q: "#d9f99d",
      o: "#f7fee7", ac: "#84cc16", br: "#bef264" },
    { frameStyle: "bamboo", frameWidth: 22, numberStyle: "brushDot", markerShape: "leaf" }),
  D("chalk", "teal-chalk-dust", "Teal Chalk Dust",
    "Midnight teal board, mint chalk, ridge frame",
    { bd: "#04211f", bg: "midnight-emerald", fr: "#5eead4", ti: "#ccfbf1", bn: "#0f3d3a", q: "#a7f3d0",
      o: "#ecfdf5", ac: "#2dd4bf", br: "#99f6e4" },
    { frameStyle: "ridge", frameWidth: 20 }),
  D("chalk", "grey-slate-classroom", "Grey Slate Classroom",
    "Cool grey slate, white chalk, gold underline title, groove frame",
    { bd: "#334155", bg: "slate-executive", fr: "#f8fafc", ti: "#ffffff", bn: "#475569", q: "#f1f5f9",
      o: "#ffffff", ac: "#fbbf24", br: "#e2e8f0" },
    { frameStyle: "groove", frameWidth: 22, numberStyle: "hollowDot", markerShape: "ring" }),
  D("chalk", "chalk-crimson-notes", "Chalk Crimson Notes",
    "Green board with crimson chalk marks for the wrong-and-right pass",
    { bd: "#122b21", bg: "chalkboard", fr: "#b45309", ti: "#fff1f2", bn: "#3f1d24", q: "#ffe4e6",
      o: "#fff7f7", ac: "#fb7185", br: "#fecdd3" },
    { frameStyle: "mahogany", frameWidth: 24, numberStyle: "scribbleDot", markerShape: "dot" }),
  D("chalk", "vintage-green-wood", "Vintage Green Wood",
    "Aged green board in an oak frame, cream chalk type",
    { bd: "#1d3b2f", bg: "chalkboard", fr: "#e6a15c", ti: "#fdf6e3", bn: "#2f4f3f", q: "#f3ead3",
      o: "#fffdf5", ac: "#f2c98a", br: "#e8dcc0" },
    { frameStyle: "oak", frameWidth: 28, numberStyle: "dottedRing", markerShape: "paren",
      markerTreatment: "outlined", markerFill: "none", markerRing: "accent", rowStyle: "dashed" }),

  /* ================================================================= 3 · neon
     Neon night: near-black boards, tubes of colour, glass rows and rings.     */
  D("neon", "cyan-neon-night", "Cyan Neon Night",
    "Black glass with a cyan tube plate and glowing ring markers",
    { bd: "#05070f", bg: "neon-streaks", fr: "#22d3ee", ti: "#a5f3fc", bn: "#0e7490", bn2: "#083344",
      q: "#cffafe", o: "#ecfeff", ac: "#22d3ee", br: "#67e8f9", chip: "#0b1a24" }),
  D("neon", "magenta-synthwave", "Magenta Synthwave",
    "Synthwave magenta tubes over an indigo horizon",
    { bd: "#12041f", bg: "aurora-night", fr: "#f472b6", ti: "#fbcfe8", bn: "#a21caf", bn2: "#4a044e",
      q: "#f5d0fe", o: "#fdf4ff", ac: "#e879f9", br: "#f0abfc", chip: "#2a0a3d" },
    { frameStyle: "neonMagenta" }),
  D("neon", "matrix-lime", "Matrix Lime",
    "Terminal green glow on black, monospaced badge lines",
    { bd: "#030a05", bg: "dots-dark", fr: "#4ade80", ti: "#bbf7d0", bn: "#14532d", bn2: "#052e16",
      q: "#dcfce7", o: "#f0fdf4", ac: "#22c55e", br: "#86efac", chip: "#07130b" },
    { frameStyle: "neonGreen", badgeFamily: "Orbitron", numberStyle: "ring" }),
  D("neon", "violet-neon-halo", "Violet Neon Halo",
    "Violet halo plate, hexagon markers, aurora blobs behind",
    { bd: "#0b1026", bg: "aurora-night", fr: "#a78bfa", ti: "#ddd6fe", bn: "#6d28d9", bn2: "#2e1065",
      q: "#ede9fe", o: "#f5f3ff", ac: "#8b5cf6", br: "#c4b5fd", chip: "#1e1b4b" },
    { bannerHalo: 55, numberStyle: "hexagon", markerShape: "hexagon" }),
  D("neon", "amber-neon-tube", "Amber Neon Tube",
    "Warm amber tubes on carbon black, ticket rows",
    { bd: "#0c0a09", bg: "charcoal-luxe", fr: "#fbbf24", ti: "#fde68a", bn: "#b45309", bn2: "#451a03",
      q: "#fef3c7", o: "#fffbeb", ac: "#f59e0b", br: "#fcd34d", chip: "#1c1917" },
    { rowStyle: "ticket", numberStyle: "pill", markerShape: "pill" }),
  D("neon", "ice-blue-neon", "Ice Blue Neon",
    "Frozen cyan on midnight, glass cards, diamond markers",
    { bd: "#04121f", bg: "mesh-ocean-bg", fr: "#7dd3fc", ti: "#e0f2fe", bn: "#0369a1", bn2: "#082f49",
      q: "#bae6fd", o: "#f0f9ff", ac: "#38bdf8", br: "#93c5fd", chip: "#0c2436" },
    { frameStyle: "ice", markerShape: "diamond", numberStyle: "diamond", rowStyle: "glass" }),
  D("neon", "rose-neon-glass", "Rose Neon Glass",
    "Rose-pink neon over plum, frosted rows, soft plates behind markers",
    { bd: "#180414", bg: "ember-fluid", fr: "#fb7185", ti: "#ffe4e6", bn: "#9f1239", bn2: "#4c0519",
      q: "#fecdd3", o: "#fff1f2", ac: "#f43f5e", br: "#fda4af", chip: "#2b0710" },
    { markerBgShape: "soft", rowStyle: "glass", numberStyle: "doubleRing", markerShape: "doubleRing" }),
  D("neon", "aqua-grid-neon", "Aqua Grid Neon",
    "Blueprint aqua grid, cyber frame, hexagon glow markers",
    { bd: "#03131a", bg: "dots-dark", fr: "#2dd4bf", ti: "#99f6e4", bn: "#115e59", bn2: "#042f2e",
      q: "#ccfbf1", o: "#f0fdfa", ac: "#14b8a6", br: "#5eead4", chip: "#062028" },
    { frameStyle: "cyberpunk", numberStyle: "hexagon", markerShape: "hexagon", rowStyle: "neon" }),

  /* ================================================================= 4 · paper
     The question sheet: white or cream paper, a coloured head band, ink-black
     stems, square outline markers and a hairline frame.                       */
  D("paper", "board-question-paper", "Board Question Paper",
    "White sheet, red head band, black ink stems, corner ticks",
    { bd: "#ffffff", bg: "minimal-mist", fr: "#9ca3af", ti: "#ffffff", bn: "#dc2626",
      q: "#111827", o: "#1f2937", ac: "#dc2626", br: "#374151", b3: "#ffffff", chip: "#111827" },
    { numberStyle: "square", markerShape: "square" }),
  D("paper", "navy-header-sheet", "Navy Header Sheet",
    "Graph paper with a navy band, blue outline markers",
    { bd: "#f8fbff", bg: "graph-paper", fr: "#1e3a8a", ti: "#ffffff", bn: "#1e3a8a",
      q: "#0f172a", o: "#1e293b", ac: "#1d4ed8", br: "#1e3a8a", chip: "#dc2626", b3: "#ffffff" }),
  D("paper", "green-exam-sheet", "Green Exam Sheet",
    "Gridded sheet, green band, square markers, thin sage frame",
    { bd: "#f8fbff", bg: "exam-graph", fr: "#16a34a", ti: "#ffffff", bn: "#15803d",
      q: "#14532d", o: "#1f2937", ac: "#16a34a", br: "#166534", chip: "#b91c1c", b3: "#ffffff" },
    { markerShape: "outlineSquare", markerTreatment: "outlined", markerFill: "none" }),
  D("paper", "violet-practice-sheet", "Violet Practice Sheet",
    "Dot paper with a violet band and pill markers",
    { bd: "#ffffff", bg: "dots-light", fr: "#7c3aed", ti: "#ffffff", bn: "#6d28d9",
      q: "#2e1065", o: "#334155", ac: "#7c3aed", br: "#5b21b6", chip: "#f59e0b", b3: "#ffffff" },
    { numberStyle: "pill", markerShape: "pill", rowStyle: "pill" }),
  D("paper", "grey-practice-sheet", "Grey Practice Sheet",
    "Pinstripe paper, slate band, minimal rows",
    { bd: "#f8fafc", bg: "pinstripe", fr: "#64748b", ti: "#ffffff", bn: "#475569",
      q: "#0f172a", o: "#1e293b", ac: "#64748b", br: "#334155", chip: "#0f172a", b3: "#ffffff" },
    { rowStyle: "minimal", frameStyle: "thin", frameWidth: 6 }),
  D("paper", "cream-model-test", "Cream Model Test",
    "Cream scholar sheet, ochre band, kraft paper frame",
    { bd: "#fffaf0", bg: "scholar-cream", fr: "#b45309", ti: "#fffbeb", bn: "#b45309",
      q: "#3f2d1a", o: "#4b3a24", ac: "#d97706", br: "#7c5a2a", chip: "#7f1d1d", b3: "#fffbeb" },
    { frameStyle: "paper", frameWidth: 18, questionFamily: "Tiro Bangla" }),
  D("paper", "blue-grid-answer-sheet", "Blue Grid Answer Sheet",
    "Grid-and-dot answer sheet, sky band, bracketed markers",
    { bd: "#ffffff", bg: "exam-grid-dots", fr: "#0284c7", ti: "#ffffff", bn: "#0369a1",
      q: "#0c4a6e", o: "#1e293b", ac: "#0284c7", br: "#075985", chip: "#dc2626", b3: "#ffffff" },
    { numberStyle: "brackets", markerShape: "bracket", markerTreatment: "outlined",
      markerFill: "none", rowStyle: "dashed" }),
  D("paper", "formula-margin-sheet", "Formula Margin Sheet",
    "Faint formula paper, teal band, taped corners",
    { bd: "#f8fafc", bg: "marks-formula", fr: "#0d9488", ti: "#ffffff", bn: "#0f766e",
      q: "#134e4a", o: "#1f2937", ac: "#0d9488", br: "#115e59", chip: "#b45309", b3: "#ffffff" },
    { numberStyle: "numParen", markerShape: "paren", markerTreatment: "outlined", markerFill: "none" }),

  /* ================================================================ 5 · royal
     Royal luxe: maroon, emerald and sapphire fields, gilt frames, serif caps
     and a gold corner plate.                                                  */
  D("royal", "maroon-gold-baroque", "Maroon Gold Baroque",
    "Deep maroon with a baroque gilt frame and ribbon plate",
    { bd: "#26060c", bg: "exam-red-slate", fr: "#d4af37", ti: "#ffd98a", bn: "#7a0f22", bn2: "#3d0710",
      q: "#ffe9b8", o: "#fff6e0", ac: "#d4af37", br: "#f2c98a", chip: "#4a0d16", b3: "#ffe082" }),
  D("royal", "emerald-gold-palace", "Emerald Gold Palace",
    "Midnight emerald with spotlight glow and gold shield markers",
    { bd: "#052e2b", bg: "midnight-emerald", fr: "#f5c542", ti: "#ffe9a8", bn: "#065f46", bn2: "#022c22",
      q: "#d1fae5", o: "#ecfdf5", ac: "#f5c542", br: "#a7f3d0", chip: "#064e3b", b3: "#ffe082" }),
  D("royal", "sapphire-gilt-ribbon", "Sapphire Gilt Ribbon",
    "Navy with elegant gold art, a sapphire ribbon plate",
    { bd: "#101c3f", bg: "navy-gold", fr: "#e6b800", ti: "#ffe082", bn: "#1e3a8a", bn2: "#0b1a45",
      q: "#dbeafe", o: "#eff6ff", ac: "#3b82f6", br: "#fcd34d", chip: "#172554", b3: "#ffe082" }),
  D("royal", "obsidian-art-deco", "Obsidian Art Deco",
    "Charcoal luxe with a deco gold frame and bevelled markers",
    { bd: "#0b0c0f", bg: "charcoal-luxe", fr: "#e6b800", ti: "#f7e7a9", bn: "#1c1917", bn2: "#0a0a0a",
      q: "#f5f5f4", o: "#fafaf9", ac: "#d4af37", br: "#d6d3d1", chip: "#292524", b3: "#ffe082" },
    { frameStyle: "artDeco", frameWidth: 24, numberStyle: "cutCorner", markerShape: "diamond" }),
  D("royal", "burgundy-velvet", "Burgundy Velvet",
    "Ember-plum velvet field, rose gilt, ticket rows",
    { bd: "#2b1030", bg: "ember-fluid", fr: "#e0a3b8", ti: "#ffe4e6", bn: "#4c0519", bn2: "#2a0310",
      q: "#fecdd3", o: "#fff1f2", ac: "#e11d48", br: "#fda4af", chip: "#3f0713", b3: "#ffe4e6" },
    { frameStyle: "velvet", frameWidth: 26, rowStyle: "ticket", numberStyle: "rosette" }),
  D("royal", "royal-purple-gilt", "Royal Purple Gilt",
    "Indigo burst field, gold frame, starburst seal markers",
    { bd: "#1e1b4b", bg: "indigo-burst", fr: "#f0c14b", ti: "#f5d0fe", bn: "#6d28d9", bn2: "#3b0764",
      q: "#ede9fe", o: "#f5f3ff", ac: "#c084fc", br: "#ddd6fe", chip: "#4c1d95", b3: "#f5d0fe" },
    { numberStyle: "star8", markerShape: "burst", frameStyle: "gold", frameWidth: 22 }),
  D("royal", "bronze-antique-study", "Bronze Antique Study",
    "Warm dark study board, bronze frame, coin markers",
    { bd: "#241a12", fr: "#cd7f32", ti: "#f2c98a", bn: "#3b2a1a", bn2: "#1d1409",
      q: "#f6e6cd", o: "#fdf4e3", ac: "#cd7f32", br: "#e0c39a", chip: "#4a3520", b3: "#f2c98a" },
    { frameStyle: "bronze", frameWidth: 26, numberStyle: "coin", markerShape: "circle", rowStyle: "panel" }),
  D("royal", "ivory-gold-certificate", "Ivory Gold Certificate",
    "Pearl ivory sheet with gold star art and a certificate frame",
    { bd: "#faf7f0", bg: "islamic-pearl", fr: "#d4af37", ti: "#fffdf5", bn: "#b45309", bn2: "#7c2d12",
      q: "#3f2d1a", o: "#4b3a24", ac: "#a16207", br: "#7c5a2a", chip: "#7c2d12", b3: "#fffdf5" },
    { frameStyle: "gold", frameWidth: 22, numberStyle: "capSeal", markerShape: "badge",
      markerTreatment: "filled", rowStyle: "panel" }),

  /* ============================================================== 6 · medical
     Medical / admission-prep mint: clean light sheets, teal bands, rounded
     markers on cards, a red corner tag.                                       */
  D("medical", "clinic-white-teal", "Clinic White Teal",
    "White clinic sheet, teal band, rounded markers on cards",
    { bd: "#f8fafc", bg: "minimal-mist", fr: "#99f6e4", ti: "#ffffff", bn: "#0d9488", bn2: "#115e59",
      q: "#0f172a", o: "#1e293b", ac: "#14b8a6", br: "#0f766e", chip: "#ef4444", b3: "#ffffff" }),
  D("medical", "mint-green-cross", "Mint Green Cross",
    "Mint-to-sky sheet with a green band and a red tag",
    { bd: "#ecfdf5", bg: "mint-sky", fr: "#86efac", ti: "#ffffff", bn: "#16a34a", bn2: "#14532d",
      q: "#14532d", o: "#1f2937", ac: "#22c55e", br: "#166534", chip: "#dc2626", b3: "#ffffff" }),
  D("medical", "aqua-care-sheet", "Aqua Care Sheet",
    "Soft aqua curve sheet, cyan band, glass rows",
    { bd: "#ffffff", bg: "mist-curve", fr: "#67e8f9", ti: "#ffffff", bn: "#0891b2", bn2: "#155e75",
      q: "#0e7490", o: "#1e293b", ac: "#06b6d4", br: "#0e7490", chip: "#f43f5e", b3: "#ffffff" },
    { rowStyle: "glass", markerBg: true, markerBgShape: "soft", markerBgOpacity: 22 }),
  D("medical", "coral-clinic-card", "Coral Clinic Card",
    "Peach cream sheet with a coral band and shadowed cards",
    { bd: "#fff7ed", bg: "peach-cream", fr: "#fda4af", ti: "#ffffff", bn: "#f43f5e", bn2: "#9f1239",
      q: "#7f1d1d", o: "#3f2d2a", ac: "#fb7185", br: "#be123c", chip: "#0d9488", b3: "#ffffff" },
    { rowStyle: "shadowed" }),
  D("medical", "sky-hospital-blue", "Sky Hospital Blue",
    "Blue highlight sheet, sky band, soft square markers",
    { bd: "#f0f9ff", bg: "marks-blue", fr: "#7dd3fc", ti: "#ffffff", bn: "#0284c7", bn2: "#075985",
      q: "#0c4a6e", o: "#1e293b", ac: "#0ea5e9", br: "#0369a1", chip: "#dc2626", b3: "#ffffff" },
    { markerShape: "roundedSquare", markerTreatment: "soft" }),
  D("medical", "sage-medical-sheet", "Sage Medical Sheet",
    "Green highlight sheet, olive band, leaf markers",
    { bd: "#f0fdf4", bg: "marks-green", fr: "#bef264", ti: "#ffffff", bn: "#4d7c0f", bn2: "#365314",
      q: "#1a2e05", o: "#1f2937", ac: "#65a30d", br: "#3f6212", chip: "#b91c1c", b3: "#ffffff" },
    { numberStyle: "leaf", markerShape: "leaf" }),
  D("medical", "rose-dental-soft", "Rose Dental Soft",
    "Pink highlight sheet, rose band, duo-tone rows",
    { bd: "#fdf2f8", bg: "marks-pink", fr: "#f9a8d4", ti: "#ffffff", bn: "#db2777", bn2: "#831843",
      q: "#500724", o: "#3f2d38", ac: "#ec4899", br: "#9d174d", chip: "#0f766e", b3: "#ffffff" },
    { rowStyle: "duo" }),
  D("medical", "deep-teal-ward", "Deep Teal Ward",
    "Midnight emerald ward board with mint type and coral tag",
    { bd: "#021a19", bg: "midnight-emerald", fr: "#14b8a6", ti: "#ccfbf1", bn: "#0f766e", bn2: "#042f2e",
      q: "#d1fae5", o: "#ecfdf5", ac: "#2dd4bf", br: "#99f6e4", chip: "#f43f5e", b3: "#042f2e" },
    { bannerGlow: 45, markerTreatment: "filled", rowStyle: "card" }),

  /* ================================================================== 7 · mesh
     Mesh gradients: soft colour clouds under frosted cards and squircle
     markers — the modern app-deck look.                                       */
  D("mesh", "aurora-mesh-glass", "Aurora Mesh Glass",
    "Indigo mesh aurora, frosted glass rows, soft halo markers",
    { bd: "#1e1b4b", bg: "mesh-aurora-bg", fr: "#a5b4fc", ti: "#e0e7ff", bn: "#4338ca", bn2: "#1e1b4b",
      q: "#c7d2fe", o: "#eef2ff", ac: "#818cf8", br: "#a5b4fc", chip: "#22d3ee", b3: "#0b1026" }),
  D("mesh", "grape-mesh-squircle", "Grape Mesh Squircle",
    "Plum blob field, grape plate, squircle markers on glass",
    { bd: "#2e1065", bg: "blobs-midnight", fr: "#c4b5fd", ti: "#f5f3ff", bn: "#7c3aed", bn2: "#3b0764",
      q: "#ddd6fe", o: "#ede9fe", ac: "#a78bfa", br: "#c4b5fd", chip: "#f472b6", b3: "#2e1065" },
    { numberStyle: "squircle", markerShape: "roundedSquare" }),
  D("mesh", "orchid-mesh-soft", "Orchid Mesh Soft",
    "Lavender haze sheet, orchid plate, pink corner tag",
    { bd: "#f5f3ff", bg: "lavender-haze", fr: "#c4b5fd", ti: "#ffffff", bn: "#a855f7", bn2: "#7e22ce",
      q: "#3b0764", o: "#4c1d95", ac: "#8b5cf6", br: "#6d28d9", chip: "#db2777", b3: "#ffffff" }),
  D("mesh", "indigo-cloud-card", "Indigo Cloud Card",
    "Light ribbon field, indigo plate, cards with a soft plate behind markers",
    { bd: "#f8fafc", bg: "ribbon-flow", fr: "#a5b4fc", ti: "#ffffff", bn: "#4f46e5", bn2: "#3730a3",
      q: "#1e1b4b", o: "#312e81", ac: "#6366f1", br: "#4338ca", chip: "#0ea5e9", b3: "#ffffff" },
    { markerBg: true, markerBgShape: "soft", markerBgOpacity: 20 }),
  D("mesh", "fuchsia-haze-pop", "Fuchsia Haze Pop",
    "Pastel dream field, fuchsia plate, pop-shadow markers",
    { bd: "#fce7f3", bg: "pastel-dream", fr: "#f0abfc", ti: "#ffffff", bn: "#d946ef", bn2: "#a21caf",
      q: "#701a75", o: "#86198f", ac: "#e879f9", br: "#a21caf", chip: "#22d3ee", b3: "#ffffff" },
    { bulletEffect: "pop", bulletEffectIntensity: 40, numberStyle: "blob", markerShape: "drop" }),
  D("mesh", "periwinkle-mesh-ring", "Periwinkle Mesh Ring",
    "Diagonal band field, periwinkle plate, double-ring markers",
    { bd: "#111827", bg: "stripe-accent", fr: "#c7d2fe", ti: "#e0e7ff", bn: "#4338ca", bn2: "#1e1b4b",
      q: "#c7d2fe", o: "#e0e7ff", ac: "#a5b4fc", br: "#c7d2fe", chip: "#f472b6", b3: "#111827" },
    { numberStyle: "doubleRing", markerShape: "doubleRing", markerTreatment: "outlined",
      markerFill: "none", markerRing: "accent" }),
  D("mesh", "plum-velvet-mesh", "Plum Velvet Mesh",
    "Ember-plum clouds, plum plate, glass rows and a violet glow",
    { bd: "#1c0a12", bg: "ember-fluid", fr: "#e879f9", ti: "#fae8ff", bn: "#86198f", bn2: "#4a044e",
      q: "#f5d0fe", o: "#fdf4ff", ac: "#d946ef", br: "#e9a8f5", chip: "#fbbf24", b3: "#4a044e" },
    { bannerHalo: 35, rowStyle: "glass" }),
  D("mesh", "lavender-glass-light", "Lavender Glass Light",
    "Pale blob-duo sheet, lavender plate, pastel pill rows",
    { bd: "#f8fafc", bg: "blob-duo", fr: "#ddd6fe", ti: "#ffffff", bn: "#8b5cf6", bn2: "#6d28d9",
      q: "#312e81", o: "#3730a3", ac: "#7c3aed", br: "#6d28d9", chip: "#f472b6", b3: "#ffffff" },
    { rowStyle: "pill", markerShape: "pill", numberStyle: "pill" }),

  /* ============================================================== 8 · sunset
     Sunset energy: embers, ambers and crimsons over warm slate — the loud,
     high-contrast board of a fast revision class.                             */
  D("sunset", "ember-orange-blast", "Ember Orange Blast",
    "Sunset mesh field, ember plate, flame markers in a lava frame",
    { bd: "#431407", bg: "mesh-sunset-bg", fr: "#fb923c", ti: "#fff7ed", bn: "#ea580c", bn2: "#7c2d12",
      q: "#ffedd5", o: "#fff7ed", ac: "#fb923c", br: "#fdba74", chip: "#7c2d12", b3: "#ffedd5" }),
  D("sunset", "crimson-sunset-wave", "Crimson Sunset Wave",
    "Sunset tide waves, crimson plate, drop markers",
    { bd: "#1e1b4b", bg: "sunset-wave", fr: "#fca5a5", ti: "#fef2f2", bn: "#b91c1c", bn2: "#450a0a",
      q: "#fee2e2", o: "#fff1f2", ac: "#f87171", br: "#fecaca", chip: "#f59e0b", b3: "#450a0a" },
    { markerShape: "drop", numberStyle: "drop" }),
  D("sunset", "amber-brush-focus", "Amber Brush Focus",
    "Amber brush sweep on dark umber, gold title, coin markers",
    { bd: "#422006", bg: "exam-highlight-yellow", fr: "#fbbf24", ti: "#fef3c7", bn: "#b45309", bn2: "#78350f",
      q: "#fde68a", o: "#fffbeb", ac: "#fbbf24", br: "#fcd34d", chip: "#7c2d12", b3: "#fef3c7" },
    { numberStyle: "coin", markerShape: "circle", rowStyle: "gradient" }),
  D("sunset", "tangerine-pop-flat", "Tangerine Pop Flat",
    "Vibrant pop bands, tangerine plate, stepped rows",
    { bd: "#7c2d12", bg: "vibrant-pop", fr: "#fed7aa", ti: "#fff7ed", bn: "#f97316", bn2: "#c2410c",
      q: "#ffedd5", o: "#fff7ed", ac: "#fb923c", br: "#fed7aa", chip: "#4c1d95", b3: "#fff7ed" },
    { rowStyle: "stepped", numberStyle: "step", markerShape: "tag" }),
  D("sunset", "lava-red-plate", "Lava Red Plate",
    "Exam-red field with corner ticks, lava frame, burst markers",
    { bd: "#1c0a0a", bg: "exam-red-slate", fr: "#f87171", ti: "#fee2e2", bn: "#dc2626", bn2: "#7f1d1d",
      q: "#fecaca", o: "#fff1f2", ac: "#f87171", br: "#fca5a5", chip: "#450a0a", b3: "#fee2e2" },
    { frameStyle: "lava", frameWidth: 20, numberStyle: "burst", markerShape: "burst" }),
  D("sunset", "peach-glow-dusk", "Peach Glow Dusk",
    "Peach cream sheet, tangerine plate, dusk peaks behind",
    { bd: "#fff7ed", bg: "peach-cream", fr: "#fdba74", ti: "#ffffff", bn: "#f97316", bn2: "#c2410c",
      q: "#7c2d12", o: "#431407", ac: "#fb923c", br: "#c2410c", chip: "#0ea5e9", b3: "#ffffff" },
    { titleFamily: "Anton", rowStyle: "card" }),
  D("sunset", "mango-slate-brush", "Mango Slate Brush",
    "Yellow brush over graphite slate, mango plate, ticket rows",
    { bd: "#1c1917", bg: "hl-brush-yellow", fr: "#f59e0b", ti: "#fde68a", bn: "#d97706", bn2: "#92400e",
      q: "#fef3c7", o: "#fffbeb", ac: "#f59e0b", br: "#fcd34d", chip: "#292524", b3: "#fde68a" },
    { rowStyle: "ticket", numberStyle: "ticket", markerShape: "tag" }),
  D("sunset", "copper-dusk-ribbon", "Copper Dusk Ribbon",
    "Sunset mesh with a copper ribbon plate and rose-gold frame",
    { bd: "#2b1030", bg: "mesh-sunset-bg", fr: "#e8a87c", ti: "#ffe8d6", bn: "#9a3412", bn2: "#431407",
      q: "#fed7aa", o: "#fff7ed", ac: "#fb923c", br: "#fdba74", chip: "#4a044e", b3: "#ffe8d6" },
    { bannerShape: "ribbon", frameStyle: "copper", frameWidth: 20, numberStyle: "ribbon" }),

  /* =============================================================== 9 · campus
     Campus blue: the bright blue-and-white school look — a coloured band,
     white cards, and a red or green corner tag.                               */
  D("campus", "cornflower-campus", "Cornflower Campus",
    "Corner-stack sheet, cornflower band, white cards, red tag",
    { bd: "#f8fafc", bg: "corner-stack", fr: "#bfdbfe", ti: "#ffffff", bn: "#588eeb", bn2: "#3b6fd4",
      q: "#0f172a", o: "#1e293b", ac: "#2563eb", br: "#1d4ed8", chip: "#eb2026", b3: "#ffffff" }),
  D("campus", "dodger-blue-class", "Dodger Blue Class",
    "Blueprint grid sheet, dodger band, green tag",
    { bd: "#ffffff", bg: "geo-grid-light", fr: "#93c5fd", ti: "#ffffff", bn: "#39b0f9", bn2: "#1d8fd0",
      q: "#0f172a", o: "#1e293b", ac: "#0ea5e9", br: "#0369a1", chip: "#0b6b33", b3: "#ffffff" },
    { numberStyle: "rounded", markerShape: "roundedSquare" }),
  D("campus", "sky-blue-academy", "Sky Blue Academy",
    "Blue marker-tile sheet, sky band, amber tag",
    { bd: "#f0f9ff", bg: "marks-blue", fr: "#7dd3fc", ti: "#ffffff", bn: "#0284c7", bn2: "#075985",
      q: "#0c4a6e", o: "#1e293b", ac: "#38bdf8", br: "#0369a1", chip: "#f59e0b", b3: "#ffffff" },
    { rowStyle: "soft" }),
  D("campus", "navy-corporate-deck", "Navy Corporate Deck",
    "Clean slate board, navy band, white corner tag",
    { bd: "#0b1120", bg: "clean-slate", fr: "#60a5fa", ti: "#ffffff", bn: "#1e3a8a", bn2: "#0f2153",
      q: "#e2e8f0", o: "#f1f5f9", ac: "#3b82f6", br: "#93c5fd", chip: "#f8fafc", b3: "#1e3a8a" }),
  D("campus", "steel-campus-cards", "Steel Campus Cards",
    "Mist sheet, steel band, red tag, shadowed cards",
    { bd: "#f1f5f9", bg: "minimal-mist", fr: "#94a3b8", ti: "#ffffff", bn: "#475569", bn2: "#334155",
      q: "#0f172a", o: "#1e293b", ac: "#64748b", br: "#334155", chip: "#dc2626", b3: "#ffffff" },
    { rowStyle: "shadowed" }),
  D("campus", "bright-blue-school", "Bright Blue School",
    "Dot sheet, bright blue band, green tag, dotted numbering",
    { bd: "#ffffff", bg: "dots-light", fr: "#60a5fa", ti: "#ffffff", bn: "#1d4ed8", bn2: "#1e40af",
      q: "#111827", o: "#1f2937", ac: "#2563eb", br: "#1e40af", chip: "#16a34a", b3: "#ffffff" },
    { numberStyle: "numDot", markerShape: "dot", markerTreatment: "outlined", markerFill: "none" }),
  D("campus", "cobalt-modern-grid", "Cobalt Modern Grid",
    "Indigo grid sheet, cobalt band, red tag, squircle markers",
    { bd: "#eef2ff", bg: "geo-grid-light", fr: "#6366f1", ti: "#ffffff", bn: "#1e40af", bn2: "#172554",
      q: "#1e1b4b", o: "#312e81", ac: "#4f46e5", br: "#3730a3", chip: "#ef4444", b3: "#ffffff" },
    { numberStyle: "squircle", markerShape: "roundedSquare", markerTreatment: "soft" }),
  D("campus", "blue-white-lecture", "Blue White Lecture",
    "Notebook sheet, blue band, left-bar rows, red tag",
    { bd: "#ffffff", bg: "notebook", fr: "#93c5fd", ti: "#ffffff", bn: "#2563eb", bn2: "#1d4ed8",
      q: "#0f172a", o: "#1e293b", ac: "#3b82f6", br: "#1d4ed8", chip: "#dc2626", b3: "#ffffff" },
    { rowStyle: "leftBar", numberStyle: "bar", markerShape: "square" }),

  /* ================================================================ 10 · gilt
     Gilt arabesque: midnight and emerald fields under gold pattern art, serif
     caps and a gilded corner plate — the Dakhil / Quranic-class look.          */
  D("gilt", "midnight-star-gilt", "Midnight Star Gilt",
    "Midnight star pattern, gold glow plate, baroque gilt frame",
    { bd: "#0d1330", bg: "islamic-midnight", fr: "#d4af37", ti: "#ffe6a3", bn: "#16205a", bn2: "#0a0f2c",
      q: "#f3e9c9", o: "#fdf8e8", ac: "#d4af37", br: "#e7d8a8", chip: "#1b2a6b", b3: "#ffe6a3" },
    { frameStyle: "baroque", frameWidth: 28 }),
  D("gilt", "emerald-girih-gold", "Emerald Girih Gold",
    "Emerald girih tiles, mint-gold type, honeycomb markers",
    { bd: "#052e2b", bg: "girih-emerald", fr: "#fbbf24", ti: "#fde68a", bn: "#065f46", bn2: "#022c22",
      q: "#d1fae5", o: "#ecfdf5", ac: "#fbbf24", br: "#a7f3d0", chip: "#064e3b", b3: "#fde68a" },
    { frameStyle: "gold", frameWidth: 24, numberStyle: "hexagon", markerShape: "hexagon" }),
  D("gilt", "pearl-arabesque-ink", "Pearl Arabesque Ink",
    "Pearl star sheet, teal plate, gilt frame, ink-brown stems",
    { bd: "#faf7f0", bg: "islamic-pearl", fr: "#d4af37", ti: "#fffdf5", bn: "#0f766e", bn2: "#115e59",
      q: "#3f2d1a", o: "#4b3a24", ac: "#a16207", br: "#7c5a2a", chip: "#7c2d12", b3: "#fffdf5" },
    { frameStyle: "gold", frameWidth: 18 }),
  D("gilt", "teal-islamic-night", "Teal Islamic Night",
    "Deep teal night with knotwork frame and mint type",
    { bd: "#04211f", bg: "midnight-emerald", fr: "#5eead4", ti: "#ccfbf1", bn: "#0f766e", bn2: "#134e4a",
      q: "#a7f3d0", o: "#ecfdf5", ac: "#5eead4", br: "#99f6e4", chip: "#b45309", b3: "#04211f" },
    { frameStyle: "celtic", frameWidth: 24 }),
  D("gilt", "gold-sand-pattern", "Gold Sand Pattern",
    "Sand-star sheet, amber plate, deco frame, emerald tag",
    { bd: "#f7efdd", bg: "islamic-pearl", fr: "#d97706", ti: "#fffaf0", bn: "#b45309", bn2: "#78350f",
      q: "#451a03", o: "#4b3a24", ac: "#d97706", br: "#92400e", chip: "#065f46", b3: "#fffaf0" },
    { frameStyle: "artDeco", frameWidth: 22, numberStyle: "star8", markerShape: "star" }),
  D("gilt", "deep-green-mihrab", "Deep Green Mihrab",
    "Mihrab green with arch markers and an emerald palace frame",
    { bd: "#052e2b", bg: "midnight-emerald", fr: "#f5c542", ti: "#fde68a", bn: "#064e3b", bn2: "#022c22",
      q: "#d1fae5", o: "#f0fdf4", ac: "#f59e0b", br: "#a7f3d0", chip: "#064e3b", b3: "#fde68a" },
    { frameStyle: "emerald", frameWidth: 24, numberStyle: "arch", markerShape: "shield" }),
  D("gilt", "ivory-naskh-serif", "Ivory Naskh Serif",
    "Ivory calm sheet, umber plate, vintage frame, naskh caps",
    { bd: "#fffdf7", bg: "ivory-calm", fr: "#a16207", ti: "#fffaf0", bn: "#7c2d12", bn2: "#431407",
      q: "#3f2d1a", o: "#4b3a24", ac: "#a16207", br: "#7c5a2a", chip: "#065f46", b3: "#fffaf0" },
    { titleFamily: "Amiri", frameStyle: "vintage", frameWidth: 20, questionFamily: "Tiro Bangla" }),
  D("gilt", "royal-blue-crescent", "Royal Blue Crescent",
    "Midnight star field, royal blue plate, sapphire frame, star markers",
    { bd: "#0a1230", bg: "islamic-midnight", fr: "#60a5fa", ti: "#e0e7ff", bn: "#1e40af", bn2: "#172554",
      q: "#dbeafe", o: "#eff6ff", ac: "#60a5fa", br: "#bfdbfe", chip: "#d4af37", b3: "#0a1230" },
    { frameStyle: "sapphire", frameWidth: 22, numberStyle: "crescentDot", markerShape: "star" }),

  /* ============================================================= 11 · notebook
     Notebook: ruled, gridded and dotted paper, ink titles underlined in red,
     taped and stickered corners.                                              */
  D("notebook", "ruled-notebook-ink", "Ruled Notebook Ink",
    "Ruled page, ink title underlined in margin red, sticky-note tag",
    { bd: "#ffffff", bg: "notebook", fr: "#e2e8f0", ti: "#111827", bn: "#ef4444",
      q: "#1f2937", o: "#111827", ac: "#2563eb", br: "#475569", chip: "#fbbf24", b3: "#422006" },
    { frameStyle: "paper", frameWidth: 14 }),
  D("notebook", "graph-paper-notes", "Graph Paper Notes",
    "Gridded page, teal underline title, pen-blue markers",
    { bd: "#f8fbff", bg: "graph-paper", fr: "#cbd5e1", ti: "#0f172a", bn: "#0f766e",
      q: "#134e4a", o: "#1e293b", ac: "#0d9488", br: "#0369a1", chip: "#dc2626", b3: "#ffffff" }),
  D("notebook", "kraft-journal-pen", "Kraft Journal Pen",
    "Kraft page, umber underline, ink-brown stems, taped frame",
    { bd: "#f0e2c8", fr: "#c9a97a", ti: "#3f2d1a", bn: "#7c2d12",
      q: "#4a2f1c", o: "#5b4636", ac: "#a3382c", br: "#6b4f3a", chip: "#2f4f3f", b3: "#fff8ec" },
    { frameStyle: "paper", frameWidth: 18 }),
  D("notebook", "sticky-note-yellow", "Sticky Note Yellow",
    "Highlighter-yellow page, amber underline, orange tag",
    { bd: "#fef9c3", bg: "marks-yellow", fr: "#fde68a", ti: "#422006", bn: "#facc15",
      q: "#713f12", o: "#422006", ac: "#eab308", br: "#a16207", chip: "#f97316", b3: "#431407" },
    { numberStyle: "washi", markerShape: "roundedSquare" }),
  D("notebook", "pink-notebook-marks", "Pink Notebook Marks",
    "Pink marker page, rose underline, sky tag, heart markers",
    { bd: "#fdf2f8", bg: "marks-pink", fr: "#fbcfe8", ti: "#500724", bn: "#db2777",
      q: "#9d174d", o: "#831843", ac: "#ec4899", br: "#be185d", chip: "#0ea5e9", b3: "#ffffff" },
    { markerShape: "heart", numberStyle: "heart" }),
  D("notebook", "blue-exercise-book", "Blue Exercise Book",
    "Blue-ruled exercise page, indigo underline, red tag",
    { bd: "#eff6ff", bg: "marks-blue", fr: "#bfdbfe", ti: "#172554", bn: "#1d4ed8",
      q: "#1e3a8a", o: "#1e293b", ac: "#2563eb", br: "#1e40af", chip: "#dc2626", b3: "#ffffff" }),
  D("notebook", "doodle-margin-fun", "Doodle Margin Fun",
    "Sticker-scatter page, violet underline, star markers",
    { bd: "#f8fafc", bg: "stickers-scatter", fr: "#ddd6fe", ti: "#2e1065", bn: "#7c3aed",
      q: "#4c1d95", o: "#334155", ac: "#8b5cf6", br: "#6d28d9", chip: "#f59e0b", b3: "#ffffff" },
    { markerShape: "star", numberStyle: "sparkle" }),
  D("notebook", "cornell-notes-slate", "Cornell Notes Slate",
    "Linen-night page, amber underline title, chalk frame",
    { bd: "#1e293b", bg: "linen-night", fr: "#fbbf24", ti: "#fef3c7", bn: "#f59e0b",
      q: "#e2e8f0", o: "#f1f5f9", ac: "#fbbf24", br: "#94a3b8", chip: "#38bdf8", b3: "#0f172a" },
    { frameStyle: "chalk", frameWidth: 18, badgeCase: false }),

  /* ================================================================ 12 · mono
     Minimal mono: quiet sheets, no plate under the title, hairline rules and
     dot markers — for a deck that must read like print.                       */
  D("mono", "paper-black-ink", "Paper Black Ink",
    "Soft fog sheet, black display caps, hairline frame",
    { bd: "#ffffff", bg: "fog-glow", fr: "#d1d5db", ti: "#0a0a0a", bn: "#111827",
      q: "#111827", o: "#1f2937", ac: "#111827", br: "#6b7280", chip: "", b3: "#111827" },
    { chip: false, frameWidth: 6 }),
  D("mono", "warm-grey-minimal", "Warm Grey Minimal",
    "Warm stone sheet, charcoal caps, no frame shadow",
    { bd: "#f5f5f4", bg: "minimal-mist", fr: "#e7e5e4", ti: "#1c1917", bn: "#44403c",
      q: "#292524", o: "#44403c", ac: "#44403c", br: "#78716c", b3: "#1c1917" },
    { chip: false, frameWidth: 6, frameShadow: false }),
  D("mono", "cool-grey-hairline", "Cool Grey Hairline",
    "Flat cool grey sheet, slate caps, 4px hairline",
    { bd: "#f8fafc", fr: "#cbd5e1", ti: "#0f172a", bn: "#334155",
      q: "#0f172a", o: "#1e293b", ac: "#334155", br: "#64748b", b3: "#0f172a" },
    { chip: false, frameWidth: 4, rowStyle: "underline", rowGap: 1.5 }),
  D("mono", "off-white-no-frame", "Off-White No Frame",
    "Ivory sheet with no frame at all, ink caps, dot markers",
    { bd: "#fffdf7", bg: "ivory-calm", fr: "#fffdf7", ti: "#111827", bn: "#1f2937",
      q: "#111827", o: "#374151", ac: "#1f2937", br: "#9ca3af", b3: "#111827" },
    { chip: false, showFrame: false, numberStyle: "hollowDot", markerShape: "ring",
      markerTreatment: "outlined", markerFill: "none", markerRing: "ink" }),
  D("mono", "charcoal-light-mono", "Charcoal Light Mono",
    "Charcoal luxe board, near-white caps, thin graphite frame",
    { bd: "#111114", bg: "charcoal-luxe", fr: "#3f3f46", ti: "#f5f5f5", bn: "#27272a",
      q: "#e4e4e7", o: "#f4f4f5", ac: "#d4d4d8", br: "#a1a1aa", b3: "#f5f5f5" },
    { chip: false, frameWidth: 8, markerRing: "accent" }),
  D("mono", "sand-minimal-ink", "Sand Minimal Ink",
    "Sand sheet, warm ink caps, kraft hairline",
    { bd: "#f3ead9", fr: "#d6c3a5", ti: "#292524", bn: "#57534e",
      q: "#292524", o: "#44403c", ac: "#78716c", br: "#a8a29e", b3: "#292524" },
    { chip: false, frameStyle: "paper", frameWidth: 10, questionFamily: "Tiro Bangla" }),
  D("mono", "mono-contrast-bold", "Mono Contrast Bold",
    "High-contrast sheet, pure black caps, solid black frame",
    { bd: "#ffffff", bg: "dots-light", fr: "#000000", ti: "#000000", bn: "#000000",
      q: "#000000", o: "#111111", ac: "#000000", br: "#525252", chip: "#000000", b3: "#ffffff" },
    { chip: true, frameStyle: "solid", frameWidth: 10, numberStyle: "squareDot",
      markerShape: "square", markerTreatment: "filled" }),
  D("mono", "quiet-white-hairline", "Quiet White Hairline",
    "Pinstripe sheet, zinc caps, underline rows",
    { bd: "#fcfcfd", bg: "pinstripe", fr: "#e4e4e7", ti: "#18181b", bn: "#3f3f46",
      q: "#18181b", o: "#27272a", ac: "#3f3f46", br: "#a1a1aa", b3: "#18181b" },
    { chip: false, frameWidth: 4, rowStyle: "underline", titleFamily: "Inter", titleCase: false }),

  /* ================================================================ 13 · cyber
     Cyber grid: blueprint lattices, synth horizons and terminal greens under
     hard-edged plates and carbon frames.                                      */
  D("cyber", "blueprint-grid-cyan", "Blueprint Grid Cyan",
    "Diamond lattice blueprint, cyan rect plate, carbon frame",
    { bd: "#071a2b", bg: "diamond-lattice", fr: "#22d3ee", ti: "#e0f2fe", bn: "#0ea5e9", bn2: "#075985",
      q: "#bae6fd", o: "#e0f2fe", ac: "#22d3ee", br: "#7dd3fc", chip: "#0b2a3d", b3: "#a5f3fc" },
    { frameStyle: "carbon", frameWidth: 16 }),
  D("cyber", "synth-horizon-magenta", "Synth Horizon Magenta",
    "Sunset-tide horizon, magenta plate, synthwave frame",
    { bd: "#12041f", bg: "sunset-wave", fr: "#f0abfc", ti: "#fae8ff", bn: "#d946ef", bn2: "#86198f",
      q: "#f5d0fe", o: "#fdf4ff", ac: "#e879f9", br: "#f0abfc", chip: "#22d3ee", b3: "#12041f" },
    { frameStyle: "neonMagenta", frameWidth: 16 }),
  D("cyber", "cyber-cyan-hex", "Cyber Cyan Hex",
    "Lattice field, deep cyan plate, hexagon markers, cyber frame",
    { bd: "#03131a", bg: "diamond-lattice", fr: "#06b6d4", ti: "#a5f3fc", bn: "#155e75", bn2: "#083344",
      q: "#cffafe", o: "#ecfeff", ac: "#06b6d4", br: "#67e8f9", chip: "#0b2a35", b3: "#a5f3fc" },
    { frameStyle: "cyberpunk", frameWidth: 18 }),
  D("cyber", "terminal-green-mono", "Terminal Green Mono",
    "Dot-grid black, terminal green, square markers, carbon frame",
    { bd: "#030a05", bg: "dots-dark", fr: "#4ade80", ti: "#bbf7d0", bn: "#14532d", bn2: "#052e16",
      q: "#dcfce7", o: "#f0fdf4", ac: "#4ade80", br: "#86efac", chip: "#07130b", b3: "#bbf7d0" },
    { numberStyle: "square", markerShape: "square", badgeFamily: "Orbitron" }),
  D("cyber", "holo-foil-iridescent", "Holo Foil Iridescent",
    "Aurora field, indigo plate, holographic frame",
    { bd: "#0b1026", bg: "aurora-night", fr: "#a5b4fc", ti: "#e0e7ff", bn: "#6366f1", bn2: "#3730a3",
      q: "#c7d2fe", o: "#e0e7ff", ac: "#a5b4fc", br: "#c4b5fd", chip: "#22d3ee", b3: "#0b1026" },
    { frameStyle: "hologram", frameWidth: 18, numberStyle: "gem", markerShape: "diamond" }),
  D("cyber", "data-violet-grid", "Data Violet Grid",
    "Diagonal band grid, violet plate, carbon frame, tag markers",
    { bd: "#0f0a1f", bg: "stripe-accent", fr: "#a78bfa", ti: "#ddd6fe", bn: "#5b21b6", bn2: "#2e1065",
      q: "#c4b5fd", o: "#ede9fe", ac: "#a78bfa", br: "#c4b5fd", chip: "#22d3ee", b3: "#0f0a1f" },
    { numberStyle: "tag", markerShape: "tag" }),
  D("cyber", "tron-blue-lines", "Tron Blue Lines",
    "Ocean mesh field, sky plate, neon frame, ring markers",
    { bd: "#04121f", bg: "mesh-ocean-bg", fr: "#38bdf8", ti: "#bae6fd", bn: "#0369a1", bn2: "#082f49",
      q: "#7dd3fc", o: "#e0f2fe", ac: "#38bdf8", br: "#93c5fd", chip: "#0b2a45", b3: "#bae6fd" },
    { frameStyle: "neon", frameWidth: 14, numberStyle: "ring", markerShape: "ring",
      markerTreatment: "glow", markerFill: "none", markerRing: "accent" }),
  D("cyber", "pixel-arcade-retro", "Pixel Arcade Retro",
    "Indigo burst field, pixel frame, square markers on stepped rows",
    { bd: "#1a0b2e", bg: "indigo-burst", fr: "#f472b6", ti: "#fbcfe8", bn: "#7e22ce", bn2: "#4c1d95",
      q: "#f5d0fe", o: "#fdf4ff", ac: "#f472b6", br: "#e9d5ff", chip: "#22d3ee", b3: "#1a0b2e" },
    { frameStyle: "pixel", frameWidth: 18, numberStyle: "square", markerShape: "square", rowStyle: "stepped" }),

  /* =============================================================== 14 · pastel
     Pastel junior: soft sheets, cloud and heart markers, rainbow frames — the
     primary-and-secondary classroom look.                                     */
  D("pastel", "peach-cream-kids", "Peach Cream Kids",
    "Peach cream sheet, tangerine plate, rainbow frame, heart markers",
    { bd: "#fff7ed", bg: "peach-cream", fr: "#fdba74", ti: "#ffffff", bn: "#fb923c", bn2: "#ea580c",
      q: "#7c2d12", o: "#431407", ac: "#f97316", br: "#c2410c", chip: "#38bdf8", b3: "#ffffff" }),
  D("pastel", "mint-bubble-pop", "Mint Bubble Pop",
    "Mint-sky sheet, emerald plate, star markers, pink tag",
    { bd: "#ecfdf5", bg: "mint-sky", fr: "#6ee7b7", ti: "#ffffff", bn: "#34d399", bn2: "#059669",
      q: "#064e3b", o: "#065f46", ac: "#10b981", br: "#047857", chip: "#f472b6", b3: "#ffffff" },
    { markerShape: "star", numberStyle: "star" }),
  D("pastel", "lavender-play-soft", "Lavender Play Soft",
    "Lavender haze sheet, violet plate, soft rounded markers",
    { bd: "#f5f3ff", bg: "lavender-haze", fr: "#c4b5fd", ti: "#ffffff", bn: "#a78bfa", bn2: "#7c3aed",
      q: "#4c1d95", o: "#5b21b6", ac: "#8b5cf6", br: "#6d28d9", chip: "#fbbf24", b3: "#ffffff" },
    { markerShape: "roundedSquare", numberStyle: "scallop" }),
  D("pastel", "sky-pastel-cloud", "Sky Pastel Cloud",
    "Pastel dream sheet, sky plate, cloud markers",
    { bd: "#f0f9ff", bg: "pastel-dream", fr: "#7dd3fc", ti: "#ffffff", bn: "#38bdf8", bn2: "#0284c7",
      q: "#0c4a6e", o: "#075985", ac: "#0ea5e9", br: "#0369a1", chip: "#fb7185", b3: "#ffffff" },
    { numberStyle: "cloud", markerShape: "drop" }),
  D("pastel", "butter-yellow-fun", "Butter Yellow Fun",
    "Highlighter-yellow sheet, butter plate, star markers, red tag",
    { bd: "#fefce8", bg: "marks-yellow", fr: "#fde047", ti: "#422006", bn: "#facc15", bn2: "#eab308",
      q: "#713f12", o: "#422006", ac: "#eab308", br: "#a16207", chip: "#ef4444", b3: "#ffffff" },
    { markerShape: "star", numberStyle: "star", titleFamily: "Fredoka", titleCase: false }),
  D("pastel", "rose-quartz-soft", "Rose Quartz Soft",
    "Pink marker sheet, rose plate, teal tag, soft rows",
    { bd: "#fdf2f8", bg: "marks-pink", fr: "#f9a8d4", ti: "#831843", bn: "#f9a8d4", bn2: "#f472b6",
      q: "#9d174d", o: "#831843", ac: "#ec4899", br: "#be185d", chip: "#22d3ee", b3: "#0e7490" },
    { rowStyle: "soft", numberStyle: "heart" }),
  D("pastel", "pistachio-round-soft", "Pistachio Round Soft",
    "Green marker sheet, pistachio plate, orange tag, pill rows",
    { bd: "#f0fdf4", bg: "marks-green", fr: "#86efac", ti: "#14532d", bn: "#86efac", bn2: "#4ade80",
      q: "#166534", o: "#14532d", ac: "#22c55e", br: "#15803d", chip: "#f97316", b3: "#431407" },
    { markerShape: "roundedSquare", rowStyle: "pill", titleCase: false }),
  D("pastel", "candy-mix-bright", "Candy Mix Bright",
    "Confetti sheet, candy-pink plate, rainbow frame, burst markers",
    { bd: "#ffffff", bg: "stickers-confetti", fr: "#f0abfc", ti: "#ffffff", bn: "#f472b6", bn2: "#db2777",
      q: "#701a75", o: "#831843", ac: "#a855f7", br: "#9333ea", chip: "#22c55e", b3: "#ffffff" },
    { markerShape: "burst", numberStyle: "sparkle" }),

  /* =============================================================== 15 · forest
     Deep forest: green science boards with lime and gold accents — the biology
     and chemistry class look.                                                 */
  D("forest", "forest-emerald-deep", "Forest Emerald Deep",
    "Midnight emerald field, forest plate, lime markers, gold tag",
    { bd: "#052e16", bg: "midnight-emerald", fr: "#84cc16", ti: "#d9f99d", bn: "#14532d", bn2: "#052e16",
      q: "#ecfccb", o: "#f7fee7", ac: "#84cc16", br: "#bef264", chip: "#fbbf24", b3: "#052e16" },
    { frameStyle: "emerald", frameWidth: 22 }),
  D("forest", "moss-lime-lab", "Moss Lime Lab",
    "Check-doodle green field, moss plate, bamboo frame",
    { bd: "#1a2e05", bg: "doodle-checks-dark", fr: "#a3e635", ti: "#ecfccb", bn: "#3f6212", bn2: "#1a2e05",
      q: "#d9f99d", o: "#f7fee7", ac: "#a3e635", br: "#bef264", chip: "#38bdf8", b3: "#1a2e05" },
    { frameStyle: "bamboo", frameWidth: 22, numberStyle: "leaf" }),
  D("forest", "pine-gold-accent", "Pine Gold Accent",
    "Chalk-green field, pine plate, gold markers, wood frame",
    { bd: "#0f2419", bg: "chalkboard", fr: "#e6a15c", ti: "#fde68a", bn: "#166534", bn2: "#0f2419",
      q: "#f0fdf4", o: "#f7fee7", ac: "#f5c542", br: "#d9f2e3", chip: "#7c2d12", b3: "#fde68a" },
    { frameStyle: "wood", frameWidth: 26, numberStyle: "coin" }),
  D("forest", "botanical-dark-leaf", "Botanical Dark Leaf",
    "Girih-emerald field, botanical plate, leaf markers",
    { bd: "#04211f", bg: "girih-emerald", fr: "#2dd4bf", ti: "#a7f3d0", bn: "#065f46", bn2: "#04211f",
      q: "#ccfbf1", o: "#ecfdf5", ac: "#2dd4bf", br: "#99f6e4", chip: "#f472b6", b3: "#04211f" },
    { numberStyle: "leaf", markerShape: "leaf", rowStyle: "leftBar" }),
  D("forest", "olive-field-warm", "Olive Field Warm",
    "Flat olive board, olive plate, oak frame, lime markers",
    { bd: "#232a12", fr: "#a3a847", ti: "#f7fee7", bn: "#4d7c0f", bn2: "#232a12",
      q: "#ecfccb", o: "#f7fee7", ac: "#a3e635", br: "#d9f99d", chip: "#b45309", b3: "#232a12" },
    { frameStyle: "oak", frameWidth: 24, numberStyle: "drop", markerShape: "drop" }),
  D("forest", "jungle-teal-glow", "Jungle Teal Glow",
    "Midnight emerald field, teal plate, glowing amber tag",
    { bd: "#022c22", bg: "midnight-emerald", fr: "#14b8a6", ti: "#99f6e4", bn: "#0f766e", bn2: "#022c22",
      q: "#ccfbf1", o: "#f0fdfa", ac: "#14b8a6", br: "#5eead4", chip: "#f59e0b", b3: "#022c22" },
    { bulletEffect: "glow", bulletEffectIntensity: 60, rowStyle: "glass" }),
  D("forest", "ivy-league-serif", "Ivy League Serif",
    "Chalk-green field, ivy plate, mahogany frame, serif caps",
    { bd: "#0b2417", bg: "chalkboard", fr: "#a3382c", ti: "#fef9c3", bn: "#14532d", bn2: "#0b2417",
      q: "#f0fdf4", o: "#f7fee7", ac: "#d4af37", br: "#e7d8a8", chip: "#7f1d1d", b3: "#fef9c3" },
    { titleFamily: "Bree Serif", titleCase: false, frameStyle: "mahogany", frameWidth: 26,
      numberStyle: "plaque", markerShape: "shield" }),
  D("forest", "green-lab-grid-light", "Green Lab Grid Light",
    "Green marker sheet, green plate, cards, red tag",
    { bd: "#f0fdf4", bg: "marks-green", fr: "#86efac", ti: "#ffffff", bn: "#16a34a", bn2: "#15803d",
      q: "#14532d", o: "#1f2937", ac: "#22c55e", br: "#15803d", chip: "#dc2626", b3: "#ffffff" },
    { titleCase: true, rowStyle: "card", frameWidth: 10, numberStyle: "rounded",
      markerShape: "roundedSquare", markerTreatment: "soft" }),

  /* ================================================================ 16 · retro
     Retro print: kraft, newsprint and two-colour poster inks with slab faces,
     stamp markers and long shadows.                                           */
  D("retro", "newsprint-ink-red", "Newsprint Ink Red",
    "Newsprint sheet, ink-red ribbon, vintage frame, teal tag",
    { bd: "#f5f1e8", bg: "ivory-calm", fr: "#a8a29e", ti: "#fdf6e3", bn: "#b91c1c", bn2: "#7f1d1d",
      q: "#1c1917", o: "#292524", ac: "#b91c1c", br: "#44403c", chip: "#0f766e", b3: "#f0fdfa" }),
  D("retro", "kraft-red-stamp", "Kraft Red Stamp",
    "Kraft sheet, umber ribbon, stamp markers, paper frame",
    { bd: "#e8d5b5", fr: "#c9a97a", ti: "#fff8ec", bn: "#a3382c", bn2: "#61150f",
      q: "#4a2f1c", o: "#5b4636", ac: "#a3382c", br: "#6b4f3a", chip: "#2f4f3f", b3: "#f0fdf4" },
    { frameStyle: "paper", frameWidth: 18, numberStyle: "stamp" }),
  D("retro", "vintage-teal-print", "Vintage Teal Print",
    "Flat dark teal board, teal ribbon, vintage frame, amber tag",
    { bd: "#0e2a2a", fr: "#5eead4", ti: "#ccfbf1", bn: "#0f766e", bn2: "#134e4a",
      q: "#a7f3d0", o: "#ecfdf5", ac: "#2dd4bf", br: "#99f6e4", chip: "#b45309", b3: "#0e2a2a" },
    { frameStyle: "vintage", frameWidth: 22 }),
  D("retro", "retro-orange-poster", "Retro Orange Poster",
    "Poster-orange sheet, comic frame, slab caps, blue tag",
    { bd: "#fff3e0", fr: "#fb923c", ti: "#fff7ed", bn: "#ea580c", bn2: "#c2410c",
      q: "#7c2d12", o: "#431407", ac: "#f97316", br: "#9a3412", chip: "#1d4ed8", b3: "#ffffff" },
    { frameStyle: "comic", frameWidth: 20, numberStyle: "burst", markerShape: "burst" }),
  D("retro", "old-paper-sepia", "Old Paper Sepia",
    "Scholar cream sheet, sepia ribbon, gilt-brown frame",
    { bd: "#f3e6cb", bg: "scholar-cream", fr: "#92400e", ti: "#fef3c7", bn: "#78350f", bn2: "#451a03",
      q: "#451a03", o: "#3f2d1a", ac: "#92400e", br: "#7c5a2a", chip: "#701a75", b3: "#fef3c7" },
    { titleFamily: "Abril Fatface", frameStyle: "vintage", frameWidth: 22, numberStyle: "coupon" }),
  D("retro", "two-colour-print", "Two-Colour Print",
    "Cross-mark sheet, black ribbon, red accent, double frame",
    { bd: "#ffffff", bg: "marks-cross", fr: "#111827", ti: "#ffffff", bn: "#0f172a", bn2: "#020617",
      q: "#111827", o: "#1f2937", ac: "#dc2626", br: "#334155", chip: "#0f172a", b3: "#ffffff" },
    { frameStyle: "double", frameWidth: 16, numberStyle: "numHash", markerShape: "square" }),
  D("retro", "pulp-comic-pop", "Pulp Comic Pop",
    "Yellow star tile sheet, pulp red ribbon, comic frame",
    { bd: "#fef9c3", bg: "stickers-yellow-tile", fr: "#dc2626", ti: "#fef08a", bn: "#dc2626", bn2: "#7f1d1d",
      q: "#1c1917", o: "#292524", ac: "#2563eb", br: "#b91c1c", chip: "#facc15", b3: "#422006" },
    { titleFamily: "Bangers", frameStyle: "comic", frameWidth: 22, numberStyle: "burst",
      markerShape: "burst", rowStyle: "duo" }),
  D("retro", "letterpress-blue", "Letterpress Blue",
    "Dot sheet, navy ribbon, groove frame, slab caps",
    { bd: "#eef2f7", bg: "dots-light", fr: "#94a3b8", ti: "#f8fafc", bn: "#1e3a8a", bn2: "#172554",
      q: "#0f172a", o: "#1e293b", ac: "#1e40af", br: "#334155", chip: "#b91c1c", b3: "#ffffff" },
    { titleFamily: "Alfa Slab One", frameStyle: "groove", frameWidth: 20, numberStyle: "plaque" }),
];

/* ================================================================ public API */

export const SLIDE_DESIGN_BY_ID = new Map<string, SlideDesignPreset>(
  SLIDE_DESIGNS.map((d) => [d.id, d]),
);

export const FAMILY_LABEL: Record<DesignFamilyId, string> = Object.fromEntries(
  DESIGN_FAMILIES.map((f) => [f.id, f.label]),
) as Record<DesignFamilyId, string>;

/** how many complete looks the gallery ships */
export const SLIDE_DESIGN_COUNT = SLIDE_DESIGNS.length;

/** the designs of one family, in gallery order */
export const designsOfFamily = (family: DesignFamilyId): SlideDesignPreset[] =>
  SLIDE_DESIGNS.filter((d) => d.family === family);

/**
 * The thirteen aspects one design writes — the panel lists them, and the test
 * suite checks every preset really does set all of their fields.
 */
export interface DesignAspect {
  id: string;
  label: string;
  fields: (keyof ThemeSettings)[];
}

export const DESIGN_ASPECTS: DesignAspect[] = [
  { id: "badge1", label: "Badge 1", fields: ["brandTopColor", "brandTopSize", "showBrandTop"] },
  { id: "badge2", label: "Badge 2", fields: ["brandBottomColor", "brandBottomSize", "showBrandBottom"] },
  { id: "badge3", label: "Badge 3", fields: ["badgeColor", "badgeSize", "badgePlate"] },
  { id: "titleText", label: "Title text", fields: ["titleColor", "titleSize"] },
  { id: "titleBg", label: "Title background", fields: ["titleBanner", "banner"] },
  { id: "questionBullet", label: "Question bullet", fields: ["numberStyle", "bulletSize", "bulletFill", "bulletBorder", "bulletEffect"] },
  { id: "questionText", label: "Question text", fields: ["questionColor", "questionSize"] },
  { id: "optionText", label: "Option text", fields: ["optionTextColor", "optionSize"] },
  { id: "optionMarker", label: "Option bullet marker", fields: ["optionBulletShape", "optionBulletTreatment", "optionBulletInk", "optionBulletFill", "optionBulletBorder"] },
  { id: "optionMarkerBg", label: "Option bullet background", fields: ["optionBulletBgColor", "optionBulletBgScope", "optionBulletBgShape", "optionBulletBgSize", "optionBulletBgOpacity"] },
  { id: "optionRow", label: "Option row", fields: ["optionStyle", "optionAccent", "optionGap", "optionLineHeight"] },
  { id: "board", label: "Board background", fields: ["board", "background"] },
  { id: "frame", label: "Frame", fields: ["frame", "frameOuter", "frameInner", "showFrame"] },
];

/**
 * The patch to hand `setTheme`. A design owns the *look* of the board, never
 * the user's own picture: the slide background's image fields (photo, fit,
 * focal point, blur, zoom, flip) and the frame's overlay image survive every
 * design change.
 */
export function designPatch(design: SlideDesignPreset, theme: ThemeSettings): Partial<ThemeSettings> {
  const cur = theme.background;
  const curFrame = theme.frame ?? DEFAULT_THEME.frame;
  const bg = design.theme.background;
  const frame = design.theme.frame;
  return {
    ...design.theme,
    background: bg
      ? {
          ...bg,
          src: cur?.src ?? "",
          fit: cur?.fit ?? "cover",
          posX: cur?.posX ?? 50,
          posY: cur?.posY ?? 50,
          opacity: cur?.opacity ?? 1,
          blur: cur?.blur ?? 0,
          zoom: cur?.zoom ?? 0,
          flipH: cur?.flipH ?? false,
        }
      : bg,
    frame: frame
      ? {
          ...frame,
          image: curFrame.image,
          imageInset: curFrame.imageInset,
          imagePlacement: curFrame.imagePlacement,
        }
      : frame,
  };
}

/* ------------------------------------------------------- which one is on? */

/** the fields a design owns — the fingerprint of "which look is painted" */
const FP_KEYS: (keyof ThemeSettings)[] = [
  "board", "background", "frame", "frameOuter", "frameInner", "showFrame",
  "titleColor", "titleSize", "titleBanner", "banner",
  "brandColor", "brandTopColor", "brandBottomColor", "brandTopSize", "brandBottomSize",
  "showBrandTop", "showBrandBottom", "badgeColor", "badgeSize", "badgePlate",
  "showBullet", "numberStyle", "bulletSize", "bulletFill", "bulletFillGradient",
  "bulletBorder", "bulletBorderGradient", "bulletBorderStyle", "bulletBorderWeight",
  "bulletRadius", "bulletOpacity", "bulletEffect", "bulletEffectIntensity",
  "bulletEffectColor", "bulletStylePreset",
  "questionColor", "questionSize",
  "optionTextColor", "optionSize", "optionStyle", "optionAccent", "optionGap", "optionLineHeight",
  "optionBulletShape", "optionBulletTreatment", "optionBulletInk", "optionBulletFill",
  "optionBulletBorder", "optionBulletCustomOnAnswer", "optionBulletFontFamily",
  "optionBulletTextSize", "optionBulletTextWeight", "optionBulletUppercase",
  "optionBulletBgColor", "optionBulletBgScope", "optionBulletBgShape",
  "optionBulletBgSize", "optionBulletBgOpacity",
  "noteColor", "noteOpacity", "noteSize", "showNote",
  "accent", "answerStyle", "boxFonts",
];

/** the sub-fields of the two nested surfaces a design really owns */
const BG_FP = ["gradient", "design", "designW", "designH", "designOpacity", "overlay", "vignette"];
const FRAME_FP = ["style", "color", "gradient", "width", "radius", "shadow"];

const pickKeys = (o: unknown, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown> | undefined)?.[k]]));

/** key-sorted JSON, dropping undefineds — stable across a save/load round-trip */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val === undefined) continue;
      out[k] = sortDeep(val);
    }
    return out;
  }
  return v;
}

const stable = (v: unknown): string => JSON.stringify(sortDeep(v)) ?? "null";

/** "which look is painted on this theme?" — one string, cheap to compare */
export function designFingerprint(theme: ThemeSettings): string {
  return FP_KEYS.map((k) =>
    stable(
      k === "background"
        ? pickKeys(theme.background, BG_FP)
        : k === "frame"
          ? pickKeys(theme.frame, FRAME_FP)
          : theme[k],
    ),
  ).join("|");
}

const FP_BY_DESIGN = new Map<string, string>(
  SLIDE_DESIGNS.map((d) => [
    d.id,
    designFingerprint({ ...DEFAULT_THEME, ...d.theme } as ThemeSettings),
  ]),
);

const DESIGN_BY_FP = new Map<string, SlideDesignPreset>(
  SLIDE_DESIGNS.map((d) => [FP_BY_DESIGN.get(d.id)!, d]),
);

/** the design currently painted, or `null` once anything has been hand-tuned */
export function activeSlideDesign(theme: ThemeSettings): SlideDesignPreset | null {
  return DESIGN_BY_FP.get(designFingerprint(theme)) ?? null;
}

/** the design before / after `id` in the gallery — `by` may be negative */
export function neighbourDesign(id: string | null, by: number): SlideDesignPreset {
  const i = id ? SLIDE_DESIGNS.findIndex((d) => d.id === id) : -1;
  const n = SLIDE_DESIGNS.length;
  const next = i < 0 ? (by > 0 ? 0 : n - 1) : (i + by + n) % n;
  return SLIDE_DESIGNS[next];
}

/* ------------------------------------------------------------------- fonts */

/** every typeface a design asks for, so the gallery can preload them */
export function designFontFamilies(design: SlideDesignPreset): string[] {
  const out = new Set<string>();
  for (const part of Object.values(design.theme.boxFonts ?? {})) {
    if (part?.family) out.add(part.family);
  }
  return [...out];
}

/** fetch the faces a design uses (a no-op for the ones already on the page) */
export function loadDesignFonts(design: SlideDesignPreset): void {
  const fonts = designFontFamilies(design)
    .map((f) => fontChoiceFor(f))
    .filter((f): f is FontChoice => !!f);
  if (fonts.length) ensureFontStylesheet(fonts);
}
