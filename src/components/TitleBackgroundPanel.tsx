import { BANNER_AUTO_FRAME_HEIGHT, DEFAULT_BANNER, cloneBanner, type BannerSettings, type Box, type DeckHeader, type ElementId, type ThemeSettings } from "../lib/types";
import { bannerCss } from "../lib/banner";
import {
  BannerBorderPanel,
  BannerEffectsPanel,
  BannerFillPanel,
  BannerPartsPanel,
  BannerPositionPanel,
  BannerPresetPanel,
  BannerShapePanel,
  BannerSizePanel,
  BannerTransparencyPanel,
  bannerOf,
  type BannerCardName,
} from "./BannerDesignPanel";
import { boxStack } from "../lib/boxFonts";
import ElementPosition from "./ElementPosition";
import { PanelHead, Toggle } from "./ui";

/**
 * Navigation ▸ "Title background".
 *
 * The plate painted *behind* the heading, in the same order the toolbar's line
 * reads: the design presets, the silhouette, the effects, the fill, the one
 * Border card (on / off · colour · style · weight · transparency · corner
 * radius, all four or each corner · glow), the shape's transparency, and then
 * the plate's own free size and place on the board. The glyphs themselves live
 * in the sibling "Title text" panel.
 */
interface Props {
  theme: ThemeSettings;
  header: DeckHeader;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setHeader: (patch: Partial<DeckHeader>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const titleBackgroundDocumentColors = (theme: ThemeSettings, banner: BannerSettings): string[] => {
  const colors = [
    theme.accent,
    theme.board,
    theme.brandColor,
    theme.titleColor,
    theme.questionColor,
    theme.optionTextColor,
    theme.badgeColor,
    theme.optionAccent,
    theme.brandTopColor,
    theme.brandBottomColor,
    theme.noteColor,
    theme.titleBanner,
    banner.color,
  ];
  const seen = new Set<string>();
  return colors.flatMap((color) => {
    const value = String(color || "").toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(value) || seen.has(value)) return [];
    seen.add(value);
    return [value];
  }).slice(0, 12);
};

export default function TitleBackgroundPanel({ theme, header, setTheme, setHeader, patchLayout }: Props) {
  const b: BannerSettings = bannerOf(theme);
  /**
   * `theme.titleBanner` is the legacy solid banner colour older decks read from,
   * so a colour pick writes both — the two can never drift apart.
   */
  const set = (p: Partial<BannerSettings>) =>
    setTheme({ banner: { ...b, ...p }, ...(p.color ? { titleBanner: p.color } : {}) });
  const css = bannerCss(b, theme.titleColor);

  const cards = { theme, banner: b, setBanner: set, documentColors: titleBackgroundDocumentColors(theme, b) };
  /**
   * The parts card's **Change** walks down this panel: every card below wears
   * `data-banner-card`, so a part opens the card that owns it instead of the
   * user hunting for it. An effect part goes one step further and lights its
   * own category inside the Effects card. The target is scrolled into view and
   * flashed.
   */
  const flash = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView?.({ behavior: "smooth", block: "start" });
    el.classList.add("banner-card-flash");
    window.setTimeout(() => el.classList.remove("banner-card-flash"), 900);
  };
  const openCard = (card: BannerCardName, part?: string) => {
    if (typeof document === "undefined") return;
    const cardEl = document.querySelector<HTMLElement>(`[data-banner-card="${card}"]`);
    const group = part === "distortion" ? "shape" : part;
    const target =
      card === "Banner effects" && group ? cardEl?.querySelector<HTMLElement>(`[data-banner-fx-group="${group}"]`) ?? cardEl : cardEl;
    flash(target);
  };

  return (
    <div className="space-y-4">
      <PanelHead
        title="Title background"
        subtitle="The banner plate behind the heading — design, shape, fill, border, size and place."
      />

      {/* --------------------------------- live preview ---------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10" style={{ background: theme.board }}>
        <div className="flex items-center justify-center px-6 py-7">
          <div
            style={{
              position: "relative",
              padding: css.padding,
              boxSizing: "border-box",
              width: header.showBanner && b.shape !== "none" ? "min(100%, 320px)" : "fit-content",
              ...(header.showBanner && b.shape !== "none" && b.size?.h === undefined ? { height: BANNER_AUTO_FRAME_HEIGHT } : {}),
              display: header.showBanner && b.shape !== "none" ? "flex" : undefined,
              alignItems: header.showBanner && b.shape !== "none" ? "center" : undefined,
              margin: "0 auto",
            }}
          >
            {header.showBanner && css.halo && <div style={css.halo} />}
            {header.showBanner && css.layers.map((l, i) => <div key={`banner-layer-${i}`} data-banner-layer={i} style={l} />)}
            {header.showBanner && <div className={b.shimmer ? "banner-shimmer" : undefined} style={css.box} />}
            {header.showBanner && css.border && <div style={css.border} />}
            {header.showBanner && css.overlays.map((l, i) => <div key={`banner-overlay-${i}`} style={l} />)}
            <div
              style={{
                position: "relative",
                fontFamily: boxStack(theme, "title"),
                fontSize: 30,
                fontWeight: 800,
                whiteSpace: "nowrap",
                width: header.showBanner && b.shape !== "none" ? "100%" : undefined,
                lineHeight: 1.25,
                ...css.text,
              }}
            >
              {header.title || "বহুনির্বাচনী"}
            </div>
          </div>
        </div>
      </div>

      <Toggle
        label="Show banner behind the title"
        checked={header.showBanner}
        onChange={(v) => setHeader({ showBanner: v })}
      />

      {/* ------------------------- the plate, channel by channel ------------- */}
      <div data-banner-card="Design presets">
        <BannerPresetPanel {...cards} />
      </div>
      {/* every part of the design, one row each — removable and one click from
          the card that changes it */}
      <div data-banner-card="Design parts">
        <BannerPartsPanel {...cards} onEdit={openCard} />
      </div>
      <div data-banner-card="Banner shape">
        <BannerShapePanel {...cards} />
      </div>
      <div data-banner-card="Banner effects">
        <BannerEffectsPanel {...cards} />
      </div>
      <div data-banner-card="Banner fill">
        <BannerFillPanel {...cards} />
      </div>
      <div data-banner-card="Banner border">
        <BannerBorderPanel {...cards} />
      </div>
      <div data-banner-card="Banner transparency">
        <BannerTransparencyPanel banner={b} setBanner={set} />
      </div>
      <div data-banner-card="Banner size">
        <BannerSizePanel {...cards} />
      </div>
      <div data-banner-card="Banner position">
        <BannerPositionPanel banner={b} setBanner={set} />
      </div>

      <ElementPosition theme={theme} id="title" patchLayout={patchLayout} label="Title block" />

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          /* `fillMode`, the corners set one by one and the line's glow are
             named as undefined so the merge cannot keep a special fill (glass ·
             metallic · pattern), a hand-set corner or a glow the plate wore */
          onClick={() => {
            const fresh = cloneBanner(DEFAULT_BANNER);
            setTheme({
              banner: {
                ...fresh,
                fillMode: undefined,
                cornersIndependent: undefined,
                corners: undefined,
                border: { ...fresh.border, glow: undefined },
              },
            });
          }}
          className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
        >
          Reset banner design
        </button>
      </div>
    </div>
  );
}
