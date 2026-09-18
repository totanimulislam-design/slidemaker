/**
 * Where an uploaded PDF / PowerPoint is actually kept.
 *
 * A document in the Uploads library stays a document: the library itself keeps
 * only its metadata (name, page count, a cover picture) in localStorage next to
 * the pictures, while the file's own bytes live here. IndexedDB is the home for
 * blobs — localStorage, where the deck lives, would blow its few-megabyte quota
 * on the first real PDF.
 *
 * Where IndexedDB is unavailable (jsdom in the tests, a browser with it
 * switched off, a storage write that is refused) the bytes are held in memory
 * for the session instead, and `saveDoc` resolves `false` so the caller can
 * tell the user that this one will not survive a reload.
 */

const DB_NAME = "slidemaker-uploads";
const DB_VERSION = 1;
const STORE = "documents";

/** session-only fallback for the bytes */
const memory = new Map<string, Blob>();

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

/** any IDB request, read only for its result */
type AnyRequest = { result: unknown };

/** One transaction against the document store; `ok` is false when it could not run. */
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
export function docStoreKind(): "indexeddb" | "memory" {
  return typeof indexedDB !== "undefined" && !!indexedDB ? "indexeddb" : "memory";
}

/**
 * A short content fingerprint of a file, so uploading the same document again
 * is recognised (and a different file that merely shares its name is not).
 * FNV-1a over the bytes, mixed with a second lane and the length; above 4 MB
 * every 8th byte is sampled so a large PDF still hashes in a few milliseconds.
 */
export async function fileFingerprint(file: Blob): Promise<string> {
  let buf: Uint8Array;
  try {
    buf = new Uint8Array(await file.arrayBuffer());
  } catch {
    return `size-${file.size}`;
  }
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  const step = buf.length > 4_000_000 ? 8 : 1;
  for (let i = 0; i < buf.length; i += step) {
    a = Math.imul(a ^ buf[i], 0x01000193) >>> 0;
    b = Math.imul(b + buf[i] + i, 0x85ebca6b) >>> 0;
  }
  return `${buf.length.toString(36)}-${a.toString(36)}-${b.toString(36)}`;
}

/** Keeps the bytes under `id`. Resolves `true` only when IndexedDB really has them. */
export async function saveDoc(id: string, blob: Blob): Promise<boolean> {
  const { ok } = await tx("readwrite", (s) => s.put(blob, id));
  if (!ok) memory.set(id, blob);
  return ok;
}

/** The bytes stored under `id`, or null when they are gone. */
export async function loadDoc(id: string): Promise<Blob | null> {
  const { ok, value } = await tx<Blob>("readonly", (s) => s.get(id));
  if (ok && value) return value;
  return memory.get(id) ?? null;
}

/** Drops the bytes — called when the upload is deleted from the library. */
export async function deleteDoc(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (s) => s.delete(id));
}
