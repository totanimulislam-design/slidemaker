/**
 * LaTeX → PowerPoint text runs.
 *
 * A PPTX export is only useful if the text stays *editable*, so instead of
 * pasting a picture of the equation we translate the LaTeX back into real
 * characters plus PowerPoint's native superscript / subscript run flags:
 *
 *   "$7x^{5} + y_{1}$"  →  [ {7x}, {5 sup}, { + y}, {1 sub} ]
 *
 * Commands with no textual equivalent (\frac, \sqrt) become the conventional
 * inline forms  a/b  and  √(x)  which a teacher can edit in PowerPoint.
 */

export interface TextRun {
  text: string;
  sup?: boolean;
  sub?: boolean;
  italic?: boolean;
}

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν",
  xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ",
  chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ",
  Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOLS: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡",
  cong: "≅", sim: "∼", propto: "∝", ll: "≪", gg: "≫",
  infty: "∞", partial: "∂", nabla: "∇", sum: "∑", prod: "∏", int: "∫", oint: "∮",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇",
  cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃",
  neg: "¬", land: "∧", lor: "∨", therefore: "∴", because: "∵",
  rightarrow: "→", to: "→", leftarrow: "←", gets: "←", leftrightarrow: "↔",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", mapsto: "↦",
  angle: "∠", perp: "⊥", parallel: "∥", triangle: "△", square: "□", circ: "∘",
  degree: "°", prime: "′", ldots: "…", dots: "…", cdots: "⋯", quad: "  ", qquad: "    ",
  left: "", right: "", displaystyle: "", limits: "", "!": "", ",": " ", ";": " ", ":": " ",
  " ": " ", lbrace: "{", rbrace: "}", "{": "{", "}": "}", "%": "%", "&": "&", "#": "#",
  "$": "$", _: "_", "^": "^", backslash: "\\", vert: "|", "|": "‖",
};

const FUNCS = [
  "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "arcsin", "arccos",
  "arctan", "log", "ln", "lg", "lim", "max", "min", "exp", "det", "gcd", "deg", "arg", "bmod",
];

const VULGAR: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
  "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘", "1/6": "⅙", "5/6": "⅚",
  "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

/* --------------------------------------------------------------- helpers */

/** reads a {...} group (or a single token) starting at `i`; returns [body, next] */
function readGroup(src: string, i: number): [string, number] {
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === "{") {
    let depth = 1;
    let j = i + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "\\") j++;
      else if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    return [src.slice(i + 1, j - 1), j];
  }
  if (src[i] === "\\") {
    const m = src.slice(i).match(/^\\[a-zA-Z]+|^\\./);
    if (m) return [m[0], i + m[0].length];
  }
  return [src[i] ?? "", i + 1];
}

const isSimple = (s: string) => /^[A-Za-z0-9α-ωΑ-Ω]{1,4}$/.test(s.trim());

function pushRun(runs: TextRun[], text: string, flag?: "sup" | "sub") {
  if (!text) return;
  const last = runs[runs.length - 1];
  const sup = flag === "sup" || undefined;
  const sub = flag === "sub" || undefined;
  if (last && !!last.sup === !!sup && !!last.sub === !!sub) last.text += text;
  else runs.push({ text, sup, sub });
}

/* ------------------------------------------------------------ conversion */

/** Flattens a LaTeX fragment to plain characters (used inside frac/sqrt). */
function flatten(tex: string): string {
  return latexToRuns(tex)
    .map((r) => {
      if (r.sup) return toUnicodeScript(r.text, "sup");
      if (r.sub) return toUnicodeScript(r.text, "sub");
      return r.text;
    })
    .join("");
}

const SUP_U: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸",
  "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ",
  "∘": "°", "°": "°",
};
const SUB_U: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈",
  "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ",
  j: "ⱼ", n: "ₙ", o: "ₒ", x: "ₓ",
};

function toUnicodeScript(text: string, kind: "sup" | "sub"): string {
  const map = kind === "sup" ? SUP_U : SUB_U;
  const mapped = Array.from(text).map((c) => map[c] ?? null);
  return mapped.every(Boolean) ? mapped.join("") : `${kind === "sup" ? "^" : "_"}(${text})`;
}

/** Converts a LaTeX fragment into PowerPoint-ready runs. */
export function latexToRuns(tex: string): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;

  while (i < tex.length) {
    const ch = tex[i];

    if (ch === "^" || ch === "_") {
      const [body, next] = readGroup(tex, i + 1);
      const inner = flatten(body);
      pushRun(runs, inner, ch === "^" ? "sup" : "sub");
      i = next;
      continue;
    }

    if (ch === "\\") {
      const nameMatch = tex.slice(i).match(/^\\([a-zA-Z]+)\*?/);
      if (!nameMatch) {
        // escaped single char: \$ \% \{ …
        pushRun(runs, tex[i + 1] ?? "");
        i += 2;
        continue;
      }
      const name = nameMatch[1];
      let j = i + nameMatch[0].length;

      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [num, a] = readGroup(tex, j);
        const [den, b] = readGroup(tex, a);
        const n = flatten(num);
        const d = flatten(den);
        const vulgar = VULGAR[`${n}/${d}`];
        if (vulgar) pushRun(runs, vulgar);
        else pushRun(runs, `${isSimple(n) ? n : `(${n})`}/${isSimple(d) ? d : `(${d})`}`);
        i = b;
        continue;
      }
      if (name === "sqrt") {
        let root = "";
        if (tex[j] === "[") {
          const close = tex.indexOf("]", j);
          root = tex.slice(j + 1, close);
          j = close + 1;
        }
        const [body, b] = readGroup(tex, j);
        const inner = flatten(body);
        if (root) pushRun(runs, toUnicodeScript(flatten(root), "sup"));
        pushRun(runs, `√${isSimple(inner) ? inner : `(${inner})`}`);
        i = b;
        continue;
      }
      if (name === "text" || name === "mathrm" || name === "operatorname" || name === "mathbf" || name === "bn") {
        const [body, b] = readGroup(tex, j);
        pushRun(runs, flatten(body));
        i = b;
        continue;
      }
      if (name === "overline" || name === "bar" || name === "vec" || name === "hat" || name === "tilde") {
        const [body, b] = readGroup(tex, j);
        pushRun(runs, flatten(body));
        i = b;
        continue;
      }
      if (name === "mathbb") {
        const [body, b] = readGroup(tex, j);
        pushRun(runs, flatten(body));
        i = b;
        continue;
      }
      if (FUNCS.includes(name)) {
        pushRun(runs, name);
        i = j;
        continue;
      }
      if (GREEK[name] !== undefined) {
        pushRun(runs, GREEK[name]);
        i = j;
        continue;
      }
      if (SYMBOLS[name] !== undefined) {
        pushRun(runs, SYMBOLS[name]);
        i = j;
        continue;
      }
      // unknown command: drop the backslash, keep the word
      pushRun(runs, name);
      i = j;
      continue;
    }

    if (ch === "{" || ch === "}") {
      i++;
      continue;
    }
    if (ch === "~") {
      pushRun(runs, " ");
      i++;
      continue;
    }
    if (ch === "&" || ch === "%") {
      pushRun(runs, ch);
      i++;
      continue;
    }

    pushRun(runs, ch);
    i++;
  }

  return runs.filter((r) => r.text !== "");
}

const MATH_TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$\n]*?\$)/g;

/** Converts a mixed "text with $math$" string into editable PPTX runs. */
export function mixedToRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  (text ?? "").split(MATH_TOKEN).forEach((part) => {
    if (!part) return;
    if (/^\$\$[\s\S]*\$\$$/.test(part)) latexToRuns(part.slice(2, -2)).forEach((r) => runs.push(r));
    else if (/^\$[\s\S]*\$$/.test(part)) latexToRuns(part.slice(1, -1)).forEach((r) => runs.push(r));
    else pushRun(runs, part);
  });
  return runs.length ? runs : [{ text: text ?? "" }];
}

/** Plain-text version (superscripts folded into unicode) — used for PDF metadata. */
export function mixedToPlain(text: string): string {
  return mixedToRuns(text)
    .map((r) => (r.sup ? toUnicodeScript(r.text, "sup") : r.sub ? toUnicodeScript(r.text, "sub") : r.text))
    .join("");
}
