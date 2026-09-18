import type { Box, DeckHeader, ElementId, ThemeSettings } from "../lib/types";
import { boxFontCss, elementInk, setElementInk } from "../lib/boxFonts";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import { Btn, ColorField, ColorInput, Field, PanelHead, Slider, TextInput, Toggle } from "./ui";
import { cn } from "../utils/cn";

/**
 * Navigation ▸ "Badge 1" and "Badge 2".
 *
 * The brand block beside the logo paints two independent lines — the academy
 * line ("LEARN WITH") and the teacher line ("FAYSAL SIR"). They share one
 * movable box and one typeface override, but each can be hidden, resized and
 * recoloured on its own, so both get their own navigation entry driven by this
 * same panel.
 */
interface Props {
  line: "top" | "bottom";
  theme: ThemeSettings;
  header: DeckHeader;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setHeader: (patch: Partial<DeckHeader>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

const COPY = {
  top: {
    n: 1,
    title: "Badge 1",
    field: "brandTop" as const,
    size: "brandTopSize" as const,
    color: "brandTopColor" as const,
    show: "showBrandTop" as const,
    fallbackSize: 25,
    placeholder: "LEARN WITH",
    subtitle: "Upper brand line — usually the academy or channel name.",
  },
  bottom: {
    n: 2,
    title: "Badge 2",
    field: "brandBottom" as const,
    size: "brandBottomSize" as const,
    color: "brandBottomColor" as const,
    show: "showBrandBottom" as const,
    fallbackSize: 27,
    placeholder: "FAYSAL SIR",
    subtitle: "Lower brand line — usually the teacher's name.",
  },
};

export default function BrandLinePanel({ line, theme, header, setTheme, setHeader, patchLayout }: Props) {
  const c = COPY[line];
  const other = COPY[line === "top" ? "bottom" : "top"];
  const size = theme[c.size] ?? c.fallbackSize;
  const shown = theme[c.show] ?? true;
  const own = theme[c.color] || "";
  const otherOwn = theme[other.color] || "";

  /** the per-line keys are a union, so writes go through one cast helper */
  const patchTheme = (patch: Record<string, unknown>) => setTheme(patch as Partial<ThemeSettings>);
  const patchHeader = (patch: Record<string, unknown>) => setHeader(patch as Partial<DeckHeader>);

  const brandCss = boxFontCss(theme, "brand", {
    textTransform: "uppercase",
    lineHeight: 1.05,
    fontWeight: 700,
    letterSpacing: 0.4,
  });

  return (
    <div className="space-y-4">
      <PanelHead title={c.title} subtitle={c.subtitle} />

      {/* ------------------------------ live preview ------------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10 px-4 py-4" style={{ background: theme.board }}>
        <div style={{ ...brandCss, color: theme.brandColor, textAlign: "center" }}>
          {(["top", "bottom"] as const).map((k) => {
            const cfg = COPY[k];
            const on = theme[cfg.show] ?? true;
            const text = header[cfg.field];
            return (
              <div
                key={k}
                className={cn("rounded px-1 transition-opacity", k === line && "ring-1 ring-amber-400/70")}
                style={{
                  fontSize: Math.round((theme[cfg.size] ?? cfg.fallbackSize) * 0.8),
                  color: theme[cfg.color] || undefined,
                  opacity: on ? 1 : 0.22,
                  textDecoration: on ? undefined : "line-through",
                }}
              >
                {text || cfg.placeholder}
              </div>
            );
          })}
        </div>
      </div>

      <Field label={`Badge ${c.n} text`}>
        <TextInput
          value={header[c.field]}
          placeholder={c.placeholder}
          onChange={(e) => patchHeader({ [c.field]: e.target.value })}
        />
      </Field>

      <Toggle label={`Show badge ${c.n}`} checked={shown} onChange={(v) => patchTheme({ [c.show]: v })} />

      <Field label="Text size" hint={`${size}px`}>
        <Slider min={12} max={64} value={size} onChange={(v) => patchTheme({ [c.size]: v })} />
      </Field>

      <ColorField
        label="Badge colour"
        hint={own ? "custom" : "follows the shared brand colour"}
        value={own}
        fallback={theme.brandColor}
        autoLabel="Shared"
        presets={Array.from(new Set([theme.brandColor, "#ffd633", "#ffffff", "#5ef2ff"]))}
        onChange={(v) => patchTheme({ [c.color]: v })}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <ColorInput label="Shared brand colour" value={elementInk(theme, "brand")} onChange={(v) => setTheme(setElementInk(theme, "brand", v))} />
        <p className="text-[10px] leading-relaxed text-slate-500">
          Used by any badge line left on <b>Shared</b>. Badge {other.n} currently{" "}
          {otherOwn ? `has its own colour (${otherOwn}).` : "follows this colour too."}
        </p>
      </div>

      <BoxFontControls theme={theme} setTheme={setTheme} selected="brand" />
      <p className="text-[10px] leading-relaxed text-slate-500">
        The typeface above is shared by both badge lines — they are one text block on the slide.
      </p>

      <ElementPosition theme={theme} id="brand" patchLayout={patchLayout} label="Badge block" />

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          onClick={() => patchTheme({ [c.size]: c.fallbackSize, [c.color]: "", [c.show]: true })}
        >
          Reset badge {c.n}
        </Btn>
        <Btn
          size="sm"
          variant="soft"
          onClick={() =>
            patchTheme({
              [c.size]: theme[other.size] ?? other.fallbackSize,
              [c.color]: otherOwn,
            })
          }
          title={`Copy badge ${other.n}'s size and colour onto badge ${c.n}`}
        >
          Match badge {other.n}
        </Btn>
      </div>
    </div>
  );
}
