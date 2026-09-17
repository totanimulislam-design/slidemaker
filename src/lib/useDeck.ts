import { useCallback, useEffect, useRef } from "react";
import { useState } from "react";
import {
  DEFAULT_BACKGROUND,
  cloneBackground as cloneBackgroundDefaults,
  DEFAULT_BANNER,
  DEFAULT_FRAME,
  DEFAULT_HEADER,
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  SAMPLE_INPUT,
  type Deck,
  type DeckHeader,
  type SlideData,
  type ThemeSettings,
} from "./types";
import { emptySlide, parseQuestions } from "./parse";
import { resolveFrameImageSrc } from "./frameImages";
import { makeImageShape, makeShape, shapeId, type ShapeItem, type ShapeKind } from "./shapes";
import { groupUid } from "./groups";
import { useHistory } from "./useHistory";
import { effectiveTheme, mergeThemeOverride } from "./overrides";
import { applySlideDesign, revertSlideDesign, type ApplySection } from "./applyDesign";
import { sortByZ, Z_BASE, Z_LABELS, type ZOp } from "./zorder";
import {
  alignLayer,
  distributeLayers,
  moveLayerTo,
  normalizeUnifiedZ,
  patchLayers,
  reorderLayer,
  topZ,
  type LayerPatch,
  type LayerRect,
  type LayerRef,
} from "./layers";
import type { AlignOp } from "./shapeAlign";
import type { BackgroundSettings, Box, ElementId, LayoutMap } from "./types";
import { DEFAULT_LAYOUT as LAYOUT_DEFAULTS } from "./types";
import { measureElement } from "./layoutMeasure";

const KEY = "mcq-slide-studio-v2";

type ShapeUpdate = { id: string; patch: Partial<ShapeItem> };

/**
 * Patch one shape as edited from a specific slide. Deck-wide ("global")
 * shapes are first fanned out into independent per-slide copies so the live
 * edit cannot leak to the rest of the deck before Apply Changes is clicked.
 * Pure — returns the next deck.
 */
function patchShapeOnSlide(d: Deck, id: string, patch: Partial<ShapeItem>, slideId: string): Deck {
  const global = d.globalShapes?.find((x) => x.id === id);
  if (!global) {
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId && s.shapes?.some((x) => x.id === id)
          ? { ...s, shapes: s.shapes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
          : s,
      ),
    };
  }
  return {
    ...d,
    globalShapes: d.globalShapes?.filter((x) => x.id !== id),
    slides: d.slides.map((s) => {
      const copy = { ...global, id: s.id === slideId ? id : shapeId() };
      return {
        ...s,
        shapes: [...(s.shapes ?? []), s.id === slideId ? { ...copy, ...patch } : copy],
      };
    }),
  };
}

/**
 * Repairs stacking data written by earlier versions: shapes are renumbered
 * 10, 11, 12 … in their existing visual order (so nothing can sit at z ≤ 0 or
 * collide), and built-in elements are clamped into 1..9.
 */
export function normalizeDeckZ(deck: Deck): Deck {
  const all = [...(deck.globalShapes ?? []), ...deck.slides.flatMap((s) => s.shapes ?? [])];
  const fresh = new Map<string, number>();
  sortByZ(all.map((x) => ({ id: x.id, z: Number.isFinite(x.z) ? x.z : Z_BASE }))).forEach((x, i) => {
    if (!fresh.has(x.id)) fresh.set(x.id, Z_BASE + i);
  });
  const fix = (x: ShapeItem): ShapeItem => ({ ...x, z: fresh.get(x.id) ?? Z_BASE });
  const layout = { ...deck.theme.layout };
  (Object.keys(layout) as (keyof typeof layout)[]).forEach((k) => {
    const b = layout[k];
    if (b && b.z !== undefined && !Number.isFinite(Number(b.z))) layout[k] = { ...b, z: undefined };
  });
  return normalizeUnifiedZ({
    ...deck,
    theme: { ...deck.theme, layout },
    globalShapes: deck.globalShapes?.map(fix),
    slides: deck.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.map(fix) } : s)),
  });
}

function initialDeck(): Deck {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Deck;
      if (parsed?.slides?.length) {
        const frame = {
          ...DEFAULT_FRAME,
          ...(parsed.theme?.frame ?? {}),
          color: parsed.theme?.frame?.color ?? parsed.theme?.frameInner ?? DEFAULT_FRAME.color,
        };
        // decks saved with the retired frame collection keep working: remap
        // old built-in image paths onto the new designs
        frame.image = resolveFrameImageSrc(frame.image);
        return normalizeDeckZ({
          header: { ...DEFAULT_HEADER, ...parsed.header },
          theme: {
            ...DEFAULT_THEME,
            ...parsed.theme,
            // decks saved before free positioning existed need the full map
            layout: {
              ...DEFAULT_LAYOUT,
              ...(parsed.theme?.layout ?? {}),
              // decks saved before the bullet existed need its box
              bullet: { ...DEFAULT_LAYOUT.bullet, ...(parsed.theme?.layout?.bullet ?? {}) },
            },
            banner: {
              ...DEFAULT_BANNER,
              ...(parsed.theme?.banner ?? {}),
              // decks from before the designer: keep their banner colour
              color: parsed.theme?.banner?.color ?? parsed.theme?.titleBanner ?? DEFAULT_BANNER.color,
            },
            background: { ...DEFAULT_BACKGROUND, ...(parsed.theme?.background ?? {}) },
            boxFonts: { ...(parsed.theme?.boxFonts ?? {}) },
            frame,
          },
          slides: parsed.slides,
          globalShapes: parsed.globalShapes ?? [],
        });
      }
    }
  } catch {
    /* ignore */
  }
  return normalizeUnifiedZ({ header: DEFAULT_HEADER, theme: DEFAULT_THEME, slides: parseQuestions(SAMPLE_INPUT), globalShapes: [] });
}

/** short readable names for the history panel */
const THEME_LABELS: Partial<Record<keyof ThemeSettings, string>> = {
  layout: "Move element",
  questionSize: "Question size",
  optionSize: "Option size",
  optionStyle: "Option style",
  optionAccent: "Option colour",
  optionBulletShape: "Option bullet shape",
  optionBulletTreatment: "Option bullet style",
  optionBulletInk: "Option bullet ink colour",
  optionBulletFill: "Option bullet fill colour",
  optionBulletBorder: "Option bullet border colour",
  optionBulletCustomOnAnswer: "Option bullet colours on answer",
  optionBulletBgColor: "Option bullet background shape",
  optionBulletBgScope: "Option bullet background shape",
  optionBulletBgShape: "Option bullet background shape",
  optionBulletBgSize: "Option bullet background size",
  optionBulletBgOpacity: "Option bullet background opacity",
  optionGap: "Option spacing",
  optionLineHeight: "Option line height",
  plainNumbering: "Plain numbering",
  optionsLayout: "Options layout",
  bengaliFont: "Bangla font",
  arabicFont: "Arabic font",
  latinFont: "Latin font",
  boxFonts: "Box font",
  answerStyle: "Answer style",
  snapEnabled: "Snapping",
  smartGuides: "Smart guides",
  snapStep: "Snap step",
  banner: "Title banner",
  background: "Background",
  showFrame: "Frame",
  showBullet: "Bullet",
  showNumber: "Number",
  bulletSeparate: "Separate number bullet",
  numberStyle: "Numbering style",
  bulletSize: "Bullet size",
};

export function useDeck() {
  const history = useHistory<Deck>(initialDeck, { limit: 150, coalesceMs: 800 });
  const { present: deck, set: setDeckH, undo, redo, canUndo, canRedo } = history;
  const [current, setCurrent] = useState(0);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(deck));
      } catch {
        /* quota */
      }
    }, 400);
  }, [deck]);

  /** raw setter kept for callers that build a whole deck (load JSON etc.) */
  const setDeck = useCallback(
    (next: Deck | ((d: Deck) => Deck), label = "Edit deck") => setDeckH(next, label),
    [setDeckH],
  );

  const setHeader = useCallback(
    (patch: Partial<DeckHeader>) => {
      const key = Object.keys(patch)[0] ?? "header";
      const label =
        key === "logo" ? "Change logo" : key === "title" ? "Edit title" : key === "badge" ? "Edit badge" : "Edit header";
      setDeckH((d) => ({ ...d, header: { ...d.header, ...patch } }), label, `header:${key}`);
    },
    [setDeckH],
  );

  const setTheme = useCallback(
    (patch: Partial<ThemeSettings>) => {
      const key = Object.keys(patch)[0] as keyof ThemeSettings | undefined;
      const label = key ? THEME_LABELS[key] ?? (key.toLowerCase().includes("color") || key === "accent" || key === "board" || key.startsWith("frame") ? "Change colour" : "Design change") : "Design change";
      setDeckH((d) => ({ ...d, theme: { ...d.theme, ...patch } }), label, key ? `theme:${key}` : undefined);
    },
    [setDeckH],
  );

  /** Apply visual settings to this slide, selected slides, or the whole deck. */
  const setThemeScoped = useCallback(
    (patch: Partial<ThemeSettings>, scope: "slide" | "selected" | "all", slideIds: string[]) => {
      const keys = Object.keys(patch) as (keyof ThemeSettings)[];
      const ids = new Set(slideIds);
      setDeckH(
        (d) => {
          if (scope === "all") {
            return {
              ...d,
              theme: { ...d.theme, ...patch },
              slides: d.slides.map((s) => {
                if (!s.themeOverride) return s;
                const next = { ...s.themeOverride };
                keys.forEach((k) => delete next[k]);
                return { ...s, themeOverride: Object.keys(next).length ? next : undefined };
              }),
            };
          }
          return {
            ...d,
            slides: d.slides.map((s) =>
              ids.has(s.id) ? { ...s, themeOverride: mergeThemeOverride(s.themeOverride, patch) } : s,
            ),
          };
        },
        `Change ${scope === "all" ? "all slides" : scope === "selected" ? `${ids.size} slides` : "this slide"}`,
      );
    },
    [setDeckH],
  );

  /** Apply header/title fields with the same editor scope semantics. */
  const setHeaderScoped = useCallback(
    (patch: Partial<DeckHeader>, scope: "slide" | "selected" | "all", slideIds: string[]) => {
      const keys = Object.keys(patch) as (keyof DeckHeader)[];
      const ids = new Set(slideIds);
      setDeckH(
        (d) => {
          if (scope === "all") {
            return {
              ...d,
              header: { ...d.header, ...patch },
              slides: d.slides.map((s) => {
                if (!s.headerOverride) return s;
                const next = { ...s.headerOverride };
                keys.forEach((k) => delete next[k]);
                return { ...s, headerOverride: Object.keys(next).length ? next : undefined };
              }),
            };
          }
          return {
            ...d,
            slides: d.slides.map((s) =>
              ids.has(s.id)
                ? { ...s, headerOverride: { ...(s.headerOverride ?? {}), ...patch } }
                : s,
            ),
          };
        },
        `Edit header on ${scope === "selected" ? `${ids.size} slides` : scope === "slide" ? "this slide" : "all slides"}`,
      );
    },
    [setDeckH],
  );

  const patchLayoutScoped = useCallback(
    (
      id: ElementId,
      patch: Partial<Box>,
      scope: "slide" | "selected" | "all",
      slideIds: string[],
      label = "Move element",
    ) => {
      const ids = new Set(slideIds);
      setDeckH(
        (d) => {
          if (scope === "all") {
            const cur = d.theme.layout[id] ?? LAYOUT_DEFAULTS[id];
            return {
              ...d,
              theme: { ...d.theme, layout: { ...d.theme.layout, [id]: { ...cur, ...patch } } },
              slides: d.slides.map((s) => {
                if (!s.themeOverride?.layout?.[id]) return s;
                const layout = { ...s.themeOverride.layout };
                delete layout[id];
                return { ...s, themeOverride: { ...s.themeOverride, layout } };
              }),
            };
          }
          return {
            ...d,
            slides: d.slides.map((s) => {
              if (!ids.has(s.id)) return s;
              const base = s.themeOverride?.layout?.[id] ?? d.theme.layout[id] ?? LAYOUT_DEFAULTS[id];
              return {
                ...s,
                themeOverride: mergeThemeOverride(s.themeOverride, {
                  layout: { ...(s.themeOverride?.layout ?? d.theme.layout), [id]: { ...base, ...patch } },
                }),
              };
            }),
          };
        },
        label,
        `scope-layout:${scope}:${id}`,
      );
    },
    [setDeckH],
  );

  const transformLayoutScoped = useCallback(
    (
      fn: (layout: LayoutMap) => LayoutMap,
      scope: "slide" | "selected" | "all",
      slideIds: string[],
      label = "Change layout",
    ) => {
      const ids = new Set(slideIds);
      setDeckH(
        (d) => {
          if (scope === "all") {
            const layout = fn(d.theme.layout);
            return {
              ...d,
              theme: { ...d.theme, layout },
              slides: d.slides.map((s) =>
                s.themeOverride?.layout
                  ? { ...s, themeOverride: { ...s.themeOverride, layout: undefined } }
                  : s,
              ),
            };
          }
          return {
            ...d,
            slides: d.slides.map((s) =>
              ids.has(s.id)
                ? {
                    ...s,
                    themeOverride: mergeThemeOverride(s.themeOverride, {
                      layout: fn(effectiveTheme(d, s).layout),
                    }),
                  }
                : s,
            ),
          };
        },
        label,
      );
    },
    [setDeckH],
  );

  /**
   * Patch ONE element's box against the *current* deck (never a render-time
   * snapshot). z is preserved unless the patch explicitly sets it — this is what
   * keeps layer order intact while dragging / applying presets.
   */
  const patchLayout = useCallback(
    (id: ElementId, patch: Partial<Box>, label = "Move element", coalesceKey = `layout:${id}`) => {
      setDeckH(
        (d) => {
          const cur = d.theme.layout[id] ?? LAYOUT_DEFAULTS[id];
          const next: Box = { ...cur, ...patch, z: patch.z !== undefined ? patch.z : cur.z };
          return { ...d, theme: { ...d.theme, layout: { ...d.theme.layout, [id]: next } } };
        },
        label,
        coalesceKey,
      );
    },
    [setDeckH],
  );

  /** Transform the whole layout map functionally, keeping every element's z. */
  const transformLayout = useCallback(
    (fn: (layout: LayoutMap) => LayoutMap, label = "Change layout") => {
      setDeckH((d) => {
        const next = fn(d.theme.layout);
        const keepZ = Object.fromEntries(
          (Object.keys(next) as ElementId[]).map((k) => [
            k,
            { ...next[k], z: next[k].z !== undefined ? next[k].z : d.theme.layout[k]?.z },
          ]),
        ) as LayoutMap;
        return { ...d, theme: { ...d.theme, layout: keepZ } };
      }, label);
    },
    [setDeckH],
  );

  const updateSlide = useCallback(
    (id: string, patch: Partial<SlideData>) => {
      const key = Object.keys(patch)[0] ?? "slide";
      const label =
        key === "question" ? "Edit question"
        : key === "options" ? "Edit options"
        : key === "answer" ? "Set answer"
        : key === "showAnswer" ? "Toggle answer"
        : key === "scale" ? "Text size"
        : key === "shapes" ? "Edit shapes"
        : `Edit ${key}`;
      setDeckH(
        (d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
        label,
        `slide:${id}:${key}`,
      );
    },
    [setDeckH],
  );

  const transformAll = useCallback(
    (fn: (s: SlideData) => SlideData, label = "Update all slides") => {
      setDeckH((d) => ({ ...d, slides: d.slides.map(fn) }), label);
    },
    [setDeckH],
  );

  const updateAll = useCallback(
    (patch: Partial<SlideData>) => {
      setDeckH((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, ...patch })) }), "Update all slides");
    },
    [setDeckH],
  );

  const addSlides = useCallback(
    (slides: SlideData[], mode: "append" | "replace") => {
      if (!slides.length) return;
      setDeckH((d) => {
        const next = mode === "replace" ? slides : [...d.slides, ...slides];
        return { ...d, slides: next.map((s, i) => ({ ...s, number: s.number || String(i + 1) })) };
      }, `${mode === "replace" ? "Import" : "Add"} ${slides.length} slide${slides.length === 1 ? "" : "s"}`);
    },
    [setDeckH],
  );

  const insertBlank = useCallback(() => {
    setDeckH((d) => {
      const s = emptySlide(d.slides.length + 1);
      window.setTimeout(() => setCurrent(d.slides.length), 0);
      return { ...d, slides: [...d.slides, s] };
    }, "New blank slide");
  }, [setDeckH]);

  const removeSlide = useCallback(
    (id: string) => {
      setDeckH((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== id) }), "Delete slide");
      setCurrent((c) => Math.max(0, c - 1));
    },
    [setDeckH],
  );

  const duplicateSlide = useCallback(
    (id: string) => {
      setDeckH((d) => {
        const i = d.slides.findIndex((s) => s.id === id);
        if (i < 0) return d;
        const copy: SlideData = { ...d.slides[i], id: `${id}-c${Math.random().toString(36).slice(2, 6)}` };
        const slides = [...d.slides];
        slides.splice(i + 1, 0, copy);
        return { ...d, slides };
      }, "Duplicate slide");
    },
    [setDeckH],
  );

  const moveSlide = useCallback(
    (id: string, dir: -1 | 1) => {
      setDeckH((d) => {
        const i = d.slides.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.slides.length) return d;
        const slides = [...d.slides];
        [slides[i], slides[j]] = [slides[j], slides[i]];
        window.setTimeout(() => setCurrent(j), 0);
        return { ...d, slides };
      }, "Reorder slides");
    },
    [setDeckH],
  );

  /** for quiz videos: question slide followed by the same slide with the answer shown */
  const addAnswerCopies = useCallback(() => {
    setDeckH(
      (d) => ({
        ...d,
        slides: d.slides.flatMap((s) =>
          s.showAnswer
            ? [s]
            : [
                { ...s, showAnswer: false },
                { ...s, id: `${s.id}-a${Math.random().toString(36).slice(2, 6)}`, showAnswer: true },
              ],
        ),
      }),
      "Add answer copies",
    );
  }, [setDeckH]);

  /* ------------------------------ shapes ------------------------------ */

  /**
   * Target for a new shape:
   *   null            → deck-wide (every slide, one shared item)
   *   string          → one slide
   *   string[]        → an independent copy on each listed slide
   */
  type ShapeTarget = null | string | string[];

  const placeItem = (d: Deck, item: ShapeItem, target: ShapeTarget): Deck => {
    // always on top of everything currently in the deck (elements included)
    item.z = topZ(d) + 1;
    if (target === null) return { ...d, globalShapes: [...(d.globalShapes ?? []), item] };
    const ids = new Set(Array.isArray(target) ? target : [target]);
    let first = true;
    return {
      ...d,
      slides: d.slides.map((s) => {
        if (!ids.has(s.id)) return s;
        // the first slide gets the original id (so it can be selected), the
        // rest get their own copies that can be edited independently
        const copy = first ? item : { ...item, id: shapeId() };
        first = false;
        return { ...s, shapes: [...(s.shapes ?? []), copy] };
      }),
    };
  };

  const scopeLabel = (target: ShapeTarget) =>
    target === null ? " on all slides" : Array.isArray(target) ? ` on ${target.length} slides` : "";

  const addShape = useCallback(
    (kind: ShapeKind, target: ShapeTarget): string => {
      const item = makeShape(kind);
      setDeckH((d) => {
        item.fill = kind === "text" || kind === "line" || kind === "arrow" ? "" : d.theme.accent;
        if (kind !== "text" && kind !== "line" && kind !== "arrow" && kind !== "star") item.stroke = d.theme.accent;
        return placeItem(d, item, target);
      }, `Insert ${kind === "text" ? "text box" : kind}${scopeLabel(target)}`);
      return item.id;
    },
    [setDeckH],
  );

  /** inserts an already-loaded image (data URL / URL + ratio) and returns its id */
  const addImage = useCallback(
    (src: string, ratio: number, target: ShapeTarget, at?: { x: number; y: number }): string => {
      const item = makeImageShape(src, ratio);
      if (at) {
        item.x = Math.round((at.x - item.w / 2) * 10) / 10;
        item.y = Math.round((at.y - item.h / 2) * 10) / 10;
      }
      setDeckH((d) => placeItem(d, item, target), `Insert image${scopeLabel(target)}`);
      return item.id;
    },
    [setDeckH],
  );

  /** copies an existing shape onto other slides (independent copies) */
  const copyShapeTo = useCallback(
    (id: string, target: ShapeTarget) => {
      setDeckH((d) => {
        const src =
          d.globalShapes?.find((x) => x.id === id) ??
          d.slides.flatMap((s) => s.shapes ?? []).find((x) => x.id === id);
        if (!src) return d;
        if (target === null) {
          // promote to deck-wide and remove per-slide copies of this id
          return {
            ...d,
            globalShapes: [...(d.globalShapes ?? []).filter((x) => x.id !== id), src],
            slides: d.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.filter((x) => x.id !== id) } : s)),
          };
        }
        const ids = new Set(Array.isArray(target) ? target : [target]);
        return {
          ...d,
          slides: d.slides.map((s) =>
            ids.has(s.id) && !s.shapes?.some((x) => x.id === id)
              ? { ...s, shapes: [...(s.shapes ?? []), { ...src, id: shapeId() }] }
              : s,
          ),
        };
      }, `Copy shape${scopeLabel(target)}`);
    },
    [setDeckH],
  );

  const updateShape = useCallback(
    (id: string, patch: Partial<ShapeItem>) => {
      const keys = Object.keys(patch);
      const geo = keys.every((k) => ["x", "y", "w", "h", "rot"].includes(k));
      const label =
        geo ? (keys.includes("rot") ? "Rotate shape" : keys.includes("w") || keys.includes("h") ? "Resize shape" : "Move shape")
        : keys[0] === "text" ? "Edit text"
        : keys[0] === "z" ? "Reorder shape"
        : keys[0] === "locked" ? "Lock shape"
        : keys[0] === "behind" ? (patch.behind ? "Move behind slide text" : "Move above slide text")
        : keys[0] === "src" ? "Replace image"
        : ["opacity", "fit", "radius", "mask", "flipH", "flipV", "shadow"].includes(keys[0]) ? "Adjust image"
        : keys[0] === "gradient" ? "Shape gradient"
        : keys[0] === "shadow2" ? "Shape shadow"
        : keys[0] === "glow" ? "Shape glow"
        : keys[0] === "textGradient" ? "Text gradient"
        : "Style shape";
      setDeckH(
        (d) => ({
          ...d,
          globalShapes: d.globalShapes?.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          slides: d.slides.map((s) =>
            s.shapes?.some((x) => x.id === id)
              ? { ...s, shapes: s.shapes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
              : s,
          ),
        }),
        label,
        `shape:${id}:${geo ? "geo" : keys[0]}`,
      );
    },
    [setDeckH],
  );

  /**
   * Edits a shape on the current slide only. If it was deck-wide, first fan it
   * out into independent per-slide copies so the live edit cannot leak to the
   * rest of the deck before Apply Changes is clicked.
   */
  const updateShapeOnSlide = useCallback(
    (id: string, patch: Partial<ShapeItem>, slideId: string) => {
      setDeckH(
        (d) => patchShapeOnSlide(d, id, patch, slideId),
        "Edit shape on this slide",
        `shape-slide:${slideId}:${id}:${Object.keys(patch)[0] ?? "style"}`,
      );
    },
    [setDeckH],
  );

  /**
   * Same as updateShapeOnSlide but for MANY shapes in one deck update, so a
   * group / multi-selection drag stays a single undo step and never churns
   * the history with one snapshot per member.
   */
  const updateShapesOnSlide = useCallback(
    (updates: ShapeUpdate[], slideId: string) => {
      if (!updates.length) return;
      const keys = Object.keys(updates[0]?.patch ?? {});
      const label =
        keys.includes("w") || keys.includes("h")
          ? `Resize ${updates.length} items`
          : keys.includes("rot")
            ? `Rotate ${updates.length} items`
            : `Move ${updates.length} items`;
      setDeckH(
        (d) => {
          let next = d;
          for (const u of updates) next = patchShapeOnSlide(next, u.id, u.patch, slideId);
          return next;
        },
        label,
        `shapes-slide:${slideId}:${keys[0] ?? "geo"}`,
      );
    },
    [setDeckH],
  );

  /** deck-wide batch patch (keeps every entry in ONE undo step) */
  const updateShapes = useCallback(
    (updates: ShapeUpdate[], label = "Move shapes") => {
      if (!updates.length) return;
      setDeckH(
        (d) => {
          const byId = new Map(updates.map((u) => [u.id, u.patch]));
          const fix = (x: ShapeItem): ShapeItem => {
            const p = byId.get(x.id);
            return p ? { ...x, ...p } : x;
          };
          return {
            ...d,
            globalShapes: d.globalShapes?.map(fix),
            slides: d.slides.map((s) =>
              s.shapes?.some((x) => byId.has(x.id)) ? { ...s, shapes: s.shapes.map(fix) } : s,
            ),
          };
        },
        label,
        `shapes-batch:${updates
          .map((u) => u.id)
          .sort()
          .join(",")}:${Object.keys(updates[0]?.patch ?? {})[0] ?? "geo"}`,
      );
    },
    [setDeckH],
  );

  /**
   * Group the given shapes: only a shared tag is written, each member keeps
   * its exact position, size, rotation, style and content — so Ungroup is
   * lossless and members stay independently editable afterwards.
   */
  const groupShapes = useCallback(
    (ids: string[]): string | null => {
      if (ids.length < 2) return null;
      const gid = groupUid();
      setDeckH((d) => {
        const set = new Set(ids);
        const fix = (x: ShapeItem): ShapeItem => (set.has(x.id) ? { ...x, groupId: gid } : x);
        return {
          ...d,
          globalShapes: d.globalShapes?.map(fix),
          slides: d.slides.map((s) =>
            s.shapes?.some((x) => set.has(x.id)) ? { ...s, shapes: s.shapes.map(fix) } : s,
          ),
        };
      }, `Group ${ids.length} items`);
      return gid;
    },
    [setDeckH],
  );

  /** Remove the group tag from every group the selection touches. */
  const ungroupShapes = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setDeckH((d) => {
        const set = new Set(ids);
        const all = [...(d.globalShapes ?? []), ...d.slides.flatMap((s) => s.shapes ?? [])];
        const gids = new Set(all.filter((x) => set.has(x.id) && x.groupId).map((x) => x.groupId as string));
        if (!gids.size) return d;
        const fix = (x: ShapeItem): ShapeItem => (x.groupId && gids.has(x.groupId) ? { ...x, groupId: undefined } : x);
        return {
          ...d,
          globalShapes: d.globalShapes?.map(fix),
          slides: d.slides.map((s) =>
            s.shapes?.some((x) => x.groupId && gids.has(x.groupId))
              ? { ...s, shapes: s.shapes.map(fix) }
              : s,
          ),
        };
      }, "Ungroup items");
    },
    [setDeckH],
  );

  /** batch delete — one undo step for the whole set */
  const removeShapes = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const set = new Set(ids);
      setDeckH(
        (d) => ({
          ...d,
          globalShapes: d.globalShapes?.filter((x) => !set.has(x.id)),
          slides: d.slides.map((s) =>
            s.shapes?.some((x) => set.has(x.id)) ? { ...s, shapes: s.shapes.filter((x) => !set.has(x.id)) } : s,
          ),
        }),
        ids.length > 1 ? `Delete ${ids.length} shapes` : "Delete shape",
      );
    },
    [setDeckH],
  );

  /**
   * Batch duplicate. Clones keep every property of the source; if the
   * sources were one group, the clones become their own new group.
   */
  const duplicateShapes = useCallback(
    (ids: string[]): string[] => {
      if (!ids.length) return [];
      const pairs = ids.map((id) => ({ src: id, dst: shapeId() }));
      setDeckH((d) => {
        const gnew = new Map<string, string>();
        const ownerOf = (id: string) => d.slides.find((s) => s.shapes?.some((x) => x.id === id))?.id ?? null;
        const made: { slideId: string | null; item: ShapeItem }[] = [];
        pairs.forEach((p, i) => {
          const src =
            d.globalShapes?.find((x) => x.id === p.src) ??
            d.slides.flatMap((s) => s.shapes ?? []).find((x) => x.id === p.src);
          if (!src) return;
          let g: string | undefined = src.groupId;
          if (g) {
            let fresh = gnew.get(g);
            if (!fresh) gnew.set(g, (fresh = groupUid()));
            g = gnew.get(g);
          }
          made.push({
            slideId: d.globalShapes?.some((x) => x.id === p.src) ? null : ownerOf(p.src),
            // a copy is always painted: duplicating a 👁-hidden layer and seeing
            // nothing appear on the slide reads as a broken button
            item: { ...src, id: p.dst, x: src.x + 3, y: src.y + 3, z: topZ(d) + 1 + i, groupId: g, hidden: false },
          });
        });
        const globals = made.filter((m) => m.slideId === null).map((m) => m.item);
        return {
          ...d,
          globalShapes: globals.length ? [...(d.globalShapes ?? []), ...globals] : d.globalShapes,
          slides: d.slides.map((s) => {
            const own = made.filter((m) => m.slideId === s.id).map((m) => m.item);
            return own.length ? { ...s, shapes: [...(s.shapes ?? []), ...own] } : s;
          }),
        };
      }, ids.length > 1 ? `Duplicate ${ids.length} items` : "Duplicate shape");
      return pairs.map((p) => p.dst);
    },
    [setDeckH],
  );

  /**
   * Bring Forward / Bring to Front / Send Backward / Send to Back — over the
   * unified stack of slide elements + drawn items visible on `slideId`.
   */
  const reorderLayerOp = useCallback(
    (ref: LayerRef, op: ZOp, slideId: string | null) => {
      setDeckH((d) => {
        const slide =
          (ref.kind === "shape" ? d.slides.find((s) => s.shapes?.some((x) => x.id === ref.id)) : undefined) ??
          d.slides.find((s) => s.id === slideId);
        return reorderLayer(d, slide, ref, op);
      }, Z_LABELS[op].label);
    },
    [setDeckH],
  );

  /**
   * Drag & drop in the layer list: puts `ref` (one row, or a whole multi-row
   * selection carried as a block) into an exact slot of the stack, counted from
   * the bottom. One drop = one undo step.
   */
  const moveLayerToOp = useCallback(
    (ref: LayerRef | LayerRef[], index: number, slideId: string | null) => {
      const one = Array.isArray(ref) ? ref[0] : ref;
      const count = Array.isArray(ref) ? ref.length : 1;
      setDeckH((d) => {
        const slide =
          (one?.kind === "shape" ? d.slides.find((s) => s.shapes?.some((x) => x.id === one.id)) : undefined) ??
          d.slides.find((s) => s.id === slideId);
        return moveLayerTo(d, slide, ref, index);
      }, count > 1 ? `Reorder ${count} layers` : "Reorder layer");
    },
    [setDeckH],
  );

  /**
   * Hide / show, lock / unlock and rename any layer — built-in elements and
   * drawn items alike. One call per gesture, so a whole multi-selection toggles
   * in a single undo step.
   */
  const patchLayersOp = useCallback(
    (refs: LayerRef[], patch: LayerPatch, slideId: string | null) => {
      if (!refs.length) return;
      const n = refs.length;
      const label =
        patch.name !== undefined
          ? "Rename layer"
          : patch.hidden !== undefined
            ? `${patch.hidden ? "Hide" : "Show"} ${n > 1 ? `${n} layers` : "layer"}`
            : patch.locked !== undefined
              ? `${patch.locked ? "Lock" : "Unlock"} ${n > 1 ? `${n} layers` : "layer"}`
              : "Edit layer";
      setDeckH((d) => patchLayers(d, refs, patch, slideId), label);
    },
    [setDeckH],
  );

  /**
   * Duplicate any set of layers. Drawn items are cloned right above the
   * originals; built-in elements cannot be duplicated (there is exactly one
   * title, one question …), so they are simply skipped.
   */
  const duplicateLayersOp = useCallback(
    (refs: LayerRef[]): string[] => duplicateShapes(refs.filter((r) => r.kind === "shape").map((r) => r.id)),
    [duplicateShapes],
  );

  /**
   * Delete any set of layers. Drawn items are removed; a built-in element
   * cannot be deleted, so it is HIDDEN instead — the Canva-equivalent outcome,
   * and it stays in the list ready to be shown again.
   */
  const removeLayersOp = useCallback(
    (refs: LayerRef[], slideId: string | null) => {
      const shapeIds = refs.filter((r) => r.kind === "shape").map((r) => r.id);
      const elements = refs.filter((r) => r.kind === "element");
      if (!shapeIds.length && !elements.length) return;
      const n = refs.length;
      setDeckH((d) => {
        const set = new Set(shapeIds);
        const cleared: Deck = shapeIds.length
          ? {
              ...d,
              globalShapes: d.globalShapes?.filter((x) => !set.has(x.id)),
              slides: d.slides.map((s) =>
                s.shapes?.some((x) => set.has(x.id)) ? { ...s, shapes: s.shapes.filter((x) => !set.has(x.id)) } : s,
              ),
            }
          : d;
        return elements.length ? patchLayers(cleared, elements, { hidden: true }, slideId) : cleared;
      }, n > 1 ? `Delete ${n} layers` : elements.length && !shapeIds.length ? "Hide layer" : "Delete layer");
    },
    [setDeckH],
  );

  /** align ANY layer (element or shape) to the slide or to a reference rect */
  const alignLayerOp = useCallback(
    (ref: LayerRef, op: AlignOp, slideId: string | null, target?: LayerRect) => {
      setDeckH(
        (d) => alignLayer(d, d.slides.find((s) => s.id === slideId), ref, op, target, measureElement),
        `Align ${ref.kind === "element" ? ref.id : "shape"}`,
        `align:${ref.kind}:${ref.id}`,
      );
    },
    [setDeckH],
  );

  const distributeLayersOp = useCallback(
    (refs: LayerRef[], axis: "h" | "v", slideId: string | null) => {
      setDeckH(
        (d) => distributeLayers(d, d.slides.find((s) => s.id === slideId), refs, axis, measureElement),
        `Distribute ${axis === "h" ? "horizontally" : "vertically"}`,
      );
    },
    [setDeckH],
  );

  /** back-compat wrapper used by shape callers */
  const reorderShape = useCallback(
    (id: string, op: ZOp, slideId: string | null) => reorderLayerOp({ kind: "shape", id }, op, slideId),
    [reorderLayerOp],
  );

  /** paste a design onto every shape (of one kind, or all) visible on a slide */
  const applyShapeDesign = useCallback(
    (style: Partial<ShapeItem>, kind: ShapeItem["kind"] | null, exceptId: string, slideId: string | null) => {
      // never copy geometry / content / identity
      const {
        id: _i, kind: _k, x: _x, y: _y, w: _w, h: _h, rot: _r, z: _z, text: _t, src: _s, locked: _l, behind: _b,
        naturalRatio: _n, hidden: _hd, name: _nm, groupId: _g, ...design
      } = style as ShapeItem;
      void _i; void _k; void _x; void _y; void _w; void _h; void _r; void _z; void _t; void _s; void _l; void _b;
      void _n; void _hd; void _nm; void _g;
      const match = (x: ShapeItem) => x.id !== exceptId && (kind === null || x.kind === kind);
      const apply = (x: ShapeItem): ShapeItem => (match(x) ? { ...x, ...design } : x);
      setDeckH(
        (d) => ({
          ...d,
          globalShapes: d.globalShapes?.map(apply),
          slides: d.slides.map((s) => (s.id === slideId && s.shapes ? { ...s, shapes: s.shapes.map(apply) } : s)),
        }),
        kind ? `Apply design to all ${kind}s` : "Apply design to all shapes",
      );
    },
    [setDeckH],
  );

  const removeShape = useCallback(
    (id: string) => {
      setDeckH(
        (d) => ({
          ...d,
          globalShapes: d.globalShapes?.filter((x) => x.id !== id),
          slides: d.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.filter((x) => x.id !== id) } : s)),
        }),
        "Delete shape",
      );
    },
    [setDeckH],
  );

  const duplicateShape = useCallback(
    (id: string): string | null => {
      const newId = shapeId();
      setDeckH((d) => {
        const clone = (x: ShapeItem): ShapeItem => ({ ...x, id: newId, x: x.x + 3, y: x.y + 3, z: topZ(d) + 1 });
        if (d.globalShapes?.some((x) => x.id === id)) {
          const src = d.globalShapes.find((x) => x.id === id)!;
          return { ...d, globalShapes: [...d.globalShapes, clone(src)] };
        }
        return {
          ...d,
          slides: d.slides.map((s) => {
            const src = s.shapes?.find((x) => x.id === id);
            return src ? { ...s, shapes: [...(s.shapes ?? []), clone(src)] } : s;
          }),
        };
      }, "Duplicate shape");
      return newId;
    },
    [setDeckH],
  );

  const toggleShapeScope = useCallback(
    (id: string, slideId: string) => {
      setDeckH((d) => {
        const g = d.globalShapes?.find((x) => x.id === id);
        if (g) {
          return {
            ...d,
            globalShapes: d.globalShapes!.filter((x) => x.id !== id),
            slides: d.slides.map((s) => (s.id === slideId ? { ...s, shapes: [...(s.shapes ?? []), g] } : s)),
          };
        }
        const owner = d.slides.find((s) => s.shapes?.some((x) => x.id === id));
        const item = owner?.shapes?.find((x) => x.id === id);
        if (!item) return d;
        return {
          ...d,
          globalShapes: [...(d.globalShapes ?? []), item],
          slides: d.slides.map((s) => (s.shapes ? { ...s, shapes: s.shapes.filter((x) => x.id !== id) } : s)),
        };
      }, "Change shape scope");
    },
    [setDeckH],
  );

  /** bulk-sets answers from a pasted answer key */
  const applyAnswers = useCallback(
    (updates: { slideId: string; answer: string }[], reveal: boolean) => {
      if (!updates.length) return;
      const map = new Map(updates.map((u) => [u.slideId, u.answer]));
      setDeckH(
        (d) => ({
          ...d,
          slides: d.slides.map((s) =>
            map.has(s.id) ? { ...s, answer: map.get(s.id)!, showAnswer: reveal ? true : s.showAnswer } : s,
          ),
        }),
        `Paste ${updates.length} answer${updates.length === 1 ? "" : "s"}`,
      );
    },
    [setDeckH],
  );

  /* ---------------------------- background ---------------------------- */

  /**
   * scope "deck"     → theme.background (every slide without an override)
   * scope "slide"    → this slide's override
   * scope "selected" → an override on each listed slide
   */
  const setBackground = useCallback(
    (patch: Partial<BackgroundSettings>, scope: "deck" | "slide" | string[], slideId: string | null) => {
      const label = patch.src !== undefined ? (patch.src ? "Set background image" : "Remove background image") : "Adjust background";
      const key = Object.keys(patch)[0] ?? "bg";
      setDeckH(
        (d) => {
          if (scope === "deck") {
            return { ...d, theme: { ...d.theme, background: { ...cloneBackgroundDefaults(), ...d.theme.background, ...patch } } };
          }
          const ids = new Set(scope === "slide" ? [slideId ?? ""] : scope);
          return {
            ...d,
            slides: d.slides.map((s) =>
              ids.has(s.id)
                ? { ...s, background: { ...cloneBackgroundDefaults(), ...d.theme.background, ...(s.background ?? {}), ...patch } }
                : s,
            ),
          };
        },
        label,
        `bg:${scope === "deck" ? "deck" : scope === "slide" ? slideId : "sel"}:${key}`,
      );
    },
    [setDeckH],
  );

  /**
   * Reset:
   *   "deck"  → deck background back to defaults AND every slide override removed
   *   "slide" / string[] → those slides' overrides removed (they follow the deck again);
   *                        if the deck itself has a background, they get a blank override
   *                        so the reset is visible on exactly those slides.
   */
  const resetBackground = useCallback(
    (scope: "deck" | "slide" | string[], slideId: string | null) => {
      setDeckH(
        (d) => {
          if (scope === "deck") {
            return {
              ...d,
              theme: { ...d.theme, background: cloneBackgroundDefaults() },
              slides: d.slides.map((s) => (s.background ? { ...s, background: undefined } : s)),
            };
          }
          const ids = new Set(scope === "slide" ? [slideId ?? ""] : scope);
          const deckHasBg = !!d.theme.background?.src || !!d.theme.background?.design || !!d.theme.background?.gradient?.enabled ||
            !!d.theme.background?.overlay?.enabled || (d.theme.background?.vignette ?? 0) > 0;
          return {
            ...d,
            slides: d.slides.map((s) =>
              ids.has(s.id) ? { ...s, background: deckHasBg ? cloneBackgroundDefaults() : undefined } : s,
            ),
          };
        },
        scope === "deck" ? "Reset background (all slides)" : "Reset background",
      );
    },
    [setDeckH],
  );

  /** drops a slide's override so it follows the deck background again */
  const clearSlideBackground = useCallback(
    (slideIds: string[]) => {
      const ids = new Set(slideIds);
      setDeckH(
        (d) => ({ ...d, slides: d.slides.map((s) => (ids.has(s.id) ? { ...s, background: undefined } : s)) }),
        "Use deck background",
      );
    },
    [setDeckH],
  );

  /**
   * Explicitly applies the design from a slide to a scope (this slide, selected slides, or all slides).
   */
  const applyDesign = useCallback(
    (
      sourceSlideId: string,
      scope: "slide" | "selected" | "all",
      targetSlideIds: string[],
      section: ApplySection = "all",
    ) => {
      const label =
        scope === "all"
          ? "Apply design to all slides"
          : scope === "selected"
            ? `Apply design to ${targetSlideIds.length} slides`
            : "Apply design to slide";
      setDeckH((d) => applySlideDesign(d, sourceSlideId, scope, targetSlideIds, section), label);
    },
    [setDeckH],
  );

  /**
   * Reverts slide(s) to follow the deck default design.
   */
  const revertDesign = useCallback(
    (slideIds: string[]) => {
      setDeckH((d) => revertSlideDesign(d, slideIds), "Revert slide design to default");
    },
    [setDeckH],
  );

  const renumber = useCallback(() => {
    setDeckH((d) => ({ ...d, slides: d.slides.map((s, i) => ({ ...s, number: String(i + 1) })) }), "Renumber");
  }, [setDeckH]);

  const resetAll = useCallback(() => {
    setDeckH(
      { header: DEFAULT_HEADER, theme: DEFAULT_THEME, slides: parseQuestions(SAMPLE_INPUT), globalShapes: [] },
      "Reset deck",
    );
    setCurrent(0);
  }, [setDeckH]);

  return {
    deck,
    setDeck,
    current,
    setCurrent,
    setHeader,
    setTheme,
    setThemeScoped,
    setHeaderScoped,
    patchLayout,
    patchLayoutScoped,
    transformLayout,
    transformLayoutScoped,
    updateSlide,
    updateAll,
    transformAll,
    addSlides,
    insertBlank,
    removeSlide,
    duplicateSlide,
    moveSlide,
    addAnswerCopies,
    addShape,
    addImage,
    copyShapeTo,
    updateShape,
    updateShapeOnSlide,
    updateShapesOnSlide,
    updateShapes,
    groupShapes,
    ungroupShapes,
    removeShapes,
    duplicateShapes,
    applyShapeDesign,
    reorderShape,
    reorderLayerOp,
    moveLayerToOp,
    patchLayersOp,
    duplicateLayersOp,
    removeLayersOp,
    alignLayerOp,
    distributeLayersOp,
    removeShape,
    duplicateShape,
    toggleShapeScope,
    applyAnswers,
    setBackground,
    resetBackground,
    clearSlideBackground,
    applyDesign,
    revertDesign,
    renumber,
    resetAll,
    // history
    undo,
    redo,
    canUndo,
    canRedo,
    history,
  };
}
