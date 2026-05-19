import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticatePlatform } from "@/lib/platform-auth";
import { sanitizeDestination } from "@/lib/safe-redirect";

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
});

async function recordClick(input: {
  campaignId: string;
  creativeId: string;
  placementId: string;
  platformId: string;
  anonymousUserId?: string | null;
}): Promise<string | null> {
  // Destination is always read from the stored creative, never trusted from
  // the client, then sanitized to block open-redirect abuse.
  const creative = await prisma.creative.findUnique({
    where: { id: input.creativeId },
    select: { destinationUrl: true },
  });
  const dest = sanitizeDestination(creative?.destinationUrl);
  if (!dest) return null;

  await prisma.adClick.create({
    data: {
      campaignId: input.campaignId,
      creativeId: input.creativeId,
      placementId: input.placementId,
      platformId: input.platformId,
      anonymousUserId: input.anonymousUserId ?? null,
      destinationUrl: dest,
    },
  });
  return dest;
}

/** POST /api/ads/click — record a click, return the safe destination URL. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  const b = parsed.data;

  const auth = await authenticatePlatform(req, b.platform);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const dest = await recordClick({
      campaignId: b.campaignId,
      creativeId: b.creativeId,
      placementId: b.placementId,
      platformId: auth.platform.id,
      anonymousUserId: b.anonymousUserId,
    });
    if (!dest) {
      return NextResponse.json(
        { ok: false, error: "No valid destination" },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, destinationUrl: dest });
  } catch (err) {
    console.error("[ads/click] write failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not record click" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/ads/click — redirect-style click tracking. Records the click and
 * issues a 302 to the sanitized destination so it can be used as a plain href.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k);

  const auth = await authenticatePlatform(req, q("platform"));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const campaignId = q("campaignId");
  const creativeId = q("creativeId");
  const placementId = q("placementId");
  if (!campaignId || !creativeId || !placementId) {
    return NextResponse.json(
      { ok: false, error: "Missing tracking parameters" },
      { status: 400 },
    );
  }

  try {
    const dest = await recordClick({
      campaignId,
      creativeId,
      placementId,
      platformId: auth.platform.id,
      anonymousUserId: q("anonymousUserId"),
    });
    if (!dest) {
      return NextResponse.json(
        { ok: false, error: "No valid destination" },
        { status: 422 },
      );
    }
    return NextResponse.redirect(dest, 302);
  } catch (err) {
    console.error("[ads/click] redirect failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not record click" },
      { status: 500 },
    );
  }
}
