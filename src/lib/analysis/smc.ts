// Détection SMC / ICT : CHoCH, BOS, Order Blocks, Fair Value Gaps, sweeps de liquidité, Fibonacci
import type { Candle, Direction, FibInfo, StructureEvent, SwingPoint, Zone } from "./types";
import { atrSeries, lastOf, swingHighs, swingLows } from "./indicators";

/**
 * Détecte les cassures de structure (CHoCH = changement de caractère contre la
 * séquence en cours, BOS = cassure dans le sens de la séquence).
 * Un pivot à l'index j est "confirmé" seulement après k bougies à droite.
 */
export function detectStructureEvents(
  candles: Candle[],
  atr: (number | null)[],
  k = 2
): StructureEvent[] {
  const events: StructureEvent[] = [];
  const confirmedHighs: SwingPoint[] = [];
  const confirmedLows: SwingPoint[] = [];
  // séquence récente: +1 haussier / -1 baissier basée sur la succession des pivots
  let lastSeqHighs: number[] = [];
  let lastSeqLows: number[] = [];

  for (let i = k; i < candles.length; i++) {
    // confirme les pivots centrés en i-k
    const c = i - k;
    if (c >= k) {
      const h = candles[c].high;
      let isHigh = true;
      for (let j = 1; j <= k; j++)
        if (candles[c - j].high >= h || candles[c + j].high >= h) isHigh = false;
      if (isHigh) {
        confirmedHighs.push({ index: c, time: candles[c].time, price: h });
        lastSeqHighs.push(h);
        if (lastSeqHighs.length > 2) lastSeqHighs = lastSeqHighs.slice(-2);
      }
      const l = candles[c].low;
      let isLow = true;
      for (let j = 1; j <= k; j++)
        if (candles[c - j].low <= l || candles[c + j].low <= l) isLow = false;
      if (isLow) {
        confirmedLows.push({ index: c, time: candles[c].time, price: l });
        lastSeqLows.push(l);
        if (lastSeqLows.length > 2) lastSeqLows = lastSeqLows.slice(-2);
      }
    }
    if (confirmedHighs.length === 0 && confirmedLows.length === 0) continue;

    const close = candles[i].close;
    const a = atr[i] ?? atr[i - 1] ?? 1;
    const body = Math.abs(candles[i].close - candles[i].open);

    // cassure au-dessus du dernier sommet confirmé -> CHoCH haussier ou BOS
    const lastHigh = lastOf(confirmedHighs);
    if (
      lastHigh &&
      lastHigh.index < i &&
      close > lastHigh.price &&
      (events.length === 0 || events[events.length - 1].index !== i)
    ) {
      const bearSeq = lastSeqLows.length === 2 && lastSeqLows[1] < lastSeqLows[0];
      events.push({
        type: bearSeq ? "CHOCH" : "BOS",
        direction: "BUY",
        index: i,
        time: candles[i].time,
        brokenLevel: lastHigh.price,
        displacement: body / a,
        candlesAgo: 0,
      });
      // évite double détection sur les bougies suivantes
      confirmedHighs.splice(confirmedHighs.indexOf(lastHigh), 1);
      continue;
    }
    const lastLow = lastOf(confirmedLows);
    if (lastLow && lastLow.index < i && close < lastLow.price) {
      const bullSeq = lastSeqHighs.length === 2 && lastSeqHighs[1] > lastSeqHighs[0];
      events.push({
        type: bullSeq ? "CHOCH" : "BOS",
        direction: "SELL",
        index: i,
        time: candles[i].time,
        brokenLevel: lastLow.price,
        displacement: body / a,
        candlesAgo: 0,
      });
      confirmedLows.splice(confirmedLows.indexOf(lastLow), 1);
    }
  }

  const n = candles.length;
  for (const e of events) e.candlesAgo = n - 1 - e.index;
  return events;
}

/** Dernier événement dans la direction demandée, idéalement récent */
export function lastEventForDirection(
  events: StructureEvent[],
  direction: Direction,
  maxAge = 24
): StructureEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.direction !== direction) continue;
    if (e.candlesAgo <= maxAge) return e;
    return null; // l'événement le plus récent dans ce sens est trop vieux
  }
  return null;
}

/**
 * Order Blocks : dernier chandelier opposé avant un mouvement de displacement
 * (forte bougie + cassure d'un pivot). Zone = range complet du chandelier OB.
 */
export function findOrderBlocks(
  candles: Candle[],
  atr: (number | null)[],
  events: StructureEvent[],
  direction: Direction,
  tf: "15m" | "5m",
  maxAge = 90
): Zone[] {
  const zones: Zone[] = [];
  const n = candles.length;
  for (const e of events) {
    if (e.direction !== direction || e.displacement < 0.55) continue;
    if (n - 1 - e.index > maxAge) continue;
    // remonte jusqu'à 5 bougies avant la cassure pour trouver la bougie opposée
    for (let j = e.index; j >= Math.max(1, e.index - 5); j--) {
      const c = candles[j];
      const opposite =
        direction === "BUY" ? c.close < c.open : c.close > c.open;
      if (!opposite) continue;
      const top = c.high;
      const bottom = c.low;
      // mitigation : clôture au-delà de l'extrême de la zone après formation
      let mitigated = false;
      for (let m = e.index + 1; m < n; m++) {
        if (
          (direction === "BUY" && candles[m].close < bottom) ||
          (direction === "SELL" && candles[m].close > top)
        ) {
          mitigated = true;
          break;
        }
      }
      if (mitigated) continue;
      const a = atr[e.index] ?? 1;
      // zone trop petite = bruit
      if (top - bottom < 0.12 * a) continue;
      zones.push({
        kind: "OB",
        direction,
        tf,
        top,
        bottom,
        ce: (top + bottom) / 2,
        time: c.time,
        distance: 0,
        inZone: false,
        mitigated: false,
      });
      break; // un OB par displacement
    }
  }
  return zones;
}

/** Fair Value Gaps (imbalances 3 bougies) non mitigés */
export function findFvgs(
  candles: Candle[],
  atr: (number | null)[],
  direction: Direction,
  tf: "15m" | "5m",
  maxAge = 90
): Zone[] {
  const zones: Zone[] = [];
  const n = candles.length;
  for (let i = 2; i < n; i++) {
    if (n - 1 - i > maxAge) continue;
    const a = atr[i] ?? 1;
    if (direction === "BUY") {
      const bottom = candles[i - 2].high;
      const top = candles[i].low;
      if (top - bottom < 0.15 * a) continue;
      let mitigated = false;
      for (let m = i + 1; m < n; m++)
        if (candles[m].close < bottom) {
          mitigated = true;
          break;
        }
      if (!mitigated)
        zones.push({
          kind: "FVG",
          direction,
          tf,
          top,
          bottom,
          ce: (top + bottom) / 2,
          time: candles[i - 1].time,
          distance: 0,
          inZone: false,
          mitigated: false,
        });
    } else {
      const top = candles[i - 2].low;
      const bottom = candles[i].high;
      if (top - bottom < 0.15 * a) continue;
      let mitigated = false;
      for (let m = i + 1; m < n; m++)
        if (candles[m].close > top) {
          mitigated = true;
          break;
        }
      if (!mitigated)
        zones.push({
          kind: "FVG",
          direction,
          tf,
          top,
          bottom,
          ce: (top + bottom) / 2,
          time: candles[i - 1].time,
          distance: 0,
          inZone: false,
          mitigated: false,
        });
    }
  }
  return zones;
}

/** Sweep de liquidité ICT : mèche sous un creux (ou au-dessus d'un sommet) puis reprise */
export function detectLiquiditySweep(
  candles: Candle[],
  direction: Direction,
  k = 2,
  lookback = 35
): { detected: boolean; detail: string } {
  const n = candles.length;
  const start = Math.max(k + 1, n - lookback);
  const isBull = direction === "BUY";
  for (let i = n - 3; i >= start; i--) {
    const lows = swingLows(candles.slice(0, i), k);
    const highs = swingHighs(candles.slice(0, i), k);
    if (isBull && lows.length) {
      const ref = lows[lows.length - 1];
      if (
        candles[i].low < ref.price &&
        candles[i].close > ref.price &&
        n - 1 - i <= 12
      )
        return {
          detected: true,
          detail: `Sweep des creux @ ${ref.price.toFixed(2)} repris il y a ${n - 1 - i} bougie(s)`,
        };
    }
    if (!isBull && highs.length) {
      const ref = highs[highs.length - 1];
      if (
        candles[i].high > ref.price &&
        candles[i].close < ref.price &&
        n - 1 - i <= 12
      )
        return {
          detected: true,
          detail: `Sweep des sommets @ ${ref.price.toFixed(2)} rejeté il y a ${n - 1 - i} bougie(s)`,
        };
    }
  }
  return { detected: false, detail: "Aucun sweep de liquidité récent" };
}

/**
 * Fibonacci sur la jambe d'impulsion associée au déclencheur.
 * BUY : du creux origine -> dernier sommet ; retracement courant (legHigh - prix)/amplitude.
 * Zone d'entrée de la stratégie : retracement entre 0.50 et 0.68.
 */
export function computeFib(
  candles: Candle[],
  direction: Direction,
  price: number,
  anchorIndex: number
): FibInfo {
  const n = candles.length;
  const from = Math.max(0, anchorIndex - 45);
  const empty: FibInfo = {
    anchorLow: 0,
    anchorHigh: 0,
    legSize: 0,
    retracement: 0,
    inZone: false,
    levels: [],
    status: "NO_LEG",
  };
  if (n < 10) return empty;

  let anchorLow = Infinity;
  let anchorHigh = -Infinity;
  if (direction === "BUY") {
    for (let i = from; i <= anchorIndex; i++) anchorLow = Math.min(anchorLow, candles[i].low);
    for (let i = from; i < n; i++) anchorHigh = Math.max(anchorHigh, candles[i].high);
  } else {
    for (let i = from; i <= anchorIndex; i++) anchorHigh = Math.max(anchorHigh, candles[i].high);
    for (let i = from; i < n; i++) anchorLow = Math.min(anchorLow, candles[i].low);
  }
  const legSize = anchorHigh - anchorLow;
  if (legSize <= 0) return empty;

  const ratios = [0.5, 0.618, 0.68];
  const levels = ratios.map((r) => ({
    ratio: r,
    price:
      direction === "BUY"
        ? anchorHigh - r * legSize
        : anchorLow + r * legSize,
  }));

  const retracement =
    direction === "BUY"
      ? (anchorHigh - price) / legSize
      : (price - anchorLow) / legSize;

  const inZone = retracement >= 0.5 && retracement <= 0.68;
  const status = inZone
    ? "IN_ZONE"
    : retracement < 0.5
      ? "TOO_EARLY"
      : retracement > 0.68 && retracement <= 1.05
        ? "TOO_DEEP"
        : "NO_LEG";

  return { anchorLow, anchorHigh, legSize, retracement, inZone, levels, status };
}

/** Killzones ICT (UTC) : Londres 07h-10h, New York 12h-15h */
export function killzone(now = new Date()): string {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (h >= 7 && h < 10) return "Killzone Londres";
  if (h >= 12 && h < 15) return "Killzone New York";
  const d = now.getUTCDay();
  if (d === 0 || d === 6) return "Week-end — marché OTC";
  if (h >= 0 && h < 7) return "Session Asie";
  return "Hors killzone";
}

/** Sélectionne la meilleure zone d'entrée (la plus proche du prix, non mitigée) */
export function pickZones(
  zones: Zone[],
  price: number,
  atr: number
): { zones: Zone[]; active: Zone | null } {
  const enriched = zones
    .map((z) => {
      const ref = z.ce;
      const distance = Math.abs(price - ref);
      const inZone =
        price >= z.bottom - 0.15 * atr && price <= z.top + 0.15 * atr;
      return { ...z, distance, inZone };
    })
    .filter((z) => z.distance <= 2.2 * atr)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
  const active = enriched.find((z) => z.inZone) ?? enriched[0] ?? null;
  return { zones: enriched, active };
}
