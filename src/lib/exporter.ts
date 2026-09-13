import { getFontEmbedCSS, toPng } from "html-to-image";
import JSZip from "jszip";
import { SLIDE_H, SLIDE_W } from "../components/Slide";

/**
 * Rasterises slides for PNG / ZIP / PDF export.
 *
 * Web fonts must be inlined into the SVG foreignObject or non-Latin text
 * silently falls back to a system font (Bangla/Arabic would break). We compute
 * that embed CSS **once** and reuse it for every slide: far faster than letting
 * html-to-image refetch Google Fonts per capture, and much more reliable.
 */

let fontCss: string | null = null;

async function ensureFontCss(node: HTMLElement): Promise<string> {
  if (fontCss !== null) return fontCss;
  try {
    fontCss = await getFontEmbedCSS(node);
  } catch {
    fontCss = ""; // CORS blocked a stylesheet — fall back to system rendering
  }
  return fontCss;
}

async function capture(node: HTMLElement, pixelRatio: number, embedCss?: string): Promise<string> {
  const opts = {
    pixelRatio,
    width: SLIDE_W,
    height: SLIDE_H,
    backgroundColor: "#000000",
    style: { transform: "none", margin: "0", left: "0", top: "0", position: "static" },
    ...(embedCss ? { fontEmbedCSS: embedCss } : {}),
  } as const;
  try {
    return await toPng(node, opts);
  } catch {
    // last resort: render without embedded fonts rather than failing the export
    return await toPng(node, { ...opts, fontEmbedCSS: "", skipFonts: true });
  }
}

/** Waits for fonts, inlines them and primes the renderer cache. */
export async function warmup(node?: HTMLElement | null) {
  if (document.fonts?.ready) await document.fonts.ready;
  if (!node) return;
  const css = await ensureFontCss(node);
  await capture(node, 1, css);
}

/** Single high-resolution capture (assumes warmup already ran). */
export async function captureSlide(node: HTMLElement, pixelRatio = 2): Promise<string> {
  return capture(node, pixelRatio, fontCss ?? undefined);
}

export async function slideToPng(node: HTMLElement, pixelRatio = 2): Promise<string> {
  await warmup(node);
  return captureSlide(node, pixelRatio);
}

/** Forces the next export to re-inline fonts (after a lazy font loads). */
export function resetFontCache() {
  fontCss = null;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function safeName(text: string, fallback: string) {
  const t = (text || "").replace(/[\\/:*?"<>|]+/g, "").trim();
  return t ? t.slice(0, 40) : fallback;
}

export async function exportZip(
  items: { node: HTMLElement; name: string }[],
  onProgress?: (done: number, total: number) => void,
  pixelRatio = 2,
) {
  const zip = new JSZip();
  await warmup(items[0]?.node);
  for (let i = 0; i < items.length; i++) {
    const dataUrl = await captureSlide(items[i].node, pixelRatio);
    zip.file(items[i].name, dataUrl.split(",")[1], { base64: true });
    onProgress?.(i + 1, items.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, "mcq-slides.zip");
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
