import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Gradient } from "../lib/types";
import { gradientCss } from "../lib/banner";
import { usePointerDrag } from "../lib/dragSession";
import { useFrameSend } from "../lib/frameSend";
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
 *
 * The knob is a Canva-style indicator: it belongs to the pointer, not to
 * React. A move writes the knob's position and the arrow's rotation straight
 * into the DOM in that same event (`paint`), the dial's box is measured once
 * per press, and the editor is told at most once per frame (`useFrameSend`) —
 * a press commits at once and the release settles what is pending. A render
 * fed from the last flush can never put the knob behind the cursor: after
 * every render the paint is re-asserted from whichever side is currently the
 * truth (the pointer while a gesture is live, the props when it is not).
 */
export function GradientAngleWheel({ value, onChange, fallback, size = 148 }: DialProps) {
  const ref = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  /** the angle the pointer has set: the truth while a gesture is live */
  const live = useRef(value.angle);
  /** a gesture is painting the knob (props are one flush behind) */
  const dragging = useRef(false);
  /** dial geometry, measured on press so moves don't force layout */
  const box = useRef<DOMRect | null>(null);

  const g = value;
  const r = size / 2;

  const send = useFrameSend((deg: number) => onChange({ ...g, type: "linear", angle: deg }));

  /** paints the knob + arrow from one angle — no React render in the way */
  const paint = (deg: number) => {
    live.current = deg;
    const a = ((deg - 90) * Math.PI) / 180;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${r + (r - 12) * Math.cos(a) - 10}px, ${
        r + (r - 12) * Math.sin(a) - 10
      }px, 0)`;
    }
    if (arrowRef.current) arrowRef.current.style.transform = `rotate(${deg}deg)`;
  };

  /** panel fields (the number box, the direction buttons): applied at once */
  const apply = (deg: number) => {
    paint(deg);
    send.sendNow(deg);
  };

  const angleFromPointer = (e: { clientX: number; clientY: number; shiftKey?: boolean }) => {
    const rect = box.current ?? ref.current?.getBoundingClientRect();
    if (!rect) return live.current;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // CSS linear-gradient angle: 0° = to top, 90° = to right (clockwise)
    let deg = (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI;
    deg = (deg + 360) % 360;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    return ((Math.round(deg) % 360) + 360) % 360;
  };

  const { begin, release, handleLeave } = usePointerDrag({
    threshold: 0, // a press on the dial sets the angle exactly where it lands
    onMove: (e) => {
      const deg = angleFromPointer(e);
      paint(deg);
      send.offer(deg);
    },
    onEnd: () => {
      dragging.current = false;
      box.current = null;
      send.flush(); // the release settles the angle the last move is holding
    },
  });

  // a render (the deck write) must not leave the knob where React last
  // committed — while dragging the pointer is the truth, otherwise the props are
  useLayoutEffect(() => {
    paint(dragging.current ? live.current : g.angle);
  });

  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        data-angle-dial=""
        onPointerDown={(e) => {
          if (!begin(e)) return; // a secondary button is not a set
          dragging.current = true;
          box.current = ref.current?.getBoundingClientRect() ?? null;
          const deg = angleFromPointer(e);
          paint(deg);
          send.sendNow(deg); // the press itself is an angle: commit it now
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={handleLeave}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.shiftKey ? 15 : 1;
          const deg = (((g.angle + (e.deltaY > 0 ? step : -step)) % 360) + 360) % 360;
          apply(deg);
        }}
        title="Drag to set the gradient angle · Shift snaps to 15° · scroll to fine-tune"
        className="relative shrink-0 cursor-grab select-none touch-none active:cursor-grabbing"
        style={{ width: size, height: size }}
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
        {/* direction arrow — rotation is painted by `paint`, never by React */}
        <div
          ref={arrowRef}
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{ width: 2, height: r - 22, marginLeft: -1, marginTop: -(r - 22), transformOrigin: "50% 100%", background: "rgba(255,255,255,.75)" }}
        >
          <div className="absolute -top-1 -left-[5px] h-0 w-0 border-x-[6px] border-b-[9px] border-x-transparent border-b-white/90" />
        </div>
        {/* knob — position is painted by `paint`, never by React */}
        <div
          ref={knobRef}
          data-angle-knob=""
          className="pointer-events-none absolute top-0 left-0 h-5 w-5 rounded-full border-2 border-slate-950 bg-amber-300 shadow will-change-transform"
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
            onChange={(e) => apply(((Number(e.target.value) % 360) + 360) % 360)}
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
              onClick={() => apply(Number(a))}
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

/* --------------------------------------------------------- colour picker */

interface ColorWheelProps {
  value: string;
  onChange: (hex: string) => void;
}

/** `#abc` / `#AABBCC` → `#aabbcc`, so the picker's own echo compares equal */
const normHex = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "";
  const body = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${body.toLowerCase()}`;
};

/** the S/L area's paint: a white→black lightness shade over the hue ramp */
const squareFace = (h: number) =>
  "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%), " +
  `linear-gradient(to right, hsl(${h} 0% 50%), hsl(${h} 100% 50%))`;

/** Canva's hue ramp for the slider under the area */
const HUE_RAMP =
  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

/** soft dark edge so a white ring stays visible on white and on black */
const INDICATOR_SHADOW = "0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.45)";

type Hsl = { h: number; s: number; l: number };

/**
 * A style write the element does not already have. Worth spelling out: a
 * redundant write still invalidates style and paint, and a drag at a mouse's
 * 120Hz makes a hundred of them a second on its own.
 */
const setStyle = (el: HTMLElement | null, prop: "transform" | "background", v: string) => {
  if (el && el.style[prop] !== v) el.style[prop] = v;
};

/**
 * The same discipline for the fields beside the surfaces: a drag PAINTS them in
 * the event that moved the pointer, rather than waiting for a render to do it —
 * and it never overwrites whatever the user is typing into one.
 */
const setField = (el: HTMLInputElement | null, v: string) => {
  if (!el || el.value === v || el.ownerDocument?.activeElement === el) return;
  el.value = v;
};

/**
 * The colour picker, laid out and behaved like Canva's:
 *
 *   ┌──────────────────────────┐
 *   │  saturation / lightness  │  ← drag the ring indicator; a press JUMPS
 *   │   area (full width)  ◉   │     it to the pointer
 *   └──────────────────────────┘
 *   ●━━━━━━━━━●━━━━━━━━━━━━━━━     ← hue ramp with its own knob
 *   ◎ ▇ #HEX   H S L               ← eyedropper · live swatch · readouts
 *
 * ## the rules that make it feel instant
 *
 * A picker is judged on one thing: is the ring under the cursor, this instant,
 * while the pointer is moving? A trailing ring is a broken picker, however
 * correct the colour turns out to be. So:
 *
 *  1. React is not in the path. The ring, the hue knob, the swatch, the hex box
 *     and the h / s / l fields are all written straight into the DOM inside the
 *     event that moved the pointer (`paint`). The gesture never sets state, so
 *     there is no render between the cursor and the indicator — not one, ever.
 *     State is taken up again the moment the pointer stops, and every render in
 *     between reads from `live` so it can only ever agree with what was painted
 *     (a render fed from the last flush is a frame behind the pointer by
 *     construction; a render that knows that can't stamp a stale pixel).
 *  2. The indicator rides the POINTER, not the colour. `s` / `l` / `h` are
 *     whole per cent — that is what the deck stores — but a ring placed at
 *     `round(s) %` of the area stands up to 1.3 px away from a 260 px cursor
 *     and does not move at all for several events in a row. That stepping IS
 *     the lag people see, so the transform is painted from the raw clientX /
 *     clientY and only the colour is rounded.
 *  3. No move ever asks the layout where anything is: both surfaces are
 *     measured once on press (`areaBox` / `hueBox`) and every move after that
 *     is arithmetic. A `getBoundingClientRect` mid-drag is a forced reflow of
 *     the whole inspector.
 *  4. Nothing is written that the element already has (§ `setStyle`), and the
 *     one genuinely expensive paint on the panel — the area's two stacked
 *     gradients, re-rasterised whenever the hue moves — happens at most ONCE
 *     PER FRAME, not once per event. A ring is 16px; a backdrop is the size of
 *     the panel, and it can wait for the frame it shares with the deck.
 *  5. The document is told at most once per frame (`useFrameSend`), with the
 *     newest colour — and when a frame is already late, `useFrameSend` skips
 *     the next one so the pointer gets a gap to move the ring in. A press
 *     commits at once (a click is a decision, not a preview) and the release
 *     settles whatever is still pending, so the colour the ring shows is
 *     always the colour that ends up in the deck.
 *  6. In Chromium the indicator moves sooner than a frame: while a gesture is
 *     live the picker also listens to `pointerrawupdate`, the un-coalesced
 *     stream the OS feeds the browser, so the ring tracks the mouse at the
 *     mouse's own rate. Where that event does not exist nothing is missed —
 *     `pointermove` is the same paint.
 *
 * Nothing paints without a live gesture: the drag runs on
 * `src/lib/dragSession.ts` like every other drag in the editor (moves stay
 * window-wide, a secondary button is not a pick, a release / cancel / blur ends
 * it), a hover paints nothing, and an echo of the picker's own colour landing
 * mid-drag is ignored instead of yanking the indicator back. There is no
 * crosshair or other cursor decoration over the area either — the ring IS the
 * cursor while it is held, so it stays a plain pointer and one marker.
 */
export function ColorWheel({ value, onChange }: ColorWheelProps) {
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(value));

  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HTMLInputElement>(null);
  const hRef = useRef<HTMLInputElement>(null);
  const sRef = useRef<HTMLInputElement>(null);
  const lRef = useRef<HTMLInputElement>(null);
  /** which surface the live gesture is painting — the hue ramp or the area */
  const mode = useRef<"hue" | "sq" | null>(null);
  /** the colour the pointer has picked: the truth while a gesture is live */
  const live = useRef<Hsl>(hsl);
  /** the last colour handed to the editor, so its echo is not read as an outside change */
  const echo = useRef("");
  /** latest onChange — the frame flush must not close over a stale editor writer */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** skip rewriting the area's gradient unless hue actually moved */
  const paintedHue = useRef<number | null>(null);
  /** picker geometry, measured on press so moves don't force layout */
  const areaBox = useRef<DOMRect | null>(null);
  const hueBox = useRef<DOMRect | null>(null);
  /**
   * The exact pixel the pointer put each indicator on, inside its own surface.
   * `null` means "no pointer pixel: place it from the colour", which is what
   * every non-pointer source (a field, a preset, an undo) does.
   */
  const dotPx = useRef<{ x: number; y: number } | null>(null);
  const knobPx = useRef<number | null>(null);
  /** the area's gradient, deferred to the frame it will be seen in */
  const faceFrame = useRef<number | null>(null);

  const send = useFrameSend((next: Hsl) => {
    const hex = hslToHex(next.h, next.s, next.l);
    echo.current = normHex(hex);
    // and deliberately NO setHsl here: the picker's pixels were painted in the
    // event that picked the colour, so the only thing left for a frame to do is
    // the document. React joins in again when the pointer stops.
    onChangeRef.current(hex);
  });

  /* ------------------------------------------------------------- the face */

  const writeFace = () => {
    const h = live.current.h;
    const face = areaRef.current;
    if (face && paintedHue.current !== h) {
      face.style.background = squareFace(h);
      paintedHue.current = h;
    }
  };
  const cancelFace = () => {
    if (faceFrame.current !== null) {
      cancelAnimationFrame(faceFrame.current);
      faceFrame.current = null;
    }
  };
  /** idle → now; a live gesture → once this frame, however many moves it holds */
  const queueFace = () => {
    if (!mode.current) {
      cancelFace();
      writeFace();
      return;
    }
    if (faceFrame.current === null) {
      faceFrame.current = requestAnimationFrame(() => {
        faceFrame.current = null;
        writeFace();
      });
    }
  };

  /* ---------------------------------------------------------------- paint */

  /** paints both indicators and every readout from one hsl triple — no React */
  const paint = (h: number, s: number, l: number) => {
    live.current = { h, s, l };
    const hex = hslToHex(h, s, l);

    // geometry only when a box is known — never read layout speculatively
    const area = mode.current ? areaBox.current : (areaBox.current ?? areaRef.current?.getBoundingClientRect() ?? null);
    if (area && area.width > 0 && area.height > 0) {
      const at = dotPx.current ?? { x: (s / 100) * area.width, y: ((100 - l) / 100) * area.height };
      setStyle(dotRef.current, "transform", `translate3d(${at.x}px, ${at.y}px, 0)`);
    }
    const bar = mode.current ? hueBox.current : (hueBox.current ?? hueRef.current?.getBoundingClientRect() ?? null);
    if (bar && bar.width > 0) {
      setStyle(knobRef.current, "transform", `translate3d(${knobPx.current ?? (h / 360) * bar.width}px, 0px, 0)`);
    }

    setStyle(dotRef.current, "background", hex);
    setStyle(swatchRef.current, "background", hex);
    setStyle(knobRef.current, "background", hslToHex(h, 100, 50));
    setField(hexRef.current, hex);
    setField(hRef.current, String(h));
    setField(sRef.current, String(s));
    setField(lRef.current, String(l));
    hueRef.current?.setAttribute("aria-valuenow", String(h));
    queueFace();
  };

  /** paint from the colour alone (a source that is not the pointer) */
  const paintFrom = (h: number, s: number, l: number) => {
    dotPx.current = null;
    knobPx.current = null;
    paint(h, s, l);
  };

  /** a panel field (the hex box, the h / s / l numbers): applied at once */
  const apply = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    echo.current = normHex(hex);
    setHsl({ h, s, l });
    paintFrom(h, s, l);
    send.sendNow({ h, s, l });
  };

  /** the hex field: the spelling typed is what the deck gets, the picker follows it */
  const applyHex = (hex: string) => {
    const next = hexToHsl(hex);
    apply(next.h, next.s, next.l);
  };

  /* ------------------------------------------------------------- picking */

  const pickFromArea = (e: { clientX: number; clientY: number }) => {
    const rect = mode.current ? areaBox.current : areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    dotPx.current = { x, y };
    knobPx.current = null; // the ramp only moves when the ramp is dragged
    pick(
      live.current.h,
      clamp(Math.round((x / rect.width) * 100), 0, 100),
      clamp(Math.round(100 - (y / rect.height) * 100), 0, 100),
    );
  };

  const pickFromHue = (e: { clientX: number; clientY: number }) => {
    const rect = mode.current ? hueBox.current : hueRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    knobPx.current = x;
    dotPx.current = null;
    pick(clamp(Math.round((x / rect.width) * 360), 0, 359), live.current.s, live.current.l);
  };

  /** a pointer move (or press) picks: paint now, tell the editor this frame */
  const pick = (h: number, s: number, l: number) => {
    paint(h, s, l);
    send.offer({ h, s, l });
  };

  /** what the live gesture does with any pointer sample, however it arrived */
  const track = (e: { clientX: number; clientY: number }) => (mode.current === "hue" ? pickFromHue(e) : pickFromArea(e));
  const trackRef = useRef(track);
  trackRef.current = track;

  /* ------------------------------------------- raw (un-coalesced) pointer */

  const rawOn = useRef(false);
  const onRaw = useRef((ev: Event) => {
    const e = ev as PointerEvent;
    if (!mode.current) return; // never paint for a pointer nobody is holding
    if (e.pointerType && e.pointerType !== "mouse") return;
    const session = stateRef.current;
    if (session.pointerId !== -1 && e.pointerId !== session.pointerId) return;
    trackRef.current(e);
  });
  const startRaw = () => {
    if (rawOn.current || typeof window === "undefined" || !("onpointerrawupdate" in window)) return;
    rawOn.current = true;
    window.addEventListener("pointerrawupdate", onRaw.current);
  };
  const stopRaw = () => {
    if (!rawOn.current) return;
    rawOn.current = false;
    window.removeEventListener("pointerrawupdate", onRaw.current);
  };

  /* ----------------------------------------------------------- the gesture */

  const { begin, release, handleLeave, state } = usePointerDrag({
    threshold: 0, // a press on the picker picks exactly where it lands
    onMove: (e) => trackRef.current(e),
    onEnd: () => {
      const last = { ...live.current };
      mode.current = null;
      areaBox.current = null;
      hueBox.current = null;
      stopRaw();
      cancelFace();
      writeFace(); // the backdrop settles with the gesture, not a frame later
      // the pointer has let go: React takes the pixels back, from the exact
      // colour the gesture ended on, so nothing it renders can disagree
      setHsl(last);
      send.flush(); // the release settles the colour the last move is holding
    },
  });
  /** the session's pointer id, for the raw stream (a second pointer is ignored) */
  const stateRef = useRef(state);
  stateRef.current = state;

  // a listener armed for one gesture, and a face write still queued, must not
  // outlive the picker — refs only, so nothing here needs an identity
  useEffect(
    () => () => {
      if (rawOn.current) {
        rawOn.current = false;
        window.removeEventListener("pointerrawupdate", onRaw.current);
      }
      if (faceFrame.current !== null) cancelAnimationFrame(faceFrame.current);
    },
    [],
  );

  /* --------------------------------------------------- press, release, keys */

  const press = (e: ReactPointerEvent, surface: "hue" | "sq") => {
    if (!begin(e)) return; // a secondary button is not a pick
    mode.current = surface;
    areaBox.current = areaRef.current?.getBoundingClientRect() ?? null;
    hueBox.current = hueRef.current?.getBoundingClientRect() ?? null;
    track(e);
    writeFace(); // a press is a click: the backdrop moves with it
    send.sendNow({ ...live.current }); // the press itself is a colour
    startRaw();
  };

  // the Canva eyedropper, when the browser has one (Chromium; behind a gesture)
  const eyeDrop = () => {
    const w = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (typeof w.EyeDropper !== "function") return;
    new w.EyeDropper()
      .open()
      .then((r) => applyHex(r.sRGBHex))
      .catch(() => /* the user cancelled */ {});
  };
  const canEyeDrop = typeof window !== "undefined" && "EyeDropper" in window;

  // keyboard: arrows nudge the picked colour (Shift = 10 steps), so the picker
  // is reachable without a pointer too
  const nudge = (dh: number, ds: number, dl: number) => {
    const { h, s, l } = live.current;
    apply((h + dh + 360) % 360, clamp(s + ds, 0, 100), clamp(l + dl, 0, 100));
  };
  const areaKeys = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") (e.preventDefault(), nudge(0, -step, 0));
    else if (e.key === "ArrowRight") (e.preventDefault(), nudge(0, step, 0));
    else if (e.key === "ArrowUp") (e.preventDefault(), nudge(0, 0, step));
    else if (e.key === "ArrowDown") (e.preventDefault(), nudge(0, 0, -step));
  };
  const hueKeys = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") (e.preventDefault(), nudge(-step, 0, 0));
    else if (e.key === "ArrowRight") (e.preventDefault(), nudge(step, 0, 0));
  };

  // an outside colour (a preset, the hex field, an undo) moves the picker — but
  // never the echo of what this picker just sent, and never while the pointer
  // owns it: an update landing mid-drag must not drag the indicator back
  useLayoutEffect(() => {
    if (mode.current || normHex(value) === echo.current) return;
    const next = hexToHsl(value);
    paintedHue.current = null;
    setHsl(next);
    paintFrom(next.h, next.s, next.l);
  }, [value]);

  // a render fed from the last flush may be one frame behind the pointer —
  // re-assert whatever the pointer last painted. With no state in the gesture
  // there is usually nothing to re-assert, and it reads no layout either way.
  useLayoutEffect(() => {
    if (!mode.current) return;
    const { h, s, l } = live.current;
    paint(h, s, l);
  });

  /* --------------------------------------------------------------- render */

  // What the panel shows. While a gesture is live the truth is `live`, never
  // `hsl` / `value` — a render must reproduce the pixels under the cursor, so a
  // re-render can only ever agree with the paint or be a no-op, never undo it.
  const shown = mode.current ? live.current : hsl;
  const shownHex = mode.current ? hslToHex(live.current.h, live.current.s, live.current.l) : value;

  return (
    <div className="flex flex-col gap-2">
      {/* ---------------- saturation / lightness area ---------------------- */}
      <div
        ref={areaRef}
        data-wheel-face=""
        tabIndex={0}
        aria-label="Saturation and lightness — drag to pick"
        onPointerDown={(e) => press(e, "sq")}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={handleLeave}
        onKeyDown={areaKeys}
        title="Drag to pick a colour · the ring follows the pointer"
        className="relative h-36 w-full cursor-default touch-none select-none rounded-xl border border-white/10"
        /* the backdrop is `paint`'s alone: one gradient per frame, and a render
           that rewrote it too would be a second full repaint of the largest
           element on the panel for nothing */
      >
        {/* the ring indicator — its position and colour live ONLY on the node */}
        <div
          ref={dotRef}
          data-wheel-marker=""
          className="pointer-events-none absolute top-0 left-0 -mt-2 -ml-2 h-4 w-4 rounded-full border-2 border-white will-change-transform"
          style={{ boxShadow: INDICATOR_SHADOW, background: hslToHex(shown.h, shown.s, shown.l) }}
        />
      </div>

      {/* ----------------------------- hue ramp ---------------------------- */}
      <div
        ref={hueRef}
        data-wheel-hue-ramp=""
        tabIndex={0}
        aria-label="Hue"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={shown.h}
        onPointerDown={(e) => press(e, "hue")}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={handleLeave}
        onKeyDown={hueKeys}
        title="Drag to change the hue"
        className="relative h-3.5 w-full cursor-pointer touch-none select-none rounded-full border border-white/10"
        style={{ background: HUE_RAMP }}
      >
        {/* the hue knob — its position and colour live ONLY on the node */}
        <div
          ref={knobRef}
          data-wheel-hue=""
          className="pointer-events-none absolute top-1/2 left-0 -mt-[9px] -ml-[9px] h-[18px] w-[18px] rounded-full border-2 border-white will-change-transform"
          style={{ boxShadow: INDICATOR_SHADOW, background: hslToHex(shown.h, 100, 50) }}
        />
      </div>

      {/* ------------------------ swatch · hex · eyedropper ---------------- */}
      <div className="flex items-center gap-1.5">
        {canEyeDrop && (
          <button
            type="button"
            onClick={eyeDrop}
            title="Pick a colour from anywhere on screen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-sm text-slate-300 hover:bg-white/10"
          >
            ◎
          </button>
        )}
        <div
          ref={swatchRef}
          className="h-8 w-9 shrink-0 rounded-lg border border-white/15"
          style={{ background: hslToHex(shown.h, shown.s, shown.l) }}
          title="The colour the picker is holding"
        />
        <input
          ref={hexRef}
          value={shownHex}
          onChange={(e) => {
            const hex = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) applyHex(hex);
          }}
          spellCheck={false}
          className="w-[86px] rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 font-mono text-[11px] text-slate-100 outline-none focus:border-amber-400/60"
        />
      </div>

      {/* --------------------------- h / s / l ----------------------------- */}
      <div className="grid grid-cols-3 gap-1.5">
        {([
          ["h", hRef],
          ["s", sRef],
          ["l", lRef],
        ] as const).map(([k, field]) => (
          <label key={k} className="flex items-center gap-1 text-[10px] tracking-wide text-slate-500 uppercase">
            {k}
            <input
              ref={field}
              type="number"
              min={0}
              max={k === "h" ? 360 : 100}
              value={shown[k]}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, k === "h" ? 360 : 100);
                apply(k === "h" ? v : live.current.h, k === "s" ? v : live.current.s, k === "l" ? v : live.current.l);
              }}
              className="w-full min-w-0 rounded border border-white/10 bg-slate-900/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none focus:border-amber-400/60"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
