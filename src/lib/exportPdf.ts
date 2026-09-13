import { SLIDE_H, SLIDE_W } from "../components/Slide";
import { captureSlide, warmup } from "./exporter";

export interface PdfOptions {
  /** 2 = crisp on screen and in print, 3 = large file */
  quality: number;
  fileName: string;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Builds a real multi-page PDF (one 16:9 page per slide) instead of relying on
 * the browser print dialog. Each page is a high-resolution render of the slide,
 * so Bangla shaping and KaTeX layout are pixel-identical to the editor.
 */
export async function exportPdf(
  items: { node: HTMLElement }[],
  { quality = 2, fileName = "mcq-slides.pdf", onProgress }: Partial<PdfOptions> = {},
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [SLIDE_W, SLIDE_H],
    compress: true,
  });

  await warmup(items[0]?.node);

  for (let i = 0; i < items.length; i++) {
    const dataUrl = await captureSlide(items[i].node, quality);
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], "landscape");
    doc.addImage(dataUrl, "PNG", 0, 0, SLIDE_W, SLIDE_H, `s${i}`, "FAST");
    onProgress?.(i + 1, items.length);
  }

  doc.save(fileName);
}
