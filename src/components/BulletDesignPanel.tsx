import { useState } from "react";
import type { ShapeEffectKind, ThemeSettings } from "../lib/types";
import { shade } from "../lib/color";
import {
  NUMBER_STYLES,
  NUMBER_STYLE_CATEGORIES,
  PRESET_CATEGORIES,
  isBulletPoint,
  isNumberingPreset,
  isPresetCategory,
  numberStyleDef,
  type NumberStyle,
  type NumberStyleCategory,
} from "../lib/numberStyles";
import { BULLET_EFFECTS, BULLET_EFFECT_BY_ID, BULLET_EFFECT_GROUPS, bulletEffectColor, bulletEffectIsOn } from "../lib/bulletEffects";
import {
  BULLET_STYLES,
  BULLET_STYLE_BY_ID,
  BULLET_STYLE_GROUPS,
  bulletStyleOf,
  bulletStylePatch,
  type BulletStyle,
  type BulletStyleGroup,
} from "../lib/bulletStyles";
import type { ShapeEffectGroup } from "../lib/shapeEffects";
import NumberStylePicker, { NumberStylePreview } from "./NumberStylePicker";
import { ColorField, ColorInput, Field, Slider } from "./ui";
import { cn } from "../utils/cn";

/**
 * **Bullet design** — the one card that decides how the question marker looks.
 *
 * Three tabs, in the order a teacher reaches for them:
 *
 *   Bullet point presets   the ready-made looks — the classic bullet points
 *                          (dot, hollow dot, square, dash, arrowhead, check…),
 *                          the numbering presets ("7." · "(7)" · "Q7" · "07")
 *                          and the one-click designs: a silhouette dressed in
 *                          a whole set of channels written together (fill ·
 *                          line · corners · effect), so "hex tile", "gold
 *                          seal" or "neon tube" is a single click — plus the
 *                          marker's size and base colour.
 *   Shape                  the silhouette alone — round & soft, cards &
 *                          chips, polygons, arrows, seals & stars, callouts,
 *                          flowchart symbols, the sticker family and the
 *                          marks. Picking one keeps the paint the marker has.
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
  { id: "designs", label: "Bullet point presets", hint: "Ready-made looks: classic bullets, numbering and one-click designs" },
  { id: "style", label: "Shape", hint: "The silhouette alone — round, cards, polygons, arrows, seals, callouts, flowchart, stickers, marks" },
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

      {tab === "designs" && <PresetsTab theme={T} setTheme={setTheme} />}
      {tab === "style" && <NumberStylePicker theme={T} setTheme={setTheme} title="Shape" maxHeight="max-h-56" />}
      {tab === "effects" && <EffectsTab theme={T} setTheme={setTheme} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bullet point presets — the ready-made looks                        */
/* ------------------------------------------------------------------ */

type PresetGroup = "all" | NumberStyleCategory | BulletStyleGroup;

/** the groups the presets tab is browsed by: the two glyph families, then the one-click looks */
const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  ...NUMBER_STYLE_CATEGORIES.filter((c) => isPresetCategory(c.id)).map((c) => ({ id: c.id as PresetGroup, label: c.label })),
  ...BULLET_STYLE_GROUPS.map((g) => ({ id: g as PresetGroup, label: g })),
];

/** the classic bullet points and the numbering formats (`lib/numberStyles`) */
const GLYPH_PRESETS = NUMBER_STYLES.filter((d) => isPresetCategory(d.category));

/** what the footer says about the preset that is on */
function describePreset(T: ThemeSettings, look: BulletStyle | undefined): string {
  if (look) return `${look.hint}. Fine-tune any channel on the toolbar — the tile stops claiming the look as soon as one is edited.`;
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const def = numberStyleDef(id);
  if (isBulletPoint(id))
    return `${def.hint}. A bullet point stands in for the number, like a list bullet does — its colour, outline, transparency and effect are still yours to change.`;
  if (isNumberingPreset(id))
    return `${def.hint}. A numbering preset paints the number with its punctuation and no shape; its ink, face and size live under Q bullet text.`;
  if (def.category === "numArrow")
    return `${def.hint}. The number rides on its own arrow — recolour the fill, line and effect like any marker, and swap the silhouette alone under Shape.`;
  return "A preset writes the whole marker at once — a bullet point or numbering format, or a one-click look with its silhouette, fill, line, corners, transparency and effect. Swap the silhouette alone under Shape.";
}

function PresetsTab({ theme: T, setTheme }: Props) {
  const [group, setGroup] = useState<PresetGroup>("all");
  const shape = (T.numberStyle ?? "circle") as NumberStyle;
  const lookId = bulletStyleOf(T);
  const look = lookId ? BULLET_STYLE_BY_ID.get(lookId) : undefined;
  /* the preset the marker is wearing: a claimed look, a bullet point, a numbering format — else "custom" */
  const now = look?.label ?? (isPresetCategory(numberStyleDef(shape).category) ? numberStyleDef(shape).label : "custom");
  const total = GLYPH_PRESETS.length + BULLET_STYLES.length;

  const glyphs = group === "all" ? GLYPH_PRESETS : GLYPH_PRESETS.filter((d) => d.category === group);
  const looks =
    group === "all"
      ? BULLET_STYLES
      : (PRESET_CATEGORIES as string[]).includes(group)
        ? []
        : BULLET_STYLES.filter((s) => s.group === group);

  const tile = (key: string, label: string, hint: string, chosen: boolean, onClick: () => void, preview: React.ReactNode) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={chosen}
      aria-label={`Bullet preset: ${label}`}
      title={hint}
      onClick={onClick}
      className={cn(
        "flex min-h-[58px] flex-col items-center justify-between gap-1 rounded-lg border p-1.5 text-center transition-all",
        chosen
          ? "border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
          : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900",
      )}
    >
      <span className="relative flex w-full flex-1 items-center justify-center py-0.5">{preview}</span>
      <span className="w-full truncate text-[9px] font-medium leading-tight text-slate-300">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3" data-bullet-presets-tab="">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Bullet point presets</span>
        <span className="text-[10px] text-slate-500">
          {total} presets · now {now}
        </span>
      </div>

      {/* the marker's size and the base colour every design derives from */}
      <Field label="Bullet size" hint={`${T.bulletSize ?? 54} px`}>
        <Slider min={20} max={160} value={T.bulletSize ?? 54} onChange={(v) => setTheme({ bulletSize: v })} ariaLabel="Bullet size" />
      </Field>
      <ColorField
        label="Bullet colour"
        value={T.accent || "#2f4fff"}
        fallback={T.accent || "#2f4fff"}
        onChange={(v) => setTheme({ accent: v })}
        allowNone={false}
        autoLabel="Accent"
        presets={[T.accent || "#2f4fff", "#0f2a5f", "#e30613", "#0b0b0f", "#ffd633", "#ffffff"]}
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Bullet preset group">
        <Chip on={group === "all"} onClick={() => setGroup("all")} label="All bullet presets">
          All
        </Chip>
        {PRESET_GROUPS.map((g) => (
          <Chip key={g.id} on={group === g.id} onClick={() => setGroup(g.id)} label={`Bullet presets: ${g.label}`}>
            {g.label}
          </Chip>
        ))}
      </div>

      <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto p-0.5" role="listbox" aria-label="Bullet preset">
        {/* a bullet point or a numbering format writes the silhouette alone — the paint stays */}
        {glyphs.map((d) =>
          tile(d.id, d.label, d.hint, shape === d.id, () => setTheme({ numberStyle: d.id }), (
            <NumberStylePreview style={d.id} theme={T} size={24} number="7" />
          )),
        )}
        {/* a one-click look writes every channel at once */}
        {looks.map((s) => {
          const patched: ThemeSettings = { ...T, ...s.patch } as ThemeSettings;
          return tile(s.id, s.label, s.hint, lookId === s.id, () => setTheme(bulletStylePatch(s)), (
            <NumberStylePreview style={s.patch.numberStyle ?? String(T.numberStyle ?? "circle")} theme={patched} size={24} number="7" />
          ));
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">{describePreset(T, look)}</p>
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
