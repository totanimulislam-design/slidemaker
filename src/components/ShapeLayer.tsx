import { useRef, useState, type CSSProperties } from "react";
import { polygonPoints, type ShapeItem } from "../lib/shapes";
import { withAlpha } from "../lib/color";
import { cssBorder, dashArray, hasGradientFill, itemStyle, shapeFill, textStyle } from "../lib/shapeDesign";
import { BAND_CONTENT, BAND_UI, safeZ } from "../lib/zorder";
import MathText from "./MathText";

interface Props {
  shapes: ShapeItem[];
  boardRef: React.RefObject<HTMLDivElement | null>;
  editable: boolean;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<ShapeItem>) => void;
  fontFamily: string;
  /** snapping is applied only when this is provided AND the user isn't holding Alt */
  snap?: (v: number) => number;
  /** smart guides: align edges/centres with other shapes while dragging */
  smartGuides?: boolean;
  onGestureEnd?: () => void;
  /** additional snap targets (the built-in slide elements) */
  extraTargets?: { x: number; y: number; w: number; h: number }[];
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Gesture =
  | { kind: "move"; id: string; dx: number; dy: number; others: ShapeItem[] }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; x0: number; y0: number; w0: number; h0: number; ratio: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; start: number; rot0: number };

const r1 = (v: number) => Math.round(v * 10) / 10;
const GUIDE_TOL = 0.8; // % of board

const HANDLES: { h: Handle; style: CSSProperties; cursor: string }[] = [
  { h: "nw", style: { left: -8, top: -8 }, cursor: "nwse-resize" },
  { h: "n", style: { left: "50%", top: -8, marginLeft: -8 }, cursor: "ns-resize" },
  { h: "ne", style: { right: -8, top: -8 }, cursor: "nesw-resize" },
  { h: "e", style: { right: -8, top: "50%", marginTop: -8 }, cursor: "ew-resize" },
  { h: "se", style: { right: -8, bottom: -8 }, cursor: "nwse-resize" },
  { h: "s", style: { left: "50%", bottom: -8, marginLeft: -8 }, cursor: "ns-resize" },
  { h: "sw", style: { left: -8, bottom: -8 }, cursor: "nesw-resize" },
  { h: "w", style: { left: -8, top: "50%", marginTop: -8 }, cursor: "ew-resize" },
];

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
  if (g.type === "radial") {
    return (
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="60%">
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

/** SVG for geometric shapes; text-only boxes render no SVG at all. */
function ShapeGraphic({ s }: { s: ShapeItem }) {
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
        }}
      />
    );
  }

  if (s.kind === "line" || s.kind === "arrow") {
    const id = `arr-${s.id}`;
    return (
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
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
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <GradientDefs s={s} id={gradId} />
      {(s.kind === "rect" || s.kind === "rounded") && <rect x="0" y="0" width="100" height="100" rx={rx} ry={rx} {...common} />}
      {s.kind === "ellipse" && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
      {poly && <polygon points={poly} {...common} />}
      {double && (s.kind === "rect" || s.kind === "rounded") && (
        <rect x="6" y="8" width="88" height="84" rx={rx} ry={rx} fill="none" stroke={stroke} strokeWidth={Math.max(1, sw * 0.6)} vectorEffect="non-scaling-stroke" />
      )}
      {double && s.kind === "ellipse" && (
        <ellipse cx="50" cy="50" rx="44" ry="44" fill="none" stroke={stroke} strokeWidth={Math.max(1, sw * 0.6)} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/** finds a nearby edge/centre of another shape (or the board) to snap to */
function smartSnap(
  v: number,
  size: number,
  others: ShapeItem[],
  axis: "x" | "y",
): { v: number; guide: number | null } {
  const candidates: number[] = [0, 50, 100];
  for (const o of others) {
    const a = axis === "x" ? o.x : o.y;
    const s = axis === "x" ? o.w : o.h;
    candidates.push(a, a + s / 2, a + s);
  }
  const mine = [
    { off: 0, val: v },
    { off: size / 2, val: v + size / 2 },
    { off: size, val: v + size },
  ];
  let best: { d: number; v: number; guide: number } | null = null;
  for (const c of candidates) {
    for (const m of mine) {
      const d = Math.abs(m.val - c);
      if (d < GUIDE_TOL && (!best || d < best.d)) best = { d, v: c - m.off, guide: c };
    }
  }
  return best ? { v: best.v, guide: best.guide } : { v, guide: null };
}

export default function ShapeLayer({
  shapes,
  boardRef,
  editable,
  selectedId,
  onSelect,
  onChange,
  fontFamily,
  snap,
  smartGuides = true,
  onGestureEnd,
  extraTargets,
}: Props) {
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });


  const board = () => boardRef.current?.getBoundingClientRect();

  /* ------------------------------- gestures ------------------------------ */
  const down = (s: ShapeItem) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(s.id);
    if (e.button !== 0 || s.locked) return;
    const b = board();
    if (!b) return;
    gesture.current = {
      kind: "move",
      id: s.id,
      dx: e.clientX - (b.left + (s.x / 100) * b.width),
      dy: e.clientY - (b.top + (s.y / 100) * b.height),
      others: [...shapes.filter((o) => o.id !== s.id), ...((extraTargets ?? []) as ShapeItem[])],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const resizeDown = (s: ShapeItem, handle: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    gesture.current = {
      kind: "resize",
      id: s.id,
      handle,
      sx: e.clientX,
      sy: e.clientY,
      x0: s.x,
      y0: s.y,
      w0: s.w,
      h0: s.h,
      ratio: s.h > 0 ? s.w / s.h : 1,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const rotateDown = (s: ShapeItem) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const b = board();
    if (!b) return;
    const cx = b.left + ((s.x + s.w / 2) / 100) * b.width;
    const cy = b.top + ((s.y + s.h / 2) / 100) * b.height;
    gesture.current = { kind: "rotate", id: s.id, cx, cy, start: Math.atan2(e.clientY - cy, e.clientX - cx), rot0: s.rot };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const b = board();
    if (!g || !b) return;
    e.preventDefault();
    const freeMove = e.altKey; // Alt = ignore all snapping

    if (g.kind === "move") {
      const me = shapes.find((x) => x.id === g.id);
      let x = ((e.clientX - g.dx - b.left) / b.width) * 100;
      let y = ((e.clientY - g.dy - b.top) / b.height) * 100;
      let gx: number | null = null;
      let gy: number | null = null;
      if (!freeMove) {
        if (snap) {
          x = snap(x);
          y = snap(y);
        }
        if (smartGuides && me) {
          const sx = smartSnap(x, me.w, g.others, "x");
          const sy = smartSnap(y, me.h, g.others, "y");
          x = sx.v;
          y = sy.v;
          gx = sx.guide;
          gy = sy.guide;
        }
      }
      setGuides({ x: gx, y: gy });
      onChange?.(g.id, { x: r1(x), y: r1(y) });
      return;
    }

    if (g.kind === "resize") {
      const dx = ((e.clientX - g.sx) / b.width) * 100;
      const dy = ((e.clientY - g.sy) / b.height) * 100;
      let { x0: x, y0: y, w0: w, h0: h } = g;
      const hnd = g.handle;

      if (hnd.includes("e")) w = g.w0 + dx;
      if (hnd.includes("s")) h = g.h0 + dy;
      if (hnd.includes("w")) {
        w = g.w0 - dx;
        x = g.x0 + dx;
      }
      if (hnd.includes("n")) {
        h = g.h0 - dy;
        y = g.y0 + dy;
      }

      // corner handles keep the aspect ratio: always for images (Shift frees
      // them), only with Shift for other shapes
      const me = shapes.find((x) => x.id === g.id);
      const keepRatio = hnd.length === 2 && (me?.kind === "image" ? !e.shiftKey : e.shiftKey);
      if (keepRatio) {
        const byW = Math.abs(w - g.w0) >= Math.abs(h - g.h0) * g.ratio;
        if (byW) h = w / g.ratio;
        else w = h * g.ratio;
        if (hnd.includes("w")) x = g.x0 + g.w0 - w;
        if (hnd.includes("n")) y = g.y0 + g.h0 - h;
      }

      // never collapse; if flipped past zero keep the min size at the anchored edge
      const minW = 1;
      const minH = 0.3;
      if (w < minW) {
        if (hnd.includes("w")) x = g.x0 + g.w0 - minW;
        w = minW;
      }
      if (h < minH) {
        if (hnd.includes("n")) y = g.y0 + g.h0 - minH;
        h = minH;
      }

      if (!freeMove && snap) {
        if (hnd.includes("w")) {
          const nx = snap(x);
          w += x - nx;
          x = nx;
        } else if (hnd.includes("e")) w = snap(x + w) - x;
        if (hnd.includes("n")) {
          const ny = snap(y);
          h += y - ny;
          y = ny;
        } else if (hnd.includes("s")) h = snap(y + h) - y;
      }

      onChange?.(g.id, { x: r1(x), y: r1(y), w: r1(Math.max(minW, w)), h: r1(Math.max(minH, h)) });
      return;
    }

    const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
    let deg = g.rot0 + ((a - g.start) * 180) / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    deg = ((Math.round(deg) + 540) % 360) - 180;
    onChange?.(g.id, { rot: deg });
  };

  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    if (gesture.current) onGestureEnd?.();
    gesture.current = null;
    setGuides({ x: null, y: null });
  };

  const handleBase: CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 3,
    background: "#ffd633",
    border: "2px solid #0a0a0c",
    boxShadow: "0 1px 4px rgba(0,0,0,.6)",
    zIndex: BAND_UI + 20,
    touchAction: "none",
    pointerEvents: "auto",
  };

  return (
    <>
      {/* smart guide lines */}
      {editable && guides.x !== null && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${guides.x}%`, width: 1, background: "rgba(255,77,109,.9)", zIndex: BAND_UI + 5, pointerEvents: "none" }} />
      )}
      {editable && guides.y !== null && (
        <div style={{ position: "absolute", left: 0, right: 0, top: `${guides.y}%`, height: 1, background: "rgba(255,77,109,.9)", zIndex: BAND_UI + 5, pointerEvents: "none" }} />
      )}

      {shapes.map((s) => {
        const isText = s.kind === "text";
        const thinLine = s.kind === "line" || s.kind === "arrow";
        return (
          <div
            key={s.id}
            data-shape={s.id}
            onPointerDown={down(s)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
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
              pointerEvents: editable ? "auto" : "none",
            }}
          >
            {thinLine && editable && <div style={{ position: "absolute", left: 0, right: 0, top: -14, bottom: -14 }} />}
            <ShapeGraphic s={s} />

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
                    ...textStyle(s),
                  }}
                />
              </div>
            )}

          </div>
        );
      })}

      {/* ---- selection frame + handles: drawn on the top band so a shape that
           sits behind an opaque image/rectangle is still visible & grabbable ---- */}
      {editable &&
        shapes
          .filter((s) => s.id === selectedId)
          .map((s) => {
            const thinLine = s.kind === "line" || s.kind === "arrow";
            const covered = shapes.some(
              (o) =>
                o.id !== s.id &&
                safeZ(o.z) > safeZ(s.z) &&
                o.x < s.x + s.w && o.x + o.w > s.x && o.y < s.y + s.h && o.y + o.h > s.y &&
                (o.kind === "image" || (o.fill && o.fillOpacity > 0.6)),
            );
            return (
              <div
                key={`sel-${s.id}`}
                style={{
                  position: "absolute",
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.w}%`,
                  height: `${s.h}%`,
                  transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
                  transformOrigin: "center center",
                  zIndex: BAND_UI + 15,
                  pointerEvents: "none",
                  outline: `1.5px ${covered ? "dashed" : "solid"} rgba(255,214,51,.95)`,
                  outlineOffset: thinLine ? 10 : 2,
                  boxSizing: "border-box",
                }}
              >
                {covered && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: -30,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(255,214,51,.95)",
                      color: "#0a0a0c",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    behind another item — use Bring Forward
                  </div>
                )}
                {!s.locked && (
                  <>
                    {(thinLine ? HANDLES.filter((h) => h.h === "e" || h.h === "w") : HANDLES).map(({ h, style, cursor }) => (
                      <div
                        key={h}
                        title="Drag to resize · Shift keeps ratio · Alt disables snapping"
                        onPointerDown={resizeDown(s, h)}
                        onPointerMove={move}
                        onPointerUp={up}
                        onPointerCancel={up}
                        style={{
                          ...handleBase,
                          ...style,
                          ...(thinLine ? { top: "50%", marginTop: -8 } : {}),
                          cursor,
                          borderRadius: h.length === 1 ? 8 : 3,
                        }}
                      />
                    ))}
                    <div
                      title="Rotate · Shift snaps to 15°"
                      onPointerDown={rotateDown(s)}
                      onPointerMove={move}
                      onPointerUp={up}
                      onPointerCancel={up}
                      style={{
                        ...handleBase,
                        left: "50%",
                        top: thinLine ? -44 : -34,
                        marginLeft: -8,
                        borderRadius: "50%",
                        background: "#5ef2ff",
                        cursor: "grab",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: thinLine ? -28 : -18,
                        width: 2,
                        height: 16,
                        marginLeft: -1,
                        background: "rgba(94,242,255,.8)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: -30,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(0,0,0,.75)",
                        color: "#ffd633",
                        fontFamily: "monospace",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        transform: s.rot ? `rotate(${-s.rot}deg)` : undefined,
                        transformOrigin: "left top",
                      }}
                    >
                      {r1(s.x)}, {r1(s.y)} · {r1(s.w)}×{r1(s.h)}{s.rot ? ` · ${s.rot}°` : ""}
                    </div>
                  </>
                )}
              </div>
            );
          })}
    </>
  );
}
