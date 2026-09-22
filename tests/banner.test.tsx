/**
 * Title background suite.
 *
 * The toolbar's Title background line is one button per channel, in the order a
 * plate is dressed: Design presets · Shape · Effects · Fill · Border ·
 * Border radius · Border style · Border weight · Transparency · Banner size ·
 * Banner position · show/hide · Default.
 *
 * These tests pin that order, and then walk every channel to the slide:
 * the fill repaints the plate, the border paints on a layer of its own (colour,
 * radius, style and weight), the two transparencies are line bars that reach
 * the plate and the line separately, the size and the position are free px on
 * the board, the eye takes the plate away, and Default hands the plate back its
 * auto size and place.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";

type Win = Window & typeof globalThis;
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
const type = (el: HTMLInputElement | null, value: string) => {
  if (!el) return;
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

const frame = () =>
  act(async () => {
    await new Promise<void>((r) => win.requestAnimationFrame(() => r()));
  });

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
const line = () => doc.querySelector<HTMLElement>('.context-toolbar [role="toolbar"][aria-label="Title background tools"]');
const lineButtons = () => Array.from(line()?.querySelectorAll<HTMLElement>(":scope > button, :scope > span > button") ?? []);
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const popButton = (label: string) => pop()?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null;
const popText = (sel: string) => pop()?.querySelector<HTMLElement>(sel) ?? null;
const openCard = (label: string) => {
  click(doc.querySelector(`.context-toolbar [aria-label="${label}"]`));
};
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));

const titleBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
/** the plate's body — the fill layer, the first thing the title box paints */
const plate = () => titleBox()?.querySelector<HTMLElement>("[data-banner-plate]") ?? null;
/** the outline's own layer */
const plateLine = () => titleBox()?.querySelector<HTMLElement>("[data-banner-line]") ?? null;
/** the heading glyphs — the box-font node, the only div inside carrying a font size */
const glyphs = () =>
  Array.from(titleBox()?.querySelectorAll<HTMLElement>("div") ?? []).find((d) => !!d.style.fontSize) ?? null;
const halo = () =>
  Array.from(titleBox()?.querySelectorAll<HTMLElement>("div") ?? []).find((d) => !!d.style.filter) ?? null;

const styleOf = (el: HTMLElement | null) => el?.getAttribute("style") ?? "";

export async function runBannerTests(): Promise<CaseResult[]> {
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
      theme: { showNumber: true, showBullet: true },
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

  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);
  let root: Root | null = null;
  act(() => {
    root = createRoot(doc.getElementById("root")!);
    root.render(createElement(App));
  });

  nav("titleBg");
  const have = () => !!line();

  /* ------------------------- the redesigned line --------------------------- */
  const ORDER = [
    "Design presets",
    "Banner shape",
    "Banner effects",
    "Banner fill",
    "Banner border",
    "Banner radius",
    "Banner border style",
    "Banner weight",
    "Banner transparency",
    "Banner size",
    "Banner position",
    "Show / hide the banner behind the title",
  ];
  const labels = lineButtons().map((b) => b.getAttribute("aria-label") ?? "");
  out.push({
    name: "the Title background line reads presets · shape · effects · fill · border · radius · style · weight · transparency · size · position · eye · Default",
    pass: ORDER.every((l, i) => labels[i] === l) && !!line()?.querySelector("[data-toolbar-default]"),
    detail: labels.slice(0, ORDER.length + 1).join(" › "),
  });

  /* ------------------------- the factory plate's box ------------------------ */
  const auto0 = { left: plate()?.style.left ?? "", top: plate()?.style.top ?? "", w: plate()?.style.width ?? "", h: plate()?.style.height ?? "" };
  // a CSS engine may fold `calc(100% + 6%)` down to `calc(106%)` — both spellings
  // are the same box, so the plate is read with its whitespace folded away
  const box = (v: string, ...forms: string[]) => forms.some((f) => v.replace(/\s+/g, "") === f.replace(/\s+/g, ""));
  out.push({
    name: "the factory plate is a tight chip: 3% of room either side and 14% above and below the heading",
    pass:
      box(auto0.left, "calc(-3% + 0px)") &&
      box(auto0.top, "calc(-14% + 0px)") &&
      box(auto0.w, "calc(100% + 6%)", "calc(106%)") &&
      box(auto0.h, "calc(100% + 28%)", "calc(128%)"),
    detail: `${auto0.w} × ${auto0.h} at ${auto0.left} / ${auto0.top}`,
  });

  /* ------------------------------ presets ---------------------------------- */
  openCard("Design presets");
  const presetTiles = () => Array.from(pop()?.querySelectorAll<HTMLElement>('button[aria-label^="Banner preset: "]') ?? []);
  out.push({
    name: "Design presets opens a card of whole looks, each painted as the plate it brings",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Design presets" &&
      presetTiles().length >= 6 &&
      presetTiles().every((t) => !!t.querySelector("span span")),
    detail: `${presetTiles().length} presets · ${presetTiles().map((t) => t.getAttribute("aria-label")?.replace("Banner preset: ", "")).slice(0, 3).join(" / ")}`,
  });
  click(popButton("Banner preset: Royal blue pill"));
  out.push({
    name: "one click paints that look: a gradient pill, rounded to a full capsule",
    pass: styleOf(plate()).includes("linear-gradient") && plate()?.style.borderRadius === "999px",
    detail: `${styleOf(plate()).slice(0, 46)} · radius ${plate()?.style.borderRadius}`,
  });
  closePop();

  /* ------------------------------- shape ----------------------------------- */
  openCard("Banner shape");
  out.push({
    name: "Shapes lists every silhouette as a picture, with the one in use marked",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Banner shape" &&
      (pop()?.querySelectorAll('[role="listbox"][aria-label="Banner shape"] [role="option"]').length ?? 0) === 7 &&
      popButton("Banner shape: Pill")?.getAttribute("aria-selected") === "true",
    detail: String(pop()?.querySelectorAll('[role="listbox"][aria-label="Banner shape"] [role="option"]').length),
  });
  click(popButton("Banner shape: Rounded"));
  out.push({
    name: "picking a silhouette repaints the plate's corners — at the tighter plate's own radius",
    pass: plate()?.style.borderRadius === "14px",
    detail: plate()?.style.borderRadius ?? "",
  });
  click(popButton("Banner shape: Ribbon"));
  out.push({
    name: "the ribbon's notched ends are cut shallower to match the shorter plate",
    pass: (plate()?.style.clipPath ?? "").includes("16px") && !(plate()?.style.clipPath ?? "").includes("22px"),
    detail: plate()?.style.clipPath ?? "",
  });
  click(popButton("Banner shape: Rounded"));
  closePop();

  /* ------------------------------ effects ---------------------------------- */
  openCard("Banner effects");
  const softness = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner softness"]');
  const haloInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner halo"]');
  out.push({
    name: "Effects holds softness · halo on line bars, and the shimmer switch",
    pass: softness?.type === "range" && haloInput?.type === "range" && Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).some((b) => (b.textContent ?? "").includes("Shimmer")),
    detail: `${softness?.type} ${softness?.min}–${softness?.max} · halo ${haloInput?.min}–${haloInput?.max}`,
  });
  type(haloInput, "70");
  out.push({
    name: "the halo paints a soft glow around the plate, growing from its own middle",
    pass: !!halo() && styleOf(halo()).includes("scale(") && styleOf(halo()).includes("blur("),
    detail: styleOf(halo()).slice(0, 60),
  });
  type(haloInput, "0");
  closePop();

  /* -------------------------------- fill ----------------------------------- */
  openCard("Banner fill");
  const fillWell = pop()?.querySelector<HTMLInputElement>('[data-banner-fill] input[type="color"]');
  out.push({
    name: "Fill colour is the body's paint — a solid well plus the full gradient builder",
    pass: !!fillWell && !!popText("details summary"),
    detail: `${pop()?.getAttribute("data-pop-panel")} · well ${!!fillWell}`,
  });
  act(() => {
    if (!fillWell) return;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
    setter?.call(fillWell, "#29b36f");
    fillWell.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
  await frame();
  await frame();
  out.push({
    name: "picking a fill colour reaches the plate",
    pass: styleOf(plate()).toLowerCase().includes("#29b36f") || styleOf(plate()).includes("rgb(41, 179, 111)"),
    detail: styleOf(plate()).slice(0, 60),
  });
  closePop();

  /* ------------------------------- border ---------------------------------- */
  openCard("Banner border");
  const outlineSwitch = Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) =>
    (b.textContent ?? "").includes("Outline the plate"),
  );
  click(outlineSwitch);
  out.push({
    name: "Border colour puts an outline on the plate, on a layer of its own",
    pass: !!plateLine() && styleOf(plateLine()).includes("solid"),
    detail: styleOf(plateLine()).slice(0, 60),
  });
  closePop();

  openCard("Banner border style");
  out.push({
    name: "Border style is five line styles as pictures — solid · dashed · dotted · double · none",
    pass:
      (pop()?.querySelectorAll('[role="listbox"][aria-label="Border style"] [role="option"]').length ?? 0) === 5 &&
      popButton("Banner border style: Solid")?.getAttribute("aria-selected") === "true",
    detail: String(pop()?.querySelectorAll('[role="listbox"][aria-label="Border style"] [role="option"]').length),
  });
  click(popButton("Banner border style: Dashed"));
  out.push({
    name: "picking a style paints the line that way",
    pass: styleOf(plateLine()).includes("dashed"),
    detail: styleOf(plateLine()).slice(0, 60),
  });
  closePop();

  openCard("Banner weight");
  const weightInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner border weight (px)"]');
  type(weightInput, "6");
  out.push({
    name: "Border weight is one line bar with no ceiling, and it thickens the line",
    pass: weightInput?.type === "range" && Number(weightInput?.max) >= 24 && styleOf(plateLine()).includes("6px"),
    detail: `${weightInput?.value} of 0–${weightInput?.max} · ${styleOf(plateLine()).slice(0, 48)}`,
  });
  closePop();

  openCard("Banner radius");
  const radiusInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner border radius (px)"]');
  type(radiusInput, "40");
  out.push({
    name: "Border radius is one line bar and rounds the plate's corners",
    pass: radiusInput?.type === "range" && plate()?.style.borderRadius === "40px",
    detail: `${radiusInput?.value} · radius ${plate()?.style.borderRadius}`,
  });
  closePop();

  /* --------------------------- transparency -------------------------------- */
  openCard("Banner transparency");
  const shapeOpacity = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner shape transparency (100 = fully visible)"]');
  const lineOpacity = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner border transparency (100 = fully visible)"]');
  out.push({
    name: "Transparency holds TWO line bars — the shape's and the border's — not ± steppers",
    pass:
      shapeOpacity?.type === "range" &&
      lineOpacity?.type === "range" &&
      shapeOpacity?.min === "0" &&
      lineOpacity?.min === "0",
    detail: `shape ${shapeOpacity?.min}–${shapeOpacity?.max} · border ${lineOpacity?.min}–${lineOpacity?.max}`,
  });
  type(lineOpacity, "30");
  const lineFaded = styleOf(plateLine());
  type(shapeOpacity, "40");
  out.push({
    name: "the two fade apart: the border's slider moves the line only, the shape's the body only",
    pass:
      lineFaded.includes("0.3") &&
      plate()?.style.opacity === "0.4" &&
      (styleOf(plateLine()).includes("0.3") || styleOf(plateLine()).includes("0.30")),
    detail: `line ${lineFaded.slice(0, 44)} · body opacity ${plate()?.style.opacity}`,
  });
  type(shapeOpacity, "100");
  type(lineOpacity, "100");
  closePop();

  /* ----------------------------- position ---------------------------------- */
  openCard("Banner position");
  const xInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner position X (px)"]');
  const yInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner position Y (px)"]');
  const glyphBefore = glyphs()?.getAttribute("style") ?? "";
  out.push({
    name: "Banner position offers free X → and Y ↓ bars, running the whole board and further",
    pass: xInput?.type === "range" && Number(xInput?.max) >= 1280 && Number(xInput?.min) <= -1280 && Number(yInput?.max) >= 720,
    detail: `x ${xInput?.min}…${xInput?.max} · y ${yInput?.min}…${yInput?.max}`,
  });
  const placedAuto = { left: plate()?.style.left ?? "", top: plate()?.style.top ?? "" };
  type(xInput, "180");
  type(yInput, "-90");
  out.push({
    name: "the nudge moves the plate alone: X right, Y down, and the heading stays exactly where it was",
    pass:
      (plate()?.style.left ?? "").includes("180px") &&
      (plate()?.style.top ?? "").includes("90px") &&
      (plate()?.style.left ?? "") !== placedAuto.left &&
      (plate()?.style.top ?? "") !== placedAuto.top &&
      (glyphs()?.getAttribute("style") ?? "") === glyphBefore,
    detail: `left ${placedAuto.left} → ${plate()?.style.left} · top ${placedAuto.top} → ${plate()?.style.top} · glyphs unchanged ${(glyphs()?.getAttribute("style") ?? "") === glyphBefore}`,
  });
  closePop();

  /* ------------------------------- size ------------------------------------ */
  openCard("Banner size");
  const widthInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner width (px)"]');
  const heightInput = pop()?.querySelector<HTMLInputElement>('input[aria-label="Banner height (px)"]');
  out.push({
    name: "Banner size offers a free width and height on line bars — both far past the board",
    pass: widthInput?.type === "range" && heightInput?.type === "range" && Number(widthInput?.max) >= 1280 && Number(heightInput?.max) >= 720,
    detail: `width 0–${widthInput?.max} · height 0–${heightInput?.max}`,
  });
  type(widthInput, "1600");
  type(heightInput, "300");
  out.push({
    name: "a free size paints the plate at exactly that px box — wider than the board when asked, and still centred on the heading",
    pass: plate()?.style.width === "1600px" && plate()?.style.height === "300px" && (plate()?.style.left ?? "").includes("calc("),
    detail: `w ${plate()?.style.width} · h ${plate()?.style.height} · left ${plate()?.style.left ?? ""} · top ${plate()?.style.top ?? ""}`,
  });
  closePop();

  /* --------------------------- show / hide --------------------------------- */
  click(doc.querySelector('.context-toolbar [aria-label="Show / hide the banner behind the title"]'));
  out.push({
    name: "the eye takes the whole plate away — body and line together",
    pass: !plate() && !plateLine(),
    detail: `plate ${!!plate()} · line ${!!plateLine()}`,
  });
  click(doc.querySelector('.context-toolbar [aria-label="Show / hide the banner behind the title"]'));
  out.push({
    name: "and brings it back exactly as it was",
    pass: !!plate() && !!plateLine(),
    detail: `${!!plate()} / ${!!plateLine()}`,
  });

  /* ------------------------------ Default ---------------------------------- */
  click(line()?.querySelector<HTMLElement>("[data-toolbar-default]"));
  const fresh = styleOf(plate());
  out.push({
    name: "Default hands the plate back its auto size and place — no px box, no nudge, no line",
    pass:
      !fresh.includes("1600px") &&
      !fresh.includes("-90px") &&
      fresh.includes("calc(") &&
      !plateLine() &&
      plate()?.style.borderRadius !== "40px",
    detail: `${fresh.slice(0, 64)} · line ${!!plateLine()}`,
  });

  out.push({ name: "no uncaught errors while dressing the title plate", pass: errors.length === 0, detail: errors.slice(0, 3).join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
