import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, getSessionUser, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, Badge, LinkButton } from "@/components/ui";
import { setApproval } from "../actions";

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
      campaign: { include: { advertiser: true } },
    },
  });
  if (!cr) notFound();

  return (
    <div>
      <PageHeader
        title={cr.title}
        subtitle={`${cr.campaign.name} · ${cr.campaign.advertiser.businessName}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/admin/creatives/${cr.id}/edit`}
              variant="secondary"
            >
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
            {cr.videoUrl && (
              <video
                src={cr.videoUrl}
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

        <div className="card space-y-3 p-4 text-sm">
          <Row label="Approval">
            <Badge value={cr.approvalStatus} />
          </Row>
          <Row label="Status">
            <Badge value={cr.status} />
          </Row>
          <Row label="Type">{cr.creativeType}</Row>
          <Row label="Dimensions">
            {cr.width && cr.height ? `${cr.width}×${cr.height}` : "—"}
          </Row>
          <Row label="Destination">
            <span className="break-all text-brand-600">
              {cr.destinationUrl}
            </span>
          </Row>
          <Row label="Campaign">
            <Link
              href={`/admin/campaigns/${cr.campaignId}`}
              className="text-brand-600 hover:underline"
            >
              {cr.campaign.name}
            </Link>
          </Row>
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
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}
