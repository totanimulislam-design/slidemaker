import { useState } from "react";
import type { Gradient, TextBgBorderStyle, TextBgEffectKind, TextBgShape, TextBgShapeKind } from "../lib/types";
import {
  DEFAULT_TEXT_BG_SHAPE,
  TEXT_BG_EFFECTS,
  TEXT_BG_EFFECT_BY_ID,
  TEXT_BG_KINDS,
  TEXT_BG_PRESETS,
  TEXT_BG_PRESET_GROUPS,
  TEXT_BG_SWATCHES,
  bgKindHasRadius,
  bgShapeFromPreset,
  bgShapeIsOn,
  bgShapeWithDefaults,
  describeBgShape,
  freshBgShape,
  bgEffectColor,
  bgPlateIsLight,
} from "../lib/textBgShape";
import { ColorInput, SegButtons, Slider, Toggle } from "./ui";
import GradientEditor from "./GradientEditor";
import { TextBgPreview } from "./TextBgShape";
import { cn } from "../utils/cn";

/**
 * The "Background shape" pop-up every text toolbar opens: the plate painted
 * behind a text part, top to bottom in the order a designer reaches for
 * things — a ready-made preset, the silhouette, the plate colour, the border
 * (colour, style, radius, weight), the transparency, an effect, and finally
 * where the plate sits around the glyphs.
 *
 * `value` is the part's own shape (undefined = none). Every edit hands the
 * whole shape back through `onChange`; "Remove" hands back `undefined` so the
 * part's field is cleared rather than left as an `enabled: false` stub.
 */
interface Props {
  value: TextBgShape | undefined;
  onChange: (next: TextBgShape | undefined) => void;
  /** the text's ink — the previews draw the sample glyphs in it */
  textColor?: string;
  /** the colour a fresh plate starts with (the part's accent) */
  accent?: string;
}

const BORDER_STYLES: { value: TextBgBorderStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
];

function Cap({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="ctx-menu-cap flex items-baseline justify-between">
      <span>{children}</span>
      {hint && <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500">{hint}</span>}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="ctx-field">
      <span>{label}</span>
      <span className="ctx-step">
        <button type="button" aria-label={`${label} −`} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
        />
        <button type="button" aria-label={`${label} +`} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
        {unit && <span className="ctx-prefix">{unit}</span>}
      </span>
    </label>
  );
}

type PresetTab = (typeof TEXT_BG_PRESET_GROUPS)[number] | "All";

/**
 * The room a silhouette wants around the glyphs: pointed and slanted shapes
 * multiply the default padding so their tips clear the text (a `padHint` is a
 * pair of multipliers, not pixels).
 */
const padFor = (hint?: [number, number]): Partial<TextBgShape> =>
  hint ? { padX: Math.round(DEFAULT_TEXT_BG_SHAPE.padX * hint[0]), padY: Math.round(DEFAULT_TEXT_BG_SHAPE.padY * hint[1]) } : {};
/** the preset group last browsed — the card reopens on it, whichever part it is for */
let lastGroup: PresetTab = "Bangladesh edu";

export default function TextBgShapePanel({ value, onChange, textColor = "#ffffff", accent }: Props) {
  const on = bgShapeIsOn(value);
  const s = bgShapeWithDefaults(value ?? freshBgShape(accent));
  // the group whose presets are showing (all of them stay one click away)
  const [group, setGroupState] = useState<PresetTab>(lastGroup);
  const setGroup = (g: PresetTab) => {
    lastGroup = g;
    setGroupState(g);
  };
  // the gradient editor's disclosure — its own state, so editing a stop before
  // switching the gradient on does not snap it shut
  const [gradOpen, setGradOpen] = useState(!!value?.gradient?.enabled);

  /** apply a change; a plate that was off comes on with it (touching a control means "I want one") */
  const set = (patch: Partial<TextBgShape>) => {
    const next: TextBgShape = { ...s, ...patch, enabled: true };
    // hand-tuning leaves the preset (the tile stops claiming it)
    if (!("preset" in patch)) delete next.preset;
    onChange(next);
  };

  const effectDef = TEXT_BG_EFFECT_BY_ID.get(s.effect) ?? TEXT_BG_EFFECTS[0];
  const hasRadius = bgKindHasRadius(s.kind);
  const presets = group === "All" ? TEXT_BG_PRESETS : TEXT_BG_PRESETS.filter((p) => p.group === group);

  const gradient: Gradient = s.gradient ?? {
    enabled: false,
    type: "linear",
    angle: 90,
    stops: [
      { color: s.color || DEFAULT_TEXT_BG_SHAPE.color, at: 0 },
      { color: "#5b8cff", at: 100 },
    ],
  };

  return (
    <div className="space-y-1" data-text-bg-panel="">
      {/* ── state ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1">
          <Toggle
            checked={on}
            onChange={(v) => (v ? onChange({ ...s, enabled: true }) : value ? onChange({ ...s, enabled: false }) : undefined)}
            label={`Background shape · ${describeBgShape(value)}`}
          />
        </div>
        {value && (
          <button
            type="button"
            className="ctx-btn ctx-default"
            aria-label="Remove background shape"
            title="Remove the plate entirely"
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        )}
      </div>

      {/* live preview of the current plate (dimmed while the part paints none) */}
      <div
        className="relative flex items-center justify-center rounded-lg border border-white/10 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%),linear-gradient(45deg,#1e293b_25%,#0f172a_25%,#0f172a_75%,#1e293b_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] py-2"
        data-text-bg-preview={on ? "on" : "off"}
      >
        <span style={{ opacity: on ? 1 : 0.35 }}>
          <TextBgPreview shape={s} sample="উদাহরণ Ag" scale={0.9} textColor={textColor} width={280} height={56} />
        </span>
        {!on && <span className="absolute bottom-1 right-2 text-[10px] text-slate-400">off — pick a preset or a shape to turn it on</span>}
      </div>

      {/* ── presets ───────────────────────────────────────────────────── */}
      <Cap hint={presets.length + " designs"}>Shape presets</Cap>
      <div className="flex flex-wrap gap-1">
        {(["All", ...TEXT_BG_PRESET_GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            className={cn("ctx-btn", group === g && "is-on")}
            style={{ height: 24, fontSize: 11 }}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label="Background shape preset">
        {presets.map((p) => {
          const chosen = on && s.preset === p.id;
          const shape = bgShapeFromPreset(p);
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Background shape preset: ${p.label}`}
              title={p.hint}
              onClick={() => onChange({ ...shape, scope: s.scope, width: s.width })}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 pb-1 pt-1.5 transition-colors",
                chosen ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-slate-900/60 hover:border-white/25",
              )}
            >
              <TextBgPreview shape={shape} scale={0.62} textColor={bgPlateIsLight(shape) ? "#0f172a" : textColor} />
              <span className="w-full truncate text-center text-[9px] leading-tight text-slate-300">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── silhouette ────────────────────────────────────────────────── */}
      <Cap hint={TEXT_BG_KINDS.length + " silhouettes"}>Shape</Cap>
      <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="Background silhouette">
        {TEXT_BG_KINDS.map((k) => {
          const chosen = on && s.kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Background silhouette: ${k.label}`}
              title={k.label}
              onClick={() => set({ kind: k.id as TextBgShapeKind, ...padFor(k.padHint) })}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-0.5 pb-1 pt-1 transition-colors",
                chosen ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-slate-900/60 hover:border-white/25",
              )}
            >
              <TextBgPreview
                shape={{ ...DEFAULT_TEXT_BG_SHAPE, kind: k.id, color: s.color || DEFAULT_TEXT_BG_SHAPE.color, gradient: undefined, effect: "none", padX: 14 * (k.padHint?.[0] ?? 1), padY: 5 * (k.padHint?.[1] ?? 1) }}
                scale={0.5}
                width={56}
                height={30}
                textColor={textColor}
              />
              <span className="w-full truncate text-center text-[8px] leading-tight text-slate-400">{k.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── shape colour ──────────────────────────────────────────────── */}
      <Cap>Shape colour</Cap>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ColorInput label="Background shape colour" value={s.color || DEFAULT_TEXT_BG_SHAPE.color} onChange={(v) => set({ color: v })} />
        </div>
        <button
          type="button"
          className={cn("ctx-btn ctx-default", !s.color && "is-on")}
          aria-pressed={!s.color}
          aria-label="Background shape colour: none"
          title="No fill — border, marks and effects only"
          onClick={() => set({ color: "" })}
        >
          None
        </button>
      </div>
      <div className="flex flex-wrap gap-1 py-1" aria-label="Background shape colour swatches">
        {TEXT_BG_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Background shape colour ${c}`}
            aria-pressed={s.color.toLowerCase() === c}
            onClick={() => set({ color: c })}
            className={cn("h-5 w-5 rounded-md border", s.color.toLowerCase() === c ? "border-amber-400 ring-2 ring-amber-400/40" : "border-white/20")}
            style={{ background: c }}
          />
        ))}
      </div>
      <details
        className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1"
        open={gradOpen}
        onToggle={(e) => setGradOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Gradient fill {s.gradient?.enabled ? "· on" : ""}
        </summary>
        <div className="pt-2">
          <GradientEditor value={gradient} onChange={(g) => set({ gradient: g })} fallback={s.color || DEFAULT_TEXT_BG_SHAPE.color} label="Background shape gradient" />
        </div>
      </details>

      {/* ── border ────────────────────────────────────────────────────── */}
      <Cap>Border colour</Cap>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ColorInput
            label="Background border colour"
            value={s.borderColor || "#ffffff"}
            onChange={(v) => set({ borderColor: v, ...(s.borderStyle === "none" ? { borderStyle: "solid" as const } : {}) })}
          />
        </div>
        <button
          type="button"
          className={cn("ctx-btn ctx-default", !s.borderColor && "is-on")}
          aria-pressed={!s.borderColor}
          aria-label="Background border colour: none"
          onClick={() => set({ borderColor: "" })}
        >
          None
        </button>
      </div>

      <Cap>Border style</Cap>
      <div role="group" aria-label="Background border style">
        <SegButtons
          value={s.borderStyle}
          options={BORDER_STYLES}
          onChange={(v) => set({ borderStyle: v, ...(v !== "none" && !s.borderColor ? { borderColor: "#ffffff" } : {}) })}
        />
      </div>

      <Cap hint={hasRadius ? undefined : "polygons have straight corners"}>Border radius</Cap>
      <div className={cn(!hasRadius && "opacity-50")}>
        <Slider value={s.radius} min={0} max={60} onChange={(v) => set({ radius: v })} ariaLabel="Background border radius" />
      </div>

      <Cap>Border weight</Cap>
      <Slider value={s.borderWidth} min={0} max={12} step={0.5} onChange={(v) => set({ borderWidth: v })} ariaLabel="Background border weight" />

      {/* ── transparency ──────────────────────────────────────────────── */}
      <Cap hint={s.opacity >= 100 ? "fully visible" : `${100 - s.opacity}% see-through`}>Transparency</Cap>
      <Slider value={s.opacity} min={0} max={100} onChange={(v) => set({ opacity: v })} ariaLabel="Background shape opacity (100 = fully visible)" />

      {/* ── effects ───────────────────────────────────────────────────── */}
      <Cap hint={effectDef.label}>Effects</Cap>
      <div className="grid grid-cols-4 gap-1" role="listbox" aria-label="Background effect">
        {TEXT_BG_EFFECTS.map((e) => {
          const chosen = on && s.effect === e.id;
          return (
            <button
              key={e.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Background effect: ${e.label}`}
              title={e.hint}
              onClick={() => set({ effect: e.id as TextBgEffectKind })}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-0.5 pb-1 pt-1 transition-colors",
                chosen ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-slate-900/60 hover:border-white/25",
              )}
            >
              <TextBgPreview
                shape={{ ...s, effect: e.id, effectIntensity: e.id === s.effect ? s.effectIntensity : 60, skew: 0, rotate: 0, offsetX: 0, offsetY: 0 }}
                scale={0.55}
                width={84}
                height={34}
                textColor={textColor}
              />
              <span className="w-full truncate text-center text-[9px] leading-tight text-slate-300">{e.label}</span>
            </button>
          );
        })}
      </div>
      {s.effect !== "none" && (
        <div className="space-y-1 rounded-lg border border-white/10 bg-slate-900/40 p-2">
          <Cap hint={effectDef.hint}>Effect intensity</Cap>
          <Slider value={s.effectIntensity} min={0} max={100} onChange={(v) => set({ effectIntensity: v })} ariaLabel="Background effect intensity" />
          {effectDef.color && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <ColorInput label="Background effect colour" value={s.effectColor || bgEffectColor(s)} onChange={(v) => set({ effectColor: v })} />
              </div>
              <button
                type="button"
                className={cn("ctx-btn ctx-default", !s.effectColor && "is-on")}
                aria-pressed={!s.effectColor}
                aria-label="Background effect colour: auto"
                title="Follow the plate colour"
                onClick={() => set({ effectColor: undefined })}
              >
                Auto
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── position ──────────────────────────────────────────────────── */}
      <Cap>Position</Cap>
      <div className="grid grid-cols-2 gap-x-3">
        <Num label="Room left/right" value={s.padX} onChange={(n) => set({ padX: n })} min={0} max={120} unit="px" />
        <Num label="Room top/bottom" value={s.padY} onChange={(n) => set({ padY: n })} min={0} max={120} unit="px" />
        <Num label="Shift horizontally" value={s.offsetX} onChange={(n) => set({ offsetX: n })} min={-200} max={200} unit="px" />
        <Num label="Shift vertically" value={s.offsetY} onChange={(n) => set({ offsetY: n })} min={-200} max={200} unit="px" />
        <Num label="Skew" value={s.skew} onChange={(n) => set({ skew: n })} min={-45} max={45} unit="°" />
        <Num label="Rotate" value={s.rotate} onChange={(n) => set({ rotate: n })} min={-180} max={180} unit="°" />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Plate per</div>
          <div role="group" aria-label="Background shape scope">
            <SegButtons
              value={s.scope}
              options={[
                { value: "block", label: "Whole text" },
                { value: "line", label: "Each line" },
              ]}
              onChange={(v) => set({ scope: v })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Width</div>
          <div role="group" aria-label="Background shape width">
            <SegButtons
              value={s.width}
              options={[
                { value: "hug", label: "Hug text" },
                { value: "fill", label: "Fill box" },
              ]}
              onChange={(v) => set({ width: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
