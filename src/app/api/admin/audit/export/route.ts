import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, ADMIN_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function csvField(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Admin-only CSV export of audit log rows matching the same filters as the
 * /admin/audit page. Capped at 5,000 rows per pull (newest first).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);

  const where: Prisma.AuditLogWhereInput = {};
  const entity = url.searchParams.get("entity");
  if (entity && (ENTITIES as readonly string[]).includes(entity)) {
    where.entity = entity;
  }
  const actor = (url.searchParams.get("actor") ?? "").trim();
  if (actor)
    where.actorEmail = { contains: actor, mode: "insensitive" };
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q) where.action = { contains: q, mode: "insensitive" };
  const range: { gte?: Date; lte?: Date } = {};
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && !Number.isNaN(Date.parse(from))) range.gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    range.lte = end;
  }
  if (Object.keys(range).length > 0) where.createdAt = range;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = "when,actor,action,entity,entityId,metadata";
  const body = rows
    .map((r) =>
      [
        csvField(r.createdAt.toISOString()),
        csvField(r.actorEmail),
        csvField(r.action),
        csvField(r.entity),
        csvField(r.entityId),
        csvField(r.metadata ?? ""),
      ].join(","),
    )
    .join("\n");

  return new NextResponse(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log.csv"`,
    },
  });
}
