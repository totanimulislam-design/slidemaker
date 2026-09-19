import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BackgroundSettings, BannerSettings, BannerShape, Box, BoxFontId, BoxTypeface, DeckHeader, ElementId, OptionsLayout, QuizOption, ThemeSettings,
} from "../lib/types";
import { DEFAULT_BANNER, DEFAULT_FRAME, ELEMENT_LABELS } from "../lib/types";
import { TEXT_GRADIENT_PRESETS } from "../lib/banner";
import {
  TEXT_PART_LABELS, WEIGHTS, boxFontLabel, boxTypeface, elementInk, opacityAlpha, opacityPercent, patchTextPart, setBoxFont, setElementInk, textPartTypeface,
} from "../lib/boxFonts";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, type ShapeItem, type ShapeKind } from "../lib/shapes";
import type { AlignOp } from "../lib/shapeAlign";
import { usePointerDrag } from "../lib/dragSession";
import { Z_LABELS, type ZOp } from "../lib/zorder";
import { shade } from "../lib/color";
import { ensureFamily } from "../lib/fonts";
import FontPicker from "./FontPicker";
import TextEffectsEditor from "./TextEffectsEditor";
import OptionBulletShapePicker from "./OptionBulletShapePicker";
import OptionStylePicker from "./OptionStylePicker";
import PlainNumberingPicker from "./PlainNumberingPicker";
import NumberStylePicker from "./NumberStylePicker";
import ShapeDesignPanel from "./ShapeDesignPanel";
import FramePanel from "./FramePanel";
import GradientEditor from "./GradientEditor";
import FontColorPanel from "./FontColorPanel";
import { SegButtons, Toggle } from "./ui";
import { useColorFrame } from "../lib/frameSend";
import { cn } from "../utils/cn";
import type { Gradient } from "../lib/types";
import { gradientCss } from "../lib/banner";

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

const BANNER_SHAPES: { id: BannerShape; label: string; icon: string }[] = [
  { id: "glow", label: "Glow", icon: "◉" },
  { id: "pill", label: "Pill", icon: "⬭" },
  { id: "rounded", label: "Rounded", icon: "▢" },
  { id: "rect", label: "Box", icon: "▭" },
  { id: "ribbon", label: "Ribbon", icon: "⧓" },
  { id: "underline", label: "Underline", icon: "▁" },
  { id: "none", label: "None", icon: "∅" },
];

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

export default function ContextToolbar(p: Props) {
  const [panel, setPanel] = useState<string | null>(null);
  const [fontColorCtx, setFontColorCtx] = useState<FontColorCtx | null>(null);
  const { shape: s, element: el, surface, theme, patchShape: patch } = p;
  const ak = p.answerKey;
  const multi = p.count > 1 || p.grouped;
  const text = !surface && !multi && (s?.kind === "text" || (!!el && el !== "logo" && !s));
  const tf = el ? boxTypeface(theme, el) : {};
  const fontPatch = (v: Parameters<typeof setBoxFont>[2]) => el && p.patchTheme({ boxFonts: setBoxFont(theme.boxFonts, el, v) });

  const stack = !surface && !multi && !s ? mergedLinesFor(p.nav, el, theme) : null;
  const activeLine = stack?.find((id) => id === p.nav) ?? (el ? ELEMENT_LEAD_LINE[el] : undefined);
  const banner: BannerSettings = {
    ...DEFAULT_BANNER,
    ...(theme.banner ?? {}),
    color: theme.banner?.color ?? theme.titleBanner,
  };
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

  const openFontColor = (ctx: FontColorCtx) => {
    // toggle if same key
    if (panel === "TextColor" && fontColorCtx?.key === ctx.key) {
      setPanel(null);
      return;
    }
    setFontColorCtx(ctx);
    setPanel("TextColor");
  };

  const popRef = useRef<HTMLDivElement | null>(null);
  const popBox = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 480, h: 280 });
  const [popPos, setPopPos] = useState<{ x: number; y: number; w: number } | null>(null);

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
  const toggle = (name: string, icon?: ReactNode) => (
    <button
      type="button"
      className={`ctx-btn ctx-toggle${panel === name ? " is-on" : ""}`}
      title={name}
      aria-label={name}
      aria-pressed={panel === name}
      aria-expanded={panel === name}
      onClick={() => setPanel(panel === name ? null : name)}
    >
      {icon}
      {name}
      <span className="ctx-caret" aria-hidden="true">▾</span>
    </button>
  );
  const sep = () => <span className="ctx-sep" aria-hidden="true" />;
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
    return (
      <button
        key={key}
        type="button"
        title={`${label} – ${gradCss ? "gradient" : solidHex}`}
        aria-label={label}
        aria-pressed={isActive}
        className={cn("ctx-btn ctx-font-color", isActive && "is-on")}
        onClick={() =>
          openFontColor({
            key,
            label,
            solid: solidHex,
            gradient,
            onSolid,
            onGradient,
            onClearGradient: onClear,
            docColors,
          })
        }
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

  let content: ReactNode = null;
  if (panel === "Font" && text) content = (
    <FontPicker
      label="Font family (all Google Fonts)"
      script="all"
      compact
      previewTarget={s ? `shape:${s.id}` : el ? `box:${el}` : undefined}
      value={s?.fontFamily || (el ? boxFontLabel(theme, el) : "")}
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
      content = <ShapeDesignPanel shape={s} onChange={patch} />;
    } else if (el) {
      content = effectsContent(el);
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
  function fontContent(part: BoxFontId): ReactNode {
    return (
      <FontPicker
        label={`${TEXT_PART_LABELS[part]} font`}
        script="all"
        compact
        previewTarget={partPreview(part)}
        value={partTf(part).family ?? ""}
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
  }

  if (panel === "Banner shape" && optLine("titleBg")) content = (
    <div className="ctx-menu-grid">
      {BANNER_SHAPES.map(b => (
        <span key={b.id}>
          {button(<>{b.icon} {b.label}</>, () => patchBanner({ shape: b.id }), banner.shape === b.id, `Banner shape: ${b.label}`)}
        </span>
      ))}
    </div>
  );
  if (panel === "Banner fill" && optLine("titleBg")) content = (
    <GradientEditor
      label="Banner gradient"
      value={banner.gradient}
      fallback={banner.color}
      onChange={g => patchBanner({ gradient: g })}
    />
  );
  if (panel === "Banner padding" && optLine("titleBg")) content = (
    <div>
      <div className="ctx-field">
        <span>Width padding</span>
        {stepper("Width padding", banner.padX, v => patchBanner({ padX: v }), 0, 40)}
      </div>
      <div className="ctx-field">
        <span>Height padding</span>
        {stepper("Height padding", banner.padY, v => patchBanner({ padY: v }), 0, 80)}
      </div>
    </div>
  );

  if (panel === "Bullet design" && optLine("questionBullet")) content = (
    <NumberStylePicker theme={theme} setTheme={p.patchTheme} />
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

  const popNode = content && (
    <div
      ref={popRef}
      role="dialog"
      aria-label={`${panel} settings`}
      data-pop-panel={panel}
      className={cn("ctx-pop", popPos && "ctx-pop-floating", panel === "TextColor" && "ctx-pop-wide")}
      style={popPos ? { left: popPos.x, top: popPos.y, width: panel === "TextColor" ? 380 : popPos.w } : panel === "TextColor" ? { width: 380 } : undefined}
    >
      <div
        className="ctx-pop-head"
        data-pop-handle={panel}
        title="Drag to move this panel · double-click to re-centre"
        onPointerDown={startPopDrag}
        onPointerUp={endPop}
        onPointerCancel={endPop}
        onDoubleClick={() => movePop(null)}
      >
        <span className="ctx-pop-title">
          <span className="ctx-grip" aria-hidden="true">⠿</span>
          {panel === "TextColor" ? fontColorCtx?.label ?? "Text color" : panel}
        </span>
        <span className="flex items-center gap-1">
          {popPos && (
            <button
              type="button"
              className="ctx-btn"
              style={{ height: 24, minWidth: 24, padding: "0 6px" }}
              title="Re-centre this panel under the toolbar"
              aria-label="Re-centre panel"
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
    const fontToggle = () => toggle(`${chip} font`, <span aria-hidden="true">A</span>);
    const spacingToggle = () => toggle(`${chip} spacing`, <span aria-hidden="true">⇄</span>);
    const effectsToggle = () => toggle(`${chip} effects`, <span aria-hidden="true">✨</span>);
    const positionToggle = () => toggle(`${chip} position`, <span aria-hidden="true\">✥</span>);
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
            {fontToggle()}
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
        const shown = p.header?.showBanner ?? true;
        return (
          <>
            {toggle("Banner shape", <span aria-hidden="true\">▣</span>)}
            {swatch("Banner colour", banner.color, v => patchBanner({ color: v }), <span className="ctx-dot" style={{ background: banner.color }} />)}
            {toggle("Banner fill")}
            {stepper("Banner opacity %", Math.round(banner.opacity * 100), v => patchBanner({ opacity: Math.max(0, Math.min(1, v / 100)) }), 0, 100, 5, { prefix: "◐" })}
            {stepper("Banner halo", banner.halo, v => patchBanner({ halo: v }), 0, 100, 5, { prefix: "☀" })}
            {toggle("Banner padding")}
            {sep()}
            {button("▣ Banner", () => p.patchHeader?.({ showBanner: !shown }), shown, "Show / hide the banner behind the title")}
            {sep()}
            {toggle("Position")}
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
            {fontToggle()}
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
            {button(<span aria-hidden="true\">👁</span>, () => patchLine({ [c.show]: !shown }), shown, `Show / hide badge ${c.n}`)}
            {textTail()}
          </>
        );
      }

      case "questionText":
        return (
          <>
            {fontToggle()}
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

      case "questionBullet":
        return (
          <>
            {toggle("Bullet design", <span aria-hidden="true\">⬤</span>)}
            {stepper("Bullet size", theme.bulletSize ?? 54, v => p.patchTheme({ bulletSize: v }), 0, 99999, 1, { prefix: "Size" })}
            {swatch("Bullet colour", theme.accent, v => p.patchTheme({ accent: v }), <span className="ctx-dot" style={{ background: theme.accent }} />)}
            {sep()}
            {button(<span aria-hidden="true\">👁</span>, () => p.patchTheme({ showBullet: !theme.showBullet }), theme.showBullet, "Show / hide the number bullet")}
          </>
        );

      case "bulletText": {
        const solid = lineFont.color || theme.accent;
        const grad = part ? partTf(part).textGradient : undefined;
        return (
          <>
            {button(<span aria-hidden="true\">👁</span>, () => p.patchTheme({ showNumber: !theme.showNumber }), theme.showNumber, "Show / hide the number inside the bullet")}
            {fontToggle()}
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
            {fontToggle()}
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
            {toggle("Marker shape", <span aria-hidden="true\">⬤</span>)}
            {toggle("Row style", <span aria-hidden="true\">▭</span>)}
            {sep()}
            {swatch("Marker colour (auto base)", picked(theme.optionAccent), v => p.patchTheme({ optionAccent: v }), <span className="ctx-dot" style={{ background: picked(theme.optionAccent) }} />)}
            {swatch(`Marker fill${theme.optionBulletFill ? "" : " (auto until set)"}`, picked(theme.optionBulletFill || shade(optionBase, 0.2)), v => p.patchTheme({ optionBulletFill: v }), <span className="ctx-dot" style={{ background: picked(theme.optionBulletFill || shade(optionBase, 0.2)) }} />, "optionBulletFill")}
            {swatch(`Marker ring${theme.optionBulletBorder ? "" : " (auto until set)"}`, picked(theme.optionBulletBorder || shade(optionBase, 0.5)), v => p.patchTheme({ optionBulletBorder: v }), <span className="ctx-ring" style={{ borderColor: picked(theme.optionBulletBorder || shade(optionBase, 0.5)) }} />, "optionBulletBorder")}
            {button("◐ Backplate", () => p.patchTheme({ optionBulletBgColor: theme.optionBulletBgColor ? "" : shade(optionBase, -0.35) }), !!theme.optionBulletBgColor, "Shape behind every marker (on / off)")}
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
            {toggle("Numbering", <span aria-hidden="true\">#</span>)}
            {fontToggle()}
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
            <>{ak.showAnswer ? "👁 Revealed" : "👁 Hidden"}</>,
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
          {toggle("Answer")}
          {button(<>✓ Paste key</>, ak.onPaste, undefined, "Paste an answer key (1. ঘ 2. গ …) for the whole deck")}
          {sep()}
        </>}
        {themePill && <>
          {swatch("Accent colour", theme.accent, v => p.patchTheme({ accent: v }), <span className="ctx-dot" style={{ background: theme.accent }} />)}
          {swatch("Board colour", theme.board, v => p.patchTheme({ board: v }), <span className="ctx-dot" style={{ background: theme.board }} />)}
          {swatch("Brand colour", theme.brandColor, v => p.patchTheme({ brandColor: v }), <span className="ctx-dot" style={{ background: theme.brandColor }} />)}
          <span className="ctx-hint">theme presets & shared fonts are in the panel</span>
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
          {button(<><span aria-hidden="true">🧲</span> Snap</>, () => p.patchTheme({ snapEnabled: !theme.snapEnabled }), theme.snapEnabled, "Magnetic snapping while dragging")}
          {button(<><span aria-hidden="true">⌖</span> Guides</>, () => p.patchTheme({ smartGuides: !(theme.smartGuides ?? true) }), theme.smartGuides ?? true, "Smart guides while dragging")}
          <span className="ctx-hint">X / Y / W / H, rotation and the position map are in the panel</span>
          {sep()}
        </>}
        {layering && <>
          <span className="ctx-hint">
            {p.layerTools?.total ?? 0} layers on this slide · drag a row in the panel to any slot in the stack · click
            to select it on the slide · 👁 hide · 🔒 lock · ⧉ duplicate · 🗑 delete
          </span>
        </>}
        {arrangeBar && <>
          {arrangeButtons}
          {sep()}
        </>}
        {inserting && p.nav === "images" && <>
          <label className="ctx-btn ctx-upload" title="Upload images (or a PDF) to this slide and library">
            📤 Upload image / PDF
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
          <span className="ctx-hint">or drop files on the slide · Shift+drop sets the background</span>
          {sep()}
        </>}
        {inserting && p.nav === "shapes" && <>
          {INSERT_SHAPES.map(k => (
            <span key={k}>{button(SHAPE_ICONS[k], () => p.insertShape?.(k), undefined, SHAPE_LABELS[k])}</span>
          ))}
          {sep()}
        </>}
        {text && <>
          {toggle("Font")}
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
          <label className="ctx-btn ctx-upload" title="Replace image">🖼 Replace<input aria-label="Replace image" type="file" accept="image/*" className="ctx-file" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { const { src, ratio } = await loadImageFile(file); patch({ src, naturalRatio: ratio }); } catch { alert('Could not read this image.'); } } }} /></label>
          <select aria-label="Image fit" title="Image fit" className="ctx-select" value={s.fit ?? 'contain'} onChange={e => patch({ fit: e.target.value as ShapeItem['fit'] })}><option value="contain">Fit</option><option value="cover">Fill / crop to box</option><option value="fill">Stretch</option></select>
          {button(<>⇋ Flip</>, () => patch({ flipH: !s.flipH }), undefined, "Flip horizontal")}
        </>}
        {s && !multi && <>{sep()}{stepper("Item opacity %", opacityPercent(s.itemOpacity), v => patch({ itemOpacity: opacityAlpha(v) }), 0, 100, 5, { prefix: <span aria-hidden="true">◐</span> })}{toggle("Effects", <span aria-hidden="true">✨</span>)}</>}
        {surface === 'frame' && <>{swatch("Frame color", (theme.frame ?? DEFAULT_FRAME).color, color => p.patchTheme({ frame: { ...(theme.frame ?? DEFAULT_FRAME), color } }))}{toggle("Frame", <span aria-hidden="true">🖼</span>)}</>}
        {surface === 'background' && <>{swatch("Color", theme.board, board => p.patchTheme({ board }))}{toggle("Gradient")}{toggle("Background effects")}</>}
        {multi && (p.grouped ? button(<>▢ Ungroup</>, p.ungroup, undefined, "Ungroup") : button(<>▣ Group</>, p.group, undefined, "Group"))}
        {!surface && <>{sep()}{toggle("Position")}</>}
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
