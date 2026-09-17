import type { Box, DeckHeader, ElementId, ThemeSettings } from "../lib/types";
import { DEFAULT_LOGO } from "../lib/types";
import ElementPosition from "./ElementPosition";
import { Btn, Field, PanelHead, Toggle } from "./ui";

/**
 * Navigation ▸ "Logo".
 *
 * The crest in the corner of every slide: upload, restore the built-in mark or
 * remove it, choose whether it is drawn at all, then place and scale its box.
 */
interface Props {
  theme: ThemeSettings;
  header: DeckHeader;
  setHeader: (patch: Partial<DeckHeader>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export default function LogoPanel({ theme, header, setHeader, patchLayout }: Props) {
  const box = theme.layout.logo;
  const free = (box?.mode ?? "align") === "free";

  const onLogo = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHeader({ logo: String(reader.result), showLogo: true });
    reader.readAsDataURL(file);
  };

  /** restore the bitmap's own aspect ratio into the free-mode box */
  const resetProportions = () => {
    const img = document.querySelector<HTMLImageElement>('.slide-editable [data-el="logo"] img');
    const ratio = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    patchLayout("logo", { h: r1(((box?.w ?? 6.5) / ratio) * (16 / 9)) }, "Reset logo proportions");
  };

  return (
    <div className="space-y-4">
      <PanelHead title="Logo" subtitle="The crest shown in the corner of every slide." />

      {/* ------------------------------ live preview ------------------------- */}
      <div
        className="flex items-center justify-center overflow-hidden rounded-xl border border-white/10 p-4"
        style={{ background: theme.board }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-black/60">
          {header.showLogo && header.logo ? (
            <img src={header.logo} alt="logo preview" className="max-h-20 max-w-20 object-contain" />
          ) : (
            <span className="text-xs text-slate-600">{header.logo ? "hidden" : "none"}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex-1 space-y-1.5">
          <label className="block cursor-pointer rounded-lg bg-amber-400 px-3 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-amber-300">
            Upload image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex gap-1.5">
            <Btn size="sm" onClick={() => setHeader({ logo: DEFAULT_LOGO, showLogo: true })}>
              Default
            </Btn>
            <Btn size="sm" variant="danger" onClick={() => setHeader({ logo: null })}>
              Remove
            </Btn>
          </div>
        </div>
      </div>

      <Toggle label="Show logo on slides" checked={header.showLogo} onChange={(v) => setHeader({ showLogo: v })} />

      {!header.logo && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-slate-400">
          No logo is set — the corner stays empty. Upload your own crest or restore the built-in one above.
        </p>
      )}

      <ElementPosition theme={theme} id="logo" patchLayout={patchLayout} hideAlign />

      {free && (
        <Field label="Aspect ratio" as="div">
          <Btn size="sm" onClick={resetProportions} title="Reset the logo box to the image's own proportions">
            ⤢ Reset logo proportions
          </Btn>
          <p className="text-[10px] leading-relaxed text-slate-500">
            In <b>Free</b> mode the box height is stored, so the crest keeps the size you drag it to. Aligned mode
            instead lets the bitmap define its own height.
          </p>
        </Field>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        The logo is shared by the whole deck. Use <b>Apply Changes ▸ Header &amp; Title</b> to push a per-slide logo
        override onto other slides.
      </p>
    </div>
  );
}
