import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { setAdvertiserStatus, deleteAdvertiser } from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdvertiserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const a = await prisma.advertiser.findUnique({
    where: { id: params.id },
    include: {
      campaigns: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { dueDate: "desc" } },
    },
  });
  if (!a) notFound();

  const nextStatus = a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <div>
      <PageHeader
        title={a.businessName}
        subtitle={`${a.contactName} · ${a.email}`}
        action={
          <div className="flex gap-2">
            <LinkButton
              href={`/admin/advertisers/${a.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <form action={setAdvertiserStatus.bind(null, a.id, nextStatus)}>
              <button
                className={nextStatus === "ACTIVE" ? "btn-primary" : "btn-danger"}
                type="submit"
              >
                {nextStatus === "ACTIVE" ? "Activate" : "Deactivate"}
              </button>
            </form>
            <DeleteButton
              action={deleteAdvertiser.bind(null, a.id)}
              label="Delete"
              confirmText={`Permanently delete ${a.businessName}? This also deletes all of its campaigns, creatives, and tracking data. This cannot be undone.`}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="label">Status</div>
          <Badge value={a.status} />
        </div>
        <div className="card p-4">
          <div className="label">Billing</div>
          <Badge value={a.billingStatus} />
        </div>
        <div className="card p-4">
          <div className="label">Industry</div>
          <div className="text-sm">{a.industry ?? "—"}</div>
        </div>
      </div>

      {a.notes && (
        <div className="card mt-4 p-4 text-sm text-slate-600">{a.notes}</div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Campaigns</h2>
        <LinkButton
          href={`/admin/campaigns/new?advertiserId=${a.id}`}
          variant="secondary"
        >
          New Campaign
        </LinkButton>
      </div>
      <div className="card mt-2 overflow-x-auto">
        {a.campaigns.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No campaigns for this advertiser." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Campaign</th>
                <th className="th">Flight</th>
                <th className="th">Pricing</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {a.campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="td font-medium">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="td">
                    {c.startDate.toISOString().slice(0, 10)} →{" "}
                    {c.endDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="td">{c.pricingModel}</td>
                  <td className="td">
                    <Badge value={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
