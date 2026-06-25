import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import type { CampaignType, PlacementType } from "@prisma/client";

/**
 * Auto-publish keeps campaign ↔ placement assignments in lockstep, gated by
 * type: a campaign of type T is served on every ACTIVE placement of type T.
 *
 * Semantics (intentional):
 *  - ADDITIVE ONLY. We create the missing ACTIVE links and never touch an
 *    existing one. So a manually PAUSED link stays paused — pausing a link is
 *    the supported way to keep a campaign off a specific placement, and a
 *    re-activation won't override that choice.
 *  - Idempotent. Safe to call repeatedly (createMany + skipDuplicates).
 *  - "Available" = placement.status ACTIVE. Auto-registered placements land
 *    INACTIVE, so they're excluded until an admin activates them (which then
 *    back-fills via autoPublishPlacement).
 *
 * CampaignType is a strict subset of PlacementType, matched by exact name.
 */

// PlacementType values that a CampaignType can match. Placements outside this
// set (SIDEBAR / VIDEO / SKYSCRAPER) can never be auto-published because no
// campaign type maps to them.
const GATE_TYPES = ["BANNER", "CARD", "NATIVE"] as const;

function isGateType(t: PlacementType): t is PlacementType & CampaignType {
  return (GATE_TYPES as readonly string[]).includes(t);
}

/**
 * Assign an ACTIVE campaign to every ACTIVE placement whose type matches the
 * campaign's type and that isn't already linked. No-op unless the campaign is
 * ACTIVE. Returns the number of links created.
 */
export async function autoPublishCampaign(
  campaignId: string,
  actor: SessionUser | null,
): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, campaignType: true },
  });
  if (!campaign || campaign.status !== "ACTIVE") return 0;

  // Matching active placements (cast: CampaignType ⊆ PlacementType by name).
  const placements = await prisma.adPlacement.findMany({
    where: {
      status: "ACTIVE",
      placementType: campaign.campaignType as unknown as PlacementType,
    },
    select: { id: true },
  });
  if (placements.length === 0) return 0;

  const existing = await prisma.campaignPlacement.findMany({
    where: { campaignId, placementId: { in: placements.map((p) => p.id) } },
    select: { placementId: true },
  });
  const linked = new Set(existing.map((e) => e.placementId));
  const toCreate = placements.filter((p) => !linked.has(p.id));
  if (toCreate.length === 0) return 0;

  await prisma.campaignPlacement.createMany({
    data: toCreate.map((p) => ({
      campaignId,
      placementId: p.id,
      status: "ACTIVE" as const,
      weight: 1,
    })),
    skipDuplicates: true,
  });

  await audit(actor, "AUTO_PUBLISH_CAMPAIGN", "Campaign", campaignId, {
    campaignType: campaign.campaignType,
    placementsAdded: toCreate.length,
  });
  return toCreate.length;
}

/**
 * Back-fill: when a placement is activated, assign it to every ACTIVE campaign
 * whose type matches and that isn't already linked. No-op unless the placement
 * is ACTIVE and its type is one a campaign can target. Returns links created.
 */
export async function autoPublishPlacement(
  placementId: string,
  actor: SessionUser | null,
): Promise<number> {
  const placement = await prisma.adPlacement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, placementType: true },
  });
  if (!placement || placement.status !== "ACTIVE") return 0;
  if (!isGateType(placement.placementType)) return 0;

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      campaignType: placement.placementType as unknown as CampaignType,
    },
    select: { id: true },
  });
  if (campaigns.length === 0) return 0;

  const existing = await prisma.campaignPlacement.findMany({
    where: { placementId, campaignId: { in: campaigns.map((c) => c.id) } },
    select: { campaignId: true },
  });
  const linked = new Set(existing.map((e) => e.campaignId));
  const toCreate = campaigns.filter((c) => !linked.has(c.id));
  if (toCreate.length === 0) return 0;

  await prisma.campaignPlacement.createMany({
    data: toCreate.map((c) => ({
      campaignId: c.id,
      placementId,
      status: "ACTIVE" as const,
      weight: 1,
    })),
    skipDuplicates: true,
  });

  await audit(actor, "AUTO_PUBLISH_PLACEMENT", "AdPlacement", placementId, {
    placementType: placement.placementType,
    campaignsAdded: toCreate.length,
  });
  return toCreate.length;
}
