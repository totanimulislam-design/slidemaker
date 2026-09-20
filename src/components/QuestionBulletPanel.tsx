import type { Box, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { numberStyleDef, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { boxFontCss } from "../lib/boxFonts";
import { BulletPositionControls, BulletShapeControls } from "./BulletShapePanel";
import BulletDesignPanel from "./BulletDesignPanel";
import NumberBullet from "./NumberBullet";
import { Btn, PanelHead, Toggle } from "./ui";

/**
 * Navigation ▸ "Question bullet".
 *
 * The marker's own body: whether it is drawn, the design card (silhouette ·
 * one-click shape styles · shape effects, with its size and base colour) and
 * the shape channels the toolbar reaches one button each — fill, outline, its
 * style, corners, weight, transparency — plus where the marker sits. The number
 * painted *inside* it has its own destination ("Text inside question bullet").
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

      {/* the design card: silhouette, one-click styles and shape effects */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <BulletDesignPanel theme={T} setTheme={setTheme} />
      </div>

      {/* the channels, each with its own card — the toolbar opens them singly */}
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
        “{numberStyleDef(id).label}” — {numberStyleDef(id).hint}. Every design derives from the base colour on the
        design card, and the fill, outline, corners, weight, transparency and effect you set here paint the marker's body
        only. Wording, ink, face and size of the number itself live under <b>Q bullet text</b>.
      </p>
    </div>
  );
}
