/**
 * Slim progress meter used for cap / budget headroom on the campaign page.
 * Filled portion changes color as it approaches 100%.
 */
export function Meter({
  label,
  value,
  max,
  format = (n) => n.toLocaleString(),
}: {
  label: string;
  value: number;
  max: number | null | undefined;
  format?: (n: number) => string;
}) {
  if (!max || max <= 0) {
    return (
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-slate-600">{label}</span>
          <span className="text-slate-400">no cap</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded bg-slate-100" />
        <div className="mt-1 text-xs text-slate-500">
          {format(value)} so far
        </div>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((value / max) * 100));
  const tone =
    pct >= 100
      ? "bg-rose-500"
      : pct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-500">
          {format(value)} / {format(max)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
