import type { OptionBulletBgScope, OptionBulletBgShape, ThemeSettings } from "../lib/types";
import type { OptionStyle } from "../lib/optionStyles";
import { readableOn, shade } from "../lib/color";
import OptionStylePicker from "./OptionStylePicker";
import OptionBulletShapePicker from "./OptionBulletShapePicker";
import OptionBulletMarker from "./OptionBulletMarker";
import { Btn, ColorField, ColorInput, Field, SegButtons, Slider, Toggle } from "./ui";

const BG_SHAPES: { value: OptionBulletBgShape; label: string }[] = [
  { value: "match", label: "Match" },
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "pill", label: "Pill" },
  { value: "diamond", label: "Diamond" },
  { value: "hexagon", label: "Hexagon" },
  { value: "soft", label: "Soft glow" },
];

export default function OptionBulletPanel({ theme: T, setTheme }: { theme: ThemeSettings; setTheme: (p: Partial<ThemeSettings>) => void }) {
  const base = T.optionAccent || T.accent || "#2f4fff";
  const picked = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : base);
  const anyCustom = [T.optionBulletInk, T.optionBulletFill, T.optionBulletBorder].some((v) => !!v);
  const bg = T.optionBulletBgColor || "";
  const bgScope: OptionBulletBgScope = T.optionBulletBgScope === "row" ? "row" : "marker";

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

      {/* --------------------------------------------------- marker colours --- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">Marker colours</span>
          <span className="text-[10px] text-slate-500">each part, independently</span>
        </div>

        <div className="flex items-center gap-2">
          <ColorInput label="Marker colour (auto base)" value={T.optionAccent} onChange={(v) => setTheme({ optionAccent: v })} />
          <ColorInput label="Theme accent" value={T.accent} onChange={(v) => setTheme({ accent: v })} />
        </div>

        <div className="space-y-1.5 pt-1">
          <ColorField
            label="Ink / text"
            hint="Letter inside the marker"
            value={T.optionBulletInk}
            fallback={picked(base)}
            onChange={(v) => setTheme({ optionBulletInk: v })}
            presets={["#ffffff", "#0b0b0f", base]}
            allowNone
          />
          <ColorField
            label="Fill"
            hint="Background of the marker"
            value={T.optionBulletFill}
            fallback={shade(picked(base), 0.2)}
            onChange={(v) => setTheme({ optionBulletFill: v })}
            presets={[base, shade(base, 0.45), shade(base, -0.35)]}
            allowNone
          />
          <ColorField
            label="Border"
            hint="Outline / ring around the marker"
            value={T.optionBulletBorder}
            fallback={shade(picked(base), 0.5)}
            onChange={(v) => setTheme({ optionBulletBorder: v })}
            presets={["#ffffff", base, "#0b0b0f"]}
            allowNone
          />
        </div>

        <Toggle
          label="Keep these colours on the revealed correct answer"
          checked={T.optionBulletCustomOnAnswer}
          onChange={(v) => setTheme({ optionBulletCustomOnAnswer: v })}
        />

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Btn
            size="sm"
            variant="soft"
            disabled={!anyCustom}
            onClick={() => setTheme({ optionBulletInk: "", optionBulletFill: "", optionBulletBorder: "" })}
          >
            Reset to auto
          </Btn>
          <Btn size="sm" onClick={() => setTheme({ optionBulletInk: T.optionBulletFill, optionBulletFill: T.optionBulletInk })}>
            Swap ink ↔ fill
          </Btn>
          <Btn
            size="sm"
            title="White or near-black, whichever reads better on the current fill"
            onClick={() => setTheme({ optionBulletInk: readableOn(picked(T.optionBulletFill || base)) })}
          >
            Auto-contrast ink
          </Btn>
          {T.optionAccent !== T.accent && (
            <Btn size="sm" onClick={() => setTheme({ optionAccent: T.accent })}>
              Match theme accent
            </Btn>
          )}
        </div>

        {/* live preview of all four channels at once */}
        <div className="space-y-1.5 rounded-lg border border-white/10 p-2" style={{ background: T.board }}>
          {["ক", "খ"].map((key, i) => (
            <div key={key} className="flex items-center gap-2.5">
              <OptionBulletMarker
                theme={T}
                color={base}
                size={26}
                keyText={key}
                highlight={i === 1}
                optionStyle={(T.optionStyle ?? "plain") as OptionStyle}
                fontFamily={T.bengaliFont}
              />
              <span className="truncate text-[13px] font-bold" style={{ color: i === 1 ? "#5cff9d" : T.optionTextColor }}>
                {i === 1 ? "revealed answer" : "option text"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------- background shape --- */}
      <div className="space-y-2.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-cyan-200 uppercase">Background shape colour</span>
          <span className="text-[10px] text-slate-500">behind the bullet</span>
        </div>

        <ColorField
          label="Background shape"
          hint={bg ? "on" : "off"}
          value={bg}
          fallback={shade(base, -0.35)}
          onChange={(v) => setTheme({ optionBulletBgColor: v })}
          autoLabel="Off"
          presets={[base, shade(base, 0.5), "#ffffff", "#000000"]}
        />

        {bg && (
          <>
            <Field label="Painted behind">
              <SegButtons
                value={bgScope}
                onChange={(v) => setTheme({ optionBulletBgScope: v as OptionBulletBgScope })}
                options={[
                  { value: "marker", label: "The marker" },
                  { value: "row", label: "The whole row" },
                ]}
              />
            </Field>

            {bgScope === "marker" ? (
              <>
                <Field label="Shape" hint="Match = the marker's own silhouette">
                  <div className="grid grid-cols-4 gap-1">
                    {BG_SHAPES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setTheme({ optionBulletBgShape: s.value })}
                        className={
                          (T.optionBulletBgShape ?? "match") === s.value
                            ? "rounded-md bg-cyan-400 px-1 py-1 text-[10px] font-semibold text-slate-950"
                            : "rounded-md border border-white/10 bg-slate-900/70 px-1 py-1 text-[10px] text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Shape size" hint={`${T.optionBulletBgSize ?? 150}%`}>
                  <Slider min={80} max={300} step={5} value={T.optionBulletBgSize ?? 150} onChange={(v) => setTheme({ optionBulletBgSize: v })} />
                </Field>
              </>
            ) : (
              <Field label="Row finish" hint="corners come from the row style">
                <SegButtons
                  value={T.optionBulletBgShape === "soft" ? "soft" : "match"}
                  onChange={(v) => setTheme({ optionBulletBgShape: v as OptionBulletBgShape })}
                  options={[
                    { value: "match", label: "Flat" },
                    { value: "soft", label: "Soft glow" },
                  ]}
                />
              </Field>
            )}

            <Field label="Shape opacity" hint={`${T.optionBulletBgOpacity ?? 30}%`}>
              <Slider min={0} max={100} step={1} value={T.optionBulletBgOpacity ?? 30} onChange={(v) => setTheme({ optionBulletBgOpacity: v })} />
            </Field>

            <Btn size="sm" variant="danger" onClick={() => setTheme({ optionBulletBgColor: "" })}>
              Remove background shape
            </Btn>
          </>
        )}
        {!bg && (
          <p className="text-[10px] leading-relaxed text-slate-500">
            Pick a colour to paint a shape behind every option bullet — a plate under the marker, or a tint across the whole
            option row. Auto (off) keeps the row exactly as the option style draws it.
          </p>
        )}
      </div>

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
