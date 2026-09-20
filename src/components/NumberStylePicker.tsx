import { useState } from "react";
import type { ThemeSettings } from "../lib/types";
import {
  NUMBER_STYLES,
  NUMBER_STYLE_CATEGORIES,
  numberStyleDef,
  renderNumberStyle,
  type NumberStyle,
  type NumberStyleCategory,
} from "../lib/numberStyles";
import { cn } from "../utils/cn";
import NumberBullet from "./NumberBullet";

/**
 * A live-rendered numbering design, drawn from the deck's own theme — so the
 * accent, the fill, the outline and the silhouette are exactly what the board
 * will paint.
 */
export function NumberStylePreview({
  style,
  theme,
  size = 26,
  number = "7",
}: {
  style: string;
  theme: ThemeSettings;
  size?: number;
  number?: string;
}) {
  const id = style as NumberStyle;
  const r = renderNumberStyle(id, theme, size, number);
  if (id === "none") return <span className="text-[10px] text-slate-600">off</span>;
  return (
    <NumberBullet
      render={r}
      style={{ fontSize: Math.round(size * r.fontScale), color: r.color, fontWeight: 700 }}
    >
      {r.content}
    </NumberBullet>
  );
}

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const ALL: NumberStyleCategory | "all" = "all";

/**
 * The bullet-design gallery: every silhouette the question marker can wear,
 * grouped the way a picker is browsed (round, cards, polygons, seals, marks)
 * and previewed with the deck's own colours. Picking one writes `numberStyle`.
 */
export default function NumberStylePicker({ theme, setTheme }: Props) {
  const current = (theme.numberStyle ?? "circle") as NumberStyle;
  const [group, setGroup] = useState<NumberStyleCategory | "all">(ALL);
  const designs = group === ALL ? NUMBER_STYLES : NUMBER_STYLES.filter((d) => d.category === group);

  return (
    <div className="space-y-3" data-bullet-design-picker="">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Bullet design</span>
        <span className="text-[10px] text-slate-500">
          {NUMBER_STYLES.length} designs · now {numberStyleDef(current).label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Bullet design group">
        {[{ id: ALL, label: "All" }, ...NUMBER_STYLE_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={group === c.id}
            onClick={() => setGroup(c.id as NumberStyleCategory | "all")}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9.5px] transition-colors",
              group === c.id
                ? "border-amber-400 bg-amber-400 font-semibold text-slate-950"
                : "border-white/5 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto p-0.5" role="listbox" aria-label="Bullet design">
        {designs.map((d) => {
          const chosen = current === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Bullet design: ${d.label}`}
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
                <NumberStylePreview style={d.id} theme={theme} size={24} number="7" />
              </span>
              <span className="w-full truncate text-[9px] font-medium leading-tight text-slate-300">{d.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        {current === "none"
          ? "No numbering mark is drawn. Turn on “Number inside bullet” if you want the number back."
          : `${numberStyleDef(current).hint}. Every design derives from the accent colour, and its fill, outline, corners and transparency are yours to change below.`}
      </p>
    </div>
  );
}
