import { PageHeader } from "@/components/ui";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { AdvertiserForm } from "../AdvertiserForm";
import { createAdvertiser } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAdvertiserPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole(ADMIN_ROLES);
  return (
    <div>
      <PageHeader title="New Advertiser" />
      <AdvertiserForm action={createAdvertiser} error={searchParams.error} />
    </div>
  );
}
