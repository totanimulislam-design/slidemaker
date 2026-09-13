import { useEffect, useRef, useState } from "react";
import type { Box, Deck, DeckHeader, ElementId, LayoutMap, SlideData, ThemeSettings } from "../lib/types";
import { DEFAULT_LOGO } from "../lib/types";
import LayoutPanel from "./LayoutPanel";
import QuestionBulletPanel from "./QuestionBulletPanel";
import OptionBulletPanel from "./OptionBulletPanel";
import OptionTextPanel from "./OptionTextPanel";
import BannerPanel from "./BannerPanel";
import BackgroundPanel from "./BackgroundPanel";
import FramePanel from "./FramePanel";
import FontPicker from "./FontPicker";
import { toSingleFamily, ensureFontStylesheet, FONT_BY_FAMILY } from "../lib/fonts";
import type { BackgroundSettings } from "../lib/types";
import ShapesPanel, { type InsertScope } from "./ShapesPanel";
import type { ShapeItem, ShapeKind } from "../lib/shapes";
import type { ZOp } from "../lib/zorder";
import type { LayerRect, LayerRef } from "../lib/layers";
import type { AlignOp } from "../lib/shapeAlign";
import LayersPanel from "./LayersPanel";
import { MATH_SNIPPETS, PRESETS } from "../lib/presets";
import { describeScripts, type ScriptId } from "../lib/fonts";
import { handleSmartPaste } from "../lib/richPaste";
import type { ApplySection } from "../lib/applyDesign";
import type { SlideField } from "./Slide";
import { Btn, ColorInput, Field, Slider, TextArea, TextInput, Toggle } from "./ui";
import { cn } from "../utils/cn";

type Tab =
  | "question"
  | "header"
  | "title"
  | "background"
  | "frame"
  | "questionBullet"
  | "optionBullet"
  | "optionText"
  | "shapes";

interface Props {
  deck: Deck;
  slide?: SlideData;
  activeField: SlideField | null;
  setHeader: (patch: Partial<DeckHeader>) => void;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  transformLayout: (fn: (layout: LayoutMap) => LayoutMap, label?: string) => void;
  editScope: "slide" | "selected" | "all";
  onEditScope: (scope: "slide" | "selected" | "all") => void;
  scopeSlideIds: string[];
  onScopeSlideIds: (ids: string[]) => void;
  onApplyDesign: (scope: "slide" | "selected" | "all", targetSlideIds: string[], section?: ApplySection) => void;
  onRevertDesign: (slideIds: string[]) => void;
  updateSlide: (id: string, patch: Partial<SlideData>) => void;
  updateAll: (patch: Partial<SlideData>) => void;
  onAnswerCopies: () => void;
  onFixFormatting: (scope: "slide" | "all") => void;
  scripts: ScriptId[];
  selectedEl: ElementId;
  onSelectEl: (id: ElementId) => void;
  shapes: {
    slide: ShapeItem[];
    global: ShapeItem[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onAdd: (kind: ShapeKind, scope: InsertScope) => void;
    onChange: (id: string, patch: Partial<ShapeItem>) => void;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleScope: (id: string) => void;
    onAddImage: (src: string, ratio: number, scope: InsertScope) => void;
    onCopyShapeTo: (id: string, scope: InsertScope) => void;
    onReorder: (id: string, op: ZOp) => void;
    onApplyDesign: (style: Partial<ShapeItem>, kind: ShapeItem["kind"] | null, exceptId: string) => void;
  };
  /** externally requested tab (e.g. after selecting a shape on the canvas) */
  forceTab?: Tab | "slide" | "banner" | "layout" | "design" | null;
  background: {
    onSet: (patch: Partial<BackgroundSettings>, scope: "deck" | "slide" | string[]) => void;
    onReset: (scope: "deck" | "slide" | string[]) => void;
    onClearSlide: (ids: string[]) => void;
  };
  layers: {
    selected: LayerRef | null;
    onSelect: (ref: LayerRef) => void;
    onReorder: (ref: LayerRef, op: ZOp) => void;
    onAlign: (ref: LayerRef, op: AlignOp, target?: LayerRect) => void;
    onDistribute: (refs: LayerRef[], axis: "h" | "v") => void;
  };
}

export type InspectorTab = Tab | "slide" | "banner" | "layout" | "design";

export default function Inspector({
  deck,
  slide,
  activeField,
  setHeader,
  setTheme,
  patchLayout,
  transformLayout,
  editScope,
  onEditScope,
  scopeSlideIds,
  onScopeSlideIds,
  onApplyDesign,
  onRevertDesign,
  updateSlide,
  updateAll,
  onAnswerCopies,
  onFixFormatting,
  scripts,
  selectedEl,
  onSelectEl,
  shapes,
  forceTab,
  background,
  layers,
}: Props) {
  const [tab, setTab] = useState<Tab>("question");

  useEffect(() => {
    if (!forceTab) return;
    const legacyMap: Record<string, Tab> = {
      slide: "question",
      banner: "title",
      layout: "shapes",
      design: "header",
    };
    setTab(legacyMap[forceTab] ?? (forceTab as Tab));
  }, [forceTab]);
  const qRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeField) return;
    if (selectedEl === "bullet") {
      setTab("questionBullet");
      return;
    }
    if (activeField === "title") {
      setTab("title");
      return;
    }
    if (["brandTop", "brandBottom", "badge", "logo"].includes(activeField)) {
      setTab("header");
      return;
    }
    if (activeField.startsWith("option:")) setTab("optionText");
    else setTab("question");
    if (activeField === "question") {
      qRef.current?.focus();
    }
  }, [activeField, selectedEl]);

  const insertSnippet = (text: string) => {
    if (!slide) return;
    const el = qRef.current;
    if (!el) return;
    const start = el.selectionStart ?? slide.question.length;
    const end = el.selectionEnd ?? start;
    const next = slide.question.slice(0, start) + text + slide.question.slice(end);
    updateSlide(slide.id, { question: next });
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  const onLogo = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHeader({ logo: String(reader.result), showLogo: true });
    reader.readAsDataURL(file);
  };

  const T = deck.theme;

  // ---- resizable panel width (drag the left edge) ------------------------
  const [width, setWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("inspector:w"));
    return v >= 300 && v <= 720 ? v : 368;
  });
  const dragW = useRef<{ sx: number; w: number } | null>(null);
  useEffect(() => {
    localStorage.setItem("inspector:w", String(width));
  }, [width]);

  // ---- question textarea height remembered --------------------------------
  const [qRows, setQRows] = useState<number>(() => Number(localStorage.getItem("inspector:qrows")) || 4);

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-white/10 bg-slate-950/80"
      style={{ width }}
    >
      <div
        title="Drag to resize panel · double-click to reset"
        onDoubleClick={() => setWidth(368)}
        onPointerDown={(e) => {
          dragW.current = { sx: e.clientX, w: width };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragW.current) return;
          setWidth(Math.max(300, Math.min(720, dragW.current.w - (e.clientX - dragW.current.sx))));
        }}
        onPointerUp={(e) => {
          dragW.current = null;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        className="group absolute top-0 bottom-0 -left-1.5 z-20 w-3 cursor-col-resize select-none"
        style={{ touchAction: "none" }}
      >
        <div className="absolute top-1/2 left-1 h-16 w-1 -translate-y-1/2 rounded-full bg-white/15 group-hover:bg-amber-400/80 group-active:bg-amber-400" />
      </div>
      <nav className="grid grid-cols-4 gap-1 border-b border-white/10 p-2">
        {(
          [
            ["question", "Question"],
            ["header", "Header"],
            ["title", "Title"],
            ["background", "Background"],
            ["frame", "Frame"],
            ["questionBullet", "Question bullet"],
            ["optionBullet", "Option bullet"],
            ["optionText", "Option text"],
            ["shapes", "Shapes"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "min-h-10 rounded-lg px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors",
              tab === k ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <ScopeBar
        deck={deck}
        slide={slide}
        scope={editScope}
        onScope={onEditScope}
        selectedIds={scopeSlideIds}
        onSelectedIds={onScopeSlideIds}
        onApplyDesign={onApplyDesign}
        onRevertDesign={onRevertDesign}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "question" &&
          (slide ? (
            <>
              <Field label="Question" hint="use $...$ for math">
                <div className="mb-1 flex items-center justify-end gap-1">
                  {[3, 6, 10].map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setQRows(r);
                        localStorage.setItem("inspector:qrows", String(r));
                      }}
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px]",
                        qRows === r ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-400 hover:bg-white/10",
                      )}
                      title={`${r} lines tall`}
                    >
                      {r === 3 ? "S" : r === 6 ? "M" : "L"}
                    </button>
                  ))}
                </div>
                <TextArea
                  ref={qRef}
                  rows={qRows}
                  value={slide.question}
                  onPaste={(e) => {
                    const res = handleSmartPaste(e);
                    if (res) updateSlide(slide.id, { question: res.value });
                  }}
                  onChange={(e) => updateSlide(slide.id, { question: e.target.value })}
                  placeholder="প্রশ্ন লিখুন..."
                />
              </Field>
              <div className="flex items-center gap-1.5">
                <Btn size="sm" variant="soft" onClick={() => onFixFormatting("slide")} title="Convert x², ½, √, ≤ … into LaTeX on this slide">
                  ✨ Fix formatting
                </Btn>
                <Btn size="sm" onClick={() => onFixFormatting("all")} title="Apply to every slide in the deck">
                  Fix all slides
                </Btn>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MATH_SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => insertSnippet(s.insert)}
                    title={s.insert}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-amber-200 hover:bg-white/10"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <Field label="Footnote (optional)">
                <TextInput
                  value={slide.note ?? ""}
                  placeholder="e.g. বোর্ড: ঢাকা ২০২৪"
                  onChange={(e) => updateSlide(slide.id, { note: e.target.value })}
                />
              </Field>

              <Field label="Text size on this slide">
                <Slider min={0.6} max={1.5} step={0.05} value={slide.scale} onChange={(v) => updateSlide(slide.id, { scale: v })} />
              </Field>
              <Field label="Question font size" hint={`${T.questionSize}px`}>
                <Slider min={20} max={52} value={T.questionSize} onChange={(v) => setTheme({ questionSize: v })} />
              </Field>
              <FontPicker
                label="Question font"
                value={toSingleFamily(T.bengaliFont)}
                onChange={(family) => {
                  const meta = FONT_BY_FAMILY.get(family.toLowerCase());
                  if (meta) ensureFontStylesheet([meta]);
                  setTheme({ bengaliFont: `'${family}', sans-serif` });
                }}
                script="bangla"
                compact
              />
              <ColorInput label="Question colour" value={T.questionColor} onChange={(v) => setTheme({ questionColor: v })} />

            </>
          ) : (
            <p className="text-sm text-slate-500">No slide selected. Paste some questions to begin.</p>
          ))}

        {tab === "header" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Brand line 1">
                <TextInput value={deck.header.brandTop} onChange={(e) => setHeader({ brandTop: e.target.value })} />
              </Field>
              <Field label="Brand line 2">
                <TextInput
                  value={deck.header.brandBottom}
                  onChange={(e) => setHeader({ brandBottom: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Right badge" hint="all slides">
              <TextInput value={deck.header.badge} onChange={(e) => setHeader({ badge: e.target.value })} />
            </Field>

            <Field label="Logo">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/60">
                  {deck.header.logo ? (
                    <img src={deck.header.logo} alt="logo" className="max-h-14 max-w-14 object-contain" />
                  ) : (
                    <span className="text-xs text-slate-600">none</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block cursor-pointer rounded-lg bg-amber-400 px-3 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-amber-300">
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onLogo(e.target.files?.[0])}
                    />
                  </label>
                  <div className="flex gap-1.5">
                    <Btn size="sm" onClick={() => setHeader({ logo: DEFAULT_LOGO })}>
                      Default
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => setHeader({ logo: null })}>
                      Remove
                    </Btn>
                  </div>
                </div>
              </div>
            </Field>

            <Toggle label="Show logo" checked={deck.header.showLogo} onChange={(v) => setHeader({ showLogo: v })} />
            <FontPicker
              label="Brand and badge font"
              value={toSingleFamily(T.latinFont)}
              onChange={(family) => {
                const meta = FONT_BY_FAMILY.get(family.toLowerCase());
                if (meta) ensureFontStylesheet([meta]);
                setTheme({ latinFont: `'${family}', sans-serif` });
              }}
              script="latin"
              compact
            />
            <FontPicker
              label="Arabic / Urdu fallback"
              value={toSingleFamily(T.arabicFont)}
              onChange={(family) => {
                const meta = FONT_BY_FAMILY.get(family.toLowerCase());
                if (meta) ensureFontStylesheet([meta]);
                setTheme({ arabicFont: `'${family}'` });
              }}
              script="arabic"
              compact
            />
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Brand" value={T.brandColor} onChange={(v) => setTheme({ brandColor: v })} />
              <ColorInput label="Badge" value={T.badgeColor} onChange={(v) => setTheme({ badgeColor: v })} />
              <ColorInput label="Frame" value={T.frame.color} onChange={(v) => setTheme({ frame: { ...T.frame, color: v } })} />
              <ColorInput label="Board" value={T.board} onChange={(v) => setTheme({ board: v })} />
              <ColorInput label="Outer" value={T.frameOuter} onChange={(v) => setTheme({ frameOuter: v })} />
              <ColorInput label="Title banner" value={T.titleBanner} onChange={(v) => setTheme({ titleBanner: v })} />
            </div>
            <Toggle label="Show frame" checked={T.showFrame} onChange={(v) => setTheme({ showFrame: v })} />
            <Field label="Theme presets">
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setTheme({ ...p.theme, banner: { ...T.banner, color: p.theme.titleBanner ?? T.banner.color } })}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-left text-xs text-slate-300 hover:border-amber-400/50"
                  >
                    <span className="flex">
                      {p.swatch.map((c) => <span key={c} className="-ml-1 h-4 w-4 rounded-full border border-black/50 first:ml-0" style={{ background: c }} />)}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {describeScripts(scripts).map((s) => (
                <span key={s.id} className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
                  {s.label}{s.rtl ? " · RTL" : ""}
                </span>
              ))}
            </div>
            <button
              onClick={() => setTab("title")}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 hover:border-amber-400/50"
            >
              Title banner design &amp; gradient
              <span className="text-xs text-amber-300">Open →</span>
            </button>
          </>
        )}

        {tab === "title" && <BannerPanel theme={deck.theme} header={deck.header} setTheme={setTheme} setHeader={setHeader} />}

        {tab === "frame" && <FramePanel theme={deck.theme} setTheme={setTheme} />}

        {tab === "background" && (
          <BackgroundPanel
            deck={deck}
            slide={slide}
            onSet={background.onSet}
            onReset={background.onReset}
            onClearSlide={background.onClearSlide}
            onRemoveShape={shapes.onRemove}
            managedScope
          />
        )}

        {tab === "questionBullet" && (
          <QuestionBulletPanel
            theme={T}
            slide={slide}
            setTheme={setTheme}
            updateSlide={updateSlide}
            onSelectBullet={() => {
              onSelectEl("bullet");
              setTab("shapes");
            }}
          />
        )}

        {tab === "optionBullet" && <OptionBulletPanel theme={T} setTheme={setTheme} />}

        {tab === "optionText" && (
          <OptionTextPanel
            slide={slide}
            theme={T}
            setTheme={setTheme}
            updateSlide={updateSlide}
            updateAll={updateAll}
            onAnswerCopies={onAnswerCopies}
          />
        )}

        {tab === "shapes" && (
          <>
            <LayoutPanel
              theme={deck.theme}
              setTheme={setTheme}
              patchLayout={patchLayout}
              transformLayout={transformLayout}
              selected={selectedEl}
              onSelect={onSelectEl}
            />
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                Layers — everything on this slide
              </span>
              <LayersPanel
                deck={deck}
                slide={slide}
                selected={layers.selected}
                onSelect={layers.onSelect}
                onReorder={layers.onReorder}
                onAlign={layers.onAlign}
                onDistribute={layers.onDistribute}
                onToggleLock={(id) => {
                  const it = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].find((x) => x.id === id);
                  if (it) shapes.onChange(id, { locked: !it.locked });
                }}
                compact
              />
            </div>
          </>
        )}

        {tab === "shapes" && (
          <ShapesPanel
            slideShapes={shapes.slide}
            globalShapes={shapes.global}
            selectedId={shapes.selectedId}
            onSelect={shapes.onSelect}
            onAdd={shapes.onAdd}
            onChange={shapes.onChange}
            onRemove={shapes.onRemove}
            onDuplicate={shapes.onDuplicate}
            onToggleScope={shapes.onToggleScope}
            snapEnabled={deck.theme.snapEnabled}
            onSnapChange={(v) => setTheme({ snapEnabled: v })}
            smartGuides={deck.theme.smartGuides ?? true}
            onSmartGuidesChange={(v) => setTheme({ smartGuides: v })}
            onAddImage={shapes.onAddImage}
            slides={deck.slides.map((s) => ({ id: s.id, number: s.number, question: s.question }))}
            currentSlideId={slide?.id ?? null}
            onCopyShapeTo={shapes.onCopyShapeTo}
            onReorder={shapes.onReorder}
            onApplyDesign={shapes.onApplyDesign}
              managedScope
            layersPanel={
              <LayersPanel
                deck={deck}
                slide={slide}
                selected={layers.selected}
                onSelect={layers.onSelect}
                onReorder={layers.onReorder}
                onAlign={layers.onAlign}
                onDistribute={layers.onDistribute}
                onToggleLock={(id) => {
                  const it = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].find((x) => x.id === id);
                  if (it) shapes.onChange(id, { locked: !it.locked });
                }}
              />
            }
          />
        )}

      </div>
    </aside>
  );
}

function ScopeBar({
  deck,
  slide,
  scope,
  onScope,
  selectedIds,
  onSelectedIds,
  onApplyDesign,
  onRevertDesign,
}: {
  deck: Deck;
  slide?: SlideData;
  scope: "slide" | "selected" | "all";
  onScope: (scope: "slide" | "selected" | "all") => void;
  selectedIds: string[];
  onSelectedIds: (ids: string[]) => void;
  onApplyDesign: (scope: "slide" | "selected" | "all", targetSlideIds: string[], section?: ApplySection) => void;
  onRevertDesign: (slideIds: string[]) => void;
}) {
  const [section, setSection] = useState<ApplySection>("all");
  const [toast, setToast] = useState<string | null>(null);

  const choose = (next: typeof scope) => {
    onScope(next);
    if (next === "selected" && !selectedIds.length && slide) onSelectedIds([slide.id]);
  };

  const handleApply = () => {
    if (scope === "selected" && !selectedIds.length) {
      setToast("Select at least one slide first.");
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    onApplyDesign(scope, selectedIds, section);
    const targetText =
      scope === "all"
        ? "All Slides"
        : scope === "selected"
          ? `${selectedIds.length || 1} Selected Slides`
          : "This Slide";
    setToast(`✓ Changes successfully applied to ${targetText}!`);
    window.setTimeout(() => setToast(null), 3500);
  };

  const hasOverride =
    !!slide?.themeOverride || !!slide?.headerOverride || !!slide?.background || !!slide?.shapes?.length;

  return (
    <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-amber-400/[0.08] to-transparent p-2.5 space-y-2">
      {/* Toast feedback */}
      {toast && (
        <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1.5 text-xs text-emerald-200 font-medium flex items-center justify-between animate-fadeIn">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-emerald-300 hover:text-white text-xs">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Target Scope
        </span>
        {hasOverride && (
          <button
            onClick={() => slide && onRevertDesign([slide.id])}
            className="text-[10px] text-rose-300 hover:underline"
            title="Clear this slide's custom overrides to follow the deck default"
          >
            ↩ Revert to Default
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {([
          ["slide", "This slide"],
          ["selected", `Selected${selectedIds.length ? ` (${selectedIds.length})` : ""}`],
          ["all", "All slides"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => choose(id)}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all",
              scope === id
                ? "border-amber-400 bg-amber-400 text-slate-950 shadow-[0_2px_10px_rgba(251,191,36,0.3)]"
                : "border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/10",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {scope === "selected" && (
        <div className="rounded-lg border border-white/10 bg-slate-950/80 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-amber-200">
              {selectedIds.length} of {deck.slides.length} slides selected
            </span>
            <div className="flex gap-1">
              <button onClick={() => onSelectedIds(deck.slides.map((s) => s.id))} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/10">all</button>
              <button onClick={() => onSelectedIds([])} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/10">none</button>
              <button onClick={() => onSelectedIds(deck.slides.filter((_, i) => i % 2 === 0).map((s) => s.id))} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/10">odd</button>
              <button onClick={() => onSelectedIds(deck.slides.filter((_, i) => i % 2 === 1).map((s) => s.id))} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/10">even</button>
            </div>
          </div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded border border-white/5 bg-slate-900/50 p-1">
            {deck.slides.map((s, i) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() =>
                    onSelectedIds(
                      selectedIds.includes(s.id)
                        ? selectedIds.filter((id) => id !== s.id)
                        : [...selectedIds, s.id],
                    )
                  }
                  className="accent-amber-400"
                />
                <span className="w-5 text-slate-500 font-mono">{i + 1}</span>
                <span className="truncate">{s.question.replace(/\$[^$]*\$/g, "math").slice(0, 36) || "Blank slide"}</span>
                {(s.themeOverride || s.headerOverride || s.background) && (
                  <span className="ml-auto text-[8px] rounded bg-amber-400/20 text-amber-200 px-1">custom</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Main Apply Changes button */}
      <div className="pt-0.5">
        <button
          onClick={handleApply}
          disabled={scope === "selected" && !selectedIds.length}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-[0_2px_14px_rgba(251,191,36,.35)] hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>✨</span>
          <span>
            {scope === "all"
              ? "Apply Changes to All Slides"
              : scope === "selected"
                ? `Apply Changes to ${selectedIds.length || 1} Selected Slides`
                : "Apply Changes to This Slide"}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
        <span>Settings to copy:</span>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as ApplySection)}
          className="rounded border border-white/10 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200 outline-none"
        >
          <option value="all">All Design Settings</option>
          <option value="header">Header & Title</option>
          <option value="theme">Theme, Fonts & Colors</option>
          <option value="frame">Frame Design</option>
          <option value="background">Background</option>
          <option value="bullets">Question Bullets</option>
          <option value="options">Option Bullets & Rows</option>
          <option value="layout">Layout / Positions</option>
          <option value="shapes">Shapes, Images & Text Boxes</option>
        </select>
      </div>

      <p className="text-[9.5px] leading-relaxed text-slate-400">
        💡 Edit any section below to preview live on this slide. Click <span className="text-amber-300 font-medium">Apply Changes</span> to push to your target scope.
      </p>
    </div>
  );
}
