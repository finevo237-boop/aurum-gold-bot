import { NextResponse } from "next/server";
import { db } from "@/db";
import { scans, signals } from "@/db/schema";
import { desc, inArray, count } from "drizzle-orm";
import { getPrice } from "@/lib/market";
import { getEngineState } from "@/lib/loop";
import { getStrategyParams, getTelegramConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [price, lastScan, recentScans, openCount, tg, params] = await Promise.all([
      getPrice().catch(() => null),
      db.select().from(scans).orderBy(desc(scans.createdAt)).limit(1).then((r) => r[0] ?? null),
      db
        .select({
          id: scans.id,
          mode: scans.mode,
          price: scans.price,
          bias: scans.bias,
          stars: scans.stars,
          signalId: scans.signalId,
          createdAt: scans.createdAt,
        })
        .from(scans)
        .orderBy(desc(scans.createdAt))
        .limit(10),
      db
        .select({ n: count() })
        .from(signals)
        .where(inArray(signals.status, ["ACTIVE", "TP1", "TP2"]))
        .then((r) => r[0]?.n ?? 0),
      getTelegramConfig(),
      getStrategyParams(),
    ]);

    return NextResponse.json({
      price,
      engine: getEngineState(),
      lastAnalysis: lastScan?.analysis ?? null,
      lastScanAt: lastScan?.createdAt ?? null,
      recentScans,
      openSignals: openCount,
      telegramConfigured: tg.configured,
      telegramOrigin: tg.origin,
      params,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Statut indisponible" },
      { status: 500 }
    );
  }
}
