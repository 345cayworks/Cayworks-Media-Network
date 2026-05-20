import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, STAFF_ROLES } from "@/lib/auth";
import { selectAd } from "@/lib/ad-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/preview/serve — admin-only mirror of /api/ads/serve.
 * Uses the session cookie, so no API key is needed. Lets operators
 * verify selection without exposing the raw platform key.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ ad: null, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("platform");
  const placementKey = url.searchParams.get("placement");
  if (!slug || !placementKey) {
    return NextResponse.json(
      { ad: null, error: "Missing platform or placement" },
      { status: 400 },
    );
  }

  const platform = await prisma.platform.findUnique({ where: { slug } });
  if (!platform || platform.status !== "ACTIVE") {
    return NextResponse.json(
      { ad: null, error: "Unknown or inactive platform" },
      { status: 404 },
    );
  }

  const ad = await selectAd({
    platformId: platform.id,
    placementKey,
    userRole: url.searchParams.get("userRole"),
    category: url.searchParams.get("category"),
  });
  return NextResponse.json({ ad });
}
