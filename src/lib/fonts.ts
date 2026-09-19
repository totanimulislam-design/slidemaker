/**
 * Universal character-set support.
 *
 * A single font never covers every script, so the slide uses a *fallback chain*:
 * the browser picks the first family in the list that actually contains each
 * glyph. Bengali → Bangla font, Arabic → naskh font, 漢字 → CJK font, ✓ ➜ symbol
 * font, 😀 → colour emoji — all inside the same line of text.
 *
 * Heavy scripts (CJK) are only fetched when the deck really uses them.
 */

import { googleFontChoice, googleFontWeights } from "./googleFonts";

export type ScriptId =
  | "latin"
  | "bengali"
  | "arabic"
  | "devanagari"
  | "cjk"
  | "cyrillic"
  | "greek"
  | "hebrew"
  | "thai"
  | "tamil"
  | "symbols"
  | "emoji";

interface ScriptDef {
  id: ScriptId;
  label: string;
  test: RegExp;
  /** Google-Fonts family names needed for this script */
  families: string[];
  /** loaded up-front (small) or on demand (large CJK files) */
  lazy?: boolean;
  rtl?: boolean;
}

export const SCRIPTS: ScriptDef[] = [
  { id: "latin", label: "Latin", test: /[A-Za-z]/, families: [] },
  { id: "bengali", label: "বাংলা Bengali", test: /[\u0980-\u09FF]/, families: [] },
  {
    id: "arabic",
    label: "العربية Arabic / Urdu",
    test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
    families: [],
    rtl: true,
  },
  { id: "devanagari", label: "देवनागरी Devanagari", test: /[\u0900-\u097F]/, families: [] },
  { id: "cyrillic", label: "Кириллица Cyrillic", test: /[\u0400-\u04FF]/, families: [] },
  { id: "greek", label: "Ελληνικά Greek", test: /[\u0370-\u03FF\u1F00-\u1FFF]/, families: [] },
  { id: "hebrew", label: "עברית Hebrew", test: /[\u0590-\u05FF]/, families: ["Noto Sans Hebrew"], lazy: true, rtl: true },
  { id: "thai", label: "ไทย Thai", test: /[\u0E00-\u0E7F]/, families: ["Noto Sans Thai"], lazy: true },
  { id: "tamil", label: "தமிழ் Tamil", test: /[\u0B80-\u0BFF]/, families: ["Noto Sans Tamil"], lazy: true },
  {
    id: "cjk",
    label: "中日韓 CJK",
    test: /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/,
    families: ["Noto Sans SC", "Noto Sans JP", "Noto Sans KR"],
    lazy: true,
  },
  {
    id: "symbols",
    label: "Symbols & arrows",
    test: /[\u2000-\u2BFF\u2E00-\u2E7F\u{1D400}-\u{1D7FF}]/u,
    families: [],
  },
  {
    id: "emoji",
    label: "Emoji",
    test: /[\u{1F000}-\u{1FAFF}\u{FE0F}\u2600-\u27BF]/u,
    families: [],
  },
];

/* ------------------------------------------------------- fallback chain */

/** generic families must never appear mid-chain — they stop the fallback walk */
const GENERIC = new Set(["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif"]);

/** Always-available families loaded in index.html (small, high coverage). */
const CORE_FALLBACK = [
  "Noto Sans Bengali",
  "Noto Naskh Arabic",
  "Noto Sans Arabic",
  "Noto Sans Devanagari",
  "Noto Sans",
  "Noto Sans Symbols 2",
  "Noto Sans Math",
  "Noto Color Emoji",
];

/** Families pulled in on demand once their script appears in the deck. */
const LAZY_FALLBACK = ["Noto Sans Hebrew", "Noto Sans Thai", "Noto Sans Tamil", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR"];

const quote = (f: string) => (/^[\w-]+$/.test(f) ? f : `'${f.replace(/'/g, "")}'`);

/** Kalpurush ships with the app; a CDN copy is registered as a fallback face. */
const KALPURUSH_FALLBACK = ["Kalpurush", "Kalpurush CDN"];
const ensureKalpurush = (family: string): string[] =>
  /^kalpurush/i.test(family) ? KALPURUSH_FALLBACK : [];

/**
 * Builds the complete CSS font-family value.
 * @param primary   the user's chosen display font (may itself be a stack)
 * @param arabic    preferred Arabic face, inserted early so Arabic looks right
 */
export function universalStack(primary: string, arabic?: string): string {
  const head = cleanFamily(primary);
  const seen = new Set<string>();
  const chain: string[] = [];
  const push = (f: string) => {
    const key = f.toLowerCase();
    if (!f || GENERIC.has(key) || seen.has(key)) return;
    seen.add(key);
    chain.push(quote(f));
  };

  head.forEach(push);
  head.flatMap(ensureKalpurush).forEach(push);
  if (arabic) cleanFamily(arabic).forEach(push);
  CORE_FALLBACK.forEach(push);
  LAZY_FALLBACK.forEach(push);
  chain.push("system-ui", "sans-serif");
  return chain.join(", ");
}

/* --------------------------------------------------------- font library */

/** the script a face is designed for — also drives the single-script pickers */
export type FontScript = "bangla" | "latin" | "arabic";

/**
 * Heading a face sits under in the picker.
 * `latin`/`bangla`/`arabic` mirror the script; `multi` collects the pan-Unicode
 * faces (Noto Sans, Noto Serif…) that cover many scripts at once.
 */
export type FontGroupId = FontScript | "multi";

export interface FontChoice {
  family: string;
  label: string;
  /** user-uploaded font */
  custom?: boolean;
  /** which script this face is primarily for */
  script: FontScript;
  /**
   * Overrides the group this face is listed under in the multi-script picker.
   * Defaults to `script` — so a face stays in its script picker *and* can be
   * filed under “Multi-language” (e.g. Noto Sans).
   */
  group?: FontGroupId;
  /** short classification for grouping in the picker */
  kind: "display" | "sans" | "serif" | "hand" | "mono" | "traditional";
  /** sample text shown in the picker */
  sample: string;
  /** weights to request from Google Fonts */
  weights: string;
  /**
   * Real Google-Fonts family to download instead of `family`.
   * Google has no “Noto Serif Arabic” — its Arabic serif is “Noto Naskh Arabic”,
   * so that file is fetched and re-registered under the friendlier name.
   */
  aliasFor?: string;
}

const bn = (family: string, kind: FontChoice["kind"]): FontChoice => ({
  family, label: family, script: "bangla", kind, sample: "বাংলা অথবা Aa", weights: "400;500;600;700;800",
});
const en = (family: string, kind: FontChoice["kind"]): FontChoice => ({
  family, label: family, script: "latin", kind, sample: "Question 12 · Aa", weights: "400;500;600;700;800",
});
const ar = (family: string, kind: FontChoice["kind"]): FontChoice => ({
  family, label: family, script: "arabic", kind, sample: "العربية", weights: "400;500;600;700",
});
/** pan-Unicode faces — filed under “Multi-language” but still script `latin` */
const multi = (family: string, kind: FontChoice["kind"]): FontChoice => ({
  family, label: family, script: "latin", group: "multi", kind, sample: "Aa বাংলا العربية", weights: "400;500;600;700;800",
});

/** The group a face belongs to in the multi-script picker. */
export const fontGroupId = (f: Pick<FontChoice, "script" | "group">): FontGroupId => f.group ?? f.script;

/** Group order + label for the grouped picker; `priority` pins faces to the top. */
export interface FontGroupDef {
  id: FontGroupId;
  label: string;
  /** families shown first, in this order (everything else follows A→Z) */
  priority: string[];
}

export const FONT_GROUPS: FontGroupDef[] = [
  {
    id: "latin",
    label: "English / Latin",
    priority: ["Inter", "Roboto", "Open Sans", "Lato", "Poppins", "Montserrat", "Nunito", "Merriweather"],
  },
  {
    id: "bangla",
    label: "Bangla",
    priority: ["Noto Sans Bengali", "Noto Serif Bengali", "Hind Siliguri", "Baloo Da 2", "Atma", "Tiro Bangla", "Kalpurush"],
  },
  {
    id: "arabic",
    label: "Arabic",
    priority: ["Noto Sans Arabic", "Noto Serif Arabic", "Cairo", "Tajawal", "Amiri", "Almarai"],
  },
  {
    id: "multi",
    label: "Multi-language",
    priority: ["Noto Sans", "Noto Serif", "Noto Sans Display", "Noto Serif Display"],
  },
];

/** Pinned faces first (in the order above), then the rest alphabetically. */
export function sortGroupFonts(fonts: FontChoice[], id: FontGroupId): FontChoice[] {
  const priority = FONT_GROUPS.find((g) => g.id === id)?.priority ?? [];
  const rank = (f: FontChoice) => {
    const i = priority.indexOf(f.family);
    return i < 0 ? priority.length : i;
  };
  // Array#sort is stable, so ties keep the library order
  return [...fonts].sort((a, b) => rank(a) - rank(b) || a.family.localeCompare(b.family, "en"));
}

/**
 * CSS font-family for a *preview* of one face: the face itself, then a
 * script-appropriate safety net so a sample never shows tofu boxes while the
 * real file is still downloading (or when it covers only some scripts).
 */
export function previewStack(f: Pick<FontChoice, "family" | "script" | "group">): string {
  if (f.script === "arabic") return `'${f.family}', 'Noto Naskh Arabic', sans-serif`;
  if (fontGroupId(f) === "multi") return `'${f.family}', 'Noto Sans', 'Noto Sans Bengali', 'Noto Naskh Arabic', sans-serif`;
  return `'${f.family}', 'Noto Sans Bengali', sans-serif`;
}

/** Curated, all verified on Google Fonts. */
export const FONT_LIBRARY: FontChoice[] = [
  /* ------------------------------- Bangla ------------------------------ */
  // self-hosted (variable weight 100–900) — the classic Bangla exam/book font
  { family: "Kalpurush", label: "Kalpurush", script: "bangla", kind: "sans", sample: "বাংলা অথবা Aa", weights: "400;500;600;700;800" },
  bn("Anek Bangla", "sans"),
  bn("Noto Sans Bengali", "sans"),
  bn("Noto Serif Bengali", "serif"),
  bn("Hind Siliguri", "sans"),
  bn("Baloo Da 2", "display"),
  bn("Tiro Bangla", "serif"),
  bn("Galada", "display"),
  bn("Atma", "display"),
  bn("Mina", "sans"),
  bn("Amita", "hand"),
  bn("Yatra One", "display"),
  bn("Modak", "display"),
  bn("Kalam", "hand"),
  bn("Baloo Bhai 2", "display"),
  bn("Noto Sans Bengali UI", "sans"),
  bn("Charukola Bengali", "display"),
  bn("SolaimanLipi", "sans"),

  /* --------------------------- Latin / English -------------------------- */
  // display / condensed / decorative — great for titles & badges
  en("Oswald", "display"),
  en("Anton", "display"),
  en("Bebas Neue", "display"),
  en("Archivo Black", "display"),
  en("Teko", "display"),
  en("Rajdhani", "display"),
  en("Khand", "display"),
  en("Saira Condensed", "display"),
  en("Barlow Condensed", "display"),
  en("Roboto Condensed", "display"),
  en("Asap Condensed", "display"),
  en("Orbitron", "display"),
  en("Bree Serif", "display"),
  en("Alfa Slab One", "display"),
  en("Abril Fatface", "display"),
  en("Cinzel", "display"),
  en("Cinzel Decorative", "display"),
  en("Righteous", "display"),
  en("Fredoka", "display"),
  en("Bungee", "display"),
  en("Bangers", "display"),
  en("Monoton", "display"),
  en("Press Start 2P", "display"),
  en("Silkscreen", "display"),
  en("Special Elite", "display"),
  en("Lobster", "display"),
  en("Pacifico", "hand"),
  en("Dancing Script", "hand"),
  en("Caveat", "hand"),
  en("Satisfy", "hand"),
  en("Great Vibes", "hand"),
  en("Sacramento", "hand"),
  en("Shadows Into Light", "hand"),
  en("Amatic SC", "hand"),
  en("Permanent Marker", "hand"),
  en("Tangerine", "hand"),
  en("Courgette", "hand"),
  en("Cookie", "hand"),
  en("Kaushan Script", "hand"),

  // geometric / modern sans
  en("Poppins", "sans"),
  en("Montserrat", "sans"),
  en("Inter", "sans"),
  en("Nunito", "sans"),
  en("Nunito Sans", "sans"),
  en("Work Sans", "sans"),
  en("DM Sans", "sans"),
  en("Manrope", "sans"),
  en("Outfit", "sans"),
  en("Urbanist", "sans"),
  en("Plus Jakarta Sans", "sans"),
  en("Figtree", "sans"),
  en("Onest", "sans"),
  en("Instrument Sans", "sans"),
  en("Bricolage Grotesque", "display"),
  en("Sora", "sans"),
  en("Space Grotesk", "sans"),
  en("Syne", "display"),
  en("Epilogue", "sans"),
  en("Rubik", "sans"),
  en("Quicksand", "sans"),
  en("Josefin Sans", "sans"),
  en("Lexend", "sans"),
  en("Mulish", "sans"),
  en("Hanken Grotesk", "sans"),
  en("Heebo", "sans"),
  en("Karla", "sans"),
  en("Cabin", "sans"),
  en("Assistant", "sans"),
  en("Jost", "sans"),
  en("Overpass", "sans"),
  en("Exo 2", "sans"),
  en("Comfortaa", "sans"),
  en("Red Hat Display", "sans"),
  en("Albert Sans", "sans"),
  en("Geist", "sans"),

  // neutral / UI
  en("Roboto", "sans"),
  en("Open Sans", "sans"),
  en("Lato", "sans"),
  en("Source Sans 3", "sans"),
  en("IBM Plex Sans", "sans"),
  en("Public Sans", "sans"),
  en("Libre Franklin", "sans"),
  en("Fira Sans", "sans"),
  en("Kanit", "sans"),
  en("Commissioner", "sans"),
  en("Chivo", "sans"),
  en("Noto Sans", "sans"),

  // serif — questions & body text
  en("Merriweather", "serif"),
  en("Playfair Display", "serif"),
  en("Lora", "serif"),
  en("PT Serif", "serif"),
  en("Libre Baskerville", "serif"),
  en("Crimson Text", "serif"),
  en("Source Serif 4", "serif"),
  en("Roboto Serif", "serif"),
  en("Roboto Slab", "serif"),
  en("Zilla Slab", "serif"),
  en("Arvo", "serif"),
  en("Rokkitt", "serif"),
  en("Aleo", "serif"),
  en("Merriweather Sans", "sans"),
  en("Bitter", "serif"),
  en("Frank Ruhl Libre", "serif"),
  en("Cormorant Garamond", "serif"),
  en("Bodoni Moda", "serif"),
  en("EB Garamond", "serif"),
  en("Josefin Slab", "serif"),
  en("BioRhyme", "serif"),

  // monospace
  en("Fira Code", "mono"),
  en("JetBrains Mono", "mono"),
  en("Roboto Mono", "mono"),
  en("Source Code Pro", "mono"),
  en("Space Mono", "mono"),
  en("Courier Prime", "mono"),

  /* ------------------------------- Arabic ------------------------------- */
  ar("Noto Naskh Arabic", "traditional"),
  { family: "Noto Serif Arabic", label: "Noto Serif Arabic", script: "arabic", kind: "serif", sample: "العربية", weights: "400;500;600;700", aliasFor: "Noto Naskh Arabic" },
  ar("Amiri", "traditional"),
  ar("Scheherazade New", "traditional"),
  ar("Lateef", "traditional"),
  ar("Aref Ruqaa", "traditional"),
  ar("Alkalami", "traditional"),
  ar("Gulzar", "traditional"),
  ar("Blaka", "display"),
  ar("Reem Kufi", "display"),
  ar("Noto Kufi Arabic", "display"),
  ar("El Messiri", "display"),
  ar("Lalezar", "display"),
  ar("Changa", "sans"),
  ar("Cairo", "sans"),
  ar("Tajawal", "sans"),
  ar("Almarai", "sans"),
  ar("Mada", "sans"),
  ar("Markazi Text", "serif"),
  ar("Noto Sans Arabic", "sans"),
  ar("IBM Plex Sans Arabic", "sans"),
  ar("Readex Pro", "sans"),
  ar("Alexandria", "sans"),

  /* ---------------------------- Multi-language --------------------------- */
  multi("Noto Sans", "sans"),
  multi("Noto Serif", "serif"),
  multi("Noto Sans Display", "sans"),
  multi("Noto Serif Display", "serif"),
];

export const FONT_BY_FAMILY = new Map(FONT_LIBRARY.map((f) => [f.family.toLowerCase(), f]));

/** families already requested (kept so we never inject the same link twice) */
const loadedFamilies = new Set<string>();

/** anything a loader can fetch: a library face, or a subset of its fields */
export interface LoadableFont {
  family: string;
  weights: string;
  /** download `aliasFor` from Google but register it as `family` */
  aliasFor?: string;
}

/**
 * The weights to ask Google for: the family's REAL weight list when the
 * catalogue knows it (a request that names a weight the family does not ship
 * fails as a whole), else whatever the caller wanted. Every weight is listed;
 * @font-face files only download once a weight is actually used.
 */
export function loadableWeights(family: string, requested: string): string {
  return googleFontWeights(family) ?? requested;
}

/** Google Fonts <link> for the given families (deduplicated). */
export function fontHref(families: { family: string; weights: string }[]): string {
  const q = families
    .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${loadableWeights(f.family, f.weights)}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/**
 * Everything known about a family: the curated library first, then the full
 * Google Fonts catalogue. Undefined for uploaded / unknown faces.
 */
export function fontChoiceFor(family: string | undefined): FontChoice | undefined {
  if (!family) return undefined;
  return FONT_BY_FAMILY.get(family.toLowerCase()) ?? googleFontChoice(family);
}

/**
 * Loads a family by name from wherever it lives — the curated library (with
 * its alias rules), the Google catalogue (with its real weights) or, failing
 * both, a plain best-effort request. Uploaded fonts are registered by
 * lib/customFonts and need nothing here.
 */
export function ensureFamily(family: string | undefined): void {
  if (!family) return;
  const meta = fontChoiceFor(family);
  ensureFontStylesheet([meta ?? { family, weights: "400;500;600;700" }]);
}

/** the first concrete family of a value that may still be a legacy CSS stack ("" when empty) */
export const firstFamily = (value: string | undefined): string =>
  (value ?? "").split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "";

/**
 * The CSS stack a family's NAME is drawn in wherever a control shows it (the
 * font picker's trigger, the toolbar's font button): the face itself, then a
 * script-appropriate safety net (see previewStack) — or a plain best-effort
 * chain for an uploaded / unknown face.
 */
export function faceStack(family: string, choice: FontChoice | undefined = fontChoiceFor(family)): string {
  return choice ? previewStack(choice) : `'${family.replace(/'/g, "")}', 'Noto Sans Bengali', sans-serif`;
}

/** parses a CSS font-family value into concrete family names */
export function cleanFamily(value: string): string[] {
  return value
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
    .filter((f) => f && !GENERIC.has(f.toLowerCase()));
}

/** normalises a legacy font-stack value into a single family name we know */
export function toSingleFamily(value: string): string {
  const first = cleanFamily(value)[0] ?? "";
  if (FONT_BY_FAMILY.has(first.toLowerCase())) return first;
  // "Oswald, system-ui, sans-serif" → Oswald; "'Anek Bangla', sans-serif" → Anek Bangla
  return first || "Kalpurush";
}

/** true when every listed family already has a stylesheet loaded */
export const familiesLoaded = (families: string[]) => families.every((f) => loadedFamilies.has(f));
export const markLoaded = (families: string[]) => families.forEach((f) => loadedFamilies.add(f));

/**
 * Aliased faces: Google's CSS is fetched and every mention of the real family
 * is renamed, then injected as a <style> so `family` becomes a usable face.
 * Fails silently (offline / CORS) — the universal chain still covers the script.
 */
const aliasRequested = new Set<string>();

function loadAlias(font: LoadableFont) {
  const source = font.aliasFor;
  if (typeof document === "undefined" || !source || aliasRequested.has(font.family)) return;
  aliasRequested.add(font.family);
  if (document.querySelector(`style[data-ff="alias:${font.family}"]`)) return;
  fetch(fontHref([{ family: source, weights: font.weights }]))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`font ${font.family}`))))
    .then((css) => {
      const style = document.createElement("style");
      style.setAttribute("data-ff", `alias:${font.family}`);
      // the CSS only names the family in its font-family declarations
      style.textContent = css.split(source).join(font.family);
      document.head.appendChild(style);
      document.fonts?.ready?.then(() => listeners.forEach((l) => l()));
    })
    .catch(() => {
      /* nothing to do: the fallback chain renders the script anyway */
    });
}

/** chunks already retried family-by-family after a failed request */
const retriedChunks = new Set<string>();

/** Requests a stylesheet for the given families (deduplicated by content). */
export function ensureFontStylesheet(families: LoadableFont[]) {
  if (typeof document === "undefined" || !families.length) return;
  // Kalpurush is declared in index.html with a local file; nothing to fetch.
  const remote = families.filter((f) => !/^kalpurush/i.test(f.family));
  markLoaded(families.map((f) => f.family));
  remote.forEach((f) => {
    if (f.aliasFor) loadAlias(f);
  });
  const direct = remote.filter((f) => !f.aliasFor);
  if (!direct.length) {
    document.fonts?.ready?.then(() => listeners.forEach((l) => l()));
    return;
  }
  const key = `ff:${direct.map((f) => f.family).sort().join("|")}`;
  if (document.querySelector(`link[data-ff="${key}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.crossOrigin = "anonymous";
  link.setAttribute("data-ff", key);
  link.href = fontHref(direct);
  link.addEventListener("load", () => {
    markLoaded(direct.map((f) => f.family));
    document.fonts?.ready?.then(() => listeners.forEach((l) => l()));
  });
  link.addEventListener("error", () => {
    // one unavailable family makes Google reject the whole request, which would
    // silently drop the other eleven — retry them one by one instead
    if (retriedChunks.has(key)) return;
    retriedChunks.add(key);
    direct.forEach((f) => ensureFontStylesheet([f]));
  });
  document.head.appendChild(link);
}

/** Pre-loads the whole library in chunks so the picker previews render. */
export function preloadFontLibrary() {
  if (typeof document === "undefined") return;
  const CHUNK = 12;
  const remote = FONT_LIBRARY.filter((f) => !/^kalpurush/i.test(f.family));
  for (let i = 0; i < remote.length; i += CHUNK) {
    ensureFontStylesheet(remote.slice(i, i + CHUNK));
  }
}

/* ------------------------------------------------------ script detection */

export function detectScripts(text: string): ScriptId[] {
  if (!text) return [];
  return SCRIPTS.filter((s) => s.test.test(text)).map((s) => s.id);
}

const RTL_RANGE = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFF]/;
const LTR_STRONG = /[A-Za-z\u0980-\u09FF\u0900-\u097F\u0400-\u04FF\u0370-\u03FF\u4E00-\u9FFF]/;

/** true when the first strong character of the text is right-to-left */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  const stripped = text.replace(/\$[^$]*\$/g, " "); // ignore LaTeX, it is always LTR
  const rtl = stripped.search(RTL_RANGE);
  if (rtl < 0) return false;
  const ltr = stripped.search(LTR_STRONG);
  return ltr < 0 || rtl < ltr;
}

/* -------------------------------------------------------- lazy font load */

const loaded = loadedFamilies;
const listeners = new Set<() => void>();

export function onFontsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function injectFamilies(families: string[]) {
  const pending = families.filter((f) => !loaded.has(f));
  if (!pending.length || typeof document === "undefined") return;
  pending.forEach((f) => loaded.add(f));

  const query = pending
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;700`)
    .join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.crossOrigin = "anonymous";
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  link.addEventListener("load", () => {
    document.fonts?.ready?.then(() => listeners.forEach((l) => l()));
  });
  document.head.appendChild(link);
}

/** Ensures every font needed by `text` is present; returns newly required scripts. */
export function ensureFontsFor(text: string): ScriptId[] {
  const found = detectScripts(text);
  const needed = SCRIPTS.filter((s) => s.lazy && found.includes(s.id)).flatMap((s) => s.families);
  const fresh = needed.filter((f) => !loaded.has(f));
  if (fresh.length) injectFamilies(fresh);
  return found;
}

export const isFamilyLoaded = (family: string) => loaded.has(family);

/** Human-readable list of scripts present in the deck. */
export function describeScripts(ids: ScriptId[]): { id: ScriptId; label: string; rtl?: boolean }[] {
  return SCRIPTS.filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, label: s.label, rtl: s.rtl }));
}
