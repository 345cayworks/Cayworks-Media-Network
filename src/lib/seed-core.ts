import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateApiKey } from "./api-key";

type SeedablePlatform = {
  name: string;
  slug: string;
  placements: {
    key: string;
    name: string;
    type: "BANNER" | "SIDEBAR" | "CARD" | "NATIVE" | "VIDEO";
  }[];
};

// Platforms baked in on every fresh deploy. Toggle ACTIVE/INACTIVE from the
// admin dashboard or the Platforms page — no redeploy needed.
export const PLATFORMS: SeedablePlatform[] = [
  {
    name: "CayRentManager",
    slug: "cayrentmanager",
    placements: [
      { key: "landlord_dashboard_top", name: "Landlord Dashboard Top", type: "BANNER" },
      { key: "tenant_portal_sidebar", name: "Tenant Portal Sidebar", type: "SIDEBAR" },
      { key: "maintenance_request_vendor_card", name: "Maintenance Vendor Card", type: "CARD" },
      { key: "billing_page_partner_offer", name: "Billing Page Partner Offer", type: "NATIVE" },
      { key: "lease_page_legal_services", name: "Lease Page Legal Services", type: "CARD" },
      { key: "property_compliance_partner", name: "Property Compliance Partner", type: "CARD" },
    ],
  },
  {
    name: "ASI Cayman Portal",
    slug: "asicayman",
    placements: [
      { key: "asi_dashboard_top", name: "Member Dashboard Top", type: "BANNER" },
      { key: "asi_portal_sidebar", name: "Portal Sidebar", type: "SIDEBAR" },
      { key: "asi_claims_partner_offer", name: "Claims Partner Offer", type: "NATIVE" },
      { key: "asi_documents_footer_card", name: "Documents Footer Card", type: "CARD" },
    ],
  },
  {
    name: "Clarity Finance",
    slug: "clarityfinance",
    placements: [
      { key: "clarity_dashboard_top", name: "Dashboard Top", type: "BANNER" },
      { key: "clarity_budget_sidebar", name: "Budget Sidebar", type: "SIDEBAR" },
      { key: "clarity_transactions_native", name: "Transactions Native", type: "NATIVE" },
      { key: "clarity_goals_partner_offer", name: "Goals Partner Offer", type: "CARD" },
    ],
  },
];

export type SeedResult = {
  superadminEmail: string;
  /** Raw API key per platform slug — only present for newly created platforms. */
  newPlatformKeys: Record<string, string>;
  log: string[];
};

/**
 * Idempotent seed. Safe to re-run: upserts everything; existing platform API
 * keys are never regenerated (so they stay valid).
 */
export async function runSeed(
  prisma: PrismaClient,
  opts: { email: string; password: string },
): Promise<SeedResult> {
  const log: string[] = [];
  const newPlatformKeys: Record<string, string> = {};
  const email = opts.email.toLowerCase().trim();

  const passwordHash = await bcrypt.hash(opts.password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, name: "Cayworks Superadmin", passwordHash, role: "SUPERADMIN" },
    update: { passwordHash, role: "SUPERADMIN" },
  });
  log.push(`Superadmin ready: ${email}`);

  const platforms = [];
  for (const p of PLATFORMS) {
    let platform = await prisma.platform.findUnique({ where: { slug: p.slug } });
    if (!platform) {
      const key = generateApiKey();
      platform = await prisma.platform.create({
        data: {
          name: p.name,
          slug: p.slug,
          apiKeyHash: key.hash,
          apiKeyPrefix: key.prefix,
          status: "ACTIVE",
          allowedDomains: [],
        },
      });
      newPlatformKeys[p.slug] = key.raw;
      log.push(`Platform created: ${p.slug} (API key issued)`);
    } else {
      log.push(`Platform exists: ${p.slug} (key unchanged)`);
    }
    for (const pl of p.placements) {
      await prisma.adPlacement.upsert({
        where: {
          platformId_placementKey: {
            platformId: platform.id,
            placementKey: pl.key,
          },
        },
        create: {
          platformId: platform.id,
          placementKey: pl.key,
          name: pl.name,
          placementType: pl.type,
          status: "ACTIVE",
          allowedSizes: ["300x250", "728x90"],
        },
        update: {},
      });
    }
    platforms.push(platform);
  }

  // No demo advertisers/campaigns/creatives are auto-created. Create those
  // through the admin UI; the seed only ensures the superadmin and the
  // bundled platforms (+ default placements) exist.

  return { superadminEmail: email, newPlatformKeys, log };
}
