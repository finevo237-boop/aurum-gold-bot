import { NextResponse } from "next/server";
import { getKlines } from "@/lib/market";
import { emaSeries } from "@/lib/analysis/indicators";
import type { Timeframe } from "@/lib/analysis/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const tf = (new URL(req.url).searchParams.get("tf") ?? "15m") as Timeframe;
    if (!["5m", "15m", "1h", "4h"].includes(tf)) {
      return NextResponse.json({ error: "Timeframe invalide" }, { status: 400 });
    }
    const { candles, symbol, source } = await getKlines(tf, 20000);
    const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "260", 10) || 260, 600);
    const slice = candles.slice(-limit);

    // EMA200 overlay utile en H1 (filtre maître de la stratégie)
    let ema: { time: number; value: number }[] = [];
    if (tf === "1h") {
      const s = emaSeries(
        candles.map((c) => c.close),
        200
      );
      ema = slice
        .map((c) => ({ time: c.time, value: s[candles.indexOf(c)] }))
        .filter((p): p is { time: number; value: number } => p.value != null)
        .map((p) => ({ time: p.time, value: Math.round(p.value * 100) / 100 }));
    }
    return NextResponse.json({ candles: slice, ema, symbol, source, tf });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Données indisponibles" },
      { status: 502 }
    );
  }
}
