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

const ADVERTISERS = [
  { businessName: "Cayman First Insurance", industry: "insurance" },
  { businessName: "Butterfield Bank", industry: "banking" },
  { businessName: "Island Pest Control", industry: "pest control" },
  { businessName: "Caribbean Legal Partners", industry: "legal" },
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

  for (const a of ADVERTISERS) {
    const id = `seed_${a.industry.replace(/\s+/g, "_")}`;
    const adv = await prisma.advertiser.upsert({
      where: { id },
      create: {
        id,
        businessName: a.businessName,
        contactName: "Account Manager",
        email: `ads@${a.businessName.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        industry: a.industry,
        status: "ACTIVE",
        billingStatus: "CURRENT",
      },
      update: {},
    });

    const now = new Date();
    const end = new Date(now.getTime() + 60 * 86400000);
    const campaign = await prisma.campaign.upsert({
      where: { id: `seedcamp_${adv.id}` },
      create: {
        id: `seedcamp_${adv.id}`,
        advertiserId: adv.id,
        name: `${a.businessName} — Q3 Awareness`,
        objective: "AWARENESS",
        startDate: new Date(now.getTime() - 86400000),
        endDate: end,
        budget: 5000,
        pricingModel: "CPM",
        status: "ACTIVE",
        priority: 5,
      },
      update: { status: "ACTIVE", endDate: end },
    });

    await prisma.creative.upsert({
      where: { id: `seedcr_${adv.id}` },
      create: {
        id: `seedcr_${adv.id}`,
        campaignId: campaign.id,
        title: a.businessName,
        description: `Trusted ${a.industry} services for Cayman customers.`,
        imageUrl: "https://placehold.co/600x300/1f6feb/ffffff/png",
        destinationUrl: "https://www.cayworks.example",
        ctaText: "Learn more",
        creativeType: "IMAGE",
        width: 600,
        height: 300,
        approvalStatus: "APPROVED",
        status: "ACTIVE",
      },
      update: { approvalStatus: "APPROVED" },
    });

    for (const platform of platforms) {
      const placement = await prisma.adPlacement.findFirst({
        where: { platformId: platform.id },
        orderBy: { createdAt: "asc" },
      });
      if (!placement) continue;
      await prisma.campaignPlacement.upsert({
        where: {
          campaignId_placementId: {
            campaignId: campaign.id,
            placementId: placement.id,
          },
        },
        create: {
          campaignId: campaign.id,
          placementId: placement.id,
          status: "ACTIVE",
          weight: 1,
        },
        update: { status: "ACTIVE" },
      });
    }
  }
  log.push(`${ADVERTISERS.length} sample advertisers + campaigns + creatives`);

  // ---- Delivery test: one image + one video creative, high priority,
  // assigned to EVERY placement on EVERY platform so ad delivery can be
  // verified immediately on any placement. Idempotent.
  const demoAdv = await prisma.advertiser.upsert({
    where: { id: "seed_delivery_test" },
    create: {
      id: "seed_delivery_test",
      businessName: "Cayworks Ad Engine — Delivery Test",
      contactName: "Cayworks",
      email: "adengine@cayworks.example",
      industry: "real estate",
      status: "ACTIVE",
      billingStatus: "CURRENT",
    },
    update: {},
  });

  const now = new Date();
  const demoCampaign = await prisma.campaign.upsert({
    where: { id: "seedcamp_delivery_test" },
    create: {
      id: "seedcamp_delivery_test",
      advertiserId: demoAdv.id,
      name: "Delivery Test (image + video)",
      objective: "AWARENESS",
      startDate: new Date(now.getTime() - 86400000),
      endDate: new Date(now.getTime() + 365 * 86400000),
      budget: 0,
      pricingModel: "HOUSE",
      status: "ACTIVE",
      priority: 10,
    },
    update: {
      status: "ACTIVE",
      priority: 10,
      endDate: new Date(now.getTime() + 365 * 86400000),
    },
  });

  await prisma.creative.upsert({
    where: { id: "seedcr_test_image" },
    create: {
      id: "seedcr_test_image",
      campaignId: demoCampaign.id,
      title: "Sample Image Ad",
      description: "Delivery test — static image creative.",
      imageUrl:
        "https://placehold.co/728x180/1f6feb/ffffff/png?text=Cayworks+Sample+Ad",
      destinationUrl: "https://www.cayworks.example",
      ctaText: "Learn more",
      creativeType: "IMAGE",
      width: 728,
      height: 180,
      approvalStatus: "APPROVED",
      status: "ACTIVE",
    },
    update: { approvalStatus: "APPROVED", status: "ACTIVE" },
  });

  await prisma.creative.upsert({
    where: { id: "seedcr_test_video" },
    create: {
      id: "seedcr_test_video",
      campaignId: demoCampaign.id,
      title: "Sample Video Ad",
      description: "Delivery test — YouTube video creative.",
      videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      destinationUrl: "https://www.cayworks.example",
      ctaText: "Watch & learn more",
      creativeType: "VIDEO",
      approvalStatus: "APPROVED",
      status: "ACTIVE",
    },
    update: { approvalStatus: "APPROVED", status: "ACTIVE" },
  });

  let links = 0;
  for (const platform of platforms) {
    const placements = await prisma.adPlacement.findMany({
      where: { platformId: platform.id },
      select: { id: true },
    });
    for (const pl of placements) {
      await prisma.campaignPlacement.upsert({
        where: {
          campaignId_placementId: {
            campaignId: demoCampaign.id,
            placementId: pl.id,
          },
        },
        create: {
          campaignId: demoCampaign.id,
          placementId: pl.id,
          status: "ACTIVE",
          weight: 5,
        },
        update: { status: "ACTIVE", weight: 5 },
      });
      links++;
    }
  }
  log.push(
    `Delivery-test campaign (sample image + sample video) on ${links} placements`,
  );

  return { superadminEmail: email, newPlatformKeys, log };
}
