import type { CSSProperties } from "react";
import type { ShapeItem } from "../lib/shapes";
import { polygonPoints } from "../lib/shapes";
import { withAlpha } from "../lib/color";
import { hasGradientFill, shapeFill } from "../lib/shapeDesign";
import type { ElementId } from "../lib/types";

/**
 * The little preview at the head of a layer row.
 *
 * Canva shows what each layer IS, not just its name, so a stack of five
 * rectangles is still readable. Drawn items get a miniature of their real
 * geometry (fill, gradient, outline, picture, the text itself); built-in slide
 * elements get a schematic of where they sit on the board.
 *
 * It is deliberately a tiny, dependency-free render — never an html-to-image
 * snapshot — so a 40-row list costs nothing to paint and stays live while the
 * user restyles a shape.
 */

const BOX = 34;

/** miniature of a drawn item: shapes, text boxes and images */
function ShapeThumb({ s }: { s: ShapeItem }) {
  if (s.kind === "image") {
    return s.src ? (
      <img
        src={s.src}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: s.mask === "circle" ? "50%" : 3,
          opacity: s.opacity ?? 1,
        }}
      />
    ) : (
      <span style={{ fontSize: 13, lineHeight: 1 }}>🖼</span>
    );
  }

  if (s.kind === "text") {
    return (
      <span
        style={{
          fontSize: 13,
          fontWeight: s.bold ? 800 : 700,
          fontStyle: s.italic ? "italic" : undefined,
          lineHeight: 1,
          color: s.textGradient?.enabled ? "#e2e8f0" : s.textColor || "#e2e8f0",
          textShadow: "0 1px 2px rgba(0,0,0,.6)",
        }}
      >
        T
      </span>
    );
  }

  const fill = hasGradientFill(s) ? shapeFill(s) : s.fill ? withAlpha(s.fill, s.fillOpacity) : "none";
  const stroke = s.stroke || (fill === "none" ? "#94a3b8" : "none");
  const sw = s.stroke ? Math.max(1, Math.min(3, s.strokeWidth)) : fill === "none" ? 1.5 : 0;
  const dash = s.dash || s.lineStyle === "dashed" ? "5 4" : s.lineStyle === "dotted" ? "1 4" : undefined;

  if (s.kind === "line" || s.kind === "arrow") {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
        <line
          x1="3"
          y1="12"
          x2={s.kind === "arrow" ? 17 : 21}
          y2="12"
          stroke={s.stroke || "#94a3b8"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        {s.kind === "arrow" && <path d="M16 8 L21 12 L16 16 Z" fill={s.stroke || "#94a3b8"} />}
      </svg>
    );
  }

  const poly = polygonPoints(s.kind);
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash, vectorEffect: "non-scaling-stroke" as const };
  // keep the item's real aspect so a wide banner does not look like a square
  const ratio = s.h > 0 ? Math.max(0.3, Math.min(3, s.w / s.h)) : 1;
  const w = ratio >= 1 ? 22 : 22 * ratio;
  const h = ratio >= 1 ? 22 / ratio : 22;
  const x = (24 - w) / 2;
  const y = (24 - h) / 2;

  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      {hasGradientFill(s) && (
        <defs>
          <linearGradient id={`lt-${s.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {[...s.gradient!.stops]
              .sort((a, b) => a.at - b.at)
              .map((st, i) => (
                <stop key={i} offset={`${st.at}%`} stopColor={st.color} />
              ))}
          </linearGradient>
        </defs>
      )}
      {(() => {
        const f = hasGradientFill(s) ? `url(#lt-${s.id})` : fill;
        if (s.kind === "ellipse") return <ellipse cx="12" cy="12" rx={w / 2} ry={h / 2} {...common} fill={f} />;
        if (poly)
          return (
            <polygon
              points={poly
                .split(" ")
                .map((p) => {
                  const [px, py] = p.split(",").map(Number);
                  return `${x + (px / 100) * w},${y + (py / 100) * h}`;
                })
                .join(" ")}
              {...common}
              fill={f}
            />
          );
        return (
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={s.kind === "rounded" ? 5 : s.cornerRadius ? 3 : 0}
            {...common}
            fill={f}
          />
        );
      })()}
    </svg>
  );
}

/**
 * Schematic of a built-in element: its real box, drawn inside a 16:9 board, so
 * the row shows WHERE on the slide that layer lives.
 */
function ElementThumb({ id, box }: { id: ElementId; box?: { x: number; y: number; w: number; h?: number; mode?: string } }) {
  const free = (box?.mode ?? "align") === "free";
  const w = Math.max(8, Math.min(100, box?.w ?? 40));
  const h = Math.max(8, Math.min(100, box?.h ?? (id === "options" ? 34 : id === "question" ? 22 : 14)));
  // aligned boxes store an alignment fraction; convert it to a left/top edge
  const left = free ? (box?.x ?? 0) : ((box?.x ?? 50) * (100 - w)) / 100;
  const top = free ? (box?.y ?? 0) : ((box?.y ?? 50) * (100 - h)) / 100;
  return (
    <svg viewBox="0 0 32 18" width="100%" height="100%" aria-hidden>
      <rect x="0.6" y="0.6" width="30.8" height="16.8" rx="2" fill="rgba(148,163,184,.12)" stroke="rgba(148,163,184,.35)" strokeWidth="0.8" />
      <rect
        x={Math.max(0.8, (left / 100) * 32)}
        y={Math.max(0.8, (top / 100) * 18)}
        width={Math.max(2, (w / 100) * 32)}
        height={Math.max(1.6, (h / 100) * 18)}
        rx="1"
        fill="rgba(56,189,248,.55)"
        stroke="rgba(125,211,252,.9)"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export default function LayerThumb({
  shape,
  elementId,
  box,
  dim,
  className,
  style,
}: {
  /** the drawn item behind this row, when there is one */
  shape?: ShapeItem;
  /** the built-in element behind this row, otherwise */
  elementId?: ElementId;
  box?: { x: number; y: number; w: number; h?: number; mode?: string };
  /** the layer is hidden — the preview greys out with it */
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      data-layer-thumb={shape ? shape.id : elementId}
      className={className}
      style={{
        width: BOX,
        height: BOX * 0.72,
        flex: `0 0 ${BOX}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 5,
        padding: 2,
        boxSizing: "border-box",
        background: "rgba(15,23,42,.85)",
        border: "1px solid rgba(148,163,184,.22)",
        opacity: dim ? 0.35 : 1,
        ...style,
      }}
    >
      {shape ? <ShapeThumb s={shape} /> : elementId ? <ElementThumb id={elementId} box={box} /> : null}
    </span>
  );
}
