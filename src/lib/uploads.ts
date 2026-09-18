import { useSyncExternalStore } from "react";
import type { ShapeItem } from "./shapes";
import type { Deck } from "./types";

export interface UploadedItem {
  id: string;
  src: string;
  ratio: number;
  name?: string;
  createdAt: number;
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
        return parsed.filter((item) => item && typeof item.src === "string");
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
    id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    src,
    ratio: cleanRatio,
    name: name || "Uploaded image",
    createdAt: Date.now(),
  };

  currentUploads = [newItem, ...currentUploads];
  persist();
  return newItem;
}

export function removeUpload(id: string): void {
  currentUploads = currentUploads.filter((u) => u.id !== id);
  persist();
}

export function clearUploads(): void {
  currentUploads = [];
  persist();
}

/**
 * Ensures any images already placed on slides in the deck are indexed
 * in the user's Uploads library so they are easily reusable.
 */
export function seedUploadsFromDeck(deck?: Deck | null): void {
  if (!deck) return;
  const found: { src: string; ratio: number; name?: string }[] = [];
  const check = (list?: ShapeItem[]) => {
    if (!list) return;
    for (const sh of list) {
      if (sh.kind === "image" && sh.src) {
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
        id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
