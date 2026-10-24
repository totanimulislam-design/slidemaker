import type { FontChoice } from "./fonts";
import { markLoaded } from "./fonts";

/**
 * User-supplied fonts.
 *
 * Some Bangla faces (Lipighor's Chhatrish July, Kalpurush variants, SolaimanLipi
 * …) are free to *use* but their licences forbid re-distributing the file, so
 * they can't be shipped with the app. Instead the user uploads the .ttf/.woff2
 * they downloaded; we register it with the browser's FontFace API, keep it in
 * localStorage and expose it everywhere a font can be picked — including
 * per-box fonts.
 */

const KEY = "custom-fonts-v1";

export interface CustomFont {
  family: string;
  script: NonNullable<FontChoice["script"]>;
  kind: NonNullable<FontChoice["kind"]>;
  /** base64 payload of the font file */
  data: string;
  /** mime the browser needs to decode the payload */
  mime: string;
  added: number;
}

const KIND_BY_NAME = (name: string): CustomFont["kind"] => {
  const n = name.toLowerCase();
  if (/(bold|black|heavy|extra)/.test(n)) return "display";
  if (/(italic|script|hand|likhan|amar)/.test(n)) return "hand";
  if (/(serif|tiro|borak|zilla)/.test(n)) return "serif";
  return "sans";
};

export function listCustomFonts(): CustomFont[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomFont[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: CustomFont[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    throw new Error("storage-full");
  }
}

export function dataUrl(font: CustomFont): string {
  return `data:${font.mime};base64,${font.data}`;
}

/** Registers a font with the browser so CSS can use it immediately. */
export function registerFont(font: CustomFont): Promise<void> {
  const settled = () => {
    // mark it even when the browser refuses, so the UI stays consistent and
    // the text simply falls back to the next family in the stack
    markLoaded([font.family]);
    listeners.forEach((l) => l(listCustomFonts()));
  };
  // environments without the FontFace API (old browsers, jsdom in the tests)
  // must not break an import: the payload is kept and used where possible
  if (typeof FontFace === "undefined") {
    settled();
    return Promise.resolve();
  }
  try {
    const face = new FontFace(font.family, `url(${dataUrl(font)})`, {
      display: "swap",
      weight: "100 900",
    });
    return face
      .load()
      .then((loaded) => {
        try {
          document.fonts?.add(loaded);
        } catch {
          /* document.fonts can be missing or refuse the face */
        }
        settled();
      })
      .catch(settled);
  } catch {
    settled();
    return Promise.resolve();
  }
}

/** Registers every saved font — called once at start-up. */
export async function restoreCustomFonts(): Promise<CustomFont[]> {
  const list = listCustomFonts();
  await Promise.all(list.map(registerFont));
  return list;
}

const listeners = new Set<(list: CustomFont[]) => void>();
export function onCustomFontsChanged(fn: (list: CustomFont[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  const list = listCustomFonts();
  listeners.forEach((fn) => fn(list));
}

/** Removes a font and unregisters it from the document. */
export function removeCustomFont(family: string) {
  save(listCustomFonts().filter((f) => f.family !== family));
  notify();
}

/**
 * Installs a font that arrived inside a shared project.
 *
 * A family the recipient already has is left untouched (the same Bangla face
 * may be a different build on each machine, and replacing it would silently
 * restyle the recipient's own decks). When localStorage refuses the payload the
 * font is still registered for this session, so the shared deck looks right
 * while it is open.
 */
export async function installCustomFont(font: CustomFont): Promise<void> {
  const family = String(font.family ?? "").trim();
  if (!family || !font.data) throw new Error("invalid font");
  const list = listCustomFonts().filter((f) => f.family.toLowerCase() !== family.toLowerCase());
  try {
    save([...list, { ...font, family }]);
  } catch (err) {
    if ((err as Error)?.message !== "storage-full") throw err;
  }
  await registerFont({ ...font, family });
  notify();
}

export async function addCustomFontFile(file: File, script: CustomFont["script"]): Promise<CustomFont> {
  if (!/\.(ttf|otf|woff2?|ttc)$/i.test(file.name)) throw new Error("type");
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const family = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "My font";
  const font: CustomFont = {
    family,
    script,
    kind: KIND_BY_NAME(file.name),
    data: btoa(binary),
    mime: /\.woff2$/i.test(file.name) ? "font/woff2" : /\.woff$/i.test(file.name) ? "font/woff" : "font/ttf",
    added: Date.now(),
  };
  const list = listCustomFonts().filter((f) => f.family.toLowerCase() !== family.toLowerCase());
  list.push(font);
  save(list);
  await registerFont(font);
  notify();
  return font;
}

/** FontChoice view of the user's fonts, merged into the pickers. */
export function customFontChoices(script?: FontChoice["script"]): FontChoice[] {
  return listCustomFonts()
    .filter((f) => !script || f.script === script)
    .map((f) => ({
      family: f.family,
      label: `${f.family}`,
      script: f.script,
      kind: f.kind,
      sample: script === "arabic" ? "العربية" : "বাংলা অথবা Aa",
      weights: "100 900",
      custom: true,
    }));
}
