import type { CSSProperties, ReactNode } from "react";
import type { BannerBorderStyle, BannerSettings, BannerShape, Gradient, ThemeSettings } from "../lib/types";
import { BANNER_WIDTH, DEFAULT_BANNER } from "../lib/types";
import {
  BANNER_PRESETS,
  bannerCss,
  bannerHasLine,
  bannerPlateWidth,
  bannerPresetPatch,
  bannerSizeNow,
  bannerBorderStyle,
  canOutline,
  clampOpacity,
  type BannerPreset,
} from "../lib/banner";
import { withAlpha } from "../lib/color";
import GradientEditor from "./GradientEditor";
import { ColorField, Field, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * The title background plate's own controls — one card per channel, so the
 * toolbar's buttons each open exactly what they name.
 *
 *   Design presets    thirty-two complete looks                BANNER_PRESETS
 *   Shape             glow · pill · rounded · box · ribbon · underline · none
 *   Effects           softness (glow) · outer halo · shimmer
 *   Fill colour       solid + gradient                          `color` · `gradient`
 *   Border colour     the outline's paint                       `border.color`
 *   Border style      solid · dashed · dotted · double · none    `border.style`
 *   Border radius     the corners, straight to a full pill       `radius`
 *   Border weight     the line's thickness                       `border.width`
 *   Transparency      the SHAPE and the BORDER, each on a slider `opacity` · `border.opacity`
 *   Banner size       free width / height in px of the board     `size`
 *   Banner position   free X / Y nudge in px of the board        `pos`
 *
 * Every channel falls back to the plate's own auto value, so an untouched deck
 * renders exactly as it always did: no free size, no nudge, no outline.
 */
interface BannerProps {
  theme: ThemeSettings;
  /** the whole plate settings, already merged with the deck's defaults */
  banner: BannerSettings;
  /** one writer for the plate — it keeps `theme.titleBanner` in step */
  setBanner: (patch: Partial<BannerSettings>) => void;
}

/** the plate the deck is painting right now, with the legacy colour folded in */
export function bannerOf(theme: ThemeSettings): BannerSettings {
  return {
    ...DEFAULT_BANNER,
    ...(theme.banner ?? {}),
    color: theme.banner?.color ?? theme.titleBanner,
    border: { ...DEFAULT_BANNER.border, ...(theme.banner?.border ?? {}) },
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** a slider's range never traps a value a deck already carries */
export const rangeMax = (limit: number, ...values: (number | undefined)[]) =>
  Math.max(limit, ...values.map((v) => Math.abs(v ?? 0)));

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

/** clear a channel back to the plate's own default */
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

/** the seven silhouettes, as the toolbar's Shapes button and the panels spell them */
export const BANNER_SHAPES: { id: BannerShape; label: string; hint: string }[] = [
  { id: "glow", label: "Glow", hint: "A soft radial light behind the heading" },
  { id: "pill", label: "Pill", hint: "A capsule — fully rounded ends" },
  { id: "rounded", label: "Rounded", hint: "A card with rounded corners" },
  { id: "rect", label: "Box", hint: "A plain rectangle" },
  { id: "ribbon", label: "Ribbon", hint: "A ribbon with notched ends" },
  { id: "underline", label: "Underline", hint: "A rule under the heading only" },
  { id: "none", label: "None", hint: "No plate at all" },
];

export const BANNER_BORDER_STYLES: { value: BannerBorderStyle; label: string; hint: string; dash?: string }[] = [
  { value: "solid", label: "Solid", hint: "One continuous line" },
  { value: "dashed", label: "Dashed", hint: "Even dashes", dash: "4 3" },
  { value: "dotted", label: "Dotted", hint: "Round dots", dash: "0.1 3.2" },
  { value: "double", label: "Double", hint: "Two parallel lines" },
  { value: "none", label: "None", hint: "No outline at all" },
];

/** the line style as a picture — the panels' tiles and the toolbar's own icon */
export function BorderStyleIcon({ style, size = 18, color = "currentColor" }: { style: BannerBorderStyle; size?: number; color?: string }) {
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
  if (style === "double") {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.4" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
        <rect x="5.6" y="5.6" width="8.8" height="8.8" rx="2" fill="none" stroke={color} strokeWidth={Math.max(1.2, stroke * 0.7)} />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="3"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={style === "dashed" ? "4 3" : style === "dotted" ? "0.1 3.2" : undefined}
        strokeLinecap={style === "dotted" ? "round" : undefined}
      />
    </svg>
  );
}

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

/** the toolbar's own icon: a plate half painted, half see-through */
export function TransparencyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <pattern id="banner-transparency-check" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="rgba(255,255,255,.18)" />
          <rect width="2" height="2" fill="rgba(255,255,255,.42)" />
          <rect x="2" y="2" width="2" height="2" fill="rgba(255,255,255,.42)" />
        </pattern>
      </defs>
      <rect x="2.2" y="4.6" width="15.6" height="10.8" rx="3" fill="url(#banner-transparency-check)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 5.3h5a1.7 1.7 0 0 1 1.7 1.7v6a1.7 1.7 0 0 1-1.7 1.7h-5z" fill="currentColor" />
    </svg>
  );
}

/** the toolbar's own icon: a plate with its size handles */
export function SizeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.4" y="5.4" width="13.2" height="9.2" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.85" />
      <path d="M1.6 10h3.4M15 10h3.4M10 1.8v2.6M10 15.6v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 10 5 8.4M3 10l2 1.6M17 10l-2-1.6M17 10l-2 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** the toolbar's own icon: a plate with the four move arrows */
export function PositionIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5.6" y="6.2" width="8.8" height="7.6" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="5.6" y="6.2" width="8.8" height="7.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 1.6v3M10 15.4v3M1.6 10h3M15.4 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.6 3 10 1.6 11.4 3M8.6 17 10 18.4 11.4 17M3 8.6 1.6 10 3 11.4M17 8.6 18.4 10 17 11.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Design presets                                                     */
/* ------------------------------------------------------------------ */

/** one preset drawn as the plate it paints, at thumbnail scale */
export function BannerPresetTile({ preset, theme, active, onClick }: { preset: BannerPreset; theme: ThemeSettings; active?: boolean; onClick: () => void }) {
  const merged: BannerSettings = { ...DEFAULT_BANNER, ...bannerOf(theme), ...preset.banner, color: preset.banner.color ?? bannerOf(theme).color };
  const css = bannerCss({ ...merged, size: undefined, pos: undefined, halo: 0 }, theme.titleColor);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Banner preset: ${preset.name}`}
      aria-pressed={!!active}
      title={preset.name}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors",
        active ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
      )}
    >
      <span className="relative block h-6 w-full overflow-hidden rounded border border-white/10" style={{ background: theme.board }}>
        {css.halo ? <span className="absolute block" style={{ ...css.halo, left: "8%", top: "-10%", width: "84%", height: "120%", transform: undefined, filter: "none" }} /> : null}
        <span className="absolute block" style={{ ...css.box, left: "8%", top: "22%", width: "84%", height: "56%" }} />
        {css.border ? <span className="absolute block" style={{ ...css.border, left: "8%", top: "22%", width: "84%", height: "56%" }} /> : null}
      </span>
      <span className="truncate">{preset.name}</span>
    </button>
  );
}

export function BannerPresetPanel({ theme, banner, setBanner }: BannerProps) {
  return (
    <div className="space-y-2" data-banner-presets="">
      <Cap hint="a whole look — shape, paint and line">Design presets</Cap>
      <div className="grid grid-cols-2 gap-1.5">
        {BANNER_PRESETS.map((p) => (
          <BannerPresetTile
            key={p.name}
            preset={p}
            theme={theme}
            active={banner.shape === (p.banner.shape ?? banner.shape) && !!p.banner.color && p.banner.color === banner.color}
            onClick={() => setBanner(bannerPresetPatch(banner, p))}
          />
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        A preset repaints the plate and hands its size and place back to auto — the heading itself is never touched.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shape                                                              */
/* ------------------------------------------------------------------ */

/** one silhouette drawn with the plate's own paint, so the tiles read true */
function ShapeTile({ shape, banner, theme, chosen, onPick }: { shape: BannerShape; banner: BannerSettings; theme: ThemeSettings; chosen: boolean; onPick: () => void }) {
  const def = BANNER_SHAPES.find((s) => s.id === shape)!;
  // every tile shows the deck's real line, the chosen one included: only the
  // silhouette changes from tile to tile
  const css = bannerCss({ ...banner, shape, size: undefined, pos: undefined, halo: 0, border: { ...banner.border, enabled: canOutline(shape) && banner.border.enabled } }, theme.titleColor);
  const frame: CSSProperties = { position: "absolute", left: "6%", top: "26%", width: "88%", height: "48%" };
  return (
    <button
      type="button"
      role="option"
      aria-selected={chosen}
      aria-label={`Banner shape: ${def.label}`}
      title={def.hint}
      onClick={onPick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-colors",
        chosen ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25",
      )}
    >
      <span className="relative block h-7 w-full overflow-hidden rounded bg-[#0b1220]">
        {css.box.display !== "none" ? <span className="absolute block" style={{ ...css.box, ...(shape === "underline" ? { left: "6%", bottom: "22%", width: "88%" } : frame) }} /> : null}
        {css.border ? <span className="absolute block" style={{ ...css.border, ...(shape === "underline" ? {} : frame) }} /> : null}
      </span>
      <span className="text-[9.5px] font-medium leading-none">{def.label}</span>
    </button>
  );
}

export function BannerShapePanel({ theme, banner, setBanner }: BannerProps) {
  const current = BANNER_SHAPES.find((s) => s.id === banner.shape);
  return (
    <div className="space-y-2" data-banner-shapes="">
      <Cap hint={current?.hint}>Shape</Cap>
      <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label="Banner shape">
        {BANNER_SHAPES.map((s) => (
          <ShapeTile
            key={s.id}
            shape={s.id}
            banner={banner}
            theme={theme}
            chosen={banner.shape === s.id}
            onPick={() => setBanner({ shape: s.id })}
          />
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        <b>Glow</b> is a soft light, <b>Underline</b> a rule under the heading; the other silhouettes are real plates a border can
        follow.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

export function BannerEffectsPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  return (
    <div className="space-y-3" data-banner-effects="">
      <Cap hint={banner.shape === "glow" ? "the glow's softness" : "glow silhouettes only"}>Effects</Cap>
      <Field label="Softness" hint={`${banner.glow}`}>
        <div className={cn(banner.shape !== "glow" && "opacity-50")}>
          <Slider min={0} max={100} value={banner.glow} onChange={(v) => setBanner({ glow: v })} ariaLabel="Banner softness" />
        </div>
      </Field>
      <Field label="Outer halo" hint={banner.halo ? `${banner.halo}` : "off"}>
        <Slider min={0} max={100} value={banner.halo} onChange={(v) => setBanner({ halo: v })} ariaLabel="Banner halo" />
      </Field>
      <Toggle label="Shimmer animation (screen only)" checked={banner.shimmer} onChange={(v) => setBanner({ shimmer: v })} />
      <p className="text-[10px] leading-relaxed text-slate-500">
        The halo grows outward from the plate itself, whatever size it is. Shimmer is a presenter-only sheen and is never
        exported.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fill · Border colour                                               */
/* ------------------------------------------------------------------ */

const FILL_SWATCHES = ["#1f5fd0", "#7c3aed", "#059669", "#b91c1c", "#b45309", "#0e7490", "#334155", "#0b0b0f"];

export function BannerFillPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  return (
    <div className="space-y-3" data-banner-fill="">
      <Cap hint={banner.gradient.enabled ? "gradient" : banner.color}>Fill colour</Cap>
      <ColorField
        label="Banner colour"
        value={banner.color}
        fallback={DEFAULT_BANNER.color}
        presets={FILL_SWATCHES}
        autoLabel="Deck"
        onChange={(v) => setBanner({ color: v || DEFAULT_BANNER.color, gradient: { ...banner.gradient, enabled: false } })}
      />
      <details className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1" open={banner.gradient.enabled}>
        <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Gradient fill {banner.gradient.enabled ? "· on" : "· off"}
        </summary>
        <div className="pt-2">
          <GradientEditor
            label="Banner gradient"
            value={banner.gradient}
            fallback={banner.color}
            onChange={(g: Gradient) => setBanner({ gradient: g })}
            presets={[
              { name: "Blue", angle: 90, stops: [{ color: "#0f3fb8", at: 0 }, { color: "#3b7bff", at: 100 }] },
              { name: "Purple-cyan", angle: 90, stops: [{ color: "#7c3aed", at: 0 }, { color: "#06b6d4", at: 100 }] },
              { name: "Gold", angle: 180, stops: [{ color: "#ffd35a", at: 0 }, { color: "#b8860b", at: 100 }] },
              { name: "Sunset", angle: 90, stops: [{ color: "#f97316", at: 0 }, { color: "#ec4899", at: 100 }] },
              { name: "Emerald", angle: 135, stops: [{ color: "#065f46", at: 0 }, { color: "#10b981", at: 100 }] },
              { name: "Steel", angle: 180, stops: [{ color: "#475569", at: 0 }, { color: "#0f172a", at: 100 }] },
            ]}
          />
        </div>
      </details>
      <p className="text-[10px] leading-relaxed text-slate-500">
        The body's paint — a solid colour or a gradient. Its transparency is on the <b>Transparency</b> card, so the outline
        keeps its own.
      </p>
    </div>
  );
}

export function BannerBorderPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  return (
    <div className="space-y-3" data-banner-border="">
      <Cap hint={canOutline(banner.shape) ? (banner.border.enabled ? "on" : "off") : "pick a plate shape"}>Border colour</Cap>
      <Toggle
        label="Outline the plate"
        checked={banner.border.enabled}
        onChange={(v) => setBanner({ border: { ...banner.border, enabled: v } })}
      />
      <ColorField
        label="Border colour"
        value={banner.border.color}
        fallback="#ffd633"
        presets={["#ffffff", "#ffd633", "#0b0b0f", banner.color]}
        autoLabel="Auto"
        onChange={(v) => setBanner({ border: { ...banner.border, color: v || "#ffffff", enabled: true } })}
      />
      <p className="text-[10px] leading-relaxed text-slate-500">
        {canOutline(banner.shape)
          ? "The line is painted on a layer of its own: it fades with Border transparency and leaves the fill alone."
          : "The soft glow and the underline rule cannot wear an outline — pick Pill, Rounded, Box or Ribbon under Shape."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border style — pictures, nothing else                              */
/* ------------------------------------------------------------------ */

export function BannerBorderStylePanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const current = bannerBorderStyle(banner);
  return (
    <div className="space-y-2" data-banner-border-style="">
      <Cap hint={BANNER_BORDER_STYLES.find((b) => b.value === current)?.hint}>Border style</Cap>
      <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Border style">
        {BANNER_BORDER_STYLES.map((b) => {
          const chosen = current === b.value;
          return (
            <button
              key={b.value}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Banner border style: ${b.label}`}
              title={b.hint}
              onClick={() => setBanner({ border: { ...banner.border, style: b.value, enabled: b.value !== "none" } })}
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
        {banner.border.enabled
          ? "The style rides on the line's own layer, so Border colour, weight and transparency all apply to it."
          : "None takes the outline away. Pick any other style to bring the line back in its own colour."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border radius — a live corner and one slider                       */
/* ------------------------------------------------------------------ */

export function BannerRadiusPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const shapes = canOutline(banner.shape) || banner.shape === "underline";
  const max = rangeMax(120, banner.radius);
  const preview: CSSProperties = {
    width: 44,
    height: 30,
    background: `linear-gradient(90deg, ${banner.color}, ${withAlpha(banner.color, 0.75)})`,
    borderRadius: Math.min(banner.radius, max),
    border: bannerHasLine(banner) ? `${Math.max(1, banner.border.width)}px ${bannerBorderStyle(banner)} ${banner.border.color}` : undefined,
    boxSizing: "border-box",
  };
  return (
    <div className="space-y-2" data-banner-radius="">
      <div className="flex items-center gap-3">
        <span className="flex h-[52px] w-[58px] items-center justify-center rounded-lg border border-white/10 bg-slate-950/60" aria-hidden="true">
          <span style={preview} />
        </span>
        <span className="min-w-0 flex-1">
          <Cap hint={banner.shape === "underline" ? "the rule's ends" : `${banner.radius}px`}>Border radius</Cap>
          <div className={cn(!shapes && "opacity-50")}>
            <Slider value={Math.min(banner.radius, max)} min={0} max={max} step={1} onChange={(v) => setBanner({ radius: v })} ariaLabel="Banner border radius (px)" />
          </div>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Drag past the plate's own half and it becomes a full round end — the slider keeps going well beyond it.
        </p>
        <AutoBtn on={banner.radius !== DEFAULT_BANNER.radius} onClick={() => setBanner({ radius: DEFAULT_BANNER.radius })} label="Border radius: back to the plate's own corners" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Border weight — one slider                                         */
/* ------------------------------------------------------------------ */

export function BannerWeightPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const max = rangeMax(24, banner.border.width);
  const w = Math.min(banner.border.width, max);
  const style = bannerBorderStyle(banner);
  return (
    <div className="space-y-2" data-banner-weight="">
      <div className="flex items-center gap-3">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-lg border border-white/10 bg-slate-950/60" aria-hidden="true">
          <span
            style={{
              width: 40,
              height: 30,
              borderRadius: 4,
              boxSizing: "border-box",
              border: `${w}px ${style === "none" ? "solid" : style} ${banner.border.color}`,
              background: banner.gradient.enabled ? undefined : withAlpha(banner.color, 0.35),
            }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <Cap hint={`${banner.border.width}px`}>Border weight</Cap>
          <Slider value={w} min={0} max={max} step={0.5} onChange={(v) => setBanner({ border: { ...banner.border, width: v, ...(v > 0 && !banner.border.enabled ? { enabled: true } : {}) } })} ariaLabel="Banner border weight (px)" />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          0 takes the line away; anything above paints it in the Border colour, in the style you picked. The slider has no
          ceiling.
        </p>
        <AutoBtn on={banner.border.width !== DEFAULT_BANNER.border.width} onClick={() => setBanner({ border: { ...banner.border, width: DEFAULT_BANNER.border.width } })} label="Border weight: back to the plate's own line" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transparency — one slider each for the shape and the line          */
/* ------------------------------------------------------------------ */

export function BannerTransparencyPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const shapePct = Math.round(clampOpacity(banner.opacity) * 100);
  const borderPct = Math.round(clampOpacity(banner.border.opacity) * 100);
  return (
    <div className="space-y-3" data-banner-transparency="">
      <Field label="Shape transparency" hint={shapePct >= 100 ? "fully visible" : `${100 - shapePct}% see-through`}>
        <Slider value={shapePct} min={0} max={100} onChange={(v) => setBanner({ opacity: v / 100 })} ariaLabel="Banner shape transparency (100 = fully visible)" />
      </Field>
      <Field label="Border transparency" hint={borderPct >= 100 ? "fully visible" : `${100 - borderPct}% see-through`}>
        <Slider value={borderPct} min={0} max={100} onChange={(v) => setBanner({ border: { ...banner.border, opacity: v / 100 } })} ariaLabel="Banner border transparency (100 = fully visible)" />
      </Field>
      <p className="text-[10px] leading-relaxed text-slate-500">
        100 = fully visible on both. The shape fades the body and its glow, the border fades the line alone — each is painted on
        its own layer, so the two never drag each other down.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banner size — free width & height                                  */
/* ------------------------------------------------------------------ */

/** the sliders run far past the board, so "free" means free */
export const SIZE_MAX_W = 2560;
export const SIZE_MAX_H = 1440;

export function BannerSizePanel({ theme, banner, setBanner }: BannerProps) {
  const auto = bannerSizeNow(banner, theme.titleSize ?? 54, theme.layout?.title?.w ?? 57);
  const w = banner.size?.w;
  const h = banner.size?.h;
  /** the width the plate paints at right now — the teacher's px, else 630 */
  const nowW = bannerPlateWidth(banner);
  const shownW = Math.min(nowW, rangeMax(SIZE_MAX_W, w));
  const shownH = Math.min(h ?? auto.h, rangeMax(SIZE_MAX_H, h));
  const maxW = rangeMax(SIZE_MAX_W, w);
  const maxH = rangeMax(SIZE_MAX_H, h);
  const factory = nowW === BANNER_WIDTH && h === undefined;
  return (
    <div className="space-y-3" data-banner-size="">
      <Cap hint={factory ? `its own box · ${nowW}×${auto.h}px` : "free size"}>Banner size</Cap>
      <Field label="Left ↔ right" hint={w === undefined ? `${nowW}px — the shape's own width` : `${w}px`}>
        <Slider
          value={r1(shownW)}
          min={0}
          max={maxW}
          step={1}
          onChange={(v) => setBanner({ size: { ...banner.size, w: v } })}
          ariaLabel="Banner width (px)"
        />
      </Field>
      <Field label="Top ↕ bottom" hint={h === undefined ? "auto — fits the heading" : `${h}px`}>
        <Slider
          value={r1(shownH)}
          min={0}
          max={maxH}
          step={1}
          onChange={(v) => setBanner({ size: { ...banner.size, h: v } })}
          ariaLabel="Banner height (px)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          The shape is {BANNER_WIDTH}px across on the 1280 × 720 board and stays there whatever the heading says — the bar
          paints any other width, in px, growing both ways from the middle so the heading stays centred on its plate.
          Nothing clamps it: the plate may run past the board's own edge.
        </p>
        <AutoBtn on={factory} onClick={() => setBanner({ size: { w: BANNER_WIDTH } })} label={`Banner size: back to the ${BANNER_WIDTH}px shape`} />
      </div>
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
        <Cap hint="while the height is auto">Room above and below the heading</Cap>
        <Field label="Height padding" hint={`${banner.padY}%`}>
          <Slider min={0} max={80} value={banner.padY} onChange={(v) => setBanner({ padY: v })} ariaLabel="Banner height padding (%)" />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banner position — free X & Y                                       */
/* ------------------------------------------------------------------ */

export const POS_LIMIT_X = 1280;
export const POS_LIMIT_Y = 720;

export function BannerPositionPanel({ banner, setBanner }: Omit<BannerProps, "theme">) {
  const x = banner.pos?.x ?? 0;
  const y = banner.pos?.y ?? 0;
  return (
    <div className="space-y-3" data-banner-position="">
      <Cap hint={x || y ? `${x} · ${y} px` : "its own place"}>Banner position</Cap>
      <Field label="X axis — left ↔ right" hint={`${r1(x)} px`}>
        <Slider
          value={r1(Math.max(Math.min(x, rangeMax(POS_LIMIT_X, x)), -rangeMax(POS_LIMIT_X, x)))}
          min={-rangeMax(POS_LIMIT_X, x)}
          max={rangeMax(POS_LIMIT_X, x)}
          step={1}
          onChange={(v) => setBanner({ pos: { ...banner.pos, x: v } })}
          ariaLabel="Banner position X (px)"
        />
      </Field>
      <Field label="Y axis — up ↕ down" hint={`${r1(y)} px`}>
        <Slider
          value={r1(Math.max(Math.min(y, rangeMax(POS_LIMIT_Y, y)), -rangeMax(POS_LIMIT_Y, y)))}
          min={-rangeMax(POS_LIMIT_Y, y)}
          max={rangeMax(POS_LIMIT_Y, y)}
          step={1}
          onChange={(v) => setBanner({ pos: { ...banner.pos, y: v } })}
          ariaLabel="Banner position Y (px)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          The nudge moves the plate alone — the heading stays where it is. Positive X goes right, positive Y goes down, and the
          sliders keep running to the whole board and past it.
        </p>
        <AutoBtn on={!x && !y} onClick={() => setBanner({ pos: undefined })} label="Banner position: back to its own place" />
      </div>
    </div>
  );
}
