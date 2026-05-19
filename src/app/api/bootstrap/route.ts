import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-time, key-protected seed endpoint so the DB can be populated without
 * local CLI access. Requires the SUPERADMIN_MASTER_KEY (sent as
 * X-Bootstrap-Key header or ?key=). Idempotent — existing platform API keys
 * are never regenerated. Tables must already exist (migrations run on deploy).
 */
export async function POST(req: Request) {
  const master = process.env.SUPERADMIN_MASTER_KEY ?? "";
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@cayworks.example";

  if (master.length < 8) {
    return NextResponse.json(
      { ok: false, error: "SUPERADMIN_MASTER_KEY is not configured" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const provided =
    req.headers.get("x-bootstrap-key") ?? url.searchParams.get("key") ?? "";
  if (provided !== master) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runSeed(prisma, { email, password: master });
    return NextResponse.json({
      ok: true,
      superadminEmail: result.superadminEmail,
      // Raw keys are returned only for platforms created on THIS call.
      newPlatformKeys: result.newPlatformKeys,
      log: result.log,
      note: "Save any newPlatformKeys now — they are not retrievable again.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message.slice(0, 300) : "Seed failed",
        hint: "If the error mentions a missing table, redeploy so migrations run, then retry.",
      },
      { status: 500 },
    );
  }
}
