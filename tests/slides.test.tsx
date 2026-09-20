/**
 * Slide-stack suite.
 *
 * Four features are pinned here:
 *
 *   1. the slide rail (left) is a drag surface: dragging a card carries it to
 *      ANY slot in the stack, the cards in between open the landing gap while
 *      the drag is live, and a click, a sub-threshold press, a hover, a
 *      pointercancel and any movement after pointer-up move nothing;
 *   2. the slide selector in the top-right corner of the editor lists the whole
 *      deck and jumps the editor to the picked slide;
 *   3. every card carries a SELECTION BOX: ticking builds a multi-selection
 *      (Ctrl/⌘-click toggles, Shift-click ranges, the header box takes the whole
 *      deck) that the bulk bar duplicates or deletes in ONE undo step, feeds the
 *      inspector's Selected-slides scope, and never opens a slide or arms a drag;
 *   4. the slide the editor is showing is the only card wearing the animated
 *      gradient border, and the border follows the editor as it moves.
 *
 * Like the layers panel, the reorder runs through the guarded pointer session,
 * so a press that never travels stays a click and a real release is the only
 * event that commits a drop.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/* --------------------------------- helpers -------------------------------- */

const fire = (target: EventTarget, t: string, x: number, y: number, buttons: number) => {
  act(() => {
    target.dispatchEvent(
      new win.PointerEvent(t, {
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

const asWin = win as unknown as EventTarget;
const down = (t: EventTarget, x: number, y: number) => fire(t, "pointerdown", x, y, 1);
const held = (t: EventTarget, x: number, y: number) => fire(t, "pointermove", x, y, 1);
const up = (t: EventTarget, x: number, y: number) => fire(t, "pointerup", x, y, 0);
const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};
const mousedown = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  });
};
/** flush the setTimeout(0) the deck uses to follow a moved slide */
const tick = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
};

const cardOrder = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("[data-slide-card]")).map((c) => c.getAttribute("data-slide-card") ?? "");
const cardOf = (id: string) => doc.querySelector<HTMLElement>(`[data-slide-card="${id}"]`);
const stackEl = () => doc.querySelector<HTMLElement>("[data-slide-stack]");
const chipOf = (id: string) => doc.querySelector<HTMLElement>(`[data-slide-drag-chip="${id}"]`);
/** what the editor is showing: the main board's question text */
const shownQuestion = () => doc.querySelector<HTMLElement>(".slide-editable [data-el=\"question\"]")?.textContent ?? "";
const picker = () => doc.querySelector<HTMLElement>("[data-slide-picker]");
const pickerTrigger = () => doc.querySelector<HTMLElement>("[data-slide-picker-trigger]");
const pickerOptions = () => Array.from(doc.querySelectorAll<HTMLElement>("[data-slide-picker-option]"));
const undoBtn = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => (b.title ?? "").startsWith("Undo")) ?? null;
const redoBtn = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => (b.title ?? "").startsWith("Redo")) ?? null;

/**
 * jsdom has no layout, so the cards get explicit boxes: 120px tall, stacked
 * from y=100 with an 8px gap — the same way the layers suite feeds its rows.
 */
const CARD_H = 120;
const CARD_GAP = 8;
const CARD_TOP = 100;
const stubCardBoxes = () => {
  cardOrder().forEach((id, i) => {
    const top = CARD_TOP + i * (CARD_H + CARD_GAP);
    cardOf(id)!.getBoundingClientRect = () =>
      ({ left: 0, top, width: 218, height: CARD_H, right: 218, bottom: top + CARD_H, x: 0, y: top }) as DOMRect;
  });
};
const boxOf = (id: string) => {
  const i = cardOrder().indexOf(id);
  const top = CARD_TOP + i * (CARD_H + CARD_GAP);
  return { x: 109, y: top + CARD_H / 2, top, mid: top + CARD_H / 2, i };
};

/** press a card, cross the 4px threshold, hover `y` — the drag is live */
const startDrag = (id: string, y: number) => {
  stubCardBoxes();
  const b = boxOf(id);
  down(cardOf(id)!, b.x, b.y);
  held(asWin, b.x, b.y + 6); // past the threshold: the drag starts here
  held(asWin, b.x, y);
  return { x: b.x, y };
};
/** press a card, cross the threshold, hover `y`, release on the window */
const dragTo = async (id: string, y: number) => {
  const at = startDrag(id, y);
  up(asWin, at.x, at.y);
  await tick();
};
/** press + release + click, the way a browser delivers a plain click */
const clickCard = (id: string) => {
  stubCardBoxes();
  const b = boxOf(id);
  down(cardOf(id)!, b.x, b.y);
  up(cardOf(id)!, b.x, b.y);
  click(cardOf(id));
};

/* ---------------------------------- suite --------------------------------- */

export async function runSlideStackTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: { title: "MCQ", brandTop: "B", brandBottom: "", badge: "Q", logo: null, showLogo: false, showBanner: false },
      slides: [
        {
          id: "sl1",
          number: "1",
          question: "Alpha question one?",
          options: [
            { key: "A", text: "a1" },
            { key: "B", text: "b1" },
          ],
          answer: "A",
          scale: 1,
          showAnswer: false,
        },
        {
          id: "sl2",
          number: "2",
          question: "Beta question two?",
          options: [
            { key: "A", text: "a2" },
            { key: "B", text: "b2" },
          ],
          answer: null,
          scale: 1,
          showAnswer: false,
        },
        {
          id: "sl3",
          number: "3",
          question: "Gamma question three?",
          options: [
            { key: "A", text: "a3" },
            { key: "B", text: "b3" },
          ],
          answer: "B",
          scale: 1,
          showAnswer: false,
        },
      ],
    }),
  );

  let root: Root | null = null;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);

  act(() => {
    root = createRoot(doc.getElementById("root")!);
    root.render(createElement(App));
  });

  const base = cardOrder();
  out.push({
    name: "the rail lists every slide, top of the deck first",
    pass: base.join(",") === "sl1,sl2,sl3",
    detail: base.join(","),
  });
  out.push({
    name: "every card advertises the drag affordance",
    pass: base.every((id) => (cardOf(id)?.getAttribute("title") ?? "").includes("drag anywhere in the stack")),
    detail: String(cardOf("sl1")?.getAttribute("title")),
  });

  /* ------------------------- top-right slide selector ----------------------- */
  out.push({
    name: "slide selection is offered in the top-right corner of the editor",
    pass:
      !!picker() &&
      !!picker()?.closest("header") &&
      (pickerTrigger()?.textContent ?? "").includes("1 / 3"),
    detail: `picker=${!!picker()} in-header=${!!picker()?.closest("header")} label=${pickerTrigger()?.textContent}`,
  });

  click(pickerTrigger());
  out.push({
    name: "opening it lists the whole deck, one preview per slide",
    pass:
      doc.querySelector("[data-slide-picker-list]")?.getAttribute("role") === "listbox" &&
      pickerOptions().length === 3 &&
      pickerOptions().every((o) => o.getAttribute("role") === "option") &&
      pickerTrigger()?.getAttribute("aria-expanded") === "true",
    detail: `options=${pickerOptions().length} list=${!!doc.querySelector("[data-slide-picker-list]")}`,
  });
  out.push({
    name: "the list is sized to the room under it — it opens down the window, not to a fixed cap",
    pass: (() => {
      const list = doc.querySelector<HTMLElement>("[data-slide-picker-list]");
      const room = (win.innerHeight || 800) - 12;
      return list?.style.maxHeight === `${room}px`;
    })(),
    detail: `maxHeight=${doc.querySelector<HTMLElement>("[data-slide-picker-list]")?.style.maxHeight} window=${win.innerHeight}`,
  });
  out.push({
    name: "each option previews its slide and marks the answer state",
    pass:
      (pickerOptions()[0]?.textContent ?? "").includes("Alpha question one") &&
      (pickerOptions()[1]?.textContent ?? "").includes("no answer") &&
      (pickerOptions()[2]?.textContent ?? "").includes("answer set"),
    detail: pickerOptions().map((o) => o.textContent?.slice(0, 24)).join(" | "),
  });

  click(pickerOptions()[2]);
  out.push({
    name: "picking an option jumps the editor to that slide and closes the list",
    pass:
      shownQuestion().includes("Gamma question three") &&
      (pickerTrigger()?.textContent ?? "").includes("3 / 3") &&
      !doc.querySelector("[data-slide-picker-list]"),
    detail: `shown=${shownQuestion().slice(0, 24)} label=${pickerTrigger()?.textContent} list=${!!doc.querySelector("[data-slide-picker-list]")}`,
  });

  click(pickerTrigger());
  act(() => {
    doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  out.push({
    name: "Escape closes the picker list",
    pass: !doc.querySelector("[data-slide-picker-list]"),
    detail: String(!!doc.querySelector("[data-slide-picker-list]")),
  });

  click(pickerTrigger());
  mousedown(doc.querySelector("header h1"));
  out.push({
    name: "clicking away closes the picker list",
    pass: !doc.querySelector("[data-slide-picker-list]"),
    detail: String(!!doc.querySelector("[data-slide-picker-list]")),
  });

  // back to slide one for the rail tests
  click(pickerTrigger());
  click(pickerOptions()[0]);

  /* --------------------------- drag to reorder ------------------------------ */
  // carry the first card to the very bottom (below the last card's midpoint)
  const at = startDrag("sl1", boxOf("sl3").mid + 14);
  out.push({
    name: "while dragging, the rail shows the card being carried and its target slot",
    pass:
      stackEl()?.getAttribute("data-dragging") === "sl1" &&
      stackEl()?.getAttribute("data-drop-index") === "2" &&
      !!chipOf("sl1") &&
      (chipOf("sl1")?.textContent ?? "").includes("slot 3 of 3") &&
      cardOf("sl1")?.hasAttribute("data-slide-dragging"),
    detail: `dragging=${stackEl()?.getAttribute("data-dragging")} drop=${stackEl()?.getAttribute("data-drop-index")} chip=${!!chipOf("sl1")}`,
  });
  out.push({
    name: "the cards in between open the landing gap while the drag is live",
    pass:
      cardOf("sl2")?.style.transform === `translateY(-${CARD_H + CARD_GAP}px)` &&
      cardOf("sl3")?.style.transform === `translateY(-${CARD_H + CARD_GAP}px)`,
    detail: `sl2=${cardOf("sl2")?.style.transform} sl3=${cardOf("sl3")?.style.transform}`,
  });
  up(asWin, at.x, at.y);
  await tick();
  out.push({
    name: "dragging a card down lands it in exactly the slot the pointer hovered",
    pass: cardOrder().join(",") === "sl2,sl3,sl1",
    detail: `${base.join(",")} → ${cardOrder().join(",")}`,
  });
  out.push({
    name: "the drop preview is gone once the pointer is up",
    pass:
      !stackEl()?.hasAttribute("data-dragging") &&
      !doc.querySelector("[data-slide-drag-chip]") &&
      cardOrder().every((id) => !cardOf(id)?.style.transform),
    detail: `dragging=${stackEl()?.getAttribute("data-dragging")} chip=${!!doc.querySelector("[data-slide-drag-chip]")}`,
  });
  out.push({
    name: "the editor follows the slide you just carried",
    pass: shownQuestion().includes("Alpha question one") && (pickerTrigger()?.textContent ?? "").includes("3 / 3"),
    detail: `shown=${shownQuestion().slice(0, 24)}`,
  });

  // and carry it straight back to the top (above the first card's midpoint)
  await dragTo("sl1", boxOf("sl2").mid - 30);
  out.push({
    name: "dragging a card to the top of the stack brings it to slot one",
    pass: cardOrder().join(",") === "sl1,sl2,sl3",
    detail: cardOrder().join(","),
  });

  // a middle card carried across the others (top half of the first card)
  const beforeMid = cardOrder();
  await dragTo("sl2", boxOf("sl1").mid - 20);
  out.push({
    name: "a middle card can be carried across the others",
    pass: cardOrder().join(",") === "sl2,sl1,sl3",
    detail: `${beforeMid.join(",")} → ${cardOrder().join(",")}`,
  });

  /* ------------------------------- undo / redo ------------------------------ */
  const beforeUndo = cardOrder();
  click(undoBtn());
  out.push({
    name: "one drop is one undo step",
    pass: cardOrder().join(",") === "sl1,sl2,sl3",
    detail: `${beforeUndo.join(",")} → ${cardOrder().join(",")}`,
  });
  click(redoBtn());
  out.push({
    name: "…and redo puts the card back",
    pass: cardOrder().join(",") === beforeUndo.join(","),
    detail: cardOrder().join(","),
  });
  click(undoBtn());

  /* --------------------------- the drag is guarded -------------------------- */
  // a plain click selects the slide and reorders nothing
  let baseOrder = cardOrder();
  clickCard("sl2");
  out.push({
    name: "a click on a card selects that slide and reorders nothing",
    pass:
      cardOrder().join(",") === baseOrder.join(",") &&
      shownQuestion().includes("Beta question two") &&
      (pickerTrigger()?.textContent ?? "").includes("2 / 3"),
    detail: `shown=${shownQuestion().slice(0, 24)} order=${cardOrder().join(",")}`,
  });

  // a press that stays inside the 4px threshold is still a click
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const b = boxOf("sl2");
    down(cardOf("sl2")!, b.x, b.y);
    held(asWin, b.x + 1, b.y + 2); // 2.2px of travel: below the threshold
    up(asWin, b.x + 1, b.y + 2);
  }
  out.push({
    name: "sub-threshold movement reorders nothing",
    pass: cardOrder().join(",") === baseOrder.join(","),
    detail: `${baseOrder.join(",")} → ${cardOrder().join(",")}`,
  });

  // hover with no button held never reorders
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const b = boxOf("sl2");
    fire(cardOf("sl2")!, "pointermove", b.x, b.y, 0);
    fire(asWin, "pointermove", b.x, CARD_TOP + 2, 0);
    fire(asWin, "pointermove", b.x, CARD_TOP + 2, 1); // no press was ever armed
  }
  out.push({
    name: "movement without a press on a card reorders nothing",
    pass: cardOrder().join(",") === baseOrder.join(",") && !stackEl()?.hasAttribute("data-dragging"),
    detail: cardOrder().join(","),
  });

  // pointercancel abandons the drop
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const d0 = boxOf("sl1");
    const d1 = boxOf("sl3");
    down(cardOf("sl1")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.mid + 10);
    fire(asWin, "pointercancel", d1.x, d1.mid + 10, 0);
  }
  out.push({
    name: "pointercancel abandons the drop",
    pass: cardOrder().join(",") === baseOrder.join(",") && !stackEl()?.hasAttribute("data-dragging"),
    detail: `${baseOrder.join(",")} → ${cardOrder().join(",")}`,
  });

  // window blur mid-drag drops the gesture too
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const d0 = boxOf("sl1");
    const d1 = boxOf("sl3");
    down(cardOf("sl1")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.mid + 10);
    act(() => {
      win.dispatchEvent(new Event("blur"));
    });
  }
  out.push({
    name: "losing the window mid-drag abandons the drop",
    pass: cardOrder().join(",") === baseOrder.join(",") && !stackEl()?.hasAttribute("data-dragging"),
    detail: `${baseOrder.join(",")} → ${cardOrder().join(",")}`,
  });

  // a real release commits the drop, and nothing keeps moving afterwards
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const d0 = boxOf("sl2");
    const d1 = boxOf("sl1");
    down(cardOf("sl2")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.mid - 20);
    up(asWin, d1.x, d1.mid - 20);
  }
  await tick();
  const dropped = cardOrder();
  held(asWin, boxOf("sl2").x, CARD_TOP + 2);
  held(asWin, boxOf("sl2").x, CARD_TOP + 2000);
  out.push({
    name: "a real release commits the drop",
    pass: dropped.join(",") !== baseOrder.join(","),
    detail: `${baseOrder.join(",")} → ${dropped.join(",")}`,
  });
  out.push({
    name: "movement after pointer-up reorders nothing (no gesture leak)",
    pass: cardOrder().join(",") === dropped.join(","),
    detail: `${baseOrder.join(",")} → ${dropped.join(",")} → ${cardOrder().join(",")}`,
  });
  click(undoBtn());

  /* ----------------------- the release the card itself gets ------------------ */
  // The pressed card holds the pointer capture in a real browser, so ITS
  // onPointerUp is the handler the release runs through, long before the
  // session's window listener. It has to commit the drop, not abort it.
  baseOrder = cardOrder();
  stubCardBoxes();
  {
    const d0 = boxOf(baseOrder[0]);
    const d1 = boxOf(baseOrder[2]);
    down(cardOf(baseOrder[0])!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.mid + 10);
    up(cardOf(baseOrder[0])!, d1.x, d1.mid + 10); // ← released ON the carried card
  }
  await tick();
  out.push({
    name: "the release the captured card receives commits the drop (browser path)",
    pass: cardOrder().join(",") === [baseOrder[1], baseOrder[2], baseOrder[0]].join(","),
    detail: `${baseOrder.join(",")} → ${cardOrder().join(",")}`,
  });
  click(undoBtn());

  /* ----------------------- the card's quick-op buttons ---------------------- */
  {
    baseOrder = cardOrder();
    const btn = cardOf(baseOrder[0])?.querySelector<HTMLElement>('button[title="Move down"]');
    const b = boxOf(baseOrder[0]);
    if (btn) {
      down(btn, b.x + 60, b.y); // a press on the button must not arm a drag
      up(btn, b.x + 60, b.y);
      click(btn);
    }
    out.push({
      name: "a press on a card's quick-op button steps it instead of starting a drag",
      pass: !!btn && cardOrder().join(",") === [baseOrder[1], baseOrder[0], ...baseOrder.slice(2)].join(","),
      detail: `${baseOrder.join(",")} → ${cardOrder().join(",")}`,
    });
    click(undoBtn());
    out.push({
      name: "…the step is its own undo step",
      pass: cardOrder().join(",") === baseOrder.join(","),
      detail: cardOrder().join(","),
    });
  }

  /* ------------------------- the rail's selection boxes --------------------- */
  {
    const boxOfId = (id: string) => doc.querySelector<HTMLInputElement>(`[data-slide-select="${id}"]`);
    const tick = (id: string) => {
      act(() => {
        boxOfId(id)?.click();
      });
    };
    const selectAll = () => doc.querySelector<HTMLInputElement>("[data-slide-select-all]");
    const bulk = () => doc.querySelector<HTMLElement>("[data-slide-bulk]");
    const bulkCount = () => doc.querySelector<HTMLElement>("[data-slide-bulk-count]")?.textContent ?? "";
    const bulkBtn = (k: "duplicate" | "delete" | "clear") => doc.querySelector<HTMLElement>(`[data-slide-bulk-${k}]`);
    const tickedCards = () =>
      Array.from(doc.querySelectorAll<HTMLElement>("[data-slide-selected]")).map(
        (c) => c.getAttribute("data-slide-card") ?? "",
      );
    const currentCards = () =>
      Array.from(doc.querySelectorAll<HTMLElement>("[data-slide-current]")).map(
        (c) => c.getAttribute("data-slide-card") ?? "",
      );
    const scopeBtn = (label: RegExp) =>
      Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => label.test((b.textContent ?? "").trim())) ??
      null;
    const esc = () => {
      act(() => {
        doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
    };
    const clickCardWith = (id: string, init: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => {
      stubCardBoxes();
      const b = boxOf(id);
      down(cardOf(id)!, b.x, b.y);
      up(cardOf(id)!, b.x, b.y);
      act(() => {
        cardOf(id)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
      });
    };

    esc(); // the rail above ends with a slide open, and an open slide is ticked
    out.push({
      name: "every card carries a selection box and the header offers select-all",
      pass: base.every((id) => boxOfId(id)?.type === "checkbox") && selectAll()?.type === "checkbox" && !tickedCards().length,
      detail: `boxes=${base.filter((id) => !!boxOfId(id)).length} all=${!!selectAll()} ticked=${tickedCards().join(",")}`,
    });

    // the editor is on slide two before any extra box is ticked
    clickCard("sl2");
    const beforeTick = shownQuestion();
    tick("sl1");
    out.push({
      name: "ticking a box adds that slide without opening it",
      pass:
        tickedCards().join(",") === "sl1,sl2" &&
        boxOfId("sl1")!.checked &&
        shownQuestion() === beforeTick &&
        (pickerTrigger()?.textContent ?? "").includes("2 / 3"),
      detail: `ticked=${tickedCards().join(",")} shown=${shownQuestion().slice(0, 24)}`,
    });

    tick("sl3");
    out.push({
      name: "the bulk bar appears and counts the ticked slides",
      pass: !!bulk() && bulkCount() === "3 selected" && tickedCards().join(",") === "sl1,sl2,sl3",
      detail: `bulk=${!!bulk()} count=${bulkCount()} ticked=${tickedCards().join(",")}`,
    });

    out.push({
      name: "the rail's ticks drive the inspector's Selected-slides scope",
      pass:
        (scopeBtn(/^Selected \(3\)$/)?.textContent ?? "").trim() === "Selected (3)" &&
        /bg-amber-400/.test(scopeBtn(/^Selected \(3\)$/)?.className ?? ""),
      detail: `label=${scopeBtn(/^Selected/)?.textContent?.trim()} cls=${(scopeBtn(/^Selected/)?.className ?? "").slice(0, 60)}`,
    });

    // a press on a box must never arm the reorder drag
    baseOrder = cardOrder();
    stubCardBoxes();
    {
      const label = boxOfId("sl2")!.parentElement as HTMLElement;
      const b = boxOf("sl2");
      down(label, b.x, b.y);
      held(asWin, b.x, b.y + 60);
      up(asWin, b.x, b.y + 60);
    }
    out.push({
      name: "a press on a selection box never starts a drag",
      pass: cardOrder().join(",") === baseOrder.join(",") && !stackEl()?.hasAttribute("data-dragging"),
      detail: `${baseOrder.join(",")} → ${cardOrder().join(",")} dragging=${stackEl()?.getAttribute("data-dragging")}`,
    });

    act(() => {
      selectAll()!.click();
    });
    out.push({
      name: "the header box unticks a fully ticked deck",
      pass: !selectAll()!.checked && !tickedCards().length && !bulk(),
      detail: `checked=${selectAll()!.checked} ticked=${tickedCards().join(",")} bulk=${!!bulk()}`,
    });
    act(() => {
      selectAll()!.click();
    });
    out.push({
      name: "…and ticks the whole deck from an empty selection",
      pass: selectAll()!.checked && selectAll()!.indeterminate === false && tickedCards().join(",") === "sl1,sl2,sl3",
      detail: `checked=${selectAll()!.checked} ticked=${tickedCards().join(",")}`,
    });
    tick("sl2");
    out.push({
      name: "a partial selection leaves the header box indeterminate",
      pass: selectAll()!.indeterminate === true && !selectAll()!.checked && tickedCards().join(",") === "sl1,sl3",
      detail: `indeterminate=${selectAll()!.indeterminate} ticked=${tickedCards().join(",")}`,
    });

    esc();
    clickCardWith("sl2", { ctrlKey: true });
    clickCardWith("sl3", { ctrlKey: true });
    out.push({
      name: "Ctrl/⌘-click adds single cards to the selection",
      pass: tickedCards().join(",") === "sl2,sl3",
      detail: tickedCards().join(","),
    });
    clickCardWith("sl3", { ctrlKey: true });
    out.push({
      name: "…and unticks the card it is pressed on a second time",
      pass: tickedCards().join(",") === "sl2",
      detail: tickedCards().join(","),
    });

    clickCard("sl1");
    out.push({
      name: "opening a slide leaves that slide as the only ticked one",
      pass: tickedCards().join(",") === "sl1" && shownQuestion().includes("Alpha question one"),
      detail: `ticked=${tickedCards().join(",")} shown=${shownQuestion().slice(0, 24)}`,
    });
    clickCardWith("sl3", { shiftKey: true });
    out.push({
      name: "Shift-click selects the whole range between the anchor and the click",
      pass: tickedCards().join(",") === "sl1,sl2,sl3",
      detail: tickedCards().join(","),
    });

    esc();
    out.push({
      name: "Escape clears the selection and hides the bulk bar",
      pass: !tickedCards().length && !bulk(),
      detail: `ticked=${tickedCards().join(",")} bulk=${!!bulk()}`,
    });

    /* ---------------------- bulk duplicate / delete -------------------------- */
    tick("sl1");
    tick("sl2");
    const beforeBulk = cardOrder();
    click(bulkBtn("duplicate"));
    out.push({
      name: "the bulk bar duplicates every ticked slide, each copy after its original",
      pass:
        cardOrder().length === 5 &&
        cardOrder()[0] === "sl1" &&
        cardOrder()[2] === "sl2" &&
        cardOrder()[4] === "sl3",
      detail: `${beforeBulk.join(",")} → ${cardOrder().join(",")}`,
    });
    click(undoBtn());
    out.push({
      name: "one bulk duplicate is one undo step",
      pass: cardOrder().join(",") === "sl1,sl2,sl3",
      detail: cardOrder().join(","),
    });

    click(bulkBtn("delete"));
    out.push({
      name: "the bulk bar deletes every ticked slide in one step",
      pass: cardOrder().join(",") === "sl3" && !bulk(),
      detail: `${beforeBulk.join(",")} → ${cardOrder().join(",")}`,
    });
    click(undoBtn());
    out.push({
      name: "one bulk delete is one undo step",
      pass: cardOrder().join(",") === "sl1,sl2,sl3",
      detail: cardOrder().join(","),
    });

    /* ------------------- the open slide's animated border ------------------- */
    clickCard("sl2");
    out.push({
      name: "only the open slide wears the animated gradient border",
      pass:
        currentCards().join(",") === "sl2" &&
        cardOf("sl2")!.classList.contains("slide-card-current") &&
        base.every((id) => (id === "sl2" ? true : !cardOf(id)!.classList.contains("slide-card-current"))),
      detail: `current=${currentCards().join(",")} classes=${cardOf("sl2")!.className}`,
    });
    clickCard("sl3");
    out.push({
      name: "the border follows the editor from slide to slide",
      pass:
        currentCards().join(",") === "sl3" &&
        cardOf("sl3")!.classList.contains("slide-card-current") &&
        !cardOf("sl2")!.classList.contains("slide-card-current"),
      detail: `current=${currentCards().join(",")} sl2=${cardOf("sl2")!.classList.contains("slide-card-current")}`,
    });
    tick("sl1"); // a box tick never opens, so sl3 stays the open slide
    out.push({
      name: "a ticked card that is not open keeps its own selection border",
      pass:
        tickedCards().join(",") === "sl1,sl3" &&
        currentCards().join(",") === "sl3" &&
        !cardOf("sl1")!.classList.contains("slide-card-current") &&
        /border-sky-400/.test(cardOf("sl1")!.className),
      detail: `ticked=${tickedCards().join(",")} current=${currentCards().join(",")} sl1=${cardOf("sl1")!.className}`,
    });

    esc(); // a clean deck and an empty selection for the rest of the suite
  }

  /* ------------------------ a single-slide deck ----------------------------- */
  // delete two slides down to one: the rail must stop being a drag surface
  {
    const kill = (id: string) => {
      const btn = cardOf(id)?.querySelector<HTMLElement>('button[title="Delete slide"]');
      click(btn);
    };
    kill("sl1");
    kill(cardOrder()[0]);
    stubCardBoxes();
    const only = cardOrder()[0];
    const b = boxOf(only);
    down(cardOf(only)!, b.x, b.y);
    held(asWin, b.x, b.y + 12);
    up(asWin, b.x, b.y + 12);
    out.push({
      name: "with one slide left the rail is not a drag surface",
      pass:
        cardOrder().length === 1 &&
        !stackEl()?.hasAttribute("data-dragging") &&
        (cardOf(only)?.getAttribute("title") ?? "").includes("Click to open"),
      detail: `cards=${cardOrder().join(",")} dragging=${stackEl()?.getAttribute("data-dragging")}`,
    });
  }

  out.push({ name: "no uncaught errors in the slide-stack suite", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
