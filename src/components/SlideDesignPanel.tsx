import { useMemo, useState } from "react";
import {
  DESIGN_ASPECTS,
  DESIGN_FAMILIES,
  FAMILY_LABEL,
  SLIDE_DESIGN_COUNT,
  SLIDE_DESIGNS,
  activeSlideDesign,
  designPatch,
  loadDesignFonts,
  type DesignFamilyId,
  type SlideDesignPreset,
} from "../lib/slideDesigns";
import type { ThemeSettings } from "../lib/types";
import DesignThumb from "./DesignThumb";
import { PanelHead } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Design".
 *
 * The gallery of complete slide looks. One card is one design, and a design is
 * the whole slide painted at once — the three badges, the title and the plate
 * behind it, the question marker and stem, the option text, the option markers
 * and the plate behind them, the option rows, the board background and the
 * frame. Picking a card writes one deck patch, so it is a single undo step and
 * a single repaint.
 *
 * Everything else about one part — nudging a size, recolouring a marker, moving
 * an element — lives in that part's own destination; this panel only ever
 * answers "what does the whole slide look like?".
 */
interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

type Filter = DesignFamilyId | "all";

export default function SlideDesignPanel({ theme, setTheme }: Props) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Filter>("all");

  const active = useMemo(() => activeSlideDesign(theme), [theme]);
  const q = query.trim().toLowerCase();

  const list = useMemo(
    () =>
      SLIDE_DESIGNS.filter(
        (d) =>
          (family === "all" || d.family === family) &&
          (!q || d.name.toLowerCase().includes(q) || d.hint.toLowerCase().includes(q) || FAMILY_LABEL[d.family].toLowerCase().includes(q)),
      ),
    [family, q],
  );

  const apply = (d: SlideDesignPreset) => {
    // a design names real typefaces — fetch them before the repaint, not after
    loadDesignFonts(d);
    setTheme(designPatch(d, theme));
  };

  const counts = useMemo(() => {
    const out = new Map<DesignFamilyId, number>();
    for (const d of SLIDE_DESIGNS) out.set(d.family, (out.get(d.family) ?? 0) + 1);
    return out;
  }, []);

  return (
    <div className="space-y-3" data-slide-designs="">
      <PanelHead
        title="Slide designs"
        subtitle="One click paints the whole slide: badges, title and its plate, question bullet and stem, options, markers and their plate, option rows, board background and frame."
        right={
          <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
            {SLIDE_DESIGN_COUNT} designs
          </span>
        }
      />

      {/* ---------------------------------------------- which one is painted */}
      <div
        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
        data-active-design={active?.id ?? ""}
      >
        <span className="min-w-0 text-[11px] text-slate-400">
          {active ? (
            <>
              In use: <b className="text-slate-100">{active.name}</b>
            </>
          ) : (
            <>
              <b className="text-slate-100">Custom look</b> — hand-tuned on top of a design
            </>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">{FAMILY_LABEL[active?.family ?? "classic"]}</span>
      </div>

      {/* ------------------------------------------------------- search + families */}
      <div className="space-y-2">
        <input
          type="search"
          value={query}
          aria-label="Search slide designs"
          placeholder="Search designs — neon, chalk, gold, paper…"
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-amber-400/60"
        />
        <div className="flex flex-wrap gap-1">
          <Chip on={family === "all"} onClick={() => setFamily("all")} label="All slide designs">
            All <span className="opacity-60">{SLIDE_DESIGN_COUNT}</span>
          </Chip>
          {DESIGN_FAMILIES.map((f) => (
            <Chip
              key={f.id}
              on={family === f.id}
              onClick={() => setFamily(f.id)}
              label={`Slide designs: ${f.label}`}
              title={f.hint}
            >
              {f.label} <span className="opacity-60">{counts.get(f.id) ?? 0}</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------- the gallery */}
      <div className="grid grid-cols-2 gap-2" data-design-grid="">
        {list.map((d) => {
          const on = active?.id === d.id;
          return (
            <button
              key={d.id}
              type="button"
              data-design={d.id}
              aria-pressed={on}
              title={`${d.name} — ${d.hint}`}
              onClick={() => apply(d)}
              style={{ contentVisibility: "auto", containIntrinsicSize: "140px" } as React.CSSProperties}
              className={cn(
                "group rounded-lg border p-1.5 text-left transition-colors",
                on
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-white/10 bg-white/[0.02] hover:border-amber-400/50 hover:bg-white/[0.05]",
              )}
            >
              <span className="block overflow-hidden rounded-md border border-black/40">
                <DesignThumb preset={d} />
              </span>
              <span className="mt-1.5 flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-200">{d.name}</span>
                {on ? (
                  <span className="shrink-0 rounded bg-amber-400 px-1 text-[8px] font-bold text-slate-950">IN USE</span>
                ) : null}
              </span>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="flex shrink-0">
                  {d.swatch.map((c, i) => (
                    <span
                      key={`${c}-${i}`}
                      className="-ml-1 h-2.5 w-2.5 rounded-full border border-black/40 first:ml-0"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="truncate text-[9px] text-slate-500">{FAMILY_LABEL[d.family]}</span>
              </span>
            </button>
          );
        })}
        {!list.length && (
          <p className="col-span-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-6 text-center text-[11px] text-slate-500">
            No design matches “{query}”. Try a colour, a material or a family — neon, chalk, gold, paper.
          </p>
        )}
      </div>

      {/* --------------------------------------------- what one design writes */}
      <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
          Every design combines
        </span>
        <div className="flex flex-wrap gap-1">
          {DESIGN_ASPECTS.map((a) => (
            <span
              key={a.id}
              data-design-aspect={a.id}
              title={`Writes: ${a.fields.join(", ")}`}
              className="rounded-md border border-amber-400/20 bg-amber-400/[0.07] px-1.5 py-0.5 text-[10px] text-amber-200/90"
            >
              {a.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          Designs paint the look only — where elements sit stays with <b>Layout</b>, and a photo you put on the slide
          background or in the frame is kept. Any part can still be fine-tuned in its own destination afterwards; the
          card stops reading “IN USE” as soon as one is.
        </p>
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  label,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        "rounded-md border px-1.5 py-1 text-[10px] transition-colors",
        on
          ? "border-amber-400 bg-amber-400 text-slate-950"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}
