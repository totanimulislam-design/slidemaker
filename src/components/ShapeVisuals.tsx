import type { CSSProperties } from "react";
import { polygonPoints, type ShapeItem } from "../lib/shapes";
import { withAlpha } from "../lib/color";
import { cssBorder, dashArray, hasGradientFill, itemStyle, shapeFill, textStyle } from "../lib/shapeDesign";
import { BAND_CONTENT, safeZ } from "../lib/zorder";
import { shapeCapturesBox } from "../lib/scene";
import MathText from "./MathText";

/**
 * SHAPE VISUALS — pure rendering of the drawn shapes / text boxes / images.
 *
 * This component paints shapes and nothing else: it holds no gesture code, no
 * selection state and no event handlers. Every wrapper is tagged with
 * `data-obj="shape:<id>"` so the ONE object interaction system
 * (components/InteractionLayer.tsx) can hit-test, select, move, resize,
 * rotate and edit it. Pointer visibility is set up for that hit-testing:
 *
 *   • non-editable renders (thumbnails, presenter, exports) → pointer-events none
 *   • locked shapes → pointer-events none (reachable from the layers panel only)
 *   • "solid" shapes (images, filled shapes, text boxes with a background)
 *     capture clicks over their whole box
 *   • outline-only shapes capture clicks ONLY over their painted pixels, so a
 *     transparent container can never block the editable object underneath.
 */

interface Props {
  shapes: ShapeItem[];
  editable: boolean;
  fontFamily: string;
}

const MASKS: Record<string, string> = {
  circle: "ellipse(50% 50% at 50% 50%)",
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  triangle: "polygon(50% 0, 100% 100%, 0 100%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
};

/** Bitmap image with fit / opacity / radius / flip / mask / border. */
function ImageGraphic({ s }: { s: ShapeItem }) {
  const mask = s.mask && s.mask !== "none" && s.mask !== "rounded" ? MASKS[s.mask] : undefined;
  const radius = s.mask === "rounded" ? "12%" : s.radius ? `${s.radius}%` : s.cornerRadius ? s.cornerRadius : 0;
  const flip = `${s.flipH ? "scaleX(-1)" : ""} ${s.flipV ? "scaleY(-1)" : ""}`.trim();
  const border = cssBorder(s);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        clipPath: mask,
        overflow: "hidden",
        border,
        boxSizing: "border-box",
        // follow the wrapper: never clickable while the wrapper is transparent (locked shapes)
        pointerEvents: "inherit",
        background: hasGradientFill(s) ? shapeFill(s) : s.fill ? withAlpha(s.fill, s.fillOpacity) : undefined,
        boxShadow: s.shadow && !mask ? "0 12px 30px rgba(0,0,0,.55)" : undefined,
      }}
    >
      {s.src ? (
        <img
          src={s.src}
          alt=""
          draggable={false}
          crossOrigin={s.src.startsWith("data:") ? undefined : "anonymous"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: s.fit ?? "contain",
            opacity: s.opacity ?? 1,
            transform: flip || undefined,
            display: "block",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,.5)",
            fontSize: 22,
            pointerEvents: "inherit",
            background: "repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 10px, transparent 10px 20px)",
            border: "2px dashed rgba(255,255,255,.35)",
            boxSizing: "border-box",
          }}
        >
          🖼 no image
        </div>
      )}
    </div>
  );
}

/** <defs> with a linear/radial gradient for the shape's fill */
function GradientDefs({ s, id }: { s: ShapeItem; id: string }) {
  const g = s.gradient;
  if (!g?.enabled) return null;
  const stops = [...g.stops].sort((a, b) => a.at - b.at);
  // mesh has no SVG equivalent — approximate it with a radial blend of all stops
  const kind = g.type === "mesh" ? "radial" : g.type;
  if (kind === "radial") {
    return (
      <defs>
        <radialGradient id={id} cx={`${g.cx ?? 50}%`} cy={`${g.cy ?? 50}%`} r="65%">
          {stops.map((st, i) => (
            <stop key={i} offset={`${st.at}%`} stopColor={st.color} stopOpacity={s.fillOpacity} />
          ))}
        </radialGradient>
      </defs>
    );
  }
  // CSS angle → SVG vector (0° = to top, 90° = to right)
  const a = ((g.angle - 90) * Math.PI) / 180;
  const x1 = 50 - 50 * Math.cos(a);
  const y1 = 50 - 50 * Math.sin(a);
  const x2 = 50 + 50 * Math.cos(a);
  const y2 = 50 + 50 * Math.sin(a);
  return (
    <defs>
      <linearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
        {stops.map((st, i) => (
          <stop key={i} offset={`${st.at}%`} stopColor={st.color} stopOpacity={s.fillOpacity} />
        ))}
      </linearGradient>
    </defs>
  );
}

/**
 * SVG for geometric shapes; text-only boxes render no SVG at all.
 * `paintedHit` = the wrapper must not swallow clicks over unpainted pixels:
 * the root svg is transparent to pointer events and only the *painted*
 * fill/stroke of each primitive stays clickable, so outline-only shapes and
 * background containers can't block the objects underneath them.
 */
function ShapeGraphic({ s, paintedHit = false }: { s: ShapeItem; paintedHit?: boolean }) {
  if (s.kind === "image") return <ImageGraphic s={s} />;
  const gradId = `g-${s.id}`;
  const fill = hasGradientFill(s) ? `url(#${gradId})` : s.fill ? withAlpha(s.fill, s.fillOpacity) : "none";
  const stroke = s.stroke || "none";
  const sw = s.strokeWidth;
  const dash = dashArray(s);
  const join = s.lineJoin ?? "round";
  const common = {
    fill,
    stroke,
    strokeWidth: sw,
    strokeDasharray: dash,
    strokeLinejoin: join,
    strokeLinecap: (s.lineStyle === "dotted" ? "round" : "butt") as "round" | "butt",
    vectorEffect: "non-scaling-stroke" as const,
    pointerEvents: (paintedHit ? "visiblePainted" : "inherit") as "visiblePainted" | "inherit",
  };

  if (s.kind === "text") {
    // text boxes can carry a background + border too
    const bg = hasGradientFill(s) ? shapeFill(s) : s.fill ? withAlpha(s.fill, s.fillOpacity) : undefined;
    const border = cssBorder(s);
    if (!bg && !border) return null;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bg,
          border,
          borderRadius: s.cornerRadius ?? 10,
          boxSizing: "border-box",
          pointerEvents: "inherit",
        }}
      />
    );
  }

  if (s.kind === "line" || s.kind === "arrow") {
    const id = `arr-${s.id}`;
    return (
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "inherit" }}>
        <GradientDefs s={s} id={gradId} />
        {s.kind === "arrow" && (
          <defs>
            <marker id={id} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
            </marker>
          </defs>
        )}
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke={stroke}
          strokeWidth={sw}
          strokeDasharray={dash}
          strokeLinecap="round"
          markerEnd={s.kind === "arrow" ? `url(#${id})` : undefined}
        />
      </svg>
    );
  }

  const poly = polygonPoints(s.kind);
  const r = s.cornerRadius ?? (s.kind === "rounded" ? 8 : 0);
  // the viewBox is 100×100 stretched; convert px radius to a modest % so it stays visible
  const rx = r > 0 ? Math.min(50, r / 4) : 0;
  const double = s.lineStyle === "double" && sw > 0;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: paintedHit ? "none" : "inherit" }}
    >
      <GradientDefs s={s} id={gradId} />
      {(s.kind === "rect" || s.kind === "rounded") && <rect x="0" y="0" width="100" height="100" rx={rx} ry={rx} {...common} />}
      {s.kind === "ellipse" && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
      {poly && <polygon points={poly} {...common} />}
      {double && (s.kind === "rect" || s.kind === "rounded") && (
        <rect
          x="6"
          y="8"
          width="88"
          height="84"
          rx={rx}
          ry={rx}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(1, sw * 0.6)}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: paintedHit ? "visiblePainted" : "inherit" }}
        />
      )}
      {double && s.kind === "ellipse" && (
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="44"
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(1, sw * 0.6)}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: paintedHit ? "visiblePainted" : "inherit" }}
        />
      )}
    </svg>
  );
}

export default function ShapeVisuals({ shapes, editable, fontFamily }: Props) {
  return (
    <>
      {shapes.map((s) => {
        const isText = s.kind === "text";
        const thinLine = s.kind === "line" || s.kind === "arrow";
        const solid = shapeCapturesBox(s); // captures clicks across its whole box?
        const clickable = editable && !s.locked;
        return (
          <div
            key={s.id}
            data-obj={`shape:${s.id}`}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.w}%`,
              height: `${s.h}%`,
              transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
              transformOrigin: "center center",
              zIndex: BAND_CONTENT + safeZ(s.z),
              boxSizing: "border-box",
              ...itemStyle(s),
              cursor: editable ? (s.locked ? "default" : "move") : undefined,
              touchAction: editable ? "none" : undefined,
              // dragging on painted glyphs must not start native text selection
              userSelect: editable ? "none" : undefined,
              // transparent/unpainted areas must not block the layers below
              pointerEvents: !clickable ? "none" : solid ? "auto" : "none",
            } as CSSProperties}
          >
            {thinLine && clickable && <div style={{ position: "absolute", left: 0, right: 0, top: -14, bottom: -14 }} />}
            <ShapeGraphic s={s} paintedHit={clickable && !solid} />

            {(isText || s.text) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: s.valign === "top" ? "flex-start" : s.valign === "bottom" ? "flex-end" : "center",
                  justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
                  padding: isText ? `${s.padding ?? 6}px ${(s.padding ?? 6) + 4}px` : "4% 6%",
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                <MathText
                  text={s.text}
                  style={{
                    fontFamily: s.fontFamily ? `'${s.fontFamily}', ${fontFamily}` : fontFamily,
                    fontSize: s.fontSize,
                    fontWeight: s.bold ? 700 : 500,
                    fontStyle: s.italic ? "italic" : "normal",
                    textAlign: s.align,
                    width: "100%",
                    // painted-only mode: only the glyphs themselves are clickable
                    ...(clickable && !solid ? { pointerEvents: "auto" as const } : { pointerEvents: "inherit" as const }),
                    ...textStyle(s),
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
