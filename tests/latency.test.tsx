/**
 * Colour-picker LATENCY suite — the "does it feel instant" half of the picker.
 *
 * `wheel.test.tsx` pins the *contract* (the indicator follows, one deck write
 * per frame, a release settles). This suite pins the *cost* of a drag: what a
 * gesture is allowed to touch between the pointer moving and the indicator
 * being where the pointer is — because that is exactly where a picker turns
 * laggy:
 *
 *   - a layout read inside a move is a forced synchronous reflow of the panel;
 *   - a render inside the move path means the indicator waits for React (and
 *     for the whole deck that the colour write drags along with it);
 *   - the colour area's gradient repainted on every event instead of once per
 *     frame is main-thread time the pointer needed;
 *   - a position rounded to whole percent steps the indicator in place — a
 *     cursor that visibly trails the mouse even on a machine at 60fps.
 *
 * No real browser is available in this environment, so every case counts the
 * work the browser would have to do, rather than wall-clock milliseconds.
 */
import { act, createElement, Profiler, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColorWheel, hslToHex } from "../src/components/GradientWheel";
import { useFrameSend } from "../src/lib/frameSend";
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

const AREA = { left: 100, top: 100, width: 260, height: 144 };
const RAMP = { left: 100, top: 252, width: 260, height: 14 };
const BAR = { left: 100, top: 300, width: 260, height: 32 };

const box = (b: { left: number; top: number; width: number; height: number }) => ({
  ...b,
  right: b.left + b.width,
  bottom: b.top + b.height,
  x: b.left,
  y: b.top,
  toJSON: () => ({}),
}) as DOMRect;

/** a point in the S/L area for a FRACTIONAL saturation / lightness pair */
const areaPointAt = (s: number, l: number) => ({
  x: AREA.left + s * AREA.width,
  y: AREA.top + (1 - l) * AREA.height,
});
/** a point on the hue ramp for a fractional hue */
const rampPointAt = (h: number) => ({ x: RAMP.left + h * RAMP.width, y: RAMP.top + RAMP.height / 2 });

/** the translate an indicator was painted at, in px inside its own surface */
const tf = (el: HTMLElement | null) => {
  const m = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el?.style.transform ?? "");
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
};

/* ------------------------------ instrumentation ---------------------------- */

/** counts the `getBoundingClientRect` calls a node answers, while switched on */
function spyRect(el: HTMLElement | null, b: DOMRect) {
  const state = { calls: 0, on: false };
  if (el) {
    el.getBoundingClientRect = () => {
      if (state.on) state.calls++;
      return b;
    };
  }
  return { state };
}

/**
 * Counts writes to ONE style property of ONE element, by standing a Proxy in
 * front of its CSSStyleDeclaration. The picker and React both write through
 * `el.style.prop = …`, so nothing escapes the count.
 */
function spyStyle(el: HTMLElement | null, prop: string) {
  const state = { writes: 0, on: false };
  if (!el) return { state };
  const real = el.style;
  const proxy = new Proxy(real, {
    set(target, key, value) {
      if (state.on && key === prop) state.writes++;
      (target as unknown as Record<string, unknown>)[key as string] = value;
      return true;
    },
  }) as CSSStyleDeclaration;
  Object.defineProperty(el, "style", { configurable: true, get: () => proxy });
  return { state };
}

/* ----------------------------------- suite --------------------------------- */

export async function runLatencyTests(): Promise<CaseResult[]> {
  const host = doc.getElementById("root")!;
  const out: CaseResult[] = [];

  const fire = (target: EventTarget, type: string, x: number, y: number, buttons: number, button = 0) => {
    act(() => {
      target.dispatchEvent(
        new win.PointerEvent(type, {
          bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons,
          pointerId: 1, pointerType: "mouse", isPrimary: true,
        }),
      );
    });
  };
  /** one animation frame (two: the first may be the one the picker asked for) */
  const frame = () =>
    act(async () => {
      await new Promise<void>((res) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => res())));
    });

  /* ------------------------------------------------------------------------ */
  /* the picker with an editor that can be told to stay out of the way         */
  /* ------------------------------------------------------------------------ */

  let commits = 0; // React commits of the picker subtree
  let asked: string[] = [];
  /** true = the editor takes the colour but does not echo a render back */
  let deferring = false;
  let push = (hex: string) => {};

  function Harness(): ReactNode {
    const [hex, setHex] = useState("#808080");
    push = (h: string) => setHex(h);
    return createElement(
      Profiler,
      { id: "wheel", onRender: () => commits++ },
      createElement(ColorWheel, {
        value: hex,
        onChange: (h: string) => {
          asked.push(h);
          if (!deferring) setHex(h);
        },
      }),
    );
  }

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(Harness));
  });

  const q = (sel: string) => host.querySelector<HTMLElement>(sel);
  const area = q("[data-wheel-face]")!;
  const ramp = q("[data-wheel-hue-ramp]")!;
  const dot = q("[data-wheel-marker]")!;

  const rectArea = spyRect(area, box(AREA));
  const rectRamp = spyRect(ramp, box(RAMP));
  const faceSpy = spyStyle(area, "background");

  const startAt = (hex: string) => {
    act(() => push(hex));
    asked = [];
    commits = 0;
    reset();
  };
  const reset = () => {
    rectArea.state.calls = 0;
    rectRamp.state.calls = 0;
    faceSpy.state.writes = 0;
  };
  const watching = (on: boolean) => {
    rectArea.state.on = on;
    rectRamp.state.on = on;
    faceSpy.state.on = on;
  };

  /* -------- 1. a move never goes back to the layout to find its box -------- */

  startAt("#808080");
  const pDown = areaPointAt(0.5, 0.5);
  fire(area, "pointerdown", pDown.x, pDown.y, 1); // the press may measure
  const measuredOnPress = rectArea.state.calls + rectRamp.state.calls;
  watching(true);
  for (let i = 0; i < 60; i++) {
    const p = areaPointAt((i % 50) / 50, (i % 33) / 33);
    fire(win, "pointermove", p.x, p.y, 1);
  }
  const layoutReadsDuringSweep = rectArea.state.calls + rectRamp.state.calls;
  watching(false);
  const pUp = areaPointAt(0.2, 0.7);
  fire(win, "pointerup", pUp.x, pUp.y, 0);
  out.push({
    name: "a 60-move sweep reads layout ZERO times (the surfaces are measured once per press)",
    pass: layoutReadsDuringSweep === 0 && measuredOnPress <= 4,
    detail: `${layoutReadsDuringSweep} getBoundingClientRect calls during 60 moves (${measuredOnPress} on the press)`,
  });

  /* ---------- 2. the indicator is UNDER the cursor, not somewhere near it -- */

  startAt("#808080");
  const q0 = areaPointAt(0.5, 0.5);
  fire(area, "pointerdown", q0.x, q0.y, 1);
  let worstOff = 0;
  let stuck = 0;
  let prevTf = "";
  // fractional pointer positions on purpose: a whole-percent indicator cannot
  // land under a fractional cursor, and it freezes for several events at a time
  for (let i = 1; i <= 40; i++) {
    const p = areaPointAt(i / 41, (i % 7) / 7);
    fire(win, "pointermove", p.x, p.y, 1);
    const at = tf(dot);
    if (!at) {
      worstOff = Infinity;
      break;
    }
    worstOff = Math.max(worstOff, Math.abs(at.x - (p.x - AREA.left)), Math.abs(at.y - (p.y - AREA.top)));
    const t = dot.style.transform;
    if (t === prevTf) stuck++;
    prevTf = t;
  }
  const q1 = areaPointAt(0.9, 0.3);
  fire(win, "pointerup", q1.x, q1.y, 0);
  out.push({
    name: "the ring sits under the pointer on EVERY move — never a step away from it",
    pass: worstOff <= 0.75,
    detail: `worst offset ${worstOff === Infinity ? "(never painted)" : worstOff.toFixed(2)}px across a 260px area`,
  });
  out.push({
    name: "…and it moves on every single move (a frozen indicator is what a laggy picker looks like)",
    pass: stuck === 0,
    detail: `${stuck} of 40 moves left the indicator exactly where it was`,
  });

  /* --------------- 3. the gesture never passes through React --------------- */

  startAt("#808080");
  deferring = true; // the editor takes the colour, and does not re-render the picker
  const q2 = areaPointAt(0.5, 0.5);
  fire(area, "pointerdown", q2.x, q2.y, 1);
  await frame();
  commits = 0;
  for (let burst = 0; burst < 4; burst++) {
    for (let i = 0; i < 20; i++) {
      const p = areaPointAt((i + burst) / 40, 0.5);
      fire(win, "pointermove", p.x, p.y, 1);
    }
    await frame();
  }
  const rendersWhileDragging = commits;
  const q3 = areaPointAt(0.8, 0.2);
  fire(win, "pointerup", q3.x, q3.y, 0);
  deferring = false;
  out.push({
    name: "80 moves across four frames render the picker ZERO times (nothing between the cursor and the indicator)",
    pass: rendersWhileDragging === 0,
    detail: `${rendersWhileDragging} React commit(s) of the picker subtree while the pointer owned it`,
  });

  /* ------------- 4. the big face repaint is per frame, not per event ------- */

  startAt("#00ff00");
  faceSpy.state.on = true;
  const q4 = rampPointAt(0.2);
  fire(ramp, "pointerdown", q4.x, q4.y, 1);
  await frame();
  faceSpy.state.writes = 0;
  for (let burst = 0; burst < 3; burst++) {
    for (let i = 0; i < 15; i++) {
      const p = rampPointAt((i + burst * 15) / 60);
      fire(win, "pointermove", p.x, p.y, 1);
    }
    await frame();
  }
  const faceWritesIn3Frames = faceSpy.state.writes;
  const q5 = rampPointAt(0.7);
  fire(win, "pointerup", q5.x, q5.y, 0);
  await frame();
  faceSpy.state.on = false;
  out.push({
    name: "dragging the hue ramp repaints the colour area once per frame, not once per move",
    pass: faceWritesIn3Frames <= 4,
    detail: `${faceWritesIn3Frames} full-face background writes for 45 moves (45 = one per event; 3 = one per frame)`,
  });

  /* --------------- 5. the readouts are painted, not waited for ------------- */

  startAt("#808080");
  const hexInput = host.querySelector<HTMLInputElement>("input[spellcheck]")!;
  const before = hexInput.value;
  const q6 = areaPointAt(0.5, 0.5);
  fire(area, "pointerdown", q6.x, q6.y, 1);
  const q7 = areaPointAt(0.92, 0.41);
  fire(win, "pointermove", q7.x, q7.y, 1);
  const paintedHex = hexInput.value;
  fire(win, "pointerup", q7.x, q7.y, 0);
  const wantHex = hslToHex(0, 92, 41); // the colour under that pointer, at h 0
  out.push({
    name: "the hex box follows the pointer in the SAME event as the indicator (painted, not waited for)",
    pass: paintedHex === wantHex,
    detail: `${before} → ${paintedHex || "(unchanged)"} in the move event; want ${wantHex}`,
  });
  await frame();
  const settledHex = host.querySelector<HTMLInputElement>("input[spellcheck]")!.value;
  out.push({
    name: "…and when the pointer stops, React agrees with what was painted (no snap-back)",
    pass: settledHex === wantHex && settledHex === paintedHex,
    detail: `settled ${settledHex || "(empty)"}, painted ${paintedHex}, want ${wantHex}`,
  });

  /* ------------- 6. a slow deck costs the write, never the pointer --------- */

  // An editor that burns real CPU per commit, the way the live board does. The
  // frame after such a write is late, and a late frame must be handed back to
  // the pointer rather than spent on yet another deck write.
  let slowCommits = 0;
  const burn = () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 28) {
      /* the deck re-render, modelled */
    }
  };
  const slowHost = doc.createElement("div");
  doc.body.appendChild(slowHost);
  let slowEditor: Gradient = {
    enabled: true,
    type: "linear",
    angle: 0,
    stops: [{ color: "#ff0000", at: 0 }, { color: "#0000ff", at: 100 }],
  };
  function SlowHarness(): ReactNode {
    const [g, setG] = useState<Gradient>(slowEditor);
    slowEditor = g;
    return createElement(GradientEditor, {
      label: "Slow deck",
      value: g,
      fallback: "#000",
      onChange: (next: Gradient) => {
        slowCommits++;
        burn();
        setG(next);
      },
    });
  }
  let slowRoot: Root | null = null;
  act(() => {
    slowRoot = createRoot(slowHost);
    slowRoot.render(createElement(SlowHarness));
  });
  const sq = (sel: string) => slowHost.querySelector<HTMLElement>(sel);
  const sArea = sq("[data-wheel-face]")!;
  const sDot = () => sq("[data-wheel-marker]");
  sArea.getBoundingClientRect = () => box(AREA);
  sq("[data-wheel-hue-ramp]")!.getBoundingClientRect = () => box(RAMP);
  sq("[data-stop-bar]")!.getBoundingClientRect = () => box(BAR);

  slowCommits = 0;
  let paintedMoves = 0;
  let behind = false;
  let lastTf = "";
  const s0 = areaPointAt(0.4, 0.5);
  fire(sArea, "pointerdown", s0.x, s0.y, 1);
  for (let burst = 0; burst < 5; burst++) {
    for (let i = 0; i < 10; i++) {
      const p = areaPointAt((20 + burst * 10 + i) / 100, 0.5);
      fire(win, "pointermove", p.x, p.y, 1);
      const t = sDot()?.style.transform ?? "";
      if (t !== lastTf) {
        paintedMoves++;
        lastTf = t;
      }
      const at = tf(sDot());
      if (!at || Math.abs(at.x - (p.x - AREA.left)) > 0.75) behind = true;
    }
    await frame();
  }
  const s1 = areaPointAt(0.69, 0.5); // where the last move left the cursor
  fire(win, "pointermove", s1.x, s1.y, 1);
  fire(win, "pointerup", s1.x, s1.y, 0);
  const settledSlow = slowEditor.stops[0].color;
  await frame();
  out.push({
    name: "with a deck that burns ~28ms per write, the indicator still keeps up with every move",
    pass: paintedMoves === 50 && !behind,
    detail: `${paintedMoves}/50 moves painted a fresh position${behind ? " — and it fell behind the cursor" : ""}`,
  });
  out.push({
    name: "…and the drag still settles on the colour the pointer left on",
    pass: settledSlow === hslToHex(0, 69, 50),
    detail: `stop=${settledSlow} want=${hslToHex(0, 69, 50)} writes=${slowCommits}`,
  });

  /* ------------- 7. the frame channel gives a late frame back -------------- */

  // A deterministic drive of useFrameSend: the test owns the frame clock, so
  // "the frame was late" is a fact here rather than a race with this machine.
  const g = globalThis as unknown as Record<string, unknown>;
  const realRaf = g.requestAnimationFrame;
  const realCancel = g.cancelAnimationFrame;
  const perf = (g.performance ?? (win as unknown as { performance: Performance }).performance) as Performance;
  const realNowFn = perf.now.bind(perf);
  const realNow = () => realNowFn();
  const fake = { t: 0, queue: new Map<number, () => void>(), next: 1, requested: 0 };
  let seen = 0;
  const tick = (stepMs: number) => {
    fake.t += stepMs; // an OFFSET on the real clock: everyone stays monotonic
    const due = [...fake.queue.values()];
    fake.queue.clear();
    for (const cb of due) cb();
  };
  Object.defineProperty(g, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (cb: () => void) => {
      const id = fake.next++;
      fake.requested++;
      fake.queue.set(id, cb);
      return id;
    },
  });
  Object.defineProperty(g, "cancelAnimationFrame", { configurable: true, writable: true, value: (id: number) => void fake.queue.delete(id) });
  // only `now` is shifted: React's dev build wants the rest of `performance`
  Object.defineProperty(perf, "now", { configurable: true, writable: true, value: () => realNow() + fake.t });

  let api: { offer: (v: number) => void; flush: () => boolean; sendNow: (v: number) => void } | null = null;
  let last = -1;
  function FrameSendProbe(): ReactNode {
    api = useFrameSend((v: number) => {
      seen++;
      last = v;
    });
    return null;
  }
  const probeHost = doc.createElement("div");
  doc.body.appendChild(probeHost);
  let probeRoot: Root | null = null;
  act(() => {
    probeRoot = createRoot(probeHost);
    probeRoot.render(createElement(FrameSendProbe));
  });

  const channel = api!;
  seen = 0;
  for (let f = 0; f < 6; f++) {
    channel.offer(f);
    tick(16); // a cheap frame
  }
  const onCheapFrames = seen;
  seen = 0;
  for (let f = 0; f < 8; f++) {
    channel.offer(f);
    tick(60); // every frame the deck write ate
  }
  const onLateFrames = seen;
  const heldBack = last; // the newest value the document has actually seen
  seen = 0;
  channel.flush(); // a release settles whatever the skipping left pending
  const settledLatest = last;
  seen = 0;
  last = -1;
  channel.sendNow(99); // a press never waits for a frame, late or not
  const pressIsImmediate = seen === 1 && last === 99;
  seen = 0;
  for (let f = 0; f < 6; f++) {
    channel.offer(f);
    tick(33); // a steady 30Hz display with a page that keeps up
  }
  const onSlowDisplay = seen;
  seen = 0;
  for (let f = 0; f < 6; f++) {
    channel.offer(f);
    tick(f % 2 ? 44 : 15); // fast frames available, half of them eaten
  }
  const onJitteryFrames = seen;

  Object.defineProperty(g, "requestAnimationFrame", { configurable: true, writable: true, value: realRaf });
  Object.defineProperty(g, "cancelAnimationFrame", { configurable: true, writable: true, value: realCancel });
  Object.defineProperty(perf, "now", { configurable: true, writable: true, value: realNowFn });
  fake.queue.clear();

  out.push({
    name: "frame channel: one write per frame while frames are cheap",
    pass: onCheapFrames === 6,
    detail: `${onCheapFrames} writes for 6 cheap frames`,
  });
  out.push({
    name: "frame channel: when frames are late it hands frames back to the pointer (never more than one write per two)",
    pass: onLateFrames > 0 && onLateFrames <= 4,
    detail: `${onLateFrames} writes for 8 late frames`,
  });
  out.push({
    name: "…and a slow DISPLAY is not mistaken for a busy main thread (30Hz, keeping up = every frame written)",
    pass: onSlowDisplay === 6,
    detail: `${onSlowDisplay} writes for 6 steady 33ms frames`,
  });
  out.push({
    name: "…and it reacts to a frame being eaten, not to the average (fast frames available = the late ones are given back)",
    pass: onJitteryFrames > 0 && onJitteryFrames < 6,
    detail: `${onJitteryFrames} writes for 6 frames alternating 15ms / 44ms`,
  });
  out.push({
    name: "…and backpressure never swallows a colour: a press is immediate, a release settles what was held",
    pass: pressIsImmediate && settledLatest === 7 && heldBack <= 7,
    detail: `sendNow=${pressIsImmediate} newest committed before the release=${heldBack}, after=${settledLatest} (offered 7)`,
  });

  /* ------- 8. between two frames, the raw pointer stream still moves it ---- */

  // Chromium hands un-coalesced pointer samples to `pointerrawupdate`, and the
  // picker listens to that stream while a gesture is live — so the ring can
  // move sooner than the next frame is ready. The document still waits for its
  // frame, and when no gesture is live no stream moves anything.
  const realRaw = (win as unknown as Record<string, unknown>).onpointerrawupdate;
  Object.defineProperty(win, "onpointerrawupdate", { configurable: true, writable: true, value: null });

  startAt("#808080");
  const r0 = areaPointAt(0.3, 0.5);
  fire(area, "pointerdown", r0.x, r0.y, 1);
  const afterPress = asked.length;
  const rawAt = areaPointAt(0.63, 0.37);
  fire(win, "pointerrawupdate", rawAt.x, rawAt.y, 1);
  const at = tf(dot);
  const rawTracks =
    !!at && Math.abs(at.x - (rawAt.x - AREA.left)) <= 0.75 && Math.abs(at.y - (rawAt.y - AREA.top)) <= 0.75;
  const rawWroteImmediately = asked.length !== afterPress;
  await frame();
  const rawSettled = asked.length === afterPress + 1 && asked.at(-1) === hslToHex(0, 63, 37);
  fire(win, "pointerup", rawAt.x, rawAt.y, 0);
  const afterRelease = dot.style.transform;
  const idleRaw = areaPointAt(0.1, 0.1);
  fire(win, "pointerrawupdate", idleRaw.x, idleRaw.y, 0);
  out.push({
    name: "a raw (un-coalesced) pointer sample moves the ring between frames — and only paints",
    pass: rawTracks && !rawWroteImmediately && rawSettled,
    detail: `tracks=${rawTracks} painted@${at?.x.toFixed(1)}px want ${(rawAt.x - AREA.left).toFixed(1)}px, wrote-in-event=${rawWroteImmediately}, settled=${rawSettled}`,
  });
  out.push({
    name: "…and a raw sample after the release moves nothing (the stream is armed for one gesture only)",
    pass: dot.style.transform === afterRelease,
    detail: `${afterRelease} → ${dot.style.transform || "(cleared)"}`,
  });
  Object.defineProperty(win, "onpointerrawupdate", { configurable: true, writable: true, value: realRaw });

  /* ---------------------- 9. no arrow marker over the picker --------------- */

  const areaClass = area.getAttribute("class") ?? "";
  out.push({
    name: "the colour area shows the plain pointer — no crosshair / arrow marker over the picker",
    pass: !areaClass.includes("cursor-crosshair") && (area.style.cursor === "" || area.style.cursor === "default"),
    detail: `class says: ${/cursor-[\w-]+/.exec(areaClass)?.[0] ?? "(no cursor class)"}; inline: ${area.style.cursor || "(none)"}`,
  });

  /* --------------------------------- teardown ------------------------------ */

  watching(false);
  act(() => {
    probeRoot?.unmount();
    slowRoot?.unmount();
    root?.unmount();
  });
  slowHost.remove();
  probeHost.remove();

  return out;
}
