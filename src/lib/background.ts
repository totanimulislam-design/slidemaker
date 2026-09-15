import type { CSSProperties } from "react";
import type { BackgroundSettings, Deck, Gradient, SlideData } from "./types";
import { DEFAULT_BACKGROUND } from "./types";
import { gradientCss } from "./banner";
import { withAlpha } from "./color";
import { effectiveTheme } from "./overrides";
import { designLayer } from "./backgroundDesigns";

/**
 * Fills in every field a saved background may be missing (decks stored before
 * the design layer, radial centre or mesh gradients existed) so old designs
 * keep rendering exactly as before.
 */
export function normalizeGradient(g: Gradient | undefined): Gradient {
  const base = DEFAULT_BACKGROUND.gradient;
  if (!g) return { ...base, stops: base.stops.map((s) => ({ ...s })) };
  const stops = g.stops?.length
    ? g.stops.map((s) => ({ color: s.color || "#ffffff", at: Math.max(0, Math.min(100, s.at ?? 0)) }))
    : base.stops.map((s) => ({ ...s }));
  return {
    enabled: !!g.enabled,
    type: g.type === "radial" || g.type === "mesh" ? g.type : "linear",
    angle: Number.isFinite(g.angle) ? g.angle : base.angle,
    stops,
    cx: Number.isFinite(g.cx) ? g.cx : 50,
    cy: Number.isFinite(g.cy) ? g.cy : 50,
  };
}

export function normalizeBackground(b: Partial<BackgroundSettings> | undefined): BackgroundSettings {
  return {
    ...DEFAULT_BACKGROUND,
    ...b,
    gradient: normalizeGradient(b?.gradient),
    overlay: { ...DEFAULT_BACKGROUND.overlay, ...(b?.overlay ?? {}) },
    design: b?.design ?? "",
    designW: Number.isFinite(b?.designW) ? b!.designW : 100,
    designH: Number.isFinite(b?.designH) ? b!.designH : 100,
    designOpacity: Number.isFinite(b?.designOpacity) ? b!.designOpacity : 1,
  };
}

/** The background that applies to a slide: its own override, else the deck's. */
export function effectiveBackground(deck: Deck, slide: SlideData | undefined): BackgroundSettings {
  const themeBg = effectiveTheme(deck, slide).background;
  return normalizeBackground({ ...themeBg, ...(slide?.background ?? {}) });
}

export const hasBackground = (b: BackgroundSettings) => !!b.src || !!b.design || b.gradient.enabled;

/**
 * Layered CSS for the board background:
 *   [gradient] → [vector design] → [image] → [overlay tint] → [vignette]
 * Everything is inline so exports render identically.
 */
export function backgroundLayers(b: BackgroundSettings, boardColor: string): CSSProperties[] {
  const layers: CSSProperties[] = [];
  const common: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

  if (b.gradient.enabled) layers.push({ ...common, background: gradientCss(b.gradient, boardColor) });

  const art = designLayer(b.design, b.designW, b.designH, b.designOpacity);
  if (art) layers.push(art);

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

/** Image treatments — applied on top of whatever image is set. */
export const IMAGE_TREATMENTS: { name: string; bg: Partial<BackgroundSettings> }[] = [
  { name: "Clear", bg: { opacity: 1, blur: 0, overlay: { enabled: false, color: "#000000", opacity: 0.35 }, vignette: 0 } },
  { name: "Dimmed", bg: { opacity: 1, blur: 0, overlay: { enabled: true, color: "#000000", opacity: 0.45 }, vignette: 20 } },
  { name: "Soft blur", bg: { opacity: 1, blur: 6, overlay: { enabled: true, color: "#000000", opacity: 0.3 }, vignette: 30 } },
  { name: "Faded", bg: { opacity: 0.35, blur: 0, overlay: { enabled: false, color: "#000000", opacity: 0.35 }, vignette: 0 } },
  { name: "Blue tint", bg: { opacity: 1, blur: 2, overlay: { enabled: true, color: "#0f2a6b", opacity: 0.55 }, vignette: 25 } },
];
