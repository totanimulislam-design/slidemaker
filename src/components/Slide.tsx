import { memo, useMemo, useRef, type CSSProperties } from "react";
import type {
  Box,
  DeckHeader,
  ElementId,
  SlideData,
  SlideField,
  ThemeSettings,
} from "../lib/types";
import { shade, withAlpha } from "../lib/color";
import { isWideNumberStyle, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { effectiveOptionLabel } from "../lib/plainNumbering";
import { optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import OptionBulletMarker from "./OptionBulletMarker";
import { isRtlText } from "../lib/fonts";
import { boxFontCss, boxStack, boxTypeface, deckStack, optionTextStack } from "../lib/boxFonts";
import { BAND_CONTENT, safeZ } from "../lib/zorder";
import { ELEMENT_DEFAULT_Z, detachedPartBox, partZ } from "../lib/layers";
import type { LayerRef } from "../lib/layers";
import { bannerCss } from "../lib/banner";
import { backgroundLayers } from "../lib/background";
import type { BackgroundSettings } from "../lib/types";
import { DEFAULT_BANNER, DEFAULT_FRAME } from "../lib/types";
import { computeFrameCss } from "../lib/frameDesigns";
import { resolveFrameImageSrc } from "../lib/frameImages";
import { PART_BANNER, PART_BG_BOARD, PART_BG_DESIGN, PART_FRAME, PART_QBULLET, collectParts, optionBulletId, optionRowId, optionTextId, partInfo, type PartId } from "../lib/parts";
import { buildScene, type ObjKey } from "../lib/scene";
import MathText from "./MathText";
import ShapeVisuals from "./ShapeVisuals";
import InteractionLayer, { type EditTarget } from "./InteractionLayer";
import type { ShapeItem } from "../lib/shapes";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

/** re-exported so existing importers (`App`, `Inspector`) keep working */
export type { SlideField };

/**
 * SLIDE — pure rendering of one slide.
 *
 * This component paints the slide exactly as designed (frame, background
 * layers, logo, brand, title + banner, badge, number bullet, question,
 * options, footnote, detached parts and drawn shapes) and tags every built-in
 * object with `data-obj="<kind>:<id>"`. It contains NO selection, drag,
 * resize, group or hit-testing code of its own: when the slide is editable,
 * it mounts the ONE object interaction system (`InteractionLayer`), which
 * owns every pointer behaviour through those tags.
 */

interface Props {
  slide: SlideData;
  header: DeckHeader;
  theme: ThemeSettings;
  /** effective background for this slide (deck default merged with the slide override) */
  background?: BackgroundSettings;
  /** deck-wide shapes rendered beneath the slide's own */
  globalShapes?: ShapeItem[];
  total?: number;
  index?: number;

  /* ---- object interaction system (present ⇒ the slide is editable) ---- */
  /** current selection as object keys (`element:…` / `part:…` / `shape:…`) */
  selection?: ObjKey[];
  /** commit a new selection (`exact` skips group expansion) */
  onSelect?: (keys: ObjKey[], opts?: { exact?: boolean }) => void;
  /** ONE batched geometry write for any mix of objects — a single undo step */
  onGeo?: (updates: { ref: LayerRef; patch: Partial<Box> }[]) => void;
  onGroup?: (refs: LayerRef[]) => void;
  onUngroup?: (refs: LayerRef[]) => void;
  /** double-click on a non-text object: open its edit options (inspector) */
  onOpenOptions?: (ref: LayerRef, field: SlideField | null) => void;
  /** inline text editing (double-click) of a built-in text field */
  onTextChange?: (field: SlideField, value: string) => void;
  /** inline text editing of a drawn shape's own text */
  onShapeText?: (id: string, text: string) => void;
  /** frame grip drag: new frame thickness in slide px */
  onFrameWidth?: (width: number) => void;
  /** a drag/resize/rotate finished — closes the undo coalescing window */
  onGestureEnd?: () => void;
  /** inspector field routing (kept for the editor chrome) */
  onField?: (field: SlideField | null) => void;
}

function BulletGraphic({
  theme: t,
  slide: sl,
  size,
  partProps,
}: {
  theme: ThemeSettings;
  slide: SlideData;
  size: number;
  partProps?: React.HTMLAttributes<HTMLDivElement> & { "data-obj"?: string };
}) {
  const id = (t.numberStyle ?? "circle") as NumberStyle;
  const r = renderNumberStyle(id, t, size, sl.number);
  const slash = id === "slash";
  const { style: partStyle, ...partRest } = partProps ?? {};
  return (
    <div
      {...partRest}
      style={{ ...r.style, fontSize: size * r.fontScale, color: r.color, fontFamily: boxStack(t, "bullet"), ...(partStyle ?? {}) }}
    >
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
}

function SlideBase({
  slide,
  header,
  theme,
  background,
  globalShapes,
  total,
  index,
  selection,
  onSelect,
  onGeo,
  onGroup,
  onUngroup,
  onOpenOptions,
  onTextChange,
  onShapeText,
  onFrameWidth,
  onGestureEnd,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const editable = !!onSelect;
  const L = theme.layout;
  const isFree = (id: ElementId) => (L[id].mode ?? "align") === "free";

  const allShapes = [...(globalShapes ?? []), ...(slide.shapes ?? [])];

  /** every built-in part actually painted on this slide */
  const parts = collectParts(theme, slide, header, background);
  const partById = new Map(parts.map((p) => [p.id, p]));

  /** the full object model of this slide (elements + parts + shapes) */
  const scene = useMemo(
    () => buildScene({ theme, slide, header, background, globalShapes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, slide, header, background, globalShapes],
  );

  /* ------------------------------ positioning ------------------------------ */

  /** tags + edit-mode affordances of a built-in ELEMENT object */
  const elementAttrs = (id: ElementId): React.HTMLAttributes<HTMLDivElement> & { "data-obj": string } => ({
    "data-obj": `element:${id}`,
    ...(editable
      ? {
          style: {
            cursor: "move",
            touchAction: "none",
            userSelect: "none",
            outline: "2px dashed transparent",
            outlineOffset: 6,
            borderRadius: 10,
          } as CSSProperties,
        }
      : {}),
  });

  /** tags + edit-mode affordances of a built-in PART object */
  const partAttrs = (id: PartId): React.HTMLAttributes<HTMLElement> & { "data-obj": string } => ({
    "data-obj": `part:${id}`,
    ...(editable
      ? {
          style: {
            cursor: partInfo(id).movable ? "move" : "pointer",
            touchAction: "none",
            userSelect: "none",
            pointerEvents: "auto",
          } as CSSProperties,
        }
      : { style: { pointerEvents: "none" } as CSSProperties }),
  });

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
      ...extra,
    };
  };

  /* -------------------------------- sizing -------------------------------- */
  const optionCount = Math.max(slide.options.length, 1);
  const twoCol = theme.optionsLayout === "two-col" || theme.optionsLayout === "grid";

  const qLen = slide.question.replace(/\$/g, "").length;
  const autoQ = qLen > 300 ? 0.66 : qLen > 230 ? 0.74 : qLen > 170 ? 0.83 : qLen > 115 ? 0.91 : 1;
  const qSize = theme.questionSize * slide.scale * autoQ * (boxTypeface(theme, "question").scale ?? 1);

  const maxOptLen = slide.options.reduce((m, o) => Math.max(m, o.text.replace(/\$/g, "").length), 0);
  const perCol = (L.options.w / (twoCol ? 2 : 1)) * 0.36; // rough chars that fit
  const autoO = maxOptLen > perCol * 2.4 ? 0.62 : maxOptLen > perCol * 1.6 ? 0.74 : maxOptLen > perCol ? 0.86 : 1;
  const optSize = theme.optionSize * slide.scale * autoO * (boxTypeface(theme, "options").scale ?? 1);
  const circle = Math.round(Math.max(optSize * 1.45, 32));
  const baseGap = optionCount > 4 ? Math.max(10, 34 - (optionCount - 4) * 8) : optionCount === 4 ? 24 : 32;
  // user-set spacing (optionGap in % of board height) overrides the auto tight packing
  const optLineH = theme.optionLineHeight ?? 1.45;
  const rowGap = theme.optionGap
    ? Math.round((theme.optionGap / 100) * SLIDE_H)
    : Math.round(baseGap * (autoO < 1 ? 0.7 : 1));

  const bodyStack = boxStack(theme, "question");
  /**
   * Option text only — applied directly to the element that paints an option's
   * text, never to the options container or the slide, so the choice cannot
   * inherit into the question, header, title, note or any shape.
   */
  const optionStack = optionTextStack(theme);
  /** The marker / plain numbering keep the deck face, independent of the option font. */
  const optionMarkerStack = deckStack(theme, "options");
  const qRtl = isRtlText(slide.question);

  const frame = theme.frame ?? DEFAULT_FRAME;
  const frameOn = theme.showFrame && frame.style !== "none";
  const frameCss = computeFrameCss(frame, frameOn);

  // If a frame image is chosen, check its placement mode (defaults to "fit" so it NEVER overlaps slide content)
  const frameImageSrc = resolveFrameImageSrc(frame.image);
  const hasFrameImage = !!frameImageSrc;
  const isImageOverlayMode = frame.imagePlacement === "overlay";
  const imageInsetPct = hasFrameImage && !isImageOverlayMode ? (frame.imageInset ?? 10) : 0;
  // Convert percentage inset into pixels for 1280x720:
  const imageInsetX = Math.round((imageInsetPct / 100) * SLIDE_W);
  const imageInsetY = Math.round((imageInsetPct / 100) * SLIDE_H);
  const frameSelectable = editable && partById.has(PART_FRAME);

  /* ------------------------- background layer order ----------------------- */
  const bgLayers = background ? backgroundLayers(background, theme.board) : [];
  // stacking of the decorative layers follows the unified z (reordering them in
  // the layers panel really changes what is painted on top)
  const bgOrder = [...bgLayers]
    .map((l) => ({ id: l.id, z: partZ(theme, l.id) }))
    .sort((a, b) => a.z - b.z)
    .map((x, i) => [x.id, i] as const);
  const bgZ = new Map(bgOrder);
  const bgDesignBox = detachedPartBox(theme, PART_BG_DESIGN);
  /** the slide's base background as a free object (undefined = full bleed) */
  const bgBoardBox = detachedPartBox(theme, PART_BG_BOARD);

  /* ---------------------------- detached parts ---------------------------- */
  /** built-in parts the user moved: painted straight onto the board */
  const detached: React.ReactNode[] = [];
  const detachedStyle = (id: PartId, b: Box, extra?: CSSProperties): CSSProperties => ({
    position: "absolute",
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w}%`,
    height: b.h ? `${b.h}%` : undefined,
    transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
    transformOrigin: "center center",
    zIndex: BAND_CONTENT + safeZ(b.z, partZ(theme, id)),
    boxSizing: "border-box",
    ...extra,
  });


  /**
   * A detached bullet's box height vs its natural px size: resizing the bullet
   * object (handles or group grip) scales the marker graphic to match.
   */
  const bulletScale = (hPct: number | undefined, basePx: number) => {
    const baseH = (basePx / SLIDE_H) * 100;
    if (!hPct || baseH <= 0) return 1;
    return Math.min(5, Math.max(0.2, hPct / baseH));
  };

  /* ------------------------------- options -------------------------------- */

  const renderOptions = () => {
    const inFlow: React.ReactNode[] = [];
    slide.options.forEach((opt, i) => {
      const correct = slide.showAnswer && slide.answer === opt.key;
      const highlight = correct && theme.answerStyle !== "tick";
      // effective label: manual edits always win; auto uses plain numbering
      const markerText = effectiveOptionLabel(opt.labelMode, opt.key, theme.plainNumbering, i);
      const rtl = isRtlText(opt.text);
      const oStyle = (theme.optionStyle ?? "plain") as OptionStyle;
      const oColor = theme.optionAccent || theme.accent;
      const chrome = optionRowStyle(oStyle, theme, oColor, highlight);

      const rowId = optionRowId(i);
      const bulletId = optionBulletId(i);
      const textId = optionTextId(i);
      const rowBox = detachedPartBox(theme, rowId);
      const bulletBox = detachedPartBox(theme, bulletId);
      const textBox = detachedPartBox(theme, textId);

      const textStyle: CSSProperties = {
        color: correct ? "#5cff9d" : theme.optionTextColor,
        // the OPTION TEXT FONT lands here and nowhere else — this
        // element is the only consumer of `optionStack`
        fontFamily: optionStack,
        fontSize: optSize,
        fontWeight: 700,
        lineHeight: optLineH,
        textShadow: correct ? "0 0 18px rgba(92,255,157,.5)" : "0 2px 5px rgba(0,0,0,.6)",
        textAlign: rtl ? "right" : "left",
      };

      /* ---- the option's numbering / bullet marker (its own selectable object) ---- */
      const marker = (extra?: CSSProperties, asPart = true, size = circle) => {
        const attrs = partAttrs(bulletId);
        return (
          <OptionBulletMarker
            theme={theme}
            color={oColor}
            size={size}
            keyText={markerText}
            highlight={highlight}
            optionStyle={oStyle}
            // the marker / plain numbering keep the deck face: the
            // option text font must not reach them
            fontFamily={optionMarkerStack}
            wrapperProps={
              asPart
                ? ({
                    ...attrs,
                    style: {
                      flex: "0 0 auto",
                      position: "relative",
                      zIndex: 2,
                      ...(attrs.style ?? {}),
                      ...extra,
                    },
                  } as React.HTMLAttributes<HTMLSpanElement>)
                : ({ style: { flex: "0 0 auto", ...extra } } as React.HTMLAttributes<HTMLSpanElement>)
            }
          />
        );
      };

      /* ---- the option's text (its own selectable object) ---- */
      const text = (asPart = true) => {
        const attrs = partAttrs(textId);
        return (
          <MathText
            text={opt.text}
            style={{
              ...textStyle,
              ...(asPart
                ? {
                    position: "relative",
                    display: "block",
                    minWidth: 0,
                    zIndex: 3,
                    ...(attrs.style ?? {}),
                  }
                : {}),
            }}
            domProps={asPart ? ({ "data-obj": attrs["data-obj"] } as React.HTMLAttributes<HTMLSpanElement>) : undefined}
          />
        );
      };

      const tick =
        correct && theme.answerStyle === "tick" ? (
          <span style={{ color: "#5cff9d", fontSize: optSize, fontWeight: 800 }}>✓</span>
        ) : null;

      const rowCss: CSSProperties = {
        ...chrome.row,
        flexDirection: rtl ? "row-reverse" : "row",
        justifyContent:
          L.options.align === "center" ? "center" : L.options.align === "right" ? "flex-end" : chrome.row.justifyContent,
      };

      const inner = (
        <>
          {bulletBox ? null : marker()}
          {textBox ? null : text()}
          {tick}
        </>
      );

      // a detached option paints row-background FIRST, then marker, then text:
      // all three share the same z-band, so DOM order decides and the row's
      // background can never paint over its (detached) numbering / text
      if (rowBox) {
        const attrs = partAttrs(rowId);
        detached.push(
          <div
            key={`d-${rowId}`}
            {...attrs}
            style={detachedStyle(rowId, rowBox, {
              ...rowCss,
              display: "flex",
              alignItems: "center",
              overflow: "visible",
              ...(attrs.style ?? {}),
            })}
          >
            {inner}
          </div>,
        );
      }
      // a detached marker / text is painted straight onto the board
      if (bulletBox) {
        const attrs = partAttrs(bulletId);
        detached.push(
          <div
            key={`d-${bulletId}`}
            {...attrs}
            style={detachedStyle(bulletId, bulletBox, {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(attrs.style ?? {}),
            })}
          >
            {marker(undefined, false, circle * bulletScale(bulletBox.h, circle))}
          </div>,
        );
      }
      if (textBox) {
        const attrs = partAttrs(textId);
        detached.push(
          <div
            key={`d-${textId}`}
            {...attrs}
            style={detachedStyle(textId, textBox, {
              ...textStyle,
              width: "100%",
              overflow: "visible",
              ...(attrs.style ?? {}),
            })}
          >
            <MathText text={opt.text} style={{ ...textStyle, display: "block", width: "100%" }} />
          </div>,
        );
      }
      if (rowBox) return;

      const attrs = partAttrs(rowId);
      inFlow.push(
        <div
          key={rowId}
          {...attrs}
          style={{
            ...rowCss,
            position: "relative",
            zIndex: 1,
            ...(attrs.style ?? {}),
          }}
        >
          {inner}
        </div>,
      );
    });
    return inFlow;
  };

  const optionRows = renderOptions();

  /* --------------------------- inline text bridge -------------------------- */

  const fieldText = (field: SlideField): string => {
    switch (field) {
      case "title":
        return header.title ?? "";
      case "brandTop":
        return header.brandTop ?? "";
      case "brandBottom":
        return header.brandBottom ?? "";
      case "badge":
        return slide.badge ?? header.badge ?? "";
      case "question":
        return slide.question ?? "";
      case "note":
        return slide.note ?? "";
      default: {
        const s = String(field);
        if (s.startsWith("option:")) return slide.options[Number(s.slice(7))]?.text ?? "";
        return "";
      }
    }
  };

  const getText = (t: EditTarget): string => {
    if (t.field) return fieldText(t.field);
    if (t.ref.kind === "shape") return allShapes.find((s) => s.id === t.ref.id)?.text ?? "";
    return "";
  };

  const commitText = (t: EditTarget, value: string) => {
    if (t.field) onTextChange?.(t.field, value);
    else if (t.ref.kind === "shape") onShapeText?.(t.ref.id, value);
  };

  /* --------------------------------- JSX --------------------------------- */
  return (
    <div
      ref={rootRef}
      className={editable ? "slide-editable" : undefined}
      {...(frameSelectable ? { "data-obj": `part:${PART_FRAME}` } : {})}
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
        ...(frameSelectable ? { cursor: "pointer" } : {}),
      }}
    >
      {/* If a frame image is active, render it BEHIND the board in "fit" mode so it never covers slide elements */}
      {hasFrameImage && (
        <div
          aria-hidden
          data-frame-image=""
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: isImageOverlayMode ? 80 : 0,
            backgroundImage: `url(${frameImageSrc})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            ...(isImageOverlayMode && frameImageSrc?.toLowerCase().match(/\.(jpg|jpeg|png)(\?|$)/)
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
        {...(frameSelectable ? { "data-obj": `part:${PART_FRAME}` } : {})}
      >
        {/* ------------------------------- board ------------------------------ */}
        <div
          ref={boardRef}
          data-board=""
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            borderRadius: frameCss.innerRadius,
            // in edit mode the base background is painted by its own selectable
            // layer (part "bgBoard") over a flat board-colour fallback, so
            // shrinking the background reveals the board colour — and read-only
            // renders keep the old inline fill so exports stay identical
            background:
              editable && partById.has(PART_BG_BOARD)
                ? theme.board
                : `radial-gradient(120% 90% at 50% -10%, ${shade(theme.board, 0.16)} 0%, ${theme.board} 62%)`,
            position: "relative",
            overflow: "hidden",
            // isolated stacking context: a child can never end up behind this background
            isolation: "isolate",
            zIndex: 1,
          }}
        >
          {/* ------------------------- slide background ------------------------ */}
          {editable && partById.has(PART_BG_BOARD) && (
            <div
              data-obj={`part:${PART_BG_BOARD}`}
              style={{
                position: "absolute",
                ...(bgBoardBox
                  ? {
                      left: `${bgBoardBox.x}%`,
                      top: `${bgBoardBox.y}%`,
                      width: `${bgBoardBox.w}%`,
                      height: `${bgBoardBox.h ?? 100}%`,
                      transform: bgBoardBox.rot ? `rotate(${bgBoardBox.rot}deg)` : undefined,
                      transformOrigin: "center center",
                    }
                  : { inset: 0 }),
                background: `radial-gradient(120% 90% at 50% -10%, ${shade(theme.board, 0.16)} 0%, ${theme.board} 62%)`,
                zIndex: partZ(theme, PART_BG_BOARD),
                pointerEvents: "auto",
                cursor: "move",
                touchAction: "none",
                boxSizing: "border-box",
              }}
            />
          )}

          {/* ------------------------------ background ------------------------- */}
          {bgLayers.map((l) => {
            const isDesign = l.id === PART_BG_DESIGN;
            // the artwork is a real object (drag / resize it); every other
            // background layer only joins the hit-test chain, so it can be
            // picked with a click or Alt+click but never blocks anything
            const artBox = isDesign ? bgDesignBox : null;
            const artStyle: CSSProperties =
              isDesign && artBox
                ? {
                    ...l.style,
                    inset: undefined,
                    left: `${artBox.x}%`,
                    top: `${artBox.y}%`,
                    width: `${artBox.w}%`,
                    height: `${artBox.h ?? 100}%`,
                    backgroundSize: "100% 100%",
                    backgroundPosition: "left top",
                    backgroundRepeat: "no-repeat",
                    transform: artBox.rot ? `rotate(${artBox.rot}deg)` : undefined,
                    transformOrigin: "center center",
                  }
                : l.style;
            return (
              <div
                key={`bg-${l.id}`}
                data-bg=""
                data-obj={`part:${l.id}`}
                style={{
                  ...artStyle,
                  zIndex: bgZ.get(l.id) ?? 0,
                  // decorative layers sit under everything, so they only ever
                  // receive clicks that no other object claimed — they can never
                  // block the built-in elements above them
                  pointerEvents: editable ? "auto" : "none",
                  cursor: editable ? (isDesign ? "move" : "pointer") : undefined,
                  touchAction: editable ? "none" : undefined,
                }}
              />
            );
          })}

          {/* -------------------------------- logo ---------------------------- */}
          {header.showLogo && header.logo && (
            <div {...elementAttrs("logo")} style={boxStyle("logo", { lineHeight: 0, ...(elementAttrs("logo").style ?? {}) })}>
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
            </div>
          )}

          {/* -------------------------------- brand --------------------------- */}
          <div
            {...elementAttrs("brand")}
            style={boxStyle("brand", {
              ...boxFontCss(theme, "brand", {
                color: theme.brandColor,
                textTransform: "uppercase",
                lineHeight: 1.05,
                fontWeight: 700,
                letterSpacing: 0.4,
              }),
              ...(elementAttrs("brand").style ?? {}),
            })}
          >
            {(["brandTop", "brandBottom"] as const).map((f, i) => (
              <div key={f} data-field={f} style={{ fontSize: i === 0 ? 25 : 27 }}>
                {f === "brandTop" ? header.brandTop : header.brandBottom}
              </div>
            ))}
          </div>

          {/* -------------------------------- title --------------------------- */}
          {(() => {
            const bset = { ...DEFAULT_BANNER, ...(theme.banner ?? {}), color: theme.banner?.color ?? theme.titleBanner };
            const css = bannerCss(bset, theme.titleColor);
            const bannerBox = detachedPartBox(theme, PART_BANNER);
            const bannerInside = (asPart: boolean) => (
              <>
                {header.showBanner && css.halo && <div style={css.halo} />}
                {header.showBanner && (
                  <div
                    className={bset.shimmer ? "banner-shimmer" : undefined}
                    style={{
                      ...css.box,
                      ...(asPart
                        ? {
                            pointerEvents: editable ? "auto" : "none",
                            cursor: editable ? "move" : undefined,
                          }
                        : {}),
                    }}
                  />
                )}
              </>
            );
            // a banner the user moved is painted onto the board as its own object
            if (bannerBox) {
              const attrs = partAttrs(PART_BANNER);
              detached.push(
                <div
                  key={`d-${PART_BANNER}`}
                  {...attrs}
                  style={detachedStyle(PART_BANNER, bannerBox, { ...(attrs.style ?? {}) })}
                >
                  {bannerInside(false)}
                </div>,
              );
            }
            const bannerAttrs = partAttrs(PART_BANNER);
            return (
              <div
                {...elementAttrs("title")}
                style={boxStyle("title", { position: "absolute", ...(elementAttrs("title").style ?? {}) })}
              >
                <div style={{ position: "relative", padding: css.padding }}>
                  {!bannerBox && partById.has(PART_BANNER) && (
                    // wrapper keeps the banner's own inset percentages resolving
                    // against exactly the same box as before → pixel-identical
                    <div
                      {...bannerAttrs}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        ...(bannerAttrs.style ?? {}),
                      }}
                    >
                      {bannerInside(false)}
                    </div>
                  )}
                  <div
                    style={boxFontCss(theme, "title", {
                      position: "relative",
                      zIndex: 1,
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
              </div>
            );
          })()}

          {/* -------------------------------- badge --------------------------- */}
          <div
            {...elementAttrs("badge")}
            style={boxStyle("badge", {
              ...boxFontCss(theme, "badge", {
                fontWeight: 700,
                fontSize: 36,
                letterSpacing: 0.5,
                color: theme.badgeColor,
                textTransform: "uppercase",
                textShadow: "0 2px 6px rgba(0,0,0,.6)",
                lineHeight: 1.15,
              }),
              ...(elementAttrs("badge").style ?? {}),
            })}
          >
            <span>{slide.badge?.trim() || header.badge}</span>
          </div>

          {/* ------------------------ number bullet (own element) ------------- */}
          {theme.bulletSeparate && theme.showBullet && (() => {
            const id = (theme.numberStyle ?? "circle") as NumberStyle;
            const size = theme.bulletSize ?? 54;
            const aspect = isWideNumberStyle(id) ? 1.6 : 1;
            return (
              <div
                {...elementAttrs("bullet")}
                style={boxStyle("bullet", {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(aspect !== 1 ? { width: `${((size * aspect) / SLIDE_W) * 100}%` } : {}),
                  ...(elementAttrs("bullet").style ?? {}),
                })}
              >
                <BulletGraphic theme={theme} slide={slide} size={size} />
              </div>
            );
          })()}

          {/* ------------------------------- question -------------------------- */}
          {(() => {
            const qBulletBox = detachedPartBox(theme, PART_QBULLET);
            const qBulletAttrs = partAttrs(PART_QBULLET);
            const qBullet = (size: number) => (
              <BulletGraphic
                theme={theme}
                slide={slide}
                size={size}
                partProps={
                  partById.has(PART_QBULLET) && !qBulletBox
                    ? ({
                        ...qBulletAttrs,
                        style: {
                          flex: "0 0 auto",
                          position: "relative",
                          zIndex: 2,
                          ...(qBulletAttrs.style ?? {}),
                          outline: "2px dashed transparent",
                          outlineOffset: 2,
                        },
                      } as React.HTMLAttributes<HTMLDivElement>)
                    : undefined
                }
              />
            );
            if (qBulletBox) {
              detached.push(
                <div
                  key={`d-${PART_QBULLET}`}
                  {...qBulletAttrs}
                  style={detachedStyle(PART_QBULLET, qBulletBox, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...(qBulletAttrs.style ?? {}),
                  })}
                >
                  {qBullet((theme.bulletSize ?? 54) * bulletScale(qBulletBox.h, theme.bulletSize ?? 54))}
                </div>,
              );
            }
            return (
              <div
                {...elementAttrs("question")}
                style={boxStyle("question", {
                  display: "flex",
                  flexDirection: qRtl ? "row-reverse" : "row",
                  alignItems: "flex-start",
                  gap: 22,
                  ...(elementAttrs("question").style ?? {}),
                })}
              >
                {!theme.bulletSeparate && theme.showBullet && !qBulletBox && qBullet(theme.bulletSize ?? 54)}
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
              </div>
            );
          })()}

          {/* -------------------------------- options -------------------------- */}
          <div
            {...elementAttrs("options")}
            style={boxStyle("options", {
              display: "grid",
              gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
              columnGap: 44,
              rowGap,
              alignContent: "center",
              ...(elementAttrs("options").style ?? {}),
            })}
          >
            {optionRows}
          </div>

          {/* -------------------------------- note ----------------------------- */}
          {slide.note?.trim() ? (
            <div
              {...elementAttrs("note")}
              style={boxStyle("note", {
                ...boxFontCss(theme, "note", {
                  color: withAlpha("#ffffff", 0.72),
                  fontSize: 20,
                  fontWeight: 500,
                }),
                ...(elementAttrs("note").style ?? {}),
              })}
            >
              <MathText text={slide.note} />
            </div>
          ) : null}

          {/* ---- built-in parts the user detached from their parent's flow ---- */}
          {detached}

          {/* ------------------------- shapes & text boxes --------------------- */}
          {allShapes.length > 0 && (
            <ShapeVisuals shapes={allShapes} editable={editable} fontFamily={bodyStack} />
          )}

          {/* ---------------- the ONE object interaction system ---------------- */}
          {editable && onSelect && onGeo && (
            <InteractionLayer
              boardRef={boardRef}
              rootRef={rootRef}
              scene={scene}
              theme={theme}
              selection={selection ?? []}
              onSelect={onSelect}
              onGeo={onGeo}
              onGroup={onGroup ?? (() => {})}
              onUngroup={onUngroup ?? (() => {})}
              onOpenOptions={onOpenOptions ?? (() => {})}
              onFrameWidth={onFrameWidth ?? (() => {})}
              onGestureEnd={onGestureEnd ?? (() => {})}
              getText={getText}
              commitText={commitText}
              editorFont={{ stack: bodyStack, qSize, optSize }}
            />
          )}

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
                pointerEvents: "none",
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
