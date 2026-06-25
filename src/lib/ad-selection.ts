import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ServeParams = {
  platformId: string;
  placementKey: string;
  userRole?: string | null;
  category?: string | null;
  /** Used to enforce per-user frequency caps when available. */
  anonymousUserId?: string | null;
};

export type AdPayload = {
  adId: string;
  campaignId: string;
  creativeId: string;
  placementId: string;
  platformId: string;
  creativeType: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string;
  ctaText: string | null;
  width: number | null;
  height: number | null;
  label: string;
};

// Rotating, non-spammy disclosure labels (see UX requirements).
const LABELS = [
  "Sponsored Local Partner",
  "Recommended Service",
  "Featured Vendor",
  "Partner Offer",
];

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Default expected dimensions per placement type, used when the placement
// itself doesn't list any allowedSizes. Tuned to standard IAB sizes.
const TYPE_DEFAULT_SIZES: Record<string, { w: number; h: number }[]> = {
  SKYSCRAPER: [{ w: 180, h: 600 }],
  BANNER: [
    { w: 728, h: 90 },
    { w: 970, h: 90 },
    { w: 300, h: 250 },
  ],
  SIDEBAR: [
    { w: 300, h: 600 },
    { w: 300, h: 250 },
  ],
  CARD: [{ w: 300, h: 250 }],
  // NATIVE/VIDEO are not dimension-gated.
};

function parseSize(s: string): { w: number; h: number } | null {
  const m = s.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

function placementSizes(
  allowedSizes: string[],
  placementType: string,
): { w: number; h: number }[] {
  if (allowedSizes.length > 0) {
    return allowedSizes
      .map(parseSize)
      .filter((s): s is { w: number; h: number } => s != null);
  }
  return TYPE_DEFAULT_SIZES[placementType] ?? [];
}

// A creative "fits" a target size if both dimensions are within ±15% — close
// enough that fluid sizing + object-fit will display it cleanly.
function fitsSize(
  cw: number,
  ch: number,
  s: { w: number; h: number },
  tolerance = 0.15,
): boolean {
  return (
    Math.abs(cw - s.w) / s.w <= tolerance &&
    Math.abs(ch - s.h) / s.h <= tolerance
  );
}

function filterBestCreatives<T extends { width: number | null; height: number | null }>(
  creatives: T[],
  sizes: { w: number; h: number }[],
): T[] {
  if (sizes.length === 0) return creatives;
  const matched = creatives.filter((c) => {
    if (!c.width || !c.height) return false;
    return sizes.some((s) => fitsSize(c.width!, c.height!, s));
  });
  // Prefer best-fit creatives; fall back to all so the slot still serves
  // something rather than going dark when nothing matches the placement.
  return matched.length > 0 ? matched : creatives;
}

const CAMPAIGN_LINK_INCLUDE = {
  campaign: {
    include: {
      advertiser: true,
      // Creatives flow through the m2m join. Filter on both the link being
      // ACTIVE and the underlying creative being APPROVED + ACTIVE so the
      // returned list is already eligible.
      creativeLinks: {
        where: {
          status: "ACTIVE",
          creative: { approvalStatus: "APPROVED", status: "ACTIVE" },
        },
        include: { creative: true },
      },
    },
  },
} satisfies Prisma.CampaignPlacementInclude;

type CampaignLink = Prisma.CampaignPlacementGetPayload<{
  include: typeof CAMPAIGN_LINK_INCLUDE;
}>;
type Creative = CampaignLink["campaign"]["creativeLinks"][number]["creative"];
type Candidate = {
  link: CampaignLink;
  weight: number;
  /** Approved creatives filtered to those that fit the placement's expected
   * dimensions. Falls back to all approved creatives when nothing matches. */
  bestCreatives: Creative[];
};

/**
 * Resolve the active placement and the eligible campaigns linked to it:
 * active campaigns within flight dates, active advertiser, billing not
 * on-hold, daily/total impression caps not exceeded, ≥1 approved creative.
 * Effective weight = max(1, priority) * max(1, placementWeight).
 */
async function gatherCandidates(
  params: ServeParams,
): Promise<{ placementId: string; candidates: Candidate[] } | null> {
  const now = new Date();

  const placement = await prisma.adPlacement.findFirst({
    where: {
      platformId: params.platformId,
      placementKey: params.placementKey,
      status: "ACTIVE",
    },
  });
  if (!placement) return null;

  const sizes = placementSizes(placement.allowedSizes, placement.placementType);

  const links = await prisma.campaignPlacement.findMany({
    where: {
      placementId: placement.id,
      status: "ACTIVE",
      campaign: {
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    },
    include: CAMPAIGN_LINK_INCLUDE,
  });

  const dayStart = startOfUtcDay(now);
  const candidates: Candidate[] = [];

  for (const link of links) {
    const campaign = link.campaign;
    if (campaign.creativeLinks.length === 0) continue;
    if (campaign.advertiser.status !== "ACTIVE") continue;
    if (campaign.advertiser.billingStatus === "ON_HOLD") continue;

    if (campaign.totalImpressionLimit != null) {
      const total = await prisma.adImpression.count({
        where: { campaignId: campaign.id },
      });
      if (total >= campaign.totalImpressionLimit) continue;
    }
    if (campaign.dailyImpressionLimit != null) {
      const today = await prisma.adImpression.count({
        where: { campaignId: campaign.id, createdAt: { gte: dayStart } },
      });
      if (today >= campaign.dailyImpressionLimit) continue;
    }

    // Per-user frequency caps: skip campaigns this anonymous user has already
    // seen the allowed number of times (rolling hour, and per UTC day).
    if (params.anonymousUserId) {
      if (campaign.frequencyCapPerUserPerHour != null) {
        const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
        const seenHour = await prisma.adImpression.count({
          where: {
            campaignId: campaign.id,
            anonymousUserId: params.anonymousUserId,
            createdAt: { gte: hourStart },
          },
        });
        if (seenHour >= campaign.frequencyCapPerUserPerHour) continue;
      }
      if (campaign.frequencyCapPerUserPerDay != null) {
        const seenDay = await prisma.adImpression.count({
          where: {
            campaignId: campaign.id,
            anonymousUserId: params.anonymousUserId,
            createdAt: { gte: dayStart },
          },
        });
        if (seenDay >= campaign.frequencyCapPerUserPerDay) continue;
      }
    }

    const weight = Math.max(1, campaign.priority) * Math.max(1, link.weight);
    // Format match: a placement is fed only the creatives built for its slot
    // type (card slot → card creative, native → native, etc.). Unlike size-fit
    // this is strict — a campaign with no creative of this format contributes
    // nothing here rather than serving a wrong-format ad.
    const formatMatched = campaign.creativeLinks
      .map((l) => l.creative)
      .filter((c) => c.format === placement.placementType);
    if (formatMatched.length === 0) continue;
    const bestCreatives = filterBestCreatives(formatMatched, sizes);
    candidates.push({ link, weight, bestCreatives });
  }

  return { placementId: placement.id, candidates };
}

// Bias toward category (advertiser industry) when requested, but never
// starve the slot: fall back to the full set if nothing matches.
function applyCategory(
  candidates: Candidate[],
  category?: string | null,
): Candidate[] {
  if (!category) return candidates;
  const cat = category.toLowerCase().trim();
  const matched = candidates.filter(
    (c) =>
      (c.link.campaign.advertiser.industry ?? "").toLowerCase().trim() === cat,
  );
  return matched.length > 0 ? matched : candidates;
}

function buildPayload(
  link: CampaignLink,
  creative: Creative,
  placementId: string,
  platformId: string,
): AdPayload {
  const campaign = link.campaign;
  const label =
    LABELS[Math.abs(hashString(campaign.id)) % LABELS.length] ?? LABELS[0];
  return {
    adId: creative.id,
    campaignId: campaign.id,
    creativeId: creative.id,
    placementId,
    platformId,
    creativeType: creative.creativeType,
    title: creative.title,
    description: creative.description,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
    destinationUrl: creative.destinationUrl,
    ctaText: creative.ctaText,
    width: creative.width,
    height: creative.height,
    label,
  };
}

/**
 * Select a single ad: weighted-random pick of an eligible campaign, then a
 * random approved creative within it. Returns null when nothing is eligible.
 */
export async function selectAd(
  params: ServeParams,
): Promise<AdPayload | null> {
  const g = await gatherCandidates(params);
  if (!g || g.candidates.length === 0) return null;

  const pool = applyCategory(g.candidates, params.category);
  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  let chosen = pool[0];
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) {
      chosen = c;
      break;
    }
  }

  const creatives = chosen.bestCreatives;
  const creative = creatives[Math.floor(Math.random() * creatives.length)];
  return buildPayload(chosen.link, creative, g.placementId, params.platformId);
}

/**
 * Build an ordered rotation queue of up to `count` ads using smooth weighted
 * round-robin (the Nginx SWRR algorithm). A campaign with weight W appears
 * ~W times more often than a weight-1 campaign, but the appearances are
 * interleaved rather than clustered, and back-to-back repeats are avoided
 * whenever more than one campaign is eligible. Creatives within a campaign
 * rotate round-robin. Returns [] when nothing is eligible.
 */
export async function selectAdQueue(
  params: ServeParams,
  count: number,
): Promise<AdPayload[]> {
  const g = await gatherCandidates(params);
  if (!g || g.candidates.length === 0) return [];

  const pool = applyCategory(g.candidates, params.category);
  const distinctCombos = pool.reduce(
    (sum, c) => sum + c.bestCreatives.length,
    0,
  );
  // No point repeating a single image; otherwise honor the requested length
  // (capped) so heavier-weight campaigns get their extra appearances.
  const n = distinctCombos <= 1 ? 1 : Math.max(1, Math.min(count, 20));

  const totalW = pool.reduce((sum, c) => sum + c.weight, 0);
  const state = pool.map((c) => ({ c, cw: 0, ci: 0 }));
  const out: AdPayload[] = [];

  for (let i = 0; i < n; i++) {
    let best = state[0];
    for (const s of state) {
      s.cw += s.c.weight;
      if (s.cw > best.cw) best = s;
    }
    best.cw -= totalW;
    const creatives = best.c.bestCreatives;
    const creative = creatives[best.ci % creatives.length];
    best.ci++;
    out.push(
      buildPayload(best.c.link, creative, g.placementId, params.platformId),
    );
  }
  return out;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
