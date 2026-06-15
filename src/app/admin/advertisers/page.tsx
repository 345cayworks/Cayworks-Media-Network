import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { BulkToolbar } from "@/components/BulkToolbar";
import { SortHeader } from "@/components/SortHeader";
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

// SortHeader / SortHeaderInline live in @/components/SortHeader now.

export default async function AdvertisersPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string; q?: string };
}) {
  await requireUser();

  const sort: SortKey = SORTABLE.has(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : "created";
  const dir: Dir = searchParams.dir === "asc" ? "asc" : "desc";
  const q = (searchParams.q ?? "").trim();

  const advertisersRaw = await prisma.advertiser.findMany({
    where: q
      ? {
          OR: [
            { businessName: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
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

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <form className="flex flex-1 min-w-[220px] items-end gap-2" method="get">
          {searchParams.sort && (
            <input type="hidden" name="sort" value={searchParams.sort} />
          )}
          {searchParams.dir && (
            <input type="hidden" name="dir" value={searchParams.dir} />
          )}
          <div className="flex-1">
            <label className="label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Business, contact or email…"
              className="input"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
          {q && (
            <Link
              href={(() => {
                const p = new URLSearchParams();
                if (searchParams.sort) p.set("sort", searchParams.sort);
                if (searchParams.dir) p.set("dir", searchParams.dir);
                return p.toString() ? `/admin/advertisers?${p.toString()}` : "/admin/advertisers";
              })()}
              className="btn-secondary"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {advertisers.length === 0 ? (
        <EmptyState message="No advertisers yet. Create your first advertiser." />
      ) : (
        <form action={bulkSetAdvertiserStatus.bind(null, "ACTIVE")}>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th w-8"></th>
                <SortHeader label="Business" k="business" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
                <SortHeader label="Contact" k="contact" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
                <SortHeader label="Industry" k="industry" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
                <th className="th">Campaigns</th>
                <th className="th text-right">
                  <SortHeader inline label="Impressions" k="impressions" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
                </th>
                <th className="th text-right">
                  <SortHeader inline label="Clicks" k="clicks" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
                </th>
                <th className="th">Billing</th>
                <SortHeader label="Status" k="status" current={sort} dir={dir} basePath="/admin/advertisers" preserve={searchParams} />
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

        <BulkToolbar selectName="advertiserId">
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
        </BulkToolbar>
        </form>
      )}
    </div>
  );
}
