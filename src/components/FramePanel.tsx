import { useState } from "react";
import type { FrameSettings, ThemeSettings } from "../lib/types";
import { DEFAULT_FRAME } from "../lib/types";
import { ALL_FRAME_STYLES, RICH_FRAME_PRESETS } from "../lib/frameDesigns";
import { FRAME_IMAGES } from "../lib/frameImages";
import { Btn, ColorInput, Field, PanelHead, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: "all", label: "All Styles" },
  { id: "wood", label: "Wood" },
  { id: "metal", label: "Metal" },
  { id: "luxury", label: "Luxury" },
  { id: "neon", label: "Neon" },
  { id: "gradient", label: "Gradient" },
  { id: "pattern", label: "Pattern" },
  { id: "fun", label: "Fun" },
  { id: "clean", label: "Minimal" },
];

const COLOR_SWATCHES = [
  "#e6a15c", // Classic wood
  "#6b1a13", // Mahogany
  "#4a2f1c", // Walnut
  "#d4af37", // Gold
  "#9ca3af", // Platinum
  "#8c531b", // Bronze
  "#fb7185", // Rose gold
  "#22d3ee", // Cyan neon
  "#f43f5e", // Magenta neon
  "#22c55e", // Green neon
  "#f97316", // Orange
  "#8b5cf6", // Purple
  "#0ea5e9", // Sky blue
  "#1e293b", // Slate dark
  "#f8fafc", // White / Chalk
  "#0a0a0c", // Obsidian
];

export default function FramePanel({ theme, setTheme }: Props) {
  const frame = theme.frame ?? DEFAULT_FRAME;
  const [category, setCategory] = useState<string>("all");
  const setFrame = (p: Partial<FrameSettings>) => setTheme({ frame: { ...frame, ...p } });

  const filteredStyles =
    category === "all"
      ? ALL_FRAME_STYLES
      : ALL_FRAME_STYLES.filter((s) => s.category === category || s.id === "none");

  return (
    <div className="space-y-4">
      <PanelHead
        title="Slide frame"
        subtitle="The border around the board — material, thickness, corners and overlay artwork."
      />
      {/* ------------------------------ Master Toggle ------------------------- */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div>
          <span className="text-xs font-semibold text-slate-100">Display Frame</span>
          <p className="text-[10px] text-slate-400">Toggle outer wooden or decorative perimeter frame</p>
        </div>
        <Toggle
          label=""
          checked={theme.showFrame && frame.style !== "none"}
          onChange={(v) => {
            setTheme({ showFrame: v });
            if (v && frame.style === "none") {
              setFrame({ style: "wood" });
            }
          }}
        />
      </div>

      {/* ------------------------------ Frame images ------------------------ */}
      <div className="space-y-2 rounded-xl border border-sky-400/30 bg-sky-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-sky-200 uppercase">
            Frame images ({FRAME_IMAGES.length})
          </span>
          {frame.image && (
            <button
              onClick={() => setFrame({ image: undefined, imageInset: undefined })}
              className="text-[10px] text-rose-300 hover:underline"
            >
              Clear image
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400">
          The main slide fits inside the frame opening so title, questions, options and shapes never overlap.
        </p>
        <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto p-0.5">
          {FRAME_IMAGES.map((img) => (
            <button
              key={img.id}
              onClick={() => setTheme({ showFrame: true, frame: { ...frame, image: img.src, imageInset: img.inset } })}
              className={cn(
                "overflow-hidden rounded-lg border text-left transition-all",
                frame.image === img.src ? "border-amber-400 ring-1 ring-amber-400" : "border-white/10 hover:border-white/30",
              )}
              title={img.name}
            >
              <span
                className="block aspect-video w-full bg-slate-950 bg-cover bg-center"
                style={{ backgroundImage: `url(${img.src})` }}
              />
              <span className="block truncate px-1 py-0.5 text-[9px] text-slate-300">{img.name}</span>
            </button>
          ))}
        </div>
        {frame.image && (
          <>
            <Field label="Inner board opening / margin" hint={`${frame.imageInset ?? 10}%`}>
              <Slider min={2} max={22} value={frame.imageInset ?? 10} onChange={(v) => setFrame({ imageInset: v })} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 p-2 text-xs">
              <div>
                <span className="font-medium text-slate-200">Prevent Content Overlap</span>
                <p className="text-[9.5px] text-slate-400">Keep slide content inside frame</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFrame({
                    imagePlacement: frame.imagePlacement === "overlay" ? "fit" : "overlay",
                  })
                }
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  frame.imagePlacement !== "overlay"
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-white/10 text-slate-400 hover:text-white"
                )}
              >
                {frame.imagePlacement !== "overlay" ? "ON (Safe Fit)" : "OFF (Overlay)"}
              </button>
            </div>
          </>
        )}
        <label className="block cursor-pointer rounded-lg border border-dashed border-white/20 px-3 py-2 text-center text-[11px] text-slate-400 hover:border-amber-400/50 hover:text-amber-200">
          Upload your own frame image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setTheme({ showFrame: true, frame: { ...frame, image: String(reader.result), imageInset: 10 } });
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>

      {/* ------------------------------ Quick Presets Grid ------------------------ */}
      <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
            Frame Presets ({RICH_FRAME_PRESETS.length})
          </span>
          <span className="text-[10px] text-slate-400">1-click styles</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto p-0.5">
          {RICH_FRAME_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setTheme({ showFrame: true, frame: { ...frame, ...p.frame } });
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all",
                frame.style === p.frame.style && frame.color === p.frame.color
                  ? "border-amber-400 bg-amber-400/15 text-amber-100"
                  : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/30 hover:bg-slate-900",
              )}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-black/40 shadow-sm"
                style={{ background: p.swatch }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-medium leading-tight">{p.name}</div>
                <div className="text-[8.5px] text-slate-500">{p.category}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------ 26 Frame Styles ------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
            Frame Style ({ALL_FRAME_STYLES.length})
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-medium transition-colors",
                category === c.id
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-white/5",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Style Cards Grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 max-h-72 overflow-y-auto">
          {filteredStyles.map((st) => (
            <button
              key={st.id}
              onClick={() => {
                setTheme({ showFrame: st.id !== "none" });
                setFrame({ style: st.id });
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all text-center",
                frame.style === st.id
                  ? "border-amber-400 bg-amber-400/15 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                  : "border-white/10 bg-slate-900/60 hover:border-white/30 hover:bg-slate-900",
              )}
            >
              <span
                className="h-7 w-full rounded-md border border-black/30 shadow-inner"
                style={{ background: st.swatch }}
              />
              <span className="text-[9.5px] font-medium text-slate-200 truncate w-full leading-tight">
                {st.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------ Color & Palette ------------------------- */}
      {frame.style !== "none" && (
        <>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
              Colors & Palette
            </span>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Frame Color" value={frame.color} onChange={(v) => setFrame({ color: v })} />
              <ColorInput label="Outer Margin" value={theme.frameOuter} onChange={(v) => setTheme({ frameOuter: v })} />
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Surface base colour lives under <b>Slide background</b>; banner colour under <b>Title background</b>.
            </p>

            {/* Quick Palette Swatches */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-400">Quick Frame Swatches</span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFrame({ color: c })}
                    className={cn(
                      "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110",
                      frame.color.toLowerCase() === c.toLowerCase()
                        ? "border-amber-400 scale-105 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                        : "border-black/50 shadow-sm",
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ------------------------------ Custom Gradient Controls ------------------------- */}
          {frame.style === "gradient" && (
            <div className="space-y-3 rounded-xl border border-indigo-400/30 bg-indigo-400/[0.06] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-indigo-200 uppercase">
                  Gradient Colors
                </span>
                <Toggle
                  label="Enabled"
                  checked={frame.gradient.enabled}
                  onChange={(v) => setFrame({ gradient: { ...frame.gradient, enabled: v } })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ColorInput
                  label="From Color"
                  value={frame.gradient.from}
                  onChange={(v) => setFrame({ gradient: { ...frame.gradient, from: v } })}
                />
                <ColorInput
                  label="To Color"
                  value={frame.gradient.to}
                  onChange={(v) => setFrame({ gradient: { ...frame.gradient, to: v } })}
                />
              </div>
              <Field label="Gradient Angle" hint={`${frame.gradient.angle}°`}>
                <Slider
                  min={0}
                  max={360}
                  value={frame.gradient.angle}
                  onChange={(v) => setFrame({ gradient: { ...frame.gradient, angle: v } })}
                />
              </Field>
              <div
                className="h-7 w-full rounded-lg border border-white/20 shadow-inner"
                style={{
                  background: `linear-gradient(${frame.gradient.angle}deg, ${frame.gradient.from}, ${frame.gradient.to})`,
                }}
              />
            </div>
          )}

          {/* ------------------------------ Dimensions & Thickness ------------------------- */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
              Geometry & Sizing
            </span>
            <Field label="Frame Thickness" hint={`${frame.width}px`}>
              <Slider min={4} max={56} value={frame.width} onChange={(v) => setFrame({ width: v })} />
            </Field>
            <Field label="Corner Radius" hint={`${frame.radius}px`}>
              <Slider min={0} max={44} value={frame.radius} onChange={(v) => setFrame({ radius: v })} />
            </Field>
            <Toggle
              label="3D Inner Shadow & Depth Lighting"
              checked={frame.shadow}
              onChange={(v) => setFrame({ shadow: v })}
            />
          </div>
        </>
      )}

      {/* ------------------------------ Reset ------------------------- */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        <Btn size="sm" onClick={() => setTheme({ showFrame: true, frame: { ...DEFAULT_FRAME } })}>
          ↺ Reset to Classic Wood
        </Btn>
        <Btn size="sm" variant="danger" onClick={() => setFrame({ style: "none" })}>
          Remove Frame
        </Btn>
      </div>
    </div>
  );
}
