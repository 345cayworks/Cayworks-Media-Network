import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { setApproval } from "../creatives/actions";

export const dynamic = "force-dynamic";

/** Central inbox of every PENDING creative across the network. */
export default async function ApprovalsPage() {
  await requireRole(ADMIN_ROLES);
  const pending = await prisma.creative.findMany({
    where: { approvalStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { campaignLinks: true } },
      campaignLinks: {
        take: 3,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              advertiser: { select: { businessName: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={`${pending.length} creative${pending.length === 1 ? "" : "s"} waiting on review.`}
      />
      {pending.length === 0 ? (
        <EmptyState message="Nothing in the queue — you're all caught up." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((cr) => {
            const advertisers = Array.from(
              new Set(
                cr.campaignLinks.map((l) => l.campaign.advertiser.businessName),
              ),
            ).slice(0, 2);
            return (
              <div key={cr.id} className="card overflow-hidden">
                <div className="aspect-video w-full bg-slate-100">
                  {cr.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cr.imageUrl}
                      alt={cr.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      {cr.creativeType}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/creatives/${cr.id}`}
                      className="truncate text-sm font-semibold text-brand-600 hover:underline"
                    >
                      {cr.title}
                    </Link>
                    <Badge value={cr.creativeType} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {cr._count.campaignLinks === 0
                      ? "Not attached to any campaign"
                      : `Used in ${cr._count.campaignLinks} campaign${
                          cr._count.campaignLinks === 1 ? "" : "s"
                        }${advertisers.length ? " · " + advertisers.join(", ") : ""}`}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <form
                      action={setApproval.bind(null, cr.id, "APPROVED")}
                      className="flex-1"
                    >
                      <button className="btn-primary w-full" type="submit">
                        Approve
                      </button>
                    </form>
                    <form
                      action={setApproval.bind(null, cr.id, "REJECTED")}
                      className="flex-1"
                    >
                      <button className="btn-danger w-full" type="submit">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
