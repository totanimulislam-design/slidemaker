import { useMemo } from "react";
import type { ThemeSettings } from "../lib/types";
import { OPTION_STYLES, optionRowStyle, type OptionStyle } from "../lib/optionStyles";
import OptionBulletMarker from "./OptionBulletMarker";
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
      <OptionBulletMarker
        theme={theme}
        color={color}
        size={circle}
        keyText={KEYS[index % KEYS.length]}
        highlight={correct}
        optionStyle={id}
        style={{ fontSize: Math.round(fs * 0.7) }}
      />
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

export default function OptionStylePicker({ theme, setTheme }: Props) {
  const current = (theme.optionStyle ?? "plain") as OptionStyle;
  const color = theme.optionAccent || theme.accent;
  const styles = useMemo(() => OPTION_STYLES, []);

  return (
    <div className="space-y-3">
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
    </div>
  );
}
