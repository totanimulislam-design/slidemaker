/**
 * Persistent image storage for the Slide Maker.
 *
 * Uploaded pictures are kept here as real `Blob`s in IndexedDB — never as
 * Base64 strings in localStorage, where a few photos can blow the ~5 MB quota
 * and silently kill the deck save (that is why images used to vanish after a
 * reload). The deck only stores a stable `imageId` on each image shape; the
 * bitmap bytes live here.
 *
 * Where IndexedDB is unavailable (jsdom in the test suite, a browser with it
 * switched off, or a refused write) the bytes are held in memory for the
 * session instead, and callers can tell the difference via `imageStoreKind()`.
 *
 * Rendering uses short-lived `blob:` URLs created on demand (`objectUrlFor`)
 * and cached for the session. They are revoked when the editor unmounts and
 * are never written to disk.
 */

import type { Deck } from "./types";
import type { ShapeItem } from "./shapes";

const DB_NAME = "slidemaker-images";
const DB_VERSION = 1;
const STORE = "images";

export interface ImageMeta {
  /** original file name */
  filename: string;
  /** MIME type of the file */
  mime?: string;
  /** natural width in px, when known */
  naturalWidth?: number;
  /** natural height in px, when known */
  naturalHeight?: number;
}

export interface ImageRecord {
  id: string;
  blob: Blob;
  filename: string;
  mime: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

/** session-only fallback for the bytes (IndexedDB unavailable) */
const memory = new Map<string, ImageRecord>();

/** cached session object URLs, imageId → blob: URL */
const urlCache = new Map<string, string>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  const idb = typeof indexedDB !== "undefined" ? indexedDB : null;
  if (!idb) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let req: IDBOpenDBRequest;
      try {
        req = idb.open(DB_NAME, DB_VERSION);
      } catch {
        return resolve(null);
      }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

type AnyRequest = { result: unknown };

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => AnyRequest,
): Promise<{ ok: boolean; value: T | null }> {
  const d = await openDb();
  if (!d) return { ok: false, value: null };
  try {
    return await new Promise<{ ok: boolean; value: T | null }>((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve({ ok: true, value: (req.result as T | undefined) ?? null });
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } catch {
    return { ok: false, value: null };
  }
}

/** `"indexeddb"` when the bytes can survive a reload, `"memory"` when they cannot. */
export function imageStoreKind(): "indexeddb" | "memory" {
  return typeof indexedDB !== "undefined" && !!indexedDB ? "indexeddb" : "memory";
}

const newId = () => `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Stores the bitmap under a stable id and returns that id.
 * Resolves `ok: false` when the write could not run (quota, unavailable…).
 */
export async function saveImage(
  blob: Blob,
  meta: ImageMeta,
): Promise<{ id: string; ok: boolean }> {
  const id = newId();
  const record: ImageRecord = {
    id,
    blob,
    filename: meta.filename,
    mime: meta.mime ?? "application/octet-stream",
    size: blob.size,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    naturalWidth: meta.naturalWidth,
    naturalHeight: meta.naturalHeight,
  };
  const { ok } = await tx("readwrite", (s) => s.put(record, id));
  if (!ok) memory.set(id, record);
  return { id, ok };
}

/** The stored record for `id`, or null when nothing is stored under it. */
export async function getImage(id: string): Promise<ImageRecord | null> {
  const { ok, value } = await tx<ImageRecord>("readonly", (s) => s.get(id));
  if (ok && value) return value;
  return memory.get(id) ?? null;
}

/** The stored blob for `id`, or null when it is gone. */
export async function getBlob(id: string): Promise<Blob | null> {
  const record = await getImage(id);
  return record?.blob ?? null;
}

/** Drops the stored bitmap for `id`. Safe to call when nothing references it. */
export async function deleteImage(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (s) => s.delete(id));
}

/**
 * A `blob:` URL for the stored image, created once per session and reused.
 * Returns null when the image is not stored (or storage is unavailable).
 */
export async function objectUrlFor(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getBlob(id);
  if (!blob) return null;
  try {
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/** Revokes the cached object URL for one image, if any. */
export async function revokeObjectUrl(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    urlCache.delete(id);
  }
}

/** Revokes every cached object URL — call when the editor unmounts. */
export async function revokeAllObjectUrls(): Promise<void> {
  for (const url of urlCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  urlCache.clear();
}

/* ------------------------------------------------------------- deck sync --- */

/**
 * Strips the render `src` from every image that is managed by this store,
 * keeping only the stable `imageId`. The live deck object is left untouched;
 * use this result for localStorage persistence and `.json` project exports.
 * Images without an `imageId` (legacy data URLs, external URLs) are kept as-is.
 */
export function prepareForStorage(deck: Deck): Deck {
  const strip = (s: ShapeItem): ShapeItem =>
    s.kind === "image" && s.imageId ? { ...s, src: "" } : s;
  return {
    ...deck,
    slides: deck.slides.map((s) =>
      s.shapes ? { ...s, shapes: s.shapes.map(strip) } : s,
    ),
    globalShapes: deck.globalShapes?.map(strip),
  };
}

/**
 * Finds every image shape in `deck` that carries an `imageId` but no render
 * `src` yet, and returns `(imageId, blob: URL)` pairs ready to be merged back
 * onto the live deck. Used on startup so a restore never clobbers edits the
 * user made while the blobs were loading.
 */
export async function collectImageUrlPairs(
  deck: Deck,
): Promise<[string, string][]> {
  const ids = new Set<string>();
  const collect = (s: ShapeItem | undefined) => {
    if (s?.kind === "image" && s.imageId && !s.src) ids.add(s.imageId);
  };
  deck.slides.forEach((s) => s.shapes?.forEach(collect));
  deck.globalShapes?.forEach(collect);
  if (!ids.size) return [];

  const pairs: [string, string][] = [];
  await Promise.all(
    [...ids].map(async (id) => {
      const url = await objectUrlFor(id);
      if (url) pairs.push([id, url]);
    }),
  );
  return pairs;
}

/**
 * Merges `(imageId, blob: URL)` pairs onto a deck: every image shape whose
 * `imageId` is in `pairs` and that still has no `src` gets its URL. Shapes
 * that were replaced or given a src in the meantime are left alone.
 */
export function applyImageUrlPairs(
  deck: Deck,
  pairs: [string, string][],
): Deck {
  const byId = new Map(pairs);
  const apply = (s: ShapeItem): ShapeItem =>
    s.kind === "image" &&
    s.imageId &&
    byId.has(s.imageId) &&
    !s.src
      ? { ...s, src: byId.get(s.imageId)! }
      : s;
  return {
    ...deck,
    slides: deck.slides.map((s) =>
      s.shapes ? { ...s, shapes: s.shapes.map(apply) } : s,
    ),
    globalShapes: deck.globalShapes?.map(apply),
  };
}

/**
 * Fully rehydrates a deck loaded from disk (or imported from a `.json` file):
 * every image with an `imageId` and no `src` gets a fresh object URL from
 * IndexedDB. Images whose blob is gone keep an empty `src` (they render as
 * the empty placeholder instead of crashing).
 */
export async function rehydrateImages(deck: Deck): Promise<Deck> {
  const ids = new Set<string>();
  const collect = (s: ShapeItem | undefined) => {
    if (s?.kind === "image" && s.imageId && !s.src) ids.add(s.imageId);
  };
  deck.slides.forEach((s) => s.shapes?.forEach(collect));
  deck.globalShapes?.forEach(collect);
  if (!ids.size) return deck;

  const urlById = new Map<string, string>();
  await Promise.all(
    [...ids].map(async (id) => {
      const url = await objectUrlFor(id);
      if (url) urlById.set(id, url);
    }),
  );

  const apply = (s: ShapeItem): ShapeItem =>
    s.kind === "image" && s.imageId && !s.src
      ? { ...s, src: urlById.get(s.imageId) ?? s.src }
      : s;
  return {
    ...deck,
    slides: deck.slides.map((s) =>
      s.shapes ? { ...s, shapes: s.shapes.map(apply) } : s,
    ),
    globalShapes: deck.globalShapes?.map(apply),
  };
}
