import { useEffect } from "react";
import type { Deck } from "../lib/types";
import Slide from "./Slide";
import { Stage } from "./SlideViews";
import { effectiveBackground } from "../lib/background";
import { effectiveHeader, effectiveTheme } from "../lib/overrides";

interface Props {
  deck: Deck;
  index: number;
  onIndex: (i: number) => void;
  onToggleAnswer: () => void;
  onClose: () => void;
}

export default function Presenter({ deck, index, onIndex, onToggleAnswer, onClose }: Props) {
  const total = deck.slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") onIndex(Math.min(total - 1, index + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") onIndex(Math.max(0, index - 1));
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onToggleAnswer();
      } else if (e.key === "Escape") onClose();
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onIndex, onToggleAnswer, onClose]);

  const slide = deck.slides[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="group flex min-h-0 flex-1 items-center justify-center">
        {slide && (
          <Stage padding={0}>
            <Slide
              slide={slide}
              header={effectiveHeader(deck, slide)}
              theme={effectiveTheme(deck, slide)}
              globalShapes={deck.globalShapes}
              background={effectiveBackground(deck, slide)}
            />
          </Stage>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-6 py-4 opacity-25 transition-opacity hover:opacity-100">
        <div className="pointer-events-auto flex items-center gap-2 text-xs text-white/70">
          <button
            onClick={() => onIndex(Math.max(0, index - 1))}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            ←
          </button>
          <span className="tabular-nums">
            {index + 1} / {total}
          </span>
          <button
            onClick={() => onIndex(Math.min(total - 1, index + 1))}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            →
          </button>
          <button onClick={onToggleAnswer} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
            Space = answer
          </button>
        </div>
        <button onClick={onClose} className="pointer-events-auto rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/20">
          Esc = exit
        </button>
      </div>
    </div>
  );
}
