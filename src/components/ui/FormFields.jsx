import { cn } from "../../lib/utils";

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

const baseControl =
  "w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink shadow-soft outline-none transition focus:border-brand-sky focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none";

export function Input(props) {
  const { className, ...rest } = props;
  return <input className={cn(baseControl, className)} {...rest} />;
}

export function Select(props) {
  const { className, ...rest } = props;
  return <select className={cn(baseControl, className)} {...rest} />;
}

export function Textarea(props) {
  const { className, ...rest } = props;
  return <textarea className={cn(baseControl, "min-h-28 resize-y", className)} {...rest} />;
}
