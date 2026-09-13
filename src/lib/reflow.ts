/**
 * Layout reflow — rebuilds line breaks when a paste arrives as one glued run.
 *
 * Copying from a PDF, a chat reply or a rich-text box often strips every
 * newline, producing:
 *
 *   ১. $P(x) = 3x^4 …$ বহুপদীর মাত্রা কত?ক) 1খ) 2গ) 4ঘ) 7২. $P(x,y) …$ …
 *
 * We locate question numbers (১. ২. ৩. / 1. 2. 3.) and option markers
 * (ক) খ) গ) ঘ) / a) b) c) d)) and restore:
 *
 *   ১. $P(x) = 3x^4 …$ বহুপদীর মাত্রা কত?
 *   ক) 1
 *   খ) 2
 *   গ) 4
 *   ঘ) 7
 *
 *   ২. …
 *
 * Everything inside $…$ is skipped, so "P(a, b, c)" is never mistaken for an
 * option marker "c)". Markers are only accepted when they form an ascending
 * run (ক→খ→গ→ঘ, a→b→c, 1→2→3), which keeps stray "(ক)" inside a sentence safe.
 */

const MATH_SPLIT = /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g;

const DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const toLatin = (s: string) => s.replace(/[০-৯٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d);

const BN_KEYS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
const AR_KEYS = ["أ", "ب", "ج", "د", "ه", "و"];
const EN_KEYS = ["a", "b", "c", "d", "e", "f"];

type Kind = "bn" | "ar" | "en" | "num";

interface Cand {
  /** index of the marker (including an opening bracket) in the full string */
  start: number;
  key: string;
  kind: Kind;
  value: number;
}

/** ক) · (খ) · গ। · a) · 12. — delimiter is required, ":" excluded on purpose */
const CAND =
  /([([{]\s*)?(?:([কখগঘঙচ])|([أبجدهو])|([a-fA-F])|([0-9]{1,3})|([০-৯]{1,3})|([٠-٩۰-۹]{1,3}))\s*([).।،])/gu;

function scan(segment: string, offset: number, out: Cand[]) {
  CAND.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CAND.exec(segment))) {
    const [full, bracket, bn, ar, en, latinNum, bnNum, arNum] = m;
    const delim = m[8];
    const markerStart = m.index + (bracket ? 0 : 0);
    const prev = markerStart > 0 ? segment[markerStart - 1] : "";
    const after = segment[m.index + full.length] ?? "";

    if (bn) {
      // a Bengali letter directly before means we are inside a word (অংক)
      if (!bracket && /[\u0980-\u09ff]/.test(prev)) continue;
      out.push({ start: markerStart + offset, key: bn, kind: "bn", value: BN_KEYS.indexOf(bn) });
    } else if (ar) {
      // only a preceding Arabic *letter* means we are inside a word — Arabic
      // punctuation (؟ ، ؛) legitimately precedes an option marker
      if (!bracket && /[\u0620-\u064A\u066E-\u06D3\u0750-\u077F]/.test(prev)) continue;
      out.push({ start: markerStart + offset, key: ar, kind: "ar", value: AR_KEYS.indexOf(ar) });
    } else if (en) {
      if (/[A-Za-z]/.test(prev)) continue; // "etc)" must not become option "c)"
      const k = en.toLowerCase();
      out.push({ start: markerStart + offset, key: k, kind: "en", value: EN_KEYS.indexOf(k) });
    } else {
      const raw = latinNum ?? bnNum ?? arNum ?? "";
      const native = !!bnNum || !!arNum;
      // skip decimals: same-script digit (or a dot) immediately before / 3.5 after
      if (native ? /[০-৯٠-٩۰-۹]/.test(prev) : /[0-9.]/.test(prev)) continue;
      if (delim === "." && /[0-9০-৯٠-٩۰-۹]/.test(after)) continue;
      out.push({ start: markerStart + offset, key: raw, kind: "num", value: parseInt(toLatin(raw), 10) });
    }
  }
}

/** keeps only markers that belong to an ascending run of at least `min` items */
function keepRuns(cands: Cand[], kind: Kind, min: number): Cand[] {
  const list = cands.filter((c) => c.kind === kind);
  const kept: Cand[] = [];
  let run: Cand[] = [];
  const flush = () => {
    if (run.length >= min) kept.push(...run);
    run = [];
  };
  for (const c of list) {
    if (run.length === 0) {
      if (c.value === 0) run = [c]; // runs must start at ক / a
      continue;
    }
    if (c.value === run[run.length - 1].value + 1) run.push(c);
    else {
      flush();
      if (c.value === 0) run = [c];
    }
  }
  flush();
  return kept;
}

interface Split {
  index: number;
  blank: boolean; // true → blank line before (start of a new question)
}

export interface ReflowResult {
  text: string;
  questions: number;
  options: number;
}

export function reflowLayout(input: string): ReflowResult {
  if (!input.trim()) return { text: input, questions: 0, options: 0 };

  /* ---------- 1. collect candidates outside math spans ---------- */
  const cands: Cand[] = [];
  let pos = 0;
  input.split(MATH_SPLIT).forEach((part, i) => {
    if (part === undefined) return;
    if (i % 2 === 0) scan(part, pos, cands);
    pos += part.length;
  });
  cands.sort((a, b) => a.start - b.start);

  /* ---------- 2. option markers: ascending ক→খ→গ or a→b→c ---------- */
  const optionCands = [
    ...keepRuns(cands, "bn", 2),
    ...keepRuns(cands, "ar", 2),
    ...keepRuns(cands, "en", 2),
  ].sort((a, b) => a.start - b.start);

  // regions covered by option lists — a question number can't live inside one
  const spans: [number, number][] = [];
  let spanStart = -1;
  optionCands.forEach((c, i) => {
    if (spanStart < 0) spanStart = c.start;
    const next = optionCands[i + 1];
    if (!next || next.value <= c.value) {
      spans.push([spanStart, c.start]);
      spanStart = -1;
    }
  });
  const insideOptions = (x: number) => spans.some(([a, b]) => x > a && x < b);

  /* ---------- 3. question numbers: 1, 2, 3 … ---------- */
  const questionCands: Cand[] = [];
  let expected = -1;
  for (const c of cands) {
    if (c.kind !== "num" || insideOptions(c.start)) continue;
    if (expected < 0) {
      if (c.value >= 1 && c.value <= 2) {
        questionCands.push(c);
        expected = c.value + 1;
      }
      continue;
    }
    if (c.value === expected) {
      questionCands.push(c);
      expected++;
    }
  }

  /* ---------- 4. apply the splits ---------- */
  const splits: Split[] = [
    ...questionCands.map((c) => ({ index: c.start, blank: true })),
    ...optionCands.map((c) => ({ index: c.start, blank: false })),
  ].sort((a, b) => a.index - b.index || Number(b.blank) - Number(a.blank));

  let out = "";
  let cursor = 0;
  let questions = 0;
  let options = 0;

  for (const sp of splits) {
    if (sp.index < cursor) continue;
    out += input.slice(cursor, sp.index);
    cursor = sp.index;
    if (out.trim() === "") continue; // very first marker: nothing to break

    const trailing = out.match(/\s*$/)?.[0] ?? "";
    const have = (trailing.match(/\n/g) ?? []).length;
    const need = sp.blank ? 2 : 1;
    if (have < need) {
      out = out.replace(/[ \t]+$/, "");
      out += "\n".repeat(need - have);
      if (sp.blank) questions++;
      else options++;
    }
  }
  out += input.slice(cursor);

  const text = out
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, questions, options };
}
