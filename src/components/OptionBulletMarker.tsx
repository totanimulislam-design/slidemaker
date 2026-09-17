import type { CSSProperties } from "react";
import type { ThemeSettings } from "../lib/types";
import { renderOptionBulletMarker, type OptionBulletShape } from "../lib/optionBulletShapes";
import { optionBadgeStyle, type OptionStyle } from "../lib/optionStyles";
import { universalStack } from "../lib/fonts";

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
   * "Text inside option bullet" — the letter's own face, size, weight and case.
   * Every field is optional and defaults to whatever the marker shape derives,
   * so an untouched deck renders exactly as before. The caller's `style` still
   * wins last: shape pickers use it to force a fixed preview size.
   */
  const textCss: CSSProperties = {};
  const pct = theme.optionBulletTextSize ?? 100;
  if (pct !== 100 && typeof marker.style.fontSize === "number") {
    textCss.fontSize = Math.max(6, Math.round((marker.style.fontSize as number) * (pct / 100)));
  }
  if (theme.optionBulletTextWeight) textCss.fontWeight = theme.optionBulletTextWeight;
  if (theme.optionBulletUppercase) textCss.textTransform = "uppercase";
  const face = theme.optionBulletFontFamily
    ? universalStack(`'${theme.optionBulletFontFamily}'`, theme.arabicFont)
    : fontFamily;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
      {marker.backplate ? <span style={marker.backplate} /> : null}
      <span
        style={{
          ...badge,
          ...marker.style,
          position: "relative",
          ...textCss,
          fontFamily: face,
          ...style,
        }}
      >
        {marker.innerStyle ? <span style={marker.innerStyle}>{marker.content}</span> : marker.content}
      </span>
    </span>
  );
}
