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
 *   • the catalogue (round · cards · polygons · arrows · seals · callouts ·
 *     flowchart · stickers · marks) and that every design renders a box (no
 *     design throws or comes out empty)
 *   • the Bullet design card: Bullet point presets (bullet points · numbering ·
 *     the one-click looks) · Shape (the silhouette alone) · Shape effects
 *   • the toolbar line and its cards (design · channels · position)
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
  NUMBER_SHAPES,
  NUMBER_STYLES,
  NUMBER_STYLE_CATEGORIES,
  SHAPE_CATEGORIES,
  isBulletPoint,
  isNumberShape,
  isNumberingPreset,
  isPresetCategory,
  numberStyleAspect,
  numberStyleDef,
  renderNumberStyle,
  showsNumber,
  zeroPadNumber,
  type NumberStyle,
} from "../src/lib/numberStyles";
import { BULLET_EFFECTS, BULLET_EFFECT_GROUPS } from "../src/lib/bulletEffects";
import { BULLET_STYLES, BULLET_STYLE_GROUPS, bulletStyleOf, bulletStylePatch } from "../src/lib/bulletStyles";

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

/** a tile on the Bullet point presets tab — a bullet point, a numbering format or a one-click look */
const presetBtn = (label: string) => pop()?.querySelector(`[aria-label="Bullet preset: ${label}"]`) ?? null;
/** the bullet design card's three tabs */
const tabBtn = (label: string) => pop()?.querySelector(`[aria-label="Bullet design tab: ${label}"]`) ?? null;
/** a tile on the Shape tab — a silhouette alone */
const shapeBtn = (label: string) => pop()?.querySelector(`[aria-label="Shape: ${label}"]`) ?? null;
const effectBtn = (label: string) => pop()?.querySelector(`[aria-label="Shape effect: ${label}"]`) ?? null;
/** a card's own tile (a border style, an option in a listbox) */
const tile = (label: string) => pop()?.querySelector(`[aria-label="${label}"]`) ?? null;
/** the marker's body wrapper — where an effect's own passes ride */
const body = () => marker()?.querySelector<HTMLElement>("[data-bullet-body]");
const popAll = (text: string) => Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).filter((b) => b.textContent?.trim() === text);
const swatchIn = (hex: string) => pop()?.querySelector<HTMLElement>(`button[title="${hex}"]`) ?? null;
/**
 * leave the design card the way the channel tests need it: no effect of its
 * own, and a box silhouette again (a cut one keeps its corners as a clip)
 */
const effectBtnTab = () => {
  click(tabBtn("Shape effects"));
  click(effectBtn("None"));
  click(tabBtn("Shape"));
  click(shapeBtn("Rounded"));
  return null;
};

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

  /* ---------------- gradients, effects and one-click styles ---------------- */
  const LINEAR = { enabled: true, type: "linear", angle: 135, stops: [{ color: "#ff0000", at: 0 }, { color: "#0000ff", at: 100 }] } as const;
  const gFill = renderNumberStyle("circle", { ...BASE, bulletFillGradient: { ...LINEAR } }, 54, "৭");
  out.push({
    name: "a gradient fill paints the body as a gradient (and the number keeps its own ink)",
    pass:
      String(gFill.surface.background).includes("linear-gradient") &&
      String(gFill.surface.background).includes("#ff0000") &&
      gFill.color === "#ffffff",
    detail: String(gFill.surface.background ?? "—").slice(0, 90),
  });

  const gBorder = renderNumberStyle("square", { ...BASE, bulletBorderGradient: { ...LINEAR }, bulletBorderWeight: 3 }, 54, "৭");
  out.push({
    name: "a gradient border on a box rides the background-clip trick (a CSS border cannot take a gradient)",
    pass:
      String(gBorder.surface.backgroundImage).includes("linear-gradient") &&
      String(gBorder.surface.border).includes("3px") &&
      String(gBorder.surface.border).includes("transparent"),
    detail: `${String(gBorder.surface.border ?? "—")} · ${String(gBorder.surface.backgroundImage ?? "—").slice(0, 60)}`,
  });

  const gCut = renderNumberStyle("star", { ...BASE, bulletBorderGradient: { ...LINEAR }, bulletBorderWeight: 2.5 }, 54, "৭");
  out.push({
    name: "…and on a cut silhouette the gradient travels with the SVG stroke",
    pass: !!gCut.outline?.gradient?.enabled && gCut.outline.width === 2.5 && !gCut.surface.border,
    detail: gCut.outline ? `${gCut.outline.style} ${gCut.outline.width}px gradient=${gCut.outline.gradient?.type ?? "—"}` : "no outline",
  });

  const neon = renderNumberStyle("circle", { ...BASE, bulletEffect: "neon", bulletEffectIntensity: 70 }, 54, "৭");
  out.push({
    name: "a shape effect paints passes of its own (neon → a glow on the body, never on the digits)",
    pass: String(neon.effect?.layer?.filter ?? neon.effect?.surface?.filter ?? "").includes("drop-shadow") && neon.color === "#ffffff",
    detail: String(neon.effect?.layer?.filter ?? neon.effect?.surface?.filter ?? "—").slice(0, 90),
  });

  const stacked = renderNumberStyle("star", { ...BASE, bulletEffect: "stack", bulletEffectIntensity: 60 }, 54, "৭");
  const mirror = renderNumberStyle("circle", { ...BASE, bulletEffect: "reflection", bulletEffectIntensity: 50 }, 54, "৭");
  const sticker = renderNumberStyle("circle", { ...BASE, bulletEffect: "sticker", bulletEffectIntensity: 60 }, 54, "৭");
  out.push({
    name: "effects that need their own silhouettes carry them (a stack behind, a reflection below, a sticker's outline)",
    pass:
      (stacked.effect?.behind.length ?? 0) >= 2 &&
      !!mirror.effect?.reflection &&
      !!stacked.clip?.points &&
      `${sticker.effect?.layer?.filter ?? ""} ${sticker.effect?.surface?.filter ?? ""}`.includes("drop-shadow"),
    detail: `behind ${stacked.effect?.behind.length ?? 0} · reflection ${mirror.effect?.reflection ? "yes" : "no"} · clip ${stacked.clip?.points ? "star" : "—"}`,
  });

  const stylePatch = bulletStylePatch(BULLET_STYLES.find((x) => x.id === "goldSeal")!);
  const styled = renderNumberStyle("scallop", { ...BASE, ...stylePatch } as ThemeSettings, 54, "৭");
  out.push({
    name: "a one-click shape writes the whole marker at once (fill · line · effect)",
    pass:
      String(styled.surface.background).includes("gradient") &&
      !!styled.effect &&
      bulletStyleOf({ ...BASE, ...stylePatch } as ThemeSettings) === "goldSeal",
    detail: `${BULLET_STYLES.length} styles · ${String(styled.surface.background ?? "—").slice(0, 46)}…`,
  });

  const drifted = bulletStyleOf({ ...BASE, ...stylePatch, bulletFill: "#123456" } as ThemeSettings);
  out.push({
    name: "…and stops claiming the look as soon as one of its channels is hand-tuned",
    pass: drifted === "",
    detail: drifted ? `still ${drifted}` : "custom",
  });

  const brokenFx: string[] = [];
  for (const e of BULLET_EFFECTS) {
    for (const d of ["circle", "star", "pill"] as NumberStyle[]) {
      try {
        renderNumberStyle(d, { ...BASE, bulletEffect: e.id, bulletEffectIntensity: 60 }, 54, "৭");
      } catch (err) {
        brokenFx.push(`${e.id}/${d}:${String(err)}`);
      }
    }
  }
  out.push({
    name: "every shape effect renders on a box and on a cut silhouette (none throws)",
    pass: brokenFx.length === 0 && BULLET_EFFECTS.length >= 30 && BULLET_EFFECT_GROUPS.length >= 5,
    detail: brokenFx.join(" · ") || `${BULLET_EFFECTS.length} effects · ${BULLET_EFFECT_GROUPS.length} groups`,
  });

  const brokenStyle: string[] = [];
  for (const st of BULLET_STYLES) {
    try {
      const r = renderNumberStyle((st.patch.numberStyle ?? "circle") as NumberStyle, { ...BASE, ...st.patch } as ThemeSettings, 54, "৭");
      if (!r.surface) brokenStyle.push(`${st.id}:empty`);
    } catch (err) {
      brokenStyle.push(`${st.id}:${String(err)}`);
    }
  }
  out.push({
    name: "every shape renders (none throws, none comes out empty)",
    pass: brokenStyle.length === 0 && BULLET_STYLE_GROUPS.length >= 6,
    detail: brokenStyle.join(" · ") || `${BULLET_STYLES.length} styles · ${BULLET_STYLE_GROUPS.length} groups`,
  });

  /* ---------------- the presets the renamed tabs are named after ---------- */
  const bulletPoints = NUMBER_STYLES.filter((d) => d.category === "bullets");
  const numbering = NUMBER_STYLES.filter((d) => d.category === "numbering");
  const wantedBullets: NumberStyle[] = ["dot", "hollowDot", "squareDot", "hollowSquare", "dash", "arrowhead", "chevron", "check", "starDot"];
  out.push({
    name: "Bullet point presets open with the classic bullets (dot · hollow dot · square · dash · arrowhead · chevron · check · star) and the numbering formats",
    pass:
      NUMBER_STYLE_CATEGORIES[0]?.id === "bullets" &&
      NUMBER_STYLE_CATEGORIES[1]?.id === "numbering" &&
      bulletPoints.length >= 9 &&
      numbering.length >= 6 &&
      wantedBullets.every((id) => bulletPoints.some((d) => d.id === id)) &&
      NUMBER_STYLES.findIndex((d) => d.category === "bullets") === 0,
    detail: `${bulletPoints.length} bullets · ${numbering.length} numbering · groups ${NUMBER_STYLE_CATEGORIES.map((c) => c.label).join("/")}`,
  });

  /* a classic bullet is a small cut silhouette in the middle of a full-size box, and no number */
  const dotRender = renderNumberStyle("dot", { ...BASE }, 54, "৭");
  const hollowRender = renderNumberStyle("hollowDot", { ...BASE }, 54, "৭");
  out.push({
    name: "a bullet point stands in for the number: a cut glyph in a full-size box, the hollow ones stroked as a ring in the accent",
    pass:
      bulletPoints.every((d) => !showsNumber(d.id) && isBulletPoint(d.id)) &&
      dotRender.content === "" &&
      Number(dotRender.style.width) === 54 &&
      !!dotRender.surface.clipPath &&
      hollowRender.surface.background === "transparent" &&
      !!hollowRender.outline &&
      hollowRender.outline.color === BASE.accent &&
      hollowRender.outline.width > 2,
    detail: `dot ${dotRender.style.width}px clip=${dotRender.surface.clipPath ? "yes" : "no"} · hollow ring ${hollowRender.outline?.width}px ${hollowRender.outline?.color}`,
  });

  /* the numbering presets keep the number and add the punctuation, in the number's own script */
  const fmt = (id: NumberStyle, n: string) => renderNumberStyle(id, { ...BASE }, 54, n).content;
  const hiddenFmt = renderNumberStyle("numDot", { ...BASE, showNumber: false }, 54, "৭").content;
  out.push({
    name: "a numbering preset paints the number with its punctuation and no shape — 7. · (7) · Q7 · 07 — a leading zero in the number's own script",
    pass:
      numbering.every((d) => showsNumber(d.id) && isNumberingPreset(d.id) && !renderNumberStyle(d.id, { ...BASE }, 54, "৭").surface.clipPath) &&
      fmt("numDot", "৭") === "৭." &&
      fmt("numParen", "7") === "7)" &&
      fmt("numParens", "৭") === "(৭)" &&
      fmt("numQ", "7") === "Q7" &&
      fmt("numHash", "7") === "#7" &&
      fmt("numZero", "7") === "07" &&
      fmt("numZero", "৭") === "০৭" &&
      fmt("numZero", "12") === "12" &&
      zeroPadNumber("१") === "०१" &&
      hiddenFmt === "" &&
      Number(renderNumberStyle("numParens", { ...BASE }, 54, "৭").style.width) > 54,
    detail: `${fmt("numDot", "৭")} · ${fmt("numParens", "৭")} · ${fmt("numQ", "7")} · ${fmt("numZero", "7")} · ${fmt("numZero", "৭")} · hidden="${hiddenFmt}"`,
  });

  /* the Number + arrow family: a numbered plate with its own arrow tail, or
     the number inside the arrow body, or the number with a text arrow after it */
  const numArrow = NUMBER_STYLES.filter((d) => d.category === "numArrow");
  const brokenArrow: string[] = [];
  for (const d of numArrow) {
    try {
      const r = renderNumberStyle(d.id, { ...BASE }, 54, "৭");
      if (d.id !== "none" && !r.style.width) brokenArrow.push(`${d.id}:no-box`);
      else if (!isNumberingPreset(d.id) && r.content !== "৭") brokenArrow.push(`${d.id}:content`);
      else if (numberStyleAspect(d.id) > 1 && Number(r.style.width) <= 54) brokenArrow.push(`${d.id}:wide`);
    } catch (e) {
      brokenArrow.push(`${d.id}:${String(e)}`);
    }
  }
  const arrowDisc = renderNumberStyle("numArrowDisc", { ...BASE }, 54, "৭");
  const arrowHollow = renderNumberStyle("numArrowDiscHollow", { ...BASE }, 54, "৭");
  const arrowInBody = renderNumberStyle("numArrowBlock", { ...BASE }, 54, "৭");
  out.push({
    name: "the Number + arrow presets: a numbered plate + tail cut as ONE silhouette (the number sits in the plate), hollow ones stroked, and the number inside the arrow body",
    pass:
      isPresetCategory("numArrow" as never) &&
      numArrow.length >= 30 &&
      brokenArrow.length === 0 &&
      numArrow.every((d) => showsNumber(d.id)) &&
      String(arrowDisc.surface.clipPath).startsWith("polygon(") &&
      arrowDisc.content === "৭" &&
      Number(arrowDisc.style.width) > 54 * 1.5 &&
      arrowDisc.style.paddingRight !== undefined &&
      arrowHollow.surface.background === "transparent" &&
      !!arrowHollow.outline &&
      arrowInBody.content === "৭" &&
      arrowInBody.style.paddingRight !== undefined &&
      fmt("numArrowText", "৭") === "৭ →" &&
      fmt("numArrowText2", "৭") === "৭ ⇒" &&
      fmt("numArrowTextTri", "৭") === "৭ ▸",
    detail: brokenArrow.join(" · ") || `${numArrow.length} designs · disc ${arrowDisc.style.width}px padR ${arrowDisc.style.paddingRight}px · hollow line ${arrowHollow.outline?.width}px · ${fmt("numArrowText", "৭")}`,
  });

  out.push({
    name: "an id the catalogue doesn't know still falls back to the default disc (the list no longer opens with it)",
    pass: numberStyleDef("bogus" as NumberStyle).id === "circle" && NUMBER_STYLES[0].id !== "circle",
    detail: `fallback ${numberStyleDef("bogus" as NumberStyle).id} · first tile ${NUMBER_STYLES[0].id}`,
  });

  /* ---------------- the Shape catalogue: every silhouette family ------------ */
  const shapeGroups = SHAPE_CATEGORIES.map((c) => c.id);
  const wantedGroups = ["curve", "cards", "polygons", "arrows", "seals", "callouts", "flowchart", "stickers", "marks"];
  const newShapes: NumberStyle[] = [
    "oval", "egg", "dome", "lens", "softTriangle", "softDiamond", "softHexagon",
    "plaque", "frame", "chamfer", "folder", "tagLeft", "label", "slot",
    "rightTriangle", "heptagon", "nonagon", "decagon", "dodecagon", "rhombus", "slantLeft", "trapezoidDown", "stepLeft", "house", "gem", "hexWide",
    "arrowLeft", "arrowUp", "arrowDown", "blockRight", "blockLeft", "arrowBoth", "arrowUpDown", "notchedArrow", "triangleRight", "triangleLeft",
    "star4", "star7", "star10", "star16", "explosion", "flower", "softStar",
    "calloutDown", "calloutUp", "calloutLeft", "calloutRight", "roundCallout",
    "document", "delay", "display", "manualInput", "offPage", "cylinder", "subroutine", "loopLimit",
    "bell", "lock", "flask", "trefoil", "quatrefoil", "parens",
  ];
  const missingShapes = newShapes.filter((id) => !NUMBER_SHAPES.some((d) => d.id === id));
  out.push({
    name: "the Shape catalogue holds every silhouette family — round · cards · polygons · arrows · seals · callouts · flowchart · stickers · marks — and none of the presets",
    pass:
      wantedGroups.every((g) => shapeGroups.includes(g as never)) &&
      !shapeGroups.includes("bullets" as never) &&
      !shapeGroups.includes("numbering" as never) &&
      NUMBER_SHAPES.length >= 130 &&
      missingShapes.length === 0 &&
      NUMBER_SHAPES.every((d) => isNumberShape(d.id) && !isBulletPoint(d.id) && !isNumberingPreset(d.id)) &&
      NUMBER_STYLES.filter((d) => !isNumberShape(d.id)).every((d) => isPresetCategory(d.category)),
    detail: missingShapes.length
      ? `missing ${missingShapes.join(", ")}`
      : `${NUMBER_SHAPES.length} shapes · ${SHAPE_CATEGORIES.map((c) => `${c.label} ${NUMBER_SHAPES.filter((d) => d.category === c.id).length}`).join(" / ")}`,
  });

  /* the new shapes all render a body, and the ones drawn for a direction keep the number inside it */
  const brokenNew: string[] = [];
  for (const id of newShapes) {
    try {
      const r = renderNumberStyle(id, { ...BASE }, 54, "৭");
      if (!r.style.width) brokenNew.push(`${id}:no-box`);
      else if (id !== "parens" && !Object.keys(r.surface).length) brokenNew.push(`${id}:no-surface`);
      else if (r.content !== "৭") brokenNew.push(`${id}:content`);
    } catch (e) {
      brokenNew.push(`${id}:${String(e)}`);
    }
  }
  const arrowUp = renderNumberStyle("arrowUp", { ...BASE }, 100, "৭");
  const cylinder = renderNumberStyle("cylinder", { ...BASE }, 100, "৭");
  const parens = renderNumberStyle("parens", { ...BASE }, 54, "৭");
  const frameR = renderNumberStyle("frame", { ...BASE }, 54, "৭");
  const softHex = numberStyleDef("softHexagon");
  out.push({
    name: "every new shape renders with its number — a block arrow pads the digit into its shaft, the cylinder paints its rim, the parens are two round rules, soft corners are real arcs",
    pass:
      brokenNew.length === 0 &&
      Number(arrowUp.style.paddingTop) >= 40 &&
      String(arrowUp.surface.clipPath).startsWith("polygon(") &&
      String(cylinder.surface.background).includes("radial-gradient") &&
      (parens.marks?.length ?? 0) === 2 &&
      String(parens.marks?.[0].borderRadius ?? "").startsWith("22px") &&
      String(frameR.surface.border ?? "").includes(BASE.accent) &&
      (softHex.points?.length ?? 0) > 12,
    detail: brokenNew.join(" · ") || `arrow ▲ pad ${arrowUp.style.paddingTop}px · parens ${parens.marks?.[0].borderRadius} · soft hexagon ${softHex.points?.length} pts`,
  });

  const geometric = BULLET_STYLES.filter((s) => s.group === "Geometric");
  const organic = BULLET_STYLES.filter((s) => s.group === "Organic");
  const shapeLed = [...geometric, ...organic];
  out.push({
    name: "the one-click looks open with shape-led families — Geometric and Organic — each look wearing a different silhouette",
    pass:
      BULLET_STYLE_GROUPS[0] === "Geometric" &&
      BULLET_STYLE_GROUPS[1] === "Organic" &&
      geometric.length >= 10 &&
      organic.length >= 5 &&
      BULLET_STYLES[0].group === "Geometric" &&
      new Set(shapeLed.map((s) => s.patch.numberStyle)).size === shapeLed.length &&
      shapeLed.every((s) => NUMBER_STYLES.some((d) => d.id === s.patch.numberStyle)),
    detail: `${geometric.length} geometric · ${organic.length} organic · ${BULLET_STYLES.length} looks in all`,
  });

  /* --------- the triangle-flag family: the stock libraries' colourful ---- */
  /* --------- numbered triangles, in every triangle silhouette there is ---- */
  const flags = BULLET_STYLES.filter((s) => s.group === "Triangle flags");
  const flagShapes = flags.map((s) => s.patch.numberStyle as NumberStyle);
  const brokenFlag: string[] = [];
  for (const st of flags) {
    const r = renderNumberStyle((st.patch.numberStyle ?? "triangleRight") as NumberStyle, { ...BASE, ...st.patch } as ThemeSettings, 54, "৭");
    if (!String(r.surface?.clipPath ?? "").startsWith("polygon(")) brokenFlag.push(`${st.id}:no-clip`);
  }
  out.push({
    name: "the Triangle flags family dresses every triangle silhouette — ▶ ▲ ▼ ◀, the peak, the drop, the right angle, the open outline, the rounded play flag, the pennant, the gem, the pole flag — in the rainbow that family ships with",
    pass:
      BULLET_STYLE_GROUPS.includes("Triangle flags") &&
      flags.length >= 12 &&
      new Set(flagShapes).size === flags.length &&
      ["triangleRight", "triangle", "triangleDown", "triangleLeft", "rightTriangle", "softTriangleRight", "softTriangle", "hollowTriangle", "numArrowFlag", "gem", "flagDot", "hexPoint"].every((id) =>
        flagShapes.includes(id as NumberStyle),
      ) &&
      flagShapes.every((id) => NUMBER_STYLES.some((d) => d.id === id)) &&
      brokenFlag.length === 0 &&
      flags.every((s) => s.label.length <= 20),
    detail: brokenFlag.join(" · ") || `${flags.length} flags over ${new Set(flagShapes).size} silhouettes · ${flags.map((s) => s.patch.numberStyle).join("/")}`,
  });

  const flagPaint = flags.find((s) => s.id === "flagAmberGloss")!;
  const flagRender = renderNumberStyle((flagPaint.patch.numberStyle ?? "circle") as NumberStyle, { ...BASE, ...flagPaint.patch } as ThemeSettings, 54, "৭");
  out.push({
    name: "…and one click writes the whole flag — silhouette, gradient body, pale rim and gloss together, and stops claiming the look once a channel is hand-tuned",
    pass:
      String(flagRender.surface?.background ?? "").includes("gradient") &&
      bulletStyleOf({ ...BASE, ...bulletStylePatch(flagPaint) } as ThemeSettings) === "flagAmberGloss" &&
      bulletStyleOf({ ...BASE, ...bulletStylePatch(flagPaint), bulletFill: "#123456" } as ThemeSettings) === "",
    detail: `${String(flagRender.surface?.background ?? "—").slice(0, 52)}… · clip ${String(flagRender.surface?.clipPath ?? "—").slice(0, 24)}…`,
  });

  /* ---------------------------- the toolbar line --------------------------- */
  nav("questionBullet");
  const labels = Array.from(line("Question bullet tools")?.querySelectorAll<HTMLElement>("button, input") ?? []).map(
    (el) => el.getAttribute("aria-label") ?? "",
  );
  out.push({
    name: "the Question bullet line carries one button per channel — fill · border · numbering · style · radius · weight · transparency · position · design",
    pass: ["Fill", "Border", "Numbering", "Border style", "Border radius", "Border weight", "Transparency", "Bullet position", "Design"].every((l) =>
      labels.includes(l),
    ),
    detail: labels.filter(Boolean).join(" · "),
  });

  out.push({
    name: "the Design button wears the elegant diamond + sparkle icon (not the old disc)",
    pass: !!barButton("Design")?.querySelector("svg") && (barButton("Design")?.innerHTML.includes("M10 2.6") || !!barButton("Design")?.querySelector("path")),
    detail: barButton("Design")?.innerHTML.slice(0, 120) ?? "no Design button",
  });

  out.push({
    name: "Fill and Border spell their name out and wear the colour-picker icon — never a bare colour dot",
    pass: ["Fill", "Border"].every((l) => {
      const b = barButton(l);
      return (
        b?.textContent?.trim().startsWith(l) === true &&
        !!b.querySelector(".ctx-paint-name") &&
        !!b.querySelector(".ctx-paint-bar") &&
        !!b.querySelector(".ctx-paint-drop svg")
      );
    }),
    detail: ["Fill", "Border"].map((l) => `${l}: ${barButton(l)?.textContent?.trim() ?? "missing"}`).join(" · "),
  });

  out.push({
    name: "the marker paints its body on a layer of its own, with the number as the box's own node",
    pass:
      !!marker() &&
      !!surface() &&
      !!digits() &&
      digits()?.textContent === "১" &&
      !digits()?.hasAttribute("data-bullet-surface") &&
      Number(body()?.style.zIndex ?? 0) === -1 &&
      marker()?.style.isolation === "isolate",
    detail: `${marker()?.tagName ?? "no marker"} · body z=${body()?.style.zIndex ?? "—"} · surface ${surface() ? "yes" : "no"} · digits ${digits()?.textContent ?? "—"}`,
  });

  /* ----------------------- the bullet design card ------------------------- */
  // new elegant name is "Design" — old "Bullet design" kept as alias in code
  click(barButton("Design") ?? barButton("Bullet design"));
  out.push({
    name: "Design (Bullet design) opens one card with three tabs: bullet point presets · shape · shape effects",
    pass:
      (pop()?.getAttribute("data-pop-panel") === "Design" || pop()?.getAttribute("data-pop-panel") === "Bullet design") &&
      ["Bullet point presets", "Shape", "Shape effects"].every((t) => !!tabBtn(t)),
    detail: `panel ${pop()?.getAttribute("data-pop-panel")} · tabs ${Array.from(pop()?.querySelectorAll('[role="tab"]') ?? []).map((t) => t.textContent?.trim()).join("/")}`,
  });

  // also verify the new Numbering option exists and opens its own gallery
  closePop();
  click(barButton("Numbering"));
  const numberingTiles = pop()?.querySelectorAll('[aria-label^="Numbering:"]').length ?? 0;
  out.push({
    name: "Numbering opens its own gallery — bullet points · numbering · number + arrow presets",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Numbering" &&
      numberingTiles >= 90 &&
      !!pop()?.querySelector('[data-bullet-numbering-panel]'),
    detail: `${numberingTiles} numbering tiles · panel ${pop()?.getAttribute("data-pop-panel")}`,
  });
  closePop();
  click(barButton("Design") ?? barButton("Bullet design"));

  const listed = pop()?.querySelectorAll('[aria-label^="Bullet preset:"]').length ?? 0;
  const groups = pop()?.querySelectorAll('[aria-label="Bullet preset group"] button').length ?? 0;
  const presetsCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "the Bullet point presets tab lists the ready-made looks — bullet points, numbering and every one-click design — with the size and base colour, and no bare silhouettes",
    pass:
      listed >= 90 &&
      listed === NUMBER_STYLES.filter((d) => !isNumberShape(d.id)).length + BULLET_STYLES.length &&
      groups >= 12 &&
      !!popInput("Bullet size") &&
      presetsCard.includes("Bullet point presets") &&
      presetsCard.includes("Bullet colour") &&
      presetsCard.includes("Bullet points") &&
      presetsCard.includes("Numbering") &&
      presetsCard.includes("Geometric") &&
      presetsCard.includes("Exam classic") &&
      presetsCard.includes("Hand drawn") &&
      presetsCard.includes("Number + arrow") &&
      presetsCard.includes("Triangle flags") &&
      !!presetBtn("Dot") &&
      !!presetBtn("Check mark") &&
      !!presetBtn("(1)") &&
      !!presetBtn("Disc + arrow") &&
      !!presetBtn("1 →") &&
      !!pop()?.querySelector('[aria-label="Bullet presets: Number + arrow"]') &&
      !!pop()?.querySelector('[aria-label="Bullet presets: Triangle flags"]') &&
      !!presetBtn("Crimson flag ▶") &&
      !!presetBtn("Rose pennant") &&
      !!presetBtn("Hex tile") &&
      !!presetBtn("Gold seal") &&
      !!presetBtn("Crimson arrow →") &&
      !!presetBtn("Neon tube") &&
      !presetBtn("Circle") &&
      !presetBtn("Star") &&
      !presetBtn("Hexagon") &&
      !pop()?.querySelector('[aria-label^="Shape:"]'),
    detail: `${listed} presets · ${groups} groups · size ${popInput("Bullet size") ? "yes" : "no"}`,
  });

  click(tabBtn("Shape"));
  const shapeTiles = pop()?.querySelectorAll('[aria-label^="Shape:"]').length ?? 0;
  const shapeChips = pop()?.querySelectorAll('[aria-label="Shape group"] button').length ?? 0;
  const shapeCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "the Shape tab lists every silhouette — round · cards · polygons · arrows · seals · callouts · flowchart · stickers · marks — and none of the presets",
    pass:
      shapeTiles >= 130 &&
      shapeTiles === NUMBER_SHAPES.length &&
      shapeChips === SHAPE_CATEGORIES.length + 1 &&
      ["Round & soft", "Cards & chips", "Polygons", "Arrows", "Seals & stars", "Callouts", "Flowchart", "Stickers", "Marks"].every((g) => shapeCard.includes(g)) &&
      ["Circle", "Hexagon", "Arrow ▲", "Block arrow ▶", "Star 16", "Callout ▼", "Document", "Cylinder", "Padlock", "Soft hexagon", "Parens", "None"].every(
        (l) => !!shapeBtn(l),
      ) &&
      !shapeBtn("Dot") &&
      !shapeBtn("(1)") &&
      !shapeBtn("Gold seal") &&
      !pop()?.querySelector('[aria-label^="Bullet preset:"]'),
    detail: `${shapeTiles} shapes · ${shapeChips} chips · ${shapeCard.slice(0, 80)}`,
  });

  click(shapeBtn("Scallop"));
  out.push({
    name: "picking a shape repaints the marker with that silhouette",
    pass: !!surface()?.style.clipPath,
    detail: `clip ${surface()?.style.clipPath ? "seal" : "—"}`,
  });

  /* the Shape group chips narrow the gallery to one family */
  click(pop()?.querySelector('[aria-label="Shapes: Arrows"]'));
  const arrowTiles = Array.from(pop()?.querySelectorAll('[aria-label^="Shape:"]') ?? []).map((b) => b.getAttribute("aria-label") ?? "");
  click(pop()?.querySelector('[aria-label="All shapes"]'));
  out.push({
    name: "a Shape group chip narrows the gallery to that family (Arrows → arrows only)",
    pass:
      arrowTiles.length === NUMBER_SHAPES.filter((d) => d.category === "arrows").length &&
      arrowTiles.includes("Shape: Arrow ▶") &&
      arrowTiles.includes("Shape: Arrow ◀▶") &&
      !arrowTiles.includes("Shape: Circle"),
    detail: arrowTiles.join(" · "),
  });

  /* a classic bullet point on the board: the glyph is cut out of the body, and the number goes */
  click(tabBtn("Bullet point presets"));
  click(presetBtn("Check mark"));
  const checkClip = surface()?.style.clipPath ?? "";
  const checkDigits = digits()?.textContent ?? "";
  out.push({
    name: "picking a bullet point paints the glyph instead of the number (a check mark cut out of the marker's body)",
    pass: checkClip.startsWith("polygon(") && checkDigits === "" && !!body(),
    detail: `clip ${checkClip.slice(0, 32)}… · digits "${checkDigits}"`,
  });

  /* a numbering preset on the board: the number keeps its script and gains its punctuation */
  click(presetBtn("(1)"));
  const parensText = (marker()?.textContent ?? "").trim();
  out.push({
    name: "picking a numbering preset wraps the slide's own number — (১) — with no shape body behind it",
    pass: parensText === "(১)" && !surface(),
    detail: `marker text "${parensText}" · surface ${surface() ? "yes" : "no"}`,
  });

  /* a Number + arrow preset on the board: the wide compound marker, number in the plate */
  click(presetBtn("Disc + arrow"));
  const arrowMarker = marker();
  out.push({
    name: "picking a Number + arrow preset paints the wide compound marker — the number in the plate, the tail clipped as one silhouette",
    pass:
      digits()?.textContent === "১" &&
      String(surface()?.style.clipPath ?? "").startsWith("polygon(") &&
      parseFloat(arrowMarker?.style.width ?? "") > 54 * 1.5,
    detail: `marker ${arrowMarker?.style.width} · digits "${digits()?.textContent}" · clip ${String(surface()?.style.clipPath ?? "").slice(0, 24)}…`,
  });

  /* the marker grows, and the corner slider's ceiling grows with it */
  type(popInput("Bullet size"), "120");

  const lookTiles = BULLET_STYLES.filter((s) => !!presetBtn(s.label)).length;
  click(presetBtn("Gold seal"));
  const presetsNow = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "a one-click look is one click: the preset tile writes the marker's silhouette, fill, line and effect together",
    pass:
      lookTiles === BULLET_STYLES.length &&
      css(surface()).includes("gradient") &&
      String(surface()?.style.clipPath).startsWith("polygon(") &&
      !!body() &&
      css(marker()).includes("120px") &&
      presetsNow.includes("now Gold seal"),
    detail: `${lookTiles} looks · ${css(surface()).slice(0, 86)}`,
  });

  /* a shape changes the silhouette alone — the look's paint and effect travel onto it */
  click(tabBtn("Shape"));
  const shapeCardNow = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  click(shapeBtn("Hexagon"));
  const hexClip = surface()?.style.clipPath ?? "";
  click(tabBtn("Bullet point presets"));
  const presetsAfter = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "picking a shape keeps the paint: Gold seal's gradient and effect travel onto a hexagon, and the presets tab now reads custom",
    pass:
      shapeCardNow.includes("now Scallop") &&
      hexClip.startsWith("polygon(25% 0%") &&
      css(surface()).includes("gradient") &&
      css(surface()).includes("rgb(255, 241, 184)") &&
      !!body() &&
      presetsAfter.includes("now custom") &&
      shapeBtn("Hexagon") === null,
    detail: `clip ${hexClip.slice(0, 24)}… · ${css(surface()).slice(0, 70)} · ${presetsAfter.includes("now custom") ? "custom" : "still claimed"}`,
  });
  /* back to a box silhouette, so the corners and the line read as plain CSS */
  click(effectBtnTab());
  closePop();

  /* ------------------------- the focused cards ----------------------------- */
  click(barButton("Border style"));
  const styleCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "Border style opens the six line styles as pictures — and nothing else",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Border style" &&
      ["Auto", "None", "Solid", "Dashed", "Dotted", "Double"].every((t) => !!tile(`Border style: ${t}`)) &&
      !styleCard.includes("Border radius") &&
      !styleCard.includes("Border weight") &&
      !styleCard.includes("Shape fill"),
    detail: styleCard.slice(0, 120),
  });
  click(tile("Border style: Dashed"));

  click(barButton("Border radius"));
  const radiusInput = popInput("Border radius (px)");
  const radiusCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "Border radius is one slider whose ceiling follows the marker — no fixed px cap",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Border radius" &&
      radiusInput?.getAttribute("max") === "120" &&
      !radiusCard.includes("Border weight") &&
      !radiusCard.includes("Transparency"),
    detail: `slider 0…${radiusInput?.getAttribute("max") ?? "—"} · ${radiusCard.slice(0, 80)}`,
  });
  type(radiusInput, "18");

  click(barButton("Border weight"));
  const weightCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "Border weight is one slider — and only the weight",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Border weight" &&
      !!popInput("Border weight (px)") &&
      !weightCard.includes("Border radius") &&
      !weightCard.includes("Transparency"),
    detail: weightCard.slice(0, 90),
  });
  type(popInput("Border weight (px)"), "4");

  click(barButton("Transparency"));
  const transCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "Transparency is one slider over the body — and only transparency",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Transparency" &&
      !!popInput("Marker transparency (100 = fully visible)") &&
      !transCard.includes("Border radius") &&
      !transCard.includes("Border weight"),
    detail: transCard.slice(0, 90),
  });
  type(popInput("Marker transparency (100 = fully visible)"), "50");
  out.push({
    name: "dashed · radius 18 · weight 4 · 50 % transparency all land on the marker's body",
    pass:
      css(surface()).includes("dashed") &&
      css(surface()).includes("4px") &&
      css(surface()).includes("border-radius: 18px") &&
      css(surface()).includes("opacity: 0.5"),
    detail: css(surface()),
  });
  out.push({
    name: "…and the number inside keeps its own ink and its own opacity",
    pass: !!digits() && !css(digits()).includes("opacity: 0.5"),
    detail: `digits ${css(digits()) || "(no inline style)"}`.slice(0, 150),
  });
  closePop();

  /* -------------------------- the paint cards ------------------------------ */
  click(barButton("Fill"));
  const openedOn = popAll("Gradient").length >= 1 && (pop()?.textContent ?? "").includes("Default gradients") ? "gradient" : "solid";
  click(popAll("Solid")[0]);
  const fillCard = (pop()?.textContent ?? "").replace(/\s+/g, " ");
  out.push({
    name: "Fill opens the colour card: Auto · None on top, then the same solid + gradient picker the text colour uses",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Paint" &&
      !!doc.querySelector('[data-paint-panel="Fill"]') &&
      popAll("Auto").length >= 1 &&
      popAll("None").length >= 1 &&
      popAll("Solid").length >= 1 &&
      popAll("Gradient").length >= 1 &&
      fillCard.includes("Custom color"),
    detail: `opened on ${openedOn} · ${fillCard.slice(0, 96)}`,
  });
  click(popAll("None")[0]);
  const noFill = !surface()?.style.background && !surface()?.style.backgroundImage;
  click(popAll("Auto")[0]);
  const autoFill = !!surface()?.style.background;
  click(swatchIn("#FF0000"));
  await frame();
  const solidFill = String(surface()?.style.background ?? "");
  click(popAll("Gradient")[0]);
  click(pop()?.querySelector("[data-gradient-swatch]") ?? null);
  await frame();
  out.push({
    name: "the Fill card's four states all reach the body — none · auto · a solid · a gradient",
    pass: noFill && autoFill && solidFill.includes("255, 0, 0") && String(surface()?.style.background).includes("gradient"),
    detail: `none=${noFill} auto=${autoFill} solid=${solidFill} gradient=${String(surface()?.style.background ?? "—").slice(0, 40)}`,
  });
  closePop();

  click(barButton("Border"));
  click(swatchIn("#00FF00"));
  await frame();
  const solidBorder = String(surface()?.style.border ?? "");
  click(popAll("Gradient")[0]);
  click(pop()?.querySelector("[data-gradient-swatch]") ?? null);
  await frame();
  out.push({
    name: "the Border card paints the line solid or as a gradient (a box takes the background-clip trick)",
    pass:
      solidBorder.includes("0, 255, 0") &&
      String(surface()?.style.backgroundImage ?? "").includes("gradient") &&
      String(surface()?.style.border ?? "").includes("transparent"),
    detail: `${solidBorder} → ${String(surface()?.style.border ?? "—")} · ${String(surface()?.style.backgroundImage ?? "—").slice(0, 40)}`,
  });
  closePop();

  /* ---------------------- outline on a cut silhouette ---------------------- */
  click(barButton("Design") ?? barButton("Bullet design"));
  click(tabBtn("Shape"));
  click(shapeBtn("Star"));
  closePop();
  click(barButton("Border style"));
  click(tile("Border style: Double"));
  closePop();
  const svg = outline();
  out.push({
    name: "on a cut silhouette the outline is stroked in SVG (double line), never dropped",
    pass: svg?.getAttribute("data-bullet-outline") === "double" && svg.querySelectorAll("polygon").length === 2,
    detail: `${svg?.getAttribute("data-bullet-outline")} · ${svg?.querySelectorAll("polygon").length ?? 0} polygons`,
  });

  const svgGrad = svg?.querySelector("linearGradient, radialGradient");
  out.push({
    name: "…and its gradient border becomes an SVG paint server, so the dashes follow the points",
    pass:
      !!svgGrad &&
      svg?.getAttribute("data-gradient") === "on" &&
      String(svg?.querySelectorAll("polygon")[1]?.getAttribute("stroke") ?? "").startsWith("url(#"),
    detail: `${svgGrad?.tagName ?? "no gradient"} · stroke ${svg?.querySelectorAll("polygon")[1]?.getAttribute("stroke") ?? "—"}`,
  });

  /* ----------------------------- shape effects ----------------------------- */
  click(barButton("Design") ?? barButton("Bullet design"));
  click(tabBtn("Shape effects"));
  const effectTiles = pop()?.querySelectorAll('[aria-label^="Shape effect:"]').length ?? 0;
  click(effectBtn("Neon"));
  await frame();
  const neonFx = `${css(body())} ${css(surface())}`;
  type(popInput("Bullet effect intensity"), "85");
  await frame();
  const loudFx = `${css(body())} ${css(surface())}`;
  out.push({
    name: "a shape effect paints the marker's body layer — with its own intensity dial",
    pass:
      effectTiles >= 30 &&
      neonFx.includes("drop-shadow") &&
      loudFx.includes("drop-shadow") &&
      loudFx !== neonFx &&
      !css(digits()).includes("filter"),
    detail: `${effectTiles} effects · ${neonFx.slice(0, 70)}`,
  });
  click(effectBtn("Stack"));
  await frame();
  out.push({
    name: "an effect that needs its own silhouettes paints them under the body (two paper copies behind)",
    pass: (marker()?.querySelectorAll("[data-bullet-behind]").length ?? 0) >= 2,
    detail: `${marker()?.querySelectorAll("[data-bullet-behind]").length ?? 0} behind layers`,
  });
  click(effectBtn("Sticker"));
  await frame();
  out.push({
    name: "…and a sticker's pale outline rides the body's own filter, so it follows the cut",
    pass: `${css(body())} ${css(surface())}`.includes("drop-shadow"),
    detail: `${css(body())} ${css(surface())}`.slice(0, 90),
  });
  click(effectBtn("Reflection"));
  await frame();
  out.push({
    name: "…and the reflection pass mirrors the marker below itself",
    pass: !!marker()?.querySelector("[data-bullet-reflection]"),
    detail: marker()?.querySelector("[data-bullet-reflection]") ? "reflection painted" : "none",
  });
  click(effectBtn("None"));
  closePop();

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
    name: "the inspector's Question bullet destination shows the design card and every channel",
    pass:
      ["Shape fill colour", "Border colour", "Border style", "Border radius", "Border weight", "Transparency", "Nudge horizontally", "Numbering"].every((t) =>
        panelText().includes(t),
      ) &&
      !!doc.querySelector("[data-bullet-shape-controls]") &&
      !!doc.querySelector("[data-bullet-position-controls]") &&
      !!doc.querySelector("[data-bullet-design-panel]") &&
      !!doc.querySelector("[data-bullet-numbering-panel]"),
    detail: panelText().slice(0, 200),
  });

  /* -------------------------------- Default -------------------------------- */
  click(line("Question bullet tools")?.querySelector<HTMLElement>("[data-toolbar-default]"));
  const reset = {
    nudge: !marker()?.style.transform,
    opaque: !css(surface()).includes("opacity"),
    solid: !css(surface()).includes("dashed"),
    round: String(surface()?.style.borderRadius) === "50%",
    noClip: !surface()?.style.clipPath,
    autoFill: (barButton("Fill")?.getAttribute("title") ?? "").includes("auto"),
    autoBorder: (barButton("Border")?.getAttribute("title") ?? "").includes("auto"),
    noFx: !css(body()).includes("filter") && !marker()?.querySelector("[data-bullet-behind]"),
  };
  out.push({
    name: "Default unwinds the whole marker in one click (design · fill · border · gradients · style · radius · weight · transparency · effect · nudge)",
    pass: Object.values(reset).every(Boolean),
    detail: `${css(marker()).slice(0, 90)} · ${JSON.stringify(reset)}`,
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
