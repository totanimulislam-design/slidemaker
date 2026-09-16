import { useRef, useState, type CSSProperties } from "react";
import { polygonPoints, type ShapeItem } from "../lib/shapes";
import { withAlpha } from "../lib/color";
import { cssBorder, dashArray, hasGradientFill, itemStyle, shapeFill, textStyle } from "../lib/shapeDesign";
import { BAND_CONTENT, BAND_UI, safeZ } from "../lib/zorder";
import { applyResize } from "../lib/freeTransform";
import type { LayerRef } from "../lib/layers";
import {
  anyGrouped,
  fillsBox,
  groupMembersOf,
  isWholeGroup,
  moveMembers,
  rotateMembers,
  scaleMembers,
  selectionBounds,
  type MemberGeo,
} from "../lib/groups";
import MathText from "./MathText";

interface Props {
  shapes: ShapeItem[];
  boardRef: React.RefObject<HTMLDivElement | null>;
  editable: boolean;
  /** current multi-selection of drawn items; a group is selected as a unit */
  selectedIds: string[];
  /** `exact` = do not expand groups (double-click digs into one member) */
  onSelect?: (ids: string[], opts?: { exact?: boolean }) => void;
  onChange?: (id: string, patch: Partial<ShapeItem>) => void;
  /** batched patches — keeps a group/multi drag inside ONE undo step */
  onBatchChange?: (updates: { id: string; patch: Partial<ShapeItem> }[]) => void;
  onGroup?: (ids: string[]) => void;
  onUngroup?: (ids: string[]) => void;
  /** Alt+click: walk to the layer *below* the point (overlapping selection) */
  onLayerCycle?: (clientX: number, clientY: number) => void;
  fontFamily: string;
  /** snapping is applied only when this is provided AND the user isn't holding Alt */
  snap?: (v: number) => number;
  /** smart guides: align edges/centres with other shapes while dragging */
  smartGuides?: boolean;
  onGestureEnd?: () => void;
  /** additional snap targets (the built-in slide elements) */
  extraTargets?: { x: number; y: number; w: number; h: number }[];
  /**
   * The slide draws the selection frame itself whenever MORE than one layer is
   * selected (the set can mix drawn items with built-in elements and built-in
   * parts), so this layer only paints its own frame for a single shape.
   */
  externalFrame?: boolean;
  /** every layer of a shape's group — may contain built-in elements / parts */
  groupRefs?: (shapeId: string) => LayerRef[];
  /** non-shape layers of the current selection (mixed multi-selection) */
  extraSelection?: LayerRef[];
  /**
   * Selection callback that can carry built-in elements / parts as well as
   * shapes. When it is given, every selection change goes through it so a
   * mixed multi-selection is never reduced to "shapes only".
   */
  onSelectRefs?: (refs: LayerRef[], opts?: { exact?: boolean }) => void;
  /** hand a whole-selection drag over to the slide's unified gesture engine */
  onExternalSetMove?: (e: React.PointerEvent<HTMLDivElement>, refs: LayerRef[]) => void;
  /** double-click a text box → edit its text right on the canvas */
  onEditText?: (shapeId: string) => void;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Gesture =
  | { kind: "move"; id: string; dx: number; dy: number; others: ShapeItem[] }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; x0: number; y0: number; w0: number; h0: number; ratio: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; start: number; rot0: number }
  /** whole selection (multi / group) — every member gets patched by the same transform */
  | { kind: "set"; mode: "move"; ids: string[]; start: Record<string, MemberGeo>; px0: number; py0: number }
  | { kind: "set"; mode: "resize"; ids: string[]; start: Record<string, MemberGeo>; handle: Handle; sx: number; sy: number; bounds: { x: number; y: number; w: number; h: number } }
  | { kind: "set"; mode: "rotate"; ids: string[]; start: Record<string, MemberGeo>; cx: number; cy: number; startAngle: number; board: { left: number; top: number; width: number; height: number } };

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
 * background containers can't block the elements underneath them.
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
  selectedIds,
  onSelect,
  onChange,
  onBatchChange,
  onGroup,
  onUngroup,
  onLayerCycle,
  fontFamily,
  snap,
  smartGuides = true,
  onGestureEnd,
  extraTargets,
  externalFrame = false,
  groupRefs,
  extraSelection,
  onSelectRefs,
  onExternalSetMove,
  onEditText,
}: Props) {
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const board = () => boardRef.current?.getBoundingClientRect();

  /** valid (still-present) shapes of the current selection, any order kept */
  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
  const single = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const emitUpdates = (updates: { id: string; patch: Partial<ShapeItem> }[]) => {
    if (!updates.length) return;
    if (onBatchChange) onBatchChange(updates);
    else updates.forEach((u) => onChange?.(u.id, u.patch));
  };

  const snapshot = (ids: string[]): Record<string, MemberGeo> => {
    const out: Record<string, MemberGeo> = {};
    for (const id of ids) {
      const s = shapes.find((x) => x.id === id);
      if (s) out[id] = { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot };
    }
    return out;
  };
  const memberList = (ids: string[], start: Record<string, MemberGeo>) =>
    ids.map((id) => ({ id, geo: start[id] })).filter((m): m is { id: string; geo: MemberGeo } => !!m.geo);

  /** capture on the actual hit child (and the box) so painted-only targets keep dragging */
  const grab = (e: React.PointerEvent<Element>) => {
    const pid = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(pid);
    } catch {
      /* capture unsupported here — move events still bubble while over the item */
    }
    const t = e.target as Element | null;
    if (t && t !== e.currentTarget && typeof t.setPointerCapture === "function") {
      try {
        t.setPointerCapture(pid);
      } catch {
        /* ignore */
      }
    }
  };

  /* ------------------------------- gestures ------------------------------ */
  const down = (s: ShapeItem) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    e.stopPropagation();
    if (e.altKey && onLayerCycle) {
      // Alt+click: dig through the layers at this point instead of grabbing
      onLayerCycle(e.clientX, e.clientY);
      return;
    }
    if (s.locked) return;
    // click on a group (or a shape that is part of one) acts on the whole group;
    // an already-selected member keeps the exact selection (precise editing),
    // Ctrl/⌘ toggles this shape's group into a multi-selection
    const members = groupMembersOf(shapes, s.id);
    // Shift AND Ctrl/⌘ both add to the selection (like every real editor);
    // Shift is still "keep ratio" while resizing and "no snapping" while moving.
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    /** the whole mixed selection a set of shape ids stands for */
    const mixedRefs = (ids: string[]): LayerRef[] => {
      const shapeRefs: LayerRef[] = ids.map((id) => ({ kind: "shape", id }));
      const memberRefs: LayerRef[] = groupRefs
        ? ids.flatMap((id) => (groupRefs(id) ?? []).filter((r) => r.kind !== "shape"))
        : [];
      const out: LayerRef[] = [];
      const seen = new Set<string>();
      [...shapeRefs, ...memberRefs, ...(additive ? (extraSelection ?? []) : [])].forEach((r) => {
        const k = `${r.kind}:${r.id}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push(r);
      });
      return out;
    };
    /** selects through the unified callback so built-ins are never dropped */
    const commit = (ids: string[]) => {
      if (onSelectRefs) onSelectRefs(mixedRefs(ids), { exact: true });
      else onSelect?.(ids);
    };

    let targets: string[];
    if (additive) {
      const allOn = members.every((id) => selectedIds.includes(id));
      targets = allOn
        ? selectedIds.filter((id) => !members.includes(id))
        : [...new Set([...selectedIds, ...members])];
      commit(targets);
    } else if (selectedIds.includes(s.id)) {
      targets = selectedIds;
    } else {
      targets = members;
      commit(targets);
    }
    if (e.button !== 0) return;
    const movable = targets.filter((id) => shapes.some((x) => x.id === id && !x.locked));
    if (!movable.length) return;
    const b = board();
    if (!b) return;

    /**
     * A group (or any multi-selection) that also contains built-in elements or
     * built-in parts is transformed by the slide's unified engine, so EVERY
     * member moves together — a mixed group can never be torn apart.
     */
    if (onExternalSetMove) {
      const all = mixedRefs(targets);
      if (all.length > 1) {
        onExternalSetMove(e, all);
        return;
      }
    }

    if (movable.length === 1 && targets.length === 1) {
      const it = shapes.find((x) => x.id === movable[0])!;
      gesture.current = {
        kind: "move",
        id: it.id,
        dx: e.clientX - (b.left + (it.x / 100) * b.width),
        dy: e.clientY - (b.top + (it.y / 100) * b.height),
        others: [...shapes.filter((o) => o.id !== it.id), ...((extraTargets ?? []) as ShapeItem[])],
      };
    } else {
      gesture.current = { kind: "set", mode: "move", ids: movable, start: snapshot(movable), px0: e.clientX, py0: e.clientY };
    }
    grab(e);
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

  /** resize / rotate handles of the multi-selection (group) frame */
  const setResizeDown = (handle: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const ids = selectedShapes.filter((x) => !x.locked).map((x) => x.id);
    if (!ids.length) return;
    const start = snapshot(ids);
    const bounds = selectionBounds(memberList(ids, start).map((m) => m.geo));
    gesture.current = { kind: "set", mode: "resize", ids, handle, start, sx: e.clientX, sy: e.clientY, bounds };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const setRotateDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const b = board();
    if (!b) return;
    const ids = selectedShapes.filter((x) => !x.locked).map((x) => x.id);
    if (!ids.length) return;
    const start = snapshot(ids);
    const bd = selectionBounds(memberList(ids, start).map((m) => m.geo));
    gesture.current = {
      kind: "set",
      mode: "rotate",
      ids,
      start,
      cx: b.left + ((bd.x + bd.w / 2) / 100) * b.width,
      cy: b.top + ((bd.y + bd.h / 2) / 100) * b.height,
      startAngle: Math.atan2(e.clientY - (b.top + ((bd.y + bd.h / 2) / 100) * b.height), e.clientX - (b.left + ((bd.x + bd.w / 2) / 100) * b.width)),
      board: { left: b.left, top: b.top, width: b.width, height: b.height },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const b = board();
    if (!g || !b) return;
    e.preventDefault();
    const freeMove = e.altKey; // Alt = ignore all snapping

    if (g.kind === "set") {
      if (g.mode === "move") {
        const dx = ((e.clientX - g.px0) / b.width) * 100;
        const dy = ((e.clientY - g.py0) / b.height) * 100;
        emitUpdates(moveMembers(memberList(g.ids, g.start), dx, dy));
        return;
      }
      if (g.mode === "resize") {
        const dx = ((e.clientX - g.sx) / b.width) * 100;
        const dy = ((e.clientY - g.sy) / b.height) * 100;
        const nb = applyResize(
          {
            kind: "resize",
            id: "selection",
            handle: g.handle,
            sx: g.sx,
            sy: g.sy,
            start: { ...g.bounds, rot: 0 },
            ratio: g.bounds.h > 0 ? g.bounds.w / g.bounds.h : 1,
          },
          dx,
          dy,
          { keepRatio: false, free: true, minW: 2, minH: 0.6 },
        );
        emitUpdates(scaleMembers(memberList(g.ids, g.start), g.bounds, nb));
        return;
      }
      const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      let delta = ((a - g.startAngle) * 180) / Math.PI;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      emitUpdates(
        rotateMembers(memberList(g.ids, g.start), { x: g.cx - g.board.left, y: g.cy - g.board.top }, delta, g.board),
      );
      return;
    }

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
      const t = e.target as Element | null;
      if (t && typeof t.releasePointerCapture === "function") {
        try {
          t.releasePointerCapture(e.pointerId);
        } catch {
          /* not held by the child */
        }
      }
      onGestureEnd?.();
    }
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

  const chipStyle: CSSProperties = {
    padding: "3px 8px",
    borderRadius: 6,
    background: "rgba(10,10,12,.85)",
    border: "1px solid rgba(255,214,51,.55)",
    color: "#ffd633",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    pointerEvents: "auto",
  };

  /** true when the shape's group also holds built-in elements / parts */
  const externalGroupOf = (id: string) => (groupRefs ? (groupRefs(id) ?? []).some((r) => r.kind !== "shape") : false);

  const bounds = selectionBounds(selectedShapes);

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
        const solid = fillsBox(s); // captures clicks across its whole box?
        const clickable = editable && !s.locked;
        return (
          <div
            key={s.id}
            data-shape={s.id}
            onPointerDown={down(s)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onDoubleClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    const solo = selectedIds.length === 1 && selectedIds[0] === s.id;
                    // first double-click digs into a group: select just this member
                    if ((s.groupId || externalGroupOf(s.id)) && !solo) {
                      onSelect?.([s.id], { exact: true });
                      return;
                    }
                    // …the next one edits the text right on the canvas
                    if (onEditText && (s.kind === "text" || s.text)) onEditText(s.id);
                  }
                : undefined
            }
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
            }}
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

      {/* per-member outlines while several items (or a group) are selected */}
      {editable &&
        !externalFrame &&
        selectedShapes.length > 1 &&
        selectedShapes.map((s) => (
          <div
            key={`out-${s.id}`}
            data-member={s.id}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.w}%`,
              height: `${s.h}%`,
              transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
              transformOrigin: "center center",
              zIndex: BAND_UI + 13,
              pointerEvents: "none",
              outline: "1.5px dashed rgba(255,214,51,.8)",
              boxSizing: "border-box",
            }}
          />
        ))}

      {/* ---- selection frame + handles: drawn on the top band so a shape that
           sits behind an opaque image/rectangle is still visible & grabbable ---- */}
      {editable &&
        !externalFrame &&
        single &&
        (() => {
          const s = single;
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
              data-sel={s.id}
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
              {s.groupId && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: -30,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(94,242,255,.9)",
                    color: "#0a0a0c",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  ⧉ grouped — double-click edits this item alone
                </div>
              )}
              {covered && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: s.groupId ? -52 : -30,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(255,214,51,.95)",
                    color: "#0a0a0c",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  behind another item — Alt+click cycles the layers below
                </div>
              )}
              {!s.locked && (
                <>
                  {(thinLine ? HANDLES.filter((h) => h.h === "e" || h.h === "w") : HANDLES).map(({ h, style, cursor }) => (
                    <div
                      key={h}
                      data-handle={h}
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
                    data-rotate=""
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
        })()}

      {/* ---- group / multi-selection frame: bounds + handles move the set ---- */}
      {editable && !externalFrame && selectedShapes.length > 1 && (
        <div
          data-set-frame=""
          style={{
            position: "absolute",
            left: `${bounds.x}%`,
            top: `${bounds.y}%`,
            width: `${bounds.w}%`,
            height: `${bounds.h}%`,
            zIndex: BAND_UI + 15,
            pointerEvents: "none",
            outline: "1.5px solid rgba(255,214,51,.95)",
            outlineOffset: 3,
            boxSizing: "border-box",
          }}
        >
          {/* Group / Ungroup chips — the existing pattern, right on the frame */}
          <div style={{ position: "absolute", right: 0, top: -34, display: "flex", gap: 4 }}>
            {anyGrouped(shapes, selectedIds) && onUngroup && (
              <button
                data-chip="ungroup"
                title="Break this group — every member becomes independently selectable (Ctrl/⌘+Shift+G)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onUngroup(selectedShapes.map((x) => x.id))}
                style={chipStyle}
              >
                ⧉ Ungroup
              </button>
            )}
            {onGroup && !isWholeGroup(shapes, selectedIds) && selectedShapes.filter((x) => !x.locked).length > 1 && (
              <button
                data-chip="group"
                title="Combine the selected items into one group (Ctrl/⌘+G)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onGroup(selectedShapes.map((x) => x.id))}
                style={chipStyle}
              >
                ⧉ Group {selectedShapes.length}
              </button>
            )}
          </div>
          {selectedShapes.some((x) => !x.locked) && (
            <>
              {HANDLES.map(({ h, style, cursor }) => (
                <div
                  key={h}
                  data-handle={h}
                  title="Drag to resize the whole selection"
                  onPointerDown={setResizeDown(h)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  style={{
                    ...handleBase,
                    ...style,
                    cursor,
                    borderRadius: h.length === 1 ? 8 : 3,
                  }}
                />
              ))}
              <div
                data-rotate=""
                title="Rotate the whole selection · Shift snaps to 15°"
                onPointerDown={setRotateDown}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                style={{
                  ...handleBase,
                  left: "50%",
                  top: -34,
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
                  top: -18,
                  width: 2,
                  height: 16,
                  marginLeft: -1,
                  background: "rgba(94,242,255,.8)",
                }}
              />
            </>
          )}
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
            }}
          >
            {selectedShapes.length} items{isWholeGroup(shapes, selectedIds) ? " · grouped" : " · selected"} · drag to
            move all
          </div>
        </div>
      )}
    </>
  );
}
