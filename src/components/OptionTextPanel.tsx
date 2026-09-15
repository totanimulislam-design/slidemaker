import { useEffect, useRef } from "react";
import type { SlideData, ThemeSettings } from "../lib/types";
import { AR_KEYS, BN_KEYS } from "../lib/parse";
import { handleSmartPaste } from "../lib/richPaste";
import { PLAIN_NUMBERING_STYLES, DEFAULT_PLAIN_NUMBERING, effectiveOptionLabel, plainNumberLabel } from "../lib/plainNumbering";
import { FONT_BY_FAMILY, ensureFontStylesheet } from "../lib/fonts";
import { boxFontLabel, setBoxFont } from "../lib/boxFonts";
import FontPicker from "./FontPicker";
import { Btn, ColorInput, Field, Slider, TextInput } from "./ui";
import { cn } from "../utils/cn";

interface Props {
  slide?: SlideData;
  theme: ThemeSettings;
  setTheme: (p: Partial<ThemeSettings>) => void;
  updateSlide: (id: string, p: Partial<SlideData>) => void;
  updateAll: (p: Partial<SlideData>) => void;
  onAnswerCopies: () => void;
}

export default function OptionTextPanel({ slide, theme: T, setTheme, updateSlide, updateAll, onAnswerCopies }: Props) {
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  const currentNumbering = T.plainNumbering ?? DEFAULT_PLAIN_NUMBERING;
  /**
   * The option face lives on the options box only (boxFonts.options) — writing
   * it to the deck's Bengali font would repaint every text box on the slide.
   * With no override the box still follows the deck Bangla font, so decks saved
   * before this was scoped keep rendering exactly as they did.
   */
  const optionFont = boxFontLabel(T, "options");

  // a deck can be saved with any face from the library — make sure the one it
  // uses is actually downloaded, not just listed in the picker
  useEffect(() => {
    const meta = FONT_BY_FAMILY.get(optionFont.toLowerCase());
    if (meta) ensureFontStylesheet([meta]);
  }, [optionFont]);

  if (!slide) return <p className="text-sm text-slate-500">No slide selected.</p>;

  return (
    <div className="space-y-4">
      <div className="border-b border-white/10 pb-3"><h2 className="text-base font-semibold text-slate-100">Option text</h2><p className="text-[11px] text-slate-500">Edit choices, correct answers and option typography.</p></div>
      <div className="space-y-2">
        {slide.options.map((opt, i) => {
          const correct = slide.answer === opt.key;
          const displayLabel = effectiveOptionLabel(opt.labelMode, opt.key, currentNumbering, i);
          return (
            <div key={i} className="flex items-center gap-1.5">
              <button
                onClick={() => updateSlide(slide.id, { answer: correct ? null : opt.key })}
                title="Mark correct answer"
                className={cn("h-7 w-7 shrink-0 rounded-full border text-xs font-bold", correct ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-white/15 text-slate-500")}
              >
                {correct ? "✓" : ""}
              </button>
              <input
                value={displayLabel}
                onChange={(e) => {
                  const newKey = e.target.value;
                  const options = slide.options.map((o, j) => j === i ? { ...o, key: newKey, labelMode: "manual" as const } : o);
                  updateSlide(slide.id, { options, answer: correct ? newKey : slide.answer });
                }}
                className="w-10 rounded-lg border border-white/10 bg-slate-900/70 px-1 py-2 text-center text-sm text-amber-200 outline-none"
              />
              <TextInput
                ref={(el) => { refs.current[i] = el; }}
                value={opt.text}
                placeholder={`Option ${i + 1}`}
                onPaste={(e) => {
                  const res = handleSmartPaste(e, { singleLine: true });
                  if (res) updateSlide(slide.id, { options: slide.options.map((o, j) => j === i ? { ...o, text: res.value } : o) });
                }}
                onChange={(e) => updateSlide(slide.id, { options: slide.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) })}
              />
              <button onClick={() => updateSlide(slide.id, { options: slide.options.filter((_, j) => j !== i) })} className="px-1.5 text-slate-500 hover:text-rose-300">✕</button>
            </div>
          );
        })}
        <Btn
          size="sm"
          onClick={() => {
            const nextIndex = slide.options.length;
            let newKey: string;
            if (currentNumbering !== "none") {
              // When plain numbering is active, generate the auto label as the key
              newKey = plainNumberLabel(currentNumbering, nextIndex) ?? String(nextIndex + 1);
            } else {
              const first = slide.options[0]?.key ?? "";
              const family = AR_KEYS.includes(first) ? AR_KEYS : /^[a-e]$/i.test(first) ? ["a", "b", "c", "d", "e"] : BN_KEYS;
              newKey = family[slide.options.length] ?? String(slide.options.length + 1);
            }
            updateSlide(slide.id, { options: [...slide.options, { key: newKey, text: "", labelMode: "auto" }] });
          }}
        >
          + Add option
        </Btn>
      </div>
      <Field label="Option font size" hint={`${T.optionSize}px`}>
        <Slider min={16} max={46} value={T.optionSize} onChange={(v) => setTheme({ optionSize: v })} />
      </Field>
      <Field label="Wrapped text line height" hint={`${T.optionLineHeight}`}>
        <Slider min={1} max={2.2} step={0.05} value={T.optionLineHeight} onChange={(v) => setTheme({ optionLineHeight: v })} />
      </Field>
      <FontPicker
        label="Option text font"
        value={optionFont}
        onChange={(family) => {
          const meta = FONT_BY_FAMILY.get(family.toLowerCase());
          if (meta) ensureFontStylesheet([meta]);
          // patch the options box only (family, nothing else) — the deck's
          // Bengali/Latin/Arabic fonts and every other box stay untouched
          setTheme({ boxFonts: setBoxFont(T.boxFonts, "options", { family }) });
        }}
        script="all"
        compact
      />
      <div className="grid grid-cols-2 gap-2">
        <ColorInput label="Option text" value={T.optionTextColor} onChange={(v) => setTheme({ optionTextColor: v })} />
      </div>
      <Field label="Plain numbering" hint={PLAIN_NUMBERING_STYLES.find((s) => s.id === currentNumbering)?.example}>
        <select
          value={currentNumbering}
          onChange={(e) => setTheme({ plainNumbering: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
        >
          {PLAIN_NUMBERING_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Btn size="sm" onClick={() => updateAll({ showAnswer: true })}>Reveal all</Btn>
        <Btn size="sm" onClick={() => updateAll({ showAnswer: false })}>Hide all</Btn>
      </div>
      <Btn size="sm" variant="soft" onClick={onAnswerCopies}>Add answer copy after every slide</Btn>
    </div>
  );
}