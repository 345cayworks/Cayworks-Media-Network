import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticatePlatform } from "@/lib/platform-auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

const placementInput = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  type: z.enum(["BANNER", "SIDEBAR", "CARD", "NATIVE", "VIDEO", "SKYSCRAPER"]),
  allowedSizes: z.array(z.string().trim()).optional().default([]),
});

const bodySchema = z.object({
  platform: z.string().min(1),
  placements: z.array(placementInput).max(500),
});

/**
 * POST /api/platforms/sync-placements
 *
 * Host-push placement manifest: a partner platform sends the full list of
 * placement slots it currently exposes. The engine upserts each one by
 * (platformId, placementKey) and updates lastSyncedAt.
 *
 * Auth: same as the other public ad endpoints — X-Ad-Engine-Key header (or
 * ?apiKey=) for the matching `platform` slug.
 *
 * Optional ?prune=1 → mark placements that exist in the engine but are
 * missing from this manifest as INACTIVE (instead of deleting). Default
 * OFF: missing rows are reported in `stale` so an operator can decide.
 *
 * Response: { ok, created: [...], updated: [...], stale: [...], synced }
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0].message },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const auth = await authenticatePlatform(req, body.platform);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  const platform = auth.platform;

  const url = new URL(req.url);
  const prune = url.searchParams.get("prune") === "1";

  const incoming = new Map(body.placements.map((p) => [p.key, p]));
  const existing = await prisma.adPlacement.findMany({
    where: { platformId: platform.id },
    select: { id: true, placementKey: true, status: true },
  });
  const existingByKey = new Map(existing.map((p) => [p.placementKey, p]));

  const created: string[] = [];
  const updated: string[] = [];
  const stale: string[] = [];

  // Upsert each manifest entry.
  for (const p of body.placements) {
    const found = existingByKey.get(p.key);
    if (!found) {
      await prisma.adPlacement.create({
        data: {
          platformId: platform.id,
          placementKey: p.key,
          name: p.name,
          description: p.description ?? null,
          placementType: p.type,
          allowedSizes: p.allowedSizes ?? [],
          status: "ACTIVE",
        },
      });
      created.push(p.key);
    } else {
      await prisma.adPlacement.update({
        where: { id: found.id },
        data: {
          name: p.name,
          description: p.description ?? null,
          placementType: p.type,
          allowedSizes: p.allowedSizes ?? [],
          // If the operator previously deactivated it, re-activate on resync.
          status: "ACTIVE",
        },
      });
      updated.push(p.key);
    }
  }

  // Stale = exists in engine but not in this manifest.
  for (const e of existing) {
    if (!incoming.has(e.placementKey)) stale.push(e.placementKey);
  }
  if (prune && stale.length > 0) {
    await prisma.adPlacement.updateMany({
      where: {
        platformId: platform.id,
        placementKey: { in: stale },
        status: "ACTIVE",
      },
      data: { status: "INACTIVE" },
    });
  }

  const synced = new Date();
  await prisma.platform.update({
    where: { id: platform.id },
    data: { lastSyncedAt: synced },
  });

  await audit(null, "SYNC_PLACEMENTS", "Platform", platform.id, {
    created: created.length,
    updated: updated.length,
    stale: stale.length,
    pruned: prune,
  });

  return NextResponse.json({
    ok: true,
    platform: platform.slug,
    synced: synced.toISOString(),
    pruned: prune,
    created,
    updated,
    stale,
  });
}
