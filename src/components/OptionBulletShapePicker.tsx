import { useState } from "react";
import type { ThemeSettings } from "../lib/types";
import {
  OPTION_BULLET_SHAPES,
  renderOptionBulletMarker,
  type OptionBulletShape,
  type OptionBulletTreatment,
} from "../lib/optionBulletShapes";
import { cn } from "../utils/cn";
import { Field, SegButtons } from "./ui";

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const CATEGORIES = [
  { id: "all", label: "All Shapes" },
  { id: "classic", label: "Classic" },
  { id: "polygons", label: "Polygons" },
  { id: "symbols", label: "Symbols" },
  { id: "minimal", label: "Minimal / Text" },
];

export default function OptionBulletShapePicker({ theme, setTheme }: Props) {
  const currentShape = (theme.optionBulletShape ?? "circle") as OptionBulletShape;
  const currentTreatment = (theme.optionBulletTreatment ?? "auto") as OptionBulletTreatment;
  const color = theme.optionAccent || theme.accent || "#2f4fff";
  const [category, setCategory] = useState<string>("all");

  const filtered =
    category === "all"
      ? OPTION_BULLET_SHAPES
      : OPTION_BULLET_SHAPES.filter((s) => s.category === category);

  return (
    <div className="space-y-3">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
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

      {/* Grid of Shapes (Circle + 23 alternatives!) */}
      <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-0.5">
        {filtered.map((s) => {
          const isSelected = currentShape === s.id;
          const preview = renderOptionBulletMarker(s.id, theme, color, 24, false, "ক");
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTheme({ optionBulletShape: s.id })}
              title={s.description}
              className={cn(
                "flex flex-col items-center justify-between gap-1 rounded-lg border p-1.5 text-center transition-all min-h-[58px]",
                isSelected
                  ? "border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                  : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900",
              )}
            >
              <div className="flex flex-1 items-center justify-center w-full py-0.5">
                <div style={{ ...preview.style, width: preview.style.width || 24, height: 24, fontSize: 13, pointerEvents: "none" }}>
                  <span style={preview.innerStyle}>{preview.content}</span>
                </div>
              </div>
              <span className="w-full truncate text-[9px] font-medium text-slate-300 leading-tight">
                {s.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bullet Treatment (Outlined vs Filled vs Soft vs Glow) */}
      <Field label="Marker fill style">
        <SegButtons
          value={currentTreatment}
          onChange={(v) => setTheme({ optionBulletTreatment: v as OptionBulletTreatment })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "outlined", label: "Outlined" },
            { value: "filled", label: "Filled" },
            { value: "soft", label: "Soft Tint" },
            { value: "glow", label: "Glow" },
          ]}
        />
      </Field>
    </div>
  );
}
