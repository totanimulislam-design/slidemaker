import type { BannerSettings, Gradient } from "./types";
import { withAlpha } from "./color";

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
  /** the box behind the title (absolute inside the title wrapper) */
  box: React.CSSProperties;
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
 */
export function bannerCss(b: BannerSettings, titleColor: string): BannerCss {
  const fill = gradientCss(b.gradient, b.color);
  const base = baseColor(b.gradient, b.color);
  const common: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    opacity: b.opacity,
  };
  const border = b.border.enabled ? `${b.border.width}px solid ${b.border.color}` : undefined;

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
      const stops = b.gradient.enabled
        ? gradientCss({ ...b.gradient, type: "linear" }, b.color)
        : undefined;
      box = {
        ...common,
        inset: `-${b.padY}% -${b.padX}%`,
        background: stops
          ? `${stops}`
          : `radial-gradient(ellipse 52% 58% at 50% 50%, ${base} 0%, ${withAlpha(base, 0.75)} ${inner}%, ${withAlpha(base, 0)} ${outer}%)`,
        // when a gradient is used we fade it with a mask instead so the colours still show
        WebkitMaskImage: stops
          ? `radial-gradient(ellipse 52% 58% at 50% 50%, #000 0%, rgba(0,0,0,.8) ${inner}%, transparent ${outer}%)`
          : undefined,
        maskImage: stops
          ? `radial-gradient(ellipse 52% 58% at 50% 50%, #000 0%, rgba(0,0,0,.8) ${inner}%, transparent ${outer}%)`
          : undefined,
      };
      break;
    }
    case "pill":
      box = { ...common, inset: `-${b.padY}% -${b.padX}%`, background: fill, borderRadius: 999, border };
      break;
    case "rounded":
      box = { ...common, inset: `-${b.padY}% -${b.padX}%`, background: fill, borderRadius: b.radius, border };
      break;
    case "rect":
      box = { ...common, inset: `-${b.padY}% -${b.padX}%`, background: fill, border };
      break;
    case "ribbon":
      box = {
        ...common,
        inset: `-${b.padY}% -${b.padX}%`,
        background: fill,
        border,
        clipPath: "polygon(0 0, 100% 0, calc(100% - 22px) 50%, 100% 100%, 0 100%, 22px 50%)",
      };
      break;
    case "underline":
      box = {
        ...common,
        left: `-${b.padX}%`,
        right: `-${b.padX}%`,
        bottom: `-${Math.max(4, b.padY / 3)}%`,
        height: Math.max(4, b.radius / 2),
        background: fill,
        borderRadius: 999,
      };
      break;
  }

  const halo: React.CSSProperties | undefined =
    b.halo > 0 && b.shape !== "none"
      ? {
          position: "absolute",
          inset: `-${b.padY + b.halo * 0.6}% -${b.padX + b.halo * 0.25}%`,
          background: `radial-gradient(ellipse at center, ${withAlpha(base, 0.55 * (b.halo / 100) + 0.15)} 0%, ${withAlpha(base, 0)} 70%)`,
          filter: `blur(${4 + b.halo * 0.3}px)`,
          pointerEvents: "none",
        }
      : undefined;

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

  return { box, halo, text, padding: "10px 0" };
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
      opacity: 1, padX: 7, padY: 20, halo: 20,
    },
  },
  {
    name: "Gold ribbon",
    swatch: "linear-gradient(180deg,#ffd35a,#b8860b)",
    banner: {
      shape: "ribbon",
      gradient: { enabled: true, type: "linear", angle: 180, stops: [{ color: "#ffd35a", at: 0 }, { color: "#e0a800", at: 55 }, { color: "#b8860b", at: 100 }] },
      opacity: 1, padX: 9, padY: 22, halo: 15,
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
      opacity: 0.95, padX: 6, padY: 22, halo: 45,
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
      padX: 8, padY: 20, halo: 30,
    },
  },
  {
    name: "Underline",
    swatch: "linear-gradient(90deg,transparent 0 40%,#ffd633 40% 60%,transparent 60%)",
    banner: { shape: "underline", color: "#ffd633", radius: 14, padX: 2, padY: 20, halo: 0, gradient: { ...DEFAULT_GRADIENT(), enabled: false } },
  },
  {
    name: "Minimal (none)",
    swatch: "transparent",
    banner: { shape: "none", halo: 0 },
  },
];

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
