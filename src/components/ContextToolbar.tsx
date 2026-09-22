import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BackgroundSettings, BannerSettings, BannerShape, Box, BoxFontId, BoxTypeface, DeckHeader, ElementId, OptionsLayout, QuizOption, ThemeSettings,
} from "../lib/types";
import { DEFAULT_FRAME, ELEMENT_LABELS } from "../lib/types";
import { activeSlideDesign, designPatch, loadDesignFonts, neighbourDesign } from "../lib/slideDesigns";
import {
  resetAnswerToolbar,
  resetBackgroundToolbar,
  resetElementToolbar,
  resetFrameToolbar,
  resetLayoutToolbar,
  resetShapeStyle,
  resetThemeToolbar,
  resetToolbarLine,
  type ToolbarResetPatch,
} from "../lib/toolbarReset";
import { TEXT_GRADIENT_PRESETS, bannerBorderStyle, gradientCss } from "../lib/banner";
import {
  TEXT_PART_LABELS, WEIGHTS, boxFontLabel, boxTypeface, elementInk, opacityAlpha, opacityPercent, patchTextPart, setBoxFont, setElementInk, textPartDeckFamily, textPartTypeface,
} from "../lib/boxFonts";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, type ShapeItem, type ShapeKind } from "../lib/shapes";
import type { AlignOp } from "../lib/shapeAlign";
import { usePointerDrag } from "../lib/dragSession";
import { Z_LABELS, type ZOp } from "../lib/zorder";
import { shade, withAlpha } from "../lib/color";
import { BULLET_COLOR_NONE } from "../lib/optionBulletColors";
import { ensureFamily, faceStack, firstFamily, fontChoiceFor } from "../lib/fonts";
import FontPicker from "./FontPicker";
import TextEffectsEditor from "./TextEffectsEditor";
import TextBgShapePanel from "./TextBgShapePanel";
import { bgShapeIsOn, describeBgShape, type TextBgShape } from "../lib/textBgShape";
import OptionBulletShapePicker from "./OptionBulletShapePicker";
import OptionStylePicker from "./OptionStylePicker";
import {
  BorderStyleIcon,
  BulletBorderStylePicker,
  BulletPositionControls,
  BulletRadiusPanel,
  BulletTransparencyPanel,
  BulletWeightPanel,
  TransparencyIcon,
  WeightIcon,
} from "./BulletShapePanel";
import BulletDesignPanel from "./BulletDesignPanel";
import {
  BannerBorderPanel,
  BannerBorderStylePanel,
  BannerEffectsPanel,
  BannerFillPanel,
  BannerPositionPanel,
  BannerPresetPanel,
  BannerRadiusPanel,
  BannerShapePanel,
  BannerSizePanel,
  BannerTransparencyPanel,
  BannerWeightPanel,
  BorderStyleIcon as BannerBorderStyleIcon,
  PositionIcon as BannerPositionIcon,
  SizeIcon as BannerSizeIcon,
  TransparencyIcon as BannerTransparencyIcon,
  WeightIcon as BannerWeightIcon,
  bannerOf,
} from "./BannerDesignPanel";
import QuestionBulletNumberingPanel from "./QuestionBulletNumberingPanel";
import PaintColorPanel from "./PaintColorPanel";
import PlainNumberingPicker from "./PlainNumberingPicker";
import ShapeDesignPanel from "./ShapeDesignPanel";
import FramePanel from "./FramePanel";
import GradientEditor from "./GradientEditor";
import FontColorPanel from "./FontColorPanel";
import { SegButtons, Toggle } from "./ui";
import { useColorFrame } from "../lib/frameSend";
import { cn } from "../utils/cn";
import type { Gradient } from "../lib/types";

const normColor = (v: string): string => {
  const c = String(v ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  return "";
};

/**
 * The toolbar's colour well as a component of its own, so it can own the
 * one-frame commit channel (see useColorFrame).
 */
function Swatch({
  name,
  value,
  onChange,
  glyph,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  glyph?: ReactNode;
}) {
  const dotRef = useRef<HTMLLabelElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<string>(normColor(value));
  const channel = useColorFrame(onChange);
  const paint = (hex: string) => {
    const ink = dotRef.current?.querySelector<HTMLElement>(".ctx-dot, .ctx-a, .ctx-ring");
    if (!ink) return;
    if (ink.classList.contains("ctx-a")) {
      if (ink.style.borderBottomColor !== hex) ink.style.borderBottomColor = hex;
    } else if (ink.classList.contains("ctx-ring")) {
      if (ink.style.borderColor !== hex) ink.style.borderColor = hex;
    } else if (ink.style.background !== hex) {
      ink.style.background = hex;
    }
  };

  useEffect(() => {
    const nv = normColor(value);
    if (!nv || nv === sentRef.current) return;
    sentRef.current = nv;
    if (inputRef.current && inputRef.current.value !== nv) inputRef.current.value = nv;
    paint(nv);
  }, [value]);

  const took = (hex: string) => {
    const v = normColor(hex);
    if (!v) return;
    sentRef.current = v;
    paint(v);
    channel.offer(v);
  };

  return (
    <label className="ctx-swatch" title={name} ref={dotRef}>
      <input
        ref={inputRef}
        aria-label={name} type="color"
        defaultValue={normColor(value) || "#ffffff"}
        onInput={e => took(e.currentTarget.value)}
        onChange={e => took(e.currentTarget.value)}
      />
      {glyph ?? <span className="ctx-dot" style={{ background: value }} />}
    </label>
  );
}

export interface AnswerKeyTools {
  answer: string | null;
  showAnswer: boolean;
  options: QuizOption[];
  onSetAnswer: (key: string | null) => void;
  onToggleReveal: () => void;
  onRevealAll: () => void;
  onHideAll: () => void;
  onClearAll: () => void;
  onPaste: () => void;
  onCopies: () => void;
}

interface Props {
  shape?: ShapeItem; element: ElementId | null; surface: "frame" | "background" | null;
  count: number; grouped: boolean; theme: ThemeSettings; background: BackgroundSettings;
  header?: DeckHeader;
  patchShape: (p: Partial<ShapeItem>) => void; patchTheme: (p: Partial<ThemeSettings>) => void;
  patchBox: (p: Partial<Box>) => void; patchBackground: (p: Partial<BackgroundSettings>) => void;
  patchHeader?: (p: Partial<DeckHeader>) => void;
  align: (op: AlignOp) => void; reorder: (op: ZOp) => void;
  group: () => void; ungroup: () => void; duplicate: () => void; remove: () => void;
  nav?: string | null;
  answerKey?: AnswerKeyTools;
  layerTools?: { total: number };
  insertShape?: (kind: ShapeKind) => void;
  onAddImages?: (files: File[]) => void;
  onPickElement?: (id: ElementId) => void;
  /** the z-preserving layout writer — the canvas drags' own path, used by the position cards */
  patchLayout?: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const INSERT_SHAPES: ShapeKind[] = ["text", "rect", "rounded", "ellipse", "triangle", "diamond", "star", "line", "arrow"];

export type MergedLineId =
  | "titleText"
  | "titleBg"
  | "badge1"
  | "badge2"
  | "questionText"
  | "questionBullet"
  | "bulletText"
  | "optionText"
  | "optionBullet"
  | "optionBulletText";

interface MergedLineMeta {
  chip: string;
  aria: string;
  element: ElementId;
}

const MERGED_LINE: Record<MergedLineId, MergedLineMeta> = {
  titleText: { chip: "Title text", aria: "Title text tools", element: "title" },
  titleBg: { chip: "Title background", aria: "Title background tools", element: "title" },
  badge1: { chip: "Badge 1", aria: "Badge 1 tools", element: "brand" },
  badge2: { chip: "Badge 2", aria: "Badge 2 tools", element: "brand" },
  questionText: { chip: "Question text", aria: "Question text tools", element: "question" },
  questionBullet: { chip: "Question bullet", aria: "Question bullet tools", element: "bullet" },
  bulletText: { chip: "Q bullet text", aria: "Text inside question bullet tools", element: "bullet" },
  optionText: { chip: "Option text", aria: "Option text tools", element: "options" },
  optionBullet: { chip: "Option bullet", aria: "Option bullet tools", element: "options" },
  optionBulletText: { chip: "Bullet text", aria: "Text inside option bullet tools", element: "options" },
};

const LINE_PART: Partial<Record<MergedLineId, BoxFontId>> = {
  titleText: "title",
  badge1: "brandTop",
  badge2: "brandBottom",
  questionText: "question",
  bulletText: "bullet",
  optionText: "options",
  optionBulletText: "optionBullet",
};

const DEFAULT_BOLD = new Set<BoxFontId>(["title", "brand", "brandTop", "brandBottom", "badge", "bullet", "options", "optionBullet"]);

const ELEMENT_SIZE_FIELD: Partial<Record<ElementId, "titleSize" | "badgeSize" | "questionSize" | "optionSize" | "noteSize">> = {
  title: "titleSize",
  badge: "badgeSize",
  question: "questionSize",
  options: "optionSize",
  note: "noteSize",
};

const opacityOf = (t: { opacity?: number }) => opacityPercent(t.opacity);

const caseOf = (t: Pick<BoxTypeface, "textTransform" | "uppercase">): "none" | "uppercase" | "lowercase" =>
  t.textTransform ?? (t.uppercase === true || t.uppercase === "uppercase" ? "uppercase" : t.uppercase === "lowercase" ? "lowercase" : "none");

const LISTING_NAV = new Set<string | undefined>(["layers", undefined]);

const ELEMENT_LEAD_LINE: Partial<Record<ElementId, MergedLineId>> = {
  title: "titleText",
  brand: "badge1",
  question: "questionText",
  bullet: "questionBullet",
  options: "optionText",
};

const MERGED_GROUP: Record<string, MergedLineId[]> = {
  titleText: ["titleText", "titleBg"],
  titleBg: ["titleText", "titleBg"],
  badge1: ["badge1", "badge2"],
  badge2: ["badge1", "badge2"],
  questionText: ["questionText", "questionBullet", "bulletText"],
  questionBullet: ["questionText", "questionBullet", "bulletText"],
  bulletText: ["questionText", "questionBullet", "bulletText"],
  optionText: ["optionText", "optionBullet", "optionBulletText"],
  optionBullet: ["optionText", "optionBullet", "optionBulletText"],
  optionBulletText: ["optionText", "optionBullet", "optionBulletText"],
};

export function mergedLinesFor(
  nav: string | null | undefined,
  element: ElementId | null,
  theme: ThemeSettings,
): MergedLineId[] | null {
  if (!element) return null;
  const open = nav ?? "";
  const dest = (MERGED_GROUP[open] ? open : undefined) ?? (LISTING_NAV.has(nav ?? undefined) ? ELEMENT_LEAD_LINE[element] : undefined);
  const group = dest ? MERGED_GROUP[dest] : undefined;
  if (!group) return null;
  const lines = group.filter((id) => !(id === "questionText" && theme.bulletSeparate));
  if (!lines.length) return null;
  return lines.some((id) => MERGED_LINE[id].element === element) ? lines : null;
}

/**
 * The stylish silhouettes as marks — the same cut the plate wears on the board,
 * drawn in the 18 × 16 box the toolbar's icon lives in.
 */
const SHAPE_MARK_POLY: Partial<Record<BannerShape, string>> = {
  hex: "1.6,8 4.8,3.4 13.2,3.4 16.4,8 13.2,12.6 4.8,12.6",
  notch: "4.4,3.4 16.4,3.4 16.4,9.8 13.6,12.6 1.6,12.6 1.6,6.2",
  chevron: "1.6,3.4 12.4,3.4 16.4,8 12.4,12.6 1.6,12.6",
  swallow: "1.6,3.4 16.4,3.4 13,8 16.4,12.6 1.6,12.6",
  slant: "5,3.4 16.4,3.4 13,12.6 1.6,12.6",
};

/** the tab and the arch: rounded on top, flat along the bottom */
const SHAPE_MARK_PATH: Partial<Record<BannerShape, string>> = {
  tab: "M1.6 12.6 V6.2 A2.8 2.8 0 0 1 4.4 3.4 H13.6 A2.8 2.8 0 0 1 16.4 6.2 V12.6 Z",
  arch: "M1.6 12.6 V8 A7.4 7.4 0 0 1 16.4 8 V12.6 Z",
};

/** the multilayer silhouettes: the plate plus the layers peeking out behind it */
const SHAPE_MARK_LAYERS: BannerShape[] = ["stack", "frame", "accent", "offsetLine", "longShadow", "gradStack"];

/** the multilayer gradient silhouettes: one plate, several stacked paints */
const SHAPE_MARK_GRADIENT: BannerShape[] = ["sheen", "split", "gloss", "stripes"];

/** the title plate as a little mark — its current silhouette, worn by the bar */
function ShapeGlyph({ shape }: { shape: BannerShape }) {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
      {shape === "none" ? (
        <rect x="1.4" y="2.6" width="15.2" height="10.8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2.4" />
      ) : shape === "glow" ? (
        <>
          <defs>
            <radialGradient id="ctx-banner-glow-mark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="9" cy="8" rx="7.8" ry="5.4" fill="url(#ctx-banner-glow-mark)" />
        </>
      ) : shape === "underline" ? (
        <rect x="1.6" y="10.4" width="14.8" height="2.8" rx="1.4" fill="currentColor" />
      ) : SHAPE_MARK_POLY[shape] ? (
        <polygon points={SHAPE_MARK_POLY[shape]} fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      ) : SHAPE_MARK_PATH[shape] ? (
        <path d={SHAPE_MARK_PATH[shape]} fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      ) : SHAPE_MARK_LAYERS.includes(shape) ? (
        <>
          {/* the layers behind, then the plate itself on top */}
          <rect x="4.4" y="5.6" width="12" height="7.6" rx="2" fill="currentColor" fillOpacity="0.16" />
          <rect x="3" y="4.5" width="12" height="7.6" rx="2" fill="currentColor" fillOpacity="0.28" />
          <rect x="1.6" y="3.4" width="12" height="7.6" rx="2" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.2" />
          {shape === "accent" ? <rect x="1.6" y="3.4" width="3.2" height="7.6" rx="2" fill="currentColor" /> : null}
        </>
      ) : SHAPE_MARK_GRADIENT.includes(shape) ? (
        <>
          <rect x="1.6" y="3.4" width="14.8" height="9.2" rx="2.8" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeWidth="1.4" />
          {/* the second paint, laid over the first — the stack the plate wears */}
          <path
            d={
              shape === "sheen"
                ? "M6.4 3.6 3.4 12.4h2.6l3-8.8z"
                : shape === "split"
                  ? "M9 3.6v8.8h5.4a2 2 0 0 0 2-2V5.6a2 2 0 0 0-2-2z"
                  : shape === "gloss"
                    ? "M3.4 4.4h11.2v2.6H3.4z"
                    : "M3.6 3.6h1.6l-2 8.8H1.6zM8 3.6h1.6l-2 8.8H6zM12.4 3.6H14l-2 8.8h-1.6z"
            }
            fill="currentColor"
            fillOpacity="0.55"
          />
        </>
      ) : (
        <rect
          x="1.6"
          y="3.4"
          width="14.8"
          height="9.2"
          rx={shape === "pill" ? 4.6 : shape === "rounded" ? 2.8 : 0.8}
          fill="currentColor"
          fillOpacity="0.24"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}

/** the Design presets mark: a little gallery with a sparkle */
const PRESET_GLYPH = (
  <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2.4" y="2.4" width="6.4" height="6.4" rx="1.7" />
    <rect x="11.2" y="2.4" width="6.4" height="6.4" rx="1.7" />
    <rect x="2.4" y="11.2" width="6.4" height="6.4" rx="1.7" />
    <path
      d="M14.4 10.4c.5 1.6 1.5 2.5 3 3-1.5.5-2.5 1.5-3 3.1-.5-1.6-1.4-2.6-3-3.1 1.6-.5 2.5-1.4 3-3Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

const BADGE_LINE = {
  badge1: { n: 1, size: "brandTopSize", color: "brandTopColor", show: "showBrandTop", fallback: 25 },
  badge2: { n: 2, size: "brandBottomSize", color: "brandBottomColor", show: "showBrandBottom", fallback: 27 },
} as const;

const ALIGN_GLYPH: Record<"left" | "center" | "right" | "justify", ReactNode> = {
  left: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="12" height="1.8" rx="0.9" />
      <rect x="1" y="6.1" width="8" height="1.8" rx="0.9" />
      <rect x="1" y="10.2" width="10" height="1.8" rx="0.9" />
    </svg>
  ),
  center: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="12" height="1.8" rx="0.9" />
      <rect x="3" y="6.1" width="8" height="1.8" rx="0.9" />
      <rect x="2" y="10.2" width="10" height="1.8" rx="0.9" />
    </svg>
  ),
  right: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="12" height="1.8" rx="0.9" />
      <rect x="5" y="6.1" width="8" height="1.8" rx="0.9" />
      <rect x="3" y="10.2" width="10" height="1.8" rx="0.9" />
    </svg>
  ),
  justify: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="12" height="1.8" rx="0.9" />
      <rect x="1" y="6.1" width="12" height="1.8" rx="0.9" />
      <rect x="1" y="10.2" width="12" height="1.8" rx="0.9" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Font color editing context – Canva style                          */
/* ------------------------------------------------------------------ */

interface FontColorCtx {
  key: string; // unique id for toggle behavior
  label: string;
  solid: string;
  gradient?: Gradient;
  onSolid: (hex: string) => void;
  onGradient: (g: Gradient) => void;
  onClearGradient: () => void;
  docColors: string[];
}

/**
 * A shape's paint channel (the question marker's Fill and Border): the same
 * solid + gradient card the text colour opens, with the two extra states a
 * shape has — Auto (the design paints its own body / line) and None.
 */
interface PaintCtx {
  key: string; // unique id for toggle behavior
  label: string;
  /** "" = auto · "transparent" = none · "#rrggbb" = the picked colour */
  value: string;
  gradient?: Gradient;
  /** the colour Auto resolves to right now */
  fallback: string;
  docColors: string[];
  onSolid: (hex: string) => void;
  onGradient: (g: Gradient) => void;
  onClearGradient: () => void;
  onAuto: () => void;
  onNone?: () => void;
}

/** the pop-ups that need the wide card (a colour grid, a design gallery) */
const WIDE_PANELS = new Set(["TextColor", "Paint", "Bullet design", "Design", "Numbering"]);
const widePanel = (panel: string | null) => !!panel && WIDE_PANELS.has(panel);

/** the droplet a paint button wears over its current colour */
const PAINT_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M7 1.4 11.2 6a4.6 4.6 0 0 1-3.2 7.8A4.6 4.6 0 0 1 4.8 6L7 1.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M7 1.4 11.2 6a4.6 4.6 0 0 1-1 6.5L7 1.4Z" fill="currentColor" opacity=".55" />
  </svg>
);

/** Canva's corner-radius icon: one corner pulled round */
const RADIUS_GLYPH = (
  <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
    <rect x="2.6" y="2.6" width="14.8" height="14.8" rx="6" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".5" />
    <path d="M3.4 13.2A9.8 9.8 0 0 1 13.2 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="13.4" cy="13.4" r="1.7" fill="currentColor" />
  </svg>
);

/** premium design mark: a polished crown with a sparkle — the design+ glyph */
const PREMIUM_DESIGN_GLYPH = (
  <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="m3.1 5.1 3.7 3.3L10 3.2l3.2 5.2 3.7-3.3-1.1 10H4.2l-1.1-10Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinejoin="round"
    />
    <path d="M4.1 12.2h11.8l-.4 2.9H4.5l-.4-2.9Z" fill="currentColor" opacity=".82" />
    <path d="M16.2 1.2c.35 1.03.98 1.65 2 2.02-1.02.37-1.65.99-2 2.02-.36-1.03-.98-1.65-2.01-2.02 1.03-.37 1.65-.99 2.01-2.02Z" fill="currentColor" />
  </svg>
);

/** numbering option icon: "1. 2. 3." list with a subtle accent */
const NUMBERING_GLYPH = (
  <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="3.6" cy="4.2" r="1.2" fill="currentColor" />
    <path d="M7.2 4.2h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <circle cx="3.6" cy="9.2" r="1.2" fill="currentColor" opacity="0.75" />
    <path d="M7.2 9.2h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <circle cx="3.6" cy="14.2" r="1.2" fill="currentColor" opacity="0.55" />
    <path d="M7.2 14.2h6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    <path d="M15.2 11.8h2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
  </svg>
);

export default function ContextToolbar(p: Props) {
  const [panel, setPanel] = useState<string | null>(null);
  const [fontColorCtx, setFontColorCtx] = useState<FontColorCtx | null>(null);
  const [paintCtx, setPaintCtx] = useState<PaintCtx | null>(null);
  /**
   * The newest context for every font-colour button, rebuilt on each render.
   * The open popover reads its entry from here instead of the snapshot taken
   * when it was opened — the panel edits a live value, so a second edit in the
   * custom gradient builder (a new colour stop, a switch to mesh) must build on
   * the first one instead of silently starting over from the opened value.
   */
  const liveFontCtx = useRef<Map<string, FontColorCtx>>(new Map());
  /** the same live re-registration for a paint channel (Fill · Border) */
  const livePaintCtx = useRef<Map<string, PaintCtx>>(new Map());
  const { shape: s, element: el, surface, theme, patchShape: patch } = p;
  const ak = p.answerKey;
  const multi = p.count > 1 || p.grouped;
  const text = !surface && !multi && (s?.kind === "text" || (!!el && el !== "logo" && !s));
  const tf = el ? boxTypeface(theme, el) : {};
  const fontPatch = (v: Parameters<typeof setBoxFont>[2]) => el && p.patchTheme({ boxFonts: setBoxFont(theme.boxFonts, el, v) });

  const stack = !surface && !multi && !s ? mergedLinesFor(p.nav, el, theme) : null;
  const activeLine = stack?.find((id) => id === p.nav) ?? (el ? ELEMENT_LEAD_LINE[el] : undefined);
  const banner: BannerSettings = bannerOf(theme);
  const patchBanner = (patch: Partial<BannerSettings>) =>
    p.patchTheme({ banner: { ...banner, ...patch }, ...(patch.color ? { titleBanner: patch.color } : {}) });
  const patchLine = (patch: Record<string, unknown>) => p.patchTheme(patch as Partial<ThemeSettings>);
  const partTf = (part: BoxFontId): BoxTypeface => textPartTypeface(theme, part);
  const setPart = (part: BoxFontId, patch: Partial<BoxTypeface>) => p.patchTheme(patchTextPart(theme, part, patch));
  const partInk = (part: BoxFontId) => elementInk(theme, part);
  const partPreview = (part: BoxFontId) => (part === "optionBullet" ? "optionBullet" : `box:${part}`);
  const optionBase = theme.optionAccent || theme.accent || "#2f4fff";
  const picked = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : optionBase);
  const markerWeight = theme.optionBulletTextWeight ?? 0;

  // document colors – deduped theme colors
  const docColors = useMemo(() => {
    const raw = [
      theme.accent,
      theme.board,
      theme.brandColor,
      theme.titleColor,
      theme.questionColor,
      theme.optionTextColor,
      theme.badgeColor,
      theme.optionAccent,
      theme.brandTopColor,
      theme.brandBottomColor,
      theme.noteColor,
      theme.titleBanner,
      banner.color,
    ].filter(Boolean) as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of raw) {
      const n = normColor(c);
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out.slice(0, 12);
  }, [theme, banner.color]);

  // clear fontColorCtx when panel is not TextColor
  useEffect(() => {
    if (panel !== "TextColor") setFontColorCtx(null);
  }, [panel]);

  /**
   * An open popover follows the slide. Every font-colour button re-registers its
   * context on each render (`liveFontCtx`), so as soon as the deck changes the
   * open panel re-reads its own entry — otherwise it would keep editing the
   * value it was opened with and each new edit would drop the one before it.
   * Compared by value, so this settles after one extra render instead of looping.
   */
  useEffect(() => {
    if (panel !== "TextColor" || !fontColorCtx) return;
    const live = liveFontCtx.current.get(fontColorCtx.key);
    if (!live) return;
    if (live.solid === fontColorCtx.solid && live.gradient === fontColorCtx.gradient) return;
    setFontColorCtx(live);
  });

  const openFontColor = (ctx: FontColorCtx) => {
    // toggle if same key
    if (panel === "TextColor" && fontColorCtx?.key === ctx.key) {
      setPanel(null);
      return;
    }
    setFontColorCtx(ctx);
    setPanel("TextColor");
  };

  // clear paintCtx when the panel is not a paint card
  useEffect(() => {
    if (panel !== "Paint") setPaintCtx(null);
  }, [panel]);

  /** an open paint card follows the deck, exactly like the colour card does */
  useEffect(() => {
    if (panel !== "Paint" || !paintCtx) return;
    const live = livePaintCtx.current.get(paintCtx.key);
    if (!live) return;
    if (live.value === paintCtx.value && live.gradient === paintCtx.gradient) return;
    setPaintCtx(live);
  });

  const openPaint = (ctx: PaintCtx) => {
    // toggle if same key
    if (panel === "Paint" && paintCtx?.key === ctx.key) {
      setPanel(null);
      return;
    }
    setPaintCtx(ctx);
    setPanel("Paint");
  };

  const popRef = useRef<HTMLDivElement | null>(null);
  const popBox = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 480, h: 280 });
  const [popPos, setPopPos] = useState<{ x: number; y: number; w: number } | null>(null);

  /**
   * A pop-up card docks to the right edge of the window, hanging from just
   * under the top bar. Its real height is measured rather than assumed, so the
   * card stays correctly docked if the responsive chrome changes.
   */
  const [topBarH, setTopBarH] = useState(56);
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector<HTMLElement>(".app-shell > header");
      const bottom = Math.round(bar?.getBoundingClientRect().bottom ?? 0);
      if (bottom > 0) setTopBarH(bottom);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [panel]);
  /** right inset of the docked card, and the gap it hangs below the top bar */
  const DOCK_INSET = 10;
  const DOCK_GAP = 6;

  const measurePop = () => {
    const node = popRef.current;
    const r = node?.getBoundingClientRect();
    const w = Math.round(r?.width || node?.offsetWidth || 0) || 480;
    const h = Math.round(r?.height || node?.offsetHeight || 0) || 280;
    return { x: Math.round(r?.left ?? 0), y: Math.round(r?.top ?? 0), w, h };
  };

  const clampPop = (x: number, y: number, w: number) => {
    const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    return {
      x: Math.round(Math.min(Math.max(x, 96 - w), Math.max(8, vw - 96))),
      y: Math.round(Math.min(Math.max(y, 4), Math.max(4, vh - 48))),
    };
  };

  const popPosRef = useRef<{ x: number; y: number; w: number } | null>(null);
  const movePop = (next: { x: number; y: number; w: number } | null) => {
    popPosRef.current = next;
    setPopPos(next);
  };

  const { begin: beginPop, end: endPop } = usePointerDrag({
    onMove: (e, st) => {
      const pos = clampPop(
        st.initialObjectX + (e.clientX - st.dragStartX),
        st.initialObjectY + (e.clientY - st.dragStartY),
        popBox.current.w,
      );
      movePop({ x: pos.x, y: pos.y, w: popBox.current.w });
    },
  });

  const startPopDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea, a")) return;
    const box = measurePop();
    popBox.current = box;
    beginPop(e, { x: box.x, y: box.y });
  };

  useEffect(() => {
    const onResize = () => {
      const cur = popPosRef.current;
      if (!cur) return;
      const pos = clampPop(cur.x, cur.y, cur.w);
      if (pos.x !== cur.x || pos.y !== cur.y) movePop({ ...cur, ...pos });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const button = (content: ReactNode, action: () => void, active?: boolean, title?: string, tone?: "danger") => {
    const name = title ?? (typeof content === "string" ? content : undefined);
    return (
      <button
        type="button"
        className={`ctx-btn${active ? " is-on" : ""}${tone === "danger" ? " danger" : ""}`}
        title={name}
        aria-label={name}
        aria-pressed={active}
        onClick={action}
      >
        {content}
      </button>
    );
  };
  /**
   * Icon-bearing toggles stay icon-only in the bar. Their complete name remains
   * available to assistive technology and as a hover tooltip; this keeps every
   * toolbar on one line without making repeated part names consume its width.
   */
  const toggle = (name: string, icon?: ReactNode, display?: ReactNode) => (
    <button
      type="button"
      className={cn("ctx-btn ctx-toggle", icon && "ctx-icon-toggle", panel === name && "is-on")}
      title={name}
      aria-label={name}
      aria-pressed={panel === name}
      aria-expanded={panel === name}
      onClick={() => setPanel(panel === name ? null : name)}
    >
      {display ?? icon ?? name}
      <span className="ctx-caret" aria-hidden="true">▾</span>
    </button>
  );
  /**
   * "Background shape" — the plate painted behind a text part. One button on
   * every text toolbar, right before its Default, opening the pop-up with the
   * presets, silhouettes, colours, border, transparency, effects and position.
   * The icon fills in while the part has a plate on, so the state reads from
   * the bar without opening the card.
   */
  const bgToggle = (name: string, shape: TextBgShape | undefined) => {
    const on = bgShapeIsOn(shape);
    const open = panel === name;
    return (
      <button
        type="button"
        className={cn("ctx-btn ctx-toggle ctx-icon-toggle", open && "is-on")}
        title={`${name}: ${describeBgShape(shape)}`}
        aria-label={name}
        aria-pressed={open}
        aria-expanded={open}
        data-bg-shape={on ? "on" : "off"}
        onClick={() => setPanel(open ? null : name)}
      >
        <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
          <rect x="1" y="1.5" width="16" height="13" rx="3.5" fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.32 : 0} stroke="currentColor" strokeWidth="1.5" />
          <text x="9" y="12" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="currentColor" fontFamily="Inter, system-ui, sans-serif">A</text>
        </svg>
        <span className="ctx-caret" aria-hidden="true">▾</span>
      </button>
    );
  };
  /**
   * The font control reads the face the board really paints — "Kalpurush",
   * "Oswald" — drawn in that face, Canva-style, instead of naming the part it
   * belongs to ("Question text font"). The part stays in the accessible name
   * and the tooltip, and `name` is still the key of the pop-up it opens.
   * `inherited` marks a part with no face of its own (it follows the deck font).
   */
  const fontToggle = (name: string, family: string, inherited: boolean) => {
    const shown = fontChoiceFor(family)?.label || family || "Default";
    const on = panel === name;
    const tag = inherited ? " (deck default)" : "";
    return (
      <button
        type="button"
        className={cn("ctx-btn ctx-toggle ctx-font-toggle", on && "is-on")}
        title={`${name}: ${shown}${tag}`}
        aria-label={`${name}: ${shown}${tag}`}
        aria-pressed={on}
        aria-expanded={on}
        data-current-font={family || undefined}
        data-inherited={inherited ? "true" : undefined}
        onClick={() => setPanel(on ? null : name)}
      >
        <span className="ctx-font-name" style={family ? { fontFamily: faceStack(family) } : undefined}>{shown}</span>
        <span className="ctx-caret" aria-hidden="true">▾</span>
      </button>
    );
  };
  const sep = () => <span className="ctx-sep" aria-hidden="true" />;
  /**
   * Apply a Default-button patch. Theme / header / background go through the
   * same scoped setters the rest of the toolbar uses, so one click is one
   * undo step on this slide.
   */
  const applyReset = (next: ToolbarResetPatch) => {
    if (next.theme && Object.keys(next.theme).length) p.patchTheme(next.theme);
    if (next.header && Object.keys(next.header).length) p.patchHeader?.(next.header);
    if (next.background) p.patchBackground(next.background);
    if (next.shape) patch(next.shape);
  };
  /** Default — restore this toolbar's factory look, without changing the wording on the slide. */
  const defaultBtn = (what: string, action: () => void) => (
    <>
      {sep()}
      <button
        type="button"
        className="ctx-btn ctx-default"
        title={`Reset ${what} to default`}
        aria-label={`Reset ${what} to default`}
        data-toolbar-default=""
        onClick={action}
      >
        Default
      </button>
    </>
  );
  const stepper = (
    name: string, value: number, onChange: (v: number) => void,
    min = 0, max = 200, step = 1,
    opts: { prefix?: ReactNode; dec?: string; inc?: string; jump?: number } = {},
  ) => {
    const clamp = (v: number) => {
      const decimals = Math.max(2, (String(step).split(".")[1] ?? "").length);
      return Number(Math.max(min, Math.min(max, v)).toFixed(decimals));
    };
    const jump = opts.jump ?? step;
    const dec = opts.dec ?? `Decrease ${name}`;
    const inc = opts.inc ?? `Increase ${name}`;
    return (
      <span className="ctx-step" role="group" aria-label={name} title={name}>
        {opts.prefix !== undefined && <span className="ctx-prefix" aria-hidden="true">{opts.prefix}</span>}
        <button type="button" aria-label={dec} title={dec} onClick={() => onChange(clamp(value - jump))}>−</button>
        <input
          aria-label={name} type="number" value={value} min={min} max={max} step={step}
          onChange={e => { const v = e.currentTarget.valueAsNumber; if (Number.isFinite(v)) onChange(clamp(v)); }}
        />
        <button type="button" aria-label={inc} title={inc} onClick={() => onChange(clamp(value + jump))}>+</button>
      </span>
    );
  };
  const swatch = (name: string, value: string, change: (v: string) => void, glyph?: ReactNode, id?: string) => (
    <Swatch key={id ?? name} name={name} value={value} onChange={change} glyph={glyph} />
  );

  // Canva-style font color button – opens FontColorPanel
  const fontColorBtn = (
    key: string,
    label: string,
    solid: string,
    gradient: Gradient | undefined,
    onSolid: (hex: string) => void,
    onGradient: (g: Gradient) => void,
    onClear: () => void,
  ) => {
    const isActive = panel === "TextColor" && fontColorCtx?.key === key;
    const gradCss = gradient?.enabled ? gradientCss(gradient, solid || "#ffffff") : undefined;
    const solidHex = normColor(solid) || "#ffffff";
    const ctx: FontColorCtx = {
      key,
      label,
      solid: solidHex,
      gradient,
      onSolid,
      onGradient,
      onClearGradient: onClear,
      docColors,
    };
    // refreshed every render so an open popover always sees the current value
    liveFontCtx.current.set(key, ctx);
    return (
      <button
        key={key}
        type="button"
        title={`${label} – ${gradCss ? "gradient" : solidHex}`}
        aria-label={label}
        aria-pressed={isActive}
        className={cn("ctx-btn ctx-font-color", isActive && "is-on")}
        onClick={() => openFontColor(ctx)}
      >
        <span className="ctx-font-preview" aria-hidden="true">
          {gradCss ? (
            <span className="ctx-font-grad" style={{ background: gradCss }} />
          ) : (
            <span className="ctx-font-solid" style={{ background: solidHex }} />
          )}
          <span className="ctx-a" style={{ borderBottomColor: gradCss ? "transparent" : solidHex }}>
            A
          </span>
        </span>
      </button>
    );
  };

  /**
   * A **paint** button — a shape channel's colour. Its name is spelled out
   * ("Fill", "Border") and the picker icon wears the paint that is on right now:
   * the solid colour, the gradient, the checker of "none", or a hollow droplet
   * while the design paints its own. Clicking opens the same solid + gradient
   * card the text colour opens, with Auto and None on top of it.
   */
  const paintColorBtn = (ctx: PaintCtx) => {
    livePaintCtx.current.set(ctx.key, ctx);
    const isActive = panel === "Paint" && paintCtx?.key === ctx.key;
    const gradCss = ctx.gradient?.enabled ? gradientCss(ctx.gradient, ctx.value || ctx.fallback) : undefined;
    const none = ctx.value === "transparent";
    const auto = !ctx.value;
    const paintCss = none
      ? "repeating-conic-gradient(#3a3a44 0% 25%, #16181f 0% 50%) 50% / 6px 6px"
      : gradCss || (/^#[0-9a-f]{3,8}$/i.test(ctx.value) ? ctx.value : undefined);
    const state = none ? "none" : gradCss ? "gradient" : auto ? `auto · ${ctx.fallback}` : String(ctx.value).toUpperCase();
    return (
      <button
        key={ctx.key}
        type="button"
        className={cn("ctx-btn ctx-paint", isActive && "is-on")}
        title={`${ctx.label} — ${state}`}
        aria-label={ctx.label}
        aria-pressed={isActive}
        aria-expanded={isActive}
        onClick={() => openPaint(ctx)}
      >
        <span className="ctx-paint-name">{ctx.label}</span>
        <span className="ctx-paint-icon" aria-hidden="true">
          <span
            className={cn("ctx-paint-bar", (auto || none) && "is-plain")}
            style={paintCss ? { background: paintCss } : undefined}
          />
          <span className={cn("ctx-paint-drop", auto && "is-auto", none && "is-none")}>{PAINT_GLYPH}</span>
        </span>
        <span className="ctx-caret" aria-hidden="true">▾</span>
      </button>
    );
  };

  // the face picked for this text itself, and what the board paints without
  // one (a text box follows the question face): the toolbar's font button and
  // the picker in its pop-up both name the current font from these two, never
  // a bare "Default"
  const textFontOwn = s ? (s.fontFamily ?? "") : el ? (tf.family ?? "") : "";
  const textFontDeck = s ? boxFontLabel(theme, "question") : el ? textPartDeckFamily(theme, el) : "";

  let content: ReactNode = null;
  if (panel === "Font" && text) content = (
    <FontPicker
      label="Font family (all Google Fonts)"
      script="all"
      compact
      previewTarget={s ? `shape:${s.id}` : el ? `box:${el}` : undefined}
      value={textFontOwn}
      fallback={textFontDeck}
      onChange={family => {
        ensureFamily(family);
        if (s) patch({ fontFamily: family });
        else fontPatch({ family: family || undefined });
      }}
    />
  );
  if (panel === "TextColor" && fontColorCtx) {
    content = (
      <FontColorPanel
        solid={fontColorCtx.solid}
        gradient={fontColorCtx.gradient}
        onSolid={fontColorCtx.onSolid}
        onGradient={fontColorCtx.onGradient}
        onClearGradient={fontColorCtx.onClearGradient}
        documentColors={fontColorCtx.docColors}
        title={fontColorCtx.label}
      />
    );
  }
  if (panel === "Paint" && paintCtx) {
    const live = livePaintCtx.current.get(paintCtx.key) ?? paintCtx;
    content = (
      <PaintColorPanel
        label={live.label}
        value={live.value}
        gradient={live.gradient}
        fallback={live.fallback}
        documentColors={live.docColors}
        onSolid={live.onSolid}
        onGradient={live.onGradient}
        onClearGradient={live.onClearGradient}
        onAuto={live.onAuto}
        onNone={live.onNone}
      />
    );
  }
  if (panel === "Spacing" && text) content = (
    <div className="space-y-2">
      <div className="ctx-field">
        <span>Letter spacing</span>
        {stepper("Letter spacing", s?.letterSpacing ?? tf.letterSpacing ?? 0, v => s ? patch({ letterSpacing: v }) : fontPatch({ letterSpacing: v }), -10, 50, .5)}
      </div>
      <div className="ctx-field">
        <span>Line height</span>
        {stepper("Line height", s?.lineHeight ?? tf.lineHeight ?? 1.4, v => s ? patch({ lineHeight: v }) : fontPatch({ lineHeight: v }), 0, 99999, .05)}
      </div>
      <div className="ctx-field">
        <span>Opacity % (100 = fully visible)</span>
        {stepper("Opacity %", s ? opacityPercent(s.textOpacity) : opacityOf(tf), v => {
          const op = opacityAlpha(v);
          if (s) patch({ textOpacity: op });
          else fontPatch({ opacity: op });
        }, 0, 100, 5)}
      </div>
    </div>
  );
  if (panel === "Effects" && text) {
    if (s && !multi) {
      content = <ShapeDesignPanel shape={s} onChange={patch} fallbackFamily={boxFontLabel(theme, "question")} />;
    } else if (el) {
      content = effectsContent(el);
    }
  }
  if (panel === "Background shape" && text) {
    if (s && !multi) {
      content = (
        <TextBgShapePanel
          value={s.textBgShape}
          onChange={textBgShape => patch({ textBgShape })}
          textColor={s.textColor || "#ffffff"}
          accent={theme.accent}
        />
      );
    } else if (el && el !== "logo") {
      content = bgShapeContent(el);
    }
  }
  if (panel === "Frame") content = <FramePanel theme={theme} setTheme={p.patchTheme} />;
  if (panel === "Gradient") content = <GradientEditor label="Background gradient" value={p.background.gradient} fallback={theme.board} onChange={gradient => p.patchBackground({ gradient })} />;
  if (panel === "Background effects") content = (
    <div>
      <div className="ctx-field"><span>Blur</span>{stepper("Blur", p.background.blur, blur => p.patchBackground({ blur }), 0, 30)}</div>
      <div className="ctx-field"><span>Vignette</span>{stepper("Vignette", p.background.vignette, vignette => p.patchBackground({ vignette }), 0, 100)}</div>
    </div>
  );
  if (panel === "Position") content = positionContent(el && el !== "logo" ? el : undefined);
  function positionContent(part?: BoxFontId): ReactNode {
    const curBox = el ? theme.layout[el] : undefined;
    const t = part ? partTf(part) : undefined;
    return (
      <div className="space-y-3">
        {part && t && (
          <div className="space-y-1 text-xs">
            <p className="ctx-menu-cap">Text position — {TEXT_PART_LABELS[part]} only (px nudge inside its box)</p>
            <div className="ctx-field"><span>Text offset X</span>{stepper(`${TEXT_PART_LABELS[part]} offset X`, t.offsetX ?? 0, v => setPart(part, { offsetX: v || undefined }), -99999, 99999, 1)}</div>
            <div className="ctx-field"><span>Text offset Y</span>{stepper(`${TEXT_PART_LABELS[part]} offset Y`, t.offsetY ?? 0, v => setPart(part, { offsetY: v || undefined }), -99999, 99999, 1)}</div>
          </div>
        )}
        {s && (s.kind === "text" || s.text) && (
          <div className="space-y-1 text-xs">
            <p className="ctx-menu-cap">Text position — the text only (px nudge inside its box)</p>
            <div className="ctx-field"><span>Text offset X</span>{stepper("Text offset X", s.textOffsetX ?? 0, v => patch({ textOffsetX: v || undefined }), -99999, 99999, 1)}</div>
            <div className="ctx-field"><span>Text offset Y</span>{stepper("Text offset Y", s.textOffsetY ?? 0, v => patch({ textOffsetY: v || undefined }), -99999, 99999, 1)}</div>
          </div>
        )}
        {s && (
          <div className="space-y-1 text-xs">
            <p className="ctx-menu-cap">Coordinates & Size</p>
            <div className="ctx-field"><span>Position X %</span>{stepper("Position X %", s.x, v => patch({ x: v }), -50, 150, 0.5)}</div>
            <div className="ctx-field"><span>Position Y %</span>{stepper("Position Y %", s.y, v => patch({ y: v }), -50, 150, 0.5)}</div>
            <div className="ctx-field"><span>Width %</span>{stepper("Width %", s.w, v => patch({ w: v }), 1, 150, 0.5)}</div>
            <div className="ctx-field"><span>Height %</span>{stepper("Height %", s.h, v => patch({ h: v }), 1, 150, 0.5)}</div>
            <div className="ctx-field"><span>Rotation °</span>{stepper("Rotation °", s.rot ?? 0, v => patch({ rot: v }), -180, 180, 1)}</div>
          </div>
        )}
        {curBox && (
          <div className="space-y-1 text-xs">
            <p className="ctx-menu-cap">Coordinates & Size</p>
            <div className="ctx-field"><span>Position X %</span>{stepper("Position X %", curBox.x, v => p.patchBox({ x: v }), -50, 150, 0.5)}</div>
            <div className="ctx-field"><span>Position Y %</span>{stepper("Position Y %", curBox.y, v => p.patchBox({ y: v }), -50, 150, 0.5)}</div>
            <div className="ctx-field"><span>Width %</span>{stepper("Width %", curBox.w, v => p.patchBox({ w: v }), 1, 150, 0.5)}</div>
            <div className="ctx-field"><span>Rotation °</span>{stepper("Rotation °", curBox.rot ?? 0, v => p.patchBox({ rot: v }), -180, 180, 1)}</div>
          </div>
        )}
        <p className="ctx-menu-cap">Arrange</p>
        <div className="ctx-menu-grid">{(["front", "forward", "backward", "back"] as ZOp[]).map(op => <span key={op}>{button(<>{Z_LABELS[op].icon} {Z_LABELS[op].label}</>, () => p.reorder(op), undefined, `${Z_LABELS[op].label} — ${Z_LABELS[op].hint}`)}</span>)}</div>
        <p className="ctx-menu-cap">Align to slide</p>
        <div className="ctx-menu-grid">{([['left', 'Align left'], ['hcenter', 'Align center'], ['right', 'Align right'], ['top', 'Align top'], ['vcenter', 'Align middle'], ['bottom', 'Align bottom']] as [AlignOp, string][]).map(([op, label]) => <span key={op}>{button(label, () => p.align(op))}</span>)}</div>
      </div>
    );
  }
  function spacingContent(part: BoxFontId): ReactNode {
    const t = partTf(part);
    return (
      <div className="space-y-2">
        <p className="ctx-menu-cap">{TEXT_PART_LABELS[part]} only</p>
        <div className="ctx-field">
          <span>Letter spacing px</span>
          {stepper("Letter spacing", t.letterSpacing ?? 0, v => setPart(part, { letterSpacing: v }), -50, 99999, .5)}
        </div>
        <div className="ctx-field">
          <span>Line spacing</span>
          {stepper("Line spacing", t.lineHeight ?? 1.4, v => setPart(part, { lineHeight: v }), 0, 99999, .05)}
        </div>
        <div className="ctx-field">
          <span>Opacity % (100 = fully visible)</span>
          {stepper("Opacity %", opacityOf(t), v => setPart(part, { opacity: opacityAlpha(v) }), 0, 100, 5)}
        </div>
      </div>
    );
  }
  function effectsContent(part: BoxFontId, extra?: ReactNode): ReactNode {
    const t = partTf(part);
    const stroke = t.textStroke ?? { enabled: false, color: "#000000", width: 1 };
    return (
      <div className="space-y-2">
        <p className="ctx-menu-cap">{TEXT_PART_LABELS[part]} only</p>
        <TextEffectsEditor value={t.effect} onChange={effect => setPart(part, { effect })} textColor={partInk(part) || "#ffffff"} compact />
        {extra}
        <details>
          <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">More: drop shadow · glow · stroke</summary>
          <div className="space-y-2 pt-2">
            <Toggle label="Text drop shadow" checked={!!t.textShadow} onChange={v => setPart(part, { textShadow: v })} />
            <div className="ctx-field">
              <span>Text glow</span>
              {stepper("Text glow", t.textGlow ?? 0, v => setPart(part, { textGlow: v }), 0, 50, 1)}
            </div>
            <Toggle
              label="Text stroke / outline"
              checked={stroke.enabled}
              onChange={v => setPart(part, { textStroke: { ...stroke, enabled: v } })}
            />
            {stroke.enabled && (
              <div className="space-y-2 pt-1">
                {swatch("Stroke colour", stroke.color, c => setPart(part, { textStroke: { ...stroke, color: c } }))}
                <div className="ctx-field">
                  <span>Stroke width</span>
                  {stepper("Stroke width", stroke.width, w => setPart(part, { textStroke: { ...stroke, width: w } }), 0.5, 8, 0.5)}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    );
  }
  /** the Background shape card for one text part (title, badge, question, option, marker letter…) */
  function bgShapeContent(part: BoxFontId): ReactNode {
    const t = partTf(part);
    return (
      <div className="space-y-2">
        <p className="ctx-menu-cap">{TEXT_PART_LABELS[part]} only — the plate behind its text</p>
        <TextBgShapePanel
          value={t.bgShape}
          onChange={bgShape => setPart(part, { bgShape })}
          textColor={partInk(part) || "#ffffff"}
          accent={theme.accent}
        />
      </div>
    );
  }
  function fontContent(part: BoxFontId): ReactNode {
    return (
      <FontPicker
        label={`${TEXT_PART_LABELS[part]} font`}
        script="all"
        compact
        previewTarget={partPreview(part)}
        value={partTf(part).family ?? ""}
        fallback={textPartDeckFamily(theme, part)}
        onChange={family => {
          ensureFamily(family);
          setPart(part, { family: family || undefined });
        }}
      />
    );
  }
  if (panel === "More" && s) content = (
    <div className="ctx-menu-col">
      {button(<>⧉ Duplicate</>, p.duplicate, undefined, "Duplicate")}
      {button(<>🗑 Delete</>, p.remove, undefined, "Delete", "danger")}
      {!multi && button(<>{s.locked ? "🔓 Unlock" : "🔒 Lock"}</>, () => patch({ locked: !s.locked }), undefined, s.locked ? "Unlock" : "Lock")}
      {!multi && button(<>🙈 Hide layer</>, () => patch({ hidden: true }), undefined, "Hide this layer — show it again from the Layers panel")}
    </div>
  );
  if (panel === "Answer" && ak) content = (
    <div className="space-y-2">
      <p className="ctx-menu-cap">How a revealed answer is painted</p>
      <SegButtons
        value={theme.answerStyle}
        options={[
          { value: "glow", label: "Glow" },
          { value: "tick", label: "Tick ✓" },
          { value: "fill", label: "Fill" },
        ]}
        onChange={(v) => p.patchTheme({ answerStyle: v })}
      />
      <Toggle
        label="Keep marker colours on the answer"
        checked={theme.optionBulletCustomOnAnswer}
        onChange={(v) => p.patchTheme({ optionBulletCustomOnAnswer: v })}
      />
      <p className="ctx-menu-cap">Whole deck</p>
      <div className="ctx-menu-grid">
        <span>{button(<>👁 Reveal all</>, ak.onRevealAll, undefined, "Reveal the answer on every slide")}</span>
        <span>{button(<>🚫 Hide all</>, ak.onHideAll, undefined, "Hide the answer on every slide")}</span>
        <span>{button(<>⧉ Answer copies</>, ak.onCopies, undefined, "Duplicate every slide with its answer revealed")}</span>
        <span>{button(<>⌫ Clear all answers</>, ak.onClearAll, undefined, "Remove the marked answer from every slide", "danger")}</span>
      </div>
      <p className="ctx-menu-cap">Import</p>
      {button(<>✓ Paste an answer key…</>, ak.onPaste, undefined, "Paste an answer key (1. ঘ 2. গ …) in any format")}
      <p className="text-[10px] leading-relaxed text-slate-500">
        Mark the correct choice on the board by clicking an option, or pick it in the panel below. Drag this card by its
        header to move it out of the way.
      </p>
    </div>
  );

  const optLine = (id: MergedLineId) => stack?.includes(id) ?? false;

  if (panel === "Marker shape" && optLine("optionBullet")) content = <OptionBulletShapePicker theme={theme} setTheme={p.patchTheme} />;
  if (panel === "Row style" && optLine("optionBullet")) content = <OptionStylePicker theme={theme} setTheme={p.patchTheme} />;
  if (panel === "Numbering" && optLine("optionBulletText")) content = <PlainNumberingPicker theme={theme} setTheme={p.patchTheme} />;

  for (const id of stack ?? []) {
    const part = LINE_PART[id];
    if (!part) continue;
    const chip = MERGED_LINE[id].chip;
    if (panel === `${chip} font`) content = fontContent(part);
    if (panel === `${chip} spacing`) content = spacingContent(part);
    if (panel === `${chip} effects`) {
      content = effectsContent(
        part,
        id === "titleText" ? (
          <div className="space-y-2 rounded-lg border border-white/10 p-2">
            <p className="ctx-menu-cap">Banner glyph effects (Title text panel)</p>
            <div className="ctx-field">
              <span>Text glow</span>
              {stepper("Title glow", banner.textGlow, v => patchBanner({ textGlow: v }), 0, 100, 5)}
            </div>
            <Toggle label="Drop shadow" checked={banner.textShadow} onChange={v => patchBanner({ textShadow: v })} />
            <GradientEditor
              label="Gradient text"
              value={banner.textGradient}
              fallback={theme.titleColor}
              onChange={g => patchBanner({ textGradient: g })}
              presets={TEXT_GRADIENT_PRESETS}
            />
          </div>
        ) : undefined,
      );
    }
    if (panel === `${chip} position`) content = positionContent(part);
    if (panel === `${chip} background shape`) content = bgShapeContent(part);
  }

  /**
   * The title background line — one button per channel, in the order a plate is
   * dressed:
   *
   *   Design presets   fifty-one complete looks in ten groups, painted as
   *                    they will be — the last three groups are the shape
   *                    styles: Stylish shapes · Multilayer shapes ·
   *                    Multilayer gradient
   *   Shape            the silhouettes in five families, as pictures
   *   Effects          softness · halo · shimmer
   *   Fill             the body's paint: solid or gradient
   *   Border           the outline's paint
   *   Border radius    the corners, one slider with no ceiling
   *   Border style     solid · dashed · dotted · double · none
   *   Border weight    the line's thickness
   *   Transparency     the SHAPE and the BORDER, each on a line bar
   *   Banner size      free width and height, on line bars
   *   Banner position  free X and Y, on line bars
   *
   * and then the eye that shows/hides the plate and the line's Default.
   */
  if (optLine("titleBg")) {
    const p = (patch: Partial<typeof banner>) => patchBanner(patch);
    const cards: Record<string, ReactNode> = {
      "Design presets": <BannerPresetPanel theme={theme} banner={banner} setBanner={p} />,
      "Banner shape": <BannerShapePanel theme={theme} banner={banner} setBanner={p} />,
      "Banner effects": <BannerEffectsPanel banner={banner} setBanner={p} />,
      "Banner fill": <BannerFillPanel banner={banner} setBanner={p} />,
      "Banner border": <BannerBorderPanel banner={banner} setBanner={p} />,
      "Banner radius": <BannerRadiusPanel banner={banner} setBanner={p} />,
      "Banner border style": <BannerBorderStylePanel banner={banner} setBanner={p} />,
      "Banner weight": <BannerWeightPanel banner={banner} setBanner={p} />,
      "Banner transparency": <BannerTransparencyPanel banner={banner} setBanner={p} />,
      "Banner size": <BannerSizePanel theme={theme} banner={banner} setBanner={p} />,
      "Banner position": <BannerPositionPanel banner={banner} setBanner={p} />,
    };
    if (panel && panel in cards) content = cards[panel];
  }

  /**
   * Numbering — the question bullet's number system, on the number's own line
   * (Q bullet text): what the number reads — English · Bangla · Arabic digits
   * and letters, Roman numerals — the same way the option markers' numbering
   * sits on their text line. The marker's styles (bullet points · numbering
   * formats · number + arrow · shapes) stay under the Question bullet line's
   * Design card; this control re-letters the number only.
   */
  if (panel === "Numbering" && optLine("bulletText")) content = (
    <QuestionBulletNumberingPanel theme={theme} setTheme={p.patchTheme} />
  );

  /**
   * Bullet design — the one card that decides how the marker looks: the
   * bullet point presets (classic bullets, numbering, the one-click looks),
   * the shapes (every silhouette alone), and the shape effects, each
   * previewed with the deck's own theme.
   *
   * The new elegant name is "Design" — the old "Bullet design" is kept as
   * an alias so existing decks, tests and deep-links keep working.
   */
  if ((panel === "Bullet design" || panel === "Design") && optLine("questionBullet")) content = (
    <BulletDesignPanel theme={theme} setTheme={p.patchTheme} />
  );
  /**
   * Every other button on the line opens the card that holds *its own* channel
   * and nothing else — Border style is six line styles, Border radius a corner
   * and one slider, Border weight one slider, Transparency one slider — so the
   * pop-up never makes the teacher hunt for their control among someone else's.
   * The whole set still sits together in the inspector's Question bullet card.
   */
  if (panel === "Border style" && optLine("questionBullet")) content = (
    <BulletBorderStylePicker theme={theme} setTheme={p.patchTheme} />
  );
  if (panel === "Border radius" && optLine("questionBullet")) content = (
    <BulletRadiusPanel theme={theme} setTheme={p.patchTheme} />
  );
  if (panel === "Border weight" && optLine("questionBullet")) content = (
    <BulletWeightPanel theme={theme} setTheme={p.patchTheme} />
  );
  if (panel === "Transparency" && optLine("questionBullet")) content = (
    <BulletTransparencyPanel theme={theme} setTheme={p.patchTheme} />
  );
  if (panel === "Bullet position" && optLine("questionBullet")) content = (
    <BulletPositionControls
      theme={theme}
      setTheme={p.patchTheme}
      patchLayout={p.patchLayout}
      onSelectBullet={() => p.onPickElement?.("bullet")}
    />
  );

  const sizeField = el ? ELEMENT_SIZE_FIELD[el] : undefined;
  const size = s?.fontSize ?? (sizeField ? Number(theme[sizeField] ?? 0) : (tf.fontSize ?? Math.round((tf.scale ?? 1) * 100)));
  const setSize = (v: number) => {
    const val = Math.max(0, v);
    if (s) patch({ fontSize: val });
    else if (sizeField) p.patchTheme({ [sizeField]: val } as Partial<ThemeSettings>);
    else fontPatch({ fontSize: val, scale: val / 100 });
  };
  const alignVal = s?.align ?? (tf.align ?? (el ? theme.layout[el].align : "left"));
  const setAlign = (a: "left" | "center" | "right" | "justify") => {
    if (s) patch({ align: a });
    else {
      fontPatch({ align: a });
      if (el && (a === "left" || a === "center" || a === "right")) p.patchBox({ align: a });
    }
  };
  const inserting = !s && !surface && (p.nav === "images" || p.nav === "shapes");
  const themePill = p.nav === "theme" && !s && !surface && !el && !multi;
  /** which slide design the deck is wearing, and how to walk the gallery */
  const activeDesign = themePill ? activeSlideDesign(theme) : null;
  const stepDesign = (by: number) => {
    const d = neighbourDesign(activeDesign?.id ?? null, by);
    loadDesignFonts(d);
    p.patchTheme(designPatch(d, theme));
  };
  const layoutPill = p.nav === "layout" && !s && !surface && !el && !multi;
  const layering = !!p.layerTools && !s && !surface && !el && !multi;
  const arrangeBar = !!p.layerTools && !layering && !surface;
  const arrangeButtons = (["front", "forward", "backward", "back"] as ZOp[]).map(op => (
    <span key={op}>
      {button(Z_LABELS[op].icon, () => p.reorder(op), undefined, `${Z_LABELS[op].label} — ${Z_LABELS[op].hint}`)}
    </span>
  ));
  const kindLabel = ak
    ? "Answer key"
    : themePill
      ? "Design"
      : layoutPill
        ? "Layout"
        : layering
          ? "Layers"
          : inserting
            ? (p.nav === "images" ? "Uploads" : "Insert shape")
            : surface || (multi ? `Group · ${p.count}` : text ? 'Text' : s?.kind || 'Image');
  const toolbarLabel = `${ak ? "answer" : themePill ? "theme" : layoutPill ? "layout" : layering ? "layers" : inserting ? "insert" : surface || (multi ? 'Group' : text ? 'Text' : s?.kind || 'Image')} tools`;

  const vhNow = () => (typeof window === "undefined" ? 800 : window.innerHeight);
  const popNode = content && (
    <div
      ref={popRef}
      role="dialog"
      aria-label={`${panel} settings`}
      data-pop-panel={panel}
      className={cn(
        "ctx-pop",
        popPos ? "ctx-pop-floating" : "ctx-pop-docked",
        widePanel(panel) && "ctx-pop-wide",
        (panel === "Bullet design" || panel === "Design") && "ctx-pop-xl",
        (panel === "TextColor" || panel === "Paint") && "ctx-pop-color",
        panel === "Numbering" && "ctx-pop-wide",
      )}
      style={
        popPos
          ? // dragged free: follow the pointer, but never cross the viewport bottom
            {
              left: popPos.x,
              top: popPos.y,
              width: panel === "Bullet design" || panel === "Design" ? 430 : widePanel(panel) ? 380 : popPos.w,
              maxHeight: Math.max(140, vhNow() - popPos.y - 8),
            }
          : // docked: right edge of the window, just under the top bar, growing
            // downward only as far as the content needs
            {
              top: topBarH + DOCK_GAP,
              right: DOCK_INSET,
              maxHeight: `calc(100vh - ${topBarH + DOCK_GAP + 10}px)`,
              ...(panel === "Bullet design" || panel === "Design" ? { width: 430 } : widePanel(panel) ? { width: 380 } : {}),
            }
      }
    >
      <div
        className="ctx-pop-head"
        data-pop-handle={panel}
        title="Drag to move this panel · double-click to re-dock it on the right"
        onPointerDown={startPopDrag}
        onPointerUp={endPop}
        onPointerCancel={endPop}
        onDoubleClick={() => movePop(null)}
      >
        <span className="ctx-pop-title">
          <span className="ctx-grip" aria-hidden="true">⠿</span>
          {panel === "TextColor"
            ? fontColorCtx?.label ?? "Text color"
            : panel === "Paint"
              ? paintCtx?.label ?? "Colour"
              : panel}
        </span>
        <span className="flex items-center gap-1">
          {popPos && (
            <button
              type="button"
              className="ctx-btn"
              style={{ height: 24, minWidth: 24, padding: "0 6px" }}
              title="Re-dock this panel on the right, under the top bar"
              aria-label="Re-dock panel"
              onClick={() => movePop(null)}
            >
              ⌖
            </button>
          )}
          {button('✕', () => setPanel(null), undefined, 'Close toolbar panel')}
        </span>
      </div>
      <div className="ctx-pop-body">{content}</div>
    </div>
  );

  const lineControls = (id: MergedLineId): ReactNode => {
    const target = MERGED_LINE[id].element;
    const chip = MERGED_LINE[id].chip;
    const lineFont = boxTypeface(theme, target);
    const lineInk = elementInk(theme, target);
    const setLineInk = (v: string) => p.patchTheme(setElementInk(theme, target, v));

    const part = LINE_PART[id];
    const t = part ? partTf(part) : {};
    const set = (patch: Partial<BoxTypeface>) => part && setPart(part, patch);
    const isBold = t.weight ? t.weight >= 700 : !!part && DEFAULT_BOLD.has(part);
    const styleButtons = () => (
      <>
        {button(<span className="ctx-glyph-b">B</span>, () => set({ weight: isBold ? 400 : 700 }), isBold, "Bold")}
        {button(<span className="ctx-glyph-i">I</span>, () => set({ italic: !t.italic }), !!t.italic, "Italic")}
        {button(<span className="ctx-glyph-u">U</span>, () => set({ underline: !t.underline }), !!t.underline, "Underline")}
        {button(<span className="ctx-glyph-s">S</span>, () => set({ strikethrough: !t.strikethrough }), !!t.strikethrough, "Strikethrough")}
      </>
    );
    const caseButton = () => {
      const cur = caseOf(t);
      const next = cur === "uppercase" ? "lowercase" : cur === "lowercase" ? "none" : "uppercase";
      return button(
        cur === "lowercase" ? "aa" : cur === "uppercase" ? "AA" : "Aa",
        () => set({ textTransform: next, uppercase: next === "uppercase" ? true : next === "lowercase" ? "lowercase" : false }),
        cur !== "none",
        `Text case of ${chip} (UPPERCASE / lowercase / Normal)`,
      );
    };
    const alignButtons = () => {
      const ownsBox = part === target;
      const cur = t.align ?? (ownsBox ? theme.layout[target]?.align ?? "left" : "left");
      return (["left", "center", "right", "justify"] as const).map(a => (
        <span key={a}>
          {button(
            ALIGN_GLYPH[a],
            () => {
              set({ align: a });
              if (ownsBox && a !== "justify") p.patchTheme({ layout: { ...theme.layout, [target]: { ...theme.layout[target], align: a } } });
            },
            cur === a,
            `Align ${a}`,
          )}
        </span>
      ));
    };
    // the line's font button names the face this part really paints with
    // (its own, else the deck face it inherits); the pop-up stays keyed
    // "<part> font" so the card's title still says which part it edits
    const lineFontToggle = () => {
      const own = firstFamily(t.family);
      return fontToggle(`${chip} font`, own || (part ? textPartDeckFamily(theme, part) : ""), !own);
    };
    const spacingToggle = () => toggle(`${chip} spacing`, <span aria-hidden="true">⇄</span>);
    const effectsToggle = () => toggle(`${chip} effects`, <span aria-hidden="true">✨</span>);
    const positionToggle = () => toggle(`${chip} position`, <span aria-hidden="true">✥</span>);
    const textTail = () => (
      <>
        {sep()}
        {styleButtons()}
        {caseButton()}
        {sep()}
        {alignButtons()}
        {sep()}
        {spacingToggle()}
        {effectsToggle()}
        {positionToggle()}
      </>
    );

    // helpers for font color with gradient support
    const solidForPart = part ? (partInk(part) || lineInk || (target === "title" ? theme.titleColor : target === "question" ? theme.questionColor : target === "options" ? theme.optionTextColor : "#ffffff")) : lineInk;
    const gradForPart = part ? partTf(part).textGradient : undefined;

    switch (id) {
      case "titleText":
        return (
          <>
            {lineFontToggle()}
            {stepper("Title size", theme.titleSize ?? 54, v => p.patchTheme({ titleSize: v }), 0, 99999, 1, { prefix: "Size" })}
            {fontColorBtn(
              `font:${id}`,
              "Title colour",
              solidForPart || theme.titleColor,
              gradForPart,
              (hex) => {
                setLineInk(hex);
                if (gradForPart?.enabled) setPart(part!, { textGradient: { ...gradForPart, enabled: false } });
              },
              (g) => setPart(part!, { textGradient: g }),
              () => setPart(part!, { textGradient: { ...(gradForPart ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solidForPart, at: 0 }, { color: "#ffffff", at: 100 }] }), enabled: false } }),
            )}
            {textTail()}
          </>
        );

      case "titleBg": {
        /**
         * The plate's line. Every channel is one button — the bar reads in the
         * order a plate is dressed, and each button opens exactly the card it
         * names (see the panel block above).
         */
        const shown = p.header?.showBanner ?? true;
        /** the little well each colour button wears */
        const plateWell = (
          <span
            className="ctx-plate-well"
            aria-hidden="true"
            style={{ background: banner.gradient.enabled ? gradientCss(banner.gradient, banner.color) : banner.color }}
          />
        );
        const lineWell = (
          <span
            className="ctx-line-well"
            aria-hidden="true"
            style={{
              borderColor: withAlpha(banner.border.color, banner.border.opacity ?? 1),
              borderStyle: bannerBorderStyle(banner) === "none" ? "dashed" : bannerBorderStyle(banner),
              borderWidth: Math.max(1, Math.min(6, banner.border.width)),
              opacity: banner.border.enabled ? 1 : 0.4,
            }}
          />
        );
        return (
          <>
            {toggle(
              "Design presets",
              PRESET_GLYPH,
              <span className="ctx-word">
                {PRESET_GLYPH}
                <span>Presets</span>
              </span>,
            )}
            {toggle("Banner shape", <ShapeGlyph shape={banner.shape} />)}
            {toggle("Banner effects", <span aria-hidden="true">✨</span>)}
            {toggle(
              "Banner fill",
              <span className="ctx-plate-fill" aria-hidden="true">
                <span className="ctx-word">Fill</span>
                {plateWell}
              </span>,
            )}
            {toggle(
              "Banner border",
              <span className="ctx-plate-fill" aria-hidden="true">
                <span className="ctx-word">Border</span>
                {lineWell}
              </span>,
            )}
            {toggle("Banner radius", RADIUS_GLYPH)}
            {toggle("Banner border style", <BannerBorderStyleIcon style={bannerBorderStyle(banner)} size={16} />)}
            {toggle("Banner weight", <BannerWeightIcon size={16} />)}
            {toggle("Banner transparency", <BannerTransparencyIcon size={16} />)}
            {toggle("Banner size", <BannerSizeIcon size={16} />)}
            {toggle("Banner position", <BannerPositionIcon size={16} />)}
            {sep()}
            {button(<span aria-hidden="true">👁</span>, () => p.patchHeader?.({ showBanner: !shown }), shown, "Show / hide the banner behind the title")}
          </>
        );
      }

      case "badge1":
      case "badge2": {
        const c = BADGE_LINE[id];
        const own = theme[c.color] ?? "";
        const shown = theme[c.show] ?? true;
        const partId = LINE_PART[id]!;
        const solid = partInk(partId) || own || theme.brandColor;
        const grad = partTf(partId).textGradient;
        return (
          <>
            {lineFontToggle()}
            {stepper(`Badge ${c.n} size`, theme[c.size] ?? c.fallback, v => patchLine({ [c.size]: v }), 0, 99999, 1, { prefix: "Size" })}
            {fontColorBtn(
              `font:${id}`,
              `Badge ${c.n} colour`,
              solid,
              grad,
              (hex) => {
                set({ color: hex });
                if (grad?.enabled) set({ textGradient: { ...grad, enabled: false } });
              },
              (g) => set({ textGradient: g }),
              () => set({ textGradient: { ...(grad ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solid, at: 0 }, { color: "#fff", at: 100 }] }), enabled: false } }),
            )}
            {button("auto", () => set({ color: "" }), !own, "Follow the shared brand colour")}
            {sep()}
            {button(<span aria-hidden="true">👁</span>, () => patchLine({ [c.show]: !shown }), shown, `Show / hide badge ${c.n}`)}
            {textTail()}
          </>
        );
      }

      case "questionText":
        return (
          <>
            {lineFontToggle()}
            {stepper("Question size %", Math.round((lineFont.scale ?? 1) * 100), v => set({ scale: Math.max(0, v) / 100 }), 0, 99999, 5, { prefix: "Size" })}
            {fontColorBtn(
              `font:${id}`,
              "Question colour",
              solidForPart || theme.questionColor,
              gradForPart,
              (hex) => {
                setLineInk(hex);
                if (gradForPart?.enabled) setPart(part!, { textGradient: { ...gradForPart, enabled: false } });
              },
              (g) => setPart(part!, { textGradient: g }),
              () => setPart(part!, { textGradient: { ...(gradForPart ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solidForPart, at: 0 }, { color: "#fff", at: 100 }] }), enabled: false } }),
            )}
            {textTail()}
          </>
        );

      case "questionBullet": {
        /**
         * The marker's line — one button per channel, in the order a marker is
         * dressed:
         *
         *   Fill            the body's paint: solid, gradient, Auto or None
         *   Border          the outline's paint: solid, gradient, Auto or None
         *   Border style    solid · dashed · dotted · double, as pictures
         *   Border radius   the corners — one slider, with no px ceiling
         *   Border weight   the outline's thickness
         *   Transparency    the body only; the number keeps its own opacity
         *   Bullet position where the marker sits on the board
         *   Bullet design   the bullet point presets, the shapes, the effects
         *
         * Fill and Border spell their name out and wear the colour-picker icon:
         * a shape's paint has four states to show (auto · solid · gradient ·
         * none) and a bare colour dot cannot carry them.
         */
        const bulletBase = theme.accent || "#2f4fff";
        const fillAuto = shade(bulletBase, 0.2);
        const borderAuto = shade(bulletBase, 0.5);
        const fillVal = theme.bulletFill ?? "";
        const borderVal = theme.bulletBorder ?? "";
        const fillGrad = theme.bulletFillGradient;
        const borderGrad = theme.bulletBorderGradient;
        /** turning a gradient off keeps its stops, so it can be switched back */
        const gradOff = (g?: Gradient) => (g ? { ...g, enabled: false } : undefined);
        const lineOn = (theme.bulletBorderStyle ?? "auto") !== "none";
        return (
          <>
            {paintColorBtn({
              key: "bulletFill",
              label: "Fill",
              value: fillVal,
              gradient: fillGrad,
              fallback: fillAuto,
              docColors,
              onSolid: hex => p.patchTheme({ bulletFill: hex, bulletFillGradient: undefined }),
              onGradient: g =>
                p.patchTheme({
                  bulletFillGradient: g,
                  ...(g.enabled && !/^#[0-9a-f]{3,8}$/i.test(fillVal) ? { bulletFill: fillAuto } : {}),
                }),
              onClearGradient: () => p.patchTheme({ bulletFillGradient: gradOff(fillGrad) }),
              onAuto: () => p.patchTheme({ bulletFill: "", bulletFillGradient: undefined }),
              onNone: () => p.patchTheme({ bulletFill: BULLET_COLOR_NONE, bulletFillGradient: undefined }),
            })}
            {paintColorBtn({
              key: "bulletBorder",
              label: "Border",
              value: borderVal,
              gradient: borderGrad,
              fallback: borderAuto,
              docColors,
              onSolid: hex =>
                p.patchTheme({
                  bulletBorder: hex,
                  bulletBorderGradient: undefined,
                  ...(lineOn ? {} : { bulletBorderStyle: "auto" as const }),
                }),
              onGradient: g =>
                p.patchTheme({
                  bulletBorderGradient: g,
                  ...(g.enabled && !/^#[0-9a-f]{3,8}$/i.test(borderVal) ? { bulletBorder: borderAuto } : {}),
                  ...(g.enabled && lineOn ? {} : { bulletBorderStyle: "solid" as const }),
                }),
              onClearGradient: () => p.patchTheme({ bulletBorderGradient: gradOff(borderGrad) }),
              onAuto: () => p.patchTheme({ bulletBorder: "", bulletBorderGradient: undefined }),
              onNone: () => p.patchTheme({ bulletBorder: BULLET_COLOR_NONE, bulletBorderGradient: undefined }),
            })}
            {toggle("Border style", <BorderStyleIcon style={theme.bulletBorderStyle ?? "auto"} size={16} />)}
            {toggle("Border radius", RADIUS_GLYPH)}
            {toggle("Border weight", <WeightIcon size={16} />)}
            {toggle("Transparency", <TransparencyIcon size={16} />)}
            {toggle("Bullet position", <span aria-hidden="true">✥</span>)}
            {toggle(
              "Design",
              PREMIUM_DESIGN_GLYPH,
              <span className="ctx-design-plus-control">
                <span className="ctx-design-plus-word">design+</span>
                {PREMIUM_DESIGN_GLYPH}
              </span>,
            )}
            {sep()}
            {button(<span aria-hidden="true">👁</span>, () => p.patchTheme({ showBullet: !theme.showBullet }), theme.showBullet, "Show / hide the number bullet")}
          </>
        );
      }

      case "bulletText": {
        const solid = lineFont.color || theme.accent;
        const grad = part ? partTf(part).textGradient : undefined;
        return (
          <>
            {/* the numbering gallery rides with the number's own line — exactly
                where the option markers' numbering sits on theirs */}
            {toggle("Numbering", NUMBERING_GLYPH)}
            {button(<span aria-hidden="true">👁</span>, () => p.patchTheme({ showNumber: !theme.showNumber }), theme.showNumber, "Show / hide the number inside the bullet")}
            {lineFontToggle()}
            {stepper("Number size %", Math.round((lineFont.scale ?? 1) * 100), v => set({ scale: Math.max(0, v) / 100 }), 0, 99999, 5, { prefix: "Size" })}
            {fontColorBtn(
              `font:${id}`,
              "Number ink",
              solid,
              grad,
              (hex) => set({ color: hex }),
              (g) => set({ textGradient: g }),
              () => set({ textGradient: { ...(grad ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solid, at: 0 }, { color: "#fff", at: 100 }] }), enabled: false } }),
            )}
            {button("auto", () => set({ color: "" }), !lineFont.color, "Let the bullet design pick its own ink")}
            {sep()}
            <select
              aria-label="Number weight"
              title="Number weight"
              className="ctx-select"
              value={String(lineFont.weight ?? 0)}
              onChange={e => set({ weight: Number(e.currentTarget.value) || undefined })}
            >
              <option value="0">Auto weight</option>
              {WEIGHTS.map(w => <option key={w.v} value={String(w.v)}>{w.l}</option>)}
            </select>
            {textTail()}
          </>
        );
      }

      case "optionText":
        return (
          <>
            {lineFontToggle()}
            {stepper("Option text size", theme.optionSize, optionSize => p.patchTheme({ optionSize }), 0, 99999, 1, { prefix: "Size" })}
            {fontColorBtn(
              `font:${id}`,
              "Option text colour",
              solidForPart || theme.optionTextColor,
              gradForPart,
              (hex) => {
                setLineInk(hex);
                if (gradForPart?.enabled) setPart(part!, { textGradient: { ...gradForPart, enabled: false } });
              },
              (g) => setPart(part!, { textGradient: g }),
              () => setPart(part!, { textGradient: { ...(gradForPart ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solidForPart, at: 0 }, { color: "#fff", at: 100 }] }), enabled: false } }),
            )}
            {stepper("Option line height", theme.optionLineHeight ?? 1.45, v => p.patchTheme({ optionLineHeight: Math.round(v * 20) / 20 }), 0, 99, .05, { prefix: "Line" })}
            {textTail()}
          </>
        );

      case "optionBullet":
        return (
          <>
            {toggle("Marker shape", <span aria-hidden="true">⬤</span>)}
            {toggle("Row style", <span aria-hidden="true">▭</span>)}
            {sep()}
            {swatch("Marker colour (auto base)", picked(theme.optionAccent), v => p.patchTheme({ optionAccent: v }), <span className="ctx-dot" style={{ background: picked(theme.optionAccent) }} />)}
            {swatch(`Marker fill${theme.optionBulletFill ? "" : " (auto until set)"}`, picked(theme.optionBulletFill || shade(optionBase, 0.2)), v => p.patchTheme({ optionBulletFill: v }), <span className="ctx-dot" style={{ background: picked(theme.optionBulletFill || shade(optionBase, 0.2)) }} />, "optionBulletFill")}
            {swatch(`Marker ring${theme.optionBulletBorder ? "" : " (auto until set)"}`, picked(theme.optionBulletBorder || shade(optionBase, 0.5)), v => p.patchTheme({ optionBulletBorder: v }), <span className="ctx-ring" style={{ borderColor: picked(theme.optionBulletBorder || shade(optionBase, 0.5)) }} />, "optionBulletBorder")}
            {button(<span aria-hidden="true">◐</span>, () => p.patchTheme({ optionBulletBgColor: theme.optionBulletBgColor ? "" : shade(optionBase, -0.35) }), !!theme.optionBulletBgColor, "Shape behind every marker (on / off)")}
            {sep()}
            <select
              aria-label="Options layout"
              title="Options layout"
              className="ctx-select"
              value={theme.optionsLayout}
              onChange={e => p.patchTheme({ optionsLayout: e.currentTarget.value as OptionsLayout })}
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="two-col">2 columns</option>
              <option value="grid">Grid</option>
            </select>
            {stepper("Gap between rows", theme.optionGap ?? 0, v => p.patchTheme({ optionGap: v }), 0, 14, .5, { prefix: "Gap" })}
          </>
        );

      case "optionBulletText": {
        const solid = picked(theme.optionBulletInk || optionBase);
        const grad = part ? partTf(part).textGradient : undefined;
        return (
          <>
            {toggle("Numbering", <span aria-hidden="true">#</span>)}
            {lineFontToggle()}
            {sep()}
            {fontColorBtn(
              `font:${id}`,
              "Marker letter ink",
              solid,
              grad,
              (hex) => p.patchTheme({ optionBulletInk: hex }),
              (g) => setPart(part!, { textGradient: g }),
              () => setPart(part!, { textGradient: { ...(grad ?? { enabled: false, type: "linear", angle: 90, stops: [{ color: solid, at: 0 }, { color: "#fff", at: 100 }] }), enabled: false } }),
            )}
            {button("auto", () => set({ color: "" }), !theme.optionBulletInk, "Let the marker palette pick the letter's ink")}
            {sep()}
            <select
              aria-label="Letter weight"
              title="Letter weight"
              className="ctx-select"
              value={String(markerWeight)}
              onChange={e => p.patchTheme({ optionBulletTextWeight: Number(e.currentTarget.value) })}
            >
              <option value="0">Auto weight</option>
              {WEIGHTS.map(w => <option key={w.v} value={String(w.v)}>{w.l}</option>)}
            </select>
            {stepper("Letter size %", theme.optionBulletTextSize ?? 100, v => p.patchTheme({ optionBulletTextSize: Math.max(0, v) }), 0, 99999, 5, { prefix: "Size" })}
            {textTail()}
          </>
        );
      }
    }
  };

  if (stack) {
    return (
      <section className="context-toolbar" aria-label="Contextual editing tools">
        <div className="ctx-rows">
          {stack.map(id => (
            <div
              key={id}
              role="toolbar"
              aria-label={MERGED_LINE[id].aria}
              className={cn("ctx-pill", activeLine === id && "ctx-pill-active")}
            >
              <span className="ctx-kind">{MERGED_LINE[id].chip}</span>
              {lineControls(id)}
              {LINE_PART[id] && bgToggle(`${MERGED_LINE[id].chip} background shape`, partTf(LINE_PART[id]!).bgShape)}
              {defaultBtn(MERGED_LINE[id].chip, () => applyReset(resetToolbarLine(id, theme)))}
            </div>
          ))}
          {arrangeBar && (
            <div role="toolbar" aria-label="Arrange tools" className="ctx-pill">
              <span className="ctx-kind">Arrange</span>
              {arrangeButtons}
            </div>
          )}
        </div>
        {popNode}
      </section>
    );
  }

  return (
    <section className="context-toolbar" aria-label="Contextual editing tools">
      <div role="toolbar" aria-label={toolbarLabel} className="ctx-pill">
        <span className="ctx-kind">{kindLabel}</span>
        {ak && <>
          {button(
            <span aria-hidden="true">{ak.showAnswer ? "✓" : "👁"}</span>,
            ak.onToggleReveal,
            ak.showAnswer,
            "Reveal / hide the answer on this slide",
          )}
          <select
            aria-label="Correct answer"
            title="Which option is correct on this slide"
            className="ctx-select"
            value={ak.answer ?? ""}
            onChange={e => ak.onSetAnswer(e.currentTarget.value || null)}
          >
            <option value="">— no answer —</option>
            {ak.options.map(o => (
              <option key={o.key} value={o.key}>
                {o.key}{o.text ? ` · ${o.text.slice(0, 18)}` : ""}
              </option>
            ))}
          </select>
          {toggle("Answer", <span aria-hidden="true">✓</span>)}
          {button(<span aria-hidden="true">📋</span>, ak.onPaste, undefined, "Paste an answer key (1. ঘ 2. গ …) for the whole deck")}
          {sep()}
        </>}
        {themePill && <>
          {/* Design is the gallery of complete slide looks: the strip names the
              one painted now and walks the gallery, the panel holds the grid */}
          <span className="ctx-hint" title="The slide design painted on this deck — the Design panel holds the whole gallery">
            {activeDesign?.name ?? "Custom look"}
          </span>
          {button(<span aria-hidden="true">◀</span>, () => stepDesign(-1), undefined, "Previous slide design")}
          {button(<span aria-hidden="true">▶</span>, () => stepDesign(1), undefined, "Next slide design")}
          {sep()}
        </>}
        {layoutPill && <>
          <select
            aria-label="Element to position"
            title="Pick an element to position (Layout panel opens its controls)"
            className="ctx-select"
            value=""
            onChange={e => {
              const v = e.currentTarget.value;
              if (v) p.onPickElement?.(v as ElementId);
            }}
          >
            <option value="">— element… —</option>
            {(["title", "brand", "logo", "badge", "question", "options", "note"] as ElementId[]).map(id => (
              <option key={id} value={id}>{ELEMENT_LABELS[id]}</option>
            ))}
          </select>
          {sep()}
          {button(<span aria-hidden="true">🧲</span>, () => p.patchTheme({ snapEnabled: !theme.snapEnabled }), theme.snapEnabled, "Magnetic snapping while dragging")}
          {button(<span aria-hidden="true">⌖</span>, () => p.patchTheme({ smartGuides: !(theme.smartGuides ?? true) }), theme.smartGuides ?? true, "Smart guides while dragging")}
          {sep()}
        </>}
        {layering && <>
          <span className="ctx-hint" title="Drag rows in the Layers panel to reorder them">
            {p.layerTools?.total ?? 0} layers
          </span>
        </>}
        {arrangeBar && <>
          {arrangeButtons}
          {sep()}
        </>}
        {inserting && p.nav === "images" && <>
          <label className="ctx-btn ctx-upload" title="Upload images (or a PDF) to this slide and library">
            <span aria-hidden="true">📤</span>
            <span className="sr-only">Upload image or PDF</span>
            <input
              aria-label="Add image or PDF files"
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              className="ctx-file"
              onChange={e => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) p.onAddImages?.(files);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {sep()}
        </>}
        {inserting && p.nav === "shapes" && <>
          {INSERT_SHAPES.map(k => (
            <span key={k}>{button(SHAPE_ICONS[k], () => p.insertShape?.(k), undefined, SHAPE_LABELS[k])}</span>
          ))}
          {sep()}
        </>}
        {text && <>
          {fontToggle("Font", firstFamily(textFontOwn) || firstFamily(textFontDeck), !firstFamily(textFontOwn))}
          {stepper(s || sizeField ? "Font size" : "Size %", size, setSize, 0, 99999, 1, { dec: "Decrease font size", inc: "Increase font size", jump: 1 })}
          {sep()}
          {button(<span className="ctx-glyph-b">B</span>, () => s ? patch({ bold: !s.bold }) : fontPatch({ weight: (tf.weight ?? 400) >= 700 ? 400 : 700 }), s ? s.bold : (tf.weight ?? 400) >= 700, "Bold")}
          {button(<span className="ctx-glyph-i">I</span>, () => s ? patch({ italic: !s.italic }) : fontPatch({ italic: !tf.italic }), s ? s.italic : !!tf.italic, "Italic")}
          {button(<span className="ctx-glyph-u">U</span>, () => s ? patch({ underline: !s.underline }) : fontPatch({ underline: !tf.underline }), s ? !!s.underline : !!tf.underline, "Underline")}
          {button(<span className="ctx-glyph-s">S</span>, () => s ? patch({ strikethrough: !s.strikethrough }) : fontPatch({ strikethrough: !tf.strikethrough }), s ? !!s.strikethrough : !!tf.strikethrough, "Strikethrough")}
          {sep()}
          {s
            ? fontColorBtn(
                "shapeText",
                "Text color",
                s.textColor || "#ffffff",
                s.textGradient,
                (hex) => patch({ textColor: hex, textGradient: s.textGradient ? { ...s.textGradient, enabled: false } : undefined }),
                (g) => patch({ textGradient: g }),
                () => patch({ textGradient: s.textGradient ? { ...s.textGradient, enabled: false } : { enabled: false, type: "linear", angle: 90, stops: [{ color: s.textColor, at: 0 }, { color: "#fff", at: 100 }] } }),
              )
            : el
              ? fontColorBtn(
                  `el:${el}`,
                  "Text color",
                  (el && elementInk(theme, el)) || tf.color || "#ffffff",
                  (el && textPartTypeface(theme, el as any).textGradient) || undefined,
                  (hex) => el && p.patchTheme(setElementInk(theme, el as any, hex)),
                  (g) => el && p.patchTheme(patchTextPart(theme, el as any, { textGradient: g })),
                  () => el && p.patchTheme(patchTextPart(theme, el as any, { textGradient: { enabled: false, type: "linear", angle: 90, stops: [{ color: (el && elementInk(theme, el)) || "#fff", at: 0 }, { color: "#fff", at: 100 }] } })),
                )
              : null}
          {button("Aa", () => {
            if (s) {
              const cur = s.textTransform ?? (s.uppercase ? "uppercase" : s.lowercase ? "lowercase" : "none");
              const next = cur === "uppercase" ? "lowercase" : cur === "lowercase" ? "none" : "uppercase";
              patch({ textTransform: next as any, uppercase: next === "uppercase", lowercase: next === "lowercase" });
            } else {
              const cur = tf.textTransform ?? (tf.uppercase === true ? "uppercase" : tf.uppercase === "lowercase" ? "lowercase" : "none");
              const next = cur === "uppercase" ? "lowercase" : cur === "lowercase" ? "none" : "uppercase";
              fontPatch({ textTransform: next as any, uppercase: next === "uppercase" ? true : next === "lowercase" ? "lowercase" : false });
            }
          }, s ? (s.uppercase || s.textTransform === "uppercase") : (tf.uppercase === true || tf.textTransform === "uppercase"), "Text case (UPPERCASE / lowercase / Normal)")}
          {sep()}
          {(["left", "center", "right", "justify"] as const).map(a => <span key={a}>{button(ALIGN_GLYPH[a], () => setAlign(a), alignVal === a, `Align ${a}`)}</span>)}
          {sep()}
          {toggle("Spacing", <span aria-hidden="true">⇄</span>)}
          {toggle("Effects", <span aria-hidden="true">✨</span>)}
        </>}
        {s && !multi && s.kind !== 'text' && s.kind !== 'image' && <>
          {swatch("Fill", s.fill, fill => patch({ fill, gradient: s.gradient ? { ...s.gradient, enabled: false } : undefined }), <span className="ctx-dot" style={{ background: s.fill || "transparent" }} />)}
          {swatch("Border", s.stroke, stroke => patch({ stroke }), <span className="ctx-ring" style={{ borderColor: s.stroke || "#ffffff" }} />)}
          {stepper("Border width", s.strokeWidth, strokeWidth => patch({ strokeWidth }), 0, 30, 1, { prefix: "Border" })}
        </>}
        {s?.kind === 'image' && !multi && <>
          <label className="ctx-btn ctx-upload" title="Replace image"><span aria-hidden="true">🖼</span><span className="sr-only">Replace image</span><input aria-label="Replace image" type="file" accept="image/*" className="ctx-file" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { const { src, ratio } = await loadImageFile(file); patch({ src, naturalRatio: ratio }); } catch { alert('Could not read this image.'); } } }} /></label>
          <select aria-label="Image fit" title="Image fit" className="ctx-select" value={s.fit ?? 'contain'} onChange={e => patch({ fit: e.target.value as ShapeItem['fit'] })}><option value="contain">Fit</option><option value="cover">Fill / crop to box</option><option value="fill">Stretch</option></select>
          {button(<span aria-hidden="true">⇋</span>, () => patch({ flipH: !s.flipH }), undefined, "Flip horizontal")}
        </>}
        {s && !multi && <>{sep()}{stepper("Item opacity %", opacityPercent(s.itemOpacity), v => patch({ itemOpacity: opacityAlpha(v) }), 0, 100, 5, { prefix: <span aria-hidden="true">◐</span> })}{toggle("Effects", <span aria-hidden="true">✨</span>)}</>}
        {surface === 'frame' && <>{swatch("Frame color", (theme.frame ?? DEFAULT_FRAME).color, color => p.patchTheme({ frame: { ...(theme.frame ?? DEFAULT_FRAME), color } }))}{toggle("Frame", <span aria-hidden="true">🖼</span>)}</>}
        {surface === 'background' && <>{swatch("Color", theme.board, board => p.patchTheme({ board }))}{toggle("Gradient", <span aria-hidden="true">◒</span>)}{toggle("Background effects", <span aria-hidden="true">✨</span>)}</>}
        {multi && (p.grouped ? button(<span aria-hidden="true">▢</span>, p.ungroup, undefined, "Ungroup") : button(<span aria-hidden="true">▣</span>, p.group, undefined, "Group"))}
        {!surface && <>{sep()}{toggle("Position", <span aria-hidden="true">✥</span>)}</>}
        {text && bgToggle("Background shape", s ? s.textBgShape : el && el !== "logo" ? partTf(el).bgShape : undefined)}
        {!inserting && !multi && (ak || themePill || layoutPill || surface || s || el) && defaultBtn(
          typeof kindLabel === "string" ? kindLabel : "toolbar",
          () => {
            if (ak) applyReset(resetAnswerToolbar());
            else if (themePill) applyReset(resetThemeToolbar());
            else if (layoutPill) applyReset(resetLayoutToolbar());
            else if (surface === "frame") applyReset(resetFrameToolbar());
            else if (surface === "background") applyReset(resetBackgroundToolbar());
            else if (s) applyReset({ shape: resetShapeStyle(s, theme.accent) });
            else if (el) applyReset(resetElementToolbar(el, theme));
          },
        )}
        {s && (
          <button
            type="button" className={`ctx-btn${panel === "More" ? " is-on" : ""}`}
            title="More" aria-label="More" aria-pressed={panel === "More"} aria-expanded={panel === "More"}
            onClick={() => setPanel(panel === "More" ? null : "More")}
          >⋯</button>
        )}
      </div>
      {popNode}
    </section>
  );
}
