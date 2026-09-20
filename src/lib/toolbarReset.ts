import type { ShapeItem } from "./shapes";
import { makeShape } from "./shapes";
import {
  DEFAULT_BANNER,
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  cloneBackground,
  cloneBadgePlate,
  cloneBanner,
  cloneFrame,
  type BackgroundSettings,
  type BannerSettings,
  type BoxFontId,
  type DeckHeader,
  type ElementId,
  type ThemeSettings,
} from "./types";

/**
 * The patch a toolbar's Default button writes. Theme / header / background
 * go through the same scoped setters the rest of the toolbar uses; `shape`
 * is applied with `patchShape`. Empty typeface objects (`boxFonts[part]: {}`)
 * clear that part's override so it follows the deck again.
 */
export interface ToolbarResetPatch {
  theme?: Partial<ThemeSettings>;
  header?: Partial<DeckHeader>;
  background?: Partial<BackgroundSettings>;
  shape?: Partial<ShapeItem>;
}

/** one line of a merged context toolbar */
export type ToolbarLineId =
  | "titleText"
  | "titleBg"
  | "badge1"
  | "badge2"
  | "questionText"
  | "questionBullet"
  | "bulletText"
  | "optionText"
  | "optionBullet"
  | "optionBulletText";

const D = DEFAULT_THEME;

const bannerOf = (theme: ThemeSettings): BannerSettings => ({
  ...DEFAULT_BANNER,
  ...(theme.banner ?? {}),
  color: theme.banner?.color ?? theme.titleBanner,
});

/** clear one part's typeface without copying every other box onto the slide */
const clearPart = (id: BoxFontId): NonNullable<ThemeSettings["boxFonts"]> => ({ [id]: {} });

const alignBox = (theme: ThemeSettings, id: ElementId): ThemeSettings["layout"] => ({
  ...theme.layout,
  [id]: { ...theme.layout[id], align: DEFAULT_LAYOUT[id].align },
});

/** factory look of the Title text line (glyphs, not the banner plate) */
function resetTitleText(theme: ThemeSettings): ToolbarResetPatch {
  const banner = bannerOf(theme);
  return {
    theme: {
      titleSize: D.titleSize,
      titleColor: D.titleColor,
      boxFonts: clearPart("title"),
      banner: {
        ...banner,
        textGradient: cloneBanner().textGradient,
        textGlow: DEFAULT_BANNER.textGlow,
        textShadow: DEFAULT_BANNER.textShadow,
      },
      layout: alignBox(theme, "title"),
    },
  };
}

/** factory look of the Title background line (the plate, not the glyphs) */
function resetTitleBg(theme: ThemeSettings): ToolbarResetPatch {
  const banner = bannerOf(theme);
  const fresh = cloneBanner();
  return {
    header: { showBanner: true },
    theme: {
      titleBanner: fresh.color,
      banner: {
        ...fresh,
        textGradient: banner.textGradient,
        textGlow: banner.textGlow,
        textShadow: banner.textShadow,
      },
    },
  };
}

function resetBadgeLine(theme: ThemeSettings, line: "badge1" | "badge2"): ToolbarResetPatch {
  if (line === "badge1") {
    return {
      theme: {
        brandTopSize: D.brandTopSize,
        brandTopColor: D.brandTopColor,
        showBrandTop: D.showBrandTop,
        boxFonts: clearPart("brandTop"),
        layout: alignBox(theme, "brand"),
      },
    };
  }
  return {
    theme: {
      brandBottomSize: D.brandBottomSize,
      brandBottomColor: D.brandBottomColor,
      showBrandBottom: D.showBrandBottom,
      boxFonts: clearPart("brandBottom"),
      layout: alignBox(theme, "brand"),
    },
  };
}

function resetQuestionText(theme: ThemeSettings): ToolbarResetPatch {
  return {
    theme: {
      questionSize: D.questionSize,
      questionColor: D.questionColor,
      boxFonts: clearPart("question"),
      layout: alignBox(theme, "question"),
    },
  };
}

function resetQuestionBullet(): ToolbarResetPatch {
  return {
    theme: {
      showBullet: D.showBullet,
      bulletSize: D.bulletSize,
      numberStyle: D.numberStyle,
      accent: D.accent,
      bulletSeparate: D.bulletSeparate,
      // the shape channels unwind with the design — an auto channel drops the
      // key entirely (undefined), so the numbering design paints itself again
      bulletFill: D.bulletFill,
      bulletBorder: D.bulletBorder,
      bulletBorderStyle: D.bulletBorderStyle,
      bulletBorderWeight: undefined,
      bulletRadius: undefined,
      bulletOpacity: D.bulletOpacity,
      // gradients, the shape effect and the one-click style unwind with them —
      // an unset channel drops its key, so the design paints itself again
      bulletFillGradient: undefined,
      bulletBorderGradient: undefined,
      bulletEffect: undefined,
      bulletEffectIntensity: undefined,
      bulletEffectColor: undefined,
      bulletStylePreset: undefined,
      bulletNudgeX: D.bulletNudgeX,
      bulletNudgeY: D.bulletNudgeY,
    },
  };
}

function resetBulletText(theme: ThemeSettings): ToolbarResetPatch {
  return {
    theme: {
      showNumber: D.showNumber,
      boxFonts: clearPart("bullet"),
      layout: alignBox(theme, "bullet"),
    },
  };
}

function resetOptionText(theme: ThemeSettings): ToolbarResetPatch {
  return {
    theme: {
      optionSize: D.optionSize,
      optionTextColor: D.optionTextColor,
      optionLineHeight: D.optionLineHeight,
      boxFonts: clearPart("options"),
      layout: alignBox(theme, "options"),
    },
  };
}

function resetOptionBullet(): ToolbarResetPatch {
  return {
    theme: {
      optionStyle: D.optionStyle,
      optionAccent: D.optionAccent,
      optionBulletShape: D.optionBulletShape,
      optionBulletTreatment: D.optionBulletTreatment,
      optionBulletInk: D.optionBulletInk,
      optionBulletFill: D.optionBulletFill,
      optionBulletBorder: D.optionBulletBorder,
      optionBulletCustomOnAnswer: D.optionBulletCustomOnAnswer,
      optionBulletBgColor: D.optionBulletBgColor,
      optionBulletBgScope: D.optionBulletBgScope,
      optionBulletBgShape: D.optionBulletBgShape,
      optionBulletBgSize: D.optionBulletBgSize,
      optionBulletBgOpacity: D.optionBulletBgOpacity,
      optionsLayout: D.optionsLayout,
      optionGap: D.optionGap,
    },
  };
}

function resetOptionBulletText(): ToolbarResetPatch {
  return {
    theme: {
      plainNumbering: D.plainNumbering,
      optionBulletInk: D.optionBulletInk,
      optionBulletTextSize: D.optionBulletTextSize,
      optionBulletTextWeight: D.optionBulletTextWeight,
      optionBulletFontFamily: D.optionBulletFontFamily,
      optionBulletUppercase: D.optionBulletUppercase,
      boxFonts: clearPart("optionBullet"),
    },
  };
}

/** Default for one merged-toolbar line */
export function resetToolbarLine(id: ToolbarLineId, theme: ThemeSettings): ToolbarResetPatch {
  switch (id) {
    case "titleText":
      return resetTitleText(theme);
    case "titleBg":
      return resetTitleBg(theme);
    case "badge1":
    case "badge2":
      return resetBadgeLine(theme, id);
    case "questionText":
      return resetQuestionText(theme);
    case "questionBullet":
      return resetQuestionBullet();
    case "bulletText":
      return resetBulletText(theme);
    case "optionText":
      return resetOptionText(theme);
    case "optionBullet":
      return resetOptionBullet();
    case "optionBulletText":
      return resetOptionBulletText();
  }
}

function resetBadge3(theme: ThemeSettings): ToolbarResetPatch {
  return {
    theme: {
      badgeSize: D.badgeSize,
      badgeColor: D.badgeColor,
      badgePlate: cloneBadgePlate(),
      boxFonts: clearPart("badge"),
      layout: alignBox(theme, "badge"),
    },
  };
}

function resetNote(theme: ThemeSettings): ToolbarResetPatch {
  return {
    theme: {
      noteColor: D.noteColor,
      noteOpacity: D.noteOpacity,
      noteSize: D.noteSize,
      showNote: D.showNote,
      boxFonts: clearPart("note"),
      layout: alignBox(theme, "note"),
    },
  };
}

function resetLogo(theme: ThemeSettings): ToolbarResetPatch {
  const cur = theme.layout.logo;
  return {
    theme: {
      layout: {
        ...theme.layout,
        logo: { ...DEFAULT_LAYOUT.logo, z: cur?.z, hidden: cur?.hidden, locked: cur?.locked },
      },
    },
  };
}

/** Default for the plain (single-line) toolbar of a built-in element */
export function resetElementToolbar(el: ElementId, theme: ThemeSettings): ToolbarResetPatch {
  switch (el) {
    case "title":
      return resetTitleText(theme);
    case "question":
      return resetQuestionText(theme);
    case "options":
      return resetOptionText(theme);
    case "bullet":
      return resetBulletText(theme);
    case "brand":
      return {
        theme: {
          brandColor: D.brandColor,
          brandTopSize: D.brandTopSize,
          brandTopColor: D.brandTopColor,
          showBrandTop: D.showBrandTop,
          brandBottomSize: D.brandBottomSize,
          brandBottomColor: D.brandBottomColor,
          showBrandBottom: D.showBrandBottom,
          boxFonts: { brand: {}, brandTop: {}, brandBottom: {} },
          layout: alignBox(theme, "brand"),
        },
      };
    case "badge":
      return resetBadge3(theme);
    case "note":
      return resetNote(theme);
    case "logo":
      return resetLogo(theme);
  }
}

/**
 * Factory style of a drawn item. Geometry, identity, wording and the image
 * source stay put — Default never deletes what the user drew, it only
 * unwinds the look.
 */
export function resetShapeStyle(s: ShapeItem, accent: string): Partial<ShapeItem> {
  const fresh = makeShape(s.kind, accent);
  return {
    fill: fresh.fill,
    fillOpacity: fresh.fillOpacity,
    stroke: fresh.stroke,
    strokeWidth: fresh.strokeWidth,
    dash: fresh.dash,
    textColor: fresh.textColor,
    fontSize: fresh.fontSize,
    bold: fresh.bold,
    italic: fresh.italic,
    align: fresh.align,
    valign: fresh.valign,
    gradient: undefined,
    textGradient: undefined,
    shadow2: undefined,
    glow: undefined,
    itemOpacity: 1,
    cornerRadius: undefined,
    lineStyle: undefined,
    lineJoin: undefined,
    blend: undefined,
    letterSpacing: undefined,
    lineHeight: undefined,
    textStroke: undefined,
    textShadow: undefined,
    textGlow: undefined,
    uppercase: undefined,
    lowercase: undefined,
    textTransform: undefined,
    textOpacity: undefined,
    textEffect: undefined,
    textBgShape: undefined,
    textOffsetX: undefined,
    textOffsetY: undefined,
    padding: undefined,
    fontFamily: undefined,
    underline: undefined,
    strikethrough: undefined,
    fit: s.kind === "image" ? "contain" : undefined,
    opacity: s.kind === "image" ? 1 : undefined,
    radius: s.kind === "image" ? 0 : undefined,
    flipH: false,
    flipV: false,
    mask: s.kind === "image" ? "none" : undefined,
    shadow: false,
  };
}

export function resetThemeToolbar(): ToolbarResetPatch {
  return { theme: { accent: D.accent, board: D.board, brandColor: D.brandColor } };
}

export function resetLayoutToolbar(): ToolbarResetPatch {
  return { theme: { snapEnabled: D.snapEnabled, smartGuides: D.smartGuides, snapStep: D.snapStep } };
}

export function resetAnswerToolbar(): ToolbarResetPatch {
  return { theme: { answerStyle: D.answerStyle, optionBulletCustomOnAnswer: D.optionBulletCustomOnAnswer } };
}

export function resetFrameToolbar(): ToolbarResetPatch {
  return {
    theme: {
      showFrame: D.showFrame,
      frameOuter: D.frameOuter,
      frameInner: D.frameInner,
      frame: { ...cloneFrame(), image: undefined, imageInset: undefined, imagePlacement: undefined },
    },
  };
}

export function resetBackgroundToolbar(): ToolbarResetPatch {
  return {
    theme: { board: D.board },
    background: cloneBackground(),
  };
}
