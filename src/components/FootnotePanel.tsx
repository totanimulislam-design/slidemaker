import type { Box, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { withAlpha } from "../lib/color";
import { boxFontCss, clearBoxFont } from "../lib/boxFonts";
import { handleSmartPaste } from "../lib/richPaste";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import MathText from "./MathText";
import { Btn, ColorInput, Field, PanelHead, Slider, TextInput, Toggle } from "./ui";

/**
 * Navigation ▸ "Footnote".
 *
 * The small line at the bottom of the board (board name, year, source…). Text,
 * visibility, colour, opacity, size, per-box typeface and position.
 */
interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  updateSlide: (id: string, patch: Partial<SlideData>) => void;
  updateAll: (patch: Partial<SlideData>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

export default function FootnotePanel({ theme: T, slide, setTheme, updateSlide, updateAll, patchLayout }: Props) {
  const color = T.noteColor || "#ffffff";
  const opacity = T.noteOpacity ?? 72;
  const size = T.noteSize ?? 20;
  const shown = T.showNote ?? true;
  const noteCss = boxFontCss(T, "note", {
    color: withAlpha(color, opacity / 100),
    fontSize: Math.round(size * 0.8),
    fontWeight: 500,
  });

  return (
    <div className="space-y-4">
      <PanelHead title="Footnote" subtitle="The small line at the bottom of the board — board, year, source." />

      {/* ------------------------------ live preview ------------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10 px-4 py-5" style={{ background: T.board }}>
        <div style={{ ...noteCss, minHeight: 20 }}>
          {slide?.note?.trim() ? <MathText text={slide.note} /> : <span style={{ opacity: 0.5 }}>বোর্ড: ঢাকা ২০২৪</span>}
        </div>
      </div>

      {slide ? (
        <>
          <Field label="Footnote text" hint="use $...$ for math">
            <TextInput
              value={slide.note ?? ""}
              placeholder="e.g. বোর্ড: ঢাকা ২০২৪"
              onPaste={(e) => {
                const res = handleSmartPaste(e, { singleLine: true });
                if (res) updateSlide(slide.id, { note: res.value });
              }}
              onChange={(e) => updateSlide(slide.id, { note: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {["বোর্ড: ঢাকা ২০২৪", "সূত্র: অধ্যায় ৩", "নম্বর: ১", "সময়: ১ মিনিট"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateSlide(slide.id, { note: s })}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-amber-200 hover:bg-white/10"
              >
                {s}
              </button>
            ))}
            {slide.note && (
              <button
                type="button"
                onClick={() => updateSlide(slide.id, { note: "" })}
                className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/20"
              >
                ✕ clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Btn size="sm" variant="soft" onClick={() => slide.note && updateAll({ note: slide.note })} disabled={!slide.note}>
              Copy this footnote to all slides
            </Btn>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No slide selected.</p>
      )}

      <Toggle label="Show footnote" checked={shown} onChange={(v) => setTheme({ showNote: v })} />

      <div className="grid grid-cols-2 gap-2">
        <ColorInput label="Footnote colour" value={color} onChange={(v) => setTheme({ noteColor: v })} />
        <Field label="Opacity" hint={`${opacity}%`}>
          <Slider min={5} max={100} value={opacity} onChange={(v) => setTheme({ noteOpacity: v })} />
        </Field>
      </div>

      <Field label="Footnote size" hint={`${size}px`}>
        <Slider min={10} max={44} value={size} onChange={(v) => setTheme({ noteSize: v })} />
      </Field>

      <BoxFontControls theme={T} setTheme={setTheme} selected="note" />

      <ElementPosition theme={T} id="note" patchLayout={patchLayout} />

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          variant="danger"
          onClick={() =>
            setTheme({
              noteColor: "#ffffff",
              noteOpacity: 72,
              noteSize: 20,
              showNote: true,
              boxFonts: clearBoxFont(T.boxFonts, "note"),
            })
          }
        >
          Reset footnote style
        </Btn>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        An empty footnote paints nothing — the space stays free for the option block. Style changes above are deck-wide;
        the wording is per slide.
      </p>
    </div>
  );
}
