import type { Deck, ElementId, SlideData } from "../lib/types";
import { useEffect, useRef, useState } from "react";
import {
  dropSlot,
  isStackable,
  layerKey,
  layerRect,
  parseLayerKey,
  sortedLayers,
  type LayerEntry,
  type LayerPatch,
  type LayerRect,
  type LayerRef,
} from "../lib/layers";
import { measureElement } from "../lib/layoutMeasure";
import type { AlignOp } from "../lib/shapeAlign";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "../lib/dragSession";
import { SegButtons } from "./ui";
import LayerThumb from "./LayerThumb";
import { canMove, Z_LABELS, type ZOp } from "../lib/zorder";
import { cn } from "../utils/cn";

interface Props {
  deck: Deck;
  slide: SlideData | undefined;
  selected: LayerRef | null;
  onSelect: (ref: LayerRef, additive?: boolean) => void;
  onReorder: (ref: LayerRef, op: ZOp) => void;
  onAlign?: (ref: LayerRef, op: AlignOp, target?: LayerRect) => void;
  onDistribute?: (refs: LayerRef[], axis: "h" | "v") => void;
  /**
   * Drag & drop: called once per drop with the layer(s) and the stack slot they
   * land in (counted from the BOTTOM, over the stackable rows). Absent → the
   * list is read-only and rows cannot be dragged.
   */
  onMoveTo?: (refs: LayerRef[], index: number) => void;
  /** 👁 / 🔒 / rename — works on elements and drawn items alike */
  onPatch?: (refs: LayerRef[], patch: LayerPatch) => void;
  /** ⧉ duplicate the given layers (drawn items only) */
  onDuplicate?: (refs: LayerRef[]) => void;
  /** 🗑 delete drawn items — a built-in element is hidden instead */
  onDelete?: (refs: LayerRef[]) => void;
  /** every drawn item selected on the canvas, so a group lights up as a whole */
  selectedIds?: string[];
  compact?: boolean;
  /** rendered as its own navigation destination: a taller list */
  expanded?: boolean;
}

/** the live state of one row drag (mirrored into a ref for the gesture handlers) */
interface RowDrag {
  key: string;
  /** every row travelling with this gesture (a multi-selection drags as a block) */
  keys: string[];
  /** the dragged row, top-first among the STACKABLE rows */
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
 * footnote, shapes, text boxes and images — top-most first, with the full set
 * of Canva layer controls.
 *
 * Clicking a row selects that element / shape on the canvas; dragging a row
 * carries it to any slot in the stack and reorders on drop. Each row also
 * carries 👁 show/hide, 🔒 lock/unlock, ⧉ duplicate and 🗑 delete, plus
 * rename-on-double-click for drawn items. The reorder runs through the same
 * guarded pointer session as the board, so a click can never move a layer and a
 * drag never leaks past pointer-up.
 */
export default function LayersPanel({
  deck,
  slide,
  selected,
  onSelect,
  onReorder,
  onAlign,
  onDistribute,
  onMoveTo,
  onPatch,
  onDuplicate,
  onDelete,
  selectedIds,
  compact,
  expanded,
}: Props) {
  const [alignTo, setAlignTo] = useState<"slide" | "item">("slide");
  const [refKey, setRefKey] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const layers = sortedLayers(deck, slide).slice().reverse(); // top first
  // ops are decided on the rows that belong to this slide's stack; layers the
  // user hid with 👁 keep their slot and can still be reordered (like Canva)
  const stack = layers.filter(isStackable).map((l) => ({ id: l.key, z: l.z }));
  const selKey = selected ? layerKey(selected) : null;
  const selEntry = layers.find((l) => l.key === selKey);
  const pos = selEntry ? layers.length - layers.indexOf(selEntry) : 0;

  /** rows that can actually be reordered: rows not painted on this slide cannot */
  const visRows = layers.filter(isStackable);
  const visIndexOf = new Map(visRows.map((l, i) => [l.key, i]));
  const draggable = !!onMoveTo && visRows.length > 1;

  /** the full canvas selection, as row keys — a multi-selection drags as one block */
  const selKeys = new Set<string>([
    ...(selectedIds ?? []).map((id) => `shape:${id}`),
    ...(selKey ? [selKey] : []),
  ]);
  /** the refs a row-level action applies to: the whole selection, or just that row */
  const targetsOf = (l: LayerEntry): LayerRef[] =>
    selKeys.has(l.key) && selKeys.size > 1
      ? visRows.filter((r) => selKeys.has(r.key)).map((r) => r.ref)
      : [l.ref];

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
      /**
       * A multi-selection travels as one block, keeping its internal order —
       * exactly like dragging several layers in Canva. Dragging a row that is
       * NOT part of the selection carries that row alone.
       */
      const keys = selKeys.has(key) && selKeys.size > 1 ? visRows.filter((r) => selKeys.has(r.key)).map((r) => r.key) : [key];
      setDrag({
        key,
        keys,
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
      const refs = d.keys.map(parseLayerKey).filter((r): r is LayerRef => !!r);
      if (!refs.length) return;
      const slot = dropSlot(visRows.length, d.from, d.over, d.keys.length);
      if (slot !== null) onMoveTo(refs, slot);
      /**
       * The layer you just carried is the one you are working on, so the drop
       * also selects it on the canvas (outline, handles and its arrange tools).
       * Deliberately AFTER the gesture ended: selecting mid-drag could swap the
       * panel underneath the list and tear the gesture down.
       */
      const ref = parseLayerKey(d.key);
      if (ref) onSelect(ref);
    },
  });

  /**
   * How far each row travels to open the landing gap (Canva-style preview).
   *
   * Exact for any number of carried rows, contiguous or not: the rows that stay
   * put keep their relative order, the block lands on `over`, and each row's
   * shift is simply the distance between where it is now and where the drop
   * would put it.
   */
  const shiftFor = (() => {
    if (!drag) return () => 0;
    const moving = new Set(drag.keys.map((k) => visIndexOf.get(k)).filter((i): i is number => i !== undefined));
    const m = moving.size || 1;
    const over = Math.max(0, Math.min(visRows.length - m, drag.over));
    /** final top-index of every row that stays put, by its current index */
    const target = new Map<number, number>();
    let p = 0;
    for (let i = 0; i < visRows.length; i++) {
      if (moving.has(i)) continue;
      target.set(i, p < over ? p : p + m);
      p++;
    }
    return (visIndex: number): number => {
      const to = target.get(visIndex);
      return to === undefined ? 0 : (to - visIndex) * drag.rowH;
    };
  })();

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
  const layout = deck.theme.layout;

  /* ------------------------------------------------------------------ row */
  /** one hover/selected action button, sized for the dense list */
  const RowBtn = ({
    on,
    label,
    title,
    onClick,
    always,
    danger,
    disabled,
  }: {
    on?: boolean;
    label: string;
    title: string;
    onClick: () => void;
    /** stay visible even when the row is not hovered (state that must be seen) */
    always?: boolean;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] leading-none transition-colors",
        always || on ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        disabled && "cursor-not-allowed opacity-25 grayscale",
        on
          ? "text-amber-300 hover:bg-amber-400/15"
          : danger
            ? "text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
            : "text-slate-400 hover:bg-white/10 hover:text-slate-100",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* ------------------------------ toolbar ------------------------------ */}
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/50 p-1">
        {(["front", "forward", "backward", "back"] as ZOp[]).map((op) => {
          const enabled = !!selKey && canMove(stack, selKey, op);
          return (
            <button
              key={op}
              type="button"
              disabled={!enabled}
              onClick={() => selected && onReorder(selected, op)}
              title={`${Z_LABELS[op].label} — ${Z_LABELS[op].hint}`}
              aria-label={Z_LABELS[op].label}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md text-xs transition-colors",
                enabled ? "text-slate-200 hover:bg-white/10" : "cursor-not-allowed text-slate-700",
              )}
            >
              {Z_LABELS[op].icon}
            </button>
          );
        })}
        <span className="mx-0.5 h-5 w-px bg-white/10" />
        {onPatch && (
          <>
            <RowBtn
              always
              disabled={!selEntry || !!selEntry.absent}
              on={!!selEntry?.hidden}
              label={selEntry?.hidden ? "🙈" : "👁"}
              title={selEntry?.hidden ? "Show this layer" : "Hide this layer"}
              onClick={() => selEntry && onPatch(targetsOf(selEntry), { hidden: !selEntry.hidden })}
            />
            <RowBtn
              always
              disabled={!selEntry || !!selEntry.absent}
              on={!!selEntry?.locked}
              label={selEntry?.locked ? "🔒" : "🔓"}
              title={selEntry?.locked ? "Unlock this layer" : "Lock this layer"}
              onClick={() => selEntry && onPatch(targetsOf(selEntry), { locked: !selEntry.locked })}
            />
          </>
        )}
        {onDuplicate && (
          <RowBtn
            always
            disabled={selEntry?.ref.kind !== "shape"}
            label="⧉"
            title={
              selEntry?.ref.kind === "element"
                ? "Built-in slide elements can't be duplicated"
                : "Duplicate this layer"
            }
            onClick={() => selEntry && onDuplicate(targetsOf(selEntry))}
          />
        )}
        {onDelete && (
          <RowBtn
            always
            danger
            disabled={!selEntry || !!selEntry.absent}
            label="🗑"
            title={
              selEntry?.ref.kind === "element"
                ? "Hide this layer — built-in elements can't be deleted"
                : "Delete this layer"
            }
            onClick={() => selEntry && onDelete(targetsOf(selEntry))}
          />
        )}
        <span className="ml-auto pr-1 text-[10px] whitespace-nowrap text-slate-500">
          {selKeys.size > 1 ? `${selKeys.size} selected` : selEntry ? `${pos} of ${layers.length}` : `${layers.length} layers`}
        </span>
      </div>

      {/* --------------------------- align & distribute ---------------------- */}
      {onAlign && (
        <details
          open={arrangeOpen}
          onToggle={(e) => setArrangeOpen((e.currentTarget as HTMLDetailsElement).open)}
          className="rounded-lg border border-white/10 bg-slate-900/40"
        >
          <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase select-none hover:text-slate-200">
            {arrangeOpen ? "▾" : "▸"} Align &amp; distribute
          </summary>
          <div className="space-y-1.5 border-t border-white/10 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Align selected</span>
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
                  .filter((l) => l.key !== selKey && isStackable(l))
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
                  type="button"
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
                        type="button"
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
            {onDistribute && visRows.length >= 3 && (
              <details className="rounded-md border border-white/10 p-2">
                <summary className="cursor-pointer text-[11px] text-slate-300">
                  Distribute evenly {picked.length ? `(${picked.length} picked)` : ""}
                </summary>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {visRows.map((l) => {
                    const on = picked.includes(l.key);
                    return (
                      <button
                        key={l.key}
                        type="button"
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
                    type="button"
                    disabled={picked.length < 3}
                    onClick={() => onDistribute(picked.map(parseLayerKey).filter((r): r is LayerRef => !!r), "h")}
                    className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60 disabled:opacity-30"
                  >
                    ⋯ Horizontally
                  </button>
                  <button
                    type="button"
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
        </details>
      )}

      <div className="flex items-center justify-between px-0.5 text-[10px] tracking-wide text-slate-500 uppercase">
        <span>Top layer</span>
        {selEntry && (
          <span className="normal-case">
            <b className="text-slate-300">{selEntry.label}</b>
            {pos === layers.length ? " · front" : pos === 1 ? " · back" : ""}
          </span>
        )}
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Layers on this slide"
        aria-multiselectable="true"
        data-layer-list
        data-dragging={drag ? drag.key : undefined}
        data-drop-index={drag ? drag.over : undefined}
        className={cn(
          "space-y-px overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-1",
          compact ? "max-h-56" : expanded ? "max-h-[58vh]" : "max-h-80",
          drag && "select-none border-amber-400/40",
        )}
      >
        {layers.map((l, i) => {
          const isSel = l.key === selKey;
          const isElement = l.ref.kind === "element";
          const vi = visIndexOf.get(l.key);
          const isDragged = !!drag?.keys.includes(l.key);
          const shift = vi === undefined || isDragged ? 0 : shiftFor(vi);
          const inMulti = !isSel && selKeys.has(l.key);
          const canDrag = draggable && isStackable(l);
          const isRenaming = renaming === l.key;
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
              data-layer-absent={l.absent ? "true" : undefined}
              data-layer-hidden={l.hidden ? "true" : undefined}
              data-layer-locked={l.locked ? "true" : undefined}
              title={
                l.absent
                  ? "Not on this slide — nothing to reorder"
                  : canDrag
                    ? "Drag to reorder · click to select it on the slide · Alt+↑/↓ to move one step"
                    : "Click to select it on the slide"
              }
              style={{
                position: "relative",
                zIndex: isDragged ? 1 : shift ? 3 : 2,
                transform: shift ? `translateY(${shift}px)` : undefined,
                transition: shift ? "transform 120ms ease" : undefined,
                opacity: isDragged ? 0.35 : undefined,
              }}
              className={cn(
                "group flex items-center gap-1.5 rounded-md border border-transparent px-1 py-1 text-xs outline-none",
                isSel
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                  : inMulti
                    ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
                    : "text-slate-300 hover:bg-white/5",
                "focus-visible:ring-1 focus-visible:ring-amber-400/70",
                l.absent && "opacity-40",
                l.hidden && !l.absent && "opacity-60",
                isDragged && "border-dashed border-amber-400/60",
                canDrag && "cursor-grab active:cursor-grabbing",
              )}
              onPointerDown={(e) => {
                if (!canDrag) return;
                // the row's own buttons and the rename box keep their events
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
                // Ctrl/⌘/Shift+click extends the selection, exactly like the canvas
                onSelect(l.ref, e.ctrlKey || e.metaKey || e.shiftKey);
              }}
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement | null)?.closest("button, input")) return;
                // double-click renames a drawn item (built-ins keep their labels)
                if (l.ref.kind === "shape" && onPatch) setRenaming(l.key);
              }}
              onKeyDown={(e) => {
                if (isRenaming) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(l.ref);
                  return;
                }
                if (e.key === "F2" && l.ref.kind === "shape" && onPatch) {
                  e.preventDefault();
                  setRenaming(l.key);
                  return;
                }
                if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
                  e.preventDefault();
                  onDelete(targetsOf(l));
                  return;
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const dir = e.key === "ArrowDown" ? 1 : -1;
                  if (e.altKey && isStackable(l)) {
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
                style={{ touchAction: canDrag ? "none" : undefined }}
                className={cn(
                  "shrink-0 px-0.5 text-[11px] leading-none text-slate-600 group-hover:text-slate-400",
                  canDrag ? "opacity-70" : "opacity-0",
                )}
              >
                ⠿
              </span>

              {/* the preview: what this layer actually looks like */}
              <LayerThumb
                shape={l.shape}
                elementId={isElement ? (l.ref.id as ElementId) : undefined}
                box={isElement ? layout[l.ref.id as ElementId] : undefined}
                dim={l.hidden || l.absent}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={l.label}
                    aria-label={`Rename ${l.label}`}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      onPatch?.([l.ref], { name: e.currentTarget.value.trim() });
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        onPatch?.([l.ref], { name: e.currentTarget.value.trim() });
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="w-full rounded border border-amber-400/60 bg-slate-950/80 px-1 py-0.5 text-xs text-slate-100 outline-none"
                  />
                ) : (
                  <span className="flex items-center gap-1">
                    <span className={cn("truncate", l.hidden && "line-through decoration-slate-500")}>{l.label}</span>
                    {l.absent && <span className="shrink-0 text-[9px] text-slate-500">(not on slide)</span>}
                    {!!l.groupId && (
                      <span className="shrink-0 text-[9px] text-sky-300" title="Part of a group — clicking this row selects the item alone">
                        ⧉
                      </span>
                    )}
                    {l.global && !isElement && (
                      <span className="shrink-0 rounded bg-black/40 px-1 text-[8px] text-slate-400" title="On every slide">
                        ALL
                      </span>
                    )}
                  </span>
                )}
              </span>

              {/* per-row controls — the state ones stay visible, the rest on hover.
                  A row that is not on this slide has nothing to act on. */}
              {!isRenaming && !l.absent && (
                <span className="flex shrink-0 items-center">
                  {/* move up / move down, one slot at a time */}
                  <button
                    type="button"
                    disabled={!canMove(stack, l.key, "forward")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(l.ref, "forward");
                    }}
                    title="Bring Forward"
                    aria-label={`Bring ${l.label} forward`}
                    className="grid h-6 w-4 shrink-0 place-items-center rounded text-[9px] text-slate-400 opacity-0 hover:bg-white/10 hover:text-slate-100 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-0"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={!canMove(stack, l.key, "backward")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(l.ref, "backward");
                    }}
                    title="Send Backward"
                    aria-label={`Send ${l.label} backward`}
                    className="mr-0.5 grid h-6 w-4 shrink-0 place-items-center rounded text-[9px] text-slate-400 opacity-0 hover:bg-white/10 hover:text-slate-100 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-0"
                  >
                    ▼
                  </button>
                  {onPatch && (
                    <RowBtn
                      always={l.hidden}
                      on={l.hidden}
                      label={l.hidden ? "🙈" : "👁"}
                      title={l.hidden ? `Show ${l.label}` : `Hide ${l.label}`}
                      onClick={() => onPatch(targetsOf(l), { hidden: !l.hidden })}
                    />
                  )}
                  {onPatch && (
                    <RowBtn
                      always={l.locked}
                      on={l.locked}
                      label={l.locked ? "🔒" : "🔓"}
                      title={l.locked ? `Unlock ${l.label}` : `Lock ${l.label}`}
                      onClick={() => onPatch(targetsOf(l), { locked: !l.locked })}
                    />
                  )}
                  {onDuplicate && l.ref.kind === "shape" && (
                    <RowBtn label="⧉" title={`Duplicate ${l.label}`} onClick={() => onDuplicate(targetsOf(l))} />
                  )}
                  {onDelete && (l.ref.kind === "shape" || !l.hidden) && (
                    <RowBtn
                      danger
                      label="🗑"
                      title={
                        l.ref.kind === "shape"
                          ? `Delete ${l.label}`
                          : `Hide ${l.label} — built-in elements can't be deleted`
                      }
                      onClick={() => onDelete(targetsOf(l))}
                    />
                  )}
                </span>
              )}
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
          <LayerThumb
            shape={dragEntry.shape}
            elementId={dragEntry.ref.kind === "element" ? (dragEntry.ref.id as ElementId) : undefined}
            box={dragEntry.ref.kind === "element" ? layout[dragEntry.ref.id as ElementId] : undefined}
          />
          <span className="truncate">
            {dragEntry.label}
            {drag.keys.length > 1 ? ` +${drag.keys.length - 1}` : ""}
          </span>
          <span className="shrink-0 rounded bg-amber-400/20 px-1 text-[9px] text-amber-200">
            layer {visRows.length - drag.over} of {visRows.length}
          </span>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        {draggable ? "Drag a row anywhere in the stack to reorder it" : "Click a row to select that item on the slide"} ·
        click to select · double-click a drawn item to rename · 👁 hide · 🔒 lock · ⧉ duplicate · 🗑 delete.
        Blue previews are slide elements (header, question, options…), the rest are drawn items — they share one stack,
        so a shape can go under the question or the title can sit over an image.
      </p>
    </div>
  );
}
