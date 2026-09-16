/**
 * Unit tests for the pointer state machine itself — the rules the whole editor
 * depends on. No rendering involved: the assertions are exactly the ones in the
 * bug report ("mouse movement alone MUST NOT move the shape" …).
 */
import { DragSession, DRAG_THRESHOLD_PX, isPrimaryPress } from "../src/lib/dragSession";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;

interface EvInit {
  x?: number;
  y?: number;
  buttons?: number;
  button?: number;
  pointerId?: number;
}

const ev = (type: string, i: EvInit = {}) =>
  new win.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: i.x ?? 0,
    clientY: i.y ?? 0,
    button: i.button ?? (type === "pointerdown" ? 0 : -1),
    buttons: i.buttons ?? (type === "pointerdown" ? 1 : 0),
    pointerId: i.pointerId ?? 1,
    pointerType: "mouse",
    isPrimary: true,
  });

function harness(threshold = DRAG_THRESHOLD_PX) {
  const writes: { x: number; y: number }[] = [];
  let starts = 0;
  let ends: boolean[] = [];
  const session = new DragSession({
    threshold,
    onStart: () => {
      starts++;
    },
    onMove: (e, s) => {
      // a well-behaved consumer only ever runs here
      if (!s.isDragging) throw new Error("onMove ran while isDragging === false");
      writes.push({ x: e.clientX - s.dragStartX, y: e.clientY - s.dragStartY });
    },
    onEnd: (moved) => {
      ends.push(moved);
    },
  });
  const target = document.createElement("div");
  const press = (i: EvInit = {}) => session.begin({ ...i, clientX: i.x ?? 0, clientY: i.y ?? 0, pointerId: i.pointerId ?? 1, button: i.button ?? 0, buttons: i.buttons ?? 1, currentTarget: target }, { x: 30, y: 40 });
  return { session, writes, starts: () => starts, ends: () => ends, press, reset: () => (ends = []) };
}

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

const cases: [string, () => [boolean, string?]][] = [];
const test = (name: string, fn: () => [boolean, string?]) => cases.push([name, fn]);

test("no listeners are bound before a pointer-down", () => {
  const h = harness();
  win.dispatchEvent(ev("pointermove", { x: 500, y: 500, buttons: 1 }));
  const ok = h.writes.length === 0;
  h.session.destroy();
  return [ok, `writes=${h.writes.length}`];
});

test("begin() arms the session but writes nothing", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  const ok = h.writes.length === 0 && h.session.state.isPointerDown && !h.session.state.isDragging;
  h.session.destroy();
  return [ok, `state=${JSON.stringify(h.session.state)}`];
});

test("begin() records the press point and the object position", () => {
  const h = harness();
  h.press({ x: 123, y: 45 });
  const s = h.session.state;
  const ok = s.dragStartX === 123 && s.dragStartY === 45 && s.initialObjectX === 30 && s.initialObjectY === 40;
  h.session.destroy();
  return [ok, `${s.dragStartX},${s.dragStartY} / ${s.initialObjectX},${s.initialObjectY}`];
});

test("movement below the threshold never starts a drag", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  for (const d of [0, 1, 2, 3, -3, 3]) win.dispatchEvent(ev("pointermove", { x: 100 + d, y: 100, buttons: 1 }));
  const ok = h.writes.length === 0 && h.starts() === 0 && !h.session.state.isDragging;
  h.session.destroy();
  return [ok, `writes=${h.writes.length} starts=${h.starts()}`];
});

test("movement past the threshold starts exactly one drag", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 104, y: 100, buttons: 1 }));
  win.dispatchEvent(ev("pointermove", { x: 144, y: 130, buttons: 1 }));
  const ok = h.starts() === 1 && h.writes.length === 2;
  h.session.destroy();
  return [ok, `starts=${h.starts()} writes=${h.writes.length}`];
});

test("pointer-up clears everything; later moves are inert", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 200, buttons: 1 }));
  const during = h.writes.length;
  win.dispatchEvent(ev("pointerup", { x: 200, y: 200 }));
  for (let i = 0; i < 10; i++) win.dispatchEvent(ev("pointermove", { x: 300 + i * 40, y: 400, buttons: 1 }));
  const s = h.session.state;
  const ok = s.isPointerDown === false && s.isDragging === false && h.writes.length === during && h.ends().join() === "true";
  h.session.destroy();
  return [ok, `state=${JSON.stringify(s)} writes=${h.writes.length} (during=${during}) ends=${JSON.stringify(h.ends())}`];
});

test("pointer-up without any movement reports a click, not a drag", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointerup", { x: 100, y: 100 }));
  return [h.ends().join() === "false" && h.writes.length === 0, `ends=${JSON.stringify(h.ends())}`];
});

test("pointercancel ends the gesture", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 100, buttons: 1 }));
  const during = h.writes.length;
  win.dispatchEvent(ev("pointercancel", { x: 200, y: 100 }));
  win.dispatchEvent(ev("pointermove", { x: 400, y: 100, buttons: 1 }));
  return [h.session.armed === false && h.writes.length === during, `writes=${h.writes.length}`];
});

test("a move that reports no button held ends the gesture instead of dragging", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 100, y: 100, buttons: 0 }));
  win.dispatchEvent(ev("pointermove", { x: 900, y: 900, buttons: 0 }));
  return [h.writes.length === 0 && h.session.armed === false, `writes=${h.writes.length} armed=${h.session.armed}`];
});

test("window blur ends the gesture (release lost outside the window)", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 200, buttons: 1 }));
  const during = h.writes.length;
  win.dispatchEvent(new win.Event("blur"));
  for (let i = 0; i < 5; i++) win.dispatchEvent(ev("pointermove", { x: 400 + i * 60, y: 200, buttons: 1 }));
  return [h.writes.length === during && h.session.state.isPointerDown === false, `during=${during} after=${h.writes.length}`];
});

test("tab hidden ends the gesture", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 200, buttons: 1 }));
  const during = h.writes.length;
  document.dispatchEvent(new win.Event("visibilitychange"));
  win.dispatchEvent(ev("pointermove", { x: 700, y: 700, buttons: 1 }));
  return [h.writes.length === during, `during=${during} after=${h.writes.length}`];
});

test("pointerleave with no button held ends the gesture", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  h.session.handleLeave({ pointerId: 1, buttons: 0 });
  win.dispatchEvent(ev("pointermove", { x: 500, y: 500, buttons: 1 }));
  return [h.writes.length === 0 && !h.session.armed, `writes=${h.writes.length}`];
});

test("pointerleave while the button is held keeps the drag alive", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  h.session.handleLeave({ pointerId: 1, buttons: 1 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 160, buttons: 1 }));
  return [h.writes.length === 1, `writes=${h.writes.length}`];
});

test("a second pointer id can never hijack the gesture", () => {
  const h = harness();
  h.press({ x: 100, y: 100, pointerId: 1 });
  for (let i = 0; i < 6; i++) win.dispatchEvent(ev("pointermove", { x: 100 + i * 80, y: 100, buttons: 1, pointerId: 2 }));
  return [h.writes.length === 0 && !h.session.state.isDragging, `writes=${h.writes.length}`];
});

test("a second pointer-up does not end the first pointer's drag", () => {
  const h = harness();
  h.press({ x: 100, y: 100, pointerId: 1 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 100, buttons: 1, pointerId: 1 }));
  const during = h.writes.length;
  win.dispatchEvent(ev("pointerup", { x: 200, y: 100, pointerId: 2 }));
  win.dispatchEvent(ev("pointermove", { x: 300, y: 100, buttons: 1, pointerId: 1 }));
  return [h.session.dragging && h.writes.length === during + 1, `during=${during} after=${h.writes.length}`];
});

test("begin() while a gesture is armed replaces it, never stacks", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 200, buttons: 1 }));
  h.press({ x: 900, y: 900 });
  win.dispatchEvent(ev("pointermove", { x: 905, y: 900, buttons: 1 }));
  // only the new gesture's writes may appear after re-arming
  const last = h.writes[h.writes.length - 1];
  return [!!last && last.x === 5 && h.session.state.dragStartX === 900, `last=${JSON.stringify(last)} start=${h.session.state.dragStartX}`];
});

test("destroy() unbinds and leaves no live gesture", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 300, y: 300, buttons: 1 }));
  h.session.destroy();
  const during = h.writes.length;
  win.dispatchEvent(ev("pointermove", { x: 700, y: 700, buttons: 1 }));
  return [h.writes.length === during && h.session.armed === false, `writes=${h.writes.length}`];
});

test("end() is idempotent", () => {
  const h = harness();
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 200, y: 200, buttons: 1 }));
  win.dispatchEvent(ev("pointerup", { x: 200, y: 200 }));
  h.reset();
  h.session.end();
  h.session.end();
  h.session.cancel();
  return [h.ends().length === 0, `onEnd calls=${h.ends().length}`];
});

test("isPrimaryPress accepts only a left-button press", () => {
  const ok =
    isPrimaryPress({ button: 0, buttons: 1 }) === true &&
    isPrimaryPress({ button: 2, buttons: 2 }) === false &&
    isPrimaryPress({ button: 1, buttons: 4 }) === false &&
    isPrimaryPress({ button: 0, buttons: 0 }) === false;
  return [ok];
});

test("threshold is configurable", () => {
  const h = harness(10);
  h.press({ x: 100, y: 100 });
  win.dispatchEvent(ev("pointermove", { x: 106, y: 106, buttons: 1 })); // 8.4px < 10
  const below = h.writes.length;
  win.dispatchEvent(ev("pointermove", { x: 112, y: 100, buttons: 1 })); // 12px > 10
  return [below === 0 && h.writes.length === 1, `below=${below} total=${h.writes.length}`];
});

export function runSessionTests(): CaseResult[] {
  const out: CaseResult[] = [];
  for (const [name, fn] of cases) {
    try {
      const [pass, detail] = fn();
      out.push({ name, pass, detail: detail ?? "" });
    } catch (err) {
      out.push({ name, pass: false, detail: String((err as Error)?.message ?? err) });
    }
  }
  return out;
}
