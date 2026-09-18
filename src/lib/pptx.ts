/**
 * PPTX import — every slide of a PowerPoint deck is rendered to a picture so
 * it can be used exactly like a PDF page (background, image layer, Upload).
 *
 * The .pptx is parsed in the browser with `pptxtojson` (a zip of XML → plain
 * objects with positions in pt and text as inline-styled HTML). We lay those
 * objects out in an off-screen DOM node at the deck's native size and
 * rasterise it with html-to-image, the same renderer the exporter uses. That
 * gives a faithful-enough visual snapshot: backgrounds, shapes, pictures, text
 * (including Bangla, through the app's already-loaded web fonts) and tables.
 * Charts / video / audio have no renderer and are drawn as a light placeholder.
 *
 * The result implements the same `OpenedDocument` contract as `openPdf`, so
 * the page-picker dialog and the deck insertion code are shared.
 */
import { getFontEmbedCSS, toPng } from "html-to-image";
import type { OpenedPdf, PdfPageRender } from "./pdf";

/* --------------------------------------------------------------- types --- */
// Loose local typing: pptxtojson's d.ts is broad, and we only read a subset.
interface PFillColor {
  type: "color";
  value: string;
}
interface PFillImage {
  type: "image";
  value: { base64?: string; blob?: string; opacity?: number };
}
interface PFillGradient {
  type: "gradient";
  value: { path: string; rot: number; colors: { pos: string; color: string }[] };
}
interface PFillPattern {
  type: "pattern";
  value: { foregroundColor: string; backgroundColor: string };
}
type PFill = PFillColor | PFillImage | PFillGradient | PFillPattern | null | undefined;

interface PBase {
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  isFlipH?: boolean;
  isFlipV?: boolean;
  order?: number;
}
interface PShape extends PBase {
  type: "shape" | "text";
  fill?: PFill;
  borderColor?: string;
  borderWidth?: number;
  borderType?: string;
  borderStrokeDasharray?: string;
  content?: string;
  vAlign?: string;
  path?: string;
  pathViewBox?: { x: number; y: number; width: number; height: number };
  textInset?: { l: number; t: number; r: number; b: number };
  shadow?: { h: number; v: number; blur: number; color: string };
  strokeOnly?: boolean;
  isVertical?: boolean;
}
interface PImage extends PBase {
  type: "image";
  base64?: string;
  blob?: string;
  rect?: { t?: number; b?: number; l?: number; r?: number };
  borderColor?: string;
  borderWidth?: number;
}
interface PTableCell {
  text: string;
  rowSpan?: number;
  colSpan?: number;
  vMerge?: number;
  hMerge?: number;
  fillColor?: string;
  fontColor?: string;
  fontBold?: boolean;
  vAlign?: string;
  borders?: Record<string, { borderColor: string; borderWidth: number; borderType: string } | undefined>;
}
interface PTable extends PBase {
  type: "table";
  data: PTableCell[][];
  rowHeights: number[];
  colWidths: number[];
  borders?: PTableCell["borders"];
}
interface PGroup extends PBase {
  type: "group";
  elements: PElement[];
}
interface PDiagram extends PBase {
  type: "diagram";
  elements: PElement[];
}
interface PMath extends PBase {
  type: "math";
  picBase64?: string;
  latex?: string;
  text?: string;
}
interface POther extends PBase {
  type: "chart" | "video" | "audio";
}
type PElement = PShape | PImage | PTable | PGroup | PDiagram | PMath | POther;

interface PSlide {
  fill?: PFill;
  elements: PElement[];
  layoutElements?: PElement[];
  note?: string;
}
interface PDeck {
  slides: PSlide[];
  size: { width: number; height: number };
  usedFonts?: string[];
}

/* ------------------------------------------------------------- helpers --- */
/** pptxtojson reports pt; the DOM works in CSS px (96 / 72) */
const PX = 96 / 72;
const px = (pt: number | undefined) => `${((pt ?? 0) * PX).toFixed(2)}px`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Inline-styled HTML from the parser → same HTML minus anything executable. */
function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";
  root.querySelectorAll("script,iframe,object,embed,link,meta").forEach((n) => n.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || ((n === "href" || n === "src") && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  return root.innerHTML;
}

function gradientCss(g: PFillGradient["value"]): string {
  const stops = g.colors.map((c) => `${c.color} ${c.pos}`).join(", ");
  if (g.path === "line") return `linear-gradient(${(g.rot ?? 0) + 90}deg, ${stops})`;
  return `radial-gradient(circle at center, ${stops})`;
}

function fillCss(fill: PFill): string {
  if (!fill) return "";
  switch (fill.type) {
    case "color":
      return `background-color:${fill.value};`;
    case "gradient":
      return `background-image:${gradientCss(fill.value)};`;
    case "image": {
      const src = fill.value.base64 || fill.value.blob;
      if (!src) return "";
      const op = fill.value.opacity != null ? `opacity:${fill.value.opacity};` : "";
      return `background-image:url("${src}");background-size:cover;background-position:center;${op}`;
    }
    case "pattern":
      return `background-color:${fill.value.backgroundColor};background-image:repeating-linear-gradient(45deg,${fill.value.foregroundColor} 0 1px,transparent 1px 4px);`;
    default:
      return "";
  }
}

function transformCss(el: PBase): string {
  const parts: string[] = [];
  if (el.rotate) parts.push(`rotate(${el.rotate}deg)`);
  if (el.isFlipH) parts.push("scaleX(-1)");
  if (el.isFlipV) parts.push("scaleY(-1)");
  return parts.length ? `transform:${parts.join(" ")};transform-origin:center;` : "";
}

function boxStyle(el: PBase, extra = ""): string {
  return `position:absolute;left:${px(el.left)};top:${px(el.top)};width:${px(el.width)};height:${px(el.height)};box-sizing:border-box;${transformCss(el)}${extra}`;
}

const V_ALIGN: Record<string, string> = { up: "flex-start", top: "flex-start", mid: "center", ctr: "center", down: "flex-end", bottom: "flex-end" };

function renderShape(el: PShape): string {
  const bw = el.borderWidth ?? 0;
  const hasStroke = bw > 0 && !!el.borderColor;
  const hasFill = !!el.fill && el.fill.type !== undefined;
  const isPlainRect = !el.path || /^M 0 0 L [\d.]+ 0 L [\d.]+ [\d.]+ L 0 [\d.]+ Z$/.test(el.path.trim());

  let geometry = "";
  if (isPlainRect) {
    const border = hasStroke
      ? `border:${px(bw)} ${el.borderType === "dashed" ? "dashed" : el.borderType === "dotted" ? "dotted" : "solid"} ${el.borderColor};`
      : "";
    const shadow = el.shadow ? `box-shadow:${px(el.shadow.h)} ${px(el.shadow.v)} ${px(el.shadow.blur)} ${el.shadow.color};` : "";
    geometry = `<div style="position:absolute;inset:0;${fillCss(el.strokeOnly ? null : el.fill)}${border}${shadow}"></div>`;
  } else {
    const vb = el.pathViewBox ?? { x: 0, y: 0, width: el.width, height: el.height };
    let fillAttr = "none";
    let defs = "";
    if (!el.strokeOnly && el.fill?.type === "color") fillAttr = el.fill.value;
    else if (!el.strokeOnly && el.fill?.type === "gradient") {
      const id = `g${Math.random().toString(36).slice(2, 8)}`;
      const stops = el.fill.value.colors.map((c) => `<stop offset="${c.pos}" stop-color="${c.color}"/>`).join("");
      defs =
        el.fill.value.path === "line"
          ? `<defs><linearGradient id="${id}" gradientTransform="rotate(${el.fill.value.rot ?? 0} .5 .5)">${stops}</linearGradient></defs>`
          : `<defs><radialGradient id="${id}">${stops}</radialGradient></defs>`;
      fillAttr = `url(#${id})`;
    } else if (!el.strokeOnly && el.fill?.type === "pattern") fillAttr = el.fill.value.foregroundColor;
    const dash = el.borderStrokeDasharray && el.borderStrokeDasharray !== "0" ? ` stroke-dasharray="${el.borderStrokeDasharray}"` : "";
    geometry = `<svg style="position:absolute;inset:0;overflow:visible" width="100%" height="100%" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" preserveAspectRatio="none">${defs}<path d="${esc(el.path!)}" fill="${fillAttr}" stroke="${hasStroke ? el.borderColor : "none"}" stroke-width="${bw}" vector-effect="non-scaling-stroke"${dash}/></svg>`;
    // an image fill on a custom path: clip a picture with the same path
    if (!el.strokeOnly && el.fill?.type === "image") {
      const src = el.fill.value.base64 || el.fill.value.blob;
      if (src) geometry = `<div style="position:absolute;inset:0;${fillCss(el.fill)}clip-path:path('${esc(el.path!)}')"></div>` + geometry;
    }
  }
  void hasFill;

  let text = "";
  if (el.content && /[^\s]/.test(el.content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, ""))) {
    const ins = el.textInset ?? { l: 7.2, t: 3.6, r: 7.2, b: 3.6 };
    const vAlign = V_ALIGN[el.vAlign ?? "up"] ?? "flex-start";
    const vertical = el.isVertical ? "writing-mode:vertical-rl;" : "";
    text = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:${vAlign};padding:${px(ins.t)} ${px(ins.r)} ${px(ins.b)} ${px(ins.l)};overflow:hidden;line-height:1.2;word-wrap:break-word;${vertical}">${sanitizeHtml(el.content)}</div>`;
  }
  return `<div style="${boxStyle(el)}">${geometry}${text}</div>`;
}

function renderImage(el: PImage): string {
  const src = el.base64 || el.blob;
  if (!src) return "";
  const r = el.rect;
  // srcRect crop percentages → oversize the img and shift it inside a clipped box
  let img = `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block" alt="">`;
  if (r && (r.l || r.r || r.t || r.b)) {
    const l = (r.l ?? 0) / 100, rr = (r.r ?? 0) / 100, t = (r.t ?? 0) / 100, b = (r.b ?? 0) / 100;
    const w = 100 / Math.max(0.01, 1 - l - rr);
    const h = 100 / Math.max(0.01, 1 - t - b);
    img = `<img src="${src}" style="position:absolute;left:${(-l * w).toFixed(3)}%;top:${(-t * h).toFixed(3)}%;width:${w.toFixed(3)}%;height:${h.toFixed(3)}%;display:block" alt="">`;
  }
  const border = el.borderWidth && el.borderColor ? `border:${px(el.borderWidth)} solid ${el.borderColor};` : "";
  return `<div style="${boxStyle(el, `overflow:hidden;${border}`)}">${img}</div>`;
}

function renderTable(el: PTable): string {
  const cols = el.colWidths?.length ? el.colWidths : [];
  const colgroup = cols.length ? `<colgroup>${cols.map((w) => `<col style="width:${px(w)}">`).join("")}</colgroup>` : "";
  const rows = (el.data ?? [])
    .map((row, ri) => {
      const h = el.rowHeights?.[ri];
      const cells = row
        .map((c) => {
          if (c.hMerge || c.vMerge) return "";
          const b = c.borders ?? el.borders ?? {};
          const side = (k: string) => {
            const s = b[k];
            return s && s.borderWidth ? `border-${k}:${px(s.borderWidth)} ${s.borderType === "dashed" ? "dashed" : "solid"} ${s.borderColor};` : `border-${k}:1px solid rgba(0,0,0,.15);`;
          };
          const style =
            `padding:${px(3.6)} ${px(7.2)};vertical-align:${c.vAlign === "mid" ? "middle" : c.vAlign === "down" ? "bottom" : "top"};` +
            (c.fillColor ? `background:${c.fillColor};` : "") +
            (c.fontColor ? `color:${c.fontColor};` : "") +
            (c.fontBold ? "font-weight:bold;" : "") +
            side("top") + side("right") + side("bottom") + side("left");
          const span = `${c.rowSpan && c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : ""}${c.colSpan && c.colSpan > 1 ? ` colspan="${c.colSpan}"` : ""}`;
          return `<td${span} style="${style}">${sanitizeHtml(c.text ?? "")}</td>`;
        })
        .join("");
      return `<tr${h ? ` style="height:${px(h)}"` : ""}>${cells}</tr>`;
    })
    .join("");
  return `<div style="${boxStyle(el)}"><table style="border-collapse:collapse;table-layout:fixed;width:100%;height:100%;font-size:14pt">${colgroup}${rows}</table></div>`;
}

function renderMath(el: PMath): string {
  if (el.picBase64) return `<div style="${boxStyle(el)}"><img src="${el.picBase64}" style="width:100%;height:100%;object-fit:contain" alt=""></div>`;
  const t = el.text || el.latex || "";
  return t ? `<div style="${boxStyle(el, "display:flex;align-items:center;font-size:18pt")}">${esc(t)}</div>` : "";
}

function renderPlaceholder(el: POther): string {
  const label = el.type === "chart" ? "Chart" : el.type === "video" ? "Video" : "Audio";
  return `<div style="${boxStyle(el, "display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,.12);border:1px dashed rgba(127,127,127,.5);color:rgba(90,90,90,.8);font:12pt system-ui,sans-serif")}">${label}</div>`;
}

function renderElement(el: PElement): string {
  switch (el.type) {
    case "shape":
    case "text":
      return renderShape(el);
    case "image":
      return renderImage(el);
    case "table":
      return renderTable(el);
    case "math":
      return renderMath(el);
    case "group":
    case "diagram":
      return `<div style="${boxStyle(el)}">${renderElements(el.elements ?? [])}</div>`;
    case "chart":
    case "video":
    case "audio":
      return renderPlaceholder(el);
    default:
      return "";
  }
}

function renderElements(list: PElement[]): string {
  return [...list]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(renderElement)
    .join("");
}

/** Builds the DOM for one slide at its native CSS-pixel size. */
export function buildSlideHtml(slide: PSlide, size: PDeck["size"]): string {
  const bg = slide.fill ? fillCss(slide.fill) : "background:#ffffff;";
  return (
    // browsers give <p> a 1em margin; PowerPoint paragraphs have none
    `<style>.pptx-page p{margin:0;padding:0}.pptx-page ul,.pptx-page ol{margin:0;padding-left:1.2em}.pptx-page table td{overflow:hidden}</style>` +
    `<div class="pptx-page" style="position:relative;width:${px(size.width)};height:${px(size.height)};overflow:hidden;background:#fff;font-family:Calibri,'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif;color:#000;">` +
    `<div style="position:absolute;inset:0;${bg}"></div>` +
    renderElements(slide.layoutElements ?? []) +
    renderElements(slide.elements ?? []) +
    `</div>`
  );
}

/* ---------------------------------------------------------- rasterise --- */
let fontCss: string | null = null;
async function embedCss(node: HTMLElement): Promise<string> {
  if (fontCss !== null) return fontCss;
  try {
    fontCss = await getFontEmbedCSS(node);
  } catch {
    fontCss = "";
  }
  return fontCss;
}

async function waitImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (im) =>
        im.complete ||
        new Promise<void>((ok) => {
          im.onload = () => ok();
          im.onerror = () => ok();
        }),
    ),
  );
}

async function rasterise(slide: PSlide, size: PDeck["size"], maxSide: number, quality: number, mime: string): Promise<PdfPageRender> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;opacity:1;z-index:-1;";
  host.innerHTML = buildSlideHtml(slide, size);
  document.body.appendChild(host);
  const node = host.querySelector<HTMLElement>(".pptx-page")!;
  try {
    await waitImages(node);
    if (document.fonts?.ready) await document.fonts.ready;
    const wpx = size.width * PX;
    const hpx = size.height * PX;
    const pixelRatio = Math.max(0.1, maxSide / Math.max(wpx, hpx));
    const css = await embedCss(node);
    const opts = { pixelRatio, width: wpx, height: hpx, backgroundColor: "#ffffff", fontEmbedCSS: css, cacheBust: false } as const;
    let png: string;
    try {
      png = await toPng(node, opts);
    } catch {
      png = await toPng(node, { ...opts, fontEmbedCSS: "", skipFonts: true });
    }
    // re-encode to JPEG (much smaller for storage) via a canvas
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error("Could not decode rendered slide"));
      img.src = png;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth);
    canvas.height = Math.max(1, img.naturalHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return { src: canvas.toDataURL(mime, quality), ratio: canvas.width / canvas.height, width: canvas.width, height: canvas.height };
  } finally {
    host.remove();
  }
}

/* --------------------------------------------------------------- open --- */
let libPromise: Promise<{ parse: (buf: ArrayBuffer, o?: { imageMode?: string }) => Promise<PDeck> }> | null = null;
function lib() {
  if (!libPromise) {
    libPromise = import("pptxtojson").then((m) => m as unknown as { parse: (buf: ArrayBuffer, o?: { imageMode?: string }) => Promise<PDeck> });
  }
  return libPromise;
}

/**
 * Opens a .pptx and exposes it through the same contract as `openPdf`, so the
 * import dialog can show thumbnails and render the chosen slides.
 */
export async function openPptx(file: File): Promise<OpenedPdf> {
  const { parse } = await lib();
  const buf = await file.arrayBuffer();
  let deck: PDeck;
  try {
    deck = await parse(buf, { imageMode: "base64" });
  } catch (e) {
    throw new Error(`Could not read that PowerPoint file${e instanceof Error && e.message ? ` (${e.message})` : ""}.`);
  }
  if (!deck?.slides?.length) throw new Error("That PowerPoint file has no slides.");
  const size = deck.size?.width && deck.size?.height ? deck.size : { width: 720, height: 405 };
  const thumbs = new Map<number, Promise<PdfPageRender>>();
  const ratio = size.width / size.height;
  return {
    name: file.name,
    numPages: deck.slides.length,
    pageRatio: async () => ratio,
    thumbnail: (n, maxSide = 220) => {
      let t = thumbs.get(n);
      if (!t) {
        t = rasterise(deck.slides[n - 1], size, maxSide * 2, 0.8, "image/jpeg");
        thumbs.set(n, t);
      }
      return t;
    },
    render: (n, maxSide = 2000) => rasterise(deck.slides[n - 1], size, maxSide, 0.9, "image/jpeg"),
    destroy: () => {
      thumbs.clear();
    },
  };
}
