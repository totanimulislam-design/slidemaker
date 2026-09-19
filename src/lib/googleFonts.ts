import type { FontChoice } from "./fonts";
import { GOOGLE_FONTS_RAW } from "./googleFontsData";

/**
 * The complete Google Fonts catalogue, parsed from the compact table in
 * `googleFontsData.ts` on first use.
 *
 * Every picker offers these families on top of the curated library, and the
 * loader consults the real weight list here so a request never asks Google
 * for a weight a family does not ship (which makes the whole stylesheet
 * request fail).
 */
export type GoogleFontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";

export interface GoogleFontMeta {
  family: string;
  category: GoogleFontCategory;
  /** the numeric weights the family ships, ascending */
  weights: number[];
  italic: boolean;
  /** script coverage flags — see googleFontsData.ts */
  scripts: string;
}

const CATEGORY: Record<string, GoogleFontCategory> = {
  s: "sans-serif",
  r: "serif",
  d: "display",
  h: "handwriting",
  m: "monospace",
};

let table: Map<string, GoogleFontMeta> | null = null;
let ordered: GoogleFontMeta[] | null = null;

function parse(): void {
  if (table) return;
  table = new Map();
  ordered = [];
  for (const line of GOOGLE_FONTS_RAW.split("\n")) {
    if (!line) continue;
    const [family, cat, weights, italic, scripts] = line.split("|");
    if (!family) continue;
    const meta: GoogleFontMeta = {
      family,
      category: CATEGORY[cat] ?? "sans-serif",
      weights: (weights || "4").split("").map((d) => Number(d) * 100),
      italic: italic === "i",
      scripts: scripts ?? "l",
    };
    table.set(family.toLowerCase(), meta);
    ordered.push(meta);
  }
}

/** every family, in catalogue (alphabetical) order */
export function googleFontList(): GoogleFontMeta[] {
  parse();
  return ordered!;
}

export function googleFontMeta(family: string | undefined): GoogleFontMeta | undefined {
  if (!family) return undefined;
  parse();
  return table!.get(family.trim().toLowerCase());
}

export const isGoogleFont = (family: string | undefined): boolean => !!googleFontMeta(family);

/** the family's real weight list as a css2 `wght@` value, e.g. "400;700" */
export function googleFontWeights(family: string | undefined): string | undefined {
  const meta = googleFontMeta(family);
  return meta ? meta.weights.join(";") : undefined;
}

export function googleFontCount(): number {
  return googleFontList().length;
}

/* -------------------- the catalogue as picker rows ------------------------- */

const KIND: Record<GoogleFontCategory, FontChoice["kind"]> = {
  "sans-serif": "sans",
  serif: "serif",
  display: "display",
  handwriting: "hand",
  monospace: "mono",
};

export function googleFontScript(meta: GoogleFontMeta): FontChoice["script"] {
  if (meta.scripts.includes("b")) return "bangla";
  if (meta.scripts.includes("a")) return "arabic";
  return "latin";
}

const SAMPLE: Record<FontChoice["script"], string> = {
  bangla: "বাংলা অথবা Aa",
  arabic: "العربية Aa",
  latin: "Question 12 · Aa",
};

let choices: FontChoice[] | null = null;

/** the whole catalogue as `FontChoice` rows (cached) */
export function googleFontChoices(): FontChoice[] {
  if (choices) return choices;
  choices = googleFontList().map((m) => {
    const script = googleFontScript(m);
    return {
      family: m.family,
      label: m.family,
      script,
      kind: KIND[m.category],
      sample: SAMPLE[script],
      weights: m.weights.join(";"),
    };
  });
  return choices;
}

/** a picker row for any family name — catalogue metadata when we have it */
export function googleFontChoice(family: string): FontChoice | undefined {
  const meta = googleFontMeta(family);
  if (!meta) return undefined;
  const script = googleFontScript(meta);
  return {
    family: meta.family,
    label: meta.family,
    script,
    kind: KIND[meta.category],
    sample: SAMPLE[script],
    weights: meta.weights.join(";"),
  };
}
