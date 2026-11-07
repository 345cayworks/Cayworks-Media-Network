import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AdvertiserForm } from "../../AdvertiserForm";
import { updateAdvertiser } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditAdvertiserPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireRole(ADMIN_ROLES);
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: params.id },
  });
  if (!advertiser) notFound();

  return (
    <div>
      <PageHeader title={`Edit — ${advertiser.businessName}`} />
      <AdvertiserForm
        action={updateAdvertiser.bind(null, advertiser.id)}
        advertiser={advertiser}
        error={searchParams.error}
      />
    </div>
  );
}
