import { useEffect, useRef, useState } from "react";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "../lib/dragSession";
import type { Box, Deck, DeckHeader, ElementId, LayoutMap, SlideData, ThemeSettings } from "../lib/types";
import { ELEMENT_LABELS } from "../lib/types";
import LayoutPanel from "./LayoutPanel";
import QuestionBulletPanel from "./QuestionBulletPanel";
import OptionBulletPanel from "./OptionBulletPanel";
import OptionBulletTextPanel from "./OptionBulletTextPanel";
import OptionTextPanel from "./OptionTextPanel";
import TitleTextPanel from "./TitleTextPanel";
import TitleBackgroundPanel from "./TitleBackgroundPanel";
import BrandLinePanel from "./BrandLinePanel";
import BadgePanel from "./BadgePanel";
import LogoPanel from "./LogoPanel";
import BulletTextPanel from "./BulletTextPanel";
import FootnotePanel from "./FootnotePanel";
import ImagesPanel from "./ImagesPanel";
import BackgroundPanel from "./BackgroundPanel";
import FramePanel from "./FramePanel";
import type { BackgroundSettings } from "../lib/types";
import ShapesPanel, { type InsertScope } from "./ShapesPanel";
import type { ShapeItem, ShapeKind } from "../lib/shapes";
import type { ZOp } from "../lib/zorder";
import { layerKey, sortedLayers, type LayerPatch, type LayerRect, type LayerRef } from "../lib/layers";
import type { AlignOp } from "../lib/shapeAlign";
import AnswerKeyPanel from "./AnswerKeyPanel";
import LayersPanel from "./LayersPanel";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import { elementInk, setElementInk } from "../lib/boxFonts";
import { MATH_SNIPPETS } from "../lib/presets";
import { type ScriptId } from "../lib/fonts";
import ThemePanel from "./ThemePanel";
import { handleSmartPaste } from "../lib/richPaste";
import type { ApplySection } from "../lib/applyDesign";
import type { SlideField } from "./Slide";
import { Btn, ColorInput, Field, PanelHead, Slider, TextArea } from "./ui";
import { cn } from "../utils/cn";

/**
 * The inspector's navigation: one destination per thing you can restyle on a
 * slide, in the order they appear on the board — the deck-wide design first,
 * then title, badges, logo, question, options, footnote, the slide surface,
 * and finally the items you insert.
 *
 * Every panel holds ONLY the features its navigation entry names — deck-wide
 * defaults live under "Design", element positions under "Layout" — so a name
 * always tells you what you get. Every entry also declares what it *selects on
 * the canvas*, so opening a panel immediately outlines the matching content on
 * the slide (and vice-versa: clicking that content on the slide opens its
 * panel).
 */
type Tab =
  | "theme"
  | "titleText"
  | "titleBg"
  | "badge1"
  | "badge2"
  | "badge3"
  | "logo"
  | "questionBullet"
  | "bulletText"
  | "questionText"
  | "optionBullet"
  | "optionBulletText"
  | "optionText"
  | "answerKey"
  | "footnote"
  | "background"
  | "frame"
  | "layout"
  | "images"
  | "shapes"
  | "layers";

interface NavItem {
  id: Tab;
  label: string;
  icon: string;
  /** full name shown in the tooltip */
  title: string;
  /** board element this panel edits — picking it selects it on the slide */
  element?: ElementId;
  /** slide surface instead of an element */
  surface?: "frame" | "background";
  /**
   * This destination lists what is ALREADY selected instead of owning one thing,
   * so opening it must leave the canvas selection exactly as it is.
   */
  keepSelection?: boolean;
}

const NAV: NavItem[] = [
  {
    id: "theme",
    label: "Design",
    icon: "🎨",
    title: "Design & defaults — deck-wide presets, base colours and shared fonts",
  },
  { id: "titleText", label: "Title text", icon: "T", title: "Title text — the heading itself", element: "title" },
  { id: "titleBg", label: "Title background", icon: "▣", title: "Title background — the banner behind it", element: "title" },
  { id: "badge1", label: "Badge 1", icon: "①", title: "Badge 1 — upper brand line", element: "brand" },
  { id: "badge2", label: "Badge 2", icon: "②", title: "Badge 2 — lower brand line", element: "brand" },
  { id: "badge3", label: "Badge 3", icon: "③", title: "Badge 3 — right-hand badge", element: "badge" },
  { id: "logo", label: "Logo", icon: "◈", title: "Logo — the corner crest", element: "logo" },
  { id: "questionBullet", label: "Question bullet", icon: "●", title: "Question bullet — the number marker", element: "bullet" },
  { id: "bulletText", label: "Q bullet text", icon: "#", title: "Text inside the question bullet", element: "bullet" },
  { id: "questionText", label: "Question text", icon: "?", title: "Question text", element: "question" },
  { id: "optionBullet", label: "Option bullet", icon: "○", title: "Option bullet — the choice markers", element: "options" },
  { id: "optionBulletText", label: "Opt bullet text", icon: "A", title: "Text inside the option bullet", element: "options" },
  { id: "optionText", label: "Option text", icon: "▤", title: "Option text — the choices", element: "options" },
  {
    id: "answerKey",
    label: "Answer key",
    icon: "✓",
    title: "Answer key — mark, reveal, paste and style the correct answers",
    element: "options",
  },
  { id: "footnote", label: "Footnote", icon: "¶", title: "Footnote — the bottom note line", element: "note" },
  { id: "background", label: "Slide background", icon: "▧", title: "Slide background", surface: "background" },
  { id: "frame", label: "Slide frame", icon: "▢", title: "Slide frame", surface: "frame" },
  {
    id: "layout",
    label: "Layout",
    icon: "✥",
    title: "Slide layout — where every element sits and snaps: position, size, rotation, alignment",
  },
  { id: "images", label: "Uploads", icon: "📤", title: "Uploads — pictures, diagrams and uploaded elements" },
  { id: "shapes", label: "Insert shapes", icon: "◇", title: "Insert shapes, text boxes and layers" },
  {
    id: "layers",
    label: "Layers",
    icon: "⧉",
    title: "Layers — everything on the slide in one stack: drag a row to reorder it, click it to select it on the slide",
    keepSelection: true,
  },
];

/**
 * The destination that styles a board element. Several tiles share one element
 * (the options block alone has four), so this picks the same "main" tile App
 * opens when the element is selected on the canvas — the Layers list's
 * *Edit … →* jump has to land in the same place.
 */
const ELEMENT_DEST: Record<ElementId, Tab> = {
  logo: "logo",
  brand: "badge1",
  title: "titleText",
  badge: "badge3",
  bullet: "questionBullet",
  question: "questionText",
  options: "optionText",
  note: "footnote",
};

/** tab a canvas click on `field` should open (slide → navigation sync) */
const TAB_OF_FIELD: Record<SlideField, Tab> = {
  title: "titleText",
  brandTop: "badge1",
  brandBottom: "badge2",
  badge: "badge3",
  logo: "logo",
  question: "questionText",
  note: "footnote",
  "option:0": "optionText",
};

const tabOfField = (field: SlideField): Tab =>
  TAB_OF_FIELD[field] ?? (field.startsWith("option:") ? "optionText" : "questionText");

/** legacy `forceTab` values still sent by App, mapped onto the new navigation */
const LEGACY_TAB: Record<string, Tab> = {
  slide: "questionText",
  question: "questionText",
  banner: "titleText",
  title: "titleText",
  header: "badge1",
  design: "badge1",
  layout: "layout",
  uploads: "images",
};

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
  /** opens the paste-answers dialog (also reachable from the Answer key panel) */
  onPasteAnswers: () => void;
  /** jump the editor to a slide (the Answer key overview does this) */
  onJumpToSlide: (index: number) => void;
  onFixFormatting: (scope: "slide" | "all") => void;
  scripts: ScriptId[];
  selectedEl: ElementId;
  onSelectEl: (id: ElementId) => void;
  /**
   * Picking a navigation item also selects its content on the slide: an element
   * gets the cyan outline + handles, a surface gets its own context toolbar, and
   * the insert tabs simply release the element selection (a selected picture or
   * shape stays selected so this panel can keep editing it).
   */
  onNavSelect: (target: {
    element?: ElementId;
    surface?: "frame" | "background";
    nav?: Tab;
    /** leave the canvas selection alone (the Layers destination) */
    keepSelection?: boolean;
  }) => void;
  shapes: {
    slide: ShapeItem[];
    global: ShapeItem[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    /** full multi-selection on the canvas (group members included) */
    selectedIds: string[];
    onGroup: (ids: string[]) => void;
    onUngroup: (ids: string[]) => void;
    onRemoveIds: (ids: string[]) => void;
    onDuplicateIds: (ids: string[]) => void;
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
  forceTab?: Tab | keyof typeof LEGACY_TAB | null;
  /**
   * Bumped on every request so asking for the tab that is already recorded
   * still re-opens it (React bails out on an identical state value).
   */
  forceToken?: number;
  background: {
    onSet: (patch: Partial<BackgroundSettings>, scope: "deck" | "slide" | string[]) => void;
    onReset: (scope: "deck" | "slide" | string[]) => void;
    onClearSlide: (ids: string[]) => void;
  };
  layers: {
    selected: LayerRef | null;
    /** every drawn item selected on the canvas (a group lights up as a whole) */
    selectedIds: string[];
    onSelect: (ref: LayerRef, additive?: boolean) => void;
    onReorder: (ref: LayerRef, op: ZOp) => void;
    /** drag & drop: the stack slot (from the bottom) the layers were dropped into */
    onMoveTo: (refs: LayerRef[], index: number) => void;
    /** 👁 hide/show, 🔒 lock/unlock and rename, for elements and drawn items alike */
    onPatch: (refs: LayerRef[], patch: LayerPatch) => void;
    onDuplicate: (refs: LayerRef[]) => void;
    /** drawn items are deleted; a built-in element is hidden instead */
    onDelete: (refs: LayerRef[]) => void;
    onAlign: (ref: LayerRef, op: AlignOp, target?: LayerRect) => void;
    onDistribute: (refs: LayerRef[], axis: "h" | "v") => void;
  };
}

export type InspectorTab = Tab | keyof typeof LEGACY_TAB;

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
  onPasteAnswers,
  onJumpToSlide,
  onFixFormatting,
  scripts,
  selectedEl,
  onSelectEl,
  onNavSelect,
  shapes,
  forceTab,
  forceToken,
  background,
  layers,
}: Props) {
  const [tab, setTab] = useState<Tab>("questionText");

  useEffect(() => {
    if (!forceTab) return;
    setTab(LEGACY_TAB[forceTab] ?? (forceTab as Tab));
  }, [forceTab, forceToken]);
  const qRef = useRef<HTMLTextAreaElement>(null);
  /** the open destination, readable from effects without re-running them */
  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;

  /**
   * Clicking content on the slide opens the panel that edits it — unless the
   * Layers destination is open. That one is a list of the whole board, so a
   * canvas click only moves its selection (Canva keeps its layers list open too);
   * the panel offers a one-click jump to the clicked thing's own destination.
   */
  useEffect(() => {
    if (!activeField || tabRef.current === "layers") return;
    if (selectedEl === "bullet") {
      setTab("bulletText");
      return;
    }
    setTab(tabOfField(activeField));
    if (activeField === "question") qRef.current?.focus();
  }, [activeField, selectedEl]);

  /** a navigation pick: open the panel AND select its content on the slide */
  const choose = (item: NavItem) => {
    setTab(item.id);
    onNavSelect({
      element: item.element,
      surface: item.surface,
      nav: item.id,
      keepSelection: item.keepSelection,
    });
  };

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

  const T = deck.theme;

  // ---- resizable panel width (drag the left edge) ------------------------
  const [width, setWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("inspector:w"));
    return v >= 300 && v <= 720 ? v : 368;
  });
  /**
   * Panel width follows the pointer ONLY inside a real drag: the same guarded
   * session the slide board uses, so the edge can never start resizing on hover
   * if a pointer-up was ever missed.
   */
  const { begin: beginEdge, end: endEdge } = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    onMove: (e, st) =>
      setWidth(Math.max(300, Math.min(720, st.initialObjectX - (e.clientX - st.dragStartX)))),
  });
  useEffect(() => {
    localStorage.setItem("inspector:w", String(width));
  }, [width]);

  // ---- question textarea height remembered --------------------------------
  const [qRows, setQRows] = useState<number>(() => Number(localStorage.getItem("inspector:qrows")) || 4);

  const activeNav = NAV.find((n) => n.id === tab);

  /**
   * The unified layer list, shared by the Layers destination and the "Layer
   * order" field of the Insert-shapes panel. `expanded` only grows the list, so
   * the destination can show the whole stack without scrolling as much.
   */
  const layersList = (expanded?: boolean) => (
    <LayersPanel
      deck={deck}
      slide={slide}
      selected={layers.selected}
      selectedIds={layers.selectedIds}
      onSelect={layers.onSelect}
      onReorder={layers.onReorder}
      onMoveTo={layers.onMoveTo}
      onPatch={layers.onPatch}
      onDuplicate={layers.onDuplicate}
      onDelete={layers.onDelete}
      onAlign={layers.onAlign}
      onDistribute={layers.onDistribute}
      expanded={expanded}
    />
  );

  /** what the Layers destination needs to know about the current selection */
  const layerRows = (() => {
    const all = sortedLayers(deck, slide);
    const sel = layers.selected ? all.find((l) => l.key === layerKey(layers.selected!)) : undefined;
    const drawn = all.filter((l) => l.ref.kind === "shape").length;
    /** the destination that styles the selected layer, for the one-click jump */
    const jump: NavItem | null = !sel
      ? null
      : sel.ref.kind === "element"
        ? (NAV.find((n) => n.id === ELEMENT_DEST[sel.ref.id as ElementId]) ?? null)
        : (() => {
            const it = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].find((x) => x.id === sel.ref.id);
            return NAV.find((n) => n.id === (it?.kind === "image" ? "images" : "shapes")) ?? null;
          })();
    return { total: all.length, drawn, jump, selectedLabel: sel?.label ?? "" };
  })();

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-white/10 bg-slate-950/80"
      style={{ width }}
    >
      <div
        title="Drag to resize panel · double-click to reset"
        onDoubleClick={() => setWidth(368)}
        onPointerDown={(e) => beginEdge(e, { x: width, y: 0 })}
        onPointerUp={endEdge}
        onPointerCancel={endEdge}
        className="group absolute top-0 bottom-0 -left-1.5 z-20 w-3 cursor-col-resize select-none"
        style={{ touchAction: "none" }}
      >
        <div className="absolute top-1/2 left-1 h-16 w-1 -translate-y-1/2 rounded-full bg-white/15 group-hover:bg-amber-400/80 group-active:bg-amber-400" />
      </div>

      {/* -------------------------------- navigation ------------------------- */}
      <nav className="shrink-0 border-b border-white/10 bg-slate-950/70 p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {NAV.map((item) => {
            const active = tab === item.id;
            /* 21 tiles = five rows of four + a full-width Layers dock closing
               the grid, so the layout never strands a lone orphan tile */
            const dock = item.id === "layers";
            return (
              <button
                key={item.id}
                type="button"
                data-nav={item.id}
                onClick={() => choose(item)}
                title={
                  item.title +
                  (item.element
                    ? ` — selects ${ELEMENT_LABELS[item.element]} on the slide`
                    : item.surface
                      ? ` — selects the slide ${item.surface}`
                      : "")
                }
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-[38px] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 leading-tight transition-colors",
                  dock && "col-span-4 min-h-0 flex-row justify-start gap-1.5 px-2.5 py-1.5",
                  active
                    ? "border-amber-400 bg-amber-400 text-slate-950"
                    : "border-transparent text-slate-400 hover:bg-white/[0.07] hover:text-slate-200",
                )}
              >
                <span className="text-[13px] leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className={cn("text-center text-[9px] font-medium", dock && "text-left text-[10px]")}>{item.label}</span>
                {dock && (
                  <span className={cn("ml-auto text-[9px] font-normal", active ? "text-slate-800/80" : "text-slate-500")} aria-hidden>
                    everything on the slide, stacked
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
        {/* ------------------------ design & defaults ------------------------ */}
        {tab === "theme" && <ThemePanel theme={T} setTheme={setTheme} scripts={scripts} />}

        {/* --------------------------- title text ---------------------------- */}
        {tab === "titleText" && (
          <TitleTextPanel
            theme={T}
            header={deck.header}
            setTheme={setTheme}
            setHeader={setHeader}
            patchLayout={patchLayout}
          />
        )}

        {/* ------------------------ title background ------------------------- */}
        {tab === "titleBg" && (
          <TitleBackgroundPanel
            theme={T}
            header={deck.header}
            setTheme={setTheme}
            setHeader={setHeader}
            patchLayout={patchLayout}
          />
        )}

        {/* --------------------------- badge 1 / 2 --------------------------- */}
        {(tab === "badge1" || tab === "badge2") && (
          <BrandLinePanel
            line={tab === "badge1" ? "top" : "bottom"}
            theme={T}
            header={deck.header}
            setTheme={setTheme}
            setHeader={setHeader}
            patchLayout={patchLayout}
          />
        )}

        {/* ------------------------------ badge 3 ---------------------------- */}
        {tab === "badge3" && (
          <BadgePanel
            theme={T}
            header={deck.header}
            slide={slide}
            setTheme={setTheme}
            setHeader={setHeader}
            updateSlide={updateSlide}
            patchLayout={patchLayout}
          />
        )}

        {/* ------------------------------- logo ------------------------------ */}
        {tab === "logo" && (
          <LogoPanel theme={T} header={deck.header} setHeader={setHeader} patchLayout={patchLayout} />
        )}

        {/* -------------------------- question bullet ------------------------ */}
        {tab === "questionBullet" && (
          <QuestionBulletPanel
            theme={T}
            slide={slide}
            setTheme={setTheme}
            onSelectBullet={() => onNavSelect({ element: "bullet" })}
            onOpenText={() => choose(NAV.find((n) => n.id === "bulletText")!)}
          />
        )}

        {/* --------------------- text inside question bullet ----------------- */}
        {tab === "bulletText" && (
          <BulletTextPanel
            theme={T}
            slide={slide}
            setTheme={setTheme}
            updateSlide={updateSlide}
            patchLayout={patchLayout}
          />
        )}

        {/* -------------------------- question text -------------------------- */}
        {tab === "questionText" &&
          (slide ? (
            <>
              <PanelHead
                title="Question text"
                subtitle="The stem itself — wording, maths, size, colour and typeface."
              />
              <Field label="Question" hint="use $...$ for math">
                <div className="mb-1 flex items-center justify-end gap-1">
                  {[3, 6, 10].map((r) => (
                    <button
                      key={r}
                      type="button"
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
                    type="button"
                    onClick={() => insertSnippet(s.insert)}
                    title={s.insert}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-amber-200 hover:bg-white/10"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <Field label="Text size on this slide" hint={`${Math.round(slide.scale * 100)}%`}>
                <Slider min={0.6} max={1.5} step={0.05} value={slide.scale} onChange={(v) => updateSlide(slide.id, { scale: v })} />
              </Field>
              {/* one write for the stem's ink: the deck field the renderer
                  reads, minus any per-box override that would shadow it */}
              <ColorInput label="Question colour" value={elementInk(T, "question")} onChange={(v) => setTheme(setElementInk(T, "question", v))} />

              {/* the stem's own text style (this box only): font from the whole
                  Google catalogue, size 0 → ∞, weight, case, spacing,
                  transparency, effects and nudge — the bullet beside it and the
                  deck-wide default faces ("Design & defaults") are untouched */}
              <BoxFontControls
                theme={T}
                setTheme={setTheme}
                selected="question"
                size={{ value: T.questionSize, onChange: (v) => setTheme({ questionSize: v }), sliderMax: 120 }}
                hide={["color"]}
              />

              <ElementPosition theme={T} id="question" patchLayout={patchLayout} />
            </>
          ) : (
            <p className="text-sm text-slate-500">No slide selected. Paste some questions to begin.</p>
          ))}

        {/* --------------------------- option bullet ------------------------- */}
        {tab === "optionBullet" && <OptionBulletPanel theme={T} setTheme={setTheme} />}

        {/* --------------------- text inside option bullet ------------------- */}
        {tab === "optionBulletText" && <OptionBulletTextPanel theme={T} slide={slide} setTheme={setTheme} />}

        {/* ---------------------------- option text -------------------------- */}
        {tab === "optionText" && (
          <OptionTextPanel
            slide={slide}
            theme={T}
            setTheme={setTheme}
            updateSlide={updateSlide}
            onOpenBulletText={() => choose(NAV.find((n) => n.id === "optionBulletText")!)}
          />
        )}

        {/* ---------------------------- answer key --------------------------- */}
        {tab === "answerKey" && (
          <AnswerKeyPanel
            slide={slide}
            slides={deck.slides}
            theme={T}
            setTheme={setTheme}
            updateSlide={updateSlide}
            updateAll={updateAll}
            onPasteAnswers={onPasteAnswers}
            onAnswerCopies={onAnswerCopies}
            onJumpToSlide={onJumpToSlide}
          />
        )}

        {/* ----------------------------- footnote ---------------------------- */}
        {tab === "footnote" && (
          <FootnotePanel
            theme={T}
            slide={slide}
            setTheme={setTheme}
            updateSlide={updateSlide}
            updateAll={updateAll}
            patchLayout={patchLayout}
          />
        )}

        {/* ------------------------- slide background ------------------------ */}
        {tab === "background" && (
          <BackgroundPanel
            deck={deck}
            slide={slide}
            onSet={background.onSet}
            onReset={background.onReset}
            onClearSlide={background.onClearSlide}
            onBoardColor={(v) => setTheme({ board: v })}
            onRemoveShape={shapes.onRemove}
            onPlainPage={(plain) => slide && updateSlide(slide.id, { plainPage: plain })}
            managedScope
          />
        )}

        {/* ---------------------------- slide frame -------------------------- */}
        {tab === "frame" && <FramePanel theme={T} setTheme={setTheme} />}

        {/* ----------------------------- slide layout ------------------------ */}
        {tab === "layout" && (
          <>
            <PanelHead
              title="Slide layout & position"
              subtitle="Where every element sits on the board — position, size, rotation, alignment and snapping."
            />
            <LayoutPanel
              theme={T}
              setTheme={setTheme}
              patchLayout={patchLayout}
              transformLayout={transformLayout}
              selected={selectedEl}
              onSelect={onSelectEl}
            />
          </>
        )}

        {/* --------------------------- insert images ------------------------- */}
        {tab === "images" && (
          <ImagesPanel
            slideShapes={shapes.slide}
            globalShapes={shapes.global}
            selectedId={shapes.selectedId}
            onSelect={shapes.onSelect}
            onAddImage={(src, ratio) => shapes.onAddImage(src, ratio, { mode: "this" })}
            onChange={shapes.onChange}
            onRemove={shapes.onRemove}
            onDuplicate={shapes.onDuplicate}
            onReorder={shapes.onReorder}
            onOpenDesign={() => setTab("shapes")}
            onUseAsBackground={(src) => {
              background.onSet({ src }, "slide");
              setTab("background");
              onNavSelect({ surface: "background" });
            }}
          />
        )}

        {/* ------------------------------ layers ----------------------------- */}
        {tab === "layers" && (
          <>
            <PanelHead
              title="Layers"
              subtitle="Everything painted on this slide in one stack — drag a row up or down to reorder it, click a row to select that shape or text on the slide."
              right={
                <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
                  {layerRows.total} rows · {layerRows.drawn} drawn
                </span>
              }
            />
            {layers.selected && layerRows.jump && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-amber-100">
                  <b>{layerRows.selectedLabel}</b> is selected on the slide
                </span>
                <Btn size="sm" onClick={() => choose(layerRows.jump!)}>
                  Edit {layerRows.jump.label} →
                </Btn>
              </div>
            )}
            {layersList(true)}
          </>
        )}

        {/* --------------------------- insert shapes ------------------------- */}
        {tab === "shapes" && (
          <>
            <ShapesPanel
              slideShapes={shapes.slide}
              globalShapes={shapes.global}
              selectedId={shapes.selectedId}
              selectedIds={shapes.selectedIds}
              onGroup={shapes.onGroup}
              onUngroup={shapes.onUngroup}
              onRemoveIds={shapes.onRemoveIds}
              onDuplicateIds={shapes.onDuplicateIds}
              onSelect={shapes.onSelect}
              onAdd={shapes.onAdd}
              onChange={shapes.onChange}
              onRemove={shapes.onRemove}
              onDuplicate={shapes.onDuplicate}
              onToggleScope={shapes.onToggleScope}
              snapEnabled={T.snapEnabled}
              onSnapChange={(v) => setTheme({ snapEnabled: v })}
              smartGuides={T.smartGuides ?? true}
              onSmartGuidesChange={(v) => setTheme({ smartGuides: v })}
              onAddImage={shapes.onAddImage}
              slides={deck.slides.map((s) => ({ id: s.id, number: s.number, question: s.question }))}
              currentSlideId={slide?.id ?? null}
              onCopyShapeTo={shapes.onCopyShapeTo}
              onReorder={shapes.onReorder}
              onApplyDesign={shapes.onApplyDesign}
              managedScope
              hideImageInsert
              layersPanel={layersList()}
            />
          </>
        )}

        {/* ------------------------- where am I hint ------------------------- */}
        {activeNav && (activeNav.id === "images" || activeNav.id === "shapes") && (
          <p className="border-t border-white/10 pt-3 text-[10px] leading-relaxed text-slate-500">
            Nothing is outlined on the slide for this panel — click a picture or shape on the canvas to edit it here.
          </p>
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
  /**
   * The scope bar is collapsible: with the full navigation above it, the panel
   * needs the vertical room. The choice is remembered between sessions.
   */
  const [open, setOpen] = useState<boolean>(() => localStorage.getItem("inspector:scope") !== "0");
  useEffect(() => {
    localStorage.setItem("inspector:scope", open ? "1" : "0");
  }, [open]);

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
    !!slide?.themeOverride ||
    !!slide?.headerOverride ||
    !!slide?.background ||
    !!slide?.plainPage ||
    !!slide?.shapes?.length;

  return (
    <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-amber-400/[0.08] to-transparent p-2.5 space-y-2">
      {/* Toast feedback */}
      {toast && (
        <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1.5 text-xs text-emerald-200 font-medium flex items-center justify-between animate-fadeIn">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-emerald-300 hover:text-white text-xs">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse the apply / scope bar" : "Expand the apply / scope bar"}
          className="flex min-w-0 items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-300 hover:text-amber-200"
        >
          <span aria-hidden className={cn("inline-block transition-transform", open && "rotate-90")}>
            ▸
          </span>
          <span className="shrink-0">Target Scope</span>
          <span className="truncate text-[9.5px] font-medium normal-case tracking-normal text-slate-400">
            {scope === "all"
              ? "all slides"
              : scope === "selected"
                ? `${selectedIds.length} selected`
                : "this slide"}
            {" · "}
            {section === "all" ? "all settings" : section}
          </span>
        </button>
        {hasOverride && (
          <button
            onClick={() => slide && onRevertDesign([slide.id])}
            className="shrink-0 text-[10px] text-rose-300 hover:underline"
            title="Clear this slide's custom overrides to follow the deck default"
          >
            ↩ Revert to Default
          </button>
        )}
      </div>

      {open && (
      <>
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
                {(s.themeOverride || s.headerOverride || s.background || s.plainPage) && (
                  <span className="ml-auto text-[8px] rounded bg-amber-400/20 text-amber-200 px-1">
                    {s.plainPage ? "plain" : "custom"}
                  </span>
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
        💡 Every panel previews live on this slide. Click <span className="text-amber-300 font-medium">Apply Changes</span> to push it to your target scope.
      </p>
      </>
      )}
    </div>
  );
}
