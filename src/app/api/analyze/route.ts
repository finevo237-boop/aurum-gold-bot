import { NextResponse, type NextRequest } from "next/server";
import { runScan } from "@/lib/scanner";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/ POST : lance une analyse manuelle */
export async function POST() {
  try {
    const outcome = await runScan("manual");
    return NextResponse.json(outcome);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analyse impossible" },
      { status: 502 }
    );
  }
}

/ GET : soit déclenché par le Cron (?cron=true) pour un scan auto, soit renvoie le dernier scan */
export async function GET(req: NextRequest) {
  const isCron = req.nextUrl.searchParams.get("cron") === "true";

  if (isCron) {
    try {
      const outcome = await runScan("auto");
      return NextResponse.json({ cron: true, outcome });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erreur cron scan" },
        { status: 500 }
      );
    }
  }

  try {
    const rows = await db.select().from(scans).orderBy(desc(scans.createdAt)).limit(1);
    if (!rows.length) return NextResponse.json({ analysis: null });
    return NextResponse.json({ analysis: rows[0].analysis, at: rows[0].createdAt, mode: rows[0].mode });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lecture impossible" },
      { status: 500 }
    );
  }
}
