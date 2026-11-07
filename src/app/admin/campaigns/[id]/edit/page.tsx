import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "../../CampaignForm";
import { updateCampaign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireRole(STAFF_ROLES);
  const [campaign, advertisers] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: params.id } }),
    prisma.advertiser.findMany({
      select: { id: true, businessName: true },
      orderBy: { businessName: "asc" },
    }),
  ]);
  if (!campaign) notFound();

  return (
    <div>
      <PageHeader title={`Edit — ${campaign.name}`} />
      <CampaignForm
        action={updateCampaign.bind(null, campaign.id)}
        advertisers={advertisers}
        campaign={campaign}
        error={searchParams.error}
      />
    </div>
  );
}
