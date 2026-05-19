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

export async function removePlacement(campaignId: string, placementId: string) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaignPlacement.deleteMany({
    where: { campaignId, placementId },
  });
  await audit(user, "REMOVE_PLACEMENT", "Campaign", campaignId, { placementId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}
