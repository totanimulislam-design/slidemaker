/**
 * Interaction tests for the slide editor's drag system.
 *
 * The contract under test (every case is a real pointer event sequence against
 * the components the editor renders — deck shapes included):
 *
 *   • mouse movement alone NEVER moves an item
 *   • hover / enter / leave NEVER move an item
 *   • a click only selects
 *   • a drag starts after pointer-down + movement past a small threshold
 *   • pointer-up / pointercancel / blur stop the drag instantly
 *   • after that, movement NEVER continues the drag
 *
 * Run with `npm run test:drag`.
 */
import { act, createElement, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import Slide, { type SlideField } from "../src/components/Slide";
import {
  DEFAULT_HEADER,
  DEFAULT_THEME,
  cloneLayout,
  type Box,
  type ElementId,
  type SlideData,
  type ThemeSettings,
} from "../src/lib/types";
import { makeShape, type ShapeItem } from "../src/lib/shapes";

/* ------------------------------- pointer api ------------------------------ */

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

interface Pt {
  x: number;
  y: number;
  buttons?: number;
  button?: number;
  pointerId?: number;
  altKey?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** dispatch one pointer event, flushing React work like a browser frame would */
function fire(target: EventTarget, type: string, p: Pt = { x: 0, y: 0 }) {
  const ev = new win.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: p.x,
    clientY: p.y,
    button: p.button ?? (type === "pointerdown" ? 0 : -1),
    buttons: p.buttons ?? (type === "pointerdown" ? 1 : 0),
    pointerId: p.pointerId ?? 1,
    pointerType: "mouse",
    isPrimary: true,
    altKey: !!p.altKey,
    shiftKey: !!p.shiftKey,
    ctrlKey: !!p.ctrlKey,
    metaKey: !!p.metaKey,
  });
  act(() => {
    target.dispatchEvent(ev);
  });
}

const asWin = win as unknown as EventTarget;
const down = (t: EventTarget, p: Pt) => fire(t, "pointerdown", { buttons: 1, ...p });
const up = (t: EventTarget, p: Pt) => fire(t, "pointerup", { buttons: 0, ...p });
/** a hover move: no button held */
const hover = (t: EventTarget, p: Pt) => fire(t, "pointermove", { buttons: 0, ...p });
/** a move while the left button is held */
const held = (t: EventTarget, p: Pt) => fire(t, "pointermove", { buttons: 1, ...p });

/** let React finish painting before the DOM is inspected */
const flush = () => act(() => {});

/** flush state changes the way a real browser frame would */
const clearWrites = () => act(() => api!.clearWrites());
const blurWindow = () => act(() => win.dispatchEvent(new Event("blur")));

const shapeEl = (id: string) => doc.querySelector(`[data-shape="${id}"]`) as HTMLElement;
const boardEl = () => doc.querySelector("[data-board]") as HTMLElement;
const elementEl = (id: ElementId) => doc.querySelector(`[data-el="${id}"]`) as HTMLElement;
const handles = () => Array.from(doc.querySelectorAll("[data-handle]")) as HTMLElement[];
const shapeHandle = (h: string) => doc.querySelector(`[data-shape] [data-handle="${h}"], [data-sel] [data-handle="${h}"]`) as HTMLElement;
const rotateHandle = () => doc.querySelector("[data-rotate]") as HTMLElement;

/** click a shape so its selection frame (handles) exists, then zero the counters */
function selectShape(id: string) {
  const el = shapeEl(id);
  const c = centre(el);
  down(el, c);
  up(el, c);
  clearWrites();
}
const centre = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
};

/* --------------------------------- fixture -------------------------------- */

const SHAPE = { ...makeShape("rect"), id: "deck-shape-1", x: 30, y: 30, w: 20, h: 10, fill: "#2f4fff", fillOpacity: 1 };
const SHAPE2 = { ...makeShape("ellipse"), id: "deck-shape-2", x: 60, y: 60, w: 14, h: 14, fillOpacity: 0 };
// a locked deck shape: it is transparent to the pointer, so a press there hits
// the board — and it must never move, however the pointer moves
const SHAPE3 = { ...makeShape("rect"), id: "deck-shape-3", x: 5, y: 85, w: 10, h: 8, locked: true, fill: "#111", fillOpacity: 1 };
const BASELINE = [SHAPE, SHAPE2, SHAPE3];

const SLIDE: SlideData = {
  id: "s1",
  number: "১",
  question: "বহুপদীর মাত্রা কত?",
  options: [
    { key: "ক", text: "1" },
    { key: "খ", text: "2" },
  ],
  answer: "ক",
  scale: 1,
  showAnswer: false,
};

let THEME: ThemeSettings = {
  ...DEFAULT_THEME,
  // keep the arithmetic exact: no grid snapping, no smart guides
  snapEnabled: false,
  smartGuides: false,
  layout: cloneLayout(),
};

interface Writes {
  shapes: { id: string; patch: Partial<ShapeItem> }[];
  batches: { id: string; patch: Partial<ShapeItem> }[][];
  layout: { id: ElementId; patch: Partial<Box> }[];
}

const NO_WRITES: Writes = { shapes: [], batches: [], layout: [] };

interface Api {
  writes: Writes;
  shapes: ShapeItem[];
  layout: Record<ElementId, Box>;
  selectedIds: string[];
  resetAll: () => void;
  clearWrites: () => void;
}

let api: Api | null = null;

function Harness() {
  const [writes, setWrites] = useState<Writes>(NO_WRITES);
  const [shapes, setShapes] = useState<ShapeItem[]>(BASELINE);
  const [layout, setLayout] = useState<Record<ElementId, Box>>(THEME.layout as Record<ElementId, Box>);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEl, setSelectedEl] = useState<ElementId | null>(null);
  const [field, setField] = useState<SlideField | null>(null);

  const resetAll = useCallback(() => {
    setWrites(NO_WRITES);
    setShapes(BASELINE);
    setLayout(THEME.layout as Record<ElementId, Box>);
    setSelectedIds([]);
    setSelectedEl(null);
    setField(null);
  }, []);

  const clearWrites = useCallback(() => setWrites(NO_WRITES), []);

  const onShapeChange = useCallback((id: string, patch: Partial<ShapeItem>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setWrites((w) => ({ ...w, shapes: [...w.shapes, { id, patch }] }));
  }, []);

  const onShapesChange = useCallback((updates: { id: string; patch: Partial<ShapeItem> }[]) => {
    setShapes((prev) => prev.map((s) => ({ ...s, ...(updates.find((u) => u.id === s.id)?.patch ?? {}) })));
    setWrites((w) => ({ ...w, batches: [...w.batches, updates] }));
  }, []);

  const onLayoutChange = useCallback((id: ElementId, patch: Partial<Box>) => {
    setLayout((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setWrites((w) => ({ ...w, layout: [...w.layout, { id, patch }] }));
  }, []);

  api = { writes, shapes, layout, selectedIds, resetAll, clearWrites };

  return createElement(Slide, {
    slide: { ...SLIDE, shapes: [] },
    header: { ...DEFAULT_HEADER, showLogo: false, logo: null },
    theme: THEME,
    onField: (f: SlideField | null) => setField(f),
    activeField: field,
    onLayoutChange,
    selected: selectedEl,
    onSelect: (id: ElementId | null) => setSelectedEl(id),
    // the shapes that come from the Deck, wired exactly as App.tsx wires them
    globalShapes: shapes,
    selectedShapeIds: selectedIds,
    onSelectShapeIds: (ids: string[]) => setSelectedIds(ids),
    onShapeChange,
    onShapesChange,
    onGroupShapes: (ids: string[]) => setShapes((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, groupId: "g1" } : x))),
    onUngroupShapes: (ids: string[]) => setShapes((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, groupId: undefined } : x))),
    onGestureEnd: () => {},
  });
}

/* --------------------------------- asserts -------------------------------- */

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CaseResult[] = [];

const W = () => api!.writes;
const shapeWrites = () => W().shapes.length + W().batches.reduce((n, b) => n + b.length, 0);
const layoutWrites = () => W().layout.length;
const at = (id: string) => api!.shapes.find((s) => s.id === id)!;
const samePos = (id: string, before: { x: number; y: number }) => at(id).x === before.x && at(id).y === before.y;

const cases: [string, () => void][] = [];
const test = (name: string, fn: () => void) => cases.push([name, fn]);

/* ============ 1. the seven steps from the report, one case each =========== */

test("1. cursor moves over a shape → shape stays still", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  for (const t of ["pointerover", "pointerenter", "pointermove", "pointerleave", "pointerout"]) {
    for (let i = 0; i < 12; i++) fire(el, t, { x: c.x - 60 + i * 12, y: c.y - 30 + i * 7, buttons: 0 });
  }
  for (let i = 0; i < 20; i++) hover(asWin, { x: c.x + i * 40, y: c.y + i * 25 });
  hover(boardEl(), { x: 20, y: 20 });
  hover(el, { x: c.x + 500, y: c.y + 300 });
  record("no writes and geometry untouched", shapeWrites() === 0 && layoutWrites() === 0 && samePos(SHAPE.id, before), `shapeWrites=${shapeWrites()}`);
});

test("1b. cursor moves over a deck element → element stays still", () => {
  const before = { ...api!.layout.question };
  const el = elementEl("question");
  const c = centre(el);
  for (let i = 0; i < 15; i++) {
    hover(el, { x: c.x - 100 + i * 15, y: c.y + i * 4 });
    hover(boardEl(), { x: c.x + i * 9, y: c.y - i * 3 });
  }
  record("deck element: no layout writes on hover", layoutWrites() === 0 && api!.layout.question.x === before.x, `layoutWrites=${layoutWrites()}`);
});

test("2. click a shape → selected, but still no movement", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  up(el, c);
  record("selected", api!.selectedIds.includes(SHAPE.id), `selected=${api!.selectedIds.join("|")}`);
  record("click wrote no geometry", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
  // and moving the mouse afterwards (case 3 of the report)
  for (let i = 0; i < 15; i++) hover(asWin, { x: c.x + i * 30, y: c.y + i * 20 });
  record("movement after selecting stays put", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
});

test("2b. click a deck element → selected, no reposition", () => {
  const before = { ...api!.layout.question };
  const el = elementEl("question");
  const c = centre(el);
  down(el, c);
  up(el, c);
  for (let i = 0; i < 12; i++) hover(asWin, { x: c.x + i * 40, y: c.y - i * 20 });
  record("deck element: click + movement never repositions", layoutWrites() === 0 && api!.layout.question.x === before.x, `writes=${layoutWrites()}`);
});

test("3. press and hold, tiny jitter → still a click, no move", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  for (const d of [1, 2, 3, -3]) held(asWin, { x: c.x + d, y: c.y });
  for (const d of [1, 2, 3]) held(asWin, { x: c.x, y: c.y + d });
  up(asWin, { x: c.x + 3, y: c.y + 3 });
  record("sub-threshold movement writes nothing", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
});

test("4. press, hold and move → the shape follows the drag", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  held(asWin, { x: c.x + 20, y: c.y }); // 20px > threshold: drag starts
  held(asWin, { x: c.x + 64, y: c.y + 36 });
  held(asWin, { x: c.x + 128, y: c.y + 72 }); // +10% / +10%
  up(asWin, { x: c.x + 128, y: c.y + 72 });
  const after = at(SHAPE.id);
  record(
    "shape moved by exactly the pointer delta",
    shapeWrites() >= 3 && Math.abs(after.x - (before.x + 10)) < 0.2 && Math.abs(after.y - (before.y + 10)) < 0.2,
    `${before.x},${before.y} → ${after.x},${after.y} (writes=${shapeWrites()})`,
  );
});

test("5. release → the shape stops immediately", () => {
  const after = { ...at(SHAPE.id) };
  for (let i = 0; i < 15; i++) hover(asWin, { x: 400 + i * 60, y: 300 + i * 40 });
  record("no movement after release", shapeWrites() === 0 && samePos(SHAPE.id, after), `writes=${shapeWrites()}`);
});

test("6. move again with the button 'held' from a stale event → nothing", () => {
  const after = { ...at(SHAPE.id) };
  // a move that still claims the button is down (stale / synthetic) must not drag
  held(asWin, { x: 1000, y: 600 });
  held(shapeEl(SHAPE.id), { x: 1100, y: 620 });
  hover(shapeEl(SHAPE.id), { x: 20, y: 20 });
  record("no phantom drag from a stray move", shapeWrites() === 0 && samePos(SHAPE.id, after), `writes=${shapeWrites()}`);
});

test("7. DOM position equals the committed state after a drag", () => {
  const st = at(SHAPE.id);
  const el = shapeEl(SHAPE.id);
  record(
    "rendered left/top come from state",
    el.style.left === `${st.x}%` && el.style.top === `${st.y}%`,
    `dom=${el.style.left},${el.style.top} state=${st.x}%,${st.y}%`,
  );
});

/* ========================= 2. pointer-state edges ========================= */

test("pointer-up delivered elsewhere still ends the drag", () => {
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  const before = { ...at(SHAPE.id) };
  down(el, c);
  held(asWin, { x: c.x + 100, y: c.y }); // drag starts (1 write)
  const during = shapeWrites();
  up(boardEl(), { x: 1200, y: 700 }); // released over the board, not over the shape
  for (let i = 0; i < 10; i++) held(asWin, { x: c.x + 400 + i * 30, y: c.y + 300 });
  record("no further writes after that release", shapeWrites() === during, `writes during=${during} after=${shapeWrites()}`);
  void before;
});

test("pointercancel aborts mid-drag", () => {
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  held(asWin, { x: c.x + 60, y: c.y });
  const during = shapeWrites();
  fire(asWin, "pointercancel", { x: c.x + 60, y: c.y, buttons: 0 });
  for (let i = 0; i < 10; i++) held(asWin, { x: c.x + 200 + i * 40, y: c.y + 200 });
  record("writes stop at cancel", shapeWrites() === during, `during=${during} after=${shapeWrites()}`);
});

test("window blur (lost pointer-up) cannot leave a live gesture", () => {
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  held(asWin, { x: c.x + 90, y: c.y + 20 });
  const during = shapeWrites();
  blurWindow();
  // the release happened over another app: no pointer-up for us, yet the button
  // state we see is 'held' — the gesture must be over all the same
  for (let i = 0; i < 10; i++) held(asWin, { x: c.x + 300 + i * 50, y: c.y + 400 });
  record("blur ends the gesture", shapeWrites() === during, `during=${during} after=${shapeWrites()}`);
});

test("a second pointer never hijacks the gesture", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, { ...c, pointerId: 1 });
  for (let i = 0; i < 8; i++) held(el, { x: c.x + i * 60, y: c.y + 40, pointerId: 2 });
  for (let i = 0; i < 8; i++) held(asWin, { x: c.x + i * 60, y: c.y + 40, pointerId: 2 });
  record("other pointer id ignored", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
  up(asWin, { ...c, pointerId: 1 });
});

test("right / middle button presses never drag", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  fire(el, "pointerdown", { ...c, button: 2, buttons: 2 });
  fire(el, "pointerup", { ...c, button: 2, buttons: 0 });
  fire(el, "pointerdown", { ...c, button: 1, buttons: 4 });
  fire(el, "pointerup", { ...c, button: 1, buttons: 0 });
  for (const b of [2, 4]) for (let i = 0; i < 6; i++) fire(asWin, "pointermove", { x: c.x + i * 50, y: c.y, buttons: b });
  record("non-primary buttons write nothing", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
});

test("double-click to edit text does not move the shape", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  for (let k = 0; k < 2; k++) {
    down(el, c);
    up(el, c);
    el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: c.x, clientY: c.y }));
    el.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true, clientX: c.x, clientY: c.y }));
    for (let i = 0; i < 6; i++) hover(el, { x: c.x + i * 30, y: c.y + i * 12 });
  }
  record("double-click wrote no geometry", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
});

test("selecting another object leaves the first alone", () => {
  const before = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE2.id);
  const c = centre(el);
  down(el, c);
  up(el, c);
  for (let i = 0; i < 10; i++) hover(asWin, { x: c.x + i * 40, y: c.y + i * 20 });
  record("second selection moved nothing", shapeWrites() === 0 && samePos(SHAPE.id, before) && at(SHAPE2.id).x === 60, `writes=${shapeWrites()}`);
});

test("rubber-band over shapes selects without moving them", () => {
  const b = { ...at(SHAPE.id) };
  const board = boardEl();
  down(board, { x: 2, y: 2 });
  held(board, { x: 300, y: 200 });
  // the band passes right over the shape while it is being drawn
  for (let i = 0; i < 8; i++) held(shapeEl(SHAPE.id), { x: 320 + i * 40, y: 240 + i * 20 });
  up(board, { x: 700, y: 480 });
  record("marquee never moves a shape", shapeWrites() === 0 && samePos(SHAPE.id, b), `writes=${shapeWrites()}`);
});

test("a marquee cannot leak: blur ends it, hovering draws nothing", () => {
  const board = boardEl();
  down(board, { x: 4, y: 4 });
  held(board, { x: 260, y: 200 }); // band is being drawn
  blurWindow(); // no pointerup at all
  flush();
  const rectAfterBlur = doc.querySelector("[data-marquee]");
  for (let i = 0; i < 10; i++) hover(board, { x: 300 + i * 40, y: 260 + i * 30 });
  flush();
  const rectLater = doc.querySelector("[data-marquee]");
  record("marquee rect disappears after an interrupted gesture", !rectAfterBlur && !rectLater, `afterBlur=${!!rectAfterBlur} later=${!!rectLater}`);
});

/* ====================== 3. handles: click ≠ resize ====================== */

test("resize handle: press + release without moving writes nothing", () => {
  // select the shape first so its handles exist
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  up(el, c);
  clearWrites();
  const h = shapeHandle("nw");
  if (!h) {
    record("selected shape exposes resize handles", false, "no handles rendered");
    return;
  }
  record("selected shape exposes resize handles", true, `${handles().length} handles`);
  const before = { ...at(SHAPE.id) };
  const hc = centre(h);
  down(h, hc);
  for (let i = 0; i < 5; i++) hover(asWin, { x: hc.x + i, y: hc.y + i });
  up(asWin, hc);
  record("pressing a handle never shifts the shape", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
  for (let i = 0; i < 8; i++) hover(asWin, { x: hc.x + i * 40, y: hc.y + i * 30 });
  record("no resize continues after release", shapeWrites() === 0 && samePos(SHAPE.id, before), `writes=${shapeWrites()}`);
});

test("resize handle: a real drag still resizes", () => {
  selectShape(SHAPE.id);
  const h = shapeHandle("se");
  if (!h) {
    record("selected shape exposes the se handle", false, "no se handle");
    return;
  }
  const before = { ...at(SHAPE.id) };
  const hc = centre(h);
  down(h, hc);
  held(asWin, { x: hc.x + 64, y: hc.y + 36 });
  held(asWin, { x: hc.x + 128, y: hc.y + 72 });
  up(asWin, { x: hc.x + 128, y: hc.y + 72 });
  const after = at(SHAPE.id);
  record(
    "size changed by +10% / +10%",
    shapeWrites() >= 2 && Math.abs(after.w - (before.w + 10)) < 0.2 && Math.abs(after.h - (before.h + 10)) < 0.2,
    `${before.w}×${before.h} → ${after.w}×${after.h}`,
  );
});

test("rotated shape: resize follows the shape's own axes", () => {
  // give the shape a real rotation first, the same way a user would
  selectShape(SHAPE.id);
  const rh = rotateHandle();
  if (!rh) {
    record("rotated shape exposes a rotate handle", false, "no rotate handle");
    return;
  }
  const rc = centre(rh);
  down(rh, rc);
  held(asWin, { x: rc.x + 140, y: rc.y + 120 });
  up(asWin, { x: rc.x + 140, y: rc.y + 120 });
  const rot = at(SHAPE.id).rot;
  if (rot === 0) {
    record("rotated shape: rotation was applied", false, "rotate drag had no effect");
    return;
  }
  clearWrites();

  // the resize must happen in the shape's LOCAL frame: drag "se" along the
  // local +x/+y diagonal (+64px × +96px in local units → +5% × +13.33%)
  const s0 = { ...at(SHAPE.id) };
  const B = { left: 100, top: 50, width: 1280, height: 720 }; // the test board (dom-env)
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const c0 = { x: B.left + ((s0.x + s0.w / 2) / 100) * B.width, y: B.top + ((s0.y + s0.h / 2) / 100) * B.height };
  const w0 = (s0.w / 100) * B.width;
  const h0 = (s0.h / 100) * B.height;
  // where the se handle really sits on screen — it lives on the rotated frame
  const se = { x: c0.x + (w0 / 2) * cos - (h0 / 2) * sin, y: c0.y + (w0 / 2) * sin + (h0 / 2) * cos };
  // that local +64/+96 move, expressed in board space
  const d = { x: 64 * cos - 96 * sin, y: 64 * sin + 96 * cos };
  const h = shapeHandle("se");
  if (!h) {
    record("rotated shape exposes the se handle", false, "no se handle");
    return;
  }
  down(h, { x: se.x, y: se.y });
  held(asWin, { x: se.x + d.x / 2, y: se.y + d.y / 2 });
  held(asWin, { x: se.x + d.x, y: se.y + d.y });
  up(asWin, { x: se.x + d.x, y: se.y + d.y });
  const after = at(SHAPE.id);
  const w1 = w0 + 64; // local px
  const h1 = h0 + 96;
  const w1p = (w1 / B.width) * 100; // board %
  const h1p = (h1 / B.height) * 100;
  const nc = {
    x: c0.x + ((w1 - w0) / 2) * cos - ((h1 - h0) / 2) * sin,
    y: c0.y + ((w1 - w0) / 2) * sin + ((h1 - h0) / 2) * cos,
  };
  const ex = ((nc.x - B.left) / B.width) * 100 - w1p / 2;
  const ey = ((nc.y - B.top) / B.height) * 100 - h1p / 2;
  record(
    "size grew along the shape's local axes",
    shapeWrites() >= 2 && Math.abs(after.w - w1p) < 0.2 && Math.abs(after.h - h1p) < 0.2,
    `${s0.w}×${s0.h} → ${after.w}×${after.h} (expected ≈${w1p.toFixed(2)}×${h1p.toFixed(2)})`,
  );
  record(
    "box position kept the opposite corner in place",
    Math.abs(after.x - ex) < 0.25 && Math.abs(after.y - ey) < 0.25,
    `${s0.x},${s0.y} → ${after.x},${after.y} (expected ≈${ex.toFixed(2)},${ey.toFixed(2)})`,
  );
  // the dragged handle must land under the pointer…
  const ac = { x: B.left + ((after.x + after.w / 2) / 100) * B.width, y: B.top + ((after.y + after.h / 2) / 100) * B.height };
  const aw = (after.w / 100) * B.width;
  const ah = (after.h / 100) * B.height;
  const seNew = { x: ac.x + (aw / 2) * cos - (ah / 2) * sin, y: ac.y + (aw / 2) * sin + (ah / 2) * cos };
  record(
    "dragged handle tracks the pointer",
    Math.abs(seNew.x - (se.x + d.x)) < 3 && Math.abs(seNew.y - (se.y + d.y)) < 3,
    `handle at ${seNew.x.toFixed(1)},${seNew.y.toFixed(1)} pointer at ${(se.x + d.x).toFixed(1)},${(se.y + d.y).toFixed(1)}`,
  );
  // …and the opposite (nw) corner must not move at all
  const nw0 = { x: c0.x - (w0 / 2) * cos + (h0 / 2) * sin, y: c0.y - (w0 / 2) * sin - (h0 / 2) * cos };
  const nwNew = { x: ac.x - (aw / 2) * cos + (ah / 2) * sin, y: ac.y - (aw / 2) * sin - (ah / 2) * cos };
  record(
    "opposite corner did not move",
    Math.abs(nwNew.x - nw0.x) < 3 && Math.abs(nwNew.y - nw0.y) < 3,
    `nw ${nw0.x.toFixed(1)},${nw0.y.toFixed(1)} → ${nwNew.x.toFixed(1)},${nwNew.y.toFixed(1)}`,
  );
});

test("rotate handle: click keeps rotation, drag rotates", () => {
  selectShape(SHAPE.id);
  const rot = rotateHandle();
  if (!rot) {
    record("selected shape exposes a rotate handle", false, "no rotate handle");
    return;
  }
  const before = at(SHAPE.id).rot;
  const rc = centre(rot);
  down(rot, rc);
  up(asWin, rc);
  record("clicking the rotate handle keeps rotation", at(SHAPE.id).rot === before && shapeWrites() === 0, `rot=${at(SHAPE.id).rot} writes=${shapeWrites()}`);
  clearWrites();
  down(rot, rc);
  held(asWin, { x: rc.x + 140, y: rc.y + 120 });
  up(asWin, { x: rc.x + 140, y: rc.y + 120 });
  record("dragging it rotates", at(SHAPE.id).rot !== before, `rot ${before} → ${at(SHAPE.id).rot}`);
});

test("deck element handles: press + release must not reposition or reflow", () => {
  // select the element first (its overlay/handles appear when selected)
  const el = elementEl("question");
  const c = centre(el);
  down(el, c);
  up(el, c);
  clearWrites();
  const before = { ...api!.layout.question };
  const h = handles()[0];
  if (!h) {
    record("element overlay exposes handles", false, "no handles rendered");
    return;
  }
  record("element overlay exposes handles", true, `${handles().length} handles on the board`);
  const hc = centre(h);
  down(h, hc);
  for (let i = 0; i < 4; i++) hover(asWin, { x: hc.x + i, y: hc.y });
  up(asWin, hc);
  record(
    "a click on an element handle writes no geometry",
    layoutWrites() === 0 && api!.layout.question.x === before.x && api!.layout.question.y === before.y,
    `writes=${layoutWrites()} x=${api!.layout.question.x} (was ${before.x})`,
  );
});

test("deck element: real drag still works and stops at release", () => {
  const el = elementEl("question");
  const c = centre(el);
  const before = { ...api!.layout.question };
  down(el, c);
  held(asWin, { x: c.x + 20, y: c.y });
  held(asWin, { x: c.x + 128, y: c.y + 72 });
  up(asWin, { x: c.x + 128, y: c.y + 72 });
  const mid = { ...api!.layout.question };
  record(
    "element followed the drag",
    layoutWrites() >= 2 && Math.abs(mid.x - (before.x + 10)) < 0.6 && Math.abs(mid.y - (before.y + 10)) < 0.6,
    `${before.x},${before.y} → ${mid.x},${mid.y}`,
  );
  clearWrites();
  for (let i = 0; i < 12; i++) hover(asWin, { x: c.x + 400 + i * 30, y: c.y + i * 10 });
  record("element is frozen after release", layoutWrites() === 0 && api!.layout.question.x === mid.x, `writes=${layoutWrites()}`);
});

/* ========================= 4. groups / multi-select ======================== */

test("group frame: hover then release does not move the set", () => {
  // select both shapes through a marquee
  const board = boardEl();
  down(board, { x: 1, y: 1 });
  held(board, { x: 900, y: 640 });
  up(board, { x: 900, y: 640 });
  const sel = api!.selectedIds;
  record("multi-select via marquee works", sel.length >= 2, `selected=${sel.length}`);
  clearWrites();
  const before = { ...at(SHAPE.id) };
  // dragging the whole set must still work
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  down(el, c);
  held(asWin, { x: c.x + 100, y: c.y + 50 });
  up(asWin, { x: c.x + 100, y: c.y + 50 });
  const moved = shapeWrites();
  record("dragging the group moves every member", moved > 0 && Math.abs(at(SHAPE.id).x - (before.x + 100 / 12.8)) < 0.3, `writes=${moved} x=${at(SHAPE.id).x} (was ${before.x})`);
  clearWrites();
  for (let i = 0; i < 10; i++) hover(asWin, { x: c.x + 500 + i * 30, y: c.y });
  record("group freezes after release", shapeWrites() === 0, `writes=${shapeWrites()}`);
});

test("selection frame leaves grouping actions to contextual toolbar", () => {
  record("old canvas grouping chips are removed", !doc.querySelector('[data-chip="group"], [data-chip="ungroup"]'), "");
});

/* ============ 5. existing features must survive the rewrite ============== */

test("grid snapping still applies during a drag", () => {
  const theme = THEME as ThemeSettings & { snapEnabled: boolean; snapStep: number };
  theme.snapEnabled = true;
  theme.snapStep = 5;
  try {
    act(() => {
      api!.resetAll();
    });
    const el = shapeEl(SHAPE.id);
    const c = centre(el);
    // 12.8px = 1% → 31% would be off-grid; the nearest 5% line is 30
    down(el, c);
    held(asWin, { x: c.x + 13, y: c.y });
    up(asWin, { x: c.x + 13, y: c.y });
    const snapped = at(SHAPE.id);
    record("drag snaps to the grid", snapped.x === 30 && snapped.y === 30, `x=${snapped.x} y=${snapped.y} (raw would be 30.1)`);
    // and a bigger move lands on the next line, not between two
    const c2 = centre(shapeEl(SHAPE.id));
    down(el, c2);
    // 100px = 7.81% → 37.81 snaps up to the 40 line; 51px = 7.08% → 37.08 to 35
    held(asWin, { x: c2.x + 100, y: c2.y + 51 });
    up(asWin, { x: c2.x + 100, y: c2.y + 51 });
    const snapped2 = at(SHAPE.id);
    record("a longer drag lands on a grid line", snapped2.x === 40 && snapped2.y === 35, `x=${snapped2.x} y=${snapped2.y}`);
  } finally {
    theme.snapEnabled = false;
    theme.snapStep = 1;
    act(() => {
      api!.resetAll();
    });
  }
});

test("smart guides still align edges with the other deck shape", () => {
  const theme = THEME as ThemeSettings & { smartGuides: boolean };
  theme.smartGuides = true;
  try {
    act(() => {
      api!.resetAll();
    });
    // SHAPE (x30 w20) dragged so its right edge lands 0.1% past SHAPE2's left (x60)
    const el = shapeEl(SHAPE.id);
    const c = centre(el);
    down(el, c);
    held(asWin, { x: c.x + 129.3, y: c.y }); // 10.10% → 40.10, guide pulls it to 40
    up(asWin, { x: c.x + 129.3, y: c.y });
    const after = at(SHAPE.id);
    record("right edge aligned to the neighbour", after.x === 40, `x=${after.x} (unsnapped would be 40.1)`);
  } finally {
    theme.smartGuides = false;
    act(() => {
      api!.resetAll();
    });
  }
});

test("locked deck shapes can never be dragged", () => {
  const before = { ...at(SHAPE3.id) };
  const lockedEl = shapeEl(SHAPE3.id);
  const c = centre(lockedEl);
  // in the browser a locked item is pointer-transparent: the press lands on the
  // board and rubber-bands, so the shape must not move
  const board = boardEl();
  down(board, c);
  held(asWin, { x: c.x + 300, y: c.y + 200 });
  up(asWin, { x: c.x + 300, y: c.y + 200 });
  // and even a press that reaches the shape itself must be refused
  down(lockedEl, c);
  held(asWin, { x: c.x + 200, y: c.y + 100 });
  up(asWin, { x: c.x + 200, y: c.y + 100 });
  for (let i = 0; i < 8; i++) hover(lockedEl, { x: c.x + i * 60, y: c.y });
  record("locked shape stayed put, and was not armed for dragging", shapeWrites() === 0 && at(SHAPE3.id).x === before.x && at(SHAPE3.id).y === before.y, `writes=${shapeWrites()} pos=${at(SHAPE3.id).x},${at(SHAPE3.id).y}`);
});

/* ============================== 6. misc edges ============================= */

test("repeat gestures stay deterministic (no accumulating drift)", () => {
  api!.resetAll();
  const start = { ...at(SHAPE.id) };
  const el = shapeEl(SHAPE.id);
  const c = centre(el);
  for (let round = 0; round < 3; round++) {
    down(el, c);
    held(asWin, { x: c.x + 51, y: c.y + 51 }); // +4% / +7.08%
    up(asWin, { x: c.x + 51, y: c.y + 51 });
    for (let i = 0; i < 5; i++) hover(asWin, { x: c.x + 400 + i * 60, y: c.y + 400 });
  }
  const after = at(SHAPE.id);
  const expectX = +(start.x + 3 * 4).toFixed(1);
  const expectY = +(start.y + 3 * 7.1).toFixed(1);
  record(
    "three identical drags accumulate exactly",
    Math.abs(after.x - expectX) <= 0.3 && Math.abs(after.y - expectY) <= 0.5,
    `${start.x},${start.y} → ${after.x},${after.y} (expected ≈${expectX},${expectY})`,
  );
});

/* --------------------------------- driver -------------------------------- */

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}

export async function runDragTests(): Promise<CaseResult[]> {
  results.length = 0;
  const host = doc.getElementById("root")!;
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(Harness));
  });

  for (const [name, fn] of cases) {
    act(() => {
      api!.resetAll();
      api!.clearWrites();
    });
    // a click on the empty board also drops any rubber band left over from the
    // previous case, so every case starts from a clean visual state
    down(boardEl(), { x: 3, y: 3 });
    up(boardEl(), { x: 3, y: 3 });
    clearWrites();
    flush();
    try {
      fn();
    } catch (err) {
      record(`${name}: interaction ran without throwing`, false, String((err as Error)?.message ?? err));
    }
  }

  act(() => {
    root?.unmount();
  });
  return results;
}
