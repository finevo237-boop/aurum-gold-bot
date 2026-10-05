// Données de marché RÉELLES — Yahoo Finance : GC=F (futures or COMEX), fallback XAUUSD=X
import type { Candle, PriceInfo, Timeframe } from "./analysis/types";
import { round2 } from "./analysis/indicators";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const SYMBOLS = [
  { symbol: "GC=F", label: "GC=F · Futures Or COMEX (Yahoo)" },
  { symbol: "XAUUSD=X", label: "XAU/USD spot (Yahoo)" },
];

interface CacheEntry {
  at: number;
  candles: Candle[];
  symbol: string;
  source: string;
}

const g = globalThis as unknown as {
  __klCache?: Map<string, CacheEntry>;
  __priceCache?: { at: number; info: PriceInfo };
};
const cache = (g.__klCache ??= new Map());

function intervalParams(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case "5m":
      return { interval: "5m", range: "5d" };
    case "15m":
      return { interval: "15m", range: "5d" };
    case "1h":
      return { interval: "1h", range: "1mo" };
    case "4h":
      // Yahoo ne propose pas le 4h : on agrège des bougies 1h
      return { interval: "1h", range: "3mo" };
  }
}

async function fetchYahooChart(
  symbol: string,
  interval: string,
  range: string
): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=${interval}&range=${range}&includePrePost=false&events=div`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;
      const ts: number[] = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0] ?? {};
      const candles: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i];
        const h = q.high?.[i];
        const l = q.low?.[i];
        const c = q.close?.[i];
        if (o == null || h == null || l == null || c == null) continue;
        candles.push({
          time: ts[i],
          open: o,
          high: h,
          low: l,
          close: c,
          volume: q.volume?.[i] ?? 0,
        });
      }
      if (candles.length < 30) continue;
      return { candles, meta: result.meta ?? {} };
    } catch {
      // essaie l'hôte suivant
    }
  }
  return null;
}

/** Agrège des bougies 1h en bougies 4h (alignées sur les frontières unix 4h) */
export function aggregateTo4h(h1: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of h1) {
    const b = Math.floor(c.time / 14400) * 14400;
    const cur = buckets.get(b);
    if (!cur) {
      buckets.set(b, { time: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export interface KlineResult {
  candles: Candle[];
  symbol: string;
  source: string;
}

/** Récupère les chandeliers d'une timeframe (cache 15 s pour limiter le rate-limit) */
export async function getKlines(tf: Timeframe, maxAgeMs = 15000): Promise<KlineResult> {
  const cached = cache.get(tf);
  if (cached && Date.now() - cached.at < maxAgeMs) {
    return { candles: cached.candles, symbol: cached.symbol, source: cached.source };
  }
  const { interval, range } = intervalParams(tf);
  for (const s of SYMBOLS) {
    const out = await fetchYahooChart(s.symbol, interval, range);
    if (!out) continue;
    const candles = tf === "4h" ? aggregateTo4h(out.candles) : out.candles;
    if (candles.length < 30) continue;
    cache.set(tf, { at: Date.now(), candles, symbol: s.symbol, source: s.label });
    return { candles, symbol: s.symbol, source: s.label };
  }
  // dernier recours : cache même périmé
  if (cached) return { candles: cached.candles, symbol: cached.symbol, source: cached.source + " (cache)" };
  throw new Error("Sources de marché indisponibles (Yahoo Finance)");
}

/** Prix temps réel + variation 24h (cache 5 s) */
export async function getPrice(force = false): Promise<PriceInfo> {
  if (!force && g.__priceCache && Date.now() - g.__priceCache.at < 5000) {
    return g.__priceCache.info;
  }
  const { candles, symbol, source } = await getKlines("5m", force ? 0 : 15000);
  const last = candles[candles.length - 1];
  const target = last.time - 86400;
  let ref = candles[0].close;
  for (const c of candles) {
    if (c.time <= target) ref = c.close;
    else break;
  }
  const info: PriceInfo = {
    price: round2(last.close),
    change24h: round2(((last.close - ref) / ref) * 100),
    symbol,
    source,
    at: new Date().toISOString(),
  };
  g.__priceCache = { at: Date.now(), info };
  return info;
}
