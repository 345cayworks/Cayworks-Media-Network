import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PlatformForm } from "../PlatformForm";
import { createPlatform } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPlatformPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole(ADMIN_ROLES);
  return (
    <div>
      <PageHeader
        title="Register Platform"
        subtitle="An API key is generated and shown once after creation."
      />
      <PlatformForm action={createPlatform} error={searchParams.error} />
    </div>
  );
}
