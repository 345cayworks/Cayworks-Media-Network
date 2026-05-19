import { NextResponse } from "next/server";
import { authenticatePlatform } from "@/lib/platform-auth";
import { selectAd } from "@/lib/ad-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /api/ads/serve
 * Query: platform, placement, userRole, category?, pageUrl?
 * Returns a single ad payload or { ad: null } when nothing is eligible.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const platformSlug = url.searchParams.get("platform");
  const placementKey = url.searchParams.get("placement");

  const auth = await authenticatePlatform(req, platformSlug);
  if (!auth.ok) {
    return NextResponse.json(
      { ad: null, error: auth.error },
      { status: auth.status, headers: noStore },
    );
  }

  if (!placementKey) {
    return NextResponse.json(
      { ad: null, error: "Missing placement" },
      { status: 400, headers: noStore },
    );
  }

  try {
    const ad = await selectAd({
      platformId: auth.platform.id,
      placementKey,
      userRole: url.searchParams.get("userRole"),
      category: url.searchParams.get("category"),
    });

    // Graceful fallback: 200 with ad:null so the client simply hides the slot.
    return NextResponse.json({ ad }, { status: 200, headers: noStore });
  } catch (err) {
    console.error("[ads/serve] selection failed", err);
    return NextResponse.json(
      { ad: null, error: "Ad selection failed" },
      { status: 500, headers: noStore },
    );
  }
}
