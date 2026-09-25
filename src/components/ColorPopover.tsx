import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Gradient } from "../lib/types";
import { gradientCss } from "../lib/banner";
import PaintColorPanel from "./PaintColorPanel";
import { cn } from "../utils/cn";

/** the colour cards currently on screen, highest z-index last — a stack, not a swap */
const colorPopovers = () => Array.from(document.querySelectorAll<HTMLElement>("[data-color-popover]"));
const zOf = (el: HTMLElement) => Number(el.style.zIndex) || 0;
const topColorPopover = () =>
  colorPopovers().reduce<HTMLElement | null>((best, el) => (!best || zOf(el) >= zOf(best) ? el : best), null);

/**
 * The floating card every colour under "Title background" opens in.
 *
 * It is its own pop-up, portalled to `<body>` so no scroll panel can clip it,
 * and it stacks *on top of* the pop-up it was opened from — shifted down and
 * left so the one underneath still shows its title and its ✕. Closing this
 * card (its own ✕, or Escape) removes only this card. The pop-up below stays
 * open. A further colour click opens another card on top of this one, the same
 * way.
 */
export function AnchoredPopover({
  anchor,
  onClose,
  children,
  width = 380,
  label,
  title,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** accessible name of the pop-up */
  label?: string;
  /** the words in the card's own title bar — defaults to `label` */
  title?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  /**
   * Claim a z-index above every colour card already open, once, before this
   * one is in the document — so a card opened from another card always paints
   * on top of it.
   */
  const zRef = useRef<number | null>(null);
  if (zRef.current === null && typeof document !== "undefined") {
    const maxZ = colorPopovers().reduce((m, el) => Math.max(m, zOf(el)), 1190);
    zRef.current = maxZ + 10;
  }
  const z = zRef.current ?? 1200;

  const place = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const lower = colorPopovers().filter((el) => el !== cardRef.current && zOf(el) < z);
    const parentPop = anchor.closest(".ctx-pop");
    const commit = (top: number, left: number, maxH: number) =>
      setPos((prev) => (prev && prev.top === top && prev.left === left && prev.maxH === maxH ? prev : { top, left, maxH }));
    /*
     * On top of the tool pop-up that opened us. Each card in the stack steps
     * down and left from that same pop-up — never from a card above it — so a
     * later card cannot drag the ones underneath out of place, and a dragged
     * tool pop-up carries the whole stack with it.
     */
    if (parentPop) {
      const pr = parentPop.getBoundingClientRect();
      const step = lower.length + 1;
      const left = Math.max(margin, Math.min(pr.left - 28 * step, vw - width - margin));
      const top = Math.max(margin, Math.min(pr.top + 44 * step, vh - 240));
      commit(top, left, Math.max(220, vh - top - margin));
      return;
    }
    const stackedOn = lower.reduce<HTMLElement | null>((best, el) => (!best || zOf(el) >= zOf(best) ? el : best), null);
    /* no tool pop-up (the inspector): stack on the colour card below, else the button */
    if (stackedOn) {
      const pr = stackedOn.getBoundingClientRect();
      const left = Math.max(margin, Math.min(pr.left - 28, vw - width - margin));
      const top = Math.max(margin, Math.min(pr.top + 44, vh - 240));
      commit(top, left, Math.max(220, vh - top - margin));
      return;
    }
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    /* no parent pop-up (the inspector): hang off the button that asked */
    if (below >= 320 || below >= above) {
      const top = r.bottom + gap;
      commit(top, left, Math.max(200, below));
    } else {
      const maxH = Math.max(200, above);
      commit(Math.max(margin, r.top - gap - maxH), left, maxH);
    }
  }, [anchor, width]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const mine = cardRef.current;
      /* only the top card of the stack answers an outside click — the ones
         underneath stay put until their own ✕ */
      if (!mine || topColorPopover() !== mine) return;
      const t = e.target as Node | null;
      if (!t || mine.contains(t) || anchor.contains(t)) return;
      const el = t instanceof Element ? t : t.parentElement;
      /* another colour button is about to open a card on top of this one */
      if (el?.closest("[aria-haspopup='dialog']")) return;
      const parentPop = anchor.closest(".ctx-pop, [data-color-popover]");
      if (parentPop && parentPop !== mine && parentPop.contains(t)) return;
      onClose();
    };
    /* Escape closes THIS card only — captured before the editor's own Escape
       (which clears the selection) or a parent pop-up's can also fire */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const mine = cardRef.current;
      if (!mine || topColorPopover() !== mine) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    /* a dragged parent pop-up must take the card stacked on it along */
    window.addEventListener("pointermove", place);
    window.addEventListener("pointerup", place);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("pointermove", place);
      window.removeEventListener("pointerup", place);
    };
  }, [anchor, onClose, place]);

  if (!pos) return null;
  const heading = title ?? label ?? "Colour";
  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label ?? heading}
      aria-modal="false"
      data-color-popover=""
      data-pop-stack={z}
      className="color-pop"
      style={{ top: pos.top, left: pos.left, width, zIndex: z, maxHeight: pos.maxH }}
    >
      <div className="color-pop-head">
        <span className="color-pop-title">{heading}</span>
        <button
          type="button"
          className="ctx-btn"
          aria-label="Close colour card"
          title="Close this colour card — the popup underneath stays open"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="color-pop-body" style={{ maxHeight: Math.max(160, pos.maxH - 42) }}>
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
        <AnchoredPopover anchor={btnRef.current} onClose={() => setOpen(false)} label={`${label} — colour card`} title={label}>
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
