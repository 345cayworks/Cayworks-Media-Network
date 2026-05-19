import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import {
  setCampaignStatus,
  assignPlacement,
  removePlacement,
} from "../actions";

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
      creatives: { orderBy: { createdAt: "desc" } },
      campaignPlacements: {
        include: { placement: { include: { platform: true } } },
      },
    },
  });
  if (!c) notFound();

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
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="label">Status</div>
          <Badge value={c.status} />
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
          href={`/admin/creatives/new?campaignId=${c.id}`}
          variant="secondary"
        >
          Add Creative
        </LinkButton>
      </div>
      <div className="card mt-2 overflow-x-auto">
        {c.creatives.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No creatives yet." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Title</th>
                <th className="th">Type</th>
                <th className="th">Approval</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {c.creatives.map((cr) => (
                <tr key={cr.id} className="border-b border-slate-50">
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
                    <Badge value={cr.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
