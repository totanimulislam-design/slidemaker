import { useEffect, useMemo, useRef, useState } from "react";
import { formatPageRange, isPptxFile, openDocument, parsePageRange, type OpenedPdf, type PdfPageRender } from "../lib/pdf";
import { Btn, Field, SegButtons, Toggle } from "./ui";
import ResizableDialog from "./ResizableDialog";
import { cn } from "../utils/cn";

/**
 * "Import slides" — pick which pages of an uploaded PDF or PowerPoint go where.
 * PPTX slides are rendered to pictures first (see lib/pptx.ts), after which a
 * slide and a PDF page are handled identically.
 *
 *  • Whole document or specific pages (click thumbnails, or type "1-3, 7").
 *  • As new slides: each page becomes its own slide in the stack, either as a
 *    full-bleed background (a clean page) or as a picture layer on a blank
 *    slide (so it can still be moved / cropped like any image).
 *  • Onto the current slide: the chosen pages are placed as picture layers.
 *  • Every rendered page is also saved to the Uploads library for reuse.
 */
export type PdfPlacement = "slides-background" | "slides-image" | "current-slide";

export interface PdfImportResult {
  placement: PdfPlacement;
  pages: { page: number; src: string; ratio: number }[];
  name: string;
}

interface Props {
  file: File | null;
  onClose: () => void;
  onImport: (res: PdfImportResult) => void | Promise<void>;
}

export default function PdfImportModal({ file, onClose, onImport }: Props) {
  const [doc, setDoc] = useState<OpenedPdf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("");
  const [placement, setPlacement] = useState<PdfPlacement>("slides-background");
  const [hiRes, setHiRes] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, PdfPageRender>>({});
  const lastClick = useRef<number | null>(null);

  // open the document when a file arrives
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setDoc(null);
    setError(null);
    setThumbs({});
    setSelected(new Set());
    setRangeText("");
    openDocument(file)
      .then((d) => {
        if (!alive) return void d.destroy();
        setDoc(d);
        const all = Array.from({ length: d.numPages }, (_, i) => i + 1);
        setSelected(new Set(all));
        setRangeText(formatPageRange(all));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not read that file."));
    return () => {
      alive = false;
    };
  }, [file]);

  useEffect(() => () => doc?.destroy(), [doc]);

  // render thumbnails progressively (first pages first)
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    (async () => {
      for (let n = 1; n <= doc.numPages; n++) {
        if (!alive) return;
        try {
          const t = await doc.thumbnail(n);
          if (alive) setThumbs((prev) => (prev[n] ? prev : { ...prev, [n]: t }));
        } catch {
          /* skip broken page */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [doc]);

  const pages = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const total = doc?.numPages ?? 0;
  const allSelected = total > 0 && pages.length === total;

  const setPages = (list: number[]) => {
    setSelected(new Set(list));
    setRangeText(formatPageRange(list));
  };

  const toggle = (n: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift && lastClick.current !== null) {
      const [a, b] = [Math.min(lastClick.current, n), Math.max(lastClick.current, n)];
      const on = !selected.has(n);
      for (let i = a; i <= b; i++) on ? next.add(i) : next.delete(i);
    } else if (next.has(n)) next.delete(n);
    else next.add(n);
    lastClick.current = n;
    setPages([...next]);
  };

  const run = async () => {
    if (!doc || !pages.length) return;
    const out: PdfImportResult["pages"] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Rendering ${isPptxFile(file!) ? "slide" : "page"} ${pages[i]} (${i + 1}/${pages.length})…`);
        const r = await doc.render(pages[i], hiRes ? 2200 : 1400);
        out.push({ page: pages[i], src: r.src, ratio: r.ratio });
      }
      setBusy("Adding to deck…");
      await onImport({ placement, pages: out, name: doc.name });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  };

  if (!file) return null;

  const pptx = isPptxFile(file);
  const unit = pptx ? "slide" : "page";
  const Unit = pptx ? "Slide" : "Page";

  const placementHint: Record<PdfPlacement, string> = {
    "slides-background": `Each ${unit} becomes a new slide with the ${unit} as its background — a clean, full-bleed copy.`,
    "slides-image": `Each ${unit} becomes a new blank slide with the ${unit} placed as a picture you can move, crop and resize.`,
    "current-slide": `The chosen ${unit}s are placed as pictures on the slide you are editing now.`,
  };

  return (
    <ResizableDialog
      storageKey="pdf-import"
      initial={{ w: 1040, h: 700 }}
      min={{ w: 640, h: 460 }}
      title={pptx ? "Import PowerPoint" : "Import PDF"}
      subtitle={`${file.name}${total ? ` · ${total} ${unit}${total === 1 ? "" : "s"}` : ""}`}
      onClose={() => !busy && onClose()}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {busy ? (
              <span className="animate-pulse text-sky-300">{busy}</span>
            ) : (
              <>
                <b className="text-slate-200">{pages.length}</b> of {total} {unit}{total === 1 ? "" : "s"} selected
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Btn onClick={onClose} disabled={!!busy}>
              Cancel
            </Btn>
            <Btn variant="primary" disabled={!doc || !pages.length || !!busy} onClick={() => void run()}>
              {placement === "current-slide"
                ? `Add ${pages.length} ${unit}${pages.length === 1 ? "" : "s"} to this slide`
                : `Add ${pages.length} slide${pages.length === 1 ? "" : "s"}`}
            </Btn>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        {/* ------------------------------ options ----------------------------- */}
        <div className="w-full shrink-0 space-y-3 overflow-y-auto md:w-72">
          <Field label={`Which ${unit}s`} as="div">
            <SegButtons
              value={allSelected ? "all" : "some"}
              onChange={(v) => {
                if (v === "all") setPages(Array.from({ length: total }, (_, i) => i + 1));
                else setPages([]);
              }}
              options={[
                { value: "all", label: pptx ? "Whole deck" : "Whole PDF" },
                { value: "some", label: `Specific ${unit}s` },
              ]}
            />
          </Field>

          <Field label={`${Unit} numbers`} hint={`1 – ${total || "?"}`}>
            <input
              value={rangeText}
              onChange={(e) => {
                setRangeText(e.target.value);
                setSelected(new Set(parsePageRange(e.target.value, total)));
              }}
              placeholder="e.g. 1-3, 7, 10-12"
              className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <Btn size="sm" onClick={() => setPages(Array.from({ length: total }, (_, i) => i + 1))}>
              Select all
            </Btn>
            <Btn size="sm" onClick={() => setPages([])}>
              None
            </Btn>
            <Btn
              size="sm"
              onClick={() => setPages(Array.from({ length: total }, (_, i) => i + 1).filter((n) => !selected.has(n)))}
            >
              Invert
            </Btn>
          </div>

          <Field label={`Add ${unit}s as`} as="div">
            <div className="space-y-1">
              {(
                [
                  ["slides-background", `New slides · ${unit} as background`],
                  ["slides-image", `New slides · ${unit} as picture`],
                  ["current-slide", "Pictures on the current slide"],
                ] as [PdfPlacement, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPlacement(v)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    placement === v
                      ? "border-amber-400 bg-amber-400/15 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full border",
                      placement === v ? "border-amber-400 bg-amber-400" : "border-white/30",
                    )}
                  />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-slate-500">{placementHint[placement]}</p>
          </Field>

          <Toggle label={`High-resolution ${unit}s (sharper, larger file)`} checked={hiRes} onChange={setHiRes} />

          <p className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-200">
            Every imported {unit} is also saved to <b>Uploads</b>, so you can drop it onto any slide later.
            {pptx && (
              <>
                {" "}
                PowerPoint slides come in as <b>pictures</b> (a visual snapshot) — text on them is not editable here.
              </>
            )}
          </p>
        </div>

        {/* ------------------------------ page grid --------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
          {error ? (
            <div className="flex h-full items-center justify-center text-sm text-rose-300">{error}</div>
          ) : !doc ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400 animate-pulse">Opening {pptx ? "PowerPoint" : "PDF"}…</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
                const on = selected.has(n);
                const t = thumbs[n];
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={(e) => toggle(n, e.shiftKey)}
                    title={`Page ${n} · click to ${on ? "deselect" : "select"} · Shift+click for a range`}
                    className={cn(
                      "group relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors",
                      on ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/30",
                    )}
                  >
                    <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded bg-white/90">
                      {t ? (
                        <img src={t.src} alt={`Page ${n}`} className="max-h-full max-w-full object-contain" draggable={false} />
                      ) : (
                        <span className="text-[10px] text-slate-500 animate-pulse">…</span>
                      )}
                    </div>
                    <span className={cn("text-[11px] font-medium", on ? "text-amber-200" : "text-slate-400")}>Page {n}</span>
                    <span
                      className={cn(
                        "absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold",
                        on ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/40 bg-black/50 text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ResizableDialog>
  );
}
