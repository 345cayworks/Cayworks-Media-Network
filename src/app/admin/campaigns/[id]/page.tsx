import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, getSessionUser, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { effectiveStatus } from "@/lib/campaign-status";
import { diagnoseForPlatform } from "@/lib/ad-diagnose";
import {
  setCampaignStatus,
  removePlacement,
  deleteCampaign,
  cloneCampaign,
  setCampaignPlacementStatus,
  bulkAttachCreativesToCampaign,
  bulkAssignPlacements,
} from "../actions";
import { Meter } from "@/components/Meter";
import { DeleteButton } from "@/components/DeleteButton";
import {
  detachCreativeFromCampaign,
  createAndAttachCreative,
  setApproval,
  setCampaignCreativeStatus,
  bulkSetCampaignCreativeStatus,
  bulkDetachCreativesFromCampaign,
} from "@/app/admin/creatives/actions";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import { DropToAttach } from "@/components/DropToAttach";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const sessionUser = await getSessionUser();
  const canApprove = !!sessionUser && ADMIN_ROLES.includes(sessionUser.role);
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

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const [imps, clicks, impsToday] = await Promise.all([
    prisma.adImpression.count({ where: { campaignId: c.id } }),
    prisma.adClick.count({ where: { campaignId: c.id } }),
    prisma.adImpression.count({
      where: { campaignId: c.id, createdAt: { gte: startOfToday } },
    }),
  ]);

  // Per-placement eligibility for THIS campaign. Reuses the diagnose
  // function and picks the candidate row matching this campaign id.
  const eligibility = await Promise.all(
    c.campaignPlacements.map(async (cp) => {
      const r = await diagnoseForPlatform(
        cp.placement.platform.slug,
        cp.placement.platform.id,
        cp.placement.placementKey,
      );
      const mine = r.candidates.find((cand) => cand.campaignId === c.id);
      return {
        placementId: cp.placementId,
        eligible: !!mine?.eligible,
        reasons: mine?.excluded ?? (r.stage === "placement" ? [r.reason ?? "Placement off"] : []),
      };
    }),
  );
  const eligibilityByPlacement = new Map(
    eligibility.map((e) => [e.placementId, e]),
  );

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

      {(c.dailyImpressionLimit ||
        c.totalImpressionLimit ||
        c.frequencyCapPerUserPerHour ||
        c.frequencyCapPerUserPerDay) && (
        <div className="card mt-3 grid gap-4 p-4 sm:grid-cols-2">
          <Meter
            label="Today"
            value={impsToday}
            max={c.dailyImpressionLimit}
          />
          <Meter
            label="Total"
            value={imps}
            max={c.totalImpressionLimit}
          />
          {(c.frequencyCapPerUserPerHour || c.frequencyCapPerUserPerDay) && (
            <div className="sm:col-span-2 text-xs text-slate-500">
              Per-user cap:{" "}
              {c.frequencyCapPerUserPerHour
                ? `${c.frequencyCapPerUserPerHour}/hour`
                : "—"}
              {" · "}
              {c.frequencyCapPerUserPerDay
                ? `${c.frequencyCapPerUserPerDay}/day`
                : "—"}
            </div>
          )}
        </div>
      )}

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
          <form
            action={bulkSetCampaignCreativeStatus.bind(null, c.id, "ACTIVE")}
          >
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th w-8"></th>
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
                const nextLink = l.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                return (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="td">
                    <input
                      type="checkbox"
                      name="creativeId"
                      value={cr.id}
                      className="h-3.5 w-3.5"
                    />
                  </td>
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
                  <td className="td">
                    <div className="flex flex-wrap justify-end gap-1">
                      {canApprove && cr.approvalStatus !== "APPROVED" && (
                        <button
                          type="submit"
                          formAction={setApproval.bind(null, cr.id, "APPROVED")}
                          className="btn-primary"
                        >
                          Approve
                        </button>
                      )}
                      {canApprove && cr.approvalStatus !== "REJECTED" && (
                        <button
                          type="submit"
                          formAction={setApproval.bind(null, cr.id, "REJECTED")}
                          className="btn-danger"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        type="submit"
                        formAction={setCampaignCreativeStatus.bind(
                          null,
                          cr.id,
                          c.id,
                          nextLink,
                        )}
                        className="btn-secondary"
                        title={l.status === "ACTIVE" ? "Pause this link" : "Reactivate this link"}
                      >
                        {l.status === "ACTIVE" ? "Pause" : "Reactivate"}
                      </button>
                      <button
                        type="submit"
                        formAction={detachCreativeFromCampaign.bind(
                          null,
                          cr.id,
                          c.id,
                        )}
                        className="btn-secondary"
                      >
                        Detach
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-3 py-2 text-xs">
            <span className="mr-auto text-slate-500">
              Bulk action applies to every ticked creative.
            </span>
            <button type="submit" className="btn-secondary">
              Reactivate
            </button>
            <button
              type="submit"
              formAction={bulkSetCampaignCreativeStatus.bind(null, c.id, "PAUSED")}
              className="btn-secondary"
            >
              Pause
            </button>
            <ConfirmFormButton
              action={bulkDetachCreativesFromCampaign.bind(null, c.id)}
              className="btn-danger"
              confirmText="Detach the selected creatives from this campaign? The creatives themselves are kept in the library."
            >
              Detach
            </ConfirmFormButton>
          </div>
          </form>
        )}
      </div>

      <div className="card mt-3 p-4">
        <div className="label mb-2">Drop a file to add a creative</div>
        <DropToAttach action={createAndAttachCreative.bind(null, c.id)} />
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
              {c.campaignPlacements.map((cp) => {
                const e = eligibilityByPlacement.get(cp.placementId);
                return (
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
                    <div className="flex flex-col gap-1">
                      <Badge value={cp.status} />
                      {e?.eligible ? (
                        <span
                          title="Eligible to serve here"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Serving
                        </span>
                      ) : (
                        <span
                          title={e?.reasons.join(" · ") || "Not eligible"}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {e?.reasons[0] ?? "Not eligible"}
                        </span>
                      )}
                    </div>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {available.length > 0 &&
        (() => {
          // Group remaining placements by platform so the bulk picker is
          // scannable: check many at once, or use the "Assign all"
          // shortcut per platform below.
          const byPlatform = new Map<
            string,
            { name: string; items: typeof available }
          >();
          for (const p of available) {
            const k = p.platform.name;
            if (!byPlatform.has(k)) byPlatform.set(k, { name: k, items: [] });
            byPlatform.get(k)!.items.push(p);
          }
          const groups = [...byPlatform.values()].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          return (
            <div className="mt-3 space-y-3">
              <form
                action={bulkAssignPlacements.bind(null, c.id)}
                className="card p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="label !mb-0">Assign placements</div>
                  <span className="text-xs text-slate-400">
                    Tick any number across platforms, then Assign selected.
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g) => (
                    <fieldset
                      key={g.name}
                      className="rounded-md border border-slate-200 p-3"
                    >
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {g.name}
                      </legend>
                      <div className="space-y-1">
                        {g.items.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              name="placementId"
                              value={p.id}
                              className="h-3.5 w-3.5"
                            />
                            <span className="font-medium text-slate-800">
                              {p.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {p.placementKey}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <button type="submit" className="btn-primary mt-3">
                  Assign selected
                </button>
              </form>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="self-center text-slate-500">
                  Or assign every placement on:
                </span>
                {groups.map((g) => (
                  <form
                    key={g.name}
                    action={bulkAssignPlacements.bind(null, c.id)}
                  >
                    {g.items.map((p) => (
                      <input
                        key={p.id}
                        type="hidden"
                        name="placementId"
                        value={p.id}
                      />
                    ))}
                    <button type="submit" className="btn-secondary">
                      {g.name} ({g.items.length})
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
