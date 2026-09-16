import type { CSSProperties } from "react";
import type { ThemeSettings } from "../lib/types";
import { renderOptionBulletMarker, type OptionBulletShape } from "../lib/optionBulletShapes";
import { optionBadgeStyle, type OptionStyle } from "../lib/optionStyles";

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

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
      {marker.backplate ? <span style={marker.backplate} /> : null}
      <span
        style={{
          ...badge,
          ...marker.style,
          position: "relative",
          fontFamily,
          ...style,
        }}
      >
        {marker.innerStyle ? <span style={marker.innerStyle}>{marker.content}</span> : marker.content}
      </span>
    </span>
  );
}
