import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Key-protected seed endpoint so the DB can be populated without local CLI
 * access. Key via X-Bootstrap-Key header or ?key= (GET allowed so it can be
 * triggered from a browser). Idempotent — existing platform API keys are
 * never regenerated. Tables must already exist (migrations run on deploy).
 */
async function handle(req: Request) {
  const master = process.env.SUPERADMIN_MASTER_KEY ?? "";
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@cayworks.example";

  if (master.length < 8) {
    return NextResponse.json(
      { ok: false, error: "SUPERADMIN_MASTER_KEY is not configured (min 8 chars)" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const provided =
    req.headers.get("x-bootstrap-key") ?? url.searchParams.get("key") ?? "";
  if (provided !== master) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — key does not match SUPERADMIN_MASTER_KEY" },
      { status: 403 },
    );
  }

  try {
    const result = await runSeed(prisma, { email, password: master });
    return NextResponse.json({
      ok: true,
      superadminEmail: result.superadminEmail,
      loginWith: `${result.superadminEmail} / <your SUPERADMIN_MASTER_KEY>`,
      newPlatformKeys: result.newPlatformKeys,
      log: result.log,
      note: "Save any newPlatformKeys now — they are not retrievable again.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 300) : "Seed failed",
        hint: "If it mentions a missing table, redeploy so migrations run, then retry.",
      },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
