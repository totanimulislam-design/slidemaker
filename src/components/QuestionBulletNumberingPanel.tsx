import type { ThemeSettings } from "../lib/types";
import {
  PLAIN_NUMBERING_STYLES,
  plainNumberingDef,
  questionNumberLabel,
  questionNumberSample,
} from "../lib/plainNumbering";
import { renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { deckStack } from "../lib/boxFonts";
import NumberBullet from "./NumberBullet";
import { boxFontCss, boxInlineCss } from "../lib/boxFonts";
import { cn } from "../utils/cn";

/**
 * Numbering on the Q bullet text toolbar — what the number *reads*, not what
 * the marker looks like.
 *
 * The old gallery of marker styles (bullet points · numbering formats ·
 * number + arrow) is gone from here: the marker's shape, fill, outline and
 * effects stay under the Question bullet line's own channels and the Design
 * card. This control changes only the numeral system the question's number is
 * drawn in — the nine systems an exam paper is numbered the world over:
 *
 *   English number  1 2 3        Bangla number   ১ ২ ৩
 *   Bangla letter   ক খ গ        English capital A B C
 *   English small   a b c        Roman capital   I II III
 *   Roman small     i ii iii     Arabic number   ١ ٢ ٣
 *   Arabic letter   أ ب ج
 *
 * …plus **Default**, which hands the reading back to each slide's own number
 * exactly as stored. Every chip previews the very sequence the board will
 * paint (`questionNumberSample` — the same generator Slide.tsx reads), so a
 * chip can never drift from the marker.
 */

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

/** the number a chip previews — the deck's marker drawn with the picked system */
const SAMPLE_NUMBER = "7";

export default function QuestionBulletNumberingPanel({ theme: T, setTheme }: Props) {
  const current = plainNumberingDef(T.questionNumbering);
  /** the marker keeps whatever design the Question bullet line set — only its digits re-letter */
  const styleId = (T.numberStyle ?? "circle") as NumberStyle;
  const sample = questionNumberLabel(T.questionNumbering, SAMPLE_NUMBER);
  const r = renderNumberStyle(styleId, T, 44, sample);
  /** a full fallback chain, so a face without Bangla/Arabic glyphs cannot leave a missing-glyph box in a chip */
  const face = deckStack(T, "options");

  return (
    <div className="space-y-3" data-bullet-numbering-panel="">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Numbering</span>
        <span className="text-[10px] text-slate-500">now {current.label.toLowerCase()}</span>
      </div>

      {/* the deck's own marker, wearing the picked system's digits */}
      <div
        className="flex items-center justify-center gap-4 overflow-hidden rounded-xl border border-white/10 px-3 py-4"
        style={{ background: T.board }}
      >
        <NumberBullet render={r}>
          <span
            style={{
              ...boxFontCss(T, "bullet", { fontSize: 44 * r.fontScale, color: r.color, display: "inline-block" }),
            }}
          >
            {boxInlineCss(T, "bullet") ? <span style={boxInlineCss(T, "bullet")}>{r.content}</span> : r.content}
          </span>
        </NumberBullet>
        <span className="text-[10px] leading-relaxed text-slate-400">
          your slides' numbers, read as <b className="text-slate-200">{sample}</b> — the marker keeps the design set
          under <b className="text-slate-200">Question bullet</b>.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Number system">
        {PLAIN_NUMBERING_STYLES.map((d) => {
          const on = d.id === current.id;
          const glyphs = d.id === "none" ? "as stored" : questionNumberSample(d.id, 3).join(" ");
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              aria-label={`Number system: ${d.label}`}
              title={`${d.label} — ${d.id === "none" ? "keep each slide's own number" : d.example}`}
              onClick={() => setTheme({ questionNumbering: d.id })}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition-colors",
                on
                  ? "border-amber-400 bg-amber-400/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              <span
                dir={d.id === "ar-letter" || d.id === "ar-number" ? "rtl" : "ltr"}
                className={cn(
                  "block w-full overflow-hidden whitespace-nowrap text-center text-[11px] font-bold leading-none",
                  on ? "text-amber-200" : "text-slate-300",
                )}
                style={{ fontFamily: face }}
              >
                {glyphs}
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[8px] leading-none",
                  on ? "text-amber-200/90" : "text-slate-400",
                )}
              >
                {d.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Default keeps each slide's own number exactly as it is stored. Pick a system and every question counts in
        it — 1 2 3 · ১ ২ ৩ · ক খ গ · A B C · a b c · I II III · i ii iii · ١ ٢ ٣ · أ ب ج. The marker's shape,
        fill, outline and effects are the Question bullet line's business and stay untouched.
      </p>
    </div>
  );
}
