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
