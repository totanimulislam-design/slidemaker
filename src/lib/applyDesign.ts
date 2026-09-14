import type { Deck, ThemeSettings, DeckHeader, BackgroundSettings } from "./types";
import type { ShapeItem } from "./shapes";
import { effectiveTheme, effectiveHeader, mergeThemeOverride } from "./overrides";
import { effectiveBackground } from "./background";

export type ApplySection = "all" | "theme" | "header" | "background" | "bullets" | "options" | "layout" | "shapes" | "frame";

let copySeq = 0;
const copyShapes = (items: ShapeItem[] = []): ShapeItem[] =>
  items.map((item) => ({
    ...item,
    id: `${item.id}-ap${Date.now().toString(36)}${(copySeq++).toString(36)}`,
  }));

/**
 * Copies the design (theme, header, background, layout, bullets, options,
 * custom shapes, text boxes and images)
 * from a source slide to the requested target scope (this slide, selected slides, or all slides).
 */
export function applySlideDesign(
  deck: Deck,
  sourceSlideId: string,
  scope: "slide" | "selected" | "all",
  targetSlideIds: string[],
  section: ApplySection = "all",
): Deck {
  const source = deck.slides.find((s) => s.id === sourceSlideId) ?? deck.slides[0];
  if (!source) return deck;

  const effTheme = effectiveTheme(deck, source);
  const effHeader = effectiveHeader(deck, source);
  const effBg = effectiveBackground(deck, source);
  const sourceShapes = source.shapes ?? [];

  if (scope === "all") {
    // When applying to ALL slides, set the deck defaults to match this slide's design
    // and clear redundant overrides so all slides cleanly inherit it.
    let nextTheme: ThemeSettings = deck.theme;
    let nextHeader: DeckHeader = deck.header;

    if (section === "all" || section === "theme") {
      nextTheme = { ...effTheme, background: section === "all" ? effBg : effTheme.background };
    }
    if (section === "layout") {
      nextTheme = { ...nextTheme, layout: { ...effTheme.layout } };
    }
    if (section === "bullets") {
      nextTheme = {
        ...nextTheme,
        showBullet: effTheme.showBullet,
        showNumber: effTheme.showNumber,
        bulletSeparate: effTheme.bulletSeparate,
        bulletSize: effTheme.bulletSize,
        numberStyle: effTheme.numberStyle,
        accent: effTheme.accent,
      };
    }
    if (section === "options") {
      nextTheme = {
        ...nextTheme,
        optionsLayout: effTheme.optionsLayout,
        optionStyle: effTheme.optionStyle,
        optionAccent: effTheme.optionAccent,
        optionBulletShape: effTheme.optionBulletShape,
        optionBulletTreatment: effTheme.optionBulletTreatment,
        optionBulletInk: effTheme.optionBulletInk,
        optionBulletFill: effTheme.optionBulletFill,
        optionBulletBorder: effTheme.optionBulletBorder,
        optionBulletCustomOnAnswer: effTheme.optionBulletCustomOnAnswer,
        optionBulletBgColor: effTheme.optionBulletBgColor,
        optionBulletBgScope: effTheme.optionBulletBgScope,
        optionBulletBgShape: effTheme.optionBulletBgShape,
        optionBulletBgSize: effTheme.optionBulletBgSize,
        optionBulletBgOpacity: effTheme.optionBulletBgOpacity,
        optionTextColor: effTheme.optionTextColor,
        optionGap: effTheme.optionGap,
        optionLineHeight: effTheme.optionLineHeight,
        answerStyle: effTheme.answerStyle,
      };
    }
    if (section === "all" || section === "header") {
      nextHeader = { ...effHeader };
    }
    if (section === "background") {
      nextTheme = { ...nextTheme, background: { ...effBg } };
    }
    if (section === "frame") {
      nextTheme = { ...nextTheme, frame: { ...effTheme.frame }, frameOuter: effTheme.frameOuter, showFrame: effTheme.showFrame };
    }

    return {
      ...deck,
      theme: nextTheme,
      header: nextHeader,
      slides: deck.slides.map((s) => {
        if (section === "all") {
          return {
            ...s,
            themeOverride: undefined,
            headerOverride: undefined,
            background: undefined,
            shapes: s.id === source.id ? sourceShapes : copyShapes(sourceShapes),
          };
        }
        return {
          ...s,
          themeOverride: section === "theme" || section === "layout" || section === "bullets" || section === "options" ? undefined : s.themeOverride,
          headerOverride: section === "header" ? undefined : s.headerOverride,
          background: section === "background" ? undefined : s.background,
          shapes: section === "shapes"
            ? (s.id === source.id ? sourceShapes : copyShapes(sourceShapes))
            : s.shapes,
        };
      }),
    };
  }

  // scope is "selected" or "slide"
  const targetIds = new Set(scope === "selected" ? targetSlideIds : [sourceSlideId]);

  return {
    ...deck,
    slides: deck.slides.map((s) => {
      if (!targetIds.has(s.id)) return s;

      let nextThemeOverride = s.themeOverride;
      let nextHeaderOverride = s.headerOverride;
      let nextBg: BackgroundSettings | undefined = s.background;
      let nextShapes = s.shapes;

      if (section === "all") {
        nextThemeOverride = { ...effTheme };
        nextHeaderOverride = { ...effHeader };
        nextBg = { ...effBg };
        nextShapes = s.id === source.id ? sourceShapes : copyShapes(sourceShapes);
      } else if (section === "header") {
        nextHeaderOverride = { ...(s.headerOverride ?? {}), ...effHeader };
      } else if (section === "background") {
        nextBg = { ...effBg };
      } else if (section === "layout") {
        nextThemeOverride = mergeThemeOverride(s.themeOverride, { layout: { ...effTheme.layout } });
      } else if (section === "bullets") {
        nextThemeOverride = mergeThemeOverride(s.themeOverride, {
          showBullet: effTheme.showBullet,
          showNumber: effTheme.showNumber,
          bulletSeparate: effTheme.bulletSeparate,
          bulletSize: effTheme.bulletSize,
          numberStyle: effTheme.numberStyle,
          accent: effTheme.accent,
        });
      } else if (section === "options") {
        nextThemeOverride = mergeThemeOverride(s.themeOverride, {
          optionsLayout: effTheme.optionsLayout,
          optionStyle: effTheme.optionStyle,
          optionAccent: effTheme.optionAccent,
          optionBulletShape: effTheme.optionBulletShape,
          optionBulletTreatment: effTheme.optionBulletTreatment,
          optionBulletInk: effTheme.optionBulletInk,
          optionBulletFill: effTheme.optionBulletFill,
          optionBulletBorder: effTheme.optionBulletBorder,
          optionBulletCustomOnAnswer: effTheme.optionBulletCustomOnAnswer,
          optionBulletBgColor: effTheme.optionBulletBgColor,
          optionBulletBgScope: effTheme.optionBulletBgScope,
          optionBulletBgShape: effTheme.optionBulletBgShape,
          optionBulletBgSize: effTheme.optionBulletBgSize,
          optionBulletBgOpacity: effTheme.optionBulletBgOpacity,
          optionTextColor: effTheme.optionTextColor,
          optionGap: effTheme.optionGap,
          optionLineHeight: effTheme.optionLineHeight,
          answerStyle: effTheme.answerStyle,
        });
      } else if (section === "frame") {
        nextThemeOverride = mergeThemeOverride(s.themeOverride, {
          frame: { ...effTheme.frame },
          frameOuter: effTheme.frameOuter,
          showFrame: effTheme.showFrame,
        });
      } else if (section === "theme") {
        nextThemeOverride = mergeThemeOverride(s.themeOverride, effTheme);
      } else if (section === "shapes") {
        nextShapes = s.id === source.id ? sourceShapes : copyShapes(sourceShapes);
      }

      return {
        ...s,
        themeOverride: nextThemeOverride,
        headerOverride: nextHeaderOverride,
        background: nextBg,
        shapes: nextShapes,
      };
    }),
  };
}

/**
 * Reverts slide(s) to follow the deck default design by clearing their overrides.
 */
export function revertSlideDesign(deck: Deck, slideIds: string[]): Deck {
  const ids = new Set(slideIds);
  return {
    ...deck,
    slides: deck.slides.map((s) =>
      ids.has(s.id)
        ? { ...s, themeOverride: undefined, headerOverride: undefined, background: undefined, shapes: [] }
        : s,
    ),
  };
}
