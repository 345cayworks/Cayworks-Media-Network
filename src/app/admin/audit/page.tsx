import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";
import { FilterChips } from "@/components/FilterChips";
import { Pagination, readPaging } from "@/components/Pagination";

export const dynamic = "force-dynamic";

const ENTITIES = [
  "Campaign",
  "Creative",
  "Advertiser",
  "Platform",
  "AdPlacement",
  "CampaignPlacement",
  "CampaignCreative",
  "User",
] as const;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: {
    entity?: string;
    q?: string;
    actor?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  };
}) {
  await requireRole(ADMIN_ROLES);

  const where: Prisma.AuditLogWhereInput = {};
  if (ENTITIES.includes(searchParams.entity as "Campaign")) {
    where.entity = searchParams.entity;
  }
  const actor = (searchParams.actor ?? "").trim();
  if (actor)
    where.actorEmail = { contains: actor, mode: "insensitive" };
  const q = (searchParams.q ?? "").trim();
  if (q) where.action = { contains: q, mode: "insensitive" };
  const range: { gte?: Date; lte?: Date } = {};
  if (searchParams.from && !Number.isNaN(Date.parse(searchParams.from)))
    range.gte = new Date(searchParams.from);
  if (searchParams.to && !Number.isNaN(Date.parse(searchParams.to))) {
    const end = new Date(searchParams.to);
    end.setUTCHours(23, 59, 59, 999);
    range.lte = end;
  }
  if (Object.keys(range).length > 0) where.createdAt = range;

  const paging = readPaging(searchParams, 25, 200);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) exportQs.set(k, String(v));
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${total.toLocaleString()} matching entries.`}
        action={
          <a
            className="btn-primary"
            href={`/api/admin/audit/export?${exportQs.toString()}`}
          >
            Export CSV
          </a>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <FilterChips
          label="Entity"
          name="entity"
          basePath="/admin/audit"
          items={ENTITIES.map((e) => ({ value: e }))}
          active={searchParams.entity}
          preserve={searchParams}
        />

        <form className="flex flex-1 min-w-[260px] items-end gap-2" method="get">
          {searchParams.entity && (
            <input type="hidden" name="entity" value={searchParams.entity} />
          )}
          <div className="flex-1">
            <label className="label" htmlFor="q">
              Action contains
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="DELETE, APPROVAL_APPROVED, …"
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="actor">
              Actor email contains
            </label>
            <input
              id="actor"
              name="actor"
              type="search"
              defaultValue={actor}
              placeholder="you@cayworks.com"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={searchParams.from}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={searchParams.to}
              className="input"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Apply
          </button>
          {(q || actor || searchParams.from || searchParams.to) && (
            <Link
              href={
                searchParams.entity
                  ? `/admin/audit?entity=${searchParams.entity}`
                  : "/admin/audit"
              }
              className="btn-secondary"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No audit entries match those filters." />
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

      <Pagination
        total={total}
        page={paging.page}
        pageSize={paging.pageSize}
        basePath="/admin/audit"
        preserve={searchParams}
      />
    </div>
  );
}
