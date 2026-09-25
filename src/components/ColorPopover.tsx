import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Gradient } from "../lib/types";
import { gradientCss } from "../lib/banner";
import PaintColorPanel from "./PaintColorPanel";
import { cn } from "../utils/cn";

/**
 * The floating card every colour under "Title background" opens in: anchored
 * to the button that asked for it, portalled to <body> so no scroll panel can
 * clip it, closed by a click outside or Escape. The card itself scrolls when
 * the viewport is short.
 */
export function AnchoredPopover({
  anchor,
  onClose,
  children,
  width = 322,
  label,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** accessible name of the pop-up */
  label?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);

  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 6;
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    /* prefer below; go above only when below is cramped and above is roomier */
    if (below >= 320 || below >= above) {
      setPos({ top: r.bottom + gap, left, maxH: Math.max(200, below) });
    } else {
      const maxH = Math.max(200, above);
      setPos({ top: Math.max(margin, r.top - gap - maxH), left, maxH });
    }
  }, [anchor, width]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    /* Escape closes THIS card only — captured before the editor's own Escape
       (which clears the selection) or a parent pop-up's can also fire */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, onClose, place]);

  if (!pos) return null;
  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label}
      data-color-popover=""
      className="fixed z-[1200] overflow-hidden rounded-xl border border-white/15 bg-[#161821] shadow-[0_18px_50px_rgba(0,0,0,.6)]"
      style={{ top: pos.top, left: pos.left, width }}
    >
      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: pos.maxH }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const checker = "repeating-conic-gradient(#3a3a44 0% 25%, #1c1c22 0% 50%) 50% / 8px 8px";

/**
 * One colour channel as a button: the swatch, the channel's name and what it
 * paints right now. Clicking it opens the colour pop-up — the SAME card the
 * text colour opens, with its two tabs (**Solid colour** and **Gradient**),
 * the document colours, the Canva swatches, the wheel and the hex field.
 * Channels that can wear Auto keep their Auto button inside the card.
 */
export default function PaintPopoverField({
  label,
  hint,
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
}: {
  /** the channel's own name — the button's and the pop-up's title */
  label: string;
  /** a note behind the name (e.g. "the shape's colour" while on Auto) */
  hint?: string;
  /** "" = auto · "transparent" = none · "#rrggbb" = the picked colour */
  value: string;
  /** the channel's gradient — an enabled one paints instead of the solid */
  gradient?: Gradient;
  /** the colour Auto resolves to right now — the swatch shows it */
  fallback: string;
  documentColors?: string[];
  onSolid: (hex: string) => void;
  onGradient: (g: Gradient) => void;
  onClearGradient: () => void;
  /** present = the channel has an Auto state ("" — the design paints its own) */
  onAuto?: () => void;
  autoHint?: string;
  /** present = the channel has a None state ("transparent" — paint nothing) */
  onNone?: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const gradOn = !!gradient?.enabled;
  const isNone = value === "transparent";
  const hex = /^#[0-9a-f]{3,8}$/i.test(value) ? value : "";
  const swatch = isNone ? checker : gradOn ? gradientCss(gradient!, hex || fallback) : hex || fallback;
  const caption = isNone ? "none" : gradOn ? "gradient" : hex ? hex.toUpperCase() : `auto · ${String(fallback).toUpperCase()}`;

  return (
    <div className="space-y-1.5" data-paint-popover-field={label}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${label} — open the colour card`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${label} — solid colour or gradient`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
          open ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-slate-900/60 hover:border-white/25",
        )}
      >
        <span className="h-7 w-10 shrink-0 rounded-md border border-white/20 shadow-inner" style={{ background: swatch }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-slate-200">
            {label}
            {hint && <span className="ml-1.5 text-[10px] font-normal text-slate-500">{hint}</span>}
          </span>
          <span className="block truncate font-mono text-[10.5px] text-slate-400">{caption}</span>
        </span>
        <span className="shrink-0 text-base leading-none text-slate-400" aria-hidden="true">
          ›
        </span>
      </button>
      {open && btnRef.current && (
        <AnchoredPopover anchor={btnRef.current} onClose={() => setOpen(false)} label={`${label} — colour card`}>
          <PaintColorPanel
            label={label}
            value={value}
            gradient={gradient}
            fallback={fallback}
            documentColors={documentColors}
            onSolid={onSolid}
            onGradient={onGradient}
            onClearGradient={onClearGradient}
            onAuto={onAuto}
            autoHint={autoHint}
            onNone={onNone}
          />
        </AnchoredPopover>
      )}
    </div>
  );
}
