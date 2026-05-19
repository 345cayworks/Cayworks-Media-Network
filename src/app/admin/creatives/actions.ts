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
