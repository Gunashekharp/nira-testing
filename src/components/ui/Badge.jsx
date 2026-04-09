import { cn } from "../../lib/utils";

const tones = {
  neutral: "bg-slate-900/5 text-brand-midnight border-slate-900/10",
  success: "bg-emerald-100 text-emerald-900 border-emerald-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  danger: "bg-rose-100 text-rose-900 border-rose-200",
  info: "bg-sky-100 text-sky-900 border-sky-200"
};

export function Badge({ className, tone = "neutral", children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
