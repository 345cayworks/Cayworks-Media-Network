import Link from "next/link";
import { requireRole, REPORT_ROLES } from "@/lib/auth";
import { buildReport, type DateRange } from "@/lib/reporting";
import { PageHeader, EmptyState, SectionTitle } from "@/components/ui";
import { HBar } from "@/components/Chart";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "campaign", label: "By Campaign" },
  { key: "advertiser", label: "By Advertiser" },
  { key: "platform", label: "By Platform" },
  { key: "placement", label: "By Placement" },
] as const;

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: { groupBy?: string; from?: string; to?: string };
}) {
  await requireRole(REPORT_ROLES);

  const dim = (TABS.find((t) => t.key === searchParams.groupBy)?.key ??
    "campaign") as "campaign" | "advertiser" | "platform" | "placement";

  const range: DateRange = {};
  if (searchParams.from && !Number.isNaN(Date.parse(searchParams.from)))
    range.from = new Date(searchParams.from);
  if (searchParams.to && !Number.isNaN(Date.parse(searchParams.to)))
    range.to = new Date(searchParams.to);

  const rows = await buildReport(dim, range);

  const qs = new URLSearchParams();
  qs.set("groupBy", dim);
  if (searchParams.from) qs.set("from", searchParams.from);
  if (searchParams.to) qs.set("to", searchParams.to);
  const csvHref = `/api/ads/reporting?${qs.toString()}&format=csv`;

  return (
    <div>
      <PageHeader
        title="Reporting"
        subtitle="Impressions, clicks, CTR and conversions."
        action={
          <a className="btn-primary" href={csvHref}>
            Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {TABS.map((t) => {
            const p = new URLSearchParams(searchParams as Record<string, string>);
            p.set("groupBy", t.key);
            return (
              <Link
                key={t.key}
                href={`/admin/reporting?${p.toString()}`}
                className={
                  t.key === dim
                    ? "rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Quick date-range presets — set from/to via a plain link.
            Custom range still lives in the form just below. */}
        {(() => {
          const today = new Date();
          const fmt = (d: Date) => d.toISOString().slice(0, 10);
          const days = (n: number) => {
            const d = new Date(today);
            d.setUTCDate(d.getUTCDate() - n);
            return d;
          };
          const monthStart = new Date(
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
          );
          const presets: { label: string; from?: string; to?: string }[] = [
            { label: "All time" },
            { label: "Today", from: fmt(today), to: fmt(today) },
            { label: "Last 7d", from: fmt(days(6)), to: fmt(today) },
            { label: "Last 30d", from: fmt(days(29)), to: fmt(today) },
            { label: "This month", from: fmt(monthStart), to: fmt(today) },
          ];
          return (
            <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
              {presets.map((p) => {
                const params = new URLSearchParams();
                params.set("groupBy", dim);
                if (p.from) params.set("from", p.from);
                if (p.to) params.set("to", p.to);
                const active =
                  (p.from ?? "") === (searchParams.from ?? "") &&
                  (p.to ?? "") === (searchParams.to ?? "");
                return (
                  <Link
                    key={p.label}
                    href={`/admin/reporting?${params.toString()}`}
                    className={
                      active
                        ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
                        : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    }
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
          );
        })()}

        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name="groupBy" value={dim} />
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={searchParams.from}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={searchParams.to}
              className="input"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Apply
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No data for the selected range." />
      ) : (
        <>
          <div className="card mb-4 p-4">
            <SectionTitle
              title="Impressions"
              hint={`Top ${Math.min(10, rows.length)} ${
                TABS.find((t) => t.key === dim)?.label.toLowerCase() ?? ""
              }`}
            />
            <HBar
              data={rows.slice(0, 10).map((r) => ({
                label: r.label,
                value: r.impressions,
                sub: `${r.ctr.toFixed(1)}% CTR`,
              }))}
            />
          </div>
          <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">{TABS.find((t) => t.key === dim)?.label}</th>
                <th className="th text-right">Impressions</th>
                <th className="th text-right">Clicks</th>
                <th className="th text-right">CTR</th>
                <th className="th text-right">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50">
                  <td className="td font-medium">{r.label}</td>
                  <td className="td text-right">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="td text-right">
                    {r.clicks.toLocaleString()}
                  </td>
                  <td className="td text-right">{r.ctr.toFixed(2)}%</td>
                  <td className="td text-right">{r.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
