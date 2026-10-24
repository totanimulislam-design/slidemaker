/**
 * Portable projects — one self-contained snapshot of a deck that another
 * person can open in this editor and keep editing on their own device.
 *
 * Two ways to send the same snapshot:
 *
 *   • a **link** — the whole bundle is deflated (when the browser can), encoded
 *     as base64url and carried in the URL hash (`#share=…`). Nothing is
 *     uploaded anywhere; the link *is* the project. That keeps sharing working
 *     on a static build with no server, and the data never leaves the sender's
 *     machine except through the link itself.
 *   • a **`.mcqdeck` file** — the same bundle as JSON, for decks whose pictures
 *     make the link too long to paste into a chat.
 *
 * A deck alone is not enough: the editor keeps uploaded bitmaps in IndexedDB
 * and only stores their stable `imageId` in the deck (`prepareForStorage`), and
 * custom font files live in localStorage. A bundle therefore carries
 *
 *     deck    — the deck exactly as it is saved (ids, no session blob: URLs)
 *     assets  — every referenced bitmap, keyed by its imageId, as base64
 *     fonts   — the custom fonts the deck actually uses, when asked for
 *
 * and opening it writes those bitmaps into the recipient's own image store,
 * allocating fresh ids and pointing the deck at them. The recipient's copy is
 * independent from that moment on: editing it can never change the sender's
 * project, and sending it back is the same Share action.
 */

import type { CustomFont } from "./customFonts";
import { installCustomFont, listCustomFonts } from "./customFonts";
import { objectUrlFor, saveImage, getImage, prepareForStorage } from "./imageStore";
import { dataUrlToBlob } from "./shapes";
import type { Deck } from "./types";

/** marker inside the JSON, so an unrelated `.json` is never mistaken for a project */
export const SHARE_FORMAT = "mcq-slide-studio/project";
/** bump when the bundle's own shape changes (the deck keeps its own schema) */
export const SHARE_VERSION = 1;
/** what the sender downloads and the recipient opens with “Open” */
export const SHARE_FILE_EXTENSION = ".mcqdeck";
/** hash key of the link: `https://editor/#share=…` */
export const SHARE_HASH_KEY = "share";
/** MIME used for the downloaded file */
export const SHARE_MIME = "application/vnd.mcq-slide-studio.project+json";

/**
 * A link longer than this is likely to be truncated by a chat app, a QR
 * printer or an e-mail client. We still offer it (browsers cope with far more)
 * but point the sender at the file instead.
 */
export const LINK_SAFE_CHARS = 60_000;
/** above this we do not pretend a link is practical: the file is the way */
export const LINK_MAX_CHARS = 250_000;
/** hard ceilings so a hand-made link cannot exhaust the page while decoding */
const MAX_TOKEN_CHARS = 4_000_000;
const MAX_BUNDLE_BYTES = 96 * 1024 * 1024;

export interface ShareAsset {
  /** original file name, shown in the library after opening */
  name: string;
  /** MIME type of the stored bytes */
  mime: string;
  /** the bytes as a data URL (base64), ready to write back into a store */
  data: string;
}

export interface ShareBundle {
  format: typeof SHARE_FORMAT;
  version: number;
  /** the project name shown to the recipient before they open it */
  name: string;
  createdAt: number;
  /** slide the sender was looking at */
  currentSlide: number;
  deck: Deck;
  /** imageId → bitmap; the ids in the deck are remapped on import */
  assets: Record<string, ShareAsset>;
  /** custom fonts the deck uses (omitted when the link would grow too much) */
  fonts: CustomFont[];
}

export interface BuildShareOptions {
  name: string;
  currentSlide?: number;
  /** include the custom font files the deck uses (default true) */
  includeFonts?: boolean;
}

export interface ShareBuild {
  bundle: ShareBundle;
  /** the encoded project, without the `#share=` part */
  token: string;
  /** the full URL to send, when a page URL is available */
  link: string;
  /** false when the fonts were left out to keep the link short */
  withFonts: boolean;
  /** how many custom fonts the deck uses (included in the bundle / file) */
  fonts: number;
  /** how many of them the link had to leave out */
  fontsDropped: number;
  /** how many images are inside the bundle */
  images: number;
  /** image ids whose bytes were already gone before sharing */
  missingImages: string[];
  /** size of the uncompressed bundle JSON, in bytes */
  bytes: number;
  /** length of the full link */
  chars: number;
  /** true when even the file-free bundle is too long for a sane link */
  tooLong: boolean;
}

/** A share string that cannot be read. The message is user-facing. */
export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareLinkError";
  }
}

/* ------------------------------------------------------------ bytes → text */

/** Chunked so a multi-megabyte payload never blows the argument limit. */
function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** URL- and hash-safe base64 (`+` → `-`, `/` → `_`, no padding). */
function toBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const normal = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  return binaryToBytes(atob(padded));
}

/** Converts a stored Blob to a data URL (base64, not percent-encoded). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bytesToBinary(bytes))}`;
}

/* ------------------------------------------------------------ compression */

/** A one-chunk stream over `bytes` (Blob.stream is not available everywhere). */
function byteStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined" || typeof ReadableStream === "undefined") return null;
  try {
    const stream = (byteStream(bytes) as unknown as ReadableStream<Uint8Array>).pipeThrough(
      new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>,
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined" || typeof ReadableStream === "undefined") {
    throw new ShareLinkError("This browser cannot unpack shared links. Open it in an up-to-date browser.");
  }
  try {
    const stream = (byteStream(bytes) as unknown as ReadableStream<Uint8Array>).pipeThrough(
      new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>,
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new ShareLinkError("This share link is damaged or incomplete — copy the whole link again.");
  }
}

/* ------------------------------------------------------------------ scan --- */

/** Every value in a nested deck, so a font stack anywhere can be checked. */
function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, into));
  else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, into));
  return into;
}

/** The custom fonts whose family name appears anywhere in the deck. */
export function fontsUsedBy(deck: Deck): CustomFont[] {
  const haystack = collectStrings(deck).join("\n").toLowerCase();
  return listCustomFonts().filter((font) => {
    const family = String(font.family ?? "").trim().toLowerCase();
    return !!family && haystack.includes(family);
  });
}

/**
 * Any `blob:` URL still in the deck (a session URL that was not backed by an
 * imageId, e.g. an older import) is fetched and turned into a data URL, so the
 * copy keeps showing the picture on another device. Best-effort: a browser
 * that refuses the fetch leaves the string as it was.
 */
async function inlineBlobUrls(value: unknown): Promise<unknown> {
  if (typeof value === "string") {
    if (!value.startsWith("blob:")) return value;
    try {
      const blob = await (await fetch(value)).blob();
      return await blobToDataUrl(blob);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) out.push(await inlineBlobUrls(item));
    return out;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = await inlineBlobUrls(item);
    return out;
  }
  return value;
}

/** Ids of every image shape that points at the image store. */
function imageIdsIn(deck: Deck): string[] {
  const ids = new Set<string>();
  const collect = (shape: { kind?: string; imageId?: string } | undefined) => {
    if (shape?.kind === "image" && shape.imageId) ids.add(shape.imageId);
  };
  deck.slides.forEach((slide) => slide.shapes?.forEach(collect));
  deck.globalShapes?.forEach(collect);
  return [...ids];
}

/* -------------------------------------------------------------- building --- */

/**
 * Packages `deck` into a detached, portable bundle. The deck in the editor is
 * never modified: it is snapshotted through `prepareForStorage` first, and the
 * bitmap bytes are read from the image store by id.
 */
export async function buildShareBundle(
  deck: Deck,
  { name, currentSlide = 0, includeFonts = true }: BuildShareOptions,
): Promise<{ bundle: ShareBundle; images: number; missingImages: string[] }> {
  if (!deck || !Array.isArray(deck.slides)) throw new Error("This deck cannot be shared.");

  /** pictures that live as a data URL on the shape itself (older imports) */
  const inlineSrc = new Map<string, string>();
  const remember = (shape: { kind?: string; imageId?: string; src?: string } | undefined) => {
    // a data:/http(s) picture can travel in the deck itself; a leftover blob:
    // URL is a session-only address and is worthless on another device
    if (shape?.kind === "image" && shape.imageId && shape.src && !shape.src.startsWith("blob:")) {
      inlineSrc.set(shape.imageId, shape.src);
    }
  };
  deck.slides.forEach((slide) => slide.shapes?.forEach(remember));
  deck.globalShapes?.forEach(remember);

  // `prepareForStorage` first drops the session `blob:` src of every image that
  // has an id (its bytes are read from the store instead), so only the urls
  // that would otherwise be lost — backgrounds, id-less legacy images — are
  // fetched and inlined
  const portable = (await inlineBlobUrls(prepareForStorage(deck))) as Deck;
  const snapshot = JSON.parse(JSON.stringify(portable)) as Deck;

  const assets: Record<string, ShareAsset> = {};
  const missingImages: string[] = [];
  for (const id of imageIdsIn(snapshot)) {
    const record = await getImage(id);
    if (!record?.blob) {
      // no stored bytes: a data URL already on the shape still travels with
      // the deck, so the picture survives on the other side
      if (!inlineSrc.has(id)) missingImages.push(id);
      continue;
    }
    assets[id] = {
      name: record.filename || `${id}.png`,
      mime: record.mime || record.blob.type || "application/octet-stream",
      data: await blobToDataUrl(record.blob),
    };
  }

  // `prepareForStorage` emptied the src of every image with an id; put back
  // the ones whose bytes are not in `assets` so they are not lost
  const restore = (shape: { kind?: string; imageId?: string; src?: string }) => {
    if (shape.kind !== "image" || !shape.imageId || shape.src) return shape;
    if (assets[shape.imageId]) return shape;
    const src = inlineSrc.get(shape.imageId);
    return src ? { ...shape, src } : shape;
  };
  snapshot.slides = snapshot.slides.map((slide) =>
    slide.shapes ? { ...slide, shapes: slide.shapes.map(restore) as typeof slide.shapes } : slide,
  );
  if (snapshot.globalShapes) snapshot.globalShapes = snapshot.globalShapes.map(restore) as typeof snapshot.globalShapes;

  const maxSlide = Math.max(0, snapshot.slides.length - 1);
  const bundle: ShareBundle = {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    name: String(name ?? "").trim().slice(0, 80) || "Shared project",
    createdAt: Date.now(),
    currentSlide: Math.max(0, Math.min(maxSlide, Math.floor(Number(currentSlide) || 0))),
    deck: snapshot,
    assets,
    fonts: includeFonts ? fontsUsedBy(snapshot) : [],
  };
  return { bundle, images: Object.keys(assets).length, missingImages };
}

/** Encodes the bundle: `z` = gzipped, `j` = plain JSON (browser without streams). */
export async function encodeShareBundle(bundle: ShareBundle): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  const packed = await deflate(bytes);
  return packed ? `z${toBase64Url(packed)}` : `j${toBase64Url(bytes)}`;
}

/** Reads what a URL / hash / bare token carries, and returns only the token. */
export function readShareToken(href: string): string | null {
  const value = String(href ?? "").trim();
  if (!value) return null;
  const match = new RegExp(`[#&?]${SHARE_HASH_KEY}=([^&\\s]+)`).exec(value);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  // a bare token, as pasted into the dialog or handed to the link builder
  if (/^[zj][A-Za-z0-9\-_]+$/.test(value)) return value;
  return null;
}

/** Shape check shared by link decoding and `.mcqdeck` files. */
export function isShareBundle(value: unknown): value is ShareBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Partial<ShareBundle>;
  return (
    bundle.format === SHARE_FORMAT &&
    typeof bundle.version === "number" &&
    !!bundle.deck &&
    Array.isArray(bundle.deck.slides)
  );
}

function validate(bundle: unknown): ShareBundle {
  if (!isShareBundle(bundle)) throw new ShareLinkError("That link does not contain an editable project.");
  if (Number(bundle.version) > SHARE_VERSION) {
    throw new ShareLinkError("This project was shared from a newer version of the editor.");
  }
  const safe: ShareBundle = {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    name: String(bundle.name ?? "").trim().slice(0, 80) || "Shared project",
    createdAt: Number.isFinite(bundle.createdAt) ? Number(bundle.createdAt) : Date.now(),
    currentSlide: Number.isFinite(bundle.currentSlide) ? Number(bundle.currentSlide) : 0,
    deck: bundle.deck,
    assets: bundle.assets && typeof bundle.assets === "object" ? bundle.assets : {},
    fonts: Array.isArray(bundle.fonts) ? bundle.fonts : [],
  };
  if (!safe.deck.slides.length) throw new ShareLinkError("That shared project has no slides.");
  return safe;
}

/** Decodes a link, a hash, a bare token — anything a sender may hand over. */
export async function decodeShareBundle(input: string): Promise<ShareBundle> {
  const token = readShareToken(input) ?? (/^[zj][A-Za-z0-9\-_]+$/.test(String(input ?? "").trim()) ? String(input).trim() : "");
  if (!token) throw new ShareLinkError("This share link is missing its project data.");
  if (token.length > MAX_TOKEN_CHARS) throw new ShareLinkError("This share link is too large to open.");
  const mode = token.slice(0, 1);
  const body = token.slice(1);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(body);
  } catch {
    throw new ShareLinkError("This share link is incomplete — copy the whole link again.");
  }
  if (mode === "z") bytes = await inflate(bytes);
  else if (mode !== "j") throw new ShareLinkError("That link does not contain an editable project.");
  if (bytes.length > MAX_BUNDLE_BYTES) throw new ShareLinkError("This share link is too large to open.");
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ShareLinkError("This share link is damaged or incomplete — copy the whole link again.");
  }
  return validate(data);
}

/* ------------------------------------------------------------------ links --- */

/** The page the link points at, without any existing share data. */
export function shareBaseUrl(): string {
  if (typeof window === "undefined" || !window.location) return "";
  const { origin, pathname, search } = window.location;
  if (!origin || origin === "null") return "";
  return `${origin}${pathname}${search}`;
}

/** Builds the link for an encoded token; `""` when there is no page URL. */
export function shareLink(token: string, base = shareBaseUrl()): string {
  if (!base) return "";
  return `${base.split("#")[0]}#${SHARE_HASH_KEY}=${token}`;
}

/**
 * Builds the bundle, encodes it and decides whether the link is practical.
 * Fonts are dropped for the link when they are what pushes it past the limit;
 * the returned `bundle` is what “Download project file” should save.
 */
export async function buildShare(
  deck: Deck,
  opts: BuildShareOptions & { maxLinkChars?: number } = { name: "" },
): Promise<ShareBuild> {
  const maxLinkChars = opts.maxLinkChars ?? LINK_MAX_CHARS;
  // fonts are opt-in: the caller says the licence allows passing the file on
  const wantFonts = opts.includeFonts === true;
  let built = await buildShareBundle(deck, { ...opts, includeFonts: wantFonts });
  let token = await encodeShareBundle(built.bundle);
  let link = shareLink(token);
  let withFonts = wantFonts;
  const fonts = built.bundle.fonts.length;

  // a font file can dwarf the whole deck; the link is still useful without it
  if (link && link.length > maxLinkChars && built.bundle.fonts.length) {
    built = await buildShareBundle(deck, { ...opts, includeFonts: false });
    token = await encodeShareBundle(built.bundle);
    link = shareLink(token);
    withFonts = false;
  }

  return {
    bundle: built.bundle,
    token,
    link,
    withFonts,
    images: built.images,
    missingImages: built.missingImages,
    bytes: new TextEncoder().encode(JSON.stringify(built.bundle)).length,
    chars: link.length,
    tooLong: !!link && link.length > maxLinkChars,
    fonts,
    fontsDropped: withFonts ? 0 : fonts,
  };
}

/* ---------------------------------------------------------------- opening --- */

export interface InstalledShare {
  /** the deck with every image id remapped to this browser's store */
  deck: Deck;
  images: number;
  /** fonts registered (skipped when the recipient already has that family) */
  fonts: number;
  /** image ids whose bytes were missing from the bundle */
  missing: string[];
}

/**
 * Writes the bundle's bitmaps into this browser's image store, installs its
 * fonts and returns a deck that renders immediately.
 *
 * Every image is stored under a fresh id, so a shared deck can never collide
 * with (or overwrite) a picture the recipient already has. If the store refuses
 * the write, the fresh id still lives in its session fallback, and the deck is
 * pointed at that; nothing is silently dropped.
 */
export async function installShareBundle(bundle: ShareBundle): Promise<InstalledShare> {
  const safe = validate(bundle);
  const deck = JSON.parse(JSON.stringify(safe.deck)) as Deck;
  const remap = new Map<string, { id: string; src: string }>();
  const missing: string[] = [];

  for (const [oldId, asset] of Object.entries(safe.assets)) {
    if (!asset || typeof asset.data !== "string" || !asset.data.startsWith("data:")) continue;
    try {
      const blob = dataUrlToBlob(asset.data);
      const mime = asset.mime || blob.type || "image/png";
      const typed = blob.type === mime ? blob : new Blob([blob as BlobPart], { type: mime });
      const { id } = await saveImage(typed, { filename: asset.name || `${oldId}.png`, mime });
      const url = await objectUrlFor(id);
      remap.set(oldId, { id, src: url ?? asset.data });
    } catch {
      missing.push(oldId);
    }
  }

  const apply = (shape: { kind?: string; imageId?: string; src?: string }) => {
    if (shape.kind !== "image" || !shape.imageId) return shape;
    const hit = remap.get(shape.imageId);
    return hit ? { ...shape, imageId: hit.id, src: hit.src } : shape;
  };
  deck.slides = deck.slides.map((slide) =>
    slide.shapes ? { ...slide, shapes: slide.shapes.map(apply) as typeof slide.shapes } : slide,
  );
  if (deck.globalShapes) deck.globalShapes = deck.globalShapes.map(apply) as typeof deck.globalShapes;

  // the preview thumbnail of a bundle shows the assets from the bundle itself;
  // once installed, missing ones would render as empty placeholders
  if (missing.length) {
    const gone = new Set(missing);
    const clear = (shape: { kind?: string; imageId?: string; src?: string }) =>
      shape.kind === "image" && shape.imageId && gone.has(shape.imageId) ? { ...shape, src: "" } : shape;
    deck.slides = deck.slides.map((slide) =>
      slide.shapes ? { ...slide, shapes: slide.shapes.map(clear) as typeof slide.shapes } : slide,
    );
    if (deck.globalShapes) deck.globalShapes = deck.globalShapes.map(clear) as typeof deck.globalShapes;
  }

  let fonts = 0;
  const local = new Set(listCustomFonts().map((f) => String(f.family).trim().toLowerCase()));
  for (const font of safe.fonts) {
    const family = String(font?.family ?? "").trim();
    if (!family || !font.data || local.has(family.toLowerCase())) continue;
    try {
      await installCustomFont({ ...font, family, added: Date.now() });
      local.add(family.toLowerCase());
      fonts++;
    } catch {
      /* a font that cannot be registered is simply not installed */
    }
  }

  return { deck, images: remap.size, fonts, missing };
}

/**
 * The bundle's deck with its asset data URLs put straight onto the image
 * shapes — used only to draw the “open this?” preview, before anything is
 * written to the recipient's stores.
 */
export function previewDeck(bundle: ShareBundle): Deck {
  const deck = JSON.parse(JSON.stringify(bundle.deck)) as Deck;
  const byId = new Map(Object.entries(bundle.assets ?? {}).map(([id, asset]) => [id, asset?.data]));
  const apply = (shape: { kind?: string; imageId?: string; src?: string }) => {
    if (shape.kind !== "image" || !shape.imageId) return shape;
    const data = byId.get(shape.imageId);
    return data ? { ...shape, src: data } : shape;
  };
  deck.slides = deck.slides.map((slide) =>
    slide.shapes ? { ...slide, shapes: slide.shapes.map(apply) as typeof slide.shapes } : slide,
  );
  if (deck.globalShapes) deck.globalShapes = deck.globalShapes.map(apply) as typeof deck.globalShapes;
  return deck;
}

/* ------------------------------------------------------------------ files --- */

/** `My project.mcqdeck` — safe on every platform, keeps the name readable. */
export function shareFileName(name: string): string {
  const base = String(name ?? "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70) || "shared-project";
  return `${base}${SHARE_FILE_EXTENSION}`;
}

/** The `.mcqdeck` file's bytes. */
export function shareFileBlob(bundle: ShareBundle): Blob {
  return new Blob([JSON.stringify(bundle)], { type: SHARE_MIME });
}

/** Parses an opened `.mcqdeck` (or a JSON export that happens to be a bundle). */
export function parseShareFile(text: string): ShareBundle {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ShareLinkError("That file could not be read as a shared project.");
  }
  return validate(data);
}

/** True when a dropped/opened file is one of ours (by name — content is parsed later). */
export function isShareFileName(name: string): boolean {
  return /\.(mcqdeck|mcqshare)(\.json)?$/i.test(String(name ?? ""));
}

/** Human size for the dialog (“86 KB”). */
export function formatBytes(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
