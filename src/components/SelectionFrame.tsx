import type { CSSProperties, ReactNode } from "react";
import type { Handle } from "../lib/freeTransform";
import { BAND_UI } from "../lib/zorder";

export type { Handle };

/**
 * The Canva-style selection box shared by every selectable thing on the board:
 * drawn shapes, the multi/group frame and the built-in slide elements.
 *
 * A thin accent outline hugs the item, with eight grips on it:
 *
 *   • corners (nw · ne · se · sw) — squares; dragging one resizes BOTH axes
 *   • east / west — horizontal pills; dragging one resizes the WIDTH only
 *   • north / south — vertical pills; dragging one resizes the HEIGHT only
 *
 * plus a rotate grip above the top edge. Each grip is a 28px invisible hit
 * area around a smaller white visual, so the grabbable target stays generous
 * even when the item sits against the board edge (the board clips overflow).
 * Hovering a grip grows it and fills it with the accent colour (see
 * `.sel-handle` in index.css), which is what makes the edge grips read as
 * "drag sideways" / "drag up-down" instead of decoration.
 *
 * The frame itself never captures the pointer — only the grips do — so a
 * press inside the outline still moves the item, exactly like Canva.
 */

export const ALL_HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** the axis a grip drives: `h` = width only, `v` = height only, `both` = corner */
export const HANDLE_AXIS: Record<Handle, "h" | "v" | "both"> = {
  nw: "both",
  ne: "both",
  se: "both",
  sw: "both",
  e: "h",
  w: "h",
  n: "v",
  s: "v",
};

const CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  e: "ew-resize",
  w: "ew-resize",
  n: "ns-resize",
  s: "ns-resize",
};

export function handleTitle(h: Handle): string {
  const axis = HANDLE_AXIS[h];
  if (axis === "h") return "Drag to resize width — horizontal · Alt disables snapping";
  if (axis === "v") return "Drag to resize height — vertical · Alt disables snapping";
  return "Drag to resize both ways · Shift keeps the ratio · Alt disables snapping";
}

/** hit-box position of each grip, centred on its edge point (28px box) */
const HIT_POS: Record<Handle, CSSProperties> = {
  nw: { left: -14, top: -14 },
  n: { left: "50%", top: -14, marginLeft: -14 },
  ne: { right: -14, top: -14 },
  e: { right: -14, top: "50%", marginTop: -14 },
  se: { right: -14, bottom: -14 },
  s: { left: "50%", bottom: -14, marginLeft: -14 },
  sw: { left: -14, bottom: -14 },
  w: { left: -14, top: "50%", marginTop: -14 },
};

/** the painted grip: corners are squares, edge grips are pills along their axis */
function gripSize(h: Handle): { width: number; height: number; borderRadius: number } {
  const axis = HANDLE_AXIS[h];
  if (axis === "h") return { width: 20, height: 11, borderRadius: 6 };
  if (axis === "v") return { width: 11, height: 20, borderRadius: 6 };
  return { width: 13, height: 13, borderRadius: 3 };
}

export interface SelectionFrameProps {
  /** frame rect in % of the board */
  rect: { x: number; y: number; w: number; h: number };
  rot?: number;
  /** outline + grip-ring colour (yellow for shapes, cyan for deck elements) */
  accent?: string;
  dashed?: boolean;
  outlineOffset?: number;
  /** which grips to show (thin lines pass `["e", "w"]`); default all eight */
  handles?: Handle[];
  /** a locked item shows the frame only — no grips, nothing to drag */
  locked?: boolean;
  /** rotate grip top offset (thin lines sit higher); default -34 */
  rotateTop?: number;
  /** dimension label under the bottom-left corner */
  badge?: ReactNode;
  /** notices pinned above the frame (grouped / covered hints) */
  topLabels?: ReactNode;
  onResizeDown?: (handle: Handle) => (e: React.PointerEvent<HTMLDivElement>) => void;
  onRotateDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** data-* attributes for the frame node (data-sel / data-set-frame / …) */
  dataAttrs?: Record<string, string | undefined>;
  zIndex?: number;
}

export default function SelectionFrame({
  rect,
  rot = 0,
  accent = "#ffd633",
  dashed = false,
  outlineOffset = 2,
  handles = ALL_HANDLES,
  locked = false,
  rotateTop = -34,
  badge,
  topLabels,
  onResizeDown,
  onRotateDown,
  onPointerUp,
  onPointerCancel,
  dataAttrs,
  zIndex = BAND_UI + 15,
}: SelectionFrameProps) {
  const showGrips = !locked && !!onResizeDown;
  return (
    <div
      {...dataAttrs}
      style={
        {
          position: "absolute",
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.w}%`,
          height: `${rect.h}%`,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: "center center",
          zIndex,
          pointerEvents: "none",
          outline: `2px ${dashed ? "dashed" : "solid"} ${accent}`,
          outlineOffset,
          boxSizing: "border-box",
          "--sel-accent": accent,
        } as CSSProperties
      }
    >
      {topLabels}

      {showGrips &&
        handles.map((h) => (
          <div
            key={h}
            data-handle={h}
            data-axis={HANDLE_AXIS[h]}
            title={handleTitle(h)}
            onPointerDown={onResizeDown?.(h)}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="sel-handle"
            style={{
              position: "absolute",
              ...HIT_POS[h],
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: CURSOR[h],
              zIndex: BAND_UI + 20,
              touchAction: "none",
              pointerEvents: "auto",
            }}
          >
            <div
              className="sel-handle-visual"
              style={{
                ...gripSize(h),
                background: "#ffffff",
                border: `2px solid ${accent}`,
                boxShadow: "0 1px 4px rgba(0,0,0,.55)",
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />
          </div>
        ))}

      {showGrips && onRotateDown && (
        <>
          <div
            data-rotate=""
            title="Rotate · Shift snaps to 15°"
            onPointerDown={onRotateDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="sel-handle sel-rotate"
            style={{
              position: "absolute",
              left: "50%",
              top: rotateTop,
              width: 28,
              height: 28,
              marginLeft: -14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              zIndex: BAND_UI + 20,
              touchAction: "none",
              pointerEvents: "auto",
            }}
          >
            <div
              className="sel-rotate-visual"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#ffffff",
                border: `2px solid ${accent}`,
                boxShadow: "0 1px 4px rgba(0,0,0,.55)",
                boxSizing: "border-box",
                color: accent,
                fontSize: 11,
                lineHeight: "12px",
                textAlign: "center",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              ↻
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              // from the bottom of the rotate visual to 2px above the frame edge
              top: rotateTop + 22,
              width: 2,
              height: -(rotateTop + 22) - 2,
              marginLeft: -1,
              background: accent,
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {badge && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: -30,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,.75)",
            color: accent,
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            transform: rot ? `rotate(${-rot}deg)` : undefined,
            transformOrigin: "left top",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}
