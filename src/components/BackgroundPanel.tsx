import { useState } from "react";
import type { BackgroundSettings, Deck, SlideData } from "../lib/types";
import { BACKGROUND_PRESETS, IMAGE_TREATMENTS, backgroundLayers, effectiveBackground } from "../lib/background";
import { inlineRemoteImage, loadImageFile, shrinkDataUrl, type ShapeItem } from "../lib/shapes";
import GradientEditor from "./GradientEditor";
import { Btn, ColorInput, Field, SegButtons, Slider, Toggle } from "./ui";
import { cn } from "../utils/cn";

type Scope = "slide" | "deck" | "selected";

interface Props {
  deck: Deck;
  slide: SlideData | undefined;
  onSet: (patch: Partial<BackgroundSettings>, scope: "deck" | "slide" | string[]) => void;
  onReset: (scope: "deck" | "slide" | string[]) => void;
  onClearSlide: (ids: string[]) => void;
  /** promote an image shape to the background (and optionally delete the shape) */
  onRemoveShape?: (id: string) => void;
  /** Scope is controlled by the main Apply Changes bar. */
  managedScope?: boolean;
}

export default function BackgroundPanel({ deck, slide, onSet, onReset, onClearSlide, onRemoveShape, managedScope = false }: Props) {
  const [scope, setScope] = useState<Scope>("slide");
  const [picked, setPicked] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const bg = effectiveBackground(deck, slide);
  const hasOverride = !!slide?.background;
  const target: "deck" | "slide" | string[] = managedScope ? "slide" : scope === "deck" ? "deck" : scope === "slide" ? "slide" : picked;
  const targetReady = scope !== "selected" || picked.length > 0;
  const set = (p: Partial<BackgroundSettings>) => targetReady && onSet(p, target);

  const importFile = async (file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy("Loading image…");
    try {
      const { src } = await loadImageFile(file);
      set({ src: await shrinkDataUrl(src, 2560, 0.85) });
    } catch {
      alert("Could not read that image.");
    } finally {
      setBusy(null);
    }
  };
  const importUrl = async () => {
    if (!url.trim()) return;
    setBusy("Fetching image…");
    try {
      const { src } = await inlineRemoteImage(url.trim());
      set({ src: await shrinkDataUrl(src, 2560, 0.85) });
      setUrl("");
    } catch {
      alert("Could not load an image from that URL.");
    } finally {
      setBusy(null);
    }
  };

  const imageShapes: ShapeItem[] = [...(deck.globalShapes ?? []), ...(slide?.shapes ?? [])].filter(
    (x) => x.kind === "image" && x.src,
  );

  const scopeText = scope === "deck" ? "every slide" : scope === "selected" ? `${picked.length} selected slide${picked.length === 1 ? "" : "s"}` : "this slide";

  return (
    <div className="space-y-4">
      {/* ------------------------------ live preview -------------------------- */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10" style={{ background: deck.theme.board }}>
        {backgroundLayers(bg, deck.theme.board).map((st, i) => (
          <div key={i} style={st} />
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/40 px-2 py-1 text-[10px] text-slate-300">
          <span>{bg.src ? "Image background" : bg.gradient.enabled ? "Gradient background" : "Board colour only"}</span>
          <span>{hasOverride ? "this slide's own background" : "from deck (all slides)"}</span>
        </div>
      </div>

      {/* The main Apply Changes bar owns scope in the inspector. */}
      {!managedScope && <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3">
        <span className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">Apply to…</span>
        <SegButtons
          value={scope}
          onChange={(v) => {
            setScope(v);
            if (v === "selected" && !picked.length && slide) setPicked([slide.id]);
          }}
          options={[
            { value: "slide", label: "This slide" },
            { value: "selected", label: "Selected" },
            { value: "deck", label: "All slides" },
          ]}
        />
        {scope === "selected" && (
          <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/60 p-1">
            <div className="flex gap-1 px-1 pb-1">
              {[
                ["all", () => setPicked(deck.slides.map((s) => s.id))],
                ["none", () => setPicked([])],
                ["odd", () => setPicked(deck.slides.filter((_, i) => i % 2 === 0).map((s) => s.id))],
                ["even", () => setPicked(deck.slides.filter((_, i) => i % 2 === 1).map((s) => s.id))],
              ].map(([l, fn]) => (
                <button key={l as string} onClick={fn as () => void} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10">
                  {l as string}
                </button>
              ))}
            </div>
            {deck.slides.map((s, i) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={picked.includes(s.id)}
                  onChange={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                  className="accent-amber-400"
                />
                <span className="w-5 font-mono text-[10px] text-slate-500">{i + 1}</span>
                <span className="truncate">{s.question.replace(/\$[^$]*\$/g, "▫").slice(0, 36) || "(empty)"}</span>
                {s.background && <span className="ml-auto text-[9px] text-amber-300">own bg</span>}
              </label>
            ))}
          </div>
        )}
        {hasOverride && scope !== "deck" && (
          <Btn size="sm" onClick={() => onClearSlide(scope === "selected" ? picked : slide ? [slide.id] : [])}>
            ↩ Use deck background on {scopeText}
          </Btn>
        )}
      </div>}
      {managedScope && (
        <p className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-200">
          Editing this slide's background preview. Use the main Apply Changes button to copy it to selected or all slides.
        </p>
      )}

      {/* --------------------------------- image ----------------------------- */}
      <div className="space-y-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-sky-200 uppercase">Background image</span>
          {busy && <span className="text-[10px] text-sky-300">{busy}</span>}
        </div>
        <div className="flex gap-1.5">
          <label className={cn("flex-1 cursor-pointer rounded-lg bg-sky-400 px-2 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300", !targetReady && "pointer-events-none opacity-40")}>
            {bg.src ? "Replace image" : "Upload image"} → {scopeText}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {bg.src && (
            <Btn
              size="sm"
              variant="danger"
              disabled={!targetReady}
              title={
                scope === "deck" || hasOverride
                  ? "Remove the background image"
                  : "This image comes from the deck background — removing here blanks only this slide"
              }
              onClick={() => {
                // image set on the deck but user is in "this slide" scope → ask which they mean
                if (scope === "slide" && !hasOverride && deck.theme.background?.src) {
                  if (confirm("This background is set for ALL slides.\n\nOK = remove it from all slides\nCancel = remove it from this slide only")) {
                    onSet({ src: "" }, "deck");
                    return;
                  }
                }
                set({ src: "" });
              }}
            >
              Remove
            </Btn>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void importUrl()}
            placeholder="https://… image URL"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
          />
          <Btn size="sm" onClick={() => void importUrl()} disabled={!url.trim() || !targetReady}>
            Add
          </Btn>
        </div>
        {imageShapes.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400">Or use an image already on the slide:</span>
            <div className="flex flex-wrap gap-1.5">
              {imageShapes.map((sh) => (
                <button
                  key={sh.id}
                  onClick={() => {
                    set({ src: sh.src! });
                    if (onRemoveShape && confirm("Image set as background. Remove the original image shape from the slide?")) onRemoveShape(sh.id);
                  }}
                  className="h-10 w-16 overflow-hidden rounded-md border border-white/15 hover:border-sky-400"
                  title="Set as background"
                >
                  <img src={sh.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10px] text-slate-500">
          Tip: drop an image onto the slide while holding <b>Shift</b> to set it as the background directly.
        </p>
      </div>

      {bg.src && (
        <>
          <Field label="Fit">
            <SegButtons
              value={bg.fit}
              onChange={(v) => set({ fit: v })}
              options={[
                { value: "cover", label: "Fill" },
                { value: "contain", label: "Fit" },
                { value: "stretch", label: "Stretch" },
                { value: "tile", label: "Tile" },
              ]}
            />
          </Field>

          <Field label="Quick treatments">
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_TREATMENTS.map((t) => (
                <button key={t.name} onClick={() => set(t.bg)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400/60">
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          {(bg.fit === "cover" || bg.fit === "contain") && (
            <Field label="Focal point" hint={`${bg.posX}% · ${bg.posY}%`}>
              <div className="grid grid-cols-3 gap-1">
                {[
                  [0, 0, "↖"], [50, 0, "↑"], [100, 0, "↗"],
                  [0, 50, "←"], [50, 50, "•"], [100, 50, "→"],
                  [0, 100, "↙"], [50, 100, "↓"], [100, 100, "↘"],
                ].map(([x, y, l]) => (
                  <button
                    key={l as string}
                    onClick={() => set({ posX: x as number, posY: y as number })}
                    className={cn(
                      "rounded-md border py-1.5 text-sm",
                      bg.posX === x && bg.posY === y ? "border-amber-400 bg-amber-400 text-slate-950" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
                    )}
                  >
                    {l as string}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Slider min={0} max={100} value={bg.posX} onChange={(v) => set({ posX: v })} />
                <Slider min={0} max={100} value={bg.posY} onChange={(v) => set({ posY: v })} />
              </div>
            </Field>
          )}

          {bg.fit === "cover" && (
            <Field label="Zoom" hint={`+${bg.zoom}%`}>
              <Slider min={0} max={100} value={bg.zoom} onChange={(v) => set({ zoom: v })} />
            </Field>
          )}

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Field label="Image opacity" hint={`${Math.round(bg.opacity * 100)}%`}>
              <Slider min={0.05} max={1} step={0.05} value={bg.opacity} onChange={(v) => set({ opacity: v })} />
            </Field>
            <Field label="Blur" hint={bg.blur ? `${bg.blur}px` : "off"}>
              <Slider min={0} max={30} value={bg.blur} onChange={(v) => set({ blur: v })} />
            </Field>
            <Toggle label="Flip horizontally" checked={bg.flipH} onChange={(v) => set({ flipH: v })} />
          </div>
        </>
      )}

      {/* ------------------------------- overlay / vignette ------------------- */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Toggle label="Colour overlay (tint / darken)" checked={bg.overlay.enabled} onChange={(v) => set({ overlay: { ...bg.overlay, enabled: v } })} />
        {bg.overlay.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Overlay colour" value={bg.overlay.color} onChange={(v) => set({ overlay: { ...bg.overlay, color: v } })} />
            <Field label="Strength" hint={`${Math.round(bg.overlay.opacity * 100)}%`}>
              <Slider min={0} max={1} step={0.05} value={bg.overlay.opacity} onChange={(v) => set({ overlay: { ...bg.overlay, opacity: v } })} />
            </Field>
          </div>
        )}
        <Field label="Vignette (dark edges)" hint={bg.vignette ? `${bg.vignette}` : "off"}>
          <Slider min={0} max={100} value={bg.vignette} onChange={(v) => set({ vignette: v })} />
        </Field>
      </div>

      {/* -------------------------------- gradient --------------------------- */}
      <Field label="Colour presets">
        <div className="grid grid-cols-3 gap-1.5">
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => set(p.bg)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-[10px] text-slate-300 hover:border-amber-400/60"
            >
              <span className="h-6 w-full rounded border border-white/10" style={{ background: p.swatch }} />
              {p.name}
            </button>
          ))}
        </div>
      </Field>
      <GradientEditor
        label="Gradient background (under the image)"
        value={bg.gradient}
        fallback={deck.theme.board}
        onChange={(g) => set({ gradient: g })}
      />

      <div className="space-y-1.5 border-t border-white/10 pt-3">
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="danger" disabled={!targetReady} onClick={() => onReset(target)}>
            ↺ Reset background on {scopeText}
          </Btn>
          {!managedScope && scope !== "deck" && (
            <Btn size="sm" variant="danger" onClick={() => onReset("deck")} title="Clear the deck background and every per-slide override">
              Reset on ALL slides
            </Btn>
          )}
        </div>
        <p className="text-[10px] text-slate-500">
          {scope === "deck"
            ? "Clears the deck background and removes every slide's own background."
            : "Clears the background on the chosen slide(s) only — other slides keep theirs."}
        </p>
      </div>
    </div>
  );
}
