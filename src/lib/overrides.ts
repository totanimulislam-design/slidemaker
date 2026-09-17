import type { Deck, DeckHeader, SlideData, ThemeSettings } from "./types";

/** Merge nested theme values without losing unchanged deck-level properties. */
export function mergeTheme(base: ThemeSettings, patch?: Partial<ThemeSettings>): ThemeSettings {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    layout: { ...base.layout, ...(patch.layout ?? {}) },
    boxFonts: { ...base.boxFonts, ...(patch.boxFonts ?? {}) },
    banner: patch.banner
      ? {
          ...base.banner,
          ...patch.banner,
          gradient: { ...base.banner.gradient, ...(patch.banner.gradient ?? {}) },
          textGradient: { ...base.banner.textGradient, ...(patch.banner.textGradient ?? {}) },
          border: { ...base.banner.border, ...(patch.banner.border ?? {}) },
        }
      : base.banner,
    background: patch.background
      ? {
          ...base.background,
          ...patch.background,
          gradient: { ...base.background.gradient, ...(patch.background.gradient ?? {}) },
          overlay: { ...base.background.overlay, ...(patch.background.overlay ?? {}) },
        }
      : base.background,
    frame: patch.frame
      ? {
          ...base.frame,
          ...patch.frame,
          gradient: { ...base.frame.gradient, ...(patch.frame.gradient ?? {}) },
        }
      : base.frame,
    badgePlate: patch.badgePlate
      ? {
          ...base.badgePlate,
          ...patch.badgePlate,
          border: { ...(base.badgePlate?.border ?? patch.badgePlate.border), ...(patch.badgePlate.border ?? {}) },
        }
      : base.badgePlate,
  };
}

export function effectiveTheme(deck: Deck, slide?: SlideData): ThemeSettings {
  return mergeTheme(deck.theme, slide?.themeOverride);
}

export function effectiveHeader(deck: Deck, slide?: SlideData): DeckHeader {
  return slide?.headerOverride ? { ...deck.header, ...slide.headerOverride } : deck.header;
}

/** Merge a patch into an existing per-slide theme override. */
export function mergeThemeOverride(
  current: Partial<ThemeSettings> | undefined,
  patch: Partial<ThemeSettings>,
): Partial<ThemeSettings> {
  return {
    ...(current ?? {}),
    ...patch,
    ...(patch.layout ? { layout: { ...(current?.layout ?? {}), ...patch.layout } } : {}),
    ...(patch.boxFonts ? { boxFonts: { ...(current?.boxFonts ?? {}), ...patch.boxFonts } } : {}),
    ...(patch.banner
      ? {
          banner: {
            ...(current?.banner ?? {}),
            ...patch.banner,
            ...(patch.banner.gradient
              ? { gradient: { ...(current?.banner?.gradient ?? {}), ...patch.banner.gradient } }
              : {}),
            ...(patch.banner.textGradient
              ? { textGradient: { ...(current?.banner?.textGradient ?? {}), ...patch.banner.textGradient } }
              : {}),
            ...(patch.banner.border
              ? { border: { ...(current?.banner?.border ?? {}), ...patch.banner.border } }
              : {}),
          },
        }
      : {}),
    ...(patch.frame
      ? {
          frame: {
            ...(current?.frame ?? {}),
            ...patch.frame,
            ...(patch.frame.gradient
              ? { gradient: { ...(current?.frame?.gradient ?? {}), ...patch.frame.gradient } }
              : {}),
          },
        }
      : {}),
    ...(patch.badgePlate
      ? {
          badgePlate: {
            ...(current?.badgePlate ?? {}),
            ...patch.badgePlate,
            ...(patch.badgePlate.border
              ? { border: { ...(current?.badgePlate?.border ?? {}), ...patch.badgePlate.border } }
              : {}),
          },
        }
      : {}),
  } as Partial<ThemeSettings>;
}