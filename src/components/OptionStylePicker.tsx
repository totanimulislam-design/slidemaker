import { useMemo } from "react";
import type { ThemeSettings } from "../lib/types";
import { OPTION_STYLES, optionBadgeStyle, optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import { cn } from "../utils/cn";

const KEYS = ["ক", "খ", "গ", "ঘ"];

/** A miniature option row rendered with the real style + colours. */
export function OptionStylePreview({
  style,
  theme,
  color,
  scale = 0.42,
  index = 0,
  correct = false,
}: {
  style: string;
  theme: ThemeSettings;
  color: string;
  scale?: number;
  index?: number;
  correct?: boolean;
}) {
  const id = style as OptionStyle;
  const chrome = optionRowStyle(id, theme, color, correct);
  const fs = Math.round(30 * scale);
  const circle = Math.round(fs * 1.45);
  return (
    <div
      style={{
        ...chrome.row,
        gap: Math.round(24 * scale),
        padding: `${Math.round(10 * scale)}px ${Math.round(24 * scale)}px`,
        width: "100%",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          ...optionBadgeStyle(id, theme, color, circle, correct),
          width: circle,
          height: circle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: Math.round(fs * 0.7),
          lineHeight: 1,
          flex: "0 0 auto",
        }}
      >
        {KEYS[index % KEYS.length]}
      </span>
      <span
        style={{
          color: correct ? "#5cff9d" : theme.optionTextColor,
          fontSize: fs,
          fontWeight: 700,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {index % 2 === 0 ? "Option" : "Answer"}
      </span>
    </div>
  );
}

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

const SWATCHES = ["#2f4fff", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#ffffff"];

export default function OptionStylePicker({ theme, setTheme }: Props) {
  const current = (theme.optionStyle ?? "plain") as OptionStyle;
  const color = theme.optionAccent || theme.accent;
  const styles = useMemo(() => OPTION_STYLES, []);

  return (
    <div className="space-y-3">
      {/* colour */}
      <Field2 label="Option colour">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2f4fff"}
            onChange={(e) => setTheme({ optionAccent: e.target.value })}
            className="h-7 w-8 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
          <div className="flex flex-wrap gap-1">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setTheme({ optionAccent: c })}
                title={c}
                className={cn(
                  "h-5 w-5 rounded border",
                  color.toLowerCase() === c.toLowerCase() ? "border-amber-300 ring-1 ring-amber-300" : "border-black/40",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            onClick={() => setTheme({ optionAccent: theme.accent })}
            className="ml-auto shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10"
            title="Use the deck accent colour"
          >
            match accent
          </button>
        </div>
      </Field2>

      {/* live preview */}
      <div className="overflow-hidden rounded-xl border border-white/10 p-2" style={{ background: theme.board }}>
        <OptionStylePreview style={current} theme={theme} color={color} index={0} />
        <div className="mt-1.5">
          <OptionStylePreview style={current} theme={theme} color={color} index={1} />
        </div>
      </div>

      {/* grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {styles.map((d) => (
          <button
            key={d.id}
            onClick={() => setTheme({ optionStyle: d.id })}
            title={d.label}
            className={cn(
              "flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-1 transition-colors",
              current === d.id ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-white/[0.03] hover:border-white/25",
            )}
          >
            <span className="flex w-full justify-center">
              <OptionStylePreview style={d.id} theme={theme} color={color} scale={0.2} index={0} />
            </span>
            <span className="w-full truncate text-center text-[8px] leading-none text-slate-400">{d.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        The colour drives the row background, borders and the letter badge. When the answer is revealed, the correct
        option is highlighted on top of the chosen style.
      </p>
    </div>
  );
}

/* tiny local Field so the preview label matches the design system */
function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{label}</span>
      {children}
    </div>
  );
}
