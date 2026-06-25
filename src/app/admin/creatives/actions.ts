"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { creativeSchema } from "@/lib/validation";
import { autoPublishCampaign, autoPublishForCreative } from "@/lib/auto-publish";

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
    redirect(
      `/admin/creatives/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`,
    );
  }
  const cr = await prisma.creative.create({ data: parsed.data });
  await audit(user, "CREATE", "Creative", cr.id, { title: cr.title });

  // Optional: attach to a campaign immediately if the form was opened from
  // one (`?attachTo=<campaignId>` carried as a hidden field).
  const attachTo = String(formData.get("attachTo") ?? "");
  if (attachTo) {
    await prisma.campaignCreative.upsert({
      where: {
        campaignId_creativeId: { campaignId: attachTo, creativeId: cr.id },
      },
      create: { campaignId: attachTo, creativeId: cr.id, status: "ACTIVE", weight: 1 },
      update: {},
    });
    await audit(user, "ATTACH", "CampaignCreative", attachTo, {
      creativeId: cr.id,
    });
    // Self-guards on campaign ACTIVE + creative APPROVED inside.
    await autoPublishCampaign(attachTo, user);
    revalidatePath(`/admin/campaigns/${attachTo}`);
    revalidatePath("/admin/creatives");
    redirect(`/admin/campaigns/${attachTo}`);
  }

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
  // Format/approval may have changed — re-publish any active campaigns using it.
  await autoPublishForCreative(id, user);
  revalidatePath(`/admin/creatives/${id}`);
  redirect(`/admin/creatives/${id}`);
}

export async function deleteCreative(id: string) {
  // Global delete — removes the creative from EVERY campaign it's linked to
  // and cascades its impressions/clicks. Use detachCreativeFromCampaign to
  // remove from a single campaign without affecting others.
  const user = await requireRole(ADMIN_ROLES);
  const cr = await prisma.creative.findUnique({
    where: { id },
    select: { title: true },
  });
  await prisma.creative.delete({ where: { id } });
  await audit(user, "DELETE", "Creative", id, { title: cr?.title });
  revalidatePath("/admin/creatives");
  redirect("/admin/creatives");
}

export async function setApproval(
  id: string,
  approvalStatus: "APPROVED" | "REJECTED" | "PENDING",
) {
  const user = await requireRole(ADMIN_ROLES);
  await prisma.creative.update({ where: { id }, data: { approvalStatus } });
  await audit(user, `APPROVAL_${approvalStatus}`, "Creative", id);
  // Approving makes it servable → publish the active campaigns that use it.
  if (approvalStatus === "APPROVED") await autoPublishForCreative(id, user);
  revalidatePath(`/admin/creatives/${id}`);
  revalidatePath("/admin/creatives");
  revalidatePath("/admin/approvals");
}

/** Bulk approve/reject for the Approvals inbox. Reads creativeId[] from the
 *  form payload and applies the same status to all of them. */
export async function bulkSetApproval(
  approvalStatus: "APPROVED" | "REJECTED",
  formData: FormData,
) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("creativeId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/approvals");
    return;
  }
  await prisma.creative.updateMany({
    where: { id: { in: ids } },
    data: { approvalStatus },
  });
  await audit(user, `APPROVAL_BULK_${approvalStatus}`, "Creative", null, {
    count: ids.length,
  });
  if (approvalStatus === "APPROVED") {
    for (const id of ids) await autoPublishForCreative(id, user);
  }
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/creatives");
}

/** Create a new creative and attach it to a campaign in one shot. Used by
 *  the drop-zone uploader on the campaign detail page. */
export async function createAndAttachCreative(
  campaignId: string,
  formData: FormData,
) {
  const user = await requireRole(STAFF_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(
      `/admin/campaigns/${campaignId}?error=${encodeURIComponent(parsed.error.errors[0].message)}`,
    );
  }
  const cr = await prisma.creative.create({ data: parsed.data });
  await prisma.campaignCreative.upsert({
    where: { campaignId_creativeId: { campaignId, creativeId: cr.id } },
    create: { campaignId, creativeId: cr.id, status: "ACTIVE", weight: 1 },
    update: { status: "ACTIVE" },
  });
  await audit(user, "CREATE_AND_ATTACH", "Creative", cr.id, { campaignId });
  await autoPublishCampaign(campaignId, user);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/creatives");
  redirect(`/admin/campaigns/${campaignId}`);
}

export async function bulkDeleteCreatives(formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("creativeId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/creatives");
    return;
  }
  await prisma.creative.deleteMany({ where: { id: { in: ids } } });
  await audit(user, "DELETE_BULK", "Creative", null, { count: ids.length });
  revalidatePath("/admin/creatives");
  revalidatePath("/admin/approvals");
}

/** Bulk-attach a Library multi-selection into a single target campaign.
 *  Reads creativeId[] + targetCampaignId from the form payload. */
export async function bulkAttachLibrarySelectionToCampaign(formData: FormData) {
  const user = await requireRole(STAFF_ROLES);
  const ids = formData
    .getAll("creativeId")
    .map((v) => String(v))
    .filter(Boolean);
  const targetCampaignId = String(formData.get("targetCampaignId") ?? "");
  if (ids.length === 0 || !targetCampaignId) {
    revalidatePath("/admin/creatives");
    return;
  }
  for (const creativeId of ids) {
    await prisma.campaignCreative.upsert({
      where: {
        campaignId_creativeId: { campaignId: targetCampaignId, creativeId },
      },
      create: {
        campaignId: targetCampaignId,
        creativeId,
        status: "ACTIVE",
        weight: 1,
      },
      update: { status: "ACTIVE" },
    });
  }
  await audit(user, "ATTACH_BULK_LIBRARY", "Campaign", targetCampaignId, {
    count: ids.length,
  });
  await autoPublishCampaign(targetCampaignId, user);
  revalidatePath("/admin/creatives");
  revalidatePath(`/admin/campaigns/${targetCampaignId}`);
}

/** Attach an existing creative to a campaign (idempotent, ACTIVE link). */
export async function attachCreativeToCampaign(
  creativeId: string,
  campaignId: string,
) {
  const user = await requireRole(STAFF_ROLES);
  if (!creativeId || !campaignId) {
    redirect("/admin/creatives?error=Missing+source+or+target");
  }
  await prisma.campaignCreative.upsert({
    where: { campaignId_creativeId: { campaignId, creativeId } },
    create: { campaignId, creativeId, status: "ACTIVE", weight: 1 },
    update: { status: "ACTIVE" },
  });
  await audit(user, "ATTACH", "CampaignCreative", campaignId, { creativeId });
  await autoPublishCampaign(campaignId, user);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/admin/creatives/${creativeId}`);
}

/** Remove a creative from one campaign without deleting the creative. */
export async function detachCreativeFromCampaign(
  creativeId: string,
  campaignId: string,
) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaignCreative.deleteMany({
    where: { campaignId, creativeId },
  });
  await audit(user, "DETACH", "CampaignCreative", campaignId, { creativeId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/admin/creatives/${creativeId}`);
}

/** Bulk-flip the status on many campaign-creative links of a single campaign. */
export async function bulkSetCampaignCreativeStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
  formData: FormData,
) {
  const user = await requireRole(STAFF_ROLES);
  const ids = formData
    .getAll("creativeId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath(`/admin/campaigns/${campaignId}`);
    return;
  }
  await prisma.campaignCreative.updateMany({
    where: { campaignId, creativeId: { in: ids } },
    data: { status },
  });
  await audit(user, `CREATIVE_LINK_BULK_${status}`, "Campaign", campaignId, {
    count: ids.length,
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

/** Bulk detach (remove the link only — creatives themselves stay). */
export async function bulkDetachCreativesFromCampaign(
  campaignId: string,
  formData: FormData,
) {
  const user = await requireRole(STAFF_ROLES);
  const ids = formData
    .getAll("creativeId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath(`/admin/campaigns/${campaignId}`);
    return;
  }
  await prisma.campaignCreative.deleteMany({
    where: { campaignId, creativeId: { in: ids } },
  });
  await audit(user, "DETACH_BULK", "Campaign", campaignId, { count: ids.length });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

/** Toggle ACTIVE / PAUSED on a single campaign-creative link. */
export async function setCampaignCreativeStatus(
  creativeId: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
) {
  const user = await requireRole(STAFF_ROLES);
  await prisma.campaignCreative.update({
    where: { campaignId_creativeId: { campaignId, creativeId } },
    data: { status },
  });
  await audit(user, `CREATIVE_LINK_${status}`, "CampaignCreative", campaignId, {
    creativeId,
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

