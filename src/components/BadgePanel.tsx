import type { Box, DeckHeader, ElementId, SlideData, ThemeSettings } from "../lib/types";
import { DEFAULT_BADGE_PLATE, cloneBadgePlate } from "../lib/types";
import { withAlpha } from "../lib/color";
import { boxFontCss, elementInk, setElementInk } from "../lib/boxFonts";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import { Btn, ColorInput, Field, PanelHead, Slider, TextInput, Toggle } from "./ui";

/**
 * Navigation ▸ "Badge 3".
 *
 * The right-hand badge (e.g. "DAKHIL-26"). One deck-wide text with an optional
 * per-slide override, its own colour, size, typeface and an optional plate
 * drawn behind it.
 */
interface Props {
  theme: ThemeSettings;
  header: DeckHeader;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setHeader: (patch: Partial<DeckHeader>) => void;
  updateSlide: (id: string, patch: Partial<SlideData>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

export default function BadgePanel({ theme, header, slide, setTheme, setHeader, updateSlide, patchLayout }: Props) {
  const plate = { ...DEFAULT_BADGE_PLATE, ...(theme.badgePlate ?? {}) };
  const setPlate = (p: Partial<typeof plate>) => setTheme({ badgePlate: { ...plate, ...p } });
  const size = theme.badgeSize ?? 36;
  const override = slide?.badge?.trim() ?? "";
  const text = override || header.badge;

  const badgeCss = boxFontCss(theme, "badge", {
    fontWeight: 700,
    fontSize: Math.round(size * 0.72),
    letterSpacing: 0.5,
    color: theme.badgeColor,
    textTransform: "uppercase",
    textShadow: "0 2px 6px rgba(0,0,0,.6)",
    lineHeight: 1.15,
  });

  return (
    <div className="space-y-4">
      <PanelHead title="Badge 3" subtitle="The right-hand badge — exam, batch or session tag." />

      {/* ------------------------------ live preview ------------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10 px-4 py-5" style={{ background: theme.board }}>
        <div style={{ ...badgeCss, textAlign: "right" }}>
          <span
            style={
              plate.enabled
                ? {
                    display: "inline-block",
                    background: withAlpha(plate.color, plate.opacity),
                    borderRadius: plate.radius,
                    padding: `${plate.padY}px ${plate.padX}px`,
                    border: plate.border.enabled ? `${plate.border.width}px solid ${plate.border.color}` : undefined,
                    boxShadow: `0 2px 10px ${withAlpha("#000000", 0.45)}`,
                  }
                : undefined
            }
          >
            {text || "DAKHIL-26"}
          </span>
        </div>
      </div>

      <Field label="Badge text (all slides)">
        <TextInput value={header.badge} onChange={(e) => setHeader({ badge: e.target.value })} />
      </Field>

      {slide && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">This slide only</span>
            {override && (
              <button
                type="button"
                onClick={() => updateSlide(slide.id, { badge: "" })}
                className="text-[10px] text-rose-300 hover:underline"
              >
                ✕ use deck badge
              </button>
            )}
          </div>
          <TextInput
            value={slide.badge ?? ""}
            placeholder={override ? "" : `Inherits “${header.badge || "—"}”`}
            onChange={(e) => updateSlide(slide.id, { badge: e.target.value })}
          />
          <p className="text-[10px] leading-relaxed text-slate-500">
            {override
              ? "This slide paints its own badge text."
              : "Empty = the slide follows the deck badge above."}
          </p>
        </div>
      )}

      <ColorInput label="Badge colour" value={elementInk(theme, "badge")} onChange={(v) => setTheme(setElementInk(theme, "badge", v))} />

      {/* --------------------------------- plate ----------------------------- */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Toggle label="Plate behind the badge" checked={plate.enabled} onChange={(v) => setPlate({ enabled: v })} />
        {plate.enabled && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Plate colour" value={plate.color} onChange={(v) => setPlate({ color: v })} />
              <Field label="Opacity" hint={`${Math.round(plate.opacity * 100)}%`}>
                <Slider min={0} max={1} step={0.05} value={plate.opacity} onChange={(v) => setPlate({ opacity: v })} />
              </Field>
            </div>
            <Field label="Corner radius" hint={plate.radius >= 999 ? "pill" : `${plate.radius}px`}>
              <Slider min={0} max={999} step={1} value={plate.radius} onChange={(v) => setPlate({ radius: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Padding ↔" hint={`${plate.padX}px`}>
                <Slider min={0} max={60} value={plate.padX} onChange={(v) => setPlate({ padX: v })} />
              </Field>
              <Field label="Padding ↕" hint={`${plate.padY}px`}>
                <Slider min={0} max={40} value={plate.padY} onChange={(v) => setPlate({ padY: v })} />
              </Field>
            </div>
            <Toggle
              label="Plate border"
              checked={plate.border.enabled}
              onChange={(v) => setPlate({ border: { ...plate.border, enabled: v } })}
            />
            {plate.border.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <ColorInput
                  label="Border colour"
                  value={plate.border.color}
                  onChange={(v) => setPlate({ border: { ...plate.border, color: v } })}
                />
                <Field label="Width" hint={`${plate.border.width}px`}>
                  <Slider
                    min={1}
                    max={8}
                    step={0.5}
                    value={plate.border.width}
                    onChange={(v) => setPlate({ border: { ...plate.border, width: v } })}
                  />
                </Field>
              </div>
            )}
          </>
        )}
      </div>

      {/* the badge glyphs only — the plate above is styled separately */}
      <BoxFontControls
        theme={theme}
        setTheme={setTheme}
        selected="badge"
        size={{ value: size, onChange: (v) => setTheme({ badgeSize: v }), sliderMax: 120 }}
        hide={["color"]}
      />

      <ElementPosition theme={theme} id="badge" patchLayout={patchLayout} />

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          variant="danger"
          onClick={() => setTheme({ badgeSize: 36, badgeColor: "#ffffff", badgePlate: cloneBadgePlate() })}
        >
          Reset badge 3
        </Btn>
      </div>
    </div>
  );
}
