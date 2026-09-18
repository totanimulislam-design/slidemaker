/**
 * Colour picker suite (the Canva system).
 *
 * The picker behind every gradient (title background, slide background, shape
 * fill) is a full-width saturation / lightness area with a ring indicator, a
 * hue ramp under it, and the gradient editor's angle dial + stop bar beside
 * it. These tests pin the system that keeps every indicator GLUED to the
 * pointer rather than trailing it:
 *
 *   1. the indicator is where the pointer is — painted into the DOM in the
 *      very event that moved it, mid-sweep with no render in between, and it
 *      keeps following when the move is delivered somewhere else (a lost
 *      pointer capture, the pointer off the picker);
 *   2. the editor is told ONCE PER FRAME with the newest colour, so a sweep is
 *      a handful of deck writes instead of one per pointermove — and the press
 *      and the release always settle, so nothing is left uncommitted;
 *   3. nothing paints without a live gesture: a hover never does, a
 *      secondary-button press never does, a press on a stop knob never jumps
 *      it, and an echo of the picker's own colour that lands mid-drag cannot
 *      drag the indicator back.
 *
 * The last cases drive the surfaces through their real consumer,
 * GradientEditor, so the colour / angle / position is graded on what the
 * gradient — and therefore the deck — gets.
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColorWheel, GradientAngleWheel, hexToHsl, hslToHex } from "../src/components/GradientWheel";
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

/** the boxes the picker paints in, as laid out by the stubs below */
const AREA = { left: 100, top: 100, width: 260, height: 144 };
const RAMP = { left: 100, top: 252, width: 260, height: 14 };
const BAR = { left: 100, top: 300, width: 260, height: 32 };
const DIAL = { left: 420, top: 100, width: 148, height: 148 };

const box = (b: { left: number; top: number; width: number; height: number }) => ({
  ...b,
  right: b.left + b.width,
  bottom: b.top + b.height,
  x: b.left,
  y: b.top,
  toJSON: () => ({}),
}) as DOMRect;

/** the pointer point inside the S/L area for a saturation / lightness pair */
const areaPoint = (s: number, l: number) => ({
  x: AREA.left + (s / 100) * AREA.width,
  y: AREA.top + ((100 - l) / 100) * AREA.height,
});
/** the pointer point on the hue ramp for a hue */
const rampPoint = (h: number) => ({ x: RAMP.left + (h / 360) * RAMP.width, y: RAMP.top + RAMP.height / 2 });
/** the pointer point on the stop bar for an at% */
const barPoint = (at: number) => ({ x: BAR.left + (at / 100) * BAR.width, y: BAR.top + BAR.height / 2 });
/** the pointer point on the angle dial for a gradient angle (0° = up) */
const dialPoint = (deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: DIAL.left + 74 + 50 * Math.cos(a), y: DIAL.top + 74 + 50 * Math.sin(a) };
};

/** where the ring indicator must sit (local translate) for an s/l pair */
const dotAt = (s: number, l: number) => ({ x: (s / 100) * AREA.width, y: ((100 - l) / 100) * AREA.height });
/** where the hue knob must sit (local translate) for a hue */
const knobAt = (h: number) => ({ x: (h / 360) * RAMP.width, y: 0 });
/** where the dial knob must sit (local translate) for an angle */
const dialKnobAt = (deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: 74 + 62 * Math.cos(a) - 10, y: 74 + 62 * Math.sin(a) - 10 };
};

/** the local translate an indicator was painted at */
const tf = (el: HTMLElement | null) => {
  const m = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el?.style.transform ?? "");
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
};
const near = (v: number | undefined, want: number, tol = 0.6) => v !== undefined && Math.abs(v - want) <= tol;
const atTf = (el: HTMLElement | null, want: { x: number; y: number }, tol = 0.6) => {
  const p = tf(el);
  return !!p && near(p.x, want.x, tol) && near(p.y, want.y, tol);
};
const pos = (el: HTMLElement | null) => el?.style.transform ?? "(none)";
const leftPct = (el: HTMLElement | null) => el?.style.left ?? "(none)";

/* ---------------------------------- harnesses ------------------------------ */

/** everything the picker asked the editor for, in order */
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
  const dot = () => el("[data-wheel-marker]");
  const knob = () => el("[data-wheel-hue]");
  const area = () => el("[data-wheel-face]");
  const ramp = () => el("[data-wheel-hue-ramp]");

  /** jsdom has no layout: give every surface the box it paints in */
  const layOut = (scope: ParentNode) => {
    const pairs: [HTMLElement | null, DOMRect][] = [
      [scope.querySelector<HTMLElement>("[data-wheel-face]"), box(AREA)],
      [scope.querySelector<HTMLElement>("[data-wheel-hue-ramp]"), box(RAMP)],
      [scope.querySelector<HTMLElement>("[data-stop-bar]"), box(BAR)],
      [scope.querySelector<HTMLElement>("[data-angle-dial]"), box(DIAL)],
    ];
    for (const [node, b] of pairs) if (node) node.getBoundingClientRect = () => b;
  };
  layOut(host);

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
  /** one animation frame (two: the first is the one the picker asked for) */
  const frame = () =>
    act(async () => {
      await new Promise<void>((res) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => res())));
    });
  /** the editor applying a colour from outside the picker (a preset, an undo) */
  const fromOutside = (hex: string) => act(() => setEditorValue?.(hex));

  const out: CaseResult[] = [];
  const reset = () => {
    asked = [];
  };
  /** the picker starts each case on the same colour */
  const startAt = (hex: string) => {
    fromOutside(hex);
    reset();
  };

  startAt("#ff0000");

  /* ---------------------- a press is already a colour ---------------------- */

  const onArea = areaPoint(50, 50);
  fire(area()!, "pointerdown", onArea.x, onArea.y, 1);
  const pressed = asked.at(-1) ?? "";
  out.push({
    name: "a press picks the colour under the cursor, before the mouse moves",
    pass: pressed === hslToHex(0, 50, 50) && hexToHsl(pressed).s === 50 && hexToHsl(pressed).l === 50,
    detail: `asked=${pressed || "(nothing)"} want=${hslToHex(0, 50, 50)}`,
  });
  out.push({
    name: "…and the ring indicator already sits where the press landed",
    pass: atTf(dot(), dotAt(50, 50)),
    detail: `dot=${pos(dot())} want=${JSON.stringify(dotAt(50, 50))}`,
  });
  fire(win, "pointerup", onArea.x, onArea.y, 0);

  /* ------------------- the indicator follows every single move -------------- */

  startAt("#ff0000");
  const p0 = areaPoint(50, 50);
  fire(area()!, "pointerdown", p0.x, p0.y, 1);
  const moved = areaPoint(100, 100);
  fire(win, "pointermove", moved.x, moved.y, 1); // delivered to the window, not to the picker
  out.push({
    name: "the indicator follows a move the picker never sees (a lost pointer capture can't freeze it)",
    pass: atTf(dot(), dotAt(100, 100)),
    detail: `dot=${pos(dot())} want=${JSON.stringify(dotAt(100, 100))}`,
  });
  fire(win, "pointerup", moved.x, moved.y, 0);

  /* ------------- a sweep paints as it goes, then is ONE deck write ---------- */

  startAt("#ff0000");
  fire(area()!, "pointerdown", p0.x, p0.y, 1);
  await frame();
  reset();
  let end = p0;
  for (const s of [60, 70, 80, 90, 95, 25]) {
    end = areaPoint(s, 50);
    fire(win, "pointermove", end.x, end.y, 1);
    // THE anti-lag pin: with no frame and no render in between, the indicator
    // is already under the pointer — it never waits for React
    if (s === 90 && !atTf(dot(), dotAt(90, 50))) {
      out.push({
        name: "mid-sweep, with no render in between, the indicator is already at the newest pointer position",
        pass: false,
        detail: `dot=${pos(dot())} want=${JSON.stringify(dotAt(90, 50))}`,
      });
    }
  }
  const duringSweep = asked.length;
  const trackedLastMove = atTf(dot(), dotAt(25, 50));
  await frame();
  out.push({
    name: "a sweep across one frame tells the editor once, at the newest colour",
    pass: duringSweep === 0 && trackedLastMove && asked.length === 1 && asked[0] === hslToHex(0, 25, 50),
    detail: `during=${duringSweep} after=${asked.length} asked=${asked[0] ?? "-"} want=${hslToHex(0, 25, 50)} dot=${pos(dot())}`,
  });

  /* ------------------ the release settles what is pending ------------------ */

  reset();
  const last = areaPoint(75, 25);
  fire(win, "pointermove", last.x, last.y, 1);
  fire(win, "pointerup", last.x, last.y, 0);
  const settled = asked.at(-1) ?? "";
  await frame();
  out.push({
    name: "the release commits the colour the indicator is showing — even between two frames",
    pass: settled === hslToHex(0, 75, 25) && atTf(dot(), dotAt(75, 25)) && asked.length === 1,
    detail: `asked=${settled || "(nothing)"} want=${hslToHex(0, 75, 25)} calls=${asked.length}`,
  });

  /* ------------------- after the release nothing is live ------------------- */

  reset();
  const before = pos(dot());
  const over = areaPoint(40, 60);
  fire(area()!, "pointermove", over.x, over.y, 0);
  fire(win, "pointermove", over.x, over.y, 0);
  out.push({
    name: "a release outside the picker leaves nothing live: a hover never paints",
    pass: asked.length === 0 && pos(dot()) === before,
    detail: `asked=${asked.length} dot ${before} → ${pos(dot())}`,
  });

  /* ------------------ an echo landing mid-drag cannot yank it -------------- */

  defer = true;
  const drag0 = areaPoint(50, 50);
  fire(area()!, "pointerdown", drag0.x, drag0.y, 1);
  await frame(); // ← the editor has now been told the press colour
  const drag1 = areaPoint(80, 40);
  fire(win, "pointermove", drag1.x, drag1.y, 1);
  await frame(); // ← and now drag1; its echo is the one that arrives late
  const stale = deferred;
  const drag2 = areaPoint(20, 60);
  fire(win, "pointermove", drag2.x, drag2.y, 1);
  const heldAtDrag2 = atTf(dot(), dotAt(20, 60));
  fromOutside(stale ?? "#000000"); // the editor finally lands the previous frame's colour
  out.push({
    name: "an echo that lands mid-drag cannot drag the indicator back",
    pass: heldAtDrag2 && atTf(dot(), dotAt(20, 60)),
    detail: `at move=${heldAtDrag2} after echo ${stale} = ${pos(dot())} want=${JSON.stringify(dotAt(20, 60))}`,
  });
  defer = false;
  reset();
  fire(win, "pointerup", drag2.x, drag2.y, 0);
  out.push({
    name: "…and the colour the pointer left on is the one that is committed",
    pass: asked.at(-1) === hslToHex(0, 20, 60),
    detail: `asked=${asked.at(-1) ?? "(nothing)"} want=${hslToHex(0, 20, 60)}`,
  });

  /* ------------------- an outside colour still moves the picker ------------- */

  fromOutside("#0000ff");
  out.push({
    name: "a colour from outside (a preset, the hex field) still moves both indicators",
    pass: atTf(dot(), dotAt(100, 50)) && atTf(knob(), knobAt(240)),
    detail: `dot=${pos(dot())} knob=${pos(knob())} want ${JSON.stringify(dotAt(100, 50))}/${JSON.stringify(knobAt(240))}`,
  });

  /* ------------------- a secondary-button press is not a pick -------------- */

  reset();
  const beforeRight = pos(dot());
  const right = areaPoint(30, 30);
  fire(area()!, "pointerdown", right.x, right.y, 2, 2);
  fire(area()!, "pointermove", right.x, right.y, 2, 2);
  fire(win, "pointerup", right.x, right.y, 0, 2);
  fire(area()!, "pointermove", areaPoint(10, 90).x, areaPoint(10, 90).y, 0);
  out.push({
    name: "a secondary-button press picks nothing, and arms no gesture",
    pass: asked.length === 0 && pos(dot()) === beforeRight,
    detail: `asked=${asked.length} dot ${beforeRight} → ${pos(dot())}`,
  });

  /* ----------------------------- the hue ramp ------------------------------ */

  startAt("#ff0000");
  const onRamp = rampPoint(240);
  fire(ramp()!, "pointerdown", onRamp.x, onRamp.y, 1);
  const huePress = asked.at(-1) ?? "";
  out.push({
    name: "a press on the hue ramp is a colour at once, with the knob under the cursor",
    pass: huePress === hslToHex(240, 100, 50) && atTf(knob(), knobAt(240)),
    detail: `asked=${huePress || "(nothing)"} want=${hslToHex(240, 100, 50)} knob=${pos(knob())}`,
  });
  reset();
  const green = rampPoint(120);
  fire(win, "pointermove", green.x, green.y, 1);
  const hueMid = asked.length;
  await frame();
  out.push({
    name: "a hue sweep is one write per frame too",
    pass: hueMid === 0 && asked.length === 1 && asked[0] === hslToHex(120, 100, 50) && atTf(knob(), knobAt(120)),
    detail: `mid=${hueMid} asked=${asked[0] ?? "-"} want=${hslToHex(120, 100, 50)} knob=${pos(knob())}`,
  });
  fire(win, "pointerup", green.x, green.y, 0);

  /* ------------------ the real consumer, end to end ------------------------- */

  // The picker is only ever reached through GradientEditor (slide background,
  // title banner, shape fill …). Same gestures, but now graded on what the
  // gradient — and therefore the deck — actually receives: the stop colour from
  // the picker, the angle from the dial, the stop position from the bar.
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
  layOut(editorHost);
  const eEl = (sel: string) => editorHost.querySelector<HTMLElement>(sel);

  /* … the picker drives the selected stop … */
  const eDot = () => eEl("[data-wheel-marker]");
  const eArea = () => eEl("[data-wheel-face]")!;
  const grabArea = areaPoint(100, 50);
  fire(eArea(), "pointerdown", grabArea.x, grabArea.y, 1);
  const pressWrite = writes.length;
  const pressColour = editorNow.stops[0].color;
  writes = [];
  const sweepTo = areaPoint(25, 50);
  fire(win, "pointermove", sweepTo.x, sweepTo.y, 1);
  const midSweep = writes.length;
  await frame();
  const afterFrame = writes.length;
  fire(win, "pointerup", sweepTo.x, sweepTo.y, 0);
  out.push({
    name: "the gradient editor gets the picker's press at once, then one write per frame",
    pass: pressWrite === 1 && pressColour === hslToHex(0, 100, 50) && midSweep === 0 && afterFrame === 1,
    detail: `press=${pressWrite}/${pressColour} sweep=${midSweep} frame=${afterFrame}`,
  });
  out.push({
    name: "…and the colour the pointer left on is the gradient's colour",
    pass: editorNow.stops[0].color === hslToHex(0, 25, 50) && atTf(eDot(), dotAt(25, 50)),
    detail: `stop=${editorNow.stops[0].color} want=${hslToHex(0, 25, 50)} dot=${pos(eDot())}`,
  });

  /* … the angle dial … */
  writes = [];
  const eKnob = () => eEl("[data-angle-knob]");
  const dial = () => eEl("[data-angle-dial]")!;
  const grabDial = dialPoint(90);
  fire(dial(), "pointerdown", grabDial.x, grabDial.y, 1);
  const anglePress = editorNow.angle;
  writes = [];
  let sweptDial = grabDial;
  for (const deg of [120, 150, 180]) {
    sweptDial = dialPoint(deg);
    fire(win, "pointermove", sweptDial.x, sweptDial.y, 1);
  }
  const dialMid = writes.length;
  const dialKnobLive = atTf(eKnob(), dialKnobAt(180));
  await frame();
  const dialAfter = writes.length;
  fire(win, "pointerup", sweptDial.x, sweptDial.y, 0);
  out.push({
    name: "the dial's press is an angle at once, its sweep paints the knob live and is one write per frame",
    pass: anglePress === 90 && dialMid === 0 && dialKnobLive && dialAfter === 1 && editorNow.angle === 180,
    detail: `press=${anglePress} mid=${dialMid} knobLive=${dialKnobLive} (${pos(eKnob())}) frame=${dialAfter} angle=${editorNow.angle}`,
  });

  /* … the stop bar … */
  writes = [];
  const stopBar = () => eEl("[data-stop-bar]")!;
  const stopKnob = () => eEl('[data-stop-knob="0"]');
  const grabKnob = barPoint(0);
  fire(stopKnob()!, "pointerdown", grabKnob.x, grabKnob.y, 1);
  const grabbedWrites = writes.length; // a press grabs the knob — it never jumps
  const atPress = editorNow.stops[0].at;
  const dragBar = barPoint(50);
  fire(win, "pointermove", dragBar.x, dragBar.y, 1);
  const barMid = writes.length;
  const knobLive = leftPct(stopKnob()) === "50%";
  await frame();
  const barAfter = writes.length;
  fire(stopKnob()!, "pointerup", dragBar.x, dragBar.y, 0);
  await frame();
  out.push({
    name: "a press on a stop knob grabs it without moving it; the drag paints it live and is one write per frame",
    pass: grabbedWrites === 0 && atPress === 0 && barMid === 0 && knobLive && barAfter === 1 && editorNow.stops[0].at === 50,
    detail: `grab=${grabbedWrites} atPress=${atPress} mid=${barMid} left=${leftPct(stopKnob())} frame=${barAfter} at=${editorNow.stops[0].at}`,
  });
  out.push({
    name: "…and the release leaves the knob where the pointer left it",
    pass: leftPct(stopKnob()) === "50%" && editorNow.stops[0].at === 50,
    detail: `left=${leftPct(stopKnob())} at=${editorNow.stops[0].at}`,
  });

  out.push({ name: "no uncaught errors in the colour-picker suite", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    setEditorRoot?.unmount();
    root?.unmount();
  });
  editorHost.remove();
  return out;
}
