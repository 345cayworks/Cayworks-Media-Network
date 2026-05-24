"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { campaignSchema } from "@/lib/validation";

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData);
  // Empty optional numeric fields -> undefined
  if (raw.dailyImpressionLimit === "") delete raw.dailyImpressionLimit;
  if (raw.totalImpressionLimit === "") delete raw.totalImpressionLimit;
  if (raw.frequencyCapPerUserPerHour === "") delete raw.frequencyCapPerUserPerHour;
  if (raw.frequencyCapPerUserPerDay === "") delete raw.frequencyCapPerUserPerDay;
  return campaignSchema.safeParse(raw);
}

export async function createCampaign(formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/campaigns/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  const c = await prisma.campaign.create({ data: parsed.data });
  await audit(user, "CREATE", "Campaign", c.id, { name: c.name });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${c.id}`);
}

export async function updateCampaign(id: string, formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/campaigns/${id}/edit?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  await prisma.campaign.update({ where: { id }, data: parsed.data });
  await audit(user, "UPDATE", "Campaign", id);
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`/admin/campaigns/${id}`);
}

export async function setCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED" | "ENDED" | "DRAFT",
) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaign.update({ where: { id }, data: { status } });
  await audit(user, `STATUS_${status}`, "Campaign", id);
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
}

export async function assignPlacement(campaignId: string, formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const placementId = String(formData.get("placementId") ?? "");
  const weight = Math.max(1, Number(formData.get("weight") ?? 1));
  if (!placementId) return;
  await prisma.campaignPlacement.upsert({
    where: { campaignId_placementId: { campaignId, placementId } },
    create: { campaignId, placementId, weight, status: "ACTIVE" },
    update: { weight, status: "ACTIVE" },
  });
  await audit(user, "ASSIGN_PLACEMENT", "Campaign", campaignId, { placementId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function deleteCampaign(id: string) {
  // Cascades to creatives, campaignPlacements, impressions/clicks/conversions,
  // and any invoice linkage. For routine pauses, use setCampaignStatus instead.
  const user = await requireRole(ADMIN_ROLES);
  const c = await prisma.campaign.findUnique({
    where: { id },
    select: { name: true, advertiserId: true },
  });
  await prisma.campaign.delete({ where: { id } });
  await audit(user, "DELETE", "Campaign", id, { name: c?.name });
  revalidatePath("/admin/campaigns");
  if (c?.advertiserId) revalidatePath(`/admin/advertisers/${c.advertiserId}`);
  redirect("/admin/campaigns");
}

export async function cloneCampaign(id: string) {
  // Duplicate the campaign (DRAFT) plus its creatives and placement
  // assignments. Link statuses are copied from the source — the cloned
  // campaign itself is DRAFT, so selection won't serve from it until an
  // admin activates the campaign.
  const user = await requireRole(STAFF_ROLES);
  const src = await prisma.campaign.findUnique({
    where: { id },
    include: { creatives: true, campaignPlacements: true },
  });
  if (!src) redirect("/admin/campaigns");

  const cloned = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        advertiserId: src.advertiserId,
        name: `${src.name} (Copy)`,
        objective: src.objective,
        startDate: src.startDate,
        endDate: src.endDate,
        budget: src.budget,
        pricingModel: src.pricingModel,
        status: "DRAFT",
        priority: src.priority,
        dailyImpressionLimit: src.dailyImpressionLimit,
        totalImpressionLimit: src.totalImpressionLimit,
        frequencyCapPerUserPerHour: src.frequencyCapPerUserPerHour,
        frequencyCapPerUserPerDay: src.frequencyCapPerUserPerDay,
      },
    });
    if (src.creatives.length > 0) {
      await tx.creative.createMany({
        data: src.creatives.map((cr) => ({
          campaignId: c.id,
          title: cr.title,
          description: cr.description,
          imageUrl: cr.imageUrl,
          videoUrl: cr.videoUrl,
          destinationUrl: cr.destinationUrl,
          ctaText: cr.ctaText,
          creativeType: cr.creativeType,
          width: cr.width,
          height: cr.height,
          approvalStatus: cr.approvalStatus,
          status: cr.status,
        })),
      });
    }
    if (src.campaignPlacements.length > 0) {
      await tx.campaignPlacement.createMany({
        data: src.campaignPlacements.map((cp) => ({
          campaignId: c.id,
          placementId: cp.placementId,
          status: cp.status,
          weight: cp.weight,
        })),
      });
    }
    return c;
  });

  await audit(user, "CLONE", "Campaign", cloned.id, { sourceId: id });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${cloned.id}`);
}

export async function setCampaignPlacementStatus(
  campaignId: string,
  placementId: string,
  status: "ACTIVE" | "PAUSED",
) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaignPlacement.update({
    where: { campaignId_placementId: { campaignId, placementId } },
    data: { status },
  });
  await audit(user, `LINK_${status}`, "CampaignPlacement", campaignId, {
    placementId,
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function removePlacement(campaignId: string, placementId: string) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaignPlacement.deleteMany({
    where: { campaignId, placementId },
  });
  await audit(user, "REMOVE_PLACEMENT", "Campaign", campaignId, { placementId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}
