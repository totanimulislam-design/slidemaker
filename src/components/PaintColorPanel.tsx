import type { Gradient } from "../lib/types";
import FontColorPanel from "./FontColorPanel";
import { gradientCss } from "../lib/banner";
import { cn } from "../utils/cn";

/**
 * The colour card behind a **Fill** or **Border** button on the Question bullet
 * line — the same card the text colour opens (Solid · Gradient, the document
 * colours, the Canva swatches, the wheel and the custom gradient builder), with
 * the two extra states a *shape* paint has and a text colour does not:
 *
 *   **Auto** — the marker design paints its own body / line
 *   **None** — paint nothing there
 *
 * so one button covers the whole tri-state convention the marker's channels
 * already use, without a second control to find.
 */
interface Props {
  /** the card's own name (also the pop-up's title) */
  label: string;
  /** "" = auto · "transparent" = none · "#rrggbb" = the picked colour */
  value: string;
  /** the channel's gradient (an enabled one paints instead of the solid) */
  gradient?: Gradient;
  /** the colour Auto resolves to right now — the swatch shows it */
  fallback: string;
  documentColors?: string[];
  onSolid: (hex: string) => void;
  onGradient: (g: Gradient) => void;
  onClearGradient: () => void;
  /** left out = the channel has no Auto state and the button is not shown */
  onAuto?: () => void;
  /** what Auto inherits, in the panel's own words — the button's tooltip */
  autoHint?: string;
  onNone?: () => void;
}

const checker = "repeating-conic-gradient(#3a3a44 0% 25%, #1c1c22 0% 50%) 50% / 8px 8px";

export default function PaintColorPanel({
  label,
  value,
  gradient,
  fallback,
  documentColors,
  onSolid,
  onGradient,
  onClearGradient,
  onAuto,
  autoHint,
  onNone,
}: Props) {
  const isNone = value === "transparent";
  const isAuto = !value || value === "";
  const gradOn = !!gradient?.enabled;
  const swatchCss = isNone ? checker : gradOn ? gradientCss(gradient!, fallback) : /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  const state = isNone ? "none" : gradOn ? "gradient" : isAuto ? "auto" : value;

  return (
    <div className="paint-color-panel flex w-full flex-col" data-paint-panel={label}>
      {/* ── the shape's two extra states ───────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#12141f] px-3 py-2">
        <span
          className="h-9 w-12 shrink-0 rounded-lg border border-white/15 shadow-inner"
          style={{ background: swatchCss }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <span className="block truncate font-mono text-[11px] text-slate-300" title={String(state)}>
            {isNone ? "none" : gradOn ? "gradient" : isAuto ? `auto · ${fallback}` : String(value).toUpperCase()}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {onAuto && (
            <button
              type="button"
              aria-label={`${label}: auto (the design's own paint)`}
              aria-pressed={isAuto && !gradOn}
              title={autoHint ?? "Auto — let the marker design paint its own"}
              onClick={onAuto}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11px] transition-colors",
                isAuto && !gradOn ? "border-amber-300 bg-amber-400 font-semibold text-slate-950" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              Auto
            </button>
          )}
          {onNone && (
            <button
              type="button"
              aria-label={`${label}: none (paint nothing)`}
              aria-pressed={isNone}
              title="None — paint nothing here"
              onClick={onNone}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11px] transition-colors",
                isNone ? "border-amber-300 bg-amber-400 font-semibold text-slate-950" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              None
            </button>
          )}
        </span>
      </div>

      {/* ── the same solid / gradient card the text colour opens ───────── */}
      <FontColorPanel
        solid={/^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback}
        gradient={gradient}
        onSolid={onSolid}
        onGradient={onGradient}
        onClearGradient={onClearGradient}
        documentColors={documentColors}
        title={label}
      />
    </div>
  );
}
