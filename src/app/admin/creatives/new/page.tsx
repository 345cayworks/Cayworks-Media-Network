import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { CreativeForm } from "../CreativeForm";
import { createCreative } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Create a new (standalone) creative asset. If opened from a campaign page
 * with ?attachTo=<campaignId>, the new creative is automatically linked to
 * that campaign on save.
 */
export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: { attachTo?: string; error?: string };
}) {
  await requireRole(STAFF_ROLES);
  const attachTo = searchParams.attachTo;
  const target = attachTo
    ? await prisma.campaign.findUnique({
        where: { id: attachTo },
        select: { id: true, name: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Creative"
        subtitle={
          target
            ? `Will be attached to "${target.name}" on save.`
            : "Reusable creative asset. Attach it to one or more campaigns afterwards."
        }
      />
      {/* Carry the attach target through to the create action via hidden field. */}
      <form id="attach-meta" />
      <CreativeForm
        action={async (formData: FormData) => {
          "use server";
          if (target) formData.set("attachTo", target.id);
          await createCreative(formData);
        }}
        error={searchParams.error}
      />
    </div>
  );
}
