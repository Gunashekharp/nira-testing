import { cloneElement, isValidElement } from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "bg-brand-midnight text-white shadow-md hover:shadow-lg hover:bg-[#0e3a4f] active:scale-[0.98] focus-visible:ring-slate-900/20",
  secondary:
    "bg-white text-ink border border-line/50 shadow-sm hover:bg-surface hover:shadow-md active:scale-[0.98] focus-visible:ring-cyan-200",
  ghost:
    "bg-transparent text-brand-midnight hover:bg-brand-mint/50 active:scale-[0.98] focus-visible:ring-slate-900/20",
  accent:
    "bg-gradient-to-r from-brand-sky to-brand-tide text-white shadow-md hover:shadow-glow active:scale-[0.98] focus-visible:ring-cyan-200",
  danger:
    "bg-brand-coral text-white shadow-sm hover:bg-red-600 active:scale-[0.98] focus-visible:ring-red-200"
};

const sizes = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  children,
  ...props
}) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:drop-shadow-sm",
    variants[variant],
    sizes[size],
    className
  );

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      ...props,
      className: cn(classes, children.props.className)
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
