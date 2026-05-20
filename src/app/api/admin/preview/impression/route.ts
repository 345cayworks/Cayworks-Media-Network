import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, STAFF_ROLES } from "@/lib/auth";
import { detectDevice, hashIp, clientIp } from "@/lib/request-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  placementId: z.string().min(1),
  platform: z.string().min(1),
  userRole: z.string().optional().nullable(),
  pageUrl: z.string().optional().nullable(),
});

/** Admin-only impression mirror — for the /admin/test harness. */
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

  await prisma.adImpression.create({
    data: {
      campaignId: b.campaignId,
      creativeId: b.creativeId,
      placementId: b.placementId,
      platformId: platform.id,
      userRole: b.userRole ?? null,
      pageUrl: b.pageUrl ?? "/admin/test",
      deviceType: detectDevice(req.headers.get("user-agent")),
      ipHash: hashIp(clientIp(req.headers)),
      userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
    },
  });
  return NextResponse.json({ ok: true });
}
