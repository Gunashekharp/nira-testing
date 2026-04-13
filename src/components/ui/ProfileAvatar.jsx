import { cn, initials } from "../../lib/utils";

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-3xl"
};

const toneClasses = {
  soft: "bg-brand-mint text-brand-midnight",
  solid: "bg-brand-midnight text-white"
};

export function ProfileAvatar({
  name,
  photo,
  size = "md",
  tone = "solid",
  className,
  imageClassName
}) {
  const label = name?.trim() || "User";
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const toneClass = toneClasses[tone] || toneClasses.solid;

  if (photo) {
    return (
      <div className={cn("overflow-hidden rounded-full bg-slate-200", sizeClass, className)}>
        <img
          src={photo}
          alt={`${label} profile`}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold uppercase",
        sizeClass,
        toneClass,
        className
      )}
      aria-label={`${label} avatar`}
    >
      {initials(label) || "U"}
    </div>
  );
}
