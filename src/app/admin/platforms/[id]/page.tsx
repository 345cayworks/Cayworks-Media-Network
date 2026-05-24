import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import {
  regenerateApiKey,
  createPlacement,
  setPlacementStatus,
} from "../actions";
import { readNewKey } from "@/lib/platform-key-flash";
import { Field, TextArea, Select, enumOptions } from "@/components/form";

export const dynamic = "force-dynamic";

export default async function PlatformDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(ADMIN_ROLES);
  const p = await prisma.platform.findUnique({
    where: { id: params.id },
    include: { placements: { orderBy: { createdAt: "asc" } } },
  });
  if (!p) notFound();

  const newKey = readNewKey(p.id);
  const base =
    process.env.NEXT_PUBLIC_AD_ENGINE_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader
        title={p.name}
        subtitle={`slug: ${p.slug}`}
        action={
          <div className="flex gap-2">
            <LinkButton
              href={`/admin/platforms/${p.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <form action={regenerateApiKey.bind(null, p.id)}>
              <button className="btn-danger" type="submit">
                Regenerate API Key
              </button>
            </form>
          </div>
        }
      />

      {newKey && (
        <div className="card mb-4 border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-800">
            API key — copy it now. It will not be shown again.
          </div>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-sm">
            {newKey}
          </code>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="label">Status</div>
          <Badge value={p.status} />
        </div>
        <div className="card p-4">
          <div className="label">API Key</div>
          <div className="font-mono text-xs text-slate-500">
            {p.apiKeyPrefix || "—"}… (hashed)
          </div>
        </div>
        <div className="card p-4">
          <div className="label">Allowed Domains</div>
          <div className="text-xs">
            {p.allowedDomains.length ? p.allowedDomains.join(", ") : "Any"}
          </div>
        </div>
      </div>

      <div className="card mt-4 p-4">
        <div className="label mb-1">Integration snippet</div>
        <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {`<AdSlot
  engineUrl="${base}"
  apiKey="<YOUR_API_KEY>"
  platform="${p.slug}"
  placement="${p.placements[0]?.placementKey ?? "your_placement_key"}"
  userRole="LANDLORD"
/>`}
        </pre>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Placements</h2>
      <div className="card mt-2 overflow-x-auto">
        {p.placements.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No placements defined yet." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Name</th>
                <th className="th">Key</th>
                <th className="th">Type</th>
                <th className="th">Sizes</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {p.placements.map((pl) => {
                const next = pl.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                return (
                  <tr key={pl.id} className="border-b border-slate-50">
                    <td className="td font-medium">{pl.name}</td>
                    <td className="td font-mono text-xs">{pl.placementKey}</td>
                    <td className="td">{pl.placementType}</td>
                    <td className="td text-xs">
                      {pl.allowedSizes.join(", ") || "—"}
                    </td>
                    <td className="td">
                      <Badge value={pl.status} />
                    </td>
                    <td className="td text-right">
                      <form
                        action={setPlacementStatus.bind(
                          null,
                          pl.id,
                          p.id,
                          next,
                        )}
                      >
                        <button className="btn-secondary" type="submit">
                          {next === "ACTIVE" ? "Activate" : "Deactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <form
        action={createPlacement.bind(null, p.id)}
        className="card mt-3 grid gap-4 p-4 sm:grid-cols-2"
      >
        <Field label="Placement Name" name="name" required />
        <Field
          label="Placement Key"
          name="placementKey"
          required
          placeholder="landlord_dashboard_top"
        />
        <Select
          label="Type"
          name="placementType"
          options={enumOptions([
            "BANNER",
            "SIDEBAR",
            "CARD",
            "NATIVE",
            "VIDEO",
            "SKYSCRAPER",
          ])}
        />
        <Select
          label="Status"
          name="status"
          options={enumOptions(["ACTIVE", "INACTIVE"])}
        />
        <TextArea
          label="Allowed Sizes (comma separated, e.g. 300x250)"
          name="allowedSizes"
        />
        <TextArea label="Description" name="description" />
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary">
            Add Placement
          </button>
        </div>
      </form>
    </div>
  );
}
