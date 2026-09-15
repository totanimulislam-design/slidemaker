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
 */

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
