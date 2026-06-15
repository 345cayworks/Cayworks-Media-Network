import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import { SelectAll } from "@/components/SelectAll";
import {
  bulkDeleteCreatives,
  bulkSetApproval,
} from "./actions";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = ["IMAGE", "VIDEO", "NATIVE", "HTML"] as const;
const APPROVAL_FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;

type Sort =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "most-used"
  | "least-used";

const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "title-asc", label: "Title A→Z" },
  { key: "title-desc", label: "Title Z→A" },
  { key: "most-used", label: "Most used" },
  { key: "least-used", label: "Least used" },
];

function orderForSort(s: Sort): Prisma.CreativeOrderByWithRelationInput {
  switch (s) {
    case "oldest":
      return { createdAt: "asc" };
    case "title-asc":
      return { title: "asc" };
    case "title-desc":
      return { title: "desc" };
    case "most-used":
      return { campaignLinks: { _count: "desc" } };
    case "least-used":
      return { campaignLinks: { _count: "asc" } };
    default:
      return { createdAt: "desc" };
  }
}

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: {
    approval?: string;
    type?: string;
    q?: string;
    sort?: string;
  };
}) {
  await requireUser();

  const where: Prisma.CreativeWhereInput = {};
  if (APPROVAL_FILTERS.includes(searchParams.approval as "PENDING")) {
    where.approvalStatus = searchParams.approval as "PENDING";
  }
  if (TYPE_FILTERS.includes(searchParams.type as "IMAGE")) {
    where.creativeType = searchParams.type as "IMAGE";
  }
  const q = (searchParams.q ?? "").trim();
  if (q) where.title = { contains: q, mode: "insensitive" };

  const sort: Sort = (SORTS.find((s) => s.key === searchParams.sort)?.key ??
    "newest") as Sort;
  const creatives = await prisma.creative.findMany({
    where,
    orderBy: orderForSort(sort),
    include: { _count: { select: { campaignLinks: true } } },
  });

  const baseQs = new URLSearchParams();
  if (q) baseQs.set("q", q);
  if (searchParams.approval) baseQs.set("approval", searchParams.approval);
  if (searchParams.type) baseQs.set("type", searchParams.type);
  if (sort !== "newest") baseQs.set("sort", sort);

  function withParam(key: string, value: string | undefined): string {
    const p = new URLSearchParams(baseQs);
    if (value) p.set(key, value);
    else p.delete(key);
    return `/admin/creatives?${p.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Creative Library"
        subtitle="Reusable creative assets. Each can be attached to many campaigns."
        action={<LinkButton href="/admin/creatives/new">New Creative</LinkButton>}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <form className="flex flex-1 min-w-[200px] items-end gap-2" method="get">
          {/* preserve other filters when searching */}
          {searchParams.approval && (
            <input type="hidden" name="approval" value={searchParams.approval} />
          )}
          {searchParams.type && (
            <input type="hidden" name="type" value={searchParams.type} />
          )}
          <div className="flex-1">
            <label className="label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Title contains…"
              className="input"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
          {q && (
            <Link href={withParam("q", undefined)} className="btn-secondary">
              Clear
            </Link>
          )}
        </form>

        <div className="flex flex-col">
          <span className="label">Type</span>
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
            <Link
              href={withParam("type", undefined)}
              className={
                !searchParams.type
                  ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
                  : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              All
            </Link>
            {TYPE_FILTERS.map((t) => (
              <Link
                key={t}
                href={withParam("type", t)}
                className={
                  searchParams.type === t
                    ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
                    : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                }
              >
                {t}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="label">Sort</span>
          <form method="get" className="flex items-center gap-1">
            {q && <input type="hidden" name="q" value={q} />}
            {searchParams.approval && (
              <input type="hidden" name="approval" value={searchParams.approval} />
            )}
            {searchParams.type && (
              <input type="hidden" name="type" value={searchParams.type} />
            )}
            <select
              name="sort"
              defaultValue={sort}
              className="input"
              style={{ minWidth: 140 }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">Apply</button>
          </form>
        </div>

        <div className="flex flex-col">
          <span className="label">Approval</span>
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
            <Link
              href={withParam("approval", undefined)}
              className={
                !searchParams.approval
                  ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
                  : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              All
            </Link>
            {APPROVAL_FILTERS.map((a) => (
              <Link
                key={a}
                href={withParam("approval", a)}
                className={
                  searchParams.approval === a
                    ? "rounded px-2 py-1 text-xs font-medium bg-brand-500 text-white"
                    : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                }
              >
                {a}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {creatives.length === 0 ? (
        <EmptyState message="No creatives match those filters." />
      ) : (
        <form action={bulkSetApproval.bind(null, "APPROVED")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {creatives.map((cr) => (
              <div key={cr.id} className="card overflow-hidden">
                <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    name="creativeId"
                    value={cr.id}
                    className="h-3.5 w-3.5"
                  />
                  Select for bulk
                </label>
                <Link
                  href={`/admin/creatives/${cr.id}`}
                  className="group block"
                >
                  <div className="aspect-video w-full bg-slate-100">
                    {cr.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cr.imageUrl}
                        alt={cr.title}
                        className="h-full w-full object-cover transition group-hover:opacity-90"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        {cr.creativeType}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {cr.title}
                        </div>
                        <div className="text-xs text-slate-400">
                          {cr.creativeType}
                          {cr.width && cr.height
                            ? ` · ${cr.width}×${cr.height}`
                            : ""}
                        </div>
                      </div>
                      <Badge value={cr.approvalStatus} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Used in{" "}
                        <strong className="text-slate-700">
                          {cr._count.campaignLinks}
                        </strong>{" "}
                        campaign{cr._count.campaignLinks === 1 ? "" : "s"}
                      </span>
                      <Badge value={cr.status} />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-md backdrop-blur">
            <SelectAll name="creativeId" />
            <span className="mr-auto text-xs text-slate-500">
              Bulk actions apply to every ticked card.
            </span>
            <button type="submit" className="btn-primary">
              Approve selected
            </button>
            <button
              type="submit"
              formAction={bulkSetApproval.bind(null, "REJECTED")}
              className="btn-secondary"
            >
              Reject selected
            </button>
            <ConfirmFormButton
              action={bulkDeleteCreatives}
              className="btn-danger"
              confirmText="Permanently delete the selected creatives? They will be removed from EVERY campaign and tracking data. This cannot be undone."
            >
              Delete
            </ConfirmFormButton>
          </div>
        </form>
      )}
    </div>
  );
}
