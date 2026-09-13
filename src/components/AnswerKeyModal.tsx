import { useMemo, useState } from "react";
import { mapAnswers, parseAnswerKey, type AnswerMapping } from "../lib/answerKey";
import type { SlideData } from "../lib/types";
import { Btn, SegButtons, TextArea, Toggle } from "./ui";
import ResizableDialog, { SplitPane } from "./ResizableDialog";
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  slides: SlideData[];
  currentIndex: number;
  onClose: () => void;
  onApply: (updates: { slideId: string; answer: string }[], reveal: boolean) => void;
}

const STATUS: Record<AnswerMapping["status"], { label: string; cls: string }> = {
  ok: { label: "set", cls: "text-emerald-300" },
  changed: { label: "replaces", cls: "text-amber-300" },
  same: { label: "already", cls: "text-slate-500" },
  "no-match": { label: "no such option", cls: "text-rose-300" },
  "no-slide": { label: "no such slide", cls: "text-rose-300" },
};

export default function AnswerKeyModal({ open, slides, currentIndex, onClose, onApply }: Props) {
  const [text, setText] = useState("");
  const [startMode, setStartMode] = useState<"first" | "current">("first");
  const [overwrite, setOverwrite] = useState(true);
  const [reveal, setReveal] = useState(false);

  const pairs = useMemo(() => parseAnswerKey(text), [text]);
  const isBare = pairs.length > 0 && pairs.every((p) => p.number === null);
  const mapping = useMemo(
    () => mapAnswers(slides, pairs, startMode === "current" ? currentIndex : 0),
    [slides, pairs, startMode, currentIndex],
  );

  if (!open) return null;

  const applicable = mapping.filter(
    (m) => m.resolved && (m.status === "ok" || (m.status === "changed" && overwrite)),
  );
  const counts = {
    set: mapping.filter((m) => m.status === "ok").length,
    changed: mapping.filter((m) => m.status === "changed").length,
    same: mapping.filter((m) => m.status === "same").length,
    bad: mapping.filter((m) => m.status === "no-match" || m.status === "no-slide").length,
  };
  const missing = slides.filter((s) => !s.answer && !applicable.some((a) => a.slideId === s.id)).length;

  const leftPane = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pr-1">
          {/* ------------------------------ input ------------------------------ */}
          
            <TextArea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`1. ঘ  2. গ  3. b  4. a\n\nor one per line:\n১) ঘ\n২) গ\n\nor a table from Excel / Word:\n1 | ঘ\n2 | গ\n\nor just the sequence:\nঘ গ খ ক ঘ\n\nor text answers:\n1. Dhaka\n2. পদ্মা`}
              className="min-h-0 flex-1 resize-none font-mono text-[13px]"
            />

            {isBare && (
              <div className="space-y-1.5 rounded-xl border border-sky-400/25 bg-sky-400/10 p-3">
                <p className="text-xs text-sky-200">
                  No question numbers found — the {pairs.length} answers will be applied in order.
                </p>
                <SegButtons
                  value={startMode}
                  onChange={setStartMode}
                  options={[
                    { value: "first", label: "Start at slide 1" },
                    { value: "current", label: `Start at current (#${currentIndex + 1})` },
                  ]}
                />
              </div>
            )}

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Toggle label="Overwrite answers that are already set" checked={overwrite} onChange={setOverwrite} />
              <Toggle label="Also reveal the answer on those slides" checked={reveal} onChange={setReveal} />
            </div>

            <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-300">Accepted formats</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  <code>1. ঘ</code> · <code>১) ঘ</code> · <code>1-ঘ</code> · <code>Q1: d</code> · <code>১ নং – ঘ</code> ·{" "}
                  <code>1 | ঘ</code>
                </li>
                <li>Bangla, English (a–e / A–E), Arabic (أ ب ج د) or numeric (1–5) keys — mixed is fine.</li>
                <li>Keys are converted across families: <code>d</code> becomes <code>ঘ</code> on a ক/খ/গ/ঘ slide.</li>
                <li>A bare sequence like <code>ঘ গ খ ক</code> or <code>dcba</code> is applied in order.</li>
                <li>Text answers (<code>2. পদ্মা</code>) match the option with that text.</li>
                <li>If a number repeats, the last one wins (handy for corrections).</li>
              </ul>
            </details>
    </div>
  );

  const rightPane = (
    <div className="flex min-h-0 flex-1 flex-col p-4 pl-1">
          <div className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5 text-xs">
              <span className="text-sm font-medium text-slate-200">
                {pairs.length} answer{pairs.length === 1 ? "" : "s"} found
              </span>
              {counts.set > 0 && <span className="text-emerald-300">● {counts.set} new</span>}
              {counts.changed > 0 && <span className="text-amber-300">● {counts.changed} change</span>}
              {counts.same > 0 && <span className="text-slate-500">● {counts.same} unchanged</span>}
              {counts.bad > 0 && <span className="text-rose-300">● {counts.bad} problem</span>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {mapping.length === 0 && (
                <p className="p-4 text-sm text-slate-600">
                  {text.trim() ? "Nothing recognisable yet — see accepted formats." : "Preview appears here…"}
                </p>
              )}
              {mapping.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-[10px] tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-2 py-1 text-left">Q</th>
                      <th className="px-2 py-1 text-left">Pasted</th>
                      <th className="px-2 py-1 text-left">→ Option</th>
                      <th className="px-2 py-1 text-left">Question</th>
                      <th className="px-2 py-1 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.map((m, i) => {
                      const slide = slides[m.slideIndex];
                      const opt = slide?.options.find((o) => o.key === m.resolved);
                      const st = STATUS[m.status];
                      const skipped = m.status === "changed" && !overwrite;
                      return (
                        <tr key={i} className={cn("border-t border-white/5", skipped && "opacity-40")}>
                          <td className="px-2 py-1.5 font-mono text-amber-300">{m.number}</td>
                          <td className="px-2 py-1.5 text-slate-300">{m.pair.key || <em>{m.pair.text}</em>}</td>
                          <td className="px-2 py-1.5">
                            {m.resolved ? (
                              <span className="text-slate-100">
                                <b className="text-emerald-300">{m.resolved}</b>
                                {opt?.text ? <span className="text-slate-400"> ) {opt.text.slice(0, 22)}</span> : null}
                              </span>
                            ) : (
                              <span className="text-rose-400">—</span>
                            )}
                            {m.status === "changed" && m.previous && (
                              <span className="ml-1 text-[10px] text-slate-500 line-through">{m.previous}</span>
                            )}
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-1.5 text-slate-500">
                            {slide ? slide.question.replace(/\$[^$]*\$/g, "▫").slice(0, 40) : "—"}
                          </td>
                          <td className={cn("px-2 py-1.5 text-right", st.cls)}>{skipped ? "kept" : st.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {mapping.length > 0 && missing > 0 && (
              <div className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
                {missing} slide{missing === 1 ? "" : "s"} will still have no answer after applying.
              </div>
            )}
          </div>
    </div>
  );

  return (
    <ResizableDialog
      storageKey="paste-answers"
      initial={{ w: 1100, h: 700 }}
      min={{ w: 620, h: 440 }}
      title="Paste answers"
      subtitle="Paste an answer key in any format — matched to your questions by number. Drag the edges or divider to resize."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {applicable.length} slide{applicable.length === 1 ? "" : "s"} will be updated
          </span>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!applicable.length}
              onClick={() => {
                onApply(
                  applicable.map((m) => ({ slideId: m.slideId, answer: m.resolved! })),
                  reveal,
                );
                setText("");
                onClose();
              }}
            >
              Apply {applicable.length || ""} answer{applicable.length === 1 ? "" : "s"}
            </Btn>
          </div>
        </div>
      }
    >
      <SplitPane storageKey="paste-answers" left={leftPane} right={rightPane} initial={0.45} />
    </ResizableDialog>
  );
}
