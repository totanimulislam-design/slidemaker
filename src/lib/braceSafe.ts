/**
 * KaTeX refuses a whole formula the moment its braces stop pairing — and that
 * is exactly how hand-typed set-builder notation arrives. A teacher writes
 *
 *     $D = {y: y \in N$ এবং $5 \leq y \leq 10}$
 *
 * and the two `$…$` spans each get half of the set: one span is left with an
 * unclosed `{`, the other with a stray `}`. Both halves used to die as red
 * source text. balanceBraces rescues them instead:
 *
 * - a `}` with no partner prints as a literal brace (`\}`);
 * - an unclosed `{` that a command (or `^` / `_`) opened is closed again at
 *   the end, so `\frac{a`, `\mathbb{N`, `x^{2` keep working;
 * - any other unclosed `{` also prints — a brace floating outside command
 *   syntax is set notation being typed out, not a grouping mistake.
 *
 * Braces that already pair up (groups, `\frac{…}{…}`) pass through untouched.
 */
/**
 * Whether the `{` at `i` reached for a command's (or script's) argument —
 * possibly after other complete groups, as in `\frac{a}{b`, where the `{b`
 * follows the group `{a}`.
 */
function followsArgument(tex: string, i: number): boolean {
  let j = i;
  // step back over a chain of complete groups: } {a} → its opener → …
  while (j > 0 && tex[j - 1] === "}") {
    let depth = 0;
    let k = j - 1;
    for (; k >= 0; k--) {
      const c = tex[k];
      if (c === "\\") {
        k--; // the escaped character is not structure
        continue;
      }
      if (c === "}") depth++;
      else if (c === "{") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (k < 0) return false;
    j = k;
  }
  let k = j - 1;
  while (k >= 0 && (tex[k] === " " || tex[k] === "\t")) k--;
  if (k < 0) return false;
  if (tex[k] === "^" || tex[k] === "_") return true;
  let end = k;
  while (end >= 0 && /[A-Za-z]/.test(tex[end])) end--;
  // a `\command` right before — but not the `\\` that prints a backslash
  return end < k && tex[end] === "\\" && tex[end - 1] !== "\\";
}

export function balanceBraces(tex: string): string {
  /** `{`s still open when the scan ends, and what opened them. */
  const open: { at: number; fromCommand: boolean }[] = [];
  /** `}`s that arrived with nothing to close. */
  const stray: number[] = [];

  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === "\\") {
      i++; // the escaped character (\{ \} \\ …) is not structure
      continue;
    }
    if (ch === "{") {
      // `\frac {a`, `\mathbb{N`, `x^{2`, `\frac{a}{b` — a command or script
      // reached for its argument group; anything else is a brace the teacher
      // meant to see.
      open.push({ at: i, fromCommand: followsArgument(tex, i) });
    } else if (ch === "}") {
      if (open.length) open.pop();
      else stray.push(i);
    }
  }

  if (!open.length && !stray.length) return tex; // already sound — the common case

  const literals = [...stray, ...open.filter((o) => !o.fromCommand).map((o) => o.at)].sort((a, b) => a - b);
  let out = "";
  let cursor = 0;
  for (const at of literals) {
    out += tex.slice(cursor, at) + (tex[at] === "{" ? "\\{" : "\\}");
    cursor = at + 1;
  }
  out += tex.slice(cursor);
  // Escaped braces open no groups, so one appended `}` per command-brace
  // closes exactly those, innermost first.
  return out + "}".repeat(open.filter((o) => o.fromCommand).length);
}
