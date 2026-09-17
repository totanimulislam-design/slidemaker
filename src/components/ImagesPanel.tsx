import { useState } from "react";
import { inlineRemoteImage, loadImageFile, shrinkDataUrl, type ShapeItem } from "../lib/shapes";
import { canMove, Z_LABELS, type ZOp } from "../lib/zorder";
import { Btn, Field, PanelHead, SegButtons, Slider, TextArea } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Insert images".
 *
 * A dedicated home for pictures: upload / paste / link, then the image-only
 * controls (fit, crop mask, corner radius, flips, opacity, shadow, caption) and
 * the layer order. Shapes, text boxes and the full design editor stay in
 * "Insert shapes".
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
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const all = [...globalShapes, ...slideShapes];
  const images = all.filter((x) => x.kind === "image");
  const sel = images.find((x) => x.id === selectedId) ?? null;
  const isGlobal = !!sel && globalShapes.some((x) => x.id === sel.id);
  const set = (p: Partial<ShapeItem>) => sel && onChange(sel.id, p);

  const importFiles = async (files: FileList | File[] | null | undefined, replaceId?: string) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(`Loading ${list.length} image${list.length > 1 ? "s" : ""}…`);
    try {
      for (const f of list) {
        const { src, ratio } = await loadImageFile(f);
        const small = await shrinkDataUrl(src);
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
      onAddImage(await shrinkDataUrl(src), ratio);
      setUrl("");
    } catch {
      alert("Could not load an image from that URL.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PanelHead
        title="Insert images"
        subtitle="Pictures, diagrams and photos placed on the slide."
        right={<span className="shrink-0 text-[10px] text-slate-500">{images.length} on slide</span>}
      />

      <p className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-200">
        Images land on <b>this slide</b> first. Use <b>Apply Changes</b> above to copy the whole composition to your
        target slides.
      </p>

      {/* --------------------------------- insert ---------------------------- */}
      <div className="space-y-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-sky-200 uppercase">Add a picture</span>
          {busy && <span className="text-[10px] text-sky-300">{busy}</span>}
        </div>
        <label className="block cursor-pointer rounded-lg bg-sky-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300">
          ⬆ Upload from device
          <input
            type="file"
            accept="image/*"
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
            placeholder="https://… image URL"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
          />
          <Btn size="sm" onClick={() => void importUrl()} disabled={!url.trim()}>
            Add
          </Btn>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          You can also <b>paste</b> an image (Ctrl/⌘ + V) or <b>drag a file</b> onto the slide — hold <b>Shift</b> while
          dropping to make it the slide background instead.
        </p>
      </div>

      {/* ---------------------------------- list ----------------------------- */}
      {images.length > 0 ? (
        <Field label={`Pictures (${images.length})`} hint="click to select" as="div">
          <div className="grid grid-cols-4 gap-1.5">
            {[...images]
              .sort((a, b) => b.z - a.z)
              .map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => onSelect(x.id)}
                  title={x.text || "Image"}
                  className={cn(
                    "flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-black/50",
                    selectedId === x.id ? "border-amber-400 ring-1 ring-amber-400/50" : "border-white/10 hover:border-white/30",
                  )}
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
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-400">
          No pictures on this slide yet. Upload one above, or drop a file straight onto the canvas.
        </p>
      )}

      {/* --------------------------------- editor ---------------------------- */}
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
