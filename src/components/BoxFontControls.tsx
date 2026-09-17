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
import { Field, SegButtons, Slider, Toggle } from "./ui";
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

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Font — {ELEMENT_LABELS[selected]}
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
        label={`${script === "bangla" ? "Bangla" : script === "arabic" ? "Arabic" : "English"} typeface`}
        value={tf.family ?? ""}
        previewTarget={`box:${selected}`}
        onChange={(family) => {
          const meta = FONT_BY_FAMILY.get(family.toLowerCase());
          if (meta) ensureFontStylesheet([meta]);
          patch({ family, script: meta?.script ?? script });
        }}
        script={script}
        compact
      />

      <Field label="Weight">
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
        <Toggle
          label="UPPERCASE"
          checked={tf.uppercase === true}
          onChange={(v) => patch({ uppercase: v ? true : "inherit" })}
        />
      </div>

      <Field label="Letter spacing" hint={`${tf.letterSpacing ?? 0}px`}>
        <Slider min={-2} max={12} step={0.5} value={tf.letterSpacing ?? 0} onChange={(v) => patch({ letterSpacing: v })} />
      </Field>

      <Field label="Size scale" hint={`${Math.round((tf.scale ?? 1) * 100)}%`}>
        <Slider min={0.6} max={1.8} step={0.05} value={tf.scale ?? 1} onChange={(v) => patch({ scale: v })} />
      </Field>

      {!compact && (
        <p className="text-[10px] leading-relaxed text-slate-500">
          This font applies only to the <b>{ELEMENT_LABELS[selected]}</b> box. Mixed Bangla/Arabic/English still falls
          back through the universal chain. Currently: {boxFontLabel(theme, selected)}.
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
