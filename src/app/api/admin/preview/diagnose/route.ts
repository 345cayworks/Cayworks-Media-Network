import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, STAFF_ROLES } from "@/lib/auth";
import { diagnoseForPlatform } from "@/lib/ad-diagnose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/preview/diagnose — admin-only diagnostic (session auth).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("platform");
  const placementKey = url.searchParams.get("placement");
  if (!slug || !placementKey) {
    return NextResponse.json(
      { ok: false, error: "Missing platform or placement" },
      { status: 400 },
    );
  }
  const platform = await prisma.platform.findUnique({ where: { slug } });
  if (!platform) {
    return NextResponse.json(
      { ok: false, error: "Unknown platform" },
      { status: 404 },
    );
  }
  const result = await diagnoseForPlatform(
    platform.slug,
    platform.id,
    placementKey,
    url.searchParams.get("anonymousUserId"),
  );
  return NextResponse.json(result);
}
