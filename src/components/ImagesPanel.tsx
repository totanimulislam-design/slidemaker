import { useState } from "react";
import { inlineRemoteImage, loadImageFile, shrinkDataUrl, type ShapeItem } from "../lib/shapes";
import { canMove, Z_LABELS, type ZOp } from "../lib/zorder";
import { addUpload, documentAsFile, removeUpload, useUploads, type UploadedItem } from "../lib/uploads";
import { DECK_ACCEPT, isDeckFile, requestPdfImport } from "../lib/pdf";
import { openDeckUpload } from "../lib/uploadDocs";
import { Btn, Field, PanelHead, SegButtons, Slider, TextArea } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Uploads".
 *
 * Canva-style uploads library: uploaded images, diagrams and media are saved here
 * and can be reused anytime across slides or removed like Canva.
 *
 * A PDF or PowerPoint is saved **as the document itself** — one entry holding
 * the file, a cover picture and its page count, never one picture per page.
 * Clicking that entry opens its page preview, where the pages to add are picked.
 *
 * When an image on the slide is selected, this panel also provides image-only
 * styling controls (fit, crop mask, corner radius, flips, opacity, shadow, caption)
 * and layer ordering.
 */
interface Props {
  slideShapes: ShapeItem[];
  globalShapes: ShapeItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddImage: (src: string, ratio: number) => void;
  onChange: (id: string, patch: Partial<ShapeItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, op: ZOp) => void;
  /** jump to the shapes tab for gradients / glow / blend on the same item */
  onOpenDesign: () => void;
  /** promote this picture to the slide background instead */
  onUseAsBackground?: (src: string) => void;
}

const MASKS = ["none", "rounded", "circle", "diamond", "triangle", "star"] as const;
const MASK_ICON: Record<(typeof MASKS)[number], string> = {
  none: "▭",
  rounded: "▢",
  circle: "◯",
  diamond: "◇",
  triangle: "△",
  star: "☆",
};

export default function ImagesPanel({
  slideShapes,
  globalShapes,
  selectedId,
  onSelect,
  onAddImage,
  onChange,
  onRemove,
  onDuplicate,
  onReorder,
  onOpenDesign,
  onUseAsBackground,
}: Props) {
  const uploads = useUploads();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const all = [...globalShapes, ...slideShapes];
  const images = all.filter((x) => x.kind === "image");
  const sel = images.find((x) => x.id === selectedId) ?? null;
  const isGlobal = !!sel && globalShapes.some((x) => x.id === sel.id);
  const set = (p: Partial<ShapeItem>) => sel && onChange(sel.id, p);

  const importFiles = async (files: FileList | File[] | null | undefined, replaceId?: string) => {
    if (!files) return;
    const all = Array.from(files);
    // a PDF / PPTX is saved to the library as the document itself and opens its
    // page preview, where the pages to add are picked
    const pdf = all.find(isDeckFile);
    if (pdf && !replaceId) void openDeckUpload(pdf);
    const list = all.filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(`Loading ${list.length} file${list.length > 1 ? "s" : ""}…`);
    try {
      for (const f of list) {
        const { src, ratio } = await loadImageFile(f);
        const small = await shrinkDataUrl(src);
        // Save to uploads library (Canva-style)
        addUpload(small, ratio, f.name);
        if (replaceId) onChange(replaceId, { src: small, naturalRatio: ratio });
        else onAddImage(small, ratio);
      }
    } catch {
      alert("That file could not be read as an image.");
    } finally {
      setBusy(null);
    }
  };

  const importUrl = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy("Fetching image…");
    try {
      const { src, ratio } = await inlineRemoteImage(u);
      const small = await shrinkDataUrl(src);
      const name = u.split("/").pop()?.split("?")[0] || "Web image";
      addUpload(small, ratio, name);
      onAddImage(small, ratio);
      setUrl("");
    } catch {
      alert("Could not load an image from that URL.");
    } finally {
      setBusy(null);
    }
  };

  const filteredUploads = search.trim()
    ? uploads.filter((u) => (u.name ?? "").toLowerCase().includes(search.toLowerCase()))
    : uploads;

  /**
   * Clicking a saved PDF / PowerPoint opens its page preview: the document's own
   * bytes are read back out of the library and handed to the same picker a fresh
   * upload gets, so the pages to add are chosen there.
   */
  const openDocPreview = async (item: UploadedItem) => {
    if (busy) return;
    setBusy(`Opening ${item.name || "document"}…`);
    try {
      const file = await documentAsFile(item);
      if (!file) {
        alert(
          `“${item.name || "That document"}” is not available any more — this browser no longer holds its file` +
            (item.doc?.persisted === false ? " (it was kept for that session only)" : "") +
            ". Upload it again to keep it in your library.",
        );
        return;
      }
      requestPdfImport(file);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PanelHead
        title="Uploads"
        subtitle="Pictures, PDFs, PowerPoints, diagrams and graphics saved to your library."
        right={
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            {uploads.length} saved
          </span>
        }
      />

      <p className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-200">
        Uploaded elements are <b>saved here</b> and ready to use across your slides. Click any picture to add it to the
        current slide. A <b>PDF or PowerPoint stays one document</b> here — click it to open its preview and pick the
        pages to add.
      </p>

      {/* --------------------------- upload section -------------------------- */}
      <div className="space-y-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-sky-200 uppercase">Upload media</span>
          {busy && <span className="text-[10px] text-sky-300 animate-pulse">{busy}</span>}
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 py-2.5 text-center text-xs font-semibold text-slate-950 transition hover:bg-sky-300 active:scale-[0.99] shadow">
          <span>⬆ Upload files</span>
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
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void importUrl()}
            placeholder="Paste image URL (https://…)"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
          />
          <Btn size="sm" onClick={() => void importUrl()} disabled={!url.trim()}>
            Add
          </Btn>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          Or <b>paste</b> an image (Ctrl/⌘ + V) or <b>drag files</b> straight onto the slide.
          <b> PDFs and PowerPoint (.pptx) files</b> are saved here <b>as the file itself</b> — not as separate page
          pictures — and open their page preview, where you choose the pages to add as slides or pictures.
        </p>
      </div>

      {/* ------------------------ uploaded elements library ------------------ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">
              Uploaded elements
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-slate-400 font-mono">
              {uploads.length}
            </span>
          </div>
          {uploads.length > 6 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-24 rounded border border-white/10 bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
            />
          )}
        </div>

        {uploads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
            <div className="text-2xl mb-1.5">📤</div>
            <div className="text-xs font-semibold text-slate-300">No uploaded elements yet</div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Upload photos, logos, graphics — or a whole PDF / PowerPoint — from your device. They are saved here so you
              can reuse them across all your slides; a PDF stays one document you can reopen any time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredUploads.map((item: UploadedItem) => {
              const isConfirming = confirmDeleteId === item.id;
              const wasJustAdded = justAddedId === item.id;
              const doc = item.doc;
              const unit = doc?.kind === "pptx" ? "slide" : "page";
              return (
                <div
                  key={item.id}
                  data-upload-tile={item.id}
                  className="group relative aspect-square rounded-lg border border-white/10 bg-black/40 overflow-hidden hover:border-sky-400/70 transition-all select-none"
                  title={
                    doc
                      ? `${item.name || "Document"} · ${doc.kind.toUpperCase()} · ${doc.pages} ${unit}${
                          doc.pages === 1 ? "" : "s"
                        } · Click to open the preview and choose ${unit}s to add`
                      : `${item.name || "Uploaded image"} · Click to add to slide · Drag to position`
                  }
                >
                  {doc ? (
                    /* A saved PDF / PowerPoint: the document itself. Clicking it
                       opens its page preview — nothing is inserted directly. */
                    <button
                      type="button"
                      data-upload-doc={item.id}
                      onClick={() => void openDocPreview(item)}
                      className="h-full w-full flex items-center justify-center p-1 cursor-pointer active:scale-95 transition-transform"
                    >
                      <img src={item.src} alt="" className="max-h-full max-w-full object-contain pointer-events-none" />
                      <span className="absolute bottom-1 left-1 rounded bg-rose-600 px-1 py-px text-[8px] font-extrabold leading-tight tracking-wide text-white shadow">
                        {doc.kind === "pdf" ? "PDF" : "PPTX"}
                      </span>
                      {doc.pages > 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[8px] font-semibold leading-tight text-slate-200">
                          {doc.pages} {unit}
                        </span>
                      )}
                    </button>
                  ) : (
                    /* Thumbnail / click to insert */
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "slidemaker-upload",
                            src: item.src,
                            ratio: item.ratio,
                            name: item.name,
                          }),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => {
                        onAddImage(item.src, item.ratio);
                        setJustAddedId(item.id);
                        setTimeout(() => setJustAddedId(null), 1200);
                      }}
                      className="h-full w-full flex items-center justify-center p-1 cursor-pointer active:scale-95 transition-transform"
                    >
                      <img
                        src={item.src}
                        alt={item.name || "Uploaded image"}
                        className="max-h-full max-w-full object-contain pointer-events-none"
                      />
                    </button>
                  )}

                  {/* Added feedback */}
                  {wasJustAdded && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/80 text-white font-semibold text-[10px] rounded-lg animate-in fade-in">
                      ✓ Added!
                    </div>
                  )}

                  {/* Canva-style Hover overlay and delete affordance */}
                  {!isConfirming && !wasJustAdded && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 via-transparent to-black/60">
                      <div className="flex justify-between items-center w-full">
                        <span className="truncate text-[9px] text-slate-300 px-1 drop-shadow">
                          {item.name || "Image"}
                        </span>
                        {/* Remove button like Canva */}
                        <button
                          type="button"
                          title="Delete from uploads"
                          aria-label={`Delete ${item.name || "image"} from uploads`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(item.id);
                          }}
                          className="pointer-events-auto h-5 w-5 rounded bg-black/80 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-[10px] transition-colors shadow"
                        >
                          🗑
                        </button>
                      </div>
                      <span className="text-[9px] text-sky-300 text-center font-medium drop-shadow">
                        {doc ? `📄 Open preview · pick ${unit}s` : "+ Add to slide"}
                      </span>
                    </div>
                  )}

                  {/* Inline Delete Confirmation (Canva-style) */}
                  {isConfirming && (
                    <div
                      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 bg-slate-950/95 p-1 text-center rounded-lg backdrop-blur-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] font-semibold text-rose-300 leading-tight">
                        Delete upload?
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            removeUpload(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded bg-rose-600 hover:bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------ pictures on this slide --------------------- */}
      {images.length > 0 && !sel && (
        <Field label={`Images on this slide (${images.length})`} hint="click to edit" as="div">
          <div className="grid grid-cols-4 gap-1.5">
            {[...images]
              .sort((a, b) => b.z - a.z)
              .map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => onSelect(x.id)}
                  title={x.text || "Image on slide"}
                  className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/50 hover:border-white/30 transition-colors"
                >
                  {x.src ? (
                    <img src={x.src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-600">empty</span>
                  )}
                </button>
              ))}
          </div>
        </Field>
      )}

      {/* ------------------- selected picture properties editor -------------- */}
      {sel && (
        <div className="space-y-3 rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-sky-200 uppercase">Selected picture</span>
            {isGlobal && <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] text-slate-300">ALL SLIDES</span>}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/50">
              {sel.src ? <img src={sel.src} alt="" className="max-h-full max-w-full object-contain" /> : null}
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="block cursor-pointer rounded-lg bg-sky-400 px-2 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300">
                Replace image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void importFiles(e.target.files, sel.id);
                    e.target.value = "";
                  }}
                />
              </label>
              <Btn
                size="sm"
                className="w-full"
                title="Restore the image's natural proportions"
                disabled={!sel.naturalRatio}
                onClick={() => {
                  if (!sel.naturalRatio) return;
                  set({ h: Math.round(((sel.w / sel.naturalRatio) * (16 / 9)) * 10) / 10 });
                }}
              >
                ⤢ Reset proportions
              </Btn>
            </div>
          </div>

          <Field label="How it fills its box" as="div">
            <SegButtons
              value={sel.fit ?? "contain"}
              onChange={(v) => set({ fit: v })}
              options={[
                { value: "contain", label: "Fit" },
                { value: "cover", label: "Fill (crop)" },
                { value: "fill", label: "Stretch" },
              ]}
            />
          </Field>

          <Field label="Opacity" hint={`${Math.round((sel.opacity ?? 1) * 100)}%`}>
            <Slider min={0.05} max={1} step={0.05} value={sel.opacity ?? 1} onChange={(v) => set({ opacity: v })} />
          </Field>

          <Field label="Crop to shape" as="div">
            <div className="grid grid-cols-6 gap-1">
              {MASKS.map((m) => (
                <button
                  key={m}
                  type="button"
                  title={m}
                  onClick={() => set({ mask: m, radius: m === "none" ? sel.radius : 0 })}
                  className={cn(
                    "rounded-md border py-1.5 text-sm",
                    (sel.mask ?? "none") === m
                      ? "border-amber-400 bg-amber-400 text-slate-950"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25",
                  )}
                >
                  {MASK_ICON[m]}
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

          <Field label="Layer order" as="div">
            <div className="grid grid-cols-4 gap-1">
              {(["front", "forward", "backward", "back"] as ZOp[]).map((op) => (
                <Btn
                  key={op}
                  size="sm"
                  disabled={!canMove(all, sel.id, op)}
                  onClick={() => onReorder(sel.id, op)}
                  title={`${Z_LABELS[op].label} · ${Z_LABELS[op].hint}`}
                >
                  {Z_LABELS[op].icon}
                </Btn>
              ))}
            </div>
          </Field>

          <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
            <Btn size="sm" onClick={() => onDuplicate(sel.id)}>
              ⧉ Duplicate
            </Btn>
            <Btn size="sm" variant="soft" onClick={onOpenDesign} title="Gradients, glow, blend mode and more">
              Full design editor →
            </Btn>
            {onUseAsBackground && sel.src && (
              <Btn size="sm" variant="soft" onClick={() => onUseAsBackground(sel.src!)}>
                Use as background
              </Btn>
            )}
            <Btn size="sm" variant="danger" onClick={() => onRemove(sel.id)}>
              🗑 Remove
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
