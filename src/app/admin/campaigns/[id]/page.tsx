import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { effectiveStatus } from "@/lib/campaign-status";
import {
  setCampaignStatus,
  assignPlacement,
  removePlacement,
  deleteCampaign,
  cloneCampaign,
  setCampaignPlacementStatus,
  bulkAttachCreativesToCampaign,
} from "../actions";
import { DeleteButton } from "@/components/DeleteButton";
import { detachCreativeFromCampaign } from "@/app/admin/creatives/actions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const c = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      advertiser: true,
      creativeLinks: {
        include: { creative: true },
        orderBy: { createdAt: "desc" },
      },
      campaignPlacements: {
        include: { placement: { include: { platform: true } } },
      },
    },
  });
  if (!c) notFound();
  const linkedCreativeIds = new Set(c.creativeLinks.map((l) => l.creativeId));
  const attachableCreatives = await prisma.creative.findMany({
    where: { id: { notIn: [...linkedCreativeIds] } },
    select: {
      id: true,
      title: true,
      creativeType: true,
      approvalStatus: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const assignedIds = new Set(c.campaignPlacements.map((p) => p.placementId));
  const allPlacements = await prisma.adPlacement.findMany({
    where: { status: "ACTIVE" },
    include: { platform: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const available = allPlacements.filter((p) => !assignedIds.has(p.id));

  const [imps, clicks] = await Promise.all([
    prisma.adImpression.count({ where: { campaignId: c.id } }),
    prisma.adClick.count({ where: { campaignId: c.id } }),
  ]);

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={`${c.advertiser.businessName} · ${c.pricingModel} · priority ${c.priority}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/admin/campaigns/${c.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <form action={cloneCampaign.bind(null, c.id)}>
              <button type="submit" className="btn-secondary">
                Clone
              </button>
            </form>
            {(["ACTIVE", "PAUSED", "ENDED"] as const).map((s) => (
              <form key={s} action={setCampaignStatus.bind(null, c.id, s)}>
                <button
                  type="submit"
                  disabled={c.status === s}
                  className="btn-secondary"
                >
                  {s === "ACTIVE"
                    ? "Activate"
                    : s === "PAUSED"
                      ? "Pause"
                      : "End"}
                </button>
              </form>
            ))}
            <DeleteButton
              action={deleteCampaign.bind(null, c.id)}
              label="Delete"
              confirmText={`Permanently delete campaign "${c.name}"? This also deletes its creatives, placement assignments, and tracking data. This cannot be undone.`}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="label">State</div>
          <StatusPill campaign={c} />
          {(() => {
            const r = effectiveStatus(c);
            return r.reasons.length > 0 && r.status !== "LIVE" ? (
              <div className="mt-1 text-xs text-slate-500">
                {r.reasons.join(" · ")}
              </div>
            ) : null;
          })()}
        </div>
        <div className="card p-4">
          <div className="label">Flight</div>
          <div className="text-xs">
            {c.startDate.toISOString().slice(0, 10)} →{" "}
            {c.endDate.toISOString().slice(0, 10)}
          </div>
        </div>
        <div className="card p-4">
          <div className="label">Impressions</div>
          <div className="text-lg font-bold">{imps.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="label">Clicks</div>
          <div className="text-lg font-bold">{clicks.toLocaleString()}</div>
        </div>
      </div>

      {/* Creatives */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Creatives</h2>
        <LinkButton
          href={`/admin/creatives/new?attachTo=${c.id}`}
          variant="secondary"
        >
          Upload new creative
        </LinkButton>
      </div>
      <div className="card mt-2 overflow-x-auto">
        {c.creativeLinks.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No creatives attached yet. Attach an existing one below or upload a new asset." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Title</th>
                <th className="th">Type</th>
                <th className="th">Approval</th>
                <th className="th">Link</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {c.creativeLinks.map((l) => {
                const cr = l.creative;
                return (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="td font-medium">
                    <Link
                      href={`/admin/creatives/${cr.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {cr.title}
                    </Link>
                  </td>
                  <td className="td">{cr.creativeType}</td>
                  <td className="td">
                    <Badge value={cr.approvalStatus} />
                  </td>
                  <td className="td">
                    <Badge value={l.status} />
                  </td>
                  <td className="td text-right">
                    <form
                      action={detachCreativeFromCampaign.bind(
                        null,
                        cr.id,
                        c.id,
                      )}
                    >
                      <button className="btn-secondary" type="submit">
                        Detach
                      </button>
                    </form>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {attachableCreatives.length > 0 && (
        <form
          action={bulkAttachCreativesToCampaign.bind(null, c.id)}
          className="card mt-3 p-4"
        >
          <div className="label mb-2">Attach existing creatives</div>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-slate-100 p-2 sm:grid-cols-2">
            {attachableCreatives.map((cr) => (
              <label
                key={cr.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="creativeId"
                  value={cr.id}
                  className="h-3.5 w-3.5"
                />
                <span className="truncate font-medium text-slate-800">
                  {cr.title}
                </span>
                <span className="text-xs text-slate-400">
                  {cr.creativeType}
                </span>
                <Badge value={cr.approvalStatus} />
              </label>
            ))}
          </div>
          <button type="submit" className="btn-primary mt-2">
            Attach selected
          </button>
        </form>
      )}

      {/* Placements */}
      <h2 className="mt-6 text-sm font-semibold text-slate-700">
        Placement Assignments
      </h2>
      <div className="card mt-2 overflow-x-auto">
        {c.campaignPlacements.length === 0 ? (
          <div className="p-4">
            <EmptyState message="Not assigned to any placement yet." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Placement</th>
                <th className="th">Platform</th>
                <th className="th">Weight</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {c.campaignPlacements.map((cp) => (
                <tr key={cp.id} className="border-b border-slate-50">
                  <td className="td font-medium">
                    {cp.placement.name}
                    <div className="text-xs text-slate-400">
                      {cp.placement.placementKey}
                    </div>
                  </td>
                  <td className="td">{cp.placement.platform.name}</td>
                  <td className="td">{cp.weight}</td>
                  <td className="td">
                    <Badge value={cp.status} />
                  </td>
                  <td className="td text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <form
                        action={setCampaignPlacementStatus.bind(
                          null,
                          c.id,
                          cp.placementId,
                          cp.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                        )}
                      >
                        <button className="btn-secondary" type="submit">
                          {cp.status === "ACTIVE" ? "Pause" : "Reactivate"}
                        </button>
                      </form>
                      <form
                        action={removePlacement.bind(
                          null,
                          c.id,
                          cp.placementId,
                        )}
                      >
                        <button className="btn-danger" type="submit">
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {available.length > 0 && (
        <form
          action={assignPlacement.bind(null, c.id)}
          className="card mt-3 flex flex-wrap items-end gap-3 p-4"
        >
          <div className="min-w-[240px] flex-1">
            <label className="label" htmlFor="placementId">
              Assign Placement
            </label>
            <select id="placementId" name="placementId" className="input">
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.platform.name} — {p.name} ({p.placementKey})
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="label" htmlFor="weight">
              Weight
            </label>
            <input
              id="weight"
              name="weight"
              type="number"
              min={1}
              defaultValue={1}
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary">
            Assign
          </button>
        </form>
      )}
    </div>
  );
}
