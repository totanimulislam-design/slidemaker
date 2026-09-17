import type { BannerSettings, BannerShape, Box, DeckHeader, ElementId, ThemeSettings } from "../lib/types";
import { DEFAULT_BANNER, cloneBanner } from "../lib/types";
import { BANNER_PRESETS, bannerCss } from "../lib/banner";
import GradientEditor from "./GradientEditor";
import ElementPosition from "./ElementPosition";
import { Btn, ColorInput, Field, PanelHead, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Title background".
 *
 * The plate painted *behind* the heading: silhouette, solid colour or gradient,
 * softness, halo, opacity, padding, corner radius, border and the on-screen
 * shimmer. The glyphs themselves live in the sibling "Title text" panel.
 */
interface Props {
  theme: ThemeSettings;
  header: DeckHeader;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setHeader: (patch: Partial<DeckHeader>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const SHAPES: { id: BannerShape; label: string; icon: string }[] = [
  { id: "glow", label: "Glow", icon: "◉" },
  { id: "pill", label: "Pill", icon: "⬭" },
  { id: "rounded", label: "Rounded", icon: "▢" },
  { id: "rect", label: "Box", icon: "▭" },
  { id: "ribbon", label: "Ribbon", icon: "⧓" },
  { id: "underline", label: "Underline", icon: "▁" },
  { id: "none", label: "None", icon: "∅" },
];

const SWATCHES = ["#1f5fd0", "#7c3aed", "#059669", "#b91c1c", "#b45309", "#0e7490", "#334155"];

export default function TitleBackgroundPanel({ theme, header, setTheme, setHeader, patchLayout }: Props) {
  const b: BannerSettings = {
    ...DEFAULT_BANNER,
    ...(theme.banner ?? {}),
    color: theme.banner?.color ?? theme.titleBanner,
  };
  /**
   * `theme.titleBanner` is the legacy solid banner colour older decks read from,
   * so a colour pick writes both — the two can never drift apart.
   */
  const set = (p: Partial<BannerSettings>) =>
    setTheme({ banner: { ...b, ...p }, ...(p.color ? { titleBanner: p.color } : {}) });
  const css = bannerCss(b, theme.titleColor);
  const solidShape = b.shape !== "glow" && b.shape !== "none";

  return (
    <div className="space-y-4">
      <PanelHead
        title="Title background"
        subtitle="The banner plate behind the heading — shape, fill, glow and padding."
      />

      {/* --------------------------------- live preview ---------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10" style={{ background: theme.board }}>
        <div className="flex items-center justify-center px-6 py-7">
          <div style={{ position: "relative", padding: css.padding }}>
            {header.showBanner && css.halo && <div style={css.halo} />}
            {header.showBanner && <div className={b.shimmer ? "banner-shimmer" : undefined} style={css.box} />}
            <div
              style={{
                position: "relative",
                fontFamily: theme.bengaliFont,
                fontSize: 30,
                fontWeight: 800,
                whiteSpace: "nowrap",
                lineHeight: 1.25,
                ...css.text,
              }}
            >
              {header.title || "বহুনির্বাচনী"}
            </div>
          </div>
        </div>
      </div>

      <Toggle
        label="Show banner behind the title"
        checked={header.showBanner}
        onChange={(v) => setHeader({ showBanner: v })}
      />

      {/* --------------------------------- presets --------------------------- */}
      <Field label="Banner presets" as="div">
        <div className="grid grid-cols-4 gap-1.5">
          {BANNER_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => set({ ...cloneBanner(b), ...p.banner })}
              title={p.name}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-[10px] text-slate-300 hover:border-amber-400/60"
            >
              <span className="h-5 w-full rounded border border-white/10" style={{ background: p.swatch }} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </Field>

      {/* --------------------------------- shape ----------------------------- */}
      <Field label="Shape" as="div">
        <div className="grid grid-cols-7 gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => set({ shape: s.id })}
              title={s.label}
              className={cn(
                "flex flex-col items-center rounded-lg border py-1.5 text-[9px]",
                b.shape === s.id
                  ? "border-amber-400 bg-amber-400 text-slate-950"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
              )}
            >
              <span className="text-base leading-none">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {b.shape !== "none" && (
        <>
          {!b.gradient.enabled && (
            <Field label="Banner colour" as="div">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ColorInput label={b.color} value={b.color} onChange={(v) => set({ color: v })} />
                </div>
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ color: c })}
                    className="h-6 w-6 rounded-md border border-black/40"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>
          )}

          <GradientEditor
            label="Gradient fill"
            value={b.gradient}
            fallback={b.color}
            onChange={(g) => set({ gradient: g })}
            presets={[
              { name: "Blue", angle: 90, stops: [{ color: "#0f3fb8", at: 0 }, { color: "#3b7bff", at: 100 }] },
              { name: "Purple-cyan", angle: 90, stops: [{ color: "#7c3aed", at: 0 }, { color: "#06b6d4", at: 100 }] },
              { name: "Gold", angle: 180, stops: [{ color: "#ffd35a", at: 0 }, { color: "#b8860b", at: 100 }] },
              { name: "Sunset", angle: 90, stops: [{ color: "#f97316", at: 0 }, { color: "#ec4899", at: 100 }] },
              { name: "Emerald", angle: 135, stops: [{ color: "#065f46", at: 0 }, { color: "#10b981", at: 100 }] },
              { name: "Steel", angle: 180, stops: [{ color: "#475569", at: 0 }, { color: "#0f172a", at: 100 }] },
            ]}
          />

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {b.shape === "glow" && (
              <Field label="Softness" hint={`${b.glow}`}>
                <Slider min={0} max={100} value={b.glow} onChange={(v) => set({ glow: v })} />
              </Field>
            )}
            <Field label="Outer halo" hint={b.halo ? `${b.halo}` : "off"}>
              <Slider min={0} max={100} value={b.halo} onChange={(v) => set({ halo: v })} />
            </Field>
            <Field label="Opacity" hint={`${Math.round(b.opacity * 100)}%`}>
              <Slider min={0.1} max={1} step={0.05} value={b.opacity} onChange={(v) => set({ opacity: v })} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Field label="Width padding" hint={`${b.padX}%`}>
              <Slider min={0} max={40} value={b.padX} onChange={(v) => set({ padX: v })} />
            </Field>
            <Field label="Height padding" hint={`${b.padY}%`}>
              <Slider min={0} max={80} value={b.padY} onChange={(v) => set({ padY: v })} />
            </Field>
            {(b.shape === "rounded" || b.shape === "underline") && (
              <Field label={b.shape === "underline" ? "Line thickness" : "Corner radius"} hint={`${b.radius}px`}>
                <Slider min={0} max={60} value={b.radius} onChange={(v) => set({ radius: v })} />
              </Field>
            )}
            {solidShape && (
              <>
                <Toggle
                  label="Border"
                  checked={b.border.enabled}
                  onChange={(v) => set({ border: { ...b.border, enabled: v } })}
                />
                {b.border.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput
                      label="Border colour"
                      value={b.border.color}
                      onChange={(v) => set({ border: { ...b.border, color: v } })}
                    />
                    <Field label="Width" hint={`${b.border.width}px`}>
                      <Slider
                        min={1}
                        max={8}
                        step={0.5}
                        value={b.border.width}
                        onChange={(v) => set({ border: { ...b.border, width: v } })}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}
            <Toggle label="Shimmer animation (screen only)" checked={b.shimmer} onChange={(v) => set({ shimmer: v })} />
          </div>
        </>
      )}

      <ElementPosition theme={theme} id="title" patchLayout={patchLayout} label="Title block" />

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <Btn size="sm" variant="danger" onClick={() => setTheme({ banner: cloneBanner(DEFAULT_BANNER) })}>
          Reset banner design
        </Btn>
      </div>
    </div>
  );
}
