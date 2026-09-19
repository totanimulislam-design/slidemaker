import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { Gradient } from "../lib/types";
import { ColorWheel } from "./GradientWheel";
import { useColorFrame } from "../lib/frameSend";
import {
  CANVA_SOLID_DEFAULTS,
  CANVA_SOLID_ALL,
  CANVA_GRADIENT_DEFAULTS,
  CANVA_GRADIENT_ALL,
  gradientCssFor,
  swatchToGradient,
  type GradientSwatch,
} from "../lib/canvaColors";
import { gradientCss } from "../lib/banner";
import { cn } from "../utils/cn";

const normColor = (v: string): string => {
  const c = String(v ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  return "";
};

interface Props {
  /** current solid color hex (e.g. #ff0000) */
  solid: string;
  /** current gradient (if any) */
  gradient?: Gradient;
  /** called when a solid color is picked */
  onSolid: (hex: string) => void;
  /** called when a gradient is picked */
  onGradient: (g: Gradient) => void;
  /** clear gradient and go back to solid */
  onClearGradient?: () => void;
  /** optional document colors (from theme) */
  documentColors?: string[];
  /** title shown in panel header (optional, parent already has header) */
  title?: string;
}

type Tab = "solid" | "gradient";

export default function FontColorPanel({
  solid,
  gradient,
  onSolid,
  onGradient,
  onClearGradient,
  documentColors = [],
}: Props) {
  const [tab, setTab] = useState<Tab>(() => (gradient?.enabled ? "gradient" : "solid"));
  const [showAllSolids, setShowAllSolids] = useState(false);
  const [showAllGradients, setShowAllGradients] = useState(false);
  const [customHex, setCustomHex] = useState<string>(() => normColor(solid) || "#ffffff");
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  // sync customHex when solid changes externally (but not while user is typing)
  useEffect(() => {
    const n = normColor(solid);
    if (n && n !== customHex && hexDraft === null) {
      setCustomHex(n);
    }
  }, [solid]); // eslint-disable-line

  const solidChannel = useColorFrame(onSolid);

  const currentSolid = normColor(solid) || "#ffffff";
  const isGradientActive = !!gradient?.enabled;

  const solidList = useMemo(() => (showAllSolids ? CANVA_SOLID_ALL : CANVA_SOLID_DEFAULTS), [showAllSolids]);
  const gradientList = useMemo(
    () => (showAllGradients ? CANVA_GRADIENT_ALL : CANVA_GRADIENT_DEFAULTS),
    [showAllGradients]
  );

  const commitHex = useCallback(
    (raw: string) => {
      const v = raw.trim();
      const withHash = v.startsWith("#") ? v : `#${v}`;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) {
        const hex = normColor(withHash);
        if (hex) {
          setCustomHex(hex);
          onSolid(hex);
        }
      }
      setHexDraft(null);
    },
    [onSolid]
  );

  // For gradient preview CSS
  const activeGradientCss = useMemo(() => {
    if (gradient?.enabled) return gradientCss(gradient, currentSolid);
    return undefined;
  }, [gradient, currentSolid]);

  return (
    <div className="font-color-panel flex max-h-[72vh] w-[360px] flex-col gap-0 overflow-hidden rounded-xl border border-white/10 bg-[#1a1d29] shadow-2xl">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 bg-[#12141f] p-2">
        <button
          type="button"
          onClick={() => setTab("solid")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "solid" ? "bg-white text-slate-900 shadow" : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          )}
        >
          Solid
        </button>
        <button
          type="button"
          onClick={() => setTab("gradient")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "gradient" ? "bg-white text-slate-900 shadow" : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          )}
        >
          Gradient
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "solid" && (
          <div className="space-y-4">
            {/* Current + Gradient indicator */}
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-16 shrink-0 rounded-lg border border-white/15 shadow-inner"
                style={{ background: currentSolid }}
                title={currentSolid}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Current</p>
                <p className="truncate font-mono text-xs text-slate-200">{currentSolid.toUpperCase()}</p>
              </div>
              {isGradientActive && onClearGradient && (
                <button
                  type="button"
                  onClick={onClearGradient}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10"
                >
                  Use solid
                </button>
              )}
            </div>

            {/* Document colors */}
            {documentColors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Document colors</h4>
                <div className="grid grid-cols-7 gap-1.5">
                  {documentColors.slice(0, 14).map((c, i) => {
                    const hex = normColor(c) || c;
                    const active = normColor(c) === currentSolid;
                    return (
                      <button
                        key={`${hex}-${i}`}
                        type="button"
                        title={hex}
                        onClick={() => onSolid(hex)}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                          active ? "border-white ring-2 ring-white/50" : "border-white/15 hover:border-white/40"
                        )}
                        style={{ background: hex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Default solids */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {showAllSolids ? `All colors (${CANVA_SOLID_ALL.length})` : `Default colors`}
                </h4>
                <span className="text-[10px] text-slate-500">{solidList.length} colors</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {solidList.map((hex, i) => {
                  const active = normColor(hex) === currentSolid && !isGradientActive;
                  return (
                    <button
                      key={`${hex}-${i}-${showAllSolids ? "all" : "def"}`}
                      type="button"
                      title={hex}
                      onClick={() => onSolid(hex)}
                      className={cn(
                        "group relative h-8 w-8 rounded-md border transition-all hover:scale-105 hover:z-10 hover:shadow-lg",
                        active ? "border-white ring-2 ring-white/50" : "border-white/10 hover:border-white/30"
                      )}
                      style={{ background: hex }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowAllSolids((v) => !v)}
                className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
              >
                {showAllSolids ? "Show less" : `See all ${CANVA_SOLID_ALL.length} colors`}
              </button>
            </div>

            {/* Solid color picker – Canva style */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Custom color</h4>
                <span className="text-[10px] text-slate-500">Pick any color</span>
              </div>

              <ColorWheel
                value={customHex}
                onChange={(hex) => {
                  setCustomHex(hex);
                  solidChannel.offer(hex);
                }}
              />

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1">
                  <span className="text-[10px] text-slate-500">#</span>
                  <input
                    value={hexDraft ?? customHex.replace("#", "").toUpperCase()}
                    onChange={(e) => setHexDraft(e.target.value)}
                    onBlur={(e) => commitHex(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value);
                    }}
                    spellCheck={false}
                    placeholder="FFFFFF"
                    className="w-[84px] bg-transparent font-mono text-xs text-slate-200 outline-none"
                  />
                </div>
                <div className="flex flex-1 flex-wrap gap-1">
                  {[
                    "#000000",
                    "#FFFFFF",
                    "#FF0000",
                    "#00FF00",
                    "#0000FF",
                    "#FFFF00",
                    "#FF00FF",
                    "#00FFFF",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => {
                        setCustomHex(c);
                        onSolid(c);
                      }}
                      className="h-6 w-6 rounded border border-white/15 hover:border-white/40"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "gradient" && (
          <div className="space-y-4">
            {/* Current gradient preview */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current</h4>
              <div
                className="h-12 w-full rounded-lg border border-white/15"
                style={{
                  background: activeGradientCss || currentSolid,
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onClearGradient?.()}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                >
                  Use solid color
                </button>
                {isGradientActive && (
                  <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300">
                    Gradient active
                  </span>
                )}
              </div>
            </div>

            {/* Default gradients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {showAllGradients ? `All gradients (${CANVA_GRADIENT_ALL.length})` : "Default gradients"}
                </h4>
                <span className="text-[10px] text-slate-500">{gradientList.length} gradients</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {gradientList.map((sw, idx) => {
                  const css = gradientCssFor(sw);
                  const isActive =
                    isGradientActive &&
                    gradient?.stops?.length === sw.stops.length &&
                    gradient?.stops?.[0]?.color?.toLowerCase() === sw.stops[0]?.color?.toLowerCase();
                  return (
                    <button
                      key={`${sw.name}-${idx}-${showAllGradients ? "all" : "def"}`}
                      type="button"
                      title={sw.name}
                      onClick={() => onGradient(swatchToGradient(sw))}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-lg border bg-white/[0.02] text-left transition-all hover:scale-[1.02] hover:border-white/30 hover:shadow-lg",
                        isActive ? "border-white ring-1 ring-white/50" : "border-white/10"
                      )}
                    >
                      <span className="h-12 w-full border-b border-white/10" style={{ background: css }} />
                      <span className="truncate px-1.5 py-1 text-[10px] font-medium text-slate-300 group-hover:text-white">
                        {sw.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowAllGradients((v) => !v)}
                className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
              >
                {showAllGradients ? "Show less" : `See all ${CANVA_GRADIENT_ALL.length} gradients`}
              </button>
            </div>

            {/* Custom gradient builder – simple */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Custom gradient</h4>
              <CustomGradientBuilder
                value={gradient}
                fallback={currentSolid}
                onChange={onGradient}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/10 bg-[#12141f] px-3 py-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          {tab === "solid"
            ? "Click any color to apply. Use the picker for custom shades."
            : "Pick a gradient to apply to text. Gradients work best on large headings."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom gradient builder – two stops + angle                        */
/* ------------------------------------------------------------------ */

function CustomGradientBuilder({
  value,
  fallback,
  onChange,
}: {
  value?: Gradient;
  fallback: string;
  onChange: (g: Gradient) => void;
}) {
  const g = value?.enabled
    ? value
    : ({
        enabled: true,
        type: "linear" as const,
        angle: 90,
        stops: [
          { color: fallback || "#7D2AE7", at: 0 },
          { color: "#00C4CC", at: 100 },
        ],
      } as Gradient);

  const [angle, setAngle] = useState(g.angle);
  const [c1, setC1] = useState(g.stops[0]?.color || fallback);
  const [c2, setC2] = useState(g.stops[1]?.color || "#00C4CC");

  useEffect(() => {
    setAngle(g.angle);
    setC1(g.stops[0]?.color || fallback);
    setC2(g.stops[1]?.color || "#00C4CC");
  }, [g.angle, g.stops, fallback]);

  const apply = useCallback(
    (a: number, col1: string, col2: string) => {
      onChange({
        enabled: true,
        type: "linear",
        angle: a,
        stops: [
          { color: col1, at: 0 },
          { color: col2, at: 100 },
        ],
      });
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      <div className="h-10 w-full rounded-lg border border-white/15" style={{ background: `linear-gradient(${angle}deg, ${c1}, ${c2})` }} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">From</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5">
            <input type="color" value={normColor(c1) || "#000000"} onChange={(e) => { setC1(e.target.value); apply(angle, e.target.value, c2); }} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
            <input value={c1.toUpperCase()} onChange={(e) => { setC1(e.target.value); apply(angle, e.target.value, c2); }} className="w-full bg-transparent font-mono text-[11px] text-slate-200 outline-none" />
          </span>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">To</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5">
            <input type="color" value={normColor(c2) || "#000000"} onChange={(e) => { setC2(e.target.value); apply(angle, c1, e.target.value); }} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
            <input value={c2.toUpperCase()} onChange={(e) => { setC2(e.target.value); apply(angle, c1, e.target.value); }} className="w-full bg-transparent font-mono text-[11px] text-slate-200 outline-none" />
          </span>
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Angle {angle}°</span>
        <input type="range" min={0} max={360} value={angle} onChange={(e) => { const v = Number(e.target.value); setAngle(v); apply(v, c1, c2); }} className="h-1.5 w-full accent-white" />
        <div className="flex gap-1">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <button key={a} type="button" onClick={() => { setAngle(a); apply(a, c1, c2); }} className={cn("flex-1 rounded border px-1 py-0.5 text-[10px]", angle === a ? "border-white bg-white text-slate-900" : "border-white/10 text-slate-400 hover:bg-white/10")}>{a}°</button>
          ))}
        </div>
      </label>
      <button type="button" onClick={() => apply(angle, c1, c2)} className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Apply gradient</button>
    </div>
  );
}
