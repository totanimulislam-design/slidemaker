/**
 * Visibility & stepper suite.
 *
 * Two rules the whole editor hangs on, pinned here for EVERY surface that can
 * change them:
 *
 *   · one meaning for a visibility number — 100 = fully visible, 0 = invisible,
 *     on every text part, on a drawn shape and on the parts painted inside a
 *     merged block, from the inspector AND the toolbar line above the board;
 *   · the − / + steppers walk the whole range: every click moves the value by
 *     its own step (a .05 line spacing step included, in BOTH directions) and a
 *     size can be raised and lowered without a ceiling.
 *
 * The old failure this suite exists for: a .05 step was rounded to a tenth, so
 * "line spacing +" jumped 1.4 → 1.5 and "−" asked for 1.45 and was rounded
 * straight back to 1.5 — the minus button never moved anything at all.
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

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** React-controlled inputs only accept a write through the native setter */
const type = (el: HTMLInputElement | HTMLTextAreaElement | null, value: string) => {
  if (!el) return;
  const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
const aside = () => doc.querySelector<HTMLElement>("aside nav button[data-nav]")!.closest("aside") as HTMLElement;
const panelInput = (label: string) => aside().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
/** a toolbar control by its accessible name, optionally inside one merged line */
const barButton = (label: string, line?: string) =>
  doc.querySelector<HTMLElement>(`.context-toolbar ${line ? `[aria-label="${line}"] ` : ""}button[aria-label="${label}"]`);
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));
/** the number inside a toolbar stepper (by the stepper's own accessible name) */
const stepInput = (aria: string) =>
  Array.from(doc.querySelectorAll<HTMLElement>(".context-toolbar .ctx-step"))
    .find((s) => s.getAttribute("aria-label") === aria)
    ?.querySelector("input")?.value;
/** a stepper number in the inspector (the «NumberWithSlider» field of a part) */
const panelValue = (label: string) => aside().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)?.value;
/** click − / + and report the value the control now holds */
const walk = (dec: string, inc: string, times: number, read: () => string | undefined, first: "dec" | "inc") => {
  const seen: (string | undefined)[] = [];
  for (let i = 0; i < times; i++) {
    click(barButton(first === "dec" ? dec : inc));
    seen.push(read());
  }
  return seen;
};

const el = (sel: string) => doc.querySelector<HTMLElement>(`.slide-editable ${sel}`);
const brandLines = () => Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div'));
const stem = () => el('[data-el="question"] > span');
const bulletBox = () => el('[data-el="question"] > div');
const bulletNumber = () => el('[data-el="question"] > div > span');
const noteBox = () => el('[data-el="note"]');
const badgeGlyphs = () => el('[data-el="badge"] > span > span');
const optionMarker = () => {
  const outer = el('[data-el="options"] > div > span');
  const box = (outer ? Array.from(outer.children).filter((c) => c.tagName === "SPAN").pop() : null) as HTMLElement | null;
  const letter = (box?.querySelector(":scope > span") ?? null) as HTMLElement | null;
  return { box, letter };
};

export async function runVisibilityTests(): Promise<CaseResult[]> {
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
      theme: { brandTopSize: 31, brandBottomSize: 19, showNumber: true, showBullet: true },
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

  /* --------------- 100 = fully visible, 0 = invisible, everywhere ---------- */
  const parts: [string, string, () => HTMLElement | null | undefined][] = [
    ["badge1", "Badge 1 opacity", () => brandLines()[0]],
    ["badge2", "Badge 2 opacity", () => brandLines()[1]],
    ["badge3", "Badge 3 opacity", () => badgeGlyphs()],
    ["titleText", "Title text opacity", () => el('[data-el="title"] div[style*="font-size"]')],
    ["questionText", "Question text opacity", () => stem()],
    ["bulletText", "Question bullet text opacity", () => bulletNumber()],
    ["optionText", "Option text opacity", () => doc.querySelector<HTMLElement>('.slide-editable [data-el="options"] > div > span:not([style*="display: inline-flex"])')],
    ["optionBulletText", "Option bullet text opacity", () => optionMarker().letter],
    ["footnote", "Footnote opacity", () => noteBox()],
  ];
  const rows: string[] = [];
  let allParts = true;
  for (const [navId, label, node] of parts) {
    nav(navId);
    const field = panelInput(label);
    if (!field || panelValue(label) !== "100") allParts = false;
    type(field, "0");
    const gone = node()?.style.opacity === "0";
    if (!gone) allParts = false;
    type(field, "100");
    /* fully visible: an explicit 1, or no opacity at all for a part that was
       never touched */
    const back = !node()?.style.opacity || node()?.style.opacity === "1";
    if (!back) allParts = false;
    type(field, "40");
    const faded = node()?.style.opacity === "0.4";
    if (!faded) allParts = false;
    rows.push(`${navId}:${gone ? "0" : `✗${node()?.style.opacity}`}/${back ? "100" : "✗"}/${faded ? "40" : `✗${node()?.style.opacity}`}`);
  }
  out.push({
    name: "every text part reads 100 = fully visible: 0 hides it, 100 brings it back, 40 = 0.4",
    pass: allParts,
    detail: rows.join(" · "),
  });

  /* ------------------- the toolbar line: line spacing − / + --------------- */
  nav("questionText");
  click(barButton("Question text spacing"));
  const lineValues = [
    ...walk("Decrease Line spacing", "Increase Line spacing", 3, () => stepInput("Line spacing"), "inc"),
    ...walk("Decrease Line spacing", "Increase Line spacing", 4, () => stepInput("Line spacing"), "dec"),
  ];
  out.push({
    name: "line spacing ± moves .05 a click, BOTH ways (1.4 → 1.55 → back to 1.35)",
    pass: lineValues.join(",") === "1.45,1.5,1.55,1.5,1.45,1.4,1.35" && stem()?.style.lineHeight === "1.35",
    detail: `${lineValues.join(" → ")} · rendered ${stem()?.style.lineHeight}`,
  });
  /* the same for the merged block's own line-spacing writer */
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Line spacing"]'), "2.5");
  out.push({
    name: "a typed line spacing lands exactly (2.5, no rounding)",
    pass: stem()?.style.lineHeight === "2.5" && stepInput("Line spacing") === "2.5",
    detail: `${stepInput("Line spacing")} · rendered ${stem()?.style.lineHeight}`,
  });

  /* --------------------- the toolbar line: opacity − / + ------------------ */
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Opacity %"]'), "100");
  const opValues = [
    ...walk("Decrease Opacity %", "Increase Opacity %", 3, () => stepInput("Opacity %"), "dec"),
    ...walk("Decrease Opacity %", "Increase Opacity %", 4, () => stepInput("Opacity %"), "inc"),
  ];
  out.push({
    name: "opacity ± walks the full range (100 → 85 → 100) and stops at the ends",
    pass: opValues.join(",") === "95,90,85,90,95,100,100",
    detail: `${opValues.join(" → ")} · rendered ${stem()?.style.opacity || "fully visible"}`,
  });
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Opacity %"]'), "0");
  const stemGone = stem()?.style.opacity === "0";
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Opacity %"]'), "100");
  /* "fully visible" is an explicit 1 (the user asked for it), or no opacity at
     all for a part that was never faded */
  const drawn = (n?: HTMLElement) => !n?.style.opacity || n.style.opacity === "1";
  out.push({
    name: "typing 0 in the toolbar hides the part, typing 100 brings it back",
    pass: stemGone && drawn(stem()),
    detail: `0 → ${stemGone ? "hidden" : "still painted"} · 100 → ${stem()?.style.opacity || "fully visible"}`,
  });
  closePop();

  /* the options block's own line height walks its .05 steps as well */
  nav("optionText");
  click(barButton("Option bullet options") ?? null);
  const optLine = [
    ...walk("Decrease Option line height", "Increase Option line height", 2, () => stepInput("Option line height"), "inc"),
    ...walk("Decrease Option line height", "Increase Option line height", 3, () => stepInput("Option line height"), "dec"),
  ];
  out.push({
    name: "the option rows' line height ± steps .05 both ways (1.45 → 1.55 → 1.4)",
    pass: optLine.join(",") === "1.5,1.55,1.5,1.45,1.4",
    detail: optLine.join(" → "),
  });

  /* ------------------------ size: no ceiling, both ways -------------------- */
  const upMany = walk("Decrease Option text size", "Increase Option text size", 6, () => stepInput("Option text size"), "inc");
  const downMany = walk("Decrease Option text size", "Increase Option text size", 12, () => stepInput("Option text size"), "dec");
  const grew = upMany.every((v, i) => Number(v) === 30 + i + 1);
  const shrank = downMany.every((v, i) => Number(v) === 36 - (i + 1));
  out.push({
    name: "option text size ± climbs and drops one pixel a click, with no ceiling in the way",
    pass: grew && shrank,
    detail: `${upMany.join(" → ")} | ${downMany.join(" → ")}`,
  });
  /* a size far past any slider range still lands, from the toolbar and the panel */
  nav("titleText");
  click(barButton("Increase Title size"));
  out.push({
    name: "the title's toolbar stepper writes the deck field (54 → 55)",
    pass: stepInput("Title size") === "55" && !!el('[data-el="title"] div[style*="font-size: 55px"]'),
    detail: `${stepInput("Title size")} · rendered ${el('[data-el="title"]')?.innerHTML.match(/font-size: [^;]+/)?.[0]}`,
  });
  type(panelInput("Title text size"), "900");
  out.push({
    name: "…and the panel's field is unbounded (900px)",
    pass: !!el('[data-el="title"] div[style*="font-size: 900px"]'),
    detail: el('[data-el="title"]')?.innerHTML.match(/font-size: [^;]+/)?.[0],
  });
  type(panelInput("Title text size"), "54");
  type(panelInput("Title text opacity"), "55");

  /* ------------------- a drawn shape / text box: the same two -------------- */
  nav("shapes");
  click(doc.querySelector('.context-toolbar [aria-label="Text box"]') ?? doc.querySelector('.context-toolbar [aria-label="Text"]'));
  const shapeText = () => doc.querySelector<HTMLElement>(".slide-editable [data-shape] span[style]");
  const sizeUp = walk("Decrease font size", "Increase font size", 2, () => stepInput("Font size"), "inc");
  const sizeDown = walk("Decrease font size", "Increase font size", 4, () => stepInput("Font size"), "dec");
  out.push({
    name: "a text box's size ± moves both ways (no clamp)",
    pass: sizeUp.join(",") === "29,30" && sizeDown.join(",") === "29,28,27,26",
    detail: `${sizeUp.join(" → ")} | ${sizeDown.join(" → ")}`,
  });
  click(barButton("Spacing"));
  const shapeLine = [
    ...walk("Decrease Line height", "Increase Line height", 2, () => stepInput("Line height"), "inc"),
    ...walk("Decrease Line height", "Increase Line height", 3, () => stepInput("Line height"), "dec"),
  ];
  out.push({
    name: "a text box's line height ± steps .05 both ways (1.4 → 1.5 → 1.35)",
    pass: shapeLine.join(",") === "1.45,1.5,1.45,1.4,1.35" && shapeText()?.style.lineHeight === "1.35",
    detail: `${shapeLine.join(" → ")} · rendered ${shapeText()?.style.lineHeight}`,
  });
  const shapeOp = [
    ...walk("Decrease Opacity %", "Increase Opacity %", 2, () => stepInput("Opacity %"), "dec"),
    ...walk("Decrease Opacity %", "Increase Opacity %", 3, () => stepInput("Opacity %"), "inc"),
  ];
  out.push({
    name: "a text box's TEXT opacity ± works over the range (100 → 90 → 100)",
    pass: shapeOp.join(",") === "95,90,95,100,100",
    detail: `${shapeOp.join(" → ")} · rendered ${shapeText()?.style.opacity || "fully visible"}`,
  });
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Opacity %"]'), "0");
  const shapeGone = shapeText()?.style.opacity === "0";
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Opacity %"]'), "100");
  out.push({
    name: "the shape's text can be faded out completely and restored from the toolbar",
    pass: shapeGone && drawn(shapeText()),
    detail: `0 → ${shapeGone ? "hidden" : "painted"} · 100 → ${shapeText()?.style.opacity || "fully visible"}`,
  });
  /* the item itself has its own opacity, from 0 to 100 too */
  const itemOp = [
    ...walk("Decrease Item opacity %", "Increase Item opacity %", 2, () => stepInput("Item opacity %"), "dec"),
    ...walk("Decrease Item opacity %", "Increase Item opacity %", 3, () => stepInput("Item opacity %"), "inc"),
  ];
  const itemBox = () => doc.querySelector<HTMLElement>(".slide-editable [data-shape]");
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Item opacity %"]'), "0");
  const itemGone = itemBox()?.style.opacity === "0";
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Item opacity %"]'), "100");
  out.push({
    name: "the whole item fades 100 → 90 → 100 and right out at 0",
    /* a drawn item always paints an opacity, so "back to visible" reads as 1 */
    pass: itemOp.join(",") === "95,90,95,100,100" && itemGone && itemBox()?.style.opacity === "1",
    detail: `${itemOp.join(" → ")} · at 0 ${itemGone ? "hidden" : "painted"}`,
  });
  closePop();
  /* the inspector's own tab carries the same control for a text box */
  const textTab = Array.from(aside().querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.trim() === "Text");
  click(textTab);
  const shapeTextOpacity = aside().querySelector<HTMLInputElement>('input[aria-label="Text opacity (100 = fully visible)"]');
  const shapeTextRange = `${shapeTextOpacity?.min}–${shapeTextOpacity?.max}`;
  type(shapeTextOpacity, "0");
  const panelGone = shapeText()?.style.opacity === "0";
  type(aside().querySelector<HTMLInputElement>('input[aria-label="Text opacity (100 = fully visible)"]'), "100");
  out.push({
    name: "the shape panel's text opacity slider spans the full 0–100 and both ends land",
    pass: shapeTextRange === "0–100" && panelGone && drawn(shapeText()),
    detail: `${shapeTextRange} · at 0 ${panelGone ? "hidden" : "painted"}`,
  });

  /* ---------------- "for all": the other opacity controls reach 0 ---------- */
  const ranges: [string, () => HTMLInputElement | null | undefined][] = [];
  nav("footnote");
  ranges.push(["footnote opacity 5 → 0", () => aside().querySelector<HTMLInputElement>('input[type="range"]')]);
  nav("titleBg");
  ranges.push(["banner opacity 10 → 0", () => aside().querySelector<HTMLInputElement>('input[type="range"]')]);
  nav("badge1");
  ranges.push(["badge plate opacity 5 → 0", () => aside().querySelector<HTMLInputElement>('input[type="range"]')]);
  const mins = ranges.map(([label, get]) => {
    const input = get();
    return `${label.split(" ")[0]} ${input?.min ?? "?"}`;
  });
  out.push({
    name: "every other opacity control starts at 0 (footnote · banner · badge plate)",
    pass: ranges.every(([, get]) => get()?.min === "0"),
    detail: mins.join(" · "),
  });

  /* ------------------ the effects' own opacity keeps its look --------------- */
  nav("badge3");
  click(aside().querySelector<HTMLElement>('button[aria-label="Text effect: Shadow"]'));
  const shadowOpacity = aside().querySelector<HTMLInputElement>('input[aria-label="Shadow Opacity"]');
  const shadowOf = () => el('[data-el="badge"]')?.style.textShadow ?? "";
  const shadow = shadowOf();
  out.push({
    name: "the shadow effect's opacity reads 60 by default (the shade it always painted)",
    pass: shadowOpacity?.value === "60" && shadow.includes("rgba(0, 0, 0, 0.6)"),
    detail: `${shadowOpacity?.value} · ${shadow}`,
  });
  type(shadowOpacity, "100");
  out.push({
    name: "…and 100 is a fully solid copy, 0 clears it away",
    pass: shadowOf().includes("rgba(0, 0, 0, 1)"),
    detail: shadowOf(),
  });
  type(aside().querySelector<HTMLInputElement>('input[aria-label="Shadow Opacity"]'), "0");
  out.push({
    name: "shadow opacity 0 paints no shadow at all",
    pass: shadowOf().includes("rgba(0, 0, 0, 0)"),
    detail: shadowOf(),
  });
  click(aside().querySelector<HTMLElement>('button[aria-label="Text effect: None"]'));

  out.push({ name: "no uncaught errors while fading and stepping", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => root?.unmount());
  doc.getElementById("root")!.innerHTML = "";
  localStorage.removeItem("mcq-slide-studio-v2");
  return out;
}
