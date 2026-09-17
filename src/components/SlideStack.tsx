import { useEffect, useRef, useState } from "react";
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
 * The slide rail: one card per slide, top of the deck first.
 *
 * A click selects the slide; dragging a card carries it to ANY slot in the
 * stack — the cards in between open a landing gap (Canva-style) and a small
 * preview follows the cursor. The reorder runs through the same guarded
 * pointer session as the board and the layer list, so a click can never move
 * a slide and a drag never leaks past pointer-up.
 */
export default function SlideStack({ deck, current, revision, onCurrent, onClearField, onMoveTo, onStep, onDuplicate, onRemove }: Props) {
  const slides = deck.slides;
  const n = slides.length;
  const draggable = !!onMoveTo && n > 1;

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
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        Slides
        <span className="text-slate-600">{n}</span>
      </div>
      <div
        ref={listRef}
        data-slide-stack
        data-dragging={drag ? drag.id : undefined}
        data-drop-index={drag ? slotFor(n, drag.from, drag.p) : undefined}
        className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4", drag && "select-none")}
      >
        {slides.map((s, i) => {
          const isDragged = !!drag && drag.id === s.id;
          const shift = isDragged ? 0 : shiftFor(i);
          return (
            <div
              key={s.id}
              ref={(el) => {
                if (el) cardEls.current.set(s.id, el);
                else cardEls.current.delete(s.id);
              }}
              data-slide-card={s.id}
              data-slide-dragging={isDragged ? "true" : undefined}
              title={
                draggable
                  ? "Click to open · drag anywhere in the stack to reorder"
                  : "Click to open this slide"
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
                "group cursor-pointer rounded-lg border p-1 transition-colors",
                i === current ? "border-amber-400 bg-amber-400/10" : "border-white/10 hover:border-white/25",
                draggable && "cursor-grab active:cursor-grabbing",
                isDragged && "border-dashed border-amber-400/60",
              )}
              onClick={() => {
                onCurrent(i);
                onClearField();
              }}
              onPointerDown={(e) => {
                if (!draggable) return;
                // the card's quick-op buttons keep their own presses
                if ((e.target as HTMLElement | null)?.closest("button")) return;
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
                <Thumb width={196}>
                  <Slide
                    key={`t-${revision}`}
                    slide={s}
                    header={effectiveHeader(deck, s)}
                    theme={effectiveTheme(deck, s)}
                    globalShapes={deck.globalShapes}
                    background={effectiveBackground(deck, s)}
                  />
                </Thumb>
              </div>
              <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-amber-300">
                {i + 1}
              </span>
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
