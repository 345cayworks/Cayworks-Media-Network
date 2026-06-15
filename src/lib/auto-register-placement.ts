import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const VARIANT_TO_TYPE: Record<string, "BANNER" | "CARD" | "NATIVE" | "VIDEO" | "SKYSCRAPER" | "SIDEBAR"> = {
  banner: "BANNER",
  card: "CARD",
  native: "NATIVE",
  video: "VIDEO",
  skyscraper: "SKYSCRAPER",
  sidebar: "SIDEBAR",
};

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Idempotently create an AdPlacement row for an unknown placementKey hit
 * via /api/ads/serve. Lands in INACTIVE so it doesn't start serving until
 * an admin reviews it. Returns true if a row was created on this call.
 *
 * Hints from the plugin (variant, w, h) are used to seed the placement's
 * type and allowedSizes; admin can adjust on review.
 */
export async function autoRegisterPlacement(args: {
  platformId: string;
  placementKey: string;
  variant?: string | null;
  width?: number;
  height?: number;
  pageUrl?: string | null;
}): Promise<boolean> {
  const existing = await prisma.adPlacement.findFirst({
    where: { platformId: args.platformId, placementKey: args.placementKey },
    select: { id: true },
  });
  if (existing) return false;

  const variantKey = (args.variant ?? "").toLowerCase();
  const placementType = VARIANT_TO_TYPE[variantKey] ?? "BANNER";
  const allowedSizes =
    args.width && args.height && args.width > 0 && args.height > 0
      ? [`${Math.round(args.width)}x${Math.round(args.height)}`]
      : [];

  try {
    const created = await prisma.adPlacement.create({
      data: {
        platformId: args.platformId,
        placementKey: args.placementKey,
        name: humanize(args.placementKey),
        placementType,
        allowedSizes,
        status: "INACTIVE",
        autoRegisteredAt: new Date(),
        description: args.pageUrl
          ? `Auto-registered from ${args.pageUrl}`
          : "Auto-registered on first impression",
      },
    });
    await audit(null, "AUTO_REGISTER_PLACEMENT", "AdPlacement", created.id, {
      placementKey: args.placementKey,
      platformId: args.platformId,
      placementType,
      allowedSizes,
    });
    return true;
  } catch {
    // Race condition: another request inserted the row first. Treat as
    // already-registered; the unique constraint protects us.
    return false;
  }
}
