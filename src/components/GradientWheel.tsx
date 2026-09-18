import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Gradient } from "../lib/types";
import { gradientCss } from "../lib/banner";
import { usePointerDrag } from "../lib/dragSession";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ math */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** hex → hsl (h 0–360, s/l 0–100) */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/* ------------------------------------------------------------ angle dial */

interface DialProps {
  value: Gradient;
  onChange: (g: Gradient) => void;
  fallback: string;
  size?: number;
}

/**
 * Circular dial: the disc shows the gradient at its current angle, the knob on
 * the rim sets the angle. Drag anywhere on the disc; Shift snaps to 15°.
 * Also drives radial "type" (centre button) and shows a 0/90/180/270 ring.
 */
export function GradientAngleWheel({ value, onChange, fallback, size = 148 }: DialProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const g = value;
  const r = size / 2;

  const setAngleFromPointer = (e: React.PointerEvent | PointerEvent, snap: boolean) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // CSS linear-gradient angle: 0° = to top, 90° = to right (clockwise)
    let deg = (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI;
    deg = (deg + 360) % 360;
    if (snap) deg = Math.round(deg / 15) * 15;
    onChange({ ...g, type: "linear", angle: Math.round(deg) % 360 });
  };

  const knobAngle = ((g.angle - 90) * Math.PI) / 180; // convert to screen (0° up)
  const kx = r + (r - 12) * Math.cos(knobAngle);
  const ky = r + (r - 12) * Math.sin(knobAngle);

  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setAngleFromPointer(e, e.shiftKey);
        }}
        onPointerMove={(e) => dragging.current && setAngleFromPointer(e, e.shiftKey)}
        onPointerUp={(e) => {
          dragging.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.shiftKey ? 15 : 1;
          onChange({ ...g, type: "linear", angle: (((g.angle + (e.deltaY > 0 ? step : -step)) % 360) + 360) % 360 });
        }}
        title="Drag to set the gradient angle · Shift snaps to 15° · scroll to fine-tune"
        className="relative shrink-0 cursor-grab select-none active:cursor-grabbing"
        style={{ width: size, height: size, touchAction: "none" }}
      >
        {/* rim ticks */}
        <div className="absolute inset-0 rounded-full border border-white/15" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const t = ((a - 90) * Math.PI) / 180;
          const major = a % 90 === 0;
          return (
            <div
              key={a}
              className={cn("absolute rounded-full", major ? "bg-white/50" : "bg-white/20")}
              style={{
                width: major ? 3 : 2,
                height: major ? 8 : 5,
                left: r + (r - 4) * Math.cos(t) - 1,
                top: r + (r - 4) * Math.sin(t) - (major ? 4 : 2.5),
                transform: `rotate(${a}deg)`,
              }}
            />
          );
        })}
        {/* gradient disc */}
        <div
          className="absolute rounded-full border border-black/40 shadow-inner"
          style={{
            inset: 16,
            background: gradientCss(g.enabled ? g : { ...g, enabled: true }, fallback),
          }}
        />
        {/* direction arrow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{ width: 2, height: r - 22, marginLeft: -1, marginTop: -(r - 22), transformOrigin: "50% 100%", transform: `rotate(${g.angle}deg)`, background: "rgba(255,255,255,.75)" }}
        >
          <div className="absolute -top-1 -left-[5px] h-0 w-0 border-x-[6px] border-b-[9px] border-x-transparent border-b-white/90" />
        </div>
        {/* knob */}
        <div
          className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-slate-950 bg-amber-300 shadow"
          style={{ left: kx - 10, top: ky - 10 }}
        />
        {/* radial toggle at centre */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ ...g, type: g.type === "radial" ? "linear" : "radial" })}
          title={g.type === "radial" ? "Radial — click for linear" : "Linear — click for radial"}
          className={cn(
            "absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[11px] font-bold shadow",
            g.type === "radial" ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/40 bg-slate-950/80 text-white",
          )}
        >
          {g.type === "radial" ? "◎" : "↗"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={360}
            value={g.angle}
            onChange={(e) => onChange({ ...g, type: "linear", angle: ((Number(e.target.value) % 360) + 360) % 360 })}
            className="w-16 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
          />
          <span className="text-slate-500">°</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            [0, "↑"],
            [90, "→"],
            [180, "↓"],
            [270, "←"],
            [45, "↗"],
            [135, "↘"],
            [225, "↙"],
            [315, "↖"],
          ].map(([a, icon]) => (
            <button
              key={a}
              onClick={() => onChange({ ...g, type: "linear", angle: Number(a) })}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[11px]",
                g.angle === a && g.type === "linear" ? "border-amber-400/70 bg-amber-400/15 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/10",
              )}
              title={`${a}°`}
            >
              {icon}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-500">{g.type === "radial" ? "Radial (centre → edge)" : `Linear ${g.angle}°`}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ colour wheel */

interface ColorWheelProps {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}

/** `#abc` / `#AABBCC` → `#aabbcc`, so the wheel's own echo compares equal */
const normHex = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "";
  const body = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${body.toLowerCase()}`;
};

/** the S/L square's paint: a white→black lightness shade over the hue ramp */
const squareFace = (h: number) =>
  "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%), " +
  `linear-gradient(to right, hsl(${h} 0% 50%), hsl(${h} 100% 50%))`;

/**
 * Hue ring + saturation/lightness square. Drag on the ring to change hue, drag
 * in the square to change saturation (x) and lightness (y).
 *
 * The marker has to BE the pointer — a picker that trails the cursor is not a
 * picker — so the gesture paints first and records second:
 *
 *  1. `paint()` writes the ring's marker, the square's ramp and the square's
 *     marker straight into the DOM on every move, so what is under the cursor
 *     is on screen in that same event. A React render is not in that path: the
 *     editor's deck write re-renders the whole board, and waiting for it is
 *     what made the wheel lag behind the mouse. Marker left/top are not driven
 *     by React state while the pointer owns the wheel — a render would stamp
 *     last-flushed coordinates over the live position and the marker would
 *     trail. After any parent render, `useLayoutEffect` restores `live`.
 *  2. the editor is told ONCE PER FRAME (`flush`), with the newest colour, so a
 *     sweep is ~60 writes instead of one per pointermove and the board below
 *     still previews live. A press flushes at once — a click must not wait for
 *     a frame — and the end of the gesture flushes what is still pending, so
 *     the colour the marker shows is always the colour that is committed.
 *  3. the gesture runs on the shared drag session, so it survives the pointer
 *     leaving the wheel (window-wide moves, not just the element's), and a
 *     release, cancel or blur ends it — a hover can never paint.
 */
export function ColorWheel({ value, onChange, size = 148 }: ColorWheelProps) {
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const ringRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueDotRef = useRef<HTMLDivElement>(null);
  const sqDotRef = useRef<HTMLDivElement>(null);
  /** which surface the live gesture is painting — the hue ring or the square */
  const mode = useRef<"ring" | "sq" | null>(null);
  /** the colour the pointer has picked: the truth while a gesture is live */
  const live = useRef(hsl);
  /** the colour the editor has not been told about yet, and the frame that tells it */
  const pending = useRef<{ h: number; s: number; l: number } | null>(null);
  const frame = useRef<number | null>(null);
  /** the last colour handed to the editor, so its echo is not read as an outside change */
  const echo = useRef("");
  /** latest onChange — the rAF flush must not close over a stale editor writer */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** skip rewriting the square's gradient unless hue actually moved */
  const paintedHue = useRef<number | null>(null);
  /** picker geometry, measured on press so moves don't force layout */
  const ringBox = useRef<DOMRect | null>(null);
  const sqBox = useRef<DOMRect | null>(null);

  const r = size / 2;
  const ring = 16;
  const sq = Math.round((r - ring - 6) * Math.SQRT2);

  /** paints the wheel from one hsl triple — no React render in the way */
  const paint = (h: number, s: number, l: number) => {
    const angle = ((h - 90) * Math.PI) / 180;
    const hue = hueDotRef.current;
    if (hue) {
      hue.style.left = `${r + (r - ring / 2) * Math.cos(angle) - 8}px`;
      hue.style.top = `${r + (r - ring / 2) * Math.sin(angle) - 8}px`;
      hue.style.background = hslToHex(h, 100, 50);
    }
    const face = squareRef.current;
    if (face && paintedHue.current !== h) {
      face.style.background = squareFace(h);
      paintedHue.current = h;
    }
    const marker = sqDotRef.current;
    if (marker) {
      marker.style.left = `${(s / 100) * sq - 7}px`;
      marker.style.top = `${((100 - l) / 100) * sq - 7}px`;
      marker.style.background = hslToHex(h, s, l);
    }
  };

  /**
   * Hands the newest colour to the editor, at most once per frame.
   * `syncUi` writes React state (the h/s/l fields). During a live drag that
   * write is skipped: a render would stamp last-flushed left/top onto the
   * markers and yank them behind the pointer.
   */
  const flush = (syncUi = false) => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    live.current = next;
    const hex = hslToHex(next.h, next.s, next.l);
    echo.current = normHex(hex);
    if (syncUi || !mode.current) setHsl(next);
    onChangeRef.current(hex);
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  /** a pointer move (or press) picks: paint now, tell the editor this frame */
  const pick = (h: number, s: number, l: number) => {
    live.current = { h, s, l };
    paint(h, s, l);
    pending.current = { h, s, l };
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        flushRef.current();
      });
    }
  };

  /** a panel field (the h / s / l numbers): applied at once, so the field keeps its draft */
  const apply = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    live.current = { h, s, l };
    echo.current = normHex(hex);
    setHsl({ h, s, l });
    paint(h, s, l);
    onChangeRef.current(hex);
  };

  /** the hex field: the spelling typed is what the deck gets, the wheel follows it */
  const applyHex = (hex: string) => {
    const next = hexToHsl(hex);
    live.current = next;
    echo.current = normHex(hex);
    setHsl(next);
    paint(next.h, next.s, next.l);
    onChangeRef.current(hex);
  };

  const pickFromRing = (e: { clientX: number; clientY: number }) => {
    const rect = ringBox.current ?? ringRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const h = (Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90) + 360) % 360;
    pick(h, live.current.s, live.current.l);
  };

  const pickFromSquare = (e: { clientX: number; clientY: number }) => {
    const rect = sqBox.current ?? squareRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp(Math.round(((e.clientX - rect.left) / rect.width) * 100), 0, 100);
    const l = clamp(Math.round(100 - ((e.clientY - rect.top) / rect.height) * 100), 0, 100);
    pick(live.current.h, s, l);
  };

  const { begin, release, handleLeave } = usePointerDrag({
    threshold: 0, // a press on the wheel picks exactly where it lands
    onMove: (e) => (mode.current === "ring" ? pickFromRing(e) : pickFromSquare(e)),
    onEnd: () => {
      mode.current = null;
      ringBox.current = null;
      sqBox.current = null;
      flush(true); // the release settles the colour the last move is still holding
    },
  });

  // an outside colour (a preset, the hex field, an undo) moves the wheel — but
  // never the echo of what this wheel just sent, and never while the pointer
  // owns it: an update landing mid-drag must not drag the marker back
  useEffect(() => {
    if (mode.current || normHex(value) === echo.current) return;
    const next = hexToHsl(value);
    live.current = next;
    paintedHue.current = null;
    setHsl(next);
    paint(next.h, next.s, next.l);
  }, [value]);

  // a parent render (the deck write) must not leave the markers on the last
  // React-committed colour — restore whatever the pointer last painted
  useLayoutEffect(() => {
    const { h, s, l } = live.current;
    paint(h, s, l);
  });

  // a frame still waiting when the wheel goes away must not fire into nothing
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const hueAngle = ((hsl.h - 90) * Math.PI) / 180;
  const hx = r + (r - ring / 2) * Math.cos(hueAngle);
  const hy = r + (r - ring / 2) * Math.sin(hueAngle);

  return (
    <div className="flex items-center gap-3">
      <div
        ref={ringRef}
        className="relative shrink-0 select-none"
        style={{ width: size, height: size, touchAction: "none" }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          ringBox.current = rect;
          sqBox.current = squareRef.current?.getBoundingClientRect() ?? null;
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          const surface = Math.hypot(dx, dy) > r - ring - 4 ? "ring" : "sq";
          if (!begin(e)) return; // a secondary button is not a pick
          mode.current = surface;
          if (surface === "ring") pickFromRing(e);
          else pickFromSquare(e);
          flush(true); // the press itself is a colour: commit it now, not in a frame
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={handleLeave}
      >
        {/* hue ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            WebkitMask: `radial-gradient(circle, transparent ${r - ring}px, #000 ${r - ring + 1}px)`,
            mask: `radial-gradient(circle, transparent ${r - ring}px, #000 ${r - ring + 1}px)`,
            cursor: "crosshair",
          }}
        />
        {/* hue marker */}
        <div
          ref={hueDotRef}
          data-wheel-hue=""
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow"
          style={{ left: hx - 8, top: hy - 8, background: hslToHex(hsl.h, 100, 50) }}
        />
        {/* S/L square */}
        <div
          ref={squareRef}
          data-wheel-face=""
          className="absolute rounded-md border border-black/40"
          style={{
            width: sq,
            height: sq,
            left: r - sq / 2,
            top: r - sq / 2,
            cursor: "crosshair",
            // x = saturation (grey → pure hue), y = lightness (white top → black bottom)
            background: squareFace(hsl.h),
          }}
        >
          <div
            ref={sqDotRef}
            data-wheel-marker=""
            className="pointer-events-none absolute h-3.5 w-3.5 rounded-full border-2 border-white shadow"
            style={{
              left: (hsl.s / 100) * sq - 7,
              top: ((100 - hsl.l) / 100) * sq - 7,
              background: hslToHex(hsl.h, hsl.s, hsl.l),
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="h-8 w-20 rounded-lg border border-white/15" style={{ background: value }} />
        <input
          value={value}
          onChange={(e) => {
            const hex = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) applyHex(hex);
          }}
          className="w-20 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 font-mono text-[11px] text-slate-100 outline-none focus:border-amber-400/60"
        />
        {(["h", "s", "l"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 text-[10px] text-slate-500 uppercase">
            {k}
            <input
              type="number"
              min={0}
              max={k === "h" ? 360 : 100}
              value={hsl[k]}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, k === "h" ? 360 : 100);
                apply(k === "h" ? v : live.current.h, k === "s" ? v : live.current.s, k === "l" ? v : live.current.l);
              }}
              className="w-14 rounded border border-white/10 bg-slate-900/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
