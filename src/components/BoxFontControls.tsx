import type { ReactNode } from "react";
import type { BoxFontId, ElementId, ThemeSettings } from "../lib/types";
import {
  BOX_DEFAULT_SCRIPT,
  BOX_FONT_IDS,
  ELEMENT_INK_FIELD,
  TEXT_PART_LABELS,
  WEIGHTS,
  boxFontLabel,
  boxTypeface,
  clearBoxFont,
  elementInk,
  opacityAlpha,
  patchTextPart,
  resetTextPart,
  textPartHasOverride,
  textPartTypeface,
  typefaceOpacityPercent,
} from "../lib/boxFonts";
import { ensureFamily } from "../lib/fonts";
import { googleFontCount } from "../lib/googleFonts";
import FontPicker from "./FontPicker";
import TextEffectsEditor from "./TextEffectsEditor";
import { ColorInput, Field, SegButtons, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";
import { ELEMENT_LABELS } from "../lib/types";

/**
 * The complete text style of ONE text part — Badge 1, Badge 2, Badge 3, the
 * title, the question, the number inside the question bullet, the option text,
 * the letter inside the option markers, the footnote.
 *
 * Font (the whole Google Fonts catalogue) · size (0 → ∞) · colour · bold ·
 * italic · underline · strikethrough · case · alignment · letter spacing ·
 * line spacing · opacity · Canva-style text effects · position (a nudge
 * of the glyphs inside their box). Every write goes through `patchTextPart`,
 * the one write path the toolbar uses too, so the two surfaces never shadow
 * each other, and every value is read back from the typeface the board really
 * paints with.
 */
export interface SizeBinding {
  value: number;
  onChange: (v: number) => void;
  /** px (default) or % of the part's natural size */
  unit?: "px" | "%";
  /** practical slider range; the number field itself is unbounded */
  sliderMax?: number;
  label?: string;
}

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  selected: BoxFontId;
  compact?: boolean;
  /** heading (defaults to the part's name) */
  label?: string;
  /**
   * The part's primary size when a deck field owns it (title → `titleSize`,
   * option text → `optionSize`, marker letter → `optionBulletTextSize` %…).
   * Without it the typeface's own `fontSize` override is the size control.
   */
  size?: SizeBinding;
  /** sections the host already renders itself */
  hide?: ("family" | "size" | "color" | "align" | "position" | "effects")[];
  /** extra rows the host wants inside the card (e.g. the marker's numbering) */
  children?: ReactNode;
}

/** parts whose built-in weight is already bold (no override) */
const DEFAULT_BOLD = new Set<BoxFontId>(["title", "brand", "brandTop", "brandBottom", "badge", "bullet", "options", "optionBullet"]);

const NUM =
  "w-24 rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60";

/** a number field with no upper bound plus a slider over the practical range */
function NumberWithSlider({
  value,
  onChange,
  min,
  sliderMin = min,
  sliderMax,
  step = 1,
  placeholder,
  allowBlank,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min: number;
  sliderMin?: number;
  sliderMax: number;
  step?: number;
  placeholder?: string;
  allowBlank?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        step={step}
        placeholder={placeholder}
        value={value !== undefined ? value : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            if (allowBlank) onChange(undefined);
            return;
          }
          const n = parseFloat(raw);
          if (Number.isFinite(n) && n >= min) onChange(n);
        }}
        className={NUM}
      />
      <div className="flex-1">
        <Slider
          min={sliderMin}
          max={Math.max(sliderMax, value ?? 0)}
          step={step}
          value={value ?? sliderMin}
          onChange={(v) => onChange(v)}
        />
      </div>
    </div>
  );
}

export default function BoxFontControls({ theme, setTheme, selected, compact, label, size, hide = [], children }: Props) {
  if (selected === "logo") return null;
  const tf = textPartTypeface(theme, selected);
  const own = boxTypeface(theme, selected);
  const script = tf.script ?? BOX_DEFAULT_SCRIPT[selected];
  const patch = (p: Parameters<typeof patchTextPart>[2]) => setTheme(patchTextPart(theme, selected, p));
  const hidden = (k: NonNullable<Props["hide"]>[number]) => hide.includes(k);
  const title = label ?? TEXT_PART_LABELS[selected];
  const ink = elementInk(theme, selected);
  const inkField = ELEMENT_INK_FIELD[selected];
  const previewTarget = selected === "optionBullet" ? "optionBullet" : `box:${selected}`;

  const stroke = own.textStroke ?? { enabled: false, color: "#000000", width: 1 };
  // "Bold" reads the weight the board really paints: the override when there
  // is one, else the part's built-in weight
  const bold = tf.weight ? tf.weight >= 700 : DEFAULT_BOLD.has(selected);
  const caseValue = tf.textTransform ?? (tf.uppercase === true ? "uppercase" : tf.uppercase === "lowercase" ? "lowercase" : "none");
  /** 0–100 how much of the glyphs is painted: 100 = fully visible, 0 = gone */
  const opacity = typefaceOpacityPercent(tf);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-text-part={selected}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Text style — {title}</span>
        {textPartHasOverride(theme, selected) && (
          <button
            type="button"
            onClick={() => setTheme(resetTextPart(theme, selected))}
            className="text-[10px] text-slate-500 hover:text-amber-300"
          >
            reset to deck default
          </button>
        )}
      </div>

      {/* ------------------------------- font ------------------------------ */}
      {!hidden("family") && (
        <>
          <SegButtons
            value={script}
            onChange={(v) => patch({ script: v, family: undefined })}
            options={[
              { value: "bangla", label: "বাংলা" },
              { value: "latin", label: "English" },
              { value: "arabic", label: "عربي" },
            ]}
          />
          <FontPicker
            label={`Font (${googleFontCount().toLocaleString()} Google Fonts)`}
            value={tf.family ?? ""}
            previewTarget={previewTarget}
            onChange={(family) => {
              ensureFamily(family);
              patch({ family: family || undefined });
            }}
            script="all"
            compact
          />
        </>
      )}

      {/* ------------------------------- size ------------------------------ */}
      {!hidden("size") &&
        (size ? (
          <Field label={size.label ?? `Font size (0 to ∞ ${size.unit ?? "px"})`} hint={`${size.value}${size.unit ?? "px"}`} as="div">
            <NumberWithSlider
              ariaLabel={`${title} size`}
              value={size.value}
              min={0}
              sliderMax={size.sliderMax ?? (size.unit === "%" ? 300 : 200)}
              onChange={(v) => size.onChange(Math.max(0, v ?? 0))}
            />
          </Field>
        ) : (
          <Field label="Font size (0 to ∞ px)" hint={tf.fontSize !== undefined ? `${tf.fontSize}px` : "auto"} as="div">
            <NumberWithSlider
              ariaLabel={`${title} size`}
              value={tf.fontSize}
              min={0}
              sliderMax={200}
              placeholder="auto"
              allowBlank
              onChange={(v) => patch({ fontSize: v })}
            />
          </Field>
        ))}

      {/* ------------------------------ colour ----------------------------- */}
      {!hidden("color") && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <ColorInput label="Font colour" value={ink || "#ffffff"} onChange={(v) => patch({ color: v })} />
          </div>
          <button
            type="button"
            onClick={() => patch({ color: "" })}
            className={cn(
              "shrink-0 rounded-md border px-2 py-1.5 text-[10px]",
              !ink ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/10",
            )}
            title={inkField ? "Back to the automatic / shared colour" : "Let the design pick its own ink"}
          >
            auto
          </button>
        </div>
      )}

      {/* ---------------------- bold · italic · lines ---------------------- */}
      <div className="grid grid-cols-2 gap-2">
        <Toggle label="Bold" checked={bold} onChange={(v) => patch({ weight: v ? 700 : 400 })} />
        <Toggle label="Italic" checked={!!tf.italic} onChange={(v) => patch({ italic: v })} />
        <Toggle label="Underline" checked={!!tf.underline} onChange={(v) => patch({ underline: v })} />
        <Toggle label="Strikethrough" checked={!!tf.strikethrough} onChange={(v) => patch({ strikethrough: v })} />
      </div>

      <Field label="Weight" as="div">
        <div className="flex flex-wrap gap-1">
          {WEIGHTS.map((w) => (
            <button
              key={w.v}
              type="button"
              onClick={() => patch({ weight: w.v })}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px]",
                (tf.weight ?? 0) === w.v
                  ? "border-amber-400 bg-amber-400/15 text-amber-200"
                  : "border-white/10 text-slate-400 hover:border-white/25",
              )}
              style={{ fontWeight: w.v }}
            >
              {w.l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => patch({ weight: undefined })}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px]",
              !tf.weight ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 text-slate-400 hover:border-white/25",
            )}
          >
            Auto
          </button>
        </div>
      </Field>

      {/* ------------------------------- case ------------------------------ */}
      <Field label="Uppercase / lowercase" as="div">
        <SegButtons
          value={caseValue}
          onChange={(v) => patch({ textTransform: v, uppercase: v === "uppercase" ? true : v === "lowercase" ? "lowercase" : false })}
          options={[
            { value: "none", label: "Normal" },
            { value: "uppercase", label: "UPPERCASE" },
            { value: "lowercase", label: "lowercase" },
          ]}
        />
      </Field>

      {/* ---------------------------- alignment ---------------------------- */}
      {!hidden("align") && (
        <Field label="Alignment" as="div">
          <SegButtons
            value={tf.align ?? "auto"}
            onChange={(v) => patch({ align: v === "auto" ? undefined : (v as "left" | "center" | "right" | "justify") })}
            options={[
              { value: "auto", label: "Auto" },
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
              { value: "justify", label: "Justify" },
            ]}
          />
        </Field>
      )}

      {/* ----------------------------- spacing ----------------------------- */}
      <Field label="Letter spacing" hint={`${tf.letterSpacing ?? 0}px`} as="div">
        <NumberWithSlider
          ariaLabel={`${title} letter spacing`}
          value={tf.letterSpacing ?? 0}
          min={-50}
          sliderMin={-5}
          sliderMax={50}
          step={0.5}
          onChange={(v) => patch({ letterSpacing: v ?? 0 })}
        />
      </Field>

      <Field label="Line spacing" hint={`${tf.lineHeight ?? "auto"}`} as="div">
        <NumberWithSlider
          ariaLabel={`${title} line spacing`}
          value={tf.lineHeight}
          min={0}
          sliderMin={0.5}
          sliderMax={4}
          step={0.05}
          placeholder="auto"
          allowBlank
          onChange={(v) => patch({ lineHeight: v })}
        />
      </Field>

      {/* ----------------------------- opacity ----------------------------- */}
      <Field label="Opacity (100 = fully visible)" hint={`${opacity}%`} as="div">
        <NumberWithSlider
          ariaLabel={`${title} opacity`}
          value={opacity}
          min={0}
          sliderMax={100}
          onChange={(v) => patch({ opacity: opacityAlpha(v ?? 100) })}
        />
      </Field>

      {/* ----------------------------- effects ----------------------------- */}
      {!hidden("effects") && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
          <TextEffectsEditor value={tf.effect} onChange={(effect) => patch({ effect })} textColor={ink || "#ffffff"} compact={compact} />
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">More: glow · drop shadow · stroke</summary>
            <div className="space-y-2 pt-2">
              <Toggle label="Text drop shadow" checked={!!tf.textShadow} onChange={(v) => patch({ textShadow: v })} />
              <Field label="Text glow" hint={tf.textGlow ? `${tf.textGlow}px` : "off"} as="div">
                <Slider min={0} max={50} value={tf.textGlow ?? 0} onChange={(v) => patch({ textGlow: v })} />
              </Field>
              <Toggle
                label="Text stroke"
                checked={stroke.enabled}
                onChange={(v) => patch({ textStroke: { ...stroke, enabled: v } })}
              />
              {stroke.enabled && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <ColorInput label="Stroke colour" value={stroke.color} onChange={(v) => patch({ textStroke: { ...stroke, color: v } })} />
                  <Field label="Width" hint={`${stroke.width}px`} as="div">
                    <Slider min={0.5} max={8} step={0.5} value={stroke.width} onChange={(v) => patch({ textStroke: { ...stroke, width: v } })} />
                  </Field>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* ----------------------------- position ---------------------------- */}
      {!hidden("position") && (
        <Field label="Text position (nudge inside the box)" hint={`${tf.offsetX ?? 0}, ${tf.offsetY ?? 0} px`} as="div">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-slate-400">
              X
              <input
                type="number"
                aria-label={`${title} position X`}
                step={1}
                value={tf.offsetX ?? 0}
                onChange={(e) => {
                  const n = e.currentTarget.valueAsNumber;
                  if (Number.isFinite(n)) patch({ offsetX: n || undefined });
                }}
                className="w-20 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-slate-400">
              Y
              <input
                type="number"
                aria-label={`${title} position Y`}
                step={1}
                value={tf.offsetY ?? 0}
                onChange={(e) => {
                  const n = e.currentTarget.valueAsNumber;
                  if (Number.isFinite(n)) patch({ offsetY: n || undefined });
                }}
                className="w-20 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
              />
            </label>
            {(tf.offsetX || tf.offsetY) ? (
              <button
                type="button"
                onClick={() => patch({ offsetX: undefined, offsetY: undefined })}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
              >
                centre
              </button>
            ) : null}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Moves only the glyphs of <b>{title}</b>. The box they sit in — and whatever is painted with it — stays where it is; move that with the position controls below.
          </p>
        </Field>
      )}

      {children}

      {!compact && (
        <p className="text-[10px] leading-relaxed text-slate-500">
          Everything here styles the <b>{title}</b> text only — not the block it is painted inside.
        </p>
      )}
    </div>
  );
}

/** Overview of every box's typeface — used on the Design tab. */
export function AllBoxFonts({ theme, setTheme, onPick }: { theme: ThemeSettings; setTheme: Props["setTheme"]; onPick?: (id: ElementId) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Fonts per box</span>
      <p className="text-[11px] text-slate-500">Each text box can use its own typeface. Click a row to edit it.</p>
      <div className="space-y-1 rounded-xl border border-white/10 bg-slate-900/40 p-1">
        {BOX_FONT_IDS.filter((id) => id !== "logo").map((id) => {
          const tf = boxTypeface(theme, id);
          const label = boxFontLabel(theme, id);
          return (
            <button
              key={id}
              onClick={() => onPick?.(id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
            >
              <span className="w-20 shrink-0 text-[11px] text-slate-400">{ELEMENT_LABELS[id]}</span>
              <span
                className="min-w-0 flex-1 truncate text-[13px] text-slate-100"
                style={{ fontFamily: `'${label}', sans-serif`, fontWeight: tf.weight ?? 600, fontStyle: tf.italic ? "italic" : "normal" }}
              >
                {label}
                {tf.weight ? ` · ${tf.weight}` : ""}
                {tf.italic ? " · italic" : ""}
                {tf.uppercase === true ? " · ABC" : ""}
              </span>
              {theme.boxFonts?.[id] ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTheme({ boxFonts: clearBoxFont(theme.boxFonts, id) });
                  }}
                  className="text-[10px] text-slate-600 hover:text-amber-300"
                >
                  reset
                </button>
              ) : (
                <span className="text-[9px] text-slate-600">default</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
