import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import type { Gradient } from "../lib/types";
import { insetPoints, polygonPointsAttr, type NumberClip, type NumberOutline, type NumberRender } from "../lib/numberStyles";
import type { ShapeEffectBehind } from "../lib/shapeEffects";

/**
 * The question bullet, painted once for every surface.
 *
 * `renderNumberStyle` hands back the marker's **box** (size, centring, padding,
 * nudge) and its **body** — the silhouette's fill, outline, corners, shadow and
 * transparency, plus the shape effect's own passes — and this component puts
 * them in the DOM:
 *
 *   <div box (an isolated stacking context)>
 *     <div body layer  (z-index −1: always UNDER the number)>
 *       behind…  surface  overlay  reflection
 *     </div>
 *     outline (SVG)  ·  the number  ·  marks
 *   </div>
 *
 * Because the body is a sibling of the number node rather than its parent, a
 * faded or transparent marker never fades the number: the digits keep the ink,
 * typeface and opacity that *Text inside question bullet* gave them. The body
 * layer sits at z-index −1 inside an isolated box, so it is always under them
 * and never under the slide.
 *
 * Cut silhouettes (star, hexagon, ticket, seal, sticker…) can't carry a CSS
 * border, so their outline is stroked over the clip as an SVG polygon — solid,
 * dashed, dotted or doubled, in a solid colour or a gradient, exactly as picked
 * in the toolbar. The board, the thumbnails, the exports and every preview go
 * through here, so they all paint the same marker.
 */
interface Props {
  render: NumberRender;
  /** extra styles for the marker's box (previews force a size) */
  style?: CSSProperties;
  /** the number node painted on top — the caller owns its typeface */
  children?: ReactNode;
}

/** the CSS that cuts a pass to the silhouette (a polygon clip, or the corners) */
const clipCss = (clip: NumberClip | undefined): CSSProperties => {
  if (!clip) return {};
  const out: CSSProperties = {};
  if (clip.borderRadius) out.borderRadius = clip.borderRadius;
  if (clip.clipPath) out.clipPath = clip.clipPath;
  return out;
};

/** one silhouette pass: a CSS box, or an SVG polygon for a cut silhouette */
function Silhouette({
  clip,
  css,
  fill,
  stroke,
  strokeWidth,
}: {
  clip: NumberClip | undefined;
  css: CSSProperties;
  /** solid colour; "" = no fill */
  fill: string;
  /** outline colour; "" = none */
  stroke: string;
  strokeWidth: number;
}) {
  if (clip?.points) {
    return (
      <span aria-hidden="true" data-bullet-behind="" style={{ position: "absolute", inset: 0, ...css }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", display: "block" }}
        >
          <polygon
            points={polygonPointsAttr(clip.points)}
            fill={fill || "none"}
            stroke={stroke || "none"}
            strokeWidth={stroke ? strokeWidth : 0}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-bullet-behind=""
      style={{
        position: "absolute",
        inset: 0,
        boxSizing: "border-box",
        ...clipCss(clip),
        ...(fill ? { background: fill } : {}),
        ...(stroke ? { border: `${strokeWidth}px solid ${stroke}` } : {}),
        ...css,
      }}
    />
  );
}

export default function NumberBullet({ render, style, children }: Props) {
  const { style: box, surface, outline, marks, clip, effect } = render;
  const painted = Object.keys(surface).length > 0;
  const body = painted || !!effect;
  return (
    <div style={{ position: "relative", isolation: "isolate", ...box, ...style }}>
      {/* the body paints first and out of flow, so the digits stay the box's
          first text node — and a faded marker never fades the number */}
      {body && (
        <div aria-hidden="true" data-bullet-body="" style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", ...(effect?.layer ?? {}) }}>
          {effect?.behind.map((b: ShapeEffectBehind, i: number) => (
            <Silhouette key={i} clip={clip} css={b.css} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} />
          ))}
          {painted && (
            <div
              aria-hidden="true"
              data-bullet-surface=""
              style={{ position: "absolute", inset: 0, boxSizing: "border-box", ...surface, ...(effect?.surface ?? {}) }}
            />
          )}
          {effect?.overlay && (
            <div
              aria-hidden="true"
              data-bullet-overlay=""
              style={{ position: "absolute", inset: 0, boxSizing: "border-box", ...clipCss(clip), ...effect.overlay }}
            />
          )}
          {effect?.reflection && (painted || effect.overlay) && (
            <div aria-hidden="true" data-bullet-reflection="" style={effect.reflection}>
              <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", ...clipCss(clip), ...surface, ...effect.overlay }} />
            </div>
          )}
        </div>
      )}
      {outline && <BulletOutline {...outline} />}
      {children}
      {/* decorative marks sit above the number (the slashed design's tick) */}
      {marks?.map((mark, i) => <span key={i} aria-hidden="true" data-bullet-mark="" style={mark} />)}
    </div>
  );
}

function BulletOutline({ points, width, color, style, dash, gradient }: NumberOutline) {
  const inner = style === "double" ? insetPoints(points, 0.84) : null;
  const uid = useId().replace(/[:]/g, "");
  const paint = gradientPaint(gradient, color, uid);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-bullet-outline={style}
      data-gradient={gradient ? "on" : undefined}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", display: "block", pointerEvents: "none" }}
    >
      {gradient && (
        <defs>
          <GradientDef gradient={gradient} id={paint.id} fallback={color} />
        </defs>
      )}
      {inner && (
        <polygon
          points={polygonPointsAttr(inner)}
          fill="none"
          stroke={paint.stroke}
          strokeWidth={width}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polygon
        points={polygonPointsAttr(points)}
        fill="none"
        stroke={paint.stroke}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** what a gradient stroke paints with: an SVG paint server, else the solid colour */
function gradientPaint(gradient: Gradient | undefined, color: string, uid: string): { stroke: string; id: string } {
  if (!gradient) return { stroke: color, id: uid };
  const id = `bullet-line-${uid}`;
  return { stroke: `url(#${id})`, id };
}

/**
 * The SVG paint server for a gradient line. A mesh gradient is a stack of
 * radial colour blobs in CSS, which SVG has no equivalent of, so it falls back
 * to a linear ramp through the same stops — the line still reads as a gradient.
 */
function GradientDef({ gradient, id, fallback }: { gradient: Gradient; id: string; fallback: string }) {
  const stops = [...(gradient.stops ?? [])].sort((a, b) => a.at - b.at);
  const list = stops.length >= 2 ? stops : [{ color: fallback, at: 0 }, { color: fallback, at: 100 }];
  if (gradient.type === "radial") {
    return (
      <radialGradient id={id} cx={`${gradient.cx ?? 50}%`} cy={`${gradient.cy ?? 50}%`} r="70%">
        {list.map((st, i) => (
          <stop key={i} offset={`${Math.max(0, Math.min(100, st.at))}%`} stopColor={st.color} />
        ))}
      </radialGradient>
    );
  }
  /* a CSS angle of 0deg points up and grows clockwise; SVG's x1/y1 → x2/y2 is
     the same ramp expressed as a vector, so 90deg (→ right) is 0,0 → 1,0 */
  const rad = (((gradient.angle ?? 90) - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return (
    <linearGradient id={id} x1={`${50 - dx * 50}%`} y1={`${50 - dy * 50}%`} x2={`${50 + dx * 50}%`} y2={`${50 + dy * 50}%`}>
      {list.map((st, i) => (
        <stop key={i} offset={`${Math.max(0, Math.min(100, st.at))}%`} stopColor={st.color} />
      ))}
    </linearGradient>
  );
}
