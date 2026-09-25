import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  BannerBorder,
  BannerBorderGlow,
  BannerBorderStyle,
  BannerCorners,
  BannerPatternKind,
  BannerSettings,
  BannerShape,
  Gradient,
  ThemeSettings,
  TransparentSide,
} from "../lib/types";
import {
  BANNER_WIDTH,
  DEFAULT_BANNER,
  DEFAULT_BANNER_BORDER_GLOW,
  DEFAULT_BANNER_GLASS,
  DEFAULT_BANNER_METALLIC,
  DEFAULT_BANNER_PATTERN,
} from "../lib/types";
import {
  BANNER_3D_DEFAULTS,
  BANNER_3D_EFFECTS,
  BANNER_BEVEL_DEFAULTS,
  BANNER_BEVEL_EFFECTS,
  BANNER_BLUR_DEFAULTS,
  BANNER_BLUR_EFFECTS,
  BANNER_DECOR_DEFAULT,
  BANNER_DECOR_EFFECTS,
  BANNER_GLASS_DEFAULTS,
  BANNER_GLASS_EFFECTS,
  BANNER_GLOW_DEFAULTS,
  BANNER_GLOW_EFFECTS,
  BANNER_HIGHLIGHT_DEFAULTS,
  BANNER_HIGHLIGHT_EFFECTS,
  BANNER_MODERN_DEFAULT,
  BANNER_MODERN_EFFECTS,
  BANNER_PRESETS,
  BANNER_PRESET_GROUPS,
  BANNER_SHADOW_DEFAULTS,
  BANNER_SHADOW_EFFECTS,
  bannerBorderGlowColor,
  bannerBorderGlowFilter,
  bannerBorderPaintColor,
  bannerCorners,
  bannerCornersNow,
  bannerCss,
  bannerFillMode,
  bannerFxColor,
  bannerEffectsOf,
  bannerHasLine,
  bannerPlateWidth,
  bannerPresetPatch,
  bannerSizeNow,
  bannerBorderStyle,
  baseColor,
  canOutline,
  clampOpacity,
  fxCornerRadius,
  glassFillCss,
  gradientCss,
  isClippedShape,
  isMaskedShape,
  metallicFillCss,
  patternFillCss,
  plateHeightFactor,
  platePaintLayers,
  radiusFollowsBar,
  takesCorners,
  type BannerEffectDef,
  type BannerPreset,
  type BannerPresetGroup,
  type BannerShapeFamily,
} from "../lib/banner";
import type { BannerEffects, BannerShapeFx } from "../lib/types";
import { shade, withAlpha } from "../lib/color";
import { rotateHue } from "../lib/textEffects";
import FontColorPanel, { type Tab as ColorPanelTab } from "./FontColorPanel";
import PaintPopoverField, { AnchoredPopover } from "./ColorPopover";
import { Field, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

/** the channel's gradient switched off (kept for the next time), never invented */
const gradOff = (g?: Gradient): Gradient | undefined => (g ? { ...g, enabled: false } : undefined);

/**
 * The title background plate's own controls — one card per channel, so the
 * toolbar's buttons each open exactly what they name.
 *
 *   Design presets    fifty-one complete looks, filed in ten   BANNER_PRESETS
 *                     groups — the last three are the shape
 *                     styles: Stylish shapes · Multilayer
 *                     shapes · Multilayer gradient
 *   Shape             the silhouettes in thirteen groups      BANNER_SHAPE_GROUPS
 *                     — the shape library (Basic & Clean ·
 *                     Banner Style · Cut & Corner · Modern ·
 *                     Curved & Wave · Organic / Decorative ·
 *                     Decorative / Highlight · Premium /
 *                     Special), then the original paint
 *                     families (plates · stylish cuts ·
 *                     multilayer · multilayer gradient · marks)
 *   Effects           softness (glow) · outer halo · shimmer,
 *                     and the seven effect groups — Common Effects
 *                     (the text background's own effects, each by
 *                     intensity and colour), Shadow Effects (twelve
 *                     shadows on X · Y · Blur · Spread · Opacity ·
 *                     Colour), Glow & Light, Depth / 3D, Modern
 *                     Effects, Shape Effects and Decorative
 *                     Effects — every tile a miniature of the deck's
 *                     own plate wearing that effect, and every Colour
 *                     channel auto to the shape's own paint (the fill
 *                     card's colour), so an effect follows a repaint
 *                                                          `effects`
 *   Fill              ten fills on one plate — solid colour,    `fillMode` · `color` ·
 *                     five gradient ramps (linear · radial ·    `gradient` · `glass` ·
 *                     angular · reflected · multi-colour ·      `metallic` · `pattern`
 *                     transparent), frosted glass, brushed
 *                     metal and a pattern
 *   Border            the whole outline in ONE card: on / off,   `border` · `radius` ·
 *                     its colour (the shared colour card),      `cornersIndependent` ·
 *                     style, weight, transparency, the corner    `corners`
 *                     radius — all four at once or each corner
 *                     on its own — and the line's glow (size ·
 *                     strength · colour, auto to the line's)
 *   Transparency      the SHAPE's own, on a slider               `opacity`
 *   Banner size       free width / height in px of the board     `size`
 *   Banner position   free X / Y nudge in px of the board        `pos`
 *
 * Every channel falls back to the plate's own auto value, so an untouched deck
 * renders exactly as it always did: no free size, no nudge, no outline.
 */
interface BannerProps {
  theme: ThemeSettings;
  /** the whole plate settings, already merged with the deck's defaults */
  banner: BannerSettings;
  /** one writer for the plate — it keeps `theme.titleBanner` in step */
  setBanner: (patch: Partial<BannerSettings>) => void;
  /** the deck's own colours, offered inside every colour pop-up */
  documentColors?: string[];
}

/** the plate the deck is painting right now, with the legacy colour folded in */
export function bannerOf(theme: ThemeSettings): BannerSettings {
  return {
    ...DEFAULT_BANNER,
    ...(theme.banner ?? {}),
    color: theme.banner?.color ?? theme.titleBanner,
    border: { ...DEFAULT_BANNER.border, ...(theme.banner?.border ?? {}) },
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** a slider's range never traps a value a deck already carries */
export const rangeMax = (limit: number, ...values: (number | undefined)[]) =>
  Math.max(limit, ...values.map((v) => Math.abs(v ?? 0)));

function Cap({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-normal text-slate-500">
        {hint}
        {action}
      </span>
    </div>
  );
}

/** clear a channel back to the plate's own default */
export function AutoBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!on}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px]",
        on ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-400 hover:bg-white/10",
      )}
    >
      auto
    </button>
  );
}

export interface BannerShapeDef {
  id: BannerShape;
  label: string;
  hint: string;
}

/**
 * Every silhouette the plate can wear, in the thirteen groups the picker's own
 * headings name. The first eight are the shape library — **Basic & Clean**,
 * **Banner Style**, **Cut & Corner**, **Modern**, **Curved & Wave**, **Organic /
 * Decorative**, **Decorative / Highlight** and **Premium / Special**; a shape
 * that already lives in one of the last five groups (pill, rounded, ribbon,
 * notch, slant, stack, offset line, split, arch) files under its library group
 * instead, under the library's name — and so does a shape the library already
 * had under another name: the hexagonal banner is the **Hexagon** of the
 * stylish cuts, the parallelogram banner the **Slanted Banner**, the skewed
 * banner the **Skewed Rectangle**, the angled-corner banner the **Angled
 * Banner**, the soft organic plate the **Organic Title Plate**, the shadow
 * banner the **Long shadow**, the border frame plate the **Double frame** and
 * the underline shape the **Underline** mark. The last five groups are the
 * original paint families: plates, the stylish cuts, the multilayer plates, the
 * multilayer gradient plates, and the marks. `BANNER_SHAPES` below is this same
 * list flattened, for anything that wants the whole set at once.
 */
export const BANNER_SHAPE_GROUPS: { family: BannerShapeFamily; name: string; hint: string; shapes: BannerShapeDef[] }[] = [
  {
    family: "basic",
    name: "Basic & Clean",
    hint: "The clean plates — rectangles, capsules and ovals",
    shapes: [
      { id: "rounded", label: "Rounded Rectangle", hint: "A card with rounded corners" },
      { id: "softRounded", label: "Soft Rounded Rectangle", hint: "Rounded much wider — the corners melt" },
      { id: "capsule", label: "Capsule", hint: "A true ellipse — the ends taper" },
      { id: "pill", label: "Pill", hint: "A capsule — fully rounded ends" },
      { id: "ovalPlate", label: "Oval Plate", hint: "A tall oval plate with an inner rim" },
      { id: "circlePlate", label: "Circle Plate", hint: "The roundest plate — make it a circle with a free size" },
      { id: "halfRound", label: "Half-Rounded Rectangle", hint: "The bottom corners rounded, the top edge square" },
      { id: "curvedRect", label: "Curved Rectangle", hint: "Both edges arch — a band thick in the middle" },
      { id: "softSquare", label: "Soft Square", hint: "A squarer, taller plate with soft corners" },
      { id: "ellipseBanner", label: "Ellipse Banner", hint: "A wide, flat ellipse" },
    ],
  },
  {
    family: "bannerStyle",
    name: "Banner Style",
    hint: "The classic banner cuts — ribbons, points and notches",
    shapes: [
      { id: "classicBanner", label: "Classic Banner", hint: "A plain bar with an embossed top and bottom rule" },
      { id: "titleBanner", label: "Title Banner", hint: "A colour strip riding the plate's leading end" },
      { id: "ribbon", label: "Ribbon Banner", hint: "A ribbon with notched ends" },
      { id: "pointedBanner", label: "Pointed Banner", hint: "A tag with a long, sharp point at its end" },
      { id: "doubleEndedBanner", label: "Double-Ended Banner", hint: "A bookmark — a point at each end" },
      { id: "notch", label: "Notched Banner", hint: "Two corners sliced off, top-left and bottom-right" },
      { id: "cutCorner", label: "Cut-Corner Banner", hint: "All four corners bevelled" },
      { id: "foldedBanner", label: "Folded Banner", hint: "A ribbon with folded tails behind it" },
      { id: "scrollBanner", label: "Scroll Banner", hint: "A parchment with rolled ends" },
      { id: "badgeBanner", label: "Badge Banner", hint: "A pill with a double inner ring" },
      { id: "tailBanner", label: "Tail Banner", hint: "A banner with a forked tail at each end" },
      { id: "flagBanner", label: "Flag Banner", hint: "A flag fluttering — wavy edges and a forked free end" },
    ],
  },
  {
    family: "cut",
    name: "Cut & Corner",
    hint: "The corner cuts — one cut, two, a shear, a chamfer, the octagon and the trapezoid",
    shapes: [
      { id: "singleCut", label: "Single-Cut Banner", hint: "One end cut on the bias, the leading edge square" },
      { id: "doubleCut", label: "Double-Cut Banner", hint: "Two cuts, both on the top edge — the bottom stays square" },
      { id: "diagonalCut", label: "Diagonal-Cut Banner", hint: "The whole plate sheared — both long edges on one diagonal" },
      { id: "chamferedBanner", label: "Chamfered Banner", hint: "All four corners chamfered deep" },
      { id: "octagonBanner", label: "Octagonal Banner", hint: "Eight sides, proportioned for a wide plate" },
      { id: "trapezoidBanner", label: "Trapezoid Banner", hint: "Narrow across the top, wide across the bottom" },
    ],
  },
  {
    family: "modern",
    name: "Modern",
    hint: "The contemporary cuts — angles, layers and cards",
    shapes: [
      { id: "slant", label: "Slanted Banner", hint: "A parallelogram banner — both ends leaning" },
      { id: "diagonalBanner", label: "Diagonal Banner", hint: "One diagonal edge, the other straight" },
      { id: "angledBanner", label: "Angled Banner", hint: "One corner cut on the long bias — the angled-corner banner" },
      { id: "asymmetricBanner", label: "Asymmetric Banner", hint: "Taller at the start, stepping in to the end" },
      { id: "skewedRect", label: "Skewed Rectangle", hint: "A shallow lean — the skewed banner, the slant's cousin" },
      { id: "stack", label: "Layered Banner", hint: "Three plates, each peeking out from behind the last" },
      { id: "offsetLine", label: "Offset Banner", hint: "The outline drawn again and offset — the sketch look" },
      { id: "split", label: "Split Banner", hint: "The gradient cut in two by one hard diagonal" },
      { id: "floatingPlate", label: "Floating Title Plate", hint: "A card lifted off the board on its own shadow" },
      { id: "geoPlate", label: "Geometric Title Plate", hint: "Two opposite corners bevelled, with an inner rule" },
      { id: "steppedBanner", label: "Stepped Banner", hint: "Both long edges step down — a staircase band" },
    ],
  },
  {
    family: "curve",
    name: "Curved & Wave",
    hint: "The curved silhouettes — arches, domes and waves",
    shapes: [
      { id: "waveBanner", label: "Wave Banner", hint: "A band with a wave on each edge" },
      { id: "curvedBanner", label: "Curved Banner", hint: "A band with an arch along the top edge" },
      { id: "wavyStrip", label: "Wavy Strip", hint: "A big swell — the wave runs the whole height" },
      { id: "arch", label: "Arch Banner", hint: "A full arch on top, flat along the bottom" },
      { id: "domeBanner", label: "Dome Banner", hint: "A dome on a flat base" },
      { id: "concaveBanner", label: "Concave Banner", hint: "A band pinched in the middle" },
      { id: "convexBanner", label: "Convex Banner", hint: "A lens — bulging in the middle" },
      { id: "swoosh", label: "Swoosh", hint: "A sweeping stroke that tapers to a point" },
      { id: "curvedRibbon", label: "Curved Ribbon", hint: "A wavy band with folded tails" },
      { id: "wavePlate", label: "Wave Plate", hint: "A flat top, a wave along the bottom" },
    ],
  },
  {
    family: "organic",
    name: "Organic / Decorative",
    hint: "The freehand shapes — blobs, clouds and strokes",
    shapes: [
      { id: "organicBlob", label: "Organic Blob", hint: "A soft, hand-drawn blob" },
      { id: "abstractBlob", label: "Abstract Blob", hint: "An angular, faceted blob" },
      { id: "wavyBlob", label: "Wavy Blob", hint: "A blob with a rippled edge" },
      { id: "roundedBlob", label: "Rounded Blob", hint: "A squircle — round, but built" },
      { id: "cloudShape", label: "Cloud Shape", hint: "Puffs along the top, flat along the bottom" },
      { id: "brushStroke", label: "Brush Stroke", hint: "A dry brush laid flat under the heading" },
      { id: "paintStroke", label: "Paint Stroke", hint: "A thick head tapering to a thin tail" },
      { id: "highlightBlob", label: "Highlight Blob", hint: "A soft-edged blob — the highlighter look" },
      { id: "organicPlate", label: "Organic Title Plate", hint: "An organic plate, flat enough to carry type — the soft organic plate" },
      { id: "abstractPlate", label: "Abstract Title Plate", hint: "An irregular facet plate" },
      { id: "asymmetricBlob", label: "Asymmetric Blob", hint: "A blob weighted to one side — a heavy lobe, a tight tail" },
      { id: "liquidShape", label: "Liquid Shape", hint: "A pour — a band with drips along its lower edge" },
      { id: "amoebaShape", label: "Amoeba Shape", hint: "An amoeba — a blob reaching out in pseudopods" },
      { id: "freeformBlob", label: "Freeform Blob", hint: "A freehand blob — drawn, not built" },
    ],
  },
  {
    family: "decor",
    name: "Decorative / Highlight",
    hint: "The highlighter's own marks — strokes, splashes and bursts",
    shapes: [
      { id: "markerStroke", label: "Marker Stroke", hint: "A chisel marker laid across — hard ends, a flat body" },
      { id: "highlightStrip", label: "Highlight Strip", hint: "A highlighter strip running the whole width" },
      { id: "swooshHighlight", label: "Swoosh Highlight", hint: "A tapered sweep with a feathered edge" },
      { id: "splashShape", label: "Splash Shape", hint: "A paint splash with droplets round it" },
      { id: "burstPlate", label: "Burst Plate", hint: "A burst of twelve deep rays round the heading" },
      { id: "sunburstPlate", label: "Sunburst Plate", hint: "A card under a sunburst of fine rays" },
    ],
  },
  {
    family: "premium",
    name: "Premium / Special",
    hint: "The dressed plates — ribbons, layers, glass, tickets, seals",
    shapes: [
      { id: "doubleRibbon", label: "Double Ribbon", hint: "A notched ribbon with two darker tails behind it" },
      { id: "tripleLayer", label: "Triple Layer Banner", hint: "Four plates — three stepping out behind the body" },
      { id: "plate3d", label: "3D Title Plate", hint: "A card on an extruded edge, bevelled top and bottom" },
      { id: "glassPlate", label: "Glass Title Plate", hint: "A pane of glass — a bright corner sheen over a frost" },
      { id: "outlineBanner", label: "Outline Banner", hint: "A hollow plate — the fill paints a ring, the middle stays clear" },
      { id: "ticketBanner", label: "Ticket Banner", hint: "A ticket, bitten at its two dashed perforations" },
      { id: "sealBadge", label: "Seal Badge", hint: "A notary's seal — the edge cut in a ring of small arcs" },
      { id: "emblemPlate", label: "Emblem Plate", hint: "An emblem — square shoulders, a point at the bottom centre" },
    ],
  },
  {
    family: "plate",
    name: "Plates",
    hint: "One body — the corners are all that changes",
    shapes: [
      { id: "glow", label: "Glow", hint: "A soft radial light behind the heading" },
      { id: "rect", label: "Box", hint: "A plain rectangle" },
    ],
  },
  {
    family: "stylish",
    name: "Stylish shapes",
    hint: "One plate, cut to another silhouette — the outline follows the cut",
    shapes: [
      { id: "hex", label: "Hexagon", hint: "A hexagonal banner — a badge with a point at each end" },
      { id: "chevron", label: "Chevron", hint: "Square at the start, an arrow tip at the end" },
      { id: "swallow", label: "Swallowtail", hint: "A flag with a V cut into its trailing end" },
      { id: "tab", label: "Tab", hint: "Rounded along the top, square along the bottom" },
    ],
  },
  {
    family: "layered",
    name: "Multilayer shapes",
    hint: "The plate plus painted layers of its own behind it",
    shapes: [
      { id: "frame", label: "Double frame", hint: "A second plate behind, and a hairline inside the first — the border frame plate" },
      { id: "accent", label: "Accent block", hint: "A colour block riding on the plate's leading end" },
      { id: "longShadow", label: "Long shadow", hint: "The plate with its own long diagonal shadow — the shadow banner" },
    ],
  },
  {
    family: "gradient",
    name: "Multilayer gradient",
    hint: "One plate painted from several stacked gradients",
    shapes: [
      { id: "sheen", label: "Sheen", hint: "The gradient crossed by a diagonal band of light" },
      { id: "gloss", label: "Gloss", hint: "The gradient under a gloss along the top edge" },
      { id: "stripes", label: "Striped", hint: "The gradient under a fine diagonal stripe weave" },
      { id: "gradStack", label: "Stacked", hint: "Three plates behind, each with a gradient of its own" },
    ],
  },
  {
    family: "mark",
    name: "Marks",
    hint: "A rule instead of a plate — or nothing at all",
    shapes: [
      { id: "underline", label: "Underline", hint: "A rule under the heading only — the underline shape" },
      { id: "none", label: "None", hint: "No plate at all" },
    ],
  },
];

/** every silhouette, flattened — the toolbar's Shapes button and the panels */
export const BANNER_SHAPES: BannerShapeDef[] = BANNER_SHAPE_GROUPS.flatMap((g) => g.shapes);

export const BANNER_BORDER_STYLES: { value: BannerBorderStyle; label: string; hint: string; dash?: string }[] = [
  { value: "solid", label: "Solid", hint: "One continuous line" },
  { value: "dashed", label: "Dashed", hint: "Even dashes", dash: "4 3" },
  { value: "dotted", label: "Dotted", hint: "Round dots", dash: "0.1 3.2" },
  { value: "double", label: "Double", hint: "Two parallel lines" },
  { value: "none", label: "None", hint: "No outline at all" },
];

/** the line style as a picture — the panels' tiles and the toolbar's own icon */
export function BorderStyleIcon({ style, size = 18, color = "currentColor" }: { style: BannerBorderStyle; size?: number; color?: string }) {
  const s = size;
  const stroke = Math.max(1.6, s * 0.11);
  if (style === "none") {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="none" stroke={color} strokeWidth={stroke} opacity="0.35" />
        <path d="M4 16 16 4" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "double") {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.4" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
        <rect x="5.6" y="5.6" width="8.8" height="8.8" rx="2" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="3"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={style === "dashed" ? "4 3" : style === "dotted" ? "0.1 3.2" : undefined}
        strokeLinecap={style === "dotted" ? "round" : undefined}
      />
    </svg>
  );
}

/** the toolbar's own icon: a hairline, a medium and a heavy rule */
export function WeightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3.4" width="16" height="1.2" rx="0.6" />
      <rect x="2" y="8.6" width="16" height="2.6" rx="1.3" />
      <rect x="2" y="14.4" width="16" height="4.2" rx="2.1" />
    </svg>
  );
}

/** the toolbar's own icon: a plate half painted, half see-through */
export function TransparencyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <pattern id="banner-transparency-check" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="rgba(255,255,255,.18)" />
          <rect width="2" height="2" fill="rgba(255,255,255,.42)" />
          <rect x="2" y="2" width="2" height="2" fill="rgba(255,255,255,.42)" />
        </pattern>
      </defs>
      <rect x="2.2" y="4.6" width="15.6" height="10.8" rx="3" fill="url(#banner-transparency-check)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 5.3h5a1.7 1.7 0 0 1 1.7 1.7v6a1.7 1.7 0 0 1-1.7 1.7h-5z" fill="currentColor" />
    </svg>
  );
}

/** the toolbar's own icon: a plate with its size handles */
export function SizeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.4" y="5.4" width="13.2" height="9.2" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.85" />
      <path d="M1.6 10h3.4M15 10h3.4M10 1.8v2.6M10 15.6v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 10 5 8.4M3 10l2 1.6M17 10l-2-1.6M17 10l-2 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** the toolbar's own icon: a plate with the four move arrows */
export function PositionIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5.6" y="6.2" width="8.8" height="7.6" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="5.6" y="6.2" width="8.8" height="7.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 1.6v3M10 15.4v3M1.6 10h3M15.4 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.6 3 10 1.6 11.4 3M8.6 17 10 18.4 11.4 17M3 8.6 1.6 10 3 11.4M17 8.6 18.4 10 17 11.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Design presets                                                     */
/* ------------------------------------------------------------------ */

/** one preset drawn as the plate it paints, at thumbnail scale */
export function BannerPresetTile({ preset, theme, active, onClick }: { preset: BannerPreset; theme: ThemeSettings; active?: boolean; onClick: () => void }) {
  const merged: BannerSettings = { ...DEFAULT_BANNER, ...bannerOf(theme), ...preset.banner, color: preset.banner.color ?? bannerOf(theme).color };
  // a preset paints the whole plate: the tile shows its own colour / gradient,
  // never a special fill (glass · metallic · pattern) the plate happens to wear
  const css = bannerCss({ ...merged, fillMode: undefined, size: undefined, pos: undefined, halo: 0 }, theme.titleColor);
  // the thumbnail lays the plate out itself, so the stage's own box is replaced
  // here — the layers wear the very same replacement, which is why their offsets
  // are percentages of the plate rather than px of the board
  const thumb: CSSProperties = { left: "8%", top: "22%", width: "84%", height: "56%" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Banner preset: ${preset.name}`}
      aria-pressed={!!active}
      title={preset.name}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors",
        active ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
      )}
    >
      <span className="relative block h-6 w-full overflow-hidden rounded border border-white/10" style={{ background: theme.board }}>
        {css.halo ? <span className="absolute block" style={{ ...css.halo, left: "8%", top: "-10%", width: "84%", height: "120%", transform: undefined, filter: "none" }} /> : null}
        {css.layers.map((l, i) => (
          <span key={i} className="absolute block" data-banner-layer={i} style={{ ...l, ...thumb }} />
        ))}
        <span className="absolute block" style={{ ...css.box, ...thumb }} />
        {css.border ? <span className="absolute block" style={{ ...css.border, ...thumb }} /> : null}
      </span>
      <span className="truncate">{preset.name}</span>
    </button>
  );
}

/**
 * Is the plate wearing exactly this look right now? The silhouette has to match,
 * and then the paint — the preset's gradient, stop for stop, or its solid colour
 * when it brings no gradient.
 */
export function presetActive(banner: BannerSettings, p: BannerPreset): boolean {
  // a special paint (glass · metallic · pattern) hides every preset's paint
  const mode = bannerFillMode(banner);
  if (mode === "glass" || mode === "metallic" || mode === "pattern") return false;
  if (banner.shape !== (p.banner.shape ?? banner.shape)) return false;
  const want = p.banner.gradient;
  if (want?.enabled) {
    const now = banner.gradient;
    return (
      now.enabled &&
      now.type === want.type &&
      now.angle === want.angle &&
      now.stops.length === want.stops.length &&
      now.stops.every((s, i) => s.color === want.stops[i]?.color && s.at === want.stops[i]?.at)
    );
  }
  return !!p.banner.color && p.banner.color === banner.color;
}

/** what each group heading says next to its own name */
const PRESET_GROUP_HINT: Record<BannerPresetGroup, string> = {
  Classic: "the factory looks",
  Broadcast: "dark stages, gilded type",
  "Chalk & parchment": "board and paper",
  "Teal current": "navy on teal",
  "Campus blue": "lecture header bars",
  "Merit & highlighter": "admission circuit",
  "Seminar shelf": "seminar classics",
  "Stylish shapes": "cut silhouettes",
  "Multilayer shapes": "plate + layers",
  "Multilayer gradient": "stacked paints",
};

export function BannerPresetPanel({ theme, banner, setBanner }: BannerProps) {
  const inUse = BANNER_PRESETS.find((p) => presetActive(banner, p));
  return (
    <div className="space-y-3" data-banner-presets="">
      <Cap hint={inUse ? inUse.name : `${BANNER_PRESETS.length} looks · ${BANNER_PRESET_GROUPS.length} groups`}>Design presets</Cap>
      {BANNER_PRESET_GROUPS.map((g) => {
        const looks = BANNER_PRESETS.filter((p) => p.group === g);
        if (!looks.length) return null;
        return (
          <div key={g} className="space-y-1.5" data-banner-preset-group={g}>
            <div className="flex items-baseline justify-between gap-2 border-t border-white/5 pt-1.5">
              <span className="text-[10px] font-semibold text-slate-300">{g}</span>
              <span className="text-[9.5px] font-normal text-slate-500">{PRESET_GROUP_HINT[g]}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {looks.map((p) => (
                <BannerPresetTile key={p.name} preset={p} theme={theme} active={presetActive(banner, p)} onClick={() => setBanner(bannerPresetPatch(banner, p))} />
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-slate-500">
        A preset repaints the plate and hands its size and place back to auto — the heading itself is never touched. The last
        three groups are the <b>shape styles</b>: cut silhouettes, plates with layers of their own, and plates painted from
        several stacked gradients.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shape                                                              */
/* ------------------------------------------------------------------ */

/**
 * One miniature board: the plate exactly as `bannerCss` paints it, shrunk into
 * a tile, so a preview shows the real thing — the silhouette, the paint (solid
 * or gradient), the multilayer plates' own layers, the outline and whatever the
 * Effects card has dressed it with, shadows and glows reaching outside the body
 * included. The miniature keeps the board's proportions: the plate fills the
 * stage (`size` × `shrink`), and an effect's px offsets, blurs and slabs shrink
 * with it, so a tile that says "Long shadow" looks like the long shadow the
 * slide will paint.
 *
 * `preview` dresses the plate for the tile (another silhouette, one effect
 * group) without touching the deck; `standIn` is the silhouette to paint when
 * the plate wears none at all, so an effect still has a body to dress.
 */
export function BannerPlatePreview({
  banner,
  theme,
  preview,
  standIn,
  size = { w: 260, h: 40 },
  shrink = 0.26,
  height,
  background = "#0b1220",
  className,
}: {
  banner: BannerSettings;
  theme: ThemeSettings;
  preview?: Partial<BannerSettings>;
  /** the silhouette to stand in when the deck paints no plate at all */
  standIn?: BannerShape;
  /** the miniature board, in CSS px — the plate is laid out on it as on the stage */
  size?: { w: number; h: number };
  /** how far that board is shrunk into the tile */
  shrink?: number;
  /** the frame's height — room for what an effect throws outside the plate */
  height?: number;
  background?: string;
  className?: string;
}) {
  const shape: BannerShape = banner.shape === "none" && standIn ? standIn : banner.shape;
  // the plate at its automatic box with no room around the (unseen) heading:
  // the stage is the plate, so a tile's plate is `size` × `shrink` and nothing
  // about the free size or the nudge leaks into a thumbnail
  const b: BannerSettings = { ...banner, shape, size: undefined, pos: undefined, padX: 0, padY: 0, halo: 0, ...preview };
  const css = bannerCss({ ...b, border: { ...b.border, enabled: canOutline(shape) && b.border.enabled } }, theme.titleColor);
  // a round or freehand silhouette stretches its own frame — the same factor the
  // board applies — so a circle tile stays round instead of being squashed
  const tall = plateHeightFactor(shape);
  return (
    <span
      aria-hidden="true"
      data-banner-preview={shape}
      className={cn("relative block overflow-hidden rounded", className)}
      style={{ width: "100%", height: height ?? Math.round(size.h * tall * shrink) + 16, background }}
    >
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: size.w,
          height: size.h,
          transform: `translate(-50%, -50%) scale(${shrink})`,
        }}
      >
        {css.halo ? <span style={css.halo} /> : null}
        {css.layers.map((l, i) => (
          <span key={`fx-layer-${i}`} data-banner-layer={i} style={l} />
        ))}
        <span data-banner-plate="" style={css.box} />
        {css.border ? <span style={css.border} /> : null}
        {css.overlays.map((l, i) => (
          <span key={`fx-overlay-${i}`} data-banner-overlay={i} style={l} />
        ))}
      </span>
    </span>
  );
}

/** one silhouette drawn with the plate's own paint, so the tiles read true */
function ShapeTile({ shape, banner, theme, chosen, onPick }: { shape: BannerShape; banner: BannerSettings; theme: ThemeSettings; chosen: boolean; onPick: () => void }) {
  const def = BANNER_SHAPES.find((s) => s.id === shape)!;
  // every tile shows the deck's real line, the chosen one included: only the
  // silhouette changes from tile to tile
  const css = bannerCss({ ...banner, shape, size: undefined, pos: undefined, halo: 0, border: { ...banner.border, enabled: canOutline(shape) && banner.border.enabled } }, theme.titleColor);
  // the silhouette's own height factor (circle, oval, blobs, strokes…) rules
  // the thumbnail frame too, so a tile shows the shape at its real proportion —
  // clamped to the tile, centred on the line the chip would sit on
  const f = plateHeightFactor(shape);
  const hPct = Math.min(48 * f, 92);
  const frame: CSSProperties = { position: "absolute", left: "6%", top: `${((100 - hPct) / 2).toFixed(2)}%`, width: "88%", height: `${hPct.toFixed(2)}%` };
  return (
    <button
      type="button"
      role="option"
      aria-selected={chosen}
      aria-label={`Banner shape: ${def.label}`}
      title={def.hint}
      onClick={onPick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-colors",
        chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
      )}
    >
      <span className="relative block h-7 w-full overflow-hidden rounded bg-[#0b1220]">
        {/* the multilayer silhouettes' own layers ride behind the body, exactly
            as they do on the board — the tile paints the real thing, not a mark */}
        {css.box.display !== "none"
          ? css.layers.map((l, i) => <span key={i} className="absolute block" data-banner-layer={i} style={{ ...l, ...frame }} />)
          : null}
        {css.box.display !== "none" ? <span className="absolute block" style={{ ...css.box, ...(shape === "underline" ? { left: "6%", bottom: "22%", width: "88%" } : frame) }} /> : null}
        {css.border ? <span className="absolute block" style={{ ...css.border, ...(shape === "underline" ? {} : frame) }} /> : null}
      </span>
      <span className="text-[9.5px] font-medium leading-none">{def.label}</span>
    </button>
  );
}

export function BannerShapePanel({ theme, banner, setBanner }: BannerProps) {
  const current = BANNER_SHAPES.find((s) => s.id === banner.shape);
  return (
    <div className="space-y-2" data-banner-shapes="">
      <Cap hint={current?.hint}>Shape</Cap>
      <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label="Banner shape">
        {BANNER_SHAPE_GROUPS.map((g) => [
          <div key={`${g.name}-head`} className="col-span-4 flex items-baseline justify-between gap-2 border-t border-white/5 pt-1.5">
            <span className="text-[10px] font-semibold text-slate-300">{g.name}</span>
            <span className="truncate text-[9.5px] font-normal text-slate-500">{g.hint}</span>
          </div>,
          ...g.shapes.map((s) => (
            <ShapeTile key={s.id} shape={s.id} banner={banner} theme={theme} chosen={banner.shape === s.id} onPick={() => setBanner({ shape: s.id })} />
          )),
        ])}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        The first eight groups are the shape library — <b>Basic &amp; Clean</b>, <b>Banner Style</b>, <b>Cut &amp; Corner</b>,{" "}
        <b>Modern</b>, <b>Curved &amp; Wave</b>, <b>Organic / Decorative</b>, <b>Decorative / Highlight</b> and{" "}
        <b>Premium / Special</b>. <b>Glow</b> is a soft light and <b>Underline</b> a rule under the heading; everything else
        is a real plate an outline can follow — the cut silhouettes are sliced by a clip-path, the curved and the freehand
        ones by a mask that keeps their waves and blobs, the <b>multilayer</b> ones paint plates of their own behind the
        body, and the <b>multilayer gradient</b> ones stack several paints on the one body.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

/**
 * One group's tiles: the "None" tile plus one tile per effect. Each tile is not
 * a mark but the plate itself — the deck's own silhouette and paint, wearing
 * that effect — so the strip reads the way the Shape card's tiles do and the
 * same way a text background's Effects strip previews its plate. `dress` hands
 * back the effects the tile is trying on (the group off for "None"), and the
 * tile paints them: what the tile shows is what the slide paints, in the
 * plate's own colour.
 */
function FxTiles<K extends string>({
  prefix,
  defs,
  active,
  onPick,
  onClear,
  theme,
  banner,
  dress,
}: {
  prefix: string;
  defs: BannerEffectDef<K>[];
  active: K | undefined;
  onPick: (kind: K) => void;
  onClear: () => void;
  theme: ThemeSettings;
  banner: BannerSettings;
  /** the plate this tile is trying on — the group's effect dressed, or the group off */
  dress: (kind: K | undefined) => BannerEffects;
}) {
  const tile = (selected: boolean) =>
    cn(
      "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center transition-colors",
      selected ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
    );
  /** the plate as this tile wants it — nothing but the body's own paint when the group is off */
  const plate = (kind: K | undefined) => (
    <BannerPlatePreview banner={banner} theme={theme} standIn="rect" preview={{ effects: dress(kind) }} />
  );
  return (
    <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label={prefix}>
      <button
        type="button"
        role="option"
        aria-selected={active === undefined}
        aria-label={`${prefix}: None`}
        title="Turn this category off"
        onClick={onClear}
        className={tile(active === undefined)}
      >
        {plate(undefined)}
        <span className="text-[9px] font-medium leading-tight">None</span>
      </button>
      {defs.map((d) => (
        <button
          key={d.kind}
          type="button"
          role="option"
          aria-selected={active === d.kind}
          aria-label={`${prefix}: ${d.label}`}
          title={d.hint}
          onClick={() => onPick(d.kind)}
          className={tile(active === d.kind)}
        >
          {plate(d.kind)}
          <span className="text-[9px] font-medium leading-tight">{d.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * One **category** of the Effects card: its heading and what its Type row says,
 * then whatever the caller paints inside — the family's tiles and, when one is
 * chosen, that effect's own controls and colour.
 */
function FxGroup({
  group,
  title,
  type,
  state,
  children,
}: {
  /** the `data-banner-fx-group` name a reader (and a test) finds the category by */
  group: string;
  title: string;
  /** what this category's **Type** control offers */
  type: string;
  /** what is on at the moment, for the heading's hint */
  state: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-3" data-banner-fx-group={group}>
      <Cap hint={state}>{title}</Cap>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Type</span>
        <span className="text-[10px] text-slate-400">{type}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * The plate's **Effects** card — the "Banner effects" button of the Title
 * background line. The plate's own softness, halo and shimmer lead, and then
 * one section per **category**, the way a design tool files its effects:
 *
 *   Shadow      twelve shadows, dressed by X · Y · Blur · Spread · Opacity · Colour
 *   Glow        eight lights, by Type · Blur · Intensity · Colour
 *   Blur        eight blurs, by Type · Blur · Intensity · Direction · Colour
 *   Glass       seven panes, by Type · Blur · Intensity · Tint
 *   Bevel       seven edges, by Type · Depth · Blur · Angle · Colour
 *   3D          nine depths, by Type · Depth · Blur · Angle · Colour
 *   Highlight   ten lights, by Type · Blur · Intensity · Angle · Colour
 *   Decorations the patterns, the textures and the accents, by Type · Intensity · Colour
 *   Finishes    the modern surface treatments, by Type · Intensity · Blur · Tint
 *   Shape       the corners (shared or four of their own) and the plate's own
 *               distortions — stretch, wave, curve, slant, skew, rotation and
 *               the two flips
 *
 * **Type** is the family's own list — one effect of that family at a time, the
 * way a design tool's Type row behaves. (The decorations are the one family
 * that stacks, and every one of them is a type; the Shape card's distortions
 * stack too.) Switching type keeps the numbers the two effects share, so a
 * shadow's Blur is still a glow's Blur.
 *
 * Every channel falls back to off, so an untouched deck renders exactly as it
 * always did, and every colour channel falls back to the SAME colour: the
 * shape's own paint (`bannerFxColor`) — the plate's solid colour, or its
 * gradient's first stop. An effect never brings a colour of its own to the
 * party; it wears what the plate wears, and repaint the plate and every effect
 * left on Auto follows it, the way a text background's plate does. The tiles
 * say so: each one is the deck's own plate painted with that effect on, in the
 * plate's own colour — the same preview language the Shape card's tiles and the
 * text background's Effects strip speak.
 *
 * A deck written before the categories is read through `bannerEffectsOf`, which
 * folds its old `depth`, `modern`, `glow`, `decor` and `common` groups into the
 * category each effect belongs to — so an old deck opens with its effect already
 * selected in the right place, and this card never writes the old groups again.
 */
export function BannerEffectsPanel({ theme, banner, setBanner, documentColors }: BannerProps) {
  const fx = bannerEffectsOf(banner);
  const setFx = (patch: Partial<BannerEffects>) => setBanner({ effects: { ...fx, ...patch } });
  const setShape = (patch: Partial<BannerShapeFx>) => setBanner({ effects: { ...fx, shape: { ...fx.shape, ...patch } } });
  /** every effect's auto colour — the shape's own paint, the plate keeps it in step */
  const shapeColor = bannerFxColor(banner);
  /** a tile's preview: the plate wearing one effect of this group (undefined = the group off) */
  const dress = <G extends keyof BannerEffects>(key: G, on: BannerEffects[G]) => ({ ...fx, [key]: on } as BannerEffects);
  /** the deck's own colour first in every well, so an effect can wear it back */
  const swatches = (...extra: string[]) => Array.from(new Set([shapeColor, ...extra]));
  /** the pop-up's document row: the deck's colours, the shape's own, then this channel's classics */
  const docColors = (...extra: string[]) =>
    Array.from(new Set([...(documentColors ?? []), ...swatches(...extra)].map((c) => String(c || "").toLowerCase()))).filter((c) =>
      /^#[0-9a-f]{6}$/.test(c),
    );
  /**
   * One colour channel of one effect group, as the button that opens the
   * colour pop-up (Solid colour · Gradient · Auto) — the user asked every
   * colour under Title background to open the same two-tab card.
   */
  const fxPaint = (
    key: "shadow" | "glow" | "blur" | "glass" | "bevel" | "threeD" | "highlight" | "decor" | "modern",
    label: string,
    group: { color: string; gradient?: Gradient },
    ...extra: string[]
  ) => (
    <PaintPopoverField
      label={label}
      hint={group.color || group.gradient?.enabled ? undefined : "the shape's colour"}
      value={group.color}
      gradient={group.gradient}
      fallback={shapeColor}
      documentColors={docColors(...extra)}
      onSolid={(v) => setFx({ [key]: { ...group, color: v, gradient: gradOff(group.gradient) } } as Partial<BannerEffects>)}
      onGradient={(gr) => setFx({ [key]: { ...group, gradient: gr } } as Partial<BannerEffects>)}
      onClearGradient={() => setFx({ [key]: { ...group, gradient: gradOff(group.gradient) } } as Partial<BannerEffects>)}
      onAuto={() => setFx({ [key]: { ...group, color: "", gradient: gradOff(group.gradient) } } as Partial<BannerEffects>)}
      autoHint="Auto — follow the shape's colour"
    />
  );
  const s = fx.shadow;
  const g = fx.glow;
  const b = fx.blur;
  const gl = fx.glass;
  const bv = fx.bevel;
  const d = fx.threeD;
  const h = fx.highlight;
  const m = fx.modern;
  const dc = fx.decor;
  const t = fx.shape;
  const label = <K extends string>(defs: BannerEffectDef<K>[], kind: K | undefined) => defs.find((e) => e.kind === kind)?.label ?? "on";
  return (
    <div className="space-y-4" data-banner-effects="">
      <Cap hint={banner.shape === "glow" ? "the glow's softness" : "glow silhouettes only"}>Effects</Cap>
      <Field label="Softness" hint={`${banner.glow}`}>
        <div className={cn(banner.shape !== "glow" && "opacity-50")}>
          <Slider min={0} max={100} value={banner.glow} onChange={(v) => setBanner({ glow: v })} ariaLabel="Banner softness" />
        </div>
      </Field>
      <Field label="Outer halo" hint={banner.halo ? `${banner.halo}` : "off"}>
        <Slider min={0} max={100} value={banner.halo} onChange={(v) => setBanner({ halo: v })} ariaLabel="Banner halo" />
      </Field>
      <Toggle label="Shimmer animation (screen only)" checked={banner.shimmer} onChange={(v) => setBanner({ shimmer: v })} />

      {/* -------------------------------- shadow ---------------------------- */}
      <FxGroup
        group="shadow"
        title="Shadow"
        type="one of twelve · Drop · Soft · Hard · Long · Inner · Floating · Offset · Coloured · Double · Surround · Layered · Cast"
        state={s ? label(BANNER_SHADOW_EFFECTS, s.kind) : "off"}
      >
        <FxTiles
          prefix="Banner shadow"
          defs={BANNER_SHADOW_EFFECTS}
          active={s?.kind}
          onPick={(kind) =>
            setFx({
              shadow: {
                kind,
                // the shadow starts on Auto colour — the plate's own paint, so the
                // tile the deck picks and the shadow it throws are one colour story
                ...BANNER_SHADOW_DEFAULTS[kind],
                ...(kind === "colored" ? { color: s?.color || "" } : {}),
              },
            })
          }
          onClear={() => setFx({ shadow: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("shadow", kind === undefined ? undefined : s && s.kind === kind ? s : { kind, ...BANNER_SHADOW_DEFAULTS[kind], color: s?.color || "" })}
        />
        {s && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Field label="X">
                <Slider min={-200} max={200} step={1} value={s.x} onChange={(v) => setFx({ shadow: { ...s, x: v } })} ariaLabel="Banner fx: shadow X (px)" />
              </Field>
              <Field label="Y">
                <Slider min={-200} max={200} step={1} value={s.y} onChange={(v) => setFx({ shadow: { ...s, y: v } })} ariaLabel="Banner fx: shadow Y (px)" />
              </Field>
              <Field label="Blur">
                <Slider min={0} max={120} step={1} value={s.blur} onChange={(v) => setFx({ shadow: { ...s, blur: v } })} ariaLabel="Banner fx: shadow blur (px)" />
              </Field>
              <Field label="Spread">
                <Slider min={-60} max={120} step={1} value={s.spread} onChange={(v) => setFx({ shadow: { ...s, spread: v } })} ariaLabel="Banner fx: shadow spread (px)" />
              </Field>
              <Field label="Opacity %">
                <Slider min={0} max={100} step={1} value={s.opacity} onChange={(v) => setFx({ shadow: { ...s, opacity: v } })} ariaLabel="Banner fx: shadow opacity (%)" />
              </Field>
            </div>
            {fxPaint("shadow", "Shadow colour", s, "#000000", "#1f5fd0", "#7c3aed", "#b91c1c", "#059669", "#b45309")}
          </div>
        )}
      </FxGroup>

      {/* --------------------------------- glow ------------------------------ */}
      <FxGroup
        group="glow"
        title="Glow"
        type="one of eight · Outer · Inner · Neon · Soft · Halo · Backlight · Aurora · Outline"
        state={g ? label(BANNER_GLOW_EFFECTS, g.kind) : "off"}
      >
        <FxTiles
          prefix="Banner glow"
          defs={BANNER_GLOW_EFFECTS}
          active={g?.kind}
          onPick={(kind) => setFx({ glow: { kind, ...BANNER_GLOW_DEFAULTS[kind], color: g?.color || "" } })}
          onClear={() => setFx({ glow: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("glow", kind === undefined ? undefined : g && g.kind === kind ? g : { kind, ...BANNER_GLOW_DEFAULTS[kind], color: g?.color || "" })}
        />
        {g && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Intensity" hint={`${g.intensity}`}>
              <Slider min={0} max={100} step={1} value={g.intensity} onChange={(v) => setFx({ glow: { ...g, intensity: v } })} ariaLabel="Banner fx: glow intensity" />
            </Field>
            <Field label="Blur" hint={`${g.blur}px`}>
              <Slider min={0} max={60} step={1} value={g.blur} onChange={(v) => setFx({ glow: { ...g, blur: v } })} ariaLabel="Banner fx: glow blur (px)" />
            </Field>
            {fxPaint("glow", "Glow colour", g, "#ffffff", "#ffd633", "#22d3ee", "#a78bfa", "#f472b6", "#4ade80")}
          </div>
        )}
      </FxGroup>

      {/* --------------------------------- blur ------------------------------ */}
      <FxGroup
        group="blur"
        title="Blur"
        type="one of eight · Soft · Gaussian · Backdrop · Motion · Zoom · Feather · Bloom · Frosted"
        state={b ? label(BANNER_BLUR_EFFECTS, b.kind) : "off"}
      >
        <FxTiles
          prefix="Banner blur"
          defs={BANNER_BLUR_EFFECTS}
          active={b?.kind}
          onPick={(kind) => setFx({ blur: { kind, ...BANNER_BLUR_DEFAULTS[kind], color: b?.color || "" } })}
          onClear={() => setFx({ blur: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("blur", kind === undefined ? undefined : b && b.kind === kind ? b : { kind, ...BANNER_BLUR_DEFAULTS[kind], color: b?.color || "" })}
        />
        {b && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Blur" hint={`${b.blur}px`}>
              <Slider min={0} max={48} step={1} value={b.blur} onChange={(v) => setFx({ blur: { ...b, blur: v } })} ariaLabel="Banner fx: blur amount (px)" />
            </Field>
            <Field label="Intensity" hint={`${b.intensity}`}>
              <Slider min={0} max={100} step={1} value={b.intensity} onChange={(v) => setFx({ blur: { ...b, intensity: v } })} ariaLabel="Banner fx: blur intensity" />
            </Field>
            <Field label="Direction °" hint={`${b.angle}°`}>
              <Slider min={-180} max={180} step={1} value={b.angle} onChange={(v) => setFx({ blur: { ...b, angle: v } })} ariaLabel="Banner fx: blur direction (deg)" />
            </Field>
            {fxPaint("blur", "Blur colour", b, "#ffffff", "#000000", "#22d3ee", "#a78bfa", "#f472b6", "#94a3b8")}
          </div>
        )}
      </FxGroup>

      {/* --------------------------------- glass ----------------------------- */}
      <FxGroup
        group="glass"
        title="Glass"
        type="one of seven · Glassmorphism · Frosted · Acrylic · Blur background · Transparent · Tinted · Glass edge"
        state={gl ? label(BANNER_GLASS_EFFECTS, gl.kind) : "off"}
      >
        <FxTiles
          prefix="Banner glass"
          defs={BANNER_GLASS_EFFECTS}
          active={gl?.kind}
          onPick={(kind) => setFx({ glass: { kind, ...BANNER_GLASS_DEFAULTS[kind], color: gl?.color || "" } })}
          onClear={() => setFx({ glass: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("glass", kind === undefined ? undefined : gl && gl.kind === kind ? gl : { kind, ...BANNER_GLASS_DEFAULTS[kind], color: gl?.color || "" })}
        />
        {gl && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Blur" hint={`${gl.blur}px`}>
              <Slider min={0} max={40} step={1} value={gl.blur} onChange={(v) => setFx({ glass: { ...gl, blur: v } })} ariaLabel="Banner fx: glass blur (px)" />
            </Field>
            <Field label="Intensity" hint={`${gl.intensity}`}>
              <Slider min={0} max={100} step={1} value={gl.intensity} onChange={(v) => setFx({ glass: { ...gl, intensity: v } })} ariaLabel="Banner fx: glass intensity" />
            </Field>
            {fxPaint("glass", "Glass tint", gl, "#ffffff", "#93c5fd", "#a5f3fc", "#d8b4fe", "#fbcfe8", "#0b0b0f")}
            <p className="text-[10px] leading-relaxed text-slate-500">
              The glass family blurs the board through the plate in the browser; exports carry the tint and the rim instead.
            </p>
          </div>
        )}
      </FxGroup>

      {/* --------------------------------- bevel ----------------------------- */}
      <FxGroup
        group="bevel"
        title="Bevel"
        type="one of seven · Bevel · Inner · Outer · Emboss · Ridge · Groove · Pillow"
        state={bv ? label(BANNER_BEVEL_EFFECTS, bv.kind) : "off"}
      >
        <FxTiles
          prefix="Banner bevel"
          defs={BANNER_BEVEL_EFFECTS}
          active={bv?.kind}
          onPick={(kind) => setFx({ bevel: { kind, ...BANNER_BEVEL_DEFAULTS[kind], color: bv?.color || "" } })}
          onClear={() => setFx({ bevel: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("bevel", kind === undefined ? undefined : bv && bv.kind === kind ? bv : { kind, ...BANNER_BEVEL_DEFAULTS[kind], color: bv?.color || "" })}
        />
        {bv && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Depth" hint={`${bv.intensity}`}>
              <Slider min={0} max={100} step={1} value={bv.intensity} onChange={(v) => setFx({ bevel: { ...bv, intensity: v } })} ariaLabel="Banner fx: bevel depth" />
            </Field>
            <Field label="Blur" hint={`${bv.blur}px`}>
              <Slider min={0} max={24} step={1} value={bv.blur} onChange={(v) => setFx({ bevel: { ...bv, blur: v } })} ariaLabel="Banner fx: bevel blur (px)" />
            </Field>
            <Field label="Angle °" hint={`${bv.angle}°`}>
              <Slider min={0} max={360} step={5} value={bv.angle} onChange={(v) => setFx({ bevel: { ...bv, angle: v } })} ariaLabel="Banner fx: bevel angle (deg)" />
            </Field>
            {fxPaint("bevel", "Bevel colour", bv, "#ffffff", "#000000", "#ffd633", "#22d3ee", "#a78bfa", "#94a3b8")}
            <p className="text-[10px] leading-relaxed text-slate-500">
              0° is light from straight above; walk the angle round and the bevel's lit edge follows it.
            </p>
          </div>
        )}
      </FxGroup>

      {/* ---------------------------------- 3D ------------------------------- */}
      <FxGroup
        group="threeD"
        title="3D"
        type="one of nine · Extrusion · Depth · Layered · Perspective · Tilt · Pop out · Raised · Pressed · Isometric"
        state={d ? label(BANNER_3D_EFFECTS, d.kind) : "off"}
      >
        <FxTiles
          prefix="Banner 3D"
          defs={BANNER_3D_EFFECTS}
          active={d?.kind}
          onPick={(kind) => setFx({ threeD: { kind, ...BANNER_3D_DEFAULTS[kind], color: d?.color || "" } })}
          onClear={() => setFx({ threeD: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("threeD", kind === undefined ? undefined : d && d.kind === kind ? d : { kind, ...BANNER_3D_DEFAULTS[kind], color: d?.color || "" })}
        />
        {d && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Depth" hint={`${d.intensity}`}>
              <Slider min={0} max={100} step={1} value={d.intensity} onChange={(v) => setFx({ threeD: { ...d, intensity: v } })} ariaLabel="Banner fx: 3D depth" />
            </Field>
            <Field label="Blur" hint={`${d.blur}px`}>
              <Slider min={0} max={40} step={1} value={d.blur} onChange={(v) => setFx({ threeD: { ...d, blur: v } })} ariaLabel="Banner fx: 3D blur (px)" />
            </Field>
            <Field label="Angle °" hint={`${d.angle}°`}>
              <Slider min={0} max={360} step={5} value={d.angle} onChange={(v) => setFx({ threeD: { ...d, angle: v } })} ariaLabel="Banner fx: 3D angle (deg)" />
            </Field>
            {fxPaint("threeD", "3D colour", d, "#000000", "#ffffff", "#1f5fd0", "#7c3aed", "#059669", "#b91c1c")}
            <p className="text-[10px] leading-relaxed text-slate-500">
              The slabs and the shadows are the shape's own paint, shaded; the turns (Perspective · Tilt · Pop out) leave the paint alone
              and tip the plate in space. 90° runs the depth straight down, 0° straight up.
            </p>
          </div>
        )}
      </FxGroup>

      {/* ------------------------------ highlight ---------------------------- */}
      <FxGroup
        group="highlight"
        title="Highlight"
        type="one of ten · Highlight · Inner · Outer · Edge · Gloss · Sheen · Shine · Reflection · Spotlight · Rim light"
        state={h ? label(BANNER_HIGHLIGHT_EFFECTS, h.kind) : "off"}
      >
        <FxTiles
          prefix="Banner highlight"
          defs={BANNER_HIGHLIGHT_EFFECTS}
          active={h?.kind}
          onPick={(kind) => setFx({ highlight: { kind, ...BANNER_HIGHLIGHT_DEFAULTS[kind], color: h?.color || "" } })}
          onClear={() => setFx({ highlight: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("highlight", kind === undefined ? undefined : h && h.kind === kind ? h : { kind, ...BANNER_HIGHLIGHT_DEFAULTS[kind], color: h?.color || "" })}
        />
        {h && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Intensity" hint={`${h.intensity}`}>
              <Slider min={0} max={100} step={1} value={h.intensity} onChange={(v) => setFx({ highlight: { ...h, intensity: v } })} ariaLabel="Banner fx: highlight intensity" />
            </Field>
            <Field label="Blur" hint={`${h.blur}px`}>
              <Slider min={0} max={40} step={1} value={h.blur} onChange={(v) => setFx({ highlight: { ...h, blur: v } })} ariaLabel="Banner fx: highlight blur (px)" />
            </Field>
            <Field label="Angle °" hint={`${h.angle}°`}>
              <Slider min={0} max={360} step={5} value={h.angle} onChange={(v) => setFx({ highlight: { ...h, angle: v } })} ariaLabel="Banner fx: highlight angle (deg)" />
            </Field>
            {fxPaint("highlight", "Highlight colour", h, "#ffffff", "#ffd633", "#22d3ee", "#f472b6", "#a78bfa", "#000000")}
            <p className="text-[10px] leading-relaxed text-slate-500">
              0° lays the light on from the top edge, 90° from the right — walk the angle and the sheen follows it.
            </p>
          </div>
        )}
      </FxGroup>

      {/* ----------------------------- decorations --------------------------- */}
      <FxGroup
        group="decor"
        title="Decorations"
        type="one of twenty-two · patterns · textures · accents · the two fades"
        state={dc ? label(BANNER_DECOR_EFFECTS, dc.kind) : "off"}
      >
        <FxTiles
          prefix="Banner decor"
          defs={BANNER_DECOR_EFFECTS}
          active={dc?.kind}
          onPick={(kind) => setFx({ decor: { kind, ...BANNER_DECOR_DEFAULT, color: dc?.color || "" } })}
          onClear={() => setFx({ decor: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("decor", kind === undefined ? undefined : dc && dc.kind === kind ? dc : { kind, ...BANNER_DECOR_DEFAULT, color: dc?.color || "" })}
        />
        {dc && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Intensity" hint={`${dc.intensity}`}>
              <Slider min={0} max={100} step={1} value={dc.intensity} onChange={(v) => setFx({ decor: { ...dc, intensity: v } })} ariaLabel="Banner fx: decorative intensity" />
            </Field>
            {fxPaint("decor", "Decorative colour", dc, "#ffffff", "#000000", "#ffd633", "#22d3ee", "#f472b6", "#94a3b8")}
          </div>
        )}
      </FxGroup>

      {/* ------------------------------- finishes ---------------------------- */}
      <FxGroup
        group="modern"
        title="Finishes"
        type="one of seven · grain · soft gradient · mesh · holographic · metallic · duotone · soft UI"
        state={m ? label(BANNER_MODERN_EFFECTS, m.kind) : "off"}
      >
        <FxTiles
          prefix="Banner modern"
          defs={BANNER_MODERN_EFFECTS}
          active={m?.kind}
          onPick={(kind) => setFx({ modern: { kind, ...BANNER_MODERN_DEFAULT, color: m?.color || "" } })}
          onClear={() => setFx({ modern: undefined })}
          theme={theme}
          banner={banner}
          dress={(kind) => dress("modern", kind === undefined ? undefined : m && m.kind === kind ? m : { kind, ...BANNER_MODERN_DEFAULT, color: m?.color || "" })}
        />
        {m && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Intensity" hint={`${m.intensity}`}>
              <Slider min={0} max={100} step={1} value={m.intensity} onChange={(v) => setFx({ modern: { ...m, intensity: v } })} ariaLabel="Banner fx: modern intensity" />
            </Field>
            <Field label="Blur" hint={`${m.blur}px`}>
              <Slider min={0} max={40} step={1} value={m.blur} onChange={(v) => setFx({ modern: { ...m, blur: v } })} ariaLabel="Banner fx: modern blur (px)" />
            </Field>
            {fxPaint("modern", "Finish tint", m, "#ffffff", "#93c5fd", "#a5f3fc", "#d8b4fe", "#fbcfe8", "#0b0b0f")}
          </div>
        )}
      </FxGroup>

      {/* ----------------------------- shape effects ------------------------ */}
      <div className="space-y-2 border-t border-white/10 pt-3" data-banner-fx-group="shape">
        <Cap
          hint={
            t.independent
              ? "four corners of their own"
              : t.radius > 0
                ? `${t.radius}px`
                : "the plate's own body"
          }
        >
          Shape Effects
        </Cap>
        <Field label="Corner radius" hint={t.radius > 0 ? `${t.radius}px` : "the plate's own"}>
          <Slider min={0} max={120} step={1} value={t.radius} onChange={(v) => setShape({ radius: v })} ariaLabel="Banner fx: corner radius (px)" />
        </Field>
        <Toggle label="Independent corner radius" checked={t.independent} onChange={(v) => setShape({ independent: v })} />
        {t.independent && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Field label="Top left" hint={`${t.cornerTL}px`}>
              <Slider min={0} max={120} step={1} value={t.cornerTL} onChange={(v) => setShape({ cornerTL: v })} ariaLabel="Banner fx: corner top-left (px)" />
            </Field>
            <Field label="Top right" hint={`${t.cornerTR}px`}>
              <Slider min={0} max={120} step={1} value={t.cornerTR} onChange={(v) => setShape({ cornerTR: v })} ariaLabel="Banner fx: corner top-right (px)" />
            </Field>
            <Field label="Bottom right" hint={`${t.cornerBR}px`}>
              <Slider min={0} max={120} step={1} value={t.cornerBR} onChange={(v) => setShape({ cornerBR: v })} ariaLabel="Banner fx: corner bottom-right (px)" />
            </Field>
            <Field label="Bottom left" hint={`${t.cornerBL}px`}>
              <Slider min={0} max={120} step={1} value={t.cornerBL} onChange={(v) => setShape({ cornerBL: v })} ariaLabel="Banner fx: corner bottom-left (px)" />
            </Field>
          </div>
        )}
        <Field label="Shape distortion" hint={t.distortion ? `${t.distortion > 0 ? "+" : ""}${t.distortion}` : "even"}>
          <Slider min={-100} max={100} step={1} value={t.distortion} onChange={(v) => setShape({ distortion: v })} ariaLabel="Banner fx: shape distortion" />
        </Field>
        <Field label="Wave amount" hint={t.wave ? `${t.wave}` : "straight edges"}>
          <Slider min={0} max={100} step={1} value={t.wave} onChange={(v) => setShape({ wave: v })} ariaLabel="Banner fx: wave amount" />
        </Field>
        <Field label="Curve amount" hint={t.curve ? `${t.curve}` : "straight edges"}>
          <Slider min={0} max={100} step={1} value={t.curve} onChange={(v) => setShape({ curve: v })} ariaLabel="Banner fx: curve amount" />
        </Field>
        <Field label="Slant amount" hint={t.slant ? `${t.slant}` : "no shear"}>
          <Slider min={0} max={100} step={1} value={t.slant} onChange={(v) => setShape({ slant: v })} ariaLabel="Banner fx: slant amount" />
        </Field>
        <Field label="Skew" hint={`${t.skew}°`}>
          <Slider min={-45} max={45} step={1} value={t.skew} onChange={(v) => setShape({ skew: v })} ariaLabel="Banner fx: skew (deg)" />
        </Field>
        <Field label="Rotation" hint={`${t.rotation}°`}>
          <Slider min={-180} max={180} step={1} value={t.rotation} onChange={(v) => setShape({ rotation: v })} ariaLabel="Banner fx: rotation (deg)" />
        </Field>
        <Toggle label="Flip horizontal" checked={t.flipH} onChange={(v) => setShape({ flipH: v })} />
        <Toggle label="Flip vertical" checked={t.flipV} onChange={(v) => setShape({ flipV: v })} />
        <p className="text-[10px] leading-relaxed text-slate-500">
          Wave, curve and slant each cut the plate's edge — the one you turn on last wins. The rest stack: rotate, then skew, then
          stretch, then the flips, on top of every effect above.
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        The halo grows outward from the plate itself, whatever size it is. Shimmer is a presenter-only sheen and is never exported.
        One effect wears at a time in each category — Type picks which — the decorations and the shape's distortions stack on top,
        and every category falls back to off, so the plate never wears more than the teacher put on it. Every colour channel starts
        on <b>Auto</b>, which is the shape's own paint: pick it once and the effect keeps that colour, leave it and it follows the
        plate the moment the fill (or the gradient's first stop) changes. The tiles are the plate itself wearing each effect — the
        same miniature the <b>Shape</b> card paints, so what a tile shows is what the board paints.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fill · the plate's ten paints                                      */
/* ------------------------------------------------------------------ */

/** the metal tones the metallic fill offers on swatches */
const METAL_SWATCHES = ["#d4af37", "#c9ccd6", "#cd7f32", "#b87333", "#8a93a5", "#e8b4b8"];

/** the checkerboard worn under a see-through preview */
const FILL_CHECKER = "repeating-conic-gradient(#3a3a44 0% 25%, #1c1c22 0% 50%) 50% / 8px 8px";

/** one of the fills on the Fill card */
type FillTileId =
  | "reflected"
  | "multi"
  | "transparent"
  | "glass"
  | "metallic"
  | "pattern";

/** the alpha a colour stop carries — 1 for an ordinary hex colour */
const stopAlpha = (c: string): number => {
  const m8 = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(c.trim());
  if (m8) return parseInt(m8[1], 16) / 255;
  const rgba = /rgba?\(([^)]*)\)/.exec(c);
  if (rgba) {
    const parts = rgba[1].split(",").map((s) => s.trim());
    return parts.length >= 4 ? Math.max(0, Math.min(1, Number(parts[3]) || 0)) : 1;
  }
  return 1;
};

/** the fully transparent twin of a hex colour — the transparent ramp's last stop */
const fadeOut = (c: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (m) return m[0].toLowerCase() + "00";
  const m3 = /^#([0-9a-f]{3})$/i.exec(c.trim());
  if (m3) return `#${m3[1].split("").map((x) => x + x).join("")}00`;
  return "#ffffff00";
};

/** the motifs the pattern paint carries, in picture tiles */
const PATTERN_KINDS: { value: BannerPatternKind; label: string }[] = [
  { value: "dots", label: "Dots" },
  { value: "stripes", label: "Diag. stripes" },
  { value: "lines", label: "Lines" },
  { value: "grid", label: "Grid" },
  { value: "checker", label: "Checker" },
  { value: "diamonds", label: "Diamonds" },
  { value: "rays", label: "Sun rays" },
  { value: "rings", label: "Rings" },
];

export const TRANSPARENT_SIDES: { id: TransparentSide; label: string; angle: number; arrow: string }[] = [
  { id: "left", label: "Left", angle: 270, arrow: "←" },
  { id: "right", label: "Right", angle: 90, arrow: "→" },
  { id: "top", label: "Top", angle: 0, arrow: "↑" },
  { id: "bottom", label: "Bottom", angle: 180, arrow: "↓" },
];

const cleanPaintColor = (color: string): string => {
  const c = String(color || "").trim();
  return /^#[0-9a-f]{8}$/i.test(c) ? c.slice(0, 7) : c;
};

const angle360 = (angle: number) => ((Math.round(angle) % 360) + 360) % 360;

/** Which physical edge currently owns the transparent end of a linear ramp. */
export const transparentSideOf = (g: BannerSettings["gradient"]): TransparentSide | "" => {
  if (!g.enabled || g.type !== "linear" || g.stops.length < 2) return "";
  const stops = [...g.stops].sort((a, b) => a.at - b.at);
  const firstClear = stopAlpha(stops[0]?.color ?? "") < 0.2;
  const lastClear = stopAlpha(stops.at(-1)?.color ?? "") < 0.2;
  if (!firstClear && !lastClear) return "";
  // CSS angles point towards the final stop. A clear first stop therefore owns
  // the opposite edge from a clear final stop.
  const clearAngle = angle360(g.angle + (firstClear && !lastClear ? 180 : 0));
  return TRANSPARENT_SIDES.find((side) => side.angle === clearAngle)?.id ?? "";
};

export function buildTransparentGradient(base: string, sides: TransparentSide[]): Gradient {
  const set = new Set(sides);
  const hasL = set.has("left");
  const hasR = set.has("right");
  const hasT = set.has("top");
  const hasB = set.has("bottom");
  const count = (hasL ? 1 : 0) + (hasR ? 1 : 0) + (hasT ? 1 : 0) + (hasB ? 1 : 0);
  const clear = fadeOut(base);

  if (count === 4) {
    return {
      enabled: true,
      type: "radial",
      angle: 0,
      cx: 50,
      cy: 50,
      stops: [
        { color: base, at: 20 },
        { color: clear, at: 95 },
      ],
    };
  }

  if (count === 3) {
    if (!hasB) {
      return {
        enabled: true,
        type: "radial",
        angle: 0,
        cx: 50,
        cy: 95,
        stops: [
          { color: base, at: 20 },
          { color: clear, at: 95 },
        ],
      };
    }
    if (!hasT) {
      return {
        enabled: true,
        type: "radial",
        angle: 0,
        cx: 50,
        cy: 5,
        stops: [
          { color: base, at: 20 },
          { color: clear, at: 95 },
        ],
      };
    }
    if (!hasR) {
      return {
        enabled: true,
        type: "radial",
        angle: 0,
        cx: 95,
        cy: 50,
        stops: [
          { color: base, at: 20 },
          { color: clear, at: 95 },
        ],
      };
    }
    return {
      enabled: true,
      type: "radial",
      angle: 0,
      cx: 5,
      cy: 50,
      stops: [
        { color: base, at: 20 },
        { color: clear, at: 95 },
      ],
    };
  }

  if (count === 2) {
    if (hasL && hasR) {
      return {
        enabled: true,
        type: "linear",
        angle: 90,
        stops: [
          { color: clear, at: 0 },
          { color: base, at: 25 },
          { color: base, at: 75 },
          { color: clear, at: 100 },
        ],
      };
    }
    if (hasT && hasB) {
      return {
        enabled: true,
        type: "linear",
        angle: 180,
        stops: [
          { color: clear, at: 0 },
          { color: base, at: 25 },
          { color: base, at: 75 },
          { color: clear, at: 100 },
        ],
      };
    }
    if (hasL && hasT) {
      return {
        enabled: true,
        type: "linear",
        angle: 315,
        stops: [
          { color: base, at: 15 },
          { color: clear, at: 100 },
        ],
      };
    }
    if (hasR && hasT) {
      return {
        enabled: true,
        type: "linear",
        angle: 45,
        stops: [
          { color: base, at: 15 },
          { color: clear, at: 100 },
        ],
      };
    }
    if (hasR && hasB) {
      return {
        enabled: true,
        type: "linear",
        angle: 135,
        stops: [
          { color: base, at: 15 },
          { color: clear, at: 100 },
        ],
      };
    }
    if (hasL && hasB) {
      return {
        enabled: true,
        type: "linear",
        angle: 225,
        stops: [
          { color: base, at: 15 },
          { color: clear, at: 100 },
        ],
      };
    }
  }

  if (hasL) {
    return {
      enabled: true,
      type: "linear",
      angle: 270,
      stops: [
        { color: base, at: 0 },
        { color: clear, at: 100 },
      ],
    };
  }
  if (hasT) {
    return {
      enabled: true,
      type: "linear",
      angle: 0,
      stops: [
        { color: base, at: 0 },
        { color: clear, at: 100 },
      ],
    };
  }
  if (hasB) {
    return {
      enabled: true,
      type: "linear",
      angle: 180,
      stops: [
        { color: base, at: 0 },
        { color: clear, at: 100 },
      ],
    };
  }

  return {
    enabled: true,
    type: "linear",
    angle: 90,
    stops: [
      { color: base, at: 0 },
      { color: clear, at: 100 },
    ],
  };
}

export const transparentSidesOf = (banner: BannerSettings): TransparentSide[] => {
  if (banner.transparentSides && banner.transparentSides.length > 0) {
    return banner.transparentSides;
  }
  const g = banner.gradient;
  if (!g || !g.enabled || g.stops.length < 2) return ["right"];
  const hasClear = g.stops.some((s) => stopAlpha(s.color) < 0.2);
  if (!hasClear) return ["right"];

  if (g.type === "radial") {
    const cx = g.cx ?? 50;
    const cy = g.cy ?? 50;
    if (cy >= 75) return ["left", "right", "top"];
    if (cy <= 25) return ["left", "right", "bottom"];
    if (cx >= 75) return ["left", "top", "bottom"];
    if (cx <= 25) return ["right", "top", "bottom"];
    return ["left", "right", "top", "bottom"];
  }

  if (g.type === "linear") {
    const stops = [...g.stops].sort((a, b) => a.at - b.at);
    const firstClear = stopAlpha(stops[0]?.color ?? "") < 0.2;
    const lastClear = stopAlpha(stops.at(-1)?.color ?? "") < 0.2;
    if (firstClear && lastClear) {
      const a = angle360(g.angle);
      if ((a >= 45 && a <= 135) || (a >= 225 && a <= 315)) return ["left", "right"];
      return ["top", "bottom"];
    }
    const clearAngle = angle360(g.angle + (firstClear && !lastClear ? 180 : 0));
    if (clearAngle >= 248 && clearAngle <= 292) return ["left"];
    if (clearAngle >= 68 && clearAngle <= 112) return ["right"];
    if (clearAngle <= 22 || clearAngle >= 338) return ["top"];
    if (clearAngle >= 158 && clearAngle <= 202) return ["bottom"];
    if (clearAngle > 292 && clearAngle < 338) return ["left", "top"];
    if (clearAngle > 22 && clearAngle < 68) return ["right", "top"];
    if (clearAngle > 112 && clearAngle < 158) return ["right", "bottom"];
    if (clearAngle > 202 && clearAngle < 248) return ["left", "bottom"];
  }

  return ["right"];
};

interface BannerFillProps extends Omit<BannerProps, "theme"> {
  /** the same deduped deck colours the text-colour popup offers */
  documentColors?: string[];
}

export function BannerFillPanel({ banner, setBanner, documentColors = [] }: BannerFillProps) {
  const g = banner.gradient;
  const mode = bannerFillMode(banner);
  const gradOn = mode === "gradient";
  const faded = gradOn && g.stops.some((s) => stopAlpha(s.color) < 0.2);
  const multi = gradOn && !faded && g.stops.length >= 4;
  const [colorTab, setColorTab] = useState<ColorPanelTab>(() => (gradOn ? "gradient" : "solid"));

  // A fill tile is allowed to move the same Solid / Gradient tabs the text
  // colour popup uses. Merely browsing a tab does not repaint anything.
  useEffect(() => {
    setColorTab(gradOn ? "gradient" : "solid");
  }, [gradOn]);

  /** the plate's own opaque paint — previews and transparent fades read it */
  const opaqueStop = faded ? g.stops.find((s) => stopAlpha(s.color) >= 0.2)?.color : undefined;
  const rawBase = opaqueStop ?? baseColor(g, banner.color || DEFAULT_BANNER.color);
  const cleanedBase = cleanPaintColor(rawBase);
  const base = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleanedBase) ? cleanedBase : banner.color || DEFAULT_BANNER.color;
  const glass = { ...DEFAULT_BANNER_GLASS, ...banner.glass };
  const metal = { ...DEFAULT_BANNER_METALLIC, ...banner.metallic };
  const pat = { ...DEFAULT_BANNER_PATTERN, ...banner.pattern };
  /** a special paint's pop-up offers the deck's colours, the plate's own, then the paint's classics */
  const fillDocColors = (...extra: string[]) =>
    Array.from(new Set([...documentColors, base, ...extra].map((c) => String(c || "").toLowerCase()))).filter((c) =>
      /^#[0-9a-f]{6}$/.test(c),
    );

  /* which fill is on — multi-colour and transparent are recognised from the
     stops, while the ordinary ramps read their gradient type */
  const active: FillTileId | "" =
    mode === "glass" ? "glass"
    : mode === "metallic" ? "metallic"
    : mode === "pattern" ? "pattern"
    : !gradOn ? ""
    : faded ? "transparent"
    : multi ? "multi"
    : g.type === "reflected" ? "reflected"
    : "";

  /* the six fills, in order — each tile is a miniature of the plate's own
     colour wearing that paint */
  const tiles: { id: FillTileId; label: string; name: string; hint: string; css: string }[] = [
    {
      id: "reflected",
      label: "Reflected",
      name: "Reflected Gradient",
      hint: "The ramp mirrored out from the middle",
      css: `linear-gradient(90deg, ${shade(base, -0.35)}, ${shade(base, 0.5)} 50%, ${shade(base, -0.35)})`,
    },
    {
      id: "multi",
      label: "Multi-Color",
      name: "Multi-Color Gradient",
      hint: "Several colours on one ramp",
      css: `linear-gradient(90deg, ${base}, ${rotateHue(base, 90)}, ${rotateHue(base, 180)}, ${rotateHue(base, 270)})`,
    },
    {
      id: "transparent",
      label: "Transparent",
      name: "Transparent Gradient",
      hint: "Fade one or more chosen sides to clear",
      css: `linear-gradient(90deg, ${base}, ${fadeOut(base)}), ${FILL_CHECKER}`,
    },
    { id: "glass", label: "Glass", name: "Glass / Frosted Fill", hint: "A tinted pane with frost on top", css: glassFillCss(base, glass) },
    { id: "metallic", label: "Metallic", name: "Metallic Fill", hint: "Brushed metal bands", css: metallicFillCss(base, metal) },
    { id: "pattern", label: "Pattern", name: "Pattern Fill", hint: "One motif inked over one ground", css: patternFillCss(base, pat) },
  ];

  const pickFill = (id: FillTileId) => {
    const gradientTile = ["reflected", "multi", "transparent"].includes(id);
    setColorTab(gradientTile ? "gradient" : "solid");
    switch (id) {
      case "reflected": {
        // Leaving Transparent must restore two opaque stops; merely changing its
        // type would still leave the clear stop and keep Transparent selected.
        const stops = faded
          ? [{ color: shade(base, -0.28), at: 0 }, { color: base, at: 100 }]
          : g.stops;
        return setBanner({ fillMode: undefined, gradient: { ...g, type: id, enabled: true, stops } });
      }
      case "multi": {
        const stops =
          g.stops.length >= 4 && !g.stops.some((s) => stopAlpha(s.color) < 0.2)
            ? g.stops
            : [
                { color: base, at: 0 },
                { color: rotateHue(base, 90), at: 33 },
                { color: rotateHue(base, 180), at: 66 },
                { color: rotateHue(base, 270), at: 100 },
              ];
        return setBanner({ fillMode: undefined, gradient: { ...g, type: "linear", enabled: true, stops } });
      }
      case "transparent": {
        const sides: TransparentSide[] =
          banner.transparentSides && banner.transparentSides.length > 0 ? banner.transparentSides : ["right"];
        return setBanner({
          fillMode: undefined,
          transparentSides: sides,
          gradient: buildTransparentGradient(base, sides),
        });
      }
      case "glass":
        return setBanner({ fillMode: "glass" });
      case "metallic":
        return setBanner({ fillMode: "metallic" });
      case "pattern":
        return setBanner({ fillMode: "pattern" });
    }
  };

  const activeSides = transparentSidesOf(banner);

  const toggleTransparentSide = (sideId: TransparentSide) => {
    setColorTab("gradient");
    const current = transparentSidesOf(banner);
    let next: TransparentSide[];
    if (current.includes(sideId)) {
      if (current.length > 1) {
        next = current.filter((s) => s !== sideId);
      } else {
        next = current;
      }
    } else {
      next = [...current, sideId];
    }
    setBanner({
      fillMode: undefined,
      transparentSides: next,
      gradient: buildTransparentGradient(base, next),
    });
  };

  const transparentSidesSummary =
    activeSides.length === 4
      ? "all 4 sides"
      : activeSides.length > 1
        ? activeSides.join(" + ")
        : activeSides[0] || "custom direction";

  const capHint =
    platePaintLayers(banner) > 1
      ? `${platePaintLayers(banner)} paints stacked on the plate`
      : mode === "glass"
        ? "glass · frosted"
        : mode === "metallic"
          ? "metallic"
          : mode === "pattern"
            ? `pattern · ${PATTERN_KINDS.find((p) => p.value === pat.kind)?.label.toLowerCase()}`
            : faded
              ? `transparent · ${transparentSidesSummary}`
              : multi
                ? "multi-colour gradient"
                : mode === "solid"
                  ? banner.color
                  : {
                      linear: "linear gradient",
                      radial: "radial gradient",
                      conic: "angular gradient",
                      reflected: "reflected gradient",
                      mesh: "mesh gradient",
                    }[g.type];

  const stylePicker = (
    <div className="space-y-2">
      <Cap hint={capHint}>Fill styles</Cap>
      <div className="grid grid-cols-2 gap-1.5" role="listbox" aria-label="Fill style">
        {tiles.map((t) => {
          const chosen = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Fill: ${t.name}`}
              title={`${t.name} — ${t.hint}`}
              onClick={() => pickFill(t.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
              )}
            >
              <span aria-hidden="true" className="h-8 w-full rounded-md border border-black/30" style={{ background: t.css }} />
              <span className="text-[9.5px] font-medium leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const specialControls =
    mode === "glass" ? (
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Cap hint="special fill">Glass / frosted</Cap>
        <PaintPopoverField
          label="Pane tint"
          hint={glass.color || glass.gradient?.enabled ? undefined : "the plate's colour"}
          value={glass.color}
          gradient={glass.gradient}
          fallback={base}
          documentColors={fillDocColors("#ffffff", "#93c5fd", "#a5f3fc", "#d8b4fe", "#fbcfe8", "#0b0b0f")}
          onSolid={(v) => setBanner({ glass: { ...glass, color: v, gradient: gradOff(glass.gradient) } })}
          onGradient={(gr) => setBanner({ glass: { ...glass, gradient: gr } })}
          onClearGradient={() => setBanner({ glass: { ...glass, gradient: gradOff(glass.gradient) } })}
          onAuto={() => setBanner({ glass: { ...glass, color: "", gradient: gradOff(glass.gradient) } })}
          autoHint="Auto — follow the plate's colour"
        />
        <Field label="Pane opacity" hint={`${glass.opacity}`}>
          <Slider min={0} max={100} value={glass.opacity} onChange={(v) => setBanner({ glass: { ...glass, opacity: v } })} ariaLabel="Glass fill: pane opacity" />
        </Field>
        <Field label="Frost" hint={`${glass.frost}`}>
          <Slider min={0} max={100} value={glass.frost} onChange={(v) => setBanner({ glass: { ...glass, frost: v } })} ariaLabel="Glass fill: frost" />
        </Field>
      </div>
    ) : mode === "metallic" ? (
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Cap hint="special fill">Metallic</Cap>
        <PaintPopoverField
          label="Metal tone"
          hint={metal.color || metal.gradient?.enabled ? undefined : "the plate's colour"}
          value={metal.color}
          gradient={metal.gradient}
          fallback={base}
          documentColors={fillDocColors(...METAL_SWATCHES)}
          onSolid={(v) => setBanner({ metallic: { ...metal, color: v, gradient: gradOff(metal.gradient) } })}
          onGradient={(gr) => setBanner({ metallic: { ...metal, gradient: gr } })}
          onClearGradient={() => setBanner({ metallic: { ...metal, gradient: gradOff(metal.gradient) } })}
          onAuto={() => setBanner({ metallic: { ...metal, color: "", gradient: gradOff(metal.gradient) } })}
          autoHint="Auto — follow the plate's colour"
        />
        <Field label="Sheen direction" hint={`${metal.angle}°`}>
          <Slider min={0} max={359} value={metal.angle} onChange={(v) => setBanner({ metallic: { ...metal, angle: v } })} ariaLabel="Metallic fill: sheen direction (deg)" />
        </Field>
        <Field label="Polish" hint={`${metal.polish}`}>
          <Slider min={0} max={100} value={metal.polish} onChange={(v) => setBanner({ metallic: { ...metal, polish: v } })} ariaLabel="Metallic fill: polish" />
        </Field>
      </div>
    ) : mode === "pattern" ? (
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Cap hint="special fill">Pattern</Cap>
        <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label="Pattern motif">
          {PATTERN_KINDS.map((k) => {
            const chosen = pat.kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                role="option"
                aria-selected={chosen}
                aria-label={`Pattern: ${k.label}`}
                title={`Pattern: ${k.label}`}
                onClick={() => setBanner({ pattern: { ...pat, kind: k.value } })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-1.5 transition-colors",
                  chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-7 w-full rounded border border-black/30"
                  style={{ background: patternFillCss(base, { ...pat, kind: k.value }) }}
                />
                <span className="text-[9px] font-medium leading-none">{k.label}</span>
              </button>
            );
          })}
        </div>
        <PaintPopoverField
          label="Pattern ink"
          hint={pat.color || pat.gradient?.enabled ? undefined : "the plate's colour"}
          value={pat.color}
          gradient={pat.gradient}
          fallback={base}
          documentColors={fillDocColors("#ffffff", "#ffd633", "#0b0b0f")}
          onSolid={(v) => setBanner({ pattern: { ...pat, color: v, gradient: gradOff(pat.gradient) } })}
          onGradient={(gr) => setBanner({ pattern: { ...pat, gradient: gr } })}
          onClearGradient={() => setBanner({ pattern: { ...pat, gradient: gradOff(pat.gradient) } })}
          onAuto={() => setBanner({ pattern: { ...pat, color: "", gradient: gradOff(pat.gradient) } })}
          autoHint="Auto — follow the plate's colour"
        />
        <PaintPopoverField
          label="Ground"
          hint={pat.back || pat.backGradient?.enabled ? undefined : "the plate's colour"}
          value={pat.back}
          gradient={pat.backGradient}
          fallback={base}
          documentColors={fillDocColors("#0b0b0f", "#ffffff", "#1e293b")}
          onSolid={(v) => setBanner({ pattern: { ...pat, back: v, backGradient: gradOff(pat.backGradient) } })}
          onGradient={(gr) => setBanner({ pattern: { ...pat, backGradient: gr } })}
          onClearGradient={() => setBanner({ pattern: { ...pat, backGradient: gradOff(pat.backGradient) } })}
          onAuto={() => setBanner({ pattern: { ...pat, back: "", backGradient: gradOff(pat.backGradient) } })}
          autoHint="Auto — follow the plate's colour"
        />
        <Field label="Motif size" hint={`${pat.scale}`}>
          <Slider min={0} max={100} value={pat.scale} onChange={(v) => setBanner({ pattern: { ...pat, scale: v } })} ariaLabel="Pattern fill: motif size" />
        </Field>
      </div>
    ) : null;

  const transparentControls = faded ? (
    <div className="space-y-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3" data-transparent-side-control="">
      <Cap hint="choose one or more clear edges">Transparent sides</Cap>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Transparent side">
        {TRANSPARENT_SIDES.map((side) => {
          const chosen = activeSides.includes(side.id);
          const preview = `linear-gradient(${side.angle}deg, ${base}, ${fadeOut(base)}), ${FILL_CHECKER}`;
          return (
            <button
              key={side.id}
              type="button"
              aria-label={`Transparent side: ${side.label}`}
              aria-pressed={chosen}
              title={`Make the ${side.label.toLowerCase()} side transparent (click to toggle)`}
              onClick={() => toggleTransparentSide(side.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] font-medium transition-colors",
                chosen ? "border-cyan-300 bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/40" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
              )}
            >
              <span className="h-7 w-full rounded border border-black/30" style={{ background: preview }} aria-hidden="true" />
              <span>{side.arrow} {side.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-400">
        Pick one or more edges that fade to clear. You can select multiple sides together.
      </p>
    </div>
  ) : null;

  const useSolid = (hex: string) => {
    setColorTab("solid");
    setBanner({ color: hex, gradient: { ...g, enabled: false }, fillMode: undefined });
  };

  return (
    <div className="banner-fill-color-panel flex min-h-0 w-full flex-col" data-banner-fill="">
      <FontColorPanel
        solid={banner.color || DEFAULT_BANNER.color}
        gradient={gradOn ? g : { ...g, enabled: false }}
        onSolid={useSolid}
        onGradient={(next) => {
          setColorTab("gradient");
          setBanner({ fillMode: undefined, gradient: next });
        }}
        onClearGradient={() => {
          setColorTab("solid");
          setBanner({ fillMode: undefined, gradient: { ...g, enabled: false } });
        }}
        documentColors={documentColors}
        activeTab={colorTab}
        onTabChange={setColorTab}
        topContent={stylePicker}
        solidContent={specialControls}
        gradientContent={transparentControls}
        title="Banner fill"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border — ONE card for the whole outline                            */
/* ------------------------------------------------------------------ */

/** which of the outline's two colours a colour card is painting */
export type BannerLineColorChannel = "line" | "glow";

/**
 * A line the teacher just asked for must be SEEN: the outline switched on, a
 * style that paints (None → Solid), a weight above 0 and a transparency short of
 * fully clear. Picking a colour, switching the outline or its glow on, picking a
 * style or dragging the weight up all go through here, so no control ever
 * answers with an invisible line.
 */
function lineVisible(border: BannerBorder): BannerBorder {
  return {
    ...border,
    enabled: true,
    style: border.style === "none" ? "solid" : border.style,
    width: border.width > 0 ? border.width : DEFAULT_BANNER.border.width,
    opacity: border.opacity !== undefined && border.opacity <= 0 ? 1 : border.opacity,
  };
}

/** the glow's settings with the factory values filled in — most decks carry none */
const glowOf = (border: BannerBorder): BannerBorderGlow => ({
  ...DEFAULT_BANNER_BORDER_GLOW,
  enabled: false,
  ...(border.glow ?? {}),
});

/** the four corners as the card lays them out — a 2 × 2 grid, each where it sits on the plate */
const CORNERS: { key: keyof BannerCorners; label: string; aria: string }[] = [
  { key: "tl", label: "Top left", aria: "top-left" },
  { key: "tr", label: "Top right", aria: "top-right" },
  { key: "bl", label: "Bottom left", aria: "bottom-left" },
  { key: "br", label: "Bottom right", aria: "bottom-right" },
];

/** one corner, pulled round — turned to face the corner it names */
function CornerGlyph({ corner, size = 13 }: { corner: keyof BannerCorners; size?: number }) {
  const turn = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}>
      <path d="M3 14V8.5A5.5 5.5 0 0 1 8.5 3H14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** an on / off row that says what it switches — a real switch to assistive technology */
function LineSwitch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-900"
    >
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[10px] leading-snug text-slate-500">{hint}</span>}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-amber-400" : "bg-white/15")} aria-hidden="true">
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/** the button that opens a colour card: the swatch, the channel's name and the colour it paints */
function ColorRow({
  label,
  color,
  caption,
  open,
  onClick,
}: {
  label: string;
  color: string;
  caption: string;
  open: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      title={`${label} — open the colour card`}
      onClick={onClick}
      className={cn(
        "group/colorrow flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all",
        open
          ? "border-amber-400/70 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
          : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900/80",
      )}
    >
      <span
        className="h-8 w-11 shrink-0 rounded-lg shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] ring-1 ring-white/20 transition-transform group-hover/colorrow:scale-[1.04]"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-slate-200">{label}</span>
        <span className="block truncate font-mono text-[10.5px] text-slate-400">{caption}</span>
      </span>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-500 transition-colors group-hover/colorrow:text-slate-300" aria-hidden="true">
        <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** the see-through checker painted under the line's live preview tile */
const LINE_PREVIEW_CHECKER = "repeating-conic-gradient(#343746 0% 25%, #1b1d28 0% 50%) 50% / 9px 9px";

/** a small left arrow for the chip that walks back to the Border card */
function BackArrowIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 3.5 5 8l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** the glow channel's mark — a four-point spark */
function SparkIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5 2.9-.4 4.1-1.6 4.5-4.5Z" />
      <path d="M12.6 9.6c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3Z" opacity=".7" />
    </svg>
  );
}

/** the border channel's mark — a rounded plate wearing its outline */
function PlateIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="4.25" width="12.5" height="7.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * The colour card behind the Border card's two colour buttons — the SAME card
 * the text colour opens (Solid colour and Gradient, the document colours, the
 * Canva swatches, the wheel and the hex field). The glow's card has one more
 * state, **Auto**: the line's own colour, followed as the line is repainted.
 * The card is its own pop-up, stacked on the Border pop-up — closing it leaves
 * the Border pop-up open.
 *
 * The head is dressed the way the editing platforms dress a stroke card: a
 * live tile that wears the line itself — its style, weight, colour and
 * transparency, and the glow's bloom when it is the glow's card — the paint's
 * hex big under it, and a strip where the real line runs edge to edge, so a
 * dashed line is seen dashing while its colour changes.
 */
export function BannerLineColorPanel({
  channel,
  banner,
  setBanner,
  documentColors,
  onBack,
}: {
  channel: BannerLineColorChannel;
  banner: BannerSettings;
  setBanner: (patch: Partial<BannerSettings>) => void;
  documentColors?: string[];
  /** the toolbar's way back to the Border card */
  onBack?: () => void;
}) {
  const border = banner.border;
  const glow = channel === "glow";
  const label = glow ? "Glow colour" : "Border colour";
  const gradient = glow ? border.glow?.gradient : border.gradient;
  const gradOn = !!gradient?.enabled;
  const auto = glow && !gradOn && !border.glow?.color?.trim();
  const value = glow ? bannerBorderGlowColor(banner) : border.color;
  const swatch = gradOn ? gradientCss(gradient!, value) : value;
  const pick = (hex: string) =>
    setBanner({
      border: glow
        ? { ...lineVisible(border), glow: { ...glowOf(border), enabled: true, color: hex, gradient: gradOff(border.glow?.gradient) } }
        : { ...lineVisible(border), color: hex, gradient: gradOff(border.gradient) },
    });
  const pickGradient = (gr: Gradient) =>
    setBanner({
      border: glow
        ? { ...lineVisible(border), glow: { ...glowOf(border), enabled: true, gradient: gr } }
        : { ...lineVisible(border), gradient: gr },
    });
  const clearGradient = () =>
    setBanner({
      border: glow
        ? { ...border, glow: { ...glowOf(border), gradient: gradOff(border.glow?.gradient) } }
        : { ...border, gradient: gradOff(border.gradient) },
    });
  /* ---- the live head: the line as it really is right now ----------------- */
  const style = bannerBorderStyle(banner);
  const opacity = clampOpacity(border.opacity);
  const opacityPct = Math.round(opacity * 100);
  /** the tile wears the paint itself — a gradient paints the ring whole */
  const tilePaint = swatch;
  /** the ring's thickness on the preview tile, kept between a hair and a beam */
  const ring = Math.max(2, Math.min(border.width, 8));
  /** the strip runs the real line edge to edge — one blended colour for the border */
  const stripColor = glow ? value : bannerBorderPaintColor(banner);
  /* a double line only reads as two lines from 4px up */
  const stripWidth = Math.max(style === "double" ? 4 : 2, Math.min(border.width, 7));
  const lineHidden = style === "none" || border.width <= 0 || !bannerHasLine(banner);
  const glowFilter = glow
    ? bannerBorderGlowFilter(banner) ?? `drop-shadow(0 0 8px ${withAlpha(value, 0.85)})`
    : undefined;
  const meta = glow
    ? `${glowOf(border).size}px bloom · ${glowOf(border).intensity}% strength`
    : `${style} · ${border.width}px${opacityPct < 100 ? ` · ${opacityPct}% visible` : ""}`;

  return (
    <div className="banner-line-color-panel flex w-full flex-col" data-banner-line-color={channel}>
      {/* ------------------------- the hero head --------------------------- */}
      <div className="banner-line-head shrink-0 space-y-2.5 border-b border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-3.5 pb-3 pt-2.5">
        {/* chip row — the way back, and the glow's Auto */}
        {(onBack || glow) && (
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button
              type="button"
              aria-label="Back to the Border card"
              title="Back to the Border card"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-2 pr-2.5 text-[10.5px] font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              <BackArrowIcon />
              Border
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          {glow && (
            <button
              type="button"
              aria-label="Glow colour: auto (the line's own colour)"
              aria-pressed={auto}
              title="Auto — the glow wears the line's own colour"
              onClick={() => setBanner({ border: { ...border, glow: { ...glowOf(border), color: "", gradient: gradOff(border.glow?.gradient) } } })}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition-all",
                auto
                  ? "border-amber-300/90 bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                  : "border-white/10 bg-white/[0.05] text-slate-300 hover:border-white/25 hover:bg-white/10",
              )}
            >
              <SparkIcon size={10} />
              Auto
            </button>
          )}
        </div>
        )}

        {/* hero row — the tile wears the line; the hex reads big under the name */}
        <div className="flex items-center gap-3">
          <span
            className="relative block h-[54px] w-[54px] shrink-0 rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-white/15"
            style={{ background: tilePaint, padding: ring, filter: glowFilter }}
            aria-hidden="true"
          >
            {/* the checker inside follows the ring's own curve */}
            <span
              className="block h-full w-full"
              style={{ background: LINE_PREVIEW_CHECKER, borderRadius: Math.max(4, 16 - ring) }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {glow ? <SparkIcon size={10} /> : <PlateIcon size={11} />}
              {glow ? "The line's light" : "The plate's outline"}
              <span
                className="inline-block h-2 w-2 rounded-[3px] ring-1 ring-white/25"
                style={{ background: gradOn ? gradientCss(gradient!, value) : value }}
                aria-hidden="true"
              />
            </span>
            <span className="mt-0.5 block truncate font-mono text-[17px] font-semibold leading-tight text-slate-100">
              {gradOn ? "Gradient" : auto ? "Auto" : value.toUpperCase()}
            </span>
            <span className="block truncate font-mono text-[10.5px] text-slate-400">
              {auto ? `follows the line's ${value.toUpperCase()}` : meta}
            </span>
          </span>
        </div>

        {/* the line itself, running edge to edge in its real style */}
        <div
          className="flex h-8 items-center overflow-hidden rounded-lg bg-black/25 px-4 ring-1 ring-white/[0.06]"
          title={`The line as it paints now — ${meta}`}
        >
          <div
            className="w-full"
            style={{
              borderTop: lineHidden
                ? "2px dashed rgba(255,255,255,0.18)"
                : `${stripWidth}px ${style} ${withAlpha(stripColor, opacity)}`,
              filter: glowFilter,
            }}
            aria-hidden="true"
          />
        </div>
        {lineHidden && <p className="-mt-1.5 text-center text-[9.5px] text-slate-500">the outline is off — the line paints once it is back</p>}
      </div>

      <FontColorPanel
        solid={/^#[0-9a-f]{3,8}$/i.test(value) ? value : "#ffffff"}
        gradient={gradient}
        onSolid={pick}
        onGradient={pickGradient}
        onClearGradient={clearGradient}
        documentColors={documentColors}
        title={label}
      />
    </div>
  );
}

/**
 * Title background ▸ **Border** — every setting of the plate's outline in one
 * card, in the order a line is drawn:
 *
 *   Outline the plate     on / off                                `border.enabled`
 *   Border colour         opens the colour card (solid + gradient) `border.color`
 *   Border style          solid · dashed · dotted · double · none `border.style`
 *   Border weight         the line's thickness, no ceiling        `border.width`
 *   Border transparency   the line's own, apart from the shape's  `border.opacity`
 *   Border radius         All corners — one bar for the four      `radius`
 *                         Each corner — top-left · top-right ·    `cornersIndependent`
 *                         bottom-left · bottom-right on their own · `corners`
 *   Border glow           on / off · size · strength · colour     `border.glow`
 *                         (Auto = the line's own colour)
 *
 * A colour button opens the colour card as its own pop-up, stacked on this one
 * (Solid colour · Gradient, the same card the text colour opens). Closing that
 * card — its ✕ — leaves this Border card open. A second colour (the glow's,
 * while the line's card is still up) stacks on top of the first; closing the
 * top one leaves the one underneath.
 */
export function BannerBorderPanel({
  theme,
  banner,
  setBanner,
  documentColors,
}: BannerProps & {
  /** the deck's colours, offered inside the colour card */
  documentColors?: string[];
}) {
  const [colorStack, setColorStack] = useState<{ channel: BannerLineColorChannel; anchor: HTMLElement }[]>([]);
  const border = banner.border;
  const setBorder = (next: BannerBorder) => setBanner({ border: next });
  const outlinable = canOutline(banner.shape);
  const lineOn = bannerHasLine(banner);
  const style = bannerBorderStyle(banner);
  const opacityPct = Math.round(clampOpacity(border.opacity) * 100);
  const weightMax = rangeMax(24, border.width);

  const glow = glowOf(border);
  const glowColor = bannerBorderGlowColor(banner);
  const glowMax = rangeMax(60, glow.size);

  const cornered = takesCorners(banner.shape);
  const each = !!banner.cornersIndependent;
  const corners = bannerCorners(banner);
  const radiusMax = rangeMax(120, banner.radius);
  const follows = radiusFollowsBar(banner);
  const shapeName = BANNER_SHAPES.find((s) => s.id === banner.shape)?.label ?? "This shape";
  const fx = bannerEffectsOf(banner);
  const fxCorners = fxCornerRadius(fx.shape);

  /**
   * A colour button opens the colour card as its own pop-up, stacked on this
   * one (Solid colour · Gradient). Clicking the button that opened the top
   * card folds that card away; a different colour stacks another card on top.
   */
  const openColor = (channel: BannerLineColorChannel, e: React.MouseEvent<HTMLButtonElement>) => {
    const anchor = e.currentTarget;
    setColorStack((stack) => {
      const top = stack[stack.length - 1];
      if (top?.channel === channel && top.anchor === anchor) return stack.slice(0, -1);
      return [...stack, { channel, anchor }];
    });
  };
  const colorCard = colorStack.map((layer, i) => {
    const glowCh = layer.channel === "glow";
    const glowNow = glowOf(border);
    /* the card's title-bar chip wears the very paint the card is about */
    const accent = glowCh
      ? glowNow.gradient?.enabled
        ? gradientCss(glowNow.gradient, bannerBorderGlowColor(banner))
        : bannerBorderGlowColor(banner)
      : border.gradient?.enabled
        ? gradientCss(border.gradient, border.color)
        : border.color;
    return (
      <AnchoredPopover
        key={`${layer.channel}-${i}`}
        anchor={layer.anchor}
        onClose={() => setColorStack((stack) => stack.slice(0, i))}
        label={glowCh ? "Glow colour — colour card" : "Border colour — colour card"}
        title={glowCh ? "Glow colour" : "Border colour"}
        accent={accent}
      >
        <BannerLineColorPanel channel={layer.channel} banner={banner} setBanner={setBanner} documentColors={documentColors} />
      </AnchoredPopover>
    );
  });

  const radiusHint = !cornered
    ? banner.shape === "none"
      ? "There is no plate to round — pick a shape under Shape first."
      : isClippedShape(banner.shape)
        ? "This silhouette is cut, not rounded — its tips and notches keep their straight edges. Pick a plate, a tab or a pill to round the corners."
        : isMaskedShape(banner.shape)
          ? "This silhouette is drawn by its own curve — a wave, a blob, a stroke — so it has no corner to round."
          : "An oval is one curve all the way round — it has no corner to round."
    : each
      ? "Each corner on its own. Past the plate's half height a corner turns into a full round end."
      : follows
        ? "One radius for all four corners. Drag past the plate's half height and it becomes a full round end."
        : `${shapeName} keeps its own corners on this bar — pick Each corner to round them one by one.`;

  return (
    <div className="space-y-3" data-banner-border="">
      <Cap hint={!outlinable ? "pick a plate shape" : lineOn ? `${style} · ${border.width}px${glow.enabled ? " · glow" : ""}` : "off"}>
        Border
      </Cap>
      <BannerPlatePreview banner={banner} theme={theme} standIn="rounded" size={{ w: 520, h: 84 }} shrink={0.6} height={82} />
      <LineSwitch
        label="Outline the plate"
        checked={border.enabled}
        onChange={(v) => setBorder(v ? lineVisible(border) : { ...border, enabled: false })}
        hint={outlinable ? undefined : "No plate to outline — pick a shape first"}
      />

      <div className={cn("space-y-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3", !outlinable && "opacity-50")}>
        {/* ------------------------------ colour ------------------------------ */}
        <div className="space-y-1.5" data-banner-border-color="">
          <ColorRow
            label="Border colour"
            color={border.gradient?.enabled ? gradientCss(border.gradient, border.color) : border.color}
            caption={border.gradient?.enabled ? "gradient" : border.color.toUpperCase()}
            open={colorStack.some((s) => s.channel === "line")}
            onClick={(e) => openColor("line", e)}
          />
        </div>

        {/* ------------------------------ style ------------------------------- */}
        <div className="space-y-1.5" data-banner-border-style="">
          <Cap hint={BANNER_BORDER_STYLES.find((b) => b.value === style)?.hint}>Border style</Cap>
          <div className="grid grid-cols-5 gap-1.5" role="listbox" aria-label="Border style">
            {BANNER_BORDER_STYLES.map((b) => {
              const chosen = style === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  role="option"
                  aria-selected={chosen}
                  aria-label={`Banner border style: ${b.label}`}
                  title={b.hint}
                  onClick={() => setBorder(b.value === "none" ? { ...border, style: "none", enabled: false } : { ...lineVisible(border), style: b.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-colors",
                    chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
                  )}
                >
                  <BorderStyleIcon style={b.value} size={20} />
                  <span className="text-[9.5px] font-medium leading-none">{b.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------ weight ------------------------------ */}
        <div className="space-y-1.5" data-banner-weight="">
          <Cap
            hint={`${border.width}px`}
            action={
              <AutoBtn
                on={border.width !== DEFAULT_BANNER.border.width}
                onClick={() => setBorder({ ...border, width: DEFAULT_BANNER.border.width })}
                label="Border weight: back to the plate's own line"
              />
            }
          >
            Border weight
          </Cap>
          <Slider
            value={Math.min(border.width, weightMax)}
            min={0}
            max={weightMax}
            step={0.5}
            onChange={(v) => setBorder(v > 0 ? lineVisible({ ...border, width: v }) : { ...border, width: v })}
            ariaLabel="Banner border weight (px)"
          />
        </div>

        {/* --------------------------- transparency --------------------------- */}
        <div className="space-y-1.5" data-banner-border-opacity="">
          <Cap hint={opacityPct >= 100 ? "fully visible" : `${100 - opacityPct}% see-through`}>Border transparency</Cap>
          <Slider
            value={opacityPct}
            min={0}
            max={100}
            onChange={(v) => setBorder({ ...border, opacity: v / 100 })}
            ariaLabel="Banner border transparency (100 = fully visible)"
          />
        </div>
      </div>

      {/* ------------------------------ radius -------------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3" data-banner-radius="" data-corners={each ? "each" : "all"}>
        <Cap
          hint={!cornered ? "no corners" : each ? `${corners.tl} · ${corners.tr} · ${corners.br} · ${corners.bl} px` : follows ? `${banner.radius}px` : "the shape's own"}
          action={
            <AutoBtn
              on={each || banner.radius !== DEFAULT_BANNER.radius}
              onClick={() => setBanner({ radius: DEFAULT_BANNER.radius, cornersIndependent: false })}
              label="Border radius: back to the plate's own corners"
            />
          }
        >
          Border radius
        </Cap>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-900/60 p-1" role="group" aria-label="Border radius corners">
          {[
            { on: !each, label: "All corners", aria: "Border radius: all corners", pick: () => setBanner({ cornersIndependent: false }) },
            // the four start where the plate's corners are right now, so flipping
            // to Each corner never moves one
            { on: each, label: "Each corner", aria: "Border radius: each corner", pick: () => setBanner({ cornersIndependent: true, corners: bannerCornersNow(banner) }) },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              aria-label={m.aria}
              aria-pressed={m.on}
              onClick={() => {
                if (!m.on) m.pick();
              }}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                m.on ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className={cn(!cornered && "opacity-50")}>
          {each ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2" data-banner-corners="">
              {CORNERS.map((c) => {
                const max = rangeMax(120, corners[c.key]);
                return (
                  <div key={c.key} className="min-w-0 space-y-1" data-banner-corner={c.key}>
                    <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-300">
                      <CornerGlyph corner={c.key} />
                      {c.label}
                    </span>
                    <Slider
                      value={Math.min(corners[c.key], max)}
                      min={0}
                      max={max}
                      step={1}
                      onChange={(v) => setBanner({ cornersIndependent: true, corners: { ...corners, [c.key]: v } })}
                      ariaLabel={`Banner border radius: ${c.aria} (px)`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={cn(cornered && !follows && "opacity-60")}>
              <Slider
                value={Math.min(banner.radius, radiusMax)}
                min={0}
                max={radiusMax}
                step={1}
                onChange={(v) => setBanner({ radius: v })}
                ariaLabel="Banner border radius (px)"
              />
            </div>
          )}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">{radiusHint}</p>
        {fxCorners && cornered && (
          <div
            className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[10.5px] leading-snug text-amber-100"
            data-banner-fx-corners=""
          >
            <span>Effects ▸ Shape Effects rounds the corners itself ({fxCorners}) and wins over these.</span>
            <button
              type="button"
              aria-label="Border radius: take the corners back from Shape Effects"
              onClick={() =>
                setBanner({ effects: { ...fx, shape: { ...fx.shape, radius: 0, independent: false, cornerTL: 0, cornerTR: 0, cornerBR: 0, cornerBL: 0 } } })
              }
              className="shrink-0 rounded border border-amber-300/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-400/20"
            >
              Use these
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------- glow --------------------------------- */}
      <div className={cn("space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3", !outlinable && "opacity-50")} data-banner-border-glow="">
        <Cap hint={glow.enabled ? `${glow.size}px · ${glow.intensity}%` : "off"}>Border glow</Cap>
        <LineSwitch
          label="Border glow"
          checked={glow.enabled}
          onChange={(v) => setBorder({ ...(v ? lineVisible(border) : border), glow: { ...glow, enabled: v } })}
          hint={glow.enabled && !lineOn ? "The glow comes back with the outline" : undefined}
        />
        {glow.enabled && (
          <div className="space-y-2.5">
            <Field label="Glow size" hint={`${glow.size}px`}>
              <Slider
                value={Math.min(glow.size, glowMax)}
                min={0}
                max={glowMax}
                step={1}
                onChange={(v) => setBorder({ ...border, glow: { ...glow, size: v } })}
                ariaLabel="Banner border glow size (px)"
              />
            </Field>
            <Field label="Glow strength" hint={`${glow.intensity}%`}>
              <Slider
                value={glow.intensity}
                min={0}
                max={100}
                step={1}
                onChange={(v) => setBorder({ ...border, glow: { ...glow, intensity: v } })}
                ariaLabel="Banner border glow strength (0–100)"
              />
            </Field>
            <ColorRow
              label="Glow colour"
              color={glow.gradient?.enabled ? gradientCss(glow.gradient, glowColor) : glowColor}
              caption={
                glow.gradient?.enabled
                  ? "gradient"
                  : glow.color.trim()
                    ? glowColor.toUpperCase()
                    : `auto · the line's ${border.color.toUpperCase()}`
              }
              open={colorStack.some((s) => s.channel === "glow")}
              onClick={(e) => openColor("glow", e)}
            />
          </div>
        )}
      </div>

      {colorCard}

      <p className="text-[10px] leading-relaxed text-slate-500">
        The line is painted on a layer of its own: it fades with Border transparency and never covers the fill. Its glow is the
        line's own light — it follows the dashes, the dots and the corners, and on a cut or curved silhouette it stays inside the
        cut.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transparency — the SHAPE's (the line's lives in the Border card)   */
/* ------------------------------------------------------------------ */

export function BannerTransparencyPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const shapePct = Math.round(clampOpacity(banner.opacity) * 100);
  return (
    <div className="space-y-3" data-banner-transparency="">
      <Field label="Shape transparency" hint={shapePct >= 100 ? "fully visible" : `${100 - shapePct}% see-through`}>
        <Slider value={shapePct} min={0} max={100} onChange={(v) => setBanner({ opacity: v / 100 })} ariaLabel="Banner shape transparency (100 = fully visible)" />
      </Field>
      <p className="text-[10px] leading-relaxed text-slate-500">
        100 = fully visible. The shape fades the body, its layers and its halo — never the outline, which is painted on its own
        layer and keeps its own transparency in the Border card.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banner size — free width & height                                  */
/* ------------------------------------------------------------------ */

/** the sliders run far past the board, so "free" means free */
export const SIZE_MAX_W = 2560;
export const SIZE_MAX_H = 1440;

export function BannerSizePanel({ theme, banner, setBanner }: BannerProps) {
  const auto = bannerSizeNow(banner, theme.titleSize ?? 54, theme.layout?.title?.w ?? 57);
  const w = banner.size?.w;
  const h = banner.size?.h;
  /** the width the plate paints at right now — the teacher's px, else 630 */
  const nowW = bannerPlateWidth(banner);
  const shownW = Math.min(nowW, rangeMax(SIZE_MAX_W, w));
  const shownH = Math.min(h ?? auto.h, rangeMax(SIZE_MAX_H, h));
  const maxW = rangeMax(SIZE_MAX_W, w);
  const maxH = rangeMax(SIZE_MAX_H, h);
  const factory = nowW === BANNER_WIDTH && h === undefined;
  return (
    <div className="space-y-3" data-banner-size="">
      <Cap hint={factory ? `its own box · ${nowW}×${auto.h}px` : "free size"}>Banner size</Cap>
      <Field label="Left ↔ right" hint={w === undefined ? `${nowW}px — the shape's own width` : `${w}px`}>
        <Slider
          value={r1(shownW)}
          min={0}
          max={maxW}
          step={1}
          onChange={(v) => setBanner({ size: { ...banner.size, w: v } })}
          ariaLabel="Banner width (px)"
        />
      </Field>
      <Field label="Top ↕ bottom" hint={h === undefined ? "auto — fits the heading" : `${h}px`}>
        <Slider
          value={r1(shownH)}
          min={0}
          max={maxH}
          step={1}
          onChange={(v) => setBanner({ size: { ...banner.size, h: v } })}
          ariaLabel="Banner height (px)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          The shape is {BANNER_WIDTH}px across on the 1280 × 720 board and stays there whatever the heading says — the bar
          paints any other width, in px, growing both ways from the middle so the heading stays centred on its plate.
          Nothing clamps it: the plate may run past the board's own edge.
        </p>
        <AutoBtn on={factory} onClick={() => setBanner({ size: { w: BANNER_WIDTH } })} label={`Banner size: back to the ${BANNER_WIDTH}px shape`} />
      </div>
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
        <Cap hint="while the height is auto">Room above and below the heading</Cap>
        <Field label="Height padding" hint={`${banner.padY}%`}>
          <Slider min={0} max={80} value={banner.padY} onChange={(v) => setBanner({ padY: v })} ariaLabel="Banner height padding (%)" />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banner position — free X & Y                                       */
/* ------------------------------------------------------------------ */

export const POS_LIMIT_X = 1280;
export const POS_LIMIT_Y = 720;

export function BannerPositionPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const x = banner.pos?.x ?? 0;
  const y = banner.pos?.y ?? 0;
  return (
    <div className="space-y-3" data-banner-position="">
      <Cap hint={x || y ? `${x} · ${y} px` : "its own place"}>Banner position</Cap>
      <Field label="X axis — left ↔ right" hint={`${r1(x)} px`}>
        <Slider
          value={r1(Math.max(Math.min(x, rangeMax(POS_LIMIT_X, x)), -rangeMax(POS_LIMIT_X, x)))}
          min={-rangeMax(POS_LIMIT_X, x)}
          max={rangeMax(POS_LIMIT_X, x)}
          step={1}
          onChange={(v) => setBanner({ pos: { ...banner.pos, x: v } })}
          ariaLabel="Banner position X (px)"
        />
      </Field>
      <Field label="Y axis — up ↕ down" hint={`${r1(y)} px`}>
        <Slider
          value={r1(Math.max(Math.min(y, rangeMax(POS_LIMIT_Y, y)), -rangeMax(POS_LIMIT_Y, y)))}
          min={-rangeMax(POS_LIMIT_Y, y)}
          max={rangeMax(POS_LIMIT_Y, y)}
          step={1}
          onChange={(v) => setBanner({ pos: { ...banner.pos, y: v } })}
          ariaLabel="Banner position Y (px)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          The nudge moves the plate alone — the heading stays where it is. Positive X goes right, positive Y goes down, and the
          sliders keep running to the whole board and past it.
        </p>
        <AutoBtn on={!x && !y} onClick={() => setBanner({ pos: undefined })} label="Banner position: back to its own place" />
      </div>
    </div>
  );
}
