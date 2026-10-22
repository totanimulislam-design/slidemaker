/**
 * Math delimiters accepted by the editor and renderer.
 *
 * Keep the capturing group: String.split() then returns ordinary text at even
 * indices and complete math spans at odd indices. In particular, \(…\) and
 * \[…\] must be protected just like $…$ / $$…$$ during smart paste and reflow.
 */
export const MATH_SPAN = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]*\$|\\\([\s\S]*?\\\))/g;

/** Applies `fn` only to ordinary text, leaving every delimited math span intact. */
export function outsideMath(text: string, fn: (chunk: string) => string): string {
  return text
    .split(MATH_SPAN)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}
