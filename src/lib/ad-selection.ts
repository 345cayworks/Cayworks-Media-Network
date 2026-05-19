import { prisma } from "@/lib/prisma";

export type ServeParams = {
  platformId: string;
  placementKey: string;
  userRole?: string | null;
  category?: string | null;
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

/**
 * Core ad-selection algorithm.
 *
 *  - resolves the active placement for the platform
 *  - finds ACTIVE campaigns linked to it within their flight dates
 *  - drops campaigns that hit their daily / total impression caps
 *  - optionally biases toward an advertiser industry (category)
 *  - weighted-random pick by (campaign.priority * campaignPlacement.weight)
 *  - returns one APPROVED + ACTIVE creative, or null when nothing is eligible
 */
export async function selectAd(
  params: ServeParams,
): Promise<AdPayload | null> {
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
    include: {
      campaign: {
        include: {
          advertiser: true,
          creatives: {
            where: { approvalStatus: "APPROVED", status: "ACTIVE" },
          },
        },
      },
    },
  });

  type Candidate = {
    link: (typeof links)[number];
    weight: number;
  };

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

    // Effective weight: campaign priority amplified by per-placement weight.
    const weight = Math.max(1, campaign.priority) * Math.max(1, link.weight);
    candidates.push({ link, weight });
  }

  if (candidates.length === 0) return null;

  // Bias toward category (advertiser industry) when requested, but never
  // starve the slot: fall back to the full set if nothing matches.
  let pool = candidates;
  if (params.category) {
    const cat = params.category.toLowerCase().trim();
    const matched = candidates.filter(
      (c) =>
        (c.link.campaign.advertiser.industry ?? "").toLowerCase().trim() ===
        cat,
    );
    if (matched.length > 0) pool = matched;
  }

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

  const campaign = chosen.link.campaign;
  // Rotate creatives within the winning campaign as well.
  const creative =
    campaign.creatives[Math.floor(Math.random() * campaign.creatives.length)];

  const label =
    LABELS[Math.abs(hashString(campaign.id)) % LABELS.length] ?? LABELS[0];

  return {
    adId: creative.id,
    campaignId: campaign.id,
    creativeId: creative.id,
    placementId: placement.id,
    platformId: params.platformId,
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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
