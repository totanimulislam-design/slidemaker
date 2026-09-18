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
import { addUpload, getUploads, removeUpload, clearUploads } from "../src/lib/uploads";

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
  ["images", "Uploads", "Uploads"],
  ["shapes", "Insert shapes", "Insert shapes"],
  ["layers", "Layers", "Layers"],
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
  // the Layers destination lists whatever is already selected, so opening it
  // must not outline anything by itself
  layers: null,
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
/** the layer rows of the Layers destination, top first */
const layerRows = () => Array.from(doc.querySelectorAll<HTMLElement>('aside [data-layer-list] [data-layer-row]'));
/** "Edit <destination> →" — the jump out of the Layers list */
const jumpButton = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("aside button")).find((b) =>
    /^Edit .+ →$/.test(b.textContent?.trim() ?? ""),
  ) ?? null;
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
    name: "navigation lists all 19 destinations, in order",
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
    detail: badToolbars.length ? `no toolbar for: ${badToolbars.join(", ")}` : `${NAV.length}/${NAV.length}`,
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
    name: "Uploads releases the element outline but keeps its panel",
    pass: overlayOf() === null && panelHeading() === "Uploads",
    detail: `overlay=${overlayOf()} panel=${panelHeading()}`,
  });

  out.push({
    name: "Uploads panel exposes upload files button",
    pass: !!doc.querySelector('aside input[type="file"][accept="image/*"]'),
    detail: "file input found",
  });

  // Adding an upload saves it here in the library
  act(() => {
    addUpload("data:image/svg+xml;utf8,<svg></svg>", 1, "test-pic.svg");
  });
  const uploadedCards = () => Array.from(doc.querySelectorAll('aside [title*="Click to add to slide"]'));
  out.push({
    name: "Uploaded elements save in the Uploads library",
    pass: uploadedCards().length >= 1,
    detail: `cards=${uploadedCards().length}`,
  });

  // Hovering / clicking delete button triggers confirmation and removes it like Canva
  const delBtn = doc.querySelector<HTMLButtonElement>('aside button[title="Delete from uploads"]');
  click(delBtn);
  const confirmDeleteBtn = Array.from(doc.querySelectorAll<HTMLButtonElement>("aside button")).find(
    (b) => b.textContent?.trim() === "Delete",
  );
  out.push({
    name: "Delete button on upload card prompts confirmation",
    pass: !!confirmDeleteBtn,
    detail: `confirmBtn=${!!confirmDeleteBtn}`,
  });

  click(confirmDeleteBtn);
  out.push({
    name: "Confirming delete removes the uploaded element from the library like Canva",
    pass: !getUploads().some((u) => u.name === "test-pic.svg"),
    detail: `uploads=${getUploads().map((u) => u.name).join(",")}`,
  });

  /* --------------------- the Layers destination ---------------------------- */
  click(doc.querySelector('aside nav button[data-nav="badge3"]'));
  click(doc.querySelector('aside nav button[data-nav="layers"]'));
  out.push({
    name: "Layers opens its own panel and keeps the badge selected",
    pass: panelHeading() === "Layers" && overlayOf() === "badge",
    detail: `panel=${panelHeading()} overlay=${overlayOf()}`,
  });
  out.push({
    name: "Layers lists every element and drawn item of the slide, top first",
    pass: layerRows().length >= 8 && layerRows()[0]?.getAttribute("data-layer-row") !== null,
    detail: layerRows().map((r) => r.getAttribute("data-layer-row")).join(","),
  });
  out.push({
    name: "Layers opens a related toolbar above the slide",
    pass: !!toolbar(),
    detail: String(toolbar()),
  });
  // picking a row selects it on the slide WITHOUT leaving the layers list
  click(doc.querySelector('aside [data-layer-row="element:title"]'));
  out.push({
    name: "clicking a layer row selects that element on the slide",
    pass: overlayOf() === "title" && panelHeading() === "Layers",
    detail: `overlay=${overlayOf()} panel=${panelHeading()}`,
  });
  out.push({
    name: "the selected layer row is marked in the list",
    pass: doc.querySelector('aside [data-layer-row="element:title"]')?.getAttribute("aria-selected") === "true",
    detail: String(doc.querySelector('aside [data-layer-row="element:title"]')?.getAttribute("aria-selected")),
  });
  // …and clicking the board keeps the list open while following the selection
  const q = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
  if (q) {
    fire(q, "pointerdown", 400, 400, 1);
    fire(q, "pointerup", 400, 400, 0);
  }
  out.push({
    name: "clicking the slide keeps the Layers list open and moves its selection",
    pass: panelHeading() === "Layers" && overlayOf() === "question",
    detail: `panel=${panelHeading()} overlay=${overlayOf()}`,
  });
  out.push({
    name: "the Layers list offers a one-click jump to the selected thing's panel",
    pass: !!jumpButton(),
    detail: jumpButton()?.textContent?.trim() ?? "missing",
  });
  click(jumpButton());
  out.push({
    name: "the jump button opens the destination that styles the selection",
    pass: panelHeading() === "Question text",
    detail: panelHeading(),
  });
  /**
   * Four tiles touch the options block (option bullet, its text, its colour,
   * the answer key), so the jump has to land on the same main tile a canvas
   * click opens — Option text — not whichever tile lists options first.
   */
  click(doc.querySelector('aside nav button[data-nav="layers"]'));
  click(doc.querySelector('aside [data-layer-row="element:options"]'));
  out.push({
    name: "an options layer jumps to Option text, the tile a board click opens",
    pass: jumpButton()?.textContent?.trim() === "Edit Option text →",
    detail: jumpButton()?.textContent?.trim() ?? "missing",
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
    name: "Uploads opens a related toolbar above the slide",
    pass: toolbar() === "insert tools" && !!doc.querySelector('.context-toolbar [aria-label="Add image files"]'),
    detail: String(toolbar()),
  });
  click(doc.querySelector('aside nav button[data-nav="shapes"]'));
  out.push({
    name: "Insert shapes opens its quick insert tools",
    pass: toolbar() === "insert tools" && !!doc.querySelector('.context-toolbar [aria-label="Rectangle"]'),
    detail: String(toolbar()),
  });

  /* --------- merged contents: one toolbar line per related part --------- */
  const optionLines = () =>
    Array.from(doc.querySelectorAll('.context-toolbar [role="toolbar"]')).map((t) =>
      t.getAttribute("aria-label"),
    );
  const OPTION_TRIO = "Option text tools|Option bullet tools|Text inside option bullet tools";
  for (const id of ["optionText", "optionBullet", "optionBulletText"]) {
    click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
    out.push({
      name: `${id} previews the tools of every merged option part, one line each`,
      pass: optionLines().join("|") === OPTION_TRIO,
      detail: optionLines().join(" | "),
    });
  }
  // the line whose part the open destination owns is highlighted
  click(doc.querySelector('aside nav button[data-nav="optionBullet"]'));
  out.push({
    name: "the destination's own line is highlighted in the stack",
    pass:
      doc
        .querySelector('.context-toolbar [aria-label="Option bullet tools"]')
        ?.classList.contains("ctx-pill-active") === true,
    detail: String(
      doc.querySelector('.context-toolbar [aria-label="Option bullet tools"]')?.className,
    ),
  });
  // a line toggle opens its deeper picker in the shared movable pop-up
  click(doc.querySelector('.context-toolbar [aria-label="Marker shape"]'));
  out.push({
    name: "a line toggle opens its picker in the shared pop-up",
    pass: pop()?.getAttribute("data-pop-panel") === "Marker shape",
    detail: String(pop()?.getAttribute("data-pop-panel")),
  });
  // and the same trio appears when an option is clicked on the slide itself
  const optRow = doc.querySelector<HTMLElement>('.slide-editable [data-el="options"] > div');
  if (optRow) {
    fire(optRow, "pointerdown", 500, 300, 1);
    fire(optRow, "pointerup", 500, 300, 0);
  }
  out.push({
    name: "clicking an option on the slide previews every merged part's tools",
    pass: optionLines().join("|") === OPTION_TRIO,
    detail: optionLines().join(" | "),
  });

  /* ------- merged contents: title, badges and the whole question block ----- */
  const lineLabels = () =>
    Array.from(doc.querySelectorAll('.context-toolbar [role="toolbar"]')).map((t) =>
      t.getAttribute("aria-label"),
    );
  const lineClass = (label: string) =>
    doc.querySelector(`.context-toolbar [aria-label="${label}"]`)?.className ?? "";
  /** each merged block with the lines its destinations must preview, in order */
  const BLOCKS: { navs: [string, string][]; lines: string[] }[] = [
    {
      navs: [
        ["titleText", "Title text tools"],
        ["titleBg", "Title background tools"],
      ],
      lines: ["Title text tools", "Title background tools"],
    },
    {
      navs: [
        ["badge1", "Badge 1 tools"],
        ["badge2", "Badge 2 tools"],
      ],
      lines: ["Badge 1 tools", "Badge 2 tools"],
    },
    {
      // the number bullet is detached in this fixture, so the stem is not merged
      navs: [
        ["questionBullet", "Question bullet tools"],
        ["bulletText", "Text inside question bullet tools"],
      ],
      lines: ["Question bullet tools", "Text inside question bullet tools"],
    },
  ];
  for (const block of BLOCKS) {
    for (const [id, own] of block.navs) {
      click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
      const got = lineLabels().join("|");
      out.push({
        name: `${id} previews every part of its merged block, one line each`,
        pass: got === block.lines.join("|"),
        detail: got,
      });
      out.push({
        name: `${id} highlights its own line and dims its siblings`,
        pass:
          lineClass(own).includes("ctx-pill-active") &&
          block.lines
            .filter((l) => l !== own)
            .every((l) => !lineClass(l).includes("ctx-pill-active")),
        detail: block.lines.map((l) => `${l}: ${lineClass(l)}`).join(" | "),
      });
    }
  }

  /* --- the stem joins the block while the bullet rides along with it ------- */
  click(doc.querySelector('aside nav button[data-nav="questionBullet"]'));
  const bulletDetach = () =>
    Array.from(doc.querySelectorAll<HTMLElement>("aside button")).find((b) =>
      b.textContent?.trim().startsWith("Bullet is a separate movable element"),
    ) ?? null;
  click(bulletDetach());
  const QUESTION_TRIO =
    "Question text tools|Question bullet tools|Text inside question bullet tools";
  for (const id of ["questionText", "questionBullet", "bulletText"]) {
    click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
    out.push({
      name: `${id} previews the whole merged question block while the bullet rides along`,
      pass: lineLabels().join("|") === QUESTION_TRIO,
      detail: lineLabels().join(" | "),
    });
  }

  /* --- a line's controls write that line's own part, never a sibling's ----- */
  click(doc.querySelector('aside nav button[data-nav="questionText"]'));
  // the stem's own span — the bullet graphic is a div beside it, so `> span`
  // always measures the question text, never the marker
  const stemSize = () =>
    parseFloat(
      doc.querySelector<HTMLElement>('.slide-editable [data-el="question"] > span')?.style.fontSize ?? "0",
    );
  const stemBefore = stemSize();
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Question size %"]'), "120");
  out.push({
    name: "the Question text line resizes the stem",
    pass: stemSize() > stemBefore && stemSize() > 0,
    detail: `${stemBefore}px → ${stemSize()}px`,
  });
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Question size %"]'), "100");

  click(doc.querySelector('aside nav button[data-nav="badge2"]'));
  const brandSizesNow = () =>
    Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div')).map(
      (d) => d.style.fontSize,
    );
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Badge 2 size"]'), "40");
  out.push({
    name: "the Badge 2 line resizes badge 2 only",
    pass: brandSizesNow()[0] === "31px" && brandSizesNow()[1] === "40px",
    detail: brandSizesNow().join(" / "),
  });
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Badge 2 size"]'), "19");

  /* --- the new lines' deeper pickers open in the shared movable pop-up ----- */
  click(doc.querySelector('aside nav button[data-nav="questionBullet"]'));
  click(doc.querySelector('.context-toolbar [aria-label="Bullet design"]'));
  out.push({
    name: "the question bullet line opens its bullet designs in the shared pop-up",
    pass: pop()?.getAttribute("data-pop-panel") === "Bullet design",
    detail: String(pop()?.getAttribute("data-pop-panel")),
  });
  click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));
  click(doc.querySelector('aside nav button[data-nav="titleBg"]'));
  click(doc.querySelector('.context-toolbar [aria-label="Banner shape"]'));
  out.push({
    name: "the title background line opens the banner shapes in the shared pop-up",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Banner shape" &&
      !!doc.querySelector('.context-toolbar [aria-label="Banner shape: Pill"]'),
    detail: String(pop()?.getAttribute("data-pop-panel")),
  });
  const bannerRadii = () =>
    Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="title"] div')).map(
      (d) => d.style.borderRadius,
    );
  click(doc.querySelector('.context-toolbar [aria-label="Banner shape: Pill"]'));
  out.push({
    name: "picking a banner shape repaints the title plate",
    pass: bannerRadii().includes("999px"),
    detail: bannerRadii().join(" / "),
  });
  click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));

  /* …and the stem leaves the block again once the bullet detaches ----------- */
  click(doc.querySelector('aside nav button[data-nav="questionBullet"]'));
  click(bulletDetach());
  click(doc.querySelector('aside nav button[data-nav="questionText"]'));
  out.push({
    name: "a detached bullet drops the stem out of the merged question block",
    pass: lineLabels().join("|") === "Text tools",
    detail: lineLabels().join(" | "),
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
