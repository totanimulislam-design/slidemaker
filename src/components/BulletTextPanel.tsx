import type { Box, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { renderNumberStyle, showsNumber, type NumberStyle } from "../lib/numberStyles";
import { boxFontCss, clearBoxFont, setBoxFont } from "../lib/boxFonts";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import { Btn, ColorInput, Field, PanelHead, TextInput, Toggle } from "./ui";

/**
 * Navigation ▸ "Text inside question bullet".
 *
 * The number painted *inside* the question bullet, kept separate from the
 * bullet's own silhouette: whether it is drawn at all, what it says, its ink
 * colour, face, weight, case, tracking and size — all through the `bullet`
 * box-typeface so it never leaks into the question text.
 */
interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  updateSlide: (id: string, patch: Partial<SlideData>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const PREVIEW_SIZE = 64;

export default function BulletTextPanel({ theme: T, slide, setTheme, updateSlide, patchLayout }: Props) {
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const r = renderNumberStyle(id, T, PREVIEW_SIZE, slide?.number || "৭");
  const drawsNumber = T.showNumber && showsNumber(id);
  const bulletFont = T.boxFonts?.bullet ?? {};

  const patchBullet = (p: Parameters<typeof setBoxFont>[2]) =>
    setTheme({ boxFonts: setBoxFont(T.boxFonts, "bullet", p) });

  return (
    <div className="space-y-4">
      <PanelHead title="Text inside question bullet" subtitle="The number drawn in the marker — wording, ink and typeface." />

      {/* ------------------------------ live preview ------------------------- */}
      <div
        className="flex items-center justify-center gap-5 overflow-hidden rounded-xl border border-white/10 px-4 py-6"
        style={{ background: T.board }}
      >
        <div
          style={boxFontCss(T, "bullet", {
            ...r.style,
            fontSize: PREVIEW_SIZE * r.fontScale,
            color: r.color,
          })}
        >
          {r.content}
        </div>
        <span className="text-[11px] text-slate-400">
          {drawsNumber ? (
            <>
              number <b className="text-slate-200">{slide?.number || "৭"}</b>
            </>
          ) : id === "none" ? (
            "bullet design is off"
          ) : showsNumber(id) ? (
            "number is hidden"
          ) : (
            "this bullet design has no number"
          )}
        </span>
      </div>

      <Toggle label="Show number inside bullet" checked={T.showNumber} onChange={(v) => setTheme({ showNumber: v })} />

      {!showsNumber(id) && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] p-2.5 text-[11px] leading-relaxed text-amber-200">
          The <b>{id}</b> bullet design is a mark without a number. Pick another design under{" "}
          <b>Question bullet</b> to paint one.
        </p>
      )}

      {slide && (
        <Field label="Question number" hint="per slide">
          <TextInput value={slide.number} onChange={(e) => updateSlide(slide.id, { number: e.target.value })} />
        </Field>
      )}

      <div className="space-y-2">
        <ColorInput
          label="Number ink colour"
          value={bulletFont.color || (/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#ffffff")}
          onChange={(v) => patchBullet({ color: v })}
        />
        <div className="flex flex-wrap gap-1.5">
          {Array.from(new Set(["#ffffff", "#0b0b0f", "#ffd633", T.accent])).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => patchBullet({ color: c })}
              title={c}
              className="h-6 w-6 rounded-md border border-black/40"
              style={{ background: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => patchBullet({ color: undefined })}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
            title="Let the bullet design choose its own ink"
          >
            auto
          </button>
        </div>
      </div>

      <BoxFontControls theme={T} setTheme={setTheme} selected="bullet" />

      {T.bulletSeparate ? (
        <ElementPosition theme={T} id="bullet" patchLayout={patchLayout} hideAlign label="Question bullet" />
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-slate-400">
          The bullet currently rides along with the question text. Turn on <b>Bullet is a separate movable element</b>{" "}
          under <b>Question bullet</b> to position it on its own.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn size="sm" variant="danger" onClick={() => setTheme({ boxFonts: clearBoxFont(T.boxFonts, "bullet") })}>
          Reset bullet text
        </Btn>
      </div>
    </div>
  );
}
