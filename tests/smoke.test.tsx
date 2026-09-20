/**
 * Boot smoke test: the full editor still mounts, renders a deck and reacts to
 * the pointer — the drag rewrite must not take the app down with it.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

const fire = (target: EventTarget, type: string, x: number, y: number, buttons: number) => {
  act(() => {
    target.dispatchEvent(
      new win.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  });
};

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

export async function runSmokeTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: { title: "MCQ", brandTop: "B", brandBottom: "", badge: "Q", logo: null, showLogo: false, showBanner: false },
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?",
          options: [
            { key: "ক", text: "1" },
            { key: "খ", text: "2" },
          ],
          answer: "ক",
          scale: 1,
          showAnswer: false,
        },
      ],
      // a shape that comes from the Deck: it must behave like any other item
      globalShapes: [{ id: "g1", kind: "rect", x: 20, y: 20, w: 20, h: 10, rot: 0, z: 10, fill: "#2f4fff", fillOpacity: 1, stroke: "", strokeWidth: 0, dash: false, text: "", textColor: "#fff", fontSize: 20, bold: false, italic: false, align: "center", valign: "middle" }],
    }),
  );

  let root: Root | null = null;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);
  try {
    act(() => {
      root = createRoot(doc.getElementById("root")!);
      root.render(createElement(App));
    });
  } catch (err) {
    out.push({ name: "the editor mounts", pass: false, detail: String((err as Error)?.message ?? err) });
    return out;
  }
  out.push({ name: "the editor mounts", pass: !!doc.querySelector(".slide-editable [data-board]"), detail: `board=${!!doc.querySelector(".slide-editable [data-board]")}` });
  out.push({ name: "deck shape from the store is rendered", pass: !!doc.querySelector('.slide-editable [data-shape="g1"]'), detail: `shape=${!!doc.querySelector('.slide-editable [data-shape="g1"]')}` });

  out.push({ name: "toolbar is hidden without selection", pass: !doc.querySelector(".context-toolbar") });

  // waving the mouse across the whole board must leave the deck shape alone
  const shape = doc.querySelector('.slide-editable [data-shape="g1"]') as HTMLElement;
  const before = `${shape.style.left},${shape.style.top}`;
  const rect = doc.querySelector(".slide-editable [data-board]")!.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    fire(shape, "pointermove", rect.left + i * 20, rect.top + i * 10, 0);
    fire(doc.querySelector(".slide-editable [data-board]")!, "pointermove", rect.right - i * 15, rect.bottom - i * 9, 0);
    fire(win as unknown as EventTarget, "pointermove", rect.left + 30 + i * 40, rect.top + 5, 0);
  }
  const after = `${shape.style.left},${shape.style.top}`;
  out.push({ name: "hovering the board leaves the deck shape exactly where it was", pass: before === after, detail: `${before} → ${after}` });

  // selection still works: clicking shows the selection frame (its edit options)
  fire(shape, "pointerdown", rect.left + rect.width * 0.3, rect.top + rect.height * 0.25, 1);
  fire(shape, "pointerup", rect.left + rect.width * 0.3, rect.top + rect.height * 0.25, 0);
  // (the font button reads the face in use — "Font: Kalpurush" — so it is matched by prefix)
  // A shape's Fill is a colour WELL (an <input type="color">); the question
  // bullet line also has a "Fill" button, but that one opens the marker's paint
  // card (solid · gradient · auto · none), so the shape tool is matched as an
  // input and the two never get confused.
  out.push({ name: "shape selection shows contextual shape tools", pass: !!doc.querySelector('.context-toolbar input[aria-label="Fill"]') && !doc.querySelector('.context-toolbar .ctx-font-toggle, .context-toolbar [aria-label^="Font:"]') });
  const frame = doc.querySelector('.slide-editable [data-sel="g1"]');
  out.push({ name: "clicking a deck shape selects it and shows its handles", pass: !!frame && frame.querySelectorAll("[data-handle]").length === 8, detail: `frame=${!!frame} handles=${frame?.querySelectorAll("[data-handle]").length ?? 0}` });
  const still = `${shape.style.left},${shape.style.top}`;
  out.push({ name: "selecting + opening edit options did not move it", pass: still === before, detail: `${before} → ${still}` });

  // and a genuine drag in the real app still works
  fire(shape, "pointerdown", rect.left + rect.width * 0.3, rect.top + rect.height * 0.25, 1);
  fire(win as unknown as EventTarget, "pointermove", rect.left + rect.width * 0.3 + 128, rect.top + rect.height * 0.25 + 72, 1);
  fire(win as unknown as EventTarget, "pointerup", rect.left + rect.width * 0.3 + 128, rect.top + rect.height * 0.25 + 72, 0);
  const moved = `${shape.style.left},${shape.style.top}`;
  out.push({ name: "a real drag in the running editor moves the deck shape", pass: moved !== before, detail: `${before} → ${moved}` });
  for (let i = 0; i < 6; i++) fire(shape, "pointermove", rect.left + 900, rect.top + 400, 0);
  out.push({ name: "…and stops when the button is released", pass: `${shape.style.left},${shape.style.top}` === moved, detail: `now=${shape.style.left},${shape.style.top}` });

  const question = doc.querySelector('.slide-editable [data-el="question"]')!;
  fire(question, "pointerdown", 120, 160, 1);
  fire(question, "pointerup", 120, 160, 0);
  out.push({ name: "text selection immediately replaces shape tools", pass: !!doc.querySelector('.context-toolbar [aria-label="Bold"]') && !doc.querySelector('.context-toolbar input[aria-label="Fill"]') });
  act(() => win.dispatchEvent(new win.KeyboardEvent('keydown', {key:'Escape', bubbles:true})));
  out.push({ name: "Escape hides the toolbar", pass: !doc.querySelector('.context-toolbar') });
  out.push({ name: "no uncaught errors while interacting", pass: errors.length === 0, detail: errors.join(" | ") });
  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
