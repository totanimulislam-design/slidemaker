import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic undo / redo history for an immutable state value.
 *
 * - `set(next, label, coalesceKey?)` records a snapshot. Consecutive calls
 *   sharing the same `coalesceKey` within `coalesceMs` are merged into ONE
 *   undo step, so a drag, a slider sweep or a typing burst undo at once.
 * - `undo()` / `redo()` move through the stack; `canUndo` / `canRedo` drive UI.
 * - The stack is bounded to `limit` entries.
 */

export interface HistoryEntry<T> {
  state: T;
  label: string;
  at: number;
}

interface Options {
  limit?: number;
  coalesceMs?: number;
}

export function useHistory<T>(initial: T | (() => T), { limit = 120, coalesceMs = 700 }: Options = {}) {
  const [present, setPresentState] = useState<T>(initial);
  const past = useRef<HistoryEntry<T>[]>([]);
  const future = useRef<HistoryEntry<T>[]>([]);
  const presentRef = useRef<T>(present);
  const presentLabel = useRef<string>("Start");
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const set = useCallback(
    (updater: T | ((prev: T) => T), label = "Edit", coalesceKey?: string) => {
      const prev = presentRef.current;
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      if (Object.is(next, prev)) return;

      const now = Date.now();
      const merge =
        !!coalesceKey && lastKey.current?.key === coalesceKey && now - lastKey.current.at < coalesceMs;

      if (!merge) {
        past.current.push({ state: prev, label: presentLabel.current, at: now });
        if (past.current.length > limit) past.current.shift();
        future.current = [];
      }
      lastKey.current = coalesceKey ? { key: coalesceKey, at: now } : null;
      presentLabel.current = label;
      presentRef.current = next;
      setPresentState(next);
    },
    [coalesceMs, limit],
  );

  /** replaces the present without recording history (e.g. initial load) */
  const replace = useCallback((next: T) => {
    presentRef.current = next;
    setPresentState(next);
  }, []);

  const undo = useCallback(() => {
    const entry = past.current.pop();
    if (!entry) return;
    future.current.push({ state: presentRef.current, label: presentLabel.current, at: Date.now() });
    presentLabel.current = entry.label;
    presentRef.current = entry.state;
    lastKey.current = null;
    setPresentState(entry.state);
  }, []);

  const redo = useCallback(() => {
    const entry = future.current.pop();
    if (!entry) return;
    past.current.push({ state: presentRef.current, label: presentLabel.current, at: Date.now() });
    presentLabel.current = entry.label;
    presentRef.current = entry.state;
    lastKey.current = null;
    setPresentState(entry.state);
  }, []);

  /** jump to an absolute point: negative = steps back, positive = steps forward */
  const jump = useCallback(
    (steps: number) => {
      if (steps < 0) for (let i = 0; i < -steps; i++) undo();
      else for (let i = 0; i < steps; i++) redo();
      rerender();
    },
    [undo, redo],
  );

  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    lastKey.current = null;
    presentLabel.current = "Start";
    rerender();
  }, []);

  /** closes the current coalescing window so the next change is a new step */
  const commit = useCallback(() => {
    lastKey.current = null;
  }, []);

  return {
    present,
    set,
    replace,
    undo,
    redo,
    jump,
    clear,
    commit,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undoLabel: past.current.length ? presentLabel.current : null,
    redoLabel: future.current.length ? future.current[future.current.length - 1].label : null,
    pastEntries: past.current,
    futureEntries: future.current,
    presentLabel: presentLabel.current,
  };
}
