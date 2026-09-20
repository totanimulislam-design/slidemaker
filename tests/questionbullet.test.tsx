/**
 * Question bullet suite — the marker's own shape.
 *
 * The toolbar's Question bullet line carries the design gallery plus the
 * channels a marker is restyled with: shape fill, border colour, border style,
 * corner radius, border weight, transparency and position. Every one of them
 * lands on the marker's BODY (the surface layer `NumberBullet` paints) and
 * never on the number inside it — the digits keep their own ink, face and
 * opacity under "Text inside question bullet".
 *
 * Pinned here:
 *   • the catalogue (round · cards · polygons · seals · marks) and that every
 *     design renders a box (no design throws or comes out empty)
 *   • the toolbar line and its three cards (design · shape · position)
 *   • fill, border colour, border style, radius, weight and transparency
 *     reaching the board, and cut silhouettes stroking their outline in SVG
 *     (a clipped CSS border would vanish)
 *   • position: the nudge moves the marker with its number, and the
 *     separate-element switch hands it its own board element
 *   • Default unwinds all of it in one click
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO, type ThemeSettings } from "../src/lib/types";
import {
  NUMBER_STYLES,
  NUMBER_STYLE_CATEGORIES,
  numberStyleAspect,
  renderNumberStyle,
  showsNumber,
  type NumberStyle,
} from "../src/lib/numberStyles";

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
const type = (el: HTMLInputElement | null | undefined, value: string) => {
  if (!el) return;
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};
/** one move of the OS colour dialog's cursor */
const dial = (el: HTMLInputElement | null | undefined, hex: string) => {
  if (!el) return;
  act(() => {
    el.value = hex;
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};
/** the one-frame commit channel paints on the next frame */
const frame = () =>
  act(async () => {
    await new Promise<void>((r) => win.requestAnimationFrame(() => r()));
  });

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
const line = (aria: string) => doc.querySelector<HTMLElement>(`.context-toolbar [role="toolbar"][aria-label="${aria}"]`);
const barButton = (label: string) => line("Question bullet tools")?.querySelector<HTMLElement>(`button[aria-label="${label}"]`);
const barColor = (prefix: string) => line("Question bullet tools")?.querySelector<HTMLInputElement>(`input[type="color"][aria-label^="${prefix}"]`);
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const popText = (text: string) => Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => b.textContent?.trim() === text) ?? null;
const popInput = (label: string) => pop()?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));
const panelText = () =>
  (doc.querySelector("[data-bullet-shape-controls]")?.closest("aside")?.textContent ?? "").replace(/\s+/g, " ");

/** the marker on the board: its box, its painted body, the number inside it */
const marker = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="question"] > div');
const surface = () => marker()?.querySelector<HTMLElement>("[data-bullet-surface]");
const outline = () => marker()?.querySelector<SVGSVGElement>("[data-bullet-outline]");
const digits = () => marker()?.querySelector<HTMLElement>(":scope > span");
const css = (el: Element | null | undefined) => el?.getAttribute("style") ?? "";

/** the theme a render starts from — the deck's own defaults */
const BASE: ThemeSettings = {
  accent: "#2f4fff",
  board: "#050507",
  questionColor: "#ffd94a",
  showBullet: true,
  showNumber: true,
  bulletSeparate: false,
  numberStyle: "circle",
  bulletSize: 54,
  bulletFill: "",
  bulletBorder: "",
  bulletBorderStyle: "auto",
  bulletOpacity: 100,
} as ThemeSettings;

const designBtn = (label: string) => pop()?.querySelector(`[aria-label="Bullet design: ${label}"]`) ?? null;

export async function runQuestionBulletTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: { title: "MCQ", brandTop: "LEARN WITH", brandBottom: "FAYSAL SIR", badge: "DAKHIL-26", logo: DEFAULT_LOGO, showLogo: true, showBanner: true },
      theme: { showNumber: true, showBullet: true, bulletSeparate: false, numberStyle: "circle" },
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?",
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

  /* ------------------------- the catalogue itself -------------------------- */
  const designCount = NUMBER_STYLES.filter((d) => d.id !== "none").length;
  out.push({
    name: "the gallery carries a silhouette for every marker convention (30+ designs, 5 groups)",
    pass: designCount >= 30 && NUMBER_STYLE_CATEGORIES.length >= 5,
    detail: `${designCount} designs · ${NUMBER_STYLE_CATEGORIES.length} groups`,
  });

  const needed: NumberStyle[] = [
    "circle", "ring", "coin", "squircle", "arch", "blob",
    "square", "rounded", "pill", "cutCorner", "ticket", "bookmark", "speech",
    "diamond", "hexagon", "hexPoint", "shield", "slant", "step", "ribbon", "banner",
    "star", "sparkle", "burst", "scallop", "gear",
    "bracket", "underline", "bar", "slash",
  ];
  const missing = needed.filter((id) => !NUMBER_STYLES.some((d) => d.id === id));
  out.push({
    name: "the popular silhouettes are all in the catalogue (discs, chips, polygons, seals, marks)",
    pass: missing.length === 0,
    detail: missing.length ? `missing ${missing.join(", ")}` : `${needed.length} conventions covered`,
  });

  const broken: string[] = [];
  for (const d of NUMBER_STYLES) {
    try {
      const r = renderNumberStyle(d.id, { ...BASE }, 54, "৭");
      if (!r.style || !r.surface) broken.push(`${d.id}:empty`);
      else if (d.id !== "none" && !r.style.width) broken.push(`${d.id}:no-box`);
      else if (d.id !== "none" && !showsNumber(d.id) && r.content !== "") broken.push(`${d.id}:content`);
    } catch (e) {
      broken.push(`${d.id}:${String(e)}`);
    }
  }
  out.push({
    name: "every design renders a box (none throws, none comes out empty)",
    pass: broken.length === 0,
    detail: broken.join(" · ") || `${NUMBER_STYLES.length} designs render`,
  });

  const wide = NUMBER_STYLES.filter((d) => numberStyleAspect(d.id) > 1);
  out.push({
    name: "wide designs (pill, ribbon, ticket, step…) get a box wider than it is tall",
    pass: wide.length >= 4 && wide.every((d) => Number(renderNumberStyle(d.id, { ...BASE }, 54, "৭").style.width) > 54),
    detail: wide.map((d) => `${d.label} ${numberStyleAspect(d.id)}×`).join(" · "),
  });

  /* ---------------- the channels, at the renderer's own level -------------- */
  const filled = renderNumberStyle("circle", { ...BASE, bulletFill: "#123456" }, 54, "৭");
  out.push({
    name: "shape fill paints the marker's body and leaves the number's own ink alone",
    pass: String(filled.surface.background) === "#123456" && filled.color === "#ffffff",
    detail: `fill ${filled.surface.background} · ink ${filled.color}`,
  });

  const bare = renderNumberStyle("circle", { ...BASE, bulletFill: "transparent", bulletBorder: "transparent" }, 54, "৭");
  out.push({
    name: "“none” really paints nothing — no fill, no line, no leftover design border",
    pass: !bare.surface.background && !bare.surface.border,
    detail: `background=${bare.surface.background ?? "—"} border=${bare.surface.border ?? "—"}`,
  });

  const dashed = renderNumberStyle("square", { ...BASE, bulletBorder: "#ff0000", bulletBorderStyle: "dashed", bulletBorderWeight: 3 }, 54, "৭");
  out.push({
    name: "a border colour + dashed + weight reaches a box silhouette as a CSS border",
    pass: String(dashed.surface.border) === "3px dashed #ff0000",
    detail: String(dashed.surface.border ?? "—"),
  });

  const cut = renderNumberStyle("star", { ...BASE, bulletBorder: "#ff0000", bulletBorderStyle: "dotted", bulletBorderWeight: 2 }, 54, "৭");
  out.push({
    name: "a cut silhouette strokes its outline in SVG instead (a clipped CSS border would vanish)",
    pass:
      !!cut.outline &&
      cut.outline.style === "dotted" &&
      !!cut.outline.dash &&
      cut.outline.color === "#ff0000" &&
      cut.outline.width === 2 &&
      !cut.surface.border,
    detail: cut.outline ? `${cut.outline.style} ${cut.outline.width}px ${cut.outline.color} · dash ${cut.outline.dash}` : "no outline",
  });

  const rounded = renderNumberStyle("square", { ...BASE, bulletRadius: 12 }, 54, "৭");
  const cutRadius = renderNumberStyle("star", { ...BASE, bulletRadius: 12 }, 54, "৭");
  out.push({
    name: "the corner radius applies to box silhouettes (polygons keep their points)",
    pass: String(rounded.surface.borderRadius) === "12px" && !cutRadius.surface.borderRadius && !!cutRadius.surface.clipPath,
    detail: `box ${rounded.surface.borderRadius} · star clip=${cutRadius.surface.clipPath ? "yes" : "no"}`,
  });

  const faded = renderNumberStyle("circle", { ...BASE, bulletOpacity: 40 }, 54, "৭");
  out.push({
    name: "transparency fades the body only — the digits keep their own colour",
    pass: String(faded.surface.opacity) === "0.4" && faded.color === "#ffffff",
    detail: `surface opacity ${faded.surface.opacity} · ink ${faded.color}`,
  });

  /* a design whose own line is already rgba() must fade, never turn grey */
  const softLine = renderNumberStyle("squircle", { ...BASE, bulletOpacity: 50 }, 54, "৭");
  out.push({
    name: "…and a design whose own line is rgba() fades its alpha instead of losing its colour",
    pass: String(softLine.surface.border).includes("rgba(255, 255, 255, 0.25)"),
    detail: String(softLine.surface.border ?? "—"),
  });

  const nudged = renderNumberStyle("circle", { ...BASE, bulletNudgeX: 6, bulletNudgeY: -4 }, 54, "৭");
  out.push({
    name: "the position nudge rides on the marker's box, so it works attached or detached",
    pass: String(nudged.style.transform) === "translate(6px, -4px)",
    detail: String(nudged.style.transform ?? "—"),
  });

  /* ---------------------------- the toolbar line --------------------------- */
  nav("questionBullet");
  const labels = Array.from(line("Question bullet tools")?.querySelectorAll<HTMLElement>("button, input") ?? []).map(
    (el) => el.getAttribute("aria-label") ?? "",
  );
  out.push({
    name: "the Question bullet line carries design · size · colour · fill · border · shape · position · show/hide",
    pass: ["Bullet design", "Bullet size", "Bullet colour", "Shape fill", "Border colour", "Bullet shape", "Bullet position"].every((l) =>
      labels.some((x) => x.startsWith(l)),
    ),
    detail: labels.filter(Boolean).join(" · "),
  });

  out.push({
    name: "the marker paints its body on a layer of its own, with the number as the box's own node",
    pass: !!marker() && !!surface() && !!digits() && digits()?.textContent === "১" && !digits()?.hasAttribute("data-bullet-surface"),
    detail: `${marker()?.tagName ?? "no marker"} · surface ${surface() ? "yes" : "no"} · digits ${digits()?.textContent ?? "—"}`,
  });

  /* ------------------------- the design gallery card ----------------------- */
  click(barButton("Bullet design"));
  const listed = pop()?.querySelectorAll('[aria-label^="Bullet design:"]').length ?? 0;
  out.push({
    name: "the design card lists the whole gallery",
    pass: pop()?.getAttribute("data-pop-panel") === "Bullet design" && listed >= 30,
    detail: `${listed} designs · panel ${pop()?.getAttribute("data-pop-panel")}`,
  });
  click(designBtn("Scallop"));
  out.push({
    name: "picking a design repaints the marker with that silhouette",
    pass: !!surface()?.style.clipPath,
    detail: `clip ${surface()?.style.clipPath ? "seal" : "—"}`,
  });
  click(designBtn("Circle"));
  closePop();
  out.push({
    name: "…and picking a round design again drops the polygon",
    pass: !surface()?.style.clipPath && String(surface()?.style.borderRadius) === "50%",
    detail: `radius ${surface()?.style.borderRadius} · clip ${surface()?.style.clipPath ? "yes" : "—"}`,
  });

  /* --------------------------- the shape card ------------------------------ */
  click(barButton("Bullet shape"));
  const shapeCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "the shape card holds fill · border colour · border style · radius · weight · transparency",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Bullet shape" &&
      ["Shape fill colour", "Border colour", "Border style", "Border radius", "Border weight", "Transparency"].every((t) => shapeCard.includes(t)),
    detail: shapeCard.slice(0, 130),
  });

  click(popText("Dash"));
  type(popInput("Border radius (px)"), "14");
  type(popInput("Border weight (px)"), "4");
  type(popInput("Marker transparency (100 = fully visible)"), "50");
  out.push({
    name: "dashed · radius 14 · weight 4 · 50 % transparency all land on the marker's body",
    pass:
      css(surface()).includes("dashed") &&
      css(surface()).includes("4px") &&
      css(surface()).includes("border-radius: 14px") &&
      css(surface()).includes("opacity: 0.5"),
    detail: css(surface()),
  });
  out.push({
    name: "…and the number inside keeps its own ink and its own opacity",
    pass: !!digits() && !css(digits()).includes("opacity: 0.5"),
    detail: `digits ${css(digits()) || "(no inline style)"}`,
  });
  closePop();

  /* -------------------------- colours from the line ------------------------ */
  dial(barColor("Shape fill"), "#3366cc");
  dial(barColor("Border colour"), "#ffcc00");
  await frame();
  out.push({
    name: "the line's fill and border wells paint the marker straight away",
    pass: css(surface()).includes("51, 102, 204") && css(surface()).includes("255, 204, 0"),
    detail: css(surface()),
  });

  /* ---------------------- outline on a cut silhouette ---------------------- */
  click(barButton("Bullet design"));
  click(designBtn("Star"));
  closePop();
  click(barButton("Bullet shape"));
  click(popText("Double"));
  closePop();
  const svg = outline();
  out.push({
    name: "on a cut silhouette the outline is stroked in SVG (double line), never dropped",
    pass: svg?.getAttribute("data-bullet-outline") === "double" && svg.querySelectorAll("polygon").length === 2,
    detail: `${svg?.getAttribute("data-bullet-outline")} · ${svg?.querySelectorAll("polygon").length ?? 0} polygons`,
  });

  /* ----------------------------- the position card ------------------------- */
  click(barButton("Bullet position"));
  const posCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "the position card offers the nudge and the separate-element switch",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Bullet position" &&
      posCard.includes("Nudge horizontally") &&
      !!popText("Bullet is a separate movable element"),
    detail: posCard.slice(0, 110),
  });
  type(popInput("Bullet nudge horizontally"), "24");
  out.push({
    name: "the nudge moves the whole marker (the number travels with its shape)",
    pass: String(marker()?.style.transform).includes("24px"),
    detail: String(marker()?.style.transform ?? "(no transform)"),
  });
  click(popText("Bullet is a separate movable element"));
  closePop();
  out.push({
    name: "the separate-element switch hands the marker its own board element",
    pass: !!doc.querySelector('.slide-editable [data-el="bullet"]'),
    detail: doc.querySelector('.slide-editable [data-el="bullet"]') ? 'element data-el="bullet"' : "still attached to the question",
  });

  /* ---------------------------- the inspector side ------------------------- */
  nav("questionBullet");
  out.push({
    name: "the inspector's Question bullet destination shows the same shape and position controls",
    pass:
      ["Shape fill colour", "Border style", "Border weight", "Transparency", "Nudge horizontally"].every((t) => panelText().includes(t)) &&
      !!doc.querySelector("[data-bullet-shape-controls]") &&
      !!doc.querySelector("[data-bullet-position-controls]"),
    detail: panelText().slice(0, 140),
  });

  /* -------------------------------- Default -------------------------------- */
  click(line("Question bullet tools")?.querySelector<HTMLElement>("[data-toolbar-default]"));
  const reset = {
    nudge: !marker()?.style.transform,
    opaque: !css(surface()).includes("opacity"),
    solid: !css(surface()).includes("dashed"),
    round: String(surface()?.style.borderRadius) === "50%",
    noClip: !surface()?.style.clipPath,
    autoFill: !!barColor("Shape fill (auto until set)"),
  };
  out.push({
    name: "Default unwinds the whole shape in one click (design · fill · border · radius · weight · transparency · nudge)",
    pass: Object.values(reset).every(Boolean),
    detail: `${css(marker())} · ${JSON.stringify(reset)}`,
  });

  out.push({
    name: "no uncaught errors while styling the marker",
    pass: errors.length === 0,
    detail: errors.join(" | "),
  });

  act(() => root?.unmount());
  win.removeEventListener("error", onErr as EventListener);
  return out;
}
