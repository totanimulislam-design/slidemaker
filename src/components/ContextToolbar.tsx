import { useState, type ReactNode } from "react";
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
export default function ContextToolbar(p: Props) {
  const [panel, setPanel] = useState<string | null>(null);
  const { shape: s, element: el, surface, theme, patchShape: patch } = p;
  const multi = p.count > 1 || p.grouped;
  const text = !surface && !multi && (s?.kind === "text" || (!!el && el !== "logo" && !s));
  const tf = el ? boxTypeface(theme, el) : {};
  const fontPatch = (v: Parameters<typeof setBoxFont>[2]) => el && p.patchTheme({ boxFonts: setBoxFont(theme.boxFonts, el, v) });
  const button = (label: string, action: () => void, active?: boolean, title = label) => <button type="button" title={title} aria-label={title} aria-pressed={active} onClick={action}>{label}</button>;
  const toggle = (name: string) => button(name + " ▾", () => setPanel(panel === name ? null : name), panel === name, name);
  const number = (name: string, value: number, onChange: (v: number) => void, min = 0, max = 200, step = 1) => <label>{name}<input aria-label={name} type="number" value={value} min={min} max={max} step={step} onChange={e => { const v = e.currentTarget.valueAsNumber; if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); }} /></label>;
  const color = (name: string, value: string, change: (v: string) => void) => <label title={name}>{name}<input aria-label={name} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={e => change(e.target.value)} /></label>;
  let content: ReactNode = null;
  if (panel === "Font" && text) content = <FontPicker label="Font family" script="all" compact value={s?.fontFamily || (el ? boxFontLabel(theme, el) : "")} onChange={family => s ? patch({ fontFamily: family }) : fontPatch({ family })} />;
  if (panel === "Spacing" && text) content = <div className="context-row">{number("Letter spacing", s?.letterSpacing ?? tf.letterSpacing ?? 0, v => s ? patch({ letterSpacing: v }) : fontPatch({ letterSpacing: v }), -2, 20, .5)}{s && number("Line height", s.lineHeight ?? 1.2, v => patch({ lineHeight: v }), .5, 3, .1)}</div>;
  if (panel === "Effects" && s && !multi) content = <ShapeDesignPanel shape={s} onChange={patch} />;
  if (panel === "Frame") content = <FramePanel theme={theme} setTheme={p.patchTheme} />;
  if (panel === "Gradient") content = <GradientEditor label="Background gradient" value={p.background.gradient} fallback={theme.board} onChange={gradient => p.patchBackground({ gradient })} />;
  if (panel === "Background effects") content = <div className="context-row">{number("Blur", p.background.blur, blur => p.patchBackground({ blur }), 0, 30)}{number("Vignette", p.background.vignette, vignette => p.patchBackground({ vignette }), 0, 100)}</div>;
  if (panel === "Position") content = <div className="context-row">{(["front", "forward", "backward", "back"] as ZOp[]).map(op => <span key={op}>{button(Z_LABELS[op].label, () => p.reorder(op))}</span>)}{([['left','Align left'],['hcenter','Align center'],['right','Align right'],['top','Align top'],['vcenter','Align middle'],['bottom','Align bottom']] as [AlignOp,string][]).map(([op,label]) => <span key={op}>{button(label, () => p.align(op))}</span>)}</div>;
  if (panel === "More" && s) content = <div className="context-row">{button("Duplicate", p.duplicate)}{button("Delete", p.remove)}{!multi && button(s.locked ? "Unlock" : "Lock", () => patch({ locked: !s.locked }))}</div>;
  const size = s?.fontSize ?? Math.round((tf.scale ?? 1) * 100);
  const setSize = (v: number) => s ? patch({ fontSize: Math.max(10, Math.min(120, v)) }) : fontPatch({ scale: Math.max(.6, Math.min(1.8, v / 100)) });
  return <section className="context-toolbar" aria-label="Contextual editing tools">
    <div role="toolbar" aria-label={`${surface || (multi ? 'Group' : text ? 'Text' : s?.kind || 'Image')} tools`} className="context-row context-scroll">
      <span className="context-kind">{surface || (multi ? `Group · ${p.count}` : text ? 'Text' : s?.kind || 'Image')}</span>
      {text && <>{!s && color("Text color", tf.color ?? "#ffffff", color => fontPatch({ color }))}{button("U", () => s ? patch({ underline: !s.underline }) : fontPatch({ underline: !tf.underline }), s ? !!s.underline : !!tf.underline, "Underline")}{button("S̶", () => s ? patch({ strikethrough: !s.strikethrough }) : fontPatch({ strikethrough: !tf.strikethrough }), s ? !!s.strikethrough : !!tf.strikethrough, "Strikethrough")}{toggle("Font")}{button("−", () => setSize(size - 1), undefined, "Decrease font size")}{number(s ? "Font size" : "Size %", size, setSize, s ? 10 : 60, s ? 120 : 180, .1)}{button("+", () => setSize(size + 1), undefined, "Increase font size")}{s && color("Text color", s.textColor, textColor => patch({ textColor, textGradient: s.textGradient ? { ...s.textGradient, enabled: false } : undefined }))}{button("B", () => s ? patch({ bold: !s.bold }) : fontPatch({ weight: (tf.weight ?? 400) >= 700 ? 400 : 700 }), s ? s.bold : (tf.weight ?? 400) >= 700, "Bold")}{button("I", () => s ? patch({ italic: !s.italic }) : fontPatch({ italic: !tf.italic }), s ? s.italic : !!tf.italic, "Italic")}{button("Aa", () => s ? patch({ uppercase: !s.uppercase }) : fontPatch({ uppercase: tf.uppercase !== true }), s ? !!s.uppercase : tf.uppercase === true, "Text case")}
        <select aria-label="Text alignment" value={s?.align ?? (el ? theme.layout[el].align : 'left')} onChange={e => { const align = e.target.value as Box['align']; s ? patch({ align }) : p.patchBox({ align }); }}><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option></select>{toggle("Spacing")}</>}
      {s && !multi && s.kind !== 'text' && s.kind !== 'image' && <>{color("Fill", s.fill, fill => patch({ fill, gradient: s.gradient ? { ...s.gradient, enabled: false } : undefined }))}{color("Border", s.stroke, stroke => patch({ stroke }))}{number("Border width", s.strokeWidth, strokeWidth => patch({ strokeWidth }), 0, 30)}</>}
      {s?.kind === 'image' && !multi && <><label className="context-upload">Replace<input aria-label="Replace image" type="file" accept="image/*" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { const {src, ratio} = await loadImageFile(file); patch({ src, naturalRatio: ratio }); } catch { alert('Could not read this image.'); } } }} /></label><select aria-label="Image fit" value={s.fit ?? 'contain'} onChange={e => patch({ fit: e.target.value as ShapeItem['fit'] })}><option value="contain">Fit</option><option value="cover">Fill / crop to box</option><option value="fill">Stretch</option></select>{button('Flip horizontal', () => patch({ flipH: !s.flipH }))}</>}
      {s && !multi && <>{number("Opacity %", Math.round((s.itemOpacity ?? 1) * 100), v => patch({ itemOpacity: v / 100 }), 0, 100)}{toggle("Effects")}</>}
      {surface === 'frame' && <>{color('Frame color', (theme.frame ?? DEFAULT_FRAME).color, color => p.patchTheme({ frame: { ...(theme.frame ?? DEFAULT_FRAME), color } }))}{toggle('Frame')}</>}
      {surface === 'background' && <>{color('Color', theme.board, board => p.patchTheme({ board }))}{toggle('Gradient')}{toggle('Background effects')}</>}
      {multi && (p.grouped ? button('Ungroup', p.ungroup) : button('Group', p.group))}
      {!surface && toggle('Position')}{s && toggle('More')}
    </div>
    {content && <div className="context-panel"><div className="flex justify-end">{button('✕', () => setPanel(null), undefined, 'Close toolbar panel')}</div>{content}</div>}
  </section>;
}
