/**
 * Colour picker suite.
 *
 * The wheel is the colour picker behind every gradient (title background,
 * slide background, shape fill…): a hue ring plus a saturation / lightness
 * square. These tests pin the three things that make it a picker rather than a
 * laggy preview of one:
 *
 *   1. the marker is where the pointer is — painted in the very event that
 *      moved it, and it keeps following when the move is delivered somewhere
 *      else (a lost pointer capture, the pointer off the wheel);
 *   2. the editor is told ONCE PER FRAME with the newest colour, so a sweep is
 *      a handful of deck writes instead of one per pointermove — and the press
 *      and the release always settle, so nothing is left uncommitted;
 *   3. nothing paints without a live gesture: a hover never does, a
 *      secondary-button press never does, and an echo of the wheel's own
 *      colour that lands mid-drag cannot drag the marker back.
 *
 * The last two cases drive the wheel through its real consumer, GradientEditor,
 * so the colour is graded on what the gradient — and therefore the deck — gets.
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColorWheel, hexToHsl, hslToHex } from "../src/components/GradientWheel";
import GradientEditor from "../src/components/GradientEditor";
import type { Gradient } from "../src/lib/types";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/* --------------------------------- geometry -------------------------------- */

/** where the 148px wheel sits in the test page, and what it is made of */
const SIZE = 148;
const R = SIZE / 2; // 74
const BAND = 16;
const SIDE = 74; // Math.round((r - band - 6) * √2)
const CENTRE = { x: 274, y: 174 };
const SQUARE = { left: CENTRE.x - SIDE / 2, top: CENTRE.y - SIDE / 2 };

const box = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
}) as DOMRect;

/** the point on the S/L square for a saturation / lightness pair */
const squarePoint = (s: number, l: number) => ({
  x: SQUARE.left + (s / 100) * SIDE,
  y: SQUARE.top + ((100 - l) / 100) * SIDE,
});
/** the point on the hue ring for a hue */
const ringPoint = (h: number) => {
  const a = ((h - 90) * Math.PI) / 180;
  return { x: CENTRE.x + (R - BAND / 2) * Math.cos(a), y: CENTRE.y + (R - BAND / 2) * Math.sin(a) };
};
/** where the square's marker must sit for a saturation / lightness pair */
const squareMarker = (s: number, l: number) => ({ left: (s / 100) * SIDE - 7, top: ((100 - l) / 100) * SIDE - 7 });
/** where the ring's marker must sit for a hue */
const hueMarker = (h: number) => {
  const a = ((h - 90) * Math.PI) / 180;
  return { left: R + (R - BAND / 2) * Math.cos(a) - 8, top: R + (R - BAND / 2) * Math.sin(a) - 8 };
};

const near = (px: string | undefined, want: number, tol = 0.6) => Math.abs(parseFloat(px ?? "NaN") - want) <= tol;
const at = (el: HTMLElement | null, want: { left: number; top: number }, tol = 0.6) =>
  !!el && near(el.style.left, want.left, tol) && near(el.style.top, want.top, tol);
const pos = (el: HTMLElement | null) => `${el?.style.left ?? "?"}/${el?.style.top ?? "?"}`;

/* ---------------------------------- the editor ----------------------------- */

/** everything the wheel asked the editor for, in order */
let asked: string[] = [];
/** a heavy editor: the colour is logged but only applied when the test says so */
let defer = false;
let deferred: string | null = null;
let setEditorValue: ((hex: string) => void) | null = null;

function Harness() {
  const [value, setValue] = useState("#ff0000");
  setEditorValue = setValue;
  return createElement(ColorWheel, {
    value,
    onChange: (hex: string) => {
      asked.push(hex);
      if (defer) deferred = hex;
      else setValue(hex);
    },
  });
}

export async function runWheelTests(): Promise<CaseResult[]> {
  const host = doc.getElementById("root")!;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(Harness));
  });

  const el = (sel: string) => host.querySelector<HTMLElement>(sel);
  const hueDot = () => el("[data-wheel-hue]");
  const sqDot = () => el("[data-wheel-marker]");
  const ring = () => hueDot()?.parentElement ?? null;
  const square = () => el("[data-wheel-face]");

  /** jsdom has no layout: give the wheel and its square the boxes they paint in */
  const layOut = () => {
    const r = ring();
    const f = square();
    if (r) r.getBoundingClientRect = () => box(CENTRE.x - R, CENTRE.y - R, SIZE, SIZE);
    if (f) f.getBoundingClientRect = () => box(SQUARE.left, SQUARE.top, SIDE, SIDE);
  };
  layOut();

  const fire = (target: EventTarget, type: string, x: number, y: number, buttons: number, button = 0) => {
    try {
      act(() => {
        target.dispatchEvent(
          new win.PointerEvent(type, {
            bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons,
            pointerId: 1, pointerType: "mouse", isPrimary: true,
          }),
        );
      });
    } catch (err) {
      // a handler that throws must not take the whole suite down with it
      errors.push(`${type}: ${(err as Error).message}`);
    }
  };
  /** one animation frame (two: the first is the one the wheel asked for) */
  const frame = () =>
    act(async () => {
      await new Promise<void>((res) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => res())));
    });
  /** the editor applying a colour from outside the wheel (a preset, an undo, a hex field) */
  const fromOutside = (hex: string) => act(() => setEditorValue?.(hex));

  const out: CaseResult[] = [];
  const reset = () => {
    asked = [];
  };
  /** the wheel starts each case on the same colour */
  const startAt = (hex: string) => {
    fromOutside(hex);
    reset();
  };

  startAt("#ff0000");

  /* ---------------------- a press is already a colour ---------------------- */

  const onRing = ringPoint(90);
  fire(ring()!, "pointerdown", onRing.x, onRing.y, 1);
  const pressed = asked.at(-1) ?? "";
  out.push({
    name: "a press picks the colour under the cursor, before the mouse moves",
    pass: pressed === hslToHex(90, 100, 50) && hexToHsl(pressed).h === 90,
    detail: `asked=${pressed || "(nothing)"} want=${hslToHex(90, 100, 50)}`,
  });
  out.push({
    name: "…and both markers already sit where the press landed",
    pass: at(hueDot(), hueMarker(90)) && at(sqDot(), squareMarker(100, 50)),
    detail: `hue=${pos(hueDot())} want=${JSON.stringify(hueMarker(90))} square=${pos(sqDot())} want=${JSON.stringify(squareMarker(100, 50))}`,
  });
  fire(win, "pointerup", onRing.x, onRing.y, 0);

  /* ------------------- the marker follows every single move ----------------- */

  startAt("#ff0000");
  const p0 = squarePoint(50, 50);
  fire(square()!, "pointerdown", p0.x, p0.y, 1);
  const moved = squarePoint(100, 100);
  fire(win, "pointermove", moved.x, moved.y, 1); // delivered to the window, not to the wheel
  out.push({
    name: "the marker follows a move the wheel never sees (a lost pointer capture can't freeze it)",
    pass: at(sqDot(), squareMarker(100, 100)),
    detail: `square=${pos(sqDot())} want=${JSON.stringify(squareMarker(100, 100))}`,
  });
  fire(win, "pointerup", moved.x, moved.y, 0);

  /* ------------------- one frame of moves is one deck write ---------------- */

  startAt("#ff0000");
  fire(square()!, "pointerdown", p0.x, p0.y, 1);
  await frame();
  reset();
  let end = p0;
  for (const s of [60, 70, 80, 90, 95, 25]) {
    end = squarePoint(s, 50);
    fire(win, "pointermove", end.x, end.y, 1);
  }
  const duringSweep = asked.length;
  const trackedLastMove = at(sqDot(), squareMarker(25, 50));
  await frame();
  out.push({
    name: "a sweep across one frame tells the editor once, at the newest colour",
    pass: duringSweep === 0 && trackedLastMove && asked.length === 1 && asked[0] === hslToHex(0, 25, 50),
    detail: `during=${duringSweep} after=${asked.length} asked=${asked[0] ?? "-"} want=${hslToHex(0, 25, 50)} marker=${pos(sqDot())}`,
  });

  /* ------------------ the release settles what is pending ------------------ */

  reset();
  const last = squarePoint(75, 25);
  fire(win, "pointermove", last.x, last.y, 1);
  fire(win, "pointerup", last.x, last.y, 0);
  const settled = asked.at(-1) ?? "";
  await frame();
  out.push({
    name: "the release commits the colour the marker is showing — even between two frames",
    pass: settled === hslToHex(0, 75, 25) && at(sqDot(), squareMarker(75, 25)) && asked.length === 1,
    detail: `asked=${settled || "(nothing)"} want=${hslToHex(0, 75, 25)} calls=${asked.length}`,
  });

  /* ------------------- after the release nothing is live ------------------- */

  reset();
  const before = pos(sqDot());
  const over = squarePoint(40, 60);
  fire(square()!, "pointermove", over.x, over.y, 0);
  fire(ring()!, "pointermove", 0, 0, 0);
  out.push({
    name: "a release outside the wheel leaves nothing live: a hover never paints",
    pass: asked.length === 0 && pos(sqDot()) === before,
    detail: `asked=${asked.length} marker ${before} → ${pos(sqDot())}`,
  });

  /* ------------------ an echo landing mid-drag cannot yank it -------------- */

  defer = true;
  const drag0 = squarePoint(50, 50);
  fire(square()!, "pointerdown", drag0.x, drag0.y, 1);
  await frame(); // ← the editor has now been told the press colour
  const drag1 = squarePoint(80, 40);
  fire(win, "pointermove", drag1.x, drag1.y, 1);
  await frame(); // ← and now drag1; its echo is the one that arrives late
  const stale = deferred;
  const drag2 = squarePoint(20, 60);
  fire(win, "pointermove", drag2.x, drag2.y, 1);
  const heldAtDrag2 = at(sqDot(), squareMarker(20, 60));
  fromOutside(stale ?? "#000000"); // the editor finally lands the previous frame's colour
  out.push({
    name: "an echo that lands mid-drag cannot drag the marker back",
    pass: heldAtDrag2 && at(sqDot(), squareMarker(20, 60)),
    detail: `at move=${heldAtDrag2} after echo ${stale} = ${pos(sqDot())} want=${JSON.stringify(squareMarker(20, 60))}`,
  });
  defer = false;
  reset();
  fire(win, "pointerup", drag2.x, drag2.y, 0);
  out.push({
    name: "…and the colour the pointer left on is the one that is committed",
    pass: asked.at(-1) === hslToHex(0, 20, 60),
    detail: `asked=${asked.at(-1) ?? "(nothing)"} want=${hslToHex(0, 20, 60)}`,
  });

  /* ------------------- an outside colour still moves the wheel -------------- */

  fromOutside("#0000ff");
  out.push({
    name: "a colour from outside (a preset, the hex field) still moves both markers",
    pass: at(hueDot(), hueMarker(240)) && at(sqDot(), squareMarker(100, 50)),
    detail: `hue=${pos(hueDot())} square=${pos(sqDot())} want ${JSON.stringify(hueMarker(240))}/${JSON.stringify(squareMarker(100, 50))}`,
  });

  /* ------------------- a secondary-button press is not a pick -------------- */

  reset();
  const beforeRight = pos(sqDot());
  const right = squarePoint(30, 30);
  fire(square()!, "pointerdown", right.x, right.y, 2, 2);
  fire(square()!, "pointermove", right.x, right.y, 2, 2);
  fire(win, "pointerup", right.x, right.y, 0, 2);
  fire(square()!, "pointermove", squarePoint(10, 90).x, squarePoint(10, 90).y, 0);
  out.push({
    name: "a secondary-button press picks nothing, and arms no gesture",
    pass: asked.length === 0 && pos(sqDot()) === beforeRight,
    detail: `asked=${asked.length} marker ${beforeRight} → ${pos(sqDot())}`,
  });

  /* ------------------ the real consumer, end to end ------------------------- */

  // The wheel is only ever reached through GradientEditor (slide background,
  // title banner, shape fill …). Same drag, but now graded on what the gradient
  // — and therefore the deck — actually receives.
  const editorHost = doc.createElement("div");
  doc.body.appendChild(editorHost);
  const START: Gradient = {
    enabled: true,
    type: "linear",
    angle: 0,
    stops: [{ color: "#ff0000", at: 0 }, { color: "#0000ff", at: 100 }],
  };
  let writes: string[] = [];
  let editorNow: Gradient = START;
  let setEditorRoot: Root | null = null;

  function EditorHarness() {
    const [g, setG] = useState<Gradient>(START);
    editorNow = g; // the gradient as the editor last rendered it
    return createElement(GradientEditor, {
      label: "Test gradient",
      value: g,
      fallback: "#000000",
      onChange: (next: Gradient) => {
        writes.push(next.stops[0].color);
        setG(next);
      },
    });
  }

  act(() => {
    setEditorRoot = createRoot(editorHost);
    setEditorRoot.render(createElement(EditorHarness));
  });
  const wheelIn = (sel: string) => editorHost.querySelector<HTMLElement>(sel);
  const editorRing = wheelIn("[data-wheel-hue]")?.parentElement ?? null;
  const editorSquare = wheelIn("[data-wheel-face]");
  if (editorRing) editorRing.getBoundingClientRect = () => box(CENTRE.x - R, CENTRE.y - R, SIZE, SIZE);
  if (editorSquare) editorSquare.getBoundingClientRect = () => box(SQUARE.left, SQUARE.top, SIDE, SIDE);

  const grab = ringPoint(210);
  fire(editorRing!, "pointerdown", grab.x, grab.y, 1);
  const pressWrite = writes.length;
  const pressColour = editorNow.stops[0].color;
  writes = [];
  let swept: { x: number; y: number } = grab;
  for (const h of [220, 230, 240, 250]) {
    swept = ringPoint(h);
    fire(win, "pointermove", swept.x, swept.y, 1);
  }
  const midSweep = writes.length;
  await frame();
  const afterFrame = writes.length;
  fire(win, "pointerup", swept.x, swept.y, 0);
  out.push({
    name: "the gradient editor gets the press at once, then one write per frame",
    pass: pressWrite === 1 && pressColour === hslToHex(210, 100, 50) && midSweep === 0 && afterFrame === 1,
    detail: `press=${pressWrite}/${pressColour} sweep=${midSweep} frame=${afterFrame}`,
  });
  out.push({
    name: "…and the colour the pointer left on is the gradient's colour",
    pass: editorNow.stops[0].color === hslToHex(250, 100, 50) && at(wheelIn("[data-wheel-marker]"), squareMarker(100, 50)),
    detail: `stop=${editorNow.stops[0].color} want=${hslToHex(250, 100, 50)}`,
  });
  act(() => setEditorRoot?.unmount());
  editorHost.remove();

  out.push({ name: "no uncaught errors in the colour-picker suite", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
