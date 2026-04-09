import { cn } from "../../lib/utils";

export function Card({ className, children }) {
  return <div className={cn("glass-card p-6", className)}>{children}</div>;
}

export function CardHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? <div className="section-title">{eyebrow}</div> : null}
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
