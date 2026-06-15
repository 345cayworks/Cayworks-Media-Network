import Link from "next/link";
import { requireUser, getSessionUser, ADMIN_ROLES } from "@/lib/auth";
import { dashboardStats, dailyCounts, buildReport } from "@/lib/reporting";
import { prisma } from "@/lib/prisma";
import {
  Stat,
  PageHeader,
  Badge,
  EmptyState,
  SectionTitle,
} from "@/components/ui";
import { HBar, ColumnChart } from "@/components/Chart";
import { setPlatformStatus } from "./platforms/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const sessionUser = await getSessionUser();
  const canToggle = !!sessionUser && ADMIN_ROLES.includes(sessionUser.role);

  const since7 = new Date();
  since7.setUTCDate(since7.getUTCDate() - 7);

  const [s, platforms, daily, topCampaigns, lastImpsByPlatform] = await Promise.all([
    dashboardStats({}),
    prisma.platform.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { placements: true } } },
    }),
    dailyCounts(14),
    buildReport("campaign", { from: since7 }),
    prisma.adImpression.groupBy({
      by: ["platformId"],
      _max: { createdAt: true },
    }),
  ]);
  const lastImp = new Map<string, Date>();
  for (const r of lastImpsByPlatform) {
    if (r.platformId && r._max.createdAt)
      lastImp.set(r.platformId, r._max.createdAt);
  }
  function fmtAgo(d: Date | undefined): string {
    if (!d) return "no impressions yet";
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }

  const top5 = topCampaigns.slice(0, 5).map((r) => ({
    label: r.label,
    value: r.impressions,
    sub: `${r.ctr.toFixed(1)}% CTR`,
  }));

  return (
    <div>
      <PageHeader
        title="Superadmin Dashboard"
        subtitle="Network-wide advertising performance at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Advertisers" value={s.advertisers} accent="brand" />
        <Stat label="Active Campaigns" value={s.activeCampaigns} accent="emerald" />
        <Stat
          label="Monthly Revenue"
          value={`$${s.monthlyRevenue.toLocaleString()}`}
          hint="Paid invoices, current month"
          accent="emerald"
        />
        <Stat
          label="Impressions"
          value={s.impressions.toLocaleString()}
          accent="brand"
        />
        <Stat
          label="Clicks"
          value={s.clicks.toLocaleString()}
          accent="brand"
        />
        <Stat label="CTR" value={`${s.ctr.toFixed(2)}%`} accent="brand" />
        <Link href="/admin/approvals" className="block">
          <Stat
            label="Pending Approvals"
            value={s.pendingCreatives}
            hint={
              s.pendingCreatives > 0
                ? "Open the inbox →"
                : "All caught up"
            }
            accent={s.pendingCreatives > 0 ? "amber" : "slate"}
          />
        </Link>
        <Stat
          label="Expiring (14d)"
          value={s.expiring.length}
          accent={s.expiring.length > 0 ? "rose" : "slate"}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <SectionTitle
            title="Last 14 days"
            hint="Daily impressions (blue) and clicks (grey)"
          />
          <ColumnChart
            data={daily.map((d) => ({
              label: d.date,
              value: d.impressions,
              secondary: d.clicks,
            }))}
            secondaryKey="secondary"
            height={140}
          />
        </div>
        <div className="card p-4">
          <SectionTitle
            title="Top campaigns · 7d"
            hint="By impressions"
          />
          <HBar
            data={top5}
            emptyText="No traffic in the last 7 days yet."
          />
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Connected Platforms
          </h2>
          <Link
            href="/admin/platforms"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Manage →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((p) => {
            const next = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            const last = lastImp.get(p.id);
            const stale =
              last && Date.now() - last.getTime() > 7 * 24 * 3600 * 1000;
            const tone =
              p.status !== "ACTIVE"
                ? { dot: "bg-slate-400", text: "Off" }
                : !last
                  ? { dot: "bg-amber-500", text: "Active · no serves yet" }
                  : stale
                    ? { dot: "bg-amber-500", text: `Active · last ${fmtAgo(last)}` }
                    : { dot: "bg-emerald-500", text: `Live · last ${fmtAgo(last)}` };
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/platforms/${p.id}`}
                      className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-600"
                    >
                      {p.name}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-400">
                      {p.slug}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {p._count.placements} placements
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  {tone.text}
                </div>
                {canToggle && (
                  <form
                    action={setPlatformStatus.bind(null, p.id, next)}
                    className="mt-3"
                  >
                    <button
                      type="submit"
                      className={
                        p.status === "ACTIVE" ? "btn-danger" : "btn-primary"
                      }
                    >
                      {p.status === "ACTIVE" ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 card">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Expiring Campaigns (next 14 days)
        </div>
        {s.expiring.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No campaigns expiring soon." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Campaign</th>
                <th className="th">Advertiser</th>
                <th className="th">Ends</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {s.expiring.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td">{c.advertiser.businessName}</td>
                  <td className="td">
                    {c.endDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="td text-right">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
