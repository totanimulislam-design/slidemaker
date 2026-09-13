import type { ThemeSettings } from "../lib/types";
import { NUMBER_STYLES, renderNumberStyle, type NumberStyle } from "../lib/numberStyles";
import { cn } from "../utils/cn";

/** a live-rendered numbering style using the deck's accent colour */
export function NumberStylePreview({
  style,
  theme,
  size = 26,
  number = "7",
}: {
  style: string;
  theme: ThemeSettings;
  size?: number;
  number?: string;
}) {
  const r = renderNumberStyle(style as NumberStyle, theme, size, number);
  if (style === "none") return <span className="text-[10px] text-slate-600">off</span>;
  const w = typeof r.style.width === "number" ? (r.style.width as number) : size;
  return (
    <span className="flex items-center justify-center" style={{ width: size * 1.35, height: size }}>
      <span
        style={{
          ...r.style,
          position: "relative",
          width: w,
          height: r.style.height,
          fontSize: size * r.fontScale,
          color: r.color,
        }}
      >
        {r.content}
        {style === "slash" && (
          <span
            style={{
              position: "absolute",
              right: size * 0.14,
              top: size * 0.08,
              width: Math.max(2, size * 0.05),
              height: size * 0.84,
              background: theme.accent,
              transform: "rotate(22deg)",
              borderRadius: 999,
            }}
          />
        )}
      </span>
    </span>
  );
}

interface Props {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}

export default function NumberStylePicker({ theme, setTheme }: Props) {
  const current = (theme.numberStyle ?? "circle") as NumberStyle;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-5 gap-1.5">
        {NUMBER_STYLES.map((d) => (
          <button
            key={d.id}
            onClick={() => setTheme({ numberStyle: d.id })}
            title={d.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors",
              current === d.id
                ? "border-amber-400 bg-amber-400/15"
                : "border-white/10 bg-white/[0.03] hover:border-white/25",
            )}
          >
            <span className="flex h-7 items-center justify-center">
              <NumberStylePreview style={d.id} theme={theme} size={22} number="7" />
            </span>
            <span className="w-full truncate text-center text-[8px] leading-none text-slate-400">{d.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        {current === "none"
          ? "No numbering mark is drawn. Turn on “Number inside bullet” if you want the number back."
          : "All styles use the deck accent colour (Design ▸ Accent). Pill, banner, ribbon and slashed are wider; Underline and Bar are marks without a number."}
      </p>
    </div>
  );
}
