import type { CSSProperties } from "react";
import type { ShapeEffectKind, ThemeSettings } from "./types";
import {
  effectColorFor,
  shapeEffectPasses,
  type ShapeEffectBehind,
  type ShapeEffectDef,
  type ShapeEffectGroup,
} from "./shapeEffects";

/**
 * Shape effects for the question marker — the whole set the big design tools
 * ship for an object, in the groups a picker browses them by.
 *
 *   Shadow           drop, lift, float, pop (hard offset), long, perspective, inner
 *   Glow & light     glow, halo, neon, inner glow, spotlight, gloss, sheen
 *   3-D & depth      bevel, emboss, 3-D rotation, material, reflection
 *   Texture & fill   stripes, dots, grid, checker, frosted glass
 *   Edge & fade      soft edges, blur, fade →, fade edges
 *   Sticker & edge   sticker outline, ring, offset outline, paper stack,
 *                    top / bottom / left bar, folded corner
 *
 * The CSS each one needs comes from the shared engine (`lib/shapeEffects`), so
 * the marker's "Neon" and a text plate's "Neon" are the same effect. Everything
 * lands on the marker's **body** layer — the number keeps its own effects under
 * *Q bullet text*.
 */

export const BULLET_EFFECT_GROUPS: ShapeEffectGroup[] = [
  "Shadow",
  "Glow & light",
  "3-D & depth",
  "Texture & fill",
  "Edge & fade",
  "Sticker & outline",
];

export const BULLET_EFFECTS: ShapeEffectDef[] = [
  { id: "none", label: "None", hint: "The design's own look", color: false, auto: "dark", group: "Shadow" },

  /* ------------------------------------------------------------- shadow -- */
  { id: "shadow", label: "Shadow", hint: "A soft shadow below the marker", color: true, auto: "dark", group: "Shadow" },
  { id: "lift", label: "Lift", hint: "A subtle shadow — the marker floats a little", color: false, auto: "dark", group: "Shadow" },
  { id: "float", label: "Float", hint: "A large soft shadow far below", color: false, auto: "dark", group: "Shadow" },
  { id: "pop", label: "Pop", hint: "A hard offset shadow — comic / sticker look", color: true, auto: "dark", group: "Shadow" },
  { id: "longShadow", label: "Long shadow", hint: "A flat stepped shadow (material style)", color: true, auto: "dark", group: "Shadow" },
  { id: "perspective", label: "Perspective", hint: "A shadow thrown towards the viewer", color: true, auto: "dark", group: "Shadow" },
  { id: "innerShadow", label: "Inner shadow", hint: "The marker looks pressed in", color: false, auto: "dark", group: "Shadow" },

  /* --------------------------------------------------------- glow & light -- */
  { id: "glow", label: "Glow", hint: "A tight glow around the marker", color: true, auto: "plate", group: "Glow & light" },
  { id: "halo", label: "Halo", hint: "A wide, soft glow", color: true, auto: "plate", group: "Glow & light" },
  { id: "neon", label: "Neon", hint: "A neon tube: bright edge, coloured glow", color: true, auto: "plate", group: "Glow & light" },
  { id: "innerGlow", label: "Inner glow", hint: "A glow inside the marker's edge", color: true, auto: "light", group: "Glow & light" },
  { id: "spotlight", label: "Spotlight", hint: "A soft light in the middle", color: false, auto: "light", group: "Glow & light" },
  { id: "gloss", label: "Gloss", hint: "A glossy highlight over the top half", color: false, auto: "light", group: "Glow & light" },
  { id: "sheen", label: "Sheen", hint: "A diagonal light streak", color: false, auto: "light", group: "Glow & light" },

  /* ---------------------------------------------------------- 3-D & depth -- */
  { id: "bevel", label: "Bevel", hint: "Light top-left edge, dark bottom-right edge", color: false, auto: "dark", group: "3-D & depth" },
  { id: "emboss", label: "Emboss", hint: "A raised marker with a highlight and a lip", color: false, auto: "dark", group: "3-D & depth" },
  { id: "threeD", label: "3-D rotation", hint: "Tilted in perspective, with an extruded lip", color: true, auto: "dark", group: "3-D & depth" },
  { id: "material", label: "Material", hint: "A layered plastic / metal face", color: true, auto: "dark", group: "3-D & depth" },
  { id: "reflection", label: "Reflection", hint: "A mirrored copy fading below the marker", color: false, auto: "dark", group: "3-D & depth" },

  /* --------------------------------------------------------- texture & fill -- */
  { id: "stripes", label: "Stripes", hint: "Diagonal stripes over the marker", color: true, auto: "light", group: "Texture & fill" },
  { id: "dots", label: "Dots", hint: "A polka-dot pattern", color: true, auto: "light", group: "Texture & fill" },
  { id: "grid", label: "Grid", hint: "Graph-paper lines", color: true, auto: "light", group: "Texture & fill" },
  { id: "checker", label: "Checker", hint: "A checkerboard pattern", color: true, auto: "light", group: "Texture & fill" },
  { id: "glass", label: "Glass", hint: "Frosted glass: blurred backdrop, light rim", color: false, auto: "light", group: "Texture & fill" },

  /* ------------------------------------------------------------ edge & fade -- */
  { id: "softEdges", label: "Soft edges", hint: "The silhouette's edge feathered away", color: false, auto: "dark", group: "Edge & fade" },
  { id: "blur", label: "Blur", hint: "The marker blurred into a soft blob", color: false, auto: "dark", group: "Edge & fade" },
  { id: "fadeRight", label: "Fade →", hint: "The marker fades out to the right", color: false, auto: "dark", group: "Edge & fade" },
  { id: "fadeEdges", label: "Fade edges", hint: "The marker fades out at both ends", color: false, auto: "dark", group: "Edge & fade" },

  /* ------------------------------------------------------- sticker & outline -- */
  { id: "sticker", label: "Sticker", hint: "A thick pale outline all round (die-cut sticker)", color: true, auto: "light", group: "Sticker & outline" },
  { id: "ring", label: "Ring", hint: "A thin outline ring outside the marker", color: true, auto: "plate", group: "Sticker & outline" },
  { id: "offsetOutline", label: "Offset outline", hint: "An outline copy shifted down-right", color: true, auto: "light", group: "Sticker & outline" },
  { id: "stack", label: "Stack", hint: "Two paper copies stacked behind", color: true, auto: "plate", group: "Sticker & outline" },
  { id: "topBar", label: "Top bar", hint: "An accent strip along the top edge", color: true, auto: "light", group: "Sticker & outline" },
  { id: "bottomBar", label: "Bottom bar", hint: "An accent strip along the bottom edge", color: true, auto: "light", group: "Sticker & outline" },
  { id: "leftBar", label: "Left bar", hint: "An accent strip along the left edge", color: true, auto: "light", group: "Sticker & outline" },
  { id: "cornerFold", label: "Corner fold", hint: "A folded top-right corner (sticky note)", color: false, auto: "dark", group: "Sticker & outline" },
];

export const BULLET_EFFECT_BY_ID = new Map<ShapeEffectKind, ShapeEffectDef>(BULLET_EFFECTS.map((e) => [e.id, e]));

export const bulletEffectDef = (kind: ShapeEffectKind | undefined): ShapeEffectDef =>
  BULLET_EFFECT_BY_ID.get(kind ?? "none") ?? BULLET_EFFECTS[0];

/** is an effect switched on at all? */
export const bulletEffectIsOn = (kind: ShapeEffectKind | undefined): boolean => !!kind && kind !== "none";

/** the colour an effect paints with — its own, else the marker's paint / a light / a dark tone */
export function bulletEffectColor(theme: ThemeSettings, accent: string, plate: string): string {
  const def = bulletEffectDef(theme.bulletEffect);
  const border = typeof theme.bulletBorder === "string" && theme.bulletBorder.startsWith("#") ? theme.bulletBorder : undefined;
  return effectColorFor(def.id, def.auto, theme.bulletEffectColor, plate || accent, border);
}

/** the CSS passes of the marker's effect, ready for `NumberBullet` to paint */
export interface BulletEffectPaint {
  /** filter · mask · transform on the body layer */
  layer?: CSSProperties;
  /** extra CSS merged into the body itself (the frosted-glass backdrop blur) */
  surface?: CSSProperties;
  /** a pass painted INSIDE the silhouette */
  overlay?: CSSProperties;
  /** extra silhouettes painted under the body (ring · offset outline · stack) */
  behind: ShapeEffectBehind[];
  /** a mirrored copy under the marker (the reflection pass) */
  reflection?: CSSProperties;
}

/**
 * One marker's effect passes. `height` is the marker's own box height in px —
 * the reflection and the 3-D tilt scale with it, so a 24 px marker in a
 * thumbnail and a 96 px one on the board wear the same look.
 */
export function bulletEffectPaint(
  theme: ThemeSettings,
  size: number,
  accent: string,
  plate: string,
  height: number,
): BulletEffectPaint | undefined {
  const kind = theme.bulletEffect;
  if (!bulletEffectIsOn(kind)) return undefined;
  const intensity = theme.bulletEffectIntensity ?? 50;
  const fx = bulletEffectColor(theme, accent, plate);
  const passes = shapeEffectPasses(kind as ShapeEffectKind, intensity, fx, plate || accent, Math.max(size, height));
  if (!passes.filters.length && !passes.overlay && !passes.backdrop && !passes.mask && !passes.transform && !passes.behind.length && !passes.reflection) {
    return undefined;
  }

  const layer: CSSProperties = {};
  if (passes.filters.length) layer.filter = passes.filters.join(" ");
  if (passes.mask) {
    layer.maskImage = passes.mask;
    (layer as Record<string, unknown>).WebkitMaskImage = passes.mask;
  }
  if (passes.transform) layer.transform = passes.transform;

  let reflection: CSSProperties | undefined;
  if (passes.reflection) {
    const r = passes.reflection;
    const gap = r.gap;
    reflection = {
      position: "absolute",
      left: 0,
      right: 0,
      top: `calc(100% + ${gap}px)`,
      height: `${Math.round(height)}px`,
      transform: "scaleY(-1)",
      opacity: r.opacity,
      filter: r.blur ? `blur(${r.blur}px)` : undefined,
      maskImage: `linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.35) ${Math.round(r.size * 0.5)}%, transparent ${Math.round(r.size)}%)`,
      pointerEvents: "none",
    };
    (reflection as Record<string, unknown>).WebkitMaskImage = reflection.maskImage;
  }

  const surface: CSSProperties | undefined = passes.backdrop
    ? { backdropFilter: passes.backdrop, ...(passes.backdrop ? { WebkitBackdropFilter: passes.backdrop } : {}) }
    : undefined;

  return {
    layer: Object.keys(layer).length ? layer : undefined,
    surface,
    overlay: passes.overlay,
    behind: passes.behind,
    reflection,
  };
}
