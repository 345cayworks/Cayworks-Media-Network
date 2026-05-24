import { clsx } from "@/lib/clsx";

/**
 * Horizontal bar chart. Pure CSS/HTML — no dep, no SVG, accessible and prints
 * cleanly. Bars are sized proportional to the largest value.
 */
export function HBar({
  data,
  format = (n) => n.toLocaleString(),
  emptyText = "No data",
  className,
}: {
  data: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  emptyText?: string;
  className?: string;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-slate-400">{emptyText}</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={clsx("space-y-2", className)}>
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-44 truncate text-xs font-medium text-slate-700">
              {d.label}
              {d.sub && (
                <span className="ml-1 text-slate-400">· {d.sub}</span>
              )}
            </div>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-brand-500 to-brand-600"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-20 text-right text-xs font-semibold tabular-nums text-slate-700">
              {format(d.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact column-bar chart (one bar per bucket). Sized to fill its container.
 * Optionally renders a second muted series stacked behind the primary one.
 */
export function ColumnChart({
  data,
  primaryKey = "value",
  secondaryKey,
  height = 120,
  formatLabel = (d) => d.label.slice(5), // "MM-DD"
  className,
}: {
  data: Array<{ label: string; value: number; secondary?: number }>;
  primaryKey?: "value";
  secondaryKey?: "secondary";
  height?: number;
  formatLabel?: (d: { label: string }) => string;
  className?: string;
}) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.value, d.secondary ?? 0)),
  );
  return (
    <div className={className}>
      <div
        className="flex items-end gap-1"
        style={{ height }}
      >
        {data.map((d) => {
          const h = (d.value / max) * 100;
          const h2 = ((d.secondary ?? 0) / max) * 100;
          return (
            <div
              key={d.label}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${d.label}: ${d.value.toLocaleString()}${
                secondaryKey ? ` · ${d.secondary?.toLocaleString() ?? 0}` : ""
              }`}
            >
              <div className="relative w-full" style={{ height: "100%" }}>
                {secondaryKey && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t bg-slate-200"
                    style={{ height: `${h2}%` }}
                  />
                )}
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-b from-brand-500 to-brand-600 transition-opacity group-hover:opacity-90"
                  style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-center text-[9px] text-slate-400"
          >
            {formatLabel(d)}
          </div>
        ))}
      </div>
    </div>
  );
}
