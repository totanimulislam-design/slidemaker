import { useMemo, useRef, useState } from "react";
import { parseQuestions, splitAnswerKeyBlock } from "../lib/parse";
import { mapAnswers, parseAnswerKey } from "../lib/answerKey";
import { handleSmartPaste, normalizeSource } from "../lib/richPaste";
import { reflowLayout } from "../lib/reflow";
import { MULTILINGUAL_SAMPLE, SAMPLE_INPUT, type SlideData } from "../lib/types";
import MathText from "./MathText";
import { Btn, SegButtons, TextArea, Toggle } from "./ui";
import ResizableDialog, { SplitPane } from "./ResizableDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (slides: SlideData[], mode: "append" | "replace") => void;
  existingCount: number;
}

export default function PasteModal({ open, onClose, onImport, existingCount }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("replace");
  const [smart, setSmart] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const [fontSize, setFontSize] = useState<number>(() => Number(localStorage.getItem("paste:font") ?? 13));
  const [wrap, setWrap] = useState<boolean>(() => localStorage.getItem("paste:wrap") !== "0");
  const ref = useRef<HTMLTextAreaElement>(null);
  const bumpFont = (d: number) => {
    const v = Math.max(10, Math.min(24, fontSize + d));
    setFontSize(v);
    localStorage.setItem("paste:font", String(v));
  };
  const lineCount = text ? text.split("\n").length : 0;

  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    const { questions, answerKey } = splitAnswerKeyBlock(text);
    const slides = parseQuestions(questions);
    if (!answerKey) return slides;
    // a trailing "উত্তরমালা: ১.ঘ ২.গ …" block fills in the answers
    const mapping = mapAnswers(slides, parseAnswerKey(answerKey));
    const byId = new Map(mapping.filter((m) => m.resolved).map((m) => [m.slideId, m.resolved!]));
    return slides.map((s) => (byId.has(s.id) ? { ...s, answer: byId.get(s.id)! } : s));
  }, [text]);
  const keyDetected = useMemo(() => !!text.trim() && !!splitAnswerKeyBlock(text).answerKey, [text]);

  /** true when questions/options are still glued together on one line */
  const glued = useMemo(() => {
    if (!text.trim()) return null;
    const r = reflowLayout(text);
    return r.text !== text && r.questions + r.options > 0 ? r : null;
  }, [text]);

  if (!open) return null;

  const readFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      const res = smart ? normalizeSource(raw) : { text: raw, notes: [] };
      setText(res.text);
      setNotes(res.notes);
    };
    reader.readAsText(file);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!smart) return;
    const res = handleSmartPaste(e);
    if (!res) return;
    setText(res.value);
    setNotes(res.notes);
    window.setTimeout(() => ref.current?.setSelectionRange(res.caret, res.caret), 0);
  };

  const reformat = () => {
    const res = normalizeSource(text);
    setText(res.text);
    setNotes(res.notes.length ? res.notes : ["already clean"]);
  };

  const leftPane = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pr-1">
      {/* text-area toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Questions</span>
        <span className="text-[10px] text-slate-600">
          {lineCount} line{lineCount === 1 ? "" : "s"} · {text.length} chars
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => bumpFont(-1)} title="Smaller text" className="rounded border border-white/10 px-1.5 py-0.5 text-slate-300 hover:bg-white/10">
            A−
          </button>
          <span className="w-7 text-center font-mono text-[10px] text-slate-500">{fontSize}</span>
          <button onClick={() => bumpFont(1)} title="Larger text" className="rounded border border-white/10 px-1.5 py-0.5 text-slate-300 hover:bg-white/10">
            A+
          </button>
          <button
            onClick={() => {
              setWrap((w) => {
                localStorage.setItem("paste:wrap", w ? "0" : "1");
                return !w;
              });
            }}
            title="Toggle line wrapping"
            className={`rounded border px-1.5 py-0.5 ${wrap ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-300"} hover:bg-white/10`}
          >
            ⏎ wrap
          </button>
        </div>
      </div>

      <TextArea
        ref={ref}
        autoFocus
        value={text}
        onPaste={onPaste}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste straight from Word, Google Docs, a PDF, ChatGPT or a website — glued lines are fine.\n\n1. $P(x,y) = 7x^5 + 5x^4y^4 + y^6$ বহুপদীর মাত্রা কত?\nক) 5\nখ) 6\nগ) 7\nঘ) 8\nউত্তর: ঘ`}
        className="min-h-0 flex-1 resize-none font-mono"
        style={{ fontSize, whiteSpace: wrap ? "pre-wrap" : "pre", overflowWrap: wrap ? "anywhere" : "normal", lineHeight: 1.55 }}
        spellCheck={false}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          size="sm"
          variant="soft"
          onClick={reformat}
          disabled={!text.trim()}
          title="Split glued questions onto their own lines and convert x², ½, √, ≤ … into LaTeX"
        >
          ✨ Fix formatting &amp; split lines
        </Btn>
        <Btn size="sm" onClick={() => setText(SAMPLE_INPUT)}>
          Load sample
        </Btn>
        <Btn
          size="sm"
          onClick={() => setText(MULTILINGUAL_SAMPLE)}
          title="Arabic, Hindi, CJK, Greek, symbols and emoji in one deck"
        >
          🌐 Multilingual sample
        </Btn>
        <label className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10">
          Upload .txt
          <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
        <Btn
          size="sm"
          variant="danger"
          onClick={() => {
            setText("");
            setNotes([]);
          }}
        >
          Clear
        </Btn>
      </div>

      <div className="space-y-1.5">
        <Toggle label="Smart paste — keep formatting &amp; rebuild line breaks" checked={smart} onChange={setSmart} />
        {glued && (
          <button
            onClick={reformat}
            className="flex w-full items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-left text-xs text-sky-200 hover:bg-sky-400/20"
          >
            <span className="text-base leading-none">⏎</span>
            <span>
              Line breaks look missing — click to split{" "}
              {glued.questions ? `${glued.questions + 1} questions` : "the options"} onto separate lines.
            </span>
          </button>
        )}
        {notes.length > 0 && (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
            ✓ Paste converted: {notes.join(" · ")}
          </p>
        )}
        {keyDetected && (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
            ✓ Answer key detected at the end — {parsed.filter((s) => s.answer).length} of {parsed.length} answers filled
            in automatically.
          </p>
        )}
        {!smart && (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Smart paste is off — text is inserted exactly as your clipboard provides it, so superscripts may flatten
            (7x⁵ → 7x5).
          </p>
        )}
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300">Formatting tips</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Lost every line break? Paste anyway — <code>…কত?ক) 1খ) 2গ) 4ঘ) 7২. …</code> is split back into proper
            lines automatically (or hit “Fix formatting &amp; split lines”).
          </li>
          <li>Separate questions with a blank line or a new number (১. / 1. / 1)).</li>
          <li>
            Options on their own lines or packed: <code>ক) 5 খ) 6 গ) 7 ঘ) 8</code>
          </li>
          <li>
            Answer with <code>উত্তর: গ</code>, <code>Ans: c</code>, a <code>*</code> after the option — or an answer
            key at the very end: <code>উত্তরমালা: ১.ঘ ২.গ ৩.খ</code>
          </li>
          <li>
            Math: <code>$x^2$</code>, <code>$\frac&#123;a&#125;&#123;b&#125;$</code>, <code>$\sqrt&#123;x&#125;$</code> — or
            just paste real superscripts and we convert them.
          </li>
        </ul>
      </details>
    </div>
  );

  const rightPane = (
    <div className="flex min-h-0 flex-1 flex-col p-4 pl-1">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-200">
            Detected <span className="text-amber-300">{parsed.length}</span> question{parsed.length === 1 ? "" : "s"}
          </span>
          {existingCount > 0 && (
            <div className="w-56">
              <SegButtons
                value={mode}
                onChange={setMode}
                options={[
                  { value: "replace", label: "Replace deck" },
                  { value: "append", label: `Add to ${existingCount}` },
                ]}
              />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {parsed.length === 0 && (
            <p className="p-4 text-sm text-slate-600">A live preview of every parsed question appears here…</p>
          )}
          {parsed.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-white/10 bg-slate-900/50 p-3">
              <div className="flex gap-1.5 text-sm text-slate-200">
                <span className="text-amber-300">{s.number || i + 1}.</span>
                {s.question ? <MathText text={s.question} /> : <em className="text-rose-400">empty</em>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {s.options.map((o, j) => (
                  <span key={j} className={`flex gap-1 ${s.answer === o.key ? "font-semibold text-emerald-400" : ""}`}>
                    {o.key}) <MathText text={o.text} />
                  </span>
                ))}
                {s.options.length === 0 && <span className="text-rose-400">no options found</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <ResizableDialog
      storageKey="paste-questions"
      initial={{ w: 1180, h: 760 }}
      min={{ w: 640, h: 460 }}
      title="Paste questions"
      subtitle="Formatting is preserved and missing line breaks are rebuilt — drag the edges, the divider or ⤢ to resize."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            disabled={parsed.length === 0}
            onClick={() => {
              onImport(parsed, existingCount === 0 ? "replace" : mode);
              setText("");
              setNotes([]);
              onClose();
            }}
          >
            Create {parsed.length || ""} slide{parsed.length === 1 ? "" : "s"}
          </Btn>
        </div>
      }
    >
      <SplitPane storageKey="paste-questions" left={leftPane} right={rightPane} initial={0.55} />
    </ResizableDialog>
  );
}
