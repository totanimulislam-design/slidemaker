import { useCallback, useEffect, useRef } from "react";

/**
 * The ONE pointer state machine behind every gesture on the slide board — deck
 * shapes, deck-generated elements, group frames, resize / rotate handles and the
 * rubber-band marquee all run through it, so nothing can move on its own.
 *
 * Rules it enforces, which the rest of the editor may therefore rely on:
 *
 *  1. Mouse movement NEVER moves anything. A gesture exists only after an
 *     explicit `begin()` from a pointer-down handler, and `begin()` writes no
 *     geometry at all — it only remembers where the press started.
 *  2. `onMove` runs ONLY while `isDragging === true`, and `isDragging` turns
 *     true only once the pointer has travelled past `threshold` px. A press
 *     that stays inside the threshold is a click: the object never moves.
 *  3. `pointerup`, `pointercancel`, `pointerleave`, lost pointer capture,
 *     window blur and a hidden tab ALL end the gesture. A release the browser
 *     never delivers to us (mouse let go outside the window, element removed
 *     mid-drag, alt-tab) therefore cannot leave a "live" gesture behind — that
 *     leak is exactly what made shapes follow the cursor.
 *  4. Belt and braces: any move event reporting that the primary button is no
 *     longer held ends the gesture instead of dragging.
 *
 * Pointer listeners are attached to the window only for the lifetime of one
 * armed gesture (that is what lets a drag continue outside the board). There is
 * no permanent global mousemove writing positions, and no hover / enter / leave
 * path touches an object's coordinates.
 */

/** Pixels the pointer must travel after pointer-down before a drag starts. */
export const DRAG_THRESHOLD_PX = 4;

/** Left button press only — every other button is a click, never a drag. */
export const isPrimaryPress = (e: { button?: number; buttons?: number }): boolean =>
  (e.button ?? 0) === 0 && (e.buttons ?? 1) !== 0;

/** Is the primary (left) button still physically down? */
const primaryHeld = (e: { buttons?: number }): boolean => ((e.buttons ?? 0) & 1) === 1;

export interface DragState {
  /** a pointer is pressed on the target and a drag may still start */
  isPointerDown: boolean;
  /** the pointer passed the threshold — geometry writes are allowed now */
  isDragging: boolean;
  pointerId: number;
  /** pointer position when the gesture was armed */
  dragStartX: number;
  dragStartY: number;
  /** object position when the gesture was armed, % of the board */
  initialObjectX: number;
  initialObjectY: number;
}

/** The subset of a pointer event the session needs, so React events fit too. */
export interface PointerLike {
  clientX: number;
  clientY: number;
  pointerId: number;
  button?: number;
  buttons?: number;
  currentTarget?: EventTarget | null;
  target?: EventTarget | null;
}

export interface DragHandlers {
  /** px of pointer travel required before a drag begins (default 4) */
  threshold?: number;
  /** evaluated on pointer-down, e.g. "editable and not locked" */
  enabled?: () => boolean;
  /** fired once, the instant the pointer crosses the threshold */
  onStart?: (e: PointerEvent, s: Readonly<DragState>) => void;
  /** fired for every accepted move — guaranteed to run only while dragging */
  onMove: (e: PointerEvent, s: Readonly<DragState>) => void;
  /** fired when the gesture ends; `moved` is true only if a real drag happened */
  onEnd?: (moved: boolean, e?: PointerEvent | Event) => void;
}

const IDLE: DragState = {
  isPointerDown: false,
  isDragging: false,
  pointerId: -1,
  dragStartX: 0,
  dragStartY: 0,
  initialObjectX: 0,
  initialObjectY: 0,
};

/**
 * Imperative core — framework free (needs only `window`), so it can be unit
 * tested directly. One instance owns exactly one gesture at a time.
 */
export class DragSession {
  readonly state: DragState = { ...IDLE };
  private bound = false;
  private captureTargets: Element[] = [];

  /**
   * Handlers may be passed directly (plain usage, tests) or as a getter (React,
   * where the handlers must be re-read on every event so an in-flight gesture
   * never runs on a stale closure).
   */
  constructor(handlers: DragHandlers | (() => DragHandlers)) {
    this.getHandlers = typeof handlers === "function" ? handlers : () => handlers;
  }

  private readonly getHandlers: () => DragHandlers;

  private get handlers(): DragHandlers {
    return this.getHandlers();
  }

  /** Bind the listeners for the lifetime of one gesture. */
  private attach() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("lostpointercapture", this.onLostCapture);
    window.addEventListener("blur", this.onInterrupt);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onInterrupt);
  }

  private detach() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("lostpointercapture", this.onLostCapture);
    window.removeEventListener("blur", this.onInterrupt);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onInterrupt);
  }

  /**
   * Arm a possible drag; call it from a pointer-DOWN handler only. Records the
   * press point and the object's current position, and touches nothing else.
   */
  begin(e: PointerLike, initial: { x: number; y: number } = { x: 0, y: 0 }) {
    if (this.state.isPointerDown) this.end(); // gestures never stack
    const s = this.state;
    s.isPointerDown = true;
    s.isDragging = false; // ← a press is NOT a drag
    s.pointerId = e.pointerId;
    s.dragStartX = e.clientX;
    s.dragStartY = e.clientY;
    s.initialObjectX = initial.x;
    s.initialObjectY = initial.y;
    // Keep events flowing when the pointer leaves the item; if capture is lost
    // the window listeners still drive the gesture. The painted child is
    // captured too, so outline-only hit areas keep the cursor while dragging.
    const wanted = [(e.currentTarget ?? null), (e.target ?? null)] as (Element | null)[];
    this.captureTargets = [];
    for (const el of wanted) {
      if (!el || typeof el.setPointerCapture !== "function" || this.captureTargets.includes(el)) continue;
      try {
        el.setPointerCapture(e.pointerId);
        this.captureTargets.push(el);
      } catch {
        /* capture unsupported — the window listeners drive the drag */
      }
    }
    this.attach();
  }

  /** armed = between pointer-down and pointer-up */
  get armed() {
    return this.state.isPointerDown;
  }

  get dragging() {
    return this.state.isDragging;
  }

  private onPointerMove = (e: PointerEvent) => {
    const s = this.state;
    if (!s.isPointerDown) return; // hover without a press: nothing happens, ever
    if (e.pointerId !== s.pointerId) return; // a second pointer never hijacks the gesture
    if (!primaryHeld(e)) {
      // button is up but its event never reached us: end, do not drag
      this.end();
      return;
    }
    if (!s.isDragging) {
      const dist = Math.hypot(e.clientX - s.dragStartX, e.clientY - s.dragStartY);
      if (dist < (this.handlers.threshold ?? DRAG_THRESHOLD_PX)) return; // still a click
      s.isDragging = true;
      this.handlers.onStart?.(e, s);
      if (!s.isDragging) {
        // onStart declined the gesture (e.g. the item became locked)
        this.end();
        return;
      }
    }
    // the only place a gesture may write geometry
    if (e.cancelable) e.preventDefault();
    this.handlers.onMove(e, s);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.state.pointerId !== -1 && e.pointerId !== this.state.pointerId) return;
    this.end(e);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.state.pointerId !== -1 && e.pointerId !== this.state.pointerId) return;
    this.end(e);
  };

  /**
   * The element holding the capture disappeared (React re-render, item
   * deleted). With the button still down the window listeners keep the gesture
   * alive; with no button held the gesture is over.
   */
  private onLostCapture = (e: Event) => {
    if (!this.state.isPointerDown) return;
    if (primaryHeld(e as PointerEvent)) return;
    this.end();
  };

  /** window blur / hidden tab: the release event may never arrive — drop it */
  private onInterrupt = () => {
    this.end();
  };

  /** A pointerleave on the item itself ends the gesture when nothing is held. */
  handleLeave(e: { pointerId?: number; buttons?: number }) {
    if (!this.state.isPointerDown) return;
    if (e.pointerId !== undefined && this.state.pointerId !== -1 && e.pointerId !== this.state.pointerId) return;
    if (primaryHeld(e)) return; // still held: the drag continues via the window listeners
    this.end();
  }

  /** End the gesture and clear every piece of pointer state. Idempotent. */
  end(e?: PointerEvent | Event) {
    const s = this.state;
    const wasActive = s.isPointerDown;
    const moved = s.isDragging;
    s.isPointerDown = false;
    s.isDragging = false;
    s.pointerId = IDLE.pointerId;
    s.dragStartX = 0;
    s.dragStartY = 0;
    s.initialObjectX = 0;
    s.initialObjectY = 0;
    const targets = this.captureTargets;
    this.captureTargets = [];
    this.detach();
    const pid = (e as PointerEvent | undefined)?.pointerId;
    if (typeof pid === "number") {
      for (const el of targets) {
        try {
          if (el.hasPointerCapture?.(pid)) el.releasePointerCapture(pid);
        } catch {
          /* the browser already released it on pointer-up */
        }
      }
    }
    if (wasActive) this.handlers.onEnd?.(moved, e);
  }

  /** Explicit abort (used by item-level pointerleave / cancel handlers). */
  cancel() {
    this.end();
  }

  destroy() {
    const s = this.state;
    const wasActive = s.isPointerDown;
    const moved = s.isDragging;
    s.isPointerDown = false;
    s.isDragging = false;
    s.pointerId = IDLE.pointerId;
    this.captureTargets = [];
    this.detach();
    if (wasActive && moved) this.handlers.onEnd?.(false);
  }
}

/**
 * React binding: one session per component instance, always torn down with it.
 * Handlers are read through a ref, so an in-flight gesture keeps working while
 * the board re-renders on every frame (a stale closure here would be fatal).
 */
export function usePointerDrag(handlers: DragHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const sessionRef = useRef<DragSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new DragSession(() => handlersRef.current);
  const session = sessionRef.current;

  useEffect(() => () => session.destroy(), [session]);

  /** arm a possible drag from a pointer-down handler; refuses non-left buttons */
  const begin = useCallback(
    (e: PointerLike, initial?: { x: number; y: number }) => {
      const h = handlersRef.current;
      if (h.enabled && !h.enabled()) return false;
      if (!isPrimaryPress(e)) return false;
      session.begin(e, initial);
      return true;
    },
    [session],
  );

  /** end the gesture now (item-level pointer-up / cancel / leave) */
  const end = useCallback(() => session.end(), [session]);
  const handleLeave = useCallback((e: { pointerId?: number; buttons?: number }) => session.handleLeave(e), [session]);

  return { begin, end, cancel: end, handleLeave, session, state: session.state };
}
