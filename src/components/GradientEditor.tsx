import type { Gradient, GradientStop } from "../lib/types";
import { gradientCss } from "../lib/banner";
import { useState } from "react";
import { Field, SegButtons, Slider, Toggle } from "./ui";
import { ColorWheel, GradientAngleWheel } from "./GradientWheel";
import { cn } from "../utils/cn";

interface Props {
  value: Gradient;
  onChange: (g: Gradient) => void;
  /** shown in the preview when the gradient is disabled */
  fallback: string;
  label: string;
  presets?: { name: string; stops: GradientStop[]; angle: number }[];
}

const PALETTE = ["#1f5fd0", "#5b8cff", "#7c3aed", "#06b6d4", "#10b981", "#ffd633", "#f97316", "#ec4899", "#ef4444", "#ffffff", "#000000"];

export default function GradientEditor({ value, onChange, fallback, label, presets }: Props) {
  const g = value;
  const [activeStop, setActiveStop] = useState<number>(0);
  const [showWheel, setShowWheel] = useState(true);
  const set = (p: Partial<Gradient>) => onChange({ ...g, ...p });
  const setStop = (i: number, p: Partial<GradientStop>) =>
    set({ stops: g.stops.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const addStop = () => {
    const sorted = [...g.stops].sort((a, b) => a.at - b.at);
    const a = sorted[0]?.at ?? 0;
    const b = sorted[sorted.length - 1]?.at ?? 100;
    const at = Math.round((a + b) / 2);
    set({ stops: [...g.stops, { color: sorted[0]?.color ?? "#ffffff", at }] });
  };
  const removeStop = (i: number) => g.stops.length > 2 && set({ stops: g.stops.filter((_, j) => j !== i) });
  const reverse = () => set({ stops: g.stops.map((s) => ({ ...s, at: 100 - s.at })) });

  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Toggle label={label} checked={g.enabled} onChange={(v) => set({ enabled: v })} />

      {/* preview bar */}
      <div
        className="h-7 w-full rounded-lg border border-white/15"
        style={{ background: gradientCss(g.enabled ? g : { ...g, enabled: false }, fallback) }}
      />

      {g.enabled && (
        <>
          {presets && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => set({ stops: p.stops.map((s) => ({ ...s })), angle: p.angle })}
                  title={p.name}
                  className="h-6 w-10 rounded-md border border-white/15 hover:border-amber-400/70"
                  style={{ background: gradientCss({ enabled: true, type: "linear", angle: 90, stops: p.stops }, "#000") }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <SegButtons
              value={g.type}
              onChange={(v) => set({ type: v })}
              options={[
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" },
              ]}
            />
            <button onClick={reverse} title="Reverse colours" className="ml-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10">
              ⇄
            </button>
          </div>

          {/* gradient wheel: drag to set the direction */}
          <Field label="Direction wheel" hint={g.type === "radial" ? "radial" : `${g.angle}°`}>
            <GradientAngleWheel value={g} onChange={onChange} fallback={fallback} />
          </Field>

          {/* stops */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Colour stops</span>
              <button onClick={addStop} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10">
                + stop
              </button>
            </div>
            {[...g.stops]
              .map((s, i) => ({ s, i }))
              .sort((a, b) => a.s.at - b.s.at)
              .map(({ s, i }) => (
                <div
                  key={i}
                  onClick={() => setActiveStop(i)}
                  className={cn("flex items-center gap-1.5 rounded-md px-1 py-0.5", activeStop === i && "bg-amber-400/10 ring-1 ring-amber-400/40")}
                >
                  <button
                    onClick={() => {
                      setActiveStop(i);
                      setShowWheel(true);
                    }}
                    title="Edit this colour on the wheel"
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
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  title={`Set selected stop to ${c}`}
                  onClick={() => setStop(Math.min(activeStop, g.stops.length - 1), { color: c })}
                  className="h-4 w-4 rounded border border-black/40"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* colour wheel for the selected stop */}
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <button
              onClick={() => setShowWheel((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase"
            >
              <span>Colour wheel — stop {Math.min(activeStop, g.stops.length - 1) + 1}</span>
              <span>{showWheel ? "▾" : "▸"}</span>
            </button>
            {showWheel && g.stops[Math.min(activeStop, g.stops.length - 1)] && (
              <div className="mt-2">
                <ColorWheel
                  value={g.stops[Math.min(activeStop, g.stops.length - 1)].color}
                  onChange={(hex) => setStop(Math.min(activeStop, g.stops.length - 1), { color: hex })}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
