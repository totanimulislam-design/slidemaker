/**
 * Title background effects suite.
 *
 * The "Banner effects" button of the Title background line opens the plate's
 * Effects card: its own softness · halo · shimmer lead, and then one section
 * per **category**, the way a design tool files its effects — Shadow (twelve
 * shadows on X · Y · Blur · Spread · Opacity · Colour), Glow (eight lights on
 * Type · Blur · Intensity · Colour), Blur (eight blurs on Type · Blur ·
 * Intensity · Direction · Colour), Glass (seven panes on Type · Blur ·
 * Intensity · Tint), Bevel (seven edges on Type · Depth · Blur · Angle ·
 * Colour), 3D (nine depths on Type · Depth · Blur · Angle · Colour), Highlight
 * (ten lights on Type · Blur · Intensity · Angle · Colour), Decorations and
 * Finishes, then the shape's own distortions. One effect wears at a time in
 * every category; the decorations and the distortions stack. These tests walk
 * every category and every one of its controls through to the slide, check the
 * Type row a reader (and the tiles) find, that every tile is a miniature of the
 * deck's own plate, and that every colour channel is Auto — the shape's own
 * paint. The last block drives a deck written before the categories through
 * `bannerEffectsOf`, which folds its old `depth` · `modern` · `glow` · `decor` ·
 * `common` groups into the category each effect belongs to.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";
import { bannerEffectsOf } from "../src/lib/banner";

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
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const popButton = (label: string) => pop()?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null;
const openCard = (label: string) => {
  click(doc.querySelector(`.context-toolbar [aria-label="${label}"]`));
};

const titleBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
const plate = () => titleBox()?.querySelector<HTMLElement>("[data-banner-plate]") ?? null;
/** the plate's own extra layers — behind the body (the streaks, the 3D slabs, the paper stacks) */
const plateLayers = () => Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-layer]") ?? []);
/** the effects' overlays — above the body, under the heading */
const overlays = () => Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-overlay]") ?? []);
const shadowOf = () => plate()?.style.boxShadow ?? "";
const filterOf = () => plate()?.style.filter ?? "";
const transformOf = () => plate()?.style.transform ?? "";
const styleOf = (el: HTMLElement | null) => el?.getAttribute("style") ?? "";
/** the tile's own spoken prefix — the 3D category reads "Banner 3D", not "Banner threeD" */
const prefixOf = (group: string) => (group === "threeD" ? "Banner 3D" : `Banner ${group}`);
/** one Effects tile's own miniature — the plate the tile previews (see BannerPlatePreview) */
const tilePreview = (group: string, label: string) =>
  pop()?.querySelector<HTMLElement>(`[data-banner-fx-group="${group}"] button[aria-label="${prefixOf(group)}: ${label}"] [data-banner-preview]`) ?? null;
/** the body of that miniature, with the effect dressed on it */
const tilePlate = (group: string, label: string) => tilePreview(group, label)?.querySelector<HTMLElement>("[data-banner-plate]") ?? null;
/** how many tiles a group holds, and how many of them paint a plate */
const tilesOf = (group: string) => pop()?.querySelectorAll(`[data-banner-fx-group="${group}"] [role="option"]`).length ?? 0;
const previewsOf = (group: string) => pop()?.querySelectorAll(`[data-banner-fx-group="${group}"] [data-banner-preview]`).length ?? 0;
/** the controls a category shows, by the labels the card gives them */
const ctrl = (group: string, label: string) => pop()?.querySelector<HTMLInputElement>(`[data-banner-fx-group="${group}"] input[aria-label="${label}"]`) ?? null;
/** the colour well of a category */
const well = (group: string) => pop()?.querySelector<HTMLInputElement>(`[data-banner-fx-group="${group}"] input[type="color"]`) ?? null;
const setColor = (el: HTMLInputElement | null, hex: string) => {
  if (!el) return;
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, hex);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};
/** the deck's plate colour as the effects read it, in both spellings — jsdom
    normalizes a colour inside a gradient, so a style string may carry either */
const PLATE = "#1f5fd0";
const rgbOf = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const PLATE_RGB = rgbOf(PLATE);
/** does this element's own style paint with that colour, in either spelling? */
const triple = (hex: string) =>
  `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
const painted = (el: HTMLElement | null, hex: string) => {
  const s = styleOf(el);
  return s.includes(hex) || s.includes(rgbOf(hex)) || s.includes(hex.replace("#", "")) || s.includes(triple(hex));
};
/** how many paints a background string stacks, one per `…-gradient(` */
const paints = (s: string) => (s.match(/gradient\(/g) ?? []).length;
/** the Auto button a category's colour well carries */
const hasAuto = (group: string) =>
  Array.from(pop()?.querySelectorAll(`[data-banner-fx-group="${group}"] button`) ?? []).some((b) => b.textContent?.trim() === "Auto");

const CATEGORIES = ["shadow", "glow", "blur", "glass", "bevel", "threeD", "highlight", "decor", "modern", "shape"];
/** every category and the tiles it holds, plus the None that turns it off */
const TYPE_COUNTS: Record<string, number> = {
  shadow: 12,
  glow: 8,
  blur: 8,
  glass: 7,
  bevel: 7,
  threeD: 9,
  highlight: 10,
  decor: 22,
  modern: 7,
};

export async function runBannerFxTests(): Promise<CaseResult[]> {
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
  openCard("Banner effects");

  /* ------------------------- the card's own structure ---------------------- */
  out.push({
    name: "the Effects card files its seven effect categories — Shadow · Glow · Blur · Glass · Bevel · 3D · Highlight — with the Decorations, the Finishes and the shape's own effects, and keeps softness · halo · shimmer",
    pass:
      CATEGORIES.every((g) => !!pop()?.querySelector(`[data-banner-fx-group="${g}"]`)) &&
      !!pop()?.querySelector('input[aria-label="Banner softness"]') &&
      !!pop()?.querySelector('input[aria-label="Banner halo"]') &&
      Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).some((b) => (b.textContent ?? "").includes("Shimmer")),
    detail: CATEGORIES.map((g) => `${g}:${!!pop()?.querySelector(`[data-banner-fx-group="${g}"]`)}`).join(" "),
  });
  out.push({
    name: "every category says what its Type control offers, and the seven effect categories name their own family",
    pass: CATEGORIES.slice(0, 7).every((g) => {
      const group = pop()?.querySelector<HTMLElement>(`[data-banner-fx-group="${g}"]`);
      return (group?.textContent ?? "").includes("Type");
    }),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group]') ?? [])
      .map((g) => g.getAttribute("data-banner-fx-group"))
      .join(" · "),
  });

  /* ---------------------------- the tiles themselves ----------------------- */
  const shadowLabels = [
    "Drop Shadow", "Soft Shadow", "Hard Shadow", "Long Shadow", "Inner Shadow", "Floating Shadow",
    "Offset Shadow", "Colored Shadow", "Double Shadow", "Surround Shadow", "Layered Shadows", "Cast Shadow",
  ];
  out.push({
    name: "Shadow holds its twelve shadows as tiles — Drop · Soft · Hard · Long · Inner · Floating · Offset · Colored · Double · Surround · Layered · Cast — plus None",
    pass: shadowLabels.every((l) => !!popButton(`Banner shadow: ${l}`)) && !!popButton("Banner shadow: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="shadow"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner shadow: ", ""))
      .join(" / "),
  });
  out.push({
    name: "Glow holds its eight lights — Outer · Inner · Neon · Soft · Halo · Backlight · Aurora · Outline Glow",
    pass:
      ["Outer Glow", "Inner Glow", "Neon Glow", "Soft Glow", "Halo", "Backlight", "Aurora", "Outline Glow"].every((l) =>
        !!popButton(`Banner glow: ${l}`),
      ) && !!popButton("Banner glow: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="glow"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner glow: ", ""))
      .join(" / "),
  });
  out.push({
    name: "Blur holds its eight blurs — Soft · Gaussian · Backdrop · Motion · Zoom · Feather · Bloom · Frosted",
    pass:
      ["Soft Blur", "Gaussian Blur", "Backdrop Blur", "Motion Blur", "Zoom Blur", "Feather", "Bloom Blur", "Frosted Blur"].every((l) =>
        !!popButton(`Banner blur: ${l}`),
      ) && !!popButton("Banner blur: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="blur"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner blur: ", ""))
      .join(" / "),
  });
  out.push({
    name: "Glass holds its seven panes — Glassmorphism · Frosted · Acrylic · Blur Background · Transparent · Tinted · Glass Edge",
    pass:
      ["Glassmorphism", "Frosted Glass", "Acrylic", "Blur Background", "Transparent Glass", "Tinted Glass", "Glass Edge"].every((l) =>
        !!popButton(`Banner glass: ${l}`),
      ) && !!popButton("Banner glass: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="glass"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner glass: ", ""))
      .join(" / "),
  });
  out.push({
    name: "Bevel holds its seven edges — Bevel · Inner · Outer · Emboss · Ridge · Groove · Pillow",
    pass:
      ["Bevel", "Inner Bevel", "Outer Bevel", "Emboss", "Ridge", "Groove", "Pillow"].every((l) => !!popButton(`Banner bevel: ${l}`)) &&
      !!popButton("Banner bevel: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="bevel"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner bevel: ", ""))
      .join(" / "),
  });
  out.push({
    name: "3D holds its nine depths — Extrusion · Depth · Layered · Perspective · Tilt · Pop Out · Raised · Pressed · Isometric",
    pass:
      ["3D Extrusion", "Depth", "Layered 3D", "Perspective", "Tilt", "Pop Out", "Raised", "Pressed / Inset", "Isometric"].every((l) =>
        !!popButton(`Banner 3D: ${l}`),
      ) && !!popButton("Banner 3D: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="threeD"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner 3D: ", ""))
      .join(" / "),
  });
  out.push({
    name: "Highlight holds its ten lights — Highlight · Inner · Outer · Edge · Gloss · Sheen · Shine · Reflection · Spotlight · Rim Light",
    pass:
      ["Highlight", "Inner Highlight", "Outer Highlight", "Edge Highlight", "Gloss", "Sheen", "Shine", "Light Reflection", "Spotlight", "Rim Light"].every((l) =>
        !!popButton(`Banner highlight: ${l}`),
      ) && !!popButton("Banner highlight: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="highlight"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner highlight: ", ""))
      .join(" / "),
  });
  out.push({
    name: "every category's tile count is the family's own — one None plus the family's whole Type list",
    pass: Object.entries(TYPE_COUNTS).every(([g, n]) => tilesOf(g) === n + 1),
    detail: Object.entries(TYPE_COUNTS).map(([g, n]) => `${g}:${tilesOf(g)}/${n + 1}`).join(" "),
  });

  /* the tiles preview the plate itself — the same language the Shape card's
     tiles and the text background's Effects strip speak, in the plate's colour */
  out.push({
    name: "every effect tile paints the deck's own plate — silhouette, paint and the effect on top — one miniature per tile in every category",
    pass:
      Object.keys(TYPE_COUNTS).every((gr) => previewsOf(gr) === tilesOf(gr) && !!tilePreview(gr, "None")) &&
      !!tilePlate("shadow", "Long Shadow") &&
      !!tilePlate("decor", "Sticker"),
    detail: Object.keys(TYPE_COUNTS).map((gr) => `${gr}:${previewsOf(gr)}/${tilesOf(gr)}`).join(" "),
  });
  out.push({
    name: "a tile is the plate in the SHAPE'S colour — the miniature carries the fill, not a generic mark",
    pass: painted(tilePlate("shadow", "None"), PLATE) && painted(tilePlate("glow", "Outer Glow"), PLATE),
    detail: styleOf(tilePlate("shadow", "None")).slice(0, 90),
  });
  out.push({
    name: "and the effect is painted on that miniature — the Drop Shadow tile already throws the plate's colour, the None tile throws nothing",
    pass:
      styleOf(tilePlate("shadow", "Drop Shadow")).includes("box-shadow") &&
      styleOf(tilePlate("shadow", "Drop Shadow")).includes("rgba(31, 95, 208, 0.5)") &&
      !styleOf(tilePlate("shadow", "None")).includes("box-shadow"),
    detail: styleOf(tilePlate("shadow", "Drop Shadow")).slice(0, 110),
  });

  /* ------------------------------- shadow ---------------------------------- */
  click(popButton("Banner shadow: Drop Shadow"));
  out.push({
    name: "Drop Shadow paints the plate's own box-shadow from its six controls — X 0 · Y 8 · Blur 24 · Spread 0 · Opacity 50 · the SHAPE'S colour",
    pass: shadowOf() === "0px 8px 24px 0px rgba(31, 95, 208, 0.5)",
    detail: shadowOf(),
  });
  out.push({
    name: "the shadow's colour well reads Auto and shows the shape's colour — the plate's paint is what the effect wears",
    pass: (well("shadow")?.value ?? "").toLowerCase() === PLATE && hasAuto("shadow"),
    detail: `${well("shadow")?.value} + Auto`,
  });
  out.push({
    name: "the shadow's controls are exactly X · Y · Blur · Spread · Opacity and a colour well",
    pass:
      ["Banner fx: shadow X (px)", "Banner fx: shadow Y (px)", "Banner fx: shadow blur (px)", "Banner fx: shadow spread (px)", "Banner fx: shadow opacity (%)"].every(
        (l) => ctrl("shadow", l)?.type === "range",
      ) && !!well("shadow"),
    detail: ["X", "Y", "Blur", "Spread", "Opacity"].map((l) => ctrl("shadow", `Banner fx: shadow ${l.toLowerCase()}${l === "X" || l === "Y" ? " (px)" : ""}`)?.type).join(","),
  });
  const sx = ctrl("shadow", "Banner fx: shadow X (px)");
  type(sx, "20");
  type(ctrl("shadow", "Banner fx: shadow Y (px)"), "-12");
  type(ctrl("shadow", "Banner fx: shadow blur (px)"), "40");
  type(ctrl("shadow", "Banner fx: shadow spread (px)"), "6");
  type(ctrl("shadow", "Banner fx: shadow opacity (%)"), "80");
  out.push({
    name: "…and each of the six walks the shadow — 20 · -12 · 40 · 6 · 80% all reach the plate",
    pass: shadowOf() === "20px -12px 40px 6px rgba(31, 95, 208, 0.8)",
    detail: shadowOf(),
  });
  setColor(well("shadow"), "#29b36f");
  await frame();
  out.push({
    name: "Colored Shadow wears the picked colour — the well repaints the shadow itself",
    pass: shadowOf().includes("rgba(41, 179, 111,"),
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Long Shadow"));
  out.push({
    name: "Long Shadow runs a diagonal streak out of the plate, on a layer of its own behind the body",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.background ?? "").includes("linear-gradient(135deg") &&
      (plateLayers()[0]?.style.transform ?? "").includes("translate(18px, 18px)"),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 30)}`,
  });
  click(popButton("Banner shadow: Inner Shadow"));
  out.push({
    name: "Inner Shadow falls inside the plate",
    pass: shadowOf().startsWith("inset"),
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Floating Shadow"));
  out.push({
    name: "Floating Shadow is a ground shadow — the plate lifts off the board",
    pass: shadowOf().includes("rgba(") && shadowOf().includes("-"),
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Double Shadow"));
  out.push({
    name: "Double Shadow throws a hard copy on each of two opposite sides — X · Y walk both at once",
    pass: (shadowOf().match(/rgba\(/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Layered Shadows"));
  out.push({
    name: "Layered Shadows stack three fall-offs, each one further and fainter",
    pass: (shadowOf().match(/rgba\(/g) ?? []).length === 3,
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Cast Shadow"));
  out.push({
    name: "Cast Shadow is thrown onto the board — a soft ellipse skewed away, on a layer of its own",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.background ?? "").includes("radial-gradient") &&
      (plateLayers()[0]?.style.transform ?? "").includes("skewX("),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 44)}`,
  });
  click(popButton("Banner shadow: None"));
  out.push({
    name: "…and None takes the whole shadow off",
    pass: shadowOf() === "" && plateLayers().length === 0,
    detail: shadowOf() || "clean",
  });

  /* -------------------------------- glow ----------------------------------- */
  click(popButton("Banner glow: Outer Glow"));
  const outerGlow = shadowOf();
  out.push({
    name: "Outer Glow blooms in the shape's own colour — two fall-offs, the tight one and the wide",
    pass: outerGlow.includes(triple(PLATE)) && (outerGlow.match(/rgba\(/g) ?? []).length === 2,
    detail: outerGlow,
  });
  out.push({
    name: "the glow's controls are Type · Blur · Intensity · Colour",
    pass:
      ctrl("glow", "Banner fx: glow blur (px)")?.type === "range" &&
      ctrl("glow", "Banner fx: glow intensity")?.type === "range" &&
      !!well("glow") &&
      tilesOf("glow") === 9,
    detail: `${ctrl("glow", "Banner fx: glow blur (px)")?.min}–${ctrl("glow", "Banner fx: glow blur (px)")?.max} · ${ctrl("glow", "Banner fx: glow intensity")?.min}–${ctrl("glow", "Banner fx: glow intensity")?.max}`,
  });
  type(ctrl("glow", "Banner fx: glow intensity"), "100");
  const glowFull = shadowOf();
  out.push({
    name: "…and Intensity walks the reach — 100 blooms wider than the default 55",
    pass: glowFull !== outerGlow && glowFull.includes("0 0 56px"),
    detail: `55 → ${outerGlow.slice(0, 34)} · 100 → ${glowFull.slice(0, 34)}`,
  });
  type(ctrl("glow", "Banner fx: glow blur (px)"), "20");
  out.push({
    name: "…and Blur widens it again — the bloom the intensity alone gave, plus the blur the teacher adds",
    pass: shadowOf().includes("0 0 72px") && shadowOf().includes("0 0 152px"),
    detail: shadowOf(),
  });
  click(popButton("Banner glow: Neon Glow"));
  out.push({
    name: "Neon Glow stacks three blooms — the bright tube and its wide halo",
    pass: (shadowOf().match(/rgba\(/g) ?? []).length === 3,
    detail: shadowOf(),
  });
  click(popButton("Banner glow: Inner Glow"));
  out.push({
    name: "Inner Glow blooms from the plate's inside",
    pass: shadowOf().startsWith("inset"),
    detail: shadowOf(),
  });
  click(popButton("Banner glow: Backlight"));
  out.push({
    name: "Backlight blooms a strong light from behind the plate, on a layer of its own",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.background ?? "").includes("radial-gradient") &&
      (plateLayers()[0]?.style.transform ?? "").includes("scale("),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 24)}`,
  });
  click(popButton("Banner glow: Aurora"));
  out.push({
    name: "Aurora shifts the light through several hues across the body, as an overlay above it",
    pass:
      overlays().length === 1 &&
      (overlays()[0]?.style.background ?? "").includes("linear-gradient") &&
      ((overlays()[0]?.style.background ?? "").match(/rgba\(/g) ?? []).length >= 4,
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner glow: Outline Glow"));
  out.push({
    name: "Outline Glow rings the plate in a colour of its own",
    pass: shadowOf().includes("0 0 ") && (shadowOf().match(/rgba\(/g) ?? []).length === 1,
    detail: shadowOf(),
  });
  click(popButton("Banner glow: Halo"));
  out.push({
    name: "Halo lays a broad, even ring of light all round the plate",
    pass: (shadowOf().match(/rgba\(/g) ?? []).length === 2 && /0 0 1[0-9][0-9]px/.test(shadowOf()),
    detail: shadowOf(),
  });
  setColor(well("glow"), "#22d3ee");
  await frame();
  out.push({
    name: "the glow's colour well repaints the light — #22d3ee reaches the plate",
    pass: shadowOf().includes("34, 211, 238") || shadowOf().includes("#22d3ee"),
    detail: shadowOf(),
  });
  click(popButton("Banner glow: None"));
  out.push({
    name: "…and None leaves the edge clean again",
    pass: shadowOf() === "" && plateLayers().length === 0 && overlays().length === 0,
    detail: `shadow ${shadowOf() || "clean"} · layers ${plateLayers().length}`,
  });

  /* -------------------------------- blur ----------------------------------- */
  click(popButton("Banner blur: Soft Blur"));
  out.push({
    name: "Soft Blur blurs the plate itself, through the body's own filter",
    pass: filterOf() === "blur(12px)",
    detail: filterOf(),
  });
  out.push({
    name: "the blur's controls are Type · Blur · Intensity · Direction · Colour",
    pass:
      ctrl("blur", "Banner fx: blur amount (px)")?.type === "range" &&
      ctrl("blur", "Banner fx: blur intensity")?.type === "range" &&
      ctrl("blur", "Banner fx: blur direction (deg)")?.type === "range" &&
      !!well("blur") &&
      tilesOf("blur") === 9,
    detail: `blur · intensity · direction`,
  });
  type(ctrl("blur", "Banner fx: blur amount (px)"), "20");
  out.push({
    name: "…and the Blur bar walks it — 20px reaches the body's filter",
    pass: filterOf() === "blur(20px)",
    detail: filterOf(),
  });
  click(popButton("Banner blur: Gaussian Blur"));
  out.push({
    name: "Gaussian Blur blurs deeper and melts the edge away — a mask on top of the blur",
    pass: filterOf().includes("blur(") && (plate()?.style.maskImage ?? "").includes("radial-gradient"),
    detail: `${filterOf()} · ${(plate()?.style.maskImage ?? "").slice(0, 40)}`,
  });
  click(popButton("Banner blur: Backdrop Blur"));
  out.push({
    name: "Backdrop Blur blurs only the board behind the plate",
    pass: !!overlays()[0]?.style.backdropFilter && filterOf() === "",
    detail: `${overlays()[0]?.style.backdropFilter ?? ""} · filter ${filterOf() || "clean"}`,
  });
  click(popButton("Banner blur: Motion Blur"));
  out.push({
    name: "Motion Blur smears the plate and runs a trail behind it, the way Direction points",
    pass: filterOf().includes("blur(") && plateLayers().length === 1 && (plateLayers()[0]?.style.transform ?? "").includes("translate("),
    detail: `${filterOf()} · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 34)}`,
  });
  click(popButton("Banner blur: Zoom Blur"));
  out.push({
    name: "Zoom Blur smears out from the middle — a scaled, blurred copy behind the body",
    pass: filterOf().includes("blur(") && (plateLayers()[0]?.style.transform ?? "").includes("scale("),
    detail: `${filterOf()} · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 26)}`,
  });
  click(popButton("Banner blur: Feather"));
  out.push({
    name: "Feather melts the edge into the board, along the Direction — a gradient mask on the body",
    pass: (plate()?.style.maskImage ?? "").includes("linear-gradient") && filterOf() === "",
    detail: (plate()?.style.maskImage ?? "").slice(0, 60),
  });
  click(popButton("Banner blur: Bloom Blur"));
  out.push({
    name: "Bloom Blur wears a blurred coloured copy of the plate behind it",
    pass: plateLayers().length === 1 && (plateLayers()[0]?.style.filter ?? "").includes("blur("),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.filter ?? "").slice(0, 22)}`,
  });
  click(popButton("Banner blur: Frosted Blur"));
  out.push({
    name: "Frosted Blur blurs the plate under a frost of the tint",
    pass: filterOf().includes("blur(") && !!overlays()[0]?.style.backdropFilter,
    detail: `${filterOf()} · ${overlays()[0]?.style.backdropFilter ?? ""}`,
  });
  setColor(well("blur"), "#a78bfa");
  await frame();
  out.push({
    name: "the blur's colour follows its own well — the frost repaints in the picked tint",
    pass: (overlays()[0]?.style.backdropFilter ?? "").includes("blur(") || (plateLayers()[0]?.style.background ?? "").includes("167, 139, 250"),
    detail: overlays()[0]?.style.backdropFilter ?? "",
  });
  click(popButton("Banner blur: None"));
  out.push({
    name: "…and None clears the blur — filter, mask and layers all clean",
    pass: filterOf() === "" && (plate()?.style.maskImage ?? "") === "" && plateLayers().length === 0,
    detail: `filter ${filterOf() || "clean"} · mask ${(plate()?.style.maskImage ?? "") || "clean"}`,
  });

  /* -------------------------------- glass ---------------------------------- */
  click(popButton("Banner glass: Glassmorphism"));
  out.push({
    name: "Glassmorphism paints a translucent pane with a rim and a backdrop blur",
    pass:
      overlays().length === 1 &&
      !!overlays()[0]?.style.backdropFilter &&
      (overlays()[0]?.style.border ?? "").includes("solid") &&
      (overlays()[0]?.style.background ?? "").includes("linear-gradient"),
    detail: `${overlays()[0]?.style.backdropFilter ?? ""} · ${(overlays()[0]?.style.border ?? "").slice(0, 30)}`,
  });
  out.push({
    name: "the glass controls are Type · Blur · Intensity · Tint",
    pass:
      ctrl("glass", "Banner fx: glass blur (px)")?.type === "range" &&
      ctrl("glass", "Banner fx: glass intensity")?.type === "range" &&
      !!well("glass") &&
      tilesOf("glass") === 8,
    detail: `${ctrl("glass", "Banner fx: glass blur (px)")?.min}–${ctrl("glass", "Banner fx: glass blur (px)")?.max}`,
  });
  type(ctrl("glass", "Banner fx: glass blur (px)"), "20");
  out.push({
    name: "…and its Blur walks the frost",
    pass: (overlays()[0]?.style.backdropFilter ?? "").includes("blur(9px)"),
    detail: overlays()[0]?.style.backdropFilter ?? "",
  });
  click(popButton("Banner glass: Tinted Glass"));
  out.push({
    name: "Tinted Glass lays colour with no blur at all",
    pass: !overlays()[0]?.style.backdropFilter && (overlays()[0]?.style.background ?? "").includes("rgba("),
    detail: `${overlays()[0]?.style.background ?? ""} · backdrop ${overlays()[0]?.style.backdropFilter || "none"}`,
  });
  click(popButton("Banner glass: Glass Edge"));
  out.push({
    name: "Glass Edge reads the pane by its lit edge alone",
    pass: (overlays()[0]?.style.border ?? "").includes("solid") && (overlays()[0]?.style.boxShadow ?? "").includes("inset"),
    detail: `${(overlays()[0]?.style.border ?? "").slice(0, 26)} · ${(overlays()[0]?.style.boxShadow ?? "").slice(0, 34)}`,
  });
  const glassBefore = styleOf(overlays()[0] ?? null);
  setColor(well("glass"), "#fbcfe8");
  await frame();
  out.push({
    name: "the glass Tint repaints the pane — the picked tint reaches the plate's own tones",
    pass: styleOf(overlays()[0] ?? null) !== glassBefore && styleOf(overlays()[0] ?? null).includes("rgba("),
    detail: `${glassBefore.slice(0, 40)} → ${styleOf(overlays()[0] ?? null).slice(0, 40)}`,
  });
  click(popButton("Banner glass: None"));
  out.push({
    name: "…and None takes the pane away",
    pass: overlays().length === 0,
    detail: `${overlays().length} overlays`,
  });

  /* -------------------------------- bevel ---------------------------------- */
  click(popButton("Banner bevel: Bevel"));
  const bevel0 = shadowOf();
  out.push({
    name: "Bevel lights one edge and shades the other — two inset cuts on the body",
    pass: (bevel0.match(/inset/g) ?? []).length === 2,
    detail: bevel0,
  });
  out.push({
    name: "the bevel's controls are Type · Depth · Blur · Angle · Colour",
    pass:
      ctrl("bevel", "Banner fx: bevel depth")?.type === "range" &&
      ctrl("bevel", "Banner fx: bevel blur (px)")?.type === "range" &&
      ctrl("bevel", "Banner fx: bevel angle (deg)")?.type === "range" &&
      !!well("bevel") &&
      tilesOf("bevel") === 8,
    detail: `${ctrl("bevel", "Banner fx: bevel depth")?.min}–${ctrl("bevel", "Banner fx: bevel depth")?.max} · angle ${ctrl("bevel", "Banner fx: bevel angle (deg)")?.min}–${ctrl("bevel", "Banner fx: bevel angle (deg)")?.max}`,
  });
  type(ctrl("bevel", "Banner fx: bevel angle (deg)"), "90");
  const bevel90 = shadowOf();
  out.push({
    name: "…and the lit edge follows the light — 90° bevels a different way than 0°",
    pass: bevel90 !== bevel0,
    detail: `0° ${bevel0.slice(0, 40)} · 90° ${bevel90.slice(0, 40)}`,
  });
  type(ctrl("bevel", "Banner fx: bevel depth"), "100");
  out.push({
    name: "…and Depth cuts it deeper — the edge steps further out",
    pass: shadowOf() !== bevel90 && (shadowOf().match(/inset/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  type(ctrl("bevel", "Banner fx: bevel blur (px)"), "12");
  out.push({
    name: "…and Blur softens the cut — the edge's own blur reaches the shadow",
    pass: shadowOf().includes("12px"),
    detail: shadowOf(),
  });
  click(popButton("Banner bevel: Outer Bevel"));
  out.push({
    name: "Outer Bevel is the one bevel cast outward — its edge is not inset",
    pass: (shadowOf().match(/inset/g) ?? []).length === 0 && (shadowOf().match(/rgba\(/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  click(popButton("Banner bevel: Ridge"));
  out.push({
    name: "Ridge cuts a hard line of light down one side and shade down the other — no blur at all",
    pass: (shadowOf().match(/inset/g) ?? []).length === 2 && (shadowOf().match(/ 0px /g) ?? []).length >= 2,
    detail: shadowOf(),
  });
  click(popButton("Banner bevel: Groove"));
  out.push({
    name: "Groove cuts a hard line in, the light on the far side",
    pass: (shadowOf().match(/inset/g) ?? []).length === 2 && shadowOf() !== "",
    detail: shadowOf(),
  });
  click(popButton("Banner bevel: Pillow"));
  out.push({
    name: "Pillow lights both edges, the middle left rounded",
    pass: (shadowOf().match(/inset/g) ?? []).length === 2 && Number(ctrl("bevel", "Banner fx: bevel blur (px)")?.value) === 4,
    detail: shadowOf(),
  });
  setColor(well("bevel"), "#000000");
  await frame();
  out.push({
    name: "the bevel's colour well repaints the cut — a picked black shades the plate's own edge",
    pass: shadowOf().includes("rgba("),
    detail: shadowOf(),
  });
  click(popButton("Banner bevel: None"));
  out.push({
    name: "…and None leaves the plate flat",
    pass: shadowOf() === "",
    detail: shadowOf() || "clean",
  });

  /* ---------------------------------- 3D ----------------------------------- */
  click(popButton("Banner 3D: 3D Extrusion"));
  out.push({
    name: "3D Extrusion stands a slab of the plate behind the body and throws its own fall",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.transform ?? "").includes("translate(") &&
      shadowOf().includes(triple(PLATE)),
    detail: `${plateLayers().length} slab · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 30)} · ${shadowOf().slice(0, 30)}`,
  });
  out.push({
    name: "the 3D controls are Type · Depth · Blur · Angle · Colour",
    pass:
      ctrl("threeD", "Banner fx: 3D depth")?.type === "range" &&
      ctrl("threeD", "Banner fx: 3D blur (px)")?.type === "range" &&
      ctrl("threeD", "Banner fx: 3D angle (deg)")?.type === "range" &&
      !!well("threeD") &&
      tilesOf("threeD") === 10,
    detail: `${ctrl("threeD", "Banner fx: 3D depth")?.min}–${ctrl("threeD", "Banner fx: 3D depth")?.max}`,
  });
  const extrusion90 = (plateLayers()[0]?.style.transform ?? "") + shadowOf();
  type(ctrl("threeD", "Banner fx: 3D angle (deg)"), "180");
  out.push({
    name: "…and Angle runs the depth — 180° stands the slab the other way than 90°",
    pass: ((plateLayers()[0]?.style.transform ?? "") + shadowOf()) !== extrusion90,
    detail: `90° ${extrusion90.slice(0, 40)} · 180° ${((plateLayers()[0]?.style.transform ?? "") + shadowOf()).slice(0, 40)}`,
  });
  const fallBefore = shadowOf();
  type(ctrl("threeD", "Banner fx: 3D blur (px)"), "16");
  out.push({
    name: "…and Blur softens the fall the depth throws",
    pass: shadowOf() !== fallBefore && shadowOf().includes("31px"),
    detail: `${fallBefore.slice(0, 40)} → ${shadowOf().slice(0, 40)}`,
  });
  click(popButton("Banner 3D: Perspective"));
  out.push({
    name: "Perspective tips the plate back in space",
    pass: transformOf().includes("perspective(") && transformOf().includes("rotateX("),
    detail: transformOf(),
  });
  click(popButton("Banner 3D: Tilt"));
  out.push({
    name: "Tilt tips the plate on its vertical axis",
    pass: transformOf().includes("perspective(") && transformOf().includes("rotateY("),
    detail: transformOf(),
  });
  click(popButton("Banner 3D: Pop Out"));
  out.push({
    name: "Pop Out lifts the plate toward the reader — a scale on the body, a soft lift below",
    pass: transformOf().includes("scale(") && shadowOf().includes("rgba("),
    detail: `${transformOf()} · ${shadowOf().slice(0, 30)}`,
  });
  click(popButton("Banner 3D: Layered 3D"));
  out.push({
    name: "Layered 3D steps three slabs out behind the body",
    pass: plateLayers().length === 3 && plateLayers().every((l) => (l.style.transform ?? "").includes("translate(")),
    detail: `${plateLayers().length} slabs`,
  });
  click(popButton("Banner 3D: Isometric"));
  out.push({
    name: "Isometric runs one hard-edged block off at the Angle — no blur on the slab",
    pass: plateLayers().length === 1 && !(plateLayers()[0]?.style.filter ?? "").includes("blur("),
    detail: `${plateLayers().length} block · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 30)}`,
  });
  click(popButton("Banner 3D: Raised"));
  out.push({
    name: "Raised lifts the plate off the board with a lit top edge",
    pass: shadowOf().includes("inset 0 1px") && shadowOf().includes("rgba("),
    detail: shadowOf(),
  });
  click(popButton("Banner 3D: Pressed / Inset"));
  out.push({
    name: "Pressed pushes the plate in — the shadow falls inside it",
    pass: (shadowOf().match(/inset/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  const pressedBefore = shadowOf();
  setColor(well("threeD"), "#7c3aed");
  await frame();
  out.push({
    name: "the 3D colour repaints the pressed edge — a picked colour reaches the body",
    pass: shadowOf() !== pressedBefore && shadowOf().includes("rgba("),
    detail: `${pressedBefore.slice(0, 40)} → ${shadowOf().slice(0, 40)}`,
  });
  click(popButton("Banner 3D: None"));
  out.push({
    name: "…and None lays the plate flat again",
    pass: transformOf() === "" && shadowOf() === "" && plateLayers().length === 0,
    detail: `transform ${transformOf() || "clean"} · shadow clean`,
  });

  /* ------------------------------ highlight -------------------------------- */
  click(popButton("Banner highlight: Highlight"));
  out.push({
    name: "Highlight lays daylight along the top edge, as an overlay above the body",
    pass: overlays().length === 1 && (overlays()[0]?.style.background ?? "").includes("linear-gradient(0deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 56),
  });
  out.push({
    name: "the highlight's controls are Type · Intensity · Blur · Angle · Colour",
    pass:
      ctrl("highlight", "Banner fx: highlight intensity")?.type === "range" &&
      ctrl("highlight", "Banner fx: highlight blur (px)")?.type === "range" &&
      ctrl("highlight", "Banner fx: highlight angle (deg)")?.type === "range" &&
      !!well("highlight") &&
      tilesOf("highlight") === 11,
    detail: `angle ${ctrl("highlight", "Banner fx: highlight angle (deg)")?.min}–${ctrl("highlight", "Banner fx: highlight angle (deg)")?.max}`,
  });
  click(popButton("Banner highlight: Sheen"));
  const sheen0 = overlays()[0]?.style.background ?? "";
  type(ctrl("highlight", "Banner fx: highlight angle (deg)"), "180");
  out.push({
    name: "…and Angle turns the light — 180° runs the sheen the other way than the default 25°",
    pass: sheen0.includes("25deg") && (overlays()[0]?.style.background ?? "").includes("180deg"),
    detail: `25° ${sheen0.slice(0, 40)} · 180° ${(overlays()[0]?.style.background ?? "").slice(0, 40)}`,
  });
  type(ctrl("highlight", "Banner fx: highlight blur (px)"), "30");
  out.push({
    name: "…and Blur widens the sheen's own spread",
    pass: (overlays()[0]?.style.background ?? "") !== sheen0,
    detail: (overlays()[0]?.style.background ?? "").slice(0, 60),
  });
  click(popButton("Banner highlight: Gloss"));
  out.push({
    name: "Gloss paints the polished top half, hard edge and all",
    pass: (overlays()[0]?.style.background ?? "").includes("linear-gradient(0deg") && (overlays()[0]?.style.background ?? "").includes("47%"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 56),
  });
  click(popButton("Banner highlight: Shine"));
  out.push({
    name: "Shine flashes a hard highlight across the body",
    pass: paints(overlays()[0]?.style.background ?? "") === 2,
    detail: `${paints(overlays()[0]?.style.background ?? "")} paints`,
  });
  click(popButton("Banner highlight: Light Reflection"));
  out.push({
    name: "Light Reflection lays a thin streak across the body",
    pass: overlays().length === 1 && (overlays()[0]?.style.background ?? "").includes("linear-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner highlight: Spotlight"));
  out.push({
    name: "Spotlight falls on the plate from the Angle's side, as an overlay above the body",
    pass: overlays().length === 1 && (overlays()[0]?.style.background ?? "").includes("radial-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 48),
  });
  click(popButton("Banner highlight: Rim Light"));
  out.push({
    name: "Rim Light hugs the edge with a bright hairline and a little bloom",
    pass: shadowOf().startsWith("inset 0 0 0") && (shadowOf().match(/rgba\(/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  click(popButton("Banner highlight: Edge Highlight"));
  out.push({
    name: "Edge Highlight brightens the rim from inside",
    pass: shadowOf().startsWith("inset"),
    detail: shadowOf(),
  });
  click(popButton("Banner highlight: Outer Highlight"));
  out.push({
    name: "Outer Highlight rings the plate from outside",
    pass: (shadowOf().match(/rgba\(/g) ?? []).length === 2 && !shadowOf().startsWith("inset"),
    detail: shadowOf(),
  });
  click(popButton("Banner highlight: Inner Highlight"));
  out.push({
    name: "Inner Highlight washes light down from the top edge",
    pass: (overlays()[0]?.style.background ?? "").includes("linear-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 48),
  });
  setColor(well("highlight"), "#ffd633");
  await frame();
  out.push({
    name: "the highlight's colour well repaints the light",
    pass: painted(overlays()[0] ?? null, "#ffd633"),
    detail: styleOf(overlays()[0] ?? null).slice(0, 90),
  });
  click(popButton("Banner highlight: None"));
  out.push({
    name: "…and None leaves the plate bare again",
    pass: overlays().length === 0 && shadowOf() === "",
    detail: `${overlays().length} overlays · ${shadowOf() || "clean"}`,
  });

  /* ----------------------------- decorations ------------------------------- */
  click(popButton("Banner decor: Vignette"));
  out.push({
    name: "Vignette darkens the corners toward the middle, as an overlay",
    pass: overlays().length === 1 && (overlays()[0]?.style.background ?? "").includes("radial-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 48),
  });
  out.push({
    name: "the Decorations card carries the patterns, the textures and the accents — twenty-two tiles plus None",
    pass:
      ["Texture Overlay", "Pattern Overlay", "Polka Dots", "Grid Lines", "Stitched Edge", "Sunburst Rays", "Gradient Shadow", "Colour Shadow", "Stripes", "Checker", "Fade →", "Ring", "Offset Outline", "Sticker", "Stack", "Top Bar", "Bottom Bar", "Left Bar", "Corner Fold"].every(
        (l) => !!popButton(`Banner decor: ${l}`),
      ) &&
      ctrl("decor", "Banner fx: decorative intensity")?.type === "range" &&
      !!well("decor"),
    detail: `${tilesOf("decor")} tiles`,
  });
  click(popButton("Banner decor: Pattern Overlay"));
  out.push({
    name: "Pattern Overlay weaves a fine diagonal over the paint",
    pass: (overlays()[0]?.style.background ?? "").includes("repeating-linear-gradient(45deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner decor: Polka Dots"));
  out.push({
    name: "Polka Dots scatter even round dots over the paint",
    pass: (overlays()[0]?.style.background ?? "").includes("radial-gradient") && (overlays()[0]?.style.backgroundSize ?? "") === "12px 12px",
    detail: `${(overlays()[0]?.style.background ?? "").slice(0, 32)} · ${overlays()[0]?.style.backgroundSize ?? ""}`,
  });
  click(popButton("Banner decor: Grid Lines"));
  out.push({
    name: "Grid Lines weave a fine square grid over the paint",
    pass: paints(overlays()[0]?.style.background ?? "") === 2,
    detail: `${paints(overlays()[0]?.style.background ?? "")} paints`,
  });
  click(popButton("Banner decor: Stitched Edge"));
  out.push({
    name: "Stitched Edge runs a dashed stitch just inside the rim",
    pass: (overlays()[0]?.style.outline ?? "").includes("dashed"),
    detail: overlays()[0]?.style.outline ?? "",
  });
  click(popButton("Banner decor: Sunburst Rays"));
  out.push({
    name: "Sunburst Rays radiate fine rays from the middle of the plate",
    pass: (overlays()[0]?.style.background ?? "").includes("repeating-conic-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 48),
  });
  click(popButton("Banner decor: Gradient Shadow"));
  out.push({
    name: "Gradient Shadow fades from one tone to another, on a layer of its own",
    pass: plateLayers().length === 1 && (plateLayers()[0]?.style.background ?? "").includes("linear-gradient(180deg"),
    detail: `${plateLayers().length} layer`,
  });
  click(popButton("Banner decor: Colour Shadow"));
  out.push({
    name: "Colour Shadow throws a hard copy in a colour of its own",
    pass: shadowOf().includes("0 0") || shadowOf().includes("0px") || shadowOf().includes("0 "),
    detail: shadowOf(),
  });
  click(popButton("Banner decor: Edge Darkening"));
  out.push({
    name: "Edge Darkening presses a shadowed rim inside the plate",
    pass: shadowOf().startsWith("inset"),
    detail: shadowOf(),
  });
  click(popButton("Banner decor: Stripes"));
  out.push({
    name: "Stripes are the shared text-plate pattern, painted over the plate",
    pass: overlays().length === 1 && (overlays()[0]?.style.background ?? "").includes("linear-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 48),
  });
  click(popButton("Banner decor: Sticker"));
  out.push({
    name: "Sticker wears a thick outline all round, on the plate's own filter",
    pass: (filterOf().match(/drop-shadow/g) ?? []).length >= 3,
    detail: filterOf().slice(0, 90),
  });
  click(popButton("Banner decor: Ring"));
  out.push({
    name: "Ring stands a thin outline round the plate, on a layer of its own behind the body",
    pass: plateLayers().length === 1 && (plateLayers()[0]?.style.border ?? "").includes("solid"),
    detail: `${plateLayers().length} layer · ${plateLayers()[0]?.style.border ?? ""}`,
  });
  click(popButton("Banner decor: Stack"));
  out.push({
    name: "Stack paints two paper copies behind the body, each stepping out",
    pass: plateLayers().length === 2 && plateLayers().every((l) => (l.style.transform ?? "").includes("translate(")),
    detail: `${plateLayers().length} layers`,
  });
  click(popButton("Banner decor: Corner Fold"));
  out.push({
    name: "Corner Fold folds the top-right corner, as an overlay above the body",
    pass: overlays().length === 1,
    detail: styleOf(overlays()[0] ?? null).slice(0, 60),
  });
  click(popButton("Banner decor: Pattern Overlay"));
  const decorBefore = styleOf(overlays()[0] ?? null);
  setColor(well("decor"), "#22d3ee");
  await frame();
  out.push({
    name: "the decoration's colour well repaints it — the accent follows the picked colour",
    pass: styleOf(overlays()[0] ?? null) !== decorBefore && painted(overlays()[0] ?? null, "#22d3ee"),
    detail: `${decorBefore.slice(0, 40)} → ${styleOf(overlays()[0] ?? null).slice(0, 40)}`,
  });
  click(popButton("Banner decor: None"));
  out.push({
    name: "…and None strips the decoration away",
    pass: overlays().length === 0 && plateLayers().length === 0 && filterOf() === "",
    detail: `${overlays().length} overlays · ${plateLayers().length} layers`,
  });

  /* -------------------------------- finishes ------------------------------- */
  click(popButton("Banner modern: Noise / Grain"));
  out.push({
    name: "the Finishes card carries the modern surfaces — grain · soft gradient · mesh · holographic · metallic · duotone · soft UI — and no longer the glass family",
    pass:
      ["Noise / Grain", "Soft Gradient Overlay", "Mesh Gradient", "Holographic", "Metallic", "Duotone", "Soft UI"].every((l) =>
        !!popButton(`Banner modern: ${l}`),
      ) &&
      !popButton("Banner modern: Glassmorphism") &&
      !popButton("Banner modern: Frosted Glass") &&
      ctrl("modern", "Banner fx: modern intensity")?.type === "range" &&
      ctrl("modern", "Banner fx: modern blur (px)")?.type === "range" &&
      !!well("modern"),
    detail: `${tilesOf("modern")} tiles`,
  });
  out.push({
    name: "Noise / Grain lays film grain over the body",
    pass: (overlays()[0]?.style.backgroundImage ?? "").includes("data:image/svg"),
    detail: (overlays()[0]?.style.backgroundImage ?? "").slice(0, 40),
  });
  click(popButton("Banner modern: Mesh Gradient"));
  out.push({
    name: "Mesh Gradient melts colour blobs into the body",
    pass: paints(overlays()[0]?.style.background ?? "") >= 5,
    detail: `${paints(overlays()[0]?.style.background ?? "")} paints`,
  });
  click(popButton("Banner modern: Holographic"));
  out.push({
    name: "Holographic lays an iridescent sheen across the body",
    pass: ((overlays()[0]?.style.background ?? "").match(/rgba\(/g) ?? []).length >= 5,
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner modern: Metallic"));
  out.push({
    name: "Metallic brushes the body — fine bands under a chrome sheen",
    pass:
      (overlays()[0]?.style.background ?? "").includes("repeating-linear-gradient(90deg") &&
      (overlays()[0]?.style.background ?? "").includes("linear-gradient(180deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner modern: Duotone"));
  out.push({
    name: "Duotone splits the tint in two across one diagonal",
    pass: (overlays()[0]?.style.background ?? "").includes("linear-gradient(120deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner modern: Soft UI"));
  out.push({
    name: "Soft UI raises the card — its two tones are the shape's colour, lit and shaded, not white and black",
    pass:
      (shadowOf().match(/rgba\(/g) ?? []).length === 2 &&
      shadowOf().includes("192, 210, 242") &&
      shadowOf().includes("16, 48, 104"),
    detail: shadowOf(),
  });
  const liftBefore = shadowOf();
  type(ctrl("modern", "Banner fx: modern blur (px)"), "20");
  out.push({
    name: "…and its Blur softens the two lifts",
    pass: shadowOf() !== liftBefore && shadowOf().includes("34px"),
    detail: `${liftBefore.slice(0, 40)} → ${shadowOf().slice(0, 40)}`,
  });
  const tintBefore = shadowOf();
  setColor(well("modern"), "#d8b4fe");
  await frame();
  out.push({
    name: "the finish's tint repaints the lift — a picked tint reaches the shadows",
    pass: shadowOf() !== tintBefore && shadowOf().includes("rgba("),
    detail: `${tintBefore.slice(0, 40)} → ${shadowOf().slice(0, 40)}`,
  });
  click(popButton("Banner modern: None"));
  out.push({
    name: "…and None strips the finish away",
    pass: overlays().length === 0 && shadowOf() === "",
    detail: `${overlays().length} overlays · ${shadowOf() || "clean"}`,
  });

  /* ------------------------------ shape effects ---------------------------- */
  const cWave = ctrl("shape", "Banner fx: wave amount");
  type(cWave, "60");
  out.push({
    name: "Shape Effects: Wave Amount cuts the edge into a wave, as the plate's own mask",
    pass: (plate()?.style.maskImage ?? "").includes("data:image/svg"),
    detail: (plate()?.style.maskImage ?? "").slice(0, 40),
  });
  click(popButton("Banner shadow: Drop Shadow"));
  click(popButton("Banner glass: Glassmorphism"));
  out.push({
    name: "an effect overlay wears the very same transform as the plate",
    pass: (overlays()[0]?.style.transform ?? "") === transformOf() && (overlays()[0]?.style.transform ?? "") === "",
    detail: `overlay ${overlays()[0]?.style.transform ?? "clean"}`,
  });
  type(ctrl("shape", "Banner fx: rotation (deg)"), "15");
  out.push({
    name: "Rotation turns the plate — and every overlay and layer with it",
    pass: transformOf() === "rotate(15deg)" && (overlays()[0]?.style.transform ?? "") === "rotate(15deg)",
    detail: `${transformOf()} · overlay ${overlays()[0]?.style.transform ?? ""}`,
  });

  /* --------------------------- stacking the categories --------------------- */
  click(popButton("Banner glow: Outer Glow"));
  click(popButton("Banner bevel: Bevel"));
  click(popButton("Banner highlight: Gloss"));
  out.push({
    name: "one effect in every category at once — the shadows stack on the plate in the shape's colour, the groups never fight",
    pass:
      (shadowOf().match(/rgba\(/g) ?? []).length >= 5 &&
      shadowOf().includes(triple(PLATE)) &&
      overlays().length >= 2 &&
      (shadowOf().match(/inset/g) ?? []).length === 2,
    detail: shadowOf().slice(0, 120),
  });

  /* ------------------------------- Default --------------------------------- */
  click(line()?.querySelector<HTMLElement>("[data-toolbar-default]"));
  out.push({
    name: "the line's Default hands the plate back its undressed body — no shadow, no glow, no turn, no mask",
    pass:
      shadowOf() === "" &&
      overlays().length === 0 &&
      transformOf() === "" &&
      (plate()?.style.maskImage ?? "") === "" &&
      plateLayers().length === 0,
    detail: `shadow clean · overlays ${overlays().length} · transform clean`,
  });

  /* --------------------- decks written before the categories --------------- */
  /* the old groups are read, once, into the category each effect belongs to */
  const legacy = bannerEffectsOf({
    ...({} as never),
    effects: {
      depth: { kind: "bevel", intensity: 60, angle: 45 },
      modern: { kind: "glass", intensity: 55, color: "", blur: 10 },
      glow: { kind: "reflection", intensity: 40, color: "" },
      decor: { kind: "innerHighlight", intensity: 45, color: "" },
      common: { kind: "pop", intensity: 70, color: "" },
      shape: undefined as never,
    },
  } as never);
  out.push({
    name: "a deck from before the categories is folded in: the old Depth/3D bevel opens under Bevel, with its light angle",
    pass: legacy.bevel?.kind === "bevel" && legacy.bevel?.intensity === 60 && legacy.bevel?.angle === 45 && legacy.bevel?.blur === 2,
    detail: JSON.stringify(legacy.bevel),
  });
  out.push({
    name: "…the old Modern glass opens under Glass, with its tint and backdrop blur",
    pass: legacy.glass?.kind === "glass" && legacy.glass?.blur === 10 && legacy.modern === undefined,
    detail: JSON.stringify(legacy.glass),
  });
  out.push({
    name: "…the old Glow card's reflection opens under Highlight",
    pass: legacy.highlight?.kind === "reflection" && legacy.glow === undefined && legacy.bevel?.kind === "bevel",
    detail: JSON.stringify(legacy.highlight),
  });
  out.push({
    name: "…the old Depth/3D extrusion opens under 3D",
    pass: bannerEffectsOf({ effects: { depth: { kind: "layered3d", intensity: 40, angle: 0 } } } as never).threeD?.kind === "layered3d",
    detail: JSON.stringify(bannerEffectsOf({ effects: { depth: { kind: "layered3d", intensity: 40, angle: 0 } } } as never).threeD),
  });
  out.push({
    name: "…the old inner highlight opens under Highlight, the old shared Pop under Shadow, and the old outline glow under Glow",
    pass:
      bannerEffectsOf({ effects: { decor: { kind: "innerHighlight", intensity: 45, color: "" } } } as never).highlight?.kind === "innerHighlight" &&
      bannerEffectsOf({ effects: { common: { kind: "pop", intensity: 70 } } } as never).shadow?.kind === "hard" &&
      bannerEffectsOf({ effects: { decor: { kind: "outlineGlow", intensity: 30, color: "" } } } as never).glow?.kind === "outlineGlow",
    detail: [
      bannerEffectsOf({ effects: { common: { kind: "pop", intensity: 70 } } } as never).shadow?.kind,
      bannerEffectsOf({ effects: { decor: { kind: "outlineGlow", intensity: 30, color: "" } } } as never).glow?.kind,
    ].join(" · "),
  });
  out.push({
    name: "…and a category the deck already uses is never overwritten by the fold",
    pass:
      bannerEffectsOf({ effects: { shadow: { kind: "soft", x: 0, y: 12, blur: 30, spread: 0, opacity: 40, color: "" }, common: { kind: "pop", intensity: 70 } } } as never)
        .shadow?.kind === "soft",
    detail: "the newer write wins",
  });
  out.push({
    name: "…and a deck that carries none of the old groups reads back exactly the seven categories, all off",
    pass:
      legacy.shadow?.kind === "hard" &&
      bannerEffectsOf({ effects: {} } as never).glow === undefined &&
      bannerEffectsOf({ effects: {} } as never).threeD === undefined,
    detail: "nothing invented",
  });

  out.push({ name: "no uncaught errors while dressing the plate's effects", pass: errors.length === 0, detail: errors.slice(0, 3).join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
