import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticatePlatform } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /api/ads/diagnose — explains why /api/ads/serve would return ad:null
 * for a given platform+placement. Same API-key auth as /serve. Useful for
 * verifying integrations from the host app without admin access.
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

  const placement = await prisma.adPlacement.findFirst({
    where: { platformId: auth.platform.id, placementKey },
  });
  if (!placement) {
    return NextResponse.json({
      ok: false,
      stage: "placement",
      reason: "Placement does not exist on this platform",
      hint: "Check the placementKey spelling — see /admin/platforms",
      platform: auth.platform.slug,
    });
  }
  if (placement.status !== "ACTIVE") {
    return NextResponse.json({
      ok: false,
      stage: "placement",
      reason: `Placement status is ${placement.status}`,
      hint: "Activate it in /admin/platforms",
    });
  }

  const now = new Date();
  const links = await prisma.campaignPlacement.findMany({
    where: { placementId: placement.id },
    include: {
      campaign: { include: { advertiser: true, creatives: true } },
    },
  });

  const candidates = links.map((l) => {
    const c = l.campaign;
    const reasons: string[] = [];
    if (l.status !== "ACTIVE") reasons.push(`link ${l.status}`);
    if (c.status !== "ACTIVE") reasons.push(`campaign ${c.status}`);
    if (c.startDate > now) reasons.push("not yet started");
    if (c.endDate < now) reasons.push("ended");
    if (c.advertiser.status !== "ACTIVE")
      reasons.push(`advertiser ${c.advertiser.status}`);
    if (c.advertiser.billingStatus === "ON_HOLD")
      reasons.push("billing ON_HOLD");
    const approved = c.creatives.filter(
      (cr) => cr.approvalStatus === "APPROVED" && cr.status === "ACTIVE",
    );
    if (approved.length === 0)
      reasons.push("no APPROVED + ACTIVE creatives");
    return {
      campaignId: c.id,
      campaignName: c.name,
      advertiser: c.advertiser.businessName,
      priority: c.priority,
      weight: l.weight,
      eligible: reasons.length === 0,
      excluded: reasons,
      approvedCreatives: approved.length,
    };
  });

  const eligible = candidates.filter((c) => c.eligible);
  const willServe = eligible.length > 0;

  return NextResponse.json({
    ok: willServe,
    stage: willServe ? "selectable" : "selection",
    platform: auth.platform.slug,
    placementKey,
    placementStatus: placement.status,
    totalCampaignLinks: candidates.length,
    eligibleCampaigns: eligible.length,
    candidates,
    hint: willServe
      ? "Engine will serve an ad. If your app still shows nothing, check the network tab for CORS/JS errors on the host page."
      : "Assign an ACTIVE campaign (with at least one APPROVED creative) to this placement.",
  });
}
