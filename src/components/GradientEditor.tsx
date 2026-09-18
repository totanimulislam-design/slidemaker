import { useLayoutEffect, useRef, useState } from "react";
import type { Gradient, GradientStop, GradientType } from "../lib/types";
import { gradientCss } from "../lib/banner";
import { GRADIENT_CATEGORIES, GRADIENT_PRESETS } from "../lib/gradientPresets";
import { Field, SegButtons, Slider, Toggle } from "./ui";
import { ColorWheel, GradientAngleWheel } from "./GradientWheel";
import { usePointerDrag } from "../lib/dragSession";
import { useFrameSend } from "../lib/frameSend";
import { cn } from "../utils/cn";

interface PresetInput {
  name: string;
  stops: GradientStop[];
  angle: number;
  type?: GradientType;
  cx?: number;
  cy?: number;
}

interface Props {
  value: Gradient;
  onChange: (g: Gradient) => void;
  /** shown in the preview when the gradient is disabled */
  fallback: string;
  label: string;
  /**
   * Compact preset row. When omitted, the full built-in gradient library
   * (pastel, blue, purple, sunset, mesh…) is shown instead.
   */
  presets?: PresetInput[];
}

const PALETTE = ["#1f5fd0", "#5b8cff", "#7c3aed", "#06b6d4", "#10b981", "#ffd633", "#f97316", "#ec4899", "#ef4444", "#ffffff", "#000000"];

const toHex6 = (c: string) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return "#ffffff";
  return m[1].length === 3 ? `#${m[1].split("").map((x) => x + x).join("")}`.toLowerCase() : c.toLowerCase();
};

export default function GradientEditor({ value, onChange, fallback, label, presets }: Props) {
  const g = value;
  const [activeStop, setActiveStop] = useState<number>(0);
  const [showWheel, setShowWheel] = useState(true);
  const [libCat, setLibCat] = useState<string>("All");
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragStop = useRef<number | null>(null);

  const set = (p: Partial<Gradient>) => onChange({ ...g, ...p });
  const sel = Math.min(activeStop, g.stops.length - 1);
  const selStop = g.stops[sel] ?? { color: "#ffffff", at: 50 };

  const setStop = (i: number, p: Partial<GradientStop>) =>
    set({ stops: g.stops.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  const addStopAt = (at: number, color?: string) => {
    if (g.stops.length >= 8) return;
    const stops = [...g.stops, { color: color ?? selStop.color, at: Math.max(0, Math.min(100, Math.round(at))) }];
    set({ stops });
    setActiveStop(stops.length - 1);
  };
  const addStop = () => {
    const sorted = [...g.stops].sort((a, b) => a.at - b.at);
    const a = sorted[0]?.at ?? 0;
    const b = sorted[sorted.length - 1]?.at ?? 100;
    addStopAt(Math.round((a + b) / 2));
  };
  const removeStop = (i: number) => {
    if (g.stops.length <= 2) return;
    set({ stops: g.stops.filter((_, j) => j !== i) });
    setActiveStop(0);
  };
  const reverse = () => set({ stops: g.stops.map((s) => ({ ...s, at: 100 - s.at })) });
  const shuffleMesh = () => {
    if (g.stops.length < 2) return;
    const colors = g.stops.map((s) => s.color);
    set({ stops: g.stops.map((s, i) => ({ ...s, color: colors[(i + 1) % colors.length] })) });
  };
  const applyPreset = (p: PresetInput) => {
    set({
      type: p.type ?? "linear",
      angle: p.angle,
      cx: p.cx ?? 50,
      cy: p.cy ?? 50,
      stops: p.stops.map((s) => ({ ...s })),
    });
    setActiveStop(0);
  };

  const atFromPointer = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
  };

  /**
   * Dragging a colour stop runs on the same Canva system as the picker: the
   * carried knob paints its position straight into the DOM in the event that
   * moved it (a render fed from the last flush may not know it yet), the bar's
   * box is measured once per press, and the deck is told at most once per
   * frame — one undoable write per frame instead of one per pointermove. A
   * press only GRABS the knob (it never jumps to the pointer) and the release
   * settles whatever the last move is still holding.
   */
  const barBox = useRef<DOMRect | null>(null);
  /** the position the carried knob is showing, which React may not know yet */
  const liveAt = useRef<number | null>(null);
  const knobEls = useRef<(HTMLDivElement | null)[]>([]);

  const sendAt = useFrameSend(({ i, at }: { i: number; at: number }) => setStop(i, { at }));

  const paintStop = (i: number, at: number) => {
    liveAt.current = at;
    const el = knobEls.current[i];
    if (el) el.style.left = `${at}%`;
  };

  const { begin: beginStop, release: releaseStop } = usePointerDrag({
    threshold: 0,
    enabled: () => dragStop.current !== null,
    onMove: (e) => {
      const i = dragStop.current;
      const rect = barBox.current;
      if (i === null || !rect) return;
      const at = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
      paintStop(i, at);
      sendAt.offer({ i, at });
    },
    onEnd: () => {
      const i = dragStop.current;
      dragStop.current = null;
      barBox.current = null;
      liveAt.current = null;
      if (i !== null) sendAt.flush(); // the release settles the position shown
    },
  });

  // while a knob is carried, its position is the pointer's — re-assert it after
  // any render (a no-op whenever React is current, and reads no layout)
  useLayoutEffect(() => {
    const i = dragStop.current;
    const at = liveAt.current;
    if (i !== null && at !== null) paintStop(i, at);
  });

  const commitHex = (raw: string) => {
    const v = raw.trim();
    const withHash = v.startsWith("#") ? v : `#${v}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) setStop(sel, { color: toHex6(withHash) });
    setHexDraft(null);
  };

  const libPresets = libCat === "All" ? GRADIENT_PRESETS : GRADIENT_PRESETS.filter((p) => p.category === libCat);

  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Toggle label={label} checked={g.enabled} onChange={(v) => set({ enabled: v })} />

      {/* live preview */}
      <div
        className="h-9 w-full rounded-lg border border-white/15"
        style={{ background: g.enabled ? gradientCss(g, fallback) : fallback }}
      />

      {g.enabled && (
        <>
          {/* ------------------------- preset library ------------------------- */}
          {presets ? (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  title={p.name}
                  className="h-7 w-12 rounded-md border border-white/15 hover:border-amber-400/70"
                  style={{
                    background: gradientCss(
                      { enabled: true, type: p.type ?? "linear", angle: p.angle, cx: p.cx ?? 50, cy: p.cy ?? 50, stops: p.stops },
                      "#000",
                    ),
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {["All", ...GRADIENT_CATEGORIES].map((c) => (
                  <button
                    key={c}
                    onClick={() => setLibCat(c)}
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      libCat === c
                        ? "border-amber-400 bg-amber-400 text-slate-950"
                        : "border-white/10 text-slate-400 hover:bg-white/10",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
                {libPresets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    title={`${p.name} (${p.type})`}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1 text-[9px] text-slate-300 hover:border-amber-400/60"
                  >
                    <span
                      className="h-7 w-full rounded border border-white/10"
                      style={{
                        background: gradientCss(
                          { enabled: true, type: p.type, angle: p.angle, cx: p.cx ?? 50, cy: p.cy ?? 50, stops: p.stops },
                          "#000",
                        ),
                      }}
                    />
                    <span className="w-full truncate text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------ type ------------------------------ */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <SegButtons
                value={g.type}
                onChange={(v) => set({ type: v })}
                options={[
                  { value: "linear", label: "Linear" },
                  { value: "radial", label: "Radial" },
                  { value: "mesh", label: "Mesh" },
                ]}
              />
            </div>
            <button
              onClick={g.type === "mesh" ? shuffleMesh : reverse}
              title={g.type === "mesh" ? "Shuffle mesh colours" : "Reverse colours"}
              className="shrink-0 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              {g.type === "mesh" ? "⤨" : "⇄"}
            </button>
          </div>

          {/* --------------------- direction / position ---------------------- */}
          {g.type === "linear" && (
            <Field label="Direction" hint={`${g.angle}°`}>
              <GradientAngleWheel value={g} onChange={onChange} fallback={fallback} />
            </Field>
          )}
          {g.type === "radial" && (
            <Field label="Glow centre" hint={`${g.cx ?? 50}% · ${g.cy ?? 50}%`}>
              <div className="grid grid-cols-3 gap-1">
                {[
                  [0, 0, "↖"], [50, 0, "↑"], [100, 0, "↗"],
                  [0, 50, "←"], [50, 50, "•"], [100, 50, "→"],
                  [0, 100, "↙"], [50, 100, "↓"], [100, 100, "↘"],
                ].map(([x, y, l]) => (
                  <button
                    key={l as string}
                    onClick={() => set({ cx: x as number, cy: y as number })}
                    className={cn(
                      "rounded-md border py-1.5 text-sm",
                      (g.cx ?? 50) === x && (g.cy ?? 50) === y
                        ? "border-amber-400 bg-amber-400 text-slate-950"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
                    )}
                  >
                    {l as string}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Slider min={0} max={100} value={g.cx ?? 50} onChange={(v) => set({ cx: v })} />
                <Slider min={0} max={100} value={g.cy ?? 50} onChange={(v) => set({ cy: v })} />
              </div>
            </Field>
          )}
          {g.type === "mesh" && (
            <p className="rounded-lg border border-white/10 bg-slate-900/40 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400">
              Mesh blends every colour stop into soft blobs over the first colour. Add stops for more blobs, ⤨ shuffles them.
            </p>
          )}

          {/* --------------------- visual stop editor ------------------------ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Colour stops</span>
              <button
                onClick={addStop}
                disabled={g.stops.length >= 8}
                className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30"
              >
                + stop
              </button>
            </div>
            <div
              ref={barRef}
              data-stop-bar=""
              onDoubleClick={(e) => addStopAt(atFromPointer(e.clientX))}
              title="Drag a knob to move it · double-click the bar to add a colour here"
              className="relative h-8 cursor-crosshair rounded-lg border border-white/15"
              style={{ background: gradientCss(g, fallback), touchAction: "none" }}
            >
              {g.stops.map((s, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    knobEls.current[i] = el;
                  }}
                  data-stop-knob={i}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveStop(i);
                    dragStop.current = i; // a press only grabs — it never jumps
                    barBox.current = barRef.current?.getBoundingClientRect() ?? null;
                    liveAt.current = s.at;
                    if (!beginStop(e)) {
                      dragStop.current = null;
                      barBox.current = null;
                      liveAt.current = null;
                    }
                  }}
                  onPointerUp={releaseStop}
                  onPointerCancel={releaseStop}
                  title={`${s.color} · ${s.at}% — drag to move`}
                  className={cn(
                    "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow active:cursor-grabbing",
                    sel === i ? "border-amber-300 ring-2 ring-amber-300/40" : "border-white/80",
                  )}
                  style={{ left: `${s.at}%`, background: s.color }}
                />
              ))}
            </div>

            {/* precise per-stop rows */}
            {[...g.stops]
              .map((s, i) => ({ s, i }))
              .sort((a, b) => a.s.at - b.s.at)
              .map(({ s, i }) => (
                <div
                  key={i}
                  onClick={() => setActiveStop(i)}
                  className={cn("flex items-center gap-1.5 rounded-md px-1 py-0.5", sel === i && "bg-amber-400/10 ring-1 ring-amber-400/40")}
                >
                  <button
                    onClick={() => {
                      setActiveStop(i);
                      setShowWheel(true);
                    }}
                    title="Edit this colour"
                    className="h-7 w-8 shrink-0 rounded border border-white/20"
                    style={{ background: s.color }}
                  />
                  <div className="flex-1">
                    <Slider min={0} max={100} value={s.at} onChange={(v) => setStop(i, { at: v })} />
                  </div>
                  <button
                    onClick={() => removeStop(i)}
                    disabled={g.stops.length <= 2}
                    className="shrink-0 rounded px-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-30"
                    title="Remove stop"
                  >
                    ✕
                  </button>
                </div>
              ))}

            {/* selected stop colour */}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/40 p-1.5">
              <input
                type="color"
                value={toHex6(selStop.color)}
                onChange={(e) => setStop(sel, { color: e.target.value })}
                title="Pick a colour"
                className="h-8 w-9 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0.5"
              />
              <input
                value={hexDraft ?? selStop.color.toUpperCase()}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => commitHex(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitHex((e.target as HTMLInputElement).value)}
                spellCheck={false}
                className="w-[76px] shrink-0 rounded-md border border-white/10 bg-slate-950/70 px-1.5 py-1 text-center font-mono text-[11px] text-slate-200 outline-none focus:border-amber-400/60"
              />
              <div className="flex flex-wrap gap-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    title={`Set selected stop to ${c}`}
                    onClick={() => setStop(sel, { color: c })}
                    className="h-4 w-4 rounded border border-black/40"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* the picker for the selected stop */}
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <button
              onClick={() => setShowWheel((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase"
            >
              <span>Colour picker — stop {sel + 1}</span>
              <span>{showWheel ? "▾" : "▸"}</span>
            </button>
            {showWheel && g.stops[sel] && (
              <div className="mt-2">
                <ColorWheel value={toHex6(g.stops[sel].color)} onChange={(hex) => setStop(sel, { color: hex })} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
