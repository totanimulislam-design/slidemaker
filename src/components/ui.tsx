import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";

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

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {hint && <span className="text-[10px] normal-case text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const base =
  "w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/15";

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(base, props.className)} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(base, "resize-y leading-relaxed", props.className)} />;
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0"
      />
      <span className="truncate text-xs text-slate-300">{label}</span>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
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
