import type { SlideData, ThemeSettings } from "../lib/types";
import type { OptionStyle } from "../lib/optionStyles";
import { readableOn, shade } from "../lib/color";
import { FONT_BY_FAMILY, ensureFontStylesheet, universalStack } from "../lib/fonts";
import { plainNumberingDef, DEFAULT_PLAIN_NUMBERING, effectiveOptionLabel } from "../lib/plainNumbering";
import OptionBulletMarker from "./OptionBulletMarker";
import FontPicker from "./FontPicker";
import PlainNumberingPicker from "./PlainNumberingPicker";
import { Btn, ColorField, Field, PanelHead, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Text inside option bullet".
 *
 * The letter painted in every option marker: what it says (plain numbering),
 * its ink colour, face, weight, case and size relative to the marker. The
 * marker's own silhouette, fill and ring stay in the "Option bullet" panel.
 */
interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const WEIGHTS = [
  { v: 0, l: "Auto" },
  { v: 400, l: "Regular" },
  { v: 500, l: "Medium" },
  { v: 600, l: "Semi" },
  { v: 700, l: "Bold" },
  { v: 800, l: "Extra" },
];

export default function OptionBulletTextPanel({ theme: T, slide, setTheme }: Props) {
  const base = T.optionAccent || T.accent || "#2f4fff";
  const picked = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : base);
  const numberingDef = plainNumberingDef(T.plainNumbering ?? DEFAULT_PLAIN_NUMBERING);
  const sizePct = T.optionBulletTextSize ?? 100;
  const weight = T.optionBulletTextWeight ?? 0;
  const family = T.optionBulletFontFamily ?? "";
  const keys = slide?.options.length
    ? slide.options.map((o, i) => effectiveOptionLabel(o.labelMode, o.key, T.plainNumbering, i))
    : ["ক", "খ", "গ", "ঘ"];
  const previewTheme: ThemeSettings = { ...T };

  return (
    <div className="space-y-4">
      <PanelHead
        title="Text inside option bullet"
        subtitle="The letter in each marker — numbering, ink, face, weight and size."
      />

      {/* ------------------------------ live preview ------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 p-3" style={{ background: T.board }}>
        {keys.slice(0, 4).map((k, i) => (
          <div key={`${k}-${i}`} className="flex items-center gap-2.5">
            <OptionBulletMarker
              theme={previewTheme}
              color={base}
              size={30}
              keyText={k}
              optionStyle={(T.optionStyle ?? "plain") as OptionStyle}
              fontFamily={
                family ? universalStack(`'${family}'`, T.arabicFont) : universalStack(T.bengaliFont, T.arabicFont)
              }
            />
            <span className="truncate text-[13px] font-bold" style={{ color: T.optionTextColor }}>
              option text
            </span>
          </div>
        ))}
      </div>

      {/* ------------------------------ numbering ---------------------------- */}
      <Field label="Label painted inside" hint={numberingDef.example} as="div">
        <PlainNumberingPicker theme={T} setTheme={setTheme} sampleKeys={slide?.options.map((o) => o.key)} />
      </Field>

      {/* --------------------------------- ink ------------------------------- */}
      <ColorField
        label="Ink colour"
        hint="letter inside the marker"
        value={T.optionBulletInk}
        fallback={picked(base)}
        onChange={(v) => setTheme({ optionBulletInk: v })}
        presets={["#ffffff", "#0b0b0f", base]}
        allowNone
      />
      <div className="flex flex-wrap gap-1.5">
        <Btn
          size="sm"
          title="White or near-black, whichever reads better on the current marker fill"
          onClick={() => setTheme({ optionBulletInk: readableOn(picked(T.optionBulletFill || base)) })}
        >
          Auto-contrast ink
        </Btn>
        <Btn size="sm" variant="soft" onClick={() => setTheme({ optionBulletInk: T.optionBulletFill || shade(base, 0.45) })}>
          Match marker fill
        </Btn>
      </div>
      <Toggle
        label="Keep the ink on the revealed correct answer"
        checked={T.optionBulletCustomOnAnswer}
        onChange={(v) => setTheme({ optionBulletCustomOnAnswer: v })}
      />

      {/* ------------------------------ typography --------------------------- */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <FontPicker
          label="Marker typeface"
          value={family}
          previewTarget="optionBullet"
          onChange={(f) => {
            const meta = FONT_BY_FAMILY.get(f.toLowerCase());
            if (meta) ensureFontStylesheet([meta]);
            setTheme({ optionBulletFontFamily: f });
          }}
          script="all"
          compact
        />

        <Field label="Weight">
          <div className="flex flex-wrap gap-1">
            {WEIGHTS.map((w) => (
              <button
                key={w.v}
                type="button"
                onClick={() => setTheme({ optionBulletTextWeight: w.v })}
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px]",
                  weight === w.v
                    ? "border-amber-400 bg-amber-400/15 text-amber-200"
                    : "border-white/10 text-slate-400 hover:border-white/25",
                )}
                style={{ fontWeight: w.v || 700 }}
              >
                {w.l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Letter size" hint={`${sizePct}% of the marker`}>
          <Slider min={50} max={170} step={5} value={sizePct} onChange={(v) => setTheme({ optionBulletTextSize: v })} />
        </Field>

        <Toggle
          label="Force UPPERCASE letters"
          checked={T.optionBulletUppercase ?? false}
          onChange={(v) => setTheme({ optionBulletUppercase: v })}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          variant="danger"
          onClick={() =>
            setTheme({
              optionBulletInk: "",
              optionBulletTextSize: 100,
              optionBulletTextWeight: 0,
              optionBulletFontFamily: "",
              optionBulletUppercase: false,
            })
          }
        >
          Reset marker text
        </Btn>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        The marker keeps the deck face by default, so an option-text font override never reaches the letters. Plain
        numbering decides <i>what</i> is painted; the controls above decide <i>how</i>.
      </p>
    </div>
  );
}
