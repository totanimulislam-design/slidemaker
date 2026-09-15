/**
 * "Plain numbering" for the option markers.
 *
 * By default a marker draws the option's parsed key (ক খ গ / a b c / 1 2 3…).
 * A plain-numbering style replaces that text with a label generated purely from
 * the option's position, so a deck can count 1, 2, 3 — or ক খ গ, ١ ٢ ٣, I II
 * III — without touching the stored keys. Like the question-bullet numbering
 * (see lib/numberStyles), a style is a pure function of (style, index), so it
 * renders identically on the canvas, in thumbnails, in PNG/PDF and in PPTX.
 * "none" (the default) keeps the existing option-key behaviour untouched.
 *
 * A typed marker is a per-option "manual" override that outranks the style,
 * and `resetOptionLabels` below is what the single "Reset Labels" button calls
 * to drop every one of those overrides at once.
 */

import { AR_KEYS, BN_KEYS } from "./parse";
import type { OptionKey, QuizOption } from "./types";

export type PlainNumbering =
  | "none"
  | "number"
  | "en-upper"
  | "en-lower"
  | "bn-number"
  | "bn-letter"
  | "ar-number"
  | "ar-letter"
  | "roman-upper"
  | "roman-lower";

export interface PlainNumberingDef {
  id: PlainNumbering;
  label: string;
  /** shown next to the picker label, and under the dropdown */
  example: string;
}

export const PLAIN_NUMBERING_STYLES: PlainNumberingDef[] = [
  { id: "none", label: "None", example: "keep the option keys" },
  { id: "number", label: "Number", example: "1, 2, 3, 4, 5…" },
  { id: "en-upper", label: "English Capital Letter", example: "A, B, C, D, E…" },
  { id: "en-lower", label: "English Small Letter", example: "a, b, c, d, e…" },
  { id: "bn-number", label: "Bangla Number", example: "১, ২, ৩, ৪, ৫…" },
  { id: "bn-letter", label: "Bangla Letter", example: "ক, খ, গ, ঘ, ঙ…" },
  { id: "ar-number", label: "Arabic Number", example: "١, ٢, ٣, ٤, ٥…" },
  { id: "ar-letter", label: "Arabic Letter", example: "أ, ب, ج, د, ه…" },
  { id: "roman-upper", label: "Roman Capital Number", example: "I, II, III, IV…" },
  { id: "roman-lower", label: "Roman Small Number", example: "i, ii, iii, iv…" },
];

export const DEFAULT_PLAIN_NUMBERING: PlainNumbering = "none";

const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** the traditional Bangla consonant sequence used to letter-list options */
const BN_LETTERS = "কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ";
/** Arabic abjad order — the classic letter-numbering sequence */
const AR_LETTERS = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ";
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** bijective sequence label: n = 1 → first letter, 26 → last, 27 → "AA"-style */
function seqLabel(seq: string, n: number): string {
  const base = seq.length;
  let out = "";
  let k = n;
  while (k > 0) {
    k -= 1;
    out = seq[k % base] + out;
    k = Math.floor(k / base);
  }
  return out;
}

const digitLabel = (n: number, digits: string) => String(n).replace(/\d/g, (d) => digits[Number(d)]);

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function romanLabel(n: number): string {
  let out = "";
  let rest = Math.max(1, n);
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/**
 * The effective display label for an option.
 *
 * When the option is in "manual" mode the user's custom key is always shown.
 * Otherwise the current Plain Numbering style generates the label; if the
 * style is "none" the stored key is returned unchanged.
 *
 * This single function is used by the settings panel, the canvas (Slide.tsx)
 * and the PPTX export so every surface always shows the same value.
 */
export function effectiveOptionLabel(
  labelMode: "auto" | "manual" | undefined,
  key: string,
  plainNumbering: string | undefined | null,
  index: number,
): string {
  if (labelMode === "manual") return key;
  return plainNumberLabel(plainNumbering, index) ?? key;
}

/**
 * The marker text for the option at `index` (0-based), or `null` when the
 * style is "none"/unknown — callers then keep the option's own key.
 */
export function plainNumberLabel(style: string | undefined | null, index: number): string | null {
  const n = Math.max(1, Math.floor(index) + 1);
  switch (style as PlainNumbering) {
    case "number":
      return String(n);
    case "en-upper":
      return seqLabel(EN_LETTERS, n);
    case "en-lower":
      return seqLabel(EN_LETTERS, n).toLowerCase();
    case "bn-number":
      return digitLabel(n, BN_DIGITS);
    case "bn-letter":
      return seqLabel(BN_LETTERS, n);
    case "ar-number":
      return digitLabel(n, AR_DIGITS);
    case "ar-letter":
      return seqLabel(AR_LETTERS, n);
    case "roman-upper":
      return romanLabel(n);
    case "roman-lower":
      return romanLabel(n).toLowerCase();
    case "none":
    default:
      return null;
  }
}

/** Latin option letters — the family `lib/parse` reads for a-e papers */
const EN_KEYS = ["a", "b", "c", "d", "e"];

/**
 * The label/key an option at `index` (0-based) should carry while it is in
 * "auto" mode: the plain-numbering label for that position. With numbering
 * set to "none" there is nothing to generate, so the option keeps the next
 * member of the letter family the slide already uses (ক খ গ / a b c / أ ب ج)
 * — the same sequence the parser and "+ Add option" produce, falling through
 * to 1, 2, 3… once a five-letter family runs out.
 */
export function autoOptionKey(
  plainNumbering: string | undefined | null,
  index: number,
  firstKey = "",
): string {
  const label = plainNumberLabel(plainNumbering, index);
  if (label) return label;
  const family = AR_KEYS.includes(firstKey) ? AR_KEYS : /^[a-e]$/i.test(firstKey) ? EN_KEYS : BN_KEYS;
  return family[index] ?? String(index + 1);
}

/** True when at least one option on the slide carries a manual label override. */
export const hasManualOptionLabels = (options: QuizOption[]): boolean =>
  options.some((o) => o.labelMode === "manual");

/**
 * Drop every manual label override on one slide.
 *
 * Each option returns to "auto" mode and takes the label its position
 * generates under `plainNumbering` — so "Reset Labels" restores the numbering
 * without touching the numbering style itself. Nothing else moves: the option
 * order, their text, the count and every typographic setting are untouched,
 * and only `answer` is re-pointed at the correct option's new key so the
 * highlight survives the rename.
 */
export function resetOptionLabels(
  options: QuizOption[],
  answer: OptionKey | null,
  plainNumbering: string | undefined | null,
): { options: QuizOption[]; answer: OptionKey | null } {
  const firstKey = options[0]?.key ?? "";
  const keys = options.map((_, i) => autoOptionKey(plainNumbering, i, firstKey));
  const correctIndex = answer == null ? -1 : options.findIndex((o) => o.key === answer);
  return {
    options: options.map((o, i) => ({ ...o, key: keys[i], labelMode: "auto" as const })),
    answer: correctIndex >= 0 ? keys[correctIndex] : answer,
  };
}
