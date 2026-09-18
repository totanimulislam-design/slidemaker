import type { ThemeSettings } from "../lib/types";
import { PRESETS } from "../lib/presets";
import { describeScripts, FONT_BY_FAMILY, ensureFontStylesheet, toSingleFamily, type ScriptId } from "../lib/fonts";
import FontPicker from "./FontPicker";
import { ColorInput, PanelHead } from "./ui";

/**
 * Navigation ▸ "Design".
 *
 * The deck-level starting point every box falls back to: one-click theme
 * presets, the two brand colours (board + accent) and the shared typefaces
 * (Bangla / English / Arabic). A text panel only ever overrides what this
 * destination defaults — Question text styles the stem itself, Title text the
 * heading, and so on — so the deck-wide pieces live exactly here.
 */
interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  /** scripts detected in the deck (badge chips at the bottom) */
  scripts: ScriptId[];
}

export default function ThemePanel({ theme: T, setTheme, scripts }: Props) {
  const pickFont = (key: "bengaliFont" | "latinFont" | "arabicFont") =>
    (family: string) => {
      const meta = FONT_BY_FAMILY.get(family.toLowerCase());
      if (meta) ensureFontStylesheet([meta]);
      setTheme({ [key]: `'${family}', sans-serif` } as Partial<ThemeSettings>);
    };

  return (
    <div className="space-y-4">
      <PanelHead
        title="Design & defaults"
        subtitle="The starting look of the whole deck — presets, base colours and shared fonts. Each text panel only tweaks its own element on top of these."
      />

      {/* ------------------------------ theme presets ------------------------- */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">Theme presets</span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setTheme({ ...p.theme, banner: { ...T.banner, color: p.theme.titleBanner ?? T.banner?.color } })}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-left text-xs text-slate-300 hover:border-amber-400/50"
            >
              <span className="flex">
                {p.swatch.map((c) => (
                  <span key={c} className="-ml-1 h-4 w-4 rounded-full border border-black/50 first:ml-0" style={{ background: c }} />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------- deck colours ------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">Deck colours</span>
          <span className="text-[10px] text-slate-500">every element starts from these</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Board (surface)" value={T.board} onChange={(v) => setTheme({ board: v })} />
          <ColorInput label="Accent" value={T.accent} onChange={(v) => setTheme({ accent: v })} />
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          The <b>board</b> paints under everything (under backgrounds too); the{" "}
          <b>accent</b> drives the question bullet and every marker colour left on auto. Overlays, gradients and
          pictures sit in <b>Slide background</b>.
        </p>
      </div>

      {/* ------------------------------- deck faces --------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">Deck fonts</span>
          <span className="text-[10px] text-slate-500">fallback faces</span>
        </div>
        <FontPicker
          label="Bangla / default face"
          value={toSingleFamily(T.bengaliFont)}
          previewTarget="deck:bengali"
          onChange={pickFont("bengaliFont")}
          script="bangla"
          compact
        />
        <FontPicker
          label="English / Latin default face"
          value={toSingleFamily(T.latinFont)}
          previewTarget="deck:latin"
          onChange={pickFont("latinFont")}
          script="latin"
          compact
        />
        <FontPicker
          label="Arabic / Urdu fallback"
          value={toSingleFamily(T.arabicFont)}
          previewTarget="deck:arabic"
          onChange={pickFont("arabicFont")}
          script="arabic"
          compact
        />
        <p className="text-[10px] leading-relaxed text-slate-500">
          A text box without its own override uses these: questions, options and the footnote follow the default face,
          badges use the Latin one, Arabic script always falls back to the third.
        </p>
        {scripts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
            {describeScripts(scripts).map((s) => (
              <span key={s.id} className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
                {s.label}{s.rtl ? " · RTL" : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
