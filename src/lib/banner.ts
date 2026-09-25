import {
  BANNER_AUTO_FRAME_HEIGHT,
  BANNER_WIDTH,
  DEFAULT_BANNER,
  DEFAULT_BANNER_BORDER_GLOW,
  DEFAULT_BANNER_EFFECTS,
  DEFAULT_BANNER_GLASS,
  DEFAULT_BANNER_METALLIC,
  DEFAULT_BANNER_PATTERN,
  type Banner3DFx,
  type Banner3DKind,
  type BannerBevelFx,
  type BannerBevelKind,
  type BannerBlurFx,
  type BannerBlurKind,
  type BannerBorderGlow,
  type BannerBorderStyle,
  type BannerCorners,
  type BannerDecorFx,
  type BannerDecorKind,
  type BannerDepthKind,
  type BannerEffects,
  type BannerFillMode,
  type BannerGlassFill,
  type BannerGlassFx,
  type BannerGlassKind,
  type BannerGlowFx,
  type BannerGlowKind,
  type BannerHighlightFx,
  type BannerHighlightKind,
  type BannerMetallicFill,
  type BannerModernFx,
  type BannerModernKind,
  type BannerPatternFill,
  type BannerSettings,
  type BannerShape,
  type BannerShadowFx,
  type BannerShadowKind,
  type BannerShapeFx,
  type Gradient,
  type TextBgEffectKind,
} from "./types";
import { shade, withAlpha } from "./color";
import { rotateHue } from "./textEffects";
import { shapeEffectPasses, type ShapeEffectBehind, type ShapeEffectPasses } from "./shapeEffects";

/* ---------------------------------------------------- silhouette families */

/**
 * The thirteen families the plate's silhouettes are sorted into — the picker's
 * own headings, and the rule that decides *how* a plate is painted. The first
 * eight are the shape library; the last five are the original paint families:
 *
 *   basic       the clean plates — rounded rectangles, soft corners, capsules,
 *               ovals and the curved band
 *   bannerStyle the classic banner cuts — ribbon, points, notches, the folded
 *               ribbon, the scroll, the badge, the tail and the flag
 *   cut         the corner cuts — one cut, two, a diagonal shear, a deep
 *               chamfer, the octagon and the trapezoid
 *   modern      the contemporary cuts — slant, diagonal, angle, skew, the
 *               layered and offset cards, the split, the floating plate and
 *               the stepped band
 *   curve       the curved silhouettes — waves, arch, dome, concave, convex,
 *               the swoosh and the curved ribbon
 *   organic     the freehand shapes — blobs (asymmetric, liquid, amoeba,
 *               freeform), the cloud, the brush and paint strokes and the
 *               highlight
 *   decor       the highlighter's own marks — the marker and highlight strips,
 *               the swoosh highlight, the splash and the burst plates
 *   premium     the dressed plates — double ribbon, triple layer, the 3D,
 *               glass, outline and ticket plates, the seal and the emblem
 *   plate       one body, corners only (glow · box)
 *   stylish     one body cut to another silhouette — a clip-path, or corners
 *               on two edges only (hexagon · chevron · swallowtail · tab)
 *   layered     the body **plus** extra painted layers of its own behind it
 *               (double frame · accent block · long shadow)
 *   gradient    the body painted from **several stacked gradients**, one plate
 *               reading as several (sheen · gloss · stripes) or several plates
 *               each with a gradient of its own (stacked gradient)
 *   mark        a rule instead of a plate (underline · none)
 */
export type BannerShapeFamily =
  | "basic"
  | "bannerStyle"
  | "cut"
  | "modern"
  | "curve"
  | "organic"
  | "decor"
  | "premium"
  | "plate"
  | "stylish"
  | "layered"
  | "gradient"
  | "mark";

export const BANNER_SHAPE_FAMILY: Record<BannerShape, BannerShapeFamily> = {
  /* basic & clean */
  rounded: "basic",
  softRounded: "basic",
  capsule: "basic",
  pill: "basic",
  ovalPlate: "basic",
  circlePlate: "basic",
  halfRound: "basic",
  curvedRect: "basic",
  softSquare: "basic",
  ellipseBanner: "basic",
  /* banner style */
  classicBanner: "bannerStyle",
  titleBanner: "bannerStyle",
  ribbon: "bannerStyle",
  pointedBanner: "bannerStyle",
  doubleEndedBanner: "bannerStyle",
  notch: "bannerStyle",
  cutCorner: "bannerStyle",
  foldedBanner: "bannerStyle",
  scrollBanner: "bannerStyle",
  badgeBanner: "bannerStyle",
  tailBanner: "bannerStyle",
  flagBanner: "bannerStyle",
  /* cut & corner */
  singleCut: "cut",
  doubleCut: "cut",
  diagonalCut: "cut",
  chamferedBanner: "cut",
  octagonBanner: "cut",
  trapezoidBanner: "cut",
  /* modern */
  slant: "modern",
  diagonalBanner: "modern",
  angledBanner: "modern",
  asymmetricBanner: "modern",
  skewedRect: "modern",
  stack: "modern",
  offsetLine: "modern",
  split: "modern",
  floatingPlate: "modern",
  geoPlate: "modern",
  steppedBanner: "modern",
  /* curved & wave */
  waveBanner: "curve",
  curvedBanner: "curve",
  wavyStrip: "curve",
  arch: "curve",
  domeBanner: "curve",
  concaveBanner: "curve",
  convexBanner: "curve",
  swoosh: "curve",
  curvedRibbon: "curve",
  wavePlate: "curve",
  /* organic / decorative */
  organicBlob: "organic",
  abstractBlob: "organic",
  wavyBlob: "organic",
  roundedBlob: "organic",
  cloudShape: "organic",
  brushStroke: "organic",
  paintStroke: "organic",
  highlightBlob: "organic",
  organicPlate: "organic",
  abstractPlate: "organic",
  asymmetricBlob: "organic",
  liquidShape: "organic",
  amoebaShape: "organic",
  freeformBlob: "organic",
  /* decorative / highlight */
  markerStroke: "decor",
  highlightStrip: "decor",
  swooshHighlight: "decor",
  splashShape: "decor",
  burstPlate: "decor",
  sunburstPlate: "decor",
  /* premium / special */
  doubleRibbon: "premium",
  tripleLayer: "premium",
  plate3d: "premium",
  glassPlate: "premium",
  outlineBanner: "premium",
  ticketBanner: "premium",
  sealBadge: "premium",
  emblemPlate: "premium",
  /* the original paint families */
  glow: "plate",
  rect: "plate",
  hex: "stylish",
  chevron: "stylish",
  swallow: "stylish",
  tab: "stylish",
  frame: "layered",
  accent: "layered",
  longShadow: "layered",
  sheen: "gradient",
  gloss: "gradient",
  stripes: "gradient",
  gradStack: "gradient",
  underline: "mark",
  none: "mark",
};

/** every silhouette the renderer paints — the pickers, the tests and the docs */
export const BANNER_SHAPE_IDS = Object.keys(BANNER_SHAPE_FAMILY) as BannerShape[];

/**
 * The silhouettes whose body is *cut* by a clip-path rather than rounded, so
 * the corner radius has nothing to say about them.
 */
export const isClippedShape = (shape: BannerShape): boolean =>
  shape === "ribbon" ||
  shape === "hex" ||
  shape === "notch" ||
  shape === "chevron" ||
  shape === "swallow" ||
  shape === "slant" ||
  shape === "titleBanner" ||
  shape === "pointedBanner" ||
  shape === "doubleEndedBanner" ||
  shape === "cutCorner" ||
  shape === "diagonalBanner" ||
  shape === "angledBanner" ||
  shape === "asymmetricBanner" ||
  shape === "skewedRect" ||
  shape === "geoPlate" ||
  shape === "scrollBanner" ||
  shape === "tailBanner" ||
  shape === "doubleRibbon" ||
  shape === "emblemPlate" ||
  shape === "burstPlate" ||
  shape === "singleCut" ||
  shape === "doubleCut" ||
  shape === "diagonalCut" ||
  shape === "chamferedBanner" ||
  shape === "octagonBanner" ||
  shape === "trapezoidBanner" ||
  shape === "steppedBanner";

/**
 * The silhouettes whose body is *masked* — a smooth silhouette (waves, domes,
 * blobs, strokes) that a corner radius or a clip polygon cannot say. The mask
 * is an SVG that stretches to the plate's own box, so it keeps its curves at
 * 630 px on the board and at thumbnail scale in the picker.
 */
const MASKED_SHAPES: ReadonlySet<BannerShape> = new Set<BannerShape>([
  "curvedRect",
  "waveBanner",
  "curvedBanner",
  "wavyStrip",
  "domeBanner",
  "concaveBanner",
  "convexBanner",
  "swoosh",
  "curvedRibbon",
  "wavePlate",
  "organicBlob",
  "abstractBlob",
  "wavyBlob",
  "roundedBlob",
  "cloudShape",
  "brushStroke",
  "paintStroke",
  "highlightBlob",
  "organicPlate",
  "abstractPlate",
  /* the flag flutters, so its free end is a curve no polygon can say */
  "flagBanner",
  "asymmetricBlob",
  "liquidShape",
  "amoebaShape",
  "freeformBlob",
  "markerStroke",
  "highlightStrip",
  "swooshHighlight",
  "splashShape",
  "sealBadge",
  "ticketBanner",
]);

export const isMaskedShape = (shape: BannerShape): boolean => MASKED_SHAPES.has(shape);


/** the stage every deck is designed on (Slide.tsx) — the plate's px speak in it */
export const BOARD_W = 1280;
export const BOARD_H = 720;

/**
 * Every silhouette can wear an outline — the soft glow and the underline rule
 * included, since the line follows the plate's own box. Only "none" (no plate)
 * has nothing to outline.
 */
export const canOutline = (shape: BannerSettings["shape"]): boolean => shape !== "none";

export const bannerBorderStyle = (b: BannerSettings): BannerBorderStyle => b.border.style ?? "solid";

/** the outline is painted as its own layer, so it needs to exist at all */
export const bannerHasLine = (b: BannerSettings): boolean =>
  b.border.enabled && (b.border.opacity ?? 1) > 0 && b.border.width > 0 && bannerBorderStyle(b) !== "none" && canOutline(b.shape);

export const clampOpacity = (v: number | undefined, fallback = 1): number =>
  Math.max(0, Math.min(1, Number.isFinite(v) ? (v as number) : fallback));

/* ------------------------------------------------------------------ */
/*  Border ▸ Border radius — the four corners, one by one              */
/* ------------------------------------------------------------------ */

/** the full ovals: their "corners" are the whole curve, so there is none to set */
const OVAL_SHAPES: ReadonlySet<BannerShape> = new Set<BannerShape>(["capsule", "ovalPlate", "circlePlate", "ellipseBanner"]);

/**
 * Can this silhouette's corners be set one by one? Every plate with four
 * corners to round can — the box, the pill, the tab, the cards, the soft glow's
 * outline. The cut silhouettes are shaped by a clip-path and the smooth ones by
 * a mask, so a radius has nothing to say to them, and the full ovals have no
 * corner at all.
 */
export const takesCorners = (shape: BannerShape): boolean =>
  shape !== "none" && !isClippedShape(shape) && !isMaskedShape(shape) && !OVAL_SHAPES.has(shape);

/** the largest corner "Each corner" starts from — past the plate's half height a corner is a full curve anyway */
export const CORNER_SEED_MAX = 120;

const cornerPx = (v: unknown, fallback = 0): number =>
  Math.max(0, typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : fallback);

/**
 * The corners the plate paints right now, one px value each — what the Border
 * card's *Each corner* starts from, so flipping it on never moves a corner: a
 * tab keeps its square bottom, a half-round its square top, the soft plates
 * their wide curve, and a pill its round ends (capped at CORNER_SEED_MAX, where
 * a corner on a chip this tall is a half circle already).
 */
export function bannerCornersNow(b: BannerSettings): BannerCorners {
  const cap = (v: number) => Math.min(CORNER_SEED_MAX, cornerPx(v));
  const r = plateRadius({ ...b, cornersIndependent: false });
  if (typeof r === "number") {
    const v = cap(r);
    return { tl: v, tr: v, br: v, bl: v };
  }
  if (typeof r === "string" && !r.includes("%")) {
    // "14px 14px 0 0" — CSS reads one to four values, clockwise from top-left
    const parts = r.split("/")[0].trim().split(/\s+/).map((p) => Number.parseFloat(p));
    if (parts.length && parts.every((p) => Number.isFinite(p))) {
      const [tl, tr = tl, br = tl, bl = tr] = parts;
      return { tl: cap(tl), tr: cap(tr), br: cap(br), bl: cap(bl) };
    }
  }
  return { tl: 0, tr: 0, br: 0, bl: 0 };
}

/** the four corners the Border card holds — the ones it set, else the ones the plate paints */
export function bannerCorners(b: BannerSettings): BannerCorners {
  const c = b.corners;
  if (!c) return bannerCornersNow(b);
  return { tl: cornerPx(c.tl), tr: cornerPx(c.tr), br: cornerPx(c.br), bl: cornerPx(c.bl) };
}

/** is the plate wearing corners set one by one right now? */
export const bannerCornersOn = (b: BannerSettings): boolean => !!b.cornersIndependent && takesCorners(b.shape);

/**
 * Does the silhouette's own corner move with the *All corners* bar? The rounded
 * plates and the cards do; the pill, the arch and the underline keep their
 * round ends, the classic bar its tight corner, the box its square one — those
 * only answer to *Each corner*.
 */
export const radiusFollowsBar = (b: BannerSettings): boolean => {
  const at = (radius: number) => String(plateRadius({ ...b, radius, cornersIndependent: false }));
  return at(14) !== at(24);
};

/* ------------------------------------------------------------------ */
/*  Border ▸ Border glow                                               */
/* ------------------------------------------------------------------ */

/**
 * The outline's glow, read safely (older decks never saved one, and a deck
 * written by hand may carry anything) — undefined while it is off, or while
 * there is no line to give it off.
 */
export function bannerBorderGlow(b: BannerSettings): BannerBorderGlow | undefined {
  const g = b.border.glow;
  if (!g?.enabled || !bannerHasLine(b)) return undefined;
  const size = Number.isFinite(g.size) ? Math.max(0, g.size) : DEFAULT_BANNER_BORDER_GLOW.size;
  const intensity = Number.isFinite(g.intensity) ? Math.max(0, Math.min(100, g.intensity)) : DEFAULT_BANNER_BORDER_GLOW.intensity;
  if (size <= 0 || intensity <= 0) return undefined;
  return { enabled: true, size, intensity, color: typeof g.color === "string" ? g.color.trim() : "" };
}

/** the line's own paint as ONE colour — its gradient blended while one is on */
export const bannerBorderPaintColor = (b: BannerSettings): string => channelPaint(b.border.color, b.border.gradient) || b.border.color;

/** the glow's colour: its own (a picked gradient blends), or the line's while it is left on Auto */
export const bannerBorderGlowColor = (b: BannerSettings): string => {
  const g = b.border.glow;
  const own = g?.gradient?.enabled ? gradientPaintColor(g.gradient, g.color?.trim() ?? "") : g?.color?.trim() ?? "";
  return own || bannerBorderPaintColor(b);
};

/**
 * The glow as a filter on the outline's own layer: a tight bloom hugging the
 * line and a wide soft one around it, both in the glow's colour. A filter
 * follows what the layer really paints, so the light traces the dashes and the
 * dots, rounds the corners with the line, and fades with Border transparency
 * (the shadow is cast from the line's own alpha).
 */
export function bannerBorderGlowFilter(b: BannerSettings): string | undefined {
  const g = bannerBorderGlow(b);
  if (!g) return undefined;
  const color = bannerBorderGlowColor(b);
  const i = g.intensity / 100;
  const near = Math.max(1, Math.round(g.size * 3.5) / 10);
  const a = (v: number) => Math.round(Math.min(1, v) * 100) / 100;
  return `drop-shadow(0 0 ${near}px ${withAlpha(color, a(0.35 + 0.65 * i))}) drop-shadow(0 0 ${g.size}px ${withAlpha(color, a(0.2 + 0.7 * i))})`;
}

/** `+ 12px` / `- 12px` — a signed nudge inside a calc() */
const nudge = (v: number) => (v < 0 ? `- ${Math.abs(v)}px` : `+ ${v}px`);

/**
 * The width a deck's plate paints at, in px of the 1280 × 720 stage: the
 * teacher's own number when they set one on the Banner size card, and the
 * factory chip (`BANNER_WIDTH`, 630 px) otherwise. Every path that dresses the
 * plate — a design preset, a slide design, the size card's own Default button —
 * writes this width instead of leaving the plate to hug the heading, so the
 * shape is 630 px across whatever the heading says.
 */
export const bannerPlateWidth = (b: BannerSettings): number => b.size?.w ?? BANNER_WIDTH;

/**
 * The width a plate actually paints at. A deck always carries a free size of
 * its own, so its plate is the teacher's px or the 630 px chip — including the
 * decks saved before the width was fixed, which may carry a height and no
 * width. Only the small previews inside the panels pass no size at all, and
 * those paint the plate hugging their own thumbnail.
 */
const paintedWidth = (b: BannerSettings): number | undefined => b.size?.w ?? (b.size ? BANNER_WIDTH : undefined);

/**
 * How much taller a silhouette paints its own automatic box than the line
 * frame it sits on. Most silhouettes are wide, flat chips — factor 1, the line
 * frame plus its padding. The round and the freehand ones read wrong squeezed
 * to that flat box, so they stretch it: the circle and the oval go tall, the
 * blobs and the cloud go round, and the strokes go slim. A free height always
 * wins — the factor only talks while the height is automatic.
 */
export function plateHeightFactor(shape: BannerShape): number {
  switch (shape) {
    case "circlePlate":
      return 2.2;
    case "domeBanner":
      return 1.8;
    case "cloudShape":
      return 1.7;
    case "ovalPlate":
      return 1.6;
    case "ellipseBanner":
      return 1.5;
    case "roundedBlob":
      return 1.5;
    case "swoosh":
      return 1.5;
    case "organicBlob":
      return 1.4;
    case "wavyBlob":
      return 1.4;
    case "highlightBlob":
      return 1.4;
    case "abstractBlob":
      return 1.35;
    case "softSquare":
      return 1.35;
    case "organicPlate":
      return 1.25;
    case "abstractPlate":
      return 1.2;
    case "wavyStrip":
      return 0.95;
    case "brushStroke":
      return 0.9;
    case "paintStroke":
      return 0.9;
    /* the round and freehand silhouettes added later read wrong squeezed to
       the flat chip, so each stretches its automatic box by its own factor */
    case "sealBadge":
      return 1.6;
    case "splashShape":
      return 1.45;
    case "amoebaShape":
      return 1.4;
    case "asymmetricBlob":
      return 1.35;
    case "freeformBlob":
      return 1.3;
    case "liquidShape":
      return 1.3;
    case "emblemPlate":
      return 1.25;
    case "burstPlate":
      return 1.25;
    case "sunburstPlate":
      return 1.2;
    case "swooshHighlight":
      return 1.2;
    case "flagBanner":
      return 1.15;
    case "ticketBanner":
      return 1.15;
    case "markerStroke":
      return 0.9;
    case "highlightStrip":
      return 0.85;
    default:
      return 1;
  }
}

/**
 * The plate's box. Width and height are read the same way: a px box when the
 * teacher sized it, the plate's own automatic box otherwise — automatic width
 * being the 630 px chip (`paintedWidth`), automatic height the line frame plus
 * its padding, and for the round and freehand silhouettes that automatic box
 * stretched by their own factor (`plateHeightFactor`), re-centred on the line.
 */
export function plateRect(b: BannerSettings): Pick<React.CSSProperties, "left" | "top" | "width" | "height"> {
  const x = b.pos?.x ?? 0;
  const y = b.pos?.y ?? 0;
  const w = paintedWidth(b);
  const h = b.size?.h;
  const f = plateHeightFactor(b.shape);
  const autoH = `100% + ${2 * b.padY}%`;
  return {
    // free size is centred on the title (where the plate already sits), so
    // resizing grows both ways and the glyphs stay in the middle of the plate
    // the nudge stays a term of its own, so a plate can be read (and tested) as
    // "centred, then moved" instead of one folded number
    left: w === undefined ? `calc(-${b.padX}% ${nudge(x)})` : `calc(50% ${nudge(x)} ${nudge(-w / 2)})`,
    top:
      h === undefined
        ? f === 1
          ? `calc(-${b.padY}% ${nudge(y)})`
          : `calc((100% - (${autoH}) * ${f}) / 2 ${nudge(y)})`
        : `calc(50% ${nudge(y)} ${nudge(-h / 2)})`,
    width: w === undefined ? `calc(100% + ${2 * b.padX}%)` : `${w}px`,
    height: h === undefined ? (f === 1 ? `calc(${autoH})` : `calc((${autoH}) * ${f})`) : `${h}px`,
  };
}

/**
 * The plate's corner radius for the silhouette in use. A number for the
 * silhouettes that round all four corners, a CSS string for the ones that round
 * two edges only (tab, half-round) or all four to a full oval (capsule, oval,
 * circle, ellipse banner), and nothing at all for the cut and the masked
 * silhouettes — their corners are cut by a clip-path or a mask, so a radius
 * would have nothing to say.
 *
 * The Border card's *Each corner* wins over all of that on every plate that
 * has corners to round (`takesCorners`): the four px values it holds, clockwise
 * from the top-left — the plate's layers, its effects and its outline all read
 * the corners from here, so they turn together.
 */
export function plateRadius(b: BannerSettings): number | string | undefined {
  if (bannerCornersOn(b)) {
    const c = bannerCorners(b);
    return `${c.tl}px ${c.tr}px ${c.br}px ${c.bl}px`;
  }
  switch (b.shape) {
    case "pill":
    case "badgeBanner":
    case "underline":
      return 999;
    // a tab is rounded along the top and square along the bottom, an arch is a
    // full half-round on top, a half-round the other way round — the tab and
    // the arch keep the plate's own radius for the curve
    case "tab":
      return `${b.radius}px ${b.radius}px 0 0`;
    case "arch":
      return "999px 999px 0 0";
    case "halfRound":
      return `0 0 ${b.radius}px ${b.radius}px`;
    // the soft silhouettes round past the plate's own corner — much wider, so
    // a 14 px corner on a 31 px plate reads as a card, not as a bar
    case "softRounded":
      return Math.max(30, Math.round(b.radius * 2.2));
    case "softSquare":
      return Math.max(18, Math.round(b.radius * 1.4));
    // a true oval — the corners carry 50% of the width and 100% of the height,
    // so the plate is an ellipse at any box and the outline follows it
    case "capsule":
    case "ovalPlate":
    case "circlePlate":
    case "ellipseBanner":
      return "50% / 100%";
    // the classic bar keeps its own tight corner whatever the slider says
    case "classicBanner":
      return 8;
  }
  if (isClippedShape(b.shape) || isMaskedShape(b.shape)) return undefined;
  if (b.shape === "rounded" || b.shape === "glow") return b.radius;
  // the modern cards (layered · offset · split · floating), the dressed premium
  // plates (3D · glass · outline · triple layer), the sunburst plate and the
  // folded ribbon's body are cards: they take the corner as set
  if (
    b.shape === "foldedBanner" ||
    BANNER_SHAPE_FAMILY[b.shape] === "layered" ||
    BANNER_SHAPE_FAMILY[b.shape] === "gradient" ||
    BANNER_SHAPE_FAMILY[b.shape] === "modern" ||
    BANNER_SHAPE_FAMILY[b.shape] === "premium" ||
    BANNER_SHAPE_FAMILY[b.shape] === "decor"
  )
    return b.radius;
  return undefined;
}

/**
 * The glow's reach inside the plate's own box. The plate is a wide, flat chip,
 * so the light is an oval a touch wider than it is tall — and because it is
 * written in % of the plate, it keeps that proportion at any size.
 */
export const GLOW_ELLIPSE = "ellipse 56% 62% at 50% 50%";

/**
 * How deep a cut silhouette reaches in, in px of the board — the ribbon's notch,
 * and the cut corners' slice, which shares the same depth. The plate is a tight
 * chip now, so the cut is cut to match — and once the teacher has sized the
 * plate by hand the cut follows the height instead of holding a fixed depth, so
 * a short plate still reads as a ribbon and not as an arrow. The *pointed*
 * silhouettes (hexagon, chevron, swallowtail, slant) reach deeper still —
 * `plateTip` below.
 */
export const RIBBON_NOTCH = 16;

export function ribbonNotch(b: BannerSettings): number {
  const h = b.size?.h;
  if (typeof h !== "number" || !Number.isFinite(h)) return RIBBON_NOTCH;
  return Math.max(6, Math.min(RIBBON_NOTCH, Math.round(h * 0.28)));
}

/** the ribbon's silhouette — one string, painted by the body and the outline alike */
export const ribbonClipPath = (b: BannerSettings): string => {
  const d = ribbonNotch(b);
  return `polygon(0 0, 100% 0, calc(100% - ${d}px) 50%, 100% 100%, 0 100%, ${d}px 50%)`;
};

/**
 * How far a *pointed* silhouette reaches in — a hexagon's tips, a chevron's
 * arrow, a swallowtail's V, a slant's lean. A tip cut only 16 px deep on a
 * 630 px plate reads as a mistake, so the pointed shapes take a deeper cut than
 * the ribbon's notch; the rule that keeps it honest at any plate height is the
 * same one (`ribbonNotch`).
 */
export const plateTip = (b: BannerSettings): number => Math.max(20, Math.round(ribbonNotch(b) * 1.8));

/**
 * A starburst cut, written in % of the plate's own box so its rays stretch with
 * it — a wide plate bursts wide, a hand-sized square plate bursts round, and a
 * thumbnail in the picker bursts exactly like the board. `points` is how many
 * rays it carries and `inner` how deep the valleys between them reach (1 = the
 * box's own edge, 0.7 = a deep spike).
 */
export function burstPolygon(points: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : inner;
    pts.push(`${(50 + 50 * r * Math.cos(a)).toFixed(2)}% ${(50 + 50 * r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

/**
 * The cut silhouette in use, as one clip-path string — the body wears it and
 * the outline's own layer wears the very same string, so a border follows the
 * hexagon's tips and the chevron's arrow instead of running off them.
 */
export function plateClipPath(b: BannerSettings): string | undefined {
  const d = ribbonNotch(b);
  const t = plateTip(b);
  switch (b.shape) {
    case "ribbon":
      return ribbonClipPath(b);
    // pointed at both ends: a hexagon badge
    case "hex":
      return `polygon(0% 50%, ${t}px 0%, calc(100% - ${t}px) 0%, 100% 50%, calc(100% - ${t}px) 100%, ${t}px 100%)`;
    // two corners sliced off, top-left and bottom-right
    case "notch":
      return `polygon(${d}px 0, 100% 0, 100% calc(100% - ${d}px), calc(100% - ${d}px) 100%, 0 100%, 0 ${d}px)`;
    // square at the start, an arrow tip at the end
    case "chevron":
      return `polygon(0 0, calc(100% - ${t}px) 0, 100% 50%, calc(100% - ${t}px) 100%, 0 100%)`;
    // a flag with a V cut into its trailing end
    case "swallow":
      return `polygon(0 0, 100% 0, calc(100% - ${t}px) 50%, 100% 100%, 0 100%)`;
    // a parallelogram: both ends leaning
    case "slant":
      return `polygon(${t}px 0, 100% 0, calc(100% - ${t}px) 100%, 0 100%)`;
    // a square body with a colour strip riding its leading end — the strip is
    // a layer of its own behind the body, so the body is cut back from it
    case "titleBanner":
      return "inset(0 0 0 14% round 0 12px 12px 0)";
    // a tag with a long, sharp point at its trailing end — deeper than the
    // chevron's tip, so the two read apart
    case "pointedBanner": {
      const p = Math.round(t * 1.8);
      return `polygon(0 0, calc(100% - ${p}px) 0, 100% 50%, calc(100% - ${p}px) 100%, 0 100%)`;
    }
    // a bookmark: a shallow point at each end
    case "doubleEndedBanner":
      return `polygon(${d}px 0, calc(100% - ${d}px) 0, 100% 50%, calc(100% - ${d}px) 100%, ${d}px 100%, 0 50%)`;
    // all four corners bevelled — the notched banner's square cousin
    case "cutCorner":
      return `polygon(${d}px 0, calc(100% - ${d}px) 0, 100% ${d}px, 100% calc(100% - ${d}px), calc(100% - ${d}px) 100%, ${d}px 100%, 0 calc(100% - ${d}px), 0 ${d}px)`;
    // one straight edge diagonal: the left side leans, the right stays square
    case "diagonalBanner":
      return "polygon(0 0, 100% 0, 100% 100%, 12% 100%)";
    // one corner cut on the long bias — the plate's own tip, run deep
    case "angledBanner": {
      const a = Math.round(t * 2.2);
      return `polygon(0 0, calc(100% - ${a}px) 0, 100% ${a}px, 100% 100%, 0 100%)`;
    }
    // taller at the start, stepping in to the end
    case "asymmetricBanner":
      return "polygon(0 0, 100% 10%, 100% 90%, 0 100%)";
    // a shallow lean — the slant's cousin, cut to the ribbon's notch
    case "skewedRect":
      return `polygon(${d}px 0, 100% 0, calc(100% - ${d}px) 100%, 0 100%)`;
    // two opposite corners bevelled deep — the notched banner's mirror, with
    // its own inner rule
    case "geoPlate":
      return `polygon(0 0, calc(100% - ${t}px) 0, 100% ${t}px, 100% 100%, ${t}px 100%, 0 calc(100% - ${t}px))`;
    // the parchment, cut in from its rolled ends — the rollers are layers
    // behind it, painted in the gap the cut leaves
    case "scrollBanner":
      return "inset(3% 7% 3% 7% round 6px)";
    /* ---- the banner cuts added later ---------------------------------- */
    // a banner with a forked tail at each end — the tails step out past the
    // body and are notched back into themselves
    case "tailBanner":
      return "polygon(0 20%, 12% 20%, 12% 0, 88% 0, 88% 20%, 100% 20%, 100% 100%, 88% 78%, 88% 100%, 12% 100%, 12% 78%, 0 100%)";
    // the ribbon's own cut, worn by the double ribbon's body — its two tails
    // are layers behind it
    case "doubleRibbon":
      return ribbonClipPath(b);
    // one end cut on the bias, the leading edge square
    case "singleCut":
      return `polygon(0 0, 100% 0, calc(100% - ${t}px) 100%, 0 100%)`;
    // two cuts, both on the top edge — the bottom stays square. The cut's reach
    // down is capped at the plate's own height, so a short plate still closes
    case "doubleCut": {
      const dy = `min(${t}px, 40%)`;
      return `polygon(${t}px 0, calc(100% - ${t}px) 0, 100% ${dy}, 100% 100%, 0 100%, 0 ${dy})`;
    }
    // the whole plate sheared: both long edges run on the same diagonal
    case "diagonalCut":
      return "polygon(0 0, 100% 16%, 100% 100%, 0 84%)";
    // all four corners chamfered deep — the cut-corner banner run long. The
    // bevel's reach down the sides is capped at the plate's own height (`min`
    // against a % of it), so a short plate bevels into a clean octagon instead
    // of folding over itself
    case "chamferedBanner": {
      const a = Math.round(t * 1.6);
      const ay = `min(${a}px, 38%)`;
      return `polygon(${a}px 0, calc(100% - ${a}px) 0, 100% ${ay}, 100% calc(100% - ${ay}), calc(100% - ${a}px) 100%, ${a}px 100%, 0 calc(100% - ${ay}), 0 ${ay})`;
    }
    // eight sides, proportioned for a wide plate — the hexagon's cousin
    case "octagonBanner":
      return "polygon(9% 0, 91% 0, 100% 34%, 100% 66%, 91% 100%, 9% 100%, 0 66%, 0 34%)";
    // narrow across the top, wide across the bottom
    case "trapezoidBanner":
      return "polygon(12% 0, 88% 0, 100% 100%, 0 100%)";
    // both long edges step down — a staircase band
    case "steppedBanner":
      return "polygon(0 0, 33% 0, 33% 11%, 66% 11%, 66% 22%, 100% 22%, 100% 100%, 66% 100%, 66% 89%, 33% 89%, 33% 78%, 0 78%)";
    // a burst of twelve deep rays around the heading
    case "burstPlate":
      return burstPolygon(12, 0.72);
    // an emblem: square shoulders, a point at the bottom centre
    case "emblemPlate":
      return "polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)";
    default:
      return undefined;
  }
}

/**
 * The masked silhouettes' own cut, as one CSS mask-image string. The mask is
 * an SVG drawn in a 100 × 40 box — the plate's own ratio — with
 * `preserveAspectRatio="none"`, so it stretches to whatever box the plate
 * paints at: the curves hold at 630 px on the board, in the 320 px preview and
 * at thumbnail scale in the picker alike. A data-URL, so the export carries
 * it with the plate and no request goes out for it.
 */
/**
 * A scalloped seal, drawn in the same 100 × 40 box the other masks live in: an
 * ellipse whose radius ripples `lobes` times around itself, so the edge reads
 * as a ring of small arcs — a notary's seal, stretched to whatever box the
 * plate paints at. The ripple is *compensated*: the mask stretches ~6× across
 * and 2× down, so a plain radial ripple would spike at the seal's ends; each
 * lobe instead reaches the same few px out in every direction.
 */
function scallopPath(lobes: number, depthPx: number): string {
  const steps = lobes * 8;
  // the plate's own px radii at the 630 × 80 chip the shapes are drawn on
  const px = 49 * (630 / 100);
  const py = 18.5 * (80 / 40);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * 2 * i) / steps;
    const reach = Math.hypot(px * Math.cos(a), py * Math.sin(a));
    // the lobes: the edge swells out by `depthPx` and back, `lobes` times round
    const r = 1 + (depthPx / reach) * (0.5 + 0.5 * Math.cos(lobes * a));
    pts.push(`${i === 0 ? "M" : "L"}${(50 + 49 * r * Math.cos(a)).toFixed(2)} ${(20 + 18.5 * r * Math.sin(a)).toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
}

const MASK_PATHS: Partial<Record<BannerShape, string>> = {
  /* basic & clean — the curved band */
  curvedRect: "M0 16 Q 50 2 100 16 L 100 26 Q 50 40 0 26 Z",
  /* curved & wave — bands bent on their long edges */
  waveBanner: "M0 10 C 15 2 30 2 45 10 C 60 18 75 18 100 10 L 100 30 C 85 38 70 38 55 30 C 40 22 25 22 0 30 Z",
  curvedBanner: "M0 18 Q 50 4 100 18 L 100 36 L 0 36 Z",
  wavyStrip: "M0 10 C 15 -2.5 30 -2.5 50 10 C 65 17.5 80 17.5 100 10 L 100 30 C 80 42.5 65 42.5 50 30 C 30 22.5 15 22.5 0 30 Z",
  domeBanner: "M0 34 C 2 12 24 2 50 2 C 76 2 98 12 100 34 L 100 40 L 0 40 Z",
  concaveBanner: "M0 8 Q 50 22 100 8 L 100 32 Q 50 18 0 32 Z",
  convexBanner: "M0 10 Q 50 -4 100 10 L 100 30 Q 50 44 0 30 Z",
  swoosh: "M0 14 C 24 4 52 10 100 32 C 74 30 40 36 0 32 Z",
  curvedRibbon: "M0 12 C 16 2 32 2 50 12 C 68 22 84 22 100 12 L 100 26 C 84 36 68 36 50 26 C 32 16 16 16 0 26 Z",
  wavePlate: "M0 2 L 100 2 L 100 24 C 88 32 76 22 62 27 C 48 32 36 24 22 29 C 14 32 6 30 0 27 Z",
  /* organic / decorative — the freehand silhouettes */
  organicBlob: "M18 5 C 34 1 58 1 74 5 C 89 9 98 15 95 24 C 92 33 75 38 57 36 C 41 40 20 38 10 31 C 1 24 3 10 18 5 Z",
  abstractBlob: "M12 8 L 40 2 L 66 8 L 98 14 L 90 30 L 62 38 L 28 36 L 4 26 Z",
  wavyBlob: "M16 7 C 20 2 28 6 34 3 C 40 0 48 6 54 3 C 60 0 68 6 74 3 C 80 0 90 6 92 14 C 96 20 92 28 84 32 C 78 36 70 30 62 36 C 54 40 44 32 36 38 C 28 40 16 34 12 26 C 8 20 12 12 16 7 Z",
  roundedBlob: "M30 2 C 55 2 80 4 90 14 C 99 23 98 31 86 35 C 68 40 30 40 16 35 C 3 30 1 20 10 12 C 16 5 20 2 30 2 Z",
  cloudShape: "M20 32 C 9 32 4 23 12 17 C 9 8 21 2 30 7 C 34 0 48 0 52 6 C 58 0 70 2 72 8 C 82 4 92 10 90 18 C 98 22 94 31 84 32 Z",
  brushStroke: "M0 15 C 14 9 30 7 46 9 C 62 11 78 10 100 15 C 80 19 64 22 48 22 C 32 23 14 21 0 24 C 2 21 2 18 0 15 Z",
  paintStroke: "M0 10 C 16 6 30 8 44 12 C 62 14 84 16 100 20 C 84 24 62 26 44 28 C 30 32 16 34 0 30 Z",
  organicPlate: "M8 12 C 22 4 42 2 60 4 C 78 5 92 8 96 16 C 99 23 94 30 82 33 C 64 37 38 38 22 35 C 10 33 2 28 4 20 C 5 16 6 14 8 12 Z",
  abstractPlate: "M6 6 L 58 0 L 100 10 L 94 32 L 40 40 L 0 30 Z",
  /* banner style — the flag, fluttering on its free end */
  flagBanner: "M0 7 C 18 3 38 11 58 7 C 72 4 86 9 100 5 L 90 20 L 100 35 C 86 31 72 36 58 33 C 38 37 18 29 0 33 Z",
  /* organic — the freehand silhouettes added later */
  asymmetricBlob:
    "M2 22 C 10 18 20 18 30 15 C 42 12 46 6 58 5 C 66 4 70 9 78 8 C 88 7 97 12 99 20 C 101 30 88 37 70 38 C 52 39 42 33 30 31 C 16 29 5 27 2 22 Z",
  liquidShape:
    "M0 6 C 20 2 40 10 60 6 C 78 3 92 8 100 5 L 100 24 C 96 24 94 31 90 31 C 86 31 85 24 81 24 C 78 24 77 35 72 35 C 67 35 66 25 62 25 C 58 25 57 31 52 31 C 47 31 46 25 42 25 C 38 25 37 37 31 37 C 25 37 25 25 20 25 C 15 25 14 30 9 30 C 5 30 4 24 0 24 Z",
  amoebaShape:
    "M12 14 C 16 6 26 8 34 4 C 40 1 46 8 54 6 C 60 4 64 10 72 8 C 82 6 92 8 96 15 C 100 22 92 26 84 27 C 78 28 76 34 68 34 C 60 34 58 28 50 30 C 42 32 40 38 30 36 C 20 34 18 28 10 26 C 2 24 6 19 12 14 Z",
  freeformBlob:
    "M2 14 C 10 6 24 10 34 6 C 46 1 60 8 72 5 C 84 2 98 8 98 16 C 98 24 90 26 84 31 C 76 37 64 33 54 36 C 42 39 32 34 22 36 C 12 38 2 32 1 24 C 0.6 20 1 17 2 14 Z",
  /* decorative / highlight — the highlighter's own marks */
  markerStroke: "M0 13 L 24 10 L 52 9 L 78 8 L 100 10 L 99 18 L 98 27 L 70 28 L 40 30 L 12 31 L 0 27 Z",
  highlightStrip: "M0 14 C 16 12 34 15 50 13 C 66 11 84 14 100 12 L 100 30 C 84 32 66 29 50 31 C 34 33 16 30 0 32 Z",
  splashShape:
    "M20 9 C 32 2 50 4 60 10 C 70 3 88 5 92 15 C 101 19 97 30 87 32 C 79 39 62 37 52 33 C 40 39 23 37 15 29 C 5 25 7 13 20 9 Z M3.4 14 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z M92.8 6 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M48.2 36.6 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 Z",
  /* premium / special — the ticket, bitten at its perforations, and the seal */
  ticketBanner:
    "M3 0 H97 A3 3 0 0 1 100 3 V37 A3 3 0 0 1 97 40 H3 A3 3 0 0 1 0 37 V3 A3 3 0 0 1 3 0 Z M14 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z M78 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z M14 40 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z M78 40 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z",
  sealBadge: scallopPath(22, 5),
};

/**
 * The masks whose path carries holes of its own — the ticket's bites are circles
 * laid over its body, so the path is filled `evenodd` for them to punch through
 * instead of adding to it.
 */
const MASK_EVEN_ODD: ReadonlySet<BannerShape> = new Set<BannerShape>(["ticketBanner"]);

/** the highlight blob's soft edge — the same blob, feathered by a blur */
const HIGHLIGHT_MASK_PATH =
  "M25 4 C 50 0 75 4 88 14 C 98 22 92 32 76 36 C 56 41 30 40 16 32 C 4 25 2 14 10 8 C 14 5 18 4 25 4 Z";

/** the swoosh highlight's soft edge — a tapered sweep, feathered the same way */
const SWOOSH_HIGHLIGHT_MASK_PATH =
  "M2 23 C 20 11 44 6 70 10 C 84 12 94 18 99 27 C 82 22 62 22 44 26 C 30 29 14 31 2 29 Z";

/**
 * The two silhouettes whose edge is *feathered* rather than drawn: the blur
 * lives inside the mask's own SVG, so nothing on the plate carries a `filter`
 * of its own and the halo stays the only blurred layer on the board.
 */
const SOFT_MASK_PATHS: Partial<Record<BannerShape, string>> = {
  highlightBlob: HIGHLIGHT_MASK_PATH,
  swooshHighlight: SWOOSH_HIGHLIGHT_MASK_PATH,
};

const maskUrl = (inner: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='none'>${inner}</svg>`,
  )}")`;

/** the masked silhouette in use, as one mask-image string — `undefined` for every other body */
export function plateMask(b: BannerSettings): string | undefined {
  const soft = SOFT_MASK_PATHS[b.shape];
  if (soft)
    return maskUrl(
      `<defs><filter id='h' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='2.5'/></filter></defs><path d='${soft}' fill='black' filter='url(#h)'/>`,
    );
  const d = MASK_PATHS[b.shape];
  if (!d) return undefined;
  const rule = MASK_EVEN_ODD.has(b.shape) ? " fill-rule='evenodd'" : "";
  return maskUrl(`<path d='${d}' fill='black'${rule}/>`);
}

/* ------------------------------------------- the plate's effects ---------- */

/** 0–100 → 0–1, clamped, never NaN */
const fxA = (v: number) => clampOpacity(v / 100);

/**
 * The effects a plate wears, merged with the factory set. Decks saved before
 * the Effects card carried no `effects` at all — and a preset or a partial
 * write may leave one group missing — so every group reads back to its own
 * default rather than `undefined`.
 */
export function bannerEffectsOf(b: BannerSettings): BannerEffects {
  const e = b.effects;
  const glass = e?.glass ?? legacyGlass(b, e?.modern);
  const out: BannerEffects = {
    shadow: e?.shadow,
    blur: e?.blur,
    bevel: e?.bevel,
    threeD: e?.threeD,
    glass,
    // The old glow and decoration cards moved their highlights and their
    // outline glow into the categories above, so what stays behind is only what
    // is still a bloom or still a decoration. A glow the card itself wrote
    // carries a `blur` number — the old one never did — which is how the two
    // are told apart.
    glow: (e?.glow && typeof e.glow.blur === "number" ? e.glow : legacyGlow(e?.glow, e?.decor)),
    highlight: e?.highlight ?? legacyHighlight(e?.glow, e?.decor),
    decor: e?.decor && !BANNER_DECOR_LEAVES[e.decor.kind] ? e.decor : undefined,
    modern: e?.modern && !(BANNER_GLASS_PANE as string[]).includes(e.modern.kind) ? e.modern : undefined,
    shape: { ...DEFAULT_BANNER_EFFECTS.shape, ...(e?.shape ?? {}) },
  };
  const d = e?.depth;
  if (d) {
    if (BANNER_DEPTH_BEVELS.includes(d.kind)) {
      out.bevel ??= { kind: d.kind as BannerBevelKind, intensity: d.intensity, blur: 2, angle: d.angle ?? 0, color: "" };
    } else {
      out.threeD ??= { kind: d.kind as Banner3DKind, intensity: d.intensity, blur: 0, angle: 90, color: "" };
    }
  }
  const c = e?.common;
  if (c && c.kind !== "none") {
    const color = c.color ?? "";
    const shadowKind = BANNER_COMMON_SHADOWS[c.kind];
    const glowKind = BANNER_COMMON_GLOWS[c.kind];
    const highlightKind = BANNER_COMMON_HIGHLIGHTS[c.kind];
    if (shadowKind) out.shadow ??= { kind: shadowKind, ...BANNER_SHADOW_DEFAULTS[shadowKind], color };
    else if (glowKind)
      out.glow ??= {
        kind: glowKind,
        intensity: c.intensity,
        blur: BANNER_GLOW_DEFAULTS[glowKind].blur,
        /* neon with an outline blooms in the outline's colour, the way it always did */
        color: color || (c.kind === "neon" && b.border.enabled ? bannerBorderPaintColor(b) : ""),
      };
    else if (highlightKind)
      out.highlight ??= {
        kind: highlightKind,
        intensity: c.intensity,
        blur: BANNER_HIGHLIGHT_DEFAULTS[highlightKind].blur,
        angle: 0,
        color,
      };
    else if (c.kind === "blur") out.blur ??= { kind: "soft", blur: 12, intensity: c.intensity, angle: 90, color };
    else if (c.kind === "glass") out.glass ??= { kind: "glass", intensity: c.intensity, blur: 8, color };
    else if (c.kind === "bevel" || c.kind === "emboss")
      out.bevel ??= { kind: c.kind, intensity: c.intensity, blur: BANNER_BEVEL_DEFAULTS[c.kind].blur, angle: 0, color };
    else if ((BANNER_SHARED_DECOR as string[]).includes(c.kind))
      out.decor ??= { kind: c.kind as unknown as BannerDecorKind, intensity: c.intensity, color };
  }
  return out;
}

/** the four bevelled edges of the old Depth / 3D card — they are the **Bevel** category now */
export const BANNER_DEPTH_BEVELS: BannerDepthKind[] = ["bevel", "emboss", "innerBevel", "outerBevel"];

/** the glass panes the old Modern Effects card carried — they are the **Glass** category now */
export const BANNER_GLASS_PANE: BannerGlassKind[] = ["glass", "frosted", "acrylic", "blurBg", "clearGlass"];

/** the old finishes that stay finishes: everything but the glass family */
const legacyGlass = (b: BannerSettings, m: BannerModernFx | undefined): BannerGlassFx | undefined =>
  m && (BANNER_GLASS_PANE as string[]).includes(m.kind)
    ? { kind: m.kind as unknown as BannerGlassKind, intensity: m.intensity, blur: m.blur ?? 8, color: m.color ?? "" }
    : b.effects?.glass;

/** the old lights that are really highlights, each to the category it belongs in today */
const BANNER_GLOW_HIGHLIGHTS: Partial<Record<string, BannerHighlightKind>> = {
  highlight: "highlight",
  reflection: "reflection",
  shine: "shine",
  gloss: "gloss",
  spotlight: "spotlight",
  rimLight: "rimLight",
};

/** the old decorations that are really highlights — or the glow of the plate's own edge */
const BANNER_DECOR_HIGHLIGHTS: Partial<Record<BannerDecorKind, BannerHighlightKind>> = {
  innerHighlight: "innerHighlight",
  outerHighlight: "outerHighlight",
  edgeHighlight: "edgeHighlight",
};

/** the old decorations the two categories above take over */
const BANNER_DECOR_LEAVES: Partial<Record<BannerDecorKind, true>> = {
  innerHighlight: true,
  outerHighlight: true,
  edgeHighlight: true,
  outlineGlow: true,
};

/** the old **Glow & Light** card's bloom, brought into the Glow category with its own blur */
function legacyGlow(g: BannerGlowFx | undefined, dc: BannerDecorFx | undefined): BannerGlowFx | undefined {
  if (dc?.kind === "outlineGlow") {
    return { kind: "outlineGlow", intensity: dc.intensity, blur: BANNER_GLOW_DEFAULTS.outlineGlow.blur, color: dc.color ?? "" };
  }
  if (!g || BANNER_GLOW_HIGHLIGHTS[g.kind]) return undefined;
  return { kind: g.kind, intensity: g.intensity, blur: BANNER_GLOW_DEFAULTS[g.kind]?.blur ?? 0, color: g.color ?? "" };
}

/** the old **Glow & Light** / decoration lights, brought into the Highlight category */
function legacyHighlight(g: BannerGlowFx | undefined, dc: BannerDecorFx | undefined): BannerHighlightFx | undefined {
  const kind = (g && BANNER_GLOW_HIGHLIGHTS[g.kind]) || (dc && BANNER_DECOR_HIGHLIGHTS[dc.kind]);
  if (!kind) return undefined;
  const src = g && BANNER_GLOW_HIGHLIGHTS[g.kind] ? g : dc!;
  return { kind, intensity: src.intensity, blur: BANNER_HIGHLIGHT_DEFAULTS[kind].blur, angle: 0, color: src.color ?? "" };
}

/** the old shared shadows, each to the shadow it paints */
const BANNER_COMMON_SHADOWS: Partial<Record<TextBgEffectKind, BannerShadowKind>> = {
  shadow: "drop",
  pop: "hard",
  lift: "soft",
  float: "floating",
  longShadow: "long",
  innerShadow: "inner",
};

/** the old shared lights, each to the bloom it paints */
const BANNER_COMMON_GLOWS: Partial<Record<TextBgEffectKind, BannerGlowKind>> = {
  glow: "outer",
  halo: "halo",
  neon: "neon",
  innerGlow: "inner",
};

/** the old shared faces, each to the highlight it paints */
const BANNER_COMMON_HIGHLIGHTS: Partial<Record<TextBgEffectKind, BannerHighlightKind>> = {
  gloss: "gloss",
  sheen: "sheen",
  spotlight: "spotlight",
};

/**
 * **The colour every effect of the Effects card comes from** — the shape's own
 * paint: the first stop of the plate's gradient, else its solid fill, else the
 * banner's factory colour. An effect left on Auto wears it and so keeps step
 * with the plate — repaint the fill and every auto effect follows, exactly the
 * way a text background's plate does it (see `bgPlateColor`).
 */
export const bannerFxColor = (b: BannerSettings): string => {
  const base = baseColor(b.gradient, b.color || DEFAULT_BANNER.color);
  /* a special paint hands the effects its own tint when it carries one, so an
     auto effect follows the frosted pane / the metal / the pattern's ink */
  const mode = bannerFillMode(b);
  if (mode === "glass") {
    const c = channelPaint(b.glass?.color ?? "", b.glass?.gradient);
    if (c) return c;
  }
  if (mode === "metallic") {
    const c = channelPaint(b.metallic?.color ?? "", b.metallic?.gradient);
    if (c) return c;
  }
  if (mode === "pattern") {
    const c = channelPaint(b.pattern?.color ?? "", b.pattern?.gradient);
    if (c) return c;
  }
  return base;
};

export interface BannerEffectDef<K extends string> {
  kind: K;
  label: string;
  hint: string;
}

/** the twelve shadows the Effects card files under *Shadow Effects* */
export const BANNER_SHADOW_EFFECTS: BannerEffectDef<BannerShadowKind>[] = [
  { kind: "drop", label: "Drop Shadow", hint: "A single shadow cast below the plate" },
  { kind: "soft", label: "Soft Shadow", hint: "A wide, low-contrast fall-off" },
  { kind: "hard", label: "Hard Shadow", hint: "A sharp shadow, no blur at all" },
  { kind: "long", label: "Long Shadow", hint: "A diagonal streak running out of the plate" },
  { kind: "inner", label: "Inner Shadow", hint: "The shadow falls inside the plate" },
  { kind: "floating", label: "Floating Shadow", hint: "A ground shadow — the plate lifts off the board" },
  { kind: "offset", label: "Offset Shadow", hint: "A solid duplicate, stepped down and right" },
  { kind: "colored", label: "Colored Shadow", hint: "A soft fall in a colour of its own — it starts on the shape's" },
  { kind: "double", label: "Double Shadow", hint: "Two hard copies — one on each of two opposite sides" },
  { kind: "surround", label: "Surround Shadow", hint: "An even, soft shadow all around the plate" },
  { kind: "layered", label: "Layered Shadows", hint: "Three shadows stacked, each one further and fainter" },
  { kind: "cast", label: "Cast Shadow", hint: "A shadow thrown onto the board, skewed away from the plate" },
];

/**
 * what each shadow kind starts from — the six controls walk from here. The
 * colour is left on **Auto** ("" = `bannerFxColor`), so a fresh shadow wears
 * the shape's own colour and keeps following the plate as it is repainted.
 */
export const BANNER_SHADOW_DEFAULTS: Record<BannerShadowKind, Omit<BannerShadowFx, "kind">> = {
  drop: { x: 0, y: 8, blur: 24, spread: 0, opacity: 50, color: "" },
  soft: { x: 0, y: 14, blur: 48, spread: 0, opacity: 35, color: "" },
  hard: { x: 10, y: 10, blur: 0, spread: 0, opacity: 60, color: "" },
  long: { x: 18, y: 18, blur: 0, spread: 60, opacity: 55, color: "" },
  inner: { x: 0, y: 6, blur: 14, spread: 0, opacity: 45, color: "" },
  floating: { x: 0, y: 24, blur: 36, spread: 12, opacity: 45, color: "" },
  offset: { x: 12, y: 12, blur: 0, spread: 0, opacity: 70, color: "" },
  colored: { x: 0, y: 10, blur: 28, spread: 0, opacity: 40, color: "" },
  double: { x: 10, y: 10, blur: 0, spread: 0, opacity: 60, color: "" },
  surround: { x: 0, y: 0, blur: 24, spread: 8, opacity: 50, color: "" },
  layered: { x: 0, y: 12, blur: 18, spread: 0, opacity: 45, color: "" },
  cast: { x: 14, y: 20, blur: 0, spread: 0, opacity: 45, color: "" },
};

/* ====================================================================== *
 *  The seven categories
 * ====================================================================== *
 *
 * One list of effects per category, in the order the card paints its tiles.
 * The card, the tiles and the tests all read these lists, so a category can
 * only ever offer what the painter knows how to draw.
 */

/** the eight lights under **Glow** */
export const BANNER_GLOW_EFFECTS: BannerEffectDef<BannerGlowKind>[] = [
  { kind: "outer", label: "Outer Glow", hint: "Light blooming round the plate's edge" },
  { kind: "inner", label: "Inner Glow", hint: "Light blooming from the plate's inside" },
  { kind: "neon", label: "Neon Glow", hint: "A bright tube with a wide bloom" },
  { kind: "soft", label: "Soft Glow", hint: "A wide, even halo of light" },
  { kind: "halo", label: "Halo", hint: "A broad, even ring of light all round the plate" },
  { kind: "backlight", label: "Backlight", hint: "A strong light rising from behind the plate" },
  { kind: "aurora", label: "Aurora", hint: "Soft light shifting through several hues" },
  { kind: "outlineGlow", label: "Outline Glow", hint: "The plate's edge glowing in a colour of its own" },
];

/** the light starts on Auto colour — it blooms in the shape's own paint (see `bannerFxColor`) */
export const BANNER_GLOW_DEFAULT: Omit<BannerGlowFx, "kind"> = { intensity: 55, blur: 0, color: "" };

/** what each light starts from, where its own numbers differ from the plain default */
export const BANNER_GLOW_DEFAULTS: Record<BannerGlowKind, Omit<BannerGlowFx, "kind">> = {
  outer: { intensity: 55, blur: 0, color: "" },
  inner: { intensity: 55, blur: 0, color: "" },
  neon: { intensity: 70, blur: 6, color: "" },
  soft: { intensity: 55, blur: 12, color: "" },
  halo: { intensity: 45, blur: 20, color: "" },
  backlight: { intensity: 60, blur: 0, color: "" },
  aurora: { intensity: 55, blur: 0, color: "" },
  outlineGlow: { intensity: 50, blur: 4, color: "" },
};

/** the eight blurs under **Blur** */
export const BANNER_BLUR_EFFECTS: BannerEffectDef<BannerBlurKind>[] = [
  { kind: "soft", label: "Soft Blur", hint: "The plate itself blurred into a soft blob" },
  { kind: "gaussian", label: "Gaussian Blur", hint: "A deep blur with the edges fading away" },
  { kind: "backdrop", label: "Backdrop Blur", hint: "Only the board behind the plate, blurred" },
  { kind: "motion", label: "Motion Blur", hint: "A directional smear, running the way Direction points" },
  { kind: "zoom", label: "Zoom Blur", hint: "A radial smear running out from the middle" },
  { kind: "feather", label: "Feather", hint: "The edge melted into the board, along the Direction" },
  { kind: "bloom", label: "Bloom Blur", hint: "A blurred coloured copy of the plate behind it" },
  { kind: "frost", label: "Frosted Blur", hint: "A blurred plate under a frost of the tint" },
];

export const BANNER_BLUR_DEFAULT: Omit<BannerBlurFx, "kind"> = { blur: 12, intensity: 55, angle: 90, color: "" };

export const BANNER_BLUR_DEFAULTS: Record<BannerBlurKind, Omit<BannerBlurFx, "kind">> = {
  soft: { blur: 12, intensity: 55, angle: 90, color: "" },
  gaussian: { blur: 18, intensity: 60, angle: 90, color: "" },
  backdrop: { blur: 12, intensity: 45, angle: 90, color: "" },
  motion: { blur: 14, intensity: 55, angle: 90, color: "" },
  zoom: { blur: 16, intensity: 55, angle: 90, color: "" },
  feather: { blur: 20, intensity: 60, angle: 90, color: "" },
  bloom: { blur: 24, intensity: 55, angle: 90, color: "" },
  frost: { blur: 14, intensity: 50, angle: 90, color: "" },
};

/** the seven panes under **Glass** */
export const BANNER_GLASS_EFFECTS: BannerEffectDef<BannerGlassKind>[] = [
  { kind: "glass", label: "Glassmorphism", hint: "A translucent pane over the board" },
  { kind: "frosted", label: "Frosted Glass", hint: "A heavier frost, more blur" },
  { kind: "acrylic", label: "Acrylic", hint: "A tinted, softly blurred panel" },
  { kind: "blurBg", label: "Blur Background", hint: "Only the board behind, blurred" },
  { kind: "clearGlass", label: "Transparent Glass", hint: "A bright rim, barely tinted" },
  { kind: "tinted", label: "Tinted Glass", hint: "Flat tinted glass — colour with no blur" },
  { kind: "glassEdge", label: "Glass Edge", hint: "A pane read by its lit edge alone" },
];

export const BANNER_GLASS_DEFAULT: Omit<BannerGlassFx, "kind"> = { intensity: 55, blur: 8, color: "" };

export const BANNER_GLASS_DEFAULTS: Record<BannerGlassKind, Omit<BannerGlassFx, "kind">> = {
  glass: { intensity: 55, blur: 8, color: "" },
  frosted: { intensity: 60, blur: 16, color: "" },
  acrylic: { intensity: 50, blur: 10, color: "" },
  blurBg: { intensity: 45, blur: 12, color: "" },
  clearGlass: { intensity: 45, blur: 4, color: "" },
  tinted: { intensity: 55, blur: 0, color: "" },
  glassEdge: { intensity: 55, blur: 6, color: "" },
};

/** the seven edges under **Bevel** */
export const BANNER_BEVEL_EFFECTS: BannerEffectDef<BannerBevelKind>[] = [
  { kind: "bevel", label: "Bevel", hint: "A lit edge and a shaded one" },
  { kind: "innerBevel", label: "Inner Bevel", hint: "The recessed edge, carved in" },
  { kind: "outerBevel", label: "Outer Bevel", hint: "The raised edge, cast outward" },
  { kind: "emboss", label: "Emboss", hint: "A soft, raised edge" },
  { kind: "ridge", label: "Ridge", hint: "A hard line of light down one side and shade down the other" },
  { kind: "groove", label: "Groove", hint: "A hard line cut in, light on the far side" },
  { kind: "pillow", label: "Pillow", hint: "Both edges lit, the middle left rounded" },
];

export const BANNER_BEVEL_DEFAULT: Omit<BannerBevelFx, "kind"> = { intensity: 50, blur: 2, angle: 0, color: "" };

export const BANNER_BEVEL_DEFAULTS: Record<BannerBevelKind, Omit<BannerBevelFx, "kind">> = {
  bevel: { intensity: 50, blur: 2, angle: 0, color: "" },
  innerBevel: { intensity: 50, blur: 2, angle: 0, color: "" },
  outerBevel: { intensity: 50, blur: 2, angle: 0, color: "" },
  emboss: { intensity: 50, blur: 6, angle: 0, color: "" },
  ridge: { intensity: 50, blur: 0, angle: 0, color: "" },
  groove: { intensity: 50, blur: 0, angle: 0, color: "" },
  pillow: { intensity: 55, blur: 4, angle: 0, color: "" },
};

/** the nine depths under **3D** */
export const BANNER_3D_EFFECTS: BannerEffectDef<Banner3DKind>[] = [
  { kind: "extrusion", label: "3D Extrusion", hint: "A slab standing behind the body" },
  { kind: "depth", label: "Depth", hint: "An extrusion run deep, in two steps" },
  { kind: "layered3d", label: "Layered 3D", hint: "Three slabs stepping out behind the body" },
  { kind: "perspective", label: "Perspective", hint: "The plate tipped back in space" },
  { kind: "tilt", label: "Tilt", hint: "The plate tipped on its vertical axis" },
  { kind: "pop", label: "Pop Out", hint: "The plate lifted toward the reader, a touch larger" },
  { kind: "raised", label: "Raised", hint: "A gentle lift off the board" },
  { kind: "pressed", label: "Pressed / Inset", hint: "Pushed in, shadowed inside" },
  { kind: "isometric", label: "Isometric", hint: "A hard-edged iso block — the slab running off at the Angle" },
];

/** the depth starts on Auto colour — its slabs are the plate's own paint, shaded (see `bannerFxColor`) */
export const BANNER_3D_DEFAULT: Omit<Banner3DFx, "kind"> = { intensity: 50, blur: 0, angle: 90, color: "" };

export const BANNER_3D_DEFAULTS: Record<Banner3DKind, Omit<Banner3DFx, "kind">> = {
  extrusion: { intensity: 50, blur: 0, angle: 90, color: "" },
  depth: { intensity: 50, blur: 0, angle: 90, color: "" },
  layered3d: { intensity: 50, blur: 0, angle: 90, color: "" },
  perspective: { intensity: 50, blur: 0, angle: 90, color: "" },
  tilt: { intensity: 50, blur: 0, angle: 90, color: "" },
  pop: { intensity: 50, blur: 0, angle: 90, color: "" },
  raised: { intensity: 45, blur: 0, angle: 90, color: "" },
  pressed: { intensity: 45, blur: 0, angle: 90, color: "" },
  isometric: { intensity: 55, blur: 0, angle: 120, color: "" },
};

/** the ten lights under **Highlight** */
export const BANNER_HIGHLIGHT_EFFECTS: BannerEffectDef<BannerHighlightKind>[] = [
  { kind: "highlight", label: "Highlight", hint: "Daylight laid along the top edge" },
  { kind: "innerHighlight", label: "Inner Highlight", hint: "Light washing down from the top edge" },
  { kind: "outerHighlight", label: "Outer Highlight", hint: "A bright ring around the plate" },
  { kind: "edgeHighlight", label: "Edge Highlight", hint: "A hairline brightening the rim" },
  { kind: "gloss", label: "Gloss", hint: "The polished top half, hard edge and all" },
  { kind: "sheen", label: "Sheen", hint: "A broad sheen sweeping the body" },
  { kind: "shine", label: "Shine", hint: "A hard flash of light across the body" },
  { kind: "reflection", label: "Light Reflection", hint: "A thin streak of light across the body" },
  { kind: "spotlight", label: "Spotlight", hint: "A cone of light falling on the plate from above" },
  { kind: "rimLight", label: "Rim Light", hint: "A bright hairline hugging the plate's edge" },
];

/** the light starts on Auto colour — it shines in the shape's own paint (see `bannerFxColor`) */
export const BANNER_HIGHLIGHT_DEFAULT: Omit<BannerHighlightFx, "kind"> = { intensity: 55, blur: 12, angle: 0, color: "" };

export const BANNER_HIGHLIGHT_DEFAULTS: Record<BannerHighlightKind, Omit<BannerHighlightFx, "kind">> = {
  highlight: { intensity: 55, blur: 12, angle: 0, color: "" },
  innerHighlight: { intensity: 55, blur: 12, angle: 0, color: "" },
  outerHighlight: { intensity: 55, blur: 6, angle: 0, color: "" },
  edgeHighlight: { intensity: 50, blur: 0, angle: 0, color: "" },
  gloss: { intensity: 55, blur: 4, angle: 0, color: "" },
  sheen: { intensity: 55, blur: 18, angle: 25, color: "" },
  shine: { intensity: 45, blur: 10, angle: 25, color: "" },
  reflection: { intensity: 45, blur: 8, angle: 25, color: "" },
  spotlight: { intensity: 55, blur: 16, angle: 0, color: "" },
  rimLight: { intensity: 50, blur: 2, angle: 0, color: "" },
};

/** the decorations under **Decorations** — the patterns, the textures and the accents */
export const BANNER_DECOR_EFFECTS: BannerEffectDef<BannerDecorKind>[] = [
  { kind: "vignette", label: "Vignette", hint: "The corners darken toward the middle" },
  { kind: "texture", label: "Texture Overlay", hint: "Grain laid over the paint" },
  { kind: "pattern", label: "Pattern Overlay", hint: "A fine diagonal weave" },
  { kind: "dots", label: "Polka Dots", hint: "Even round dots scattered over the paint" },
  { kind: "grid", label: "Grid Lines", hint: "A fine square grid over the paint" },
  { kind: "stitch", label: "Stitched Edge", hint: "A dashed stitch running inside the rim" },
  { kind: "sunburst", label: "Sunburst Rays", hint: "Fine rays radiating from the middle" },
  { kind: "gradientShadow", label: "Gradient Shadow", hint: "A shadow that fades from one tone to another" },
  { kind: "colorShadow", label: "Colour Shadow", hint: "A hard shadow in a colour of its own" },
  { kind: "edgeDarkening", label: "Edge Darkening", hint: "A shadowed rim, pressed in" },
  { kind: "stripes", label: "Stripes", hint: "Diagonal stripes over the plate" },
  { kind: "checker", label: "Checker", hint: "A checkerboard pattern" },
  { kind: "fadeRight", label: "Fade →", hint: "The plate fades out to the right" },
  { kind: "fadeEdges", label: "Fade edges", hint: "The plate fades out at both ends" },
  { kind: "ring", label: "Ring", hint: "A thin outline ring outside the plate" },
  { kind: "offsetOutline", label: "Offset Outline", hint: "An outline copy shifted down-right" },
  { kind: "sticker", label: "Sticker", hint: "A thick pale outline all round (die-cut sticker)" },
  { kind: "stack", label: "Stack", hint: "Two paper copies stacked behind" },
  { kind: "topBar", label: "Top Bar", hint: "An accent strip along the top edge" },
  { kind: "bottomBar", label: "Bottom Bar", hint: "An accent strip along the bottom edge" },
  { kind: "leftBar", label: "Left Bar", hint: "An accent strip along the left edge" },
  { kind: "cornerFold", label: "Corner Fold", hint: "A folded top-right corner (sticky note)" },
];

/** the pattern family the shared text-plate engine paints (`lib/shapeEffects`) */
export const BANNER_SHARED_DECOR: BannerDecorKind[] = [
  "stripes",
  "dots",
  "grid",
  "checker",
  "fadeRight",
  "fadeEdges",
  "ring",
  "offsetOutline",
  "sticker",
  "stack",
  "topBar",
  "bottomBar",
  "leftBar",
  "cornerFold",
];

/** the decoration starts on Auto colour — it is laid over the plate in the plate's own paint */
export const BANNER_DECOR_DEFAULT: Omit<BannerDecorFx, "kind"> = { intensity: 50, color: "" };

/** the seven finishes under **Finishes** — none of the glass family, which is the Glass category now */
export const BANNER_MODERN_EFFECTS: BannerEffectDef<BannerModernKind>[] = [
  { kind: "noise", label: "Noise / Grain", hint: "Film grain laid over the body" },
  { kind: "softGradient", label: "Soft Gradient Overlay", hint: "Light to shade, diagonally" },
  { kind: "mesh", label: "Mesh Gradient", hint: "Colour blobs melted into the body" },
  { kind: "holographic", label: "Holographic", hint: "An iridescent sheen shifting across the body" },
  { kind: "metallic", label: "Metallic", hint: "Brushed metal — fine bands under a chrome sheen" },
  { kind: "duotone", label: "Duotone", hint: "Two tones of the tint, split on one diagonal" },
  { kind: "softUi", label: "Soft UI", hint: "The soft raised card — a light and a dark shadow" },
];

/** the finish starts on Auto colour — its tint is the shape's own paint, shaded for the effect */
export const BANNER_MODERN_DEFAULT: Omit<BannerModernFx, "kind"> = { intensity: 55, color: "", blur: 8 };


/**
 * The paint a plate's effects add on top of its silhouette — everything the
 * Effects card of the Title background line can turn on, category by category
 * (see `bannerEffectsOf`), folded into the channels `bannerCss` already knows
 * how to paint:
 *
 *   shadows   box-shadow segments on the body itself (outer or inset) — the
 *             shadow category's fall-offs, the glows' blooms, the bevels'
 *             edges, the highlights' rims and the accents
 *   back      layers of its own behind the body — the long shadow's streak, the
 *             3D slabs, the cast shadow, the bloom blur, the paper stacks
 *   over      overlays above the body, under the heading — the glass panes, the
 *             sheens, the glows' aurora, the patterns and the grain
 *   filters   CSS filters on the body itself — the blur category, the glows'
 *             own softness, which follow the silhouette
 *   transform the 3D turns and the shape effects' transforms the body, its
 *             layers and its overlays all wear together
 *   radius    the body's corner radius, when a shape effect says otherwise
 *   mask      the body's edge, when a shape effect cuts it (wave · curve · slant)
 *   maskFade  the body's edge, when an effect melts it (Gaussian · Feather ·
 *             Fade → · Fade edges) — combined with `mask` and the silhouette's
 *             own mask in `bannerCss`, which makes the layers intersect
 *
 * A category that is off paints nothing, so an untouched deck renders exactly
 * as it always did.
 */
export interface BannerEffectPaint {
  shadows: string[];
  back: React.CSSProperties[];
  over: React.CSSProperties[];
  filters: string[];
  transform: string;
  radius: number | string | undefined;
  mask: string | undefined;
  maskFade: string | undefined;
}

const EMPTY_FX: BannerEffectPaint = {
  shadows: [],
  back: [],
  over: [],
  filters: [],
  transform: "",
  radius: undefined,
  mask: undefined,
  maskFade: undefined,
};

/** the film grain the Noise / Grain and the Texture Overlay wear, as a data-URL */
const NOISE_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(#n)' opacity='0.5'/></svg>`,
)}")`;

/** the mesh gradient's colour blobs — soft radials over a diagonal base */
function meshBg(color: string, a: number): string {
  const spots = ["22% 22%", "80% 16%", "86% 82%", "14% 84%", "55% 48%"];
  const tints = [
    withAlpha("#ffffff", 0.2 + 0.5 * a),
    withAlpha(shade(color, 0.35), 0.2 + 0.5 * a),
    withAlpha(shade(color, -0.25), 0.18 + 0.4 * a),
    withAlpha("#ffffff", 0.12 + 0.3 * a),
    withAlpha(shade(color, 0.1), 0.18 + 0.4 * a),
  ];
  const blobs = spots.map((p, n) => `radial-gradient(ellipse 58% 48% at ${p}, ${tints[n]} 0%, transparent 72%)`);
  return `${blobs.join(", ")}, linear-gradient(120deg, ${withAlpha(color, 0.15 + 0.3 * a)} 0%, ${withAlpha(
    shade(color, -0.2),
    0.12 + 0.25 * a,
  )} 100%)`;
}

/** a wave along each long edge, in the mask's own 100 × 40 box */
function waveMaskPath(v: number): string {
  const a = (Math.max(0, Math.min(100, v)) / 100) * 2.8;
  const n = 24;
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (100 * i) / n;
    top.push(`${i ? "L" : "M"}${x.toFixed(2)} ${(3 + a * Math.sin((Math.PI * 6 * i) / n)).toFixed(2)}`);
  }
  for (let i = n; i >= 0; i--) {
    const x = (100 * i) / n;
    bot.push(`L${x.toFixed(2)} ${(37 - a * Math.sin((Math.PI * 6 * i) / n)).toFixed(2)}`);
  }
  return `${top.join(" ")} ${bot.join(" ")} Z`;
}

/** a curved band — both long edges arch the same way, like the curved banner */
function curveMaskPath(v: number): string {
  const a = (Math.max(0, Math.min(100, v)) / 100) * 6;
  const e = (4 + a * 0.4).toFixed(2);
  const f = (34 + a * 0.4).toFixed(2);
  return `M0 ${e} Q 50 ${(4 - a).toFixed(2)} 100 ${e} L 100 ${f} Q 50 ${(34 + a).toFixed(2)} 0 ${f} Z`;
}

/** the whole plate sheared — a parallelogram cut, like the slant's cousin */
function slantMaskPath(v: number): string {
  const s = (Math.max(0, Math.min(100, v)) / 100) * 14;
  return `M${s.toFixed(2)} 0 L100 0 L${(100 - s).toFixed(2)} 40 L0 40 Z`;
}

/**
 * The corners the Effects card's Shape Effects set — they win over the
 * silhouette's own and over the Border card's, on the body and on its outline
 * alike. Undefined while the card leaves the corners to the plate.
 */
export function fxCornerRadius(t: BannerShapeFx): string | undefined {
  if (t.independent && t.cornerTL + t.cornerTR + t.cornerBR + t.cornerBL > 0) {
    return `${t.cornerTL}px ${t.cornerTR}px ${t.cornerBR}px ${t.cornerBL}px`;
  }
  return t.radius > 0 ? `${t.radius}px` : undefined;
}

/**
 * An effect whose colour carries a picked gradient paints the gradient's
 * blended tone — a shadow, a glow or a tint is one flat colour in CSS, so the
 * gradient is folded to one honest mix of its stops before the builders run.
 */
function resolveFxPaint(fx: BannerEffects): BannerEffects {
  const one = <T extends { color: string; gradient?: Gradient }>(g: T | undefined): T | undefined =>
    g?.gradient?.enabled ? { ...g, color: gradientPaintColor(g.gradient, g.color) } : g;
  return {
    ...fx,
    shadow: one(fx.shadow),
    glow: one(fx.glow),
    blur: one(fx.blur),
    glass: one(fx.glass),
    bevel: one(fx.bevel),
    threeD: one(fx.threeD),
    highlight: one(fx.highlight),
    decor: one(fx.decor),
    modern: one(fx.modern),
  };
}

export function bannerEffectsPaint(b: BannerSettings, base: string): BannerEffectPaint {
  const fx = resolveFxPaint(bannerEffectsOf(b));
  const shapeOpacity = clampOpacity(b.opacity);
  /**
   * What an effect paints when its own colour is left on Auto: the shape's
   * colour, whatever the group — shadow, light, finish or decoration. Every
   * effect in the card starts here, so the plate's paint and its effects are
   * one colour story, and repainting the plate repaints them with it.
   */
  const auto = bannerFxColor(b);
  const shadows: string[] = [];
  const filters: string[] = [];
  const back: React.CSSProperties[] = [];
  const over: React.CSSProperties[] = [];

  const common: React.CSSProperties = { position: "absolute", pointerEvents: "none" };
  const geo = b.shape === "underline" ? ruleRect(b) : plateRect(b);
  const t = fx.shape;
  /** the shape effects' own corners, else the silhouette's */
  const fxRadius = fxCornerRadius(t);
  const radius = fxRadius ?? plateRadius(b);
  const clip = plateClipPath(b);
  /** the shape effects cut the edge where the silhouette does not — wave wins, then curve, then slant */
  const mask =
    t.wave > 0
      ? maskUrl(`<path d='${waveMaskPath(t.wave)}' fill='black'/>`)
      : t.curve > 0
        ? maskUrl(`<path d='${curveMaskPath(t.curve)}' fill='black'/>`)
        : t.slant > 0
          ? maskUrl(`<path d='${slantMaskPath(t.slant)}' fill='black'/>`)
          : undefined;
  /**
   * The edge an effect melts away — the shared fades (Fade → · Fade edges) and
   * the blurs that eat the rim (Gaussian, Feather). It rides along with the
   * silhouette's own mask, which `bannerCss` intersects.
   */
  let maskFade: string | undefined;

  /**
   * The compass every angular control walks: 0° is straight above, the angle
   * grows clockwise, and `x`/`y` are the unit step a light or a slab takes in
   * that direction. A bevel's light, a highlight's sheen and a 3D extrusion's
   * run all read the same way, so one Angle means one thing in the card.
   */
  const compass = (deg: number | undefined) => {
    const d = (((Number.isFinite(deg) ? (deg as number) : 0) % 360) + 360) % 360;
    const rad = (d * Math.PI) / 180;
    const snap = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
    return { deg: d, x: snap(Math.sin(rad)), y: snap(-Math.cos(rad)) };
  };
  /** a length in px, never NaN, floored where the effect wants a minimum */
  const len = (v: number | undefined, min = 0) => Math.max(min, Number.isFinite(v) ? (v as number) : 0);
  const r1p = (v: number) => Math.round(v * 10) / 10;
  /** a backdrop blur, in both spellings — Safari still wants the prefix */
  const backdropOf = (v: string): React.CSSProperties => ({ backdropFilter: v, WebkitBackdropFilter: v });

  /** the one transform the body, its extra layers and its overlays all wear */
  let transform = "";
  const d3 = fx.threeD;
  if (d3 && d3.kind === "perspective") {
    const i = Math.max(0, Math.min(100, d3.intensity));
    transform += `perspective(${Math.round(900 - i * 5)}px) rotateX(${(i * 0.3).toFixed(1)}deg)`;
  }
  if (d3 && d3.kind === "tilt") {
    const i = Math.max(0, Math.min(100, d3.intensity));
    transform += `perspective(${Math.round(900 - i * 5)}px) rotateY(${-(i * 0.25).toFixed(1)}deg)`;
  }
  if (d3 && d3.kind === "pop") {
    const i = Math.max(0, Math.min(100, d3.intensity));
    transform += `scale(${(1 + i * 0.0016).toFixed(3)})`;
  }
  if (t.rotation) transform += ` rotate(${t.rotation}deg)`;
  if (t.skew) transform += ` skewX(${t.skew}deg)`;
  if (t.distortion) transform += ` scaleX(${(1 + t.distortion / 200).toFixed(3)})`;
  if (t.flipH) transform += " scaleX(-1)";
  if (t.flipV) transform += " scaleY(-1)";
  const pre = transform ? `${transform} ` : "";

  /** a layer of its own behind the body — the plate's own box, its own silhouette */
  const backLayer = (extra: React.CSSProperties) =>
    back.push({
      ...common,
      ...geo,
      borderRadius: radius,
      clipPath: clip,
      opacity: shapeOpacity,
      ...extra,
    });
  /** an overlay above the body, under the heading — the very same box and cut */
  const overLayer = (extra: React.CSSProperties) =>
    over.push({
      ...common,
      ...geo,
      borderRadius: radius,
      clipPath: clip,
      maskImage: mask,
      WebkitMaskImage: mask,
      transform: transform || undefined,
      opacity: shapeOpacity,
      ...extra,
    });
  /**
   * A silhouette the shared text-plate engine asks to be painted **behind** the
   * shape (a ring, an offset outline, a paper stack) — the plate's own box,
   * grown by the gap a ring wants, else moved by the effect's own transform.
   */
  const pushSharedBehind = (h: ShapeEffectBehind) => {
    if (!h.css.transform && h.stroke) {
      /* a ring — the plate's own box grown out by the gap, outline only */
      if (!("top" in geo)) return;
      const gap = Math.abs(Number(h.css.inset)) || 0;
      back.push({
        ...common,
        left: `calc(${geo.left} - ${gap}px)`,
        top: `calc(${geo.top} - ${gap}px)`,
        width: `calc(${geo.width} + ${gap * 2}px)`,
        height: `calc(${geo.height} + ${gap * 2}px)`,
        borderRadius: radius,
        clipPath: clip,
        border: `${h.strokeWidth}px solid ${h.stroke}`,
        boxSizing: "border-box",
        transform: pre || undefined,
        opacity: shapeOpacity,
      });
    } else {
      /* offset outline / paper stack — the plate's own box, moved */
      back.push({
        ...common,
        ...geo,
        borderRadius: radius,
        clipPath: clip,
        background: h.fill || undefined,
        ...(h.stroke ? { border: `${h.strokeWidth}px solid ${h.stroke}`, boxSizing: "border-box" } : {}),
        transform: h.css.transform ? `${pre}${h.css.transform}` : pre || undefined,
        opacity: shapeOpacity * (typeof h.css.opacity === "number" ? h.css.opacity : 1),
      });
    }
  };

  /* ------------------------------- shadow ---------------------------------- */
  /* An offset copy of the plate, dressed by the category's six controls:
     X · Y · Blur · Spread · Opacity · Colour. */
  const s = fx.shadow;
  if (s) {
    const sColor = s.color || auto;
    const c = withAlpha(sColor, fxA(s.opacity));
    switch (s.kind) {
      case "inner":
        shadows.push(`inset ${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${c}`);
        break;
      case "long":
        backLayer({
          background: `linear-gradient(135deg, ${c} ${Math.max(0, 100 - s.spread)}%, ${withAlpha(sColor, 0)} 100%)`,
          transform: `${pre}translate(${s.x}px, ${s.y}px)`,
        });
        break;
      case "floating":
        shadows.push(`0 ${s.y}px ${s.blur}px ${-Math.abs(s.spread)}px ${c}`);
        break;
      case "offset":
        shadows.push(`${s.x}px ${s.y}px 0px ${s.spread}px ${c}`);
        break;
      // two hard copies on opposite sides — X · Y walk both at once
      case "double":
        shadows.push(
          `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${c}`,
          `${-s.x}px ${-s.y}px ${s.blur}px ${s.spread}px ${withAlpha(sColor, Math.round(fxA(s.opacity) * 0.75 * 1000) / 1000)}`,
        );
        break;
      // an even fall-off all round the plate — Blur is its reach, Spread its ring
      case "surround":
        shadows.push(`0px 0px ${s.blur}px ${s.spread}px ${c}`);
        break;
      // three fall-offs stacked on the same direction, each one further and fainter
      case "layered": {
        const seg = (k: number, o: number) =>
          `${Math.round(s.x * k)}px ${Math.round(s.y * k)}px ${Math.round(s.blur * k)}px ${s.spread}px ${withAlpha(sColor, fxA(s.opacity) * o)}`;
        shadows.push(seg(0.33, 0.45), seg(0.66, 0.68), seg(1, 0.9));
        break;
      }
      // a shadow thrown onto the board — a soft ellipse, skewed away from the plate
      case "cast":
        backLayer({
          background: `radial-gradient(ellipse at center, ${c} 0%, ${withAlpha(sColor, 0)} 72%)`,
          borderRadius: 999,
          transform: `${pre}translate(${Math.round(s.x * 0.5)}px, ${Math.max(4, Math.round(s.y * 0.6))}px) scaleY(0.45) skewX(-16deg)`,
        });
        break;
      default:
        shadows.push(`${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${c}`);
    }
  }

  /* -------------------------------- glow ----------------------------------- */
  /* Light blooming off the plate, dressed by Type · Blur · Intensity · Colour.
     Blur widens every one of them — the reach the intensity alone would give
     plus the blur the teacher adds on top. */
  const g = fx.glow;
  if (g) {
    const i = Math.max(0, Math.min(100, g.intensity));
    const a = i / 100;
    const extra = len(g.blur);
    const c = g.color || auto;
    switch (g.kind) {
      case "inner":
        shadows.push(`inset 0 0 ${Math.round(6 + i * 0.5 + extra * 1.4)}px ${withAlpha(c, 0.2 + 0.65 * a)}`);
        break;
      case "outer":
        shadows.push(
          `0 0 ${Math.round(6 + i * 0.5 + extra * 0.8)}px ${withAlpha(c, 0.25 + 0.55 * a)}`,
          `0 0 ${Math.round(16 + i + extra * 1.8)}px ${withAlpha(c, 0.1 + 0.3 * a)}`,
        );
        break;
      case "neon":
        shadows.push(
          `0 0 ${Math.max(2, Math.round(2 + extra * 0.2))}px ${withAlpha(c, Math.min(1, 0.55 + a))}`,
          `0 0 ${Math.round(6 + i * 0.4 + extra)}px ${withAlpha(c, 0.8)}`,
          `0 0 ${Math.round(18 + i * 0.9 + extra * 2.2)}px ${withAlpha(c, 0.4)}`,
        );
        break;
      case "soft":
        shadows.push(
          `0 0 ${Math.round(12 + i * 0.8 + extra * 2)}px ${Math.round(2 + i * 0.15 + extra * 0.4)}px ${withAlpha(c, 0.18 + 0.5 * a)}`,
        );
        break;
      // a broad, even ring of light all round the plate
      case "halo":
        shadows.push(
          `0 0 ${Math.round(14 + i * 1.1 + extra * 2.4)}px ${Math.round(4 + i * 0.2 + extra * 0.6)}px ${withAlpha(c, 0.14 + 0.42 * a)}`,
          `0 0 ${Math.round(30 + i * 1.4 + extra * 3)}px ${withAlpha(c, 0.06 + 0.2 * a)}`,
        );
        break;
      // a strong light rising from BEHIND the plate — its own layer, scaled out
      case "backlight":
        backLayer({
          background: `radial-gradient(ellipse at center, ${withAlpha(c, 0.22 + 0.55 * a)} 0%, ${withAlpha(c, 0)} 72%)`,
          transform: `${pre}scale(${(1.1 + 0.16 * a + extra * 0.004).toFixed(3)})`,
        });
        shadows.push(`0 0 ${Math.round(4 + i * 0.3 + extra)}px ${withAlpha(c, 0.1 + 0.35 * a)}`);
        break;
      // soft light shifting through the colour's own neighbours round the wheel
      case "aurora":
        overLayer({
          background: `linear-gradient(${100 + Math.round(i * 0.2)}deg, ${withAlpha(rotateHue(c, -40), 0.1 + 0.3 * a)} 0%, ${withAlpha(
            c,
            0.12 + 0.34 * a,
          )} 34%, ${withAlpha(rotateHue(c, 45), 0.1 + 0.3 * a)} 66%, ${withAlpha(rotateHue(c, 100), 0.06 + 0.24 * a)} 100%)`,
          filter: extra ? `blur(${r1p(extra * 0.4)}px)` : undefined,
        });
        break;
      // the plate's edge glowing in a colour of its own
      case "outlineGlow":
        shadows.push(
          `0 0 ${Math.round(2 + i * 0.25 + extra * 0.6)}px ${Math.max(1, Math.round(i * 0.08))}px ${withAlpha(c, 0.3 + 0.6 * a)}`,
        );
        break;
    }
  }

  /* -------------------------------- bevel ---------------------------------- */
  /* A lit edge and a shaded one, dressed by Type · Depth · Blur · Angle ·
     Colour. Depth is how far the edge is cut, Blur how soft the cut is,
     Angle where the light comes from, and the colour the effect's own — the
     plate's paint when it is left on Auto. */
  const bv = fx.bevel;
  if (bv) {
    const i = Math.max(0, Math.min(100, bv.intensity));
    const a = i / 100;
    const soft = len(bv.blur);
    const { x: lx, y: ly } = compass(bv.angle);
    const c = bv.color || auto;
    const lit = (al: number) => withAlpha(shade(c, 0.7), al);
    const deep = (al: number) => withAlpha(shade(c, -0.55), al);
    const cut = Math.max(1, Math.round(i * 0.06));
    /** a cut edge, on the body itself — inset, so it follows the silhouette */
    const edge = (x: number, y: number, color: string, spread = 0) =>
      shadows.push(`inset ${r1p(x)}px ${r1p(y)}px ${Math.round(soft)}px ${spread}px ${color}`);
    switch (bv.kind) {
      case "bevel":
        edge(-lx * cut, ly * cut, lit(0.25 + 0.5 * a));
        edge(lx * cut, -ly * cut, deep(0.15 + 0.45 * a));
        break;
      case "innerBevel":
        edge(-lx * cut, ly * cut, deep(0.2 + 0.5 * a));
        edge(lx * cut, -ly * cut, lit(0.15 + 0.4 * a));
        break;
      // the raised edge, cast outward — the only bevel that is not inset
      case "outerBevel":
        shadows.push(
          `${r1p(lx * cut)}px ${r1p(-ly * cut)}px ${Math.round(soft)}px ${lit(0.3 + 0.5 * a)}`,
          `${r1p(-lx * cut)}px ${r1p(ly * cut)}px ${Math.round(soft)}px ${deep(0.2 + 0.5 * a)}`,
        );
        break;
      case "emboss":
        edge(-lx * cut, ly * cut, lit(0.15 + 0.4 * a));
        edge(lx * cut, -ly * cut, deep(0.12 + 0.35 * a));
        break;
      // a hard line of light down one side, a hard line of shade down the other
      case "ridge":
        edge(-lx * cut, ly * cut, lit(0.3 + 0.55 * a));
        edge(lx * cut, -ly * cut, deep(0.2 + 0.5 * a));
        break;
      // a hard line cut IN, the light on the far side
      case "groove":
        edge(-lx * cut, ly * cut, deep(0.22 + 0.5 * a));
        edge(lx * cut, -ly * cut, lit(0.2 + 0.45 * a));
        break;
      // both edges lit toward the light, the middle left rounded
      case "pillow":
        edge(-lx * cut, ly * cut, lit(0.25 + 0.5 * a), Math.round(2 + soft * 0.4));
        edge(lx * cut, -ly * cut, lit(0.2 + 0.4 * a), Math.round(2 + soft * 0.4));
        break;
    }
  }

  /* ---------------------------------- 3D ----------------------------------- */
  /* A slab behind the plate, or the plate itself tipped in space, dressed by
     Type · Depth · Blur · Angle · Colour — the same compass the bevel walks.
     The turns (Perspective · Tilt · Pop Out) are transforms, built above, and
     their Blur softens the shadow the turn throws. */
  if (d3) {
    const i = Math.max(0, Math.min(100, d3.intensity));
    const a = i / 100;
    const soft = len(d3.blur);
    const { x: dx, y: dy } = compass(d3.angle);
    const c = d3.color || auto;
    /** a slab of the effect's colour (the plate's own, shaded) behind the body */
    const slab = (o: number, run: number, shadeBy: number) =>
      backLayer({
        background: withAlpha(shade(c, shadeBy), o * shapeOpacity),
        transform: `${pre}translate(${r1p(dx * run)}px, ${r1p(dy * run)}px)`,
      });
    const fall = (spread: number, bl: number, al: number) =>
      shadows.push(`0 ${Math.round(spread)}px ${Math.round(bl)}px ${withAlpha(c, al)}`);
    switch (d3.kind) {
      case "extrusion":
        slab(1, 3 + i * 0.16, -0.45);
        fall(2 + i * 0.1, 2 + i * 0.25 + soft, 0.2 + 0.35 * a);
        break;
      case "depth":
        slab(0.75, 6 + i * 0.4, -0.62);
        slab(1, 3 + i * 0.2, -0.42);
        fall(3 + i * 0.15, 3 + i * 0.3 + soft, 0.25 + 0.4 * a);
        break;
      // three slabs stepping out behind the body, each a shade lighter as it nears
      case "layered3d":
        slab(0.34, 9 + i * 0.36, -0.62);
        slab(0.52, 6 + i * 0.24, -0.46);
        slab(0.72, 3 + i * 0.12, -0.3);
        fall(3 + i * 0.14, 4 + i * 0.3 + soft, 0.2 + 0.38 * a);
        break;
      case "raised":
        fall(1 + i * 0.08, 2 + i * 0.2 + soft, 0.2 + 0.4 * a);
        shadows.push(`inset 0 1px ${Math.round(soft)}px ${withAlpha(shade(c, 0.7), 0.2 + 0.4 * a)}`);
        break;
      case "pressed":
        shadows.push(
          `inset 0 ${Math.round(1 + i * 0.06)}px ${Math.round(2 + i * 0.18 + soft)}px ${withAlpha(shade(c, -0.6), 0.25 + 0.5 * a)}`,
          `inset 0 ${-Math.round(1 + i * 0.06)}px ${Math.round(soft)}px ${withAlpha(shade(c, 0.6), 0.12 + 0.3 * a)}`,
        );
        break;
      // a hard-edged iso block — the slab running off at the Angle, no blur at all
      case "isometric":
        slab(1, 5 + i * 0.3, -0.55);
        fall(3 + i * 0.12, soft, 0.2 + 0.4 * a);
        break;
      // the three turns: their paint is the transform, built above — Blur and
      // Angle dress the shadow that sells the lift
      case "perspective":
        fall(4 + i * 0.14, 8 + i * 0.32 + soft, 0.22 + 0.4 * a);
        break;
      case "tilt":
        shadows.push(
          `${r1p(dx * (6 + i * 0.14))}px ${r1p(dy * (6 + i * 0.14))}px ${Math.round(8 + i * 0.32 + soft)}px ${withAlpha(c, 0.22 + 0.4 * a)}`,
        );
        break;
      case "pop":
        shadows.push(
          `0 ${Math.round(5 + i * 0.2)}px ${Math.round(12 + i * 0.5 + soft)}px ${withAlpha(c, 0.16 + 0.36 * a)}`,
          `0 ${Math.round(2 + i * 0.08)}px ${Math.round(4 + i * 0.16 + soft)}px ${withAlpha(c, 0.14 + 0.3 * a)}`,
        );
        break;
    }
  }

  /* -------------------------------- glass ---------------------------------- */
  /* The frosted panes — Type · Blur · Intensity · Tint. What a pane does not
     use it leaves alone: Flat Tint never blurs, Glass Edge never lays a pane,
     Blur Background blurs the board and leaves the plate's own paint on top. */
  const gl = fx.glass;
  if (gl) {
    const i = Math.max(0, Math.min(100, gl.intensity));
    const a = i / 100;
    const blur = len(gl.blur);
    const c = gl.color || auto;
    /** the pane's two tones: the tint lit and the tint shaded */
    const lit = (al: number) => withAlpha(shade(c, 0.72), al);
    const pane = (extra: React.CSSProperties) => overLayer(extra);
    switch (gl.kind) {
      case "glass":
        pane({
          background: `linear-gradient(120deg, ${lit(0.12 + 0.4 * a)} 0%, ${lit(0.02 + 0.08 * a)} 55%, ${lit(0.08 + 0.18 * a)} 100%)`,
          border: `1px solid ${lit(0.25 + 0.4 * a)}`,
          boxSizing: "border-box",
          ...backdropOf(`blur(${Math.round(1 + blur * 0.4)}px) saturate(1.25)`),
        });
        break;
      case "frosted":
        pane({
          background: `linear-gradient(180deg, ${withAlpha(c, 0.18 + 0.45 * a)} 0%, ${withAlpha(c, 0.06 + 0.2 * a)} 100%)`,
          border: `1px solid ${lit(0.15 + 0.3 * a)}`,
          boxSizing: "border-box",
          ...backdropOf(`blur(${Math.round(2 + blur * 0.8)}px)`),
        });
        break;
      case "acrylic":
        pane({
          background: `linear-gradient(120deg, ${withAlpha(c, 0.15 + 0.4 * a)} 0%, ${withAlpha(c, 0.04 + 0.15 * a)} 100%)`,
          border: `1px solid ${lit(0.1 + 0.25 * a)}`,
          boxSizing: "border-box",
          ...backdropOf(`blur(${Math.round(1 + blur * 0.4)}px) saturate(1.4)`),
        });
        break;
      case "blurBg":
        pane(backdropOf(`blur(${Math.round(1 + blur)}px)`));
        break;
      case "clearGlass":
        pane({
          background: `linear-gradient(120deg, ${lit(0.08 + 0.25 * a)} 0%, ${lit(0.02 + 0.06 * a)} 100%)`,
          border: `1px solid ${lit(0.35 + 0.4 * a)}`,
          boxSizing: "border-box",
        });
        break;
      // flat tinted glass — colour with no blur at all
      case "tinted":
        pane({ background: withAlpha(c, 0.18 + 0.5 * a) });
        break;
      // a pane read by its lit edge alone
      case "glassEdge":
        pane({
          border: `1px solid ${lit(0.3 + 0.5 * a)}`,
          boxSizing: "border-box",
          boxShadow: `inset 0 1px 0 ${lit(0.18 + 0.4 * a)}, inset 0 -1px 0 ${withAlpha(shade(c, -0.5), 0.12 + 0.3 * a)}`,
        });
        break;
    }
  }

  /* ----------------------------- highlight --------------------------------- */
  /* A light laid over the plate's face — Type · Blur · Intensity · Angle ·
     Colour. Blur softens the light's own edge and Angle turns the way it
     runs, so one sheen can be laid on from any side. */
  const hl = fx.highlight;
  if (hl) {
    const i = Math.max(0, Math.min(100, hl.intensity));
    const a = i / 100;
    const soft = len(hl.blur);
    const { deg, x: hx, y: hy } = compass(hl.angle);
    const c = hl.color || auto;
    /** a linear light, running along the Angle */
    const along = (from: number, at: number, to: number, al: number, spread = 0) => {
      const p0 = Math.max(0, from - spread);
      const p1 = Math.max(p0 + 1, at - spread * 0.5);
      const p2 = Math.min(100, to + spread);
      return `linear-gradient(${deg}deg, ${withAlpha(c, 0)} ${p0}%, ${withAlpha(c, al)} ${p1}%, ${withAlpha(c, 0)} ${p2}%)`;
    };
    switch (hl.kind) {
      case "highlight":
        overLayer({
          background: `linear-gradient(${deg}deg, ${withAlpha(c, 0.15 + 0.7 * a)} 0%, ${withAlpha(c, 0.03 + 0.18 * a)} 38%, ${withAlpha(c, 0)} 62%)`,
          filter: soft ? `blur(${r1p(soft * 0.15)}px)` : undefined,
        });
        break;
      case "innerHighlight":
        overLayer({
          background: `linear-gradient(${deg}deg, ${withAlpha(c, 0.15 + 0.6 * a)} 0%, ${withAlpha(c, 0)} 55%)`,
          filter: soft ? `blur(${Math.round(soft * 0.5)}px)` : undefined,
        });
        break;
      case "outerHighlight":
        shadows.push(
          `0 0 0 ${Math.max(1, Math.round(i * 0.05))}px ${withAlpha(c, 0.25 + 0.5 * a)}`,
          `0 0 ${Math.round(4 + i * 0.3 + soft * 1.6)}px ${withAlpha(c, 0.2 + 0.4 * a)}`,
        );
        break;
      case "edgeHighlight":
        shadows.push(`inset 0 0 ${Math.round(soft)}px ${Math.max(1, Math.round(i * 0.04))}px ${withAlpha(c, 0.2 + 0.65 * a)}`);
        break;
      case "gloss":
        overLayer({
          background: `linear-gradient(${deg}deg, ${withAlpha(c, 0.25 + 0.6 * a)} 0%, ${withAlpha(c, 0.06 + 0.18 * a)} 46%, ${withAlpha(c, 0)} 47%)`,
          filter: soft ? `blur(${Math.round(soft * 0.3)}px)` : undefined,
        });
        break;
      // a broad sheen sweeping the body — Blur is how wide it is, Angle the way it runs
      case "sheen":
        overLayer({ background: along(26, 45, 74, 0.3 + 0.65 * a, soft * 0.5) });
        break;
      // a hard flash across the body
      case "shine":
        overLayer({
          background: `linear-gradient(${deg}deg, ${withAlpha(c, 0)} 34%, ${withAlpha(c, 0.25 + 0.6 * a)} 47%, ${withAlpha(
            c,
            0,
          )} ${Math.min(72, 60 + soft * 0.3)}%), linear-gradient(${deg}deg, ${withAlpha(c, 0)} 44%, ${withAlpha(
            c,
            0.14 + 0.3 * a,
          )} 50%, ${withAlpha(c, 0)} 56%)`,
        });
        break;
      // a thin streak of light across the body
      case "reflection":
        overLayer({ background: along(34 + soft * 0.3, 47 + soft * 0.2, 60 + soft * 0.4, 0.25 + 0.5 * a) });
        break;
      // a cone of light falling on the plate from the Angle's side
      case "spotlight": {
        const at = `${(50 - hx * 46).toFixed(0)}% ${(50 - hy * 46).toFixed(0)}%`;
        overLayer({
          background: `radial-gradient(ellipse 92% 84% at ${at}, ${withAlpha(c, 0.16 + 0.6 * a)} 0%, ${withAlpha(
            c,
            0.03 + 0.12 * a,
          )} 52%, ${withAlpha(c, 0)} 72%)`,
          filter: soft ? `blur(${Math.round(soft * 0.5)}px)` : undefined,
        });
        break;
      }
      // a bright hairline hugging the edge, with a little bloom behind it
      case "rimLight":
        shadows.push(
          `inset 0 0 0 ${Math.max(1, Math.round(1 + soft * 0.1))}px ${withAlpha(c, 0.35 + 0.6 * a)}`,
          `0 0 ${Math.round(2 + i * 0.12 + soft)}px ${withAlpha(c, 0.2 + 0.5 * a)}`,
        );
        break;
    }
  }

  /* --------------------------------- blur ---------------------------------- */
  /* Type · Blur · Intensity · Direction · Colour — the plate blurred, the
     board blurred behind it, or a blurred copy of the plate worn behind. */
  const bl = fx.blur;
  if (bl) {
    const i = Math.max(0, Math.min(100, bl.intensity));
    const a = i / 100;
    const amount = len(bl.blur);
    const c = bl.color || auto;
    const { deg } = compass(bl.angle);
    switch (bl.kind) {
      // the plate itself, blurred into a soft blob
      case "soft":
        filters.push(`blur(${r1p(amount)}px)`);
        break;
      // a deep blur, the edges melting away into the board
      case "gaussian":
        filters.push(`blur(${r1p(amount)}px)`);
        maskFade = `radial-gradient(ellipse 94% 90% at 50% 50%, black ${Math.round(62 - a * 18)}%, transparent 100%)`;
        break;
      // only the board behind the plate, blurred
      case "backdrop":
        overLayer({
          ...backdropOf(`blur(${r1p(amount)}px)`),
          background: withAlpha(c, 0.04 + 0.14 * a),
        });
        break;
      // a directional smear, running the way Direction points
      case "motion":
        filters.push(`blur(${r1p(amount)}px)`);
        backLayer({
          background: withAlpha(c, 0.1 + 0.3 * a),
          transform: `${pre}translate(${r1p(Math.sin((deg * Math.PI) / 180) * 3)}px, ${r1p(
            -Math.cos((deg * Math.PI) / 180) * 3,
          )}px)`,
          filter: `blur(${r1p(amount * 0.6)}px)`,
        });
        break;
      // a radial smear running out from the middle
      case "zoom":
        filters.push(`blur(${r1p(amount * 0.5)}px)`);
        backLayer({
          background: withAlpha(c, 0.08 + 0.26 * a),
          transform: `${pre}scale(1.06)`,
          filter: `blur(${r1p(amount)}px)`,
        });
        break;
      // the edge melted into the board, along the Direction
      case "feather":
        maskFade = `linear-gradient(${deg}deg, transparent 0%, black ${Math.max(2, Math.round(amount * 0.6))}%, black ${Math.max(
          4,
          100 - Math.round(amount * 0.6),
        )}%, transparent 100%)`;
        break;
      // a blurred coloured copy of the plate behind it
      case "bloom":
        backLayer({
          background: withAlpha(shade(c, 0.15), 0.25 + 0.5 * a),
          filter: `blur(${r1p(amount)}px)`,
          transform: `${pre}scale(1.02)`,
        });
        break;
      // a blurred plate under a frost of the tint
      case "frost":
        filters.push(`blur(${r1p(amount * 0.6)}px)`);
        overLayer(backdropOf(`blur(${r1p(amount)}px) saturate(1.15)`));
        break;
    }
  }

  /* ----------------------------- decorations ------------------------------- */
  /* The patterns, the textures and the accents — and the two fades and the
     accents that the shared text-plate engine paints (see `BANNER_SHARED_DECOR`). */
  const dc = fx.decor;
  if (dc) {
    const i = Math.max(0, Math.min(100, dc.intensity));
    const a = i / 100;
    const c = dc.color || auto;
    switch (dc.kind) {
      case "vignette":
        overLayer({
          background: `radial-gradient(ellipse at center, ${withAlpha(c, 0)} 52%, ${withAlpha(c, 0.15 + 0.7 * a)} 100%)`,
        });
        break;
      case "texture":
        overLayer({ backgroundImage: NOISE_BG, backgroundSize: "140px 140px", opacity: shapeOpacity * (0.3 + 0.7 * a) });
        break;
      case "pattern":
        overLayer({
          background: `repeating-linear-gradient(45deg, ${withAlpha(c, 0.12 + 0.45 * a)} 0 2px, ${withAlpha(c, 0)} 2px 9px)`,
          opacity: shapeOpacity * (0.5 + 0.5 * a),
        });
        break;
      // even round dots scattered over the paint
      case "dots":
        overLayer({
          background: `radial-gradient(${withAlpha(c, 0.2 + 0.62 * a)} 1.4px, ${withAlpha(c, 0)} 1.6px)`,
          backgroundSize: "12px 12px",
        });
        break;
      // a fine square grid woven over the paint
      case "grid":
        overLayer({
          background: `repeating-linear-gradient(0deg, ${withAlpha(c, 0.14 + 0.5 * a)} 0 1px, ${withAlpha(
            c,
            0,
          )} 1px 14px), repeating-linear-gradient(90deg, ${withAlpha(c, 0.14 + 0.5 * a)} 0 1px, ${withAlpha(c, 0)} 1px 14px)`,
        });
        break;
      // a dashed stitch running just inside the rim
      case "stitch":
        overLayer({
          outline: `2px dashed ${withAlpha(c, 0.3 + 0.65 * a)}`,
          outlineOffset: "-6px",
        });
        break;
      // fine rays radiating from the middle of the plate
      case "sunburst":
        overLayer({
          background: `repeating-conic-gradient(from 0deg at 50% 50%, ${withAlpha(c, 0.08 + 0.4 * a)} 0deg 8deg, ${withAlpha(
            c,
            0,
          )} 8deg 16deg)`,
        });
        break;
      case "gradientShadow":
        backLayer({
          background: `linear-gradient(180deg, ${withAlpha(c, Math.min(1, 0.35 + 0.65 * a))} 0%, ${withAlpha(
            shade(c, -0.35),
            Math.max(0, 0.15 + 0.5 * a),
          )} 100%)`,
          transform: `${pre}translateY(${(6 + i * 0.12).toFixed(1)}px)`,
        });
        break;
      case "colorShadow":
        shadows.push(`${Math.round(6 + i * 0.06)}px ${Math.round(8 + i * 0.08)}px 0 0 ${withAlpha(c, 0.25 + 0.7 * a)}`);
        break;
      case "edgeDarkening":
        shadows.push(`inset 0 0 ${Math.round(3 + i * 0.15)}px ${Math.max(1, Math.round(i * 0.05))}px ${withAlpha(c, 0.2 + 0.6 * a)}`);
        break;
      /* the shared text-plate vocabulary (lib/shapeEffects) — the patterns and
         the accents, painted by the very engine a text plate wears */
      case "stripes":
      case "checker":
      case "fadeRight":
      case "fadeEdges":
      case "ring":
      case "offsetOutline":
      case "sticker":
      case "stack":
      case "topBar":
      case "bottomBar":
      case "leftBar":
      case "cornerFold": {
        const passes: ShapeEffectPasses = shapeEffectPasses(dc.kind as TextBgEffectKind, i, c, base);
        if (passes.filters.length) filters.push(...passes.filters);
        if (passes.overlay || passes.backdrop) {
          overLayer({
            ...(passes.backdrop ? backdropOf(passes.backdrop) : {}),
            ...(passes.overlay ?? {}),
          });
        }
        for (const h of passes.behind) pushSharedBehind(h);
        if (passes.mask) maskFade = passes.mask;
        if (passes.transform) transform += ` ${passes.transform}`;
        break;
      }
    }
  }

  /* ------------------------------- finishes -------------------------------- */
  /* The modern surface treatments — the grain, the mesh, the metallic and the
     rest. The glass family is the **Glass** category, dressed by its own card. */
  const m = fx.modern;
  if (m) {
    const i = Math.max(0, Math.min(100, m.intensity));
    const a = i / 100;
    const c = m.color || auto;
    const blur = Math.max(0, m.blur ?? 0);
    /**
     * The finish's two tones: the tint lit and the tint shaded. Left on Auto the
     * tint is the shape's own colour, so a soft-UI lift is a lighter / darker
     * pass of the plate rather than a strip of plain white laid over it — the
     * highlight follows the plate the moment it is repainted. (The two
     * materials with a palette of their own — `metallic`'s chrome and
     * `holographic`'s iridescence — keep it: the finish IS the colour there.)
     */
    const lit = (al: number) => withAlpha(shade(c, 0.72), al);
    const deep = (al: number) => withAlpha(shade(c, -0.5), al);
    switch (m.kind) {
      case "noise":
        overLayer({ backgroundImage: NOISE_BG, backgroundSize: "140px 140px", opacity: shapeOpacity * (0.25 + 0.75 * a) });
        break;
      case "softGradient":
        overLayer({
          background: `linear-gradient(120deg, ${lit(0.1 + 0.35 * a)} 0%, ${lit(0)} 45%, ${deep(0.05 + 0.25 * a)} 100%)`,
          filter: blur ? `blur(${r1p(blur * 0.4)}px)` : undefined,
        });
        break;
      case "mesh":
        overLayer({ background: meshBg(c, a) });
        break;
      // an iridescent sheen — pink, cyan, gold and violet walking one diagonal
      case "holographic":
        overLayer({
          background: `linear-gradient(115deg, ${withAlpha("#ff7ad9", 0.1 + 0.3 * a)} 0%, ${withAlpha(
            "#7af0ff",
            0.1 + 0.3 * a,
          )} 28%, ${withAlpha("#fff3a0", 0.08 + 0.26 * a)} 52%, ${withAlpha("#b28bff", 0.1 + 0.3 * a)} 76%, ${withAlpha(
            "#7af0ff",
            0.08 + 0.24 * a,
          )} 100%)`,
        });
        break;
      // brushed metal — a chrome sheen over fine horizontal bands
      case "metallic":
        overLayer({
          background: `linear-gradient(180deg, ${withAlpha("#ffffff", 0.28 + 0.4 * a)} 0%, ${withAlpha(
            "#ffffff",
            0.04,
          )} 30%, ${withAlpha("#000000", 0.1 + 0.28 * a)} 50%, ${withAlpha("#ffffff", 0.14 + 0.3 * a)} 64%, ${withAlpha(
            "#000000",
            0.08 + 0.22 * a,
          )} 100%), repeating-linear-gradient(90deg, ${withAlpha("#ffffff", 0.05 + 0.15 * a)} 0 1px, ${withAlpha(
            "#000000",
            0.04 + 0.12 * a,
          )} 1px 2px, ${withAlpha("#ffffff", 0)} 2px 4px)`,
        });
        break;
      // the tint's two tones — light and deep — split on one diagonal
      case "duotone":
        overLayer({
          background: `linear-gradient(120deg, ${withAlpha(c, 0.22 + 0.48 * a)} 0%, ${withAlpha(c, 0.05 + 0.14 * a)} 48%, ${withAlpha(
            shade(c, -0.5),
            0.22 + 0.48 * a,
          )} 100%)`,
        });
        break;
      // the soft raised card — a light shadow up-left, a dark one down-right
      case "softUi": {
        const off = Math.max(2, Math.round(i * 0.12));
        shadows.push(
          `${-off}px ${-off}px ${off * 2 + blur}px ${lit(0.12 + 0.4 * a)}`,
          `${off}px ${off}px ${off * 2 + blur}px ${deep(0.16 + 0.44 * a)}`,
        );
        break;
      }
    }
  }

  return { shadows, back, over, filters, transform, radius: fxRadius, mask, maskFade };
}

/**
 * The body's paint. Most silhouettes wear the fill alone; the **multilayer
 * gradient** family stacks a second paint over it — a diagonal band of light, a
 * hard split, a gloss along the top edge, a fine stripe weave — so one plate
 * reads as several. Every layer is a percentage of the plate's own box, so the
 * look holds at 630 px on the board and at thumbnail scale in the gallery.
 */
export function platePaint(b: BannerSettings, fill: string): Pick<React.CSSProperties, "background"> {
  const light = (a: number) => withAlpha("#ffffff", a);
  const dark = (a: number) => withAlpha("#000000", a);
  switch (b.shape) {
    case "sheen":
      return { background: `linear-gradient(115deg, ${light(0)} 30%, ${light(0.3)} 46%, ${light(0)} 62%), ${fill}` };
    case "split":
      return { background: `linear-gradient(118deg, ${light(0.2)} 0 50%, ${dark(0.22)} 50% 100%), ${fill}` };
    case "gloss":
      return { background: `linear-gradient(180deg, ${light(0.38)} 0%, ${light(0.06)} 46%, ${dark(0.18)} 100%), ${fill}` };
    case "stripes":
      return { background: `repeating-linear-gradient(115deg, ${light(0.12)} 0 8px, ${light(0)} 8px 20px), ${fill}` };
    /* ---- the silhouettes added later --------------------------------- */
    // a burst of rays over the plate's own paint — the sunburst's rays run from
    // the middle of the box, so they hold at 630 px and at thumbnail scale
    case "sunburstPlate":
      return { background: `repeating-conic-gradient(from 0deg at 50% 50%, ${light(0.24)} 0deg 7deg, ${light(0)} 7deg 14deg), ${fill}` };
    // glass: a bright corner sheen over a frost that darkens toward the bottom
    case "glassPlate":
      return {
        background: `linear-gradient(118deg, ${light(0.45)} 0 18%, ${light(0.06)} 42%, ${light(0)} 62%), linear-gradient(180deg, ${light(0.3)} 0%, ${light(0.04)} 46%, ${dark(0.14)} 100%), ${fill}`,
      };
    // a ticket: two dashed perforations standing where the mask bites the edges
    case "ticketBanner": {
      const perf = `repeating-linear-gradient(180deg, ${dark(0.42)} 0 4px, ${dark(0)} 4px 9px)`;
      return { background: `${perf} 18% 50% / 2px 72% no-repeat, ${perf} 82% 50% / 2px 72% no-repeat, ${fill}` };
    }
    // a hollow plate: the middle stays clear and the fill paints the ring,
    // which `plateShadow` draws as an inset rule that follows the corners
    case "outlineBanner":
      return { background: "transparent" };
    default:
      return { background: fill };
  }
}

/**
 * how many paints the body itself carries — 1 for an ordinary plate, 2 for a
 * gradient layer (the split banner files under modern now, but still stacks its
 * hard diagonal over its own gradient) and 3 for the glass and ticket plates,
 * which stack two layers of their own over the fill
 */
const PLATE_PAINT_STACK: Partial<Record<BannerShape, number>> = {
  sheen: 2,
  split: 2,
  gloss: 2,
  stripes: 2,
  sunburstPlate: 2,
  glassPlate: 3,
  ticketBanner: 3,
};

export const platePaintLayers = (b: BannerSettings): number => PLATE_PAINT_STACK[b.shape] ?? 1;

/**
 * The plate's own extra layers, painted **behind** its body and **under** the
 * heading: the multilayer silhouettes and the stacked-gradient plate. Each
 * layer wears the plate's own box (`plateRect`), so it follows the free size,
 * the nudge and the centring exactly — and each offset is a percentage of that
 * box, so a stack reads as a stack at 630 px and at thumbnail scale alike.
 *
 * Nothing here uses `filter`: the outer halo is the plate's only blurred layer,
 * so a reader (and a test) can still tell the two apart.
 */
export function bannerLayers(b: BannerSettings, base: string): React.CSSProperties[] {
  const common: React.CSSProperties = { position: "absolute", pointerEvents: "none" };
  const rect = plateRect(b);
  const radius = plateRadius(b);
  const clip = plateClipPath(b);
  switch (b.shape) {
    // three plates, each peeking out from behind the one above it
    case "stack":
      return [
        { ...common, ...rect, background: withAlpha(shade(base, -0.55), 0.34), borderRadius: radius, clipPath: clip, transform: "translate(4.5%, 34%)" },
        { ...common, ...rect, background: withAlpha(shade(base, -0.32), 0.55), borderRadius: radius, clipPath: clip, transform: "translate(2.2%, 17%)" },
      ];
    // a second plate behind, a hair larger and a little lower, plus an inner rule
    case "frame":
      return [{ ...common, ...rect, background: withAlpha(shade(base, 0.5), 0.5), borderRadius: radius, clipPath: clip, transform: "translate(0, 15%) scale(1.055)" }];
    // a colour block riding on the plate's leading end. The cut is written as a
    // percentage of the plate's own box, so the block stays a sixth of the plate
    // at 630 px and at thumbnail scale alike — and the corner it keeps is
    // spelled with its unit, since a clip-path is a string React hands over
    // verbatim and a bare `round 14` would be thrown away as invalid CSS.
    case "accent": {
      const round = radius === undefined ? "" : ` round ${typeof radius === "number" ? `${radius}px` : radius}`;
      return [{ ...common, ...rect, background: withAlpha(shade(base, -0.42), 0.95), clipPath: `inset(0 84% 0 0${round})` }];
    }
    // the plate's own outline, drawn again and offset — the "offset sketch" look
    case "offsetLine":
      return [
        {
          ...common,
          ...rect,
          border: `2px solid ${withAlpha(shade(base, 0.65), 0.85)}`,
          borderRadius: radius,
          clipPath: clip,
          boxSizing: "border-box",
          transform: "translate(2.5%, 24%)",
        },
      ];
    // a long diagonal shadow on a layer of its own, fading as it goes
    case "longShadow":
      return [
        {
          ...common,
          ...rect,
          background: `linear-gradient(135deg, ${withAlpha("#000000", 0.5)} 0%, ${withAlpha("#000000", 0)} 78%)`,
          borderRadius: radius,
          clipPath: clip,
          transform: "translate(3%, 26%)",
        },
      ];
    // three plates, each wearing a gradient of its own
    case "gradStack":
      return [
        {
          ...common,
          ...rect,
          background: `linear-gradient(90deg, ${withAlpha(shade(base, -0.6), 0.42)}, ${withAlpha(shade(base, -0.25), 0.3)})`,
          borderRadius: radius,
          transform: "translate(5%, 38%)",
        },
        {
          ...common,
          ...rect,
          background: `linear-gradient(90deg, ${withAlpha(shade(base, 0.4), 0.5)}, ${withAlpha(shade(base, -0.15), 0.38)})`,
          borderRadius: radius,
          transform: "translate(2.5%, 19%)",
        },
      ];
    // the title banner's own colour strip, riding the plate's leading end and
    // running a hair past its top and bottom — the body is cut back from it
    case "titleBanner":
      return [{ ...common, ...rect, background: withAlpha(shade(base, -0.38), 1), clipPath: "inset(-6% 86% -6% 0 round 999px)" }];
    // the folded ribbon's two tails, darker than the body and stepped down and
    // out from its ends, each with a notch cut in its inner edge
    case "foldedBanner":
      return [
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.4), 1),
          clipPath: "polygon(0 0, 36% 0, 27% 50%, 36% 100%, 0 100%)",
          transform: "translate(-6%, 18%)",
        },
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.4), 1),
          clipPath: "polygon(64% 0, 100% 0, 100% 100%, 64% 100%, 73% 50%)",
          transform: "translate(6%, 18%)",
        },
      ];
    // the curved ribbon's tails — the folded ribbon's own, under a wavy body
    case "curvedRibbon":
      return [
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.4), 1),
          clipPath: "polygon(0 0, 36% 0, 27% 50%, 36% 100%, 0 100%)",
          transform: "translate(-6%, 20%)",
        },
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.4), 1),
          clipPath: "polygon(64% 0, 100% 0, 100% 100%, 64% 100%, 73% 50%)",
          transform: "translate(6%, 20%)",
        },
      ];
    // the scroll's two rolled ends — a light shade of the parchment, standing
    // a hair past its top and bottom in the gap the body's cut leaves
    case "scrollBanner":
      return [
        { ...common, ...rect, background: withAlpha(shade(base, 0.45), 1), clipPath: "inset(-5% 89% -5% 1% round 999px)" },
        { ...common, ...rect, background: withAlpha(shade(base, 0.45), 1), clipPath: "inset(-5% 1% -5% 89% round 999px)" },
      ];
    // the floating plate's ground shadow — a soft ellipse, squashed, a step
    // below the card
    case "floatingPlate":
      return [
        {
          ...common,
          ...rect,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 70%)",
          borderRadius: 999,
          transform: "translateY(30%) scaleY(0.35)",
        },
      ];
    /* ---- the premium plates: layers of their own ---------------------- */
    // the double ribbon's two tails — darker than its notched body, stepped
    // down and out from its ends, each notched back into itself
    case "doubleRibbon":
      return [
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.42), 1),
          clipPath: "polygon(0 0, 40% 0, 30% 50%, 40% 100%, 0 100%)",
          transform: "translate(-7%, 22%)",
        },
        {
          ...common,
          ...rect,
          background: withAlpha(shade(base, -0.42), 1),
          clipPath: "polygon(60% 0, 100% 0, 100% 100%, 60% 100%, 70% 50%)",
          transform: "translate(7%, 22%)",
        },
      ];
    // three plates behind, each a step darker and a step lower — the layered
    // banner's own stack, one plate deeper
    case "tripleLayer":
      return [
        { ...common, ...rect, background: withAlpha(shade(base, -0.62), 0.3), borderRadius: radius, clipPath: clip, transform: "translate(6.5%, 46%)" },
        { ...common, ...rect, background: withAlpha(shade(base, -0.44), 0.48), borderRadius: radius, clipPath: clip, transform: "translate(4.3%, 31%)" },
        { ...common, ...rect, background: withAlpha(shade(base, -0.26), 0.68), borderRadius: radius, clipPath: clip, transform: "translate(2.1%, 15%)" },
      ];
    // the 3D plate's extruded edge — a slab of the same silhouette standing
    // straight below the body, with a squashed contact shade under it
    case "plate3d":
      return [
        { ...common, ...rect, background: withAlpha(shade(base, -0.5), 1), borderRadius: radius, clipPath: clip, transform: "translateY(13%)" },
        { ...common, ...rect, background: withAlpha("#000000", 0.34), borderRadius: radius, clipPath: clip, transform: "translateY(26%) scaleY(0.3)" },
      ];
    default:
      return [];
  }
}

function ruleRect(b: BannerSettings): Pick<React.CSSProperties, "left" | "bottom" | "width" | "height"> {
  const x = b.pos?.x ?? 0;
  const y = b.pos?.y ?? 0;
  // the rule is the plate's width — 630 px across, like every other silhouette
  const w = paintedWidth(b);
  return {
    left: w === undefined ? `calc(-${b.padX}% ${nudge(x)})` : `calc(50% ${nudge(x - w / 2)})`,
    bottom: `calc(-${Math.max(4, b.padY / 3)}% ${nudge(y)})`,
    width: w === undefined ? `calc(100% + ${2 * b.padX}%)` : `${w}px`,
    // the Height slider is a rule's thickness; the radius keeps its default
    height: b.size?.h === undefined ? Math.max(4, b.radius / 2) : b.size.h,
  };
}

/** CSS gradient string (or a solid colour when the gradient is off). */
export function gradientCss(g: Gradient, fallback: string): string {
  if (!g.enabled || g.stops.length < 2) return fallback;
  const sorted = [...g.stops].sort((a, b) => a.at - b.at);
  const stops = sorted.map((s) => `${s.color} ${s.at}%`).join(", ");
  if (g.type === "radial") {
    // older saved gradients have no centre — default to the middle
    const cx = g.cx ?? 50;
    const cy = g.cy ?? 50;
    return `radial-gradient(ellipse at ${cx}% ${cy}%, ${stops})`;
  }
  if (g.type === "mesh") {
    // modern mesh look: soft radial colour blobs layered over a base.
    // The base is a solid gradient (not a bare colour) so the string also
    // works in `background-image` contexts such as gradient text.
    const base = sorted[0]?.color ?? fallback;
    const spots = ["18% 18%", "82% 14%", "85% 85%", "14% 86%", "50% 45%", "68% 28%"];
    const layers = sorted.slice(1).map(
      (s, i) => `radial-gradient(ellipse 58% 48% at ${spots[i % spots.length]}, ${s.color} 0%, transparent 72%)`,
    );
    return layers.length ? `${layers.join(", ")}, linear-gradient(${base}, ${base})` : base;
  }
  if (g.type === "conic") {
    // the angular sweep: the stops ride one turn round the plate's own centre,
    // starting from the gradient's angle
    const cx = g.cx ?? 50;
    const cy = g.cy ?? 50;
    return `conic-gradient(from ${g.angle}deg at ${cx}% ${cy}%, ${stops})`;
  }
  if (g.type === "reflected") {
    // the ramp mirrored out from the middle: the first colour holds the centre
    // and the last one both ends, along the same angle a linear ramp would run
    const mirrored = [
      ...[...sorted].reverse().map((s) => ({ color: s.color, at: 50 - s.at / 2 })),
      ...sorted.map((s) => ({ color: s.color, at: 50 + s.at / 2 })),
    ];
    return `linear-gradient(${g.angle}deg, ${mirrored.map((s) => `${s.color} ${s.at}%`).join(", ")})`;
  }
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** The dominant colour of a gradient (first stop) — used for glows/halos. */
export const baseColor = (g: Gradient, fallback: string) => (g.enabled && g.stops[0] ? g.stops[0].color : fallback);

/** `#rgb` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()` → [r, g, b, a]; null when unreadable */
function parsePaint(c: string): [number, number, number, number] | null {
  const v = String(c ?? "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v)?.[1];
  if (hex) {
    const h = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  return null;
}

/**
 * The ONE flat colour a gradient stands for, where a channel can only paint
 * one — a shadow, a glow, a pane's tint. The stops are blended together
 * (each weighted by its own alpha), so a red → blue ramp throws a violet
 * shadow instead of ignoring half the pick.
 */
export function gradientPaintColor(g: Gradient | undefined, fallback: string): string {
  if (!g?.enabled || !g.stops.length) return fallback;
  let r = 0;
  let gr = 0;
  let bl = 0;
  let w = 0;
  for (const s of g.stops) {
    const p = parsePaint(s.color);
    if (!p) continue;
    const a = Math.max(0, Math.min(1, p[3]));
    if (a <= 0.02) continue; // a clear stop paints nothing — it must not pull the blend toward black
    r += p[0] * a;
    gr += p[1] * a;
    bl += p[2] * a;
    w += a;
  }
  if (w <= 0) return fallback;
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n / w))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(gr)}${hex(bl)}`;
}

/**
 * What a single-colour channel paints: the gradient's blended tone while one
 * is enabled, else the channel's own `color` (which may be "" = auto).
 */
export function channelPaint(color: string, gradient?: Gradient): string {
  return gradient?.enabled ? gradientPaintColor(gradient, color) : color;
}

/* ------------------------------------------------------------------ */
/*  The plate's ten fills                                              */
/* ------------------------------------------------------------------ */

/**
 * Which paint the plate is wearing right now. Only the three special paints
 * live in `fillMode`; **solid** and **gradient** are read from
 * `gradient.enabled` — so a preset or a design that repaints `gradient` is
 * never hidden behind a stale mode, and an untouched older deck reads exactly
 * the way it always did.
 */
export function bannerFillMode(b: BannerSettings): BannerFillMode {
  const m = b.fillMode;
  if (m === "glass" || m === "metallic" || m === "pattern") return m;
  return b.gradient.enabled ? "gradient" : "solid";
}

/**
 * The frosted pane: a tinted sheet that grows denser toward the bottom, with
 * the light gathered along the top edge and a cold sheen across the corner —
 * written as stacked gradients only, so exports capture it pixel for pixel.
 */
export function glassFillCss(base: string, glass?: BannerGlassFill): string {
  const g = { ...DEFAULT_BANNER_GLASS, ...glass };
  const c = channelPaint(g.color, g.gradient) || base;
  const o = Math.max(0, Math.min(100, g.opacity)) / 100;
  const f = Math.max(0, Math.min(100, g.frost)) / 100;
  const pane = (a: number) => withAlpha(c, Math.max(0, Math.min(1, a)));
  const ice = (a: number) => withAlpha("#ffffff", Math.max(0, Math.min(1, a)));
  return [
    `linear-gradient(118deg, ${ice(0.34 * f + 0.08)} 0%, ${ice(0.05 * f)} 44%, ${ice(0.14 * f + 0.02)} 100%)`,
    `radial-gradient(ellipse 120% 62% at 50% 0%, ${ice(0.16 * f + 0.04)} 0%, ${ice(0)} 68%)`,
    `linear-gradient(180deg, ${pane(0.28 + 0.5 * o)} 0%, ${pane(0.42 + 0.55 * o)} 100%)`,
  ].join(", ");
}

/**
 * Brushed metal: bright and shaded bands brushed along one angle — the polish
 * slider drives how far apart the bright and the dark bands sit.
 */
export function metallicFillCss(base: string, metal?: BannerMetallicFill): string {
  const m = { ...DEFAULT_BANNER_METALLIC, ...metal };
  const c = channelPaint(m.color, m.gradient) || base;
  const p = Math.max(0, Math.min(100, m.polish)) / 100;
  const hi = shade(c, 0.5 + 0.35 * p);
  const light = shade(c, 0.18 + 0.2 * p);
  const deep = shade(c, -(0.28 + 0.3 * p));
  return `linear-gradient(${m.angle}deg, ${hi} 0%, ${light} 16%, ${deep} 34%, ${c} 50%, ${hi} 64%, ${light} 78%, ${deep} 90%, ${shade(c, 0.08)} 100%)`;
}

/**
 * The pattern motifs. Every one is a single `background` value — the tiled
 * kinds carry their own `position / size` inside the shorthand and the
 * repeating kinds need none — so the pattern flows through the same paint
 * channel as every other fill.
 */
export function patternFillCss(base: string, pattern?: BannerPatternFill): string {
  const p = { ...DEFAULT_BANNER_PATTERN, ...pattern };
  const ink = channelPaint(p.color, p.gradient) || base;
  const ground = channelPaint(p.back, p.backGradient) || base;
  const t = Math.max(0, Math.min(100, p.scale)) / 100;
  const tile = Math.round(10 + 26 * t); // the motif tile, 10–36 px
  const clear = withAlpha(ink, 0);
  /* a gradient ground really paints its ramp — the ground is a full layer of its own */
  const baseLayer = p.backGradient?.enabled
    ? gradientCss(p.backGradient, ground)
    : `linear-gradient(${ground}, ${ground})`;
  switch (p.kind) {
    case "dots": {
      const r = Math.max(1.5, tile * 0.16);
      return `radial-gradient(circle, ${ink} ${r}px, ${clear} ${r + 0.6}px) 0 0 / ${tile}px ${tile}px, ${baseLayer}`;
    }
    case "stripes": {
      const w = Math.max(3, Math.round(tile * 0.3));
      return `repeating-linear-gradient(45deg, ${ink} 0 ${w}px, ${clear} ${w}px ${tile}px), ${baseLayer}`;
    }
    case "lines": {
      const w = Math.max(2, Math.round(tile * 0.14));
      return `repeating-linear-gradient(0deg, ${ink} 0 ${w}px, ${clear} ${w}px ${tile}px), ${baseLayer}`;
    }
    case "grid": {
      const w = Math.max(1, Math.round(tile * 0.09));
      return `repeating-linear-gradient(0deg, ${ink} 0 ${w}px, ${clear} ${w}px ${tile}px), repeating-linear-gradient(90deg, ${ink} 0 ${w}px, ${clear} ${w}px ${tile}px), ${baseLayer}`;
    }
    case "checker":
      return `repeating-conic-gradient(${ink} 0% 25%, ${ground} 25% 50%) 0 0 / ${tile}px ${tile}px`;
    case "diamonds":
      return [
        `linear-gradient(45deg, ${ink} 25%, ${clear} 25%) 0 0 / ${tile}px ${tile}px`,
        `linear-gradient(135deg, ${ink} 25%, ${clear} 25%) 0 0 / ${tile}px ${tile}px`,
        `linear-gradient(225deg, ${ink} 25%, ${clear} 25%) 0 0 / ${tile}px ${tile}px`,
        `linear-gradient(315deg, ${ink} 25%, ${clear} 25%) 0 0 / ${tile}px ${tile}px`,
        baseLayer,
      ].join(", ");
    case "rays": {
      const on = Math.max(2, Math.round(tile * 0.18));
      const off = Math.max(4, Math.round(tile * 0.4));
      return `repeating-conic-gradient(from 0deg at 50% 50%, ${withAlpha(ink, 0.85)} 0deg ${on}deg, ${clear} ${on}deg ${off}deg), ${baseLayer}`;
    }
    case "rings": {
      const w = Math.max(2, Math.round(tile * 0.14));
      return `repeating-radial-gradient(circle at 50% 50%, ${ink} 0 ${w}px, ${clear} ${w}px ${tile}px), ${baseLayer}`;
    }
    default:
      return baseLayer;
  }
}

/**
 * The paint the plate's body wears right now — one of the ten fills: the
 * solid colour, the gradient's five ramps (linear · radial · angular ·
 * reflected · multi-colour · transparent all ride `gradient`), or one of the
 * three special paints.
 */
export function bannerFillCss(b: BannerSettings): string {
  const base = baseColor(b.gradient, b.color || DEFAULT_BANNER.color);
  const mode = bannerFillMode(b);
  if (mode === "glass") return glassFillCss(base, b.glass);
  if (mode === "metallic") return metallicFillCss(base, b.metallic);
  if (mode === "pattern") return patternFillCss(base, b.pattern);
  return gradientCss(b.gradient, b.color || DEFAULT_BANNER.color);
}

export interface BannerCss {
  /** the plate's body — fill, corners, silhouette and its own transparency */
  box: React.CSSProperties;
  /**
   * The plate's own extra layers — the multilayer silhouettes (stacked plates,
   * double frame, accent block, offset outline, long shadow) and the stacked
   * gradient plate, plus the effect layers the Effects card paints (the long
   * shadow's streak, the 3D's slabs, the gradient shadow). They are painted
   * **behind** `box` and **under** the heading, in the order given, and they
   * fade with the shape's own transparency. Empty for every single-body
   * silhouette wearing no effects.
   */
  layers: React.CSSProperties[];
  /**
   * the outline, on a layer of its own: its transparency is the Border
   * transparency, so it fades without taking the fill down with it
   */
  border?: React.CSSProperties;
  /** extra glow layer under the box, optional */
  halo?: React.CSSProperties;
  /**
   * The Effects card's overlays — glass, noise, the gloss and the sheen, the
   * mesh and the vignette — painted **above** the body and the line, **under**
   * the heading. Each wears the body's own box and silhouette, so the
   * overlay follows the free size, the nudge and the cut exactly.
   */
  overlays: React.CSSProperties[];
  /** styles applied to the title text */
  text: React.CSSProperties;
  /** inner padding on the title wrapper so the banner fits around the text */
  padding: string;
}

/**
 * The shadows a body carries on *itself* — the double frame's inner hairline
 * and the long shadow's soft fall, the classic bar's embossed top and bottom
 * rules, the badge's double ring, the oval and circle plates' rims, the
 * geometric plate's inner rule and the floating card's lift off the board.
 * Everything else the silhouette paints rides a layer of its own, so none of
 * these fights the outline's layer.
 */
export function plateShadow(b: BannerSettings, base: string): string | undefined {
  switch (b.shape) {
    case "frame":
      return `inset 0 0 0 2px ${withAlpha(shade(base, 0.7), 0.42)}`;
    case "longShadow":
      return "0 12px 28px -14px rgba(0,0,0,.65)";
    case "classicBanner":
      return `inset 0 3px 0 ${withAlpha(shade(base, 0.55), 0.9)}, inset 0 -3px 0 ${withAlpha(shade(base, -0.3), 0.55)}`;
    case "badgeBanner":
      return `inset 0 0 0 2px ${withAlpha(shade(base, 0.85), 0.9)}, inset 0 0 0 6px ${withAlpha(shade(base, -0.35), 0.5)}`;
    case "ovalPlate":
      return `inset 0 0 0 2px ${withAlpha(shade(base, 0.8), 0.75)}`;
    case "circlePlate":
      return `inset 0 0 0 2px ${withAlpha(shade(base, 0.85), 0.9)}, inset 0 0 0 5px ${withAlpha(shade(base, -0.3), 0.4)}`;
    case "geoPlate":
      return `inset 0 0 0 2px ${withAlpha(shade(base, 0.75), 0.6)}`;
    case "floatingPlate":
      return "0 16px 30px -12px rgba(0,0,0,0.6), 0 5px 12px -6px rgba(0,0,0,0.45)";
    /* ---- the premium plates ------------------------------------------ */
    // the hollow plate: its fill is the ring, drawn as an inset rule that
    // follows the plate's own corners, with a hairline inside it
    case "outlineBanner":
      return `inset 0 0 0 4px ${withAlpha(base, 0.95)}, inset 0 0 0 7px ${withAlpha(shade(base, 0.6), 0.35)}`;
    // the 3D plate's own bevel — a lit top edge and a shaded bottom one, on the
    // body, while the extruded slab rides a layer behind it
    case "plate3d":
      return `inset 0 2px 0 ${withAlpha(shade(base, 0.6), 0.55)}, inset 0 -3px 0 ${withAlpha(shade(base, -0.42), 0.5)}`;
    // the glass plate's rim — a bright hairline along the top, a faint one
    // round the whole pane
    case "glassPlate":
      return `inset 0 1px 0 ${withAlpha("#ffffff", 0.55)}, inset 0 0 0 1px ${withAlpha("#ffffff", 0.16)}`;
    default:
      return undefined;
  }
}

/**
 * Builds all the CSS for a banner. Keeps everything inline so html-to-image,
 * thumbnails and the presenter render it identically.
 *
 * Geometry is free: the plate hugs the title by default (its padding), and as
 * soon as `size` / `pos` carry numbers it is painted at exactly that box — in px
 * of the 1280 × 720 stage, with no ceiling anywhere.
 */
export function bannerCss(b: BannerSettings, titleColor: string): BannerCss {
  const fill = bannerFillCss(b);
  const base = baseColor(b.gradient, b.color);
  const shapeOpacity = clampOpacity(b.opacity);
  const radius = plateRadius(b);
  /** the Effects card's paint, folded into the body's channels below */
  const fx = b.shape === "none" ? EMPTY_FX : bannerEffectsPaint(b, base);
  const fxShadow = fx.shadows.length ? fx.shadows.join(", ") : undefined;
  /** the common effects' filters — drop-shadows, glows and the blur, on the
      body itself, where they follow the silhouette's own edge */
  const fxFilter = fx.filters.length ? fx.filters.join(" ") : undefined;
  /**
   * One plate, several masks (the shape's cut, the common effect's fade and
   * the silhouette's own): CSS lays multiple mask layers down `add` by
   * default, where each would open a hole in the others — so two or more
   * layers are asked to INTERSECT instead.
   */
  const joinMasks = (...masks: (string | undefined)[]) => {
    const list = masks.filter((m): m is string => !!m);
    if (!list.length) return { value: undefined as string | undefined, composite: {} as Partial<React.CSSProperties> };
    return {
      value: list.join(", "),
      composite: list.length > 1 ? { maskComposite: "intersect" as const, WebkitMaskComposite: "source-in" as const } : {},
    };
  };
  const common: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
  };

  let box: React.CSSProperties;
  switch (b.shape) {
    case "none":
      box = { display: "none" };
      break;
    case "glow": {
      // soft radial fade — the classic look
      const g = Math.max(0, Math.min(100, b.glow));
      const inner = 30 + (100 - g) * 0.3; // where the fade starts
      const outer = 55 + g * 0.35; // where it reaches transparent
      /* a paint that carries layers (a gradient or one of the three special
         fills) is faded with a mask so its colours still show; the radial and
         mesh ramps flatten to a linear one first, exactly the way the older
         decks rendered them under the glow */
      const fillModeNow = bannerFillMode(b);
      const stops = b.gradient.enabled
        ? gradientCss(
            b.gradient.type === "radial" || b.gradient.type === "mesh" ? { ...b.gradient, type: "linear" } : b.gradient,
            b.color,
          )
        : fillModeNow === "glass" || fillModeNow === "metallic" || fillModeNow === "pattern"
          ? fill
          : undefined;
      const fade =
        stops && `radial-gradient(${GLOW_ELLIPSE}, #000 0%, rgba(0,0,0,.8) ${inner}%, transparent ${outer}%)`;
      // when a gradient is used we fade it with a mask instead so the colours still show —
      // and a shape effect that cuts the edge (wave · curve · slant) wins over the fade,
      // a common effect's fade intersecting with it
      const glowMask = joinMasks(fx.mask, fx.maskFade, fade);
      box = {
        ...common,
        ...plateRect(b),
        background: stops
          ? `${stops}`
          : `radial-gradient(${GLOW_ELLIPSE}, ${base} 0%, ${withAlpha(base, 0.75)} ${inner}%, ${withAlpha(base, 0)} ${outer}%)`,
        WebkitMaskImage: glowMask.value,
        maskImage: glowMask.value,
        ...glowMask.composite,
        boxShadow: fxShadow,
        filter: fxFilter,
        transform: fx.transform || undefined,
      };
      break;
    }
    case "underline": {
      const ruleMask = joinMasks(fx.mask, fx.maskFade);
      box = {
        ...common,
        ...ruleRect(b),
        background: fill,
        // a full round end (plateRadius: 999) — or the Border card's own corners
        borderRadius: fx.radius ?? radius,
        maskImage: ruleMask.value,
        WebkitMaskImage: ruleMask.value,
        ...ruleMask.composite,
        boxShadow: fxShadow,
        filter: fxFilter,
        transform: fx.transform || undefined,
      };
      break;
    }
    default: {
      /**
       * Every other silhouette — the plates, the shape library (basic · banner
       * style · modern · curved & wave · organic) and the multilayer plates —
       * is one body on the plate's own box, and they differ in four channels
       * only: the corners (`plateRadius`), the cut (`plateClipPath`), the mask
       * (`plateMask`, the smooth silhouettes) and the paint (`platePaint`, one
       * fill or a stack of gradients) — plus whatever the Effects card has
       * turned on: its shadows join the body's own, its corners and its edge
       * cut win over the silhouette's, and its transform dresses the whole
       * stack (the body, its layers and its overlays) together.
       */
      const bodyMask = joinMasks(fx.mask, fx.maskFade, plateMask(b));
      box = {
        ...common,
        ...plateRect(b),
        ...platePaint(b, fill),
        borderRadius: fx.radius ?? radius,
        clipPath: plateClipPath(b),
        // the smooth silhouettes (waves, domes, blobs, strokes) wear their cut
        // as a mask — the outline's layer wears the very same one below — and
        // a common effect's fade intersects with it
        maskImage: bodyMask.value,
        WebkitMaskImage: bodyMask.value,
        ...bodyMask.composite,
        // the double frame keeps a hairline inside itself and the long-shadow
        // plate its own soft fall — both on the body, so neither fights the
        // outline's own layer — and the effects' shadows ride the same body
        boxShadow: [plateShadow(b, base), fxShadow].filter(Boolean).join(", ") || undefined,
        filter: fxFilter,
        transform: fx.transform || undefined,
      };
    }
  }

  /**
   * The plate's own extra layers — empty for a single-body silhouette, two or
   * three painted plates for the multilayer ones, and the effect layers (the
   * long shadow's streak, the 3D's slabs, the gradient shadow) ride on the
   * same back. They sit behind the body, so the body's paint and its outline
   * always win.
   */
  const layers = b.shape === "none" ? [] : [...bannerLayers(b, base), ...fx.back];
  /** the Effects card's overlays — above the body, under the heading */
  const overlays = b.shape === "none" ? [] : fx.over;

  const halo: React.CSSProperties | undefined =
    b.halo > 0 && b.shape !== "none"
      ? {
          ...common,
          ...(b.shape === "underline" ? ruleRect(b) : plateRect(b)),
          background: `radial-gradient(ellipse at center, ${withAlpha(base, 0.55 * (b.halo / 100) + 0.15)} 0%, ${withAlpha(base, 0)} 70%)`,
          // grows outward from the plate's own middle, whatever its size
          transform: `scale(${1 + b.halo / 160})`,
          filter: `blur(${4 + b.halo * 0.3}px)`,
        }
      : undefined;

  /**
   * The outline is its own layer: a transparent box wearing only a border, so
   * Border transparency fades the line alone and never the paint behind it.
   * It rounds exactly the corners the body wears (the Effects card's shape
   * corners included), and its glow is a filter on this layer alone — the light
   * the line gives off, never a second copy of the plate.
   */
  const lineMask = joinMasks(plateMask(b), fx.maskFade);
  /**
   * A gradient picked for the line paints the line itself: the layer wears a
   * transparent border and a gradient background, and two mask layers
   * (padding-box XOR border-box) keep only the ring between them — corners,
   * radius and the cut silhouette's clip all follow as before. A silhouette
   * that already needs its own mask (a wave, a blob) keeps it and paints the
   * gradient's blended tone instead, so the two masks never fight.
   */
  const lineGradient = b.border.gradient?.enabled && b.border.width > 0 ? b.border.gradient : undefined;
  const lineRing = !!lineGradient && !lineMask.value;
  const lineColor = lineGradient && !lineRing ? gradientPaintColor(lineGradient, b.border.color) : b.border.color;
  const borderLine: React.CSSProperties | undefined = bannerHasLine(b)
    ? {
        ...common,
        ...(b.shape === "underline" ? ruleRect(b) : plateRect(b)),
        border: lineRing
          ? `${b.border.width}px solid transparent`
          : `${b.border.width}px ${bannerBorderStyle(b)} ${withAlpha(lineColor, clampOpacity(b.border.opacity))}`,
        borderRadius: fx.radius ?? radius,
        boxSizing: "border-box",
        filter: bannerBorderGlowFilter(b),
        // the outline follows the cut silhouette — the ribbon's notch, the
        // hexagon's tips, the chevron's arrow — and the masked silhouette
        // clips it to the very same mask, so the line stays inside the wave
        // or the blob instead of running off its curve; a common effect's
        // fade runs the line out with the plate
        clipPath: plateClipPath(b),
        ...(lineRing
          ? {
              background: `${gradientCss(lineGradient!, b.border.color)} border-box`,
              opacity: clampOpacity(b.border.opacity),
              WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
              maskComposite: "exclude",
            }
          : {
              maskImage: lineMask.value,
              WebkitMaskImage: lineMask.value,
              ...lineMask.composite,
            }),
      }
    : undefined;

  /**
   * The shape's transparency paints the body, its own layers and its glow —
   * never the line, which fades on its own.
   */
  if (b.shape !== "none") {
    box.opacity = shapeOpacity;
    layers.forEach((l) => {
      l.opacity = shapeOpacity;
    });
    if (halo) halo.opacity = shapeOpacity;
  }

  const tg = b.textGradient;
  const textBase = tg.enabled && tg.stops[0] ? tg.stops[0].color : titleColor;
  const shadows: string[] = [];
  if (b.textShadow) shadows.push("0 3px 6px rgba(0,0,0,.55)");
  if (b.textGlow > 0) shadows.push(`0 0 ${8 + b.textGlow * 0.4}px ${withAlpha(textBase, 0.25 + b.textGlow / 200)}`);

  const text: React.CSSProperties = tg.enabled
    ? {
        backgroundImage: gradientCss(tg, titleColor),
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        // text-shadow would paint over clipped text; use a drop-shadow filter instead
        filter: shadows.length
          ? `${b.textShadow ? "drop-shadow(0 3px 4px rgba(0,0,0,.6)) " : ""}${b.textGlow > 0 ? `drop-shadow(0 0 ${6 + b.textGlow * 0.25}px ${withAlpha(textBase, 0.55)})` : ""}`
          : undefined,
      }
    : { color: titleColor, textShadow: shadows.join(", ") || undefined };

  // Slide.tsx gives the title plate a stable frame. The frame is intentionally
  // independent of the glyph width and height, so changing title font size
  // changes only the text, not the built-in plate.
  return { box, layers, border: borderLine, halo, overlays, text, padding: "6px 0" };
}

/**
 * Measures the plate as it is painted right now, in px of the 1280 × 720 stage,
 * so "Banner size" can start from the plate the teacher is looking at instead
 * of jumping the moment they touch a slider. Null when nothing is measured
 * (no canvas yet) — callers then fall back to a sensible guess.
 */
export function measureBannerPlate(): { w: number; h: number } | null {
  if (typeof document === "undefined") return null;
  const board = document.querySelector<HTMLElement>(".slide-editable [data-board]");
  const plate = document.querySelector<HTMLElement>(".slide-editable [data-banner-plate]");
  if (!board || !plate) return null;
  // CSS zoom (a non-transform scale) would already be inside offsetWidth
  const k = BOARD_W / (board.offsetWidth || BOARD_W);
  const w = Math.round(plate.offsetWidth * k);
  const h = Math.round(plate.offsetHeight * k);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * The plate's size for a slider that has not been touched yet: the measured
 * canvas when it can be measured, the plate's own box else — the 630 px chip
 * across, and the line frame plus its padding down.
 */
export function bannerSizeNow(b: BannerSettings, titleSize = 54, titleWidthPct = 57): { w: number; h: number } {
  const measured = measureBannerPlate();
  if (measured) return measured;
  // no canvas to measure — the plate's width is the factory chip whatever the
  // heading says or which font it wears, so the slider starts on 630 instead of
  // jumping when the title size changes. Keep this in sync with the editor.
  void titleSize;
  void titleWidthPct;
  const w = bannerPlateWidth(b);
  // and the automatic height is the line frame plus its padding — stretched by
  // the silhouette's own factor when it paints a taller box (circle, oval,
  // blobs, cloud), so the slider starts where the plate really is
  const h = Math.round(BANNER_AUTO_FRAME_HEIGHT * (1 + (2 * b.padY) / 100) * plateHeightFactor(b.shape));
  return { w: Math.max(40, w), h: Math.max(24, h) };
}

/* ------------------------------------------------------------ presets */

export interface BannerPreset {
  name: string;
  /** the gallery's own heading this look is filed under */
  group: BannerPresetGroup;
  swatch: string;
  banner: Partial<BannerSettings>;
}

/**
 * The Design presets gallery's headings, in the order the card reads them. The
 * last three are the shape styles: **stylish** silhouettes, **multilayer**
 * plates and **multilayer gradient** plates.
 */
export type BannerPresetGroup =
  | "Classic"
  | "Broadcast"
  | "Chalk & parchment"
  | "Teal current"
  | "Campus blue"
  | "Merit & highlighter"
  | "Seminar shelf"
  | "Stylish shapes"
  | "Multilayer shapes"
  | "Multilayer gradient";

export const BANNER_PRESET_GROUPS: BannerPresetGroup[] = [
  "Classic",
  "Broadcast",
  "Chalk & parchment",
  "Teal current",
  "Campus blue",
  "Merit & highlighter",
  "Seminar shelf",
  "Stylish shapes",
  "Multilayer shapes",
  "Multilayer gradient",
];

export const BANNER_PRESETS: BannerPreset[] = [
  {
    name: "Classic glow",
    group: "Classic",
    swatch: "radial-gradient(circle, #1f5fd0, transparent 70%)",
    banner: { shape: "glow", color: "#1f5fd0", glow: 65, halo: 0, gradient: { ...DEFAULT_GRADIENT(), enabled: false } },
  },
  {
    name: "Royal blue pill",
    group: "Classic",
    swatch: "linear-gradient(90deg,#0f3fb8,#3b7bff)",
    banner: {
      shape: "pill",
      gradient: { enabled: true, type: "linear", angle: 90, stops: [{ color: "#0f3fb8", at: 0 }, { color: "#3b7bff", at: 100 }] },
      opacity: 1, padX: 4, padY: 11, halo: 20,
    },
  },
  {
    name: "Gold ribbon",
    group: "Classic",
    swatch: "linear-gradient(180deg,#ffd35a,#b8860b)",
    banner: {
      shape: "ribbon",
      gradient: { enabled: true, type: "linear", angle: 180, stops: [{ color: "#ffd35a", at: 0 }, { color: "#e0a800", at: 55 }, { color: "#b8860b", at: 100 }] },
      opacity: 1, padX: 4, padY: 12, halo: 15,
      border: { enabled: false, color: "#fff", width: 1 },
    },
  },
  {
    name: "Neon",
    group: "Classic",
    swatch: "linear-gradient(90deg,#7c3aed,#06b6d4)",
    banner: {
      shape: "rounded",
      radius: 14,
      gradient: { enabled: true, type: "linear", angle: 90, stops: [{ color: "#7c3aed", at: 0 }, { color: "#06b6d4", at: 100 }] },
      opacity: 0.95, padX: 3, padY: 12, halo: 45,
      border: { enabled: true, color: "#e9d5ff", width: 1.5 },
      textGlow: 60,
    },
  },
  {
    name: "Emerald",
    group: "Classic",
    swatch: "linear-gradient(135deg,#065f46,#10b981)",
    banner: {
      shape: "glow",
      glow: 80,
      gradient: { enabled: true, type: "linear", angle: 135, stops: [{ color: "#065f46", at: 0 }, { color: "#10b981", at: 100 }] },
      halo: 25,
    },
  },
  {
    name: "Sunset",
    group: "Classic",
    swatch: "linear-gradient(90deg,#f97316,#ec4899)",
    banner: {
      shape: "pill",
      gradient: { enabled: true, type: "linear", angle: 90, stops: [{ color: "#f97316", at: 0 }, { color: "#ec4899", at: 100 }] },
      padX: 4, padY: 11, halo: 30,
    },
  },
  {
    name: "Underline",
    group: "Classic",
    swatch: "linear-gradient(90deg,transparent 0 40%,#ffd633 40% 60%,transparent 60%)",
    banner: { shape: "underline", color: "#ffd633", radius: 14, padX: 1, padY: 11, halo: 0, gradient: { ...DEFAULT_GRADIENT(), enabled: false } },
  },
  {
    name: "Minimal (none)",
    group: "Classic",
    swatch: "transparent",
    banner: { shape: "none", halo: 0 },
  },

  /* -------------------------------------------------------------- */
  /* Broadcast looks — dark space stages with gilded lettering,      */
  /* dashed-outline tags and white pill captions, as seen on the     */
  /* big online academic channels' class slides.                     */
  /* -------------------------------------------------------------- */
  {
    name: "Orbit gold",
    group: "Broadcast",
    swatch: "radial-gradient(circle, #312e81, transparent 70%)",
    banner: {
      shape: "glow",
      color: "#312e81",
      glow: 75,
      halo: 35,
      gradient: noGrad(),
      padX: 4,
      padY: 13,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff2a8", 0], ["#ffb800", 100]),
      textGlow: 25,
      textShadow: true,
    },
  },
  {
    name: "Violet nebula tag",
    group: "Broadcast",
    swatch: "linear-gradient(90deg,#4c1d95,#6d28d9)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#4c1d95", 0], ["#6d28d9", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 30,
      border: { enabled: true, color: "#ffffff", width: 2, style: "dashed", opacity: 0.85 },
      textGradient: lin(180, ["#ffffff", 0], ["#e9d5ff", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Deep space plate",
    group: "Broadcast",
    swatch: "linear-gradient(180deg,#0b1026,#1e1b4b)",
    banner: {
      shape: "rounded",
      radius: 12,
      gradient: lin(180, ["#0b1026", 0], ["#1e1b4b", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 20,
      border: { enabled: true, color: "#ffd633", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#fff2a8", 0], ["#fbbf24", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },

  /* -------------------------------------------------------------- */
  /* Chalk & parchment — blackboard tops, cream paper and burnt      */
  /* orange chapter pills, the printed-lecture look.                 */
  /* -------------------------------------------------------------- */
  {
    name: "Chalkboard glow",
    group: "Chalk & parchment",
    swatch: "radial-gradient(circle, #123524, transparent 70%)",
    banner: {
      shape: "glow",
      color: "#123524",
      glow: 70,
      halo: 20,
      gradient: noGrad(),
      padX: 4,
      padY: 13,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#cbd5e1", 100]),
      textGlow: 25,
      textShadow: true,
    },
  },
  {
    name: "Burnt orange card",
    group: "Chalk & parchment",
    swatch: "linear-gradient(180deg,#c2711d,#a05a15)",
    banner: {
      shape: "rounded",
      radius: 10,
      gradient: lin(180, ["#c2711d", 0], ["#a05a15", 100]),
      opacity: 1,
      padX: 4,
      padY: 14,
      halo: 0,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff7ed", 0], ["#ffedd5", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Parchment ink",
    group: "Chalk & parchment",
    swatch: "linear-gradient(180deg,#faf3e3,#efe4cb)",
    banner: {
      shape: "rounded",
      radius: 12,
      gradient: lin(180, ["#faf3e3", 0], ["#efe4cb", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#b3611f", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#9a3412", 0], ["#7c2d12", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },

  /* -------------------------------------------------------------- */
  /* Teal current — navy plates with ice lettering on teal stages,   */
  /* silver bars with teal blocks.                                   */
  /* -------------------------------------------------------------- */
  {
    name: "Navy frost",
    group: "Teal current",
    swatch: "linear-gradient(180deg,#0a1f44,#123a6b)",
    banner: {
      shape: "rounded",
      radius: 18,
      gradient: lin(180, ["#0a1f44", 0], ["#123a6b", 100]),
      opacity: 1,
      padX: 4,
      padY: 14,
      halo: 30,
      border: { enabled: true, color: "#38bdf8", width: 1.5, style: "solid", opacity: 0.7 },
      textGradient: lin(180, ["#e0f2fe", 0], ["#7dd3fc", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Glacier pill",
    group: "Teal current",
    swatch: "linear-gradient(90deg,#082032,#0e3a53)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#082032", 0], ["#0e3a53", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 25,
      border: { enabled: true, color: "#7dd3fc", width: 2, style: "dashed", opacity: 0.8 },
      textGradient: lin(180, ["#f0f9ff", 0], ["#bae6fd", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Silver mint bar",
    group: "Teal current",
    swatch: "linear-gradient(180deg,#f8fafc,#cbd5e1)",
    banner: {
      shape: "rect",
      radius: 6,
      gradient: lin(180, ["#f8fafc", 0], ["#cbd5e1", 100]),
      opacity: 1,
      padX: 3,
      padY: 12,
      halo: 0,
      border: { enabled: true, color: "#0f766e", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(90, ["#0f766e", 0], ["#0d9488", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },

  /* -------------------------------------------------------------- */
  /* Campus blue & tangerine — deep blue header bars with orange     */
  /* rules, the classic coaching-institute lecture look.             */
  /* -------------------------------------------------------------- */
  {
    name: "Lecture header",
    group: "Campus blue",
    swatch: "linear-gradient(90deg,#00357e,#0057b8)",
    banner: {
      shape: "rect",
      radius: 4,
      gradient: lin(90, ["#00357e", 0], ["#0057b8", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#f7941d", width: 3, style: "solid", opacity: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#e0e7ff", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Tangerine double",
    group: "Campus blue",
    swatch: "linear-gradient(90deg,#00418f,#005bbf)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#00418f", 0], ["#005bbf", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 15,
      border: { enabled: true, color: "#f7941d", width: 4, style: "double", opacity: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#fff7ed", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Sky bar",
    group: "Campus blue",
    swatch: "linear-gradient(90deg,#38bdf8,#0284c7)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#38bdf8", 0], ["#0284c7", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 25,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#f0f9ff", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },

  /* -------------------------------------------------------------- */
  /* Merit & highlighter — yellow highlighter plates with navy ink,  */
  /* crimson ribbons and merit bars, the admission-circuit look.     */
  /* -------------------------------------------------------------- */
  {
    name: "Highlighter",
    group: "Merit & highlighter",
    swatch: "linear-gradient(90deg,#fde047,#facc15)",
    banner: {
      shape: "rect",
      radius: 4,
      gradient: lin(90, ["#fde047", 0], ["#facc15", 100]),
      opacity: 1,
      padX: 2,
      padY: 10,
      halo: 0,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#1e3a8a", 0], ["#172554", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },
  {
    name: "Crimson ribbon",
    group: "Merit & highlighter",
    swatch: "linear-gradient(90deg,#be123c,#9f1239)",
    banner: {
      shape: "ribbon",
      gradient: lin(90, ["#be123c", 0], ["#9f1239", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 15,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff1f2", 0], ["#ffe4e6", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Merit red card",
    group: "Merit & highlighter",
    swatch: "linear-gradient(180deg,#dc2626,#b91c1c)",
    banner: {
      shape: "rounded",
      radius: 8,
      gradient: lin(180, ["#dc2626", 0], ["#b91c1c", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 10,
      border: { enabled: true, color: "#ffffff", width: 2, style: "solid", opacity: 0.85 },
      textGradient: lin(180, ["#ffffff", 0], ["#fef2f2", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },

  /* -------------------------------------------------------------- */
  /* Seminar shelf — chalk pills, maroon & gold, midnight doubles,   */
  /* circuit outlines and print-lecture paper.                       */
  /* -------------------------------------------------------------- */
  {
    name: "Emerald chalk pill",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#064e3b,#047857)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#064e3b", 0], ["#047857", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 15,
      border: { enabled: true, color: "#a7f3d0", width: 2, style: "dashed", opacity: 0.8 },
      textGradient: lin(180, ["#ecfdf5", 0], ["#a7f3d0", 100]),
      textGlow: 10,
      textShadow: true,
    },
  },
  {
    name: "Maroon & gold",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#7f1d1d,#991b1b)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#7f1d1d", 0], ["#991b1b", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 20,
      border: { enabled: true, color: "#ffd633", width: 2, style: "solid", opacity: 0.95 },
      textGradient: lin(180, ["#fff2a8", 0], ["#fbbf24", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Midnight double",
    group: "Seminar shelf",
    swatch: "linear-gradient(180deg,#0b0b0f,#15151c)",
    banner: {
      shape: "rect",
      radius: 10,
      gradient: lin(180, ["#0b0b0f", 0], ["#15151c", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 10,
      border: { enabled: true, color: "#ffd633", width: 4, style: "double", opacity: 1 },
      textGradient: lin(180, ["#fde68a", 0], ["#f59e0b", 100]),
      textGlow: 25,
      textShadow: true,
    },
  },
  {
    name: "Mint glow",
    group: "Seminar shelf",
    swatch: "radial-gradient(circle, #0d9488, transparent 70%)",
    banner: {
      shape: "glow",
      color: "#0d9488",
      glow: 80,
      halo: 20,
      gradient: noGrad(),
      padX: 4,
      padY: 13,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#ccfbf1", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Sunrise underline",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#f59e0b,#ef4444)",
    banner: {
      shape: "underline",
      color: "#f59e0b",
      gradient: lin(90, ["#f59e0b", 0], ["#ef4444", 100]),
      radius: 14,
      padX: 2,
      padY: 11,
      halo: 15,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff7ed", 0], ["#fdba74", 100]),
      textGlow: 10,
      textShadow: true,
    },
  },
  {
    name: "Cyan circuit",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#164e63,#0e7490)",
    banner: {
      shape: "rounded",
      radius: 14,
      gradient: lin(90, ["#164e63", 0], ["#0e7490", 100]),
      opacity: 0.35,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#22d3ee", width: 2, style: "solid", opacity: 0.95 },
      textGradient: lin(90, ["#a5f3fc", 0], ["#22d3ee", 100]),
      textGlow: 55,
      textShadow: false,
    },
  },
  {
    name: "Royal violet",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#581c87,#7e22ce)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#581c87", 0], ["#7e22ce", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 40,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#f5f3ff", 0], ["#ddd6fe", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Coral sunrise",
    group: "Seminar shelf",
    swatch: "linear-gradient(90deg,#fb923c,#e11d48)",
    banner: {
      shape: "pill",
      gradient: lin(90, ["#fb923c", 0], ["#e11d48", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 20,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff7ed", 0], ["#ffe4e6", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Slate print",
    group: "Seminar shelf",
    swatch: "linear-gradient(180deg,#e2e8f0,#cbd5e1)",
    banner: {
      shape: "rounded",
      radius: 8,
      gradient: lin(180, ["#e2e8f0", 0], ["#cbd5e1", 100]),
      opacity: 1,
      padX: 3,
      padY: 12,
      halo: 0,
      border: { enabled: true, color: "#64748b", width: 1.5, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#0f172a", 0], ["#334155", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },

  /* -------------------------------------------------------------- */
  /* Stylish shapes — one plate, cut to another silhouette: the      */
  /* hexagon badge, the cut corners, the chevron's arrow, the        */
  /* swallowtail's V, the slant, the tab and the arch.               */
  /* -------------------------------------------------------------- */
  {
    name: "Hex badge",
    group: "Stylish shapes",
    swatch: "linear-gradient(90deg,#10245e,#2f6fe4)",
    banner: {
      shape: "hex",
      gradient: lin(90, ["#10245e", 0], ["#2f6fe4", 100]),
      opacity: 1,
      padX: 5,
      padY: 13,
      halo: 20,
      border: { enabled: true, color: "#ffd633", width: 2, style: "solid", opacity: 0.95 },
      textGradient: lin(180, ["#fff2a8", 0], ["#fbbf24", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Cut corner card",
    group: "Stylish shapes",
    swatch: "linear-gradient(135deg,#0f172a,#334155)",
    banner: {
      shape: "notch",
      gradient: lin(135, ["#0f172a", 0], ["#334155", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 10,
      border: { enabled: true, color: "#22d3ee", width: 1.5, style: "solid", opacity: 0.85 },
      textGradient: lin(180, ["#e0f2fe", 0], ["#7dd3fc", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Chevron tag",
    group: "Stylish shapes",
    swatch: "linear-gradient(90deg,#be123c,#f43f5e)",
    banner: {
      shape: "chevron",
      gradient: lin(90, ["#be123c", 0], ["#f43f5e", 100]),
      opacity: 1,
      padX: 5,
      padY: 12,
      halo: 25,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#ffe4e6", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Swallowtail flag",
    group: "Stylish shapes",
    swatch: "linear-gradient(90deg,#064e3b,#10b981)",
    banner: {
      shape: "swallow",
      gradient: lin(90, ["#064e3b", 0], ["#10b981", 100]),
      opacity: 1,
      padX: 5,
      padY: 12,
      halo: 15,
      border: { enabled: true, color: "#ffffff", width: 1.5, style: "dashed", opacity: 0.7 },
      textGradient: lin(180, ["#ecfdf5", 0], ["#a7f3d0", 100]),
      textGlow: 10,
      textShadow: true,
    },
  },
  {
    name: "Slant plate",
    group: "Stylish shapes",
    swatch: "linear-gradient(90deg,#5b21b6,#06b6d4)",
    banner: {
      shape: "slant",
      gradient: lin(90, ["#5b21b6", 0], ["#06b6d4", 100]),
      opacity: 1,
      padX: 6,
      padY: 12,
      halo: 35,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#f5f3ff", 0], ["#a5f3fc", 100]),
      textGlow: 25,
      textShadow: true,
    },
  },
  {
    name: "Sky tab",
    group: "Stylish shapes",
    swatch: "linear-gradient(180deg,#38bdf8,#0369a1)",
    banner: {
      shape: "tab",
      radius: 16,
      gradient: lin(180, ["#38bdf8", 0], ["#0369a1", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#f0f9ff", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#ffffff", 0], ["#e0f2fe", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Gold arch",
    group: "Stylish shapes",
    swatch: "linear-gradient(180deg,#fbbf24,#b45309)",
    banner: {
      shape: "arch",
      gradient: lin(180, ["#fbbf24", 0], ["#b45309", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 20,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#451a03", 0], ["#7c2d12", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },

  /* -------------------------------------------------------------- */
  /* Multilayer shapes — the plate plus painted plates of its own    */
  /* behind it: a paper stack, a double frame, an accent block, an   */
  /* offset outline and a long shadow.                               */
  /* -------------------------------------------------------------- */
  {
    name: "Paper stack",
    group: "Multilayer shapes",
    swatch: "linear-gradient(180deg,#faf3e3,#e7d8b8)",
    banner: {
      shape: "stack",
      radius: 10,
      color: "#f6ead0",
      gradient: lin(180, ["#faf3e3", 0], ["#e7d8b8", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#a16207", width: 1.5, style: "solid", opacity: 0.7 },
      textGradient: lin(180, ["#7c2d12", 0], ["#431407", 100]),
      textGlow: 0,
      textShadow: false,
    },
  },
  {
    name: "Neon stack",
    group: "Multilayer shapes",
    swatch: "linear-gradient(90deg,#4c1d95,#22d3ee)",
    banner: {
      shape: "stack",
      radius: 14,
      gradient: lin(90, ["#4c1d95", 0], ["#7c3aed", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 40,
      border: { enabled: true, color: "#22d3ee", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#ecfeff", 0], ["#a5f3fc", 100]),
      textGlow: 55,
      textShadow: false,
    },
  },
  {
    name: "Gold double frame",
    group: "Multilayer shapes",
    swatch: "linear-gradient(180deg,#0b1026,#1e1b4b)",
    banner: {
      shape: "frame",
      radius: 12,
      gradient: lin(180, ["#0b1026", 0], ["#1e1b4b", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 15,
      border: { enabled: true, color: "#ffd633", width: 2, style: "solid", opacity: 0.95 },
      textGradient: lin(180, ["#fff2a8", 0], ["#fbbf24", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Mint offset",
    group: "Multilayer shapes",
    swatch: "linear-gradient(90deg,#0f766e,#14b8a6)",
    banner: {
      shape: "offsetLine",
      radius: 10,
      gradient: lin(90, ["#0f766e", 0], ["#14b8a6", 100]),
      opacity: 1,
      padX: 4,
      padY: 12,
      halo: 0,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#f0fdfa", 0], ["#ccfbf1", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Amber accent card",
    group: "Multilayer shapes",
    swatch: "linear-gradient(90deg,#f59e0b 0 16%,#0a1f44 16%)",
    banner: {
      shape: "accent",
      radius: 8,
      gradient: lin(90, ["#0a1f44", 0], ["#123a6b", 100]),
      opacity: 1,
      padX: 6,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#f59e0b", width: 2, style: "solid", opacity: 0.85 },
      textGradient: lin(180, ["#ffffff", 0], ["#fde68a", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },
  {
    name: "Long shadow blue",
    group: "Multilayer shapes",
    swatch: "linear-gradient(135deg,#1d4ed8,#60a5fa)",
    banner: {
      shape: "longShadow",
      radius: 12,
      gradient: lin(135, ["#1d4ed8", 0], ["#60a5fa", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#ffffff", 0], ["#dbeafe", 100]),
      textGlow: 0,
      textShadow: true,
    },
  },

  /* -------------------------------------------------------------- */
  /* Multilayer gradient shapes — one plate painted from several     */
  /* stacked gradients (a sheen, a hard split, a gloss, a stripe     */
  /* weave), and the stacked plates each wearing a gradient.         */
  /* -------------------------------------------------------------- */
  {
    name: "Sheen royal",
    group: "Multilayer gradient",
    swatch: "linear-gradient(115deg,#1e3a8a,#3b82f6 46%,#1e3a8a)",
    banner: {
      shape: "sheen",
      radius: 14,
      gradient: lin(90, ["#1e3a8a", 0], ["#3b82f6", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 25,
      border: { enabled: true, color: "#bfdbfe", width: 1.5, style: "solid", opacity: 0.7 },
      textGradient: lin(180, ["#ffffff", 0], ["#dbeafe", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Split sunset",
    group: "Multilayer gradient",
    swatch: "linear-gradient(118deg,#fdba74 0 50%,#be123c 50%)",
    banner: {
      shape: "split",
      radius: 10,
      gradient: lin(90, ["#f97316", 0], ["#ec4899", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 20,
      border: { enabled: false, color: "#ffffff", width: 1 },
      textGradient: lin(180, ["#fff7ed", 0], ["#ffe4e6", 100]),
      textGlow: 10,
      textShadow: true,
    },
  },
  {
    name: "Gloss emerald",
    group: "Multilayer gradient",
    swatch: "linear-gradient(180deg,#a7f3d0,#047857 60%,#064e3b)",
    banner: {
      shape: "gloss",
      radius: 16,
      gradient: lin(180, ["#047857", 0], ["#064e3b", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 20,
      border: { enabled: true, color: "#d1fae5", width: 1.5, style: "solid", opacity: 0.6 },
      textGradient: lin(180, ["#f0fdf4", 0], ["#a7f3d0", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
  {
    name: "Striped steel",
    group: "Multilayer gradient",
    swatch: "repeating-linear-gradient(115deg,#475569 0 6px,#1e293b 6px 12px)",
    banner: {
      shape: "stripes",
      radius: 8,
      gradient: lin(90, ["#1e293b", 0], ["#475569", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 0,
      border: { enabled: true, color: "#22d3ee", width: 2, style: "solid", opacity: 0.8 },
      textGradient: lin(180, ["#ecfeff", 0], ["#67e8f9", 100]),
      textGlow: 20,
      textShadow: true,
    },
  },
  {
    name: "Stacked gradient",
    group: "Multilayer gradient",
    swatch: "linear-gradient(90deg,#4c1d95,#06b6d4)",
    banner: {
      shape: "gradStack",
      radius: 14,
      gradient: lin(90, ["#4c1d95", 0], ["#06b6d4", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 30,
      border: { enabled: true, color: "#ffffff", width: 1.5, style: "solid", opacity: 0.55 },
      textGradient: lin(180, ["#ffffff", 0], ["#ddd6fe", 100]),
      textGlow: 25,
      textShadow: true,
    },
  },
  {
    name: "Maroon sheen",
    group: "Multilayer gradient",
    swatch: "linear-gradient(115deg,#7f1d1d,#dc2626 46%,#7f1d1d)",
    banner: {
      shape: "sheen",
      radius: 12,
      gradient: lin(90, ["#7f1d1d", 0], ["#dc2626", 100]),
      opacity: 1,
      padX: 4,
      padY: 13,
      halo: 20,
      border: { enabled: true, color: "#ffd633", width: 2, style: "solid", opacity: 0.9 },
      textGradient: lin(180, ["#fff2a8", 0], ["#fbbf24", 100]),
      textGlow: 15,
      textShadow: true,
    },
  },
];

/** a linear gradient literal for the preset gallery */
function lin(angle: number, ...stops: [string, number][]): Gradient {
  return { enabled: true, type: "linear", angle, stops: stops.map(([color, at]) => ({ color, at })) };
}

/** gradient switched off — the preset paints a solid body */
function noGrad(): Gradient {
  return { ...DEFAULT_GRADIENT(), enabled: false };
}

/**
 * What a design preset writes: its own channels over the current plate, plus
 * the plate's *place* handed back to auto — a preset is a whole look, so a size
 * or nudge left over from the last one must not follow it around.
 *
 * The plate's width is the one thing a preset does not touch: it dresses the
 * 630 px chip, it does not resize it, so the shape stays 630 px across after
 * any of the fifty-one looks. A width the teacher set by hand survives too,
 * and the height goes back to hugging the line.
 */
export function bannerPresetPatch(
  current: BannerSettings,
  preset: BannerPreset,
): Partial<BannerSettings> {
  return {
    ...JSON.parse(JSON.stringify(current)) as BannerSettings,
    size: { w: bannerPlateWidth(current) },
    pos: undefined,
    ...preset.banner,
    // a preset paints the whole plate: the special fills (glass · metallic ·
    // pattern) step aside so the preset's own colour / gradient is worn
    fillMode: undefined,
  };
}

function DEFAULT_GRADIENT(): Gradient {
  return { enabled: false, type: "linear", angle: 90, stops: [{ color: "#1f5fd0", at: 0 }, { color: "#5b8cff", at: 100 }] };
}

/** Ready-made text gradients for the title itself. */
export const TEXT_GRADIENT_PRESETS: { name: string; stops: { color: string; at: number }[]; angle: number }[] = [
  { name: "Gold", angle: 180, stops: [{ color: "#fff2a8", at: 0 }, { color: "#ffb800", at: 100 }] },
  { name: "Silver", angle: 180, stops: [{ color: "#ffffff", at: 0 }, { color: "#a1a1aa", at: 100 }] },
  { name: "Fire", angle: 180, stops: [{ color: "#fde68a", at: 0 }, { color: "#f97316", at: 60 }, { color: "#dc2626", at: 100 }] },
  { name: "Aqua", angle: 90, stops: [{ color: "#a5f3fc", at: 0 }, { color: "#22d3ee", at: 100 }] },
  { name: "Rose", angle: 90, stops: [{ color: "#fbcfe8", at: 0 }, { color: "#ec4899", at: 100 }] },
];
