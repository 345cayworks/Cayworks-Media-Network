import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { setApproval, bulkSetApproval } from "../creatives/actions";

export const dynamic = "force-dynamic";

const TYPES = ["IMAGE", "VIDEO", "NATIVE", "HTML"] as const;

/** Central inbox of every PENDING creative across the network. */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  await requireRole(ADMIN_ROLES);

  const where: Prisma.CreativeWhereInput = { approvalStatus: "PENDING" };
  if (TYPES.includes(searchParams.type as "IMAGE")) {
    where.creativeType = searchParams.type as "IMAGE";
  }

  const pending = await prisma.creative.findMany({
    where,
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

  function chipClass(active: boolean): string {
    return active
      ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
      : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100";
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={`${pending.length} creative${pending.length === 1 ? "" : "s"} waiting on review.`}
      />

      <div className="card mb-4 flex flex-wrap items-end justify-between gap-3 p-3">
        <div className="flex items-end gap-2">
          <span className="label">Type</span>
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
            <Link href="/admin/approvals" className={chipClass(!searchParams.type)}>
              All
            </Link>
            {TYPES.map((t) => (
              <Link
                key={t}
                href={`/admin/approvals?type=${t}`}
                className={chipClass(searchParams.type === t)}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-500">
          Tick multiple, then use the bulk buttons at the bottom.
        </span>
      </div>

      {pending.length === 0 ? (
        <EmptyState message="Nothing in the queue — you're all caught up." />
      ) : (
        <form action={bulkSetApproval.bind(null, "APPROVED")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((cr) => {
              const advertisers = Array.from(
                new Set(
                  cr.campaignLinks.map(
                    (l) => l.campaign.advertiser.businessName,
                  ),
                ),
              ).slice(0, 2);
              return (
                <div key={cr.id} className="card overflow-hidden">
                  <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      name="creativeId"
                      value={cr.id}
                      className="h-3.5 w-3.5"
                    />
                    Select for bulk action
                  </label>
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
                      <button
                        type="submit"
                        formAction={setApproval.bind(null, cr.id, "APPROVED")}
                        className="btn-primary flex-1"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        formAction={setApproval.bind(null, cr.id, "REJECTED")}
                        className="btn-danger flex-1"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-md backdrop-blur">
            <span className="mr-auto text-xs text-slate-500">
              Bulk action applies to every ticked card.
            </span>
            <button type="submit" className="btn-primary">
              Approve selected
            </button>
            <button
              type="submit"
              formAction={bulkSetApproval.bind(null, "REJECTED")}
              className="btn-danger"
            >
              Reject selected
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
