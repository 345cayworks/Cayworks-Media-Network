import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import { BulkToolbar } from "@/components/BulkToolbar";
import { SortHeader } from "@/components/SortHeader";
import { FilterChips } from "@/components/FilterChips";
import {
  bulkSetCampaignStatus,
  bulkDeleteCampaigns,
} from "./actions";
import {
  effectiveStatus,
  statusLabel,
  type EffectiveStatus,
} from "@/lib/campaign-status";

const STATE_FILTERS: EffectiveStatus[] = [
  "LIVE",
  "PAUSED",
  "DRAFT",
  "OFF_SCHEDULE",
  "NO_CREATIVES",
  "NO_PLACEMENTS",
  "ENDED",
  "ADVERTISER_OFF",
];

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

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string; state?: string; q?: string };
}) {
  await requireUser();

  const sort: SortKey = SORTABLE.has(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : "created";
  const dir: Dir = searchParams.dir === "asc" ? "asc" : "desc";
  const stateFilter = STATE_FILTERS.includes(searchParams.state as EffectiveStatus)
    ? (searchParams.state as EffectiveStatus)
    : null;
  const q = (searchParams.q ?? "").trim();

  const campaignsRaw = await prisma.campaign.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            {
              advertiser: {
                businessName: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {},
    orderBy: orderByFor(sort, dir),
    include: {
      advertiser: {
        select: {
          businessName: true,
          status: true,
          billingStatus: true,
        },
      },
      _count: { select: { creativeLinks: true, campaignPlacements: true } },
      creativeLinks: { select: { status: true } },
      campaignPlacements: {
        select: {
          status: true,
          placement: {
            select: {
              platform: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    },
  });

  // Apply effective-state filter in JS — it's a derived value across many cols.
  const campaigns = stateFilter
    ? campaignsRaw.filter((c) => effectiveStatus(c).status === stateFilter)
    : campaignsRaw;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Plan flights, pricing, priority and placement assignments."
        action={<LinkButton href="/admin/campaigns/new">New Campaign</LinkButton>}
      />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <form className="flex flex-1 min-w-[220px] items-end gap-2" method="get">
          {searchParams.sort && (
            <input type="hidden" name="sort" value={searchParams.sort} />
          )}
          {searchParams.dir && (
            <input type="hidden" name="dir" value={searchParams.dir} />
          )}
          {searchParams.state && (
            <input type="hidden" name="state" value={searchParams.state} />
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
              placeholder="Campaign name or advertiser…"
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
                if (searchParams.state) p.set("state", searchParams.state);
                return p.toString() ? `/admin/campaigns?${p.toString()}` : "/admin/campaigns";
              })()}
              className="btn-secondary"
            >
              Clear
            </Link>
          )}
        </form>
        <FilterChips
          label="State"
          name="state"
          basePath="/admin/campaigns"
          items={STATE_FILTERS.map((s) => ({ value: s, label: statusLabel(s) }))}
          active={stateFilter ?? undefined}
          preserve={searchParams}
        />
        <span className="ml-auto text-xs text-slate-500">
          Showing {campaigns.length} of {campaignsRaw.length}
        </span>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState message="No campaigns match those filters." />
      ) : (
        <form action={bulkSetCampaignStatus.bind(null, "ACTIVE")}>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th w-8"></th>
                <SortHeader label="Campaign" k="name" current={sort} dir={dir} basePath="/admin/campaigns" preserve={searchParams} />
                <SortHeader label="Advertiser" k="advertiser" current={sort} dir={dir} basePath="/admin/campaigns" preserve={searchParams} />
                <SortHeader label="Flight" k="flight" current={sort} dir={dir} basePath="/admin/campaigns" preserve={searchParams} />
                <th className="th">Platforms</th>
                <th className="th">Pricing</th>
                <th className="th">Prio</th>
                <th className="th">Creatives</th>
                <th className="th">State</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                // Group the campaign's placement assignments by platform; a
                // platform is "active" if at least one of its links is ACTIVE.
                const byPlatform = new Map<
                  string,
                  { name: string; slug: string; active: boolean }
                >();
                for (const cp of c.campaignPlacements) {
                  const p = cp.placement.platform;
                  const cur = byPlatform.get(p.id);
                  const isActive = cp.status === "ACTIVE";
                  if (!cur)
                    byPlatform.set(p.id, {
                      name: p.name,
                      slug: p.slug,
                      active: isActive,
                    });
                  else if (isActive) cur.active = true;
                }
                const platforms = [...byPlatform.values()].sort((a, b) =>
                  a.name.localeCompare(b.name),
                );
                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="td">
                      <input
                        type="checkbox"
                        name="campaignId"
                        value={c.id}
                        className="h-3.5 w-3.5"
                      />
                    </td>
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
                    <td className="td">
                      {platforms.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {platforms.map((p) => (
                            <span
                              key={p.slug}
                              title={
                                p.active
                                  ? `Serving on ${p.name}`
                                  : `Paused on ${p.name}`
                              }
                              className={
                                p.active
                                  ? "inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700"
                                  : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                              }
                            >
                              <span
                                className={
                                  p.active
                                    ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                                    : "h-1.5 w-1.5 rounded-full bg-slate-400"
                                }
                              />
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="td">{c.pricingModel}</td>
                    <td className="td">{c.priority}</td>
                    <td className="td">{c._count.creativeLinks}</td>
                    <td className="td">
                      <StatusPill campaign={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <BulkToolbar selectName="campaignId">
          <button type="submit" className="btn-secondary">
            Activate
          </button>
          <button
            type="submit"
            formAction={bulkSetCampaignStatus.bind(null, "PAUSED")}
            className="btn-secondary"
          >
            Pause
          </button>
          <button
            type="submit"
            formAction={bulkSetCampaignStatus.bind(null, "ENDED")}
            className="btn-secondary"
          >
            End
          </button>
          <ConfirmFormButton
            action={bulkDeleteCampaigns}
            className="btn-danger"
            confirmText="Permanently delete the selected campaigns? This also deletes their creatives' links, placement assignments, and tracking data. This cannot be undone."
          >
            Delete
          </ConfirmFormButton>
        </BulkToolbar>
        </form>
      )}
    </div>
  );
}
