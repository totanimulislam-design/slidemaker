/**
 * Layers suite.
 *
 * The "Layers" navigation destination is ONE list for everything painted on a
 * slide — built-in elements AND drawn shapes / text boxes / images — sharing a
 * single stacking order, top first. These tests pin what it promises:
 *
 *   1. the list mirrors the stack the board actually paints;
 *   2. clicking a row selects that shape / text on the slide, and clicking the
 *      slide moves the list's selection — neither leaves the panel;
 *   3. rows are draggable: a real drag lands the layer in exactly the slot the
 *      pointer hovered (elements and drawn items alike), with the rows in
 *      between making room, while a click, a sub-threshold press, a hover, a
 *      hidden row, pointercancel and any movement after pointer-up reorder
 *      nothing;
 *   4. one drop is one undo step.
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

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

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

const key = (t: EventTarget, k: string, init: Record<string, unknown> = {}) => {
  act(() => {
    t.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  });
};

const asWin = win as unknown as EventTarget;
const down = (t: EventTarget, x: number, y: number) => fire(t, "pointerdown", x, y, 1);
const held = (t: EventTarget, x: number, y: number) => fire(t, "pointermove", x, y, 1);
const up = (t: EventTarget, x: number, y: number) => fire(t, "pointerup", x, y, 0);

const navButton = (id: string) => doc.querySelector<HTMLElement>(`aside nav button[data-nav="${id}"]`);
const panelHeading = () => doc.querySelector("aside h2")?.textContent?.trim() ?? "";
const overlayOf = () =>
  doc.querySelector('.slide-editable [data-el-overlay]')?.getAttribute("data-el-overlay") ?? null;
const shapeSelOf = () => doc.querySelector(".slide-editable [data-sel]")?.getAttribute("data-sel") ?? null;

const listEl = () => doc.querySelector<HTMLElement>("aside [data-layer-list]");
const rows = () => Array.from(doc.querySelectorAll<HTMLElement>("aside [data-layer-list] [data-layer-row]"));
const rowOf = (k: string) => doc.querySelector<HTMLElement>(`aside [data-layer-row="${k}"]`);
const rowKeys = () => rows().map((r) => r.getAttribute("data-layer-row") ?? "");
/** the rows that can be reordered — built-ins the slide does not have are not */
const liveKeys = () =>
  rows().filter((r) => !r.hasAttribute("data-layer-absent")).map((r) => r.getAttribute("data-layer-row") ?? "");
/** rows for built-ins this slide does not paint at all (no logo, empty footnote) */
const absentKeys = () => rowKeys().filter((k) => rowOf(k)?.hasAttribute("data-layer-absent"));
/** rows the user hid with 👁 — still in the stack, just not painted */
const hiddenKeys = () => rowKeys().filter((k) => rowOf(k)?.hasAttribute("data-layer-hidden"));
/** rows the user locked with 🔒 */
const lockedKeys = () => rowKeys().filter((k) => rowOf(k)?.hasAttribute("data-layer-locked"));
/** a row's action button, by its accessible name prefix */
const rowBtn = (k: string, prefix: string) =>
  Array.from(rowOf(k)?.querySelectorAll<HTMLElement>("button") ?? []).find((b) =>
    (b.getAttribute("title") ?? "").startsWith(prefix),
  ) ?? null;
/** is the layer painted on the board right now? */
const paintedOnBoard = (k: string): boolean => {
  const kind = k.slice(0, k.indexOf(":"));
  const id = k.slice(k.indexOf(":") + 1);
  const el = doc.querySelector<HTMLElement>(
    kind === "element" ? `.slide-editable [data-el="${id}"]` : `.slide-editable [data-shape="${id}"]`,
  );
  return !!el && el.style.display !== "none";
};
const selectedRow = () =>
  rows().find((r) => r.getAttribute("aria-selected") === "true")?.getAttribute("data-layer-row") ?? null;
const order = () => liveKeys().join(",");

/** the toolbar rows above the board, in order — one per related part */
const toolbarRows = () =>
  Array.from(doc.querySelectorAll<HTMLElement>('.context-toolbar [role="toolbar"]')).map(
    (t) => t.getAttribute("aria-label") ?? "",
  );
/** …without the arrange row the Layers destination adds beside them */
const toolbarLines = () => toolbarRows().filter((l) => l !== "Arrange tools");
/** the line the toolbar highlights as the one you are editing */
const activeLine = () =>
  Array.from(doc.querySelectorAll<HTMLElement>('.context-toolbar [role="toolbar"]')).find((t) =>
    t.className.includes("ctx-pill-active"),
  )?.getAttribute("aria-label") ?? "";
/** the painted size of the title glyphs (the Title text line writes it) */
const titlePx = () =>
  Math.max(
    ...Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="title"] div')).map((d) =>
      parseFloat(d.style.fontSize || "0"),
    ),
  );
/** typing into a toolbar stepper, the way a user edits the value */
const type = (el: HTMLInputElement | null | undefined, v: string) => {
  if (!el) return;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

/** the z the board paints a layer at: elements and shapes share one number line */
const paintedZ = (k: string): number => {
  const kind = k.slice(0, k.indexOf(":"));
  const id = k.slice(k.indexOf(":") + 1);
  const el = doc.querySelector<HTMLElement>(
    kind === "element" ? `.slide-editable [data-el="${id}"]` : `.slide-editable [data-shape="${id}"]`,
  );
  return Number(el?.style.zIndex ?? "0");
};
/** the painted order agrees with the list, top first */
const paintMatchesList = (keys: string[]) => keys.every((k, i) => i === 0 || paintedZ(keys[i - 1]) >= paintedZ(k));

/**
 * jsdom has no layout, so the rows get explicit boxes: 24px tall, stacked from
 * y=200 in DOM order. The panel measures these when a drag starts, exactly like
 * a browser measures the real list.
 */
const ROW_H = 24;
const ROW_TOP = 200;
const stubRowBoxes = () => {
  rows().forEach((r, i) => {
    const top = ROW_TOP + i * ROW_H;
    r.getBoundingClientRect = () =>
      ({ left: 900, top, width: 320, height: ROW_H, right: 1220, bottom: top + ROW_H, x: 900, y: top }) as DOMRect;
  });
};

/** a row's box, by key */
const boxOf = (k: string) => {
  const i = rows().findIndex((r) => r.getAttribute("data-layer-row") === k);
  return { x: 940, y: ROW_TOP + i * ROW_H + ROW_H / 2, top: ROW_TOP + i * ROW_H, i };
};

/**
 * What a drop must produce: the dragged row takes the slot the pointer hovered
 * (`targetKey`'s index), every other row keeps its relative order.
 */
const afterDrag = (before: string[], dragKey: string, targetKey: string): string[] => {
  const at = before.indexOf(targetKey);
  const rest = before.filter((k) => k !== dragKey);
  return [...rest.slice(0, at), dragKey, ...rest.slice(at)];
};

/** press a row, cross the 4px threshold, hover the TOP HALF of `toKey` */
const startDrag = (fromKey: string, toKey: string) => {
  stubRowBoxes();
  const from = boxOf(fromKey);
  const to = boxOf(toKey);
  down(rowOf(fromKey)!, from.x, from.y);
  held(asWin, from.x, from.y + 6); // past the threshold: the drag starts here
  held(asWin, to.x, to.top + 2); // upper half → this row's slot
  return { x: to.x, y: to.top + 2 };
};
const dragRow = (fromKey: string, toKey: string) => {
  const at = startDrag(fromKey, toKey);
  up(asWin, at.x, at.y);
};

/** press + release + click, the way a browser delivers a plain click */
const clickRow = (k: string) => {
  stubRowBoxes();
  const b = boxOf(k);
  down(rowOf(k)!, b.x, b.y);
  up(rowOf(k)!, b.x, b.y);
  click(rowOf(k));
};

const undoBtn = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => (b.title ?? "").startsWith("Undo")) ?? null;
const redoBtn = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("button")).find((b) => (b.title ?? "").startsWith("Redo")) ?? null;

/* ---------------------------------- suite --------------------------------- */

export async function runLayersTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: {
        title: "MCQ",
        brandTop: "LEARN WITH",
        brandBottom: "",
        badge: "DAKHIL-26",
        logo: null,
        showLogo: false, // → the logo row exists but is hidden (not on this slide)
        showBanner: true,
      },
      theme: { showBullet: false }, // → no bullet row on the board either
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?",
          note: "",
          options: [
            { key: "ক", text: "5" },
            { key: "খ", text: "6" },
          ],
          answer: "ক",
          scale: 1,
          showAnswer: false,
          shapes: [
            {
              id: "sh1", kind: "rect", x: 10, y: 60, w: 20, h: 12, rot: 0, z: 10,
              fill: "#2f4fff", fillOpacity: 1, stroke: "", strokeWidth: 0, dash: false,
              text: "", textColor: "#fff", fontSize: 20, bold: false, italic: false,
              align: "center", valign: "middle",
            },
            {
              id: "sh2", kind: "text", x: 40, y: 60, w: 24, h: 10, rot: 0, z: 11,
              fill: "", fillOpacity: 0, stroke: "", strokeWidth: 0, dash: false,
              text: "Hello layer", textColor: "#fff", fontSize: 22, bold: false, italic: false,
              align: "center", valign: "middle",
            },
          ],
        },
      ],
      globalShapes: [
        {
          id: "g1", kind: "ellipse", x: 70, y: 20, w: 16, h: 16, rot: 0, z: 12,
          fill: "#f59e0b", fillOpacity: 1, stroke: "", strokeWidth: 0, dash: false,
          text: "", textColor: "#fff", fontSize: 20, bold: false, italic: false,
          align: "center", valign: "middle",
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

  /* ------------------------- the destination itself ------------------------ */
  click(navButton("layers"));
  out.push({
    name: "Layers is a navigation destination with its own panel",
    pass: panelHeading() === "Layers" && !!listEl(),
    detail: `heading=${panelHeading()} list=${!!listEl()}`,
  });

  const first = liveKeys();
  out.push({
    name: "the list carries every element and drawn item of the slide, top first",
    pass:
      first.length === 8 &&
      ["element:brand", "element:title", "element:badge", "element:question", "element:options"].every((k) =>
        first.includes(k),
      ) &&
      ["shape:sh1", "shape:sh2", "shape:g1"].every((k) => first.includes(k)) &&
      first[0] === "shape:g1" &&
      first[first.length - 1] === "element:brand",
    detail: first.join(","),
  });
  out.push({
    name: "the list order is the order the board paints (descending z)",
    pass: paintMatchesList(first),
    detail: first.map((k) => `${k.split(":")[1]}=${paintedZ(k)}`).join(" "),
  });
  out.push({
    name: "built-ins that are not on this slide are listed but marked absent",
    pass: absentKeys().length === 3 && liveKeys().length < rowKeys().length,
    detail: absentKeys().join(","),
  });
  out.push({
    name: "every row carries a live preview of what that layer is",
    pass: rows().every((r) => !!r.querySelector("[data-layer-thumb]")),
    detail: `${rows().filter((r) => !!r.querySelector("[data-layer-thumb]")).length}/${rows().length} rows`,
  });
  out.push({
    name: "the list is a listbox of selectable options",
    pass:
      listEl()?.getAttribute("role") === "listbox" &&
      rows().every((r) => r.getAttribute("role") === "option") &&
      rows().filter((r) => r.tabIndex === 0).length === 1,
    detail: `${listEl()?.getAttribute("role")} / tabstops=${rows().filter((r) => r.tabIndex === 0).length}`,
  });
  out.push({
    name: "every live row advertises the drag affordance",
    pass: liveKeys().every((k) => (rowOf(k)?.title ?? "").includes("Drag to reorder")),
    detail: String(rowOf(first[0])?.title),
  });
  out.push({
    name: "a drawn item on every slide is marked ALL in the list",
    pass: (rowOf("shape:g1")?.textContent ?? "").includes("ALL") && !(rowOf("shape:sh1")?.textContent ?? "").includes("ALL"),
    detail: String(rowOf("shape:g1")?.textContent),
  });

  /* --------------------- click a row → select it on the slide --------------- */
  const baseOrder = order();
  clickRow("shape:sh2");
  out.push({
    name: "clicking a drawn item's row selects that text box on the slide",
    pass: shapeSelOf() === "sh2" && overlayOf() === null,
    detail: `shape=${shapeSelOf()} overlay=${overlayOf()}`,
  });
  out.push({
    name: "…and the Layers panel stays open with that row selected",
    pass: panelHeading() === "Layers" && selectedRow() === "shape:sh2",
    detail: `panel=${panelHeading()} selected=${selectedRow()}`,
  });
  out.push({
    name: "selecting a layer leaves the stack alone",
    pass: order() === baseOrder,
    detail: `${baseOrder} → ${order()}`,
  });

  clickRow("element:question");
  out.push({
    name: "clicking an element's row outlines that element on the slide",
    pass: overlayOf() === "question" && selectedRow() === "element:question" && shapeSelOf() === null,
    detail: `overlay=${overlayOf()} selected=${selectedRow()} shape=${shapeSelOf()}`,
  });

  /* ------- a row previews every merged part of the layer it selects -------- */
  /**
   * The Layers destination styles nothing itself — it lists the board — so the
   * toolbar above the slide takes its merged block from the SELECTION: the
   * "Title" row previews the title text AND its banner, exactly like the Title
   * text destination does, with the row's own part highlighted.
   */
  const MERGED: [row: string, lines: string[], own: string][] = [
    ["element:title", ["Title text tools", "Title background tools"], "Title text tools"],
    ["element:brand", ["Badge 1 tools", "Badge 2 tools"], "Badge 1 tools"],
    [
      "element:question",
      ["Question text tools", "Question bullet tools", "Text inside question bullet tools"],
      "Question text tools",
    ],
    ["element:options", ["Option text tools", "Option bullet tools", "Text inside option bullet tools"], "Option text tools"],
  ];
  for (const [row, lines, own] of MERGED) {
    clickRow(row);
    const got = toolbarLines();
    out.push({
      name: `picking ${row} previews every merged part of that layer above the slide`,
      pass: got.join("|") === lines.join("|") && panelHeading() === "Layers",
      detail: `${got.join(" | ")} · panel=${panelHeading()}`,
    });
    out.push({
      name: `${row} highlights its own part and leaves the Layers panel open`,
      pass: activeLine() === own && panelHeading() === "Layers" && selectedRow() === row,
      detail: `active=${activeLine()} panel=${panelHeading()} selected=${selectedRow()}`,
    });
    out.push({
      name: `${row} keeps the arrange tools the Layers destination is for`,
      pass: toolbarRows().includes("Arrange tools"),
      detail: toolbarRows().join(" | "),
    });
  }

  /* …and a line picked from the list still restyles its OWN part only */
  clickRow("element:title");
  const titleBefore = titlePx();
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Title size"]'), "80");
  out.push({
    name: "a line picked from the Layers list still restyles its own part",
    pass: titlePx() > titleBefore && titlePx() > 0,
    detail: `${titleBefore}px → ${titlePx()}px`,
  });
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Title size"]'), "54");

  /* a layer with no merged siblings (Badge, Footnote) keeps the plain toolbar */
  clickRow("element:badge");
  out.push({
    name: "a layer that is not part of a merged block keeps the plain toolbar",
    pass: toolbarLines().join("|") === "Text tools",
    detail: toolbarLines().join(" | "),
  });
  clickRow("element:question");

  /* ------------------- click the slide → the list follows ------------------- */
  const titleEl = doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
  if (titleEl) {
    fire(titleEl, "pointerdown", 400, 90, 1);
    fire(titleEl, "pointerup", 400, 90, 0);
  }
  out.push({
    name: "selecting an element on the slide moves the list's selection, panel stays",
    pass: panelHeading() === "Layers" && selectedRow() === "element:title" && overlayOf() === "title",
    detail: `panel=${panelHeading()} selected=${selectedRow()} overlay=${overlayOf()}`,
  });

  const shapeEl = doc.querySelector<HTMLElement>('.slide-editable [data-shape="sh1"]');
  if (shapeEl) {
    fire(shapeEl, "pointerdown", 200, 500, 1);
    fire(shapeEl, "pointerup", 200, 500, 0);
  }
  out.push({
    name: "…and so does clicking a drawn shape on the board",
    pass: selectedRow() === "shape:sh1" && panelHeading() === "Layers",
    detail: `selected=${selectedRow()} panel=${panelHeading()}`,
  });

  /* ------------------------------ drag to reorder --------------------------- */
  // a drawn item dropped onto a slide element's slot (down the list = further back)
  let before = liveKeys();
  let at = startDrag("shape:sh1", "element:title");
  out.push({
    name: "while dragging, the list shows the row being carried and the gap it will land in",
    pass:
      listEl()?.getAttribute("data-dragging") === "shape:sh1" &&
      !!doc.querySelector('[data-layer-drag-chip="shape:sh1"]') &&
      // dragging DOWN the list: the rows it passes slide up to fill the hole
      rowOf("element:title")?.style.transform === `translateY(-${ROW_H}px)` &&
      rowOf("shape:g1")?.style.transform === "" &&
      rowOf("shape:sh1")?.getAttribute("data-layer-dragging") === "true",
    detail: `chip=${!!doc.querySelector('[data-layer-drag-chip="shape:sh1"]')} title=${rowOf("element:title")?.style.transform}`,
  });
  up(asWin, at.x, at.y);
  let after = liveKeys();
  out.push({
    name: "dragging a row down lands it in exactly the slot the pointer hovered",
    pass: after.join(",") === afterDrag(before, "shape:sh1", "element:title").join(","),
    detail: `${before.join(",")} → ${after.join(",")}`,
  });
  out.push({
    name: "the drop is written to the stack the board paints",
    pass: paintMatchesList(after) && paintedZ("shape:sh1") < paintedZ("element:title"),
    detail: after.map((k) => `${k.split(":")[1]}=${paintedZ(k)}`).join(" "),
  });
  out.push({
    name: "the drag preview is gone once the pointer is up",
    pass:
      !listEl()?.hasAttribute("data-dragging") &&
      !doc.querySelector("[data-layer-drag-chip]") &&
      rows().every((r) => !r.style.transform),
    detail: `dragging=${listEl()?.getAttribute("data-dragging")}`,
  });
  out.push({
    name: "the dragged row stays selected after the drop",
    pass: selectedRow() === "shape:sh1",
    detail: String(selectedRow()),
  });

  // and back up to the very front
  before = liveKeys();
  dragRow("shape:sh1", "shape:g1");
  after = liveKeys();
  out.push({
    name: "dragging a row to the top of the list brings that layer to front",
    pass:
      after.join(",") === afterDrag(before, "shape:sh1", "shape:g1").join(",") &&
      after[0] === "shape:sh1" &&
      paintedZ("shape:sh1") > paintedZ("shape:g1"),
    detail: `${before.join(",")} → ${after.join(",")} | z sh1=${paintedZ("shape:sh1")} g1=${paintedZ("shape:g1")}`,
  });

  // a slide element across drawn items and other elements
  before = liveKeys();
  dragRow("element:options", "element:brand");
  after = liveKeys();
  out.push({
    name: "a slide element can be dragged across drawn items and other elements",
    pass:
      after.join(",") === afterDrag(before, "element:options", "element:brand").join(",") &&
      after[after.length - 1] === "element:options" &&
      paintedZ("element:options") < paintedZ("element:brand"),
    detail: `${before.join(",")} → ${after.join(",")}`,
  });

  // dropping past the last row sends the layer to the back
  before = liveKeys();
  stubRowBoxes();
  {
    const from = boxOf("shape:g1");
    down(rowOf("shape:g1")!, from.x, from.y);
    held(asWin, from.x, from.y + 6);
    held(asWin, from.x, ROW_TOP + rows().length * ROW_H + 40); // below every row
    up(asWin, from.x, ROW_TOP + rows().length * ROW_H + 40);
  }
  after = liveKeys();
  out.push({
    name: "dropping below the last row sends the layer to the back",
    pass:
      after[after.length - 1] === "shape:g1" &&
      paintedZ("shape:g1") <= Math.min(...after.slice(0, -1).map(paintedZ)),
    detail: `${before.join(",")} → ${after.join(",")}`,
  });

  /* ------------------------------- undo / redo ------------------------------ */
  const beforeUndo = order();
  click(undoBtn());
  out.push({
    name: "one drop is one undo step",
    pass: order() === before.join(","),
    detail: `${beforeUndo} → ${order()} (wanted ${before.join(",")})`,
  });
  click(redoBtn());
  out.push({
    name: "…and redo puts the layer back",
    pass: order() === beforeUndo,
    detail: order(),
  });
  click(undoBtn());

  /* --------------------------- the drag is guarded -------------------------- */
  // a plain click never reorders
  let base = order();
  clickRow("shape:sh2");
  out.push({
    name: "a click on a row selects it and reorders nothing",
    pass: order() === base && selectedRow() === "shape:sh2",
    detail: `selected=${selectedRow()} order=${order()}`,
  });

  // a press that stays inside the 4px threshold is still a click
  base = order();
  stubRowBoxes();
  {
    const b = boxOf("shape:sh2");
    down(rowOf("shape:sh2")!, b.x, b.y);
    held(asWin, b.x + 1, b.y + 2); // 2.2px of travel: below the threshold
    up(asWin, b.x + 1, b.y + 2);
  }
  out.push({
    name: "sub-threshold movement reorders nothing",
    pass: order() === base,
    detail: `${base} → ${order()}`,
  });

  // hover with no button held never reorders
  base = order();
  stubRowBoxes();
  {
    const b = boxOf("shape:sh2");
    fire(rowOf("shape:sh2")!, "pointermove", b.x, b.y, 0);
    fire(asWin, "pointermove", b.x, ROW_TOP + 2, 0);
    fire(asWin, "pointermove", b.x, ROW_TOP + 2, 1); // no press was ever armed
  }
  out.push({
    name: "movement without a press on a row reorders nothing",
    pass: order() === base && !listEl()?.hasAttribute("data-dragging"),
    detail: order(),
  });

  // a built-in the slide does not have cannot be dragged
  base = order();
  const absentKey = absentKeys()[0];
  stubRowBoxes();
  {
    const h = boxOf(absentKey);
    const t = boxOf("element:question");
    down(rowOf(absentKey)!, h.x, h.y);
    held(asWin, t.x, t.y + 6);
    held(asWin, t.x, t.top + 2);
    up(asWin, t.x, t.top + 2);
  }
  out.push({
    name: "a layer that is not on this slide cannot be dragged",
    pass: order() === base && rowOf(absentKey)?.getAttribute("title") === "Not on this slide — nothing to reorder",
    detail: `${absentKey} → ${order()}`,
  });

  // pointercancel abandons the drop
  base = order();
  stubRowBoxes();
  {
    const d0 = boxOf("shape:sh2");
    const d1 = boxOf("element:brand");
    down(rowOf("shape:sh2")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.top + 2);
    fire(asWin, "pointercancel", d1.x, d1.top + 2, 0);
  }
  out.push({
    name: "pointercancel abandons the drop",
    pass: order() === base && !listEl()?.hasAttribute("data-dragging"),
    detail: `${base} → ${order()}`,
  });

  // a cancel the row itself receives abandons the drop too (never commits)
  base = order();
  stubRowBoxes();
  {
    const d0 = boxOf("shape:g1");
    const d1 = boxOf("element:brand");
    down(rowOf("shape:g1")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.top + 2);
    fire(rowOf("shape:g1")!, "pointercancel", d1.x, d1.top + 2, 0); // ← on the row
  }
  out.push({
    name: "a cancel the captured row receives abandons the drop",
    pass: order() === base && !listEl()?.hasAttribute("data-dragging"),
    detail: `${base} → ${order()}`,
  });

  // window blur mid-drag drops the gesture too
  base = order();
  stubRowBoxes();
  {
    const d0 = boxOf("shape:sh2");
    const d1 = boxOf("element:brand");
    down(rowOf("shape:sh2")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.top + 2);
    act(() => {
      win.dispatchEvent(new Event("blur"));
    });
  }
  out.push({
    name: "losing the window mid-drag abandons the drop",
    pass: order() === base && !listEl()?.hasAttribute("data-dragging"),
    detail: `${base} → ${order()}`,
  });

  // nothing keeps moving after a completed release
  base = order();
  stubRowBoxes();
  {
    const d0 = boxOf("shape:g1");
    const d1 = boxOf("element:brand");
    down(rowOf("shape:g1")!, d0.x, d0.y);
    held(asWin, d0.x, d0.y + 8);
    held(asWin, d1.x, d1.top + 2);
    up(asWin, d1.x, d1.top + 2);
  }
  const dropped = order();
  held(asWin, boxOf("shape:g1").x, ROW_TOP + 2);
  held(asWin, boxOf("shape:g1").x, ROW_TOP + 40 * ROW_H);
  out.push({
    name: "movement after pointer-up reorders nothing (no gesture leak)",
    pass: dropped !== base && order() === dropped,
    detail: `${base} → ${dropped} → ${order()}`,
  });
  click(undoBtn());

  // the row's own quick-op buttons step the layer instead of starting a drag
  base = order();
  stubRowBoxes();
  {
    const forwardBtn = rowOf("shape:sh2")?.querySelector<HTMLElement>('button[title="Bring Forward"]');
    const b = boxOf("shape:sh2");
    const zBefore = paintedZ("shape:sh2");
    if (forwardBtn) {
      down(forwardBtn, b.x + 60, b.y);
      held(asWin, b.x + 60, ROW_TOP + 2);
      up(forwardBtn, b.x + 60, ROW_TOP + 2);
      click(forwardBtn);
    }
    out.push({
      name: "a press on a row's ▲ button steps it forward instead of starting a drag",
      pass: !!forwardBtn && paintedZ("shape:sh2") > zBefore,
      detail: `btn=${!!forwardBtn} z=${zBefore}→${paintedZ("shape:sh2")} order=${base}→${order()}`,
    });
  }
  click(undoBtn());

  // the lock button still locks (a press on it must not arm a drag)
  {
    const lockBtn = rowBtn("shape:sh2", "Lock");
    click(lockBtn);
    out.push({
      name: "a row's lock button still locks the item",
      pass: !!lockBtn && !!rowBtn("shape:sh2", "Unlock") && lockedKeys().includes("shape:sh2"),
      detail: `btn=${!!lockBtn} locked=${lockedKeys().join(",")}`,
    });
    click(rowBtn("shape:sh2", "Unlock"));
    out.push({
      name: "…and unlocks it again",
      pass: !lockedKeys().includes("shape:sh2"),
      detail: lockedKeys().join(","),
    });
  }

  /* --------------------------- keyboard reordering -------------------------- */
  base = order();
  key(rowOf("shape:sh2")!, "ArrowUp", { altKey: true });
  out.push({
    name: "Alt+↑ on a focused row brings that layer forward without a pointer",
    pass: order() !== base && paintedZ("shape:sh2") > paintedZ("shape:g1"),
    detail: `${base} → ${order()}`,
  });
  click(undoBtn());
  out.push({
    name: "the keyboard step is its own undo step",
    pass: order() === base,
    detail: order(),
  });
  key(rowOf("shape:sh2")!, "ArrowDown", { altKey: true });
  out.push({
    name: "Alt+↓ sends it backward again",
    pass: order() !== base,
    detail: `${base} → ${order()}`,
  });
  click(undoBtn());

  /* -------------------------- hide / show a layer --------------------------- */
  click(navButton("layers"));
  base = order();
  click(rowBtn("shape:sh1", "Hide"));
  out.push({
    name: "👁 hides a drawn item: the board stops painting it",
    pass: hiddenKeys().includes("shape:sh1") && !paintedOnBoard("shape:sh1"),
    detail: `hidden=${hiddenKeys().join(",")} painted=${paintedOnBoard("shape:sh1")}`,
  });
  out.push({
    name: "…but it keeps its slot in the stack (Canva behaviour)",
    pass: order() === base && liveKeys().includes("shape:sh1"),
    detail: `${base} → ${order()}`,
  });
  // a hidden layer is still fully draggable
  before = liveKeys();
  dragRow("shape:sh1", "element:brand");
  out.push({
    name: "a hidden layer can still be dragged to a new slot",
    pass: liveKeys().join(",") === afterDrag(before, "shape:sh1", "element:brand").join(","),
    detail: `${before.join(",")} → ${liveKeys().join(",")}`,
  });
  click(undoBtn());
  click(rowBtn("shape:sh1", "Show"));
  out.push({
    name: "👁 again shows it",
    pass: !hiddenKeys().includes("shape:sh1") && paintedOnBoard("shape:sh1"),
    detail: `hidden=${hiddenKeys().join(",")} painted=${paintedOnBoard("shape:sh1")}`,
  });

  // the same toggle works on a built-in slide element
  click(rowBtn("element:title", "Hide"));
  out.push({
    name: "👁 hides a built-in element too, and the board follows",
    pass: hiddenKeys().includes("element:title") && !paintedOnBoard("element:title"),
    detail: `hidden=${hiddenKeys().join(",")} painted=${paintedOnBoard("element:title")}`,
  });
  click(undoBtn());
  out.push({
    name: "hiding a layer is one undo step",
    pass: !hiddenKeys().includes("element:title") && paintedOnBoard("element:title"),
    detail: hiddenKeys().join(","),
  });

  /* ----------------------------- lock a layer ------------------------------- */
  click(rowBtn("element:question", "Lock"));
  out.push({
    name: "🔒 locks a built-in element",
    pass: lockedKeys().includes("element:question"),
    detail: lockedKeys().join(","),
  });
  {
    // a locked element must not move when dragged on the board
    const qEl = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
    const x0 = qEl?.style.left ?? "";
    if (qEl) {
      fire(qEl, "pointerdown", 300, 300, 1);
      held(asWin, 380, 360);
      up(asWin, 380, 360);
    }
    out.push({
      name: "…and a locked element cannot be dragged on the board",
      pass: (doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]')?.style.left ?? "") === x0,
      detail: `left ${x0} → ${doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]')?.style.left}`,
    });
    out.push({
      name: "…but it still selects, so it can be unlocked again",
      pass: overlayOf() === "question" && !!doc.querySelector('[data-el-locked="true"]'),
      detail: `overlay=${overlayOf()}`,
    });
  }
  click(rowBtn("element:question", "Unlock"));
  out.push({
    name: "🔒 again unlocks it",
    pass: !lockedKeys().includes("element:question"),
    detail: lockedKeys().join(","),
  });

  /* ------------------------------- duplicate -------------------------------- */
  {
    const n = liveKeys().length;
    click(rowBtn("shape:sh2", "Duplicate"));
    const grown = liveKeys();
    out.push({
      name: "⧉ duplicates a drawn item into its own new layer",
      pass: grown.length === n + 1,
      detail: `${n} → ${grown.length} rows`,
    });
    out.push({
      name: "…and the clone becomes the selection",
      pass: !!selectedRow() && selectedRow() !== "shape:sh2" && selectedRow()!.startsWith("shape:"),
      detail: String(selectedRow()),
    });
    click(undoBtn());
    out.push({
      name: "duplicating is one undo step",
      pass: liveKeys().length === n,
      detail: `${liveKeys().length} rows`,
    });
  }

  /* --------------------------------- delete --------------------------------- */
  {
    const n = liveKeys().length;
    click(rowBtn("shape:sh2", "Delete"));
    out.push({
      name: "🗑 deletes a drawn item's layer",
      pass: liveKeys().length === n - 1 && !liveKeys().includes("shape:sh2"),
      detail: `${n} → ${liveKeys().length} rows`,
    });
    click(undoBtn());
    out.push({
      name: "…and undo brings it back",
      pass: liveKeys().includes("shape:sh2"),
      detail: liveKeys().join(","),
    });
    // a built-in element cannot be deleted — it is hidden instead
    click(rowBtn("element:badge", "Hide Badge"));
    out.push({
      name: "🗑 on a built-in element hides it instead of deleting the row",
      pass: hiddenKeys().includes("element:badge") && rowKeys().includes("element:badge"),
      detail: `hidden=${hiddenKeys().join(",")}`,
    });
    click(undoBtn());
  }

  /* --------------------------------- rename --------------------------------- */
  {
    const row = rowOf("shape:sh1")!;
    act(() => {
      row.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
    const input = row.querySelector<HTMLInputElement>("input");
    out.push({
      name: "double-clicking a drawn item's row opens a rename box",
      pass: !!input,
      detail: `input=${!!input}`,
    });
    if (input) {
      act(() => {
        input.value = "Backdrop";
        input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });
    }
    out.push({
      name: "…and the new name sticks on the row",
      pass: (rowOf("shape:sh1")?.textContent ?? "").includes("Backdrop"),
      detail: String(rowOf("shape:sh1")?.textContent),
    });
    click(undoBtn());
  }

  /* -------------------- several layers dragged as one block ----------------- */
  {
    clickRow("shape:sh1");
    stubRowBoxes();
    const b = boxOf("shape:sh2");
    act(() => {
      rowOf("shape:sh2")!.dispatchEvent(
        new win.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }),
      );
    });
    void b;
    const picked = rows().filter((r) => r.className.includes("sky-400")).length;
    out.push({
      name: "Ctrl+click adds a second layer to the selection",
      pass: picked >= 1,
      detail: `${picked} extra row(s) marked`,
    });
    before = liveKeys();
    dragRow("shape:sh1", "element:brand");
    after = liveKeys();
    const bothMoved =
      after.indexOf("shape:sh1") > before.indexOf("shape:sh1") && after.indexOf("shape:sh2") > before.indexOf("shape:sh2");
    out.push({
      name: "dragging one of them carries the whole selection as a block",
      pass: bothMoved && Math.abs(after.indexOf("shape:sh1") - after.indexOf("shape:sh2")) === 1,
      detail: `${before.join(",")} → ${after.join(",")}`,
    });
    click(undoBtn());
    clickRow("shape:sh1");
  }

  /* --------------------- the same list inside Insert shapes ----------------- */
  click(navButton("shapes"));
  clickRow("shape:sh1");
  out.push({
    name: "Insert shapes still carries the same unified layer list",
    pass: panelHeading() === "Insert shapes" && !!listEl() && liveKeys().length === 8,
    detail: `panel=${panelHeading()} rows=${liveKeys().length}`,
  });
  out.push({
    name: "picking a row there opens the panel that styles it",
    pass: panelHeading() === "Insert shapes" && shapeSelOf() === "sh1",
    detail: `panel=${panelHeading()} shape=${shapeSelOf()}`,
  });
  before = liveKeys();
  dragRow("shape:sh1", "element:question");
  after = liveKeys();
  out.push({
    name: "…and its rows are draggable too",
    pass: after.join(",") === afterDrag(before, "shape:sh1", "element:question").join(","),
    detail: `${before.join(",")} → ${after.join(",")}`,
  });

  /**
   * The release the row itself receives — the path a REAL browser takes, since
   * the pressed row holds the pointer capture: React's `onPointerUp` on the row
   * runs on the way up, long before the session's window listener. It has to
   * commit the drop, not abort it. (Last, because it moves the stack the tests
   * above pin down.)
   */
  before = liveKeys();
  stubRowBoxes();
  {
    const from = boxOf(before[0]);
    const to = boxOf(before[3]);
    down(rowOf(before[0])!, from.x, from.y);
    held(asWin, from.x, from.y + 6);
    held(asWin, to.x, to.top + 2);
    up(rowOf(before[0])!, to.x, to.top + 2); // ← released ON the row, like a browser
  }
  after = liveKeys();
  out.push({
    name: "the release the captured row receives commits the drop (browser path)",
    pass: after.join(",") === afterDrag(before, before[0], before[3]).join(","),
    detail: `${before.join(",")} → ${after.join(",")}`,
  });

  out.push({ name: "no uncaught errors in the layers suite", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
