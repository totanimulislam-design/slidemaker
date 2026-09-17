import type { SlideData, ThemeSettings } from "../lib/types";
import { renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { boxFontCss } from "../lib/boxFonts";
import NumberStylePicker from "./NumberStylePicker";
import { Btn, ColorInput, Field, PanelHead, Slider, Toggle } from "./ui";

/**
 * Navigation ▸ "Question bullet".
 *
 * The marker's own body: whether it is drawn, which of the 20 numbering designs
 * it uses, how big it is, the accent colour every design derives from, and
 * whether it detaches from the question so it can be placed on its own. The
 * number painted *inside* it has its own navigation entry.
 */
interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  /** select the bullet on the canvas (outline + drag handles) */
  onSelectBullet: () => void;
  /** open the "text inside question bullet" panel */
  onOpenText: () => void;
}

export default function QuestionBulletPanel({ theme: T, slide, setTheme, onSelectBullet, onOpenText }: Props) {
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const size = T.bulletSize ?? 54;
  const r = renderNumberStyle(id, T, size, slide?.number || "৭");

  return (
    <div className="space-y-4">
      <PanelHead title="Question bullet" subtitle="The number marker's body — design, size and accent colour." />

      {/* ------------------------------ live preview ------------------------- */}
      <div
        className="flex items-center justify-center gap-4 overflow-hidden rounded-xl border border-white/10 px-4 py-5"
        style={{ background: T.board }}
      >
        <div style={boxFontCss(T, "bullet", { ...r.style, fontSize: size * r.fontScale, color: r.color })}>
          {r.content}
        </div>
        <span className="max-w-[55%] truncate text-[15px] font-semibold" style={{ color: T.questionColor }}>
          {slide?.question.replace(/\$[^$]*\$/g, "▫").slice(0, 42) || "প্রশ্ন…"}
        </span>
      </div>

      <Toggle label="Show question bullet" checked={T.showBullet} onChange={(v) => setTheme({ showBullet: v })} />

      <Field label="Numbering style" as="div">
        <NumberStylePicker theme={T} setTheme={setTheme} />
      </Field>

      <Field label="Bullet size" hint={`${size}px`}>
        <Slider min={28} max={96} value={size} onChange={(v) => setTheme({ bulletSize: v })} />
      </Field>

      <ColorInput label="Bullet / numbering colour" value={T.accent} onChange={(v) => setTheme({ accent: v })} />

      <Toggle
        label="Bullet is a separate movable element"
        checked={T.bulletSeparate}
        onChange={(v) => {
          setTheme({ bulletSeparate: v });
          if (v) onSelectBullet();
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" onClick={onOpenText}>
          # Style the number inside →
        </Btn>
        {T.bulletSeparate && (
          <Btn size="sm" variant="soft" onClick={onSelectBullet}>
            ✥ Select bullet on canvas
          </Btn>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Every design derives from the accent colour above. Wording, ink, face and size of the number itself live under{" "}
        <b>Q bullet text</b>.
      </p>
    </div>
  );
}
