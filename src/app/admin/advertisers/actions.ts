"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { advertiserSchema } from "@/lib/validation";

function parse(formData: FormData) {
  return advertiserSchema.safeParse(Object.fromEntries(formData));
}

export async function createAdvertiser(formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/advertisers/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  const a = await prisma.advertiser.create({ data: parsed.data });
  await audit(user, "CREATE", "Advertiser", a.id, { name: a.businessName });
  revalidatePath("/admin/advertisers");
  // Support inline-from-another-flow creation: hidden `return` field sends
  // the operator straight back where they came from (e.g. the campaign form).
  const ret = String(formData.get("return") ?? "");
  if (ret.startsWith("/admin/")) {
    const sep = ret.includes("?") ? "&" : "?";
    redirect(`${ret}${sep}advertiserId=${a.id}`);
  }
  redirect(`/admin/advertisers/${a.id}`);
}

export async function updateAdvertiser(id: string, formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`/admin/advertisers/${id}/edit?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }
  await prisma.advertiser.update({ where: { id }, data: parsed.data });
  await audit(user, "UPDATE", "Advertiser", id);
  revalidatePath(`/admin/advertisers/${id}`);
  redirect(`/admin/advertisers/${id}`);
}

export async function setAdvertiserStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  const user = await requireRole(ADMIN_ROLES);
  await prisma.advertiser.update({ where: { id }, data: { status } });
  await audit(user, status === "ACTIVE" ? "ACTIVATE" : "DEACTIVATE", "Advertiser", id);
  revalidatePath("/admin/advertisers");
  revalidatePath(`/admin/advertisers/${id}`);
}

export async function bulkSetAdvertiserStatus(
  status: "ACTIVE" | "INACTIVE" | "PROSPECT",
  formData: FormData,
) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("advertiserId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/advertisers");
    return;
  }
  await prisma.advertiser.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  await audit(user, `STATUS_BULK_${status}`, "Advertiser", null, {
    count: ids.length,
  });
  revalidatePath("/admin/advertisers");
}

export async function bulkDeleteAdvertisers(formData: FormData) {
  const user = await requireRole(ADMIN_ROLES);
  const ids = formData
    .getAll("advertiserId")
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) {
    revalidatePath("/admin/advertisers");
    return;
  }
  await prisma.advertiser.deleteMany({ where: { id: { in: ids } } });
  await audit(user, "DELETE_BULK", "Advertiser", null, { count: ids.length });
  revalidatePath("/admin/advertisers");
  revalidatePath("/admin/campaigns");
}

export async function deleteAdvertiser(id: string) {
  // Hard delete cascades campaigns → creatives → impressions/clicks/etc.
  // (See schema onDelete: Cascade). Prefer deactivate for routine pauses;
  // this is for permanent removal.
  const user = await requireRole(ADMIN_ROLES);
  const a = await prisma.advertiser.findUnique({
    where: { id },
    select: { businessName: true },
  });
  await prisma.advertiser.delete({ where: { id } });
  await audit(user, "DELETE", "Advertiser", id, { name: a?.businessName });
  revalidatePath("/admin/advertisers");
  redirect("/admin/advertisers");
}
