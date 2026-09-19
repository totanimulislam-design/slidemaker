import { useState } from "react";
import type { ShapeItem } from "../lib/shapes";
import {
  DEFAULT_GLOW,
  DEFAULT_SHADOW,
  DEFAULT_TEXT_STROKE,
  SHAPE_STYLE_PRESETS,
  TEXT_STYLE_PRESETS,
  shapeFill,
} from "../lib/shapeDesign";
import { TEXT_GRADIENT_PRESETS } from "../lib/banner";
import { opacityAlpha, opacityPercent } from "../lib/boxFonts";
import { ensureFamily } from "../lib/fonts";
import GradientEditor from "./GradientEditor";
import TextEffectsEditor from "./TextEffectsEditor";
import { Btn, ColorInput, Field, SegButtons, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";
import FontPicker from "./FontPicker";

interface Props {
  shape: ShapeItem;
  onChange: (patch: Partial<ShapeItem>) => void;
  /** copy this item's design onto every other shape (optionally only same kind) */
  onApplyToAll?: (style: Partial<ShapeItem>, sameKindOnly: boolean) => void;
}

const DESIGN_KEYS: (keyof ShapeItem)[] = [
  "fill", "fillOpacity", "gradient", "stroke", "strokeWidth", "dash", "lineStyle", "lineJoin", "cornerRadius",
  "shadow2", "glow", "itemOpacity", "blend", "textColor", "textGradient", "fontSize", "bold", "italic",
  "letterSpacing", "lineHeight", "textStroke", "textShadow", "uppercase", "padding", "textEffect", "textOpacity",
  "textGlow", "lowercase", "textTransform", "underline", "strikethrough",
];

export const pickDesign = (s: ShapeItem): Partial<ShapeItem> =>
  Object.fromEntries(DESIGN_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])) as Partial<ShapeItem>;

export default function ShapeDesignPanel({ shape: s, onChange, onApplyToAll }: Props) {
  const [tab, setTab] = useState<"fill" | "line" | "effects" | "text">(s.kind === "text" ? "text" : "fill");
  const isLine = s.kind === "line" || s.kind === "arrow";
  const isImage = s.kind === "image";
  const hasText = s.kind === "text" || !!s.text;
  const shadow = s.shadow2 ?? DEFAULT_SHADOW;
  const glow = s.glow ?? DEFAULT_GLOW;
  const tstroke = s.textStroke ?? DEFAULT_TEXT_STROKE;

  const tabs = [
    !isLine && { id: "fill", label: isImage ? "Backdrop" : "Fill" },
    { id: "line", label: isLine ? "Line" : isImage ? "Border" : "Outline" },
    { id: "effects", label: "Effects" },
    hasText && { id: "text", label: "Text" },
  ].filter(Boolean) as { id: typeof tab; label: string }[];

  return (
    <div className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-400/[0.05] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-violet-200 uppercase">Shape design</span>
        <div
          className="h-6 w-14 rounded-md border border-white/15"
          style={{ background: isLine ? s.stroke : shapeFill(s), opacity: s.itemOpacity ?? 1 }}
          title="Current fill"
        />
      </div>

      {/* presets */}
      <Field label="Style presets">
        <div className="grid grid-cols-6 gap-1">
          {(s.kind === "text" ? TEXT_STYLE_PRESETS : SHAPE_STYLE_PRESETS).map((p) => (
            <button
              key={p.name}
              onClick={() => onChange(p.style)}
              title={p.name}
              className="flex flex-col items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-1 text-[9px] text-slate-300 hover:border-amber-400/60"
            >
              <span className="h-5 w-full rounded border border-white/10" style={{ background: p.swatch }} />
              <span className="w-full truncate text-center">{p.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              tab === t.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------- FILL ------------------------------- */}
      {tab === "fill" && !isLine && (
        <div className="space-y-3">
          {!s.gradient?.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Fill colour" value={s.fill || "#000000"} onChange={(v) => onChange({ fill: v })} />
              <Field label="Fill opacity" hint={`${Math.round(s.fillOpacity * 100)}%`}>
                <Slider min={0} max={1} step={0.05} value={s.fillOpacity} onChange={(v) => onChange({ fillOpacity: v })} />
              </Field>
            </div>
          )}
          {!s.gradient?.enabled && (
            <button onClick={() => onChange({ fill: "" })} className="text-[11px] text-slate-400 hover:text-amber-300">
              {s.fill ? "✕ no fill" : "no fill"}
            </button>
          )}
          <GradientEditor
            label="Gradient fill"
            value={s.gradient ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: s.fill || "#2f4fff", at: 0 }, { color: "#ffffff", at: 100 }] }}
            fallback={s.fill || "#2f4fff"}
            onChange={(g) => onChange({ gradient: g, ...(g.enabled && !s.fill ? { fill: g.stops[0]?.color ?? "#2f4fff" } : {}) })}
            presets={[
              { name: "Blue", angle: 90, stops: [{ color: "#0f3fb8", at: 0 }, { color: "#3b7bff", at: 100 }] },
              { name: "Gold", angle: 180, stops: [{ color: "#fff1b8", at: 0 }, { color: "#b8860b", at: 100 }] },
              { name: "Sunset", angle: 90, stops: [{ color: "#f97316", at: 0 }, { color: "#ec4899", at: 100 }] },
              { name: "Ocean", angle: 135, stops: [{ color: "#38bdf8", at: 0 }, { color: "#1e3a8a", at: 100 }] },
              { name: "Emerald", angle: 160, stops: [{ color: "#6ee7b7", at: 0 }, { color: "#065f46", at: 100 }] },
              { name: "Mono", angle: 180, stops: [{ color: "#475569", at: 0 }, { color: "#0f172a", at: 100 }] },
            ]}
          />
          {s.gradient?.enabled && (
            <Field label="Gradient opacity" hint={`${Math.round(s.fillOpacity * 100)}%`}>
              <Slider min={0} max={1} step={0.05} value={s.fillOpacity} onChange={(v) => onChange({ fillOpacity: v })} />
            </Field>
          )}
          {(s.kind === "rect" || s.kind === "rounded" || s.kind === "text" || isImage) && (
            <Field label="Corner radius" hint={`${s.cornerRadius ?? (s.kind === "rounded" ? 8 : 0)}px`}>
              <Slider min={0} max={80} value={s.cornerRadius ?? (s.kind === "rounded" ? 8 : 0)} onChange={(v) => onChange({ cornerRadius: v })} />
            </Field>
          )}
        </div>
      )}

      {/* ------------------------------- LINE ------------------------------- */}
      {tab === "line" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Colour" value={s.stroke || "#ffffff"} onChange={(v) => onChange({ stroke: v })} />
            <Field label="Thickness" hint={`${s.strokeWidth}px`}>
              <Slider min={0} max={24} step={0.5} value={s.strokeWidth} onChange={(v) => onChange({ strokeWidth: v })} />
            </Field>
          </div>
          {!isLine && (
            <button onClick={() => onChange({ stroke: "" })} className="text-[11px] text-slate-400 hover:text-amber-300">
              {s.stroke ? "✕ no outline" : "no outline"}
            </button>
          )}
          <Field label="Style">
            <SegButtons
              value={s.lineStyle ?? (s.dash ? "dashed" : "solid")}
              onChange={(v) => onChange({ lineStyle: v, dash: v === "dashed" })}
              options={[
                { value: "solid", label: "━" },
                { value: "dashed", label: "╍" },
                { value: "dotted", label: "┄" },
                ...(isLine || isImage ? [] : [{ value: "double" as const, label: "═" }]),
              ]}
            />
          </Field>
          {!isLine && !isImage && s.kind !== "ellipse" && (
            <Field label="Corners">
              <SegButtons
                value={s.lineJoin ?? "round"}
                onChange={(v) => onChange({ lineJoin: v })}
                options={[
                  { value: "round", label: "Rounded joins" },
                  { value: "miter", label: "Sharp joins" },
                ]}
              />
            </Field>
          )}
        </div>
      )}

      {/* ------------------------------ EFFECTS ----------------------------- */}
      {tab === "effects" && (
        <div className="space-y-3">
          <Field label="Item opacity" hint={`${opacityPercent(s.itemOpacity)}%`}>
            {/* 0 → 100: an item can be faded all the way out (and back) */}
            <Slider min={0} max={1} step={0.05} value={s.itemOpacity ?? 1} onChange={(v) => onChange({ itemOpacity: v })} />
          </Field>

          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Toggle label="Drop shadow" checked={shadow.enabled} onChange={(v) => onChange({ shadow2: { ...shadow, enabled: v } })} />
            {shadow.enabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput label="Shadow colour" value={shadow.color} onChange={(v) => onChange({ shadow2: { ...shadow, color: v } })} />
                  <Field label="Opacity" hint={`${Math.round(shadow.opacity * 100)}%`}>
                    <Slider min={0} max={1} step={0.05} value={shadow.opacity} onChange={(v) => onChange({ shadow2: { ...shadow, opacity: v } })} />
                  </Field>
                </div>
                <Field label="Blur" hint={`${shadow.blur}px`}>
                  <Slider min={0} max={60} value={shadow.blur} onChange={(v) => onChange({ shadow2: { ...shadow, blur: v } })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Offset X" hint={`${shadow.x}px`}>
                    <Slider min={-40} max={40} value={shadow.x} onChange={(v) => onChange({ shadow2: { ...shadow, x: v } })} />
                  </Field>
                  <Field label="Offset Y" hint={`${shadow.y}px`}>
                    <Slider min={-40} max={40} value={shadow.y} onChange={(v) => onChange({ shadow2: { ...shadow, y: v } })} />
                  </Field>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <Toggle label="Outer glow" checked={glow.enabled} onChange={(v) => onChange({ glow: { ...glow, enabled: v } })} />
            {glow.enabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput label="Glow colour" value={glow.color} onChange={(v) => onChange({ glow: { ...glow, color: v } })} />
                  <Field label="Strength" hint={`${Math.round(glow.opacity * 100)}%`}>
                    <Slider min={0} max={1} step={0.05} value={glow.opacity} onChange={(v) => onChange({ glow: { ...glow, opacity: v } })} />
                  </Field>
                </div>
                <Field label="Size" hint={`${glow.size}px`}>
                  <Slider min={1} max={60} value={glow.size} onChange={(v) => onChange({ glow: { ...glow, size: v } })} />
                </Field>
                <button
                  onClick={() => onChange({ glow: { ...glow, color: s.stroke || s.fill || glow.color } })}
                  className="text-[11px] text-slate-400 hover:text-amber-300"
                >
                  use the shape's own colour
                </button>
              </>
            )}
          </div>

          <Field label="Blend mode">
            <select
              value={s.blend ?? "normal"}
              onChange={(e) => onChange({ blend: e.target.value as ShapeItem["blend"] })}
              className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none"
            >
              {["normal", "multiply", "screen", "overlay", "soft-light", "difference"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* -------------------------------- TEXT ------------------------------ */}
      {tab === "text" && hasText && (
        <div className="space-y-3">
          <FontPicker
            label="Text font (All Google Fonts)"
            value={s.fontFamily ?? ""}
            previewTarget={`shape:${s.id}`}
            onChange={(family) => {
              ensureFamily(family);
              onChange({ fontFamily: family });
            }}
            script="all"
            compact
          />

          <Field label="Font size (0 to ∞ px)" hint={`${s.fontSize}px`}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={s.fontSize}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num >= 0) onChange({ fontSize: num });
                }}
                className="w-24 rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
              />
              <div className="flex-1">
                <Slider
                  min={0}
                  max={200}
                  step={1}
                  value={s.fontSize}
                  onChange={(v) => onChange({ fontSize: v })}
                />
              </div>
            </div>
          </Field>

          {!s.textGradient?.enabled && <ColorInput label="Text colour" value={s.textColor} onChange={(v) => onChange({ textColor: v })} />}
          <GradientEditor
            label="Gradient text"
            value={s.textGradient ?? { enabled: false, type: "linear", angle: 180, stops: [{ color: "#fff2a8", at: 0 }, { color: "#ffb800", at: 100 }] }}
            fallback={s.textColor}
            onChange={(g) => onChange({ textGradient: g })}
            presets={TEXT_GRADIENT_PRESETS}
          />

          <div className="grid grid-cols-2 gap-1.5">
            <Toggle label="Bold" checked={s.bold} onChange={(v) => onChange({ bold: v })} />
            <Toggle label="Italic" checked={s.italic} onChange={(v) => onChange({ italic: v })} />
            <Toggle label="Underline" checked={!!s.underline} onChange={(v) => onChange({ underline: v })} />
            <Toggle label="Strikethrough" checked={!!s.strikethrough} onChange={(v) => onChange({ strikethrough: v })} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-medium text-slate-400 uppercase">Text Case</span>
            <SegButtons
              value={s.textTransform ?? (s.uppercase ? "uppercase" : s.lowercase ? "lowercase" : "none")}
              onChange={(v) =>
                onChange({
                  textTransform: v as any,
                  uppercase: v === "uppercase",
                  lowercase: v === "lowercase",
                })
              }
              options={[
                { value: "none", label: "Normal" },
                { value: "uppercase", label: "UPPERCASE" },
                { value: "lowercase", label: "lowercase" },
              ]}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-medium text-slate-400 uppercase">Alignment</span>
            <SegButtons
              value={s.align}
              onChange={(v) => onChange({ align: v as any })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
                { value: "justify", label: "Justify" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Letter spacing" hint={`${s.letterSpacing ?? 0}px`}>
              <Slider min={-5} max={50} step={0.5} value={s.letterSpacing ?? 0} onChange={(v) => onChange({ letterSpacing: v })} />
            </Field>
            <Field label="Line height" hint={`${s.lineHeight ?? 1.4}`}>
              <Slider min={0.5} max={4} step={0.05} value={s.lineHeight ?? 1.4} onChange={(v) => onChange({ lineHeight: v })} />
            </Field>
          </div>

          {/* 100 = fully visible · 0 = invisible — the same reading as every other
              opacity control in the editor (see lib/boxFonts `opacityPercent`) */}
          <Field label="Opacity (100 = fully visible)" hint={`${opacityPercent(s.textOpacity)}%`}>
            <Slider
              ariaLabel="Text opacity (100 = fully visible)"
              min={0}
              max={100}
              step={1}
              value={opacityPercent(s.textOpacity)}
              onChange={(v) => onChange({ textOpacity: opacityAlpha(v) })}
            />
          </Field>

          <Field label="Text position (nudge inside the box)" hint={`${s.textOffsetX ?? 0}, ${s.textOffsetY ?? 0} px`} as="div">
            <div className="flex items-center gap-2">
              {(["textOffsetX", "textOffsetY"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-[10px] text-slate-400">
                  {k === "textOffsetX" ? "X" : "Y"}
                  <input
                    type="number"
                    aria-label={k === "textOffsetX" ? "Text position X" : "Text position Y"}
                    step={1}
                    value={s[k] ?? 0}
                    onChange={(e) => {
                      const n = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(n)) onChange({ [k]: n || undefined });
                    }}
                    className="w-20 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
                  />
                </label>
              ))}
            </div>
          </Field>

          {s.kind === "text" && (
            <Field label="Inner padding" hint={`${s.padding ?? 6}px`}>
              <Slider min={0} max={40} value={s.padding ?? 6} onChange={(v) => onChange({ padding: v })} />
            </Field>
          )}

          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
            <TextEffectsEditor value={s.textEffect} onChange={(textEffect) => onChange({ textEffect })} textColor={s.textColor} compact />
            <span className="block pt-1 text-[10px] font-semibold text-slate-300 uppercase">More</span>
            <Toggle label="Text shadow" checked={s.textShadow !== false} onChange={(v) => onChange({ textShadow: v })} />
            <Field label="Text glow" hint={s.textGlow ? `${s.textGlow}px` : "off"}>
              <Slider min={0} max={50} value={s.textGlow ?? 0} onChange={(v) => onChange({ textGlow: v })} />
            </Field>
            <Toggle label="Text outline" checked={tstroke.enabled} onChange={(v) => onChange({ textStroke: { ...tstroke, enabled: v } })} />
            {tstroke.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <ColorInput label="Outline colour" value={tstroke.color} onChange={(v) => onChange({ textStroke: { ...tstroke, color: v } })} />
                <Field label="Width" hint={`${tstroke.width}px`}>
                  <Slider min={0.5} max={8} step={0.5} value={tstroke.width} onChange={(v) => onChange({ textStroke: { ...tstroke, width: v } })} />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {onApplyToAll && (
        <div className="flex gap-1.5 border-t border-white/10 pt-2">
          <Btn size="sm" onClick={() => onApplyToAll(pickDesign(s), true)} title={`Copy this design to every ${s.kind}`}>
            Apply to all {s.kind === "text" ? "text boxes" : `${s.kind}s`}
          </Btn>
          <Btn size="sm" onClick={() => onApplyToAll(pickDesign(s), false)} title="Copy this design to every shape on this slide">
            Apply to all shapes
          </Btn>
        </div>
      )}
    </div>
  );
}
