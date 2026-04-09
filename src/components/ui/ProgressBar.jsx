import { cn } from "../../lib/utils";

export function ProgressBar({ value, className }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-900/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-sky via-brand-tide to-brand-midnight transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
