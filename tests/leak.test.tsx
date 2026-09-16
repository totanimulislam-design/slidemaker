/**
 * Root-cause regression for “shapes move when the mouse just moves over them”.
 *
 * The pattern that caused it: pointer-down armed a gesture object, the ITEM's
 * own `onPointerMove` rewrote the position from that gesture, and only the
 * item's own `pointerup` cleared it. Miss that single event — release the button
 * outside the window, over another panel, or let the element be replaced under
 * the cursor — and the gesture outlives the press: from then on every hover
 * moves the shape.
 *
 * `LegacyBoard` reproduces that pattern; `SessionBoard` drives the same item
 * through `src/lib/dragSession.ts`. Both get an identical event sequence, and the
 * results must differ exactly the way the report demands.
 */
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DragSession, DRAG_THRESHOLD_PX } from "../src/lib/dragSession";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

interface Phase {
  hovering: boolean;
}
interface BoardProps {
  phase: Phase;
  onWrite: (phase: "drag" | "hover") => void;
}

const fire = (target: EventTarget, type: string, x: number, y: number, buttons: number) => {
  const ev = new win.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  act(() => {
    target.dispatchEvent(ev);
  });
};

/** press → two moves with the button down → released elsewhere → three hovers */
function sequence(host: HTMLElement, phase: Phase) {
  const el = host.firstElementChild as HTMLElement;
  phase.hovering = false;
  fire(el, "pointerdown", 300, 200, 1);
  fire(el, "pointermove", 380, 230, 1);
  fire(el, "pointermove", 460, 260, 1);
  fire(doc.body, "pointerup", 460, 260, 0); // the item never sees the release
  phase.hovering = true;
  fire(el, "pointermove", 300, 200, 0);
  fire(el, "pointermove", 420, 240, 0);
  fire(el, "pointermove", 540, 280, 0);
}

/* ------------------------------ legacy pattern ---------------------------- */

function LegacyBoard({ phase, onWrite }: BoardProps) {
  const gesture = useRef<{ dx: number } | null>(null);
  const [, bump] = useState(0);
  return createElement("div", {
    "data-legacy": "",
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      gesture.current = { dx: e.clientX }; // armed, and nothing marks it as "not dragging yet"
      bump((n) => n + 1);
    },
    // no isPointerDown flag, no threshold, no button check: a gesture object is
    // enough, so any leftover one keeps repainting the item
    onPointerMove: () => {
      if (!gesture.current) return;
      onWrite(phase.hovering ? "hover" : "drag");
    },
    onPointerUp: () => {
      gesture.current = null; // only this element's own pointerup clears it
    },
  });
}

/* ----------------------------- session pattern ---------------------------- */

function SessionBoard({ phase, onWrite }: BoardProps) {
  const sessionRef = useRef<DragSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new DragSession({
      threshold: DRAG_THRESHOLD_PX,
      // the ONLY write path, and the session calls it only while isDragging
      onMove: () => onWrite(phase.hovering ? "hover" : "drag"),
    });
  }
  const session = sessionRef.current;
  (globalThis as Record<string, unknown>).__session = session;
  return createElement("div", {
    "data-session": "",
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      session.begin(
        {
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
          button: e.button,
          buttons: e.buttons,
          currentTarget: e.currentTarget,
        },
        { x: 0, y: 0 },
      );
    },
    onPointerUp: () => session.end(),
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => session.handleLeave({ pointerId: e.pointerId, buttons: e.buttons }),
  });
}

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

async function measure(Board: (p: BoardProps) => React.ReactElement, host: HTMLElement) {
  const writes = { drag: 0, hover: 0 };
  const phase: Phase = { hovering: false };
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(Board as React.ComponentType<BoardProps>, { phase, onWrite: (p) => void writes[p]++ }));
  });
  sequence(host, phase);
  const session = (globalThis as Record<string, unknown>).__session as DragSession | undefined;
  delete (globalThis as Record<string, unknown>).__session;
  act(() => {
    root?.unmount();
  });
  return { writes, state: session ? { ...session.state } : undefined };
}

export async function runLeakTests(): Promise<CaseResult[]> {
  const host = doc.getElementById("root")!;
  const legacy = await measure(LegacyBoard, host);
  const session = await measure(SessionBoard, host);

  return [
    {
      name: "legacy pattern reproduces the bug: after a lost pointer-up, hovering still moves the item",
      pass: legacy.writes.drag > 0 && legacy.writes.hover > 0,
      detail: `drag writes=${legacy.writes.drag}, hover writes=${legacy.writes.hover}`,
    },
    {
      name: "drag session: the drag itself works",
      pass: session.writes.drag > 0,
      detail: `drag writes=${session.writes.drag}`,
    },
    {
      name: "drag session: hovering after that release moves nothing",
      pass: session.writes.hover === 0,
      detail: `hover writes=${session.writes.hover}`,
    },
    {
      name: "drag session: pointer state is fully reset afterwards",
      pass: !!session.state && session.state.isPointerDown === false && session.state.isDragging === false && session.state.pointerId === -1,
      detail: session.state ? JSON.stringify(session.state) : "no session",
    },
  ];
}
