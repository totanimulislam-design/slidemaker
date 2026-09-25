import type { ShapeItem } from "./shapes";

export type OptionKey = string;

export type EditorScope = "slide" | "selected" | "all";

export interface QuizOption {
  key: OptionKey;
  text: string;
  /**
   * How the option's display label is determined:
   *   "auto"   — the label is generated from the deck's Plain Numbering setting.
   *              When numbering is "none", the stored `key` is shown as-is.
   *   "manual" — the user has explicitly typed a custom label; it always takes
   *              priority over Plain Numbering.
   *
   * `undefined` (missing) is treated as `"auto"` for backward compatibility
   * with decks saved before this field existed.
   */
  labelMode?: "auto" | "manual";
}

export interface SlideData {
  id: string;
  number: string;
  question: string;
  options: QuizOption[];
  answer: OptionKey | null;
  /** per slide override of the deck badge, empty = use deck badge */
  badge?: string;
  /** optional small note shown at the bottom of the board */
  note?: string;
  /** manual font scale for this slide only */
  scale: number;
  showAnswer: boolean;
  /** shapes & text boxes drawn on this slide only */
  shapes?: ShapeItem[];
  /**
   * A slide of the user's OWN — free of the deck's built-in design.
   *
   * Pages imported from a PDF / PowerPoint are marked with it so the imported
   * page lands as a separate, clean slide instead of inheriting the project's
   * frame, logo, brand lines, title banner and badge (see PLAIN_PAGE_CHROME).
   * The slide stays fully editable: draw on it, give it a background, and flip
   * the deck design back on with one toggle (Inspector → Slide background).
   */
  plainPage?: boolean;
  /** per-slide background override (undefined = use the deck background) */
  background?: BackgroundSettings;
  /** Per-slide visual overrides. Unset fields continue to follow the deck. */
  themeOverride?: Partial<ThemeSettings>;
  /** Per-slide header/title overrides. */
  headerOverride?: Partial<DeckHeader>;
}

export type OptionsLayout = "right" | "left" | "two-col" | "grid";

/** Every movable element on the board. */
export type ElementId =
  | "logo" | "brand" | "title" | "badge" | "bullet" | "question" | "options" | "note";

/**
 * Canva-style text effects. One effect at a time, each with the handful of
 * settings Canva exposes for it; `lib/textEffects` turns it into CSS.
 */
export type TextEffectKind =
  | "none"
  | "shadow"
  | "lift"
  | "hollow"
  | "splice"
  | "outline"
  | "echo"
  | "glitch"
  | "neon"
  | "background";

export interface TextEffect {
  kind: TextEffectKind;
  /** shadow · splice · echo · glitch — distance of the copy, 0–100 */
  offset?: number;
  /** shadow · splice · echo · glitch — direction in degrees, −180…180 (0 = right, 90 = down) */
  direction?: number;
  /** shadow — softness 0–100 */
  blur?: number;
  /**
   * shadow · background — how visible the copy / plate is: 100 = fully visible,
   * 0 = invisible (the same reading as every other opacity control).
   */
  opacity?: number;
  /** @deprecated the old 0–100 "transparency" (0 = solid, 100 = gone); read
   *  once in `effectWithDefaults` so decks written before the flip still paint
   *  the effect they were designed with */
  transparency?: number;
  /** shadow · splice · outline · echo · glitch · background — the effect's own colour */
  color?: string;
  /** hollow · splice · outline — stroke thickness 1–100 */
  thickness?: number;
  /** lift · neon — intensity 0–100 */
  intensity?: number;
  /** background — corner roundness 0–100 */
  roundness?: number;
  /** background — how far the plate spreads past the glyphs 0–100 */
  spread?: number;
}

/* ------------------------------------------------- text background shape */

/**
 * The silhouette of a text part's background shape (see lib/textBgShape).
 *
 *   box family   — painted with CSS corners, so every border style, the
 *                  corner radius and the border weight apply
 *   poly family  — a polygon silhouette (slants, chevrons, ribbons…); the
 *                  border is an SVG stroke, so radius does not apply
 *   mark family  — highlighter / underline / side bar marks
 */
export type TextBgShapeKind =
  | "rect"
  | "rounded"
  | "pill"
  | "ellipse"
  | "leaf"
  | "leafAlt"
  | "tabTop"
  | "tabBottom"
  | "tabLeft"
  | "tabRight"
  | "bubble"
  | "bubbleRight"
  | "parallelogram"
  | "parallelogramLeft"
  | "slantRight"
  | "slantLeft"
  | "trapezoid"
  | "chevron"
  | "arrow"
  | "arrowLeft"
  | "ribbon"
  | "flag"
  | "flagLeft"
  | "hexagon"
  | "octagon"
  | "diamond"
  | "cutCorners"
  | "starburst"
  | "starburst8"
  | "tagRight"
  | "tagLeft"
  | "ticket"
  | "highlight"
  | "underline"
  | "sideBar";

export type TextBgBorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";

/**
 * Outline style of a question-bullet marker. `"auto"` keeps whatever line the
 * numbering design itself draws, so an untouched deck paints exactly as before.
 */
export type NumberBorderStyle = "auto" | "none" | "solid" | "dashed" | "dotted" | "double";

/** the 30+ looks a background shape can wear (lib/textBgShape TEXT_BG_EFFECTS) */
export type TextBgEffectKind =
  | "none"
  | "shadow"
  | "pop"
  | "lift"
  | "float"
  | "longShadow"
  | "glow"
  | "halo"
  | "neon"
  | "innerShadow"
  | "innerGlow"
  | "bevel"
  | "emboss"
  | "gloss"
  | "sheen"
  | "spotlight"
  | "stripes"
  | "dots"
  | "grid"
  | "checker"
  | "glass"
  | "blur"
  | "fadeRight"
  | "fadeEdges"
  | "ring"
  | "offsetOutline"
  | "sticker"
  | "stack"
  | "topBar"
  | "bottomBar"
  | "leftBar"
  | "cornerFold";

/**
 * Every effect a painted surface can wear — the plate behind a text part AND
 * the question marker's body. It is the text-plate set plus the five the shape
 * tools ship for objects: a perspective shadow, a reflection, soft edges, a
 * 3-D rotation and a material / layered look. `lib/shapeEffects` turns one of
 * them into CSS passes, so both surfaces paint the same "Pop" or the same
 * "Neon" (see `TEXT_BG_EFFECTS` and `BULLET_EFFECTS`).
 */
export type ShapeEffectKind =
  | TextBgEffectKind
  | "perspective"
  | "reflection"
  | "softEdges"
  | "threeD"
  | "material";

/**
 * A shape painted BEHIND a text part — the plate a title, a question, a
 * badge line, the number in the bullet, an option's text or a custom text
 * box sits on (Canva's "text background", the coloured capsules and slanted
 * plates of the Bangladeshi edu-platform slide style).
 *
 * The plate is its own layer under the glyphs: nothing here ever touches the
 * text's colour, opacity or effects, and the text's own nudge (`offsetX` /
 * `offsetY` of the typeface) never moves the plate. Every length is in slide
 * pixels, so the board, the thumbnails and the PNG / PDF export paint the
 * same plate.
 */
export interface TextBgShape {
  /** false parks the settings without painting the plate */
  enabled: boolean;
  kind: TextBgShapeKind;
  /** the preset the settings were built from, for the picker highlight */
  preset?: string;
  /** solid fill; "" = no fill (border / effects only) */
  color: string;
  /** gradient fill — wins over `color` while enabled */
  gradient?: Gradient;
  /** "" = no border */
  borderColor: string;
  borderStyle: TextBgBorderStyle;
  /** px */
  borderWidth: number;
  /** corner radius px (box family) */
  radius: number;
  /** how visible the plate is: 100 = fully visible, 0 = invisible */
  opacity: number;
  effect: TextBgEffectKind;
  /** 0–100 strength of the effect */
  effectIntensity: number;
  /** the effect's own colour; undefined = derived from the plate */
  effectColor?: string;
  /** room between the glyphs and the plate's edge, px */
  padX: number;
  padY: number;
  /** nudge of the plate only, px — the text stays where it is */
  offsetX: number;
  offsetY: number;
  /** one plate hugging every line, or one plate behind the whole text */
  scope: "line" | "block";
  /** hug the text, or fill the box's whole width */
  width: "hug" | "fill";
  /** slant of the plate, degrees (−45 … 45) */
  skew: number;
  /** rotation of the plate, degrees (−180 … 180) */
  rotate: number;
}

/** Per-box typeface override. Empty fields fall back to the deck fonts. */
export interface BoxTypeface {
  color?: string;
  underline?: boolean;
  strikethrough?: boolean;
  family?: string;
  script?: "bangla" | "latin" | "arabic";
  weight?: number;
  italic?: boolean;
  uppercase?: boolean | "inherit" | "lowercase" | "normal" | "uppercase";
  textTransform?: "uppercase" | "lowercase" | "none";
  align?: "left" | "center" | "right" | "justify";
  letterSpacing?: number;
  lineHeight?: number;
  opacity?: number;
  fontSize?: number;
  /** size multiplier on top of the box's default (1 = unchanged) */
  scale?: number;
  textGlow?: number;
  textShadow?: boolean;
  textStroke?: { enabled: boolean; color: string; width: number };
  textGradient?: Gradient;
  /** Canva-style text effect (shadow, lift, hollow, splice, outline, echo, glitch, neon, background) */
  effect?: TextEffect;
  /**
   * Position of the TEXT inside its box, in slide pixels. A nudge of the glyphs
   * only: the box (and anything painted with it — banner, marker, plate) stays
   * where it is.
   */
  offsetX?: number;
  offsetY?: number;
  /**
   * The shape painted behind this part's glyphs (toolbar ▸ Background shape).
   * Its own layer under the text: the plate is never faded, stroked or moved
   * by a text setting, and the text is never touched by the plate's.
   */
  bgShape?: TextBgShape;
}

/**
 * Every text part that owns a typeface of its own. The board elements, plus
 * the parts painted INSIDE a merged element: the two brand lines (Badge 1 /
 * Badge 2) inside the brand block and the letter inside every option marker.
 */
export type BoxFontId = ElementId | "brandTop" | "brandBottom" | "optionBullet";

export type BoxFonts = Partial<Record<BoxFontId, BoxTypeface>>;

/**
 * Position is stored as an *alignment fraction* (like background-position):
 * x = 0 → flush to the left edge, 50 → centred, 100 → flush right.
 * The same applies to y from top to bottom, so an element can never be
 * dragged outside the board.
 */
export interface Box {
  x: number;
  y: number;
  /** width as a percentage of the board */
  w: number;
  align: "left" | "center" | "right";
  /**
   * "align" → x/y are alignment fractions (0 = flush left/top … 100 = flush right/bottom)
   * "free"  → x/y are the element's own left/top edge in % of the board; may go
   *           past the edges (‑50 … 150), can have a fixed height and rotation.
   */
  mode?: "align" | "free";
  /** fixed height in % of the board (free mode only, undefined = auto) */
  h?: number;
  /** rotation in degrees */
  rot?: number;
  /** stacking order */
  z?: number;
  /**
   * Layer visibility (Layers panel 👁). `true` keeps the element in the stack —
   * it can still be reordered, selected and shown again — but the board, the
   * thumbnails and every export stop painting it.
   */
  hidden?: boolean;
  /** Layer lock (Layers panel 🔒): the element cannot be dragged/resized/rotated. */
  locked?: boolean;
}

export const FREE_MIN = -50;
export const FREE_MAX = 150;

export type LayoutMap = Record<ElementId, Box>;

export const ELEMENT_LABELS: Record<ElementId, string> = {
  logo: "Logo",
  brand: "Brand text",
  title: "Title",
  badge: "Badge",
  bullet: "Number bullet",
  question: "Question",
  options: "Options",
  note: "Footnote",
};

/**
 * The deck's built-in DESIGN elements — the ones a plain page (a slide of the
 * user's own, e.g. an imported PDF page) does not paint. Content-driven elements
 * (bullet, question, options, footnote) are deliberately NOT in this list: they
 * follow what the user actually types on that slide.
 */
export const PLAIN_PAGE_CHROME: readonly ElementId[] = ["logo", "brand", "title", "badge"];

/** Is `id` one of the built-in design elements a plain page keeps off? */
export const isPlainPageChrome = (id: ElementId): boolean => PLAIN_PAGE_CHROME.includes(id);

export const DEFAULT_LAYOUT: LayoutMap = {
  logo: { x: 1, y: 3, w: 6.5, align: "left" },
  brand: { x: 9.5, y: 4, w: 21, align: "left" },
  title: { x: 50, y: 3, w: 57, align: "center" },
  badge: { x: 99, y: 5, w: 27, align: "right" },
  bullet: { x: 3.5, y: 21, w: 5, align: "center" },
  question: { x: 8.5, y: 18, w: 90, align: "left" },
  options: { x: 88, y: 72, w: 42, align: "left" },
  note: { x: 2, y: 97, w: 60, align: "left" },
};

export const cloneLayout = (l: LayoutMap = DEFAULT_LAYOUT): LayoutMap =>
  Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v }])) as LayoutMap;

/* ------------------------------------------------------------ banner */

/**
 * The title plate's silhouette, in thirteen families (`BANNER_SHAPE_FAMILY` in
 * `src/lib/banner.ts` says which one each id belongs to). The first eight are
 * the shape library — **Basic & Clean**, **Banner Style**, **Cut & Corner**,
 * **Modern**, **Curved & Wave**, **Organic / Decorative**, **Decorative /
 * Highlight** and **Premium / Special** — and the last five are the original
 * paint families:
 *
 *   basic       the clean plates — rounded rectangles, soft corners, capsules,
 *               ovals, the curved band
 *   bannerStyle the classic banner cuts — ribbon, points, notches, the folded
 *               and the scroll, the badge, the tail and the flag
 *   cut         the corner cuts — one cut, two, a diagonal shear, a chamfer,
 *               the octagon and the trapezoid
 *   modern      the contemporary cuts — slant, diagonal, angle, skew, the
 *               layered and offset cards, the split, the floating plate, the
 *               stepped band
 *   curve       the curved silhouettes — waves, arch, dome, concave, convex,
 *               the swoosh, the curved ribbon
 *   organic     the freehand shapes — blobs (asymmetric, liquid, amoeba,
 *               freeform), the cloud, the brush and paint strokes, the
 *               highlight
 *   decor       the highlighter's own marks — marker and highlight strips, the
 *               swoosh highlight, the splash, the burst and sunburst plates
 *   premium     the dressed plates — double ribbon, triple layer, the 3D,
 *               glass, outline and ticket plates, the seal and the emblem
 *   plates      one body, corners only — glow · box
 *   stylish     one body cut to another silhouette — hexagon, chevron,
 *               swallowtail, tab
 *   multilayer  the body **plus** painted layers of its own behind it — double
 *               frame, accent block, long shadow
 *   gradient    the body painted from **several stacked gradients** — sheen,
 *               gloss, stripes, and the stacked-gradient plates
 *   marks       a rule instead of a plate — underline · none
 */
export type BannerShape =
  /* basic & clean */
  | "rounded"
  | "softRounded"
  | "capsule"
  | "pill"
  | "ovalPlate"
  | "circlePlate"
  | "halfRound"
  | "curvedRect"
  | "softSquare"
  | "ellipseBanner"
  /* banner style */
  | "classicBanner"
  | "titleBanner"
  | "ribbon"
  | "pointedBanner"
  | "doubleEndedBanner"
  | "notch"
  | "cutCorner"
  | "foldedBanner"
  | "scrollBanner"
  | "badgeBanner"
  | "tailBanner"
  | "flagBanner"
  /* cut & corner */
  | "singleCut"
  | "doubleCut"
  | "diagonalCut"
  | "chamferedBanner"
  | "octagonBanner"
  | "trapezoidBanner"
  /* modern */
  | "slant"
  | "diagonalBanner"
  | "angledBanner"
  | "asymmetricBanner"
  | "skewedRect"
  | "stack"
  | "offsetLine"
  | "split"
  | "floatingPlate"
  | "geoPlate"
  | "steppedBanner"
  /* curved & wave */
  | "waveBanner"
  | "curvedBanner"
  | "wavyStrip"
  | "arch"
  | "domeBanner"
  | "concaveBanner"
  | "convexBanner"
  | "swoosh"
  | "curvedRibbon"
  | "wavePlate"
  /* organic / decorative */
  | "organicBlob"
  | "abstractBlob"
  | "wavyBlob"
  | "roundedBlob"
  | "cloudShape"
  | "brushStroke"
  | "paintStroke"
  | "highlightBlob"
  | "organicPlate"
  | "abstractPlate"
  | "asymmetricBlob"
  | "liquidShape"
  | "amoebaShape"
  | "freeformBlob"
  /* decorative / highlight */
  | "markerStroke"
  | "highlightStrip"
  | "swooshHighlight"
  | "splashShape"
  | "burstPlate"
  | "sunburstPlate"
  /* premium / special */
  | "doubleRibbon"
  | "tripleLayer"
  | "plate3d"
  | "glassPlate"
  | "outlineBanner"
  | "ticketBanner"
  | "sealBadge"
  | "emblemPlate"
  /* plates */
  | "glow"
  | "rect"
  /* stylish — one plate, another silhouette */
  | "hex"
  | "chevron"
  | "swallow"
  | "tab"
  /* multilayer — the plate plus its own layers */
  | "frame"
  | "accent"
  | "longShadow"
  /* multilayer gradient — one plate, several paints */
  | "sheen"
  | "gloss"
  | "stripes"
  | "gradStack"
  /* marks */
  | "underline"
  | "none";

export interface GradientStop {
  color: string;
  /** 0–100 */
  at: number;
}

/**
 * linear    one ramp along an angle
 * radial     one ramp out from a centre
 * mesh       colour blobs melted over a base
 * conic      the angular sweep round a centre (from its angle)
 * reflected  the ramp mirrored out from the middle to both ends
 */
export type GradientType = "linear" | "radial" | "mesh" | "conic" | "reflected";

export interface Gradient {
  enabled: boolean;
  type: GradientType;
  /** degrees, linear only */
  angle: number;
  stops: GradientStop[];
  /** radial centre in % of the box (defaults 50/50 when missing) */
  cx?: number;
  cy?: number;
}

/**
 * The title plate's outline, in the same words the markers use: a solid rule, a
 * dashed one, dots, two parallel lines, or none at all.
 */
export type BannerBorderStyle = "solid" | "dashed" | "dotted" | "double" | "none";

/**
 * The plate's four corners set one by one (Title background ▸ Border ▸ Border
 * radius ▸ Each corner), in px: top-left, top-right, bottom-right, bottom-left —
 * the order CSS reads `border-radius` in.
 */
export interface BannerCorners {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/**
 * The light the plate's outline gives off (Title background ▸ Border ▸ Border
 * glow): the line itself blooms, so the glow follows its dashes and dots, its
 * corners and its transparency.
 */
export interface BannerBorderGlow {
  /** on / off — switched off, the settings wait for the next time */
  enabled: boolean;
  /** how far the light reaches, px */
  size: number;
  /** how bright it is, 0–100 */
  intensity: number;
  /** "" = auto: the line's own colour */
  color: string;
}

/**
 * The plate's outline: its colour, thickness, line style, its own transparency
 * (0–1, independent of the shape's) and the glow it may give off.
 */
export interface BannerBorder {
  enabled: boolean;
  color: string;
  width: number;
  style?: BannerBorderStyle;
  opacity?: number;
  /** left out = no glow (every deck saved before the glow existed) */
  glow?: BannerBorderGlow;
}

/** what the Border card's glow starts on the first time it is switched on */
export const DEFAULT_BANNER_BORDER_GLOW: BannerBorderGlow = { enabled: true, size: 14, intensity: 60, color: "" };

/* ------------------------------ the plate's ten fills ------------------- */

/**
 * The paint the title plate wears (Title background ▸ Fill). **Solid** and
 * **gradient** both read from `color` / `gradient` (the gradient's own `type`
 * names the linear · radial · angular · reflected · multi-colour · transparent
 * ramps); the three special paints carry their own settings below. Older decks
 * never saved a `fillMode` — the plate derives solid / gradient from
 * `gradient.enabled`, exactly as it always did.
 */
export type BannerFillMode = "solid" | "gradient" | "glass" | "metallic" | "pattern";

export type TransparentSide = "left" | "right" | "top" | "bottom";

/**
 * The pattern paint's motifs — every one is written in repeating CSS
 * gradients, so the whole pattern stays inside a single `background` value
 * and exports pixel-for-pixel.
 */
export type BannerPatternKind =
  | "dots"
  | "stripes"
  | "lines"
  | "grid"
  | "checker"
  | "diamonds"
  | "rays"
  | "rings";

/** the frosted pane paint — a tinted pane with frost gathered along the top */
export interface BannerGlassFill {
  /** the pane's tint — "" follows the plate's own colour */
  color: string;
  /** how solidly the pane is painted, 0–100 */
  opacity: number;
  /** how hard the frost gathers (the white sheen), 0–100 */
  frost: number;
}

/** the brushed-metal paint — lit and shaded bands brushed along one angle */
export interface BannerMetallicFill {
  /** the metal's tint — "" follows the plate's own colour */
  color: string;
  /** the direction the sheen runs, degrees */
  angle: number;
  /** the contrast between the bright and the dark bands, 0–100 */
  polish: number;
}

/** the pattern paint — one motif inked over one ground */
export interface BannerPatternFill {
  kind: BannerPatternKind;
  /** the pattern's ink — "" follows the plate's own colour */
  color: string;
  /** the ground under the motif — "" follows the plate's own colour */
  back: string;
  /** the motif's tile size, 0–100 */
  scale: number;
}

export const DEFAULT_BANNER_GLASS: BannerGlassFill = { color: "", opacity: 60, frost: 55 };
export const DEFAULT_BANNER_METALLIC: BannerMetallicFill = { color: "", angle: 135, polish: 65 };
export const DEFAULT_BANNER_PATTERN: BannerPatternFill = { kind: "dots", color: "", back: "", scale: 45 };

/* ------------------------------------- the Effects card of the plate ------ */

/* ====================================================================== *
 *  The effects a plate wears, category by category
 * ====================================================================== *
 *
 * The plate's **Effects** card reads like Canva's: seven categories, each one
 * a family of effects with its own tiles and its own controls, and each one
 * wearing at most one effect at a time:
 *
 *   Shadow      an offset copy of the plate, on X · Y · Blur · Spread ·
 *               Opacity · Colour
 *   Glow        light blooming off the plate, on Type · Blur · Intensity ·
 *               Colour
 *   Blur        the plate (or the board behind it) blurred, on Type · Blur ·
 *               Intensity · Direction · Colour
 *   Glass       the frosted pane family, on Type · Blur · Intensity · Tint
 *   Bevel       a lit edge and a shaded one, on Type · Depth · Blur · Angle ·
 *               Colour
 *   ​3D          a slab behind the plate (or the plate tipped in space), on
 *               Type · Depth · Blur · Angle · Colour
 *   Highlight   a light laid over the plate, on Type · Blur · Intensity ·
 *               Angle · Colour
 *
 * Every one of them falls back to off, and every colour channel falls back to
 * the shape's own paint (`bannerFxColor`), so an effect left on Auto follows
 * the plate the moment it is repainted.
 *
 * Decks written before the seven categories kept their effects in the older
 * groups — `common` (the text background's shared vocabulary), `depth` (the
 * 3D shapes) and `modern` (the glass family). Those are still read, and
 * `bannerEffectsOf` in `lib/banner` folds each of them into the category it
 * belongs to, so an old deck opens with its effect already selected in the
 * right place.
 */

/* -------------------------------- shadow --------------------------------- */

/** the twelve shadows a plate can carry — one at a time, dressed by the card */
export type BannerShadowKind =
  | "drop"
  | "soft"
  | "hard"
  | "long"
  | "inner"
  | "floating"
  | "offset"
  | "colored"
  | "double"
  | "surround"
  | "layered"
  | "cast";

export interface BannerShadowFx {
  kind: BannerShadowKind;
  /** px of the board, signed — left/right */
  x: number;
  /** px of the board, signed — up/down */
  y: number;
  /** px */
  blur: number;
  /** px — the shadow grows outward (0 = its own size) */
  spread: number;
  /** 0–100 */
  opacity: number;
  color: string;
}

/* --------------------------------- glow ---------------------------------- */

/** the eight lights a plate can bloom with — one at a time */
export type BannerGlowKind = "outer" | "inner" | "neon" | "soft" | "halo" | "backlight" | "aurora" | "outlineGlow";

export interface BannerGlowFx {
  kind: BannerGlowKind;
  /** 0–100 — how bright the light is */
  intensity: number;
  /** px — the bloom's reach, on top of the intensity's own */
  blur: number;
  color: string;
}

/* --------------------------------- blur ---------------------------------- */

/** the eight blurs a plate can wear — one at a time */
export type BannerBlurKind = "soft" | "gaussian" | "backdrop" | "motion" | "zoom" | "feather" | "bloom" | "frost";

export interface BannerBlurFx {
  kind: BannerBlurKind;
  /** px — how much blur */
  blur: number;
  /** 0–100 — how deep the blur (and, with it, the tint) goes */
  intensity: number;
  /** degrees — the way a motion, zoom or feather blur runs */
  angle: number;
  color: string;
}

/* --------------------------------- glass --------------------------------- */

/** the seven panes a plate can be cut from — one at a time */
export type BannerGlassKind = "glass" | "frosted" | "acrylic" | "blurBg" | "clearGlass" | "tinted" | "glassEdge";

export interface BannerGlassFx {
  kind: BannerGlassKind;
  /** 0–100 — the pane's tint and the strength of its rim */
  intensity: number;
  /** px — the backdrop blur the pane frosts the board with */
  blur: number;
  color: string;
}

/* --------------------------------- bevel --------------------------------- */

/** the seven edges a plate can be cut with — one at a time */
export type BannerBevelKind = "bevel" | "innerBevel" | "outerBevel" | "emboss" | "ridge" | "groove" | "pillow";

export interface BannerBevelFx {
  kind: BannerBevelKind;
  /** 0–100 — how deep the edge is cut */
  intensity: number;
  /** px — how soft the cut is */
  blur: number;
  /** degrees — where the light comes from (0 = straight above, clockwise) */
  angle: number;
  color: string;
}

/* ---------------------------------- 3D ----------------------------------- */

/** the nine depths a plate can stand in — one at a time */
export type Banner3DKind =
  | "extrusion"
  | "depth"
  | "layered3d"
  | "perspective"
  | "tilt"
  | "pop"
  | "raised"
  | "pressed"
  | "isometric";

export interface Banner3DFx {
  kind: Banner3DKind;
  /** 0–100 — how far the depth runs */
  intensity: number;
  /** px — the softness of the shadow the depth throws */
  blur: number;
  /** degrees — the way the depth runs (0 = straight up, 90 = down, 180 = up) */
  angle: number;
  color: string;
}

/* ------------------------------- highlight ------------------------------- */

/** the ten lights a plate can wear on its face — one at a time */
export type BannerHighlightKind =
  | "highlight"
  | "innerHighlight"
  | "outerHighlight"
  | "edgeHighlight"
  | "gloss"
  | "sheen"
  | "shine"
  | "reflection"
  | "spotlight"
  | "rimLight";

export interface BannerHighlightFx {
  kind: BannerHighlightKind;
  /** 0–100 — how bright the light is */
  intensity: number;
  /** px — how soft the light's edge is */
  blur: number;
  /** degrees — the way the light runs */
  angle: number;
  color: string;
}

/* ---------------------------- the shape's own ---------------------------- */

/** the shape's own distortion channels — sliders and flips, all independent */
export interface BannerShapeFx {
  /** 0 = the plate's own corners; px otherwise */
  radius: number;
  /** the four corners in px, worn when `independent` */
  cornerTL: number;
  cornerTR: number;
  cornerBR: number;
  cornerBL: number;
  independent: boolean;
  /** −100..100 — squash the plate to a stretch */
  distortion: number;
  /** 0–100 — a wave along each long edge */
  wave: number;
  /** 0–100 — a curved band */
  curve: number;
  /** 0–100 — shear the whole plate */
  slant: number;
  /** degrees, −45..45 */
  skew: number;
  /** degrees, −180..180 */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/* ------------------------------------------------------------------------- *
 *  The decorations & the finishes — the effects that are none of the seven
 * ------------------------------------------------------------------------- */

/**
 * The plate's **Decorations** — the patterns, the textures and the accents
 * that are none of the seven categories: the vignette, the grain, the stitch,
 * the bars, the sticker outline and the rest. One at a time, with its own
 * strength and colour, read from the same `decor` group the card always kept
 * them in.
 */
export type BannerDecorKind =
  | "innerHighlight"
  | "outerHighlight"
  | "outlineGlow"
  | "gradientShadow"
  | "colorShadow"
  | "edgeHighlight"
  | "edgeDarkening"
  | "vignette"
  | "texture"
  | "pattern"
  | "dots"
  | "grid"
  | "stitch"
  | "sunburst"
  /** the accents the shared text-background vocabulary brings (see `common`) */
  | "ring"
  | "offsetOutline"
  | "sticker"
  | "stack"
  | "topBar"
  | "bottomBar"
  | "leftBar"
  | "stripes"
  | "checker"
  | "cornerFold"
  | "fadeRight"
  | "fadeEdges";

export interface BannerDecorFx {
  kind: BannerDecorKind;
  /** 0–100 */
  intensity: number;
  color: string;
}

/**
 * The plate's **Finishes** — the modern surface treatments: the grain, the
 * mesh, the holographic sheen, the brushed metal, the duotone and the soft-UI
 * card. The glass family moved to the **Glass** category, where it is dressed
 * by the pane's own controls.
 */
export type BannerModernKind = "noise" | "softGradient" | "mesh" | "holographic" | "metallic" | "duotone" | "softUi";

export interface BannerModernFx {
  kind: BannerModernKind;
  /** 0–100 */
  intensity: number;
  color: string;
  /** a little extra blur the finish may lay over the body, px */
  blur: number;
}

/**
 * The plate's **Shared Effects** — the very vocabulary of the text
 * background's own Effects card (see `TextBgEffectKind` and `lib/textBgShape`
 * `TEXT_BG_EFFECTS`), painted on the whole title plate by the same
 * `lib/shapeEffects` engine a text plate wears. What the card still files here
 * is the patterns and the accents the seven categories do not carry.
 */
export interface BannerCommonFx {
  kind: TextBgEffectKind;
  /** 0–100 strength of the effect */
  intensity: number;
  /** the effect's own colour; undefined = derived from the plate */
  color?: string;
}

/* ------------------------------------------------------------------------- *
 *  Everything the card dresses
 * ------------------------------------------------------------------------- */

/**
 * Everything the plate's **Effects** card dresses: one effect per category
 * (`shadow` · `glow` · `blur` · `glass` · `bevel` · `threeD` · `highlight`),
 * the decorations and the finishes, and the shape's distortion channels on
 * their own. `undefined` in a group means the group is off.
 *
 * `depth` is the one group decks no longer write: it is the old **Depth / 3D**
 * card, whose twelve depths are folded into `bevel` (the four bevelled edges)
 * and `threeD` (the extrusions and the turns) when the deck is read — so a
 * deck that had, say, *3D Extrusion* selected opens with it selected under
 * **3D**.
 */
export interface BannerEffects {
  shadow?: BannerShadowFx;
  glow?: BannerGlowFx;
  blur?: BannerBlurFx;
  glass?: BannerGlassFx;
  bevel?: BannerBevelFx;
  threeD?: Banner3DFx;
  highlight?: BannerHighlightFx;
  /** the patterns, textures and accents — the Decorations card */
  decor?: BannerDecorFx;
  /** the modern finishes — the Finishes strip of the Decorations card */
  modern?: BannerModernFx;
  /** the shared text-background effects still filed here */
  common?: BannerCommonFx;
  /** @deprecated the old Depth / 3D group — read, folded into `bevel` / `threeD` */
  depth?: BannerDepthFx;
  /** the corners and the distortions, stacked on top of every category */
  shape: BannerShapeFx;
}

/**
 * The old **Depth / 3D** group — twelve depths in one list. Decks written
 * before the seven categories carry it; `bannerEffectsOf` maps each kind into
 * the category that suits it (the bevelled edges to **Bevel**, the extrusions
 * and the turns to **3D**) and the card never writes it again.
 */
export type BannerDepthKind =
  | "extrusion"
  | "bevel"
  | "emboss"
  | "innerBevel"
  | "outerBevel"
  | "raised"
  | "pressed"
  | "depth"
  | "perspective"
  | "layered3d"
  | "tilt"
  | "pop";

export interface BannerDepthFx {
  kind: BannerDepthKind;
  /** 0–100 */
  intensity: number;
  /** the light's direction in degrees — 0 is straight above, clockwise */
  angle: number;
}

/** the factory effects — everything off, the shape wearing its own body */
export const DEFAULT_BANNER_EFFECTS: BannerEffects = {
  shape: {
    radius: 0,
    cornerTL: 0,
    cornerTR: 0,
    cornerBR: 0,
    cornerBL: 0,
    independent: false,
    distortion: 0,
    wave: 0,
    curve: 0,
    slant: 0,
    skew: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
  },
};

export interface BannerSettings {
  shape: BannerShape;
  /** solid colour (used when gradient is disabled) */
  color: string;
  gradient: Gradient;
  /**
   * The paint the plate wears — one of the ten fills. Left out (or set to
   * solid / gradient), the plate reads its paint from `color` / `gradient`
   * exactly like the older decks; **glass**, **metallic** and **pattern** wear
   * the special paints below instead.
   */
  fillMode?: BannerFillMode;
  /** the frosted pane paint, worn while `fillMode` is "glass" */
  glass?: BannerGlassFill;
  /** the brushed-metal paint, worn while `fillMode` is "metallic" */
  metallic?: BannerMetallicFill;
  /** the pattern paint, worn while `fillMode` is "pattern" */
  pattern?: BannerPatternFill;
  /** which sides fade to clear when transparent gradient is active */
  transparentSides?: TransparentSide[];
  /** the SHAPE's own transparency 0–1 — the outline keeps its own below */
  opacity: number;
  /** soft edge / blur strength 0–100 (glow shape) */
  glow: number;
  /** extra glow halo around the banner (any shape) 0–100 */
  halo: number;
  /**
   * Plate expansion, in % of the title frame. `padY` is the room above and
   * below the heading while the plate's height is automatic. `padX` is kept for
   * decks saved before the plate's width became its own 630 px box
   * (`BANNER_WIDTH`); a deck whose width is unset — the small previews inside
   * the panels — still reads it as room left and right.
   */
  padX: number;
  padY: number;
  /** corner radius for rounded / rect shapes, px — every corner alike */
  radius: number;
  /**
   * Each corner on its own (Border ▸ Border radius ▸ Each corner). While
   * `cornersIndependent` is on, the four values below replace the silhouette's
   * own corners (the ones `radius` draws) on every plate that has corners to
   * round; switched off, the plate goes back to `radius` and the four values
   * wait. Left out on every deck saved before the corners came apart.
   */
  cornersIndependent?: boolean;
  corners?: BannerCorners;
  /**
   * The plate's outline: its colour, thickness, line style, its own
   * transparency (0–1, independent of the shape's) and its glow.
   */
  border: BannerBorder;
  /**
   * Free plate box in px of the 1280 × 720 stage. Left out, the plate uses the
   * title element's stable frame and its padding; set, the plate is painted at
   * that exact size and centred on the title — and nothing clamps it, so it may
   * be wider or taller than the board itself.
   */
  size?: { w?: number; h?: number };
  /**
   * Where the plate sits, as a nudge in px of the stage from its own place:
   * x → right, y → down. Free of any limit, like the size.
   */
  pos?: { x?: number; y?: number };
  /** title text: solid colour or gradient */
  textGradient: Gradient;
  /** text glow */
  textGlow: number;
  textShadow: boolean;
  /** subtle animated shimmer in presenter mode (not exported) */
  shimmer: boolean;
  /** the plate's own effects — the Effects card of the Title background line */
  effects?: BannerEffects;
}

/**
 * The default padding used by the title plate when it has no explicit free
 * size. The title plate is laid out against the title element's own box (not
 * the glyphs), so changing the title font cannot resize the built-in plate.
 */
export const BANNER_PAD_X = 7;
export const BANNER_PAD_Y = 8;

/**
 * The content frame used by the automatic title plate, in stage pixels. It is
 * deliberately independent of the title font size: the heading may grow or
 * shrink inside this frame while the built-in background keeps its own shape.
 */
export const BANNER_AUTO_FRAME_HEIGHT = 72;

/** the plate's own default corner radius, matched to its tighter box */
export const BANNER_RADIUS = 14;

/**
 * The title background shape's width, in px of the 1280 × 720 stage: **630 px
 * across**, horizontally. The plate paints at exactly this box, centred on the
 * heading — free of the title text's own width, so the plate keeps its size
 * whatever the heading says or which font it wears. Height stays automatic: the
 * 72 px line frame plus its padding.
 *
 * Every path that dresses the plate writes this width rather than handing the
 * shape back to the heading's own room — a fresh deck, a banner design preset
 * (`bannerPresetPatch`), a slide design (`lib/slideDesigns`), and the Banner
 * size card's own button all carry it. Only the *Banner size* bar paints
 * another width, and only for as long as the teacher leaves it there.
 */
export const BANNER_WIDTH = 630;

export const DEFAULT_BANNER: BannerSettings = {
  shape: "glow",
  color: "#1f5fd0",
  gradient: {
    enabled: false,
    type: "linear",
    angle: 90,
    stops: [
      { color: "#1f5fd0", at: 0 },
      { color: "#5b8cff", at: 100 },
    ],
  },
  // the plate starts on the classic solid / gradient pair — the three special
  // paints wait on their own factory settings
  glass: { ...DEFAULT_BANNER_GLASS },
  metallic: { ...DEFAULT_BANNER_METALLIC },
  pattern: { ...DEFAULT_BANNER_PATTERN },
  opacity: 1,
  glow: 65,
  halo: 0,
  padX: BANNER_PAD_X,
  padY: BANNER_PAD_Y,
  radius: BANNER_RADIUS,
  // the plate's width is fixed from the start (see BANNER_WIDTH); only the
  // height still grows with the heading's line
  size: { w: BANNER_WIDTH },
  border: { enabled: false, color: "#ffd633", width: 2, style: "solid", opacity: 1 },
  textGradient: {
    enabled: false,
    type: "linear",
    angle: 180,
    stops: [
      { color: "#fff2a8", at: 0 },
      { color: "#ffb800", at: 100 },
    ],
  },
  textGlow: 25,
  textShadow: true,
  shimmer: false,
  effects: DEFAULT_BANNER_EFFECTS,
};

export const cloneBanner = (b: BannerSettings = DEFAULT_BANNER): BannerSettings =>
  JSON.parse(JSON.stringify(b)) as BannerSettings;

/* ---------------------------------------------------------- background */

export interface BackgroundSettings {
  /** data-URL or http(s) URL; "" = no image */
  src: string;
  fit: "cover" | "contain" | "stretch" | "tile";
  /** focal point in %, used with cover/contain */
  posX: number;
  posY: number;
  /** 0–1 */
  opacity: number;
  /** px */
  blur: number;
  /** 0–100 extra zoom when fit = cover */
  zoom: number;
  flipH: boolean;
  /** colour overlay / tint */
  overlay: { enabled: boolean; color: string; opacity: number };
  /** optional gradient beneath / instead of the image */
  gradient: Gradient;
  /** darken the board edges for legibility */
  vignette: number;
  /**
   * Decorative vector design id (see lib/backgroundDesigns). "" = none.
   * Rendered above the gradient, below the image.
   */
  design?: string;
  /**
   * Design size as % of the board (100 = natural). Width and height are
   * independent so shapes can be stretched; keep them equal to scale
   * uniformly. Percentages keep the design correct at any slide size.
   */
  designW?: number;
  designH?: number;
  /** design layer opacity 0–1 */
  designOpacity?: number;
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  src: "",
  fit: "cover",
  posX: 50,
  posY: 50,
  opacity: 1,
  blur: 0,
  zoom: 0,
  flipH: false,
  overlay: { enabled: false, color: "#000000", opacity: 0.35 },
  gradient: {
    enabled: false,
    type: "linear",
    angle: 180,
    stops: [
      { color: "#0b1226", at: 0 },
      { color: "#050507", at: 100 },
    ],
    cx: 50,
    cy: 50,
  },
  vignette: 0,
  design: "",
  designW: 100,
  designH: 100,
  designOpacity: 1,
};

export const cloneBackground = (b: BackgroundSettings = DEFAULT_BACKGROUND): BackgroundSettings =>
  JSON.parse(JSON.stringify(b)) as BackgroundSettings;

/* ------------------------------------------------------------- frame ---- */

export type FrameStyleId =
  | "wood"
  | "mahogany"
  | "walnut"
  | "ebony"
  | "gold"
  | "silver"
  | "bronze"
  | "copper"
  | "baroque"
  | "neon"
  | "neonMagenta"
  | "neonGreen"
  | "cyberpunk"
  | "solid"
  | "gradient"
  | "glass"
  | "carbon"
  | "double"
  | "triple"
  | "dashed"
  | "dotted"
  | "chalk"
  | "groove"
  | "ridge"
  | "oak"
  | "bamboo"
  | "marble"
  | "obsidian"
  | "pearl"
  | "ruby"
  | "emerald"
  | "sapphire"
  | "leather"
  | "velvet"
  | "cinema"
  | "polaroid"
  | "comic"
  | "pixel"
  | "mosaic"
  | "rainbow"
  | "ice"
  | "lava"
  | "paper"
  | "vintage"
  | "artDeco"
  | "celtic"
  | "orichalcum"
  | "hologram"
  | "thin"
  | "none";

export interface FrameSettings {
  /** rendering style of the frame */
  style: FrameStyleId;
  /** primary frame colour (wood/solid base) */
  color: string;
  /** optional two-stop gradient used by the "gradient" style */
  gradient: { enabled: boolean; angle: number; from: string; to: string };
  /** frame thickness in slide px */
  width: number;
  /** corner radius in px */
  radius: number;
  /** inner shadow / neon glow */
  shadow: boolean;
  /** overlay frame image url (photo or svg) */
  image?: string;
  /** inner opening as % of the slide (photo frames) */
  imageInset?: number;
  /**
   * "fit" (default) = scale the inner board to fit strictly inside the frame opening
   * so frame images NEVER cover the title, question, options, or any slide content.
   * "overlay" = legacy behavior where the frame sits as an overlay on top.
   */
  imagePlacement?: "fit" | "overlay";
}

export const DEFAULT_FRAME: FrameSettings = {
  style: "wood",
  color: "#e6a15c",
  gradient: { enabled: false, angle: 155, from: "#f2c98a", to: "#a86a24" },
  width: 26,
  radius: 14,
  shadow: true,
};

export const cloneFrame = (f: FrameSettings = DEFAULT_FRAME): FrameSettings =>
  JSON.parse(JSON.stringify(f)) as FrameSettings;

export const FRAME_STYLES: { id: FrameStyleId; label: string }[] = [
  { id: "wood", label: "Wood" },
  { id: "mahogany", label: "Mahogany" },
  { id: "walnut", label: "Walnut" },
  { id: "ebony", label: "Ebony" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
  { id: "bronze", label: "Bronze" },
  { id: "copper", label: "Rose Gold" },
  { id: "baroque", label: "Baroque" },
  { id: "neon", label: "Neon Cyan" },
  { id: "neonMagenta", label: "Synthwave" },
  { id: "neonGreen", label: "Matrix" },
  { id: "cyberpunk", label: "Cyber" },
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "glass", label: "Glass" },
  { id: "carbon", label: "Carbon" },
  { id: "double", label: "Double" },
  { id: "triple", label: "Triple" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
  { id: "chalk", label: "Chalk" },
  { id: "groove", label: "Groove" },
  { id: "ridge", label: "Ridge" },
  { id: "oak", label: "Oak" },
  { id: "bamboo", label: "Bamboo" },
  { id: "marble", label: "Marble" },
  { id: "obsidian", label: "Obsidian" },
  { id: "pearl", label: "Pearl" },
  { id: "ruby", label: "Ruby" },
  { id: "emerald", label: "Emerald" },
  { id: "sapphire", label: "Sapphire" },
  { id: "leather", label: "Leather" },
  { id: "velvet", label: "Velvet" },
  { id: "cinema", label: "Cinema" },
  { id: "polaroid", label: "Polaroid" },
  { id: "comic", label: "Comic" },
  { id: "pixel", label: "Pixel" },
  { id: "mosaic", label: "Mosaic" },
  { id: "rainbow", label: "Rainbow" },
  { id: "ice", label: "Ice" },
  { id: "lava", label: "Lava" },
  { id: "paper", label: "Paper" },
  { id: "vintage", label: "Vintage" },
  { id: "artDeco", label: "Art Deco" },
  { id: "celtic", label: "Celtic" },
  { id: "orichalcum", label: "Orichalcum" },
  { id: "hologram", label: "Hologram" },
  { id: "thin", label: "Thin" },
  { id: "none", label: "None" },
];

/** where the option bullet's background shape is painted */
export type OptionBulletBgScope = "marker" | "row";

/**
 * A plate drawn behind the right-hand badge (Badge 3). Disabled by default so
 * decks saved before this existed render exactly as they did.
 */
export interface BadgePlate {
  enabled: boolean;
  color: string;
  /** 0–1 */
  opacity: number;
  /** corner radius in px */
  radius: number;
  /** horizontal / vertical padding in px */
  padX: number;
  padY: number;
  border: { enabled: boolean; color: string; width: number };
}

export const DEFAULT_BADGE_PLATE: BadgePlate = {
  enabled: false,
  color: "#1f5fd0",
  opacity: 1,
  radius: 999,
  padX: 18,
  padY: 6,
  border: { enabled: false, color: "#ffd633", width: 2 },
};

export const cloneBadgePlate = (p: BadgePlate = DEFAULT_BADGE_PLATE): BadgePlate =>
  JSON.parse(JSON.stringify(p)) as BadgePlate;

/** silhouette of the option bullet's background shape */
export type OptionBulletBgShape =
  | "match"
  | "circle"
  | "rounded"
  | "square"
  | "pill"
  | "diamond"
  | "hexagon"
  | "soft";

export interface ThemeSettings {
  frameOuter: string;
  frameInner: string;
  board: string;
  /** frame style / colour / gradient / thickness */
  frame: FrameSettings;
  titleColor: string;
  titleBanner: string;
  /** full title-banner design (shape, gradient, glow …) */
  banner: BannerSettings;
  /** deck-wide background (slides may override with their own) */
  background: BackgroundSettings;
  questionColor: string;
  optionTextColor: string;
  /** option-row style id (see lib/optionStyles) */
  optionStyle: string;
  /** option-row / badge colour */
  optionAccent: string;
  /** option bullet marker shape: circle and 23 alternatives */
  optionBulletShape: string;
  /** option bullet fill treatment */
  optionBulletTreatment: string;
  /** letter inside the bullet marker — "" = auto (marker colour), "transparent" = hidden */
  optionBulletInk: string;
  /** background / fill of the bullet marker — "" = auto, "transparent" = no fill */
  optionBulletFill: string;
  /** outline / ring of the bullet marker — "" = auto, "transparent" = no ring */
  optionBulletBorder: string;
  /** keep the picked ink / fill / border colours on the revealed correct answer */
  optionBulletCustomOnAnswer: boolean;
  /** colour of the bullet's background shape — "" = off */
  optionBulletBgColor: string;
  /** paint that shape behind the marker, or as the option-row background */
  optionBulletBgScope: OptionBulletBgScope;
  /** silhouette of that background shape */
  optionBulletBgShape: OptionBulletBgShape;
  /** size of the background shape, % of the marker box */
  optionBulletBgSize: number;
  /** background shape opacity, 0–100 */
  optionBulletBgOpacity: number;

  /* ------------------------------------------------------- title text ---- */
  /** title text size in slide px (undefined = 54, the historical hardcode) */
  titleSize?: number;

  /* --------------------------------------- brand line 1 / brand line 2 ---- */
  /**
   * The brand block paints two independent lines — "Badge 1" (LEARN WITH) and
   * "Badge 2" (FAYSAL SIR). Each can be hidden, resized and recoloured on its
   * own; unset fields keep following the shared `brandColor`.
   */
  brandTopSize?: number;
  brandBottomSize?: number;
  brandTopColor?: string;
  brandBottomColor?: string;
  showBrandTop?: boolean;
  showBrandBottom?: boolean;

  /* ------------------------------------------------- badge 3 (right) ------ */
  /** right-hand badge size in slide px (undefined = 36) */
  badgeSize?: number;
  /** optional plate drawn behind the right badge */
  badgePlate?: BadgePlate;

  /* ----------------------------------------- text inside question bullet -- */
  /**
   * The number painted inside the question bullet is styled through
   * `boxFonts.bullet` (family, colour, weight, size scale) — the same per-box
   * typeface mechanism every other text element uses.
   */

  /* ------------------------------------------- text inside option bullet -- */
  /** letter size as % of the marker's own font size (100 = unchanged) */
  optionBulletTextSize?: number;
  /** 0 / undefined = the marker shape's own weight */
  optionBulletTextWeight?: number;
  /** "" = the deck face used by the options box */
  optionBulletFontFamily?: string;
  optionBulletUppercase?: boolean;

  /* ---------------------------------------------------------- footnote ---- */
  noteColor?: string;
  /** 0–100 */
  noteOpacity?: number;
  noteSize?: number;
  showNote?: boolean;

  accent: string;
  brandColor: string;
  badgeColor: string;
  bengaliFont: string;
  /** preferred face for Arabic / Urdu text (Dakhil, Quranic quotes) */
  arabicFont: string;
  latinFont: string;
  /** per-element typeface (title, question, options, brand, badge, note…) */
  boxFonts: BoxFonts;
  questionSize: number;
  optionSize: number;
  /** extra vertical gap between option rows, % of the board (0 = auto/tight) */
  optionGap: number;
  /** line-height of the option text (1 = tight, 2 = airy) */
  optionLineHeight: number;
  /** plain numbering painted over the option markers (see lib/plainNumbering) — "none" keeps the option keys */
  plainNumbering: string;
  /**
   * The numeral system the question bullet's number reads in — English digits,
   * Bangla digits or letters, English capital / small letters, Roman capitals
   * / smalls, Arabic-Indic digits or Arabic abjad letters (see
   * lib/plainNumbering · `questionNumberLabel`). "none" — the default — keeps
   * each slide's own number exactly as stored.
   */
  questionNumbering: string;
  optionsLayout: OptionsLayout;
  /** free positioning for every element (0–100 % both axes) */
  layout: LayoutMap;
  /** magnetic snapping while dragging */
  snapEnabled: boolean;
  /** grid step in % used by free mode snapping */
  snapStep: number;
  /** shapes snap to edges/centres of other shapes */
  smartGuides: boolean;
  showBullet: boolean;
  showFrame: boolean;
  showNumber: boolean;
  /** the number bullet is its own movable element (default: off = attached to the question) */
  bulletSeparate: boolean;
  /** numbering style id (see lib/numberStyles) */
  numberStyle: string;
  /** bullet size in px */
  bulletSize: number;
  /**
   * The question bullet's own shape channels (toolbar ▸ Question bullet). They
   * follow the same tri-state convention the option marker uses:
   *
   *   ""            → auto: the numbering design paints itself
   *   "transparent" → paint nothing there
   *   "#rrggbb"     → the picked colour
   *
   * `bulletBorderStyle`, `bulletBorderWeight` and `bulletRadius` fall back to
   * the design's own line and corners, and `bulletOpacity` fades the marker's
   * body only — the number keeps its own ink.
   */
  bulletFill?: string;
  /**
   * The fill's gradient — the same solid / gradient pair the text colour
   * picker offers. An enabled gradient paints the body instead of the solid;
   * clearing it hands the body back to `bulletFill` (or the design's own paint).
   */
  bulletFillGradient?: Gradient;
  bulletBorder?: string;
  /** the outline's gradient (an enabled one paints the line instead of the solid) */
  bulletBorderGradient?: Gradient;
  bulletBorderStyle?: NumberBorderStyle;
  /** outline weight in px (undefined = the design's own line) */
  bulletBorderWeight?: number;
  /** corner radius in px (undefined = the design's own corners) */
  bulletRadius?: number;
  /** 0–100: the marker's body, never the number */
  bulletOpacity?: number;
  /** the marker's shape effect (lib/shapeEffects) — undefined / "none" = the design's own */
  bulletEffect?: ShapeEffectKind;
  /** 0–100 strength of the marker's effect */
  bulletEffectIntensity?: number;
  /** the effect's own colour; undefined = derived from the marker's paint */
  bulletEffectColor?: string;
  /** the shape-style preset last picked (lib/bulletStyles) — "" once hand-tuned */
  bulletStylePreset?: string;
  /** nudge of the whole marker in px — works attached to the question or on its own */
  bulletNudgeX?: number;
  bulletNudgeY?: number;
  /** bullet design id */
  answerStyle: "glow" | "tick" | "fill";
}

export interface DeckHeader {
  title: string;
  brandTop: string;
  brandBottom: string;
  badge: string;
  logo: string | null;
  showLogo: boolean;
  showBanner: boolean;
}

export interface Deck {
  header: DeckHeader;
  theme: ThemeSettings;
  slides: SlideData[];
  /** shapes & text boxes that appear on every slide (watermarks, banners…) */
  globalShapes?: ShapeItem[];
}

export const DEFAULT_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE08A"/><stop offset="55%" stop-color="#F2B441"/><stop offset="100%" stop-color="#B9771B"/>
    </linearGradient>
  </defs>
  <path d="M60 6 108 24v40c0 27-20 44-48 50C32 108 12 91 12 64V24z" fill="url(#g)"/>
  <path d="M60 14 100 29v34c0 22-17 36-40 41-23-5-40-19-40-41V29z" fill="#0b0b0f"/>
  <path d="M60 38 92 50 60 62 28 50z" fill="url(#g)"/>
  <path d="M38 56v14c0 7 10 12 22 12s22-5 22-12V56L60 66z" fill="url(#g)" opacity="0.85"/>
  <rect x="90" y="50" width="3" height="20" rx="1.5" fill="url(#g)"/>
  <text x="60" y="103" font-family="Oswald, Impact, sans-serif" font-size="17" font-weight="700"
        text-anchor="middle" fill="url(#g)" letter-spacing="1">ACADEMY</text>
</svg>`)}`;

export const DEFAULT_THEME: ThemeSettings = {
  frameOuter: "#0a0a0c",
  frameInner: "#e6a15c",
  board: "#050507",
  frame: cloneFrame(),
  titleColor: "#ffd633",
  titleBanner: "#1f5fd0",
  banner: cloneBanner(),
  background: cloneBackground(),
  questionColor: "#ffd94a",
  optionTextColor: "#ffffff",
  optionStyle: "plain",
  optionAccent: "#2f4fff",
  optionBulletShape: "circle",
  optionBulletTreatment: "auto",
  optionBulletInk: "",
  optionBulletFill: "",
  optionBulletBorder: "",
  optionBulletCustomOnAnswer: false,
  optionBulletBgColor: "",
  optionBulletBgScope: "marker",
  optionBulletBgShape: "match",
  optionBulletBgSize: 150,
  optionBulletBgOpacity: 30,
  titleSize: 54,
  brandTopSize: 25,
  brandBottomSize: 27,
  brandTopColor: "",
  brandBottomColor: "",
  showBrandTop: true,
  showBrandBottom: true,
  badgeSize: 36,
  badgePlate: cloneBadgePlate(),
  optionBulletTextSize: 100,
  optionBulletTextWeight: 0,
  optionBulletFontFamily: "",
  optionBulletUppercase: false,
  noteColor: "#ffffff",
  noteOpacity: 72,
  noteSize: 20,
  showNote: true,
  accent: "#2f4fff",
  brandColor: "#ffffff",
  badgeColor: "#ffffff",
  bengaliFont: "'Kalpurush', 'Anek Bangla', 'Noto Sans Bengali', sans-serif",
  arabicFont: "'Noto Naskh Arabic'",
  latinFont: "'Oswald', system-ui, sans-serif",
  boxFonts: {},
  questionSize: 34,
  optionSize: 30,
  optionGap: 0,
  optionLineHeight: 1.45,
  plainNumbering: "none",
  questionNumbering: "none",
  optionsLayout: "right",
  layout: cloneLayout(),
  snapEnabled: true,
  snapStep: 1,
  smartGuides: true,
  showBullet: true,
  showFrame: true,
  showNumber: false,
  bulletSeparate: false,
  numberStyle: "circle",
  bulletSize: 54,
  bulletFill: "",
  bulletBorder: "",
  bulletBorderStyle: "auto",
  bulletOpacity: 100,
  bulletNudgeX: 0,
  bulletNudgeY: 0,
  answerStyle: "glow",
};

export const DEFAULT_HEADER: DeckHeader = {
  title: "বহুনির্বাচনী",
  brandTop: "LEARN WITH",
  brandBottom: "FAYSAL SIR",
  badge: "DAKHIL-26",
  logo: DEFAULT_LOGO,
  showLogo: true,
  showBanner: true,
};

export const SAMPLE_INPUT = `১. $P(x,y) = 7x^5 + 5x^4y^4 + y^6$ বহুপদীর মাত্রা কত?
ক) 5
খ) 6
গ) 7
ঘ) 8
উত্তর: ঘ

২. $\\log_2 32$ এর মান কত?
ক) 3
খ) 4
গ) 5
ঘ) 6
উত্তর: গ

3. If $x + \\frac{1}{x} = 3$, then $x^2 + \\frac{1}{x^2}$ = ?
a) 5
b) 7
c) 9
d) 11
Ans: b`;

/** Shows off the universal character set: Arabic, Hindi, CJK, Greek, emoji. */
export const MULTILINGUAL_SAMPLE = `১. সূরা আল-ফাতিহা (سورة الفاتحة) কত নম্বর সূরা?
ক) ১
খ) ২
গ) ৩
ঘ) ৪
উত্তর: ক

٢. كم عدد أركان الإسلام؟
أ) ثلاثة
ب) أربعة
ج) خمسة
د) ستة
Ans: ج

3. बहुपद $x^3 + 2x$ की घात क्या है?
a) 1
b) 2
c) 3
d) 4
Ans: c

4. Which symbols are correct? ✓ ✗ α β ∑ ∫ 😀 中文 Ελληνικά Русский
a) All render ✓
b) None
Ans: a`;

