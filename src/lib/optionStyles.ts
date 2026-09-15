import type { CSSProperties } from "react";
import type { ThemeSettings } from "./types";
import { shade, withAlpha } from "./color";
import { BULLET_COLOR_NONE, optionRowBackdrop, optionBulletPalette } from "./optionBulletColors";

/**
 * Option-row styles.
 *
 * A style describes the row container (background, border, radius, shadow) and
 * the letter badge (shape, fill, ink). Everything derives from the theme's
 * accent + a user colour so recolouring stays one click.
 */

export type OptionStyle =
  | "plain" | "soft" | "card" | "outline" | "pill" | "striped"
  | "leftBar" | "underline" | "boxed" | "glass" | "dashed" | "gradient"
  | "neon" | "ticket" | "chevron" | "stepped" | "panel" | "duo"
  | "minimal" | "shadowed";

export interface OptionStyleDef {
  id: OptionStyle;
  label: string;
}

export const OPTION_STYLES: OptionStyleDef[] = [
  { id: "plain", label: "Plain" },
  { id: "soft", label: "Soft" },
  { id: "card", label: "Card" },
  { id: "outline", label: "Outline" },
  { id: "pill", label: "Pill" },
  { id: "striped", label: "Striped" },
  { id: "leftBar", label: "Left bar" },
  { id: "underline", label: "Underline" },
  { id: "boxed", label: "Boxed" },
  { id: "glass", label: "Glass" },
  { id: "dashed", label: "Dashed" },
  { id: "gradient", label: "Gradient" },
  { id: "neon", label: "Neon" },
  { id: "ticket", label: "Ticket" },
  { id: "chevron", label: "Chevron" },
  { id: "stepped", label: "Stepped" },
  { id: "panel", label: "Panel" },
  { id: "duo", label: "Duo tone" },
  { id: "minimal", label: "Minimal" },
  { id: "shadowed", label: "Shadowed" },
];

export interface OptionChrome {
  row: CSSProperties;
  /** overrides for the letter badge */
  badge: CSSProperties;
  /** ring/glow drawn on the badge via boxShadow */
  badgeRing?: string;
}

export function optionRowStyle(
  id: OptionStyle,
  theme: ThemeSettings,
  color: string,
  highlight: boolean,
): OptionChrome {
  const accent = theme.accent;
  const board = theme.board;
  const hlBg = withAlpha(accent, 0.22);
  // a picked "background shape" colour replaces the style's own row tint
  const backdrop = optionRowBackdrop(theme, highlight);

  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "4px 8px",
    borderRadius: 999,
    background: "transparent",
    justifyContent: "flex-start",
  };
  const row = (over: CSSProperties): OptionChrome => {
    // a custom row background replaces the style's own paint entirely
    const cleaned: CSSProperties = backdrop
      ? {
          ...over,
          backgroundImage: undefined,
          backgroundPosition: undefined,
          backgroundRepeat: undefined,
          backgroundSize: undefined,
        }
      : over;
    return {
      row: {
        ...base,
        ...cleaned,
        // correct-answer highlight always reads, whatever the style
        background: backdrop
          ? backdrop.background
          : highlight && !over.background
            ? hlBg
            : over.background,
        boxShadow: backdrop?.boxShadow ?? over.boxShadow,
      },
      badge: { borderRadius: "50%" },
    };
  };

  switch (id) {
    case "plain":
      return row({});

    case "soft":
      return row({ background: withAlpha(color, 0.14), padding: "8px 18px" });

    case "card":
      return row({
        background: shade(board, -0.25),
        border: `1px solid ${withAlpha(color, 0.35)}`,
        borderRadius: 14,
        padding: "10px 18px",
        boxShadow: `0 4px 14px rgba(0,0,0,.35)`,
      });

    case "outline":
      return row({ border: `2px solid ${color}`, borderRadius: 12, padding: "9px 18px" });

    case "pill":
      return row({
        background: withAlpha(color, 0.18),
        border: `1.5px solid ${withAlpha(color, 0.6)}`,
        borderRadius: 999,
        padding: "9px 22px",
      });

    case "striped":
      return row({
        background: `repeating-linear-gradient(135deg, ${withAlpha(color, 0.16)} 0 10px, ${withAlpha(color, 0.04)} 10px 20px)`,
        borderRadius: 10,
        padding: "9px 18px",
      });

    case "leftBar":
      return row({
        background: withAlpha(color, 0.1),
        borderLeft: `6px solid ${color}`,
        borderRadius: 8,
        padding: "9px 18px",
      });

    case "underline":
      return row({
        borderBottom: `3px solid ${color}`,
        borderRadius: 0,
        padding: "6px 10px 10px",
      });

    case "boxed":
      return row({
        background: shade(board, -0.35),
        border: `2px solid ${shade(color, -0.1)}`,
        borderRadius: 10,
        padding: "10px 16px",
        boxShadow: `inset 0 0 0 1px ${withAlpha("#ffffff", 0.05)}`,
      });

    case "glass":
      return row({
        background: `linear-gradient(135deg, ${withAlpha("#ffffff", 0.14)}, ${withAlpha("#ffffff", 0.04)})`,
        border: `1px solid ${withAlpha("#ffffff", 0.28)}`,
        borderRadius: 16,
        padding: "10px 18px",
        backdropFilter: "blur(4px)",
      });

    case "dashed":
      return row({ border: `2px dashed ${color}`, borderRadius: 12, padding: "9px 18px" });

    case "gradient":
      return row({
        background: `linear-gradient(120deg, ${withAlpha(color, 0.32)}, ${withAlpha(accent, 0.12)})`,
        borderRadius: 12,
        padding: "10px 18px",
        border: `1px solid ${withAlpha(color, 0.35)}`,
      });

    case "neon":
      return row({
        background: shade(board, -0.3),
        border: `1.5px solid ${color}`,
        borderRadius: 12,
        padding: "10px 18px",
        boxShadow: `0 0 16px ${withAlpha(color, 0.55)}, inset 0 0 12px ${withAlpha(color, 0.18)}`,
      });

    case "ticket":
      return row({
        background: shade(board, -0.28),
        border: `1.5px solid ${withAlpha(color, 0.5)}`,
        borderRadius: 12,
        padding: "10px 18px 10px 10px",
        backgroundImage: `radial-gradient(circle at left center, ${board} 7px, transparent 7.5px), radial-gradient(circle at right center, ${board} 7px, transparent 7.5px)`,
        backgroundSize: "18px 100%, 18px 100%",
        backgroundPosition: "left, right",
        backgroundRepeat: "repeat-y, repeat-y",
      });

    case "chevron":
      return row({
        clipPath: "polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%, 6% 50%)",
        background: withAlpha(color, 0.2),
        padding: "10px 26px",
        borderRadius: 0,
      });

    case "stepped":
      return row({
        background: shade(board, -0.3),
        borderLeft: `10px solid ${color}`,
        borderTop: `1px solid ${withAlpha(color, 0.3)}`,
        borderBottom: `1px solid ${withAlpha(color, 0.3)}`,
        borderRadius: 6,
        padding: "9px 18px",
      });

    case "panel":
      return row({
        background: `linear-gradient(180deg, ${withAlpha(color, 0.22)}, ${withAlpha(color, 0.06)})`,
        borderTop: `2px solid ${color}`,
        borderRadius: 10,
        padding: "10px 18px",
      });

    case "duo":
      return row({
        background: `linear-gradient(90deg, ${withAlpha(color, 0.34)} 0 34%, ${withAlpha(color, 0.07)} 34% 100%)`,
        borderRadius: 12,
        padding: "10px 18px",
        border: `1px solid ${withAlpha(color, 0.3)}`,
      });

    case "minimal":
      return row({ borderRadius: 8, padding: "6px 12px" });

    case "shadowed":
      return row({
        background: shade(board, -0.22),
        borderRadius: 14,
        padding: "11px 18px",
        boxShadow: `0 6px 18px rgba(0,0,0,.45), 0 0 0 1px ${withAlpha(color, 0.25)}`,
      });

    default:
      return row({});
  }
}

/** Letter-badge styling that pairs with each row style. */
export function optionBadgeStyle(
  id: OptionStyle,
  theme: ThemeSettings,
  color: string,
  size: number,
  highlight: boolean,
): CSSProperties {
  const accent = theme.accent;
  /** the bullet's own ink / fill / border channels, when the user picked any */
  const pal = optionBulletPalette(theme, highlight);
  const filled: CSSProperties = {
    background: `radial-gradient(circle at 32% 28%, ${shade(highlight ? accent : color, 0.4)}, ${highlight ? accent : color} 72%)`,
    color: "#ffffff",
    border: `${Math.max(2, size * 0.06)}px solid #ffffff`,
    boxShadow: `0 0 0 2px ${withAlpha("#000000", 0.5)}`,
  };
  const outlined: CSSProperties = {
    background: withAlpha("#ffffff", 0.04),
    color: highlight ? "#ffffff" : color,
    border: `2.5px solid ${color}`,
  };
  const soft: CSSProperties = {
    background: withAlpha(color, 0.18),
    color: highlight ? "#ffffff" : color,
    border: `1.5px solid ${withAlpha(color, 0.55)}`,
  };

  const out: CSSProperties = { ...outlined };
  switch (id) {
    case "plain": case "minimal": case "underline":
      Object.assign(out, outlined, { borderRadius: "50%" });
      break;
    case "soft": case "pill": case "glass": case "gradient": case "panel": case "duo":
      Object.assign(out, filled, { borderRadius: "50%" });
      break;
    case "card": case "shadowed": case "boxed": case "ticket": case "neon":
      Object.assign(out, soft, { borderRadius: id === "ticket" ? 8 : "50%" });
      break;
    case "outline": case "dashed": case "stepped": case "striped":
      Object.assign(out, outlined, { borderRadius: id === "outline" ? 10 : id === "dashed" ? 10 : 8 });
      break;
    case "leftBar": case "chevron": case "shadowed2" as never:
      Object.assign(out, filled, { borderRadius: id === "chevron" ? 4 : 8 });
      break;
    default:
      Object.assign(out, outlined, { borderRadius: "50%" });
  }
  if (highlight) out.boxShadow = `0 0 22px ${withAlpha(accent, 0.85)}`;
  if (pal.customWins) {
    if (pal.fill) out.background = pal.fill === BULLET_COLOR_NONE ? "transparent" : pal.fill;
    if (pal.ink) out.color = pal.ink === BULLET_COLOR_NONE ? "transparent" : pal.ink;
    if (pal.border) {
      const w = Math.max(1.5, size * 0.06);
      out.border = pal.border === BULLET_COLOR_NONE ? "none" : `${w}px solid ${pal.border}`;
    }
  }
  return out;
}
