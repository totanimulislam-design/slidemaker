import type { Gradient } from "./types";

/**
 * User-drawn overlays: shapes and free text boxes.
 *
 * Coordinates are percentages of the board (same as free-mode layout), so an
 * item keeps its place at any zoom, in thumbnails and in PDF/PNG exports.
 */

export type ShapeKind =
  | "rect"
  | "rounded"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "image";

export interface ShapeItem {
  id: string;
  kind: ShapeKind;
  /** user-given layer name (Layers panel); empty = derive it from the content */
  name?: string;
  /** left / top edge in % of the board */
  x: number;
  y: number;
  /** size in % of the board */
  w: number;
  h: number;
  rot: number;
  z: number;
  /** fill colour, "" = none */
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  dash: boolean;
  /** text shown inside the shape / text box (supports $math$) */
  text: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  locked?: boolean;
  /**
   * Layer visibility (Layers panel 👁). A hidden item keeps its slot in the
   * stack and stays listed, but is not painted on the board or in exports.
   */
  hidden?: boolean;
  /** render beneath the slide's question/options/title (backdrops, highlights) */
  behind?: boolean;
  /**
   * Group tag: shapes sharing a groupId move / resize / rotate as one unit.
   * Members keep their own geometry and style, so ungrouping is lossless and
   * every member stays individually selectable and editable.
   */
  groupId?: string;

  /* ----------------------------- design ------------------------------ */
  /** gradient fill (overrides `fill` when enabled) */
  gradient?: Gradient;
  /** gradient text (text boxes / labels) */
  textGradient?: Gradient;
  /** drop shadow */
  shadow2?: { enabled: boolean; color: string; blur: number; x: number; y: number; opacity: number };
  /** outer glow */
  glow?: { enabled: boolean; color: string; size: number; opacity: number };
  /** whole-item opacity 0–1 */
  itemOpacity?: number;
  /** corner radius override for rect/rounded/text, px */
  cornerRadius?: number;
  /** outline style */
  lineStyle?: "solid" | "dashed" | "dotted" | "double";
  /** outline sits inside/centre/outside — visual only via padding */
  lineJoin?: "round" | "miter";
  /** CSS mix-blend-mode */
  blend?: "normal" | "multiply" | "screen" | "overlay" | "soft-light" | "difference";
  /** text letter-spacing (px) and line-height */
  letterSpacing?: number;
  lineHeight?: number;
  /** text outline (stroke) */
  textStroke?: { enabled: boolean; color: string; width: number };
  /** text shadow */
  textShadow?: boolean;
  /** uppercase */
  uppercase?: boolean;
  /** inner padding for text boxes, px */
  padding?: number;
  /** font family override for this item's text (single family name) */
  fontFamily?: string;
  underline?: boolean;
  strikethrough?: boolean;

  /* ---------------------------- image only ---------------------------- */
  /** data-URL or http(s) URL */
  src?: string;
  /** natural aspect ratio (w / h) captured at insert time */
  naturalRatio?: number;
  /**
   * This picture is a page of an imported PDF / PowerPoint. It is kept out of
   * the Uploads library: the document itself is what is saved there, and its
   * page preview is how the page comes back.
   */
  importedPage?: boolean;
  /** how the bitmap fills its box */
  fit?: "contain" | "cover" | "fill";
  /** 0–1 */
  opacity?: number;
  /** corner radius in % of the shorter side (0 = square, 50 = circle) */
  radius?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** clip mask applied to the image */
  mask?: "none" | "circle" | "rounded" | "diamond" | "triangle" | "star";
  /** shadow behind the image */
  shadow?: boolean;
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  image: "Image",
  text: "Text box",
  rect: "Rectangle",
  rounded: "Rounded box",
  ellipse: "Circle / Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  line: "Line",
  arrow: "Arrow",
};

export const SHAPE_ICONS: Record<ShapeKind, string> = {
  image: "🖼",
  text: "T",
  rect: "▭",
  rounded: "▢",
  ellipse: "◯",
  triangle: "△",
  diamond: "◇",
  star: "☆",
  line: "─",
  arrow: "→",
};

let n = 0;
export const shapeId = () => `sh${Date.now().toString(36)}${(n++).toString(36)}`;

export function makeShape(kind: ShapeKind, accent = "#2f4fff", z = 10): ShapeItem {
  const base: ShapeItem = {
    id: shapeId(),
    kind,
    x: 35,
    y: 40,
    w: 30,
    h: 20,
    rot: 0,
    z,
    fill: kind === "text" || kind === "line" || kind === "arrow" ? "" : accent,
    fillOpacity: kind === "rect" || kind === "rounded" ? 0.25 : 1,
    stroke: kind === "text" ? "" : accent === "" ? "#ffffff" : accent,
    strokeWidth: 3,
    dash: false,
    text: kind === "text" ? "নতুন টেক্সট / New text" : "",
    textColor: "#ffffff",
    fontSize: 28,
    bold: kind === "text",
    italic: false,
    align: "center",
    valign: "middle",
  };
  if (kind === "line" || kind === "arrow") return { ...base, h: 0.5, w: 30, strokeWidth: 4, stroke: "#ffd633" };
  if (kind === "ellipse") return { ...base, w: 16, h: 28, fill: "", fillOpacity: 1 };
  if (kind === "text") return { ...base, w: 36, h: 12, align: "left" };
  if (kind === "star") return { ...base, w: 12, h: 21, fill: "#ffd633", stroke: "#ffd633" };
  if (kind === "image")
    return {
      ...base,
      w: 30,
      h: 30,
      fill: "",
      stroke: "",
      strokeWidth: 0,
      text: "",
      fit: "contain",
      opacity: 1,
      radius: 0,
      mask: "none",
      shadow: false,
    };
  return base;
}

/** Board is 16:9 — converts a pixel ratio into equal *visual* w/h percentages. */
export const BOARD_RATIO = 16 / 9;

/** Builds an image shape sized to its natural ratio, no larger than `maxW` % of the board. */
export function makeImageShape(src: string, naturalRatio: number, maxW = 40, z = 10): ShapeItem {
  const item = makeShape("image", "", z);
  // percentages are of different axes, so correct for the board ratio
  let w = maxW;
  let h = (w / naturalRatio) * BOARD_RATIO;
  if (h > 70) {
    h = 70;
    w = (h * naturalRatio) / BOARD_RATIO;
  }
  return { ...item, src, naturalRatio, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, x: Math.round((100 - w) / 2), y: Math.round((100 - h) / 2) };
}

/** Reads a File/Blob into a data URL plus its natural aspect ratio. */
export function loadImageFile(file: Blob): Promise<{ src: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const src = String(reader.result);
      probeImage(src).then((ratio) => resolve({ src, ratio })).catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

/** Resolves the natural aspect ratio of any image source. */
export function probeImage(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

/**
 * Fetches a remote image and converts it to a data URL so exports (PNG/PDF)
 * don't hit CORS. Falls back to the original URL when the host blocks fetch.
 */
export async function inlineRemoteImage(url: string): Promise<{ src: string; ratio: number }> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    return await loadImageFile(blob);
  } catch {
    const ratio = await probeImage(url);
    return { src: url, ratio };
  }
}

/** Downscales very large uploads so the deck stays light in localStorage. */
export async function shrinkDataUrl(src: string, maxSide = 1920, quality = 0.88): Promise<string> {
  if (!src.startsWith("data:image/") || src.startsWith("data:image/svg")) return src;
  const img = new Image();
  await new Promise<void>((ok, bad) => {
    img.onload = () => ok();
    img.onerror = () => bad(new Error("decode failed"));
    img.src = src;
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && src.length < 1_500_000) return src;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const hasAlpha = /png|webp|gif/.test(src.slice(0, 30));
  return hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
}

/* ------------------------------------------------ polygon point helpers */

export function polygonPoints(kind: ShapeKind): string | null {
  switch (kind) {
    case "triangle":
      return "50,0 100,100 0,100";
    case "diamond":
      return "50,0 100,50 50,100 0,50";
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 50 : 20;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
      }
      return pts.join(" ");
    }
    default:
      return null;
  }
}
