import { cn } from "../../lib/utils";

const tones = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-cyan-50 text-brand-tide border-cyan-200"
};

export function Badge({ className, tone = "neutral", children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
