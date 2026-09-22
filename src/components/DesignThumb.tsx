import type { CSSProperties } from "react";
import { bannerCss, gradientCss } from "../lib/banner";
import { designThumb } from "../lib/backgroundDesigns";
import { computeFrameCss } from "../lib/frameDesigns";
import { optionRowBackdrop } from "../lib/optionBulletColors";
import { optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import { DEFAULT_BADGE_PLATE, DEFAULT_THEME, type ThemeSettings } from "../lib/types";
import type { SlideDesignPreset } from "../lib/slideDesigns";
import { NumberStylePreview } from "./NumberStylePicker";
import OptionBulletMarker from "./OptionBulletMarker";

/**
 * The miniature a slide design paints in the gallery.
 *
 * It is not a scaled-down slide — it is the design's own materials, drawn small:
 * the real frame CSS (`computeFrameCss`), the real board gradient and pattern
 * art, the real title plate (`bannerCss`), the real question marker
 * (`NumberStylePreview`), the real option markers and the real row chrome
 * (`optionRowStyle`). Text is reduced to bars, so a hundred thumbnails stay
 * cheap while still telling one look from the next at a glance.
 */

/** the full theme a design paints, cached — thumbnails and tests share it */
const PREVIEW = new Map<string, ThemeSettings>();

export function previewTheme(preset: SlideDesignPreset): ThemeSettings {
  const hit = PREVIEW.get(preset.id);
  if (hit) return hit;
  // `showNumber` is forced on for the gallery only: a marker reads as a marker
  // when the numeral is in it, and the field is not part of any design.
  const t = { ...DEFAULT_THEME, ...preset.theme, showNumber: true } as ThemeSettings;
  PREVIEW.set(preset.id, t);
  return t;
}

/** title plate CSS with the slide-scale positioning stripped out */
function plateCss(t: ThemeSettings): { plate: CSSProperties; isRule: boolean } {
  const box = bannerCss(t.banner, t.titleColor).box;
  // the miniature lays the plate out itself (a fixed inset), so the stage's own
  // geometry and the glow's scale are stripped and only the paint is kept — the
  // shape's own 630px width among it, which would otherwise win over the inset
  // and paint a chip wider than the card
  const {
    position: _p,
    inset: _i,
    left: _l,
    right: _r,
    bottom: _b,
    top: _t,
    width: _w,
    height: _h,
    transform: _tf,
    pointerEvents: _pe,
    ...rest
  } = box as CSSProperties & Record<string, unknown>;
  if (t.banner.shape === "none") return { plate: { display: "none" }, isRule: false };
  return { plate: rest as CSSProperties, isRule: t.banner.shape === "underline" };
}

const bar = (color: string, height: number, width: string, opacity = 1, radius = 2): CSSProperties => ({
  height,
  width,
  background: color,
  opacity,
  borderRadius: radius,
  display: "block",
  flex: "0 0 auto",
});

interface Props {
  preset: SlideDesignPreset;
}

export default function DesignThumb({ preset }: Props) {
  const t = previewTheme(preset);
  const bg = t.background;
  const frameCss = computeFrameCss(t.frame, t.showFrame);
  const ring = Math.max(0, Math.round(frameCss.outerPadding / 7));
  const board = gradientCss(bg.gradient, t.board);
  const art = designThumb(bg.design);
  const { plate, isRule } = plateCss(t);
  const chip = t.badgePlate ?? DEFAULT_BADGE_PLATE;
  const chrome = optionRowStyle((t.optionStyle ?? "plain") as OptionStyle, t, t.optionAccent, false);
  const rowBg = optionRowBackdrop(t, false);
  const vignette = bg.vignette
    ? `inset 0 0 ${Math.round(6 + bg.vignette / 6)}px rgba(0,0,0,${Math.min(0.6, bg.vignette / 130)})`
    : undefined;

  return (
    <span
      data-design-thumb={preset.id}
      className="relative block w-full overflow-hidden"
      style={{
        aspectRatio: "16 / 9",
        background: frameCss.ringBackground,
        boxShadow: frameCss.ringBoxShadow === "none" ? undefined : frameCss.ringBoxShadow,
        border: frameCss.ringBorder,
        borderRadius: Math.max(2, Math.round(frameCss.outerRadius / 3)),
        padding: ring,
      }}
    >
      {/* ------------------------------------------------------------ board */}
      <span
        className="relative block h-full w-full overflow-hidden"
        style={{
          background: board,
          borderRadius: Math.max(1, Math.round(frameCss.innerRadius / 3)),
          boxShadow: [frameCss.boardBoxShadow === "none" ? "" : frameCss.boardBoxShadow, vignette ?? ""]
            .filter(Boolean)
            .join(", ") || undefined,
        }}
      >
        {/* pattern art */}
        {bg.design ? (
          <span className="pointer-events-none absolute inset-0 block" style={{ ...art, opacity: bg.designOpacity ?? 1 }} />
        ) : null}

        {/* ------------------------------------------- badges · title · chip */}
        <span className="absolute inset-x-[4%] top-[7%] flex items-start justify-between gap-[3%]">
          {/* Badge 1 + Badge 2 */}
          <span className="flex w-[20%] flex-col items-start gap-[2px]">
            {t.showBrandTop ? (
              <span
                style={bar(
                  t.brandTopColor || t.brandColor,
                  Math.max(2, Math.min(4, Math.round((t.brandTopSize ?? 25) / 9))),
                  "90%",
                  0.95,
                )}
              />
            ) : null}
            {t.showBrandBottom ? (
              <span
                style={bar(
                  t.brandBottomColor || t.brandColor,
                  Math.max(2, Math.min(5, Math.round((t.brandBottomSize ?? 27) / 8))),
                  "70%",
                  0.95,
                )}
              />
            ) : null}
          </span>

          {/* title + its plate */}
          <span className="relative flex w-[52%] justify-center">
            {!isRule ? (
              <span
                className="pointer-events-none absolute block"
                style={{ ...plate, inset: "-35% -6%", height: undefined }}
              />
            ) : null}
            <span
              className="relative block"
              style={bar(t.titleColor, 4, "86%", 1, plate.borderRadius ? 2 : 1)}
            />
            {isRule ? (
              <span className="absolute -bottom-[3px] left-[7%] block" style={{ ...plate, width: "86%", height: 2 }} />
            ) : null}
          </span>

          {/* Badge 3 */}
          <span className="flex w-[20%] items-start justify-end">
            <span
              className="relative flex items-center justify-center"
              style={{
                width: "88%",
                height: 7,
                background: chip.enabled ? chip.color : "transparent",
                borderRadius: Math.min(6, Math.max(1, chip.radius / 100)),
                border: chip.border.enabled ? `1px solid ${chip.border.color}` : undefined,
                opacity: chip.enabled ? chip.opacity : 1,
              }}
            >
              <span style={bar(t.badgeColor, 2, "62%", 0.95, 1)} />
            </span>
          </span>
        </span>

        {/* ---------------------------------------- question bullet + stem */}
        <span className="absolute inset-x-[5%] top-[40%] flex items-center gap-[4px]">
          {t.showBullet && t.numberStyle !== "none" ? (
            <span className="flex flex-[0_0_auto] items-center">
              <NumberStylePreview style={t.numberStyle} theme={t} size={13} number="৭" />
            </span>
          ) : null}
          <span style={bar(t.questionColor, 3, "72%", 0.92)} />
        </span>

        {/* ------------------------------------------------- option rows */}
        <span className="absolute bottom-[7%] right-[5%] flex w-[40%] flex-col gap-[2px]">
          {["ক", "খ", "গ", "ঘ"].map((key, i) => (
            <span
              key={key}
              className="flex items-center gap-[3px]"
              style={{
                ...chrome.row,
                ...(rowBg ?? {}),
                padding: "1px 2px",
                opacity: i > 2 ? 0.85 : 1,
              }}
            >
              <OptionBulletMarker theme={t} color={t.optionAccent} size={9} keyText={key} optionStyle={t.optionStyle as OptionStyle} />
              <span style={bar(t.optionTextColor, 2, `${88 - i * 9}%`, 0.8, 1)} />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
