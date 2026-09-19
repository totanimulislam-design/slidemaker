import type { CSSProperties } from "react";
import type { TextEffect, TextEffectKind } from "../lib/types";
import {
  EFFECT_DEFAULTS,
  EFFECT_FIELD_META,
  TEXT_EFFECTS,
  TEXT_EFFECT_BY_ID,
  effectWithDefaults,
  switchEffect,
  textEffectStyles,
} from "../lib/textEffects";
import { ColorInput, Slider } from "./ui";
import { cn } from "../utils/cn";

/**
 * Canva-style text effects: a tile per effect (each painted with the effect
 * itself) and, under it, the handful of settings the chosen effect has.
 *
 * Shared by every text part's panel, the shape design panel and the toolbar's
 * "Effects" pop-up, so the same picker appears wherever text can be styled.
 */
interface Props {
  value: TextEffect | undefined;
  onChange: (next: TextEffect | undefined) => void;
  /** the colour the text is painted with — the tiles preview against it */
  textColor?: string;
  compact?: boolean;
  /** hide the caption row */
  bare?: boolean;
}

export default function TextEffectsEditor({ value, onChange, textColor = "#ffffff", compact, bare }: Props) {
  const current = effectWithDefaults(value);
  const def = TEXT_EFFECT_BY_ID.get(current.kind) ?? TEXT_EFFECTS[0];
  const pick = (kind: TextEffectKind) => onChange(kind === "none" ? undefined : switchEffect(value, kind));
  const set = (patch: Partial<TextEffect>) => onChange({ ...current, ...patch });

  return (
    <div className="space-y-2">
      {!bare && (
        <span className="flex items-baseline justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
          Text effects
          <span className="text-[10px] normal-case text-slate-500">{def.label}</span>
        </span>
      )}

      <div className={cn("grid gap-1.5", compact ? "grid-cols-5" : "grid-cols-5")} role="listbox" aria-label="Text effect">
        {TEXT_EFFECTS.map((e) => {
          const on = current.kind === e.id;
          const preview = textEffectStyles({ ...EFFECT_DEFAULTS[e.id], kind: e.id }, textColor);
          const sampleCss: CSSProperties = {
            color: textColor,
            fontWeight: 800,
            fontSize: compact ? 17 : 20,
            lineHeight: 1,
            fontFamily: "Inter, 'Noto Sans', system-ui, sans-serif",
            ...preview.css,
          };
          return (
            <button
              key={e.id}
              type="button"
              role="option"
              aria-selected={on}
              aria-label={`Text effect: ${e.label}`}
              title={e.hint}
              onClick={() => pick(e.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1 pt-2 transition-colors",
                on ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-slate-900/60 hover:border-white/25",
              )}
            >
              <span className="flex h-7 items-center justify-center overflow-visible" style={sampleCss}>
                {preview.inline ? <span style={preview.inline}>Ag</span> : "Ag"}
              </span>
              <span className="text-[9px] leading-tight text-slate-300">{e.label}</span>
            </button>
          );
        })}
      </div>

      {def.fields.length > 0 && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
          {def.fields.map((f) => {
            const meta = EFFECT_FIELD_META[f];
            if (f === "color") {
              return (
                <ColorInput
                  key={f}
                  label={`${def.label} colour`}
                  value={current.color ?? EFFECT_DEFAULTS[current.kind].color ?? "#000000"}
                  onChange={(v) => set({ color: v })}
                />
              );
            }
            const v = (current[f] as number | undefined) ?? (EFFECT_DEFAULTS[current.kind][f] as number | undefined) ?? 0;
            return (
              <label key={f} className="block space-y-1">
                <span className="flex items-baseline justify-between text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                  {meta.label}
                  <input
                    type="number"
                    aria-label={`${def.label} ${meta.label}`}
                    value={v}
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    onChange={(e) => {
                      const n = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(n)) set({ [f]: Math.max(meta.min, Math.min(meta.max, n)) } as Partial<TextEffect>);
                    }}
                    className="w-16 rounded border border-white/10 bg-slate-900/70 px-1.5 py-0.5 text-right font-mono text-[10px] normal-case text-slate-200 outline-none focus:border-amber-400/60"
                  />
                </span>
                <Slider min={meta.min} max={meta.max} step={meta.step} value={v} onChange={(n) => set({ [f]: n } as Partial<TextEffect>)} />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
