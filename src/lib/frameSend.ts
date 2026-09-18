import { useCallback, useEffect, useRef } from "react";

/**
 * The one-frame commit channel behind every colour drag.
 *
 * Picking a colour re-renders the whole editor, so a gesture that told the
 * editor on every `pointermove` would spend its life inside React renders and
 * the indicator would trail the cursor. The channel fixes the budget instead:
 *
 *   - `offer(v)` — the newest value wins; ONE animation frame later the latest
 *     value is handed over, whatever the event rate was. A sweep across a
 *     hundred moves is a single write.
 *   - `sendNow(v)` — hand a value over immediately (a press must not wait for
 *     a frame).
 *   - `flush()` — hand over whatever is still pending right now (the end of a
 *     gesture settles what its last move is still holding).
 *
 * The pointer-facing indicator is NEVER routed through here — it paints itself
 * straight into the DOM in the event that moved it. Only the document (the
 * deck write, and with it the live preview on the slide) waits for the frame.
 *
 * ## backpressure
 *
 * One write per frame is only free while a frame is actually free. A deck with
 * a dozen live slides spends longer in one commit than a frame lasts, and then
 * "every frame" means the main thread has no gap left for the next pointer
 * event — which is exactly the latency a picker is judged by, since the pointer
 * is the only thing the user is watching. So the channel measures how long an
 * offered value had to WAIT for its frame:
 *
 *   - a value that got its frame inside `lateFrameMs` is a page keeping up:
 *     commit on every frame, as before;
 *   - a value that had to wait longer means the frame was already eaten — hand
 *     that frame back to the pointer and commit on the next one instead.
 *
 * Never more than ONE skip in a row, so the document rate under load is ~30Hz
 * rather than unbounded deferral: still live, still smooth, and a third of a
 * frame cheaper for the cursor per write. `sendNow` and `flush` (a press and a
 * release) always commit immediately, whatever the pressure — a click is a
 * decision, not a preview.
 *
 * "Late" is measured against the frame the page is actually running on, not
 * against an absolute: the channel keeps the shortest wait it has seen (which
 * is the display's own cadence) and calls a frame late only once a wait clears
 * it by a wide margin. A 30 Hz laptop, a 120 Hz one and a throttled background
 * tab therefore all get one write per frame, and only a frame that work ate —
 * while fast frames are demonstrably available — costs a write.
 */
export interface FrameSendOptions {
  /** a wait longer than this means the frame was already spent (default 26ms) */
  lateFrameMs?: number;
}

/** the clock the browser itself runs on; `Date.now` where there is none */
const clock = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

export function useFrameSend<T>(send: (v: T) => void, { lateFrameMs = 26 }: FrameSendOptions = {}) {
  /** the newest value the editor has not been told about yet */
  const pending = useRef<T | null>(null);
  /** the frame that will tell it */
  const frame = useRef<number | null>(null);
  /** when the current frame was asked for — its wait is the pressure signal */
  const askedAt = useRef(0);
  /** a frame has already been given back, so the next one commits come what may */
  const handedBack = useRef(false);
  /** the quickest wait seen this gesture ≈ the display's own frame time */
  const cadence = useRef(0);
  /** latest `send` — the flush must not close over a stale setter */
  const sendRef = useRef(send);
  sendRef.current = send;

  const flush = useCallback((): boolean => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    handedBack.current = false;
    cadence.current = 0; // a settled gesture starts its measurement fresh
    const v = pending.current;
    if (v === null) return false;
    pending.current = null;
    sendRef.current(v);
    return true;
  }, []);

  const tick = useCallback(() => {
    frame.current = null;
    const v = pending.current;
    if (v === null) return;
    const wait = clock() - askedAt.current;
    // never let a slow sample set the floor, or a page that is only ever busy
    // would declare itself busy by definition; a fast one always pulls it down
    cadence.current = cadence.current
      ? Math.min(cadence.current + 0.35, wait)
      : Math.min(wait, lateFrameMs);
    if (wait > Math.max(lateFrameMs, cadence.current * 1.75) && !handedBack.current) {
      // the frame we waited for was already over — do not spend the next one on
      // a write the pointer still needs; commit on the frame after it
      handedBack.current = true;
      askedAt.current = clock();
      frame.current = requestAnimationFrame(tick);
      return;
    }
    handedBack.current = false;
    pending.current = null;
    sendRef.current(v);
  }, [lateFrameMs]);

  const offer = useCallback(
    (v: T) => {
      pending.current = v;
      if (frame.current === null) {
        askedAt.current = clock();
        frame.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  const sendNow = useCallback(
    (v: T) => {
      pending.current = v;
      flush();
    },
    [flush],
  );

  const drop = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    handedBack.current = false;
    cadence.current = 0;
    pending.current = null;
  }, []);

  // a frame still waiting when the surface goes away must not fire into nothing
  useEffect(() => drop, [drop]);

  return { offer, sendNow, flush, drop };
}

/* ------------------------------------------------------------------ *
 * useColorFrame — the one-frame channel for a NATIVE colour picker.
 * ------------------------------------------------------------------ *
 * The in-app wheel (GradientWheel) never routes its pointer through React,
 * but every SOLID colour — a frame, an option bullet, a text ink — is picked
 * with the browser's own `<input type="color">`. That dialog is a Canva-style
 * surface too: for such an input React maps BOTH the native `input` (one per
 * move of the cursor through its saturation field) AND the native `change`
 * (the dialog closing) onto `onChange`, so the handler runs on every step.
 * Committing on every step re-renders the whole deck (board + every rail
 * thumbnail) once per move, the main thread fills with React, and the OS
 * indicator falls behind the cursor — the exact trailing-handle symptom people
 * report. This channel gives those events the discipline the wheel already has:
 *
 *   - `offer(hex)` — a move (or the close). The newest value wins; ONE
 *     animation frame later the latest value is committed, whatever the event
 *     rate. The cursor in the OS dialog is compositor-owned and unaffected;
 *     our side does at most one deck write per frame — a sweep is a handful of
 *     writes instead of one per step — and the last colour lands on the next
 *     frame after the dialog is let go, nothing left pending beyond it.
 *   - `flush()` / `drop()` — a pending value is settled exactly once when the
 *     picker unmounts, and a frame still queued when it goes away is cancelled
 *     so it cannot fire into nothing.
 *
 * The visible swatch is painted straight into the DOM inside the move handler
 * by the caller (so the glyph the user is looking at follows the dialog in the
 * same event), and only the deck write waits for the frame — exactly the split
 * the wheel uses between its indicator and its document.
 */
export function useColorFrame(onCommit: (v: string) => void) {
  /** the newest value the editor has not yet committed in a frame */
  const valueRef = useRef<string | null>(null);
  /** the frame that will commit it, if one is on the way */
  const frameRef = useRef<number | null>(null);
  /** latest onCommit — the frame must not close over a stale editor writer */
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  /** commit whatever is pending right now (idempotent) */
  const settle = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const v = valueRef.current;
    if (v !== null) {
      valueRef.current = null;
      onCommitRef.current(v);
    }
  }, []);

  /** a move or a close: newest wins, one commit per frame */
  const offer = useCallback(
    (hex: string) => {
      valueRef.current = hex;
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          const v = valueRef.current;
          if (v !== null) {
            valueRef.current = null;
            onCommitRef.current(v);
          }
        });
      }
    },
    [],
  );

  const flush = useCallback(() => settle(), [settle]);

  /** exactly-once settle + cancel a queued frame, on unmount */
  const drop = useCallback(() => settle(), [settle]);

  // a frame still queued when the picker goes away must not fire into nothing
  useEffect(() => drop, [drop]);

  return { offer, flush, drop };
}
