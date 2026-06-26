import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { ConfirmFormButton } from "@/components/ConfirmFormButton";
import { BulkToolbar } from "@/components/BulkToolbar";
import { FilterChips } from "@/components/FilterChips";
import { SearchInput } from "@/components/SearchInput";
import { Pagination, readPaging } from "@/components/Pagination";
import {
  bulkDeleteCreatives,
  bulkSetApproval,
  setApproval,
  bulkAttachLibrarySelectionToCampaign,
  bulkSetCreativeFormat,
} from "./actions";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = ["IMAGE", "VIDEO", "NATIVE", "HTML"] as const;
const APPROVAL_FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
const FORMAT_FILTERS = [
  "BANNER",
  "CARD",
  "NATIVE",
  "SIDEBAR",
  "VIDEO",
  "SKYSCRAPER",
] as const;

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
    format?: string;
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    orphan?: string;
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
  if (FORMAT_FILTERS.includes(searchParams.format as "BANNER")) {
    where.format = searchParams.format as "BANNER";
  }
  const q = (searchParams.q ?? "").trim();
  if (q) where.title = { contains: q, mode: "insensitive" };
  // ?orphan=1 → only creatives with zero campaign links (cleanup view).
  if (searchParams.orphan === "1") {
    where.campaignLinks = { none: {} };
  }

  const sort: Sort = (SORTS.find((s) => s.key === searchParams.sort)?.key ??
    "newest") as Sort;
  const paging = readPaging(searchParams, 24);
  const [creatives, total] = await Promise.all([
    prisma.creative.findMany({
      where,
      orderBy: orderForSort(sort),
      include: { _count: { select: { campaignLinks: true } } },
      skip: paging.skip,
      take: paging.pageSize,
    }),
    prisma.creative.count({ where }),
  ]);

  // Campaigns available as targets for the bulk-attach action in the toolbar.
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      advertiser: { select: { businessName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Creative Library"
        subtitle="Reusable creative assets. Each can be attached to many campaigns."
        action={<LinkButton href="/admin/creatives/new">New Creative</LinkButton>}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <SearchInput
          basePath="/admin/creatives"
          defaultValue={q}
          placeholder="Title contains…"
          preserve={searchParams}
        />

        <FilterChips
          label="Type"
          name="type"
          basePath="/admin/creatives"
          items={TYPE_FILTERS.map((t) => ({ value: t }))}
          active={searchParams.type}
          preserve={searchParams}
        />

        <FilterChips
          label="Slot format"
          name="format"
          basePath="/admin/creatives"
          items={FORMAT_FILTERS.map((f) => ({ value: f }))}
          active={searchParams.format}
          preserve={searchParams}
        />

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
            {searchParams.format && (
              <input type="hidden" name="format" value={searchParams.format} />
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

        <FilterChips
          label="Approval"
          name="approval"
          basePath="/admin/creatives"
          items={APPROVAL_FILTERS.map((a) => ({ value: a }))}
          active={searchParams.approval}
          preserve={searchParams}
        />

        <FilterChips
          label="Usage"
          name="orphan"
          basePath="/admin/creatives"
          items={[{ value: "1", label: "Orphaned" }]}
          active={searchParams.orphan}
          preserve={searchParams}
        />
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
                        <div className="mt-1">
                          <Badge value={cr.format} />
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
                <div className="flex gap-1 border-t border-slate-100 p-2">
                  <button
                    type="submit"
                    formAction={setApproval.bind(null, cr.id, "APPROVED")}
                    disabled={cr.approvalStatus === "APPROVED"}
                    className="btn-primary flex-1 text-xs disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    formAction={setApproval.bind(null, cr.id, "REJECTED")}
                    disabled={cr.approvalStatus === "REJECTED"}
                    className="btn-danger flex-1 text-xs disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          <BulkToolbar
            selectName="creativeId"
            hint="Bulk actions apply to every ticked card."
          >
            {campaigns.length > 0 && (
              <>
                <select
                  name="targetCampaignId"
                  defaultValue=""
                  className="input max-w-[220px] text-xs"
                  title="Pick a campaign to attach the selected creatives to"
                >
                  <option value="">Attach to…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.advertiser.businessName}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  formAction={bulkAttachLibrarySelectionToCampaign}
                  className="btn-secondary"
                >
                  Attach selected
                </button>
              </>
            )}
            <select
              name="format"
              defaultValue=""
              className="input max-w-[160px] text-xs"
              title="Set the slot format on the selected creatives"
            >
              <option value="">Set format…</option>
              {FORMAT_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="submit"
              formAction={bulkSetCreativeFormat}
              className="btn-secondary"
            >
              Set format
            </button>
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
          </BulkToolbar>
        </form>
      )}

      <Pagination
        total={total}
        page={paging.page}
        pageSize={paging.pageSize}
        basePath="/admin/creatives"
        preserve={searchParams}
        pageSizes={[12, 24, 48, 96]}
      />
    </div>
  );
}
