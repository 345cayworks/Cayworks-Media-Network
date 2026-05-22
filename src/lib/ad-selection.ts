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

const CAMPAIGN_LINK_INCLUDE = {
  campaign: {
    include: {
      advertiser: true,
      creatives: { where: { approvalStatus: "APPROVED", status: "ACTIVE" } },
    },
  },
} satisfies Prisma.CampaignPlacementInclude;

type CampaignLink = Prisma.CampaignPlacementGetPayload<{
  include: typeof CAMPAIGN_LINK_INCLUDE;
}>;
type Creative = CampaignLink["campaign"]["creatives"][number];
type Candidate = { link: CampaignLink; weight: number };

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
    if (campaign.creatives.length === 0) continue;
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

    // Per-user frequency cap: skip campaigns this anonymous user has already
    // seen the allowed number of times today.
    if (
      campaign.frequencyCapPerUserPerDay != null &&
      params.anonymousUserId
    ) {
      const seen = await prisma.adImpression.count({
        where: {
          campaignId: campaign.id,
          anonymousUserId: params.anonymousUserId,
          createdAt: { gte: dayStart },
        },
      });
      if (seen >= campaign.frequencyCapPerUserPerDay) continue;
    }

    const weight = Math.max(1, campaign.priority) * Math.max(1, link.weight);
    candidates.push({ link, weight });
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

  const creatives = chosen.link.campaign.creatives;
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
    (sum, c) => sum + c.link.campaign.creatives.length,
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
    const creatives = best.c.link.campaign.creatives;
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
