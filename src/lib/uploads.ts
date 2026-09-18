import { useSyncExternalStore } from "react";
import { deleteDoc, fileFingerprint, loadDoc, saveDoc } from "./docStore";
import type { ShapeItem } from "./shapes";
import type { Deck } from "./types";

export type UploadedDocKind = "pdf" | "pptx";

/**
 * An uploaded PDF / PowerPoint, kept in the library as the document itself —
 * NOT as one picture per page. The bytes live in lib/docStore (IndexedDB); the
 * library holds this metadata plus a cover picture of the first page, which is
 * what the tile in the panel shows.
 */
export interface UploadedDoc {
  kind: UploadedDocKind;
  mime: string;
  /** page (PDF) / slide (PPTX) count — 0 when the file could not be read */
  pages: number;
  bytes: number;
  /** content fingerprint — how the same document is recognised on re-upload */
  hash: string;
  /** false when the bytes only live in memory, so this entry dies with the tab */
  persisted: boolean;
}

export interface UploadedItem {
  id: string;
  /** a picture's own data URL; for a document, the small cover picture of page 1 */
  src: string;
  ratio: number;
  name?: string;
  createdAt: number;
  /** present when the entry is a saved PDF / PowerPoint rather than a picture */
  doc?: UploadedDoc;
}

const STORAGE_KEY = "mcq-slide-studio-uploads-v1";

let listeners: Array<() => void> = [];
let currentUploads: UploadedItem[] = loadFromStorage();

function loadFromStorage(): UploadedItem[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.src === "string")
          .map((item) => ({
            ...item,
            // a document entry from an older build (or a hand-edited store) is
            // treated as a plain picture rather than trusted blindly
            doc:
              item.doc && (item.doc.kind === "pdf" || item.doc.kind === "pptx")
                ? {
                    kind: item.doc.kind,
                    mime: typeof item.doc.mime === "string" ? item.doc.mime : "",
                    pages: Number.isFinite(item.doc.pages) ? item.doc.pages : 0,
                    bytes: Number.isFinite(item.doc.bytes) ? item.doc.bytes : 0,
                    hash: typeof item.doc.hash === "string" ? item.doc.hash : "",
                    persisted: item.doc.persisted !== false,
                  }
                : undefined,
          }));
      }
    }
  } catch (err) {
    console.warn("Failed to load uploads from storage:", err);
  }
  return [];
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUploads));
    }
  } catch (err) {
    console.warn("Failed to persist uploads to storage:", err);
  }
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (err) {
      console.error(err);
    }
  }
}

export function subscribeUploads(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getUploads(): UploadedItem[] {
  return currentUploads;
}

export function useUploads(): UploadedItem[] {
  return useSyncExternalStore(subscribeUploads, getUploads, () => []);
}

const newId = () => `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function addUpload(src: string, ratio = 1, name?: string): UploadedItem {
  if (!src) {
    throw new Error("Image src is required");
  }

  const cleanRatio = Number.isFinite(ratio) && ratio > 0 ? Math.round(ratio * 1000) / 1000 : 1;

  // Deduplicate by src: move to top if existing
  const existingIdx = currentUploads.findIndex((u) => u.src === src);
  if (existingIdx !== -1) {
    const existing = currentUploads[existingIdx];
    const updated: UploadedItem = {
      ...existing,
      ratio: cleanRatio,
      name: name && name !== "Image" && name !== "Slide image" ? name : existing.name,
      createdAt: Date.now(),
    };
    currentUploads = [updated, ...currentUploads.filter((_, i) => i !== existingIdx)];
    persist();
    return updated;
  }

  const newItem: UploadedItem = {
    id: newId(),
    src,
    ratio: cleanRatio,
    name: name || "Uploaded image",
    createdAt: Date.now(),
  };

  currentUploads = [newItem, ...currentUploads];
  persist();
  return newItem;
}

/* --------------------------------------------------------------- documents --- */

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** A document that could not be previewed still gets a legible tile. */
function docCover(kind: UploadedDocKind): string {
  const label = kind === "pdf" ? "PDF" : "PPTX";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">` +
    `<rect x="4" y="4" width="56" height="72" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>` +
    `<rect x="14" y="20" width="36" height="4" rx="2" fill="#cbd5e1"/>` +
    `<rect x="14" y="30" width="28" height="4" rx="2" fill="#cbd5e1"/>` +
    `<text x="32" y="62" font-family="system-ui,sans-serif" font-size="15" font-weight="700" ` +
    `text-anchor="middle" fill="#e11d48">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Is this library entry a saved document (PDF / PowerPoint) rather than a picture? */
export const isDocUpload = (item: UploadedItem): boolean => !!item.doc;

/**
 * Saves an uploaded PDF / PowerPoint to the library AS THE DOCUMENT ITSELF.
 *
 * One entry per file, holding the file's own bytes (lib/docStore) plus a cover
 * picture and the page count. Nothing is rasterised into the library: the
 * pages a user picks later are added to the deck, never stored here as
 * separate pictures. Uploading the same file again moves the entry to the top.
 */
export async function addDocumentUpload(
  file: File,
  meta: { pages?: number; cover?: string; ratio?: number } = {},
): Promise<UploadedItem> {
  const pptx = /\.pptx$/i.test(file.name) || file.type === PPTX_MIME;
  const kind: UploadedDocKind = pptx ? "pptx" : "pdf";
  const mime = pptx ? PPTX_MIME : "application/pdf";
  const pages = Number.isFinite(meta.pages) ? Math.max(0, Math.round(meta.pages ?? 0)) : 0;
  const hash = await fileFingerprint(file);

  // the same file again → the same entry, refreshed and moved to the top
  const existing = currentUploads.find((u) => u.doc && u.doc.hash === hash);
  const id = existing?.id ?? newId();
  const persisted = (await saveDoc(id, file)) || !!existing?.doc?.persisted;

  const item: UploadedItem = {
    id,
    src: meta.cover || existing?.src || docCover(kind),
    ratio: Number.isFinite(meta.ratio) && (meta.ratio ?? 0) > 0 ? meta.ratio! : (existing?.ratio ?? 1),
    name: file.name || (pptx ? "PowerPoint.pptx" : "Document.pdf"),
    createdAt: Date.now(),
    doc: {
      kind,
      mime,
      pages: pages || existing?.doc?.pages || 0,
      bytes: file.size,
      hash,
      persisted,
    },
  };

  currentUploads = [item, ...currentUploads.filter((u) => u.id !== id)];
  persist();
  return item;
}

/**
 * The stored document as a `File` again — what the page preview opens. Null
 * when the bytes are gone (evicted, or a session-only store after a reload).
 */
export async function documentAsFile(item: UploadedItem): Promise<File | null> {
  if (!item.doc) return null;
  const blob = await loadDoc(item.id);
  if (!blob) return null;
  const name = item.name || (item.doc.kind === "pptx" ? "deck.pptx" : "document.pdf");
  return new File([blob], name, { type: item.doc.mime });
}

export function removeUpload(id: string): void {
  const gone = currentUploads.find((u) => u.id === id);
  currentUploads = currentUploads.filter((u) => u.id !== id);
  persist();
  if (gone?.doc) void deleteDoc(id);
}

export function clearUploads(): void {
  const docs = currentUploads.filter((u) => u.doc).map((u) => u.id);
  currentUploads = [];
  persist();
  for (const id of docs) void deleteDoc(id);
}

/**
 * Ensures any images already placed on slides in the deck are indexed
 * in the user's Uploads library so they are easily reusable.
 *
 * A page of an imported PDF / PowerPoint is left out on purpose: the library
 * keeps that DOCUMENT (one entry, the file itself), so its pages are reached
 * through the document's preview instead of piling up as separate pictures.
 */
export function seedUploadsFromDeck(deck?: Deck | null): void {
  if (!deck) return;
  const found: { src: string; ratio: number; name?: string }[] = [];
  const check = (list?: ShapeItem[]) => {
    if (!list) return;
    for (const sh of list) {
      if (sh.kind === "image" && sh.src && !sh.importedPage) {
        found.push({
          src: sh.src,
          ratio: sh.naturalRatio || 1,
          name: sh.text || "Slide image",
        });
      }
    }
  };

  check(deck.globalShapes);
  if (Array.isArray(deck.slides)) {
    for (const s of deck.slides) {
      check(s.shapes);
    }
  }

  let added = false;
  for (const item of found) {
    if (!currentUploads.some((u) => u.src === item.src)) {
      currentUploads.push({
        id: newId(),
        src: item.src,
        ratio: item.ratio,
        name: item.name || "Slide image",
        createdAt: Date.now(),
      });
      added = true;
    }
  }

  if (added) {
    persist();
  }
}
