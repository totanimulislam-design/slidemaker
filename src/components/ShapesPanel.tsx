import { useEffect, useRef } from "react";
import { SHAPE_ICONS, SHAPE_LABELS, inlineRemoteImage, loadImageFile, shrinkDataUrl, type ShapeItem, type ShapeKind } from "../lib/shapes";
import { DECK_ACCEPT, isDeckFile } from "../lib/pdf";
import { openDeckUpload } from "../lib/uploadDocs";
import { addUpload } from "../lib/uploads";
import { handleSmartPaste } from "../lib/richPaste";
import { alignShape, boundsOf, distributeShapes, type AlignOp } from "../lib/shapeAlign";
import { canMove, Z_LABELS, type ZOp } from "../lib/zorder";
import { useState } from "react";
import { Btn, Field, PanelHead, SegButtons, Slider, TextArea, Toggle } from "./ui";
import ShapeDesignPanel from "./ShapeDesignPanel";
import { layerLabel } from "../lib/layers";
import { cn } from "../utils/cn";

const KINDS: ShapeKind[] = ["text", "rect", "rounded", "ellipse", "triangle", "diamond", "star", "line", "arrow"];
const MASKS = ["none", "rounded", "circle", "diamond", "triangle", "star"] as const;


interface Props {
  slideShapes: ShapeItem[];
  globalShapes: ShapeItem[];
  selectedId: string | null;
  /** full multi-selection from the canvas (a group arrives as all its members) */
  selectedIds: string[];
  onGroup: (ids: string[]) => void;
  onUngroup: (ids: string[]) => void;
  onRemoveIds: (ids: string[]) => void;
  onDuplicateIds: (ids: string[]) => void;
  onSelect: (id: string | null) => void;
  onAdd: (kind: ShapeKind, scope: InsertScope) => void;
  onChange: (id: string, patch: Partial<ShapeItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleScope: (id: string) => void;
  snapEnabled: boolean;
  onSnapChange: (v: boolean) => void;
  smartGuides: boolean;
  onSmartGuidesChange: (v: boolean) => void;
  onAddImage: (src: string, ratio: number, scope: InsertScope) => void;
  /** slide list for the "selected slides" picker */
  slides: { id: string; number: string; question: string }[];
  currentSlideId: string | null;
  onCopyShapeTo: (id: string, scope: InsertScope) => void;
  onReorder: (id: string, op: ZOp) => void;
  /** copy a design onto other shapes: kind = only that kind, null = all; exceptId = source */
  onApplyDesign: (style: Partial<ShapeItem>, kind: ShapeItem["kind"] | null, exceptId: string) => void;
  /** unified layers list (elements + shapes) rendered inside the Layer section */
  layersPanel?: React.ReactNode;
  /**
   * Pictures have their own navigation entry ("Uploads"), so the shapes
   * panel can drop its image uploader and stay focused on shapes & text boxes.
   */
  hideImageInsert?: boolean;
  /** Scope is controlled by the inspector's main Apply Changes bar. */
  managedScope?: boolean;
  /** the face a text box without a font of its own is painted with (see ShapeDesignPanel) */
  fallbackFamily?: string;
}

export type InsertScope = { mode: "this" } | { mode: "selected"; ids: string[] } | { mode: "all" };

export default function ShapesPanel({
  slideShapes,
  globalShapes,
  selectedId,
  selectedIds,
  onGroup,
  onUngroup,
  onRemoveIds,
  onDuplicateIds,
  onSelect,
  onAdd,
  onChange,
  onRemove,
  onDuplicate,
  onToggleScope,
  snapEnabled,
  onSnapChange,
  smartGuides,
  onSmartGuidesChange,
  onAddImage,
  slides,
  currentSlideId,
  onCopyShapeTo,
  onReorder,
  onApplyDesign,
  layersPanel,
  managedScope = false,
  hideImageInsert = false,
  fallbackFamily,
}: Props) {
  const [scopeMode, setScopeMode] = useState<"this" | "selected" | "all">("this");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<"selected" | "all">("selected");

  const scope: InsertScope = managedScope
    ? { mode: "this" }
    : scopeMode === "all" ? { mode: "all" } : scopeMode === "selected" ? { mode: "selected", ids: pickedIds } : { mode: "this" };
  const scopeReady = scopeMode !== "selected" || pickedIds.length > 0;
  const scopeText =
    scopeMode === "all" ? "all slides" : scopeMode === "selected" ? `${pickedIds.length} selected slide${pickedIds.length === 1 ? "" : "s"}` : "this slide";

  const togglePick = (id: string) =>
    setPickedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickRange = (from: number, to: number) => {
    const [a, b] = from < to ? [from, to] : [to, from];
    setPickedIds(slides.slice(a, b + 1).map((s) => s.id));
  };
  const [urlInput, setUrlInput] = useState("");
  const [imgBusy, setImgBusy] = useState<string | null>(null);

  const importFiles = async (files: FileList | File[] | null | undefined, sc: InsertScope = scope, replaceId?: string) => {
    if (!files) return;
    const all = Array.from(files);
    // a PDF / PPTX is saved to Uploads as the document itself and opens its page preview
    const pdf = all.find(isDeckFile);
    if (pdf && !replaceId) void openDeckUpload(pdf);
    const list = all.filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setImgBusy(`Loading ${list.length} image${list.length > 1 ? "s" : ""}…`);
    try {
      for (const f of list) {
        const { src, ratio } = await loadImageFile(f);
        const small = await shrinkDataUrl(src);
        addUpload(small, ratio, f.name);
        if (replaceId) onChange(replaceId, { src: small, naturalRatio: ratio });
        else onAddImage(small, ratio, sc);
      }
    } catch {
      alert("That file could not be read as an image.");
    } finally {
      setImgBusy(null);
    }
  };

  const importUrl = async (replaceId?: string) => {
    const url = urlInput.trim();
    if (!url) return;
    setImgBusy("Fetching image…");
    try {
      const { src, ratio } = await inlineRemoteImage(url);
      const small = await shrinkDataUrl(src);
      const name = url.split("/").pop()?.split("?")[0] || "Web image";
      addUpload(small, ratio, name);
      if (replaceId) onChange(replaceId, { src: small, naturalRatio: ratio });
      else onAddImage(small, ratio, scope);
      setUrlInput("");
    } catch {
      alert("Could not load an image from that URL.");
    } finally {
      setImgBusy(null);
    }
  };
  const [alignTo, setAlignTo] = useState<"board" | "shape">("board");
  const [refId, setRefId] = useState<string | null>(null);
  const all = [...globalShapes, ...slideShapes];
  const sel = all.find((x) => x.id === selectedId) ?? null;
  const isGlobal = !!sel && globalShapes.some((x) => x.id === sel.id);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sel?.kind === "text") textRef.current?.focus();
  }, [sel?.id, sel?.kind]);

  const set = (p: Partial<ShapeItem>) => sel && onChange(sel.id, p);

  return (
    <div className="space-y-4">
      <PanelHead
        title="Insert shapes"
        subtitle="Boxes, circles, arrows and text boxes — insert, style and order them. Fixed-element positions live under Layout."
      />
      {/* --------------------------------- insert ---------------------------- */}
      {/* Scope is normally handled by the main Apply Changes bar. */}
      {!managedScope && <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3">
        <span className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">Add new items to…</span>
        <SegButtons
          value={scopeMode}
          onChange={(v) => {
            setScopeMode(v);
            if (v === "selected") {
              setPickerOpen(true);
              if (!pickedIds.length && currentSlideId) setPickedIds([currentSlideId]);
            }
          }}
          options={[
            { value: "this", label: "This slide" },
            { value: "selected", label: "Selected slides" },
            { value: "all", label: "All slides" },
          ]}
        />
        <p className="text-[11px] leading-relaxed text-slate-400">
          {scopeMode === "this" && "Only the slide you're viewing."}
          {scopeMode === "all" && "One shared item shown on every slide (edit once, changes everywhere)."}
          {scopeMode === "selected" && "An independent copy is placed on each chosen slide."}
        </p>

        {scopeMode === "selected" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-[11px] font-medium text-amber-200 hover:underline"
              >
                {pickerOpen ? "▾" : "▸"} {pickedIds.length} of {slides.length} slides chosen
              </button>
              <div className="flex gap-1">
                <button onClick={() => setPickedIds(slides.map((s) => s.id))} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10">
                  all
                </button>
                <button onClick={() => setPickedIds([])} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10">
                  none
                </button>
                <button
                  onClick={() => setPickedIds(slides.map((s) => s.id).filter((id) => !pickedIds.includes(id)))}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
                >
                  invert
                </button>
              </div>
            </div>
            {pickerOpen && (
              <>
                <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/60 p-1">
                  {slides.map((sl, i) => {
                    const on = pickedIds.includes(sl.id);
                    return (
                      <label
                        key={sl.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs",
                          on ? "bg-amber-400/15 text-amber-100" : "text-slate-300 hover:bg-white/5",
                        )}
                        onClick={(e) => {
                          // Shift-click selects a range from the last picked slide
                          if (e.shiftKey && pickedIds.length) {
                            e.preventDefault();
                            const last = slides.findIndex((s) => s.id === pickedIds[pickedIds.length - 1]);
                            if (last >= 0) pickRange(last, i);
                          }
                        }}
                      >
                        <input type="checkbox" checked={on} onChange={() => togglePick(sl.id)} className="accent-amber-400" />
                        <span className="w-6 shrink-0 font-mono text-[10px] text-slate-500">{i + 1}</span>
                        <span className="truncate">{sl.question.replace(/\$[^$]*\$/g, "▫").slice(0, 40) || "(empty)"}</span>
                        {sl.id === currentSlideId && <span className="ml-auto text-[9px] text-amber-300">current</span>}
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPickedIds(slides.filter((_, i) => i % 2 === 0).map((s) => s.id))}
                    className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
                  >
                    odd
                  </button>
                  <button
                    onClick={() => setPickedIds(slides.filter((_, i) => i % 2 === 1).map((s) => s.id))}
                    className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
                  >
                    even
                  </button>
                  <button
                    onClick={() => {
                      const from = slides.findIndex((s) => s.id === currentSlideId);
                      if (from >= 0) setPickedIds(slides.slice(from).map((s) => s.id));
                    }}
                    className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
                  >
                    from current →
                  </button>
                  <span className="ml-auto text-[10px] text-slate-500">Shift-click = range</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>}
      {managedScope && (
        <p className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-200">
          New shapes, images and text boxes are added to this slide first. Apply Changes copies the full shape composition to your target slides.
        </p>
      )}

      <Field label="Insert" hint={`→ ${scopeText}`}>
        {!scopeReady && (
          <p className="mb-1.5 rounded-md border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-[11px] text-rose-200">
            Pick at least one slide above.
          </p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              disabled={!scopeReady}
              onClick={() => onAdd(k, scope)}
              title={SHAPE_LABELS[k]}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-slate-200 hover:border-amber-400/60 hover:bg-white/[0.08] disabled:opacity-40"
            >
              <span className={cn("text-lg leading-none", k === "text" && "font-serif font-bold")}>{SHAPE_ICONS[k]}</span>
              <span className="text-[10px] text-slate-400">{SHAPE_LABELS[k]}</span>
            </button>
          ))}
        </div>
        {!hideImageInsert && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.06] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-sky-200">🖼 Image</span>
            {imgBusy && <span className="text-[10px] text-sky-300">{imgBusy}</span>}
          </div>
          <label
            className={cn(
              "block cursor-pointer rounded-lg bg-sky-400 px-2 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300",
              !scopeReady && "pointer-events-none opacity-40",
            )}
          >
            Upload → {scopeText}
            <input
              type="file"
              accept={`image/*,${DECK_ACCEPT}`}
              multiple
              className="hidden"
              onChange={(e) => {
                void importFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex gap-1.5">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void importUrl()}
              placeholder="https://… image URL"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
            />
            <Btn size="sm" onClick={() => void importUrl()} disabled={!urlInput.trim() || !scopeReady}>
              Add
            </Btn>
          </div>
          <p className="text-[10px] text-slate-500">
            Or paste an image (Ctrl+V) / drag a file onto the slide.
          </p>
        </div>
        )}

      </Field>

      <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Toggle label="Snap to grid" checked={snapEnabled} onChange={onSnapChange} />
        <Toggle label="Smart guides (snap to other shapes)" checked={smartGuides} onChange={onSmartGuidesChange} />
        <p className="text-[11px] text-slate-500">
          Hold <b>Alt</b> while dragging to move completely freely, ignoring every snap.
        </p>
      </div>

      {/* --------------------------------- list ------------------------------ */}
      {all.length > 0 && (
        <Field label={`Items (${all.length})`} hint="click to select">
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-1">
            {[...all]
              .sort((a, b) => b.z - a.z)
              .map((x) => {
                const g = globalShapes.some((y) => y.id === x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => onSelect(x.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs",
                      selectedId === x.id ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:bg-white/5",
                    )}
                  >
                    <span className="w-4 text-center">{SHAPE_ICONS[x.kind]}</span>
                    <span className={cn("flex-1 truncate", x.hidden && "line-through opacity-60")}>
                      {layerLabel(x)}
                    </span>
                    {x.hidden && <span className="text-[10px]" title="Hidden">🙈</span>}
                    {g && <span className="rounded bg-black/20 px-1 text-[9px]">ALL</span>}
                    {x.groupId && (
                      <span className="text-[10px] text-sky-300" title="Part of a group — click here selects this item alone">
                        ⧉
                      </span>
                    )}
                    {x.locked && <span className="text-[10px]">🔒</span>}
                  </button>
                );
              })}
          </div>
        </Field>
      )}

      {selectedIds.length === 0 && !sel && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-400">
          Click any shape, text box or image on the slide to select it. Eight handles resize from any edge or
          corner (hold <b>Shift</b> to keep the ratio), the blue handle rotates (<b>Shift</b> snaps to 15°),{" "}
          <b>Alt</b> disables snapping. <b>Delete</b> removes, <b>Ctrl/⌘ + D</b> duplicates, arrows nudge.{" "}
          <b>Ctrl/⌘ + click</b> or drag on the empty slide for multi-select, <b>Ctrl/⌘ + G</b> groups,{" "}
          <b>Ctrl/⌘ + Shift + G</b> ungroups, <b>Alt + click</b> / <b>Tab</b> pick layers hidden underneath.
        </p>
      )}

      {/* ---------------------------- multi-selection ------------------------ */}
      {selectedIds.length > 1 &&
        (() => {
          const items = all.filter((x) => selectedIds.includes(x.id));
          if (items.length < 2) return null;
          const bounds = boundsOf(items);
          const gid = items[0].groupId;
          const grouped = !!gid && items.every((x) => x.groupId === gid);
          const run = (op: AlignOp) => items.forEach((it) => !it.locked && onChange(it.id, alignShape(it, op, bounds)));
          return (
            <div className="space-y-2.5 rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-200">
                  ⧉ {items.length} items selected{grouped ? " · grouped as one" : ""}
                </span>
                <div className="flex gap-1">
                  <Btn size="sm" onClick={() => onDuplicateIds(items.map((x) => x.id))} title="Duplicate selection (Ctrl+D)">
                    ⧉
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => onRemoveIds(items.map((x) => x.id))} title="Delete selection">
                    ✕
                  </Btn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {!grouped && (
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => onGroup(items.map((x) => x.id))}
                    title="Group them — they then move / resize / rotate as one unit and are selected together (Ctrl+G)"
                  >
                    ⧉ Group {items.length}
                  </Btn>
                )}
                {grouped && (
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => onUngroup(items.map((x) => x.id))}
                    title="Ungroup — every member stays exactly where it is and becomes independently selectable (Ctrl+Shift+G)"
                  >
                    ⧉ Ungroup
                  </Btn>
                )}
                <Btn
                  size="sm"
                  onClick={() => items.forEach((it) => onChange(it.id, { locked: !it.locked }))}
                  title="Lock / unlock every selected item"
                >
                  🔒 Lock all
                </Btn>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-400">
                Drag any selected item (or the yellow bounds frame) to move the whole set; handles scale every
                member from the opposite edge. Aligning or distributing below edits the selected items.
              </p>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    ["left", "⇤", "Align left edges"],
                    ["hcenter", "⫿", "Center horizontally"],
                    ["right", "⇥", "Align right edges"],
                    ["top", "⤒", "Align top edges"],
                    ["vcenter", "⩵", "Center vertically"],
                    ["bottom", "⤓", "Align bottom edges"],
                  ] as [AlignOp, string, string][]
                ).map(([op, label, title]) => (
                  <button
                    key={op}
                    onClick={() => run(op)}
                    title={title}
                    className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {items.length >= 3 && (
                <div className="grid grid-cols-2 gap-1">
                  <Btn
                    size="sm"
                    onClick={() =>
                      distributeShapes(items.filter((x) => !x.locked), "h").forEach((d) => onChange(d.id, d.patch))
                    }
                    title="Equal horizontal gaps between the selected items"
                  >
                    ⋯ Distribute ↔
                  </Btn>
                  <Btn
                    size="sm"
                    onClick={() =>
                      distributeShapes(items.filter((x) => !x.locked), "v").forEach((d) => onChange(d.id, d.patch))
                    }
                    title="Equal vertical gaps between the selected items"
                  >
                    ⋮ Distribute ↕
                  </Btn>
                </div>
              )}
            </div>
          );
        })()}

      {/* ------------------------------- properties -------------------------- */}
      {sel && selectedIds.length <= 1 && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-200">
              {SHAPE_ICONS[sel.kind]} {SHAPE_LABELS[sel.kind]}
              {sel.groupId && (
                <button
                  onClick={() => onUngroup([sel.id])}
                  title="This item belongs to a group — click Ungroup to separate it (its position, size, rotation, style and content are untouched)"
                  className="rounded bg-sky-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-400/35"
                >
                  ⧉ grouped — Ungroup
                </button>
              )}
            </span>
            <div className="flex gap-1">
              <Btn size="sm" onClick={() => onDuplicate(sel.id)} title="Duplicate (Ctrl+D)">
                ⧉
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => onRemove(sel.id)} title="Delete">
                ✕
              </Btn>
            </div>
          </div>

          {/* ------------------------------ free alignment ---------------------- */}
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Align</span>
              <SegButtons
                value={alignTo}
                onChange={setAlignTo}
                options={[
                  { value: "board", label: "to slide" },
                  { value: "shape", label: "to shape" },
                ]}
              />
            </div>
            {alignTo === "shape" && (
              <select
                value={refId ?? ""}
                onChange={(e) => setRefId(e.target.value || null)}
                className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="">— choose reference shape —</option>
                {all
                  .filter((x) => x.id !== sel.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {SHAPE_ICONS[x.kind]} {x.kind === "text" && x.text ? x.text.slice(0, 24) : SHAPE_LABELS[x.kind]}
                    </option>
                  ))}
              </select>
            )}
            {(() => {
              const ref =
                alignTo === "shape" ? all.find((x) => x.id === refId) ?? null : { x: 0, y: 0, w: 100, h: 100 };
              const disabled = !ref;
              const run = (op: AlignOp) => ref && set(alignShape(sel, op, ref));
              const B = ({ op, label, title }: { op: AlignOp; label: string; title: string }) => (
                <button
                  disabled={disabled}
                  onClick={() => run(op)}
                  title={title}
                  className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/10 disabled:opacity-30"
                >
                  {label}
                </button>
              );
              return (
                <>
                  <div className="grid grid-cols-6 gap-1">
                    <B op="left" label="⇤" title="Align left edges" />
                    <B op="hcenter" label="⫿" title="Center horizontally" />
                    <B op="right" label="⇥" title="Align right edges" />
                    <B op="top" label="⤒" title="Align top edges" />
                    <B op="vcenter" label="⩵" title="Center vertically" />
                    <B op="bottom" label="⤓" title="Align bottom edges" />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <B op="fill-w" label="↔ Fill width" title="Stretch to the reference width" />
                    <B op="fill-h" label="↕ Fill height" title="Stretch to the reference height" />
                    {alignTo === "board" ? (
                      <B op="fit-board" label="⛶ Fill slide" title="Cover the whole slide" />
                    ) : (
                      <button
                        disabled={disabled}
                        onClick={() => ref && set({ x: ref.x, y: ref.y, w: ref.w, h: ref.h })}
                        className="rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-xs text-slate-200 hover:border-amber-400/60 disabled:opacity-30"
                      >
                        ⧉ Match size
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
            {all.length >= 3 && (
              <div className="grid grid-cols-2 gap-1">
                <Btn
                  size="sm"
                  onClick={() => distributeShapes(all.filter((x) => !x.locked), "h").forEach((d) => onChange(d.id, d.patch))}
                  title="Equal horizontal gaps between all shapes"
                >
                  ⋯ Distribute ↔
                </Btn>
                <Btn
                  size="sm"
                  onClick={() => distributeShapes(all.filter((x) => !x.locked), "v").forEach((d) => onChange(d.id, d.patch))}
                  title="Equal vertical gaps between all shapes"
                >
                  ⋮ Distribute ↕
                </Btn>
              </div>
            )}
            {all.length >= 2 && (
              <Btn
                size="sm"
                className="w-full"
                onClick={() => {
                  const b = boundsOf(all);
                  set(alignShape(sel, "hcenter", b));
                  set({ ...alignShape(sel, "hcenter", b), ...alignShape(sel, "vcenter", b) });
                }}
                title="Center this shape inside the group of all shapes"
              >
                ✛ Center within all shapes
              </Btn>
            )}
          </div>

          {sel.kind === "image" && (
            <div className="space-y-3 rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/50">
                  {sel.src ? <img src={sel.src} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-600">none</span>}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block cursor-pointer rounded-lg bg-sky-400 px-2 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300">
                    Replace image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        void importFiles(e.target.files, scope, sel.id);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Btn
                    size="sm"
                    className="w-full"
                    title="Restore the image's natural proportions"
                    onClick={() => {
                      if (!sel.naturalRatio) return;
                      set({ h: Math.round(((sel.w / sel.naturalRatio) * (16 / 9)) * 10) / 10 });
                    }}
                    disabled={!sel.naturalRatio}
                  >
                    ⤢ Reset proportions
                  </Btn>
                </div>
              </div>

              <SegButtons
                value={sel.fit ?? "contain"}
                onChange={(v) => set({ fit: v })}
                options={[
                  { value: "contain", label: "Fit" },
                  { value: "cover", label: "Fill (crop)" },
                  { value: "fill", label: "Stretch" },
                ]}
              />

              <Field label="Opacity" hint={`${Math.round((sel.opacity ?? 1) * 100)}%`}>
                <Slider min={0} max={1} step={0.05} value={sel.opacity ?? 1} onChange={(v) => set({ opacity: v })} />
              </Field>

              <Field label="Crop to shape">
                <div className="grid grid-cols-6 gap-1">
                  {MASKS.map((m) => (
                    <button
                      key={m}
                      onClick={() => set({ mask: m, radius: m === "none" ? sel.radius : 0 })}
                      title={m}
                      className={cn(
                        "rounded-md border py-1.5 text-sm",
                        (sel.mask ?? "none") === m
                          ? "border-amber-400 bg-amber-400 text-slate-950"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25",
                      )}
                    >
                      {m === "none" ? "▭" : m === "rounded" ? "▢" : m === "circle" ? "◯" : m === "diamond" ? "◇" : m === "triangle" ? "△" : "☆"}
                    </button>
                  ))}
                </div>
              </Field>

              {(sel.mask ?? "none") === "none" && (
                <Field label="Corner radius" hint={`${sel.radius ?? 0}%`}>
                  <Slider min={0} max={50} value={sel.radius ?? 0} onChange={(v) => set({ radius: v })} />
                </Field>
              )}

              <div className="grid grid-cols-3 gap-1.5">
                <Btn size="sm" variant={sel.flipH ? "primary" : "ghost"} onClick={() => set({ flipH: !sel.flipH })}>
                  ⇋ Flip H
                </Btn>
                <Btn size="sm" variant={sel.flipV ? "primary" : "ghost"} onClick={() => set({ flipV: !sel.flipV })}>
                  ⇅ Flip V
                </Btn>
                <Btn size="sm" variant={sel.shadow ? "primary" : "ghost"} onClick={() => set({ shadow: !sel.shadow })}>
                  ▣ Shadow
                </Btn>
              </div>

              <Field label="Caption (optional)" hint="shown over the image">
                <TextArea rows={1} value={sel.text} onChange={(e) => set({ text: e.target.value })} placeholder="e.g. চিত্র-১" />
              </Field>
            </div>
          )}

          {sel.kind !== "image" && (sel.kind === "text" || sel.kind !== "line") && sel.kind !== "arrow" && (
            <Field label={sel.kind === "text" ? "Text" : "Label inside shape"} hint="$math$ ok">
              <TextArea
                ref={textRef}
                rows={sel.kind === "text" ? 3 : 2}
                value={sel.text}
                onPaste={(e) => {
                  const r = handleSmartPaste(e, { reflow: false });
                  if (r) set({ text: r.value });
                }}
                onChange={(e) => set({ text: e.target.value })}
                placeholder={sel.kind === "text" ? "Type here…" : "optional"}
              />
            </Field>
          )}

          {(sel.kind === "text" || sel.text) && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Field label="Font size (0 to ∞ px)" hint={`${sel.fontSize}px`} as="div">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    aria-label="Text box font size"
                    min={0}
                    value={sel.fontSize}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n) && n >= 0) set({ fontSize: n });
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
                  />
                  <div className="flex-1">
                    <Slider min={0} max={Math.max(200, sel.fontSize)} value={sel.fontSize} onChange={(v) => set({ fontSize: v })} />
                  </div>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <p className="self-center text-[10px] text-slate-500">Colour, gradient &amp; outline → Shape design ▸ Text</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => set({ bold: !sel.bold })}
                    className={cn(
                      "flex-1 rounded-lg border text-sm font-bold",
                      sel.bold ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/10 text-slate-300",
                    )}
                  >
                    B
                  </button>
                  <button
                    onClick={() => set({ italic: !sel.italic })}
                    className={cn(
                      "flex-1 rounded-lg border text-sm italic",
                      sel.italic ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/10 text-slate-300",
                    )}
                  >
                    I
                  </button>
                </div>
              </div>
              <SegButtons
                value={sel.align}
                onChange={(v) => set({ align: v })}
                options={[
                  { value: "left", label: "⯇ Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right ⯈" },
                ]}
              />
              <SegButtons
                value={sel.valign}
                onChange={(v) => set({ valign: v })}
                options={[
                  { value: "top", label: "Top" },
                  { value: "middle", label: "Middle" },
                  { value: "bottom", label: "Bottom" },
                ]}
              />
            </div>
          )}

          {/* ------------------------------ design ------------------------------ */}
          <ShapeDesignPanel
            shape={sel}
            onChange={(p) => onChange(sel.id, p)}
            onApplyToAll={(style, sameKind) => onApplyDesign(style, sameKind ? sel.kind : null, sel.id)}
            fallbackFamily={fallbackFamily}
          />

          {/* ------------------------------ geometry ---------------------------- */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k} className="space-y-1">
                  <span className="block text-[10px] text-slate-500 uppercase">{k}</span>
                  <input
                    type="number"
                    step={0.5}
                    value={sel[k]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) set({ [k]: v } as Partial<ShapeItem>);
                    }}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400/60"
                  />
                </label>
              ))}
            </div>
            <Field label="Rotation" hint={`${sel.rot}°`}>
              <div className="flex items-center gap-1.5">
                <div className="flex-1">
                  <Slider min={-180} max={180} value={sel.rot} onChange={(v) => set({ rot: v })} />
                </div>
                <button
                  onClick={() => set({ rot: 0 })}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
                >
                  0°
                </button>
              </div>
            </Field>
            <Field label="Layer order" hint="shared with slide elements">
              {layersPanel ?? (
                <div className="grid grid-cols-2 gap-1.5">
                  {(["forward", "front", "backward", "back"] as ZOp[]).map((op) => (
                    <Btn key={op} size="sm" disabled={!canMove(all, sel.id, op)} onClick={() => onReorder(sel.id, op)} title={Z_LABELS[op].hint}>
                      {Z_LABELS[op].icon} {Z_LABELS[op].label}
                    </Btn>
                  ))}
                </div>
              )}
            </Field>
            <Toggle label="Lock position & size" checked={!!sel.locked} onChange={(v) => set({ locked: v })} />
            {!managedScope && <Toggle
              label={isGlobal ? "Shown on every slide" : "Show on every slide"}
              checked={isGlobal}
              onChange={() => onToggleScope(sel.id)}
            />}
            {!managedScope && !isGlobal && (
              <div className="space-y-1.5 rounded-lg border border-white/10 bg-slate-900/50 p-2">
                <span className="text-[11px] font-medium text-slate-400">Copy this item to…</span>
                <div className="flex gap-1.5">
                  <SegButtons
                    value={copyMode}
                    onChange={setCopyMode}
                    options={[
                      { value: "selected", label: `Selected (${pickedIds.length})` },
                      { value: "all", label: "All slides" },
                    ]}
                  />
                </div>
                {copyMode === "selected" && !pickedIds.length && (
                  <p className="text-[10px] text-slate-500">Choose slides in “Selected slides” at the top.</p>
                )}
                <Btn
                  size="sm"
                  variant="soft"
                  className="w-full"
                  disabled={copyMode === "selected" && !pickedIds.length}
                  onClick={() =>
                    onCopyShapeTo(sel.id, copyMode === "all" ? { mode: "all" } : { mode: "selected", ids: pickedIds })
                  }
                >
                  ⧉ Copy to {copyMode === "all" ? "all slides" : `${pickedIds.length} slide${pickedIds.length === 1 ? "" : "s"}`}
                </Btn>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
