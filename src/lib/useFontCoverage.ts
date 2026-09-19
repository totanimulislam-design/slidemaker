import { useEffect, useMemo, useState } from "react";
import type { Deck } from "./types";
import { cleanFamily, detectScripts, ensureFamily, ensureFontsFor, fontChoiceFor, onFontsChanged, type ScriptId } from "./fonts";
import { effectiveOptionLabel } from "./plainNumbering";
import { effectiveTheme } from "./overrides";
import { resetFontCache } from "./exporter";
import { listCustomFonts } from "./customFonts";

/**
 * Every family a deck asks for by name: the deck's three script faces, each
 * text part's own typeface (per box, per brand line, the marker letter), any
 * per-slide theme override and the drawn text boxes. Uploaded faces are
 * registered locally and skipped; everything else that the curated library or
 * the Google catalogue knows is fetched, so a deck opened on another machine
 * renders with the faces it was designed in instead of a fallback.
 */
export function deckFamilies(deck: Deck): string[] {
  const out = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    for (const f of cleanFamily(value)) out.add(f);
  };
  const fromTheme = (t: Partial<Deck["theme"]> | undefined) => {
    if (!t) return;
    add(t.bengaliFont);
    add(t.latinFont);
    add(t.arabicFont);
    add(t.optionBulletFontFamily);
    for (const tf of Object.values(t.boxFonts ?? {})) add(tf?.family);
  };
  fromTheme(deck.theme);
  const shapes = [...(deck.globalShapes ?? [])];
  deck.slides.forEach((s) => {
    fromTheme(s.themeOverride);
    shapes.push(...(s.shapes ?? []));
  });
  shapes.forEach((sh) => add(sh.fontFamily));
  const custom = new Set(listCustomFonts().map((f) => f.family.toLowerCase()));
  return Array.from(out).filter((f) => !custom.has(f.toLowerCase()) && !!fontChoiceFor(f));
}

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
      // the numbering of a slide is the theme it actually paints with, so a
      // per-slide override counts too
      const t = effectiveTheme(deck, s);
      parts.push(s.question, s.note ?? "", s.badge ?? "");
      s.options.forEach((o, i) =>
        // the effective label, not just the stored key: plain numbering can put
        // Bangla/Arabic/Roman glyphs on the board that no key contains
        parts.push(o.key, o.text, effectiveOptionLabel(o.labelMode, o.key, t.plainNumbering, i)),
      );
    });
    return parts.join("\n");
  }, [deck]);

  const scripts = useMemo(() => detectScripts(text), [text]);

  useEffect(() => {
    ensureFontsFor(text);
  }, [text]);

  // the faces the deck names (any of the ~1,900 Google families, per text part)
  const families = useMemo(() => deckFamilies(deck).join("|"), [deck]);
  useEffect(() => {
    families.split("|").forEach((f) => ensureFamily(f));
  }, [families]);

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
