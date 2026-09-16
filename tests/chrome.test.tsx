/**
 * The editor chrome (dialog grips, split divider, inspector edge) used the same
 * "gesture ref + onPointerMove on the element" idiom as the board, so it is now
 * driven by the same guarded session. These cases pin the two properties that
 * matter: a divider resizes on a real drag, and never on a hover.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SplitPane } from "../src/components/ResizableDialog";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

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

const paneRatio = () => {
  const pane = doc.querySelector('[role="separator"]')?.parentElement?.firstElementChild as HTMLElement | null;
  return pane?.style.flexBasis ?? "";
};

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

export async function runChromeTests(): Promise<CaseResult[]> {
  const host = doc.getElementById("root")!;
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(
      createElement(SplitPane, {
        storageKey: "drag-test",
        initial: 0.5,
        left: createElement("div", null, "left"),
        right: createElement("div", null, "right"),
      }),
    );
  });
  // give the pane a size, since jsdom has no layout
  const container = doc.querySelector('[role="separator"]')!.parentElement as HTMLElement;
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  const out: CaseResult[] = [];
  const divider = doc.querySelector('[role="separator"]')!;
  const start = paneRatio();

  for (let i = 0; i < 10; i++) fire(divider, "pointermove", 100 + i * 60, 300, 0);
  out.push({ name: "hovering the divider does not resize the panes", pass: paneRatio() === start, detail: `${start} → ${paneRatio()}` });

  // press and release with no travel at all
  fire(divider, "pointerdown", 500, 300, 1);
  fire(win, "pointermove", 501, 300, 1);
  fire(win, "pointerup", 501, 300, 0);
  out.push({ name: "pressing the divider without dragging does not resize", pass: paneRatio() === start, detail: `${start} → ${paneRatio()}` });

  fire(divider, "pointerdown", 500, 300, 1);
  fire(win, "pointermove", 700, 300, 1);
  const dragged = paneRatio();
  out.push({ name: "dragging the divider resizes the panes", pass: dragged === "70%", detail: `flex-basis=${dragged}` });

  fire(win, "pointerup", 700, 300, 0);
  for (let i = 0; i < 10; i++) fire(divider, "pointermove", 100 + i * 80, 300, 0);
  out.push({ name: "the divider freezes after release", pass: paneRatio() === dragged, detail: `${dragged} → ${paneRatio()}` });

  act(() => {
    root?.unmount();
  });
  return out;
}
