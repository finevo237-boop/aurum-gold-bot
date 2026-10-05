import { NextResponse } from "next/server";
import { db } from "@/db";
import { signals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatSignalMessage, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(signals).orderBy(desc(signals.createdAt)).limit(100);
    const closed = rows.filter((r) => r.resultR != null);
    const wins = closed.filter((r) => (r.resultR ?? 0) > 0);
    const stats = {
      total: rows.length,
      open: rows.filter((r) => ["ACTIVE", "TP1", "TP2"].includes(r.status)).length,
      closed: closed.length,
      wins: wins.length,
      losses: closed.length - wins.length,
      winrate: closed.length ? Math.round((wins.length / closed.length) * 100) : null,
      totalR: closed.reduce((acc, r) => acc + (r.resultR ?? 0), 0),
    };
    return NextResponse.json({ signals: rows, stats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lecture impossible" },
      { status: 500 }
    );
  }
}

/** POST { id } : renvoie manuellement un signal vers le canal Telegram */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id: number };
    const rows = await db.select().from(signals).where(eq(signals.id, id)).limit(1);
    const sig = rows[0];
    if (!sig) return NextResponse.json({ error: "Signal introuvable" }, { status: 404 });
    const res = await sendTelegram(
      formatSignalMessage({
        direction: sig.direction as "BUY" | "SELL",
        entry: sig.entry,
        tp1: sig.tp1,
        tp2: sig.tp2,
        tp3: sig.tp3,
        sl: sig.sl,
        stars: sig.stars,
        confluences: sig.confluences,
        source: "republcation manuelle",
      })
    );
    await db
      .update(signals)
      .set({ telegramSent: res.ok, telegramError: res.ok ? null : (res.error ?? null), updatedAt: new Date() })
      .where(eq(signals.id, id));
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Envoi impossible" },
      { status: 500 }
    );
  }
}
