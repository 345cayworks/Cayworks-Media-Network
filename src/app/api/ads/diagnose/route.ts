import { NextResponse } from "next/server";
import { authenticatePlatform } from "@/lib/platform-auth";
import { diagnoseForPlatform } from "@/lib/ad-diagnose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /api/ads/diagnose — explains why /api/ads/serve would return ad:null
 * for a given platform+placement. Same API-key auth as /serve.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("platform");
  const placementKey = url.searchParams.get("placement");

  const auth = await authenticatePlatform(req, slug);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, stage: "auth", error: auth.error },
      { status: auth.status },
    );
  }
  if (!placementKey) {
    return NextResponse.json(
      { ok: false, stage: "input", error: "Missing placement" },
      { status: 400 },
    );
  }

  const result = await diagnoseForPlatform(
    auth.platform.slug,
    auth.platform.id,
    placementKey,
    url.searchParams.get("anonymousUserId"),
  );
  return NextResponse.json(result);
}
