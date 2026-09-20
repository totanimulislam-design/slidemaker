import type { CSSProperties, ReactNode } from "react";
import { insetPoints, polygonPointsAttr, type NumberOutline, type NumberRender } from "../lib/numberStyles";

/**
 * The question bullet, painted once for every surface.
 *
 * `renderNumberStyle` hands back two things and this component puts them in the
 * DOM: the marker's **box** (size, centring, padding, nudge) and its
 * **surface** — the silhouette's fill, outline, corners, shadow and body
 * transparency, on a layer of its own. Because the surface is a sibling of the
 * number node rather than its parent, a faded or transparent marker never fades
 * the number: the digits keep the ink, typeface and opacity that
 * *Text inside question bullet* gave them.
 *
 * Cut silhouettes (star, hexagon, ticket, seal…) can't carry a CSS border, so
 * their outline is stroked over the clip as an SVG polygon — solid, dashed,
 * dotted or doubled, exactly as picked in the toolbar. The board, the
 * thumbnails, the exports and every preview go through here, so they all paint
 * the same marker.
 */
interface Props {
  render: NumberRender;
  /** extra styles for the marker's box (previews force a size) */
  style?: CSSProperties;
  /** the number node painted on top — the caller owns its typeface */
  children?: ReactNode;
}

export default function NumberBullet({ render, style, children }: Props) {
  const { style: box, surface, outline, marks } = render;
  const painted = Object.keys(surface).length > 0;
  return (
    <div style={{ position: "relative", ...box, ...style }}>
      {/* the body paints first and out of flow, so the digits stay the box's
          first text node — and a faded marker never fades the number */}
      {painted && (
        <div
          aria-hidden="true"
          data-bullet-surface=""
          style={{ position: "absolute", inset: 0, boxSizing: "border-box", ...surface }}
        />
      )}
      {outline && <BulletOutline {...outline} />}
      {children}
      {/* decorative marks sit above the number (the slashed design's tick) */}
      {marks?.map((mark, i) => <span key={i} aria-hidden="true" data-bullet-mark="" style={mark} />)}
    </div>
  );
}

function BulletOutline({ points, width, color, style, dash }: NumberOutline) {
  const inner = style === "double" ? insetPoints(points, 0.84) : null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-bullet-outline={style}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", display: "block", pointerEvents: "none" }}
    >
      {inner && (
        <polygon
          points={polygonPointsAttr(inner)}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polygon
        points={polygonPointsAttr(points)}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
