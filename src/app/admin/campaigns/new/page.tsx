import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "../CampaignForm";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage(
  props: {
    searchParams: Promise<{ error?: string; advertiserId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireRole(STAFF_ROLES);
  const advertisers = await prisma.advertiser.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" },
  });

  return (
    <div>
      <PageHeader title="New Campaign" />
      <CampaignForm
        action={createCampaign}
        advertisers={advertisers}
        defaultAdvertiserId={searchParams.advertiserId}
        error={searchParams.error}
      />
    </div>
  );
}
