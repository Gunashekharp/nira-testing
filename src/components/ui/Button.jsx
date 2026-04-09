import { cloneElement, isValidElement } from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "bg-brand-midnight text-white shadow-soft hover:bg-brand-tide focus-visible:ring-slate-900/20",
  secondary:
    "bg-white/80 text-ink hover:bg-white focus-visible:ring-cyan-200",
  ghost:
    "bg-transparent text-brand-midnight hover:bg-slate-900/5 focus-visible:ring-slate-900/20",
  accent:
    "bg-brand-amber text-brand-midnight hover:opacity-95 focus-visible:ring-amber-200"
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
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
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
