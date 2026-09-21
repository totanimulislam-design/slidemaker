import { useState } from "react";
import type { ShapeEffectKind, ThemeSettings } from "../lib/types";
import { shade } from "../lib/color";
import { numberStyleDef, type NumberStyle } from "../lib/numberStyles";
import { BULLET_EFFECTS, BULLET_EFFECT_BY_ID, BULLET_EFFECT_GROUPS, bulletEffectColor, bulletEffectIsOn } from "../lib/bulletEffects";
import {
  BULLET_STYLES,
  BULLET_STYLE_BY_ID,
  BULLET_STYLE_GROUPS,
  bulletStyleOf,
  bulletStylePatch,
  type BulletStyleGroup,
} from "../lib/bulletStyles";
import type { ShapeEffectGroup } from "../lib/shapeEffects";
import NumberStylePicker, { NumberStylePreview } from "./NumberStylePicker";
import { ColorInput, Slider } from "./ui";
import { cn } from "../utils/cn";

/**
 * **Bullet design** — the one card that decides how the question marker looks.
 *
 * Three tabs, in the order a teacher reaches for them:
 *
 *   Bullet point presets   what the marker is — the classic bullet points
 *                          (dot, hollow dot, square, dash, arrowhead, check…),
 *                          the numbering presets ("7." · "(7)" · "Q7" · "07")
 *                          and every silhouette: circles, chips, polygons,
 *                          seals, marks and the sticker family — plus its
 *                          size and base colour.
 *   Shape                  one-click shapes: a silhouette dressed in a whole
 *                          set of channels written together (fill · line ·
 *                          corners · effect), so "hex tile", "gold seal" or
 *                          "neon tube" is a single click.
 *   Shape effects          the effects an object can wear — shadow, glow,
 *                          neon, bevel, 3-D, reflection, material, texture,
 *                          soft edges, sticker outline… — each with its own
 *                          intensity and colour.
 *
 * Everything is previewed with the deck's own theme through the same renderer
 * the board uses, so a tile is the marker as it will actually paint. The
 * individual channels (fill · border · style · radius · weight · transparency ·
 * position) stay on the toolbar line and in the inspector card, where a single
 * tweak belongs; this card is where a *look* is chosen.
 */
interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

type Tab = "designs" | "style" | "effects";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "designs", label: "Bullet point presets", hint: "Classic bullets, numbering and every marker silhouette" },
  { id: "style", label: "Shape", hint: "One-click shapes: silhouette, fill, line and effect together" },
  { id: "effects", label: "Shape effects", hint: "Shadow, glow, bevel, texture and the rest" },
];

/** the solid colour an effect's "Auto" falls back to (the marker's own face) */
function plateOf(T: ThemeSettings): string {
  const fill = T.bulletFill ?? "";
  if (/^#[0-9a-f]{3,8}$/i.test(fill)) return fill;
  return shade(T.accent || "#2f4fff", 0.2);
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[9.5px] transition-colors",
        on
          ? "border-amber-400 bg-amber-400 font-semibold text-slate-950"
          : "border-white/5 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

export default function BulletDesignPanel({ theme: T, setTheme }: Props) {
  const [tab, setTab] = useState<Tab>("designs");
  const hint = TABS.find((t) => t.id === tab)?.hint ?? "";

  return (
    <div className="space-y-2.5" data-bullet-design-panel="" data-bullet-design-tab={tab}>
      {/* ── the three tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1" role="tablist" aria-label="Bullet design">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-label={`Bullet design tab: ${t.label}`}
            title={t.hint}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-medium transition-colors",
              tab === t.id
                ? "border-amber-400 bg-amber-400/15 text-amber-200"
                : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/25 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-[10px] leading-relaxed text-slate-500">{hint}</p>

      {tab === "designs" && (
        <NumberStylePicker theme={T} setTheme={setTheme} title="Bullet point presets" controls="full" maxHeight="max-h-52" />
      )}
      {tab === "style" && <StyleTab theme={T} setTheme={setTheme} />}
      {tab === "effects" && <EffectsTab theme={T} setTheme={setTheme} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shape — one-click shapes (silhouette · fill · line · effect)       */
/* ------------------------------------------------------------------ */

function StyleTab({ theme: T, setTheme }: Props) {
  const [group, setGroup] = useState<BulletStyleGroup | "all">("all");
  const current = bulletStyleOf(T);
  const shown = group === "all" ? BULLET_STYLES : BULLET_STYLES.filter((s) => s.group === group);

  return (
    <div className="space-y-2" data-bullet-style-tab="">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Shape</span>
        <span className="text-[10px] text-slate-500">
          {BULLET_STYLES.length} shapes · {current ? BULLET_STYLE_BY_ID.get(current)?.label : "custom"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Shape group">
        <Chip on={group === "all"} onClick={() => setGroup("all")} label="All shapes">
          All
        </Chip>
        {BULLET_STYLE_GROUPS.map((g) => (
          <Chip key={g} on={group === g} onClick={() => setGroup(g)} label={`Shapes: ${g}`}>
            {g}
          </Chip>
        ))}
      </div>

      <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-0.5" role="listbox" aria-label="Shape">
        {shown.map((s) => {
          const chosen = current === s.id;
          const patched: ThemeSettings = { ...T, ...s.patch } as ThemeSettings;
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Shape: ${s.label}`}
              title={s.hint}
              onClick={() => setTheme(bulletStylePatch(s))}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-between gap-1 rounded-lg border p-1.5 text-center transition-all",
                chosen
                  ? "border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                  : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900",
              )}
            >
              <span className="relative flex w-full flex-1 items-center justify-center py-0.5">
                <NumberStylePreview
                  style={s.patch.numberStyle ?? String(T.numberStyle ?? "circle")}
                  theme={patched}
                  size={24}
                  number="7"
                />
              </span>
              <span className="w-full truncate text-[9px] font-medium leading-tight text-slate-300">{s.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        {current
          ? `${BULLET_STYLE_BY_ID.get(current)?.hint}. Fine-tune any channel on the toolbar — the tile stops claiming the shape as soon as one is edited.`
          : "A shape writes the marker's silhouette, fill, line, corners, transparency and effect together. Fine-tune any of them afterwards on the toolbar line."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shape effects — the effect an object can wear                      */
/* ------------------------------------------------------------------ */

function EffectsTab({ theme: T, setTheme }: Props) {
  const [group, setGroup] = useState<ShapeEffectGroup | "all">("all");
  const kind = T.bulletEffect;
  const on = bulletEffectIsOn(kind);
  const def = BULLET_EFFECT_BY_ID.get(kind ?? "none") ?? BULLET_EFFECTS[0];
  const intensity = T.bulletEffectIntensity ?? 50;
  const plate = plateOf(T);
  const shown = group === "all" ? BULLET_EFFECTS : BULLET_EFFECTS.filter((e) => e.group === group);

  return (
    <div className="space-y-2" data-bullet-effects-tab="">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Shape effects</span>
        <span className="text-[10px] text-slate-500">
          {BULLET_EFFECTS.length} effects · {def.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Shape effect group">
        <Chip on={group === "all"} onClick={() => setGroup("all")} label="All shape effects">
          All
        </Chip>
        {BULLET_EFFECT_GROUPS.map((g) => (
          <Chip key={g} on={group === g} onClick={() => setGroup(g)} label={`Shape effects: ${g}`}>
            {g}
          </Chip>
        ))}
      </div>

      <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-0.5" role="listbox" aria-label="Shape effect">
        {shown.map((e) => {
          const chosen = (kind ?? "none") === e.id;
          const patched: ThemeSettings = {
            ...T,
            bulletEffect: e.id as ShapeEffectKind,
            bulletEffectIntensity: chosen ? intensity : 55,
          } as ThemeSettings;
          return (
            <button
              key={e.id}
              type="button"
              role="option"
              aria-selected={chosen}
              aria-label={`Shape effect: ${e.label}`}
              title={e.hint}
              onClick={() => setTheme({ bulletEffect: e.id as ShapeEffectKind, ...(e.id === "none" ? { bulletStylePreset: undefined } : {}) })}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-between gap-1 rounded-lg border p-1.5 text-center transition-all",
                chosen
                  ? "border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                  : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900",
              )}
            >
              <span className="relative flex w-full flex-1 items-center justify-center py-0.5">
                <NumberStylePreview style={String(T.numberStyle ?? "circle")} theme={patched} size={24} number="7" />
              </span>
              <span className="w-full truncate text-[9px] font-medium leading-tight text-slate-300">{e.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── the chosen effect's own two knobs ───────────────────────────── */}
      <div className={cn("space-y-1.5 rounded-lg border border-white/10 bg-slate-900/40 p-2", !on && "opacity-60")}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Effect intensity</span>
          <span className="text-[10px] text-slate-500">{def.hint}</span>
        </div>
        <Slider
          value={intensity}
          min={0}
          max={100}
          onChange={(v) =>
            setTheme({ bulletEffectIntensity: v, ...(on ? {} : { bulletEffect: "shadow" as ShapeEffectKind }) })
          }
          ariaLabel="Bullet effect intensity"
        />
        {def.color && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1">
              <ColorInput
                label="Bullet effect colour"
                value={T.bulletEffectColor || bulletEffectColor(T, T.accent || "#2f4fff", plate)}
                onChange={(v) => setTheme({ bulletEffectColor: v })}
              />
            </div>
            <button
              type="button"
              className={cn("ctx-btn ctx-default", !T.bulletEffectColor && "is-on")}
              aria-pressed={!T.bulletEffectColor}
              aria-label="Bullet effect colour: auto"
              title="Follow the marker's own face"
              onClick={() => setTheme({ bulletEffectColor: undefined })}
            >
              Auto
            </button>
          </div>
        )}
        <p className="pt-0.5 text-[10px] leading-relaxed text-slate-500">
          The effect paints the marker's <b>body</b> only — {numberStyleDef((T.numberStyle ?? "circle") as NumberStyle).label}'s
          number keeps its own ink and effects under <b>Q bullet text</b>.
        </p>
      </div>
    </div>
  );
}
