import { useState } from "react";
import type { Deck } from "../lib/types";
import { Btn, Field, SegButtons, TextInput } from "./ui";
import { cn } from "../utils/cn";

export type ExportFormat = "pdf" | "png" | "zip";

export interface ExportSettings {
  format: ExportFormat;
  scope: "all" | "current";
  quality: number;
  fileName: string;
}

export const DEFAULT_EXPORT: ExportSettings = {
  format: "pdf",
  scope: "all",
  quality: 2,
  fileName: "mcq-slides",
};

const CARDS: { value: ExportFormat; icon: string; title: string; blurb: string }[] = [
  { value: "pdf", icon: "📄", title: "PDF", blurb: "One 16:9 page per slide, print-ready" },
  { value: "png", icon: "🖼", title: "PNG", blurb: "Current slide as a single image" },
  { value: "zip", icon: "🗂", title: "PNG ZIP", blurb: "Every slide as a numbered image" },
];

interface Props {
  open: boolean;
  deck: Deck;
  busy: string | null;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
}

export default function ExportModal({ open, deck, busy, onClose, onExport }: Props) {
  const [s, setS] = useState<ExportSettings>(DEFAULT_EXPORT);
  if (!open) return null;

  const set = <K extends keyof ExportSettings>(k: K, v: ExportSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const count = s.scope === "all" ? deck.slides.length : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Export deck</h2>
            <p className="text-xs text-slate-500">{deck.slides.length} slides ready</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {CARDS.map((c) => (
              <button
                key={c.value}
                onClick={() => set("format", c.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  s.format === c.value
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <span className="text-lg">{c.icon}</span>
                  {c.title}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.blurb}</p>
              </button>
            ))}
          </div>

          <Field label="File name">
            <div className="flex items-center gap-2">
              <TextInput value={s.fileName} onChange={(e) => set("fileName", e.target.value)} />
              <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-2 font-mono text-xs text-slate-400">
                .{s.format === "zip" ? "zip" : s.format}
              </span>
            </div>
          </Field>

          {(s.format === "pdf" || s.format === "zip" || s.format === "png") && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <Field label="Resolution">
                <SegButtons
                  value={String(s.quality)}
                  onChange={(v) => set("quality", Number(v))}
                  options={[
                    { value: "1", label: "1× (1280px)" },
                    { value: "2", label: "2× (2560px)" },
                    { value: "3", label: "3× (3840px)" },
                  ]}
                />
              </Field>
              {s.format === "pdf" && (
                <p className="text-[11px] text-slate-500">
                  Each slide becomes one 16:9 page. Bangla shaping and equations are rendered exactly as you see
                  them in the editor.
                </p>
              )}
            </div>
          )}

          {s.format === "png" && (
            <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              Only the slide currently open in the editor will be saved.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <span className="text-xs text-slate-500">{busy ?? `${count} slide${count === 1 ? "" : "s"}`}</span>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!!busy || !deck.slides.length} onClick={() => onExport(s)}>
              {busy ? "Working…" : "Export"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
