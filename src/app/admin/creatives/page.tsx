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
    include: { _count: { select: { campaignLinks: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Creative Library"
        subtitle="Reusable creative assets. Each can be attached to many campaigns."
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
        <EmptyState message="No creatives in the library yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creatives.map((cr) => (
            <Link
              key={cr.id}
              href={`/admin/creatives/${cr.id}`}
              className="card group block overflow-hidden"
            >
              <div className="aspect-video w-full bg-slate-100">
                {cr.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cr.imageUrl}
                    alt={cr.title}
                    className="h-full w-full object-cover transition group-hover:opacity-90"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    {cr.creativeType}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {cr.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {cr.creativeType}
                      {cr.width && cr.height
                        ? ` · ${cr.width}×${cr.height}`
                        : ""}
                    </div>
                  </div>
                  <Badge value={cr.approvalStatus} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Used in{" "}
                    <strong className="text-slate-700">
                      {cr._count.campaignLinks}
                    </strong>{" "}
                    campaign{cr._count.campaignLinks === 1 ? "" : "s"}
                  </span>
                  <Badge value={cr.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
