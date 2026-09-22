import type { Box, DeckHeader, ElementId, ThemeSettings } from "../lib/types";
import { BANNER_AUTO_FRAME_HEIGHT, DEFAULT_BANNER } from "../lib/types";
import { TEXT_GRADIENT_PRESETS, bannerCss } from "../lib/banner";
import { boxStack, clearBoxFont, elementInk, setElementInk } from "../lib/boxFonts";
import GradientEditor from "./GradientEditor";
import BoxFontControls from "./BoxFontControls";
import ElementPosition from "./ElementPosition";
import { Btn, ColorInput, Field, PanelHead, Slider, TextInput, Toggle } from "./ui";

/**
 * Navigation ▸ "Title text".
 *
 * Everything that paints the title *glyphs*: the string itself, its size, solid
 * colour or gradient, glow and shadow, plus the per-box typeface override and
 * the element's own position on the board. The plate drawn behind it lives in
 * the sibling "Title background" panel.
 */
interface Props {
  theme: ThemeSettings;
  header: DeckHeader;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setHeader: (patch: Partial<DeckHeader>) => void;
  patchLayout: (id: ElementId, patch: Partial<Box>, label?: string) => void;
}

export default function TitleTextPanel({ theme, header, setTheme, setHeader, patchLayout }: Props) {
  const b = { ...DEFAULT_BANNER, ...(theme.banner ?? {}), color: theme.banner?.color ?? theme.titleBanner };
  const setBanner = (p: Partial<typeof b>) => setTheme({ banner: { ...b, ...p } });
  const css = bannerCss(b, theme.titleColor);
  const size = theme.titleSize ?? 54;

  return (
    <div className="space-y-4">
      <PanelHead
        title="Title text"
        subtitle="The heading glyphs — wording, size, colour, glow and typeface."
      />

      {/* --------------------------------- live preview ---------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/10" style={{ background: theme.board }}>
        <div className="flex items-center justify-center px-6 py-7">
          <div
            style={{
              position: "relative",
              padding: css.padding,
              boxSizing: "border-box",
              width: header.showBanner && b.shape !== "none" ? "min(100%, 320px)" : "fit-content",
              ...(header.showBanner && b.shape !== "none" && b.size?.h === undefined ? { height: BANNER_AUTO_FRAME_HEIGHT } : {}),
              display: header.showBanner && b.shape !== "none" ? "flex" : undefined,
              alignItems: header.showBanner && b.shape !== "none" ? "center" : undefined,
              margin: "0 auto",
            }}
          >
            {header.showBanner && css.halo && <div style={css.halo} />}
            {header.showBanner && css.layers.map((l, i) => <div key={`banner-layer-${i}`} data-banner-layer={i} style={l} />)}
            {header.showBanner && <div className={b.shimmer ? "banner-shimmer" : undefined} style={css.box} />}
            {header.showBanner && css.border && <div style={css.border} />}
            {header.showBanner && css.overlays.map((l, i) => <div key={`banner-overlay-${i}`} style={l} />)}
            <div
              style={{
                position: "relative",
                fontFamily: boxStack(theme, "title"),
                fontSize: Math.round(size * 0.56),
                fontWeight: 800,
                whiteSpace: "nowrap",
                width: header.showBanner && b.shape !== "none" ? "100%" : undefined,
                lineHeight: 1.25,
                ...css.text,
              }}
            >
              {header.title || "বহুনির্বাচনী"}
            </div>
          </div>
        </div>
      </div>

      <Field label="Title text">
        <TextInput value={header.title} onChange={(e) => setHeader({ title: e.target.value })} />
      </Field>

      {!b.textGradient.enabled && (
        <ColorInput label="Title colour" value={elementInk(theme, "title")} onChange={(v) => setTheme(setElementInk(theme, "title", v))} />
      )}

      <GradientEditor
        label="Gradient text"
        value={b.textGradient}
        fallback={theme.titleColor}
        onChange={(g) => setBanner({ textGradient: g })}
        presets={TEXT_GRADIENT_PRESETS}
      />

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Field label="Text glow" hint={b.textGlow ? `${b.textGlow}` : "off"}>
          <Slider min={0} max={100} value={b.textGlow} onChange={(v) => setBanner({ textGlow: v })} />
        </Field>
        <Toggle label="Drop shadow" checked={b.textShadow} onChange={(v) => setBanner({ textShadow: v })} />
      </div>

      {/* the heading glyphs only — the banner plate has its own destination */}
      <BoxFontControls
        theme={theme}
        setTheme={setTheme}
        selected="title"
        size={{ value: size, onChange: (v) => setTheme({ titleSize: v }), sliderMax: 160 }}
        hide={["color"]}
      />

      <ElementPosition theme={theme} id="title" patchLayout={patchLayout} />

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <Btn
          size="sm"
          variant="danger"
          onClick={() =>
            setTheme({
              titleSize: 54,
              titleColor: "#ffd633",
              boxFonts: clearBoxFont(theme.boxFonts, "title"),
              banner: { ...b, textGradient: { ...b.textGradient, enabled: false }, textGlow: 25, textShadow: true },
            })
          }
        >
          Reset title text
        </Btn>
      </div>
    </div>
  );
}
