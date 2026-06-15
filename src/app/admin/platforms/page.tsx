import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { BulkToolbar } from "@/components/BulkToolbar";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import {
  setPlatformStatus,
  bulkSetPlatformStatus,
  bulkDeletePlatforms,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  await requireUser();
  const platforms = await prisma.platform.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { placements: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Platforms"
        subtitle="Register partner platforms, issue API keys, manage placements."
        action={<LinkButton href="/admin/platforms/new">Register Platform</LinkButton>}
      />
      {platforms.length === 0 ? (
        <EmptyState message="No platforms registered yet." />
      ) : (
        <form action={bulkSetPlatformStatus.bind(null, "ACTIVE")}>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th w-8"></th>
                  <th className="th">Name</th>
                  <th className="th">Slug</th>
                  <th className="th">API Key</th>
                  <th className="th">Placements</th>
                  <th className="th">Last sync</th>
                  <th className="th">Status</th>
                  <th className="th">Serving</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => {
                  const next = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="td">
                        <input
                          type="checkbox"
                          name="platformId"
                          value={p.id}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="td font-medium">
                        <Link
                          href={`/admin/platforms/${p.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="td font-mono text-xs">{p.slug}</td>
                      <td className="td font-mono text-xs text-slate-400">
                        {p.apiKeyPrefix || "—"}…
                      </td>
                      <td className="td">{p._count.placements}</td>
                      <td className="td text-xs text-slate-500">
                        {p.lastSyncedAt
                          ? p.lastSyncedAt.toISOString().replace("T", " ").slice(0, 16)
                          : "—"}
                      </td>
                      <td className="td">
                        <Badge value={p.status} />
                      </td>
                      <td className="td">
                        <form action={setPlatformStatus.bind(null, p.id, next)}>
                          <button
                            type="submit"
                            className={
                              p.status === "ACTIVE" ? "btn-danger" : "btn-primary"
                            }
                          >
                            {p.status === "ACTIVE" ? "Turn off" : "Turn on"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <BulkToolbar selectName="platformId">
            <button type="submit" className="btn-secondary">
              Turn on
            </button>
            <button
              type="submit"
              formAction={bulkSetPlatformStatus.bind(null, "INACTIVE")}
              className="btn-secondary"
            >
              Turn off
            </button>
            <ConfirmFormButton
              action={bulkDeletePlatforms}
              className="btn-danger"
              confirmText="Permanently delete the selected platforms? This also deletes their placements and all impressions/clicks routed through them. This cannot be undone."
            >
              Delete
            </ConfirmFormButton>
          </BulkToolbar>
        </form>
      )}
    </div>
  );
}
