import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticatePlatform } from "@/lib/platform-auth";
import { detectDevice, hashIp, clientIp } from "@/lib/request-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

const bodySchema = z.object({
  adId: z.string().optional(),
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  placementId: z.string().min(1),
  platform: z.string().min(1),
  anonymousUserId: z.string().optional().nullable(),
  userRole: z.string().optional().nullable(),
  pageUrl: z.string().optional().nullable(),
});

/** POST /api/ads/impression — record one served impression. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 },
    );
  }
  const b = parsed.data;

  const auth = await authenticatePlatform(req, b.platform);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  try {
    await prisma.adImpression.create({
      data: {
        campaignId: b.campaignId,
        creativeId: b.creativeId,
        placementId: b.placementId,
        platformId: auth.platform.id,
        anonymousUserId: b.anonymousUserId ?? null,
        userRole: b.userRole ?? null,
        pageUrl: b.pageUrl ?? null,
        deviceType: detectDevice(req.headers.get("user-agent")),
        ipHash: hashIp(clientIp(req.headers)),
        userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ads/impression] write failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not record impression" },
      { status: 500 },
    );
  }
}
