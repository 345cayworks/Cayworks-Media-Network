import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Field, TextArea, Select, FormError, enumOptions } from "@/components/form";
import { updatePlacement } from "@/app/admin/platforms/actions";

export const dynamic = "force-dynamic";

export default async function EditPlacementPage({
  params,
  searchParams,
}: {
  params: { id: string; placementId: string };
  searchParams: { error?: string };
}) {
  await requireRole(ADMIN_ROLES);
  const placement = await prisma.adPlacement.findUnique({
    where: { id: params.placementId },
    include: { platform: { select: { name: true, id: true } } },
  });
  if (!placement || placement.platform.id !== params.id) notFound();

  const action = updatePlacement.bind(null, placement.id, params.id);

  return (
    <div>
      <PageHeader
        title={`Edit Placement — ${placement.name}`}
        subtitle={`${placement.platform.name} · ${placement.placementKey}`}
        action={
          <Link href={`/admin/platforms/${params.id}`} className="btn-secondary">
            Back to platform
          </Link>
        }
      />
      <form action={action} className="card max-w-2xl space-y-4 p-6">
        <FormError message={searchParams.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Placement Name"
            name="name"
            required
            defaultValue={placement.name}
          />
          <Field
            label="Placement Key"
            name="placementKey"
            required
            defaultValue={placement.placementKey}
          />
          <Select
            label="Type"
            name="placementType"
            options={enumOptions([
              "BANNER",
              "SIDEBAR",
              "CARD",
              "NATIVE",
              "VIDEO",
              "SKYSCRAPER",
            ])}
            defaultValue={placement.placementType}
          />
          <Select
            label="Status"
            name="status"
            options={enumOptions(["ACTIVE", "INACTIVE"])}
            defaultValue={placement.status}
          />
        </div>
        <TextArea
          label="Allowed Sizes (comma separated, e.g. 300x250, 728x90)"
          name="allowedSizes"
          defaultValue={placement.allowedSizes.join(", ")}
        />
        <TextArea
          label="Description"
          name="description"
          defaultValue={placement.description}
        />
        <button type="submit" className="btn-primary">
          Save Placement
        </button>
      </form>
    </div>
  );
}
