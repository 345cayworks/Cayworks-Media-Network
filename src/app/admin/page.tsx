import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboardStats } from "@/lib/reporting";
import { Stat, PageHeader, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const s = await dashboardStats({});

  return (
    <div>
      <PageHeader
        title="Superadmin Dashboard"
        subtitle="Network-wide advertising performance at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Advertisers" value={s.advertisers} />
        <Stat label="Active Campaigns" value={s.activeCampaigns} />
        <Stat
          label="Monthly Revenue"
          value={`$${s.monthlyRevenue.toLocaleString()}`}
          hint="Paid invoices, current month"
        />
        <Stat label="Impressions" value={s.impressions.toLocaleString()} />
        <Stat label="Clicks" value={s.clicks.toLocaleString()} />
        <Stat label="CTR" value={`${s.ctr.toFixed(2)}%`} />
        <Stat
          label="Pending Creatives"
          value={s.pendingCreatives}
          hint="Awaiting approval"
        />
        <Stat label="Expiring (14d)" value={s.expiring.length} />
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
