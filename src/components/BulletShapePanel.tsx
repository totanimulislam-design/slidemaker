import type { CSSProperties, ReactNode } from "react";
import type { Box, ElementId, Gradient, NumberBorderStyle, ThemeSettings } from "../lib/types";
import { shade } from "../lib/color";
import { gradientCss } from "../lib/banner";
import {
  numberStyleDef,
  numberStyleLineWeight,
  numberStyleRadius,
  showsNumber,
  type NumberStyle,
} from "../lib/numberStyles";
import ElementPosition from "./ElementPosition";
import GradientEditor from "./GradientEditor";
import { Btn, ColorField, Field, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * The question bullet's own shape controls.
 *
 * Every channel has ONE card of its own — the toolbar's Border style, Border
 * radius, Border weight and Transparency buttons each open exactly the control
 * they name and nothing else — and the inspector's *Question bullet*
 * destination stacks the same cards, so a teacher can reach them from the board
 * or from the panel and both read the same.
 *
 * Every channel falls back to the numbering design's own paint (`auto`), which
 * is what makes an untouched deck render exactly as before:
 *
 *   Shape fill        the silhouette's body — solid or gradient   `bulletFill` · `bulletFillGradient`
 *   Border colour      its outline — solid or gradient            `bulletBorder` · `bulletBorderGradient`
 *   Border style       solid · dashed · dotted · double           `bulletBorderStyle`
 *   Border radius      the corners, with no px ceiling            `bulletRadius`
 *   Border weight      the outline's thickness                    `bulletBorderWeight`
 *   Transparency       the body only, never the number            `bulletOpacity`
 */
interface ShapeProps {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

/* ------------------------------------------------------------------ */
/*  Shared bits                                                        */
/* ------------------------------------------------------------------ */

export const BULLET_BORDER_STYLES: { value: NumberBorderStyle; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "The design's own line" },
  { value: "none", label: "None", hint: "No outline at all" },
  { value: "solid", label: "Solid", hint: "One continuous line" },
  { value: "dashed", label: "Dashed", hint: "Even dashes" },
  { value: "dotted", label: "Dotted", hint: "Round dots" },
  { value: "double", label: "Double", hint: "Two parallel lines" },
];

function Cap({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-normal text-slate-500">
        {hint}
        {action}
      </span>
    </div>
  );
}

/** clear a channel back to the design's own value */
export function AutoBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!on}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px]",
        on ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-400 hover:bg-white/10",
      )}
    >
      auto
    </button>
  );
}

/** the marker's box, its design and the two auto values its channels fall back to */
function markerOf(T: ThemeSettings) {
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const size = T.bulletSize ?? 54;
  const base = T.accent || "#2f4fff";
  const def = numberStyleDef(id);
  return {
    id,
    size,
    base,
    def,
    cut: !!def.points,
    radiusAuto: numberStyleRadius(id, size),
    weightAuto: numberStyleLineWeight(id, size),
    radius: T.bulletRadius ?? numberStyleRadius(id, size),
    weight: T.bulletBorderWeight ?? numberStyleLineWeight(id, size),
    opacity: T.bulletOpacity ?? 100,
    fill: T.bulletFill ?? "",
    fillGradient: T.bulletFillGradient,
    border: T.bulletBorder ?? "",
    borderGradient: T.bulletBorderGradient,
    fillAuto: shade(base, 0.2),
    borderAuto: shade(base, 0.5),
  };
}

/** the CSS of the current fill — solid, gradient or the design's own */
export function bulletFillCss(T: ThemeSettings): string {
  const m = markerOf(T);
  if (m.fill === "transparent") return "";
  if (m.fillGradient?.enabled) return gradientCss(m.fillGradient, m.fill || m.fillAuto);
  if (/^#[0-9a-f]{3,8}$/i.test(m.fill)) return m.fill;
  return m.fillAuto;
}

/** the CSS of the current line — solid, gradient or the design's own */
export function bulletBorderCss(T: ThemeSettings): string {
  const m = markerOf(T);
  if (m.border === "transparent" || (T.bulletBorderStyle ?? "auto") === "none") return "";
  if (m.borderGradient?.enabled) return gradientCss(m.borderGradient, m.border || m.borderAuto);
  if (/^#[0-9a-f]{3,8}$/i.test(m.border)) return m.border;
  return m.borderAuto;
}

/* ------------------------------------------------------------------ */
/*  Border style — icon tiles, nothing else                            */
/* ------------------------------------------------------------------ */

/** how one line style reads as a picture (the tiles and the toolbar icon) */
export function BorderStyleIcon({ style, size = 18, color = "currentColor" }: { style: NumberBorderStyle; size?: number; color?: string }) {
  const s = size;
  const stroke = Math.max(1.6, s * 0.11);
  if (style === "none") {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="none" stroke={color} strokeWidth={stroke} opacity="0.35" />
        <path d="M4 16 16 4" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "auto") {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="2.5" width="15" height="15" rx="7.5" fill="none" stroke={color} strokeWidth={stroke} strokeDasharray="3 2.4" opacity="0.9" />
        <text x="10" y="13.6" textAnchor="middle" fontSize="9" fontWeight="800" fill={color} fontFamily="Inter, system-ui, sans-serif">A</text>
      </svg>
    );
  }
  const dash = style === "dashed" ? "4 3" : style === "dotted" ? "0.1 3.2" : undefined;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      {style === "double" ? (
        <>
          <rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.4" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
          <rect x="5.4" y="5.4" width="9.2" height="9.2" rx="2" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
        </>
      ) : (
        <rect
          x="2.5"
          y="2.5"
          width="15"
          height="15"
          rx="3"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={dash}
          strokeLinecap={style === "dotted" ? "round" : undefined}
        />
      )}
    </svg>
  );
}

/** the Border style card: six line styles as pictures */
export function BulletBorderStylePicker({ theme: T, setTheme }: ShapeProps) {
  const current = (T.bulletBorderStyle ?? "auto") as NumberBorderStyle;
  return (
    <div className="space-y-2" data-bullet-border-style="">
      <Cap hint={BULLET_BORDER_STYLES.find((b) => b.value === current)?.hint}>Border style</Cap>
      <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Border style">
        {BULLET_BORDER_STYLES.map((b) => {
          const chosen = current === b.value;
          return (
            <button
              key={b.value}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Border style: ${b.label}`}
              title={b.hint}
              onClick={() => setTheme({ bulletBorderStyle: b.value })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-colors",
                chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
              )}
            >
              <BorderStyleIcon style={b.value} size={22} />
              <span className="text-[9.5px] font-medium leading-none">{b.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        {current === "none"
          ? "No outline. Pick a colour under Border to bring the line back."
          : current === "auto"
            ? "Auto keeps the line the marker design draws itself."
            : "Box silhouettes take a real CSS border; a cut silhouette (star, seal, sticker…) is stroked in SVG so the dashes follow its points."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border radius — a live corner and one slider                       */
/* ------------------------------------------------------------------ */

/** how far the corners can go: half the marker is a circle, and the slider
 *  keeps going past it instead of stopping at an arbitrary px ceiling */
export const bulletRadiusMax = (T: ThemeSettings): number => Math.max(24, T.bulletSize ?? 54);

export function BulletRadiusPanel({ theme: T, setTheme }: ShapeProps) {
  const m = markerOf(T);
  const max = bulletRadiusMax(T);
  const pct = Math.round((m.radius / Math.max(1, m.size)) * 100);
  const preview: CSSProperties = {
    width: 46,
    height: 46,
    background: bulletFillCss(T) || m.base,
    border: `${Math.max(1.5, Math.min(4, m.weight))}px ${T.bulletBorderStyle === "dashed" ? "dashed" : T.bulletBorderStyle === "dotted" ? "dotted" : "solid"} ${bulletBorderCss(T) || "#ffffff"}`,
    borderRadius: m.cut ? undefined : Math.min(m.radius, max),
    clipPath: m.cut ? `polygon(${(m.def.points ?? []).map(([x, y]) => `${x}% ${y}%`).join(", ")})` : undefined,
    boxSizing: "border-box",
  };
  return (
    <div className="space-y-2" data-bullet-radius="">
      <div className="flex items-center gap-3">
        <span className="flex h-[54px] w-[54px] items-center justify-center rounded-lg border border-white/10 bg-slate-950/60" aria-hidden="true">
          <span style={preview} />
        </span>
        <span className="min-w-0 flex-1">
          <Cap hint={m.cut ? "polygons keep their points" : `${m.radius}px · ${pct}% of the marker`}>Border radius</Cap>
          <div className={cn(m.cut && "opacity-50")}>
            <Slider
              value={Math.min(m.radius, max)}
              min={0}
              max={max}
              step={1}
              onChange={(v) => setTheme({ bulletRadius: v })}
              ariaLabel="Border radius (px)"
            />
          </div>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Drag to a full circle and past it — the slider runs to {max}px, half the marker being perfectly round.
        </p>
        <AutoBtn
          on={T.bulletRadius !== undefined}
          onClick={() => setTheme({ bulletRadius: undefined })}
          label="Border radius: back to the design's own corners"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border weight — three lines and one slider                         */
/* ------------------------------------------------------------------ */

export const bulletWeightMax = (T: ThemeSettings): number => Math.max(12, Math.round((T.bulletSize ?? 54) * 0.3));

/** the toolbar's own icon: a hairline, a medium and a heavy rule */
export function WeightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3.4" width="16" height="1.2" rx="0.6" />
      <rect x="2" y="8.6" width="16" height="2.6" rx="1.3" />
      <rect x="2" y="14.4" width="16" height="4.2" rx="2.1" />
    </svg>
  );
}

export function BulletWeightPanel({ theme: T, setTheme }: ShapeProps) {
  const m = markerOf(T);
  const max = bulletWeightMax(T);
  return (
    <div className="space-y-2" data-bullet-weight="">
      <div className="flex items-center gap-3">
        <span
          className="flex h-[54px] w-[54px] items-center justify-center rounded-lg border border-white/10 bg-slate-950/60"
          aria-hidden="true"
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              boxSizing: "border-box",
              border: `${Math.max(0, Math.min(m.weight, max))}px solid ${bulletBorderCss(T) || "#ffffff"}`,
              background: bulletFillCss(T) || m.base,
            }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <Cap hint={m.weight ? `${m.weight}px` : "no line"}>Border weight</Cap>
          <Slider
            value={Math.min(m.weight, max)}
            min={0}
            max={max}
            step={0.5}
            onChange={(v) => setTheme({ bulletBorderWeight: v })}
            ariaLabel="Border weight (px)"
          />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          0 takes the outline away; anything above draws it in the Border colour, dashed or dotted as picked.
        </p>
        <AutoBtn
          on={T.bulletBorderWeight !== undefined}
          onClick={() => setTheme({ bulletBorderWeight: undefined })}
          label="Border weight: back to the design's own line"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transparency — one slider over the body only                       */
/* ------------------------------------------------------------------ */

/** the toolbar's own icon: a disc half painted, half see-through */
export function TransparencyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <pattern id="bullet-transparency-check" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="rgba(255,255,255,.18)" />
          <rect width="2" height="2" fill="rgba(255,255,255,.42)" />
          <rect x="2" y="2" width="2" height="2" fill="rgba(255,255,255,.42)" />
        </pattern>
      </defs>
      <circle cx="10" cy="10" r="7.6" fill="url(#bullet-transparency-check)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 2.4a7.6 7.6 0 0 1 0 15.2z" fill="currentColor" />
    </svg>
  );
}

export function BulletTransparencyPanel({ theme: T, setTheme }: ShapeProps) {
  const m = markerOf(T);
  return (
    <div className="space-y-2" data-bullet-transparency="">
      <div className="flex items-center gap-3">
        <span
          className="flex h-[54px] w-[54px] items-center justify-center rounded-lg border border-white/10"
          style={{ background: "repeating-conic-gradient(#334155 0% 25%, #0f172a 0% 50%) 50% / 10px 10px" }}
          aria-hidden="true"
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: m.cut ? undefined : "50%",
              clipPath: m.cut ? `polygon(${(m.def.points ?? []).map(([x, y]) => `${x}% ${y}%`).join(", ")})` : undefined,
              background: bulletFillCss(T) || m.base,
              opacity: m.opacity / 100,
            }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <Cap hint={m.opacity >= 100 ? "fully visible" : `${100 - m.opacity}% see-through`}>Transparency</Cap>
          <Slider
            value={m.opacity}
            min={0}
            max={100}
            onChange={(v) => setTheme({ bulletOpacity: v })}
            ariaLabel="Marker transparency (100 = fully visible)"
          />
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        100 = fully visible. The body fades — fill, outline, corners and its effect — while the number keeps its own ink
        and opacity under <b>Q bullet text</b>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fill & Border — the two paint rows (colour + gradient)             */
/* ------------------------------------------------------------------ */

function PaintRow({
  label,
  value,
  gradient,
  fallback,
  onValue,
  onGradient,
  autoLabel,
  presets,
}: {
  label: string;
  value: string;
  gradient: Gradient | undefined;
  fallback: string;
  onValue: (v: string) => void;
  onGradient: (g: Gradient) => void;
  autoLabel: string;
  presets: string[];
}) {
  const gradOn = !!gradient?.enabled;
  const draft: Gradient =
    gradient ?? {
      enabled: false,
      type: "linear",
      angle: 135,
      stops: [
        { color: fallback, at: 0 },
        { color: shade(fallback, -0.35), at: 100 },
      ],
    };
  const swatch = value === "transparent" ? "" : gradOn ? gradientCss(draft, fallback) : /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  return (
    <div className="space-y-1.5">
      <Cap hint={value === "transparent" ? "none" : gradOn ? "gradient" : value ? "" : "design's own"}>{label}</Cap>
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-12 shrink-0 rounded-md border border-white/15"
          style={{ background: swatch || "repeating-conic-gradient(#3a3a44 0% 25%, #1c1c22 0% 50%) 50% / 8px 8px" }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <ColorField
            label={label}
            value={value}
            fallback={fallback}
            onChange={onValue}
            allowNone
            autoLabel={autoLabel}
            presets={presets}
          />
        </div>
      </div>
      <details className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1" open={gradOn}>
        <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Gradient {gradOn ? "· on" : "· off"}
        </summary>
        <div className="pt-2">
          <GradientEditor
            label={`${label} gradient`}
            value={draft}
            fallback={fallback}
            hideLibrary
            onChange={(g) => onGradient(g)}
          />
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The whole card (the inspector's Question bullet destination)        */
/* ------------------------------------------------------------------ */

export function BulletShapeControls({ theme: T, setTheme }: ShapeProps) {
  const m = markerOf(T);
  const gradFallback = (v: string, auto: string) => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : auto);

  return (
    <div className="space-y-3" data-bullet-shape-controls="">
      {/* ------------------------------------------------------------ fill --- */}
      <PaintRow
        label="Shape fill colour"
        value={m.fill}
        gradient={m.fillGradient}
        fallback={m.fillAuto}
        autoLabel="Auto (the design's own fill)"
        presets={[m.base, shade(m.base, 0.45), shade(m.base, -0.35), "#ffffff", "#0b0b0f"]}
        onValue={(v) => setTheme({ bulletFill: v, ...(v ? { bulletFillGradient: undefined } : {}) })}
        onGradient={(g) => setTheme({ bulletFillGradient: g, ...(g.enabled ? { bulletFill: gradFallback(m.fill, m.fillAuto) } : {}) })}
      />

      {/* ---------------------------------------------------------- border --- */}
      <PaintRow
        label="Border colour"
        value={m.border}
        gradient={m.borderGradient}
        fallback={m.borderAuto}
        autoLabel="Auto (the design's own line)"
        presets={["#ffffff", m.base, shade(m.base, 0.5), "#0b0b0f"]}
        onValue={(v) =>
          setTheme({
            bulletBorder: v,
            ...(v ? { bulletBorderGradient: undefined } : {}),
            ...(v && (T.bulletBorderStyle ?? "auto") === "none" ? { bulletBorderStyle: "auto" as NumberBorderStyle } : {}),
          })
        }
        onGradient={(g) =>
          setTheme({
            bulletBorderGradient: g,
            ...(g.enabled
              ? {
                  bulletBorder: gradFallback(m.border, m.borderAuto),
                  ...((T.bulletBorderStyle ?? "auto") === "none" ? { bulletBorderStyle: "solid" as NumberBorderStyle } : {}),
                }
              : {}),
          })
        }
      />

      <BulletBorderStylePicker theme={T} setTheme={setTheme} />
      <BulletRadiusPanel theme={T} setTheme={setTheme} />
      <BulletWeightPanel theme={T} setTheme={setTheme} />
      <BulletTransparencyPanel theme={T} setTheme={setTheme} />

      <p className="text-[10px] leading-relaxed text-slate-500">
        These channels paint the marker's <b>body</b> — the fill, the outline and the corners. The number keeps its own
        ink, face and opacity (<b>Q bullet text</b>), which is also why the marker design previews stay honest.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position                                                           */
/* ------------------------------------------------------------------ */

interface PositionProps extends ShapeProps {
  /** the z-preserving layout writer the canvas drags use */
  patchLayout?: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  /** bring the marker into view on the canvas (outline + handles) */
  onSelectBullet?: () => void;
}

export function BulletPositionControls({ theme: T, setTheme, patchLayout, onSelectBullet }: PositionProps) {
  const nudgeX = T.bulletNudgeX ?? 0;
  const nudgeY = T.bulletNudgeY ?? 0;
  const nudged = nudgeX !== 0 || nudgeY !== 0;
  const separate = !!T.bulletSeparate;

  return (
    <div className="space-y-3" data-bullet-position-controls="">
      <Cap>Position</Cap>
      <Toggle
        label="Bullet is a separate movable element"
        checked={separate}
        onChange={(v) => {
          setTheme({ bulletSeparate: v });
          if (v) onSelectBullet?.();
        }}
      />
      <p className="text-[10px] leading-relaxed text-slate-500">
        {separate
          ? "The marker is its own layer on the board: drag it anywhere, or place it exactly below."
          : "The marker rides along with the question's row. Nudge it here, or make it a separate element to place it anywhere on the board."}
      </p>

      <Field label="Nudge horizontally →" hint={`${nudgeX} px`}>
        <Slider min={-300} max={300} value={nudgeX} onChange={(v) => setTheme({ bulletNudgeX: v })} ariaLabel="Bullet nudge horizontally" />
      </Field>
      <Field label="Nudge vertically ↓" hint={`${nudgeY} px`}>
        <Slider min={-200} max={200} value={nudgeY} onChange={(v) => setTheme({ bulletNudgeY: v })} ariaLabel="Bullet nudge vertically" />
      </Field>
      {nudged && (
        <Btn size="sm" variant="soft" onClick={() => setTheme({ bulletNudgeX: 0, bulletNudgeY: 0 })}>
          Reset nudge
        </Btn>
      )}

      {separate && patchLayout ? (
        <ElementPosition theme={T} id="bullet" patchLayout={patchLayout} hideAlign label="Question bullet" />
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-slate-500">
          {T.showNumber && !showsNumber((T.numberStyle ?? "circle") as NumberStyle)
            ? "This design is a mark without a number. "
            : ""}
          Turning on <b>Bullet is a separate movable element</b> hands the marker its own box — alignment, X / Y / width /
          height and rotation open right here.
        </p>
      )}
    </div>
  );
}
