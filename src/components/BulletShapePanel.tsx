import type { ReactNode } from "react";
import type { Box, ElementId, NumberBorderStyle, ThemeSettings } from "../lib/types";
import { shade } from "../lib/color";
import {
  numberStyleDef,
  numberStyleLineWeight,
  numberStyleRadius,
  showsNumber,
  type NumberStyle,
} from "../lib/numberStyles";
import ElementPosition from "./ElementPosition";
import { Btn, ColorField, Field, SegButtons, Slider, Toggle } from "./ui";

/**
 * The question bullet's own shape controls — the same set the toolbar's
 * "Bullet shape" card and the inspector's "Question bullet" destination both
 * show, so a teacher can reach them from the board or from the panel.
 *
 * Every channel falls back to the numbering design's own paint (`auto`), which
 * is what makes an untouched deck render exactly as before:
 *
 *   Shape fill        the silhouette's body            `bulletFill`
 *   Border colour      its outline                     `bulletBorder`
 *   Border style       solid · dashed · dotted · double `bulletBorderStyle`
 *   Border radius      the corners, in px              `bulletRadius`
 *   Border weight      the outline's thickness          `bulletBorderWeight`
 *   Transparency       the body only, never the number  `bulletOpacity`
 */
interface ShapeProps {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const BORDER_STYLES: { value: NumberBorderStyle; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dash" },
  { value: "dotted", label: "Dot" },
  { value: "double", label: "Double" },
];

function Cap({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-normal text-slate-500">
        {hint}
        {action}
      </span>
    </div>
  );
}

/** clear a channel back to the design's own value */
function AutoBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!on}
      title={label}
      onClick={onClick}
      className={!on ? "rounded border border-amber-400/60 px-1.5 py-0.5 text-[10px] text-amber-200" : "rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10"}
    >
      auto
    </button>
  );
}

export function BulletShapeControls({ theme: T, setTheme }: ShapeProps) {
  const id = (T.numberStyle ?? "circle") as NumberStyle;
  const size = T.bulletSize ?? 54;
  const base = T.accent || "#2f4fff";
  const def = numberStyleDef(id);
  const cut = !!def.points;

  const radiusAuto = numberStyleRadius(id, size);
  const weightAuto = numberStyleLineWeight(id, size);
  const radius = T.bulletRadius ?? radiusAuto;
  const weight = T.bulletBorderWeight ?? weightAuto;
  const opacity = T.bulletOpacity ?? 100;

  return (
    <div className="space-y-3" data-bullet-shape-controls="">
      {/* ------------------------------------------------------------ fill --- */}
      <Cap hint={T.bulletFill === "transparent" ? "none" : T.bulletFill ? "" : "design's own"}>Shape fill colour</Cap>
      <ColorField
        label="Shape fill"
        value={T.bulletFill ?? ""}
        fallback={shade(base, 0.2)}
        onChange={(v) => setTheme({ bulletFill: v })}
        allowNone
        autoLabel="Auto (the design's own fill)"
        presets={[base, shade(base, 0.45), shade(base, -0.35), "#ffffff", "#0b0b0f"]}
      />

      {/* ---------------------------------------------------------- border --- */}
      <Cap hint={T.bulletBorder === "transparent" ? "none" : T.bulletBorder ? "" : "design's own"}>Border colour</Cap>
      <ColorField
        label="Border colour"
        value={T.bulletBorder ?? ""}
        fallback={shade(base, 0.5)}
        onChange={(v) => setTheme({ bulletBorder: v })}
        allowNone
        autoLabel="Auto (the design's own line)"
        presets={["#ffffff", base, shade(base, 0.5), "#0b0b0f"]}
      />

      <Cap>Border style</Cap>
      <SegButtons
        value={(T.bulletBorderStyle ?? "auto") as NumberBorderStyle}
        options={BORDER_STYLES}
        onChange={(v) => setTheme({ bulletBorderStyle: v as NumberBorderStyle })}
      />

      <Cap
        hint={cut ? `polygons have straight corners · ${radius}px` : `${T.bulletRadius !== undefined ? "" : "auto · "}${radius}px`}
        action={<AutoBtn on={T.bulletRadius !== undefined} onClick={() => setTheme({ bulletRadius: undefined })} label="Border radius: back to the design's own corners" />}
      >
        Border radius
      </Cap>
      <div className={cut ? "opacity-50" : undefined}>
        <Slider
          value={radius}
          min={0}
          max={80}
          step={1}
          onChange={(v) => setTheme({ bulletRadius: v })}
          ariaLabel="Border radius (px)"
        />
      </div>

      <Cap
        hint={weight ? `${weight}px` : "none"}
        action={<AutoBtn on={T.bulletBorderWeight !== undefined} onClick={() => setTheme({ bulletBorderWeight: undefined })} label="Border weight: back to the design's own line" />}
      >
        Border weight
      </Cap>
      <Slider
        value={weight}
        min={0}
        max={16}
        step={0.5}
        onChange={(v) => setTheme({ bulletBorderWeight: v })}
        ariaLabel="Border weight (px)"
      />

      {/* ----------------------------------------------------- transparency --- */}
      <Cap hint={opacity >= 100 ? "fully visible" : `${100 - opacity}% see-through`}>Transparency</Cap>
      <Slider
        value={opacity}
        min={0}
        max={100}
        onChange={(v) => setTheme({ bulletOpacity: v })}
        ariaLabel="Marker transparency (100 = fully visible)"
      />

      <p className="text-[10px] leading-relaxed text-slate-500">
        These channels paint the marker's <b>body</b> — the fill, the outline and the corners. The number keeps its own
        ink, face and opacity (<b>Q bullet text</b>), which is also why the marker design previews above stay honest.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position                                                           */
/* ------------------------------------------------------------------ */

interface PositionProps extends ShapeProps {
  /** the z-preserving layout writer the canvas drags use */
  patchLayout?: (id: ElementId, patch: Partial<Box>, label?: string) => void;
  /** bring the marker into view on the canvas (outline + handles) */
  onSelectBullet?: () => void;
}

export function BulletPositionControls({ theme: T, setTheme, patchLayout, onSelectBullet }: PositionProps) {
  const nudgeX = T.bulletNudgeX ?? 0;
  const nudgeY = T.bulletNudgeY ?? 0;
  const nudged = nudgeX !== 0 || nudgeY !== 0;
  const separate = !!T.bulletSeparate;

  return (
    <div className="space-y-3" data-bullet-position-controls="">
      <Cap>Position</Cap>
      <Toggle
        label="Bullet is a separate movable element"
        checked={separate}
        onChange={(v) => {
          setTheme({ bulletSeparate: v });
          if (v) onSelectBullet?.();
        }}
      />
      <p className="text-[10px] leading-relaxed text-slate-500">
        {separate
          ? "The marker is its own layer on the board: drag it anywhere, or place it exactly below."
          : "The marker rides along with the question's row. Nudge it here, or make it a separate element to place it anywhere on the board."}
      </p>

      <Field label="Nudge horizontally →" hint={`${nudgeX} px`}>
        <Slider min={-300} max={300} value={nudgeX} onChange={(v) => setTheme({ bulletNudgeX: v })} ariaLabel="Bullet nudge horizontally" />
      </Field>
      <Field label="Nudge vertically ↓" hint={`${nudgeY} px`}>
        <Slider min={-200} max={200} value={nudgeY} onChange={(v) => setTheme({ bulletNudgeY: v })} ariaLabel="Bullet nudge vertically" />
      </Field>
      {nudged && (
        <Btn size="sm" variant="soft" onClick={() => setTheme({ bulletNudgeX: 0, bulletNudgeY: 0 })}>
          Reset nudge
        </Btn>
      )}

      {separate && patchLayout ? (
        <ElementPosition theme={T} id="bullet" patchLayout={patchLayout} hideAlign label="Question bullet" />
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-slate-500">
          {T.showNumber && !showsNumber((T.numberStyle ?? "circle") as NumberStyle)
            ? "This design is a mark without a number. "
            : ""}
          Turning on <b>Bullet is a separate movable element</b> hands the marker its own box — alignment, X / Y / width /
          height and rotation open right here.
        </p>
      )}
    </div>
  );
}
