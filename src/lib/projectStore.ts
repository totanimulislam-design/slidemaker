/**
 * Named, editable slide projects saved in this browser.
 *
 * Project records live in IndexedDB rather than localStorage: a deck can be
 * much larger than localStorage's small quota. Image bitmaps remain in the
 * existing image store; a project stores their stable ids through
 * `prepareForStorage`, exactly like the editor's draft autosave.
 *
 * If IndexedDB is unavailable or refuses a write, a session-only memory store
 * keeps the feature usable. Save results report whether the write was durable
 * so the UI can tell the user when a project will not survive a reload.
 */

import { prepareForStorage } from "./imageStore";
import type { Deck } from "./types";

const DB_NAME = "slidemaker-projects";
const DB_VERSION = 1;
const STORE = "projects";

export interface SavedProject {
  id: string;
  name: string;
  deck: Deck;
  createdAt: number;
  updatedAt: number;
  /** the editor position to restore when the project is reopened */
  currentSlide: number;
}

export interface ProjectIdentity {
  id: string;
  name: string;
}

export interface SaveProjectInput {
  /** omit to create a new project; pass an id to update that project */
  id?: string;
  name: string;
  deck: Deck;
  currentSlide?: number;
}

export interface SaveProjectResult {
  project: SavedProject;
  /** false means the record is in the session-only fallback */
  persistent: boolean;
}

const memory = new Map<string, SavedProject>();
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
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
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
  const db = await openDb();
  if (!db) return { ok: false, value: null };
  try {
    return await new Promise<{ ok: boolean; value: T | null }>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve({ ok: true, value: (request.result as T | undefined) ?? null });
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    return { ok: false, value: null };
  }
}

export function projectStoreKind(): "indexeddb" | "memory" {
  return typeof indexedDB !== "undefined" && !!indexedDB ? "indexeddb" : "memory";
}

const newId = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through to the portable id */
  }
  return `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const cleanName = (name: string) => {
  const value = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!value) throw new Error("Give the project a name.");
  return value;
};

/**
 * A detached, JSON-safe snapshot. The editor uses immutable deck updates, but
 * cloning here also protects a saved project from any future incidental
 * mutation of the live deck.
 */
function snapshotDeck(deck: Deck): Deck {
  return JSON.parse(JSON.stringify(prepareForStorage(deck))) as Deck;
}

/** Used to detect unsaved differences without comparing render-only blob URLs. */
export function projectFingerprint(deck: Deck): string {
  return JSON.stringify(prepareForStorage(deck));
}

/** Newest record wins when a previous session fallback and IndexedDB both have a copy. */
const newest = (a: SavedProject | undefined, b: SavedProject | undefined) => {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
};

export async function listProjects(): Promise<SavedProject[]> {
  const { value } = await tx<SavedProject[]>("readonly", (store) => store.getAll());
  const byId = new Map<string, SavedProject>();
  for (const project of value ?? []) byId.set(project.id, project);
  for (const project of memory.values()) byId.set(project.id, newest(byId.get(project.id), project)!);
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export async function getProject(id: string): Promise<SavedProject | null> {
  const { value } = await tx<SavedProject>("readonly", (store) => store.get(id));
  return newest(value ?? undefined, memory.get(id)) ?? null;
}

export async function saveProject(input: SaveProjectInput): Promise<SaveProjectResult> {
  if (!input.deck || !Array.isArray(input.deck.slides)) throw new Error("This deck cannot be saved.");
  const id = input.id || newId();
  const previous = input.id ? await getProject(input.id) : null;
  const now = Date.now();
  const maxSlide = Math.max(0, input.deck.slides.length - 1);
  const requestedSlide = Number.isFinite(input.currentSlide) ? Math.floor(input.currentSlide!) : 0;
  const project: SavedProject = {
    id,
    name: cleanName(input.name),
    deck: snapshotDeck(input.deck),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    currentSlide: Math.max(0, Math.min(maxSlide, requestedSlide)),
  };

  const { ok } = await tx("readwrite", (store) => store.put(project));
  if (ok) memory.delete(id);
  else memory.set(id, project);
  return { project, persistent: ok };
}

export async function renameProject(id: string, name: string): Promise<SavedProject> {
  const previous = await getProject(id);
  if (!previous) throw new Error("That project no longer exists.");
  const project: SavedProject = { ...previous, name: cleanName(name), updatedAt: Date.now() };
  const { ok } = await tx("readwrite", (store) => store.put(project));
  if (ok) memory.delete(id);
  else memory.set(id, project);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (store) => store.delete(id));
}
