import Link from "next/link";
import { clsx } from "@/lib/clsx";

export type SortDir = "asc" | "desc";

function buildHref(
  basePath: string,
  k: string,
  nextDir: SortDir,
  preserve?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (preserve) {
    for (const [key, value] of Object.entries(preserve)) {
      if (value && key !== "sort" && key !== "dir") params.set(key, value);
    }
  }
  params.set("sort", k);
  params.set("dir", nextDir);
  return `${basePath}?${params.toString()}`;
}

/**
 * Sortable column header. Wraps the link in a `<th>` by default; set
 * `inline` when rendering inside an already-styled `<th>` (e.g. right-aligned).
 */
export function SortHeader({
  label,
  k,
  current,
  dir,
  basePath,
  preserve,
  inline = false,
  className,
}: {
  label: string;
  k: string;
  current: string;
  dir: SortDir;
  basePath: string;
  preserve?: Record<string, string | undefined>;
  inline?: boolean;
  className?: string;
}) {
  const active = current === k;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";
  const link = (
    <Link
      href={buildHref(basePath, k, nextDir, preserve)}
      className={clsx(
        "inline-flex items-center gap-1",
        active ? "text-brand-600" : "hover:text-slate-700",
        className,
      )}
    >
      {label}
      <span className="text-[10px]">{arrow}</span>
    </Link>
  );
  return inline ? link : <th className="th">{link}</th>;
}
