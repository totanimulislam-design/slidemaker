import type { CSSProperties } from "react";
import type { ThemeSettings } from "./types";
import { withAlpha } from "./color";

/**
 * The option bullet is painted from four independent colour channels so a
 * teacher can restyle one part without touching the others:
 *
 *   • Ink    — the letter inside the marker (`optionBulletInk`)
 *   • Fill   — the marker's own background   (`optionBulletFill`)
 *   • Border — the outline / ring           (`optionBulletBorder`)
 *   • Backdrop — the *background shape* drawn behind the bullet, either as a
 *     plate under the marker or as the option-row container tint
 *     (`optionBulletBgColor`)
 *
 * Every channel is tri-state:
 *   ""            → auto: derive it from the marker colour (`optionAccent`)
 *   "transparent" → explicitly nothing (no fill / no ring)
 *   "#rrggbb"     → the picked colour
 *
 * `optionBulletCustomOnAnswer` decides whether the picked channels also win
 * over the green/accent treatment used to reveal the correct answer.
 */

/** value meaning "derive it from the marker colour" */
export const BULLET_COLOR_AUTO = "";
/** value meaning "paint nothing here" */
export const BULLET_COLOR_NONE = "transparent";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` → `#aabbcc`, so the value is usable by `<input type="color">`. */
function expandHex(v: string): string {
  if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}

/**
 * Normalise anything the user (or an old JSON deck) may have stored into one of
 * `null` (auto) · `"transparent"` (none) · `#rrggbb`.
 */
export function normalizeBulletColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v || v === "auto" || v === "inherit") return null;
  if (v === "transparent" || v === "none") return BULLET_COLOR_NONE;
  return HEX.test(v) ? expandHex(v) : null;
}

/** Is this channel explicitly set (not auto)? */
export const isBulletColorSet = (value: unknown): boolean => normalizeBulletColor(value) !== null;

export interface OptionBulletPalette {
  /** the marker colour every channel falls back to */
  base: string;
  ink: string | null;
  fill: string | null;
  border: string | null;
  /** true when the picked channels are set and should beat the answer highlight */
  customWins: boolean;
  /** true when at least one of ink / fill / border was picked */
  any: boolean;
}

export function optionBulletPalette(theme: ThemeSettings, highlight = false): OptionBulletPalette {
  const ink = normalizeBulletColor(theme.optionBulletInk);
  const fill = normalizeBulletColor(theme.optionBulletFill);
  const border = normalizeBulletColor(theme.optionBulletBorder);
  const any = ink !== null || fill !== null || border !== null;
  return {
    base: theme.optionAccent?.trim() || theme.accent?.trim() || "#2f4fff",
    ink,
    fill,
    border,
    customWins: any && (!highlight || theme.optionBulletCustomOnAnswer === true),
    any,
  };
}

/* ------------------------------------------------------------- backdrop ---- */

export interface OptionBulletBackdrop {
  /** normalised colour, never null */
  color: string;
  scope: "marker" | "row";
  shape: "match" | "circle" | "rounded" | "square" | "pill" | "diamond" | "hexagon" | "soft";
  /** 100–300, % of the marker box (marker scope only) */
  size: number;
  /** 0–1 */
  opacity: number;
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
};

/** the background-shape settings, or `null` when the colour is off/auto. */
export function optionBulletBackdrop(theme: ThemeSettings): OptionBulletBackdrop | null {
  const color = normalizeBulletColor(theme.optionBulletBgColor);
  if (!color || color === BULLET_COLOR_NONE) return null;
  return {
    color,
    scope: theme.optionBulletBgScope === "row" ? "row" : "marker",
    shape: theme.optionBulletBgShape ?? "match",
    size: num(theme.optionBulletBgSize, 60, 300, 150),
    opacity: num(theme.optionBulletBgOpacity, 0, 100, 30) / 100,
  };
}

/**
 * The plate drawn *behind* the marker. `w`/`h` are the marker box, `radius` and
 * `clip` let a "match" plate borrow the marker's own silhouette.
 */
export function optionBulletPlateStyle(
  bg: OptionBulletBackdrop,
  w: number,
  h: number,
  radius: string | number | undefined,
  clip: string | undefined,
): CSSProperties {
  const scale = bg.size / 100;
  const box = Math.max(w, h);
  const isPill = bg.shape === "pill" || (bg.shape === "match" && w > h);
  const width = Math.round(isPill ? box * 1.9 * scale : box * scale);
  const height = Math.round(box * scale);

  const style: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width,
    height,
    transform: "translate(-50%, -50%)",
    background: withAlpha(bg.color, bg.opacity),
    pointerEvents: "none",
    flex: "0 0 auto",
    boxSizing: "border-box",
  };

  switch (bg.shape) {
    case "circle":
      style.borderRadius = "50%";
      break;
    case "soft":
      style.borderRadius = "50%";
      style.filter = `blur(${Math.max(4, Math.round(height * 0.2))}px)`;
      style.background = withAlpha(bg.color, Math.min(1, bg.opacity * 1.5));
      break;
    case "rounded":
      style.borderRadius = Math.round(height * 0.28);
      break;
    case "square":
      style.borderRadius = 0;
      break;
    case "pill":
      style.borderRadius = 999;
      break;
    case "diamond":
      style.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      break;
    case "hexagon":
      style.clipPath = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
      break;
    default: // match the marker's own geometry
      if (clip) style.clipPath = clip;
      else style.borderRadius = radius ?? "50%";
      if (bg.opacity < 0.5) style.background = withAlpha(bg.color, Math.min(1, bg.opacity * 1.35));
      break;
  }
  return style;
}

/**
 * Row-scope: the picked colour becomes the option row's background shape.
 * Returned as a patch so every renderer (canvas, thumbnails, previews) applies
 * it the same way while the row style keeps its radius / border / clip.
 */
export function optionRowBackdrop(theme: ThemeSettings, highlight: boolean): CSSProperties | null {
  const bg = optionBulletBackdrop(theme);
  if (!bg || bg.scope !== "row") return null;
  if (highlight && theme.optionBulletCustomOnAnswer !== true) return null;
  const patch: CSSProperties = { background: withAlpha(bg.color, bg.opacity) };
  if (bg.shape === "soft") patch.boxShadow = `0 0 ${Math.round(18 + 40 * bg.opacity)}px ${withAlpha(bg.color, Math.min(0.8, bg.opacity + 0.2))}`;
  return patch;
}
