import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CreativeForm } from "../CreativeForm";
import { createCreative } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: { campaignId?: string; error?: string };
}) {
  await requireRole(STAFF_ROLES);
  const campaigns = await prisma.campaign.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="New Creative" />
      <CreativeForm
        action={createCreative}
        campaigns={campaigns}
        defaultCampaignId={searchParams.campaignId}
        error={searchParams.error}
      />
    </div>
  );
}
