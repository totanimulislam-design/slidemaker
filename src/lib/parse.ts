import type { QuizOption, SlideData } from "./types";

let idCounter = 0;
export const uid = () => `s${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Bengali, Arabic-Indic and Extended (Urdu/Persian) digits → ASCII */
const DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export const toLatinDigits = (s: string) => s.replace(/[০-৯٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d);

export const BN_KEYS = ["ক", "খ", "গ", "ঘ", "ঙ"];
/** Arabic abjad option letters used across Arabic-language exam papers */
export const AR_KEYS = ["أ", "ب", "ج", "د", "ه"];

/** marker like: ক) / (খ) / a. / A) / 1) / ১। */
const MARKER_CORE = "(ক|খ|গ|ঘ|ঙ|أ|ب|ج|د|ه|[a-eA-E]|[0-9০-৯٠-٩۰-۹]{1,3})";
const DELIM = "[\\)\\.।:\\-–\\]\\}،؍]";
const MARKER_AT_START = new RegExp(`^\\s*[\\(\\[\\{]?\\s*${MARKER_CORE}\\s*${DELIM}\\s*`);
const MARKER_INLINE = new RegExp(`(?:^|[\\s\\u00a0])[\\(\\[]?\\s*${MARKER_CORE}\\s*[\\)\\.।:\\]،]\\s+`, "g");
const ANSWER_LINE =
  /^\s*(?:উত্তর|সঠিক\s*উত্তর|উঃ|সমাধান|ans(?:wer)?|correct|الجواب|الإجابة|إجابة|جواب|उत्तर|सही\s*उत्तर)\s*[:：\-–.)]?\s*(.+)$/i;

const isBnKey = (k: string) => BN_KEYS.includes(k) || AR_KEYS.includes(k);
const isAlphaKey = (k: string) => /^[a-eA-E]$/.test(k);
const isNumKey = (k: string) => /^[0-9০-৯٠-٩۰-۹]{1,3}$/.test(k);

const cleanText = (t: string) =>
  t
    .replace(/\u00a0/g, " ")
    .replace(/^\s*\*\*(.*)\*\*\s*$/, "$1")
    .replace(/\s+$/g, "")
    .trim();

/** returns true when the option text was flagged as the correct one (trailing *, ✓, (সঠিক)) */
function extractCorrectFlag(text: string): { text: string; correct: boolean } {
  let t = text.trim();
  let correct = false;
  const flagged = /(\s*[*✓✔☑]\s*$)|(\s*\((?:সঠিক|correct|ans)\)\s*$)/i;
  if (flagged.test(t)) {
    correct = true;
    t = t.replace(flagged, "").trim();
  }
  if (/^[*✓✔☑]\s+/.test(t)) {
    correct = true;
    t = t.replace(/^[*✓✔☑]\s+/, "").trim();
  }
  return { text: cleanText(t), correct };
}

const TRAILING_ANS =
  /[\s,;।|]*(?:উত্তর|সঠিক\s*উত্তর|উঃ|ans(?:wer)?|correct)\s*[:：\-–.)]?\s*([^\s,;।|]{1,4})\s*$/iu;

/** pulls an inline "Answer: b" tail out of an option/question fragment */
function extractTrailingAnswer(text: string): { text: string; answer: string | null } {
  const m = text.match(TRAILING_ANS);
  if (!m || m.index === undefined) return { text, answer: null };
  return { text: text.slice(0, m.index).trim(), answer: m[1].replace(/[)।.:\]]$/, "") };
}

interface Marker {
  key: string;
  index: number;
  length: number;
}

function findInlineMarkers(line: string): Marker[] {
  const out: Marker[] = [];
  MARKER_INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_INLINE.exec(line))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    out.push({ key: m[1], index: m.index + lead, length: raw.length - lead });
    MARKER_INLINE.lastIndex = m.index + raw.length - 1;
  }
  return out;
}

/** Split a line that packs several options together: "ক) 5  খ) 6  গ) 7  ঘ) 8" */
function splitPackedOptions(line: string): { lead: string; options: QuizOption[] } | null {
  const markers = findInlineMarkers(line);
  if (markers.length < 2) return null;
  // keep only a sensible ascending run of keys of a single family
  const family = (k: string) =>
    BN_KEYS.includes(k) ? "bn" : AR_KEYS.includes(k) ? "ar" : isAlphaKey(k) ? "en" : "num";
  const fam = family(markers[0].key);
  const seq = markers.filter((mk) => family(mk.key) === fam);
  if (seq.length < 2) return null;
  const lead = line.slice(0, seq[0].index).trim();
  const options: QuizOption[] = [];
  seq.forEach((mk, i) => {
    const start = mk.index + mk.length;
    const end = i + 1 < seq.length ? seq[i + 1].index : line.length;
    options.push({ key: mk.key, text: line.slice(start, end).trim() });
  });
  if (options.some((o) => o.text.length === 0)) return null;
  return { lead, options };
}

interface Draft {
  number: string;
  question: string[];
  options: QuizOption[];
  answer: string | null;
}

const newDraft = (number: string): Draft => ({ number, question: [], options: [], answer: null });

/** push an option onto the draft, handling "*" markers and inline "Ans: x" tails */
function addOption(draft: Draft, key: string, rawText: string) {
  const tail = extractTrailingAnswer(rawText);
  const { text, correct } = extractCorrectFlag(tail.text);
  draft.options.push({ key, text });
  if (correct) draft.answer = key;
  else if (tail.answer) draft.answer = tail.answer;
}

function resolveAnswer(raw: string, options: QuizOption[]): string | null {
  const value = raw.trim();
  if (!value) return null;
  const head = value.match(MARKER_AT_START);
  const token = head ? head[1] : value.split(/\s+/)[0].replace(/[)।.:\]]$/, "");
  const direct = options.find((o) => o.key.toLowerCase() === token.toLowerCase());
  if (direct) return direct.key;
  // map across families by index (answer "d" but options ক-ঘ)
  const idxFromToken = (() => {
    if (BN_KEYS.includes(token)) return BN_KEYS.indexOf(token);
    if (AR_KEYS.includes(token)) return AR_KEYS.indexOf(token);
    if (isAlphaKey(token)) return token.toLowerCase().charCodeAt(0) - 97;
    if (isNumKey(token)) return parseInt(toLatinDigits(token), 10) - 1;
    return -1;
  })();
  if (idxFromToken >= 0 && idxFromToken < options.length) return options[idxFromToken].key;
  const byText = options.find((o) => o.text && o.text.toLowerCase() === value.toLowerCase());
  return byText ? byText.key : null;
}

/**
 * Splits off a trailing answer-key block such as
 *   "উত্তরমালা: ১.ঘ ২.গ ৩.খ"  or  "Answers: 1-d 2-c 3-b"  or  "Answer key\n1. d\n2. c"
 * so it can be applied after the questions are parsed.
 */
export function splitAnswerKeyBlock(input: string): { questions: string; answerKey: string } {
  const text = input.replace(/\r\n?/g, "\n");
  const header =
    /(?:^|\n)\s*(?:উত্তরমালা|উত্তর\s*পত্র|উত্তরসমূহ|সঠিক\s*উত্তরসমূহ|answers?\s*key|answer\s*sheet|answers|solutions?|key)\s*[:：\-–]*\s*(?=\n|[0-9০-৯]|\S)/gi;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = header.exec(text))) last = m;
  if (!last) return { questions: text, answerKey: "" };
  const after = text.slice(last.index + last[0].length);
  // must look like a key list (several "n. x" pairs), not a single "উত্তর: গ" line
  const pairCount = (after.match(/(?:^|[\s,;|।])[0-9০-৯]{1,3}\s*[.)।:\-–|]*\s*[কখগঘঙa-eA-E1-5أبجده](?=$|[\s,;|।.])/gu) ?? []).length;
  if (pairCount < 2) return { questions: text, answerKey: "" };
  return { questions: text.slice(0, last.index).trimEnd(), answerKey: after.trim() };
}

export function parseQuestions(input: string, startIndex = 1): SlideData[] {
  const text = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const lines = text.split("\n");
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let prevBlank = true;
  let expectedNumber = 1;

  const pushCurrent = () => {
    if (current && (current.question.length || current.options.length)) drafts.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      prevBlank = true;
      continue;
    }

    // ---- answer line -------------------------------------------------
    const ansMatch = line.match(ANSWER_LINE);
    if (ansMatch && current) {
      current.answer = ansMatch[1].trim();
      prevBlank = false;
      continue;
    }

    const startMarker = line.match(MARKER_AT_START);
    const key = startMarker?.[1];
    const rest = startMarker ? line.slice(startMarker[0].length) : line;

    // ---- explicit option line (ক/খ/গ/ঘ or a/b/c/d) ---------------------
    if (key && (isBnKey(key) || isAlphaKey(key)) && current) {
      const packed = splitPackedOptions(line);
      if (packed && packed.options.length >= 2 && !packed.lead) {
        packed.options.forEach((o) => addOption(current!, o.key, o.text));
      } else {
        addOption(current, key, rest);
      }
      prevBlank = false;
      continue;
    }

    // ---- numeric marker: new question or numeric option? --------------
    if (key && isNumKey(key)) {
      const num = parseInt(toLatinDigits(key), 10);
      const startsNew =
        !current ||
        prevBlank ||
        current.options.length >= 2 ||
        num === expectedNumber ||
        num === expectedNumber + 1;
      if (startsNew) {
        pushCurrent();
        current = newDraft(toLatinDigits(key));
        expectedNumber = num + 1;
        const packed = splitPackedOptions(rest);
        if (packed && packed.options.length >= 2) {
          if (packed.lead) current.question.push(cleanText(packed.lead));
          packed.options.forEach((o) => addOption(current!, o.key, o.text));
        } else if (rest.trim()) {
          current.question.push(cleanText(rest));
        }
        prevBlank = false;
        continue;
      }
      if (current && num <= 6) {
        addOption(current, toLatinDigits(key), rest);
        prevBlank = false;
        continue;
      }
    }

    // ---- plain line: new question after blank / continuation -----------
    const packedPlain = splitPackedOptions(line);
    if (current && packedPlain && packedPlain.options.length >= 3) {
      if (packedPlain.lead) current.question.push(cleanText(packedPlain.lead));
      packedPlain.options.forEach((o) => addOption(current!, o.key, o.text));
      prevBlank = false;
      continue;
    }

    if (!current || (prevBlank && current.options.length > 0)) {
      pushCurrent();
      current = newDraft("");
    }
    current.question.push(cleanText(line));
    prevBlank = false;
  }
  pushCurrent();

  return drafts.map((d, i) => {
    const options = d.options.map((o) => ({ ...o, text: cleanText(o.text) }));
    const answer = d.answer ? resolveAnswer(d.answer, options) : null;
    return {
      id: uid(),
      number: d.number || String(startIndex + i),
      question: d.question.join("\n").trim(),
      options,
      answer,
      badge: "",
      note: "",
      scale: 1,
      showAnswer: false,
    } satisfies SlideData;
  });
}

export function emptySlide(number: number): SlideData {
  return {
    id: uid(),
    number: String(number),
    question: "নতুন প্রশ্ন লিখুন...",
    options: BN_KEYS.slice(0, 4).map((k) => ({ key: k, text: "" })),
    answer: null,
    badge: "",
    note: "",
    scale: 1,
    showAnswer: false,
  };
}
