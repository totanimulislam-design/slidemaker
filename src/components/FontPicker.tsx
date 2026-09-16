import { useEffect, useMemo, useState } from "react";
import { FONT_LIBRARY, type FontChoice, type FontChoice as FC } from "../lib/fonts";
import { addCustomFontFile, customFontChoices, listCustomFonts, onCustomFontsChanged, removeCustomFont, type CustomFont } from "../lib/customFonts";
import { cn } from "../utils/cn";

interface Props {
  /** current value: a font-family stack (legacy) or a single family */
  value: string;
  onChange: (family: string) => void;
  label: string;
  script: FontChoice["script"];
  /** restrict to a subset of kinds */
  kinds?: FontChoice["kind"][];
  /** compact height (used in the inspector) */
  compact?: boolean;
}

const KIND_LABEL: Record<FC["kind"], string> = {
  display: "Display",
  sans: "Sans",
  serif: "Serif",
  hand: "Handwriting",
  mono: "Mono",
  traditional: "Traditional",
};

import { ensureFontStylesheet, preloadFontLibrary } from "../lib/fonts";

export default function FontPicker({ value, onChange, label, script, kinds, compact }: Props) {
  const current = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [custom, setCustom] = useState<CustomFont[]>(() => listCustomFonts());
  useEffect(() => onCustomFontsChanged(setCustom), []);

  const list = useMemo(() => {
    const mine = customFontChoices(script).filter(
      (f) => !query || f.label.toLowerCase().includes(query.toLowerCase()),
    );
    const builtIn = FONT_LIBRARY.filter(
      (f) =>
        f.script === script &&
        (!kinds || kinds.includes(f.kind)) &&
        (!query || f.label.toLowerCase().includes(query.toLowerCase())),
    );
    return [...mine, ...builtIn];
  }, [script, kinds, query, custom]);

  const chosen = FONT_LIBRARY.find((f) => f.family === current);

  return (
    <div className="space-y-1.5">
      <span className="flex items-baseline justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {open && (
          <button onClick={() => setOpen(false)} className="text-[10px] normal-case text-slate-500 hover:text-slate-300">
            close
          </button>
        )}
      </span>

      {/* trigger */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) preloadFontLibrary();
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-slate-900/70 px-2.5 py-2 text-left transition-colors",
          open ? "border-amber-400/60" : "border-white/10 hover:border-white/25",
        )}
      >
        <span
          className="min-w-0 flex-1 truncate text-slate-100"
          style={{ fontFamily: `'${current}', sans-serif`, fontSize: compact ? 15 : 17, lineHeight: 1.2 }}
        >
          {chosen ? chosen.sample : current || "Default"}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">{chosen ? KIND_LABEL[chosen.kind] : "—"}</span>
        <span className="shrink-0 text-[10px] text-slate-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${list.length} fonts…`}
            className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
          />
          <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/40 p-1">
            {list.map((f) => (
              <FontRow
                key={f.family}
                f={f}
                active={f.family === current}
                onPick={() => { onChange(f.family); setOpen(false); }}
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
            {!list.length && <p className="p-3 text-center text-xs text-slate-600">No fonts match “{query}”.</p>}
          </div>

          {/* upload your own font file (Chhatrish July, SolaimanLipi, Charukola…) */}
          <UploadRow script={script} onAdded={(family) => { onChange(family); }} />
          <p className="px-1 text-[10px] leading-relaxed text-slate-500">
            Previews load on open. Any text still falls back through the universal chain, so mixed Bangla/Arabic/Latin
            always renders.
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
              setErr(ex instanceof Error && ex.message === "storage-full"
                ? "Not enough browser storage — remove another custom font."
                : "That file could not be loaded as a font.");
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
}: { f: FontChoice; active: boolean; onPick: () => void; onRemove?: () => void }) {
  // mount the stylesheet for this row lazily so the list stays light
  const [seen, setSeen] = useState(false);
  const ref = useMemo(
    () => ({
      onMouseEnter: () => {
        if (!seen) {
          ensureFontStylesheet([f]);
          setSeen(true);
        }
      },
    }),
    [f, seen],
  );

  return (
    <button
      {...ref}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "hover:bg-white/5",
      )}
    >
      <span
        className="min-w-0 flex-1 truncate text-[15px] leading-tight text-slate-100"
        style={{ fontFamily: `'${f.family}', ${f.script === "arabic" ? "'Noto Naskh Arabic'" : "'Noto Sans Bengali'"}, sans-serif` }}
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
          : "bg-white/10 text-slate-400",
        )}
      >
        {KIND_LABEL[f.kind]}
      </span>
    </button>
  );
}
