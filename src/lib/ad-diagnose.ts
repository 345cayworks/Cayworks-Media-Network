import { prisma } from "@/lib/prisma";

export type CandidateEval = {
  campaignId: string;
  campaignName: string;
  advertiser: string;
  priority: number;
  weight: number;
  eligible: boolean;
  excluded: string[];
  approvedCreatives: number;
};

export type DiagnoseResult = {
  ok: boolean;
  stage: "placement" | "selection" | "selectable";
  platform: string;
  placementKey: string;
  placementStatus?: string;
  totalCampaignLinks: number;
  eligibleCampaigns: number;
  candidates: CandidateEval[];
  reason?: string;
  hint: string;
};

/**
 * Build a full picture of why selection would or wouldn't return an ad for
 * a given (platform, placementKey). Used by both the public diagnose
 * endpoint and the admin preview endpoint.
 */
export async function diagnoseForPlatform(
  platformSlug: string,
  platformId: string,
  placementKey: string,
  anonymousUserId?: string | null,
): Promise<DiagnoseResult> {
  const placement = await prisma.adPlacement.findFirst({
    where: { platformId, placementKey },
  });

  if (!placement) {
    return {
      ok: false,
      stage: "placement",
      platform: platformSlug,
      placementKey,
      totalCampaignLinks: 0,
      eligibleCampaigns: 0,
      candidates: [],
      reason: "Placement does not exist on this platform",
      hint: "Check the placementKey spelling — see /admin/platforms",
    };
  }
  if (placement.status !== "ACTIVE") {
    return {
      ok: false,
      stage: "placement",
      platform: platformSlug,
      placementKey,
      placementStatus: placement.status,
      totalCampaignLinks: 0,
      eligibleCampaigns: 0,
      candidates: [],
      reason: `Placement status is ${placement.status}`,
      hint: "Activate it in /admin/platforms",
    };
  }

  const now = new Date();
  const links = await prisma.campaignPlacement.findMany({
    where: { placementId: placement.id },
    include: {
      campaign: {
        include: {
          advertiser: true,
          creativeLinks: { include: { creative: true } },
        },
      },
    },
  });

  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const candidates: CandidateEval[] = [];
  for (const l of links) {
    const c = l.campaign;
    const reasons: string[] = [];
    if (l.status !== "ACTIVE") reasons.push(`link ${l.status}`);
    if (c.status !== "ACTIVE") reasons.push(`campaign ${c.status}`);
    if (c.startDate > now) reasons.push("not yet started");
    if (c.endDate < now) reasons.push("ended");
    if (c.advertiser.status !== "ACTIVE")
      reasons.push(`advertiser ${c.advertiser.status}`);
    if (c.advertiser.billingStatus === "ON_HOLD")
      reasons.push("billing ON_HOLD");
    const approved = c.creativeLinks
      .filter((l) => l.status === "ACTIVE")
      .map((l) => l.creative)
      .filter((cr) => cr.approvalStatus === "APPROVED" && cr.status === "ACTIVE");
    if (approved.length === 0) reasons.push("no APPROVED + ACTIVE creatives");

    // Per-user frequency caps (only evaluable when a user id is supplied).
    if (anonymousUserId) {
      if (c.frequencyCapPerUserPerHour != null) {
        const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
        const seenHour = await prisma.adImpression.count({
          where: { campaignId: c.id, anonymousUserId, createdAt: { gte: hourStart } },
        });
        if (seenHour >= c.frequencyCapPerUserPerHour)
          reasons.push(
            `hourly frequency cap reached for this user (${seenHour}/${c.frequencyCapPerUserPerHour} in last hour)`,
          );
      }
      if (c.frequencyCapPerUserPerDay != null) {
        const seenDay = await prisma.adImpression.count({
          where: { campaignId: c.id, anonymousUserId, createdAt: { gte: dayStart } },
        });
        if (seenDay >= c.frequencyCapPerUserPerDay)
          reasons.push(
            `daily frequency cap reached for this user (${seenDay}/${c.frequencyCapPerUserPerDay} today)`,
          );
      }
    }

    candidates.push({
      campaignId: c.id,
      campaignName: c.name,
      advertiser: c.advertiser.businessName,
      priority: c.priority,
      weight: l.weight,
      eligible: reasons.length === 0,
      excluded: reasons,
      approvedCreatives: approved.length,
    });
  }

  const eligible = candidates.filter((c) => c.eligible);
  const willServe = eligible.length > 0;

  return {
    ok: willServe,
    stage: willServe ? "selectable" : "selection",
    platform: platformSlug,
    placementKey,
    placementStatus: placement.status,
    totalCampaignLinks: candidates.length,
    eligibleCampaigns: eligible.length,
    candidates,
    hint: willServe
      ? "Engine will serve an ad. If your host app still shows nothing, check the network tab for CORS or env-var errors."
      : "Assign an ACTIVE campaign (with at least one APPROVED creative) to this placement.",
  };
}
