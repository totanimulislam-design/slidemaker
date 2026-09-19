/**
 * Background shape suite.
 *
 * Every text toolbar carries a "Background shape" button right before its
 * Default. It opens a pop-up with presets, silhouettes, shape colour, border
 * colour / style / radius / weight, transparency, 20+ effects and position,
 * and whatever is picked there paints a plate behind THAT part's glyphs only
 * — on a layer of its own, under the text, adding no DOM while it is off.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";
import { TEXT_BG_EFFECTS, TEXT_BG_KINDS, TEXT_BG_PRESETS, textBgRender, bgShapeFromPreset } from "../src/lib/textBgShape";

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

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
const line = (aria: string) => doc.querySelector<HTMLElement>(`.context-toolbar [role="toolbar"][aria-label="${aria}"]`);
const lineButtons = (aria: string) => Array.from(line(aria)?.querySelectorAll<HTMLElement>(":scope > button, :scope > span > button") ?? []);
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const popButton = (label: string) => pop()?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null;
const popInput = (label: string) => pop()?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`) ?? null;
const popTextButton = (text: string) => Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => b.textContent?.trim() === text) ?? null;
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));

const el = (sel: string) => doc.querySelector<HTMLElement>(`.slide-editable ${sel}`);
const plates = (scope: Element | null | undefined) => Array.from(scope?.querySelectorAll<HTMLElement>("[data-text-bg]") ?? []);
const layerOf = (plate: HTMLElement | undefined) => plate?.querySelector<HTMLElement>("[data-text-bg-layer]") ?? null;
const fillOf = (plate: HTMLElement | undefined) => plate?.querySelector<HTMLElement>("[data-text-bg-fill]") ?? null;

/**
 * "Background shape sits right before Default": the button carrying the
 * background-shape label is the last control before the line's Default.
 */
function bgBeforeDefault(aria: string, bgLabel: string): { pass: boolean; detail: string } {
  const buttons = lineButtons(aria);
  const labels = buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "");
  const bg = buttons.findIndex((b) => b.getAttribute("aria-label") === bgLabel);
  const def = buttons.findIndex((b) => b.hasAttribute("data-toolbar-default"));
  return { pass: bg >= 0 && def === bg + 1, detail: `${labels.slice(Math.max(0, bg - 1), def + 1).join(" › ") || "no such line"} (bg #${bg}, default #${def})` };
}

export async function runTextBgTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: { title: "MCQ", brandTop: "LEARN WITH", brandBottom: "FAYSAL SIR", badge: "DAKHIL-26", logo: DEFAULT_LOGO, showLogo: true, showBanner: true },
      theme: { showNumber: true, showBullet: true },
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?\nদ্বিতীয় লাইন",
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

  /* ----------------------- the catalogue itself ---------------------------- */
  out.push({
    name: "the pop-up offers more than 20 effects, 30 silhouettes and 40+ presets",
    pass: TEXT_BG_EFFECTS.filter((e) => e.id !== "none").length > 20 && TEXT_BG_KINDS.length >= 30 && TEXT_BG_PRESETS.length >= 40,
    detail: `${TEXT_BG_EFFECTS.length - 1} effects · ${TEXT_BG_KINDS.length} silhouettes · ${TEXT_BG_PRESETS.length} presets`,
  });
  out.push({
    name: "every preset renders to a plate (no preset produces an empty or throwing render)",
    pass: TEXT_BG_PRESETS.every((p) => {
      const r = textBgRender(bgShapeFromPreset(p));
      return !!r && !!r.fill && !!r.wrapper;
    }),
  });
  out.push({
    name: "the Bangladesh edu group carries the ACS / Udvash / 10 Minute School looks",
    pass: ["acsViolet", "udvashCard", "tenMsRed", "deshGreenRed"].every((id) => TEXT_BG_PRESETS.some((p) => p.id === id && p.group === "Bangladesh edu")),
    detail: TEXT_BG_PRESETS.filter((p) => p.group === "Bangladesh edu").map((p) => p.label).join(", "),
  });

  /* ------------------ the button: on every text toolbar -------------------- */
  const noPlates = plates(doc.querySelector(".slide-editable")).length;
  out.push({ name: "an untouched deck paints no plate DOM at all", pass: noPlates === 0, detail: `${noPlates} plates` });

  nav("titleText");
  const titleLine = bgBeforeDefault("Title text tools", "Title text background shape");
  out.push({ name: "Title text: Background shape sits right before Default", ...titleLine });
  out.push({
    name: "Title background (banner line) is not a text toolbar, so it gets no Background shape button",
    pass: !!line("Title background tools") && !lineButtons("Title background tools").some((b) => /background shape/i.test(b.getAttribute("aria-label") ?? "")),
  });

  nav("badge1");
  out.push({ name: "Badge 1: Background shape sits right before Default", ...bgBeforeDefault("Badge 1 tools", "Badge 1 background shape") });
  out.push({ name: "Badge 2: Background shape sits right before Default", ...bgBeforeDefault("Badge 2 tools", "Badge 2 background shape") });

  nav("questionText");
  out.push({ name: "Question text: Background shape sits right before Default", ...bgBeforeDefault("Question text tools", "Question text background shape") });
  out.push({ name: "Q bullet text: Background shape sits right before Default", ...bgBeforeDefault("Text inside question bullet tools", "Q bullet text background shape") });

  nav("optionText");
  out.push({ name: "Option text: Background shape sits right before Default", ...bgBeforeDefault("Option text tools", "Option text background shape") });
  out.push({ name: "Bullet text (marker letter): Background shape sits right before Default", ...bgBeforeDefault("Text inside option bullet tools", "Bullet text background shape") });

  nav("footnote");
  out.push({ name: "Footnote (plain text toolbar): Background shape sits right before Default", ...bgBeforeDefault("Text tools", "Background shape") });

  /* ------------------------ the pop-up's contents -------------------------- */
  nav("titleText");
  click(line("Title text tools")?.querySelector('button[aria-label="Title text background shape"]'));
  const card = pop();
  out.push({
    name: "clicking it opens the Background shape pop-up card",
    pass: card?.getAttribute("data-pop-panel") === "Title text background shape" && !!card?.querySelector("[data-text-bg-panel]"),
    detail: card?.getAttribute("data-pop-panel") ?? "no card",
  });
  const has = (sel: string) => !!card?.querySelector(sel);
  /** a ColorInput names itself with a visible caption beside its well */
  const hasText = (text: string) => Array.from(card?.querySelectorAll("span") ?? []).some((n) => n.textContent?.trim() === text && !!n.closest("div")?.querySelector('input[type="color"]'));
  const sections = {
    presets: has('[role="listbox"][aria-label="Background shape preset"] button[aria-label^="Background shape preset: "]'),
    silhouettes: has('[role="listbox"][aria-label="Background silhouette"] button'),
    shapeColour: hasText("Background shape colour") && has('button[aria-label="Background shape colour: none"]'),
    borderColour: hasText("Background border colour") && has('button[aria-label="Background border colour: none"]'),
    borderStyle: has('[role="group"][aria-label="Background border style"] button'),
    borderRadius: has('input[aria-label="Background border radius"]'),
    borderWeight: has('input[aria-label="Background border weight"]'),
    transparency: has('input[aria-label="Background shape opacity (100 = fully visible)"]'),
    effects: (card?.querySelectorAll('[role="listbox"][aria-label="Background effect"] button').length ?? 0) > 20,
    position: has('input[aria-label="Room left/right"]') && has('input[aria-label="Shift horizontally"]') && has('[role="group"][aria-label="Background shape scope"]'),
  };
  out.push({
    name: "the card holds presets · shape colour · border colour · border style · border radius · border weight · transparency · 20+ effects · position",
    pass: Object.values(sections).every(Boolean),
    detail: Object.entries(sections).map(([k, v]) => `${k}:${v ? "✓" : "✗"}`).join(" "),
  });
  out.push({
    name: "the preset grid shows every preset with a live thumbnail of its plate",
    pass: (() => {
      click(popTextButton("All"));
      const tiles = Array.from(card?.querySelectorAll<HTMLElement>('button[aria-label^="Background shape preset: "]') ?? []);
      return tiles.length === TEXT_BG_PRESETS.length && tiles.every((t) => !!t.querySelector("[data-text-bg]"));
    })(),
    detail: `${card?.querySelectorAll('button[aria-label^="Background shape preset: "]').length} tiles`,
  });

  /* ------------------------- painting the title ---------------------------- */
  const titleBox = () => el('[data-el="title"]');
  click(popButton("Background shape preset: ACS violet pill"));
  const titlePlate = plates(titleBox())[0];
  out.push({
    name: "picking a preset paints ONE plate behind the title, on a layer under the glyphs",
    pass:
      plates(titleBox()).length === 1 &&
      !!titlePlate &&
      titlePlate.style.position === "relative" &&
      titlePlate.style.isolation === "isolate" &&
      layerOf(titlePlate)?.style.zIndex === "-1" &&
      layerOf(titlePlate)?.getAttribute("aria-hidden") === "true" &&
      /#a936f5|169, 54, 245/.test(fillOf(titlePlate)?.style.background ?? "") &&
      (titlePlate.textContent ?? "").includes("MCQ"),
    detail: `${plates(titleBox()).length} plates · fill=${fillOf(titlePlate)?.style.background} · layer z=${layerOf(titlePlate)?.style.zIndex}`,
  });
  out.push({
    name: "…and nothing else on the slide got a plate (the brand block, the question, the options stay bare)",
    pass: plates(doc.querySelector(".slide-editable")).length === 1,
    detail: `${plates(doc.querySelector(".slide-editable")).length} plates on the slide`,
  });
  const titleBtn = () => line("Title text tools")?.querySelector<HTMLElement>('button[aria-label="Title text background shape"]');
  out.push({
    name: "the toolbar button shows the plate is on (and names the preset in its tooltip)",
    pass: titleBtn()?.getAttribute("data-bg-shape") === "on" && (titleBtn()?.getAttribute("title") ?? "").includes("ACS violet pill"),
    detail: `${titleBtn()?.getAttribute("data-bg-shape")} · ${titleBtn()?.getAttribute("title")}`,
  });

  // silhouette → a polygon clips the fill; a border becomes an SVG stroke
  click(popButton("Background silhouette: Slant"));
  out.push({
    name: "a polygon silhouette clips the fill with clip-path (no corner radius applies)",
    pass: (fillOf(plates(titleBox())[0])?.style.clipPath ?? "").startsWith("polygon(") && !fillOf(plates(titleBox())[0])?.style.borderRadius,
    detail: fillOf(plates(titleBox())[0])?.style.clipPath,
  });
  click(popTextButton("Dashed"));
  type(popInput("Background border weight"), "3");
  out.push({
    name: "border style + weight on a polygon draw an SVG stroke that follows the silhouette",
    pass: (() => {
      const poly = plates(titleBox())[0]?.querySelector("svg polygon");
      return !!poly && poly.getAttribute("stroke-width") === "3" && !!poly.getAttribute("stroke-dasharray") && poly.getAttribute("fill") === "none";
    })(),
    detail: plates(titleBox())[0]?.querySelector("svg polygon")?.outerHTML.slice(0, 160),
  });

  click(popButton("Background silhouette: Pill"));
  type(popInput("Background border radius"), "9");
  out.push({
    name: "back on a box silhouette the border is a CSS border with the plate's own radius",
    pass: (() => {
      const plate = plates(titleBox())[0];
      const border = Array.from(plate?.querySelectorAll<HTMLElement>("[data-text-bg-layer] > span") ?? []).find((n) => n.style.borderStyle === "dashed");
      return !!border && border.style.borderWidth === "3px" && !!fillOf(plate)?.style.borderRadius && !plate?.querySelector("svg");
    })(),
    detail: Array.from(plates(titleBox())[0]?.querySelectorAll<HTMLElement>("[data-text-bg-layer] > span") ?? []).map((n) => n.style.cssText).join(" | "),
  });

  type(popInput("Background shape opacity (100 = fully visible)"), "40");
  out.push({
    name: "transparency fades the plate's layer only (40 → opacity 0.4), never the glyphs",
    pass: layerOf(plates(titleBox())[0])?.style.opacity === "0.4" && !plates(titleBox())[0]?.style.opacity,
    detail: `layer ${layerOf(plates(titleBox())[0])?.style.opacity} · wrapper ${plates(titleBox())[0]?.style.opacity || "—"}`,
  });

  click(popButton("Background effect: Shadow"));
  out.push({
    name: "an effect (Shadow) lands on the plate's layer as a filter",
    pass: (layerOf(plates(titleBox())[0])?.style.filter ?? "").includes("drop-shadow"),
    detail: layerOf(plates(titleBox())[0])?.style.filter,
  });
  click(popButton("Background effect: Glass"));
  out.push({
    name: "Glass frosts the fill with a backdrop blur",
    pass: (() => {
      const f = fillOf(plates(titleBox())[0]);
      return !!f && ((f.style.getPropertyValue("backdrop-filter") || f.style.getPropertyValue("-webkit-backdrop-filter")).includes("blur"));
    })(),
    detail: fillOf(plates(titleBox())[0])?.style.cssText,
  });
  click(popButton("Background effect: Fade →"));
  out.push({
    name: "Fade → masks the layer",
    pass: !!layerOf(plates(titleBox())[0])?.style.getPropertyValue("mask-image") || !!layerOf(plates(titleBox())[0])?.style.getPropertyValue("-webkit-mask-image"),
    detail: layerOf(plates(titleBox())[0])?.style.cssText,
  });
  click(popButton("Background effect: Gloss"));
  out.push({
    name: "Gloss adds an overlay pass on top of the fill",
    pass: !!plates(titleBox())[0]?.querySelector("[data-text-bg-overlay]"),
  });

  type(popInput("Room left/right"), "30");
  type(popInput("Room top/bottom"), "10");
  type(popInput("Shift horizontally"), "-4");
  type(popInput("Skew"), "-12");
  out.push({
    name: "position: room becomes the wrapper's padding; shift and skew transform the plate's layer only",
    pass:
      plates(titleBox())[0]?.style.padding === "10px 30px" &&
      (layerOf(plates(titleBox())[0])?.style.transform ?? "").includes("translate(-4px, 0px)") &&
      (layerOf(plates(titleBox())[0])?.style.transform ?? "").includes("skewX(-12deg)"),
    detail: `padding ${plates(titleBox())[0]?.style.padding} · transform ${layerOf(plates(titleBox())[0])?.style.transform}`,
  });

  click(popButton("Remove background shape"));
  out.push({
    name: "Remove takes the plate away and the title's DOM is bare again",
    pass: plates(titleBox()).length === 0 && titleBtn()?.getAttribute("data-bg-shape") === "off",
    detail: `${plates(titleBox()).length} plates · button ${titleBtn()?.getAttribute("data-bg-shape")}`,
  });
  closePop();

  /* --------------------- per line vs whole block --------------------------- */
  nav("questionText");
  click(line("Question text tools")?.querySelector('button[aria-label="Question text background shape"]'));
  click(popButton("Background shape preset: Udvash steel card"));
  const stem = () => el('[data-el="question"] > span');
  out.push({
    name: "the question gets one plate behind the whole (two-line) text by default",
    pass: plates(stem()).length === 1 && (plates(stem())[0]?.textContent ?? "").includes("দ্বিতীয় লাইন"),
    detail: `${plates(stem()).length} plates`,
  });
  click(popTextButton("Each line"));
  out.push({
    name: "'Each line' paints a plate per line (two lines → two plates), each hugging its own line",
    pass: plates(stem()).length === 2 && plates(stem())[0]?.style.display === "inline-block",
    detail: `${plates(stem()).length} plates · ${plates(stem())[0]?.style.display}`,
  });
  click(popTextButton("Fill box"));
  out.push({
    name: "'Fill box' stretches every plate to the box width",
    pass: plates(stem()).length === 2 && plates(stem()).every((p) => p.style.display === "block"),
    detail: plates(stem()).map((p) => p.style.display).join(" / "),
  });
  closePop();

  /* ------------------------ the other parts -------------------------------- */
  nav("badge1");
  click(line("Badge 1 tools")?.querySelector('button[aria-label="Badge 1 background shape"]'));
  click(popButton("Background shape preset: 10MS red chevron"));
  const brandLines = () => Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div'));
  out.push({
    name: "Badge 1's plate wraps Badge 1's line only — Badge 2 stays bare",
    pass: plates(brandLines()[0]).length === 1 && plates(brandLines()[1]).length === 0,
    detail: brandLines().map((d) => plates(d).length).join(" / "),
  });
  closePop();

  nav("optionText");
  click(line("Text inside option bullet tools")?.querySelector('button[aria-label="Bullet text background shape"]'));
  click(popButton("Background shape preset: Answer green"));
  const optionsBox = () => el('[data-el="options"]');
  out.push({
    name: "Bullet text's plate sits behind each marker letter (one per option), never behind the option text",
    pass: (() => {
      const all = plates(optionsBox());
      // every plate holds a one-glyph marker letter (ক / খ), none holds an option's text
      return all.length === 2 && all.every((p) => ["ক", "খ"].includes((p.textContent ?? "").trim()));
    })(),
    detail: plates(optionsBox()).map((p) => (p.textContent ?? "").trim()).join(" / "),
  });
  closePop();

  click(line("Option text tools")?.querySelector('button[aria-label="Option text background shape"]'));
  click(popButton("Background shape preset: Option pill"));
  out.push({
    name: "Option text's plate wraps each option's text (two options → two more plates)",
    pass: plates(optionsBox()).length === 4 && plates(optionsBox()).some((p) => (p.textContent ?? "").trim() === "5"),
    detail: `${plates(optionsBox()).length} plates in the options box`,
  });
  // Default on the Option text line clears its plate but leaves the marker letters' plates
  closePop();
  click(line("Option text tools")?.querySelector("button[data-toolbar-default]"));
  out.push({
    name: "the line's Default clears its own plate only (the marker letters keep theirs)",
    pass: plates(optionsBox()).length === 2,
    detail: `${plates(optionsBox()).length} plates after Default`,
  });

  nav("footnote");
  click(line("Text tools")?.querySelector('button[aria-label="Background shape"]'));
  click(popButton("Background shape preset: Chalkboard"));
  out.push({
    name: "the footnote's plain toolbar paints the footnote",
    pass: plates(el('[data-el="note"]')).length === 1,
    detail: `${plates(el('[data-el="note"]')).length} plates`,
  });
  closePop();

  /* --------------------------- custom text box ----------------------------- */
  nav("shapes");
  click(doc.querySelector('.context-toolbar [aria-label="Text box"]') ?? doc.querySelector('.context-toolbar [aria-label="Text"]'));
  const shapeBox = () => doc.querySelector<HTMLElement>(".slide-editable [data-shape]");
  const textToolbar = bgBeforeDefault("Text tools", "Background shape");
  out.push({ name: "a custom text box's toolbar: Background shape sits right before Default", ...textToolbar });
  click(line("Text tools")?.querySelector('button[aria-label="Background shape"]'));
  click(popTextButton("Canva classics"));
  click(popButton("Background shape preset: Highlighter"));
  out.push({
    name: "a preset paints the text box's own text (stored on the shape item)",
    pass: !!shapeBox() && plates(shapeBox()).length >= 1,
    detail: `${plates(shapeBox()).length} plates in the text box`,
  });
  closePop();
  click(line("Text tools")?.querySelector("button[data-toolbar-default]"));
  out.push({
    name: "the text box's Default clears its plate too",
    pass: !!shapeBox() && plates(shapeBox()).length === 0,
    detail: `${plates(shapeBox()).length} plates after Default`,
  });

  out.push({ name: "no uncaught errors while styling plates", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => root?.unmount());
  doc.getElementById("root")!.innerHTML = "";
  localStorage.removeItem("mcq-slide-studio-v2");
  return out;
}
