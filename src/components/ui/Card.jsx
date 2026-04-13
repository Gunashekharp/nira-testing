import { cn } from "../../lib/utils";

const densityClassMap = {
  compact: "p-4",
  balanced: "p-5",
  comfy: "p-6"
};

const variantClassMap = {
  default: "glass-card",
  gradientElevated: "glass-card glass-card-gradient shadow-elevated"
};

export function Card({ className, children, density = "balanced", variant = "default", ...props }) {
  return (
    <div
      {...props}
      className={cn(
        variantClassMap[variant] || variantClassMap.default,
        densityClassMap[density] || densityClassMap.balanced,
        "transition-shadow duration-300 hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        {eyebrow ? <div className="section-title">{eyebrow}</div> : null}
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardContent({ className, children }) {
  return <div className={cn(className)}>{children}</div>;
}
