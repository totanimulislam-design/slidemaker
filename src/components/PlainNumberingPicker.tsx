import type { ThemeSettings } from "../lib/types";
import {
  PLAIN_NUMBERING_STYLES,
  plainNumberingDef,
  plainNumberingSample,
  type PlainNumbering,
} from "../lib/plainNumbering";
import { deckStack } from "../lib/boxFonts";
import { cn } from "../utils/cn";

/**
 * Plain numbering as a direct-selection control: every style sits in the panel
 * with the glyphs it really produces drawn on its own chip, so choosing one is
 * a single click — no dropdown, nothing hidden.
 *
 * The chips are fed by `plainNumberLabel` (the same generator the board and the
 * exports use), the active chip takes the project's selected-state styling, and
 * each preview is drawn in the deck's marker face, so a chip shows what the
 * slide will actually paint — including the fallbacks that keep Bangla and
 * Arabic glyphs from turning into missing-glyph boxes.
 */

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  /** the slide's own option keys — the preview for "Default", which paints no numbering */
  sampleKeys?: string[];
  /** accessible name of the group (defaults to the caption the panel shows) */
  label?: string;
}

export default function PlainNumberingPicker({ theme, setTheme, sampleKeys = [], label = "Plain numbering" }: Props) {
  const current = plainNumberingDef(theme.plainNumbering).id as PlainNumbering;
  /**
   * The face the option markers use — deliberately *not* the OPTION TEXT FONT,
   * which is scoped to option text, and always a full fallback chain so a face
   * without Bangla/Arabic glyphs cannot leave a missing-glyph box in a chip.
   */
  const face = deckStack(theme, "options");

  return (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={label}>
      {PLAIN_NUMBERING_STYLES.map((d) => {
        const on = d.id === current;
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            title={`${d.label} — ${d.example}`}
            onClick={() => setTheme({ plainNumbering: d.id })}
            className={cn(
              "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition-colors",
              on
                ? "border-amber-400 bg-amber-400/15"
                : "border-white/10 bg-white/[0.03] hover:border-white/25",
            )}
          >
            <span
              dir="ltr"
              className={cn(
                "block w-full overflow-hidden whitespace-nowrap text-center text-[11px] font-bold leading-none",
                // the amber tone of the panel's own selected state, so the chip
                // stays readable whatever the deck accent is
                on ? "text-amber-200" : "text-slate-300",
              )}
              style={{ fontFamily: face }}
            >
              {plainNumberingSample(d.id, 3, sampleKeys).join(" ")}
            </span>
            <span
              className={cn(
                "w-full truncate text-center text-[8px] leading-none",
                on ? "text-amber-200/90" : "text-slate-400",
              )}
            >
              {d.caption ?? d.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
