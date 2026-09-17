import { useMemo, useState } from "react";
import type { SlideData, ThemeSettings } from "../lib/types";
import { answerSummary, formatAnswerKey } from "../lib/answerKey";
import { cn } from "../utils/cn";
import { Btn, PanelHead, SegButtons, Toggle } from "./ui";

/**
 * "Answer key" destination.
 *
 * One place for everything about the correct answers:
 *
 *   • mark the correct choice on the slide you are looking at (or clear it)
 *   • reveal / hide it — here, or across the whole deck
 *   • paste a whole key in any format (the paste dialog) and add answer copies
 *   • pick how a revealed answer is painted (glow / tick / fill)
 *   • see the deck's key at a glance, jump to a slide, copy or save it
 */
interface Props {
  slide?: SlideData;
  /** every slide in the deck, for the key overview */
  slides: SlideData[];
  theme: ThemeSettings;
  setTheme: (p: Partial<ThemeSettings>) => void;
  updateSlide: (id: string, p: Partial<SlideData>) => void;
  updateAll: (p: Partial<SlideData>) => void;
  /** opens the paste-answers dialog */
  onPasteAnswers: () => void;
  /** duplicate every question slide with its answer revealed (quiz videos) */
  onAnswerCopies: () => void;
  onJumpToSlide: (index: number) => void;
}

export default function AnswerKeyPanel({
  slide,
  slides,
  theme: T,
  setTheme,
  updateSlide,
  updateAll,
  onPasteAnswers,
  onAnswerCopies,
  onJumpToSlide,
}: Props) {
  const [note, setNote] = useState<string | null>(null);
  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 2800);
  };

  const stats = useMemo(() => answerSummary(slides), [slides]);
  const keyText = useMemo(() => formatAnswerKey(slides), [slides]);
  const index = slide ? slides.findIndex((s) => s.id === slide.id) : -1;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(keyText);
      flash("Answer key copied ✓");
    } catch {
      flash("Clipboard blocked — use “Save .txt” instead.");
    }
  };

  const saveKey = () => {
    try {
      const url = URL.createObjectURL(new Blob([keyText], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "answer-key.txt";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash("Saved answer-key.txt ✓");
    } catch {
      flash("Download is not available in this browser.");
    }
  };

  const nextMissing = () => {
    if (stats.firstMissing === null) flash("Every slide already has an answer ✓");
    else onJumpToSlide(stats.firstMissing);
  };

  if (!slide) return <p className="text-sm text-slate-500">No slide selected.</p>;

  return (
    <div className="space-y-4">
      <PanelHead
        title="Answer key"
        subtitle="Mark the correct choice, reveal it on the slide, and keep the whole deck's key in one place."
      />

      {/* ---------------------------- this slide ---------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">This slide</span>
          <span className="text-[10px] text-slate-500">
            Q {slide.number || index + 1} · {slide.options.length} option{slide.options.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid gap-1.5">
          {slide.options.map((opt, i) => {
            const correct = slide.answer === opt.key;
            return (
              <button
                key={`${opt.key}-${i}`}
                type="button"
                data-answer-option={opt.key}
                aria-pressed={correct}
                title={correct ? "Click to clear this answer" : "Mark this option as the correct answer"}
                onClick={() => updateSlide(slide.id, { answer: correct ? null : opt.key, showAnswer: correct ? false : slide.showAnswer })}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                  correct
                    ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    correct ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-white/20 text-slate-400",
                  )}
                >
                  {correct ? "✓" : opt.key.slice(0, 1)}
                </span>
                <span className="truncate">{opt.text || `Option ${i + 1}`}</span>
              </button>
            );
          })}
          {!slide.options.length && (
            <p className="text-[11px] text-slate-500">This slide has no options yet — paste questions first.</p>
          )}
        </div>

        <Toggle
          label="Reveal the answer on this slide"
          checked={slide.showAnswer}
          onChange={(v) => updateSlide(slide.id, { showAnswer: v })}
        />

        {stats.missing > 0 && (
          <button
            type="button"
            onClick={nextMissing}
            className="w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20"
          >
            {stats.missing} slide{stats.missing === 1 ? "" : "s"} without an answer — go to the first →
          </button>
        )}
      </div>

      {/* --------------------------- paste / reveal -------------------------- */}
      <div className="space-y-2">
        <Btn
          variant="primary"
          className="w-full"
          onClick={onPasteAnswers}
          title="Paste an answer key (1. ঘ 2. গ …) in any format and match it to your questions"
        >
          ✓ Paste answers…
        </Btn>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" onClick={() => updateAll({ showAnswer: true })} title="Reveal the correct answer on every slide">
            👁 Reveal all
          </Btn>
          <Btn size="sm" onClick={() => updateAll({ showAnswer: false })} title="Hide the correct answer on every slide">
            Hide all
          </Btn>
        </div>
        <Btn
          size="sm"
          variant="soft"
          className="w-full"
          onClick={onAnswerCopies}
          title="For quiz videos: duplicate every question slide with its answer revealed"
        >
          ⧉ Answer copy after every slide
        </Btn>
        <Btn
          size="sm"
          variant="danger"
          className="w-full"
          disabled={!stats.set}
          onClick={() => {
            updateAll({ answer: null, showAnswer: false });
            flash("Every answer cleared");
          }}
          title="Remove the marked answer from every slide"
        >
          ⌫ Clear every answer
        </Btn>
      </div>

      {/* --------------------------- answer style --------------------------- */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">How a revealed answer looks</span>
        <SegButtons
          value={T.answerStyle}
          options={[
            { value: "glow", label: "Glow" },
            { value: "tick", label: "Tick ✓" },
            { value: "fill", label: "Fill" },
          ]}
          onChange={(v) => setTheme({ answerStyle: v })}
        />
        <Toggle
          label="Keep marker colours on the revealed answer"
          checked={T.optionBulletCustomOnAnswer}
          onChange={(v) => setTheme({ optionBulletCustomOnAnswer: v })}
        />
      </div>

      {/* --------------------------- deck overview --------------------------- */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">Deck key</span>
          <span className={cn("text-[10px]", stats.missing ? "text-amber-300" : "text-emerald-300")}>
            {stats.set}/{stats.total} set
            {stats.revealed ? ` · ${stats.revealed} shown` : ""}
          </span>
        </div>

        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-white/5 bg-slate-900/50 p-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              data-key-row={s.id}
              onClick={() => onJumpToSlide(i)}
              title={`Go to slide ${i + 1}`}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[10px]",
                i === index ? "bg-amber-400/15 text-amber-100" : "text-slate-300 hover:bg-white/5",
              )}
            >
              <span className="w-5 shrink-0 font-mono text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {s.question.replace(/\$[^$]*\$/g, "math").slice(0, 34) || "Blank slide"}
              </span>
              <span className={cn("shrink-0 font-bold", s.answer ? "text-emerald-300" : "text-rose-300/70")}>
                {s.answer ?? "—"}
              </span>
            </button>
          ))}
          {!slides.length && <p className="px-2 py-3 text-center text-[10px] text-slate-600">No slides yet.</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Btn size="sm" onClick={copyKey} disabled={!stats.set} title="Copy the key as text (1. ঘ 2. গ …)">
            ⧉ Copy key
          </Btn>
          <Btn size="sm" onClick={saveKey} disabled={!stats.set} title="Download the key as a .txt file">
            ⤓ Save .txt
          </Btn>
          <Btn size="sm" variant="soft" onClick={nextMissing}>
            Next unanswered →
          </Btn>
        </div>

        {note && <p className="text-[10px] text-emerald-300">{note}</p>}
        <p className="text-[10px] leading-relaxed text-slate-500">
          The deck key can be pasted straight back into “Paste answers…”, so an exported key always round-trips.
        </p>
      </div>
    </div>
  );
}
