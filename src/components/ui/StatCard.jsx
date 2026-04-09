import { cn } from "../../lib/utils";

export function StatCard({ label, value, tone = "default", className }) {
  const toneClass =
    tone === "accent"
      ? "bg-brand-midnight text-white"
      : tone === "soft"
        ? "bg-brand-mint text-brand-midnight"
        : "bg-white/80 text-ink";

  return (
    <div className={cn("rounded-[24px] border border-white/60 p-5 shadow-soft", toneClass, className)}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
