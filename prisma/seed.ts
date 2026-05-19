import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateApiKey } from "../src/lib/api-key";

const prisma = new PrismaClient();

const CRM_PLACEMENTS = [
  { key: "landlord_dashboard_top", name: "Landlord Dashboard Top", type: "BANNER" as const },
  { key: "tenant_portal_sidebar", name: "Tenant Portal Sidebar", type: "SIDEBAR" as const },
  { key: "maintenance_request_vendor_card", name: "Maintenance Vendor Card", type: "CARD" as const },
  { key: "billing_page_partner_offer", name: "Billing Page Partner Offer", type: "NATIVE" as const },
  { key: "lease_page_legal_services", name: "Lease Page Legal Services", type: "CARD" as const },
  { key: "property_compliance_partner", name: "Property Compliance Partner", type: "CARD" as const },
];

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

  // CayRentManager platform (first integration target).
  let apiKeyNote = "(existing platform — key unchanged)";
  let platform = await prisma.platform.findUnique({
    where: { slug: "cayrentmanager" },
  });
  if (!platform) {
    const key = generateApiKey();
    platform = await prisma.platform.create({
      data: {
        name: "CayRentManager",
        slug: "cayrentmanager",
        apiKeyHash: key.hash,
        apiKeyPrefix: key.prefix,
        status: "ACTIVE",
        allowedDomains: [],
      },
    });
    apiKeyNote = key.raw;
  }
  console.log(`✓ Platform: cayrentmanager  API KEY: ${apiKeyNote}`);

  for (const p of CRM_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: {
        platformId_placementKey: {
          platformId: platform.id,
          placementKey: p.key,
        },
      },
      create: {
        platformId: platform.id,
        placementKey: p.key,
        name: p.name,
        placementType: p.type,
        status: "ACTIVE",
        allowedSizes: ["300x250", "728x90"],
      },
      update: {},
    });
  }
  console.log(`✓ ${CRM_PLACEMENTS.length} CayRentManager placements`);

  // Sample advertisers across the initial categories.
  const advertisers = [
    { businessName: "Cayman First Insurance", industry: "insurance" },
    { businessName: "Butterfield Bank", industry: "banking" },
    { businessName: "Island Pest Control", industry: "pest control" },
    { businessName: "Caribbean Legal Partners", industry: "legal" },
  ];

  for (const a of advertisers) {
    const adv = await prisma.advertiser.upsert({
      where: { id: `seed_${a.industry.replace(/\s+/g, "_")}` },
      create: {
        id: `seed_${a.industry.replace(/\s+/g, "_")}`,
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
        title: `${a.businessName}`,
        description: `Trusted ${a.industry} services for Cayman property owners.`,
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

    const placement = await prisma.adPlacement.findFirst({
      where: { platformId: platform.id, placementKey: "landlord_dashboard_top" },
    });
    if (placement) {
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
