import Link from "next/link";

/**
 * Segmented chip filter with an "All" reset. The active chip is the one
 * matching `active`; clicking any chip navigates to `basePath` with the
 * param set, preserving any other params from `preserve`.
 */
export function FilterChips({
  label,
  name,
  basePath,
  items,
  active,
  preserve,
}: {
  label?: string;
  name: string;
  basePath: string;
  items: readonly { value: string; label?: string }[];
  active: string | undefined;
  preserve?: Record<string, string | undefined>;
}) {
  function href(value?: string): string {
    const p = new URLSearchParams();
    if (preserve) {
      for (const [k, v] of Object.entries(preserve)) {
        if (v && k !== name) p.set(k, v);
      }
    }
    if (value) p.set(name, value);
    return p.toString() ? `${basePath}?${p.toString()}` : basePath;
  }
  function chipClass(isActive: boolean): string {
    return isActive
      ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
      : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100";
  }
  return (
    <div className="flex items-end gap-2">
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1">
        <Link href={href(undefined)} className={chipClass(!active)}>
          All
        </Link>
        {items.map((it) => (
          <Link
            key={it.value}
            href={href(it.value)}
            className={chipClass(active === it.value)}
          >
            {it.label ?? it.value}
          </Link>
        ))}
      </div>
    </div>
  );
}
