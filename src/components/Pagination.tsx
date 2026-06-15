import Link from "next/link";

/**
 * URL-driven pagination footer. Reads `page` and `pageSize` query params
 * (1-indexed page); other current params are preserved across navigation
 * via `preserve`. Renders Prev / Next + a "Page X of Y" label + a page-size
 * picker. Hides itself when there's only one page and pageSize is default.
 */
export function Pagination({
  total,
  page,
  pageSize,
  basePath,
  preserve,
  pageSizes = [10, 25, 50, 100],
}: {
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  preserve?: Record<string, string | undefined>;
  pageSizes?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), totalPages);

  function href(p: number, ps?: number): string {
    const params = new URLSearchParams();
    if (preserve) {
      for (const [k, v] of Object.entries(preserve)) {
        if (v && k !== "page" && k !== "pageSize") params.set(k, v);
      }
    }
    if (p > 1) params.set("page", String(p));
    if (ps && ps !== 25) params.set("pageSize", String(ps));
    return params.toString() ? `${basePath}?${params.toString()}` : basePath;
  }

  const start = (clamped - 1) * pageSize + 1;
  const end = Math.min(total, clamped * pageSize);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <span>
        {total === 0
          ? "0 results"
          : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
      </span>
      <div className="flex items-center gap-2">
        <span>Per page:</span>
        <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          {pageSizes.map((n) => (
            <Link
              key={n}
              href={href(1, n)}
              className={
                pageSize === n
                  ? "rounded px-2 py-0.5 text-xs font-medium bg-brand-500 text-white"
                  : "rounded px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              {n}
            </Link>
          ))}
        </div>
        <Link
          href={href(clamped - 1, pageSize)}
          aria-disabled={clamped === 1}
          className={
            clamped === 1
              ? "pointer-events-none rounded border border-slate-200 px-2 py-1 text-slate-300"
              : "rounded border border-slate-200 px-2 py-1 hover:bg-slate-100"
          }
        >
          ← Prev
        </Link>
        <span className="tabular-nums">
          Page {clamped} of {totalPages}
        </span>
        <Link
          href={href(clamped + 1, pageSize)}
          aria-disabled={clamped >= totalPages}
          className={
            clamped >= totalPages
              ? "pointer-events-none rounded border border-slate-200 px-2 py-1 text-slate-300"
              : "rounded border border-slate-200 px-2 py-1 hover:bg-slate-100"
          }
        >
          Next →
        </Link>
      </div>
    </div>
  );
}

/** Tiny helper to read + clamp page/pageSize from searchParams. */
export function readPaging(
  searchParams: Record<string, string | undefined>,
  defaultPageSize = 25,
  max = 200,
): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    max,
    Math.max(1, parseInt(searchParams.pageSize ?? String(defaultPageSize), 10) || defaultPageSize),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
