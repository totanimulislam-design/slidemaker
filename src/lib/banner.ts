import { BANNER_AUTO_FRAME_HEIGHT, type BannerBorderStyle, type BannerSettings, type Gradient } from "./types";
import { withAlpha } from "./color";

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

/** the plate's box — free when the teacher sized it, else the title frame's own room */
export function plateRect(b: BannerSettings): Pick<React.CSSProperties, "left" | "top" | "width" | "height"> {
  const x = b.pos?.x ?? 0;
  const y = b.pos?.y ?? 0;
  const w = b.size?.w;
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

/** the plate's corner radius for the silhouette in use */
export function plateRadius(b: BannerSettings): number | undefined {
  if (b.shape === "pill") return 999;
  if (b.shape === "rounded" || b.shape === "glow") return b.radius;
  if (b.shape === "underline") return 999;
  return undefined;
}

/**
 * The glow's reach inside the plate's own box. The plate is a wide, flat chip,
 * so the light is an oval a touch wider than it is tall — and because it is
 * written in % of the plate, it keeps that proportion at any size.
 */
export const GLOW_ELLIPSE = "ellipse 56% 62% at 50% 50%";

/**
 * How deep the ribbon's ends are cut in, in px of the board. The plate is a
 * tight chip now, so the notch is cut to match — and once the teacher has sized
 * the plate by hand the cut follows the height instead of holding a fixed
 * depth, so a short plate still reads as a ribbon and not as an arrow.
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

/** the rule under the title (the "underline" silhouette) has a shape of its own */
function ruleRect(b: BannerSettings): Pick<React.CSSProperties, "left" | "bottom" | "width" | "height"> {
  const x = b.pos?.x ?? 0;
  const y = b.pos?.y ?? 0;
  const w = b.size?.w;
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
    case "ribbon":
      box = {
        ...common,
        ...plateRect(b),
        background: fill,
        clipPath: ribbonClipPath(b),
      };
      break;
    case "underline":
      box = { ...common, ...ruleRect(b), background: fill, borderRadius: 999 };
      break;
    default:
      // pill · rounded · box: one body, differing only in the corners
      box = { ...common, ...plateRect(b), background: fill, borderRadius: radius };
  }

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
        clipPath: b.shape === "ribbon" ? ribbonClipPath(b) : undefined,
      }
    : undefined;

  // the shape's transparency paints the body (and its own glow), never the line
  if (b.shape !== "none") {
    box.opacity = shapeOpacity;
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
  return { box, border: borderLine, halo, text, padding: "6px 0" };
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
 * canvas when it can be measured, an estimate from the title's own box else.
 */
export function bannerSizeNow(b: BannerSettings, titleSize = 54, titleWidthPct = 57): { w: number; h: number } {
  const measured = measureBannerPlate();
  if (measured) return measured;
  // no canvas to measure — automatic plates use the title element's stable
  // frame, not the current glyph metrics. Keep this fallback in sync with the
  // editor so the size panel does not jump when the title size changes.
  void titleSize;
  const frameW = Math.round((BOARD_W * titleWidthPct) / 100);
  const w = Math.round(frameW * (1 + (2 * b.padX) / 100));
  const h = Math.round(BANNER_AUTO_FRAME_HEIGHT * (1 + (2 * b.padY) / 100));
  return { w: Math.max(40, w), h: Math.max(24, h) };
}

/* ------------------------------------------------------------ presets */

export interface BannerPreset {
  name: string;
  swatch: string;
  banner: Partial<BannerSettings>;
}

export const BANNER_PRESETS: BannerPreset[] = [
  {
    name: "Classic glow",
    swatch: "radial-gradient(circle, #1f5fd0, transparent 70%)",
    banner: { shape: "glow", color: "#1f5fd0", glow: 65, halo: 0, gradient: { ...DEFAULT_GRADIENT(), enabled: false } },
  },
  {
    name: "Royal blue pill",
    swatch: "linear-gradient(90deg,#0f3fb8,#3b7bff)",
    banner: {
      shape: "pill",
      gradient: { enabled: true, type: "linear", angle: 90, stops: [{ color: "#0f3fb8", at: 0 }, { color: "#3b7bff", at: 100 }] },
      opacity: 1, padX: 4, padY: 11, halo: 20,
    },
  },
  {
    name: "Gold ribbon",
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
    swatch: "linear-gradient(90deg,#f97316,#ec4899)",
    banner: {
      shape: "pill",
      gradient: { enabled: true, type: "linear", angle: 90, stops: [{ color: "#f97316", at: 0 }, { color: "#ec4899", at: 100 }] },
      padX: 4, padY: 11, halo: 30,
    },
  },
  {
    name: "Underline",
    swatch: "linear-gradient(90deg,transparent 0 40%,#ffd633 40% 60%,transparent 60%)",
    banner: { shape: "underline", color: "#ffd633", radius: 14, padX: 1, padY: 11, halo: 0, gradient: { ...DEFAULT_GRADIENT(), enabled: false } },
  },
  {
    name: "Minimal (none)",
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
 */
export function bannerPresetPatch(
  current: BannerSettings,
  preset: BannerPreset,
): Partial<BannerSettings> {
  return { ...JSON.parse(JSON.stringify(current)) as BannerSettings, size: undefined, pos: undefined, ...preset.banner };
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
