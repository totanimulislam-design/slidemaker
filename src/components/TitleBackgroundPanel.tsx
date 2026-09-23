import { BANNER_AUTO_FRAME_HEIGHT, DEFAULT_BANNER, cloneBanner, type BannerSettings, type Box, type DeckHeader, type ElementId, type ThemeSettings } from "../lib/types";
import { bannerCss } from "../lib/banner";
import {
  BannerBorderPanel,
  BannerBorderStylePanel,
  BannerEffectsPanel,
  BannerFillPanel,
  BannerPositionPanel,
  BannerPresetPanel,
  BannerRadiusPanel,
  BannerShapePanel,
  BannerSizePanel,
  BannerTransparencyPanel,
  BannerWeightPanel,
  bannerOf,
} from "./BannerDesignPanel";
import { boxStack } from "../lib/boxFonts";
import ElementPosition from "./ElementPosition";
import { PanelHead, Toggle } from "./ui";

/**
 * Navigation ▸ "Title background".
 *
 * The plate painted *behind* the heading, in the same order the toolbar's line
 * reads: the design presets, the silhouette, the effects, the fill and the
 * border (colour · radius · style · weight), the two transparencies, and then
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

export default function TitleBackgroundPanel({ theme, header, setTheme, setHeader, patchLayout }: Props) {
  const b: BannerSettings = bannerOf(theme);
  /**
   * `theme.titleBanner` is the legacy solid banner colour older decks read from,
   * so a colour pick writes both — the two can never drift apart.
   */
  const set = (p: Partial<BannerSettings>) =>
    setTheme({ banner: { ...b, ...p }, ...(p.color ? { titleBanner: p.color } : {}) });
  const css = bannerCss(b, theme.titleColor);

  const cards = { theme, banner: b, setBanner: set };

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
      <BannerPresetPanel {...cards} />
      <BannerShapePanel {...cards} />
      <BannerEffectsPanel theme={theme} banner={b} setBanner={set} />
      <BannerFillPanel {...cards} />
      <BannerBorderPanel banner={b} setBanner={set} />
      <BannerRadiusPanel banner={b} setBanner={set} />
      <BannerBorderStylePanel banner={b} setBanner={set} />
      <BannerWeightPanel banner={b} setBanner={set} />
      <BannerTransparencyPanel banner={b} setBanner={set} />
      <BannerSizePanel {...cards} />
      <BannerPositionPanel banner={b} setBanner={set} />

      <ElementPosition theme={theme} id="title" patchLayout={patchLayout} label="Title block" />

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          /* `fillMode` is named as undefined so the merge cannot keep a
             special fill (glass · metallic · pattern) the plate was wearing */
          onClick={() => setTheme({ banner: { ...cloneBanner(DEFAULT_BANNER), fillMode: undefined } })}
          className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
        >
          Reset banner design
        </button>
      </div>
    </div>
  );
}
