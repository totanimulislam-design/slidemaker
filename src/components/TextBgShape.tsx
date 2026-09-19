import type { CSSProperties, ReactNode } from "react";
import type { TextBgShape } from "../lib/types";
import {
  bgShapeIsOn,
  bgStrokeDash,
  polygonPointsAttr,
  textBgRender,
  type TextBgBehindLayer,
  type TextBgBorderSpec,
  type TextBgKindDef,
  type TextBgRender,
} from "../lib/textBgShape";

/**
 * The background shape painted behind a text part.
 *
 * `TextBgShapeBox` wraps the glyphs of ONE text part — the title, a brand
 * line, the badge, the number inside the question bullet, the question stem,
 * an option's text, the footnote, the letter inside an option marker or a
 * custom text box — and paints the plate in its own layer under them:
 *
 *   <span wrapper (padding = the plate's room around the glyphs)>
 *     <span layer (opacity · nudge / skew / rotation · shadows, glows, fades)>
 *       behind…  fill  overlay  border
 *     </span>
 *     {glyphs}
 *   </span>
 *
 * The wrapper is an isolated stacking context and the layer sits at z-index
 * −1 inside it, so the plate is always under the text and never under the
 * slide. With no shape on, the glyphs are returned untouched: no wrapper, no
 * layer — the DOM of an unstyled part does not change.
 */

interface Props {
  shape: TextBgShape | undefined;
  children: ReactNode;
  /** extra styles for the wrapper (previews force a size) */
  style?: CSSProperties;
  className?: string;
}

/** one silhouette pass: a CSS box for the box / mark families, an SVG polygon for the poly family */
function Silhouette({
  render,
  css,
  fill,
  border,
}: {
  render: TextBgRender;
  css: CSSProperties;
  /** solid colour; "" = no fill */
  fill: string;
  border?: TextBgBorderSpec;
}) {
  const { kind, clip } = render;
  if (kind.family === "poly" && kind.points) {
    const dash = border ? bgStrokeDash(border.style, border.width) : undefined;
    return (
      <span style={{ ...css, ...(clip.inset ?? {}) }} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", display: "block" }}>
          <polygon
            points={polygonPointsAttr(kind.points)}
            fill={fill || "none"}
            stroke={border ? border.color : "none"}
            strokeWidth={border ? border.width : 0}
            strokeDasharray={dash}
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
      style={{
        ...css,
        ...(clip.inset ?? {}),
        ...(clip.radius ? { borderRadius: clip.radius } : {}),
        ...(fill ? { background: fill } : {}),
        ...(border ? { border: `${border.width}px ${border.style} ${border.color}`, boxSizing: "border-box" } : {}),
      }}
    />
  );
}

function Behind({ render, layer }: { render: TextBgRender; layer: TextBgBehindLayer }) {
  return (
    <Silhouette
      render={render}
      css={layer.css}
      fill={layer.fill}
      border={layer.stroke ? { color: layer.stroke, width: layer.strokeWidth, style: "solid" } : undefined}
    />
  );
}

/** the plate's layer alone — the renderer's building block, also used by the previews */
export function TextBgLayer({ render, style }: { render: TextBgRender; style?: CSSProperties }) {
  const { kind, fill, overlay, border, behind, layer } = render;
  return (
    <span aria-hidden="true" data-text-bg-layer={kind.id} style={{ ...layer, ...style }}>
      {behind.map((b, i) => (
        <Behind key={i} render={render} layer={b} />
      ))}
      {/* fill pass: background + silhouette (already cut in `fill`) */}
      <span data-text-bg-fill="" style={fill} />
      {overlay && <span data-text-bg-overlay="" style={overlay} />}
      {border && (
        <Silhouette
          render={render}
          css={{ position: "absolute", inset: 0 }}
          fill=""
          border={border}
        />
      )}
    </span>
  );
}

export default function TextBgShapeBox({ shape, children, style, className }: Props) {
  const render = textBgRender(shape);
  if (!render) return <>{children}</>;
  return (
    <span className={className} data-text-bg={render.kind.id} style={{ ...render.wrapper, ...style }}>
      <TextBgLayer render={render} />
      {children}
    </span>
  );
}

/** what MathText needs to paint a plate per line / behind the whole text */
export interface TextBgWrap {
  scope: "line" | "block";
  render: (children: ReactNode) => ReactNode;
}

/** the MathText `wrap` for a part's background shape (undefined when the part paints none) */
export function textBgWrap(shape: TextBgShape | undefined): TextBgWrap | undefined {
  if (!bgShapeIsOn(shape)) return undefined;
  return {
    scope: shape!.scope ?? "block",
    render: (children) => <TextBgShapeBox shape={shape}>{children}</TextBgShapeBox>,
  };
}

/**
 * A live thumbnail of a plate: the real renderer at a fixed size, scaled
 * down, so a preset tile shows exactly the plate it will paint.
 */
export function TextBgPreview({
  shape,
  sample = "Ag",
  scale = 0.6,
  textColor = "#ffffff",
  width = 84,
  height = 40,
}: {
  shape: TextBgShape;
  sample?: string;
  scale?: number;
  textColor?: string;
  width?: number;
  height?: number;
}) {
  return (
    <span
      className="flex items-center justify-center overflow-hidden"
      style={{ width, height }}
      aria-hidden="true"
    >
      <span style={{ transform: `scale(${scale})`, transformOrigin: "center", display: "inline-block", whiteSpace: "nowrap" }}>
        <TextBgShapeBox shape={{ ...shape, enabled: true }}>
          <span style={{ color: textColor, fontSize: 20, fontWeight: 800, lineHeight: 1.1, fontFamily: "Inter, 'Noto Sans Bengali', system-ui, sans-serif" }}>
            {sample}
          </span>
        </TextBgShapeBox>
      </span>
    </span>
  );
}

export type { TextBgKindDef };
