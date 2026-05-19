import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CreativeForm } from "../../CreativeForm";
import { updateCreative } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCreativePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireRole(STAFF_ROLES);
  const [creative, campaigns] = await Promise.all([
    prisma.creative.findUnique({ where: { id: params.id } }),
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!creative) notFound();

  return (
    <div>
      <PageHeader title={`Edit — ${creative.title}`} />
      <CreativeForm
        action={updateCreative.bind(null, creative.id)}
        campaigns={campaigns}
        creative={creative}
        error={searchParams.error}
      />
    </div>
  );
}
