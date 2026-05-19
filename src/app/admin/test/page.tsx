import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TestRunner } from "./TestRunner";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function TestDeliveryPage() {
  await requireRole(STAFF_ROLES);

  const platforms = await prisma.platform.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      placements: {
        where: { status: "ACTIVE" },
        select: { id: true, placementKey: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  // Derive the engine origin so the harness exercises the public API exactly
  // the way a host app would (going out and back through the network).
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const engineUrl =
    process.env.NEXT_PUBLIC_AD_ENGINE_URL ?? `${proto}://${host}`;

  return (
    <div>
      <PageHeader
        title="Test Delivery"
        subtitle="End-to-end verification of serve, diagnose, impression, click, and the live plugin — using the same APIs host apps use."
      />
      {platforms.length === 0 ? (
        <div className="card p-6 text-sm text-slate-500">
          No active platforms. Register one in /admin/platforms first.
        </div>
      ) : (
        <TestRunner
          engineUrl={engineUrl}
          platforms={platforms.map((p) => ({
            slug: p.slug,
            name: p.name,
            placements: p.placements,
          }))}
        />
      )}
    </div>
  );
}
