/**
 * Navigation suite.
 *
 * The inspector's navigation is one destination per restylable thing on a
 * slide. These tests pin the two guarantees the redesign makes:
 *
 *   1. every destination exists, in the documented order, and opens its own
 *      panel;
 *   2. picking a destination also SELECTS the matching content on the slide —
 *      an element gets its outline + handles, a surface gets its own context
 *      toolbar, and the insert tabs release the element selection.
 *
 * Plus the reverse direction (clicking content on the canvas opens its panel)
 * and the new per-element typography fields actually reaching the slide DOM.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/** navigation order + the heading each destination must open */
const NAV: [id: string, label: string, heading: string][] = [
  ["titleText", "Title text", "Title text"],
  ["titleBg", "Title background", "Title background"],
  ["badge1", "Badge 1", "Badge 1"],
  ["badge2", "Badge 2", "Badge 2"],
  ["badge3", "Badge 3", "Badge 3"],
  ["logo", "Logo", "Logo"],
  ["questionBullet", "Question bullet", "Question bullet"],
  ["bulletText", "Q bullet text", "Text inside question bullet"],
  ["questionText", "Question text", "Question text"],
  ["optionBullet", "Option bullet", "Option Bullet"],
  ["optionBulletText", "Opt bullet text", "Text inside option bullet"],
  ["optionText", "Option text", "Option text"],
  ["answerKey", "Answer key", "Answer key"],
  ["footnote", "Footnote", "Footnote"],
  ["background", "Slide background", "Slide background"],
  ["frame", "Slide frame", "Slide frame"],
  ["images", "Insert images", "Insert images"],
  ["shapes", "Insert shapes", "Insert shapes"],
];

/** nav id → the board element it must select on the slide */
const SELECTS: Record<string, string | null> = {
  titleText: "title",
  titleBg: "title",
  badge1: "brand",
  badge2: "brand",
  badge3: "badge",
  logo: "logo",
  questionBullet: "bullet",
  bulletText: "bullet",
  questionText: "question",
  optionBullet: "options",
  optionBulletText: "options",
  optionText: "options",
  answerKey: "options",
  footnote: "note",
  background: null,
  frame: null,
  images: null,
  shapes: null,
};

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** React-controlled inputs only accept a write through the native setter */
const type = (el: HTMLInputElement | HTMLTextAreaElement | null, value: string) => {
  if (!el) return;
  const proto =
    el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
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

const navButtons = () => Array.from(doc.querySelectorAll<HTMLElement>("aside nav button[data-nav]"));
const panelHeading = () => doc.querySelector("aside h2")?.textContent?.trim() ?? "";
const overlayOf = () =>
  doc.querySelector('.slide-editable [data-el-overlay]')?.getAttribute("data-el-overlay") ?? null;
const toolbar = () => doc.querySelector('.context-toolbar [role="toolbar"]')?.getAttribute("aria-label") ?? null;

/** the first inline font-size inside an element box (the box itself or its text node) */
const fontSizeIn = (sel: string): string => {
  const root = doc.querySelector<HTMLElement>(`.slide-editable ${sel}`);
  if (!root) return "";
  if (root.style.fontSize) return root.style.fontSize;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (el.style.fontSize) return el.style.fontSize;
  }
  return "";
};

/** a Field's control, found by its caption */
const fieldControl = (caption: string): HTMLInputElement | HTMLTextAreaElement | null => {
  const span = Array.from(doc.querySelectorAll<HTMLElement>("aside label > span")).find((s) =>
    s.textContent?.trim().startsWith(caption),
  );
  return (span?.closest("label")?.querySelector("input, textarea") ?? null) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
};

export async function runNavTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: {
        title: "MCQ",
        brandTop: "LEARN WITH",
        brandBottom: "FAYSAL SIR",
        badge: "DAKHIL-26",
        logo: DEFAULT_LOGO,
        showLogo: true,
        showBanner: true,
      },
      theme: {
        // new per-element typography fields must reach the slide DOM
        titleSize: 70,
        badgeSize: 44,
        brandTopSize: 31,
        brandBottomSize: 19,
        noteSize: 26,
        bulletSeparate: true,
        showNumber: true,
      },
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?",
          note: "বোর্ড: ঢাকা ২০২৪",
          options: [
            { key: "ক", text: "5" },
            { key: "খ", text: "6" },
          ],
          answer: "ক",
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

  /* ------------------------------- the nav itself -------------------------- */
  const ids = navButtons().map((b) => b.getAttribute("data-nav"));
  out.push({
    name: "navigation lists all 18 destinations, in order",
    pass: ids.length === NAV.length && NAV.every(([id], i) => ids[i] === id),
    detail: ids.join(","),
  });

  const labels = navButtons().map((b) => b.textContent?.trim());
  out.push({
    name: "every destination shows a compact icon + label",
    pass: NAV.every(([, label], i) => labels[i]?.includes(label)),
    detail: labels.join(" | "),
  });

  /* ------------------------- each destination opens ------------------------ */
  const badPanels: string[] = [];
  const badSelections: string[] = [];
  const badToolbars: string[] = [];
  for (const [id, , heading] of NAV) {
    click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
    if (panelHeading() !== heading) badPanels.push(`${id}→"${panelHeading()}"`);
    const want = SELECTS[id];
    const got = overlayOf();
    if (want !== got) badSelections.push(`${id}: want ${want} got ${got}`);
    // every destination — element, surface or insert/answer — puts its related
    // tools in the toolbar above the slide
    const bar = toolbar();
    if (!bar) badToolbars.push(id);
  }
  out.push({
    name: "each destination opens its own panel",
    pass: badPanels.length === 0,
    detail: badPanels.join(" | "),
  });
  out.push({
    name: "each destination selects the matching content on the slide",
    pass: badSelections.length === 0,
    detail: badSelections.join(" | "),
  });
  out.push({
    name: "every destination opens a related toolbar above the slide",
    pass: badToolbars.length === 0,
    detail: badToolbars.length ? `no toolbar for: ${badToolbars.join(", ")}` : "18/18",
  });

  /* ------------------------- surfaces get their toolbar -------------------- */
  click(doc.querySelector('aside nav button[data-nav="background"]'));
  out.push({ name: "Slide background selects the background surface", pass: toolbar() === "background tools", detail: String(toolbar()) });
  click(doc.querySelector('aside nav button[data-nav="frame"]'));
  out.push({ name: "Slide frame selects the frame surface", pass: toolbar() === "frame tools", detail: String(toolbar()) });

  /* -------------------- insert tabs release the outline -------------------- */
  click(doc.querySelector('aside nav button[data-nav="badge3"]'));
  click(doc.querySelector('aside nav button[data-nav="images"]'));
  out.push({
    name: "Insert images releases the element outline but keeps its panel",
    pass: overlayOf() === null && panelHeading() === "Insert images",
    detail: `overlay=${overlayOf()} panel=${panelHeading()}`,
  });

  /* ---------------- the Answer key destination and its tools --------------- */
  click(doc.querySelector('aside nav button[data-nav="answerKey"]'));
  out.push({ name: "Answer key opens its own panel", pass: panelHeading() === "Answer key", detail: panelHeading() });
  out.push({
    name: "Answer key outlines the options block on the slide",
    pass: overlayOf() === "options",
    detail: String(overlayOf()),
  });
  out.push({
    name: "Answer key opens a related toolbar above the slide",
    pass: toolbar() === "answer tools",
    detail: String(toolbar()),
  });

  const answerOption = (key: string) =>
    doc.querySelector<HTMLElement>(`aside [data-answer-option="${key}"]`);
  click(answerOption("খ"));
  out.push({
    name: "the panel marks the correct choice for the slide",
    pass:
      answerOption("খ")?.getAttribute("aria-pressed") === "true" &&
      answerOption("ক")?.getAttribute("aria-pressed") === "false",
    detail: `খ=${answerOption("খ")?.getAttribute("aria-pressed")} ক=${answerOption("ক")?.getAttribute("aria-pressed")}`,
  });

  /** the revealed answer paints the correct option text in the "answer green" */
  const answerInk = () =>
    Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] *'))
      .map((el) => el.style.color)
      .filter(Boolean)
      .join(" ");
  const revealed = () => /5cff9d|92,\s*255,\s*157/i.test(answerInk());
  const revealBtn = () =>
    doc.querySelector<HTMLElement>('.context-toolbar [aria-label="Reveal / hide the answer on this slide"]');

  click(revealBtn());
  out.push({
    name: "the toolbar reveal toggle paints the answer on the slide",
    pass: revealBtn()?.getAttribute("aria-pressed") === "true" && revealed(),
    detail: `pressed=${revealBtn()?.getAttribute("aria-pressed")} ink=${answerInk().slice(0, 60)}`,
  });
  click(revealBtn());
  out.push({
    name: "clicking it again hides the answer",
    pass: revealBtn()?.getAttribute("aria-pressed") === "false" && !revealed(),
    detail: `pressed=${revealBtn()?.getAttribute("aria-pressed")} ink=${answerInk().slice(0, 60)}`,
  });

  const keyRow = doc.querySelector<HTMLElement>('aside [data-key-row="sl1"]');
  out.push({
    name: "the deck-key overview lists every slide with its answer",
    pass: !!keyRow && /খ/.test(keyRow.textContent ?? ""),
    detail: keyRow?.textContent ?? "",
  });
  const pasteBtn = Array.from(doc.querySelectorAll<HTMLElement>("aside button")).find((b) =>
    b.textContent?.includes("Paste answers"),
  );
  out.push({
    name: "the panel exposes the paste-answers dialog",
    pass: !!pasteBtn,
    detail: pasteBtn?.textContent ?? "",
  });

  /* --------------------- the toolbar pop-up is movable --------------------- */
  click(doc.querySelector('.context-toolbar [aria-label="Answer"]'));
  const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
  const head = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop-head");
  out.push({
    name: "the toolbar pop-up opens under the pill",
    pass: pop()?.getAttribute("data-pop-panel") === "Answer",
    detail: String(pop()?.getAttribute("data-pop-panel")),
  });

  // a press that stays inside the 4px threshold is a click, never a drag
  fire(head()!, "pointerdown", 300, 120, 1);
  fire(head()!, "pointermove", 302, 121, 1);
  fire(head()!, "pointerup", 302, 121, 0);
  out.push({
    name: "a click on the pop-up header does not move the panel",
    pass: (pop()?.style.left ?? "") === "",
    detail: `left=${pop()?.style.left} position=${pop()?.style.position}`,
  });

  fire(head()!, "pointerdown", 300, 120, 1);
  fire(head()!, "pointermove", 380, 200, 1);
  fire(head()!, "pointerup", 380, 200, 0);
  out.push({
    name: "dragging the pop-up header moves the panel",
    pass:
      // the floating class is what lifts the card out of its centred default
      !!pop()?.classList.contains("ctx-pop-floating") &&
      parseFloat(pop()?.style.left ?? "0") === 80 &&
      parseFloat(pop()?.style.top ?? "0") === 80,
    detail: `floating=${pop()?.classList.contains("ctx-pop-floating")} left=${pop()?.style.left} top=${pop()?.style.top}`,
  });

  act(() => {
    head()?.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  });
  out.push({
    name: "double-clicking the header re-centres the pop-up",
    pass: (pop()?.style.left ?? "x") === "",
    detail: `left=${pop()?.style.left}`,
  });

  /* ------------------ the insert destinations get tools too ---------------- */
  click(doc.querySelector('aside nav button[data-nav="images"]'));
  out.push({
    name: "Insert images opens a related toolbar above the slide",
    pass: toolbar() === "insert tools" && !!doc.querySelector('.context-toolbar [aria-label="Add image files"]'),
    detail: String(toolbar()),
  });
  click(doc.querySelector('aside nav button[data-nav="shapes"]'));
  out.push({
    name: "Insert shapes opens its quick insert tools",
    pass: toolbar() === "insert tools" && !!doc.querySelector('.context-toolbar [aria-label="Rectangle"]'),
    detail: String(toolbar()),
  });

  /* --------------------- reverse sync: canvas → nav ------------------------ */
  const title = doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
  if (title) {
    fire(title, "pointerdown", 400, 90, 1);
    fire(title, "pointerup", 400, 90, 0);
  }
  out.push({
    name: "clicking the title on the slide opens Title text",
    pass: panelHeading() === "Title text",
    detail: panelHeading(),
  });

  const brand = doc.querySelector<HTMLElement>('.slide-editable [data-el="brand"]');
  if (brand) {
    fire(brand, "pointerdown", 200, 80, 1);
    fire(brand, "pointerup", 200, 80, 0);
  }
  out.push({
    name: "clicking the brand block on the slide opens Badge 1",
    pass: panelHeading() === "Badge 1",
    detail: panelHeading(),
  });

  /* ------------------- Badge 1 / Badge 2 write their own line -------------- */
  click(doc.querySelector('aside nav button[data-nav="badge1"]'));
  type(fieldControl("Badge 1 text"), "STUDY WITH");
  const lines = () =>
    Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div')).map(
      (d) => d.textContent?.trim(),
    );
  out.push({
    name: "Badge 1 edits the upper brand line only",
    pass: lines()[0] === "STUDY WITH" && lines()[1] === "FAYSAL SIR",
    detail: lines().join(" / "),
  });

  click(doc.querySelector('aside nav button[data-nav="badge2"]'));
  type(fieldControl("Badge 2 text"), "RAHMAN SIR");
  out.push({
    name: "Badge 2 edits the lower brand line only",
    pass: lines()[0] === "STUDY WITH" && lines()[1] === "RAHMAN SIR",
    detail: lines().join(" / "),
  });

  /* ------------------- new typography fields reach the DOM ----------------- */
  out.push({
    name: "title size override reaches the slide",
    pass: fontSizeIn('[data-el="title"]') === "70px",
    detail: fontSizeIn('[data-el="title"]'),
  });
  out.push({
    name: "badge size override reaches the slide",
    pass: fontSizeIn('[data-el="badge"]') === "44px",
    detail: fontSizeIn('[data-el="badge"]'),
  });
  const brandSizes = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div')).map(
    (d) => d.style.fontSize,
  );
  out.push({
    name: "each brand line keeps its own size",
    pass: brandSizes[0] === "31px" && brandSizes[1] === "19px",
    detail: brandSizes.join(" / "),
  });
  out.push({
    name: "footnote size override reaches the slide",
    pass: fontSizeIn('[data-el="note"]') === "26px",
    detail: fontSizeIn('[data-el="note"]'),
  });

  out.push({ name: "no uncaught errors while navigating", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
