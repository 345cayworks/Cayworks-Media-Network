import Link from "next/link";

/**
 * URL-driven search input with a Clear button. Submits as a GET form so
 * other current params (sort/dir/state/filters) are preserved via hidden
 * inputs derived from `preserve`. The `name` and `page` keys are not
 * propagated (search resets to page 1).
 */
export function SearchInput({
  basePath,
  name = "q",
  defaultValue = "",
  placeholder,
  label = "Search",
  preserve,
  className,
}: {
  basePath: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  preserve?: Record<string, string | undefined>;
  className?: string;
}) {
  const trimmed = defaultValue.trim();
  const hidden: { k: string; v: string }[] = [];
  if (preserve) {
    for (const [k, v] of Object.entries(preserve)) {
      if (v && k !== name && k !== "page") hidden.push({ k, v });
    }
  }
  const clearHref = (() => {
    const p = new URLSearchParams();
    for (const h of hidden) p.set(h.k, h.v);
    return p.toString() ? `${basePath}?${p.toString()}` : basePath;
  })();

  return (
    <form
      className={`flex flex-1 min-w-[220px] items-end gap-2 ${className ?? ""}`}
      method="get"
      action={basePath}
    >
      {hidden.map((h) => (
        <input key={h.k} type="hidden" name={h.k} value={h.v} />
      ))}
      <div className="flex-1">
        <label className="label" htmlFor={`${name}-input`}>
          {label}
        </label>
        <input
          id={`${name}-input`}
          name={name}
          type="search"
          defaultValue={trimmed}
          placeholder={placeholder}
          className="input"
        />
      </div>
      <button type="submit" className="btn-secondary">
        Search
      </button>
      {trimmed && (
        <Link href={clearHref} className="btn-secondary">
          Clear
        </Link>
      )}
    </form>
  );
}
