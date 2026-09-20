import { useEffect, useRef, useState } from "react";
import Slide from "./Slide";
import { Thumb } from "./SlideViews";
import { effectiveBackground } from "../lib/background";
import { effectiveHeader, effectiveTheme } from "../lib/overrides";
import { useRoomBelow } from "../lib/useRoomBelow";
import type { Deck } from "../lib/types";
import { cn } from "../utils/cn";

interface Props {
  deck: Deck;
  /** the slide the editor is showing */
  current: number;
  revision: number;
  /** jump to a slide picked from the list */
  onCurrent: (i: number) => void;
}

/** plain text for the option label — rich paste can leave marks behind */
const labelOf = (q: string): string =>
  (q.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "Blank slide").slice(0, 42);

/**
 * The slide selector, parked in the top-right corner of the editor: one
 * compact control ("3 / 12") that opens the whole stack as a list of live
 * previews. Picking a row jumps the editor to that slide — the same action as
 * clicking its card in the left rail, for when the rail is far away or you
 * want the number in front of you.
 */
export default function SlidePicker({ deck, current, revision, onCurrent }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** the list opens down to the bottom of the window, never past it */
  const { ref: listRef, room } = useRoomBelow(open, 12, 240);
  const n = deck.slides.length;
  const index = Math.min(current, Math.max(0, n - 1));

  /* close on the next click anywhere outside the control */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* Escape closes the list first (and stops, so the editor keeps its selection) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!n) return null;

  return (
    <div ref={rootRef} data-slide-picker className="relative">
      <button
        type="button"
        data-slide-picker-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Select a slide"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          open
            ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
        )}
      >
        <span aria-hidden="true">🎞</span>
        <span className="tabular-nums">
          {index + 1} / {n}
        </span>
        <span
          aria-hidden="true"
          className={cn("text-[9px] text-slate-500 transition-transform", open && "rotate-180 text-amber-300")}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          data-slide-picker-list
          role="listbox"
          aria-label="Slides"
          className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-[248px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur"
          style={room ? { maxHeight: room } : undefined}
        >
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={i === index}
              data-slide-picker-option={s.id}
              title={`Go to slide ${i + 1}`}
              onClick={() => {
                onCurrent(i);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 text-left transition-colors",
                i === index ? "border-amber-400/50 bg-amber-400/10" : "hover:bg-white/5",
              )}
            >
              <span className="relative block shrink-0 overflow-hidden rounded border border-white/10 bg-black">
                <Thumb width={64}>
                  <Slide
                    key={`p-${revision}`}
                    slide={s}
                    header={effectiveHeader(deck, s)}
                    theme={effectiveTheme(deck, s)}
                    globalShapes={deck.globalShapes}
                    background={effectiveBackground(deck, s)}
                  />
                </Thumb>
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 rounded px-1 text-[9px] font-semibold",
                    i === index ? "bg-amber-400 text-slate-950" : "bg-black/70 text-amber-300",
                  )}
                >
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-xs", i === index ? "text-amber-100" : "text-slate-300")}>
                  {labelOf(s.question)}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {s.answer ? "✓ answer set" : "no answer"} · {s.options.length} options
                </span>
              </span>
              {s.showAnswer && <span className="shrink-0 text-[10px] text-emerald-300" title="Answer revealed">👁</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
