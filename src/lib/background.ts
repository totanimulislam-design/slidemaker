import type { CSSProperties } from "react";
import type { BackgroundSettings, Deck, SlideData } from "./types";
import { DEFAULT_BACKGROUND } from "./types";
import { gradientCss } from "./banner";
import { withAlpha } from "./color";
import { effectiveTheme } from "./overrides";

/** The background that applies to a slide: its own override, else the deck's. */
export function effectiveBackground(deck: Deck, slide: SlideData | undefined): BackgroundSettings {
  const base = { ...DEFAULT_BACKGROUND, ...(effectiveTheme(deck, slide).background ?? {}) };
  return slide?.background ? { ...base, ...slide.background } : base;
}

export const hasBackground = (b: BackgroundSettings) => !!b.src || b.gradient.enabled;

/**
 * Layered CSS for the board background:
 *   [gradient] → [image] → [overlay tint] → [vignette]
 * Everything is inline so exports render identically.
 */
export function backgroundLayers(b: BackgroundSettings, boardColor: string): CSSProperties[] {
  const layers: CSSProperties[] = [];
  const common: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

  if (b.gradient.enabled) layers.push({ ...common, background: gradientCss(b.gradient, boardColor) });

  if (b.src) {
    const zoom = b.fit === "cover" ? 1 + b.zoom / 100 : 1;
    const size =
      b.fit === "cover" ? `${100 * zoom}% auto`
      : b.fit === "contain" ? "contain"
      : b.fit === "stretch" ? "100% 100%"
      : "auto";
    layers.push({
      ...common,
      backgroundImage: `url("${b.src}")`,
      backgroundRepeat: b.fit === "tile" ? "repeat" : "no-repeat",
      backgroundPosition: `${b.posX}% ${b.posY}%`,
      backgroundSize: b.fit === "cover" ? "cover" : size,
      transform: `${b.flipH ? "scaleX(-1) " : ""}${b.fit === "cover" && b.zoom ? `scale(${zoom})` : ""}`.trim() || undefined,
      transformOrigin: `${b.posX}% ${b.posY}%`,
      opacity: b.opacity,
      filter: b.blur ? `blur(${b.blur}px)` : undefined,
      // blur bleeds transparent edges; overscan hides them
      inset: b.blur ? -b.blur * 2 : 0,
    });
  }

  if (b.overlay.enabled && b.overlay.opacity > 0) {
    layers.push({ ...common, background: withAlpha(b.overlay.color, b.overlay.opacity) });
  }

  if (b.vignette > 0) {
    layers.push({
      ...common,
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${Math.max(20, 75 - b.vignette * 0.4)}%, rgba(0,0,0,${(b.vignette / 100) * 0.85}) 100%)`,
    });
  }
  return layers;
}

/* ------------------------------------------------------------- presets */

export interface BackgroundPreset {
  name: string;
  swatch: string;
  bg: Partial<BackgroundSettings>;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { name: "Board only", swatch: "#050507", bg: { src: "", gradient: { ...DEFAULT_BACKGROUND.gradient, enabled: false }, overlay: { ...DEFAULT_BACKGROUND.overlay, enabled: false }, vignette: 0 } },
  { name: "Night sky", swatch: "linear-gradient(180deg,#0b1226,#050507)", bg: { gradient: { enabled: true, type: "linear", angle: 180, stops: [{ color: "#0b1226", at: 0 }, { color: "#050507", at: 100 }] } } },
  { name: "Deep green", swatch: "linear-gradient(160deg,#0f3d2e,#06140f)", bg: { gradient: { enabled: true, type: "linear", angle: 160, stops: [{ color: "#0f3d2e", at: 0 }, { color: "#06140f", at: 100 }] } } },
  { name: "Royal", swatch: "linear-gradient(135deg,#2a0a3d,#0b0620)", bg: { gradient: { enabled: true, type: "linear", angle: 135, stops: [{ color: "#2a0a3d", at: 0 }, { color: "#0b0620", at: 100 }] } } },
  { name: "Spotlight", swatch: "radial-gradient(circle,#1e293b,#020617)", bg: { gradient: { enabled: true, type: "radial", angle: 0, stops: [{ color: "#1e293b", at: 0 }, { color: "#020617", at: 100 }] } } },
  { name: "Paper", swatch: "linear-gradient(180deg,#fdfaf3,#efe7d6)", bg: { gradient: { enabled: true, type: "linear", angle: 180, stops: [{ color: "#fdfaf3", at: 0 }, { color: "#efe7d6", at: 100 }] } } },
];

/** Image treatments — applied on top of whatever image is set. */
export const IMAGE_TREATMENTS: { name: string; bg: Partial<BackgroundSettings> }[] = [
  { name: "Clear", bg: { opacity: 1, blur: 0, overlay: { enabled: false, color: "#000000", opacity: 0.35 }, vignette: 0 } },
  { name: "Dimmed", bg: { opacity: 1, blur: 0, overlay: { enabled: true, color: "#000000", opacity: 0.45 }, vignette: 20 } },
  { name: "Soft blur", bg: { opacity: 1, blur: 6, overlay: { enabled: true, color: "#000000", opacity: 0.3 }, vignette: 30 } },
  { name: "Faded", bg: { opacity: 0.35, blur: 0, overlay: { enabled: false, color: "#000000", opacity: 0.35 }, vignette: 0 } },
  { name: "Blue tint", bg: { opacity: 1, blur: 2, overlay: { enabled: true, color: "#0f2a6b", opacity: 0.55 }, vignette: 25 } },
];
