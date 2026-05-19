import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: { approval?: string };
}) {
  await requireUser();
  const where =
    searchParams.approval === "PENDING"
      ? { approvalStatus: "PENDING" as const }
      : {};
  const creatives = await prisma.creative.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        select: { name: true, advertiser: { select: { businessName: true } } },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Creatives"
        subtitle="Review, approve and manage ad creatives."
        action={
          <div className="flex gap-2">
            <LinkButton href="/admin/creatives?approval=PENDING" variant="secondary">
              Pending only
            </LinkButton>
            <LinkButton href="/admin/creatives/new">New Creative</LinkButton>
          </div>
        }
      />
      {creatives.length === 0 ? (
        <EmptyState message="No creatives found." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Title</th>
                <th className="th">Campaign</th>
                <th className="th">Advertiser</th>
                <th className="th">Type</th>
                <th className="th">Approval</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {creatives.map((cr) => (
                <tr key={cr.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="td font-medium">
                    <Link
                      href={`/admin/creatives/${cr.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {cr.title}
                    </Link>
                  </td>
                  <td className="td">{cr.campaign.name}</td>
                  <td className="td">{cr.campaign.advertiser.businessName}</td>
                  <td className="td">{cr.creativeType}</td>
                  <td className="td">
                    <Badge value={cr.approvalStatus} />
                  </td>
                  <td className="td">
                    <Badge value={cr.status} />
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
