import type { ReactNode } from "react";
import { useState } from "react";
import type { BackgroundSettings, Box, ElementId, ThemeSettings } from "../lib/types";
import { DEFAULT_FRAME } from "../lib/types";
import { boxFontLabel, boxTypeface, setBoxFont } from "../lib/boxFonts";
import type { ShapeItem } from "../lib/shapes";
import { loadImageFile } from "../lib/shapes";
import type { AlignOp } from "../lib/shapeAlign";
import { Z_LABELS, type ZOp } from "../lib/zorder";
import FontPicker from "./FontPicker";
import ShapeDesignPanel from "./ShapeDesignPanel";
import FramePanel from "./FramePanel";
import GradientEditor from "./GradientEditor";

interface Props {
  shape?: ShapeItem; element: ElementId | null; surface: "frame" | "background" | null;
  count: number; grouped: boolean; theme: ThemeSettings; background: BackgroundSettings;
  patchShape: (p: Partial<ShapeItem>) => void; patchTheme: (p: Partial<ThemeSettings>) => void;
  patchBox: (p: Partial<Box>) => void; patchBackground: (p: Partial<BackgroundSettings>) => void;
  align: (op: AlignOp) => void; reorder: (op: ZOp) => void;
  group: () => void; ungroup: () => void; duplicate: () => void; remove: () => void;
}

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
  const multi = p.count > 1 || p.grouped;
  const text = !surface && !multi && (s?.kind === "text" || (!!el && el !== "logo" && !s));
  const tf = el ? boxTypeface(theme, el) : {};
  const fontPatch = (v: Parameters<typeof setBoxFont>[2]) => el && p.patchTheme({ boxFonts: setBoxFont(theme.boxFonts, el, v) });

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

  const size = s?.fontSize ?? Math.round((tf.scale ?? 1) * 100);
  const setSize = (v: number) => s ? patch({ fontSize: Math.max(10, Math.min(120, v)) }) : fontPatch({ scale: Math.max(.6, Math.min(1.8, v / 100)) });
  const alignVal = s?.align ?? (el ? theme.layout[el].align : "left");
  const setAlign = (a: "left" | "center" | "right") => { const align = a as Box['align']; s ? patch({ align }) : p.patchBox({ align }); };
  const kindLabel = surface || (multi ? `Group · ${p.count}` : text ? 'Text' : s?.kind || 'Image');
  const toolbarLabel = `${surface || (multi ? 'Group' : text ? 'Text' : s?.kind || 'Image')} tools`;

  return (
    <section className="context-toolbar" aria-label="Contextual editing tools">
      <div role="toolbar" aria-label={toolbarLabel} className="ctx-pill">
        <span className="ctx-kind">{kindLabel}</span>
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
        <div className="ctx-pop" role="dialog" aria-label={`${panel} settings`}>
          <div className="ctx-pop-head"><span>{panel}</span>{button('✕', () => setPanel(null), undefined, 'Close toolbar panel')}</div>
          <div className="ctx-pop-body">{content}</div>
        </div>
      )}
    </section>
  );
}
