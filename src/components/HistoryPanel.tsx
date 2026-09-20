import type { Deck } from "../lib/types";
import type { useHistory } from "../lib/useHistory";
import { useRoomBelow } from "../lib/useRoomBelow";
import { Btn } from "./ui";
import { cn } from "../utils/cn";

type History = ReturnType<typeof useHistory<Deck>>;

interface Props {
  open: boolean;
  history: History;
  onClose: () => void;
}

const fmt = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function HistoryPanel({ open, history, onClose }: Props) {
  /** the card grows down the window as far as the steps need, never past it */
  const { ref: panelRef, room } = useRoomBelow(open);
  if (!open) return null;
  const { pastEntries, futureEntries, presentLabel, jump, clear, canUndo, canRedo, undo, redo } = history;

  // oldest → newest, then present, then redo-able future (newest first in the stack)
  const rows: { label: string; at: number; offset: number }[] = [
    ...pastEntries.map((e, i) => ({ label: e.label, at: e.at, offset: -(pastEntries.length - i) })),
    { label: presentLabel, at: Date.now(), offset: 0 },
    ...[...futureEntries].reverse().map((e, i) => ({ label: e.label, at: e.at, offset: i + 1 })),
  ];

  return (
    <div
      ref={panelRef}
      data-history-panel
      className="absolute top-14 left-3 z-40 flex w-72 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur"
      style={room ? { maxHeight: room } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-semibold text-slate-100">History</span>
        <div className="flex items-center gap-1">
          <Btn size="sm" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶
          </Btn>
          <Btn size="sm" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            ↷
          </Btn>
          <button onClick={onClose} className="ml-1 rounded-md px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {rows.map((r, i) => (
          <button
            key={`${r.at}-${i}`}
            onClick={() => jump(r.offset)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
              r.offset === 0
                ? "bg-amber-400 text-slate-950"
                : r.offset > 0
                  ? "text-slate-500 hover:bg-white/5"
                  : "text-slate-300 hover:bg-white/5",
            )}
          >
            <span className="w-4 text-center opacity-70">{r.offset === 0 ? "●" : r.offset > 0 ? "○" : "•"}</span>
            <span className="flex-1 truncate">{r.label}</span>
            <span className={cn("font-mono text-[10px]", r.offset === 0 ? "text-slate-800" : "text-slate-600")}>
              {fmt(r.at)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[11px] text-slate-500">
        <span>
          {pastEntries.length} step{pastEntries.length === 1 ? "" : "s"} back · {futureEntries.length} forward
        </span>
        <button onClick={clear} className="text-rose-300 hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}
