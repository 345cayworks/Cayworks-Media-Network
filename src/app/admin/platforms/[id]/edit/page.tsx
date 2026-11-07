import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PlatformForm } from "../../PlatformForm";
import { updatePlatform } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditPlatformPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireRole(ADMIN_ROLES);
  const platform = await prisma.platform.findUnique({
    where: { id: params.id },
  });
  if (!platform) notFound();

  return (
    <div>
      <PageHeader title={`Edit — ${platform.name}`} />
      <PlatformForm
        action={updatePlatform.bind(null, platform.id)}
        platform={platform}
        error={searchParams.error}
      />
    </div>
  );
}
