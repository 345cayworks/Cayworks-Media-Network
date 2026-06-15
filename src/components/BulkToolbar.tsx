import { SelectAll } from "@/components/SelectAll";

/**
 * Sticky bottom toolbar used by the bulk-action list pages. Wraps the
 * shared styling (sticky/blur/card) and a Select-all checkbox bound to a
 * given checkbox `name`; callers compose the action buttons themselves so
 * they stay grep-able at the call site.
 */
export function BulkToolbar({
  selectName,
  hint = "Bulk actions apply to every ticked row.",
  children,
}: {
  selectName: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-md backdrop-blur">
      <SelectAll name={selectName} />
      <span className="mr-auto text-xs text-slate-500">{hint}</span>
      {children}
    </div>
  );
}
