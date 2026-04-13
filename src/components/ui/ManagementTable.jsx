import { Card, CardHeader } from "./Card";
import { cn } from "../../lib/utils";

const toneClasses = {
  default: "border-line/70 bg-white text-muted hover:border-brand-sky/30 hover:text-ink",
  danger: "border-red-200 bg-red-50 text-brand-coral hover:border-red-300 hover:text-red-700"
};

export function ManagementActionButton({
  label,
  onClick,
  children,
  tone = "default",
  disabled = false
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition",
        toneClasses[tone] || toneClasses.default,
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

export function ManagementTable({
  eyebrow,
  title,
  description,
  columns,
  rows,
  selectedRowId,
  onRowSelect,
  renderActions,
  emptyTitle = "No records found",
  emptyDescription = "Try a different filter or add a new record.",
  toolbar,
  className
}) {
  const visibleColumnCount = columns.length + (renderActions ? 1 : 0);

  return (
    <Card className={cn("overflow-hidden shadow-elevated", className)}>
      <CardHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={toolbar}
      />
      <div className="-mx-6 overflow-x-auto px-6 pb-1">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-line/70 px-4 pb-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted",
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
              {renderActions ? (
                <th className="border-b border-line/70 px-4 pb-3 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const rowId = row.id;
                const selected = selectedRowId === rowId;

                return (
                  <tr
                    key={rowId}
                    role={onRowSelect ? "button" : undefined}
                    tabIndex={onRowSelect ? 0 : undefined}
                    onClick={onRowSelect ? () => onRowSelect(rowId) : undefined}
                    onKeyDown={
                      onRowSelect
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowSelect(rowId);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "group outline-none",
                      onRowSelect && "cursor-pointer"
                    )}
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-b border-line/60 px-4 py-4 align-top text-sm text-ink transition",
                          selected ? "bg-brand-mint/65" : "bg-white group-hover:bg-slate-50",
                          index === 0 && selected ? "rounded-l-3xl" : "",
                          column.cellClassName
                        )}
                      >
                        {column.render(row, selected)}
                      </td>
                    ))}
                    {renderActions ? (
                      <td
                        className={cn(
                          "border-b border-line/60 px-4 py-4 align-top text-right transition",
                          selected ? "rounded-r-3xl bg-brand-mint/65" : "bg-white group-hover:bg-slate-50"
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          {renderActions(row)}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-14 text-center">
                  <div className="rounded-[28px] border border-dashed border-line bg-surface-2 px-6 py-10">
                    <div className="text-base font-semibold text-ink">{emptyTitle}</div>
                    <div className="mt-2 text-sm leading-6 text-muted">{emptyDescription}</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
