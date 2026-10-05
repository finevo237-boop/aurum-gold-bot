import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** POST : lance une analyse complète immédiate (SMC + ICT multi-TF) */
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

/** GET : dernière analyse enregistrée */
export async function GET() {
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
