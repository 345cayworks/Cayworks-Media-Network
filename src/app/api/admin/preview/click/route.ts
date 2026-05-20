import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, STAFF_ROLES } from "@/lib/auth";
import { sanitizeDestination } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  placementId: z.string().min(1),
  platform: z.string().min(1),
});

/** Admin-only click mirror — for the /admin/test harness. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  const b = parsed.data;

  const platform = await prisma.platform.findUnique({
    where: { slug: b.platform },
  });
  if (!platform) {
    return NextResponse.json({ ok: false, error: "Unknown platform" }, { status: 404 });
  }

  const creative = await prisma.creative.findUnique({
    where: { id: b.creativeId },
    select: { destinationUrl: true },
  });
  const dest = sanitizeDestination(creative?.destinationUrl);
  if (!dest) {
    return NextResponse.json(
      { ok: false, error: "No valid destination" },
      { status: 422 },
    );
  }

  await prisma.adClick.create({
    data: {
      campaignId: b.campaignId,
      creativeId: b.creativeId,
      placementId: b.placementId,
      platformId: platform.id,
      destinationUrl: dest,
    },
  });
  return NextResponse.json({ ok: true, destinationUrl: dest });
}
