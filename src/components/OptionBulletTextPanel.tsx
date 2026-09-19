import type { SlideData, ThemeSettings } from "../lib/types";
import type { OptionStyle } from "../lib/optionStyles";
import { readableOn, shade } from "../lib/color";
import { universalStack } from "../lib/fonts";
import { resetTextPart } from "../lib/boxFonts";
import { plainNumberingDef, DEFAULT_PLAIN_NUMBERING, effectiveOptionLabel } from "../lib/plainNumbering";
import OptionBulletMarker from "./OptionBulletMarker";
import BoxFontControls from "./BoxFontControls";
import PlainNumberingPicker from "./PlainNumberingPicker";
import { Btn, ColorField, Field, PanelHead } from "./ui";

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

export default function OptionBulletTextPanel({ theme: T, slide, setTheme }: Props) {
  const base = T.optionAccent || T.accent || "#2f4fff";
  const picked = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : base);
  const numberingDef = plainNumberingDef(T.plainNumbering ?? DEFAULT_PLAIN_NUMBERING);
  const sizePct = T.optionBulletTextSize ?? 100;
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

      {/* ------------------------------ typography --------------------------- */}
      {/* the LETTER only — face (whole Google catalogue), size % (0 → ∞),
          weight, case, spacing, opacity, effects and nudge. The marker's
          silhouette, fill and ring stay under "Option bullet". Family, weight,
          size and UPPERCASE keep living in the flat optionBullet* fields the
          toolbar and the markers always read (see lib/boxFonts patchTextPart). */}
      <BoxFontControls
        theme={T}
        setTheme={setTheme}
        selected="optionBullet"
        size={{
          value: sizePct,
          onChange: (v) => setTheme({ optionBulletTextSize: Math.max(0, Math.round(v)) }),
          unit: "%",
          sliderMax: 300,
          label: "Letter size (% of the marker, 0 to ∞)",
        }}
        hide={["color"]}
      />

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          variant="danger"
          onClick={() => setTheme({ optionBulletInk: "", ...resetTextPart(T, "optionBullet") })}
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
