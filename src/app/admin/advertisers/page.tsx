import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { SelectAll } from "@/components/SelectAll";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import {
  bulkSetAdvertiserStatus,
  bulkDeleteAdvertisers,
} from "./actions";

export const dynamic = "force-dynamic";

type SortKey =
  | "business"
  | "contact"
  | "industry"
  | "status"
  | "impressions"
  | "clicks"
  | "created";
type Dir = "asc" | "desc";

const SORTABLE: ReadonlySet<SortKey> = new Set([
  "business",
  "contact",
  "industry",
  "status",
  "impressions",
  "clicks",
  "created",
]);

function orderByFor(sort: SortKey, dir: Dir): Prisma.AdvertiserOrderByWithRelationInput {
  switch (sort) {
    case "business":
      return { businessName: dir };
    case "contact":
      return { contactName: dir };
    case "industry":
      return { industry: dir };
    case "status":
      return { status: dir };
    default:
      // impressions / clicks are sorted in JS after aggregation.
      return { createdAt: dir };
  }
}

function SortHeaderInline({
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
    <Link
      href={`/admin/advertisers?sort=${k}&dir=${nextDir}`}
      className={
        active
          ? "inline-flex items-center gap-1 text-brand-600"
          : "inline-flex items-center gap-1 hover:text-slate-700"
      }
    >
      {label}
      <span className="text-[10px]">{arrow}</span>
    </Link>
  );
}

function SortHeader(props: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: Dir;
}) {
  return (
    <th className="th">
      <SortHeaderInline {...props} />
    </th>
  );
}

export default async function AdvertisersPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  await requireUser();

  const sort: SortKey = SORTABLE.has(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : "created";
  const dir: Dir = searchParams.dir === "asc" ? "asc" : "desc";

  const advertisersRaw = await prisma.advertiser.findMany({
    orderBy: orderByFor(sort, dir),
    include: { _count: { select: { campaigns: true } } },
  });

  // Roll impressions/clicks up from campaigns → advertiser. groupBy on
  // tracking tables by campaignId, then map to advertiserId.
  const [imps, clks, campaigns] = await Promise.all([
    prisma.adImpression.groupBy({
      by: ["campaignId"],
      _count: { _all: true },
    }),
    prisma.adClick.groupBy({
      by: ["campaignId"],
      _count: { _all: true },
    }),
    prisma.campaign.findMany({ select: { id: true, advertiserId: true } }),
  ]);
  const campToAdv = new Map(campaigns.map((c) => [c.id, c.advertiserId]));
  const impByAdv = new Map<string, number>();
  const clkByAdv = new Map<string, number>();
  for (const r of imps) {
    const advId = r.campaignId ? campToAdv.get(r.campaignId) : null;
    if (advId) impByAdv.set(advId, (impByAdv.get(advId) ?? 0) + r._count._all);
  }
  for (const r of clks) {
    const advId = r.campaignId ? campToAdv.get(r.campaignId) : null;
    if (advId) clkByAdv.set(advId, (clkByAdv.get(advId) ?? 0) + r._count._all);
  }

  // Aggregate-based sorts are applied in JS after the rollup above.
  const advertisers =
    sort === "impressions" || sort === "clicks"
      ? [...advertisersRaw].sort((a, b) => {
          const av =
            sort === "impressions"
              ? (impByAdv.get(a.id) ?? 0)
              : (clkByAdv.get(a.id) ?? 0);
          const bv =
            sort === "impressions"
              ? (impByAdv.get(b.id) ?? 0)
              : (clkByAdv.get(b.id) ?? 0);
          return dir === "asc" ? av - bv : bv - av;
        })
      : advertisersRaw;

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
        <form action={bulkSetAdvertiserStatus.bind(null, "ACTIVE")}>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th w-8"></th>
                <SortHeader label="Business" k="business" current={sort} dir={dir} />
                <SortHeader label="Contact" k="contact" current={sort} dir={dir} />
                <SortHeader label="Industry" k="industry" current={sort} dir={dir} />
                <th className="th">Campaigns</th>
                <th className="th text-right">
                  <SortHeaderInline
                    label="Impressions"
                    k="impressions"
                    current={sort}
                    dir={dir}
                  />
                </th>
                <th className="th text-right">
                  <SortHeaderInline
                    label="Clicks"
                    k="clicks"
                    current={sort}
                    dir={dir}
                  />
                </th>
                <th className="th">Billing</th>
                <SortHeader label="Status" k="status" current={sort} dir={dir} />
              </tr>
            </thead>
            <tbody>
              {advertisers.map((a) => {
                const impressions = impByAdv.get(a.id) ?? 0;
                const clicks = clkByAdv.get(a.id) ?? 0;
                return (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="td">
                    <input
                      type="checkbox"
                      name="advertiserId"
                      value={a.id}
                      className="h-3.5 w-3.5"
                    />
                  </td>
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
                  <td className="td text-right tabular-nums">
                    {impressions.toLocaleString()}
                  </td>
                  <td className="td text-right tabular-nums">
                    {clicks.toLocaleString()}
                  </td>
                  <td className="td">
                    <Badge value={a.billingStatus} />
                  </td>
                  <td className="td">
                    <Badge value={a.status} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-md backdrop-blur">
          <SelectAll name="advertiserId" />
          <span className="mr-auto text-xs text-slate-500">
            Bulk actions apply to every ticked row.
          </span>
          <button type="submit" className="btn-secondary">
            Activate
          </button>
          <button
            type="submit"
            formAction={bulkSetAdvertiserStatus.bind(null, "INACTIVE")}
            className="btn-secondary"
          >
            Deactivate
          </button>
          <ConfirmFormButton
            action={bulkDeleteAdvertisers}
            className="btn-danger"
            confirmText="Permanently delete the selected advertisers? This also deletes ALL their campaigns, creatives' links, and tracking data. This cannot be undone."
          >
            Delete
          </ConfirmFormButton>
        </div>
        </form>
      )}
    </div>
  );
}
