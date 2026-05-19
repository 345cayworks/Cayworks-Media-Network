import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateApiKey } from "../src/lib/api-key";

const prisma = new PrismaClient();

type SeedablePlatform = {
  name: string;
  slug: string;
  placements: { key: string; name: string; type: "BANNER" | "SIDEBAR" | "CARD" | "NATIVE" | "VIDEO" }[];
};

// Platforms baked in on every fresh deploy. Toggle ACTIVE/INACTIVE from the
// admin dashboard or the Platforms page — no redeploy needed.
const PLATFORMS: SeedablePlatform[] = [
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

async function seedPlatform(p: SeedablePlatform) {
  let keyNote = "(existing — key unchanged)";
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
    keyNote = key.raw;
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
  console.log(`✓ Platform ${p.slug} (${p.placements.length} placements)  API KEY: ${keyNote}`);
  return platform;
}

async function main() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? "admin@cayworks.example").toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, name: "Cayworks Superadmin", passwordHash, role: "SUPERADMIN" },
    update: { passwordHash, role: "SUPERADMIN" },
  });
  console.log(`✓ Superadmin: ${email} / ${password}`);

  const platforms = [];
  for (const p of PLATFORMS) platforms.push(await seedPlatform(p));

  // Sample advertisers across the initial categories.
  const advertisers = [
    { businessName: "Cayman First Insurance", industry: "insurance" },
    { businessName: "Butterfield Bank", industry: "banking" },
    { businessName: "Island Pest Control", industry: "pest control" },
    { businessName: "Caribbean Legal Partners", industry: "legal" },
  ];

  for (const a of advertisers) {
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

    // Assign the campaign to the first placement of every platform so all
    // baked-in platforms serve ads out of the box.
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
  console.log(`✓ ${advertisers.length} sample advertisers + campaigns + creatives`);
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
