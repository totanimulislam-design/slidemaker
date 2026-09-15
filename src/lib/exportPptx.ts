import type PptxGenJSType from "pptxgenjs";
import { SLIDE_W, SLIDE_H } from "../components/Slide";
import type { Box, Deck, ElementId, SlideData } from "./types";
import { mixedToRuns, type TextRun } from "./latexRuns";
import { flatten, shade, withAlpha } from "./color";
import { isRtlText } from "./fonts";
import { boxStack, deckStack, optionTextStack, boxTypeface } from "./boxFonts";
import type { ShapeItem } from "./shapes";
import { sortedLayers } from "./layers";
import { DEFAULT_BANNER, type Gradient } from "./types";
import { effectiveBackground } from "./background";
import { effectiveHeader, effectiveTheme } from "./overrides";
import { isWideNumberStyle, pptxGeometry, type NumberStyle } from "./numberStyles";
import { optionBadgeStyle } from "./optionStyles";
import type { OptionStyle } from "./optionStyles";
import { formatOptionKey, isMinimalOptionBulletShape, type OptionBulletShape } from "./optionBulletShapes";
import { effectiveOptionLabel } from "./plainNumbering";
import { optionBulletBackdrop, optionBulletPalette } from "./optionBulletColors";

/**
 * Editable PowerPoint export.
 *
 * Every element is a *native* PPTX object — rectangles for the board, ovals for
 * the option bullets and real text boxes for the question/answers — so the deck
 * can be re-typed, restyled and re-animated inside PowerPoint. Equations are
 * translated into characters plus PowerPoint superscript/subscript flags rather
 * than being flattened into pictures.
 */

const PX = 96; // 1280×720 px  →  13.333×7.5 in

/**
 * pptxgenjs can only write solid fills. To get REAL PowerPoint gradients we
 * emit a unique marker colour per gradient, then after the file is generated
 * we replace that <a:solidFill> with a proper <a:gradFill> inside the zip.
 */
interface GradSpec {
  marker: string; // 6-hex marker colour
  type: "linear" | "radial";
  angle: number;
  transparency: number;
  stops: { color: string; position: number; transparency?: number }[];
}
const gradRegistry: GradSpec[] = [];
let gradSeq = 0;
function registerGradient(g: Gradient, transparency: number, stopTransparency?: number[]): string {
  // very unlikely colours: F0F1xx .. keep to 6 hex digits
  const marker = `F0F1${(gradSeq++ % 256).toString(16).toUpperCase().padStart(2, "0")}`;
  gradRegistry.push({
    marker,
    type: g.type,
    angle: g.angle,
    transparency,
    stops: [...g.stops]
      .sort((a, b) => a.at - b.at)
      .map((st, i) => ({ color: hex(st.color), position: st.at, transparency: stopTransparency?.[i] })),
  });
  return marker;
}
function gradFillXml(g: GradSpec): string {
  const gs = g.stops
    .map((st) => {
      const tr = st.transparency ?? g.transparency;
      const alpha = tr ? `<a:alpha val="${Math.round((100 - tr) * 1000)}"/>` : "";
      return `<a:gs pos="${Math.round(st.position * 1000)}"><a:srgbClr val="${st.color}">${alpha}</a:srgbClr></a:gs>`;
    })
    .join("");
  const dir =
    g.type === "radial"
      ? `<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>`
      : `<a:lin ang="${Math.round((((g.angle - 90) % 360) + 360) % 360) * 60000}" scaled="0"/>`;
  return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst>${dir}</a:gradFill>`;
}
function injectGradients(xml: string): string {
  let out = xml;
  for (const g of gradRegistry) {
    // pptxgenjs writes either <a:srgbClr val="M"/> or <a:srgbClr val="M"><a:alpha …/></a:srgbClr>
    const re = new RegExp(
      `<a:solidFill><a:srgbClr val="${g.marker}"(?:/>|>(?:<a:alpha[^>]*/>)?</a:srgbClr>)</a:solidFill>`,
      "g",
    );
    out = out.replace(re, gradFillXml(g));
  }
  return out;
}
const inch = (px: number) => Number((px / PX).toFixed(4));
const hex = (c: string) => c.replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6);

/** CSS font stack → the first concrete family name PowerPoint can resolve */
export function firstFamily(stack: string, fallback: string): string {
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || fallback;
}

function toPptxRuns(text: string, base: PptxGenJSType.TextPropsOptions): PptxGenJSType.TextProps[] {
  const runs: TextRun[] = mixedToRuns(text);
  return runs.map((r) => ({
    text: r.text,
    options: {
      ...base,
      ...(r.sup ? { superscript: true } : {}),
      ...(r.sub ? { subscript: true } : {}),
    },
  }));
}

export interface PptxOptions {
  /** font used for Bangla/latin body text inside PowerPoint */
  bodyFont: string;
  /** font used for the brand + badge (condensed display face) */
  displayFont: string;
  /** add a second slide per question with the answer highlighted */
  answerSlides: boolean;
  /** put the correct answer in PowerPoint's speaker notes */
  speakerNotes: boolean;
  fileName: string;
}

export const DEFAULT_PPTX_OPTIONS: PptxOptions = {
  bodyFont: "Nirmala UI",
  displayFont: "Arial Narrow",
  answerSlides: false,
  speakerNotes: true,
  fileName: "mcq-slides.pptx",
};

function buildSlide(
  pptx: PptxGenJSType,
  deck: Deck,
  slide: SlideData,
  reveal: boolean,
  opts: PptxOptions,
) {
  const t = effectiveTheme(deck, slide);
  const h = effectiveHeader(deck, slide);
  const s = pptx.addSlide();
  s.background = { color: hex(t.frameOuter) };

  /* ------------------------------- frame ------------------------------- */
  const frame = t.frame ?? {
    style: "wood", color: t.frameInner, width: 26, radius: 14, shadow: true,
    gradient: { enabled: false, angle: 155, from: "#f2c98a", to: "#a86a24" },
  };
  const frameOn = t.showFrame && frame.style !== "none";
  const frameThickness = frame.style === "thin" ? 8 : frame.style === "neon" ? 10 : frame.width;
  if (frameOn) {
    const frameColor =
      frame.style === "solid" || frame.style === "neon" || frame.style === "thin" || frame.style === "double"
        ? frame.color
        : frame.color; // wood auto-shades on screen; PPTX uses the base colour
    const isNeon = frame.style === "neon" || frame.style === "neonMagenta" || frame.style === "neonGreen";
    const neonGlowColor =
      frame.style === "neonMagenta" ? "#f43f5e" : frame.style === "neonGreen" ? "#22c55e" : frame.color;
    const isDashed = frame.style === "dashed";
    const isDotted = frame.style === "dotted" || frame.style === "chalk";
    const isDouble = frame.style === "double" || frame.style === "triple" || frame.style === "baroque";

    if (frame.style === "gradient" && frame.gradient?.enabled) {
      s.addShape(pptx.ShapeType.rect, {
        x: inch(frameThickness / 2), y: inch(frameThickness / 2), w: inch(SLIDE_W - frameThickness), h: inch(SLIDE_H - frameThickness),
        fill: { color: registerGradient({ enabled: true, type: "linear", angle: frame.gradient.angle, stops: [{ color: frame.gradient.from, at: 0 }, { color: frame.gradient.to, at: 100 }] }, 0) },
        line: { type: "none" },
        rectRadius: frame.radius / 96 / 4,
      });
    } else if (frame.style === "gold" || frame.style === "silver" || frame.style === "bronze" || frame.style === "copper") {
      const stops =
        frame.style === "gold" ? [{ color: "#ffe082", at: 0 }, { color: "#e6b800", at: 50 }, { color: "#8c6b00", at: 100 }]
        : frame.style === "silver" ? [{ color: "#ffffff", at: 0 }, { color: "#9ca3af", at: 50 }, { color: "#4b5563", at: 100 }]
        : frame.style === "copper" ? [{ color: "#fce7f3", at: 0 }, { color: "#fb7185", at: 50 }, { color: "#9f1239", at: 100 }]
        : [{ color: "#e6ab73", at: 0 }, { color: "#9c5c23", at: 50 }, { color: "#4a2806", at: 100 }];
      s.addShape(pptx.ShapeType.rect, {
        x: inch(frameThickness / 2), y: inch(frameThickness / 2), w: inch(SLIDE_W - frameThickness), h: inch(SLIDE_H - frameThickness),
        fill: { color: registerGradient({ enabled: true, type: "linear", angle: 135, stops }, 0) },
        line: { type: "none" },
        rectRadius: frame.radius / 96 / 4,
        shadow: frame.shadow ? { type: "outer", blur: 8, offset: 0, angle: 0, color: "000000", opacity: 0.4 } : undefined,
      });
    } else {
      s.addShape(pptx.ShapeType.rect, {
        x: inch(frameThickness / 2), y: inch(frameThickness / 2), w: inch(SLIDE_W - frameThickness), h: inch(SLIDE_H - frameThickness),
        fill: { color: hex(frameColor) },
        line:
          isDouble
            ? { color: hex(shade(frame.color, 0.4)), width: 2, dashType: "solid" }
            : isDashed
              ? { color: hex(frame.color), width: 2, dashType: "dash" }
              : isDotted
                ? { color: hex(frame.color), width: 2, dashType: "sysDot" }
                : isNeon
                  ? { color: hex(shade(neonGlowColor, -0.2)), width: 2 }
                  : { type: "none" },
        rectRadius: frame.radius / 96 / 4,
        shadow:
          isNeon
            ? { type: "outer", blur: 14, offset: 0, angle: 0, color: hex(neonGlowColor), opacity: 0.7 }
            : frame.shadow
              ? { type: "outer", blur: 6, offset: 0, angle: 0, color: "000000", opacity: 0.4 }
              : undefined,
      });
    }
  }
  // If a custom frame image is active and in "fit" mode, offset the inner slide content so the frame never overlaps
  const hasFrameImage = !!frame.image;
  const isImageOverlayMode = frame.imagePlacement === "overlay";
  const imageInsetPct = hasFrameImage && !isImageOverlayMode ? (frame.imageInset ?? 10) : 0;
  const imageInsetX = Math.round((imageInsetPct / 100) * SLIDE_W);
  const imageInsetY = Math.round((imageInsetPct / 100) * SLIDE_H);

  const framePx = frameOn ? frameThickness : 0;
  const bx = hasFrameImage && !isImageOverlayMode ? imageInsetX : framePx;
  const by = hasFrameImage && !isImageOverlayMode ? imageInsetY : framePx;
  const bw = 1280 - bx * 2;
  const bh = 720 - by * 2;

  /**
   * Same alignment-fraction maths the on-screen slide uses:
   * left = x% of the *free* space, so 0 → flush left, 100 → flush right.
   */
  const place = (id: ElementId, elW: number, elH: number) => {
    const b: Box = t.layout[id];
    const w = (b.w / 100) * bw;
    const width = elW || w;
    const free = (b.mode ?? "align") === "free";
    const height = free && b.h ? (b.h / 100) * bh : elH;
    return {
      // free → x/y are the element's own edge; aligned → fraction of the free space
      x: inch(free ? bx + (b.x / 100) * bw : bx + (b.x / 100) * Math.max(0, bw - width)),
      y: inch(free ? by + (b.y / 100) * bh : by + (b.y / 100) * Math.max(0, bh - height)),
      w: inch(width),
      h: inch(height),
      align: b.align,
      boxW: w,
      rotate: b.rot || 0,
    };
  };
  s.addShape(pptx.ShapeType.rect, {
    x: inch(bx), y: inch(by), w: inch(bw), h: inch(bh),
    fill: { color: hex(t.board) },
    line: { type: "none" },
  });

  /* ----------------------------- background ----------------------------- */
  const bg = effectiveBackground(deck, slide);
  if (bg.gradient.enabled) {
    s.addShape(pptx.ShapeType.rect, {
      x: inch(bx), y: inch(by), w: inch(bw), h: inch(bh),
      fill: { color: registerGradient(bg.gradient, 0) }, line: { type: "none" },
    });
  }
  if (bg.src) {
    const img: PptxGenJSType.ImageProps = {
      x: inch(bx), y: inch(by), w: inch(bw), h: inch(bh),
      transparency: Math.round((1 - bg.opacity) * 100),
      flipH: bg.flipH || undefined,
      sizing: {
        type: bg.fit === "contain" ? "contain" : bg.fit === "stretch" ? "crop" : "cover",
        w: inch(bw), h: inch(bh),
      },
    };
    if (bg.src.startsWith("data:")) img.data = bg.src;
    else img.path = bg.src;
    try {
      s.addImage(img);
    } catch {
      /* unreadable source — keep the board colour */
    }
  }
  if (bg.overlay.enabled && bg.overlay.opacity > 0) {
    s.addShape(pptx.ShapeType.rect, {
      x: inch(bx), y: inch(by), w: inch(bw), h: inch(bh),
      fill: { color: hex(bg.overlay.color), transparency: Math.round((1 - bg.overlay.opacity) * 100) },
      line: { type: "none" },
    });
  }
  if (bg.vignette > 0) {
    // radial black that is fully transparent at the centre and darkens toward the edges
    s.addShape(pptx.ShapeType.rect, {
      x: inch(bx), y: inch(by), w: inch(bw), h: inch(bh),
      fill: {
        color: registerGradient(
          { enabled: true, type: "radial", angle: 0, stops: [{ color: "#000000", at: 0 }, { color: "#000000", at: 100 }] },
          0,
          [100, 100 - Math.round(bg.vignette * 0.85)],
        ),
      },
      line: { type: "none" },
    });
  }

  /* --------------------------------------------------------------------
   * Every element below is wrapped in an emitter so we can run them in the
   * unified layer order (slide elements interleaved with drawn shapes).
   * ------------------------------------------------------------------ */
  const emit: Record<string, () => void> = {};
  const face = (id: ElementId, fallback: string) => firstFamily(boxStack(t, id), fallback);
  /**
   * Deck face of a box, ignoring that box's own typeface override — used by the
   * option marker/plain numbering so the OPTION TEXT FONT stays on option text.
   */
  const baseFace = (id: ElementId, fallback: string) => firstFamily(deckStack(t, id), fallback);
  /** option text only: the same face the canvas puts on the option's text node */
  const optionFace = () => firstFamily(optionTextStack(t), opts.bodyFont);
  const tfBold = (id: ElementId, fallback = true) => {
    const w = boxTypeface(t, id).weight;
    return w ? w >= 600 : fallback;
  };
  const tfItalic = (id: ElementId) => !!boxTypeface(t, id).italic;

  /* ------------------------------- header ------------------------------ */
  emit["element:logo"] = () => {

  if (h.showLogo && h.logo) {
    const lb = t.layout.logo;
    const size = (lb.w / 100) * bw;
    const heightPx = (lb.mode ?? "align") === "free" && lb.h ? (lb.h / 100) * bh : size;
    const p = place("logo", size, heightPx);
    try {
      s.addImage({ data: h.logo, x: p.x, y: p.y, w: p.w, h: p.h, rotate: p.rotate });
    } catch {
      /* unsupported data url — skip the logo rather than fail the export */
    }
  }
  };

  emit["element:brand"] = () => {
  const brand = place("brand", 0, 68);
  s.addText(h.brandTop.toUpperCase(), {
    x: brand.x, y: brand.y, w: brand.w, h: inch(32),
    fontFace: face("brand", opts.displayFont), fontSize: 19, bold: tfBold("brand"), italic: tfItalic("brand"), color: hex(t.brandColor),
    align: brand.align, valign: "middle", margin: 0, rotate: brand.rotate,
  });
  s.addText(h.brandBottom.toUpperCase(), {
    x: brand.x, y: inch((brand.y as number) * PX + 32), w: brand.w, h: inch(34),
    fontFace: face("brand", opts.displayFont), fontSize: 20, bold: tfBold("brand"), italic: tfItalic("brand"), color: hex(t.brandColor),
    align: brand.align, valign: "middle", margin: 0, rotate: brand.rotate,
  });
  };

  emit["element:title"] = () => {
    const title = place("title", 0, 96);
    const b = { ...DEFAULT_BANNER, ...(t.banner ?? {}), color: t.banner?.color ?? t.titleBanner };

    /** PowerPoint fill: solid, or a marker colour that becomes a real gradient after write */
    const pptFill = (g: Gradient, solid: string, transparency = 0): PptxGenJSType.ShapeFillProps => {
      if (!g.enabled || g.stops.length < 2) return { color: hex(solid), transparency };
      return { color: registerGradient(g, transparency) };
    };

    if (h.showBanner && b.shape !== "none") {
      const padX = (b.padX / 100) * ((title.w as number) * PX);
      const padY = (b.padY / 100) * ((title.h as number) * PX) * 0.5;
      const bx0 = (title.x as number) * PX - padX;
      const by0 = (title.y as number) * PX - padY;
      const bw0 = (title.w as number) * PX + padX * 2;
      const bh0 = (title.h as number) * PX + padY * 2;
      const transparency = Math.round((1 - b.opacity) * 100);
      const line = b.border.enabled && b.shape !== "glow" && b.shape !== "underline"
        ? { color: hex(b.border.color), width: Math.max(0.5, b.border.width * 0.75) }
        : { type: "none" as const };

      // halo: a larger, mostly transparent ellipse underneath
      if (b.halo > 0) {
        const hx = bw0 * (b.halo / 100) * 0.35;
        const hy = bh0 * (b.halo / 100) * 0.6;
        s.addShape(pptx.ShapeType.ellipse, {
          x: inch(bx0 - hx), y: inch(by0 - hy), w: inch(bw0 + hx * 2), h: inch(bh0 + hy * 2),
          fill: { color: hex(b.gradient.enabled ? b.gradient.stops[0].color : b.color), transparency: 78 },
          line: { type: "none" }, rotate: title.rotate,
        });
      }

      const geom =
        b.shape === "glow" ? pptx.ShapeType.ellipse
        : b.shape === "pill" ? pptx.ShapeType.roundRect
        : b.shape === "rounded" ? pptx.ShapeType.roundRect
        : b.shape === "ribbon" ? pptx.ShapeType.chevron
        : b.shape === "underline" ? pptx.ShapeType.roundRect
        : pptx.ShapeType.rect;

      if (b.shape === "underline") {
        const th = Math.max(4, b.radius / 2);
        s.addShape(geom, {
          x: inch(bx0), y: inch(by0 + bh0 - th), w: inch(bw0), h: inch(th),
          fill: pptFill(b.gradient, b.color, transparency), line: { type: "none" }, rectRadius: 0.05, rotate: title.rotate,
        });
      } else if (b.shape === "glow") {
        // soft glow approximated with a semi-transparent ellipse (PowerPoint has no true radial fade via pptxgenjs)
        s.addShape(geom, {
          x: inch(bx0), y: inch(by0), w: inch(bw0), h: inch(bh0),
          fill: pptFill(b.gradient, b.color, Math.max(transparency, 10 + Math.round(b.glow * 0.25))),
          line: { type: "none" }, rotate: title.rotate,
        });
      } else {
        s.addShape(geom, {
          x: inch(bx0), y: inch(by0), w: inch(bw0), h: inch(bh0),
          fill: pptFill(b.gradient, b.color, transparency), line,
          rectRadius: b.shape === "pill" ? 0.5 : b.shape === "rounded" ? Math.min(0.5, b.radius / 100) : undefined,
          rotate: title.rotate,
        });
      }
    }

    const tg = b.textGradient;
    const titleColor = tg.enabled && tg.stops[0] ? tg.stops[0].color : t.titleColor;
    s.addText(h.title, {
      x: title.x, y: title.y, w: title.w, h: title.h,
      fontFace: face("title", opts.bodyFont), fontSize: 38, bold: tfBold("title"), italic: tfItalic("title"), color: hex(titleColor),
      align: title.align, valign: "middle", margin: 0, shrinkText: true, rotate: title.rotate,
      glow: b.textGlow > 0 ? { size: Math.round(2 + b.textGlow / 10), opacity: 0.45, color: hex(titleColor) } : undefined,
      shadow: b.textShadow ? { type: "outer", blur: 3, offset: 2, angle: 90, color: "000000", opacity: 0.55 } : undefined,
    });
  };

  emit["element:badge"] = () => {
  const badge = place("badge", 0, 50);
  s.addText((slide.badge?.trim() || h.badge).toUpperCase(), {
    x: badge.x, y: badge.y, w: badge.w, h: badge.h,
    fontFace: face("badge", opts.displayFont), fontSize: 27, bold: tfBold("badge"), italic: tfItalic("badge"), color: hex(t.badgeColor),
    align: badge.align, valign: "middle", margin: 0, rotate: badge.rotate,
  });
  };

  /* ------------------------------ question ----------------------------- */
  emit["element:question"] = () => {
  const qSize = Math.round(t.questionSize * slide.scale * 0.75);
  const qLines = Math.max(1, Math.ceil(slide.question.length / 46));
  const qH = Math.max(74, qLines * qSize * 1.7);
  const q = place("question", 0, qH);
  const qRtl = isRtlText(slide.question);
  const qPx = (q.x as number) * PX;
  const bullet = 54;

  if (t.showBullet) {
    const id = (t.numberStyle ?? "circle") as NumberStyle;
    const wide = isWideNumberStyle(id) ? 1.6 : 1;
    const bw0 = bullet * wide;
    const geo = pptxGeometry(id, { ShapeType: pptx.ShapeType as unknown as Record<string, string> });
    const cx = qRtl ? qPx + q.boxW - bw0 : qPx;
    const by0 = (q.y as number) * PX + 4;
    const accent = hex(t.accent);
    const opts2: PptxGenJSType.ShapeProps = {
      x: inch(cx), y: inch(by0), w: inch(bw0), h: inch(bullet),
      line: id === "ring" ? { color: accent, width: 3 } : { color: "FFFFFF", width: 3 },
      rotate: 0,
    };
    if (id === "ring") {
      opts2.fill = { color: hex(t.board) };
      opts2.line = { color: accent, width: 3 };
    } else if (id === "glow") {
      opts2.fill = { color: accent, transparency: 70 };
      opts2.shadow = { type: "outer", blur: 14, offset: 0, angle: 0, color: accent, opacity: 0.6 };
    } else if (id === "gradient") {
      // solid stand-in; PowerPoint gradient injection handles other shapes
      opts2.fill = { color: accent };
    } else if (geo.fillable) {
      opts2.fill = { color: accent };
    } else {
      opts2.fill = { type: "none" };
      opts2.line = { color: accent, width: 2.5 };
    }
    if (geo.radius !== undefined && "rectRadius" in opts2) opts2.rectRadius = geo.radius;
    try {
      // geometry names are validated against pptxgenjs at runtime
      s.addShape((pptx.ShapeType as unknown as Record<string, PptxGenJSType.ShapeType>)[geo.shape] ?? pptx.ShapeType.ellipse, opts2);
    } catch {
      s.addShape(pptx.ShapeType.ellipse, { ...opts2, fill: { color: accent } });
    }

    if (t.showNumber && id !== "underline" && id !== "bar" && id !== "none") {
      s.addText(slide.number, {
        x: inch(cx), y: inch(by0), w: inch(bw0), h: inch(bullet),
        fontFace: face("bullet", opts.bodyFont), fontSize: 17, bold: true,
        color: id === "ring" || id === "bracket" || id === "slash" ? accent : "FFFFFF",
        align: "center", valign: "middle", margin: 0,
      });
    }
  }

  const gap = t.showBullet ? bullet * (isWideNumberStyle((t.numberStyle ?? "circle") as NumberStyle) ? 1.6 : 1) + 22 : 0;
  s.addText(
    toPptxRuns(slide.question, {
      fontFace: face("question", opts.bodyFont), fontSize: qSize, bold: tfBold("question"), italic: tfItalic("question"),
      color: hex(t.questionColor), rtlMode: qRtl,
    }),
    {
      x: inch(qPx + (qRtl ? 0 : gap)), y: q.y, w: inch(Math.max(80, q.boxW - gap)), h: q.h,
      align: qRtl ? "right" : q.align, valign: "top", margin: 0,
      shrinkText: true, isTextBox: true, rtlMode: qRtl, rotate: q.rotate,
    },
  );
  };

  /* ------------------------------ options ------------------------------ */
  emit["element:options"] = () => {
  const count = Math.max(slide.options.length, 1);
  const twoCol = t.optionsLayout === "two-col" || t.optionsLayout === "grid";
  const optFont = Math.round(t.optionSize * slide.scale * 0.74);
  const dia = Math.min(54, Math.max(32, optFont * 1.5));
  const rows = twoCol ? Math.ceil(count / 2) : count;
  // user-set row gap (optionGap = % of board height) wins over the auto estimate
  const gapPx = t.optionGap ? ((t.optionGap / 100) * bh) : 0;
  const lineH = t.optionLineHeight ?? 1.45;
  const rowH = Math.max(dia + 10, optFont * lineH * 1.1) + gapPx;
  const optBox = place("options", 0, rows * rowH);
  const optLeft = (optBox.x as number) * PX;
  const optTop = (optBox.y as number) * PX;
  const colW = twoCol ? optBox.boxW / 2 : optBox.boxW;

  slide.options.forEach((opt, i) => {
    const col = twoCol ? i % 2 : 0;
    const row = twoCol ? Math.floor(i / 2) : i;
    const left = optLeft + col * colW;
    const y = optTop + row * rowH;
    const correct = reveal && slide.answer === opt.key;

    const oStyle = (t.optionStyle ?? "plain") as OptionStyle;
    const oColor = t.optionAccent || t.accent;
    const highlight = correct && t.answerStyle !== "tick";
    // the bullet's independent colour channels ("" = auto → follow oColor)
    const pal = optionBulletPalette(t, highlight);
    const plate = optionBulletBackdrop(t);
    const plateOn = !!plate && (!highlight || t.optionBulletCustomOnAnswer === true);
    const solidColor = (v: string | null) => (v && v !== "transparent" ? v : null);
    const rgbaOf = (hexColor: string, alpha: number) => {
      const h = hexColor.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    // row background, style-aware (rounded card / pill / bar / panel …)
    // …unless the bullet's background shape is scoped to the whole row
    const rowFill =
      plateOn && plate?.scope === "row" ? flatten(plate.color, t.board, plate.opacity)
      : oStyle === "soft" ? rgbaOf(oColor, 0.14)
      : oStyle === "card" || oStyle === "shadowed" ? shade(t.board, -0.25)
      : oStyle === "outline" || oStyle === "boxed" || oStyle === "dashed" || oStyle === "neon" ? shade(t.board, -0.3)
      : oStyle === "glass" ? rgbaOf("#ffffff", 0.1)
      : oStyle === "pill" ? rgbaOf(oColor, 0.18)
      : oStyle === "leftBar" || oStyle === "chevron" ? rgbaOf(oColor, 0.12)
      : oStyle === "gradient" ? rgbaOf(oColor, 0.22)
      : oStyle === "panel" || oStyle === "duo" ? rgbaOf(oColor, 0.18)
      : oStyle === "striped" ? rgbaOf(oColor, 0.12)
      : highlight ? rgbaOf(t.accent, 0.22)
      : undefined;
    const blend = (fg: string, bg: string, a: number) => {
      const p = (h: string, i: number) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
      const mix = (i: number) => Math.round(p(fg, i) * a + p(bg, i) * (1 - a));
      const hx = (v: number) => v.toString(16).padStart(2, "0");
      return `#${hx(mix(0))}${hx(mix(2))}${hx(mix(4))}`;
    };
    const rowGeom =
      oStyle === "pill" ? pptx.ShapeType.roundRect
      : oStyle === "leftBar" || oStyle === "stepped" ? pptx.ShapeType.roundRect
      : oStyle === "chevron" ? pptx.ShapeType.chevron
      : oStyle === "underline" ? pptx.ShapeType.rect
      : pptx.ShapeType.roundRect;
    if (rowFill) {
      s.addShape(rowGeom, {
        x: inch(left), y: inch(y), w: inch(Math.max(60, colW)), h: inch(rowH),
        fill: { color: rowFill.startsWith("rgba(")
          ? blend(oColor, t.board, parseFloat(rowFill.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? "0.2"))
          : rowFill },
        line: { type: "none" },
        rectRadius: oStyle === "pill" ? 0.5 : 0.12,
      });
      // border pass for outline-ish styles
      if (["outline", "dashed", "boxed", "neon", "card", "glass", "pill", "ticket", "duo"].includes(oStyle)) {
        s.addShape(rowGeom, {
          x: inch(left), y: inch(y), w: inch(Math.max(60, colW)), h: inch(rowH),
          fill: { type: "none" },
          line: { color: hex(oColor), width: oStyle === "neon" || oStyle === "outline" ? 2 : 1, dashType: oStyle === "dashed" ? "dash" : "solid" },
          rectRadius: oStyle === "pill" ? 0.5 : 0.12,
        });
      }
    }

    // left accent bar
    if (oStyle === "leftBar" || oStyle === "stepped") {
      s.addShape(pptx.ShapeType.rect, {
        x: inch(left), y: inch(y), w: inch(8), h: inch(rowH),
        fill: { color: hex(oColor) }, line: { type: "none" },
      });
    }

    // letter badge — ink / fill / border each come from their own channel
    const badge = optionBadgeStyle(oStyle, t, oColor, dia, highlight);
    const bShape = (t.optionBulletShape ?? "circle") as OptionBulletShape;
    const isMinimal = isMinimalOptionBulletShape(bShape);
    const keyLabel = formatOptionKey(effectiveOptionLabel(opt.labelMode, opt.key, t.plainNumbering, i), bShape);
    const bW = bShape === "pill" ? dia * 1.35 : dia;

    const geomType =
      bShape === "square" || bShape === "outlineSquare"
        ? pptx.ShapeType.rect
        : bShape === "roundedSquare" || bShape === "pill"
          ? pptx.ShapeType.roundRect
          : bShape === "diamond"
            ? pptx.ShapeType.diamond
            : bShape === "hexagon"
              ? pptx.ShapeType.hexagon
              : bShape === "octagon"
                ? pptx.ShapeType.octagon
                : bShape === "pentagon"
                  ? pptx.ShapeType.pentagon
                  : bShape === "triangle"
                    ? pptx.ShapeType.triangle
                    : bShape === "shield" || bShape === "tag"
                      ? pptx.ShapeType.homePlate
                      : bShape === "star" || bShape === "burst"
                        ? pptx.ShapeType.star5
                        : bShape === "heart"
                          ? pptx.ShapeType.heart
                          : bShape === "drop"
                            ? pptx.ShapeType.teardrop
                            : pptx.ShapeType.ellipse;

    const customFill = pal.customWins ? solidColor(pal.fill) : null;
    const customBorder = pal.customWins ? solidColor(pal.border) : null;
    const customInk = pal.customWins ? solidColor(pal.ink) : null;
    const autoFill =
      typeof badge.background === "string" && badge.background.startsWith("#") ? badge.background : oColor;
    const badgeFill = customFill ?? autoFill;

    // the bullet's own background shape, painted underneath the marker
    if (plate && plateOn && plate.scope === "marker") {
      const boxSize = Math.max(6, Math.round(Math.max(dia, bW) * (plate.size / 100)));
      const pW = Math.round(
        plate.shape === "pill" || (plate.shape === "match" && bW > dia) ? boxSize * 1.9 : boxSize,
      );
      const plateGeom =
        plate.shape === "square"
          ? pptx.ShapeType.rect
          : plate.shape === "rounded" || plate.shape === "pill"
            ? pptx.ShapeType.roundRect
            : plate.shape === "diamond"
              ? pptx.ShapeType.diamond
              : plate.shape === "hexagon"
                ? pptx.ShapeType.hexagon
                : plate.shape === "match"
                  ? geomType
                  : pptx.ShapeType.ellipse; // circle & soft glow
      s.addShape(plateGeom, {
        x: inch(left + (bW - pW) / 2),
        y: inch(y + (rowH - boxSize) / 2),
        w: inch(pW),
        h: inch(boxSize),
        fill: { color: hex(flatten(plate.color, t.board, plate.opacity)) },
        line: { type: "none" },
        rectRadius: plate.shape === "pill" ? 0.5 : 0.12,
      });
    }

    if (!isMinimal) {
      const isOutlineOnly = bShape === "ring" || bShape === "doubleRing" || bShape === "outlineSquare";
      const fillVal = isOutlineOnly && !customFill ? { type: "none" as const } : { color: hex(badgeFill) };
      const wantsRing = isOutlineOnly || (typeof badge.border === "string" && badge.border.includes("solid"));
      const lineVal = customBorder
        ? { color: hex(customBorder), width: Math.max(0.75, +(dia * 0.07).toFixed(2)) }
        : pal.customWins && pal.border === "transparent"
          ? { type: "none" as const }
          : wantsRing
            ? { color: hex(oColor), width: 2 }
            : { type: "none" as const };

      s.addShape(geomType, {
        x: inch(left),
        y: inch(y + (rowH - dia) / 2),
        w: inch(bW),
        h: inch(dia),
        fill: fillVal,
        line: lineVal,
        rectRadius: bShape === "pill" ? 0.5 : bShape === "roundedSquare" ? 0.25 : undefined,
      });
    }

    const badgeInk =
      typeof badge.color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(badge.color) ? badge.color : null;

    s.addText(keyLabel, {
      x: inch(left),
      y: inch(y + (rowH - dia) / 2),
      w: inch(bW),
      h: inch(dia),
      // the marker keeps the deck face: the option text font must not repaint it
      fontFace: baseFace("options", opts.bodyFont),
      fontSize: Math.round(optFont * (isMinimal ? 0.72 : 0.62)),
      bold: true,
      color: customInk ? hex(customInk) : badgeInk ? hex(badgeInk) : correct ? "FFFFFF" : hex(oColor),
      align: "center",
      valign: "middle",
      margin: 0,
    });

    const oRtl = isRtlText(opt.text);
    s.addText(
      toPptxRuns(opt.text, {
        fontFace: optionFace(),
        fontSize: optFont,
        bold: tfBold("options"),
        italic: tfItalic("options"),
        color: correct ? "5CFF9D" : hex(t.optionTextColor),
        rtlMode: oRtl,
      }),
      {
        x: inch(left + dia + 20), y: inch(y), w: inch(Math.max(60, colW - dia - 30)), h: inch(rowH),
        align: oRtl ? "right" : "left", valign: "middle", margin: 0, shrinkText: true,
        isTextBox: true, rtlMode: oRtl, lineSpacingMultiple: Math.max(0.8, Math.min(2.5, lineH / 1.2)),
      },
    );
  });
  };

  /* ------------------------------- extras ------------------------------ */
  emit["element:note"] = () => {
  if (slide.note?.trim()) {
    const n = place("note", 0, 30);
    s.addText(toPptxRuns(slide.note, { fontFace: face("note", opts.bodyFont), fontSize: 13, italic: tfItalic("note"), color: "BFC6D4" }), {
      x: n.x, y: n.y, w: n.w, h: n.h,
      align: n.align, valign: "middle", margin: 0, isTextBox: true, rotate: n.rotate,
    });
  }
  };

  /* -------------------- shapes & text boxes & images --------------------- */
  const shapeById = new Map<string, ShapeItem>(
    [...(deck.globalShapes ?? []), ...(slide.shapes ?? [])].map((x) => [x.id, x]),
  );

  /* --------------------- emit everything in stack order ------------------ */
  for (const layer of sortedLayers(deck, slide)) {
    if (layer.ref.kind === "element") emit[layer.key]?.();
    else {
      const sh = shapeById.get(layer.ref.id);
      if (sh) addShapeToSlide(pptx, s, sh, bx, by, bw, bh, opts);
    }
  }

  if (opts.speakerNotes) {
    const ans = slide.options.find((o) => o.key === slide.answer);
    s.addNotes(ans ? `সঠিক উত্তর / Answer: ${ans.key}) ${ans.text}` : "Answer not set.");
  }
  return s;
}

/** Emits a user-drawn shape / text box as a native PowerPoint object. */
function addShapeToSlide(
  pptx: PptxGenJSType,
  s: PptxGenJSType.Slide,
  sh: ShapeItem,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  opts: PptxOptions,
) {
  const x = inch(bx + (sh.x / 100) * bw);
  const y = inch(by + (sh.y / 100) * bh);
  const w = inch(Math.max(4, (sh.w / 100) * bw));
  const h = inch(Math.max(4, (sh.h / 100) * bh));
  const rotate = sh.rot || 0;

  /* ---------------------------- design → pptx ---------------------------- */
  const itemT = Math.round((1 - (sh.itemOpacity ?? 1)) * 100); // whole-item transparency
  const fillT = Math.min(100, Math.round((1 - sh.fillOpacity) * 100) + itemT);
  const dashType: PptxGenJSType.ShapeLineProps["dashType"] =
    (sh.lineStyle ?? (sh.dash ? "dashed" : "solid")) === "dashed" ? "dash"
    : sh.lineStyle === "dotted" ? "sysDot"
    : "solid";
  const line: PptxGenJSType.ShapeLineProps = sh.stroke && sh.strokeWidth > 0
    ? { color: hex(sh.stroke), width: Math.max(0.5, sh.strokeWidth * 0.75), dashType, transparency: itemT || undefined }
    : { type: "none" };
  const fill: PptxGenJSType.ShapeFillProps =
    sh.gradient?.enabled && sh.gradient.stops.length >= 2
      ? { color: registerGradient(sh.gradient, fillT) }
      : sh.fill
        ? { color: hex(sh.fill), transparency: fillT }
        : { type: "none" };

  // shadow / glow: PowerPoint has one effect slot in pptxgenjs → shadow wins, glow falls back to a soft shadow
  const sd = sh.shadow2;
  const gl = sh.glow;
  const shadow: PptxGenJSType.ShadowProps | undefined = sd?.enabled
    ? { type: "outer", blur: Math.round(sd.blur * 0.75), offset: Math.round(Math.hypot(sd.x, sd.y) * 0.75), angle: Math.round(((Math.atan2(sd.y, sd.x) * 180) / Math.PI + 360) % 360), color: hex(sd.color), opacity: sd.opacity }
    : gl?.enabled
      ? { type: "outer", blur: Math.round(gl.size * 0.9), offset: 0, angle: 0, color: hex(gl.color), opacity: gl.opacity }
      : undefined;

  const tg = sh.textGradient;
  const textColor = tg?.enabled && tg.stops[0] ? tg.stops[0].color : sh.textColor;
  const textProps = sh.text
    ? toPptxRuns(sh.uppercase ? sh.text.toUpperCase() : sh.text, {
        fontFace: opts.bodyFont,
        fontSize: Math.round(sh.fontSize * 0.75),
        bold: sh.bold,
        italic: sh.italic,
        color: hex(textColor),
        charSpacing: sh.letterSpacing ? Math.round(sh.letterSpacing * 0.75) : undefined,
        outline: sh.textStroke?.enabled ? { color: hex(sh.textStroke.color), size: Math.max(0.25, sh.textStroke.width * 0.5) } : undefined,
        glow: gl?.enabled && sh.kind === "text" ? { size: Math.round(gl.size / 4), opacity: gl.opacity, color: hex(gl.color) } : undefined,
        shadow: sh.textShadow !== false ? { type: "outer", blur: 2, offset: 1.5, angle: 90, color: "000000", opacity: 0.5 } : undefined,
      })
    : null;
  const textOpts = {
    align: sh.align,
    valign: sh.valign as "top" | "middle" | "bottom",
    margin: sh.kind === "text" ? Math.round((sh.padding ?? 6) * 0.75) : 4,
    lineSpacingMultiple: sh.lineHeight ? Math.max(0.8, Math.min(2.5, sh.lineHeight / 1.2)) : undefined,
  };

  if (sh.kind === "image") {
    if (!sh.src) return;
    const rounding = sh.mask === "circle" || (sh.radius ?? 0) >= 50;
    const opts: PptxGenJSType.ImageProps = {
      x, y, w, h, rotate,
      rounding,
      transparency: Math.round((1 - (sh.opacity ?? 1)) * 100),
      flipH: sh.flipH || undefined,
      flipV: sh.flipV || undefined,
      sizing: { type: sh.fit === "cover" ? "cover" : sh.fit === "fill" ? "crop" : "contain", w, h },
      shadow: sh.shadow ? { type: "outer", blur: 8, offset: 4, angle: 90, color: "000000", opacity: 0.5 } : undefined,
    };
    if (sh.src.startsWith("data:")) opts.data = sh.src;
    else opts.path = sh.src;
    try {
      s.addImage(opts);
    } catch {
      /* unreadable source — skip rather than fail the export */
    }
    // border drawn as an outline shape on top (PowerPoint pictures have no line prop via pptxgenjs)
    if (sh.stroke && sh.strokeWidth > 0) {
      s.addShape(rounding ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
        x, y, w, h, rotate,
        fill: { type: "none" },
        line: { color: hex(sh.stroke), width: Math.max(0.5, sh.strokeWidth * 0.75), dashType },
      });
    }
    if (sh.text) {
      s.addText(textProps ?? [{ text: sh.text }], { x, y, w, h, ...textOpts, rotate, isTextBox: true });
    }
    return;
  }

  if (sh.kind === "line" || sh.kind === "arrow") {
    s.addShape(pptx.ShapeType.line, {
      x, y: inch(by + ((sh.y + sh.h / 2) / 100) * bh), w, h: 0,
      line: { ...line, endArrowType: sh.kind === "arrow" ? "triangle" : undefined },
      rotate,
      shadow,
    });
    return;
  }

  if (sh.kind === "text") {
    s.addText(textProps ?? [{ text: "" }], {
      x, y, w, h, ...textOpts, rotate, isTextBox: true,
      fill: sh.fill || sh.gradient?.enabled ? fill : undefined,
      line: sh.stroke ? line : undefined,
      shadow: sh.fill || sh.gradient?.enabled ? shadow : undefined,
      rectRadius: sh.cornerRadius ? Math.min(0.5, sh.cornerRadius / 200) : undefined,
      shape: sh.cornerRadius ? pptx.ShapeType.roundRect : undefined,
    });
    return;
  }

  const shapeType =
    sh.kind === "rect" ? pptx.ShapeType.rect
    : sh.kind === "rounded" ? pptx.ShapeType.roundRect
    : sh.kind === "ellipse" ? pptx.ShapeType.ellipse
    : sh.kind === "triangle" ? pptx.ShapeType.triangle
    : sh.kind === "diamond" ? pptx.ShapeType.diamond
    : pptx.ShapeType.star5;

  const radius = sh.cornerRadius !== undefined ? Math.min(0.5, sh.cornerRadius / 200) : sh.kind === "rounded" ? 0.1 : undefined;
  const geomType = radius && sh.kind === "rect" ? pptx.ShapeType.roundRect : shapeType;
  if (textProps) {
    s.addText(textProps, { x, y, w, h, shape: geomType, fill, line, rotate, shadow, ...textOpts, rectRadius: radius });
  } else {
    s.addShape(geomType, { x, y, w, h, fill, line, rotate, shadow, rectRadius: radius });
  }
}

export async function exportPptx(deck: Deck, options: Partial<PptxOptions> = {}) {
  const opts = { ...DEFAULT_PPTX_OPTIONS, ...options };
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: "MCQ16x9", width: 13.333, height: 7.5 });
  pptx.layout = "MCQ16x9";
  pptx.author = deck.header.brandBottom || "MCQ Slide Studio";
  pptx.company = deck.header.brandTop || "";
  pptx.title = deck.header.title || "MCQ";
  pptx.subject = deck.header.badge || "";

  gradRegistry.length = 0;
  gradSeq = 0;

  for (const slide of deck.slides) {
    buildSlide(pptx, deck, slide, slide.showAnswer, opts);
    if (opts.answerSlides && !slide.showAnswer && slide.answer) {
      buildSlide(pptx, deck, slide, true, opts);
    }
  }

  if (!gradRegistry.length) {
    await pptx.writeFile({ fileName: opts.fileName });
    return;
  }

  // post-process: swap marker solids for real gradient fills
  const { default: JSZip } = await import("jszip");
  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  const zip = await JSZip.loadAsync(blob);
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  for (const f of slideFiles) {
    const xml = await zip.file(f)!.async("string");
    zip.file(f, injectGradients(xml));
  }
  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** silence unused-import lint for the alpha helper kept for future theming */
void withAlpha;
