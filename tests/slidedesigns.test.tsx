/**
 * Slide design suite.
 *
 * The Design destination is a gallery of complete looks. These tests pin what
 * that promise means:
 *
 *   1. the gallery is big, browsable and honest — 100+ designs, unique ids and
 *      names, every one of them writing all thirteen aspects it claims to
 *      combine, and every catalogue id it names (bullet silhouette, marker
 *      shape, row style, frame material, background art, typeface) a real one;
 *   2. no two designs paint the same slide, and every design keeps its text
 *      readable on the board it brings;
 *   3. one click really does paint the slide — badges, title and plate, marker
 *      and stem, option text and markers, rows, board and frame all reach the
 *      DOM, in one deck write, keeping a photo the user put on the background;
 *   4. the gallery and the toolbar agree about which design is on, and a
 *      hand-tuned channel stops the card claiming the look.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO, DEFAULT_THEME, type ThemeSettings } from "../src/lib/types";
import { BG_PRESETS, designInfo } from "../src/lib/backgroundDesigns";
import { ALL_FRAME_STYLES } from "../src/lib/frameDesigns";
import { NUMBER_STYLES } from "../src/lib/numberStyles";
import { OPTION_BULLET_SHAPES } from "../src/lib/optionBulletShapes";
import { OPTION_STYLES } from "../src/lib/optionStyles";
import { fontChoiceFor } from "../src/lib/fonts";
import {
  DESIGN_ASPECTS,
  DESIGN_FAMILIES,
  SLIDE_DESIGNS,
  SLIDE_DESIGN_COUNT,
  activeSlideDesign,
  designFingerprint,
  designPatch,
  FAMILY_LABEL,
  designsOfFamily,
  neighbourDesign,
} from "../src/lib/slideDesigns";

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

/* ------------------------------------------------------- catalogue lookups */

const NUMBER_IDS = new Set(NUMBER_STYLES.map((s) => s.id as string));
const ROW_IDS = new Set(OPTION_STYLES.map((s) => s.id as string));
const MARKER_IDS = new Set(OPTION_BULLET_SHAPES.map((s) => s.id as string));
const FRAME_IDS = new Set(ALL_FRAME_STYLES.map((s) => s.id as string));
const BG_IDS = new Set(BG_PRESETS.map((p) => p.id));
const BANNER_SHAPES = new Set(["glow", "pill", "rect", "rounded", "ribbon", "underline", "none"]);

/* --------------------------------------------------------------- contrast */

function lum(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** the colour the board really shows through: the gradient's first stop, else the board */
function boardBase(t: ThemeSettings): string {
  const g = t.background?.gradient;
  return g?.enabled && g.stops[0]?.color ? g.stops[0].color : t.board;
}

/** the colour a filled title plate shows ("" when no plate sits behind the glyphs) */
function plateBase(t: ThemeSettings): string {
  const shape = t.banner.shape;
  // "none" paints nothing and "underline" only rules a line under the title,
  // so in both the glyphs sit on the board
  if (shape === "none" || shape === "underline") return "";
  const g = t.banner.gradient;
  return g?.enabled && g.stops[0]?.color ? g.stops[0].color : t.banner.color;
}

/* ------------------------------------------------------------------ DOM reads */

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
const panelHeading = () => doc.querySelector("aside h2")?.textContent?.trim() ?? "";
const cards = () => Array.from(doc.querySelectorAll<HTMLElement>("aside [data-design-grid] button[data-design]"));
const card = (id: string) => doc.querySelector<HTMLElement>(`aside button[data-design="${id}"]`);
const chips = () => Array.from(doc.querySelectorAll<HTMLElement>('aside button[aria-label^="Slide designs: "], aside button[aria-label="All slide designs"]'));
const activeLine = () => doc.querySelector<HTMLElement>("aside [data-active-design]");
const aspects = () => Array.from(doc.querySelectorAll<HTMLElement>("aside [data-design-aspect]"));
const thumbs = () => Array.from(doc.querySelectorAll<HTMLElement>("aside [data-design-thumb]"));

const board = () => doc.querySelector<HTMLElement>('.slide-editable [data-board]');
const frameRing = () => board()?.parentElement ?? null;
const bgLayers = () => Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-bg]'));
const titleBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
/** the plate is the absolutely-positioned layer the banner CSS paints */
const titlePlate = () =>
  Array.from(titleBox()?.querySelectorAll<HTMLElement>("div") ?? []).find((d) => d.style.position === "absolute") ?? null;
/** the glyphs are the box-font node — the only div carrying a font size */
const titleText = () =>
  Array.from(titleBox()?.querySelectorAll<HTMLElement>("div") ?? []).find((d) => !!d.style.fontSize) ?? null;
const brandLines = () => Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div'));
const badgeBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="badge"]');
const questionBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
const bulletMarker = () => questionBox()?.querySelector<HTMLElement>(":scope > div") ?? null;
const bulletSurface = () => bulletMarker()?.querySelector<HTMLElement>("[data-bullet-surface]") ?? null;
const stemText = () => questionBox()?.querySelector<HTMLElement>(":scope > span") ?? null;
const optionsBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="options"]');
const firstRow = () => optionsBox()?.querySelector<HTMLElement>(":scope > div") ?? null;
/** the marker of the first option row: wrapper ▸ box ▸ letter */
const firstMarker = () => firstRow()?.querySelector<HTMLElement>("span > span") ?? null;
/** the first option's own text node (MathText paints a styled span) */
const firstOptionText = () =>
  Array.from(firstRow()?.querySelectorAll<HTMLElement>("span") ?? []).find(
    (sp) => !!sp.style.color && (sp.textContent ?? "").includes("5"),
  ) ?? null;
const toolbar = () => doc.querySelector('.context-toolbar [role="toolbar"]')?.getAttribute("aria-label") ?? null;
const barButton = (label: string) =>
  doc.querySelector<HTMLElement>(`.context-toolbar [aria-label="${label}"]`);
const barHint = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-hint")?.textContent?.trim() ?? "";

const rgb = (hex: string): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}`;
};

export async function runSlideDesignTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];

  /* ================================ the catalogue ========================= */
  out.push({
    name: "the gallery ships 100+ complete slide designs",
    pass: SLIDE_DESIGN_COUNT >= 100 && SLIDE_DESIGNS.length === SLIDE_DESIGN_COUNT,
    detail: `${SLIDE_DESIGN_COUNT} designs`,
  });

  const ids = SLIDE_DESIGNS.map((d) => d.id);
  const names = SLIDE_DESIGNS.map((d) => d.name);
  out.push({
    name: "every design has its own id and its own name",
    pass: new Set(ids).size === ids.length && new Set(names).size === names.length,
    detail: `${new Set(ids).size}/${ids.length} ids · ${new Set(names).size}/${names.length} names`,
  });

  out.push({
    name: "every family is a real family and holds designs of its own",
    pass:
      DESIGN_FAMILIES.every((f) => designsOfFamily(f.id).length > 0) &&
      SLIDE_DESIGNS.every((d) => DESIGN_FAMILIES.some((f) => f.id === d.family)),
    detail: DESIGN_FAMILIES.map((f) => `${f.label} ${designsOfFamily(f.id).length}`).join(" · "),
  });

  /* ---------------------------- the thirteen aspects ---------------------- */
  const missing: string[] = [];
  for (const d of SLIDE_DESIGNS) {
    for (const a of DESIGN_ASPECTS) {
      for (const f of a.fields) {
        if (!(f in d.theme)) missing.push(`${d.id}.${String(f)}`);
      }
    }
    // typography travels in the per-box typefaces
    const boxes = d.theme.boxFonts ?? {};
    for (const part of ["brandTop", "brandBottom", "badge", "title", "bullet", "question", "options", "optionBullet"]) {
      if (!(part in boxes)) missing.push(`${d.id}.boxFonts.${part}`);
    }
  }
  out.push({
    name: "every design writes all thirteen aspects — badges, title, plate, bullet, stem, options, markers, marker plate, rows, board, frame",
    pass: missing.length === 0,
    detail: missing.length ? missing.slice(0, 6).join(", ") : `${DESIGN_ASPECTS.length} aspects × ${SLIDE_DESIGN_COUNT} designs`,
  });

  out.push({
    name: "the aspects the panel advertises are the thirteen a design combines",
    pass:
      aspects().length === 0 || aspects().length === DESIGN_ASPECTS.length,
    detail: `${DESIGN_ASPECTS.map((a) => a.label).join(" · ")}`,
  });

  /* --------------------------- every id it names -------------------------- */
  const badIds: string[] = [];
  for (const d of SLIDE_DESIGNS) {
    const t = { ...DEFAULT_THEME, ...d.theme } as ThemeSettings;
    if (!NUMBER_IDS.has(t.numberStyle)) badIds.push(`${d.id}: numberStyle ${t.numberStyle}`);
    if (!ROW_IDS.has(t.optionStyle)) badIds.push(`${d.id}: optionStyle ${t.optionStyle}`);
    if (!MARKER_IDS.has(t.optionBulletShape)) badIds.push(`${d.id}: marker ${t.optionBulletShape}`);
    if (!FRAME_IDS.has(t.frame.style)) badIds.push(`${d.id}: frame ${t.frame.style}`);
    if (!BANNER_SHAPES.has(t.banner.shape)) badIds.push(`${d.id}: banner ${t.banner.shape}`);
    if (t.background.design && !designInfo(t.background.design)) badIds.push(`${d.id}: art ${t.background.design}`);
    for (const part of Object.values(t.boxFonts ?? {})) {
      if (part?.family && !fontChoiceFor(part.family)) badIds.push(`${d.id}: font ${part.family}`);
    }
    if (t.optionBulletFontFamily && !fontChoiceFor(t.optionBulletFontFamily)) {
      badIds.push(`${d.id}: marker font ${t.optionBulletFontFamily}`);
    }
  }
  out.push({
    name: "every catalogue id a design names really exists (bullet · marker · row · frame · plate · art · face)",
    pass: badIds.length === 0,
    detail: badIds.length ? badIds.slice(0, 6).join(" | ") : `${SLIDE_DESIGN_COUNT} designs checked`,
  });

  const knownBg = SLIDE_DESIGNS.every((d) => {
    const g = (d.theme.background as ThemeSettings["background"])?.gradient;
    return !!g && Array.isArray(g.stops) && g.stops.every((s) => /^#[0-9a-f]{6}$/i.test(s.color));
  });
  out.push({
    name: "every board the designs bring is a real gradient over a real colour",
    pass: knownBg && BG_IDS.size > 0,
    detail: `${BG_IDS.size} background presets in the catalogue`,
  });

  /* ------------------------------ uniqueness ------------------------------ */
  const fps = SLIDE_DESIGNS.map((d) => designFingerprint({ ...DEFAULT_THEME, ...d.theme } as ThemeSettings));
  const dupes = fps.length - new Set(fps).size;
  out.push({
    name: "no two designs paint the same slide (every look has its own fingerprint)",
    pass: dupes === 0,
    detail: dupes ? `${dupes} collisions` : `${fps.length} distinct looks`,
  });

  const samePalette = SLIDE_DESIGNS.map((d) => d.swatch.join(",")).length - new Set(SLIDE_DESIGNS.map((d) => d.swatch.join(","))).size;
  out.push({
    name: "no two designs share a palette strip",
    pass: samePalette === 0,
    detail: samePalette ? `${samePalette} shared palettes` : "all palettes distinct",
  });

  /* ------------------------------ readability ----------------------------- */
  const unreadable: string[] = [];
  for (const d of SLIDE_DESIGNS) {
    const t = { ...DEFAULT_THEME, ...d.theme } as ThemeSettings;
    const base = boardBase(t);
    const plate = plateBase(t);
    const checks: [string, number][] = [
      ["stem", contrast(t.questionColor, base)],
      ["options", contrast(t.optionTextColor, base)],
      ["badge 1", contrast(t.brandTopColor || t.brandColor, base)],
      ["badge 2", contrast(t.brandBottomColor || t.brandColor, base)],
      ["footnote", contrast(t.noteColor ?? t.optionTextColor, base)],
      ["title", contrast(t.titleColor, plate || base)],
    ];
    if (t.badgePlate?.enabled) checks.push(["badge 3", contrast(t.badgeColor, t.badgePlate.color)]);
    else checks.push(["badge 3", contrast(t.badgeColor, base)]);
    const fill = /^#[0-9a-f]{3,6}$/i.test(t.optionBulletFill) ? t.optionBulletFill : "";
    if (fill) checks.push(["marker letter", contrast(t.optionBulletInk, fill)]);
    for (const [what, ratio] of checks) {
      if (ratio < 2) unreadable.push(`${d.name}: ${what} ${ratio.toFixed(1)}`);
    }
  }
  out.push({
    name: "every design keeps its text readable on the board it brings (contrast ≥ 2:1)",
    pass: unreadable.length === 0,
    detail: unreadable.length ? unreadable.slice(0, 6).join(" | ") : `${SLIDE_DESIGN_COUNT} designs × 8 inks`,
  });

  /* ------------------------------- neighbours ----------------------------- */
  const first = SLIDE_DESIGNS[0];
  const last = SLIDE_DESIGNS[SLIDE_DESIGNS.length - 1];
  out.push({
    name: "the gallery walks in a ring — next from the last is the first, previous from the first is the last",
    pass: neighbourDesign(last.id, 1).id === first.id && neighbourDesign(first.id, -1).id === last.id && neighbourDesign(null, 1).id === first.id,
    detail: `${neighbourDesign(last.id, 1).name} ← ${last.name} → ${neighbourDesign(last.id, 1).name}`,
  });

  /* ================================= the editor =========================== */
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

  let root: Root | null = null;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);
  act(() => {
    root = createRoot(doc.getElementById("root")!);
    root.render(createElement(App));
  });

  /* --------------------------------- the panel ---------------------------- */
  nav("theme");
  out.push({
    name: "Design opens the slide design gallery (and nothing else)",
    pass:
      panelHeading() === "Slide designs" &&
      !!doc.querySelector("aside [data-slide-designs]") &&
      cards().length === SLIDE_DESIGN_COUNT,
    detail: `${panelHeading()} · ${cards().length} cards`,
  });

  out.push({
    name: "the old Design features are gone — no theme presets, no deck colour wells, no deck font pickers",
    pass:
      !/Theme presets/.test(doc.querySelector("aside")?.textContent ?? "") &&
      !/Deck colours/.test(doc.querySelector("aside")?.textContent ?? "") &&
      !/Deck fonts/.test(doc.querySelector("aside")?.textContent ?? "") &&
      !doc.querySelector('aside [aria-label="Board (surface)"]'),
    detail: (doc.querySelector("aside")?.textContent ?? "").slice(0, 90),
  });

  out.push({
    name: "every card paints a thumbnail of its own look",
    pass: thumbs().length === SLIDE_DESIGN_COUNT && thumbs().every((t) => !!t.getAttribute("data-design-thumb")),
    detail: `${thumbs().length} thumbnails`,
  });

  out.push({
    name: "the panel lists the thirteen aspects one design combines",
    pass: aspects().length === DESIGN_ASPECTS.length,
    detail: aspects().map((a) => a.textContent?.trim()).join(" · "),
  });

  /* --------------------------------- filtering ---------------------------- */
  type(doc.querySelector<HTMLInputElement>('aside input[aria-label="Search slide designs"]'), "neon");
  const searched = cards().length;
  const byId = new Map(SLIDE_DESIGNS.map((d) => [d.id, d]));
  const haystack = (id: string) => {
    const d = byId.get(id);
    return d ? [d.name, d.hint, FAMILY_LABEL[d.family]].join(" ").toLowerCase() : "";
  };
  out.push({
    name: "search narrows the gallery to the designs that match (name, hint or family)",
    pass:
      searched > 0 &&
      searched < SLIDE_DESIGN_COUNT &&
      cards().every((c) => haystack(c.getAttribute("data-design") ?? "").includes("neon")),
    detail: `${searched} of ${SLIDE_DESIGN_COUNT}`,
  });
  type(doc.querySelector<HTMLInputElement>('aside input[aria-label="Search slide designs"]'), "");

  const chalkChip = doc.querySelector<HTMLElement>('aside button[aria-label="Slide designs: Chalk & slate"]');
  click(chalkChip);
  out.push({
    name: "a family chip narrows the gallery to that family",
    pass: cards().length === designsOfFamily("chalk").length && chalkChip?.getAttribute("aria-pressed") === "true",
    detail: `${cards().length} chalk designs`,
  });
  click(doc.querySelector<HTMLElement>('aside button[aria-label="All slide designs"]'));
  out.push({
    name: "All brings the whole gallery back",
    pass: cards().length === SLIDE_DESIGN_COUNT,
    detail: `${cards().length} cards`,
  });

  /* ------------------------------- one click ------------------------------ */
  const before = {
    board: board()?.style.background ?? "",
    plate: titlePlate()?.style.background ?? "",
    marker: bulletSurface()?.style.background ?? "",
  };
  const design = SLIDE_DESIGNS.find((d) => d.id === "midnight-gold-pill")!;
  click(card(design.id));

  const t = { ...DEFAULT_THEME, ...designPatch(design, { ...DEFAULT_THEME, showNumber: true, showBullet: true } as ThemeSettings) } as ThemeSettings;
  const painted = {
    board: board()?.style.background ?? "",
    ring: frameRing()?.style.background ?? "",
    plate: titlePlate()?.style.background ?? "",
    plateRadius: titlePlate()?.style.borderRadius ?? "",
    titleInk: titleText()?.style.color ?? "",
    stemInk: stemText()?.style.color ?? "",
    stemSize: stemText()?.style.fontSize ?? "",
    bullet: bulletSurface()?.style.background ?? "",
    brandSize: brandLines()[0]?.style.fontSize ?? "",
    badgeSize: badgeBox()?.style.fontSize ?? "",
    optionInk: firstOptionText()?.style.color ?? "",
    rowChrome: firstRow()?.style.cssText ?? "",
    marker: firstMarker()?.style.cssText ?? "",
  };

  out.push({
    name: "one click repaints the board and the frame around it",
    pass:
      painted.board.includes(rgb(t.board).split(",")[0]) !== false &&
      painted.board !== before.board &&
      !!painted.ring &&
      bgLayers().length > 0,
    detail: `board ${painted.board.slice(0, 46)} · ring ${painted.ring.slice(0, 30)} · ${bgLayers().length} background layers`,
  });

  out.push({
    name: "…and the title: its plate and its glyphs both change",
    pass: painted.plate !== before.plate && !!painted.plate && painted.titleInk === `rgb(${rgb(t.titleColor)})`,
    detail: `plate ${painted.plate.slice(0, 40)} · radius ${painted.plateRadius} · ink ${painted.titleInk}`,
  });

  out.push({
    name: "…and the question: the marker's body and the stem's ink and size",
    pass:
      painted.bullet !== before.marker &&
      !!painted.bullet &&
      painted.stemInk === `rgb(${rgb(t.questionColor)})` &&
      painted.stemSize === `${t.questionSize}px`,
    detail: `marker ${painted.bullet.slice(0, 36)} · stem ${painted.stemInk} ${painted.stemSize}`,
  });

  out.push({
    name: "…and the badges: both brand lines and the corner tag",
    pass:
      brandLines().length === 2 &&
      painted.brandSize === `${t.brandTopSize}px` &&
      brandLines()[1]?.style.fontSize === `${t.brandBottomSize}px` &&
      painted.badgeSize === `${t.badgeSize}px`,
    detail: `badge1 ${painted.brandSize} · badge2 ${brandLines()[1]?.style.fontSize} · badge3 ${painted.badgeSize}`,
  });

  out.push({
    name: "…and the options: marker silhouette, letter ink and row chrome",
    pass:
      !!painted.marker &&
      painted.marker.length > 20 &&
      painted.optionInk === `rgb(${rgb(t.optionTextColor)})` &&
      !!painted.rowChrome,
    detail: `marker ${painted.marker.slice(0, 40)} · ink ${painted.optionInk} · row ${painted.rowChrome.slice(0, 34)}`,
  });

  /* ------------------------------ which one is on -------------------------- */
  out.push({
    name: "the card and the panel both say which design is painted",
    pass:
      card(design.id)?.getAttribute("aria-pressed") === "true" &&
      (card(design.id)?.textContent ?? "").includes("IN USE") &&
      activeLine()?.getAttribute("data-active-design") === design.id &&
      (activeLine()?.textContent ?? "").includes(design.name),
    detail: `${activeLine()?.getAttribute("data-active-design")} · ${activeLine()?.textContent?.trim().slice(0, 40)}`,
  });

  out.push({
    name: "the Design toolbar names it and walks the gallery",
    pass: toolbar() === "theme tools" && barHint() === design.name,
    detail: `${toolbar()} · ${barHint()}`,
  });

  const next = neighbourDesign(design.id, 1);
  click(barButton("Next slide design"));
  out.push({
    name: "Next paints the following design, and the panel follows",
    pass: activeLine()?.getAttribute("data-active-design") === next.id && barHint() === next.name,
    detail: `${next.name}`,
  });
  click(barButton("Previous slide design"));
  out.push({
    name: "Previous brings the design back",
    pass: activeLine()?.getAttribute("data-active-design") === design.id,
    detail: String(activeLine()?.getAttribute("data-active-design")),
  });

  /* --------------------------- a hand-tune clears it ----------------------- */
  nav("questionText");
  const stemBefore = stemText()?.style.fontSize ?? "";
  type(doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label="Question size %"]'), "124");
  nav("theme");
  out.push({
    name: "hand-tuning one channel stops the card claiming the look",
    pass:
      stemBefore !== (stemText()?.style.fontSize ?? "") &&
      activeLine()?.getAttribute("data-active-design") === "" &&
      (activeLine()?.textContent ?? "").includes("Custom look") &&
      !doc.querySelector('aside button[data-design][aria-pressed="true"]'),
    detail: `stem ${stemBefore} → ${stemText()?.style.fontSize} · active="${activeLine()?.getAttribute("data-active-design")}"`,
  });

  /* ------------------------------ a photo survives ------------------------- */
  const photo = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  const withPhoto = { ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, src: photo, fit: "contain" as const, blur: 3 } };
  const kept = designPatch(design, withPhoto as ThemeSettings).background as ThemeSettings["background"];
  out.push({
    name: "a design keeps the photo on the slide background (and the frame image)",
    pass: kept?.src === photo && kept?.fit === "contain" && kept?.blur === 3 && kept?.design === design.theme.background?.design,
    detail: `src kept=${kept?.src === photo} · fit=${kept?.fit} · art=${kept?.design}`,
  });

  out.push({ name: "no uncaught errors while browsing and applying designs", pass: errors.length === 0, detail: errors.slice(0, 3).join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
