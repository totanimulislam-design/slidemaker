import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { BackgroundSettings, Box, ElementId, QuizOption, ThemeSettings } from "../lib/types";
import { DEFAULT_FRAME } from "../lib/types";
import { boxFontLabel, boxTypeface, setBoxFont } from "../lib/boxFonts";
import { SHAPE_ICONS, SHAPE_LABELS, loadImageFile, type ShapeItem, type ShapeKind } from "../lib/shapes";
import type { AlignOp } from "../lib/shapeAlign";
import { usePointerDrag } from "../lib/dragSession";
import { Z_LABELS, type ZOp } from "../lib/zorder";
import FontPicker from "./FontPicker";
import ShapeDesignPanel from "./ShapeDesignPanel";
import FramePanel from "./FramePanel";
import GradientEditor from "./GradientEditor";
import { SegButtons, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * The answer-key half of the toolbar, handed over by App while the "Answer key"
 * navigation destination is open.
 */
export interface AnswerKeyTools {
  answer: string | null;
  showAnswer: boolean;
  options: QuizOption[];
  onSetAnswer: (key: string | null) => void;
  onToggleReveal: () => void;
  onRevealAll: () => void;
  onHideAll: () => void;
  onClearAll: () => void;
  /** opens the paste-answers dialog */
  onPaste: () => void;
  /** duplicate every slide with its answer revealed */
  onCopies: () => void;
}

interface Props {
  shape?: ShapeItem; element: ElementId | null; surface: "frame" | "background" | null;
  count: number; grouped: boolean; theme: ThemeSettings; background: BackgroundSettings;
  patchShape: (p: Partial<ShapeItem>) => void; patchTheme: (p: Partial<ThemeSettings>) => void;
  patchBox: (p: Partial<Box>) => void; patchBackground: (p: Partial<BackgroundSettings>) => void;
  align: (op: AlignOp) => void; reorder: (op: ZOp) => void;
  group: () => void; ungroup: () => void; duplicate: () => void; remove: () => void;
  /**
   * Which inspector destination asked for this toolbar. The destinations that
   * own no single board element (Answer key, Insert images, Insert shapes) bring
   * their own related tools here instead of leaving the strip empty.
   */
  nav?: string | null;
  answerKey?: AnswerKeyTools;
  /** quick insert: a shape/text box on the current slide (Insert shapes) */
  insertShape?: (kind: ShapeKind) => void;
  /** quick insert: image files on the current slide (Insert images) */
  onAddImages?: (files: File[]) => void;
}

/** the shapes offered by the Insert-shapes strip, in the same order as below the board */
const INSERT_SHAPES: ShapeKind[] = ["text", "rect", "rounded", "ellipse", "triangle", "diamond", "star", "line", "arrow"];

/** tiny Canva-style text-alignment glyphs */
const ALIGN_GLYPH: Record<"left" | "center" | "right", ReactNode> = (["left", "center", "right"] as const).reduce(
  (acc, a) => {
    const x = (w: number) => (a === "left" ? 1 : a === "center" ? (14 - w) / 2 : 14 - 1 - w);
    acc[a] = (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <rect x={x(12)} y="2" width="12" height="1.8" rx="0.9" />
        <rect x={x(8)} y="6.1" width="8" height="1.8" rx="0.9" />
        <rect x={x(10)} y="10.2" width="10" height="1.8" rx="0.9" />
      </svg>
    );
    return acc;
  },
  {} as Record<"left" | "center" | "right", ReactNode>,
);

export default function ContextToolbar(p: Props) {
  const [panel, setPanel] = useState<string | null>(null);
  const { shape: s, element: el, surface, theme, patchShape: patch } = p;
  /** the answer-key half of the toolbar (only present on the Answer key destination) */
  const ak = p.answerKey;
  const multi = p.count > 1 || p.grouped;
  const text = !surface && !multi && (s?.kind === "text" || (!!el && el !== "logo" && !s));
  const tf = el ? boxTypeface(theme, el) : {};
  const fontPatch = (v: Parameters<typeof setBoxFont>[2]) => el && p.patchTheme({ boxFonts: setBoxFont(theme.boxFonts, el, v) });

  /* ---------------------------------------------------------------------- *
   * Movable pop-up panel
   *
   * The card a toolbar toggle opens (Font, Spacing, Frame, Answer …) can be
   * dragged anywhere by its header, so it never covers the slide area you are
   * working on. It starts life centred under the pill — the historical look —
   * and only switches to free (fixed) positioning once a real drag begins; a
   * press that never travels past the 4px threshold stays a plain click, exactly
   * like every other gesture in the editor (lib/dragSession owns the rules).
   * ---------------------------------------------------------------------- */
  const popRef = useRef<HTMLDivElement | null>(null);
  /** the card's measured box at the moment a drag was armed */
  const popBox = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 480, h: 280 });
  const [popPos, setPopPos] = useState<{ x: number; y: number; w: number } | null>(null);

  const measurePop = () => {
    const node = popRef.current;
    const r = node?.getBoundingClientRect();
    const w = Math.round(r?.width || node?.offsetWidth || 0) || 480;
    const h = Math.round(r?.height || node?.offsetHeight || 0) || 280;
    return { x: Math.round(r?.left ?? 0), y: Math.round(r?.top ?? 0), w, h };
  };

  /** keep the card reachable: the header (and a slice of the body) stays on screen */
  const clampPop = (x: number, y: number, w: number) => {
    const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    return {
      x: Math.round(Math.min(Math.max(x, 96 - w), Math.max(8, vw - 96))),
      y: Math.round(Math.min(Math.max(y, 4), Math.max(4, vh - 48))),
    };
  };

  /** the same position, readable from the window-resize listener without re-binding it */
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
    // the close button keeps behaving like a button, not a drag handle
    if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea, a")) return;
    const box = measurePop();
    popBox.current = box;
    // the card keeps its centred default until a real drag moves it
    beginPop(e, { x: box.x, y: box.y });
  };

  // a resized window must not strand a dragged card off screen
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
    const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)) * 10) / 10;
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
  /** colour well: the glyph previews the value, the native picker opens on click */
  const swatch = (name: string, value: string, change: (v: string) => void, glyph?: ReactNode) => (
    <label className="ctx-swatch" title={name}>
      <input
        aria-label={name} type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
        onChange={e => change(e.target.value)}
      />
      {glyph ?? <span className="ctx-dot" style={{ background: value }} />}
    </label>
  );
  const textSwatch = (name: string, value: string, change: (v: string) => void) =>
    swatch(name, value, change, <span className="ctx-a" style={{ borderBottomColor: value }}>A</span>);

  let content: ReactNode = null;
  if (panel === "Font" && text) content = <FontPicker label="Font family" script="all" compact value={s?.fontFamily || (el ? boxFontLabel(theme, el) : "")} onChange={family => s ? patch({ fontFamily: family }) : fontPatch({ family })} />;
  if (panel === "Spacing" && text) content = (
    <div>
      <div className="ctx-field"><span>Letter spacing</span>{stepper("Letter spacing", s?.letterSpacing ?? tf.letterSpacing ?? 0, v => s ? patch({ letterSpacing: v }) : fontPatch({ letterSpacing: v }), -2, 20, .5)}</div>
      {s && <div className="ctx-field"><span>Line height</span>{stepper("Line height", s.lineHeight ?? 1.2, v => patch({ lineHeight: v }), .5, 3, .1)}</div>}
    </div>
  );
  if (panel === "Effects" && s && !multi) content = <ShapeDesignPanel shape={s} onChange={patch} />;
  if (panel === "Frame") content = <FramePanel theme={theme} setTheme={p.patchTheme} />;
  if (panel === "Gradient") content = <GradientEditor label="Background gradient" value={p.background.gradient} fallback={theme.board} onChange={gradient => p.patchBackground({ gradient })} />;
  if (panel === "Background effects") content = (
    <div>
      <div className="ctx-field"><span>Blur</span>{stepper("Blur", p.background.blur, blur => p.patchBackground({ blur }), 0, 30)}</div>
      <div className="ctx-field"><span>Vignette</span>{stepper("Vignette", p.background.vignette, vignette => p.patchBackground({ vignette }), 0, 100)}</div>
    </div>
  );
  if (panel === "Position") content = (
    <div>
      <p className="ctx-menu-cap">Arrange</p>
      <div className="ctx-menu-grid">{(["front", "forward", "backward", "back"] as ZOp[]).map(op => <span key={op}>{button(<>{Z_LABELS[op].icon} {Z_LABELS[op].label}</>, () => p.reorder(op), undefined, `${Z_LABELS[op].label} — ${Z_LABELS[op].hint}`)}</span>)}</div>
      <p className="ctx-menu-cap">Align to slide</p>
      <div className="ctx-menu-grid">{([['left', 'Align left'], ['hcenter', 'Align center'], ['right', 'Align right'], ['top', 'Align top'], ['vcenter', 'Align middle'], ['bottom', 'Align bottom']] as [AlignOp, string][]).map(([op, label]) => <span key={op}>{button(label, () => p.align(op))}</span>)}</div>
    </div>
  );
  if (panel === "More" && s) content = (
    <div className="ctx-menu-col">
      {button(<>⧉ Duplicate</>, p.duplicate, undefined, "Duplicate")}
      {button(<>🗑 Delete</>, p.remove, undefined, "Delete", "danger")}
      {!multi && button(<>{s.locked ? "🔓 Unlock" : "🔒 Lock"}</>, () => patch({ locked: !s.locked }), undefined, s.locked ? "Unlock" : "Lock")}
    </div>
  );
  // the related panel of the "Answer key" destination: style, deck-wide actions,
  // and the paste-key entry point — everything the answer key needs, on the board
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

  const size = s?.fontSize ?? Math.round((tf.scale ?? 1) * 100);
  const setSize = (v: number) => s ? patch({ fontSize: Math.max(10, Math.min(120, v)) }) : fontPatch({ scale: Math.max(.6, Math.min(1.8, v / 100)) });
  const alignVal = s?.align ?? (el ? theme.layout[el].align : "left");
  const setAlign = (a: "left" | "center" | "right") => { const align = a as Box['align']; s ? patch({ align }) : p.patchBox({ align }); };
  /** the Insert destinations show their quick-add tools when nothing else is selected */
  const inserting = !s && !surface && (p.nav === "images" || p.nav === "shapes");
  const kindLabel = ak
    ? "Answer key"
    : inserting
      ? (p.nav === "images" ? "Insert image" : "Insert shape")
      : surface || (multi ? `Group · ${p.count}` : text ? 'Text' : s?.kind || 'Image');
  const toolbarLabel = `${ak ? "answer" : inserting ? "insert" : surface || (multi ? 'Group' : text ? 'Text' : s?.kind || 'Image')} tools`;

  return (
    <section className="context-toolbar" aria-label="Contextual editing tools">
      <div role="toolbar" aria-label={toolbarLabel} className="ctx-pill">
        <span className="ctx-kind">{kindLabel}</span>
        {/* the answer-key destination: mark, reveal, style, paste — right on the board */}
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
        {/* the insert destinations: quick-add tools above the board */}
        {inserting && p.nav === "images" && <>
          <label className="ctx-btn ctx-upload" title="Add image files to this slide">
            🖼 Add image
            <input
              aria-label="Add image files"
              type="file"
              accept="image/*"
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
          {stepper(s ? "Font size" : "Size %", size, setSize, s ? 10 : 60, s ? 120 : 180, .1, { dec: "Decrease font size", inc: "Increase font size", jump: 1 })}
          {sep()}
          {button(<span className="ctx-glyph-b">B</span>, () => s ? patch({ bold: !s.bold }) : fontPatch({ weight: (tf.weight ?? 400) >= 700 ? 400 : 700 }), s ? s.bold : (tf.weight ?? 400) >= 700, "Bold")}
          {button(<span className="ctx-glyph-i">I</span>, () => s ? patch({ italic: !s.italic }) : fontPatch({ italic: !tf.italic }), s ? s.italic : !!tf.italic, "Italic")}
          {button(<span className="ctx-glyph-u">U</span>, () => s ? patch({ underline: !s.underline }) : fontPatch({ underline: !tf.underline }), s ? !!s.underline : !!tf.underline, "Underline")}
          {button(<span className="ctx-glyph-s">S</span>, () => s ? patch({ strikethrough: !s.strikethrough }) : fontPatch({ strikethrough: !tf.strikethrough }), s ? !!s.strikethrough : !!tf.strikethrough, "Strikethrough")}
          {sep()}
          {s
            ? textSwatch("Text color", s.textColor, textColor => patch({ textColor, textGradient: s.textGradient ? { ...s.textGradient, enabled: false } : undefined }))
            : textSwatch("Text color", tf.color ?? "#ffffff", color => fontPatch({ color }))}
          {button("Aa", () => s ? patch({ uppercase: !s.uppercase }) : fontPatch({ uppercase: tf.uppercase !== true }), s ? !!s.uppercase : tf.uppercase === true, "Text case")}
          {sep()}
          {(["left", "center", "right"] as const).map(a => <span key={a}>{button(ALIGN_GLYPH[a], () => setAlign(a), alignVal === a, `Align ${a}`)}</span>)}
          {sep()}
          {toggle("Spacing", <span aria-hidden="true">⇄</span>)}
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
        {s && !multi && <>{sep()}{stepper("Opacity %", Math.round((s.itemOpacity ?? 1) * 100), v => patch({ itemOpacity: v / 100 }), 0, 100, 1, { prefix: <span aria-hidden="true">◐</span> })}{toggle("Effects", <span aria-hidden="true">✨</span>)}</>}
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
      {content && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={`${panel} settings`}
          data-pop-panel={panel}
          className={cn("ctx-pop", popPos && "ctx-pop-floating")}
          style={popPos ? { left: popPos.x, top: popPos.y, width: popPos.w } : undefined}
        >
          {/* the header is the drag handle: free positioning, double-click to re-centre */}
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
              {panel}
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
      )}
    </section>
  );
}
