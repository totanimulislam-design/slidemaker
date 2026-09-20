import type { Box, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { numberStyleDef, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { boxFontCss } from "../lib/boxFonts";
import { BulletPositionControls, BulletShapeControls } from "./BulletShapePanel";
import NumberBullet from "./NumberBullet";
import NumberStylePicker from "./NumberStylePicker";
import { Btn, ColorInput, Field, PanelHead, Slider, Toggle } from "./ui";

/**
 * Navigation ▸ "Question bullet".
 *
 * The marker's own body: whether it is drawn, which design it wears, how big it
 * is, the accent colour every design derives from — and the shape channels the
 * toolbar reaches directly (fill, outline, corners, weight, transparency, and
 * where the marker sits). The number painted *inside* it has its own
 * destination ("Text inside question bullet").
 */
interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  /** the z-preserving layout writer, so the marker can be placed like any other element */
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  /** select the bullet on the canvas (outline + drag handles) */
  onSelectBullet: () => void;
  /** open the "text inside question bullet" panel */
  onOpenText: () => void;
}

export default function QuestionBulletPanel({ theme: T, slide, setTheme, patchLayout, onSelectBullet, onOpenText }: Props) {
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const size = T.bulletSize ?? 54;
  const r = renderNumberStyle(id, T, size, slide?.number || "৭");

  return (
    <div className="space-y-4">
      <PanelHead
        title="Question bullet"
        subtitle="The number marker's body — design, colours, outline and where it sits."
      />

      {/* ------------------------------ live preview ------------------------- */}
      <div
        className="flex items-center justify-center gap-4 overflow-hidden rounded-xl border border-white/10 px-4 py-5"
        style={{ background: T.board }}
      >
        <NumberBullet render={r}>
          <span style={boxFontCss(T, "bullet", { fontSize: size * r.fontScale, color: r.color })}>{r.content}</span>
        </NumberBullet>
        <span className="max-w-[55%] truncate text-[15px] font-semibold" style={{ color: T.questionColor }}>
          {slide?.question.replace(/\$[^$]*\$/g, "▫").slice(0, 42) || "প্রশ্ন…"}
        </span>
      </div>

      <Toggle label="Show question bullet" checked={T.showBullet} onChange={(v) => setTheme({ showBullet: v })} />

      <Field label="Numbering design" as="div">
        <NumberStylePicker theme={T} setTheme={setTheme} />
      </Field>

      <Field label="Bullet size" hint={`${size}px`}>
        <Slider min={28} max={96} value={size} onChange={(v) => setTheme({ bulletSize: v })} />
      </Field>

      <ColorInput label="Bullet / numbering colour" value={T.accent} onChange={(v) => setTheme({ accent: v })} />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <BulletShapeControls theme={T} setTheme={setTheme} />
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <BulletPositionControls theme={T} setTheme={setTheme} patchLayout={patchLayout} onSelectBullet={onSelectBullet} />
      </div>

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
        “{numberStyleDef(id).label}” — {numberStyleDef(id).hint}. Every design derives from the accent colour above, and
        the fill, outline, corners, weight and transparency you set here are the marker's body only. Wording, ink, face
        and size of the number itself live under <b>Q bullet text</b>.
      </p>
    </div>
  );
}
