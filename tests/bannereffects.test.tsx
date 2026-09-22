/**
 * Title background effects suite.
 *
 * The "Banner effects" button of the Title background line opens the plate's
 * Effects card: its own softness · halo · shimmer lead, and then one section
 * per effect group — Shadow Effects (eight shadows, each dressed by X · Y ·
 * Blur · Spread · Opacity · Colour), Glow & Light, Depth / 3D, Modern Effects,
 * Shape Effects and Decorative Effects. One effect wears at a time in each
 * group ("None" takes it off); the shape's distortions stack. These tests walk
 * every group to the slide: the shadow's six controls reach the plate's
 * box-shadow, the glows and the decorations paint, the depth rides its own
 * layers, the modern finishes paint overlays (and the glass family its
 * backdrop blur), the shape effects cut the edge and turn the plate, and the
 * line's Default hands the plate back its undressed body.
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
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const popButton = (label: string) => pop()?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null;
const openCard = (label: string) => {
  click(doc.querySelector(`.context-toolbar [aria-label="${label}"]`));
};
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));

const titleBox = () => doc.querySelector<HTMLElement>('.slide-editable [data-el="title"]');
const plate = () => titleBox()?.querySelector<HTMLElement>("[data-banner-plate]") ?? null;
/** the plate's own extra layers — behind the body (the long shadow's streak, the 3D's slabs) */
const plateLayers = () => Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-layer]") ?? []);
/** the effects' overlays — above the body, under the heading */
const overlays = () => Array.from(titleBox()?.querySelectorAll<HTMLElement>("[data-banner-overlay]") ?? []);
const shadowOf = () => plate()?.style.boxShadow ?? "";
const styleOf = (el: HTMLElement | null) => el?.getAttribute("style") ?? "";
/** how many paints a background string stacks, one per `…-gradient(` */
const paints = (s: string) => (s.match(/gradient\(/g) ?? []).length;

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
  const GROUPS = ["shadow", "glow", "depth", "modern", "shape", "decor"];
  out.push({
    name: "the Effects card files its six groups — Shadow · Glow & Light · Depth/3D · Modern · Shape · Decorative — and keeps softness · halo · shimmer",
    pass:
      GROUPS.every((g) => !!pop()?.querySelector(`[data-banner-fx-group="${g}"]`)) &&
      !!pop()?.querySelector('input[aria-label="Banner softness"]') &&
      !!pop()?.querySelector('input[aria-label="Banner halo"]') &&
      Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).some((b) => (b.textContent ?? "").includes("Shimmer")),
    detail: GROUPS.map((g) => `${g}:${!!pop()?.querySelector(`[data-banner-fx-group="${g}"]`)}`).join(" "),
  });

  /* the shadow group's tiles, one per effect, plus the None that takes it off */
  out.push({
    name: "Shadow Effects holds its eight shadows as tiles — Drop · Soft · Hard · Long · Inner · Floating · Offset · Colored",
    pass:
      ["Drop Shadow", "Soft Shadow", "Hard Shadow", "Long Shadow", "Inner Shadow", "Floating Shadow", "Offset Shadow", "Colored Shadow"]
        .every((l) => !!popButton(`Banner shadow: ${l}`)) && !!popButton("Banner shadow: None"),
    detail: Array.from(pop()?.querySelectorAll('[data-banner-fx-group="shadow"] [role="option"]') ?? [])
      .map((b) => b.getAttribute("aria-label")?.replace("Banner shadow: ", ""))
      .join(" / "),
  });

  /* ------------------------------- shadows --------------------------------- */
  click(popButton("Banner shadow: Drop Shadow"));
  out.push({
    name: "Drop Shadow paints the plate's own box-shadow from its six controls — X 0 · Y 8 · Blur 24 · Spread 0 · Opacity 50 · black",
    pass: shadowOf() === "0px 8px 24px 0px rgba(0, 0, 0, 0.5)",
    detail: shadowOf(),
  });
  const sx = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shadow X (px)"]');
  const sy = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shadow Y (px)"]');
  const sBlur = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shadow blur (px)"]');
  const sSpread = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shadow spread (px)"]');
  const sOp = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shadow opacity (%)"]');
  out.push({
    name: "the shadow's controls are X · Y · Blur · Spread · Opacity bars and a colour well",
    pass: [sx, sy, sBlur, sSpread, sOp].every((i) => i?.type === "range") && !!pop()?.querySelector('[data-banner-fx-group="shadow"] input[type="color"]'),
    detail: `${[sx, sy, sBlur, sSpread, sOp].map((i) => i?.type).join(",")} + colour`,
  });
  type(sx, "20");
  type(sy, "-12");
  type(sBlur, "40");
  type(sSpread, "6");
  type(sOp, "80");
  out.push({
    name: "…and each of the six walks the shadow — 20 · -12 · 40 · 6 · 80% all reach the plate",
    pass: shadowOf() === "20px -12px 40px 6px rgba(0, 0, 0, 0.8)",
    detail: shadowOf(),
  });
  const sColor = pop()?.querySelector<HTMLInputElement>('[data-banner-fx-group="shadow"] input[type="color"]');
  act(() => {
    if (!sColor) return;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
    setter?.call(sColor, "#29b36f");
    sColor.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
  await frame();
  out.push({
    name: "Colored Shadow wears the picked colour — the well repaints the shadow itself",
    pass: shadowOf().includes("rgba(41, 179, 111,") || shadowOf().toLowerCase().includes("#29b36f"),
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Long Shadow"));
  out.push({
    name: "Long Shadow runs a diagonal streak out of the plate, on a layer of its own behind the body",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.background ?? "").includes("linear-gradient(135deg") &&
      (plateLayers()[0]?.style.transform ?? "").includes("translate(18px, 18px)"),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.background ?? "").slice(0, 44)}`,
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
    pass: shadowOf() === "0 24px 36px -12px rgba(0, 0, 0, 0.45)",
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: Offset Shadow"));
  out.push({
    name: "Offset Shadow is a solid duplicate, stepped down and right — no blur",
    pass: shadowOf() === "12px 12px 0px 0px rgba(0, 0, 0, 0.7)",
    detail: shadowOf(),
  });
  click(popButton("Banner shadow: None"));
  out.push({
    name: "…and None takes the whole shadow off",
    pass: shadowOf() === "",
    detail: shadowOf() || "clean",
  });

  /* ------------------------------ glow & light ----------------------------- */
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
  click(popButton("Banner glow: Gloss"));
  out.push({
    name: "Gloss paints the polished top half as an overlay above the body, under the heading",
    pass:
      overlays().length === 1 &&
      (overlays()[0]?.style.background ?? "").includes("linear-gradient(180deg") &&
      (overlays()[0]?.style.borderRadius ?? "") !== "",
    detail: `${overlays().length} overlay · ${(overlays()[0]?.style.background ?? "").slice(0, 48)}`,
  });
  click(popButton("Banner glow: Shine"));
  out.push({
    name: "Shine sweeps a broad sheen across the body",
    pass: (overlays()[0]?.style.background ?? "").includes("115deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  const gInt = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: glow intensity"]');
  out.push({
    name: "the glow's intensity walks its reach",
    pass: gInt?.type === "range" && Number(gInt?.max) === 100,
    detail: `${gInt?.min}–${gInt?.max}`,
  });
  type(gInt, "100");
  const glowFull = shadowOf();
  click(popButton("Banner glow: None"));
  out.push({
    name: "…and None leaves the edge clean again",
    pass: shadowOf() === "",
    detail: `before ${glowFull.slice(0, 40)} · after clean`,
  });

  /* -------------------------------- depth / 3D ----------------------------- */
  click(popButton("Banner depth: Bevel"));
  out.push({
    name: "Bevel lights one edge and shades the other, by the light's angle",
    pass: (shadowOf().match(/inset/g) ?? []).length === 2,
    detail: shadowOf(),
  });
  const dAngle = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: light angle (deg)"]');
  type(dAngle, "90");
  const bevel90 = shadowOf();
  type(dAngle, "0");
  out.push({
    name: "…and the lit edge follows the light — 90° bevels a different way than 0°",
    pass: dAngle?.type === "range" && bevel90 !== shadowOf(),
    detail: `0° ${shadowOf().slice(0, 38)} · 90° ${bevel90.slice(0, 38)}`,
  });
  click(popButton("Banner depth: 3D Extrusion"));
  out.push({
    name: "3D Extrusion stands a slab of the plate behind the body",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.transform ?? "").includes("translateY(") &&
      shadowOf().includes("rgba(0, 0, 0,"),
    detail: `${plateLayers().length} slab · ${(plateLayers()[0]?.style.transform ?? "").slice(0, 30)} · ${shadowOf().slice(0, 30)}`,
  });
  click(popButton("Banner depth: Perspective"));
  out.push({
    name: "Perspective tips the plate back in space",
    pass:
      (plate()?.style.transform ?? "").includes("perspective(") && (plate()?.style.transform ?? "").includes("rotateX("),
    detail: plate()?.style.transform ?? "",
  });
  click(popButton("Banner depth: None"));
  out.push({
    name: "…and None lays the plate flat again",
    pass: plate()?.style.transform === "" && shadowOf() === "",
    detail: `transform ${plate()?.style.transform || "clean"} · shadow clean`,
  });

  /* ----------------------------- modern effects ---------------------------- */
  click(popButton("Banner modern: Glassmorphism"));
  out.push({
    name: "Glassmorphism paints a translucent pane with a rim and a backdrop blur",
    pass:
      overlays().length === 1 &&
      !!overlays()[0]?.style.backdropFilter &&
      (overlays()[0]?.style.border ?? "").includes("solid") &&
      (overlays()[0]?.style.background ?? "").includes("linear-gradient"),
    detail: `${overlays()[0]?.style.backdropFilter ?? ""} · ${(overlays()[0]?.style.border ?? "").slice(0, 30)}`,
  });
  const mBlur = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: backdrop blur (px)"]');
  type(mBlur, "20");
  out.push({
    name: "…and its blur walks the frost",
    pass: (overlays()[0]?.style.backdropFilter ?? "").includes("blur(9px)"),
    detail: overlays()[0]?.style.backdropFilter ?? "",
  });
  click(popButton("Banner modern: Noise / Grain"));
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
  click(popButton("Banner modern: None"));
  out.push({
    name: "…and None strips the finish away",
    pass: overlays().length === 0,
    detail: `${overlays().length} overlays`,
  });

  /* ------------------------------ shape effects ---------------------------- */
  /* the factory deck wears the soft glow silhouette, whose edge the shape effects
     cannot cut — pick a real plate first, like the Shape card's own tiles */
  closePop();
  openCard("Banner shape");
  click(popButton("Banner shape: Rounded Rectangle"));
  closePop();
  openCard("Banner effects");
  const radiusFx = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: corner radius (px)"]');
  type(radiusFx, "30");
  out.push({
    name: "Shape Effects: the corner radius rounds the plate's own corners",
    pass: plate()?.style.borderRadius === "30px",
    detail: `radius ${plate()?.style.borderRadius}`,
  });
  click(Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => (b.textContent ?? "").includes("Independent corner radius")));
  const cTL = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: corner top-left (px)"]');
  const cTR = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: corner top-right (px)"]');
  const cBR = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: corner bottom-right (px)"]');
  const cBL = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: corner bottom-left (px)"]');
  type(cTL, "10");
  type(cTR, "20");
  type(cBR, "40");
  type(cBL, "5");
  out.push({
    name: "…and Independent Corner Radius gives each corner its own value",
    pass: plate()?.style.borderRadius === "10px 20px 40px 5px" && [cTL, cTR, cBR, cBL].every((i) => i?.type === "range"),
    detail: `radius ${plate()?.style.borderRadius}`,
  });
  const rot = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: rotation (deg)"]');
  type(rot, "15");
  out.push({
    name: "Rotation turns the plate",
    pass: (plate()?.style.transform ?? "").includes("rotate(15deg)"),
    detail: plate()?.style.transform ?? "",
  });
  const skew = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: skew (deg)"]');
  type(skew, "10");
  out.push({
    name: "Skew shears it, and the transforms stack in order",
    pass: (plate()?.style.transform ?? "").includes("rotate(15deg)") && (plate()?.style.transform ?? "").includes("skewX(10deg)"),
    detail: plate()?.style.transform ?? "",
  });
  const dist = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: shape distortion"]');
  type(dist, "50");
  out.push({
    name: "Shape Distortion stretches the plate",
    pass: (plate()?.style.transform ?? "").includes("scaleX(1.250)"),
    detail: plate()?.style.transform ?? "",
  });
  click(Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => (b.textContent ?? "").includes("Flip horizontal")));
  out.push({
    name: "Flip Horizontal mirrors it",
    pass: (plate()?.style.transform ?? "").includes("scaleX(-1)"),
    detail: plate()?.style.transform ?? "",
  });
  const wave = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: wave amount"]');
  type(wave, "60");
  out.push({
    name: "Wave Amount cuts the edge into a wave, as the plate's own mask",
    pass: (plate()?.style.maskImage ?? "").includes("url(") && (plate()?.style.maskImage ?? "").includes("data:image/svg"),
    detail: (plate()?.style.maskImage ?? "").slice(0, 40),
  });
  const curve = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: curve amount"]');
  type(curve, "60");
  out.push({
    name: "Curve Amount bends the band the same way",
    pass: (plate()?.style.maskImage ?? "").includes("data:image/svg"),
    detail: (plate()?.style.maskImage ?? "").slice(0, 40),
  });
  const slant = pop()?.querySelector<HTMLInputElement>('[aria-label="Banner fx: slant amount"]');
  type(slant, "50");
  out.push({
    name: "…and Slant Amount shears the silhouette",
    pass: (plate()?.style.maskImage ?? "").includes("data:image/svg"),
    detail: (plate()?.style.maskImage ?? "").slice(0, 40),
  });
  click(Array.from(pop()?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => (b.textContent ?? "").includes("Flip vertical")));
  out.push({
    name: "Flip Vertical inverts it — the whole stack, flips last",
    pass: (plate()?.style.transform ?? "").includes("scaleY(-1)") && (plate()?.style.transform ?? "").includes("scaleX(-1)"),
    detail: plate()?.style.transform ?? "",
  });
  /* the overlay must turn with the plate it paints over */
  click(popButton("Banner glow: Highlight"));
  out.push({
    name: "an effect overlay wears the very same transform as the plate",
    pass: overlays().length === 1 && (overlays()[0]?.style.transform ?? "") === (plate()?.style.transform ?? ""),
    detail: `overlay ${overlays()[0]?.style.transform ?? ""}`,
  });
  click(popButton("Banner glow: None"));

  /* --------------------------- decorative effects -------------------------- */
  click(popButton("Banner decor: Vignette"));
  out.push({
    name: "Vignette darkens the corners toward the middle, as an overlay",
    pass: (overlays()[0]?.style.background ?? "").includes("radial-gradient"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 50),
  });
  click(popButton("Banner decor: Edge Highlight"));
  out.push({
    name: "Edge Highlight brightens the rim from inside",
    pass: shadowOf().startsWith("inset 0 0 0"),
    detail: shadowOf(),
  });
  click(popButton("Banner decor: Gradient Shadow"));
  out.push({
    name: "Gradient Shadow fades from one tone to another, on a layer of its own",
    pass:
      plateLayers().length === 1 &&
      (plateLayers()[0]?.style.background ?? "").includes("linear-gradient(180deg") &&
      (plateLayers()[0]?.style.transform ?? "").includes("translateY("),
    detail: `${plateLayers().length} layer · ${(plateLayers()[0]?.style.background ?? "").slice(0, 44)}`,
  });
  click(popButton("Banner decor: Pattern Overlay"));
  out.push({
    name: "Pattern Overlay weaves a fine diagonal over the paint",
    pass: (overlays()[0]?.style.background ?? "").includes("repeating-linear-gradient(45deg"),
    detail: (overlays()[0]?.style.background ?? "").slice(0, 52),
  });
  click(popButton("Banner decor: None"));
  out.push({
    name: "…and None strips the decoration away",
    pass: overlays().length === 0 && plateLayers().length === 0 && shadowOf() === "",
    detail: `overlays ${overlays().length} · layers ${plateLayers().length} · shadow clean`,
  });

  /* --------------------------- stacking across groups ---------------------- */
  click(popButton("Banner shadow: Drop Shadow"));
  click(popButton("Banner glow: Outer Glow"));
  click(popButton("Banner decor: Outline Glow"));
  out.push({
    name: "one effect per group, all at once — the shadows stack on the plate, the groups never fight",
    pass:
      (shadowOf().match(/rgba\(/g) ?? []).length >= 4 &&
      shadowOf().includes("rgba(0, 0, 0, 0.5)") &&
      shadowOf().includes("rgba(255, 255, 255,"),
    detail: shadowOf(),
  });

  /* ------------------------------- Default --------------------------------- */
  click(line()?.querySelector<HTMLElement>("[data-toolbar-default]"));
  out.push({
    name: "the line's Default hands the plate back its undressed body — no shadow, no glow, no turn",
    pass:
      shadowOf() === "" &&
      overlays().length === 0 &&
      (plate()?.style.transform ?? "") === "" &&
      (plate()?.style.maskImage ?? "") === "",
    detail: `shadow clean · overlays ${overlays().length} · transform clean`,
  });

  out.push({ name: "no uncaught errors while dressing the plate's effects", pass: errors.length === 0, detail: errors.slice(0, 3).join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => {
    root?.unmount();
  });
  return out;
}
