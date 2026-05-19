import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { setPlatformStatus } from "./actions";

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
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Name</th>
                <th className="th">Slug</th>
                <th className="th">API Key</th>
                <th className="th">Placements</th>
                <th className="th">Status</th>
                <th className="th">Serving</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => {
                const next = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                return (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
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
      )}
    </div>
  );
}
