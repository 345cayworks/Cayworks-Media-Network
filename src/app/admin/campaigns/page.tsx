import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireUser();
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      advertiser: { select: { businessName: true } },
      _count: { select: { creatives: true, campaignPlacements: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Plan flights, pricing, priority and placement assignments."
        action={<LinkButton href="/admin/campaigns/new">New Campaign</LinkButton>}
      />
      {campaigns.length === 0 ? (
        <EmptyState message="No campaigns yet." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Campaign</th>
                <th className="th">Advertiser</th>
                <th className="th">Flight</th>
                <th className="th">Pricing</th>
                <th className="th">Prio</th>
                <th className="th">Creatives</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="td font-medium">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="td">{c.advertiser.businessName}</td>
                  <td className="td whitespace-nowrap text-xs">
                    {c.startDate.toISOString().slice(0, 10)} →{" "}
                    {c.endDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="td">{c.pricingModel}</td>
                  <td className="td">{c.priority}</td>
                  <td className="td">{c._count.creatives}</td>
                  <td className="td">
                    <Badge value={c.status} />
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
