import type { Box, ElementId, LayoutMap, OptionsLayout, ThemeSettings } from "../lib/types";
import { DEFAULT_LAYOUT, ELEMENT_LABELS, FREE_MAX, FREE_MIN, cloneLayout } from "../lib/types";
import { clamp100, clampFree, convertMode } from "../lib/layoutMeasure";
import { Btn, Field, SegButtons, Slider, Toggle } from "./ui";
import BoxFontControls from "./BoxFontControls";
import { cn } from "../utils/cn";

const IDS: ElementId[] = ["title", "brand", "logo", "badge", "question", "options", "note"];

const OPTION_PRESETS: { id: OptionsLayout; label: string; box: Partial<Box> }[] = [
  { id: "right", label: "Right column", box: { x: 88, y: 72, w: 42, align: "left" } },
  { id: "left", label: "Left column", box: { x: 6, y: 72, w: 46, align: "left" } },
  { id: "two-col", label: "Two columns", box: { x: 50, y: 74, w: 92, align: "left" } },
  { id: "grid", label: "Centred grid", box: { x: 50, y: 70, w: 78, align: "center" } },
];

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  /** z-preserving, functional writers (see useDeck) */
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  transformLayout: (fn: (layout: LayoutMap) => LayoutMap, label?: string) => void;
  selected: ElementId;
  onSelect: (id: ElementId) => void;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

function NumberBox({
  value,
  onChange,
  min,
  max,
  step = 0.5,
  suffix = "%",
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-slate-900/70 focus-within:border-amber-400/60">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-full bg-transparent px-2 py-1.5 font-mono text-xs text-slate-100 outline-none disabled:opacity-40"
      />
      <span className="pr-2 text-[10px] text-slate-500">{suffix}</span>
    </div>
  );
}

export default function LayoutPanel({ theme, setTheme, patchLayout, transformLayout, selected, onSelect }: Props) {
  const labelOf = (id: ElementId) => ELEMENT_LABELS[id];
  const layout = theme.layout;
  const box = layout[selected] ?? DEFAULT_LAYOUT[selected];
  const free = (box.mode ?? "align") === "free";
  const lo = free ? FREE_MIN : 0;
  const hi = free ? FREE_MAX : 100;
  const clamp = free ? clampFree : clamp100;

  // every write goes through functional updaters so layer order (z) survives
  const commit = (next: LayoutMap, label?: string) => transformLayout(() => next, label);
  const patch = (id: ElementId, p: Partial<Box>, label?: string) => patchLayout(id, p, label);
  const set = (p: Partial<Box>) => patch(selected, p);

  const setMode = (mode: "align" | "free") => patch(selected, convertMode(selected, box, mode));
  const setAllModes = (mode: "align" | "free") => {
    const next = { ...layout } as LayoutMap;
    IDS.forEach((id) => {
      if (next[id]) next[id] = convertMode(id, next[id], mode);
    });
    commit(next);
  };

  const allFree = IDS.every((id) => (layout[id]?.mode ?? "align") === "free");

  return (
    <div className="space-y-4">
      {/* ------------------------------ mode switch -------------------------- */}
      <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">Positioning mode</span>
          <button
            onClick={() => setAllModes(allFree ? "align" : "free")}
            className="rounded-md border border-amber-400/40 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-400/15"
          >
            {allFree ? "Set all → Aligned" : "Set all → Free"}
          </button>
        </div>
        <SegButtons
          value={free ? "free" : "align"}
          onChange={(v) => setMode(v)}
          options={[
            { value: "free", label: "✥ Free" },
            { value: "align", label: "⊞ Aligned" },
          ]}
        />
        <p className="text-[11px] leading-relaxed text-slate-400">
          {free ? (
            <>
              <b className="text-slate-200">Free:</b> X / Y are the element's own left & top edge. Drag it anywhere —
              even past the edges (−50 … 150 %) — resize with the yellow corner grip, rotate and layer.
            </>
          ) : (
            <>
              <b className="text-slate-200">Aligned:</b> 0 % = flush left/top, 50 % = centred, 100 % = flush
              right/bottom; the element always stays inside the board.
            </>
          )}
        </p>
      </div>

      {/* ------------------------------ element picker ----------------------- */}
      <Field label="Element" hint="or click it on the slide">
        <div className="grid grid-cols-3 gap-1.5">
          {IDS.map((id) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                selected === id
                  ? "border-amber-400 bg-amber-400 text-slate-950"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
              )}
            >
              {labelOf(id)}
              {(layout[id]?.mode ?? "align") === "free" && <span title="free" className="text-[9px] opacity-70">✥</span>}
            </button>
          ))}
        </div>
      </Field>

      {selected !== "logo" && (
        <BoxFontControls theme={theme} setTheme={setTheme} selected={selected} />
      )}

      {/* ----------------------------- exact numbers ------------------------- */}
      <Field label={free ? "Position (left / top edge)" : "Position (alignment)"}>
        <div className="grid grid-cols-4 gap-1.5">
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-500">X</span>
            <NumberBox value={r1(box.x)} min={lo} max={hi} onChange={(v) => set({ x: v })} />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-500">Y</span>
            <NumberBox value={r1(box.y)} min={lo} max={hi} onChange={(v) => set({ y: v })} />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-500">W</span>
            <NumberBox value={r1(box.w)} min={3} max={150} onChange={(v) => set({ w: v })} />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-500">H</span>
            <NumberBox
              value={box.h ?? NaN}
              min={2}
              max={150}
              disabled={!free}
              onChange={(v) => set({ h: v })}
            />
          </label>
        </div>
        {free && selected === "logo" && (
          <button
            onClick={() => {
              // restore the image's natural proportions from the bitmap
              const img = document.querySelector<HTMLImageElement>('.slide-editable [data-el="logo"] img');
              const ratio = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
              set({ h: r1((box.w / ratio) * (16 / 9)) });
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60"
            title="Reset the logo box to the image's own aspect ratio"
          >
            ⤢ Reset logo proportions
          </button>
        )}
        {free && (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {box.h ? "Fixed height" : "Height: auto (fits content)"}
            </span>
            {box.h ? (
              <button onClick={() => set({ h: undefined })} className="text-[10px] text-amber-300 hover:underline">
                make auto
              </button>
            ) : null}
          </div>
        )}
      </Field>

      {/* --------------------------------- sliders --------------------------- */}
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
            onClick={() => set({ rot: 0 })}
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
          >
            0°
          </button>
        </div>
      </Field>

      <Field label="Text alignment inside the box">
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

      {/* ------------------------------ quick align -------------------------- */}
      <Field label={free ? "Jump to (keeps size)" : "Snap to"}>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["↖", 0, 0], ["↑", 50, 0], ["↗", 100, 0],
              ["←", 0, 50], ["✛", 50, 50], ["→", 100, 50],
              ["↙", 0, 100], ["↓", 50, 100], ["↘", 100, 100],
            ] as [string, number, number][]
          ).map(([icon, ax, ay]) => (
            <button
              key={icon}
              onClick={() => {
                if (!free) return set({ x: ax, y: ay });
                // in free mode convert the alignment anchor into an edge position
                const h = box.h ?? 10;
                set({ x: r1((ax / 100) * (100 - box.w)), y: r1((ay / 100) * (100 - h)) });
              }}
              className="rounded-lg border border-white/10 bg-white/[0.03] py-2 text-sm text-slate-300 hover:border-amber-400/60 hover:bg-white/[0.08]"
            >
              {icon}
            </button>
          ))}
        </div>
      </Field>

      {/* --------------------------------- snapping -------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Toggle
          label="Magnetic snapping while dragging"
          checked={theme.snapEnabled}
          onChange={(v) => setTheme({ snapEnabled: v })}
        />
        {theme.snapEnabled && (
          <Field label="Free-mode grid step" hint={`${theme.snapStep} %`}>
            <SegButtons
              value={String(theme.snapStep)}
              onChange={(v) => setTheme({ snapStep: Number(v) })}
              options={[
                { value: "0.5", label: "0.5" },
                { value: "1", label: "1" },
                { value: "2.5", label: "2.5" },
                { value: "5", label: "5" },
              ]}
            />
          </Field>
        )}
        <p className="text-[11px] text-slate-500">
          Hold nothing to drag freely; <b>Shift + arrows</b> nudge 1 %, <b>Shift + Alt + arrows</b> nudge 0.2 %.
        </p>
      </div>

      {/* --------------------------- option block presets -------------------- */}
      {selected === "options" && (
        <Field label="Option block presets">
          <div className="grid grid-cols-2 gap-1.5">
            {OPTION_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setTheme({ optionsLayout: p.id });
                  patch("options", { ...p.box, mode: "align", h: undefined });
                }}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs transition-colors",
                  theme.optionsLayout === p.id
                    ? "border-amber-400 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* --------------------------------- resets ---------------------------- */}
      <div className="flex gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          onClick={() => patch(selected, { ...DEFAULT_LAYOUT[selected], z: layout[selected]?.z }, "Reset element position")}
        >
          Reset {labelOf(selected)}
        </Btn>
        <Btn
          size="sm"
          variant="danger"
          onClick={() =>
            transformLayout((cur) => {
              const fresh = cloneLayout(DEFAULT_LAYOUT);
              (Object.keys(fresh) as ElementId[]).forEach((k) => {
                fresh[k] = { ...fresh[k], z: cur[k]?.z };
              });
              return fresh;
            }, "Reset all positions")
          }
        >
          Reset all positions
        </Btn>
      </div>

      {/* ------------------------------ mini preview ------------------------- */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Position map</span>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/15 bg-slate-900">
          {[25, 50, 75].map((p) => (
            <div key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-white/[0.07]" style={{ left: `${p}%` }} />
          ))}
          {[25, 50, 75].map((p) => (
            <div key={`h${p}`} className="absolute right-0 left-0 h-px bg-white/[0.07]" style={{ top: `${p}%` }} />
          ))}
          {IDS.map((id) => {
            const b = layout[id];
            if (!b) return null;
            const isFree = (b.mode ?? "align") === "free";
            const active = id === selected;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                title={labelOf(id)}
                className={cn(
                  "absolute truncate rounded px-1 text-[8px] leading-[14px] transition-colors",
                  active ? "z-10 bg-amber-400 text-slate-950" : "bg-white/15 text-slate-300 hover:bg-white/25",
                )}
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.w}%`,
                  height: isFree && b.h ? `${b.h}%` : 14,
                  transform: `${isFree ? "" : `translate(-${b.x}%, -${b.y}%)`} rotate(${b.rot ?? 0}deg)`,
                  zIndex: active ? 10 : b.z ?? 3,
                }}
              >
                {labelOf(id)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
