import { useEffect, useMemo, useState } from "react";
import type { Deck } from "./types";
import { detectScripts, ensureFontsFor, onFontsChanged, type ScriptId } from "./fonts";
import { resetFontCache } from "./exporter";

/**
 * Watches every string in the deck, loads any extra font files the content
 * needs (CJK, Hebrew, Thai, Tamil …) and reports which scripts are in use.
 */
export function useFontCoverage(deck: Deck): { scripts: ScriptId[]; revision: number } {
  const [revision, setRevision] = useState(0);

  const text = useMemo(() => {
    const parts: string[] = [
      deck.header.title,
      deck.header.brandTop,
      deck.header.brandBottom,
      deck.header.badge,
    ];
    deck.slides.forEach((s) => {
      parts.push(s.question, s.note ?? "", s.badge ?? "");
      s.options.forEach((o) => parts.push(o.key, o.text));
    });
    return parts.join("\n");
  }, [deck]);

  const scripts = useMemo(() => detectScripts(text), [text]);

  useEffect(() => {
    ensureFontsFor(text);
  }, [text]);

  // re-render slides (and re-inline export fonts) once a lazy font arrives
  useEffect(
    () =>
      onFontsChanged(() => {
        resetFontCache();
        setRevision((r) => r + 1);
      }),
    [],
  );

  return { scripts, revision };
}
