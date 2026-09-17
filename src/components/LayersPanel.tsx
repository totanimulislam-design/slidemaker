import type { Deck, SlideData } from "../lib/types";
import { useEffect, useRef, useState } from "react";
import {
  dropSlot,
  layerKey,
  layerRect,
  parseLayerKey,
  sortedLayers,
  type LayerRect,
  type LayerRef,
} from "../lib/layers";
import { measureElement } from "../lib/layoutMeasure";
import type { AlignOp } from "../lib/shapeAlign";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "../lib/dragSession";
import { SegButtons } from "./ui";
import { canMove, Z_LABELS, type ZOp } from "../lib/zorder";
import { cn } from "../utils/cn";

interface Props {
  deck: Deck;
  slide: SlideData | undefined;
  selected: LayerRef | null;
  onSelect: (ref: LayerRef) => void;
  onReorder: (ref: LayerRef, op: ZOp) => void;
  onAlign?: (ref: LayerRef, op: AlignOp, target?: LayerRect) => void;
  onDistribute?: (refs: LayerRef[], axis: "h" | "v") => void;
  onToggleLock?: (id: string) => void;
  /**
   * Drag & drop: called once per drop with the layer and the stack slot it
   * lands in (counted from the BOTTOM, over the visible layers). Absent → the
   * list is read-only and rows cannot be dragged.
   */
  onMoveTo?: (ref: LayerRef, index: number) => void;
  /** every drawn item selected on the canvas, so a group lights up as a whole */
  selectedIds?: string[];
  compact?: boolean;
  /** rendered as its own navigation destination: a taller list */
  expanded?: boolean;
}

/** the live state of one row drag (mirrored into a ref for the gesture handlers) */
interface RowDrag {
  key: string;
  /** the dragged row, top-first among the VISIBLE rows */
  from: number;
  /** insertion point the pointer currently points at, same order */
  over: number;
  /** pointer position, for the chip that follows the cursor */
  x: number;
  y: number;
  /** uniform row height, used to open the landing gap */
  rowH: number;
  /** list scrollTop when the drag started, so cached rects stay valid */
  scroll0: number;
  /** row boxes captured at drag start (viewport space) — transforms never feed back */
  rows: { top: number; h: number }[];
}

/** how close to the list edge the pointer must be to auto-scroll, and how fast */
const EDGE_PX = 26;
const EDGE_SPEED = 9;

/**
 * One list for everything on the slide — header pieces, question, options,
 * footnote, shapes, text boxes and images — top-most first, with the four
 * layer operations.
 *
 * Clicking a row selects that element / shape on the canvas; dragging a row
 * carries it to a new slot and reorders the stack on drop, exactly like Canva.
 * The reorder runs through the same guarded pointer session as the board, so a
 * click can never move a layer and a drag never leaks past pointer-up.
 */
export default function LayersPanel({
  deck,
  slide,
  selected,
  onSelect,
  onReorder,
  onAlign,
  onDistribute,
  onToggleLock,
  onMoveTo,
  selectedIds,
  compact,
  expanded,
}: Props) {
  const [alignTo, setAlignTo] = useState<"slide" | "item">("slide");
  const [refKey, setRefKey] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const layers = sortedLayers(deck, slide).slice().reverse(); // top first
  // ops are decided on the visible layers only (hidden ones are skipped by reorderLayer)
  const stack = layers.filter((l) => !l.hidden).map((l) => ({ id: l.key, z: l.z }));
  const selKey = selected ? layerKey(selected) : null;
  const selEntry = layers.find((l) => l.key === selKey);
  const pos = selEntry ? layers.length - layers.indexOf(selEntry) : 0;

  /** rows that can actually be reordered: hidden built-ins are not on this slide */
  const visRows = layers.filter((l) => !l.hidden);
  const visIndexOf = new Map(visRows.map((l, i) => [l.key, i]));
  const draggable = !!onMoveTo && visRows.length > 1;

  /* ---------------------------------------------------------------------- *
   * Drag to reorder
   * ---------------------------------------------------------------------- */
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  /** the row a pointer-down armed; read once by the session's onStart */
  const armedKey = useRef<string | null>(null);
  const dragRef = useRef<RowDrag | null>(null);
  const [drag, setDragState] = useState<RowDrag | null>(null);
  const setDrag = (d: RowDrag | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  /** row boxes at drag start; returns null when a row is not measurable yet */
  const measureRows = (): { rows: { top: number; h: number }[]; rowH: number } | null => {
    const rows: { top: number; h: number }[] = [];
    let rowH = 0;
    for (const l of visRows) {
      const el = rowEls.current.get(l.key);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      rows.push({ top: r.top, h: r.height });
      if (r.height > rowH) rowH = r.height;
    }
    return rows.length ? { rows, rowH: rowH || 28 } : null;
  };

  /**
   * Insertion index (top-first) for a pointer Y. The cached row boxes are in
   * the viewport space of the drag's first frame, so the list's scroll travel
   * since then is added back — auto-scrolling cannot desync the drop target.
   */
  const overIndexAt = (d: RowDrag, clientY: number): number => {
    const y = clientY + ((listRef.current?.scrollTop ?? 0) - d.scroll0);
    let i = d.rows.length;
    for (let k = 0; k < d.rows.length; k++) {
      if (y < d.rows[k].top + d.rows[k].h / 2) {
        i = k;
        break;
      }
    }
    return Math.max(0, Math.min(d.rows.length - 1, i));
  };

  /* auto-scroll while the pointer waits near either edge of the list */
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
    const over = overIndexAt(d, lastY.current);
    if (over !== d.over) setDrag({ ...d, over });
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

  const { begin, end, handleLeave } = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    enabled: () => draggable && !!armedKey.current,
    onStart: (e) => {
      const key = armedKey.current;
      if (!key) return;
      const from = visIndexOf.get(key);
      const measured = measureRows();
      if (from === undefined || !measured) return;
      setDrag({
        key,
        from,
        over: from,
        x: e.clientX,
        y: e.clientY,
        rowH: measured.rowH,
        scroll0: listRef.current?.scrollTop ?? 0,
        rows: measured.rows,
      });
    },
    onMove: (e) => {
      const d = dragRef.current;
      if (!d) return;
      setDrag({ ...d, over: overIndexAt(d, e.clientY), x: e.clientX, y: e.clientY });
      edgeScroll(e.clientY);
    },
    onEnd: (moved, e) => {
      const d = dragRef.current;
      armedKey.current = null;
      stopEdge();
      setDrag(null);
      if (!d || !moved || !onMoveTo) return; // a press that never travelled is a click
      /**
       * Only a real release commits the drop. pointercancel, a lost pointer
       * capture, window blur and a hidden tab all end the gesture WITHOUT the
       * user ever letting go over the list, so the row snaps back instead of
       * landing somewhere it was never aimed at.
       */
      if (!e || e.type !== "pointerup") return;
      const ref = parseLayerKey(d.key);
      if (!ref) return;
      const slot = dropSlot(visRows.length, d.from, d.over);
      if (slot !== null) onMoveTo(ref, slot);
      /**
       * The layer you just carried is the one you are working on, so the drop
       * also selects it on the canvas (outline, handles and its arrange tools).
       * Deliberately AFTER the gesture ended: selecting mid-drag could swap the
       * panel underneath the list and tear the gesture down.
       */
      onSelect(ref);
    },
  });

  /** how far a row travels to open the landing gap (Canva-style preview) */
  const shiftFor = (visIndex: number): number => {
    if (!drag) return 0;
    const { from, over, rowH } = drag;
    if (over < from) return visIndex >= over && visIndex < from ? rowH : 0;
    if (over > from) return visIndex > from && visIndex <= over ? -rowH : 0;
    return 0;
  };

  /** keep the selected row in view when the canvas drives the selection */
  useEffect(() => {
    const list = listRef.current;
    if (!list || !selKey || dragRef.current) return;
    const row = rowEls.current.get(selKey);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const c = list.getBoundingClientRect();
    if (r.height <= 0 || c.height <= 0) return;
    if (r.top < c.top) list.scrollTop -= c.top - r.top + 4;
    else if (r.bottom > c.bottom) list.scrollTop += r.bottom - c.bottom + 4;
  }, [selKey, layers.length]);

  /** roving tabindex: the selection, or the first row, is the list's tab stop */
  const focusIndex = Math.max(0, layers.findIndex((l) => l.key === selKey));
  const focusRow = (i: number) => {
    const key = layers[Math.max(0, Math.min(layers.length - 1, i))]?.key;
    if (key) rowEls.current.get(key)?.focus();
  };

  const dragEntry = drag ? layers.find((l) => l.key === drag.key) : null;

  return (
    <div className="space-y-2">
      {/* four ops for the selected layer */}
      <div className="grid grid-cols-2 gap-1.5">
        {(["forward", "front", "backward", "back"] as ZOp[]).map((op) => {
          const enabled = !!selKey && canMove(stack, selKey, op);
          return (
            <button
              key={op}
              disabled={!enabled}
              onClick={() => selected && onReorder(selected, op)}
              title={Z_LABELS[op].hint}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                enabled
                  ? "border-white/10 bg-white/[0.04] text-slate-200 hover:border-amber-400/60 hover:bg-white/10"
                  : "cursor-not-allowed border-white/5 text-slate-600",
              )}
            >
              <span className="w-4 text-center">{Z_LABELS[op].icon}</span>
              {Z_LABELS[op].label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------ free alignment ------------------------- */}
      {onAlign && (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-slate-900/40 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Align selected</span>
            <div className="w-36">
              <SegButtons
                value={alignTo}
                onChange={setAlignTo}
                options={[
                  { value: "slide", label: "to slide" },
                  { value: "item", label: "to item" },
                ]}
              />
            </div>
          </div>
          {alignTo === "item" && (
            <select
              value={refKey}
              onChange={(e) => setRefKey(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none"
            >
              <option value="">— choose reference item —</option>
              {layers
                .filter((l) => l.key !== selKey && !l.hidden)
                .map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.icon} {l.label}
                  </option>
                ))}
            </select>
          )}
          {(() => {
            const refRef = alignTo === "item" ? parseLayerKey(refKey) : null;
            const target: LayerRect | undefined =
              alignTo === "item" ? (refRef ? layerRect(deck, slide, refRef, measureElement) ?? undefined : undefined) : undefined;
            const disabled = !selected || (alignTo === "item" && !target);
            const run = (op: AlignOp) => selected && onAlign(selected, op, target);
            const B = ({ op, label, title }: { op: AlignOp; label: string; title: string }) => (
              <button
                disabled={disabled}
                onClick={() => run(op)}
                title={title}
                className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10 disabled:opacity-30"
              >
                {label}
              </button>
            );
            return (
              <>
                <div className="grid grid-cols-6 gap-1">
                  <B op="left" label="⇤" title="Align left edges" />
                  <B op="hcenter" label="⫿" title="Center horizontally" />
                  <B op="right" label="⇥" title="Align right edges" />
                  <B op="top" label="⤒" title="Align top edges" />
                  <B op="vcenter" label="⩵" title="Center vertically" />
                  <B op="bottom" label="⤓" title="Align bottom edges" />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <B op="fill-w" label="↔ Fill W" title="Match the reference width" />
                  <B op="fill-h" label="↕ Fill H" title="Match the reference height" />
                  {alignTo === "slide" ? (
                    <B op="fit-board" label="⛶ Fill slide" title="Cover the whole slide" />
                  ) : (
                    <button
                      disabled={disabled}
                      onClick={() => {
                        if (!selected || !target) return;
                        onAlign(selected, "left", target);
                        onAlign(selected, "top", target);
                        onAlign(selected, "fill-w", target);
                        onAlign(selected, "fill-h", target);
                      }}
                      className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60 disabled:opacity-30"
                    >
                      ⧉ Match
                    </button>
                  )}
                </div>
              </>
            );
          })()}

          {/* distribute a picked set */}
          {onDistribute && layers.filter((l) => !l.hidden).length >= 3 && (
            <details className="rounded-md border border-white/10 p-2">
              <summary className="cursor-pointer text-[11px] text-slate-300">
                Distribute evenly {picked.length ? `(${picked.length} picked)` : ""}
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {layers
                  .filter((l) => !l.hidden)
                  .map((l) => {
                    const on = picked.includes(l.key);
                    return (
                      <button
                        key={l.key}
                        onClick={() => setPicked((p) => (on ? p.filter((k) => k !== l.key) : [...p, l.key]))}
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          on ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-400 hover:bg-white/5",
                        )}
                      >
                        {l.icon} {l.label.slice(0, 14)}
                      </button>
                    );
                  })}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <button
                  disabled={picked.length < 3}
                  onClick={() => onDistribute(picked.map(parseLayerKey).filter((r): r is LayerRef => !!r), "h")}
                  className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60 disabled:opacity-30"
                >
                  ⋯ Horizontally
                </button>
                <button
                  disabled={picked.length < 3}
                  onClick={() => onDistribute(picked.map(parseLayerKey).filter((r): r is LayerRef => !!r), "v")}
                  className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60 disabled:opacity-30"
                >
                  ⋮ Vertically
                </button>
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {selEntry ? (
            <>
              <b className="text-slate-300">{selEntry.label}</b> · layer {pos} of {layers.length}
              {pos === layers.length ? " · top" : pos === 1 ? " · bottom" : ""}
            </>
          ) : (
            "Select an item on the slide or in the list"
          )}
        </span>
        <span>top ↑</span>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Layers on this slide"
        data-layer-list
        data-dragging={drag ? drag.key : undefined}
        data-drop-index={drag ? drag.over : undefined}
        className={cn(
          "space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-1",
          compact ? "max-h-48" : expanded ? "max-h-[56vh]" : "max-h-72",
          drag && "select-none border-amber-400/40",
        )}
      >
        {layers.map((l, i) => {
          const isSel = l.key === selKey;
          const isElement = l.ref.kind === "element";
          const vi = visIndexOf.get(l.key);
          const isDragged = drag?.key === l.key;
          const shift = vi === undefined || isDragged ? 0 : shiftFor(vi);
          const inMulti =
            !isSel && l.ref.kind === "shape" && (selectedIds ?? []).includes(l.ref.id);
          return (
            <div
              key={l.key}
              ref={(el) => {
                if (el) rowEls.current.set(l.key, el);
                else rowEls.current.delete(l.key);
              }}
              role="option"
              aria-selected={isSel}
              tabIndex={i === focusIndex ? 0 : -1}
              data-layer-row={l.key}
              data-layer-dragging={isDragged ? "true" : undefined}
              data-layer-hidden={l.hidden ? "true" : undefined}
              title={
                l.hidden
                  ? "Not painted on this slide — nothing to reorder"
                  : draggable
                    ? "Drag to reorder · click to select it on the slide · Alt+↑/↓ to move one step"
                    : "Click to select it on the slide"
              }
              style={{
                position: "relative",
                zIndex: isDragged ? 1 : shift ? 3 : 2,
                transform: shift ? `translateY(${shift}px)` : undefined,
                transition: shift ? "transform 120ms ease" : undefined,
                opacity: isDragged ? 0.3 : undefined,
              }}
              className={cn(
                "group flex items-center gap-2 rounded-md px-1.5 py-1 text-xs outline-none",
                isSel
                  ? "bg-amber-400/20 text-amber-100"
                  : inMulti
                    ? "bg-sky-400/10 text-sky-100"
                    : "text-slate-300 hover:bg-white/5",
                "focus-visible:ring-1 focus-visible:ring-amber-400/70",
                l.hidden && "opacity-40",
                isDragged && "border border-dashed border-amber-400/60",
                draggable && !l.hidden && "cursor-grab active:cursor-grabbing",
              )}
              onPointerDown={(e) => {
                if (!draggable || l.hidden) return;
                // the row's own quick-op buttons keep their clicks (no capture, no drag)
                if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea, a")) return;
                armedKey.current = l.key;
                begin(e, { x: 0, y: 0 });
              }}
              onPointerUp={end}
              onPointerCancel={end}
              /* a release outside the row must not leave an armed gesture behind;
                 while the button is still held the window listeners keep the drag */
              onPointerLeave={handleLeave}
              onClick={(e) => {
                if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea")) return;
                onSelect(l.ref);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(l.ref);
                  return;
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const dir = e.key === "ArrowDown" ? 1 : -1;
                  if (e.altKey && !l.hidden) {
                    // Alt+↑/↓ = Bring Forward / Send Backward, without a drag
                    onReorder(l.ref, dir === -1 ? "forward" : "backward");
                    window.setTimeout(() => rowEls.current.get(l.key)?.focus(), 0);
                    return;
                  }
                  focusRow(i + dir);
                  return;
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  focusRow(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  focusRow(layers.length - 1);
                }
              }}
            >
              {/* the grip: touch-action none here, so a touch drag reorders
                  instead of scrolling the list (the rest of the row still scrolls) */}
              <span
                aria-hidden="true"
                style={{ touchAction: draggable && !l.hidden ? "none" : undefined }}
                className={cn(
                  "shrink-0 text-[11px] leading-none text-slate-600 group-hover:text-slate-400",
                  draggable && !l.hidden ? "opacity-70" : "opacity-0",
                )}
              >
                ⠿
              </span>
              <span className="w-7 shrink-0 font-mono text-[9px] text-slate-600">
                {i === 0 ? "top" : i === layers.length - 1 ? "btm" : layers.length - i}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px]",
                    isElement ? "bg-sky-400/15 text-sky-200" : "bg-white/10 text-slate-200",
                  )}
                  title={isElement ? "Slide element" : "Drawn item"}
                >
                  {l.icon}
                </span>
                <span className="truncate">{l.label}</span>
                {l.hidden && <span className="text-[9px] text-slate-500">(hidden)</span>}
                {!!l.groupId && (
                  <span className="shrink-0 text-[9px] text-sky-300" title="Part of a group — clicking this row selects the item alone">
                    ⧉
                  </span>
                )}
              </span>
              {l.global && !isElement && <span className="rounded bg-black/30 px-1 text-[8px]">ALL</span>}
              {l.ref.kind === "shape" && onToggleLock && (
                <button
                  onClick={() => onToggleLock(l.ref.id)}
                  title={l.locked ? "Unlock" : "Lock"}
                  aria-label={l.locked ? `Unlock ${l.label}` : `Lock ${l.label}`}
                  className={cn("text-[11px]", l.locked ? "text-amber-300" : "text-slate-600 opacity-0 group-hover:opacity-100")}
                >
                  {l.locked ? "🔒" : "🔓"}
                </button>
              )}
              {/* inline quick ops on hover */}
              <div className="hidden shrink-0 gap-0.5 group-hover:flex">
                <button
                  disabled={!canMove(stack, l.key, "forward")}
                  onClick={() => onReorder(l.ref, "forward")}
                  title="Bring Forward"
                  aria-label={`Bring ${l.label} forward`}
                  className="rounded px-1 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  disabled={!canMove(stack, l.key, "backward")}
                  onClick={() => onReorder(l.ref, "backward")}
                  title="Send Backward"
                  aria-label={`Send ${l.label} backward`}
                  className="rounded px-1 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* the row being carried, following the cursor (never intercepts pointer events) */}
      {drag && dragEntry && (
        <div
          data-layer-drag-chip={dragEntry.key}
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md border border-amber-400/70 bg-slate-900/95 px-2 py-1 text-xs text-amber-100 shadow-lg shadow-black/50"
          style={{ left: drag.x + 14, top: drag.y - 15, maxWidth: 260 }}
        >
          <span aria-hidden="true" className="text-[11px] text-slate-500">
            ⠿
          </span>
          <span className="truncate">{dragEntry.label}</span>
          <span className="shrink-0 rounded bg-amber-400/20 px-1 text-[9px] text-amber-200">
            layer {visRows.length - drag.over} of {visRows.length}
          </span>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        {draggable
          ? "Drag a row to reorder the stack, or click it to select that item on the slide. "
          : "Click a row to select that item on the slide. "}
        Blue icons are slide elements (header, question, options…), grey are drawn items. They share one stack, so a
        shape can go under the question or the title can sit over an image.
      </p>
    </div>
  );
}
