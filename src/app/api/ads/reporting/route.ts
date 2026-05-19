import { NextResponse } from "next/server";
import { getSessionUser, REPORT_ROLES } from "@/lib/auth";
import { buildReport, toCsv, type DateRange } from "@/lib/reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/ads/reporting — protected admin reporting endpoint.
 * Query: groupBy=campaign|platform|placement, from, to, format=json|csv
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !REPORT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dimRaw = url.searchParams.get("groupBy") ?? "campaign";
  const dim = (["campaign", "platform", "placement"] as const).includes(
    dimRaw as "campaign",
  )
    ? (dimRaw as "campaign" | "platform" | "placement")
    : "campaign";

  const range: DateRange = {};
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && !Number.isNaN(Date.parse(from))) range.from = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.to = new Date(to);

  const rows = await buildReport(dim, range);

  if (url.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${dim}.csv"`,
      },
    });
  }

  return NextResponse.json({ groupBy: dim, range, rows });
}
