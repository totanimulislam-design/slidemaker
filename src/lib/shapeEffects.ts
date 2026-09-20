import type { CSSProperties } from "react";
import type { ShapeEffectKind } from "./types";
import { parseColor } from "./textEffects";

export type { ShapeEffectKind } from "./types";

/**
 * The shape-effect engine every painted surface shares.
 *
 * One vocabulary of effects — the drop shadows, glows, bevels, glosses,
 * patterns, fades and sticker outlines the big design tools ship — turned into
 * plain CSS passes, so a text plate and a question marker paint the *same*
 * "Pop" or the same "Neon" instead of two approximations of it.
 *
 * An effect never owns a whole element: it hands back the passes a renderer
 * applies to the layers it already has.
 *
 *   filters     `filter` of the layer that carries the silhouette (drop-shadows,
 *               blurs — outside the clip, so they are never cut away)
 *   overlay     a pass painted INSIDE the silhouette (inner shadows, gloss,
 *               patterns, bars, a folded corner)
 *   backdrop    `backdrop-filter` of the fill pass (frosted glass)
 *   mask        `mask-image` of the layer (fades, soft edges)
 *   transform   an extra transform for the layer (3-D rotation)
 *   behind      extra silhouettes painted under the shape (ring, offset
 *               outline, paper stack)
 *   reflection  a mirrored copy under the shape (the reflection effect)
 *
 * Every pass is a pure function of (effect, intensity, effect colour, the
 * shape's own colour) plus the shape's size in px, so the board, the
 * thumbnails, the pickers and the PNG / PDF export all agree.
 */

/** what the effect's colour falls back to when none is picked */
export type ShapeEffectAuto = "dark" | "light" | "plate";

export interface ShapeEffectDef {
  id: ShapeEffectKind;
  label: string;
  hint: string;
  /** whether the effect has a colour of its own */
  color: boolean;
  auto: ShapeEffectAuto;
  /** which family the effect belongs to (the pickers group by it) */
  group: ShapeEffectGroup;
}

export type ShapeEffectGroup = "Shadow" | "Glow & light" | "3-D & depth" | "Texture & fill" | "Edge & fade" | "Sticker & outline";

/** a silhouette painted behind the shape by an effect (ring · offset outline · stack) */
export interface ShapeEffectBehind {
  /** where it sits relative to the shape's layer */
  css: CSSProperties;
  /** solid fill; "" = outline only */
  fill: string;
  /** outline colour; "" = none */
  stroke: string;
  strokeWidth: number;
}

/** a mirrored copy under the shape — the reflection pass */
export interface ShapeEffectReflection {
  /** gap between the shape and its reflection, px */
  gap: number;
  /** how much of the shape's height the reflection covers, % */
  size: number;
  /** 0–1, the reflection's own fade */
  opacity: number;
  /** px */
  blur: number;
}

export interface ShapeEffectPasses {
  filters: string[];
  overlay?: CSSProperties;
  backdrop?: string;
  mask?: string;
  transform?: string;
  behind: ShapeEffectBehind[];
  reflection?: ShapeEffectReflection;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n * 100) / 100;

/** rgba() of any colour we can parse (hex / rgb); the colour itself otherwise */
export function bgAlpha(color: string, a: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${round(clamp(a, 0, 1))})`;
}

/** the colour an effect paints with — its own, else the shape's / a light / a dark tone */
export function effectColorFor(kind: ShapeEffectKind, auto: ShapeEffectAuto, picked: string | undefined, plate: string, border?: string): string {
  if (picked) return picked;
  switch (auto) {
    case "plate":
      return kind === "neon" && border ? border : plate;
    case "light":
      return "#ffffff";
    default:
      return "#000000";
  }
}

/**
 * Every CSS pass one effect needs. `size` is the shape's own box in px — the
 * marker-only passes (reflection, soft edges, 3-D) scale with it, and the
 * plate passes fall back to fixed px when the caller has no size to give.
 */
export function shapeEffectPasses(
  kind: ShapeEffectKind,
  intensity: number,
  fx: string,
  plate: string,
  size = 0,
): ShapeEffectPasses {
  const i = clamp(intensity, 0, 100) / 100;
  const filters: string[] = [];
  const behind: ShapeEffectBehind[] = [];
  let overlay: CSSProperties | undefined;
  let backdrop: string | undefined;
  let mask: string | undefined;
  let transform: string | undefined;
  let reflection: ShapeEffectReflection | undefined;

  switch (kind) {
    case "shadow":
      filters.push(`drop-shadow(0 ${round(2 + 8 * i)}px ${round(4 + 16 * i)}px ${bgAlpha(fx, 0.25 + 0.45 * i)})`);
      break;
    case "perspective":
      /* a shadow thrown towards the viewer: tight under the shape, long at the side */
      filters.push(
        `drop-shadow(0 ${round(2 + 6 * i)}px ${round(2 + 4 * i)}px ${bgAlpha(fx, 0.3 + 0.3 * i)})`,
        `drop-shadow(${round(-(4 + 10 * i))}px ${round(6 + 14 * i)}px ${round(8 + 16 * i)}px ${bgAlpha(fx, 0.18 + 0.24 * i)})`,
      );
      break;
    case "pop": {
      const d = round(3 + 9 * i);
      filters.push(`drop-shadow(${d}px ${d}px 0 ${fx})`);
      break;
    }
    case "lift":
      filters.push(`drop-shadow(0 ${round(1 + 3 * i)}px ${round(2 + 6 * i)}px rgba(0, 0, 0, ${round(0.25 + 0.25 * i)}))`);
      break;
    case "float":
      filters.push(`drop-shadow(0 ${round(10 + 20 * i)}px ${round(14 + 26 * i)}px rgba(0, 0, 0, ${round(0.3 + 0.3 * i)}))`);
      break;
    case "longShadow": {
      const steps = 3 + Math.round(9 * i);
      for (let k = 0; k < steps; k++) filters.push(`drop-shadow(2px 2px 0 ${fx})`);
      break;
    }
    case "reflection": {
      reflection = {
        gap: round(size ? size * (0.02 + 0.05 * i) : 1 + 3 * i),
        size: round(30 + 40 * i),
        opacity: round(0.18 + 0.42 * i),
        blur: round(size ? size * (0.01 + 0.05 * i) : 0.6 + 2.4 * i),
      };
      filters.push(`drop-shadow(0 ${round(1 + 2 * i)}px ${round(2 + 4 * i)}px rgba(0, 0, 0, ${round(0.2 + 0.2 * i)}))`);
      break;
    }
    case "glow":
      filters.push(`drop-shadow(0 0 ${round(4 + 10 * i)}px ${fx})`, `drop-shadow(0 0 ${round(2 + 4 * i)}px ${fx})`);
      break;
    case "halo":
      filters.push(`drop-shadow(0 0 ${round(14 + 26 * i)}px ${bgAlpha(fx, 0.65)})`, `drop-shadow(0 0 ${round(30 + 40 * i)}px ${bgAlpha(fx, 0.4)})`);
      break;
    case "neon":
      filters.push(
        `drop-shadow(0 0 2px rgba(255, 255, 255, 0.85))`,
        `drop-shadow(0 0 ${round(6 + 10 * i)}px ${fx})`,
        `drop-shadow(0 0 ${round(16 + 24 * i)}px ${bgAlpha(fx, 0.8)})`,
      );
      overlay = { boxShadow: `inset 0 0 ${round(8 + 12 * i)}px ${bgAlpha(fx, 0.6)}` };
      break;
    case "innerShadow":
      overlay = { boxShadow: `inset 0 ${round(2 + 6 * i)}px ${round(6 + 14 * i)}px rgba(0, 0, 0, ${round(0.3 + 0.4 * i)})` };
      break;
    case "innerGlow":
      overlay = { boxShadow: `inset 0 0 ${round(8 + 24 * i)}px ${bgAlpha(fx, 0.5 + 0.4 * i)}` };
      break;
    case "bevel": {
      const d = round(1 + 3 * i);
      const b = round(2 + 4 * i);
      overlay = { boxShadow: `inset ${d}px ${d}px ${b}px rgba(255, 255, 255, 0.45), inset -${d}px -${d}px ${b}px rgba(0, 0, 0, 0.45)` };
      break;
    }
    case "emboss": {
      const d = round(2 + 4 * i);
      overlay = { boxShadow: `inset 0 ${d}px 0 rgba(255, 255, 255, 0.35), inset 0 -${d}px 0 rgba(0, 0, 0, 0.35)` };
      filters.push(`drop-shadow(0 ${round(1 + 2 * i)}px ${round(2 + 3 * i)}px rgba(0, 0, 0, 0.35))`);
      break;
    }
    case "material": {
      /* the layered / plastic look: a lit top, a shaded lip and a soft drop */
      const lip = round((size || 24) * (0.06 + 0.14 * i));
      overlay = {
        background: `linear-gradient(180deg, rgba(255, 255, 255, ${round(0.16 + 0.28 * i)}) 0%, rgba(255, 255, 255, 0.05) 46%, rgba(0, 0, 0, 0) 54%, rgba(0, 0, 0, ${round(0.1 + 0.2 * i)}) 100%)`,
        boxShadow: `inset 0 -${lip}px ${round(lip * 1.6)}px rgba(0, 0, 0, ${round(0.18 + 0.22 * i)}), inset 0 ${round(lip * 0.6)}px ${round(lip)}px rgba(255, 255, 255, 0.3)`,
      };
      filters.push(`drop-shadow(0 ${round(2 + 5 * i)}px ${round(4 + 8 * i)}px ${bgAlpha(fx, 0.3 + 0.25 * i)})`);
      break;
    }
    case "threeD": {
      /* 3-D rotation: a perspective tilt, an extruded lip and a lit face */
      const px = round((size || 60) * (4 + 4 * i));
      const rx = round(6 + 14 * i);
      const ry = round(-(5 + 12 * i));
      transform = `perspective(${px}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      const lip = round((size || 24) * (0.05 + 0.12 * i));
      overlay = {
        background: `linear-gradient(160deg, rgba(255, 255, 255, ${round(0.18 + 0.22 * i)}), rgba(255, 255, 255, 0) 55%)`,
        boxShadow: `inset 0 -${lip}px ${round(lip * 1.4)}px rgba(0, 0, 0, ${round(0.22 + 0.28 * i)}), inset ${lip}px 0 ${round(lip * 1.4)}px rgba(0, 0, 0, ${round(0.12 + 0.2 * i)})`,
      };
      filters.push(`drop-shadow(${round(2 + 6 * i)}px ${round(4 + 8 * i)}px ${round(6 + 10 * i)}px ${bgAlpha(fx, 0.35 + 0.3 * i)})`);
      break;
    }
    case "gloss":
      overlay = { background: `linear-gradient(180deg, rgba(255, 255, 255, ${round(0.3 + 0.35 * i)}) 0%, rgba(255, 255, 255, 0.08) 48%, transparent 52%)` };
      break;
    case "sheen":
      overlay = {
        background: `linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, ${round(0.18 + 0.35 * i)}) 45%, rgba(255, 255, 255, ${round(0.22 + 0.4 * i)}) 50%, transparent 65%)`,
      };
      break;
    case "spotlight":
      overlay = { background: `radial-gradient(ellipse at 50% 35%, rgba(255, 255, 255, ${round(0.22 + 0.38 * i)}), transparent 65%)` };
      break;
    case "stripes":
      overlay = { background: `repeating-linear-gradient(135deg, ${bgAlpha(fx, 0.16 + 0.28 * i)} 0 6px, transparent 6px 14px)` };
      break;
    case "dots":
      overlay = { backgroundImage: `radial-gradient(${bgAlpha(fx, 0.25 + 0.4 * i)} 1.4px, transparent 1.7px)`, backgroundSize: "9px 9px" };
      break;
    case "grid":
      overlay = {
        backgroundImage: `linear-gradient(${bgAlpha(fx, 0.16 + 0.24 * i)} 1px, transparent 1px), linear-gradient(90deg, ${bgAlpha(fx, 0.16 + 0.24 * i)} 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
      };
      break;
    case "checker":
      overlay = { background: `repeating-conic-gradient(${bgAlpha(fx, 0.14 + 0.24 * i)} 0% 25%, transparent 0% 50%) 50% / 14px 14px` };
      break;
    case "glass":
      backdrop = `blur(${round(4 + 10 * i)}px)`;
      overlay = {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06))",
        boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, ${round(0.25 + 0.3 * i)})`,
      };
      break;
    case "blur":
      filters.push(`blur(${round(2 + 10 * i)}px)`);
      break;
    case "softEdges": {
      /* the silhouette's own edge feathered away */
      const soft = round(4 + 22 * i);
      mask = `radial-gradient(closest-side, #000 ${round(Math.max(20, 100 - soft * 1.6))}%, rgba(0,0,0,0.35) ${round(Math.max(40, 100 - soft * 0.7))}%, transparent 100%)`;
      break;
    }
    case "fadeRight":
      mask = `linear-gradient(90deg, #000 ${round(70 - 55 * i)}%, transparent 100%)`;
      break;
    case "fadeEdges": {
      const a = round(4 + 26 * i);
      mask = `linear-gradient(90deg, transparent, #000 ${a}%, #000 ${100 - a}%, transparent)`;
      break;
    }
    case "ring": {
      const gap = round(2 + 6 * i);
      behind.push({ css: { position: "absolute", inset: -gap }, fill: "", stroke: fx, strokeWidth: 2 });
      break;
    }
    case "offsetOutline": {
      const d = round(3 + 9 * i);
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d}px, ${d}px)` }, fill: "", stroke: fx, strokeWidth: 2 });
      break;
    }
    case "sticker": {
      const w = round(2 + 4 * i);
      filters.push(
        `drop-shadow(${w}px 0 0 ${fx})`,
        `drop-shadow(-${w}px 0 0 ${fx})`,
        `drop-shadow(0 ${w}px 0 ${fx})`,
        `drop-shadow(0 -${w}px 0 ${fx})`,
      );
      break;
    }
    case "stack": {
      const d = round(3 + 5 * i);
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d * 2}px, ${d * 2}px)`, opacity: 0.3 }, fill: fx || plate, stroke: "", strokeWidth: 0 });
      behind.push({ css: { position: "absolute", inset: 0, transform: `translate(${d}px, ${d}px)`, opacity: 0.55 }, fill: fx || plate, stroke: "", strokeWidth: 0 });
      break;
    }
    case "topBar":
      overlay = { borderTop: `${round(3 + 7 * i)}px solid ${fx}` };
      break;
    case "bottomBar":
      overlay = { borderBottom: `${round(3 + 7 * i)}px solid ${fx}` };
      break;
    case "leftBar":
      overlay = { borderLeft: `${round(3 + 7 * i)}px solid ${fx}` };
      break;
    case "cornerFold": {
      const fold = round(10 + 12 * i);
      overlay = {
        background: `linear-gradient(225deg, rgba(0, 0, 0, 0.5) 0 ${fold}px, rgba(255, 255, 255, 0.28) ${fold}px ${round(fold * 1.45)}px, transparent ${round(fold * 1.45)}px)`,
      };
      break;
    }
    default:
      break;
  }

  return { filters, overlay, backdrop, mask, transform, behind, reflection };
}
