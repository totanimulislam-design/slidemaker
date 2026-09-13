import type { ThemeSettings } from "../lib/types";
import OptionStylePicker from "./OptionStylePicker";
import OptionBulletShapePicker from "./OptionBulletShapePicker";
import { Btn, ColorInput, Field, SegButtons, Slider } from "./ui";

export default function OptionBulletPanel({ theme: T, setTheme }: { theme: ThemeSettings; setTheme: (p: Partial<ThemeSettings>) => void }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-base font-semibold text-slate-100">Option Bullet</h2>
        <p className="text-[11px] text-slate-500">Customize the marker shape (circle & alternatives) and row container.</p>
      </div>

      {/* Bullet Marker Shape (Alternatives to Circle) */}
      <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
            Marker Shape (Alternatives to Circle)
          </span>
          <span className="text-[10px] text-slate-400">24 shapes</span>
        </div>
        <OptionBulletShapePicker theme={T} setTheme={setTheme} />
      </div>

      {/* Bullet & Row Colors */}
      <div className="grid grid-cols-2 gap-2">
        <ColorInput label="Marker / bullet" value={T.optionAccent} onChange={(v) => setTheme({ optionAccent: v })} />
        <ColorInput label="Theme accent" value={T.accent} onChange={(v) => setTheme({ accent: v })} />
      </div>
      {T.optionAccent !== T.accent && (
        <Btn size="sm" onClick={() => setTheme({ optionAccent: T.accent })}>
          Match theme accent
        </Btn>
      )}

      {/* Row Container Style */}
      <Field label="Option row container style" hint="24 styles">
        <OptionStylePicker theme={T} setTheme={setTheme} />
      </Field>

      {/* Layout & Spacing */}
      <Field label="Options layout">
        <SegButtons
          value={T.optionsLayout}
          onChange={(v) => setTheme({ optionsLayout: v })}
          options={[
            { value: "right", label: "Right" },
            { value: "left", label: "Left" },
            { value: "two-col", label: "2 Col" },
            { value: "grid", label: "Grid" },
          ]}
        />
      </Field>
      <Field label="Gap between rows" hint={T.optionGap ? `${T.optionGap}%` : "auto"}>
        <Slider min={0} max={14} step={0.5} value={T.optionGap} onChange={(v) => setTheme({ optionGap: v })} />
      </Field>
    </div>
  );
}