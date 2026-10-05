import type { Candle, SwingPoint, Trend } from "./types";

/** EMA classique — retourne une série alignée sur les valeurs (null tant que période non remplie) */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** ATR de Wilder */
export function atrSeries(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += trueRange(candles[i], candles[i - 1]);
  }
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + trueRange(candles[i], candles[i - 1])) / period;
    out[i] = prev;
  }
  return out;
}

function trueRange(c: Candle, p: Candle): number {
  return Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
}

/** Pivots fractals : high supérieur aux k bougies de chaque côté */
export function swingHighs(candles: Candle[], k = 2): SwingPoint[] {
  const res: SwingPoint[] = [];
  for (let i = k; i < candles.length - k; i++) {
    const h = candles[i].high;
    let ok = true;
    for (let j = 1; j <= k; j++) {
      if (candles[i - j].high >= h || candles[i + j].high >= h) {
        ok = false;
        break;
      }
    }
    if (ok) res.push({ index: i, time: candles[i].time, price: h });
  }
  return res;
}

export function swingLows(candles: Candle[], k = 2): SwingPoint[] {
  const res: SwingPoint[] = [];
  for (let i = k; i < candles.length - k; i++) {
    const l = candles[i].low;
    let ok = true;
    for (let j = 1; j <= k; j++) {
      if (candles[i - j].low <= l || candles[i + j].low <= l) {
        ok = false;
        break;
      }
    }
    if (ok) res.push({ index: i, time: candles[i].time, price: l });
  }
  return res;
}

/**
 * Tendance par structure de marché (price action pur) :
 * BULLISH = derniers sommets + derniers creux ascendants (HH/HL)
 * BEARISH = LH/LL, sinon RANGE.
 */
export function structureTrend(candles: Candle[], k = 2): {
  trend: Trend;
  highs: SwingPoint[];
  lows: SwingPoint[];
} {
  const highs = swingHighs(candles, k);
  const lows = swingLows(candles, k);
  if (highs.length < 2 || lows.length < 2) return { trend: "RANGE", highs, lows };
  const h1 = highs[highs.length - 1].price;
  const h2 = highs[highs.length - 2].price;
  const l1 = lows[lows.length - 1].price;
  const l2 = lows[lows.length - 2].price;
  if (h1 > h2 && l1 > l2) return { trend: "BULLISH", highs, lows };
  if (h1 < h2 && l1 < l2) return { trend: "BEARISH", highs, lows };
  return { trend: "RANGE", highs, lows };
}

export function lastOf<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
