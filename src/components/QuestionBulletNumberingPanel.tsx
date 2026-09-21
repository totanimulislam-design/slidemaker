import { useState } from "react";
import type { ThemeSettings } from "../lib/types";
import {
  NUMBER_STYLES,
  NUMBER_STYLE_CATEGORIES,
  isPresetCategory,
  numberStyleDef,
  type NumberStyle,
  type NumberStyleCategory,
} from "../lib/numberStyles";
import { NumberStylePreview } from "./NumberStylePicker";
import { cn } from "../utils/cn";

/**
 * Numbering option for the question bullet toolbar.
 *
 * A focused gallery that shows only the preset families — the classic
 * bullet points (dot · square · dash · arrowhead · check …), the numbering
 * formats (1. · (1) · Q1 · 01 …) and the Number + arrow compounds
 * (disc + arrow · card + arrow · 1 → …) — so a teacher can pick how the
 * marker's number reads without hunting inside the full Bullet design card.
 *
 * Every tile is previewed with the deck's own theme through the same
 * renderer the board uses, so the tile is the marker as it will actually
 * paint. Picking one writes `numberStyle` and nothing else, so the paint
 * the teacher has set stays.
 */

type PresetGroup = "all" | NumberStyleCategory;

const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  { id: "all", label: "All" },
  ...NUMBER_STYLE_CATEGORIES.filter((c) => isPresetCategory(c.id)).map((c) => ({
    id: c.id as PresetGroup,
    label: c.label,
  })),
];

/** only the preset families — bullets, numbering, number + arrow */
const PRESET_STYLES = NUMBER_STYLES.filter((d) => isPresetCategory(d.category));

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

export default function QuestionBulletNumberingPanel({ theme: T, setTheme }: Props) {
  const [group, setGroup] = useState<PresetGroup>("all");
  const current = (T.numberStyle ?? "circle") as NumberStyle;
  const now = numberStyleDef(current).label;
  const list = group === "all" ? PRESET_STYLES : PRESET_STYLES.filter((d) => d.category === group);

  return (
    <div className="space-y-3" data-bullet-numbering-panel="">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Numbering</span>
        <span className="text-[10px] text-slate-500">
          {PRESET_STYLES.length} styles · now {now}
        </span>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        How the marker reads — a classic bullet that stands in for the number, a numbering format like “7.” · “(7)” ·
        “Q7” · “07”, or a numbered plate with its own arrow tail like “disc + arrow” · “1 →”.
      </p>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Numbering group">
        {PRESET_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={group === g.id}
            aria-label={g.id === "all" ? "All numbering styles" : `Numbering: ${g.label}`}
            onClick={() => setGroup(g.id)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9.5px] transition-colors",
              group === g.id
                ? "border-amber-400 bg-amber-400 font-semibold text-slate-950"
                : "border-white/5 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div
        className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-0.5"
        role="listbox"
        aria-label="Numbering style"
      >
        {list.map((d) => {
          const chosen = current === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Numbering: ${d.label}`}
              title={d.hint}
              onClick={() => setTheme({ numberStyle: d.id })}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-between gap-1 rounded-lg border p-1.5 text-center transition-all",
                chosen
                  ? "border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                  : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900",
              )}
            >
              <span className="relative flex w-full flex-1 items-center justify-center py-0.5">
                <NumberStylePreview style={d.id} theme={T} size={24} number="7" />
              </span>
              <span className="w-full truncate text-[9px] font-medium leading-tight text-slate-300">{d.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        {numberStyleDef(current).hint}. The fill, outline, corners, transparency and shape effects you set on the
        toolbar stay on the marker — this only changes how its number (or its bullet glyph) reads.
      </p>
    </div>
  );
}
