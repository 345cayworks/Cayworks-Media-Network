"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { creativeSchema } from "@/lib/validation";

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData);
  if (raw.width === "") delete raw.width;
  if (raw.height === "") delete raw.height;
  return creativeSchema.safeParse(raw);
}

export async function createCreative(formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/creatives/new?campaignId=${formData.get("campaignId")}&error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  const cr = await prisma.creative.create({ data: parsed.data });
  await audit(user, "CREATE", "Creative", cr.id, { title: cr.title });
  revalidatePath("/admin/creatives");
  redirect(`/admin/creatives/${cr.id}`);
}

export async function updateCreative(id: string, formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/creatives/${id}/edit?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  await prisma.creative.update({ where: { id }, data: parsed.data });
  await audit(user, "UPDATE", "Creative", id);
  revalidatePath(`/admin/creatives/${id}`);
  redirect(`/admin/creatives/${id}`);
}

export async function deleteCreative(id: string) {
  // Cascades to impressions/clicks for this creative (per schema). For a
  // routine pause set status=INACTIVE in the edit form instead.
  const user = await requireRole(ADMIN_ROLES);
  const cr = await prisma.creative.findUnique({
    where: { id },
    select: { title: true, campaignId: true },
  });
  await prisma.creative.delete({ where: { id } });
  await audit(user, "DELETE", "Creative", id, { title: cr?.title });
  revalidatePath("/admin/creatives");
  if (cr?.campaignId) revalidatePath(`/admin/campaigns/${cr.campaignId}`);
  redirect(cr?.campaignId ? `/admin/campaigns/${cr.campaignId}` : "/admin/creatives");
}

export async function cloneCreative(
  sourceId: string,
  targetCampaignId: string,
) {
  // Reuse already-uploaded media (image/video URLs are shared — no
  // re-upload) by duplicating an existing creative into another campaign.
  // Lands the operator on the new creative's edit page to tweak per-campaign
  // copy/CTA. Re-set to PENDING so the new campaign's review still runs.
  const user = await requireRole(STAFF_ROLES);
  if (!sourceId || !targetCampaignId) {
    redirect("/admin/creatives?error=Missing+source+or+target");
  }
  const src = await prisma.creative.findUnique({ where: { id: sourceId } });
  if (!src) redirect("/admin/creatives?error=Source+creative+not+found");

  const cloned = await prisma.creative.create({
    data: {
      campaignId: targetCampaignId,
      title: src.title,
      description: src.description,
      imageUrl: src.imageUrl,
      videoUrl: src.videoUrl,
      destinationUrl: src.destinationUrl,
      ctaText: src.ctaText,
      creativeType: src.creativeType,
      width: src.width,
      height: src.height,
      approvalStatus: "PENDING",
      status: "ACTIVE",
    },
  });
  await audit(user, "CLONE", "Creative", cloned.id, {
    sourceId,
    targetCampaignId,
  });
  revalidatePath("/admin/creatives");
  revalidatePath(`/admin/campaigns/${targetCampaignId}`);
  redirect(`/admin/creatives/${cloned.id}/edit`);
}

export async function setApproval(
  id: string,
  approvalStatus: "APPROVED" | "REJECTED" | "PENDING",
) {
  // Approval is an admin-only gate.
  const user = await requireRole(ADMIN_ROLES);
  await prisma.creative.update({ where: { id }, data: { approvalStatus } });
  await audit(user, `APPROVAL_${approvalStatus}`, "Creative", id);
  revalidatePath(`/admin/creatives/${id}`);
  revalidatePath("/admin/creatives");
}
