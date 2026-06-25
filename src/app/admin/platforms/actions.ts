"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateApiKey } from "@/lib/api-key";
import { stashKey } from "@/lib/platform-key-flash";
import { platformSchema, placementSchema } from "@/lib/validation";
import { autoPublishPlacement } from "@/lib/auto-publish";

export async function createPlatform(formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const parsed = platformSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin/platforms/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  const key = generateApiKey();
  const p = await prisma.platform.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      allowedDomains: parsed.data.allowedDomains,
      apiKeyHash: key.hash,
      apiKeyPrefix: key.prefix,
    },
  });
  await audit(user, "CREATE", "Platform", p.id, { slug: p.slug });
  stashKey(p.id, key.raw);
  revalidatePath("/admin/platforms");
  redirect(`/admin/platforms/${p.id}`);
}

export async function updatePlatform(id: string, formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const parsed = platformSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin/platforms/${id}/edit?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  await prisma.platform.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      allowedDomains: parsed.data.allowedDomains,
    },
  });
  await audit(user, "UPDATE", "Platform", id);
  revalidatePath(`/admin/platforms/${id}`);
  redirect(`/admin/platforms/${id}`);
}

export async function regenerateApiKey(id: string) {
  const user = await requireRole(ADMIN_ROLES);
  const key = generateApiKey();
  await prisma.platform.update({
    where: { id },
    data: { apiKeyHash: key.hash, apiKeyPrefix: key.prefix },
  });
  await audit(user, "REGENERATE_API_KEY", "Platform", id);
  stashKey(id, key.raw);
  revalidatePath(`/admin/platforms/${id}`);
  redirect(`/admin/platforms/${id}`);
}

export async function setPlatformStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
) {
  const user = await requireRole(ADMIN_ROLES);
  await prisma.platform.update({ where: { id }, data: { status } });
  await audit(user, `PLATFORM_${status}`, "Platform", id);
  // An INACTIVE platform's API key is rejected at /api/ads/serve, so this
  // instantly switches that platform's ads off network-wide.
  revalidatePath("/admin");
  revalidatePath("/admin/platforms");
  revalidatePath(`/admin/platforms/${id}`);
}

export async function bulkSetPlatformStatus(
  status: "ACTIVE" | "INACTIVE",
  formData: FormData,
) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("platformId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/platforms");
    return;
  }
  await prisma.platform.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  await audit(user, `STATUS_BULK_${status}`, "Platform", null, {
    count: ids.length,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/platforms");
}

export async function bulkDeletePlatforms(formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("platformId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/platforms");
    return;
  }
  await prisma.platform.deleteMany({ where: { id: { in: ids } } });
  await audit(user, "DELETE_BULK", "Platform", null, { count: ids.length });
  revalidatePath("/admin");
  revalidatePath("/admin/platforms");
}

export async function createPlacement(platformId: string, formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const raw = { ...Object.fromEntries(formData), platformId };
  const parsed = placementSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/admin/platforms/${platformId}?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  const placement = await prisma.adPlacement.create({ data: parsed.data });
  await audit(user, "CREATE", "AdPlacement", platformId, {
    placementKey: parsed.data.placementKey,
  });
  // A placement created ACTIVE back-fills onto matching active campaigns.
  if (placement.status === "ACTIVE") await autoPublishPlacement(placement.id, user);
  revalidatePath(`/admin/platforms/${platformId}`);
}

export async function setPlacementStatus(
  placementId: string,
  platformId: string,
  status: "ACTIVE" | "INACTIVE",
) {
  const user = await requireRole(ADMIN_ROLES);
  await prisma.adPlacement.update({ where: { id: placementId }, data: { status } });
  await audit(user, `PLACEMENT_${status}`, "AdPlacement", placementId);
  // Activating a placement back-fills it onto matching active campaigns.
  if (status === "ACTIVE") await autoPublishPlacement(placementId, user);
  revalidatePath(`/admin/platforms/${platformId}`);
}

export async function updatePlacement(
  placementId: string,
  platformId: string,
  formData: FormData,
) {
  const user = await requireRole(ADMIN_ROLES);
  const raw = { ...Object.fromEntries(formData), platformId };
  const parsed = placementSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(
      `/admin/platforms/${platformId}/placements/${placementId}/edit?error=${encodeURIComponent(parsed.error.errors[0].message)}`,
    );
  }
  await prisma.adPlacement.update({
    where: { id: placementId },
    data: {
      placementKey: parsed.data.placementKey,
      name: parsed.data.name,
      description: parsed.data.description,
      placementType: parsed.data.placementType,
      status: parsed.data.status,
      allowedSizes: parsed.data.allowedSizes,
    },
  });
  await audit(user, "UPDATE", "AdPlacement", placementId);
  // Edit can flip the placement to ACTIVE or change its type — back-fill.
  if (parsed.data.status === "ACTIVE") await autoPublishPlacement(placementId, user);
  revalidatePath(`/admin/platforms/${platformId}`);
  redirect(`/admin/platforms/${platformId}`);
}

export async function deletePlacement(
  placementId: string,
  platformId: string,
) {
  // Cascades to CampaignPlacement links + impressions/clicks/conversions
  // on this placement (see schema onDelete: Cascade).
  const user = await requireRole(ADMIN_ROLES);
  const p = await prisma.adPlacement.findUnique({
    where: { id: placementId },
    select: { placementKey: true },
  });
  await prisma.adPlacement.delete({ where: { id: placementId } });
  await audit(user, "DELETE", "AdPlacement", placementId, {
    placementKey: p?.placementKey,
  });
  revalidatePath(`/admin/platforms/${platformId}`);
}
