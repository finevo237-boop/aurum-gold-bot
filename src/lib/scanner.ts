// Orchestration : scan -> signal -> telegram -> suivi des TP/SL
import { db } from "@/db";
import { scans, signals } from "@/db/schema";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { runAnalysis } from "./analysis/engine";
import type { AnalysisResult, SignalStatus } from "./analysis/types";
import { getKlines } from "./market";
import { getStrategyParams } from "./settings";
import { formatSignalMessage, formatUpdateMessage, sendTelegram } from "./telegram";

export interface ScanOutcome {
  analysis: AnalysisResult;
  signalCreated: number | null;
  telegram: { ok: boolean; error?: string; configured: boolean } | null;
  skipped: string | null;
  scanId: number;
}

/** Lance une analyse complète, persiste le scan et publie le signal si 5★ */
export async function runScan(mode: "auto" | "manual"): Promise<ScanOutcome> {
  const { minStars, cooldownMin } = await getStrategyParams();
  const analysis = await runAnalysis(minStars);

  let signalCreated: number | null = null;
  let telegram: ScanOutcome["telegram"] = null;
  let skipped: string | null = null;

  if (analysis.qualifies && analysis.signal) {
    const since = new Date(Date.now() - cooldownMin * 60_000);
    const recent = await db
      .select()
      .from(signals)
      .where(and(eq(signals.direction, analysis.signal.direction), gte(signals.createdAt, since)))
      .orderBy(desc(signals.createdAt))
      .limit(1);
    const activeSameDir = await db
      .select({ id: signals.id })
      .from(signals)
      .where(
        and(
          eq(signals.direction, analysis.signal.direction),
          inArray(signals.status, ["ACTIVE", "TP1", "TP2"])
        )
      )
      .limit(1);

    if (recent.length || activeSameDir.length) {
      skipped = `Cooldown ${cooldownMin} min / signal ${analysis.signal.direction} déjà actif — pas de doublon.`;
    } else {
      const s = analysis.signal;
      const tg = await sendTelegram(
        formatSignalMessage({
          direction: s.direction,
          entry: s.entry,
          tp1: s.tp1,
          tp2: s.tp2,
          tp3: s.tp3,
          sl: s.sl,
          stars: s.stars,
          confluences: s.confluences,
          source: analysis.source,
        })
      );
      telegram = tg;
      const inserted = await db
        .insert(signals)
        .values({
          symbol: analysis.symbol,
          direction: s.direction,
          stars: s.stars,
          entry: s.entry,
          sl: s.sl,
          tp1: s.tp1,
          tp2: s.tp2,
          tp3: s.tp3,
          status: "ACTIVE",
          confluences: s.confluences,
          analysis: analysis as unknown as Record<string, unknown>,
          telegramSent: tg.ok,
          telegramError: tg.ok ? null : (tg.error ?? null),
        })
        .returning({ id: signals.id });
      signalCreated = inserted[0]?.id ?? null;
    }
  }

  const scanRow = await db
    .insert(scans)
    .values({
      mode,
      price: analysis.price,
      bias: analysis.bias,
      stars: analysis.stars,
      signalId: signalCreated,
      analysis: analysis as unknown as Record<string, unknown>,
    })
    .returning({ id: scans.id });

  return { analysis, signalCreated, telegram, skipped, scanId: scanRow[0]?.id ?? 0 };
}

const OPEN_STATUSES = ["ACTIVE", "TP1", "TP2"] as const;

function finalResult(status: SignalStatus): number | null {
  switch (status) {
    case "TP3_HIT":
      return 4;
    case "SL_HIT":
      return -1;
    default:
      return null;
  }
}

/** Résultat réalisé si SL après TP partiels (gestion standard : SL au BE après TP1) */
function resultAfterStatus(prevStatus: string): number {
  if (prevStatus === "TP2") return 1.5;
  if (prevStatus === "TP1") return 0;
  return -1;
}

/** Met à jour les signaux ouverts avec les bougies 5m réelles depuis leur création */
export async function updateOpenSignals(): Promise<number> {
  const open = await db
    .select()
    .from(signals)
    .where(inArray(signals.status, [...OPEN_STATUSES]))
    .orderBy(signals.createdAt);
  if (!open.length) return 0;

  const { candles } = await getKlines("5m");
  let updated = 0;

  for (const sig of open) {
    const from = Math.floor(new Date(sig.createdAt).getTime() / 1000);
    const path = candles.filter((c) => c.time >= from);
    if (!path.length) continue;

    let status: string = sig.status;
    let closed = false;
    let transitions: { kind: "TP1" | "TP2" | "TP3_HIT" | "SL_HIT"; price: number }[] = [];

    for (const c of path) {
      if (status === "TP3_HIT" || status === "SL_HIT") break;
      if (sig.direction === "BUY") {
        // conservateur : si SL et TP touchés dans la même bougie, on compte le SL
        if (c.low <= sig.sl && status !== "TP2") {
          transitions.push({ kind: "SL_HIT", price: sig.sl });
          status = "SL_HIT";
          closed = true;
          break;
        }
        if (status === "ACTIVE" && c.high >= sig.tp1) {
          transitions.push({ kind: "TP1", price: sig.tp1 });
          status = "TP1";
        }
        if (status === "TP1" && c.high >= sig.tp2) {
          transitions.push({ kind: "TP2", price: sig.tp2 });
          status = "TP2";
        }
        if (status === "TP2") {
          // après TP2, le SL est remonté au BE : sortie BE si retour sur l'entrée
          if (c.low <= sig.entry) {
            transitions.push({ kind: "SL_HIT", price: sig.entry });
            status = "SL_HIT";
            closed = true;
            break;
          }
          if (c.high >= sig.tp3) {
            transitions.push({ kind: "TP3_HIT", price: sig.tp3 });
            status = "TP3_HIT";
            closed = true;
          }
        }
      } else {
        if (c.high >= sig.sl && status !== "TP2") {
          transitions.push({ kind: "SL_HIT", price: sig.sl });
          status = "SL_HIT";
          closed = true;
          break;
        }
        if (status === "ACTIVE" && c.low <= sig.tp1) {
          transitions.push({ kind: "TP1", price: sig.tp1 });
          status = "TP1";
        }
        if (status === "TP1" && c.low <= sig.tp2) {
          transitions.push({ kind: "TP2", price: sig.tp2 });
          status = "TP2";
        }
        if (status === "TP2") {
          if (c.high >= sig.entry) {
            transitions.push({ kind: "SL_HIT", price: sig.entry });
            status = "SL_HIT";
            closed = true;
            break;
          }
          if (c.low <= sig.tp3) {
            transitions.push({ kind: "TP3_HIT", price: sig.tp3 });
            status = "TP3_HIT";
            closed = true;
          }
        }
      }
    }

    // expiration : 48h sans issue -> EXPIRED
    if (!closed && Date.now() - new Date(sig.createdAt).getTime() > 48 * 3600_000) {
      status = "EXPIRED";
      closed = true;
    }

    if (status !== sig.status) {
      const isFinal = status === "TP3_HIT" || status === "SL_HIT" || status === "EXPIRED";
      let resultR: number | null = null;
      if (status === "TP3_HIT") resultR = 4;
      else if (status === "SL_HIT") resultR = resultAfterStatus(sig.status);
      else if (status === "EXPIRED") resultR = null;

      await db
        .update(signals)
        .set({
          status: status as SignalStatus,
          resultR: isFinal ? (resultR ?? finalResult(status as SignalStatus)) : null,
          closedAt: isFinal ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(signals.id, sig.id));
      updated++;

      // notifications Telegram de suivi
      for (const t of transitions) {
        await sendTelegram(
          formatUpdateMessage(
            { direction: sig.direction as "BUY" | "SELL", entry: sig.entry },
            t.kind,
            t.price
          )
        );
      }
    }
  }
  return updated;
}
