import { BANNER_AUTO_FRAME_HEIGHT, BANNER_WIDTH, type BannerBorderStyle, type BannerSettings, type BannerShape, type Gradient } from "./types";
import { shade, withAlpha } from "./color";

/* ---------------------------------------------------- silhouette families */

/**
 * The five families the plate's silhouettes are sorted into — the picker's own
 * headings, and the rule that decides *how* a plate is painted:
 *
 *   plate     one body, corners only (glow · pill · rounded · box)
 *   stylish   one body cut to another silhouette — a clip-path, or corners on
 *             two edges only (ribbon · hexagon · cut corners · chevron ·
 *             swallowtail · slant · tab · arch)
 *   layered   the body **plus** extra painted layers of its own behind it
 *             (stack · frame · accent · offset outline · long shadow)
 *   gradient  the body painted from **several stacked gradients**, one plate
 *             reading as several (sheen · split · gloss · stripes) or several
 *             plates each with a gradient of its own (stacked gradient)
 *   mark      a rule instead of a plate (underline · none)
 */
export type BannerShapeFamily = "plate" | "stylish" | "layered" | "gradient" | "mark";

export const BANNER_SHAPE_FAMILY: Record<BannerShape, BannerShapeFamily> = {
  glow: "plate",
  pill: "plate",
  rect: "plate",
  rounded: "plate",
  ribbon: "stylish",
  hex: "stylish",
  notch: "stylish",
  chevron: "stylish",
  swallow: "stylish",
  slant: "stylish",
  tab: "stylish",
  arch: "stylish",
  stack: "layered",
  frame: "layered",
  accent: "layered",
  offsetLine: "layered",
  longShadow: "layered",
  sheen: "gradient",
  split: "gradient",
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
  shape === "ribbon" || shape === "hex" || shape === "notch" || shape === "chevron" || shape === "swallow" || shape === "slant";


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
 * The plate's box. Width and height are read the same way: a px box when the
 * teacher sized it, the plate's own automatic box otherwise — automatic width
 * being the 630 px chip (`paintedWidth`), automatic height the line frame plus
 * its padding.
 */
export function plateRect(b: BannerSettings): Pick<React.CSSProperties, "left" | "top" | "width" | "height"> {
  const x = b.pos?.x ?? 0;
  const y = b.pos?.y ?? 0;
  const w = paintedWidth(b);
  const h = b.size?.h;
  return {
    // free size is centred on the title (where the plate already sits), so
    // resizing grows both ways and the glyphs stay in the middle of the plate
    // the nudge stays a term of its own, so a plate can be read (and tested) as
    // "centred, then moved" instead of one folded number
    left: w === undefined ? `calc(-${b.padX}% ${nudge(x)})` : `calc(50% ${nudge(x)} ${nudge(-w / 2)})`,
    top: h === undefined ? `calc(-${b.padY}% ${nudge(y)})` : `calc(50% ${nudge(y)} ${nudge(-h / 2)})`,
    width: w === undefined ? `calc(100% + ${2 * b.padX}%)` : `${w}px`,
    height: h === undefined ? `calc(100% + ${2 * b.padY}%)` : `${h}px`,
  };
}

/**
 * The plate's corner radius for the silhouette in use. A number for the
 * silhouettes that round all four corners, a CSS string for the ones that round
 * two edges only (tab, arch), and nothing at all for the cut silhouettes —
 * their corners are cut by a clip-path, so a radius would have nothing to say.
 */
export function plateRadius(b: BannerSettings): number | string | undefined {
  if (b.shape === "pill") return 999;
  if (b.shape === "underline") return 999;
  // a tab is rounded along the top and square along the bottom, an arch is a
  // full half-round on top — both keep the plate's own radius for the curve
  if (b.shape === "tab") return `${b.radius}px ${b.radius}px 0 0`;
  if (b.shape === "arch") return "999px 999px 0 0";
  if (isClippedShape(b.shape)) return undefined;
  if (b.shape === "rounded" || b.shape === "glow") return b.radius;
  // the multilayer and gradient plates are cards: they take the corner as set
  if (BANNER_SHAPE_FAMILY[b.shape] === "layered" || BANNER_SHAPE_FAMILY[b.shape] === "gradient") return b.radius;
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
    default:
      return undefined;
  }
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
    default:
      return { background: fill };
  }
}

/** how many paints the body itself carries — 1 for an ordinary plate, 2 for a gradient layer */
export const platePaintLayers = (b: BannerSettings): number => (BANNER_SHAPE_FAMILY[b.shape] === "gradient" && b.shape !== "gradStack" ? 2 : 1);

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
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** The dominant colour of a gradient (first stop) — used for glows/halos. */
export const baseColor = (g: Gradient, fallback: string) => (g.enabled && g.stops[0] ? g.stops[0].color : fallback);

export interface BannerCss {
  /** the plate's body — fill, corners, silhouette and its own transparency */
  box: React.CSSProperties;
  /**
   * The plate's own extra layers — the multilayer silhouettes (stacked plates,
   * double frame, accent block, offset outline, long shadow) and the stacked
   * gradient plate. They are painted **behind** `box` and **under** the
   * heading, in the order given, and they fade with the shape's own
   * transparency. Empty for every single-body silhouette.
   */
  layers: React.CSSProperties[];
  /**
   * the outline, on a layer of its own: its transparency is the Border
   * transparency, so it fades without taking the fill down with it
   */
  border?: React.CSSProperties;
  /** extra glow layer under the box, optional */
  halo?: React.CSSProperties;
  /** styles applied to the title text */
  text: React.CSSProperties;
  /** inner padding on the title wrapper so the banner fits around the text */
  padding: string;
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
  const fill = gradientCss(b.gradient, b.color);
  const base = baseColor(b.gradient, b.color);
  const shapeOpacity = clampOpacity(b.opacity);
  const radius = plateRadius(b);
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
      const stops = b.gradient.enabled ? gradientCss({ ...b.gradient, type: "linear" }, b.color) : undefined;
      box = {
        ...common,
        ...plateRect(b),
        background: stops
          ? `${stops}`
          : `radial-gradient(${GLOW_ELLIPSE}, ${base} 0%, ${withAlpha(base, 0.75)} ${inner}%, ${withAlpha(base, 0)} ${outer}%)`,
        // when a gradient is used we fade it with a mask instead so the colours still show
        WebkitMaskImage: stops
          ? `radial-gradient(${GLOW_ELLIPSE}, #000 0%, rgba(0,0,0,.8) ${inner}%, transparent ${outer}%)`
          : undefined,
        maskImage: stops
          ? `radial-gradient(${GLOW_ELLIPSE}, #000 0%, rgba(0,0,0,.8) ${inner}%, transparent ${outer}%)`
          : undefined,
      };
      break;
    }
    case "underline":
      box = { ...common, ...ruleRect(b), background: fill, borderRadius: 999 };
      break;
    default: {
      /**
       * Every other silhouette — the plates (pill · rounded · box), the stylish
       * cuts (ribbon · hexagon · cut corners · chevron · swallowtail · slant ·
       * tab · arch), the multilayer plates and the multilayer gradient plates —
       * is one body on the plate's own box, and they differ in three channels
       * only: the corners (`plateRadius`), the cut (`plateClipPath`) and the
       * paint (`platePaint`, one fill or a stack of gradients).
       */
      box = {
        ...common,
        ...plateRect(b),
        ...platePaint(b, fill),
        borderRadius: radius,
        clipPath: plateClipPath(b),
        // the double frame keeps a hairline inside itself and the long-shadow
        // plate its own soft fall — both on the body, so neither fights the
        // outline's own layer
        boxShadow:
          b.shape === "frame"
            ? `inset 0 0 0 2px ${withAlpha(shade(base, 0.7), 0.42)}`
            : b.shape === "longShadow"
              ? "0 12px 28px -14px rgba(0,0,0,.65)"
              : undefined,
      };
    }
  }

  /**
   * The plate's own extra layers — empty for a single-body silhouette, two or
   * three painted plates for the multilayer ones. They sit behind the body, so
   * the body's paint and its outline always win.
   */
  const layers = b.shape === "none" ? [] : bannerLayers(b, base);

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
   */
  const borderLine: React.CSSProperties | undefined = bannerHasLine(b)
    ? {
        ...common,
        ...(b.shape === "underline" ? ruleRect(b) : plateRect(b)),
        border: `${b.border.width}px ${bannerBorderStyle(b)} ${withAlpha(b.border.color, clampOpacity(b.border.opacity))}`,
        borderRadius: radius,
        boxSizing: "border-box",
        // the outline follows the cut silhouette — the ribbon's notch, the
        // hexagon's tips, the chevron's arrow — not a rectangle around it
        clipPath: plateClipPath(b),
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
  return { box, layers, border: borderLine, halo, text, padding: "6px 0" };
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
  const h = Math.round(BANNER_AUTO_FRAME_HEIGHT * (1 + (2 * b.padY) / 100));
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
