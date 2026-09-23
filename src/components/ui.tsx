import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "../utils/cn";
import { useColorFrame } from "../lib/frameSend";

/** `#abc` / `#AABBCC` → `#aabbcc`, so browser echoes compare equal; otherwise "" */
const normColor = (v: string): string => {
  const c = String(v ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  return "";
};

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  title,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft" | "success";
  size?: "sm" | "md";
  title?: string;
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary:
      "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_2px_14px_rgba(251,191,36,.35)] font-semibold",
    ghost: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
    soft: "bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 border border-indigo-400/30",
    danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-400/30",
    success:
      "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_2px_14px_rgba(16,185,129,.35)] font-semibold",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * A captioned control. It renders as a `<label>` so clicking the caption focuses
 * the field — but a block whose children are buttons (a picker, a swatch row)
 * must pass `as="div"`: a `<label>` forwards its clicks to its first labelable
 * descendant, which would silently activate that button.
 */
export function Field({
  label,
  hint,
  children,
  as = "label",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  as?: "label" | "div";
}) {
  const inner = (
    <>
      <span className="flex items-baseline justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {hint && <span className="text-[10px] normal-case text-slate-500">{hint}</span>}
      </span>
      {children}
    </>
  );
  return as === "div" ? <div className="block space-y-1.5">{inner}</div> : <label className="block space-y-1.5">{inner}</label>;
}

const base =
  "w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/15";

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(base, props.className)} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(base, "resize-y leading-relaxed", props.className)} />;
}

/**
 * A solid-colour well: the glyph previews the colour, the native picker opens
 * on click.
 *
 * The OS dialog fires an `input` for every move of the cursor, so its commit is
 * routed through `useColorFrame` — one deck write per frame — while only the
 * swatch is painted inside the event. The dialog's own indicator belongs to
 * the compositor; this side never has to render for it, so there is nothing
 * left to fall behind the cursor.
 */
export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  /** the colour the swatch is showing — the committed truth until a drag paints over it */
  const [ui, setUi] = useState<string>(value);
  const swatchRef = useRef<HTMLSpanElement>(null);
  /** the colour we last handed to the editor, so its echo is not read back as an outside change */
  const sentRef = useRef<string>(normColor(value));

  /* paint first (the swatch follows the dialog NOW), commit once per frame */
  const paint = useCallback((hex: string) => {
    const el = swatchRef.current;
    if (el && el.style.background !== hex) el.style.background = hex;
  }, []);
  const channel = useColorFrame(onChange);

  /* an outside change (a preset, an undo, the deck) moves the well — but never
     the echo of what this very input just sent */
  useEffect(() => {
    const nv = normColor(value);
    if (nv === sentRef.current) return;
    sentRef.current = nv;
    setUi(value);
    paint(nv || value);
  }, [value, paint]);

  /* the dialog's own indicator is compositor-owned; our side paints the swatch
     in the event and lets the frame channel decide when the deck hears about it */
  const onInput = useCallback(
    (v: string) => {
      paint(v);
      setUi(v);
      channel.offer(v);
    },
    [paint, channel],
  );
  const readInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = normColor(e.target.value);
      if (v) onInput(v);
    },
    [onInput],
  );

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5">
      <label className="relative flex h-7 w-7 shrink-0 cursor-pointer rounded border border-white/20">
        <span ref={swatchRef} className="absolute inset-0 rounded-sm" style={{ background: ui }} />
        <input
          type="color"
          value={normColor(value) || "#000000"}
          onInput={readInput}
          onChange={readInput}
          className="absolute inset-0 h-7 w-7 cursor-pointer opacity-0"
        />
      </label>
      <span className="truncate text-xs text-slate-300">{label}</span>
    </div>
  );
}

/**
 * A colour picker with three states — `""` (auto: inherit from the deck),
 * `"transparent"` (paint nothing) and a hex colour — so one channel of an
 * element can be restyled without touching the others.
 */
export function ColorField({
  label,
  hint,
  value,
  onChange,
  fallback = "#2f4fff",
  allowNone = false,
  presets = [],
  autoLabel = "Auto",
}: {
  label: string;
  hint?: string;
  /** "" = auto · "transparent" = none · "#rrggbb" */
  value: string;
  onChange: (v: string) => void;
  /** swatch shown while the field is on auto */
  fallback?: string;
  allowNone?: boolean;
  presets?: string[];
  autoLabel?: string;
}) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "";
  const isNone = value === "transparent";
  const [draft, setDraft] = useState<string | null>(null);
  const shown = (draft ?? hex).toUpperCase();
  const swatchRef = useRef<HTMLSpanElement>(null);
  /* the native picker commits through the one-frame channel, like ColorInput */
  const channel = useColorFrame((v: string) => {
    onChange(v);
    setDraft(null);
  });

  const paintSwatch = useCallback((v: string) => {
    const el = swatchRef.current;
    if (el && el.style.background !== v) el.style.background = v;
  }, []);

  const commit = (raw: string) => {
    const v = raw.trim();
    if (!v || v.toLowerCase() === "auto") {
      onChange("");
      setDraft(null);
      return;
    }
    const withHash = v.startsWith("#") ? v : `#${v}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) {
      onChange(withHash.toLowerCase());
      setDraft(null);
    } else {
      setDraft(raw);
    }
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 bg-slate-900/60 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          {hint && <span className="truncate text-[9.5px] normal-case text-slate-500">{hint}</span>}
        </span>
        <span className="flex items-center gap-1">
          {allowNone && (
            <button
              type="button"
              title="Paint nothing here"
              onClick={() => onChange(isNone ? "" : "transparent")}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[9.5px] transition-colors",
                isNone ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/10 text-slate-400 hover:bg-white/10",
              )}
            >
              None
            </button>
          )}
          <button
            type="button"
            title={`Inherit the marker colour (${fallback})`}
            onClick={() => onChange("")}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[9.5px] transition-colors",
              !hex && !isNone ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/10 text-slate-400 hover:bg-white/10",
            )}
          >
            {autoLabel}
          </button>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-white/20">
          <span
            ref={swatchRef}
            className="absolute inset-0"
            style={{
              background: isNone ? "repeating-conic-gradient(#3a3a44 0% 25%, #1c1c22 0% 50%) 50% / 8px 8px" : hex || fallback,
            }}
          />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback}
            onInput={(e) => {
              const v = normColor((e.target as HTMLInputElement).value);
              if (!v) return;
              paintSwatch(v);
              setDraft(v);
              channel.offer(v);
            }}
            onChange={(e) => {
              /* React maps a color input's native `change` to onChange too, so a
                 close is just the newest move — offer it the same way */
              const v = normColor((e.target as HTMLInputElement).value);
              if (!v) return;
              paintSwatch(v);
              setDraft(null);
              channel.offer(v);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            title={hex ? `Custom: ${hex}` : `Auto: ${fallback}`}
          />
        </span>
        <input
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            commit(e.target.value);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          spellCheck={false}
          placeholder={isNone ? "none" : autoLabel.toUpperCase()}
          className="w-[74px] rounded-md border border-white/10 bg-slate-950/70 px-1.5 py-1 text-center font-mono text-[11px] text-slate-200 outline-none focus:border-amber-400/60"
        />
        {presets.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {Array.from(new Set(presets.map((c) => c.toLowerCase()))).map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                className={cn(
                  "rounded border",
                  hex.toLowerCase() === c.toLowerCase() ? "border-amber-300 ring-1 ring-amber-300" : "border-black/40",
                )}
                style={{ background: c, width: 18, height: 18 }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}


export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** accessible name — a bare range input has none of its own */
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-400"
      />
      <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-400">{value}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
    >
      {label}
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-amber-400" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function SegButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-900/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Heading every inspector panel opens with, so the 19 navigation destinations
 * all read the same way: what this panel edits, and what it drives on the slide.
 */
export function PanelHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
