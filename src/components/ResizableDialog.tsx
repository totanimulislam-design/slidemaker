import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

/**
 * A dialog whose size can be changed three ways:
 *   • drag the bottom-right corner (or any edge grip) to resize freely
 *   • the ⤢ button toggles a maximised (near full-screen) state
 *   • sizes are remembered per `storageKey`
 * The children get a split view via <SplitPane>.
 */

interface Size {
  w: number;
  h: number;
}

interface Props {
  storageKey: string;
  initial?: Size;
  min?: Size;
  children: ReactNode;
  className?: string;
  /** rendered inside the header's right side, before the close button */
  headerExtra?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

const readSize = (key: string, fallback: Size): Size => {
  try {
    const raw = localStorage.getItem(`dlg:${key}`);
    if (raw) {
      const s = JSON.parse(raw) as Size;
      if (s.w > 200 && s.h > 200) return s;
    }
  } catch {
    /* ignore */
  }
  return fallback;
};

export default function ResizableDialog({
  storageKey,
  initial = { w: 1100, h: 700 },
  min = { w: 560, h: 420 },
  children,
  className,
  headerExtra,
  title,
  subtitle,
  onClose,
  footer,
}: Props) {
  const [size, setSize] = useState<Size>(() => readSize(storageKey, initial));
  const [maxed, setMaxed] = useState(false);
  const drag = useRef<{ sx: number; sy: number; w: number; h: number; ex: number; ey: number } | null>(null);

  const viewport = () => ({ w: window.innerWidth - 32, h: window.innerHeight - 32 });

  useEffect(() => {
    if (!maxed) localStorage.setItem(`dlg:${storageKey}`, JSON.stringify(size));
  }, [size, maxed, storageKey]);

  // clamp to the viewport on window resize
  useEffect(() => {
    const onResize = () => {
      const v = viewport();
      setSize((s) => ({ w: Math.min(s.w, v.w), h: Math.min(s.h, v.h) }));
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** ex/ey ∈ {-1,0,1}: which edges move (1 = right/bottom, -1 = left/top) */
  const start = (ex: number, ey: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (maxed) return;
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, w: size.w, h: size.h, ex, ey };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const v = viewport();
      // the dialog is centred, so dragging one edge changes width by 2×
      const dw = (e.clientX - d.sx) * d.ex * 2;
      const dh = (e.clientY - d.sy) * d.ey * 2;
      setSize({
        w: Math.max(min.w, Math.min(v.w, d.w + dw)),
        h: Math.max(min.h, Math.min(v.h, d.h + dh)),
      });
    },
    [min.w, min.h],
  );
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    drag.current = null;
  };

  const grip = (ex: number, ey: number, style: React.CSSProperties, cursor: string) => (
    <div
      onPointerDown={start(ex, ey)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ position: "absolute", zIndex: 5, cursor: maxed ? "default" : cursor, touchAction: "none", ...style }}
    />
  );

  const v = typeof window !== "undefined" ? viewport() : { w: 1200, h: 800 };
  const w = maxed ? v.w : size.w;
  const h = maxed ? v.h : size.h;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl",
          className,
        )}
        style={{ width: w, height: h, maxWidth: "100%", maxHeight: "100%" }}
      >
        {/* edge & corner grips */}
        {grip(1, 0, { top: 12, bottom: 12, right: -3, width: 8 }, "ew-resize")}
        {grip(-1, 0, { top: 12, bottom: 12, left: -3, width: 8 }, "ew-resize")}
        {grip(0, 1, { left: 12, right: 12, bottom: -3, height: 8 }, "ns-resize")}
        {grip(0, -1, { left: 12, right: 12, top: -3, height: 8 }, "ns-resize")}
        {grip(1, 1, { right: -3, bottom: -3, width: 20, height: 20 }, "nwse-resize")}
        {grip(-1, 1, { left: -3, bottom: -3, width: 20, height: 20 }, "nesw-resize")}
        {grip(1, -1, { right: -3, top: -3, width: 20, height: 20 }, "nesw-resize")}
        {grip(-1, -1, { left: -3, top: -3, width: 20, height: 20 }, "nwse-resize")}
        {!maxed && (
          <div
            className="pointer-events-none absolute right-1.5 bottom-1.5 z-[6] text-[11px] text-slate-600"
            title="Drag to resize"
          >
            ◢
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            {headerExtra}
            <button
              onClick={() => setMaxed((m) => !m)}
              title={maxed ? "Restore size" : "Maximise"}
              className="rounded-lg px-2.5 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              {maxed ? "⤡" : "⤢"}
            </button>
            <button
              onClick={() => {
                setSize(initial);
                setMaxed(false);
              }}
              title="Reset size"
              className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white/10 hover:text-white"
            >
              ↺
            </button>
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {footer && <div className="shrink-0 border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- split */

interface SplitProps {
  storageKey: string;
  left: ReactNode;
  right: ReactNode;
  /** initial share of the left pane, 0–1 */
  initial?: number;
  min?: number;
  max?: number;
  className?: string;
}

/** Two panes with a draggable divider. Stacks vertically on narrow widths. */
export function SplitPane({ storageKey, left, right, initial = 0.5, min = 0.25, max = 0.8, className }: SplitProps) {
  const [ratio, setRatio] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem(`split:${storageKey}`) ?? "");
      return Number.isFinite(v) ? v : initial;
    } catch {
      return initial;
    }
  });
  const [vertical, setVertical] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem(`split:${storageKey}`, String(ratio));
  }, [ratio, storageKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVertical(el.getBoundingClientRect().width < 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const raw = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    setRatio(Math.max(min, Math.min(max, raw)));
  };

  return (
    <div
      ref={ref}
      className={cn("flex min-h-0 flex-1", vertical ? "flex-col" : "flex-row", className)}
    >
      <div style={{ flexBasis: `${ratio * 100}%` }} className="flex min-h-0 min-w-0 flex-col">
        {left}
      </div>
      <div
        role="separator"
        title="Drag to resize · double-click to reset"
        onDoubleClick={() => setRatio(initial)}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          dragging.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        className={cn(
          "group relative shrink-0 select-none",
          vertical ? "my-1 h-3 cursor-row-resize" : "mx-1 w-3 cursor-col-resize",
        )}
        style={{ touchAction: "none" }}
      >
        <div
          className={cn(
            "absolute rounded-full bg-white/15 transition-colors group-hover:bg-amber-400/80 group-active:bg-amber-400",
            vertical ? "top-1 right-[40%] left-[40%] h-1" : "top-[40%] bottom-[40%] left-1 w-1",
          )}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  );
}
