import type { Deck, SlideData } from "../lib/types";
import { useState } from "react";
import { layerKey, layerRect, parseLayerKey, sortedLayers, type LayerRect, type LayerRef } from "../lib/layers";
import { measureElement } from "../lib/layoutMeasure";
import type { AlignOp } from "../lib/shapeAlign";
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
  compact?: boolean;
}

/**
 * One list for everything on the slide — header pieces, question, options,
 * footnote, shapes, text boxes and images — top-most first, with the four
 * layer operations. Click a row to select it on the canvas.
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
  compact,
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

      <div className={cn("space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-1", compact ? "max-h-48" : "max-h-72")}>
        {layers.map((l, i) => {
          const isSel = l.key === selKey;
          const isElement = l.ref.kind === "element";
          return (
            <div
              key={l.key}
              className={cn(
                "group flex items-center gap-2 rounded-md px-1.5 py-1 text-xs",
                isSel ? "bg-amber-400/20 text-amber-100" : "text-slate-300 hover:bg-white/5",
                l.hidden && "opacity-40",
              )}
            >
              <span className="w-7 shrink-0 font-mono text-[9px] text-slate-600">
                {i === 0 ? "top" : i === layers.length - 1 ? "btm" : layers.length - i}
              </span>
              <button onClick={() => onSelect(l.ref)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
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
              </button>
              {l.global && !isElement && <span className="rounded bg-black/30 px-1 text-[8px]">ALL</span>}
              {l.ref.kind === "shape" && onToggleLock && (
                <button
                  onClick={() => onToggleLock(l.ref.id)}
                  title={l.locked ? "Unlock" : "Lock"}
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
                  className="rounded px-1 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  disabled={!canMove(stack, l.key, "backward")}
                  onClick={() => onReorder(l.ref, "backward")}
                  title="Send Backward"
                  className="rounded px-1 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        Blue icons are slide elements (header, question, options…), grey are drawn items. They share one stack, so a
        shape can go under the question or the title can sit over an image.
      </p>
    </div>
  );
}
