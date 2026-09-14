import { memo, useRef, useState, type CSSProperties } from "react";
import type { Box, DeckHeader, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { shade, withAlpha } from "../lib/color";
import { isWideNumberStyle, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import OptionBulletMarker from "./OptionBulletMarker";
import { isRtlText } from "../lib/fonts";
import { boxFontCss, boxStack, boxTypeface } from "../lib/boxFonts";
import { BAND_CONTENT, BAND_UI, safeZ } from "../lib/zorder";
import { ELEMENT_DEFAULT_Z } from "../lib/layers";
import { bannerCss } from "../lib/banner";
import { backgroundLayers } from "../lib/background";
import type { BackgroundSettings } from "../lib/types";
import { DEFAULT_BANNER, DEFAULT_FRAME } from "../lib/types";
import { computeFrameCss } from "../lib/frameDesigns";
import { HANDLES, applyMove, applyResize, applyRotate, type Gesture as FreeGesture, type Handle } from "../lib/freeTransform";
import { measureElement } from "../lib/layoutMeasure";
import MathText from "./MathText";
import ShapeLayer from "./ShapeLayer";
import type { ShapeItem } from "../lib/shapes";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export type SlideField = "title" | "brandTop" | "brandBottom" | "badge" | "logo" | "question" | `option:${number}` | "note";

const FIELD_OF: Record<ElementId, SlideField> = {
  logo: "logo",
  brand: "brandTop",
  title: "title",
  badge: "badge",
  question: "question",
  options: "option:0",
  note: "note",
  bullet: "question",
};

interface Props {
  slide: SlideData;
  header: DeckHeader;
  theme: ThemeSettings;
  onField?: (field: SlideField | null) => void;
  activeField?: SlideField | null;
  total?: number;
  index?: number;
  /** enables drag-to-position and reports the new box */
  onLayoutChange?: (id: ElementId, patch: Partial<Box>) => void;
  selected?: ElementId | null;
  onSelect?: (id: ElementId | null) => void;
  /** deck-wide shapes rendered beneath the slide's own */
  globalShapes?: ShapeItem[];
  selectedShape?: string | null;
  onSelectShape?: (id: string | null) => void;
  onShapeChange?: (id: string, patch: Partial<ShapeItem>) => void;
  /** called when a drag/resize/rotate finishes — closes the undo coalescing window */
  onGestureEnd?: () => void;
  /** effective background for this slide (deck default merged with the slide override) */
  background?: BackgroundSettings;
}

const SNAP = [0, 25, 50, 75, 100];
const snapAnchor = (v: number, tol = 1.8) => {
  const hit = SNAP.find((t) => Math.abs(v - t) < tol);
  return hit === undefined ? v : hit;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const ELEMENT_LABEL: Record<ElementId, string> = {
  logo: "Logo", brand: "Brand", title: "Title", badge: "Badge", bullet: "Number bullet", question: "Question", options: "Options", note: "Footnote",
};

function SlideBase({
  slide,
  header,
  theme,
  onField,
  activeField,
  total,
  index,
  onLayoutChange,
  selected,
  onSelect,
  globalShapes,
  selectedShape,
  onSelectShape,
  onShapeChange,
  onGestureEnd,
  background,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<FreeGesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const editable = !!onField;
  const movable = !!onLayoutChange;
  const L = theme.layout;
  const isFree = (id: ElementId) => (L[id].mode ?? "align") === "free";

  /* ------------------------------ positioning ------------------------------ */
  const boxStyle = (id: ElementId, extra?: CSSProperties): CSSProperties => {
    const b = L[id];
    const free = (b.mode ?? "align") === "free";
    const rot = b.rot ? ` rotate(${b.rot}deg)` : "";
    return {
      position: "absolute",
      left: `${b.x}%`,
      top: `${b.y}%`,
      width: `${b.w}%`,
      height: free && b.h ? `${b.h}%` : undefined,
      transform: free ? (rot || undefined) : `translate(-${b.x}%, -${b.y}%)${rot}`,
      transformOrigin: "center center",
      // one shared number line with drawn shapes (see lib/layers.ts)
      zIndex: BAND_CONTENT + safeZ(b.z, ELEMENT_DEFAULT_Z[id]),
      textAlign: b.align,
      boxSizing: "border-box",
      ...(editable
        ? {
            cursor: movable ? "move" : "pointer",
            outline:
              activeField === FIELD_OF[id] && selected !== id ? "2px dashed rgba(255,255,255,.4)" : "2px dashed transparent",
            outlineOffset: 6,
            borderRadius: 10,
            touchAction: "none",
          }
        : {}),
      ...extra,
    };
  };

  /**
   * Current geometry of an element in "free" terms (own top-left edge, % of
   * board). Aligned elements are measured live so the first drag is seamless.
   */
  /** rect frozen at gesture start — mid-drag DOM reads would see a moving/rotated box */
  const frozenRect = useRef<{ id: ElementId; rect: { x: number; y: number; w: number; h: number; rot: number } } | null>(null);

  const freeRectOf = (id: ElementId) => {
    const fz = frozenRect.current;
    if (fz && fz.id === id) return { ...fz.rect, rot: L[id].rot ?? fz.rect.rot };
    const b = L[id];
    if ((b.mode ?? "align") === "free") {
      const m = b.h ? null : measureElement(id);
      return { x: b.x, y: b.y, w: b.w, h: b.h ?? m?.h ?? 10, rot: b.rot ?? 0 };
    }
    const m = measureElement(id);
    return {
      x: m ? m.left : (b.x * (100 - b.w)) / 100,
      y: m ? m.top : b.y,
      w: m ? m.w : b.w,
      h: m ? m.h : 10,
      rot: b.rot ?? 0,
    };
  };

  /**
   * Any drag/resize/rotate promotes the element to free mode. The logo (an
   * image) also gets an explicit height so its box no longer depends on the
   * bitmap having loaded — this was the source of the jump/drift.
   */
  const ensureFree = (id: ElementId) => {
    const r = freeRectOf(id);
    frozenRect.current = { id, rect: r };
    if (isFree(id) && (id !== "logo" || L[id].h)) return r;
    onLayoutChange?.(id, {
      mode: "free",
      x: r1(r.x),
      y: r1(r.y),
      w: r1(r.w),
      ...(id === "logo" ? { h: r1(r.h) } : {}),
    });
    return r;
  };

  const elementShown = (id: ElementId) =>
    id === "logo" ? !!(header.showLogo && header.logo) : id === "note" ? !!slide.note?.trim() : true;

  const snapTargets = (except: string) => {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    (Object.keys(L) as ElementId[]).forEach((id) => {
      if (`element:${id}` === except) return;
      if (!elementShown(id)) return;
      const r = freeRectOf(id);
      out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
    });
    [...(globalShapes ?? []), ...(slide.shapes ?? [])].forEach((sh) => {
      if (`shape:${sh.id}` !== except) out.push({ x: sh.x, y: sh.y, w: sh.w, h: sh.h });
    });
    return out;
  };

  const gridSnap = theme.snapEnabled
    ? (v: number) => {
        const step = Math.max(0.1, theme.snapStep || 1);
        return snapAnchor(Math.round(v / step) * step, 1.2);
      }
    : undefined;

  const startDrag = (id: ElementId) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (editable) {
      e.stopPropagation();
      onSelect?.(id);
      onSelectShape?.(null);
      onField?.(FIELD_OF[id]);
    }
    if (!movable || e.button !== 0) return;
    const b = boardRef.current?.getBoundingClientRect();
    if (!b) return;
    const r = ensureFree(id);
    gesture.current = {
      kind: "move",
      id,
      dx: e.clientX - (b.left + (r.x / 100) * b.width),
      dy: e.clientY - (b.top + (r.y / 100) * b.height),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const startResize = (id: ElementId, handle: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!movable || e.button !== 0) return;
    const r = ensureFree(id);
    gesture.current = { kind: "resize", id, handle, sx: e.clientX, sy: e.clientY, start: r, ratio: r.h > 0 ? r.w / r.h : 1 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const startRotate = (id: ElementId) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!movable || e.button !== 0) return;
    const b = boardRef.current?.getBoundingClientRect();
    if (!b) return;
    const r = ensureFree(id);
    const cx = b.left + ((r.x + r.w / 2) / 100) * b.width;
    const cy = b.top + ((r.y + r.h / 2) / 100) * b.height;
    gesture.current = { kind: "rotate", id, cx, cy, start: Math.atan2(e.clientY - cy, e.clientX - cx), rot0: r.rot };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const b = boardRef.current?.getBoundingClientRect();
    if (!g || !b) return;
    e.preventDefault();
    const id = g.id as ElementId;
    const freeMove = e.altKey;

    if (g.kind === "move") {
      const r = freeRectOf(id); // frozen size → stable snapping while dragging
      const rawX = ((e.clientX - g.dx - b.left) / b.width) * 100;
      const rawY = ((e.clientY - g.dy - b.top) / b.height) * 100;
      const res = applyMove(r, rawX, rawY, {
        grid: gridSnap,
        others: theme.smartGuides === false ? undefined : snapTargets(`element:${id}`),
        free: freeMove,
      });
      setGuides({ x: res.gx, y: res.gy });
      onLayoutChange?.(id, { x: res.x, y: res.y });
      return;
    }
    if (g.kind === "resize") {
      const dx = ((e.clientX - g.sx) / b.width) * 100;
      const dy = ((e.clientY - g.sy) / b.height) * 100;
      const keepRatio = id === "logo" ? !e.shiftKey : e.shiftKey;
      const r = applyResize(g, dx, dy, { keepRatio, grid: gridSnap, free: freeMove, minW: 2, minH: 2 });
      onLayoutChange?.(id, { x: r.x, y: r.y, w: r.w, h: r.h });
      return;
    }
    onLayoutChange?.(id, { rot: applyRotate(g, e.clientX, e.clientY, e.shiftKey) });
  };

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      onGestureEnd?.();
    }
    gesture.current = null;
    frozenRect.current = null;
    setGuides({ x: null, y: null });
  };

  const handlers = editable
    ? (id: ElementId) => ({
        "data-el": id,
        onPointerDown: startDrag(id),
        onPointerMove,
        onPointerUp: endGesture,
        onPointerCancel: endGesture,
      })
    : (id: ElementId) => ({ "data-el": id });

  /** the "hit" helper is kept for legacy call sites — outline is now on the overlay */
  const hit = (_field: SlideField): CSSProperties => ({});
  void hit;

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

  /** selection frame + 8 handles + rotate for the selected built-in element */
  const ElementOverlay = ({ id }: { id: ElementId }) => {
    if (!movable || selected !== id || !elementShown(id)) return null;
    const b = L[id];
    const free = isFree(id);
    const r = freeRectOf(id);
    const style: CSSProperties = free
      ? { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: b.h ? `${b.h}%` : `${r.h}%` }
      : { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` };
    return (
      <div
        style={{
          position: "absolute",
          ...style,
          transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
          transformOrigin: "center center",
          zIndex: BAND_UI + 15,
          pointerEvents: "none",
          outline: "1.5px solid rgba(94,242,255,.95)",
          outlineOffset: 3,
          boxSizing: "border-box",
        }}
      >
        {HANDLES.map(({ h, cursor, style: hs }) => (
          <div
            key={h}
            title="Drag to resize · Shift keeps ratio · Alt disables snapping"
            onPointerDown={startResize(id, h)}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            style={{ ...handleBase, ...hs, cursor, background: "#5ef2ff", borderRadius: h.length === 1 ? 8 : 3 }}
          />
        ))}
        <div
          title="Rotate · Shift snaps to 15°"
          onPointerDown={startRotate(id)}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          style={{ ...handleBase, left: "50%", top: -34, marginLeft: -8, borderRadius: "50%", background: "#5ef2ff", cursor: "grab" }}
        />
        <div style={{ position: "absolute", left: "50%", top: -18, width: 2, height: 16, marginLeft: -1, background: "rgba(94,242,255,.8)" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: -30,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,.75)",
            color: "#5ef2ff",
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
            transform: b.rot ? `rotate(${-b.rot}deg)` : undefined,
            transformOrigin: "left top",
          }}
        >
          {ELEMENT_LABEL[id]} · {r1(r.x)}, {r1(r.y)} · {r1(r.w)}×{r1(r.h)}{b.rot ? ` · ${b.rot}°` : ""}{free ? "" : " · aligned"}
        </div>
      </div>
    );
  };

  /** legacy single-corner grip is superseded by ElementOverlay */
  const Grip = (_p: { id: ElementId }) => null;
  void Grip;

  const BulletGraphic = ({ theme: t, slide: sl, size }: { theme: ThemeSettings; slide: SlideData; size: number }) => {
    const id = (t.numberStyle ?? "circle") as NumberStyle;
    const r = renderNumberStyle(id, t, size, sl.number);
    const slash = id === "slash";
    return (
      <div style={{ ...r.style, fontSize: size * r.fontScale, color: r.color, fontFamily: boxStack(t, "bullet") }}>
        {r.content}
        {slash && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: size * 0.14,
              top: size * 0.08,
              width: Math.max(2, size * 0.05),
              height: size * 0.84,
              background: `linear-gradient(160deg, ${shade(t.accent, 0.3)}, ${t.accent})`,
              transform: "rotate(22deg)",
              borderRadius: 999,
            }}
          />
        )}
      </div>
    );
  };

  /* -------------------------------- sizing -------------------------------- */
  const optionCount = Math.max(slide.options.length, 1);
  const twoCol = theme.optionsLayout === "two-col" || theme.optionsLayout === "grid";

  const qLen = slide.question.replace(/\$/g, "").length;
  const autoQ = qLen > 300 ? 0.66 : qLen > 230 ? 0.74 : qLen > 170 ? 0.83 : qLen > 115 ? 0.91 : 1;
  const qSize = theme.questionSize * slide.scale * autoQ * (boxTypeface(theme, "question").scale ?? 1);

  const maxOptLen = slide.options.reduce((m, o) => Math.max(m, o.text.replace(/\$/g, "").length), 0);
  const perCol = (L.options.w / (twoCol ? 2 : 1)) * 0.36; // rough chars that fit
  let autoO = maxOptLen > perCol * 2.4 ? 0.62 : maxOptLen > perCol * 1.6 ? 0.74 : maxOptLen > perCol ? 0.86 : 1;
  const optSize = theme.optionSize * slide.scale * autoO * (boxTypeface(theme, "options").scale ?? 1);
  const circle = Math.round(Math.max(optSize * 1.45, 32));
  const baseGap = optionCount > 4 ? Math.max(10, 34 - (optionCount - 4) * 8) : optionCount === 4 ? 24 : 32;
  // user-set spacing (optionGap in % of board height) overrides the auto tight packing
  const optLineH = theme.optionLineHeight ?? 1.45;
  const rowGap = theme.optionGap
    ? Math.round((theme.optionGap / 100) * SLIDE_H)
    : Math.round(baseGap * (autoO < 1 ? 0.7 : 1));

  const shapeSnap = theme.snapEnabled
    ? (v: number) => {
        const step = Math.max(0.1, theme.snapStep || 1);
        return snapAnchor(Math.round(v / step) * step, 1.2);
      }
    : undefined;
  const allShapes = [...(globalShapes ?? []), ...(slide.shapes ?? [])];

  const bodyStack = boxStack(theme, "question");
  const qRtl = isRtlText(slide.question);

  const frame = theme.frame ?? DEFAULT_FRAME;
  const frameOn = theme.showFrame && frame.style !== "none";
  const frameCss = computeFrameCss(frame, frameOn);

  // If a frame image is chosen, check its placement mode (defaults to "fit" so it NEVER overlaps slide content)
  const hasFrameImage = !!frame.image;
  const isImageOverlayMode = frame.imagePlacement === "overlay";
  const imageInsetPct = hasFrameImage && !isImageOverlayMode ? (frame.imageInset ?? 10) : 0;
  // Convert percentage inset into pixels for 1280x720:
  const imageInsetX = Math.round((imageInsetPct / 100) * SLIDE_W);
  const imageInsetY = Math.round((imageInsetPct / 100) * SLIDE_H);

  return (
    <div
      className={editable ? "slide-editable" : undefined}
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        background: theme.frameOuter,
        padding: hasFrameImage && !isImageOverlayMode
          ? `${imageInsetY}px ${imageInsetX}px`
          : frameCss.outerPadding,
        boxSizing: "border-box",
        fontFamily: bodyStack,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* If frame image is active, render it BEHIND the board in "fit" mode so it never covers slide elements */}
      {hasFrameImage && (
        <div
          aria-hidden
          data-frame-image=""
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: isImageOverlayMode ? 80 : 0,
            backgroundImage: `url(${frame.image})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            ...(isImageOverlayMode && frame.image?.toLowerCase().match(/\.(jpg|jpeg|png)(\?|$)/)
              ? {
                  padding: `${frame.imageInset ?? 10}%`,
                  WebkitMask: "linear-gradient(#fff,#fff) content-box, linear-gradient(#fff,#fff)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff,#fff) content-box, linear-gradient(#fff,#fff)",
                  maskComposite: "exclude",
                }
              : {}),
          }}
        />
      )}
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding: hasFrameImage && !isImageOverlayMode ? 0 : frameCss.outerPadding,
          borderRadius: hasFrameImage && !isImageOverlayMode ? 0 : frameCss.outerRadius,
          background: hasFrameImage && !isImageOverlayMode ? "transparent" : frameCss.ringBackground,
          boxShadow: hasFrameImage && !isImageOverlayMode ? "none" : frameCss.ringBoxShadow,
          border: hasFrameImage && !isImageOverlayMode ? "none" : frameCss.ringBorder,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ------------------------------- board ------------------------------ */}
        <div
          ref={boardRef}
          data-board=""
          onPointerDown={() => {
            if (!editable) return;
            // clicking empty slide clears the selection (element, shape, and any field)
            onSelectShape?.(null);
            onSelect?.(null);
            onField?.(null);
          }}
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            borderRadius: frameCss.innerRadius,
            background: `radial-gradient(120% 90% at 50% -10%, ${shade(theme.board, 0.16)} 0%, ${theme.board} 62%)`,
            position: "relative",
            overflow: "hidden",
            // isolated stacking context: a child can never end up behind this background
            isolation: "isolate",
            zIndex: 1,
          }}
        >
          {/* ------------------------------ background ------------------------- */}
          {background &&
            backgroundLayers(background, theme.board).map((st, i) => (
              <div key={`bg-${i}`} data-bg="" style={{ ...st, zIndex: 0 }} />
            ))}

          {/* alignment guides while dragging */}
          {guides.x !== null && (
            <div
              style={{
                position: "absolute", top: 0, bottom: 0, left: `${guides.x}%`,
                width: 1, background: "rgba(255,214,51,.85)", zIndex: BAND_UI, pointerEvents: "none",
              }}
            />
          )}
          {guides.y !== null && (
            <div
              style={{
                position: "absolute", left: 0, right: 0, top: `${guides.y}%`,
                height: 1, background: "rgba(255,214,51,.85)", zIndex: BAND_UI, pointerEvents: "none",
              }}
            />
          )}

          {/* -------------------------------- logo ---------------------------- */}
          {header.showLogo && header.logo && (
            <div {...handlers("logo")} style={boxStyle("logo", { lineHeight: 0 })}>
              <img
                src={header.logo}
                alt="logo"
                draggable={false}
                style={{
                  width: "100%",
                  // aligned mode / no stored height: let the bitmap define it; free mode: fill the box
                  height: isFree("logo") && L.logo.h ? "100%" : "auto",
                  objectFit: "contain",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
              <Grip id="logo" />
            </div>
          )}

          {/* -------------------------------- brand --------------------------- */}
          <div
            {...handlers("brand")}
            style={boxStyle("brand", boxFontCss(theme, "brand", {
              color: theme.brandColor,
              textTransform: "uppercase",
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: 0.4,
            }))}
          >
            <div style={{ fontSize: 25 }}>{header.brandTop}</div>
            <div style={{ fontSize: 27 }}>{header.brandBottom}</div>
            <Grip id="brand" />
          </div>

          {/* -------------------------------- title --------------------------- */}
          {(() => {
            const bset = { ...DEFAULT_BANNER, ...(theme.banner ?? {}), color: theme.banner?.color ?? theme.titleBanner };
            const css = bannerCss(bset, theme.titleColor);
            return (
              <div
                {...handlers("title")}
                style={boxStyle("title", { position: "absolute" })}
              >
                <div style={{ position: "relative", padding: css.padding }}>
                  {header.showBanner && css.halo && <div style={css.halo} />}
                  {header.showBanner && <div className={bset.shimmer ? "banner-shimmer" : undefined} style={css.box} />}
                  <div
                    style={boxFontCss(theme, "title", {
                      position: "relative",
                      fontSize: 54,
                      fontWeight: 800,
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      ...css.text,
                    })}
                  >
                    {header.title}
                  </div>
                </div>
                <Grip id="title" />
              </div>
            );
          })()}

          {/* -------------------------------- badge --------------------------- */}
          <div
            {...handlers("badge")}
            style={boxStyle("badge", boxFontCss(theme, "badge", {
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: 0.5,
              color: theme.badgeColor,
              textTransform: "uppercase",
              textShadow: "0 2px 6px rgba(0,0,0,.6)",
              lineHeight: 1.15,
            }))}
          >
            <span>{slide.badge?.trim() || header.badge}</span>
            <Grip id="badge" />
          </div>

          {/* ------------------------ number bullet (own element) ------------- */}
          {theme.bulletSeparate && theme.showBullet && (() => {
            const id = (theme.numberStyle ?? "circle") as NumberStyle;
            const size = theme.bulletSize ?? 54;
            const aspect = isWideNumberStyle(id) ? 1.6 : 1;
            return (
              <div
                {...handlers("bullet")}
                style={boxStyle("bullet", {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(aspect !== 1 ? { width: `${((size * aspect) / SLIDE_W) * 100}%` } : {}),
                })}
              >
                <BulletGraphic theme={theme} slide={slide} size={size} />
              </div>
            );
          })()}

          {/* ------------------------------- question -------------------------- */}
          <div
            {...handlers("question")}
            style={boxStyle("question", {
              display: "flex",
              flexDirection: qRtl ? "row-reverse" : "row",
              alignItems: "flex-start",
              gap: 22,
            })}
          >
            {!theme.bulletSeparate && theme.showBullet && (
              <BulletGraphic theme={theme} slide={slide} size={theme.bulletSize ?? 54} />
            )}
            <MathText
              text={slide.question}
              style={boxFontCss(theme, "question", {
                color: theme.questionColor,
                fontSize: qSize,
                fontWeight: 600,
                lineHeight: 1.6,
                letterSpacing: 0.2,
                textShadow: "0 2px 6px rgba(0,0,0,.6)",
                flex: 1,
                textAlign: qRtl ? "right" : L.question.align,
              })}
            />
            <Grip id="question" />
          </div>

          {/* -------------------------------- options -------------------------- */}
          <div
            {...handlers("options")}
            style={boxStyle("options", {
              display: "grid",
              gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
              columnGap: 44,
              rowGap,
              alignContent: "center",
            })}
          >
            {slide.options.map((opt, i) => {
              const correct = slide.showAnswer && slide.answer === opt.key;
              const highlight = correct && theme.answerStyle !== "tick";
              const rtl = isRtlText(opt.text);
              const oStyle = (theme.optionStyle ?? "plain") as OptionStyle;
              const oColor = theme.optionAccent || theme.accent;
              const chrome = optionRowStyle(oStyle, theme, oColor, highlight);
              return (
                <div
                  key={`${opt.key}-${i}`}
                  onClick={(e) => {
                    if (!editable) return;
                    e.stopPropagation();
                    onField?.(`option:${i}`);
                    onSelect?.("options");
                  }}
                  style={{
                    ...chrome.row,
                    flexDirection: rtl ? "row-reverse" : "row",
                    justifyContent:
                      L.options.align === "center" ? "center" : L.options.align === "right" ? "flex-end" : chrome.row.justifyContent,
                  }}
                >
                  <OptionBulletMarker
                    theme={theme}
                    color={oColor}
                    size={circle}
                    keyText={opt.key}
                    highlight={highlight}
                    optionStyle={oStyle}
                    fontFamily={boxStack(theme, "options")}
                  />
                  <MathText
                    text={opt.text}
                    style={{
                      color: correct ? "#5cff9d" : theme.optionTextColor,
                      fontSize: optSize,
                      fontWeight: 700,
                      lineHeight: optLineH,
                      textShadow: correct ? "0 0 18px rgba(92,255,157,.5)" : "0 2px 5px rgba(0,0,0,.6)",
                      textAlign: rtl ? "right" : "left",
                    }}
                  />
                  {correct && theme.answerStyle === "tick" && (
                    <span style={{ color: "#5cff9d", fontSize: optSize, fontWeight: 800 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* -------------------------------- note ----------------------------- */}
          {slide.note?.trim() ? (
            <div
              {...handlers("note")}
              style={boxStyle("note", boxFontCss(theme, "note", {
                color: withAlpha("#ffffff", 0.72),
                fontSize: 20,
                fontWeight: 500,
              }))}
            >
              <MathText text={slide.note} />
              <Grip id="note" />
            </div>
          ) : null}

          {/* ------------------------- shapes & text boxes --------------------- */}
          {allShapes.length > 0 && (
            <ShapeLayer
              shapes={allShapes}
              boardRef={boardRef}
              editable={editable}
              selectedId={selectedShape ?? null}
              onSelect={onSelectShape}
              onChange={onShapeChange}
              fontFamily={bodyStack}
              snap={shapeSnap}
              smartGuides={theme.smartGuides ?? true}
              extraTargets={theme.smartGuides === false ? [] : snapTargets("")}
              onGestureEnd={onGestureEnd}
            />
          )}

          {movable &&
            (Object.keys(L) as ElementId[]).map((id) => <ElementOverlay key={`ov-${id}`} id={id} />)}

          {typeof index === "number" && typeof total === "number" && (
            <div
              style={{
                position: "absolute",
                right: 26,
                bottom: 14,
                color: withAlpha("#ffffff", 0.35),
                fontFamily: boxStack(theme, "badge"),
                fontSize: 18,
                letterSpacing: 1,
              }}
            >
              {index + 1}/{total}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/** memoised so large decks keep their thumbnails cheap to re-render */
export default memo(SlideBase);
