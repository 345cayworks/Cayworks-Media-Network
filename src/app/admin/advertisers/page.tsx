import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
  await requireUser();
  const advertisers = await prisma.advertiser.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Advertisers"
        subtitle="Manage advertiser accounts and their campaigns."
        action={
          <LinkButton href="/admin/advertisers/new">New Advertiser</LinkButton>
        }
      />
      {advertisers.length === 0 ? (
        <EmptyState message="No advertisers yet. Create your first advertiser." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Business</th>
                <th className="th">Contact</th>
                <th className="th">Industry</th>
                <th className="th">Campaigns</th>
                <th className="th">Billing</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {advertisers.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="td font-medium">
                    <Link
                      href={`/admin/advertisers/${a.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {a.businessName}
                    </Link>
                  </td>
                  <td className="td">
                    {a.contactName}
                    <div className="text-xs text-slate-400">{a.email}</div>
                  </td>
                  <td className="td">{a.industry ?? "—"}</td>
                  <td className="td">{a._count.campaigns}</td>
                  <td className="td">
                    <Badge value={a.billingStatus} />
                  </td>
                  <td className="td">
                    <Badge value={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
