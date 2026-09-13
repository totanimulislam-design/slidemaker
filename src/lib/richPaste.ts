/**
 * Smart paste: keeps the *source* formatting of pasted questions intact.
 *
 * Plain-text clipboards flatten "7x⁵" into "7x5", so we prefer the clipboard's
 * text/html flavour (Word, Google Docs, websites, PDF viewers all provide it)
 * and rebuild the real structure: <sup>/<sub>, MathML, KaTeX/MathJax TeX
 * annotations, Word's vertical-align spans, tables and lists.
 * Anything still encoded as Unicode (x², ½, √, ≤, π …) is converted to LaTeX
 * and wrapped in $…$ so it renders exactly like the original.
 */

/* ------------------------------------------------------------------ maps */

const SUP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n", "ⁱ": "i",
  "ᵃ": "a", "ᵇ": "b", "ᶜ": "c", "ᵈ": "d", "ᵉ": "e", "ᶠ": "f", "ᵍ": "g", "ʰ": "h", "ʲ": "j",
  "ᵏ": "k", "ˡ": "l", "ᵐ": "m", "ᵒ": "o", "ᵖ": "p", "ʳ": "r", "ˢ": "s", "ᵗ": "t", "ᵘ": "u",
  "ᵛ": "v", "ʷ": "w", "ˣ": "x", "ʸ": "y", "ᶻ": "z",
};

const SUB: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
  "ₐ": "a", "ₑ": "e", "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m", "ₙ": "n",
  "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s", "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x",
};

const VULGAR: Record<string, [string, string]> = {
  "½": ["1", "2"], "⅓": ["1", "3"], "⅔": ["2", "3"], "¼": ["1", "4"], "¾": ["3", "4"],
  "⅕": ["1", "5"], "⅖": ["2", "5"], "⅗": ["3", "5"], "⅘": ["4", "5"], "⅙": ["1", "6"],
  "⅚": ["5", "6"], "⅐": ["1", "7"], "⅛": ["1", "8"], "⅜": ["3", "8"], "⅝": ["5", "8"],
  "⅞": ["7", "8"], "⅑": ["1", "9"], "⅒": ["1", "10"],
};

const SYMBOL: Record<string, string> = {
  "×": "\\times", "⋅": "\\cdot", "∙": "\\cdot", "·": "\\cdot", "⨯": "\\times", "÷": "\\div", "∕": "/", "−": "-", "±": "\\pm",
  "∓": "\\mp", "≤": "\\leq", "≥": "\\geq", "≦": "\\leqq", "≧": "\\geqq", "≠": "\\neq",
  "≈": "\\approx", "≅": "\\cong", "≡": "\\equiv", "∝": "\\propto", "∞": "\\infty",
  "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∮": "\\oint", "∂": "\\partial", "∇": "\\nabla",
  "∆": "\\Delta", "√": "\\sqrt{}", "∛": "\\sqrt[3]{}", "∜": "\\sqrt[4]{}",
  "∈": "\\in", "∉": "\\notin", "∋": "\\ni", "⊂": "\\subset", "⊃": "\\supset",
  "⊆": "\\subseteq", "⊇": "\\supseteq", "∪": "\\cup", "∩": "\\cap", "∅": "\\emptyset",
  "∀": "\\forall", "∃": "\\exists", "¬": "\\neg", "∧": "\\land", "∨": "\\lor",
  "→": "\\rightarrow", "←": "\\leftarrow", "↔": "\\leftrightarrow", "⇒": "\\Rightarrow",
  "⇐": "\\Leftarrow", "⇔": "\\Leftrightarrow", "↦": "\\mapsto",
  "∠": "\\angle", "∟": "\\angle", "⊥": "\\perp", "∥": "\\parallel", "∴": "\\therefore",
  "∵": "\\because", "△": "\\triangle", "□": "\\square", "○": "\\circ",
  "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\varepsilon",
  "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta", "ι": "\\iota", "κ": "\\kappa", "λ": "\\lambda",
  "μ": "\\mu", "µ": "\\mu", "ν": "\\nu", "ξ": "\\xi", "π": "\\pi", "ρ": "\\rho",
  "σ": "\\sigma", "τ": "\\tau", "υ": "\\upsilon", "φ": "\\phi", "ϕ": "\\phi", "χ": "\\chi",
  "ψ": "\\psi", "ω": "\\omega", "Γ": "\\Gamma", "Δ": "\\Delta", "Θ": "\\Theta",
  "Λ": "\\Lambda", "Ξ": "\\Xi", "Π": "\\Pi", "Σ": "\\Sigma", "Φ": "\\Phi", "Ψ": "\\Psi",
  "Ω": "\\Omega", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}", "′": "'", "″": "''", "‰": "\\permil",
};

const FUNCS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "log", "ln", "lg",
  "lim", "max", "min", "exp", "det", "gcd", "lcm", "mod", "arg", "deg",
]);

import { reflowLayout } from "./reflow";

export interface ConvertResult {
  text: string;
  notes: string[];
}

export interface NormalizeOptions {
  /** rebuild missing line breaks when questions/options arrive glued together */
  reflow?: boolean;
}

interface Counters {
  sup: number;
  sub: number;
  symbol: number;
  frac: number;
  wrapped: number;
}

/* --------------------------------------------------------- text cleaning */

/** Removes clipboard junk without touching Bengali joiners (ZWJ/ZWNJ). */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200b\ufeff\u00ad\u2060]/g, "") // zero-width space / BOM / soft hyphen
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "  ")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/\u2026/g, "...")
    .split("\n")
    .map((l) => l.replace(/^[\s]*[•◦▪●‣·o]\s+/u, "").replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Applies `fn` only outside existing $…$ / $$…$$ spans so real LaTeX is never touched. */
function outsideMath(text: string, fn: (chunk: string) => string): string {
  return text
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/* ------------------------------------------------- unicode math → LaTeX */

function unicodeToLatex(chunk: string, c: Counters): string {
  let s = chunk;

  // x² / x⁵⁺¹  →  x^{2} / x^{5+1}
  s = s.replace(/[\u00b2\u00b3\u00b9\u2070-\u207f\u1d2c-\u1d6a\u02b0-\u02b8\u02e1-\u02e3]+/gu, (m) => {
    const mapped = Array.from(m).map((ch) => SUP[ch] ?? "").join("");
    if (!mapped) return m;
    c.sup++;
    return `^{${mapped}}`;
  });

  // H₂O → H_{2}O
  s = s.replace(/[\u2080-\u208e\u2090-\u209c]+/gu, (m) => {
    const mapped = Array.from(m).map((ch) => SUB[ch] ?? "").join("");
    if (!mapped) return m;
    c.sub++;
    return `_{${mapped}}`;
  });

  // 30° → 30^{\circ}
  s = s.replace(/\u00b0/g, () => {
    c.sup++;
    return "^{\\circ}";
  });

  // ½ → \frac{1}{2}
  s = s.replace(/[\u00bc-\u00be\u2150-\u215e]/g, (m) => {
    const f = VULGAR[m];
    if (!f) return m;
    c.frac++;
    return `\\frac{${f[0]}}{${f[1]}}`;
  });

  // √(x+1) / √25 / √x
  s = s.replace(/√\s*\(([^()]{1,60})\)/g, (_m, inner) => {
    c.symbol++;
    return `\\sqrt{${inner}}`;
  });
  s = s.replace(/√\s*([A-Za-z0-9]+(?:\^\{[^}]*\})?)/g, (_m, inner) => {
    c.symbol++;
    return `\\sqrt{${inner}}`;
  });

  // remaining single-glyph symbols
  s = s.replace(/[^\u0000-\u007f\u0980-\u09ff]/gu, (ch) => {
    const rep = SYMBOL[ch];
    if (!rep) return ch;
    c.symbol++;
    return `${rep} `;
  });

  return s.replace(/[ \t]{2,}/g, (m) => (m.length > 3 ? m : " "));
}

/* --------------------------------------------- wrap math runs in $ … $ */

const MATH_CHAR = /[A-Za-z0-9^_{}\\+\-*/=<>()[\].,'|! ]/;
const HAS_MARKER = /\^\{|_\{|\\[a-zA-Z]+|\\sqrt/;

/** question / option markers that must never be pulled inside $…$ */
const LINE_MARKER = /^\s*[([{]?\s*(?:ক|খ|গ|ঘ|ঙ|[a-eA-E]|[0-9০-৯]{1,3})\s*[).।:\-–\]}]\s*/u;

function isMathyWord(w: string, side: "left" | "right"): boolean {
  if (!w) return false;
  if (HAS_MARKER.test(w)) return true;
  // never absorb list markers / stray closers such as ")" "1." "iii."
  if (/^[)\].,;:।]+$/.test(w)) return false;
  const opens = (w.match(/[([{]/g) ?? []).length;
  const closes = (w.match(/[)\]}]/g) ?? []).length;
  if (side === "left" && closes > opens) return false;
  if (side === "right" && opens > closes) return false;
  const letters = w.match(/[A-Za-z]+/g) ?? [];
  return letters.every((r) => r.length === 1 || FUNCS.has(r.toLowerCase()));
}

/** Wraps the smallest sensible expression around every LaTeX marker with $…$ */
function wrapMathRuns(chunk: string, c: Counters): string {
  let out = "";
  let i = 0;
  while (i < chunk.length) {
    if (!MATH_CHAR.test(chunk[i])) {
      out += chunk[i];
      i++;
      continue;
    }
    let j = i;
    while (j < chunk.length && MATH_CHAR.test(chunk[j])) j++;
    const run = chunk.slice(i, j);
    out += HAS_MARKER.test(run) ? wrapRun(run, c) : run;
    i = j;
  }
  return out;
}

/**
 * Splits the run into clusters of adjacent maths-like words and wraps every
 * cluster that actually contains LaTeX. Ordinary words ("and", "then", "value")
 * break a cluster, so prose never ends up inside $…$.
 */
function wrapRun(run: string, c: Counters): string {
  const tokens = run.split(/(\s+)/); // words at even indices, gaps at odd
  const clusters: [number, number][] = [];
  let start = -1;

  for (let i = 0; i < tokens.length; i += 2) {
    const w = tokens[i];
    const mathy = !!w && (isMathyWord(w, "left") || isMathyWord(w, "right"));
    if (!mathy) {
      start = -1;
      continue;
    }
    if (start < 0) {
      start = i;
      clusters.push([i, i]);
    } else {
      clusters[clusters.length - 1][1] = i;
    }
  }

  let out = "";
  let cursor = 0;
  for (const [from, to] of clusters) {
    let a = from;
    let b = to;
    // drop edge words that only carry punctuation from a neighbouring sentence
    while (a <= b && !isMathyWord(tokens[a], "left")) a += 2;
    while (b >= a && !isMathyWord(tokens[b], "right")) b -= 2;
    if (a > b) continue;

    let inner = tokens.slice(a, b + 1).join("");
    if (!HAS_MARKER.test(inner)) continue;

    const lead = inner.match(/^[\s,.;:)\]]+/)?.[0] ?? "";
    inner = inner.slice(lead.length);
    const tail = inner.match(/[\s,.;:([]+$/)?.[0] ?? "";
    inner = inner.slice(0, inner.length - tail.length);
    if (!inner || !HAS_MARKER.test(inner)) continue;

    out += tokens.slice(cursor, a).join("") + lead + `$${inner}$` + tail;
    cursor = b + 1;
    c.wrapped++;
  }
  out += tokens.slice(cursor).join("");
  return out || run;
}

/* ------------------------------------------------------- HTML → source */

const SKIP_TAGS = new Set(["style", "script", "head", "meta", "link", "title", "noscript"]);
const BLOCK_TAGS = new Set([
  "p", "div", "li", "tr", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "section", "article", "header", "footer", "blockquote", "pre", "table", "ul", "ol",
]);

function cleanTex(tex: string): string {
  return tex
    .replace(/^\s*\{\s*\\displaystyle\s*/, "")
    .replace(/\}\s*$/, (m, ...rest) => (String(rest[1]).includes("\\displaystyle") ? "" : m))
    .replace(/\\displaystyle\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function texFromNode(el: Element): string | null {
  const ann = el.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="TeX"]');
  const raw = ann?.textContent;
  if (raw && raw.trim()) return cleanTex(raw);
  const attr =
    el.getAttribute("data-tex") ||
    el.getAttribute("data-latex") ||
    el.getAttribute("data-original-input");
  if (attr && attr.trim()) return cleanTex(attr);
  return null;
}

function braced(s: string): string {
  const t = s.trim();
  return t.length === 1 || /^\\?[A-Za-z0-9]+$/.test(t) ? t : `{${t}}`;
}

function mathmlToLatex(node: Element): string {
  const tag = node.tagName.toLowerCase().replace(/^[a-z]+:/, "");
  const children = Array.from(node.children).filter(
    (c) => !/^(annotation|annotation-xml)$/i.test(c.tagName.replace(/^[a-z]+:/, "")),
  );
  const kid = (i: number) => (children[i] ? mathmlToLatex(children[i]) : "");
  const all = () => children.map(mathmlToLatex).join(" ").replace(/\s+/g, " ").trim();
  const txt = (node.textContent ?? "").trim();

  switch (tag) {
    case "math":
    case "mrow":
    case "mstyle":
    case "semantics":
    case "mpadded":
    case "menclose":
    case "mphantom":
      return all();
    case "mi":
      if (!txt) return "";
      return FUNCS.has(txt.toLowerCase()) ? `\\${txt.toLowerCase()}` : txt.length > 1 ? `\\mathrm{${txt}}` : txt;
    case "mn":
      return txt;
    case "mo":
    case "mtext":
      return Array.from(txt).map((ch) => SYMBOL[ch] ?? ch).join("") || "";
    case "msup":
      return `${braced(kid(0))}^${braced(kid(1))}`;
    case "msub":
      return `${braced(kid(0))}_${braced(kid(1))}`;
    case "msubsup":
      return `${braced(kid(0))}_${braced(kid(1))}^${braced(kid(2))}`;
    case "mfrac":
      return `\\frac{${kid(0)}}{${kid(1)}}`;
    case "msqrt":
      return `\\sqrt{${all()}}`;
    case "mroot":
      return `\\sqrt[${kid(1)}]{${kid(0)}}`;
    case "mover":
      return `\\overset{${kid(1)}}{${kid(0)}}`;
    case "munder":
      return `${braced(kid(0))}_${braced(kid(1))}`;
    case "munderover":
      return `${braced(kid(0))}_${braced(kid(1))}^${braced(kid(2))}`;
    case "mfenced":
      return `(${all()})`;
    case "mspace":
      return " ";
    case "mtable":
      return children.map(mathmlToLatex).join(" \\\\ ");
    case "mtr":
      return children.map(mathmlToLatex).join(" & ");
    case "mtd":
      return all();
    default:
      return children.length ? all() : txt;
  }
}

function isSuperStyle(el: Element): "sup" | "sub" | null {
  const style = (el.getAttribute("style") ?? "").toLowerCase();
  if (/vertical-align\s*:\s*super/.test(style)) return "sup";
  if (/vertical-align\s*:\s*sub/.test(style)) return "sub";
  const va = (el as HTMLElement).style?.verticalAlign?.toLowerCase?.() ?? "";
  if (va === "super") return "sup";
  if (va === "sub") return "sub";
  return null;
}

/** Converts a clipboard HTML fragment into editable source text. */
export function htmlToSource(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const olCounters = new Map<Element, number>();
  const stack: string[] = [""];
  const emit = (s: string) => {
    stack[stack.length - 1] += s;
  };
  const out = () => stack[0];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      emit((node.nodeValue ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " "));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase().replace(/^[a-z]+:/, "");
    if (SKIP_TAGS.has(tag)) return;

    // rendered math (KaTeX / MathJax / MathML / Word) --------------------
    if (tag === "math" || el.classList?.contains("katex") || el.classList?.contains("MathJax")) {
      const tex = texFromNode(el) ?? (tag === "math" ? mathmlToLatex(el) : null);
      const body = (tex ?? el.textContent ?? "").trim();
      if (body) emit(`$${body}$`);
      return; // never descend: avoids duplicated MathML + HTML text
    }
    if (el.classList?.contains("katex-mathml") || el.classList?.contains("MJX_Assistive_MathML")) return;
    if (tag === "annotation" || tag === "annotation-xml") return;

    if (tag === "br") {
      emit("\n");
      return;
    }
    if (tag === "img") {
      const alt = el.getAttribute("alt") ?? "";
      if (/[\\^_{}]/.test(alt)) emit(`$${cleanTex(alt)}$`);
      else if (alt.trim()) emit(alt);
      return;
    }

    const vAlign = isSuperStyle(el);
    if (tag === "sup" || tag === "sub" || vAlign) {
      const inner = (el.textContent ?? "").trim();
      if (!inner) return;
      // footnote / reference markers are not exponents
      const mark = tag === "sub" || vAlign === "sub" ? "_" : "^";
      emit(`${mark}{${inner}}`);
      return;
    }

    if (tag === "li") {
      const parent = el.parentElement;
      if (parent && parent.tagName.toLowerCase() === "ol") {
        const n = (olCounters.get(parent) ?? Number(parent.getAttribute("start") ?? 1) - 1) + 1;
        olCounters.set(parent, n);
        emit(`${n}. `);
      }
    }

    // a table cell must stay on one line so "ক) 5  খ) 6" survives as options
    const isCell = tag === "td" || tag === "th";
    if (isCell) stack.push("");

    Array.from(el.childNodes).forEach(walk);

    if (isCell) {
      const cell = (stack.pop() ?? "").replace(/\s*\n+\s*/g, " ").trim();
      if (cell) emit(`${cell}  `);
    } else if (BLOCK_TAGS.has(tag)) {
      emit("\n");
    }
  };

  Array.from(doc.body.childNodes).forEach(walk);

  // Word wraps everything in tables/paragraphs — collapse the debris
  return out()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ----------------------------------------------------------- public API */

/** Normalises already-plain text (Unicode math → LaTeX, quotes, bullets…). */
export function normalizeSource(text: string, opts: NormalizeOptions = {}): ConvertResult {
  const c: Counters = { sup: 0, sub: 0, symbol: 0, frac: 0, wrapped: 0 };
  const cleaned = tidy(text);

  const line = (l: string) => {
    // keep "১." / "ক)" / "a)" markers verbatim so the question parser still sees them
    const head = l.match(LINE_MARKER)?.[0] ?? "";
    const body = l.slice(head.length);
    return head + wrapMathRuns(unicodeToLatex(body, c), c);
  };

  let converted = outsideMath(cleaned, (chunk) => chunk.split("\n").map(line).join("\n"))
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, "  "))
    .join("\n");

  const notes = describe(c);

  // reflow last: by now every equation is inside $…$, so "P(a, b, c)" can never
  // be mistaken for the option marker "c)"
  if (opts.reflow !== false) {
    const r = reflowLayout(converted);
    converted = r.text;
    if (r.questions) notes.unshift(`split ${r.questions + 1} questions onto their own lines`);
    if (r.options) notes.unshift(`broke ${r.options} options onto separate lines`);
  }

  return { text: converted, notes };
}

/** Full clipboard conversion — prefers the HTML flavour when it carries formatting. */
export function convertClipboard(html: string, plain: string, opts: NormalizeOptions = {}): ConvertResult {
  const useHtml = !!html && /<(sup|sub|math|table|li|br|p|div|span)\b/i.test(html);
  let base = plain;
  const notes: string[] = [];

  if (useHtml) {
    try {
      const fromHtml = htmlToSource(html);
      if (fromHtml.replace(/\s/g, "").length >= plain.replace(/\s/g, "").length * 0.6) {
        base = fromHtml;
        if (/<(sup|sub)\b/i.test(html) || /vertical-align\s*:\s*(super|sub)/i.test(html))
          notes.push("kept super/subscripts");
        if (/<math|katex|MathJax/i.test(html)) notes.push("recovered equations");
        if (/<table/i.test(html)) notes.push("flattened table layout");
      }
    } catch {
      base = plain;
    }
  }

  const res = normalizeSource(base, opts);
  return { text: res.text, notes: [...notes, ...res.notes] };
}

function describe(c: Counters): string[] {
  const n: string[] = [];
  if (c.sup) n.push(`${c.sup} superscript${c.sup > 1 ? "s" : ""}`);
  if (c.sub) n.push(`${c.sub} subscript${c.sub > 1 ? "s" : ""}`);
  if (c.frac) n.push(`${c.frac} fraction${c.frac > 1 ? "s" : ""}`);
  if (c.symbol) n.push(`${c.symbol} symbol${c.symbol > 1 ? "s" : ""}`);
  if (c.wrapped) n.push(`${c.wrapped} expression${c.wrapped > 1 ? "s" : ""} → LaTeX`);
  return n;
}

/* -------------------------------------------------- React paste helpers */

type AnyInput = HTMLTextAreaElement | HTMLInputElement;

/**
 * Handles a paste event on an input/textarea: converts the clipboard, inserts it
 * at the caret and reports the result. Returns null when nothing was handled.
 */
export function handleSmartPaste(
  e: React.ClipboardEvent<AnyInput>,
  opts: { singleLine?: boolean; reflow?: boolean } = {},
): { value: string; caret: number; notes: string[] } | null {
  const cd = e.clipboardData;
  if (!cd) return null;
  const plain = cd.getData("text/plain") ?? "";
  const html = cd.getData("text/html") ?? "";
  if (!plain && !html) return null;

  let { text, notes } = convertClipboard(html, plain, { reflow: opts.reflow !== false && !opts.singleLine });
  if (opts.singleLine) text = text.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return null;

  const el = e.currentTarget;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const value = el.value.slice(0, start) + text + el.value.slice(end);
  e.preventDefault();
  return { value, caret: start + text.length, notes };
}
