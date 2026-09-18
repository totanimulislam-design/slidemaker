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
 */
export function useFrameSend<T>(send: (v: T) => void) {
  /** the newest value the editor has not been told about yet */
  const pending = useRef<T | null>(null);
  /** the frame that will tell it */
  const frame = useRef<number | null>(null);
  /** latest `send` — the flush must not close over a stale setter */
  const sendRef = useRef(send);
  sendRef.current = send;

  const flush = useCallback((): boolean => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const v = pending.current;
    if (v === null) return false;
    pending.current = null;
    sendRef.current(v);
    return true;
  }, []);

  const offer = useCallback(
    (v: T) => {
      pending.current = v;
      if (frame.current === null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          flush();
        });
      }
    },
    [flush],
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
    pending.current = null;
  }, []);

  // a frame still waiting when the surface goes away must not fire into nothing
  useEffect(() => drop, [drop]);

  return { offer, sendNow, flush, drop };
}
