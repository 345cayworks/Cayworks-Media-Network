import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole(ADMIN_ROLES);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Most recent 200 administrative actions."
      />
      {logs.length === 0 ? (
        <EmptyState message="No audit entries yet." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">When</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th">Entity</th>
                <th className="th">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="td whitespace-nowrap text-xs">
                    {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="td">{l.actorEmail}</td>
                  <td className="td font-mono text-xs">{l.action}</td>
                  <td className="td">{l.entity}</td>
                  <td className="td font-mono text-xs text-slate-400">
                    {l.entityId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
