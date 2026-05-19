import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unauthenticated health/diagnostic endpoint. Reports config + DB status
 * WITHOUT leaking secret values, so a broken deploy can be diagnosed
 * without server-log access. Safe to leave enabled.
 */
export async function GET() {
  const secret = process.env.AUTH_SECRET ?? "";
  const checks = {
    AUTH_SECRET_set: secret.length > 0,
    AUTH_SECRET_long_enough: secret.length >= 16,
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    database_reachable: false as boolean | string,
    superadmin_exists: false as boolean | string,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database_reachable = true;
    const count = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    checks.superadmin_exists = count > 0;
  } catch (err) {
    checks.database_reachable =
      err instanceof Error ? err.message.slice(0, 200) : "unknown error";
  }

  const ok =
    checks.AUTH_SECRET_long_enough &&
    checks.DATABASE_URL_set &&
    checks.database_reachable === true &&
    checks.superadmin_exists === true;

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
