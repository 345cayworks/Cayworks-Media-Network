import { prisma } from "@/lib/prisma";

export type DateRange = { from?: Date; to?: Date };

export type ReportRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
};

function rangeFilter(range: DateRange) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (range.from) createdAt.gte = range.from;
  if (range.to) createdAt.lte = range.to;
  return Object.keys(createdAt).length ? { createdAt } : {};
}

function ctr(impressions: number, clicks: number): number {
  return impressions === 0 ? 0 : (clicks / impressions) * 100;
}

type Dim = "campaign" | "platform" | "placement" | "advertiser";

/** Aggregate impressions / clicks / conversions grouped by a dimension. */
export async function buildReport(
  dim: Dim,
  range: DateRange,
): Promise<ReportRow[]> {
  const where = rangeFilter(range);

  // Advertiser isn't a column on the tracking tables — roll it up from the
  // per-campaign aggregates via campaign.advertiserId.
  if (dim === "advertiser") {
    const [imps, clks, convs] = await Promise.all([
      prisma.adImpression.groupBy({
        by: ["campaignId"],
        where,
        _count: { _all: true },
      }),
      prisma.adClick.groupBy({
        by: ["campaignId"],
        where,
        _count: { _all: true },
      }),
      prisma.adConversion.groupBy({
        by: ["campaignId"],
        where,
        _count: { _all: true },
      }),
    ]);
    const campaignIds = new Set<string>();
    for (const r of imps) if (r.campaignId) campaignIds.add(r.campaignId);
    for (const r of clks) if (r.campaignId) campaignIds.add(r.campaignId);
    for (const r of convs) if (r.campaignId) campaignIds.add(r.campaignId);

    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: [...campaignIds] } },
      select: {
        id: true,
        advertiserId: true,
        advertiser: { select: { businessName: true } },
      },
    });
    const campaignToAdv = new Map(
      campaigns.map((c) => [c.id, { id: c.advertiserId, label: c.advertiser.businessName }]),
    );

    const adMap = new Map<string, ReportRow>();
    const ensureAd = (id: string, label: string) => {
      if (!adMap.has(id))
        adMap.set(id, {
          key: id,
          label,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          conversions: 0,
        });
      return adMap.get(id)!;
    };
    for (const r of imps) {
      const a = r.campaignId ? campaignToAdv.get(r.campaignId) : null;
      if (a) ensureAd(a.id, a.label).impressions += r._count._all;
    }
    for (const r of clks) {
      const a = r.campaignId ? campaignToAdv.get(r.campaignId) : null;
      if (a) ensureAd(a.id, a.label).clicks += r._count._all;
    }
    for (const r of convs) {
      const a = r.campaignId ? campaignToAdv.get(r.campaignId) : null;
      if (a) ensureAd(a.id, a.label).conversions += r._count._all;
    }
    const adOut = [...adMap.values()];
    for (const row of adOut) row.ctr = ctr(row.impressions, row.clicks);
    adOut.sort((a, b) => b.impressions - a.impressions);
    return adOut;
  }

  const groupKey =
    dim === "campaign"
      ? "campaignId"
      : dim === "platform"
        ? "platformId"
        : "placementId";

  const [imps, clks, convs] = await Promise.all([
    prisma.adImpression.groupBy({
      by: [groupKey as "campaignId"],
      where,
      _count: { _all: true },
    }),
    prisma.adClick.groupBy({
      by: [groupKey as "campaignId"],
      where,
      _count: { _all: true },
    }),
    prisma.adConversion.groupBy({
      by: [groupKey as "campaignId"],
      where: dim === "campaign" ? where : { ...where },
      _count: { _all: true },
    }),
  ]);

  const map = new Map<string, ReportRow>();
  const ensure = (id: string) => {
    if (!map.has(id))
      map.set(id, {
        key: id,
        label: id,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
      });
    return map.get(id)!;
  };

  const idOf = (r: unknown): string | null =>
    ((r as Record<string, unknown>)[groupKey] as string | null) ?? null;

  for (const r of imps) {
    const id = idOf(r);
    if (id) ensure(id).impressions = r._count._all;
  }
  for (const r of clks) {
    const id = idOf(r);
    if (id) ensure(id).clicks = r._count._all;
  }
  for (const r of convs) {
    const id = idOf(r);
    if (id) ensure(id).conversions = r._count._all;
  }

  // Resolve human-readable labels.
  const ids = [...map.keys()];
  if (dim === "campaign") {
    const rows = await prisma.campaign.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, advertiser: { select: { businessName: true } } },
    });
    for (const r of rows)
      ensure(r.id).label = `${r.name} — ${r.advertiser.businessName}`;
  } else if (dim === "platform") {
    const rows = await prisma.platform.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    for (const r of rows) ensure(r.id).label = r.name;
  } else {
    const rows = await prisma.adPlacement.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, placementKey: true },
    });
    for (const r of rows) ensure(r.id).label = `${r.name} (${r.placementKey})`;
  }

  const out = [...map.values()];
  for (const row of out) row.ctr = ctr(row.impressions, row.clicks);
  out.sort((a, b) => b.impressions - a.impressions);
  return out;
}

export function toCsv(rows: ReportRow[]): string {
  const header = "label,impressions,clicks,ctr_percent,conversions";
  const body = rows
    .map(
      (r) =>
        `"${r.label.replace(/"/g, '""')}",${r.impressions},${r.clicks},${r.ctr.toFixed(
          2,
        )},${r.conversions}`,
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

export async function dashboardStats(range: DateRange) {
  const where = rangeFilter(range);
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86400000);

  const [
    advertisers,
    activeCampaigns,
    impressions,
    clicks,
    pendingCreatives,
    expiring,
    revenueAgg,
  ] = await Promise.all([
    prisma.advertiser.count(),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.adImpression.count({ where }),
    prisma.adClick.count({ where }),
    prisma.creative.count({ where: { approvalStatus: "PENDING" } }),
    prisma.campaign.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: in14 } },
      select: {
        id: true,
        name: true,
        endDate: true,
        advertiser: { select: { businessName: true } },
      },
      orderBy: { endDate: "asc" },
      take: 10,
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: {
        status: "PAID",
        paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    }),
  ]);

  return {
    advertisers,
    activeCampaigns,
    impressions,
    clicks,
    ctr: ctr(impressions, clicks),
    monthlyRevenue: Number(revenueAgg._sum.amount ?? 0),
    pendingCreatives,
    expiring,
  };
}
