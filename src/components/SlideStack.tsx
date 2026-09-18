import { useEffect, useRef, useState, type ReactNode } from "react";
import Slide from "./Slide";
import { Thumb } from "./SlideViews";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "../lib/dragSession";
import { effectiveBackground } from "../lib/background";
import { effectiveHeader, effectiveTheme } from "../lib/overrides";
import type { Deck } from "../lib/types";
import { cn } from "../utils/cn";

interface Props {
  deck: Deck;
  /** the slide the editor is showing */
  current: number;
  /** font-coverage revision — re-keys the previews when extra fonts load */
  revision: number;
  /** the slide ids ticked in the rail's selection boxes */
  selected: string[];
  /**
   * Replace the ticked set. The inspector's “Selected slides” scope reads the
   * same list, so one selection drives the rail's bulk bar AND a design apply.
   */
  onSelected: (ids: string[]) => void;
  /** select a slide (a plain click, never a drag) */
  onCurrent: (i: number) => void;
  /** a canvas click that armed an edit field must be dropped when switching slides */
  onClearField: () => void;
  /**
   * Drag & drop: called once per drop with the dragged slide's id and the FINAL
   * 0-based slot it lands in (the slot the pointer hovered). Absent → the rail
   * is read-only and cards cannot be dragged.
   */
  onMoveTo?: (id: string, toIndex: number) => void;
  onStep: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /** bulk ops over the ticked set — each one is a single undo step */
  onDuplicateSelected: (ids: string[]) => void;
  onRemoveSelected: (ids: string[]) => void;
}

/** the live state of one card drag (mirrored into a ref for the gesture handlers) */
interface CardDrag {
  id: string;
  /** the dragged card's index, top-first */
  from: number;
  /** the gap the pointer currently points at, 0..n (before row k, or past the last) */
  p: number;
  /** pointer position, for the chip that follows the cursor */
  x: number;
  y: number;
  /** card height + the gap between cards — how far one slot is */
  stride: number;
  /** list scrollTop when the drag started, so cached rects stay valid */
  scroll0: number;
  /** card boxes captured at drag start (viewport space) — transforms never feed back */
  tops: number[];
  h: number;
}

/** how close to the list edge the pointer must be to auto-scroll, and how fast */
const EDGE_PX = 26;
const EDGE_SPEED = 9;

/** final slot (0-based) for a pointer at gap `p` while carrying the card at `from` */
const slotFor = (n: number, from: number, p: number): number => {
  const g = Math.max(0, Math.min(n, p));
  const to = g - (from < g ? 1 : 0);
  return Math.max(0, Math.min(n - 1, to));
};

/**
 * A rail preview that fills the card's content box exactly, whatever its
 * current width (the list's scrollbar steals 8px when it shows up). The
 * card's border — the current slide's gradient ring, a ticked card's sky
 * frame — then runs evenly around the slide instead of hugging one side.
 */
function RailThumb({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(194);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw > 0) setW(cw);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <Thumb width={w}>{children}</Thumb>
    </div>
  );
}

/**
 * The slide rail: one card per slide, top of the deck first.
 *
 * A click selects the slide; dragging a card carries it to ANY slot in the
 * stack — the cards in between open a landing gap (Canva-style) and a small
 * preview follows the cursor. The reorder runs through the same guarded
 * pointer session as the board and the layer list, so a click can never move
 * a slide and a drag never leaks past pointer-up.
 *
 * Every card also carries a SELECTION BOX: ticking boxes builds a multi-
 * selection (Ctrl/⌘-click toggles one card, Shift-click takes the whole range)
 * that the header's select-all box and the bulk bar operate on. Ticking never
 * opens a slide, so a press on a box can never start a drag either.
 *
 * The card the editor is showing wears a moving gradient border, so the open
 * slide stays readable at a glance.
 */
export default function SlideStack({
  deck,
  current,
  revision,
  selected,
  onSelected,
  onCurrent,
  onClearField,
  onMoveTo,
  onStep,
  onDuplicate,
  onRemove,
  onDuplicateSelected,
  onRemoveSelected,
}: Props) {
  const slides = deck.slides;
  const n = slides.length;
  const draggable = !!onMoveTo && n > 1;

  /* ---------------------------------------------------------------------- *
   * Multi-selection
   * ---------------------------------------------------------------------- */
  const ticked = new Set(selected);
  /** ticked slides in deck order — what the bulk bar acts on (stale ids drop out) */
  const selIds = slides.filter((s) => ticked.has(s.id)).map((s) => s.id);
  const selCount = selIds.length;
  const allTicked = n > 0 && selCount === n;
  /** the card the last click anchored a Shift-range from (defaults to the open one) */
  const anchorRef = useRef(current);

  /**
   * One card's click: plain opens it, Ctrl/⌘ toggles its tick, Shift takes the
   * range from the anchor. A plain open always leaves that slide as the only
   * ticked one, the way a file list keeps a single selection on a plain click.
   */
  const openCard = (i: number, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    const id = slides[i].id;
    if (e.shiftKey) {
      const a = Math.max(0, Math.min(n - 1, anchorRef.current));
      const [lo, hi] = a <= i ? [a, i] : [i, a];
      onSelected(slides.slice(lo, hi + 1).map((s) => s.id));
    } else if (e.ctrlKey || e.metaKey) {
      onSelected(ticked.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    } else if (!(selCount === 1 && ticked.has(id))) {
      onSelected([id]);
    }
    anchorRef.current = i;
    onCurrent(i);
    onClearField();
  };

  /* ---------------------------------------------------------------------- *
   * Drag to reorder
   * ---------------------------------------------------------------------- */
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  /** the card a pointer-down armed; read once by the session's onStart */
  const armedId = useRef<string | null>(null);
  const dragRef = useRef<CardDrag | null>(null);
  const [drag, setDragState] = useState<CardDrag | null>(null);
  const setDrag = (d: CardDrag | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  /** card boxes at drag start; returns null when a card is not measurable yet */
  const measureCards = (): { tops: number[]; h: number; stride: number } | null => {
    const tops: number[] = [];
    let h = 0;
    for (const s of slides) {
      const el = cardEls.current.get(s.id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      tops.push(r.top);
      if (r.height > h) h = r.height;
    }
    if (!tops.length) return null;
    const gap = tops.length > 1 ? Math.max(0, tops[1] - tops[0] - h) : 8;
    return { tops, h: h || 80, stride: h + gap };
  };

  /**
   * Gap index (0..n) for a pointer Y: the number of cards whose midpoint the
   * pointer is BELOW. The cached boxes are in the viewport space of the drag's
   * first frame, so the list's scroll travel since then is added back.
   */
  const gapAt = (d: CardDrag, clientY: number): number => {
    const y = clientY + ((listRef.current?.scrollTop ?? 0) - d.scroll0);
    for (let k = 0; k < d.tops.length; k++) {
      if (y < d.tops[k] + d.h / 2) return k;
    }
    return d.tops.length;
  };

  /* auto-scroll while the pointer waits near either edge of the rail */
  const edgeDir = useRef(0);
  const edgeRaf = useRef<number | null>(null);
  const lastY = useRef(0);
  const stopEdge = () => {
    edgeDir.current = 0;
    if (edgeRaf.current !== null) {
      cancelAnimationFrame(edgeRaf.current);
      edgeRaf.current = null;
    }
  };
  const edgeTick = () => {
    edgeRaf.current = null;
    const list = listRef.current;
    const d = dragRef.current;
    if (!list || !d || !edgeDir.current) return;
    list.scrollTop += edgeDir.current * EDGE_SPEED;
    const p = gapAt(d, lastY.current);
    if (p !== d.p) setDrag({ ...d, p });
    edgeRaf.current = requestAnimationFrame(edgeTick);
  };
  const edgeScroll = (clientY: number) => {
    const list = listRef.current;
    if (!list) return;
    lastY.current = clientY;
    const r = list.getBoundingClientRect();
    const scrollable = list.scrollHeight > list.clientHeight + 1;
    const dir =
      !scrollable || r.height <= 0
        ? 0
        : clientY < r.top + EDGE_PX
          ? -1
          : clientY > r.bottom - EDGE_PX
            ? 1
            : 0;
    if (!dir) {
      stopEdge();
      return;
    }
    if (edgeDir.current === dir && edgeRaf.current !== null) return;
    edgeDir.current = dir;
    if (edgeRaf.current === null) edgeRaf.current = requestAnimationFrame(edgeTick);
  };
  useEffect(() => stopEdge, []);

  const { begin, release, handleLeave } = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    enabled: () => draggable && !!armedId.current,
    onStart: (e) => {
      const id = armedId.current;
      if (!id) return;
      const from = slides.findIndex((s) => s.id === id);
      const measured = measureCards();
      if (from < 0 || !measured) return;
      setDrag({
        id,
        from,
        p: from,
        x: e.clientX,
        y: e.clientY,
        stride: measured.stride,
        scroll0: listRef.current?.scrollTop ?? 0,
        tops: measured.tops,
        h: measured.h,
      });
    },
    onMove: (e) => {
      const d = dragRef.current;
      if (!d) return;
      setDrag({ ...d, p: gapAt(d, e.clientY), x: e.clientX, y: e.clientY });
      edgeScroll(e.clientY);
    },
    onEnd: (moved, e) => {
      const d = dragRef.current;
      armedId.current = null;
      stopEdge();
      setDrag(null);
      if (!d || !moved || !onMoveTo) return; // a press that never travelled is a click
      /**
       * Only a real release commits the drop. pointercancel, a lost pointer
       * capture, window blur and a hidden tab all end the gesture WITHOUT the
       * user ever letting go over the rail, so the card snaps back instead of
       * landing somewhere it was never aimed at.
       */
      if (!e || e.type !== "pointerup") return;
      onMoveTo(d.id, slotFor(n, d.from, d.p));
    },
  });

  /**
   * How far each card travels to open the landing gap. Exact for any drop:
   * the cards that stay put keep their relative order, the dragged card lands
   * in the slot the pointer hovers, and each card's shift is the distance
   * between where it is now and where the drop would put it.
   */
  const shiftFor = (i: number): number => {
    if (!drag || i === drag.from) return 0;
    const to = slotFor(n, drag.from, drag.p);
    let f = i < drag.from ? i : i - 1; // index after the dragged card leaves
    if (f >= to) f += 1; // …and after the dragged card lands
    return (f - i) * drag.stride;
  };

  /** keep the current card in view when the editor jumps to another slide */
  useEffect(() => {
    const list = listRef.current;
    if (!list || dragRef.current) return;
    const el = cardEls.current.get(slides[current]?.id ?? "");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const c = list.getBoundingClientRect();
    if (r.height <= 0 || c.height <= 0) return;
    if (r.top < c.top) list.scrollTop -= c.top - r.top + 4;
    else if (r.bottom > c.bottom) list.scrollTop += r.bottom - c.bottom + 4;
  }, [current, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const dragEntry = drag ? slides[drag.from] : null;

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-white/10 bg-slate-950/60">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {/* one box to tick the whole deck at once (indeterminate while partial) */}
        <label
          data-slide-select-all-wrap
          title={allTicked ? "Untick every slide" : "Tick every slide"}
          className="flex cursor-pointer items-center gap-1.5"
        >
          <input
            ref={(el) => {
              if (el) el.indeterminate = selCount > 0 && !allTicked;
            }}
            type="checkbox"
            data-slide-select-all
            aria-label="Select all slides"
            checked={allTicked}
            onChange={() => onSelected(allTicked ? [] : slides.map((s) => s.id))}
            className="h-3.5 w-3.5 cursor-pointer accent-amber-400"
          />
          Slides
        </label>
        <span className="ml-auto text-slate-600">{n}</span>
      </div>

      {/* the bulk bar: what the ticked slides can be put through together */}
      {selCount > 0 && (
        <div
          data-slide-bulk
          className="flex items-center gap-1 border-b border-white/5 bg-sky-400/[0.08] px-3 py-1.5"
        >
          <span data-slide-bulk-count className="text-[10px] font-semibold text-sky-200">
            {selCount} selected
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              data-slide-bulk-duplicate
              title={`Duplicate the ${selCount} selected slide${selCount === 1 ? "" : "s"}`}
              aria-label={`Duplicate the ${selCount} selected slides`}
              onClick={() => onDuplicateSelected(selIds)}
              className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-amber-400 hover:text-slate-950"
            >
              ⧉
            </button>
            <button
              type="button"
              data-slide-bulk-delete
              title={`Delete the ${selCount} selected slide${selCount === 1 ? "" : "s"}`}
              aria-label={`Delete the ${selCount} selected slides`}
              onClick={() => onRemoveSelected(selIds)}
              className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-rose-500 hover:text-white"
            >
              ✕
            </button>
            <button
              type="button"
              data-slide-bulk-clear
              title="Clear the selection"
              onClick={() => onSelected([])}
              className="rounded px-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-100"
            >
              clear
            </button>
          </div>
        </div>
      )}

      <div
        ref={listRef}
        data-slide-stack
        data-dragging={drag ? drag.id : undefined}
        data-drop-index={drag ? slotFor(n, drag.from, drag.p) : undefined}
        className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pt-1 pb-4", drag && "select-none")}
      >
        {slides.map((s, i) => {
          const isDragged = !!drag && drag.id === s.id;
          const shift = isDragged ? 0 : shiftFor(i);
          const checked = ticked.has(s.id);
          const isOpen = i === current;
          return (
            <div
              key={s.id}
              ref={(el) => {
                if (el) cardEls.current.set(s.id, el);
                else cardEls.current.delete(s.id);
              }}
              data-slide-card={s.id}
              data-slide-dragging={isDragged ? "true" : undefined}
              data-slide-current={isOpen ? "true" : undefined}
              data-slide-selected={checked ? "true" : undefined}
              title={
                draggable
                  ? "Click to open · tick the box (or Ctrl/⌘-click) to select several · Shift-click selects a range · drag anywhere in the stack to reorder"
                  : "Click to open this slide · tick the box (or Ctrl/⌘-click) to select several · Shift-click selects a range"
              }
              style={{
                position: "relative",
                zIndex: isDragged ? 1 : shift ? 3 : 2,
                transform: shift ? `translateY(${shift}px)` : undefined,
                transition: shift ? "transform 120ms ease" : undefined,
                opacity: isDragged ? 0.35 : undefined,
                touchAction: "pan-y",
              }}
              className={cn(
                "group cursor-pointer rounded-lg border-2 p-1 transition-colors select-none",
                /* the open slide's border is the animated gradient ring in index.css */
                isDragged
                  ? "border-dashed border-amber-400/60 bg-amber-400/10"
                  : isOpen
                    ? "slide-card-current"
                    : checked
                      ? "border-sky-400/70 bg-sky-400/[0.07] hover:border-sky-300"
                      : "border-white/10 hover:border-white/25",
                draggable && "cursor-grab active:cursor-grabbing",
              )}
              onClick={(e) => openCard(i, e)}
              onPointerDown={(e) => {
                if (!draggable) return;
                // the card's quick-op buttons and its selection box keep their own presses
                if ((e.target as HTMLElement | null)?.closest("button, input, label")) return;
                armedId.current = s.id;
                begin(e, { x: 0, y: 0 });
              }}
              /* `release` forwards the NATIVE pointer event: the card holds the
                 pointer capture, so this is the handler a real release runs
                 through, long before the session's window listener sees it. */
              onPointerUp={release}
              onPointerCancel={release}
              /* a release outside the card must not leave an armed gesture behind;
                 while the button is still held the window listeners keep the drag */
              onPointerLeave={handleLeave}
            >
              <div className="pointer-events-none">
                <RailThumb>
                  <Slide
                    key={`t-${revision}`}
                    slide={s}
                    header={effectiveHeader(deck, s)}
                    theme={effectiveTheme(deck, s)}
                    globalShapes={deck.globalShapes}
                    background={effectiveBackground(deck, s)}
                  />
                </RailThumb>
              </div>
              {/* selection box + slide number: the box fades in on hover and stays
                  put while ticked, so the number never jumps sideways */}
              <div className="absolute top-2 left-2 z-[3] flex items-center gap-1">
                <label
                  data-slide-select-wrap={s.id}
                  title={checked ? `Slide ${i + 1} selected — untick to drop it` : `Select slide ${i + 1}`}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-md border bg-slate-950/80 transition-opacity",
                    checked
                      ? "border-amber-400/80 opacity-100"
                      : "border-white/25 opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                  )}
                >
                  <input
                    type="checkbox"
                    data-slide-select={s.id}
                    aria-label={`Select slide ${i + 1}`}
                    checked={checked}
                    onChange={() =>
                      onSelected(checked ? selected.filter((x) => x !== s.id) : [...selected, s.id])
                    }
                    className="h-3.5 w-3.5 cursor-pointer accent-amber-400"
                  />
                </label>
                <span className="rounded bg-black/70 px-1.5 text-[10px] font-semibold text-amber-300">
                  {i + 1}
                </span>
              </div>
              <div className="absolute right-1.5 bottom-1.5 hidden gap-1 group-hover:flex">
                {[
                  { t: "↑", title: "Move up", fn: () => onStep(s.id, -1) },
                  { t: "↓", title: "Move down", fn: () => onStep(s.id, 1) },
                  { t: "⧉", title: "Duplicate slide", fn: () => onDuplicate(s.id) },
                  { t: "✕", title: "Delete slide", fn: () => onRemove(s.id) },
                ].map((b) => (
                  <button
                    key={b.t}
                    type="button"
                    title={b.title}
                    aria-label={`${b.title} (slide ${i + 1})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      b.fn();
                    }}
                    className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-amber-400 hover:text-slate-950"
                  >
                    {b.t}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!n && (
          <p className="px-1 py-6 text-center text-xs text-slate-600">
            No slides yet. Use “Paste questions”.
          </p>
        )}
      </div>

      {/* the card being carried, following the cursor (never intercepts pointer events) */}
      {drag && dragEntry && (
        <div
          data-slide-drag-chip={drag.id}
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg border border-amber-400/70 bg-slate-900/95 p-1 shadow-lg shadow-black/50"
          style={{ left: drag.x + 14, top: drag.y - 15 }}
        >
          <Thumb width={72}>
            <Slide
              slide={dragEntry}
              header={effectiveHeader(deck, dragEntry)}
              theme={effectiveTheme(deck, dragEntry)}
              globalShapes={deck.globalShapes}
              background={effectiveBackground(deck, dragEntry)}
            />
          </Thumb>
          <span className="shrink-0 rounded bg-amber-400/20 px-1 text-[9px] text-amber-200">
            slot {slotFor(n, drag.from, drag.p) + 1} of {n}
          </span>
        </div>
      )}
    </aside>
  );
}
