import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CreativeForm } from "../CreativeForm";
import { createCreative, cloneCreative } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: { campaignId?: string; error?: string };
}) {
  await requireRole(STAFF_ROLES);
  const [campaigns, existingCreatives] = await Promise.all([
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creative.findMany({
      select: {
        id: true,
        title: true,
        creativeType: true,
        campaign: {
          select: {
            name: true,
            advertiser: { select: { businessName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const defaultTarget = searchParams.campaignId ?? campaigns[0]?.id ?? "";

  async function cloneAction(formData: FormData) {
    "use server";
    const sourceId = String(formData.get("sourceId") ?? "");
    const targetCampaignId = String(formData.get("targetCampaignId") ?? "");
    await cloneCreative(sourceId, targetCampaignId);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Creative" />

      {existingCreatives.length > 0 && (
        <form
          action={cloneAction}
          className="card max-w-2xl space-y-3 p-6"
        >
          <div className="text-sm font-semibold text-slate-700">
            Reuse an already-uploaded creative
          </div>
          <p className="text-xs text-slate-500">
            Duplicates the media + copy into another campaign — no re-upload
            needed. Lands on the new creative's edit page so you can tweak
            copy/CTA per campaign. New copy is set to PENDING for review.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sourceId">
                Source creative
              </label>
              <select id="sourceId" name="sourceId" className="input" required>
                {existingCreatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.creativeType} — {c.campaign.name} (
                    {c.campaign.advertiser.businessName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="targetCampaignId">
                Target campaign
              </label>
              <select
                id="targetCampaignId"
                name="targetCampaignId"
                className="input"
                defaultValue={defaultTarget}
                required
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-secondary">
            Reuse into target campaign
          </button>
        </form>
      )}

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-700">
          Or build a new creative
        </div>
        <CreativeForm
          action={createCreative}
          campaigns={campaigns}
          defaultCampaignId={searchParams.campaignId}
          error={searchParams.error}
        />
      </div>
    </div>
  );
}
