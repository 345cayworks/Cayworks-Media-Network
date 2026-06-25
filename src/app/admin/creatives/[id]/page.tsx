import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, getSessionUser, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, Badge, LinkButton } from "@/components/ui";
import {
  setApproval,
  deleteCreative,
  attachCreativeToCampaign,
  detachCreativeFromCampaign,
} from "../actions";
import { resolveVideo } from "@/lib/media";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function CreativeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const user = await getSessionUser();
  const canApprove = !!user && ADMIN_ROLES.includes(user.role);

  const cr = await prisma.creative.findUnique({
    where: { id: params.id },
    include: {
      campaignLinks: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              advertiser: { select: { businessName: true } },
            },
          },
        },
      },
    },
  });
  if (!cr) notFound();
  const video = resolveVideo(cr.videoUrl);

  // Performance: totals for this creative, plus a breakdown per campaign.
  const [totalImps, totalClicks, impsByCampaign, clicksByCampaign] =
    await Promise.all([
      prisma.adImpression.count({ where: { creativeId: cr.id } }),
      prisma.adClick.count({ where: { creativeId: cr.id } }),
      prisma.adImpression.groupBy({
        by: ["campaignId"],
        where: { creativeId: cr.id },
        _count: { _all: true },
      }),
      prisma.adClick.groupBy({
        by: ["campaignId"],
        where: { creativeId: cr.id },
        _count: { _all: true },
      }),
    ]);
  const impsByCamp = new Map<string, number>();
  for (const r of impsByCampaign)
    if (r.campaignId) impsByCamp.set(r.campaignId, r._count._all);
  const clicksByCamp = new Map<string, number>();
  for (const r of clicksByCampaign)
    if (r.campaignId) clicksByCamp.set(r.campaignId, r._count._all);
  const totalCtr = totalImps === 0 ? 0 : (totalClicks / totalImps) * 100;

  const linkedIds = new Set(cr.campaignLinks.map((l) => l.campaignId));
  const attachable = await prisma.campaign.findMany({
    where: { id: { notIn: [...linkedIds] } },
    select: {
      id: true,
      name: true,
      advertiser: { select: { businessName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title={cr.title}
        subtitle={`${cr.creativeType} · ${cr.format} slot${cr.width && cr.height ? ` · ${cr.width}×${cr.height}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/admin/creatives/${cr.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {canApprove && (
              <>
                <form action={setApproval.bind(null, cr.id, "APPROVED")}>
                  <button
                    className="btn-primary"
                    disabled={cr.approvalStatus === "APPROVED"}
                  >
                    Approve
                  </button>
                </form>
                <form action={setApproval.bind(null, cr.id, "REJECTED")}>
                  <button
                    className="btn-danger"
                    disabled={cr.approvalStatus === "REJECTED"}
                  >
                    Reject
                  </button>
                </form>
                <DeleteButton
                  action={deleteCreative.bind(null, cr.id)}
                  label="Delete"
                  confirmText={`Permanently delete creative "${cr.title}"? It will be removed from ALL ${cr.campaignLinks.length} campaigns it's attached to, along with its impressions and clicks. This cannot be undone.`}
                />
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <div className="label mb-2">Preview</div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
              Sponsored
            </div>
            {cr.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cr.imageUrl}
                alt={cr.title}
                className="mb-2 max-h-48 w-full rounded object-cover"
              />
            )}
            {video?.type === "youtube" && (
              <iframe
                src={video.embedSrc}
                title={cr.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="mb-2 aspect-video w-full rounded"
              />
            )}
            {video?.type === "file" && (
              <video
                src={video.src}
                controls
                className="mb-2 max-h-48 w-full rounded"
              />
            )}
            <div className="font-semibold text-slate-900">{cr.title}</div>
            {cr.description && (
              <p className="mt-1 text-sm text-slate-600">{cr.description}</p>
            )}
            <a
              href={cr.destinationUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-3"
            >
              {cr.ctaText ?? "Learn more"}
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4 text-sm space-y-3">
            <Row label="Approval">
              <Badge value={cr.approvalStatus} />
            </Row>
            <Row label="Status">
              <Badge value={cr.status} />
            </Row>
            <Row label="Destination">
              <span className="break-all text-brand-600">{cr.destinationUrl}</span>
            </Row>
            <Row label="Campaigns">
              <span className="text-slate-700">{cr.campaignLinks.length}</span>
            </Row>
            <Row label="Impressions">
              <span className="tabular-nums text-slate-700">
                {totalImps.toLocaleString()}
              </span>
            </Row>
            <Row label="Clicks">
              <span className="tabular-nums text-slate-700">
                {totalClicks.toLocaleString()}
              </span>
            </Row>
            <Row label="CTR">
              <span className="tabular-nums text-slate-700">
                {totalCtr.toFixed(2)}%
              </span>
            </Row>
          </div>

          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">
              Attached to campaigns
            </div>
            {cr.campaignLinks.length === 0 ? (
              <div className="text-xs text-slate-400">
                Not attached to any campaign yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {cr.campaignLinks.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/campaigns/${l.campaign.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {l.campaign.name}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {l.campaign.advertiser.businessName} ·{" "}
                        {(impsByCamp.get(l.campaignId) ?? 0).toLocaleString()}{" "}
                        impr ·{" "}
                        {(clicksByCamp.get(l.campaignId) ?? 0).toLocaleString()}{" "}
                        clk
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge value={l.status} />
                      <form
                        action={detachCreativeFromCampaign.bind(
                          null,
                          cr.id,
                          l.campaignId,
                        )}
                      >
                        <button className="btn-secondary" type="submit">
                          Detach
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {attachable.length > 0 && (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const id = String(formData.get("campaignId") ?? "");
                  if (id) await attachCreativeToCampaign(cr.id, id);
                }}
                className="mt-3 flex items-end gap-2"
              >
                <div className="flex-1">
                  <label className="label" htmlFor="campaignId">
                    Attach to campaign
                  </label>
                  <select id="campaignId" name="campaignId" className="input">
                    {attachable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.advertiser.businessName}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-primary">
                  Attach
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}
