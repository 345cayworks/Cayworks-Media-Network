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
  const creative = await prisma.creative.findUnique({ where: { id: params.id } });
  if (!creative) notFound();

  return (
    <div>
      <PageHeader title={`Edit — ${creative.title}`} />
      <CreativeForm
        action={updateCreative.bind(null, creative.id)}
        creative={creative}
        error={searchParams.error}
      />
    </div>
  );
}
