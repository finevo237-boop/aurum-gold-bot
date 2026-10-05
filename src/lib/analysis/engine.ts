// Moteur d'analyse XAU/USD — Stratégie : H4 (tendance) + H1 (EMA200) + M15/M5 (SMC/ICT)
import type {
  AnalysisResult,
  CheckItem,
  Direction,
  SignalDraft,
} from "./types";
import {
  atrSeries,
  clamp,
  emaSeries,
  lastOf,
  round2,
  structureTrend,
} from "./indicators";
import {
  computeFib,
  detectLiquiditySweep,
  detectStructureEvents,
  findFvgs,
  findOrderBlocks,
  killzone,
  lastEventForDirection,
  pickZones,
} from "./smc";
import { getKlines, getPrice } from "../market";

const d2 = (v: number) => round2(v);

export async function runAnalysis(minStars = 5): Promise<AnalysisResult> {
  const [k4h, k1h, k15m, k5m, priceInfo] = await Promise.all([
    getKlines("4h"),
    getKlines("1h"),
    getKlines("15m"),
    getKlines("5m"),
    getPrice(),
  ]);
  const price = priceInfo.price;

  // ---------- H4 : tendance par structure SMC ----------
  const h4Struct = structureTrend(k4h.candles, 2);
  const h4Detail =
    h4Struct.trend === "BULLISH"
      ? "Sommets et creux ascendants (HH/HL)"
      : h4Struct.trend === "BEARISH"
        ? "Sommets et creux descendants (LH/LL)"
        : "Structure latérale — pas de tendance claire";

  // ---------- H1 : EMA 200 (filtre maître de la stratégie) ----------
  const closes1h = k1h.candles.map((c) => c.close);
  const ema200 = emaSeries(closes1h, 200);
  const emaNow = lastOf(ema200) ?? 0;
  const emaRef = ema200[ema200.length - 11] ?? emaNow;
  const slope = emaNow - emaRef; // pente sur ~10 heures
  const priceAbove = price > emaNow;
  const h1Trend =
    priceAbove && slope > 0 ? "BULLISH" : !priceAbove && slope < 0 ? "BEARISH" : "RANGE";

  // ---------- Direction recherchée (H4) + biais final (H4 + EMA200 H1) ----------
  const dir: Direction | null =
    h4Struct.trend === "BULLISH" ? "BUY" : h4Struct.trend === "BEARISH" ? "SELL" : null;
  const h1Confirms =
    dir === "BUY" ? priceAbove && slope > 0 : dir === "SELL" ? !priceAbove && slope < 0 : false;
  const bias: Direction | "NONE" = dir !== null && h1Confirms ? dir : "NONE";

  // ---------- M15 / M5 : structure, déclencheurs, zones ----------
  const atr15 = atrSeries(k15m.candles, 14);
  const atr5 = atrSeries(k5m.candles, 14);
  const a15 = lastOf(atr15) ?? 1;
  const a5 = lastOf(atr5) ?? 0.5;
  const m15Struct = structureTrend(k15m.candles, 2);
  const m5Struct = structureTrend(k5m.candles, 2);
  const events15 = detectStructureEvents(k15m.candles, atr15);
  const events5 = detectStructureEvents(k5m.candles, atr5);

  // Même sans biais confirmé (EMA200), on observe les triggers dans le sens H4
  const watch: Direction | null = dir ?? null;
  const event15 = !watch ? null : lastEventForDirection(events15, watch, 24);
  const event5 = !watch ? null : lastEventForDirection(events5, watch, 30);

  // ---------- Zones d'entrée (Order Blocks + FVG) dans le sens H4 ----------
  let zonesPicked: ReturnType<typeof pickZones> = { zones: [], active: null };
  if (watch) {
    const ob15 = findOrderBlocks(k15m.candles, atr15, events15, watch, "15m");
    const fvg15 = findFvgs(k15m.candles, atr15, watch, "15m");
    const ob5 = findOrderBlocks(k5m.candles, atr5, events5, watch, "5m", 120);
    const fvg5 = findFvgs(k5m.candles, atr5, watch, "5m", 120);
    zonesPicked = pickZones([...ob15, ...fvg15, ...ob5, ...fvg5], price, a15);
  }
  const activeZone = zonesPicked.active;
  const zoneOk = !!activeZone?.inZone;

  // ---------- Fibonacci 0.50 – 0.68 sur la jambe d'impulsion ----------
  const fibAnchor =
    event15?.index ?? event5?.index ?? Math.max(10, k15m.candles.length - 1);
  const fib =
    bias === "NONE"
      ? computeFib(k15m.candles, "BUY", price, fibAnchor) // indicative seulement
      : computeFib(k15m.candles, bias, price, fibAnchor);

  // ---------- ICT : sweep de liquidité + killzone ----------
  const sweep = !watch
    ? { detected: false, detail: "—" }
    : detectLiquiditySweep(k15m.candles, watch);
  const session = killzone();

  // ---------- Vérifications = étoiles ----------
  const dirLabel = bias === "BUY" ? "haussière" : bias === "SELL" ? "baissière" : "—";
  const checks: CheckItem[] = [
    {
      id: "h4",
      label: "Tendance H4 (structure SMC)",
      ok: dir !== null,
      detail: h4Detail,
    },
    {
      id: "h1ema",
      label: "EMA 200 H1 alignée",
      ok: dir !== null && h1Confirms,
      detail: `EMA200 = ${d2(emaNow)} · pente 10h = ${slope >= 0 ? "+" : ""}${d2(slope)}$ · prix ${priceAbove ? "au-dessus" : "en-dessous"}`,
    },
    {
      id: "trigger",
      label: "Déclencheur M15 (CHoCH / BOS)",
      ok: !!event15 && event15.candlesAgo <= 12,
      detail: event15
        ? `${event15.type} ${event15.direction === "BUY" ? "haussier" : "baissier"} — cassure de ${d2(event15.brokenLevel)} il y a ${event15.candlesAgo} bougie(s) · displacement ${d2(event15.displacement)} ATR`
        : "Aucun CHoCH/BOS récent dans le sens du biais",
    },
    {
      id: "zone",
      label: "Zone d'entrée (Order Block / FVG)",
      ok: zoneOk,
      detail: activeZone
        ? `${activeZone.kind} ${activeZone.tf} [${d2(activeZone.bottom)} – ${d2(activeZone.top)}] · CE ${d2(activeZone.ce)} · ${activeZone.inZone ? "prix DANS la zone" : `prix à ${d2(activeZone.distance)}$ de la zone`}`
        : "Aucune zone valide à proximité du prix",
    },
    {
      id: "fib",
      label: "Fibonacci 0.50 – 0.68",
      ok: fib.inZone,
      detail:
        fib.status === "NO_LEG"
          ? "Pas de jambe d'impulsion exploitable"
          : `Retracement ${(fib.retracement * 100).toFixed(1)}% de la jambe ${d2(fib.anchorLow)} → ${d2(fib.anchorHigh)}`,
    },
  ];
  const stars = checks.filter((c) => c.ok).length;
  const qualifies = bias !== "NONE" && stars >= minStars;

  // ---------- Construction du signal ----------
  let signal: SignalDraft | null = null;
  const note: string[] = [];
  if (qualifies && activeZone) {
    const legExtreme = bias === "BUY" ? fib.anchorLow : fib.anchorHigh;
    const zoneExtreme = bias === "BUY" ? activeZone.bottom : activeZone.top;
    const structural =
      bias === "BUY"
        ? Math.min(zoneExtreme, legExtreme) - 0.35 * a15
        : Math.max(zoneExtreme, legExtreme) + 0.35 * a15;
    let dist = Math.abs(price - structural);
    const minDist = Math.max(1.0 * a15, 1.6); // plancher anti-bruit (spread/volatilité or)
    const maxDist = 2.6 * a15;
    if (dist < minDist) note.push("SL structurel trop serré → distance minimale ATR appliquée");
    if (dist > maxDist) note.push("SL structurel trop large → plafonné à 2.6 × ATR M15");
    dist = clamp(dist, minDist, maxDist);

    const entry = d2(price);
    const sl = d2(bias === "BUY" ? entry - dist : entry + dist);
    const tp1 = d2(bias === "BUY" ? entry + 1.5 * dist : entry - 1.5 * dist);
    const tp2 = d2(bias === "BUY" ? entry + 2.5 * dist : entry - 2.5 * dist);
    const tp3 = d2(bias === "BUY" ? entry + 4.0 * dist : entry - 4.0 * dist);

    const conf: string[] = checks
      .filter((c) => c.ok)
      .map(
        (c) =>
          ({
            h4: `Tendance H4 ${dirLabel}`,
            h1ema: `EMA200 H1 ${dirLabel}`,
            trigger: `${event15?.type ?? "BOS"} M15`,
            zone: `${activeZone.kind} ${activeZone.tf.toUpperCase()}`,
            fib: `Fibonacci ${(fib.retracement * 100).toFixed(0)}%`,
          })[c.id] ?? c.label
      );
    if (sweep.detected) conf.push("Sweep liquidité (ICT)");
    if (event5 && event5.candlesAgo <= 10) conf.push(`Confirmation ${event5.type} M5`);
    if (session.includes("Killzone")) conf.push(session + " (ICT)");

    signal = {
      direction: bias as Direction,
      entry,
      sl,
      tp1,
      tp2,
      tp3,
      riskDistance: d2(dist),
      confluences: conf,
      stars,
    };
  } else {
    if (dir === null) note.push("Tendance H4 en range — pas de direction exploitable.");
    else if (bias === "NONE")
      note.push(
        `Tendance H4 ${dir === "BUY" ? "haussière" : "baissière"} détectée, mais EMA200 H1 non alignée — attente de confirmation avant toute entrée.`
      );
    if (watch && !event15) note.push("Attente d'un CHoCH/BOS M15.");
    if (watch && event15 && !zoneOk)
      note.push("Prix hors zone OB/FVG — patience, le prix doit revenir dans la zone.");
    if (watch && zoneOk && !fib.inZone)
      note.push("Zone atteinte mais retracement Fibonacci hors 50–68%.");
  }

  return {
    at: new Date().toISOString(),
    symbol: priceInfo.symbol,
    source: priceInfo.source,
    price,
    change24h: priceInfo.change24h,
    session,
    bias,
    stars,
    qualifies,
    h4: { trend: h4Struct.trend, detail: h4Detail },
    h1: {
      ema200: d2(emaNow),
      slope: d2(slope),
      priceAbove,
      trend: h1Trend as AnalysisResult["h1"]["trend"],
      detail: `EMA200 ${d2(emaNow)} (${priceAbove ? "sous le prix" : "sur le prix"}), pente ${slope >= 0 ? "positive" : "négative"}`,
    },
    m15: {
      trend: m15Struct.trend,
      event: event15,
      detail: event15
        ? `${event15.type} · niveau ${d2(event15.brokenLevel)} · il y a ${event15.candlesAgo} bougies`
        : "Pas de cassure récente",
    },
    m5: { trend: m5Struct.trend, event: event5 },
    sweep,
    zones: zonesPicked.zones.map((z) => ({
      ...z,
      top: d2(z.top),
      bottom: d2(z.bottom),
      ce: d2(z.ce),
      distance: d2(z.distance),
    })),
    activeZone: activeZone
      ? { ...activeZone, top: d2(activeZone.top), bottom: d2(activeZone.bottom), ce: d2(activeZone.ce), distance: d2(activeZone.distance) }
      : null,
    fib: {
      ...fib,
      anchorLow: d2(fib.anchorLow),
      anchorHigh: d2(fib.anchorHigh),
      legSize: d2(fib.legSize),
      retracement: round2(fib.retracement * 1000) / 1000,
      levels: fib.levels.map((l) => ({ ratio: l.ratio, price: d2(l.price) })),
    },
    checks,
    signal,
    note: note.join(" ") || (qualifies ? "Setup complet validé." : ""),
  };
}
