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
 * factory size (a 630px-wide chip) and place.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { bannerCss } from "../src/lib/banner";
import { DEFAULT_BANNER, DEFAULT_LOGO } from "../src/lib/types";

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
  Array.from(titleBox()?.querySelectorAll<HTMLElement>("div") ?? []).find((d) => !!d.style.filter && !d.hasAttribute("data-banner-layer")) ?? null;
/**
 * The plate's own extra layers — the multilayer silhouettes paint one or two
 * plates of their own *behind* the body, each on a div of its own.
 */
const plateLayers = () => Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-layer]") ?? []);
/** how many paints a background string stacks, one per `…-gradient(` */
const paints = (s: string) => (s.match(/gradient\(/g) ?? []).length;

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
  // …and it folds the px terms of `calc(50% + 180px - 315px)` into one number,
  // so a move is read as the sum of its px, not as a substring of its spelling
  const pxSum = (v: string) =>
    Array.from(v.matchAll(/([-+]?\s*[\d.]+)px/g)).reduce((s, m) => s + Number(m[1].replace(/\s+/g, "")), 0);
  out.push({
    name: "the factory plate is a 630px-wide chip centred on the heading, free of the glyphs' own width, with 8% of the line above and below",
    pass:
      box(auto0.left, "calc(50% + 0px - 315px)", "calc(50% - 315px)") &&
      box(auto0.top, "calc(-8% + 0px)", "calc(-8%)") &&
      auto0.w === "630px" &&
      box(auto0.h, "calc(100% + 16%)", "calc(116%)"),
    detail: `${auto0.w} × ${auto0.h} at ${auto0.left} / ${auto0.top}`,
  });

  /* ------- the 630px width is the shape's own, not one look among many ----- */
  const legacy = bannerCss({ ...DEFAULT_BANNER, size: { h: 200 } }, "#ffffff").box;
  out.push({
    name: "a deck saved before the width was fixed — a hand-set height and no width — still paints the 630px chip",
    pass: legacy.width === "630px",
    detail: `w ${String(legacy.width)} · h ${String(legacy.height)}`,
  });
  const thumb = bannerCss({ ...DEFAULT_BANNER, size: undefined }, "#ffffff").box;
  out.push({
    name: "…while the small previews, which ask for no size at all, still hug their own box",
    pass: box(String(thumb.width), "calc(100% + 14%)", "calc(114%)"),
    detail: `w ${String(thumb.width)}`,
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
  out.push({
    name: "…and the shape stays 630px across — a preset dresses the plate, it never resizes it",
    pass: plate()?.style.width === "630px" && box(plate()?.style.left ?? "", "calc(50% + 0px - 315px)", "calc(50% - 315px)"),
    detail: `w ${plate()?.style.width ?? ""} · left ${plate()?.style.left ?? ""}`,
  });
  /* ---- the shape styles: three groups of their own at the end of the card --- */
  const SHAPE_STYLE_GROUPS = ["Stylish shapes", "Multilayer shapes", "Multilayer gradient"];
  out.push({
    name: "the gallery is filed in groups, the last three being the shape styles — Stylish shapes · Multilayer shapes · Multilayer gradient",
    pass:
      SHAPE_STYLE_GROUPS.every((g) => !!pop()?.querySelector(`[data-banner-preset-group="${g}"]`)) &&
      SHAPE_STYLE_GROUPS.every((g) => (pop()?.querySelectorAll(`[data-banner-preset-group="${g}"] button[aria-label^="Banner preset: "]`)?.length ?? 0) >= 5) &&
      presetTiles().length >= 45,
    detail: `${presetTiles().length} presets · ${pop()?.querySelectorAll("[data-banner-preset-group]").length ?? 0} groups · ${SHAPE_STYLE_GROUPS.map((g) => `${g.split(" ")[0]} ${pop()?.querySelectorAll(`[data-banner-preset-group="${g}"] button`)?.length ?? 0}`).join(" / ")}`,
  });
  click(popButton("Banner preset: Gold double frame"));
  out.push({
    name: "a multilayer preset reaches the slide as layers of its own behind the plate — and still dresses the 630px chip",
    pass:
      plateLayers().length === 1 &&
      styleOf(plateLayers()[0] ?? null).includes("scale(") &&
      plate()?.style.width === "630px" &&
      (plate()?.style.boxShadow ?? "").includes("inset"),
    detail: `${plateLayers().length} layer · ${plateLayers()[0]?.style.transform ?? ""} · inset ${!!(plate()?.style.boxShadow ?? "").includes("inset")}`,
  });
  click(popButton("Banner preset: Sheen royal"));
  out.push({
    name: "a multilayer gradient preset stacks two paints on the one body — a sheen over the look's own gradient",
    pass: paints(plate()?.style.background ?? "") === 2 && (plate()?.style.background ?? "").includes("115deg"),
    detail: (plate()?.style.background ?? "").slice(0, 58),
  });
  // back to the pill the rest of the suite dresses — and the outline back off,
  // since the multilayer look above brought one with it and the Border card's
  // own test below switches the line on from off
  click(popButton("Banner preset: Royal blue pill"));
  closePop();
  openCard("Banner border");
  click(
    Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => (b.textContent ?? "").includes("Outline the plate")),
  );
  closePop();

  /* ------------------------------- shape ----------------------------------- */
  openCard("Banner shape");
  out.push({
    name: "Shapes lists every silhouette as a picture, with the one in use marked",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Banner shape" &&
      (pop()?.querySelectorAll('[role="listbox"][aria-label="Banner shape"] [role="option"]').length ?? 0) === 92 &&
      popButton("Banner shape: Pill")?.getAttribute("aria-selected") === "true",
    detail: String(pop()?.querySelectorAll('[role="listbox"][aria-label="Banner shape"] [role="option"]').length),
  });
  const GROUPS = [
    "Basic & Clean",
    "Banner Style",
    "Cut & Corner",
    "Modern",
    "Curved & Wave",
    "Organic / Decorative",
    "Decorative / Highlight",
    "Premium / Special",
    "Plates",
    "Stylish shapes",
    "Multilayer shapes",
    "Multilayer gradient",
    "Marks",
  ];
  out.push({
    name: "…filed in thirteen groups — the shape library (Basic & Clean · Banner Style · Cut & Corner · Modern · Curved & Wave · Organic / Decorative · Decorative / Highlight · Premium / Special) plus the original paint families",
    pass: GROUPS.every((g) => (pop()?.textContent ?? "").includes(g)),
    detail: GROUPS.filter((g) => (pop()?.textContent ?? "").includes(g)).join(" › "),
  });
  /* the eighty-name catalogue: every shape a teacher may go looking for is a
     tile of its own, or an alias in a tile's hint where the library already had
     it under another name */
  const CATALOGUE = [
    /* 1 basic / clean */ "Rounded Rectangle", "Soft Rounded Rectangle", "Capsule", "Pill", "Oval Plate", "Circle Plate",
    "Ellipse Banner", "Curved Rectangle", "Half-Rounded Rectangle", "Soft Square",
    /* 2 classic banners */ "Classic Banner", "Ribbon Banner", "Pointed Banner", "Double-Ended Banner", "Notched Banner",
    "Folded Banner", "Scroll Banner", "Badge Banner", "Tail Banner", "Flag Banner",
    /* 3 cut & corner */ "Cut-Corner Banner", "Double-Cut Banner", "Single-Cut Banner", "Diagonal-Cut Banner",
    "Angled-Corner Banner", "Chamfered Banner", "Hexagonal Banner", "Octagonal Banner", "Trapezoid Banner",
    "Parallelogram Banner",
    /* 4 modern / geometric */ "Slanted Banner", "Diagonal Banner", "Skewed Banner", "Asymmetric Banner",
    "Geometric Title Plate", "Offset Banner", "Split Banner", "Layered Banner", "Floating Title Plate", "Stepped Banner",
    /* 5 curved / wave */ "Wave Banner", "Curved Banner", "Wavy Strip", "Wave Plate", "Arch Banner", "Dome Banner",
    "Swoosh", "Curved Ribbon", "Concave Banner", "Convex Banner",
    /* 6 organic / blob */ "Organic Blob", "Abstract Blob", "Wavy Blob", "Rounded Blob", "Asymmetric Blob", "Cloud Shape",
    "Soft Organic Plate", "Liquid Shape", "Amoeba Shape", "Freeform Blob",
    /* 7 decorative / highlight */ "Brush Stroke", "Paint Stroke", "Marker Stroke", "Highlight Strip", "Highlight Blob",
    "Underline Shape", "Swoosh Highlight", "Splash Shape", "Burst Plate", "Sunburst Plate",
    /* 8 premium / special */ "Double Ribbon", "Triple Layer Banner", "Shadow Banner", "3D Title Plate", "Glass Title Plate",
    "Outline Banner", "Border Frame Plate", "Ticket Banner", "Seal Badge", "Emblem Plate",
  ];
  const tileText = () =>
    Array.from(pop()?.querySelectorAll<HTMLElement>('[role="listbox"][aria-label="Banner shape"] [role="option"]') ?? [])
      .map((t) => `${t.getAttribute("aria-label") ?? ""} ${t.getAttribute("title") ?? ""}`.toLowerCase())
      .join("\n");
  out.push({
    name: "…and the whole eighty-name catalogue is findable — each as its own tile, or as an alias in a tile's hint",
    pass: CATALOGUE.every((n) => tileText().includes(n.toLowerCase())),
    detail: CATALOGUE.filter((n) => !tileText().includes(n.toLowerCase())).join(", ") || `${CATALOGUE.length} names`,
  });
  click(popButton("Banner shape: Rounded Rectangle"));
  out.push({
    name: "picking a silhouette repaints the plate's corners — at the tighter plate's own radius",
    pass: plate()?.style.borderRadius === "14px",
    detail: plate()?.style.borderRadius ?? "",
  });
  click(popButton("Banner shape: Ribbon Banner"));
  out.push({
    name: "the ribbon's notched ends are cut shallower to match the shorter plate",
    pass: (plate()?.style.clipPath ?? "").includes("16px") && !(plate()?.style.clipPath ?? "").includes("22px"),
    detail: plate()?.style.clipPath ?? "",
  });

  /* ---- stylish shapes: one plate, cut to another silhouette --------------- */
  click(popButton("Banner shape: Hexagon"));
  out.push({
    name: "a stylish silhouette cuts the plate to its own shape — the hexagon's tips, on the slide",
    pass: (plate()?.style.clipPath ?? "").startsWith("polygon(0% 50%") && (plate()?.style.borderRadius ?? "") === "",
    detail: plate()?.style.clipPath ?? "",
  });
  const hexCss = bannerCss({ ...DEFAULT_BANNER, shape: "hex", border: { enabled: true, color: "#ffffff", width: 2 } }, "#ffffff");
  out.push({
    name: "…and the outline's own layer wears the very same cut, so a border follows the tips instead of running off them",
    pass: !!hexCss.border && hexCss.border.clipPath === hexCss.box.clipPath && !!hexCss.border.clipPath,
    detail: String(hexCss.border?.clipPath ?? "").slice(0, 48),
  });
  const cutFamilies = ["Notched Banner", "Chevron", "Swallowtail", "Slanted Banner"];
  out.push({
    name: "every cut silhouette brings its own polygon — notched banner · chevron · swallowtail · slanted banner",
    pass:
      cutFamilies.every((label) => !!popButton(`Banner shape: ${label}`)) &&
      (["notch", "chevron", "swallow", "slant"] as const).every(
        (s) => (bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").box.clipPath ?? "").startsWith("polygon("),
      ),
    detail: (["notch", "chevron", "swallow", "slant"] as const)
      .map((s) => `${s} ${String(bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").box.clipPath ?? "").slice(8, 26)}…`)
      .join(" · "),
  });
  click(popButton("Banner shape: Tab"));
  out.push({
    name: "a tab rounds the top edge only — and an arch is a full half-round on top, flat along the bottom",
    pass:
      plate()?.style.borderRadius === "14px 14px 0 0" &&
      bannerCss({ ...DEFAULT_BANNER, shape: "arch" }, "#ffffff").box.borderRadius === "999px 999px 0 0",
    detail: `${plate()?.style.borderRadius ?? ""} · arch ${String(bannerCss({ ...DEFAULT_BANNER, shape: "arch" }, "#ffffff").box.borderRadius)}`,
  });

  /* ---- the shape library: the new silhouettes ------------------------------ */
  click(popButton("Banner shape: Wave Banner"));
  const waveMask = plate()?.style.maskImage ?? "";
  const waveCss = bannerCss({ ...DEFAULT_BANNER, shape: "waveBanner", border: { enabled: true, color: "#ffffff", width: 2 } }, "#ffffff");
  out.push({
    name: "a masked silhouette carries its cut as a mask — the wave banner's waves, and the outline wears the very same mask",
    pass:
      waveMask.startsWith('url("data:image/svg+xml') &&
      (plate()?.style.clipPath ?? "") === "" &&
      !!waveCss.border &&
      waveCss.border.maskImage === waveCss.box.maskImage &&
      !!waveCss.border.maskImage,
    detail: `${waveMask.slice(0, 40)}… · line shares the mask ${waveCss.border?.maskImage === waveCss.box.maskImage}`,
  });
  click(popButton("Banner shape: Circle Plate"));
  const circleH = plate()?.style.height ?? "";
  out.push({
    name: "the round silhouettes paint a taller box — the circle plate's height is the line frame stretched by its own factor",
    pass: box(circleH, "calc((100% + 22%) * 2.2)", "calc(268.4%)") && (plate()?.style.borderRadius ?? "") === "50% / 100%",
    detail: `h ${circleH} · radius ${plate()?.style.borderRadius ?? ""}`,
  });
  click(popButton("Banner shape: Capsule"));
  out.push({
    name: "the capsule is a true oval — 50% of the width, 100% of the height, so the ends taper",
    pass: (plate()?.style.borderRadius ?? "") === "50% / 100%" && (plate()?.style.height ?? "").includes("%"),
    detail: `radius ${plate()?.style.borderRadius ?? ""} · h ${plate()?.style.height ?? ""}`,
  });
  click(popButton("Banner shape: Cut-Corner Banner"));
  const octClip = plate()?.style.clipPath ?? "";
  out.push({
    name: "the cut-corner banner bevels all four corners — an eight-point polygon",
    pass: octClip.startsWith("polygon(") && (octClip.match(/calc\(/g) ?? []).length === 4 && octClip.split(",").length === 8,
    detail: octClip,
  });
  click(popButton("Banner shape: Folded Banner"));
  out.push({
    name: "the folded banner's tails paint behind the body — two darker plates, notched, stepped down and out",
    pass:
      plateLayers().length === 2 &&
      plateLayers().every((l) => (l.style.transform ?? "").includes("translate(") && (l.style.transform ?? "").includes("%")) &&
      plateLayers().every((l) => (l.style.clipPath ?? "").startsWith("polygon(")),
    detail: `${plateLayers().length} tails · ${plateLayers().map((l) => l.style.transform).join(" / ")}`,
  });
  click(popButton("Banner shape: Scroll Banner"));
  out.push({
    name: "the scroll's rolled ends ride in the gap the parchment's cut leaves — two light pills behind the body",
    pass:
      plateLayers().length === 2 &&
      plateLayers().every((l) => (l.style.clipPath ?? "").startsWith("inset(") && (l.style.clipPath ?? "").includes("round")) &&
      (plate()?.style.clipPath ?? "").startsWith("inset(3% 7% 3% 7% round"),
    detail: `body ${plate()?.style.clipPath ?? ""} · ${plateLayers().length} rollers`,
  });
  click(popButton("Banner shape: Classic Banner"));
  out.push({
    name: "the classic bar keeps its own tight corner and its embossed rules — on the body, not a layer",
    pass: (plate()?.style.borderRadius ?? "") === "8px" && (plate()?.style.boxShadow ?? "").includes("inset 0 3px 0"),
    detail: `radius ${plate()?.style.borderRadius ?? ""} · shadow ${String(plate()?.style.boxShadow ?? "").slice(0, 44)}`,
  });

  /* ---- the silhouettes added later: cut & corner --------------------------- */
  click(popButton("Banner shape: Single-Cut Banner"));
  out.push({
    name: "the cut & corner group brings its own cuts — single · double · diagonal · chamfered · octagon · trapezoid",
    pass:
      (plate()?.style.clipPath ?? "").startsWith("polygon(0 0, 100% 0,") &&
      (["singleCut", "doubleCut", "diagonalCut", "chamferedBanner", "octagonBanner", "trapezoidBanner"] as const).every(
        (s) => (bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").box.clipPath ?? "").startsWith("polygon("),
      ),
    detail: (["singleCut", "doubleCut", "diagonalCut", "chamferedBanner", "octagonBanner", "trapezoidBanner"] as const)
      .map((s) => `${s} ${(String(bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").box.clipPath ?? "").match(/,/g) ?? []).length + 1} pts`)
      .join(" · "),
  });
  const chamClip = String(bannerCss({ ...DEFAULT_BANNER, shape: "chamferedBanner" }, "#ffffff").box.clipPath ?? "");
  out.push({
    name: "a deep bevel caps itself at the plate's own height, so a short plate still closes",
    pass: chamClip.includes("min(") && chamClip.includes("38%"),
    detail: chamClip.slice(0, 60),
  });
  click(popButton("Banner shape: Stepped Banner"));
  out.push({
    name: "the stepped banner is a staircase — both long edges step down in three",
    pass: (plate()?.style.clipPath ?? "").split(",").length === 12,
    detail: plate()?.style.clipPath ?? "",
  });

  /* ---- the silhouettes added later: the masked freehand ones --------------- */
  click(popButton("Banner shape: Flag Banner"));
  const flagMask = plate()?.style.maskImage ?? "";
  out.push({
    name: "the new freehand silhouettes wear masks like the old ones — the flag, the blobs, the strokes, the splash, the seal, the ticket",
    pass:
      flagMask.startsWith('url("data:image/svg+xml') &&
      (["flagBanner", "asymmetricBlob", "liquidShape", "amoebaShape", "freeformBlob", "markerStroke", "highlightStrip", "swooshHighlight", "splashShape", "sealBadge", "ticketBanner"] as const).every(
        (s) => (bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").box.maskImage ?? "").startsWith('url("data:image/svg+xml'),
      ),
    detail: `${(bannerCss({ ...DEFAULT_BANNER, shape: "sealBadge" }, "#ffffff").box.maskImage ?? "").length} chars of seal`,
  });
  out.push({
    name: "the ticket's bites are holes in its mask — the path is filled even-odd, and the outline wears the very same mask",
    pass: (() => {
      const css = bannerCss({ ...DEFAULT_BANNER, shape: "ticketBanner", border: { enabled: true, color: "#ffffff", width: 2 } }, "#ffffff");
      return (css.box.maskImage ?? "").includes("evenodd") && css.border?.maskImage === css.box.maskImage;
    })(),
    detail: "evenodd in the mask",
  });
  click(popButton("Banner shape: Burst Plate"));
  out.push({
    name: "the burst plate is cut to a star — twelve rays written in % of the plate, so they stretch with it",
    pass: (plate()?.style.clipPath ?? "").startsWith("polygon(") && (plate()?.style.clipPath ?? "").split(",").length === 24,
    detail: `${(plate()?.style.clipPath ?? "").split(",").length} points`,
  });

  /* ---- the silhouettes added later: the premium plates -------------------- */
  click(popButton("Banner shape: Double Ribbon"));
  out.push({
    name: "the double ribbon is the ribbon's cut with two tails of its own behind it",
    pass:
      plateLayers().length === 2 &&
      plateLayers().every((l) => (l.style.clipPath ?? "").startsWith("polygon(")) &&
      (plate()?.style.clipPath ?? "").includes("50%"),
    detail: `${plateLayers().length} tails · ${plateLayers().map((l) => l.style.transform).join(" / ")}`,
  });
  click(popButton("Banner shape: Triple Layer Banner"));
  out.push({
    name: "the triple layer banner steps three plates out behind the body",
    pass: plateLayers().length === 3 && plateLayers().every((l) => (l.style.transform ?? "").includes("translate(")),
    detail: `${plateLayers().length} layers`,
  });
  click(popButton("Banner shape: 3D Title Plate"));
  out.push({
    name: "the 3D plate stands on an extruded slab of its own silhouette, bevelled top and bottom on the body",
    pass:
      plateLayers().length === 2 &&
      (plate()?.style.boxShadow ?? "").includes("inset 0 2px 0") &&
      (plateLayers()[0]?.style.transform ?? "").includes("translateY("),
    detail: `${plateLayers().length} layers · ${String(plate()?.style.boxShadow ?? "").slice(0, 40)}`,
  });
  click(popButton("Banner shape: Outline Banner"));
  out.push({
    name: "the outline banner is hollow — the body carries no paint, its fill is an inset ring that follows the corners",
    pass:
      (plate()?.style.background ?? "").includes("transparent") &&
      (plate()?.style.boxShadow ?? "").startsWith("inset 0 0 0 4px"),
    detail: `bg ${plate()?.style.background ?? ""} · ${String(plate()?.style.boxShadow ?? "").slice(0, 30)}`,
  });
  {
    // with the deck's gradient on, the fill is itself a paint the plates stack over
    const painted = { ...DEFAULT_BANNER, gradient: { ...DEFAULT_BANNER.gradient, enabled: true } };
    out.push({
      name: "the glass and the ticket plates stack their paints over the fill — three each, the sunburst two",
      pass:
        (["glassPlate", "ticketBanner"] as const).every(
          (s) => paints(String(bannerCss({ ...painted, shape: s }, "#ffffff").box.background ?? "")) === 3,
        ) &&
        paints(String(bannerCss({ ...painted, shape: "sunburstPlate" }, "#ffffff").box.background ?? "")) === 2,
      detail: (["glassPlate", "ticketBanner", "sunburstPlate"] as const)
        .map((s) => `${s} ${paints(String(bannerCss({ ...painted, shape: s }, "#ffffff").box.background ?? ""))}`)
        .join(" · "),
    });
  }

  /* ---- multilayer shapes: the plate plus painted plates of its own -------- */
  click(popButton("Banner shape: Layered Banner"));
  out.push({
    name: "a multilayer silhouette paints plates of its own on the slide — two layers behind the body",
    pass:
      plateLayers().length === 2 &&
      plateLayers().every((l) => (l.style.transform ?? "").includes("translate(")) &&
      plateLayers().every((l) => (l.style.background ?? "").length > 0),
    detail: `${plateLayers().length} layers · ${plateLayers().map((l) => l.style.transform).join(" / ")}`,
  });
  out.push({
    name: "…and they ride *behind* the body, so the plate's own paint and its outline still win",
    pass: (() => {
      const stack = Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-layer], [data-banner-plate]") ?? []);
      const body = stack.findIndex((el) => el.hasAttribute("data-banner-plate"));
      return stack.length === 3 && body === stack.length - 1;
    })(),
    detail: `${plateLayers().length} layers then the body`,
  });
  const accentClip = String(bannerCss({ ...DEFAULT_BANNER, shape: "accent" }, "#ffffff").layers[0]?.clipPath ?? "");
  out.push({
    name: "the accent block is cut as a percentage of the plate, with its corner spelled in px — CSS a browser will not throw away",
    pass: accentClip.startsWith("inset(0 84% 0 0 round ") && /round \d+(\.\d+)?px/.test(accentClip),
    detail: accentClip,
  });
  out.push({
    name: "each multilayer silhouette brings its own layers — stack · double frame · accent block · offset line · long shadow",
    pass: (["stack", "frame", "accent", "offsetLine", "longShadow"] as const).every(
      (s) => bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").layers.length >= 1,
    ),
    detail: (["stack", "frame", "accent", "offsetLine", "longShadow"] as const)
      .map((s) => `${s} ${bannerCss({ ...DEFAULT_BANNER, shape: s }, "#ffffff").layers.length}`)
      .join(" · "),
  });
  out.push({
    name: "the layers follow the shape's transparency and leave when the shape does",
    pass:
      bannerCss({ ...DEFAULT_BANNER, shape: "stack", opacity: 0.4 }, "#ffffff").layers.every((l) => l.opacity === 0.4) &&
      bannerCss({ ...DEFAULT_BANNER, shape: "stack" }, "#ffffff").layers.length ===
        bannerCss({ ...DEFAULT_BANNER, shape: "none" }, "#ffffff").layers.length + 2 &&
      bannerCss({ ...DEFAULT_BANNER, shape: "none" }, "#ffffff").layers.length === 0,
    detail: `opacity 0.4 on every layer · none paints 0 layers`,
  });

  /* ---- multilayer gradient: one plate, several stacked paints -------------- */
  click(popButton("Banner shape: Sheen"));
  out.push({
    name: "a multilayer gradient stacks a second paint on the one body — a band of light over the deck's own gradient",
    pass: paints(plate()?.style.background ?? "") === 2 && (plate()?.style.background ?? "").includes("115deg"),
    detail: (plate()?.style.background ?? "").slice(0, 58),
  });
  // the deck's own gradient switched on, so the body's paint is a gradient the
  // second layer can be stacked over
  const gradPlate = { ...DEFAULT_BANNER, gradient: { ...DEFAULT_BANNER.gradient, enabled: true } };
  out.push({
    name: "each gradient layer brings its own second paint — sheen · split · gloss · stripes",
    pass: (["sheen", "split", "gloss", "stripes"] as const).every(
      (s) => paints(String(bannerCss({ ...gradPlate, shape: s }, "#ffffff").box.background ?? "")) === 2,
    ),
    detail: (["sheen", "split", "gloss", "stripes"] as const)
      .map((s) => `${s} ${paints(String(bannerCss({ ...gradPlate, shape: s }, "#ffffff").box.background ?? ""))} paints`)
      .join(" · "),
  });
  click(popButton("Banner shape: Stacked"));
  out.push({
    name: "the stacked gradient plate paints three plates, each wearing a gradient of its own",
    pass:
      plateLayers().length === 2 &&
      plateLayers().every((l) => (l.style.background ?? "").includes("linear-gradient(")) &&
      paints(plate()?.style.background ?? "") === 1,
    detail: `${plateLayers().length} gradient layers under a gradient body`,
  });
  click(popButton("Banner shape: Rounded Rectangle"));
  out.push({
    name: "back to a single-body silhouette and the extra layers are gone",
    pass: plateLayers().length === 0 && paints(plate()?.style.background ?? "") === 1,
    detail: `${plateLayers().length} layers`,
  });
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
  const fillTiles = Array.from(
    pop()?.querySelectorAll<HTMLElement>('[data-banner-fill] [role="listbox"][aria-label="Fill style"] [role="option"]') ?? [],
  );
  out.push({
    name: "Fill is the body's paint — the six fills (reflected · multi-colour · transparent · glass · metallic · pattern) as picture tiles",
    pass:
      fillTiles.length === 6 &&
      fillTiles.map((t) => t.textContent?.trim()).join(" · ") ===
        "Reflected · Multi-Color · Transparent · Glass · Metallic · Pattern",
    detail: `${fillTiles.length} fills`,
  });
  const pickedFill = "#00C875";
  click(Array.from(pop()?.querySelectorAll<HTMLElement>(".font-color-panel > div:first-child button") ?? [])
    .find((button) => button.textContent?.trim() === "Solid"));
  const pickedFillButton = Array.from(pop()?.querySelectorAll<HTMLElement>(".font-color-panel button[title]") ?? [])
    .find((button) => button.getAttribute("title")?.toUpperCase() === pickedFill);
  click(pickedFillButton);
  await frame();
  out.push({
    name: "picking a fill colour from the text-style palette reaches the plate",
    pass: !!pickedFillButton && (styleOf(plate()).toLowerCase().includes(pickedFill.toLowerCase()) || styleOf(plate()).includes("rgb(0, 200, 117)")),
    detail: `${pickedFillButton ? "swatch found" : "swatch missing"} · ${styleOf(plate()).slice(0, 60)}`,
  });
  out.push({
    name: "Fill opens the same Solid / Gradient colour popup as text colour, with the six banner fills inside it",
    pass:
      !!pop()?.querySelector(".font-color-panel") &&
      Array.from(pop()?.querySelectorAll<HTMLElement>(".font-color-panel > div:first-child button") ?? [])
        .map((button) => button.textContent?.trim())
        .join(" · ") === "Solid · Gradient" &&
      fillTiles.length === 6,
    detail: `${pop()?.querySelectorAll(".font-color-panel").length} colour card · ${fillTiles.length} fill styles`,
  });
  click(popButton("Fill: Transparent Gradient"));
  await frame();
  const transparentSides = Array.from(pop()?.querySelectorAll<HTMLElement>('[role="group"][aria-label="Transparent side"] button') ?? []);
  const leftTransparent = popButton("Transparent side: Left");
  const rightTransparent = popButton("Transparent side: Right");
  click(leftTransparent);
  await frame();
  out.push({
    name: "Transparent has an explicit edge control — Left · Right · Top · Bottom — and multiple sides can be selected together",
    pass:
      transparentSides.length === 4 &&
      transparentSides.map((button) => button.getAttribute("aria-label")?.replace("Transparent side: ", "")).join(" · ") ===
        "Left · Right · Top · Bottom" &&
      leftTransparent?.getAttribute("aria-pressed") === "true" &&
      rightTransparent?.getAttribute("aria-pressed") === "true",
    detail: `${transparentSides.length} sides · Left & Right selected`,
  });
  click(rightTransparent);
  await frame();
  out.push({
    name: "toggling a transparent side off leaves the other side selected and repaints the fade",
    pass:
      leftTransparent?.getAttribute("aria-pressed") === "true" &&
      rightTransparent?.getAttribute("aria-pressed") === "false" &&
      (styleOf(plate()).includes("270deg") || styleOf(plate()).includes("to left")),
    detail: `${(styleOf(plate()).match(/linear-gradient\([^)]*/)?.[0] ?? "").slice(0, 72)}`,
  });

  /* ---- the other nine fills: five ramps + glass · metallic · pattern ------ */
  const ramp = (type: "conic" | "reflected") =>
    String(
      bannerCss({ ...DEFAULT_BANNER, gradient: { ...DEFAULT_BANNER.gradient, enabled: true, type, angle: 90 } }, "#ffffff")
        .box.background ?? "",
    );
  out.push({
    name: "the angular ramp sweeps round the centre and the reflected ramp mirrors out from the middle",
    pass:
      ramp("conic").startsWith("conic-gradient(from 90deg at 50% 50%") &&
      ramp("reflected").startsWith("linear-gradient(90deg") &&
      ramp("reflected").includes("#1f5fd0 50%"),
    detail: `${ramp("conic").slice(0, 32)} · ${ramp("reflected").slice(0, 32)}`,
  });
  const special = (fillMode: "glass" | "metallic" | "pattern") =>
    String(bannerCss({ ...DEFAULT_BANNER, fillMode }, "#ffffff").box.background ?? "");
  out.push({
    name: "glass, metallic and pattern are paints of their own — a frosted pane in three layers, brushed metal bands, one tiled motif",
    pass:
      paints(special("glass")) === 3 &&
      (special("metallic").match(/#[0-9a-f]{6}/gi)?.length ?? 0) >= 6 &&
      special("metallic").startsWith("linear-gradient(") &&
      special("pattern").includes("radial-gradient(circle") &&
      special("pattern").includes("/ "),
    detail: `glass ${paints(special("glass"))} paints · metal ${(special("metallic").match(/#[0-9a-f]{6}/gi) ?? []).length} stops · pattern ${special("pattern").slice(0, 26)}`,
  });
  click(popButton("Fill: Metallic Fill"));
  await frame();
  out.push({
    name: "clicking the metallic tile wears that paint on the plate",
    pass:
      popButton("Fill: Metallic Fill")?.getAttribute("aria-selected") === "true" &&
      /linear-gradient\(\d+deg/.test(styleOf(plate())),
    detail: (styleOf(plate()).match(/background:[^;]*/)?.[0] ?? "").slice(0, 110),
  });
  click(popButton("Fill: Pattern Fill"));
  await frame();
  click(popButton("Pattern: Checker"));
  out.push({
    name: "the pattern paint carries eight motifs of its own — picking one wears the tile and keeps the others",
    pass:
      (pop()?.querySelectorAll('[role="listbox"][aria-label="Pattern motif"] [role="option"]').length ?? 0) === 8 &&
      popButton("Pattern: Checker")?.getAttribute("aria-selected") === "true" &&
      (special("pattern").length ?? 0) > 0,
    detail: `${pop()?.querySelectorAll('[role="listbox"][aria-label="Pattern motif"] [role="option"]').length} motifs · ${(styleOf(plate()).match(/background:[^;]*/)?.[0] ?? "").slice(0, 80)}`,
  });
  click(Array.from(pop()?.querySelectorAll<HTMLElement>(".font-color-panel > div:first-child button") ?? [])
    .find((button) => button.textContent?.trim() === "Solid"));
  await frame();
  /* the flat colour is the palette colour picked above — the plate must wear it */
  out.push({
    name: "back on Solid tab the plate wears the flat banner colour again",
    pass: styleOf(plate()).includes("rgb(0, 200, 117)"),
    detail: `picked ${pickedFill} · ${(styleOf(plate()).match(/background:[^;]*/)?.[0] ?? "").slice(0, 48)}`,
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
      pxSum(plate()?.style.left ?? "") - pxSum(placedAuto.left) === 180 &&
      pxSum(plate()?.style.top ?? "") - pxSum(placedAuto.top) === -90 &&
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
  const sizeDefault = pop()?.querySelector<HTMLElement>('button[aria-label="Banner size: back to the 630px shape"]') ?? null;
  click(sizeDefault);
  out.push({
    name: "the size card's own button hands the shape back its 630px width, with the height hugging the line again",
    pass:
      plate()?.style.width === "630px" &&
      (plate()?.style.height ?? "").includes("%") &&
      !(plate()?.style.height ?? "").includes("300px") &&
      Number(widthInput?.value) === 630,
    detail: `w ${plate()?.style.width ?? ""} · h ${plate()?.style.height ?? ""} · bar ${widthInput?.value ?? ""}`,
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
    name: "Default hands the plate back its factory size and place — the 630px chip, no nudge, no line",
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
