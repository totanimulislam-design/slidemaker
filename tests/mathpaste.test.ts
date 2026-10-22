import katex from "katex";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import AnswerKeyModal from "../src/components/AnswerKeyModal";
import MathText from "../src/components/MathText";
import { balanceBraces } from "../src/lib/braceSafe";
import { MATH_SPAN } from "../src/lib/mathSpans";
import { normalizeSource } from "../src/lib/richPaste";
import { reflowLayout } from "../src/lib/reflow";
import { mapAnswers, parseAnswerKey } from "../src/lib/answerKey";
import type { SlideData } from "../src/lib/types";

interface Result {
  name: string;
  pass: boolean;
  detail?: string;
}

function slideWithOptions(texts: string[]): SlideData {
  return {
    id: "math-slide",
    number: "1",
    question: "Set relation",
    options: texts.map((text, i) => ({ key: ["ক", "খ", "গ", "ঘ"][i], text })),
    answer: null,
    badge: "",
    note: "",
    scale: 1,
    showAnswer: false,
  };
}

function renderDelimited(source: string) {
  let tex = "";
  if (source.startsWith("$") && source.endsWith("$")) tex = source.slice(1, -1);
  else if (source.startsWith(String.raw`\(`) && source.endsWith(String.raw`\)`)) tex = source.slice(2, -2);
  else if (source.startsWith(String.raw`\[`) && source.endsWith(String.raw`\]`)) tex = source.slice(2, -2);
  else throw new Error(`No complete math delimiter: ${source}`);
  // the app renders through MathText, which sanitises before KaTeX sees it
  return katex.renderToString(balanceBraces(tex), { throwOnError: true });
}

export function runMathPasteTests(): Result[] {
  const results: Result[] = [];
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, detail: error instanceof Error ? error.message : String(error) });
    }
  };
  const equal = (actual: unknown, expected: unknown) => {
    if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };

  test("smart paste preserves inline \\(…\\) around \\in, \\notin and \\leq", () => {
    for (const command of [String.raw`\in`, String.raw`\notin`, String.raw`\leq`]) {
      const input = `1. \\(x ${command} A\\)`;
      const output = normalizeSource(input).text;
      equal(output, input);
      renderDelimited(output.slice(3));
    }
  });

  test("smart paste preserves display \\[…\\] set relations", () => {
    const input = String.raw`1. \[A \subseteq B\]`;
    const output = normalizeSource(input).text;
    equal(output, input);
    renderDelimited(output.slice(3));
  });

  test("a set-builder colon does not split the expression into invalid math runs", () => {
    const input = String.raw`1. A = \{x \in \mathbb{R} : x \notin B, x \leq 5\}`;
    const expected = String.raw`1. $A = \{x \in \mathbb{R} : x \notin B, x \leq 5\}$`;
    const output = normalizeSource(input, { reflow: false }).text;
    equal(output, expected);
    renderDelimited(output.slice(3));
  });

  test("balanceBraces leaves sound TeX untouched", () => {
    equal(balanceBraces(String.raw`\frac{a}{b}`), String.raw`\frac{a}{b}`);
    equal(balanceBraces(String.raw`x^{a}_{b}`), String.raw`x^{a}_{b}`);
    equal(balanceBraces(String.raw`A = \{5, 6, 7\}`), String.raw`A = \{5, 6, 7\}`);
  });

  test("a stray closing brace prints instead of killing the formula", () => {
    equal(balanceBraces(String.raw`5 \leq y \leq 10}`), String.raw`5 \leq y \leq 10\}`);
  });

  test("an unclosed set brace prints instead of killing the formula", () => {
    equal(balanceBraces(String.raw`D = {y: y \in N`), String.raw`D = \{y: y \in N`);
  });

  test("a command's unfinished argument group is closed, not printed", () => {
    equal(balanceBraces(String.raw`\frac{a}{b`), String.raw`\frac{a}{b}`);
    equal(balanceBraces(String.raw`x^{2`), String.raw`x^{2}`);
    equal(balanceBraces(String.raw`\mathbb{N`), String.raw`\mathbb{N}`);
    equal(balanceBraces(String.raw`{a\frac{b`), String.raw`\{a\frac{b}`);
  });

  test("a set split across two $…$ spans renders with its braces showing", () => {
    const text = "$D = {y: y \\in N$ এবং $5 \\leq y \\leq 10}$";
    let html = "";
    for (const part of text.split(MATH_SPAN).filter((p) => p !== undefined && p !== "")) {
      if (part.startsWith("$")) html += renderDelimited(part);
    }
    if (!html) throw new Error("no math span was found");
    if (html.includes("katex-error")) throw new Error("KaTeX reported an error");
    const visible = html.replace(/<[^>]*>/g, "");
    for (const glyph of ["{", "}", "∈", "≤"]) {
      if (!visible.includes(glyph)) throw new Error(`expected ${glyph} in the render, got: ${visible}`);
    }
  });

  test("MathText renders the split set-builder line without red error text", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      act(() => {
        root.render(createElement(MathText, { text: "$D = {y: y \\in N$ এবং $5 \\leq y \\leq 10}$" }));
      });
      if (!host.querySelector(".katex")) throw new Error("math was not rendered with KaTeX");
      if (host.querySelector(".katex-error")) throw new Error("rendered as raw red source");
      const visible = host.textContent ?? "";
      for (const glyph of ["{", "}", "∈", "≤"]) {
        if (!visible.includes(glyph)) throw new Error(`expected ${glyph} in the render, got: ${visible}`);
      }
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  test("paste answers matches a raw-brace set to the escaped option", () => {
    const slide = slideWithOptions([String.raw`$D = \{5, 6, 7, 8, 9, 10\}$`, String.raw`$D = \{5, 7, 9\}$`]);
    const mapping = mapAnswers([slide], parseAnswerKey("1. D = {5, 6, 7, 8, 9, 10}"));
    equal(mapping[0]?.status, "ok");
    equal(mapping[0]?.resolved, "ক");
  });

  test("reflow ignores option-like markers inside \\(…\\)", () => {
    const input = String.raw`1. \((a) (b) (c)\)`;
    equal(reflowLayout(input).text, input);
    equal(normalizeSource(input).text, input);
  });

  test("paste answers matches \\(…\\), bare LaTeX and Unicode ∈ to the same option", () => {
    const slide = slideWithOptions([String.raw`$x \in A$`]);
    for (const input of [String.raw`1. \(x \in A\)`, String.raw`1. x \in A`, "1. x ∈ A"]) {
      const mapping = mapAnswers([slide], parseAnswerKey(input));
      equal(mapping[0]?.status, "ok");
      equal(mapping[0]?.resolved, "ক");
    }
  });

  test("paste answers matches ∉ / \\not\\in and ≤ / \\le aliases", () => {
    const slide = slideWithOptions([String.raw`$x \notin B$`, String.raw`$x \leq 5$`]);
    for (const [input, key] of [
      ["1. x ∉ B", "ক"],
      [String.raw`1. \(x \not\in B\)`, "ক"],
      ["1. x ≤ 5", "খ"],
      [String.raw`1. \(x \le 5\)`, "খ"],
    ] as const) {
      const mapping = mapAnswers([slide], parseAnswerKey(input));
      equal(mapping[0]?.status, "ok");
      equal(mapping[0]?.resolved, key);
    }
  });

  test("Unicode math answers prefer the exact option instead of a longer partial match", () => {
    const slide = slideWithOptions([
      String.raw`$A = \{x \in \mathbb{R} : x \leq 5\}$`,
      String.raw`$x \leq 5$`,
    ]);
    const mapping = mapAnswers([slide], parseAnswerKey("1. x ≤ 5"));
    equal(mapping[0]?.resolved, "খ");
  });

  test("Paste answers renders pasted math and applies the matched option", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let applied: { slideId: string; answer: string }[] = [];
    try {
      act(() => {
        root.render(
          createElement(AnswerKeyModal, {
            open: true,
            slides: [slideWithOptions([String.raw`$x \in A$`])],
            currentIndex: 0,
            onClose: () => {},
            onApply: (updates) => {
              applied = updates;
            },
          }),
        );
      });
      const textarea = host.querySelector("textarea");
      if (!textarea) throw new Error("answer input not found");
      const paste = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(paste, "clipboardData", {
        value: { getData: (type: string) => (type === "text/plain" ? String.raw`1. \(x \in A\)` : "") },
      });
      act(() => {
        textarea.dispatchEvent(paste);
      });
      equal(textarea.value, String.raw`1. \(x \in A\)`);
      if (!host.querySelector(".katex")) throw new Error("pasted answer was not rendered with KaTeX");
      if (host.querySelector(".katex-error")) throw new Error("pasted answer contains a KaTeX error");
      const apply = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.startsWith("Apply"));
      if (!apply) throw new Error("apply button not found");
      act(() => {
        apply.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      equal(JSON.stringify(applied), JSON.stringify([{ slideId: "math-slide", answer: "ক" }]));
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  return results;
}
