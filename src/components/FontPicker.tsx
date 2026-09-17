import { useEffect, useMemo, useRef, useState } from "react";
import {
  FONT_BY_FAMILY,
  FONT_GROUPS,
  FONT_LIBRARY,
  type FontChoice,
  type FontChoice as FC,
  type FontGroupId,
  type FontScript,
  fontGroupId,
  previewStack,
  sortGroupFonts,
} from "../lib/fonts";
import { addCustomFontFile, customFontChoices, listCustomFonts, onCustomFontsChanged, removeCustomFont, type CustomFont } from "../lib/customFonts";
import { cn } from "../utils/cn";
import { useFontPreview } from "../lib/fontPreview";
import { ensureFontStylesheet, preloadFontLibrary } from "../lib/fonts";

interface Props {
  /** current value: a font-family stack (legacy) or a single family */
  value: string;
  onChange: (family: string) => void;
  label: string;
  /** one script, or `"all"` for every script filed under language groups */
  script: FontScript | "all";
  /** restrict to a subset of kinds */
  kinds?: FontChoice["kind"][];
  /** compact height (used in the inspector) */
  compact?: boolean;
  /** file the list under language headings (on by default when script is "all") */
  grouped?: boolean;
  /** target identifier for live hover preview, e.g. "box:question", "deck:bengali", "shape:xxx" */
  previewTarget?: string;
}

/** one heading + its faces inside the dropdown (`flat` = the un-grouped list) */
interface Section {
  id: FontGroupId | "saved" | "flat";
  label: string;
  fonts: FontChoice[];
}

const KIND_LABEL: Record<FC["kind"], string> = {
  display: "Display",
  sans: "Sans",
  serif: "Serif",
  hand: "Handwriting",
  mono: "Mono",
  traditional: "Traditional",
};

export default function FontPicker({ value, onChange, label, script, kinds, compact, grouped, previewTarget }: Props) {
  const current = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [custom, setCustom] = useState<CustomFont[]>(() => listCustomFonts());
  useEffect(() => onCustomFontsChanged(setCustom), []);

  const all = script === "all";
  const showGroups = grouped ?? all;

  const { setPreview, clearPreview } = useFontPreview();

  // clear live preview when dropdown closes
  useEffect(() => {
    if (!open) clearPreview();
  }, [open, clearPreview]);

  /** every face the dropdown offers, in the order it will be shown */
  const sections = useMemo<Section[]>(() => {
    const hit = (f: FontChoice) => !query || f.label.toLowerCase().includes(query.toLowerCase());
    const mine = customFontChoices(all ? undefined : script).filter(hit);
    const taken = new Set(mine.map((f) => f.family.toLowerCase()));
    const builtIn = FONT_LIBRARY.filter(
      (f) =>
        (all || f.script === script) &&
        (!kinds || kinds.includes(f.kind)) &&
        !taken.has(f.family.toLowerCase()) &&
        hit(f),
    );

    if (!showGroups) return [{ id: "flat", label: "", fonts: [...mine, ...builtIn] }];

    const fonts = [...mine, ...builtIn];
    const out: Section[] = [];
    // a face saved on an older deck stays reachable even if it left the library
    const known = fonts.some((f) => f.family.toLowerCase() === current.toLowerCase());
    const saved: FontChoice | null =
      current && !known
        ? {
            family: current,
            label: current,
            script: FONT_BY_FAMILY.get(current.toLowerCase())?.script ?? "bangla",
            kind: "sans",
            sample: "Aa বাংলا العربية",
            weights: "400;500;600;700;800",
          }
        : null;
    if (saved && hit(saved)) out.push({ id: "saved", label: "Saved font", fonts: [saved] });
    for (const g of FONT_GROUPS) {
      const inGroup = fonts.filter((f) => fontGroupId(f) === g.id);
      if (inGroup.length) out.push({ id: g.id, label: g.label, fonts: sortGroupFonts(inGroup, g.id) });
    }
    return out;
  }, [all, script, kinds, query, custom, showGroups, current]);

  const list = sections.flatMap((s) => s.fonts);
  const chosen = FONT_LIBRARY.find((f) => f.family === current);

  // the list is long once every script is included, so reveal the picked face
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const active = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    clearPreview();
  };

  const handleHover = (family: string) => {
    if (!previewTarget) return;
    setPreview(previewTarget, family);
  };

  return (
    <div className="space-y-1.5">
      <span className="flex items-baseline justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {open && (
          <button onClick={handleClose} className="text-[10px] normal-case text-slate-500 hover:text-slate-300">
            close
          </button>
        )}
      </span>

      {/* trigger */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) preloadFontLibrary();
          else clearPreview();
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-slate-900/70 px-2.5 py-2 text-left transition-colors",
          open ? "border-amber-400/60" : "border-white/10 hover:border-white/25",
        )}
      >
        <span
          className="min-w-0 flex-1 truncate text-slate-100"
          style={{
            fontFamily: chosen ? previewStack(chosen) : `'${current}', sans-serif`,
            fontSize: compact ? 15 : 17,
            lineHeight: 1.2,
          }}
        >
          {chosen ? chosen.sample : current || "Default"}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">{chosen ? KIND_LABEL[chosen.kind] : "—"}</span>
        <span className="shrink-0 text-[10px] text-slate-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="space-y-2 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl"
          onMouseLeave={() => clearPreview()}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${list.length} fonts…`}
            className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
          />
          <div ref={scrollRef} className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/40 p-1">
            {sections.map((s) => (
              <div key={s.id} className="pt-1 first:pt-0">
                {s.label && (
                  <div className="sticky top-0 z-10 -mx-1 mb-0.5 rounded bg-slate-900/95 px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase backdrop-blur-sm">
                    {s.label}
                  </div>
                )}
                {s.fonts.map((f) => (
                  <FontRow
                    key={f.family}
                    f={f}
                    active={f.family === current}
                    previewTarget={previewTarget}
                    onHover={handleHover}
                    onPick={() => {
                      onChange(f.family);
                      setOpen(false);
                      clearPreview();
                    }}
                    onRemove={
                      f.custom
                        ? () => {
                            removeCustomFont(f.family);
                            if (current === f.family) onChange("");
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
            {!list.length && <p className="p-3 text-center text-xs text-slate-600">No fonts match “{query}”.</p>}
          </div>

          {/* upload your own font file (Chhatrish July, SolaimanLipi, Charukola…) */}
          <UploadRow
            script={script === "all" ? (FONT_BY_FAMILY.get(current.toLowerCase())?.script ?? "bangla") : script}
            onAdded={(family) => {
              onChange(family);
            }}
          />
          <p className="px-1 text-[10px] leading-relaxed text-slate-500">
            Hover a font to preview it live on the slide. Previews load on open. Any text still falls back through the
            universal chain, so mixed Bangla/Arabic/Latin always renders.
          </p>
        </div>
      )}
    </div>
  );
}

function UploadRow({ script, onAdded }: { script: NonNullable<FontChoice["script"]>; onAdded: (family: string) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1 border-t border-white/10 pt-1.5">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-amber-400/40 bg-amber-400/[0.06] px-2 py-1.5 text-[11px] text-amber-200 hover:bg-amber-400/15">
        <span className="text-base leading-none">⬆</span>
        <span className="min-w-0 flex-1">
          {busy ? "Loading font…" : <>Upload a font file <span className="text-amber-400/70">(.ttf .otf .woff2)</span></>}
        </span>
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff2"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setErr(null);
            setBusy(true);
            try {
              const font = await addCustomFontFile(file, script);
              onAdded(font.family);
            } catch (ex) {
              setErr(
                ex instanceof Error && ex.message === "storage-full"
                  ? "Not enough browser storage — remove another custom font."
                  : "That file could not be loaded as a font.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {err && <p className="px-1 text-[10px] text-rose-300">{err}</p>}
      <p className="px-1 text-[10px] leading-relaxed text-slate-500">
        Add faces that can't be bundled (Chhatrish July, SolaimanLipi, Charukola…). They stay on this device and work
        everywhere a font can be picked.
      </p>
    </div>
  );
}

function FontRow({
  f,
  active,
  onPick,
  onRemove,
  previewTarget,
  onHover,
}: {
  f: FontChoice;
  active: boolean;
  onPick: () => void;
  onRemove?: () => void;
  previewTarget?: string;
  onHover?: (family: string) => void;
}) {
  // mount the stylesheet for this row lazily so the list stays light
  const [seen, setSeen] = useState(false);

  const handleEnter = () => {
    if (!seen) {
      ensureFontStylesheet([f]);
      setSeen(true);
    }
    if (previewTarget) onHover?.(f.family);
  };

  return (
    <button
      onMouseEnter={handleEnter}
      onFocus={handleEnter}
      onClick={onPick}
      data-active={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "hover:bg-white/5",
      )}
    >
      <span
        className="min-w-0 flex-1 truncate text-[15px] leading-tight text-slate-100"
        style={{ fontFamily: previewStack(f) }}
      >
        {f.sample}
      </span>
      <span className="w-24 shrink-0 truncate text-[10px] text-slate-500">
        {f.custom ? "⬆ " : ""}{f.label}
      </span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Remove ${f.label}`}
          className="shrink-0 rounded px-1 text-[10px] text-slate-600 hover:bg-rose-500/15 hover:text-rose-300"
        >
          ✕
        </span>
      )}
      <span
        className={cn(
          "shrink-0 rounded px-1 py-0.5 text-[9px]",
          f.script === "bangla" ? "bg-emerald-400/15 text-emerald-300"
          : f.script === "arabic" ? "bg-sky-400/15 text-sky-300"
          : fontGroupId(f) === "multi" ? "bg-violet-400/15 text-violet-300"
          : "bg-white/10 text-slate-400",
        )}
      >
        {KIND_LABEL[f.kind]}
      </span>
    </button>
  );
}
