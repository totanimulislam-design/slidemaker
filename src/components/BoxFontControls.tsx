import type { ElementId, ThemeSettings } from "../lib/types";
import {
  BOX_DEFAULT_SCRIPT,
  BOX_FONT_IDS,
  WEIGHTS,
  boxFontLabel,
  boxTypeface,
  clearBoxFont,
  setBoxFont,
} from "../lib/boxFonts";
import { FONT_BY_FAMILY, ensureFontStylesheet } from "../lib/fonts";
import FontPicker from "./FontPicker";
import { ColorInput, Field, SegButtons, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";
import { ELEMENT_LABELS } from "../lib/types";

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  selected: ElementId;
  compact?: boolean;
}

export default function BoxFontControls({ theme, setTheme, selected, compact }: Props) {
  if (selected === "logo") return null;
  const tf = boxTypeface(theme, selected);
  const script = tf.script ?? BOX_DEFAULT_SCRIPT[selected];
  const patch = (p: Parameters<typeof setBoxFont>[2]) =>
    setTheme({ boxFonts: setBoxFont(theme.boxFonts, selected, p) });

  const stroke = tf.textStroke ?? { enabled: false, color: "#000000", width: 1 };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Font & Typography — {ELEMENT_LABELS[selected]}
        </span>
        {theme.boxFonts?.[selected] && (
          <button
            onClick={() => setTheme({ boxFonts: clearBoxFont(theme.boxFonts, selected) })}
            className="text-[10px] text-slate-500 hover:text-amber-300"
          >
            reset to deck default
          </button>
        )}
      </div>

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
        label="Font (All Google Fonts)"
        value={tf.family ?? ""}
        previewTarget={`box:${selected}`}
        onChange={(family) => {
          const meta = FONT_BY_FAMILY.get(family.toLowerCase());
          if (meta) ensureFontStylesheet([meta]);
          patch({ family, script: meta?.script ?? script });
        }}
        script="all"
        compact
      />

      <div className="space-y-2">
        <Field label="Font size (0 to ∞ px)" hint={tf.fontSize !== undefined ? `${tf.fontSize}px` : "auto"}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="auto"
              value={tf.fontSize !== undefined ? tf.fontSize : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") patch({ fontSize: undefined });
                else {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0) patch({ fontSize: num });
                }
              }}
              className="w-24 rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
            />
            <div className="flex-1">
              <Slider
                min={0}
                max={200}
                step={1}
                value={tf.fontSize ?? 32}
                onChange={(v) => patch({ fontSize: v })}
              />
            </div>
          </div>
        </Field>

        <Field label="Size scale multiplier" hint={`${Math.round((tf.scale ?? 1) * 100)}%`}>
          <Slider min={0.1} max={5} step={0.05} value={tf.scale ?? 1} onChange={(v) => patch({ scale: v })} />
        </Field>
      </div>

      <ColorInput
        label="Font colour"
        value={tf.color || "#ffffff"}
        onChange={(v) => patch({ color: v })}
      />

      <Field label="Weight & Bold">
        <div className="flex flex-wrap gap-1">
          {WEIGHTS.map((w) => (
            <button
              key={w.v}
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
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Toggle label="Italic" checked={!!tf.italic} onChange={(v) => patch({ italic: v })} />
        <Toggle label="Strikethrough" checked={!!tf.strikethrough} onChange={(v) => patch({ strikethrough: v })} />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-medium text-slate-400 uppercase">Text Case</span>
        <SegButtons
          value={tf.textTransform ?? (tf.uppercase === true ? "uppercase" : tf.uppercase === "lowercase" ? "lowercase" : "none")}
          onChange={(v) => patch({ textTransform: v as any, uppercase: v === "uppercase" ? true : v === "lowercase" ? "lowercase" : false })}
          options={[
            { value: "none", label: "Normal" },
            { value: "uppercase", label: "UPPERCASE" },
            { value: "lowercase", label: "lowercase" },
          ]}
        />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-medium text-slate-400 uppercase">Text Alignment</span>
        <SegButtons
          value={tf.align ?? "left"}
          onChange={(v) => patch({ align: v as any })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
            { value: "justify", label: "Justify" },
          ]}
        />
      </div>

      <Field label="Letter spacing" hint={`${tf.letterSpacing ?? 0}px`}>
        <Slider min={-5} max={50} step={0.5} value={tf.letterSpacing ?? 0} onChange={(v) => patch({ letterSpacing: v })} />
      </Field>

      <Field label="Line spacing (line height)" hint={`${tf.lineHeight ?? 1.4}`}>
        <Slider min={0.5} max={4} step={0.05} value={tf.lineHeight ?? 1.4} onChange={(v) => patch({ lineHeight: v })} />
      </Field>

      <Field label="Text transparency (opacity)" hint={`${Math.round((tf.opacity ?? 1) * 100)}%`}>
        <Slider min={0} max={1} step={0.05} value={tf.opacity ?? 1} onChange={(v) => patch({ opacity: v })} />
      </Field>

      <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
        <span className="block text-[10px] font-semibold text-slate-300 uppercase">Text Effects</span>
        <Toggle label="Text Drop Shadow" checked={!!tf.textShadow} onChange={(v) => patch({ textShadow: v })} />
        <Field label="Text Glow" hint={tf.textGlow ? `${tf.textGlow}px` : "off"}>
          <Slider min={0} max={50} value={tf.textGlow ?? 0} onChange={(v) => patch({ textGlow: v })} />
        </Field>
        <Toggle
          label="Text Stroke / Outline"
          checked={stroke.enabled}
          onChange={(v) => patch({ textStroke: { ...stroke, enabled: v } })}
        />
        {stroke.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <ColorInput label="Outline colour" value={stroke.color} onChange={(v) => patch({ textStroke: { ...stroke, color: v } })} />
            <Field label="Width" hint={`${stroke.width}px`}>
              <Slider min={0.5} max={8} step={0.5} value={stroke.width} onChange={(v) => patch({ textStroke: { ...stroke, width: v } })} />
            </Field>
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-[10px] leading-relaxed text-slate-500">
          These typography and text effect settings apply to the <b>{ELEMENT_LABELS[selected]}</b> text box.
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
