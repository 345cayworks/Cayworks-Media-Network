import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import type { CreativeFormat, PlacementType } from "@prisma/client";

/**
 * Auto-publish keeps campaign ↔ placement assignments in lockstep by FORMAT.
 * A campaign is multi-format: it carries creatives, each tagged with a slot
 * format (Creative.format). The campaign auto-publishes to every ACTIVE
 * placement whose placementType matches a format it actually has an
 * APPROVED + ACTIVE creative for — so one campaign can feed a banner, a card
 * and a native slot at once, each from its matching creative.
 *
 * Semantics (intentional):
 *  - ADDITIVE ONLY. We create missing ACTIVE links and never touch an existing
 *    one, so a manually PAUSED link is the supported opt-out and survives
 *    re-publish.
 *  - Idempotent (createMany + skipDuplicates).
 *  - "Available" = placement.status ACTIVE; INACTIVE / auto-registered
 *    placements are excluded until an admin activates them.
 *
 * CreativeFormat and PlacementType share names, matched by exact value.
 */

/** Distinct slot formats a campaign can currently serve: the formats of its
 *  ACTIVE links to APPROVED + ACTIVE creatives. Empty unless the campaign is
 *  ACTIVE (callers gate on this to make activation the trigger). */
async function servableFormats(campaignId: string): Promise<PlacementType[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      creativeLinks: {
        where: {
          status: "ACTIVE",
          creative: { approvalStatus: "APPROVED", status: "ACTIVE" },
        },
        select: { creative: { select: { format: true } } },
      },
    },
  });
  if (!campaign || campaign.status !== "ACTIVE") return [];
  const formats = new Set(campaign.creativeLinks.map((l) => l.creative.format));
  return [...formats] as unknown as PlacementType[];
}

/**
 * Assign an ACTIVE campaign to every ACTIVE placement whose type matches one
 * of the campaign's servable creative formats and that isn't already linked.
 * No-op unless the campaign is ACTIVE with ≥1 approved creative. Returns the
 * number of links created.
 */
export async function autoPublishCampaign(
  campaignId: string,
  actor: SessionUser | null,
): Promise<number> {
  const formats = await servableFormats(campaignId);
  if (formats.length === 0) return 0;

  const placements = await prisma.adPlacement.findMany({
    where: { status: "ACTIVE", placementType: { in: formats } },
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
    formats,
    placementsAdded: toCreate.length,
  });
  return toCreate.length;
}

/**
 * Back-fill: when a placement is activated, assign it to every ACTIVE campaign
 * that has an APPROVED + ACTIVE creative of the placement's format and isn't
 * already linked. No-op unless the placement is ACTIVE. Returns links created.
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

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      creativeLinks: {
        some: {
          status: "ACTIVE",
          creative: {
            approvalStatus: "APPROVED",
            status: "ACTIVE",
            format: placement.placementType as unknown as CreativeFormat,
          },
        },
      },
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

/**
 * Re-publish every ACTIVE campaign linked to this creative. Call when a
 * creative becomes servable (approved) or its format changes, so a campaign
 * that was activated before its creatives were ready picks up the new
 * format's placements. Returns total links created.
 */
export async function autoPublishForCreative(
  creativeId: string,
  actor: SessionUser | null,
): Promise<number> {
  const links = await prisma.campaignCreative.findMany({
    where: { creativeId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
    select: { campaignId: true },
  });
  let created = 0;
  for (const { campaignId } of links) {
    created += await autoPublishCampaign(campaignId, actor);
  }
  return created;
}
