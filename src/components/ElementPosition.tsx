import type { Box, ElementId, ThemeSettings } from "../lib/types";
import { DEFAULT_LAYOUT, ELEMENT_LABELS, FREE_MAX, FREE_MIN } from "../lib/types";
import { clamp100, clampFree, convertMode } from "../lib/layoutMeasure";
import { Field, SegButtons, Slider } from "./ui";
import { cn } from "../utils/cn";

/**
 * Compact position / size / rotation editor for ONE board element.
 *
 * Every element panel ("Title text", "Badge 1", "Logo", "Footnote"…) ends with
 * this block, so picking a navigation item both selects that element on the
 * canvas *and* exposes its geometry right there — no trip to a global layout
 * panel. Writes go through the same z-preserving `patchLayout` the canvas drags
 * use, so layer order survives.
 */
interface Props {
  theme: ThemeSettings;
  id: ElementId;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  /** hide the alignment row (the logo box has no text to align) */
  hideAlign?: boolean;
  /** short caption, defaults to the element's own label */
  label?: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

const ANCHORS: [string, number, number][] = [
  ["↖", 0, 0], ["↑", 50, 0], ["↗", 100, 0],
  ["←", 0, 50], ["✛", 50, 50], ["→", 100, 50],
  ["↙", 0, 100], ["↓", 50, 100], ["↘", 100, 100],
];

export default function ElementPosition({ theme, id, patchLayout, hideAlign, label }: Props) {
  const layout = theme.layout;
  const box = layout[id] ?? DEFAULT_LAYOUT[id];
  const free = (box.mode ?? "align") === "free";
  const lo = free ? FREE_MIN : 0;
  const hi = free ? FREE_MAX : 100;
  const clamp = free ? clampFree : clamp100;
  const set = (p: Partial<Box>) => patchLayout(id, p);

  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">
          Position — {label ?? ELEMENT_LABELS[id]}
        </span>
        <button
          type="button"
          onClick={() => patchLayout(id, { ...DEFAULT_LAYOUT[id], z: box.z }, `Reset ${ELEMENT_LABELS[id]} position`)}
          className="text-[10px] text-slate-500 hover:text-amber-300"
          title="Put this element back at its default place and size"
        >
          reset
        </button>
      </div>

      <SegButtons
        value={free ? "free" : "align"}
        onChange={(v) => patchLayout(id, convertMode(id, box, v))}
        options={[
          { value: "free", label: "✥ Free" },
          { value: "align", label: "⊞ Aligned" },
        ]}
      />

      <Field label={free ? "Position (left / top edge)" : "Position (alignment)"} as="div">
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              ["X", box.x, lo, hi, (v: number) => set({ x: v })],
              ["Y", box.y, lo, hi, (v: number) => set({ y: v })],
              ["W", box.w, 3, 150, (v: number) => set({ w: v })],
            ] as [string, number, number, number, (v: number) => void][]
          ).map(([k, v, min, max, on]) => (
            <NumberCell key={k} k={k} value={r1(v)} min={min} max={max} onChange={on} />
          ))}
          <NumberCell
            k="H"
            value={box.h ?? NaN}
            min={2}
            max={150}
            disabled={!free}
            onChange={(v) => set({ h: v })}
          />
        </div>
        {free && (
          <span className="text-[10px] text-slate-500">
            {box.h ? "Fixed height" : "Height: auto (fits content)"}
            {box.h ? (
              <button onClick={() => set({ h: undefined })} className="ml-1.5 text-amber-300 hover:underline">
                make auto
              </button>
            ) : null}
          </span>
        )}
      </Field>

      <Field label="Horizontal ← →" hint={`${r1(box.x)} %`}>
        <Slider min={lo} max={hi} step={0.5} value={r1(box.x)} onChange={(v) => set({ x: clamp(v) })} />
      </Field>
      <Field label="Vertical ↑ ↓" hint={`${r1(box.y)} %`}>
        <Slider min={lo} max={hi} step={0.5} value={r1(box.y)} onChange={(v) => set({ y: clamp(v) })} />
      </Field>
      <Field label="Width" hint={`${r1(box.w)} %`}>
        <Slider min={3} max={free ? 150 : 100} step={0.5} value={r1(box.w)} onChange={(v) => set({ w: v })} />
      </Field>
      <Field label="Rotation" hint={`${box.rot ?? 0}°`}>
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <Slider min={-180} max={180} step={1} value={box.rot ?? 0} onChange={(v) => set({ rot: v })} />
          </div>
          <button
            type="button"
            onClick={() => set({ rot: 0 })}
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
          >
            0°
          </button>
        </div>
      </Field>

      {!hideAlign && (
        <Field label="Text alignment inside the box" as="div">
          <SegButtons
            value={box.align}
            onChange={(v) => set({ align: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
      )}

      <Field label={free ? "Jump to (keeps size)" : "Snap to"} as="div">
        <div className="grid grid-cols-9 gap-1">
          {ANCHORS.map(([icon, ax, ay]) => (
            <button
              key={icon}
              type="button"
              onClick={() => {
                if (!free) return set({ x: ax, y: ay });
                const h = box.h ?? 10;
                set({ x: r1((ax / 100) * (100 - box.w)), y: r1((ay / 100) * (100 - h)) });
              }}
              className="rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-xs text-slate-300 hover:border-amber-400/60 hover:bg-white/[0.08]"
            >
              {icon}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function NumberCell({
  k,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  k: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] text-slate-500">{k}</span>
      <span
        className={cn(
          "flex items-center rounded-lg border border-white/10 bg-slate-900/70 focus-within:border-amber-400/60",
          disabled && "opacity-40",
        )}
      >
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={0.5}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-full bg-transparent px-2 py-1.5 font-mono text-xs text-slate-100 outline-none disabled:opacity-40"
        />
        <span className="pr-1.5 text-[10px] text-slate-500">%</span>
      </span>
    </label>
  );
}
