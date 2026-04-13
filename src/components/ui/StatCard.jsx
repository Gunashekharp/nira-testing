import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

const densityClassMap = {
  compact: "p-3",
  balanced: "p-4",
  comfy: "p-5"
};

export function StatCard({
  label,
  value,
  tone = "default",
  density = "balanced",
  className,
  to,
  href,
  onClick,
  active = false,
  title
}) {
  const toneClass =
    tone === "accent"
      ? "bg-gradient-to-br from-brand-midnight to-[#2d3a65] text-white border-brand-sky/20"
      : tone === "soft"
        ? "bg-brand-mint/60 text-brand-midnight border-brand-sky/20"
        : "bg-white/90 text-ink border-line/50";

  const interactive = Boolean(to || href || onClick);
  const cardClassName = cn(
    "stat-glow block w-full rounded-xl border text-left",
    densityClassMap[density] || densityClassMap.balanced,
    toneClass,
    interactive
      ? "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/40"
      : "",
    active ? "ring-2 ring-brand-sky/40 ring-offset-2 ring-offset-transparent" : "",
    className
  );

  const content = (
    <>
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-tight">{value}</div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cardClassName} title={title || label}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={cardClassName} title={title || label}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName} title={title || label}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
