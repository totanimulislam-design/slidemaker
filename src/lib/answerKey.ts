import { AR_KEYS, BN_KEYS, toLatinDigits } from "./parse";
import type { SlideData } from "./types";

/**
 * Answer-key parser.
 *
 * Teachers keep answers separately from questions, in every imaginable shape:
 *
 *   1. ঘ  2. গ  3. b            ১) ঘ, ২) গ, ৩) খ
 *   1-ঘ 2-গ 3-খ                 1 ঘ 2 গ 3 খ
 *   Q1: d   Q2: c               ১ নং – ঘ
 *   ঘ গ খ ক ঘ                    (bare sequence → 1, 2, 3, …)
 *   1 | ঘ   (table pasted from Word / Excel)
 *   উত্তরমালা: ১.ঘ ২.গ ৩.খ
 *
 * We extract (number, key) pairs, normalise the key into the option family
 * each slide actually uses (ক/খ/গ/ঘ, a/b/c/d, أ/ب/ج/د, or 1/2/3/4) and apply.
 */

export interface AnswerPair {
  /** 1-based question number as written; null for bare sequences */
  number: number | null;
  /** raw key as typed: ঘ / d / D / 4 / ج */
  key: string;
  /** optional literal answer text (e.g. "Dhaka") when no marker was given */
  text?: string;
}

export interface AnswerMapping {
  slideId: string;
  slideIndex: number;
  number: string;
  pair: AnswerPair;
  /** the option key on that slide, or null when it couldn't be matched */
  resolved: string | null;
  /** previous answer on the slide, if any */
  previous: string | null;
  status: "ok" | "same" | "changed" | "no-match" | "no-slide";
}

const KEY_CHARS = "কখগঘঙأبجدهa-eA-E1-5১-৫١-٥";
const NUM = "[0-9০-৯٠-٩۰-۹]{1,3}";

/** family-independent index (0-based) for any option key */
export function keyIndex(raw: string): number {
  const k = raw.trim();
  if (BN_KEYS.includes(k)) return BN_KEYS.indexOf(k);
  if (AR_KEYS.includes(k)) return AR_KEYS.indexOf(k);
  if (/^[a-eA-E]$/.test(k)) return k.toLowerCase().charCodeAt(0) - 97;
  const n = parseInt(toLatinDigits(k), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n - 1;
  return -1;
}

/** strips "উত্তরমালা:", "Answer key", "Answers" headers etc. */
function stripHeader(text: string): string {
  return text
    .replace(/^\s*(?:উত্তরমালা|উত্তর|সঠিক উত্তর|answers?\s*key|answers?|ans|solutions?|key)\s*[:：\-–]*\s*/i, "")
    .replace(/\r\n?/g, "\n");
}

export function parseAnswerKey(input: string): AnswerPair[] {
  const text = stripHeader(input).replace(/\u00a0/g, " ").trim();
  if (!text) return [];
  const pairs: AnswerPair[] = [];

  // ---- 1. numbered pairs:  1. ঘ | ১) ঘ | 1-ঘ | Q1: d | 1 | ঘ | ১ নং ঘ ------
  const numbered = new RegExp(
    `(?:^|[\\s,;|।])(?:q|Q|প্রশ্ন)?\\s*(${NUM})\\s*(?:নং|no\\.?)?\\s*[.)।:\\-–|=>]*\\s*[(\\[]?\\s*([${KEY_CHARS}])\\s*[)\\]]?(?=$|[\\s,;|।.])`,
    "gu",
  );
  let m: RegExpExecArray | null;
  while ((m = numbered.exec(text))) {
    const num = parseInt(toLatinDigits(m[1]), 10);
    if (Number.isFinite(num)) pairs.push({ number: num, key: m[2] });
  }

  // ---- 2. numbered lines with literal text answers:  1. Dhaka  2. পদ্মা --------
  const literal = new RegExp(`(?:^|\\n)\\s*(?:q|Q)?\\s*(${NUM})\\s*[.)।:\\-–]\\s*([^\\n]{1,60})`, "gu");
  const lits: AnswerPair[] = [];
  while ((m = literal.exec(text))) {
    const t = m[2].trim();
    const num = parseInt(toLatinDigits(m[1]), 10);
    const kOnly = t.match(new RegExp(`^[(\\[]?\\s*([${KEY_CHARS}])\\s*[)\\]]?\\s*$`, "u"));
    if (kOnly) lits.push({ number: num, key: kOnly[1] });
    else if (t) lits.push({ number: num, key: "", text: t });
  }

  // merge: literal lines fill in numbers the key-pass could not read
  if (pairs.length || lits.length) {
    const merged = new Map<number, AnswerPair>();
    lits.forEach((p) => merged.set(p.number!, p));
    pairs.forEach((p) => merged.set(p.number!, p)); // explicit keys win over prose
    // corrections: a later duplicate in the *raw* pair list overrides
    const out = dedupe([...merged.values(), ...pairs]);
    if (out.length) return out;
  }

  // ---- 3. bare sequence: ঘ গ খ ক / d c b a / ঘ,গ,খ / dcba --------------------
  const bare = text.replace(/[\s,;|।.]+/g, "");
  if (bare && new RegExp(`^[${KEY_CHARS}]+$`, "u").test(bare) && !/^[0-9০-৯٠-٥]+$/.test(bare) ) {
    return Array.from(bare).map((k) => ({ number: null, key: k }));
  }
  // tolerant: tokens separated by whitespace where each token is a single key
  const toks = text.split(/[\s,;|।]+/).filter(Boolean);
  if (toks.length && toks.every((t) => new RegExp(`^[${KEY_CHARS}]$`, "u").test(t))) {
    return toks.map((k) => ({ number: null, key: k }));
  }
  return [];
}

function dedupe(pairs: AnswerPair[]): AnswerPair[] {
  const seen = new Map<number, AnswerPair>();
  pairs.forEach((p) => {
    if (p.number !== null) seen.set(p.number, p); // later entries win (corrections)
  });
  return [...seen.values()].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/** Finds the matching option key on a slide for a raw answer. */
export function resolveOnSlide(slide: SlideData, pair: AnswerPair): string | null {
  const opts = slide.options;
  if (!opts.length) return null;
  if (pair.key) {
    const direct = opts.find((o) => o.key === pair.key || o.key.toLowerCase() === pair.key.toLowerCase());
    if (direct) return direct.key;
    const idx = keyIndex(pair.key);
    if (idx >= 0 && idx < opts.length) return opts[idx].key;
    return null;
  }
  if (pair.text) {
    const norm = (s: string) => s.replace(/\$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const t = norm(pair.text);
    const exact = opts.find((o) => norm(o.text) === t);
    if (exact) return exact.key;
    const partial = opts.find((o) => norm(o.text).includes(t) || t.includes(norm(o.text)));
    return partial ? partial.key : null;
  }
  return null;
}

/** How many slides carry an answer, and where the first gap is. */
export interface AnswerSummary {
  total: number;
  set: number;
  missing: number;
  revealed: number;
  /** index (0-based) of the first slide without an answer, or null */
  firstMissing: number | null;
}

export function answerSummary(slides: SlideData[]): AnswerSummary {
  const set = slides.filter((s) => !!s.answer).length;
  const firstMissing = slides.findIndex((s) => !s.answer);
  return {
    total: slides.length,
    set,
    missing: slides.length - set,
    revealed: slides.filter((s) => s.showAnswer).length,
    firstMissing: firstMissing < 0 ? null : firstMissing,
  };
}

/**
 * The deck's answers as plain text — the same shape the parser accepts, so an
 * exported key can be pasted straight back into "Paste answers".
 *
 *   ১. ঘ
 *   ২. গ
 *   ৩. —
 */
export function formatAnswerKey(
  slides: SlideData[],
  opts: { includeMissing?: boolean; missingMark?: string } = {},
): string {
  const { includeMissing = false, missingMark = "—" } = opts;
  return slides
    .map((s, i) => ({ slide: s, number: (s.number || String(i + 1)).trim() }))
    .filter(({ slide }) => includeMissing || !!slide.answer)
    .map(({ slide, number }) => `${number}. ${slide.answer ?? missingMark}`)
    .join("\n");
}

/**
 * Builds the mapping preview. Numbered pairs match slides by their `number`
 * (falling back to position); bare sequences map by position starting at
 * `startIndex` (0-based slide index).
 */
export function mapAnswers(slides: SlideData[], pairs: AnswerPair[], startIndex = 0): AnswerMapping[] {
  const byNumber = new Map<number, number>();
  slides.forEach((s, i) => {
    const n = parseInt(toLatinDigits(s.number), 10);
    if (Number.isFinite(n) && !byNumber.has(n)) byNumber.set(n, i);
  });

  return pairs.map((pair, i) => {
    let idx: number;
    if (pair.number !== null) {
      idx = byNumber.has(pair.number) ? byNumber.get(pair.number)! : pair.number - 1;
    } else {
      idx = startIndex + i;
    }
    const slide = slides[idx];
    if (!slide) {
      return {
        slideId: "",
        slideIndex: idx,
        number: pair.number !== null ? String(pair.number) : String(idx + 1),
        pair,
        resolved: null,
        previous: null,
        status: "no-slide",
      };
    }
    const resolved = resolveOnSlide(slide, pair);
    const previous = slide.answer;
    const status: AnswerMapping["status"] =
      !resolved ? "no-match" : previous === resolved ? "same" : previous ? "changed" : "ok";
    return { slideId: slide.id, slideIndex: idx, number: slide.number, pair, resolved, previous, status };
  });
}
