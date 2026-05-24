import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

type SortKey = "name" | "advertiser" | "flight" | "status" | "created";
type Dir = "asc" | "desc";

const SORTABLE: ReadonlySet<SortKey> = new Set([
  "name",
  "advertiser",
  "flight",
  "status",
  "created",
]);

function orderByFor(sort: SortKey, dir: Dir): Prisma.CampaignOrderByWithRelationInput {
  switch (sort) {
    case "name":
      return { name: dir };
    case "advertiser":
      return { advertiser: { businessName: dir } };
    case "flight":
      return { startDate: dir };
    case "status":
      return { status: dir };
    default:
      return { createdAt: dir };
  }
}

function SortHeader({
  label,
  k,
  current,
  dir,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: Dir;
}) {
  const active = current === k;
  const nextDir: Dir = active && dir === "asc" ? "desc" : "asc";
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <th className="th">
      <Link
        href={`/admin/campaigns?sort=${k}&dir=${nextDir}`}
        className={
          active
            ? "inline-flex items-center gap-1 text-brand-600"
            : "inline-flex items-center gap-1 hover:text-slate-700"
        }
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </Link>
    </th>
  );
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  await requireUser();

  const sort: SortKey = SORTABLE.has(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : "created";
  const dir: Dir = searchParams.dir === "asc" ? "asc" : "desc";

  const campaigns = await prisma.campaign.findMany({
    orderBy: orderByFor(sort, dir),
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
                <SortHeader label="Campaign" k="name" current={sort} dir={dir} />
                <SortHeader label="Advertiser" k="advertiser" current={sort} dir={dir} />
                <SortHeader label="Flight" k="flight" current={sort} dir={dir} />
                <th className="th">Pricing</th>
                <th className="th">Prio</th>
                <th className="th">Creatives</th>
                <SortHeader label="Status" k="status" current={sort} dir={dir} />
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
