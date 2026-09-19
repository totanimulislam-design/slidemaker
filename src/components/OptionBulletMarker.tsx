import type { CSSProperties } from "react";
import type { ThemeSettings } from "../lib/types";
import { renderOptionBulletMarker, type OptionBulletShape } from "../lib/optionBulletShapes";
import { optionBadgeStyle, type OptionStyle } from "../lib/optionStyles";
import { universalStack } from "../lib/fonts";
import { offsetCss, optionBulletTypeface, typefaceCss, typefaceInlineCss } from "../lib/boxFonts";
import TextBgShapeBox from "./TextBgShape";

/**
 * One option bullet: ink, fill, border and the background shape painted behind
 * it. Shared by the canvas, the thumbnails and the pickers so every surface
 * shows exactly what the export will contain.
 */
interface Props {
  theme: ThemeSettings;
  /** the marker colour everything auto-falls-back to */
  color: string;
  size: number;
  keyText: string;
  highlight?: boolean;
  /** merge the option-row style's own badge treatment (canvas + row previews) */
  optionStyle?: OptionStyle;
  fontFamily?: string;
  /** extra overrides (thumbnail scaling, previews…) */
  style?: CSSProperties;
}

export default function OptionBulletMarker({
  theme,
  color,
  size,
  keyText,
  highlight = false,
  optionStyle,
  fontFamily,
  style,
}: Props) {
  const shape = (theme.optionBulletShape ?? "circle") as OptionBulletShape;
  const marker = renderOptionBulletMarker(shape, theme, color, size, highlight, keyText);
  const badge = optionStyle ? optionBadgeStyle(optionStyle, theme, color, size, highlight) : undefined;

  /**
   * "Text inside option bullet" — the letter is its own text box. Its typeface
   * (the marker's flat theme fields folded under `boxFonts.optionBullet`, see
   * lib/boxFonts) paints the LETTER NODE: face, size, weight, case, spacing,
   * opacity, effect and nudge all land on the glyph and never on the
   * marker's silhouette, fill or ring. Every field is optional and defaults to
   * whatever the marker shape derives, so an untouched deck renders exactly as
   * before. The caller's `style` still wins on the marker box: shape pickers
   * use it to force a fixed preview size.
   */
  const tf = optionBulletTypeface(theme);
  const face = tf.family ? universalStack(`'${tf.family}'`, theme.arabicFont) : fontFamily;
  // a caller-forced size (the shape pickers' fixed previews) is the base the
  // letter scales from; otherwise the shape's own derived size is
  const forced = typeof style?.fontSize === "number" ? (style.fontSize as number) : undefined;
  const baseSize = forced ?? (typeof marker.style.fontSize === "number" ? (marker.style.fontSize as number) : undefined);
  // the letter's own ink (an explicit override) beats the marker palette;
  // `typefaceCss` sets a colour only when the typeface carries one
  const letterCss = typefaceCss(
    tf,
    { display: "inline-block", ...(baseSize !== undefined ? { fontSize: baseSize } : {}) },
    face,
  );
  if (typeof letterCss.fontSize === "number") letterCss.fontSize = Math.max(0, Math.round(letterCss.fontSize));
  const inline = typefaceInlineCss(tf);
  const nudge = offsetCss(tf, marker.innerStyle?.transform as string | undefined);
  const justify = tf.align === "left" ? "flex-start" : tf.align === "right" ? "flex-end" : tf.align === "center" ? "center" : undefined;

  // the letter's own background shape sits between the glyph and the marker's fill
  const letter = <TextBgShapeBox shape={tf.bgShape}>{inline ? <span style={inline}>{marker.content}</span> : marker.content}</TextBgShapeBox>;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
      {marker.backplate ? <span style={marker.backplate} /> : null}
      <span
        style={{
          ...badge,
          ...marker.style,
          position: "relative",
          ...(justify ? { justifyContent: justify } : {}),
          fontFamily: face,
          ...style,
        }}
      >
        <span style={{ ...(marker.innerStyle ?? {}), ...letterCss, ...nudge }}>{letter}</span>
      </span>
    </span>
  );
}
