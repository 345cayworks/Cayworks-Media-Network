import { NextResponse } from "next/server";
import { authenticatePlatform } from "@/lib/platform-auth";
import { selectAd, selectAdQueue } from "@/lib/ad-selection";
import { autoRegisterPlacement } from "@/lib/auto-register-placement";
import { prisma } from "@/lib/prisma";

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

  const selectParams = {
    platformId: auth.platform.id,
    placementKey,
    userRole: url.searchParams.get("userRole"),
    category: url.searchParams.get("category"),
    anonymousUserId: url.searchParams.get("anonymousUserId"),
  };

  // `count` requests a rotation queue; omitting it preserves the single-ad
  // response shape for existing integrations.
  const countRaw = url.searchParams.get("count");
  const count = countRaw ? Math.min(Math.max(parseInt(countRaw, 10) || 0, 1), 20) : 0;

  // Lazy auto-register: when the host requests a placement the engine has
  // never seen, create an INACTIVE AdPlacement row using the plugin's hints
  // (variant, w, h, pageUrl) so admins can review + activate. ?autoRegister=0
  // opts out per-request. Runs before selection so the row exists when an
  // operator goes looking; selection itself stays nullity-safe (selectAd
  // only returns rows in ACTIVE placements).
  const autoOn = url.searchParams.get("autoRegister") !== "0";
  if (autoOn) {
    const exists = await prisma.adPlacement.findFirst({
      where: { platformId: auth.platform.id, placementKey },
      select: { id: true },
    });
    if (!exists) {
      await autoRegisterPlacement({
        platformId: auth.platform.id,
        placementKey,
        variant: url.searchParams.get("variant"),
        width: parseInt(url.searchParams.get("w") ?? "0", 10) || undefined,
        height: parseInt(url.searchParams.get("h") ?? "0", 10) || undefined,
        pageUrl: url.searchParams.get("pageUrl"),
      });
    }
  }

  try {
    if (count > 0) {
      const ads = await selectAdQueue(selectParams, count);
      return NextResponse.json(
        { ads, ad: ads[0] ?? null },
        { status: 200, headers: noStore },
      );
    }
    const ad = await selectAd(selectParams);
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
