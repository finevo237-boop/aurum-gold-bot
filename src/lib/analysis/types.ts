// Types partagés moteur d'analyse — SMC / ICT / Price Action (XAU/USD)

export type Trend = "BULLISH" | "BEARISH" | "RANGE";
export type Direction = "BUY" | "SELL";
export type Timeframe = "5m" | "15m" | "1h" | "4h";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
}

export interface StructureEvent {
  type: "CHOCH" | "BOS";
  direction: Direction;
  index: number;
  time: number;
  brokenLevel: number;
  /** taille du corps de la bougie de cassure, exprimée en ATR */
  displacement: number;
  /** nombre de bougies écoulées depuis l'événement */
  candlesAgo: number;
}

export interface Zone {
  kind: "OB" | "FVG";
  direction: Direction;
  tf: "15m" | "5m";
  top: number;
  bottom: number;
  ce: number; // 50% de la zone ("Consequential Encroachment" ICT)
  time: number;
  /** distance du prix actuel au centre de la zone, en prix */
  distance: number;
  inZone: boolean;
  mitigated: boolean;
}

export interface FibInfo {
  anchorLow: number;
  anchorHigh: number;
  legSize: number;
  /** retracement courant 0..1+ (ex: 0.618) */
  retracement: number;
  inZone: boolean; // entre 0.50 et 0.68
  levels: { ratio: number; price: number }[];
  status: "IN_ZONE" | "TOO_EARLY" | "TOO_DEEP" | "NO_LEG";
}

export interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface SignalDraft {
  direction: Direction;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskDistance: number;
  confluences: string[];
  stars: number;
}

export interface AnalysisResult {
  at: string; // ISO
  symbol: string;
  source: string;
  price: number;
  change24h: number; // %
  session: string; // Killzone ICT détectée
  bias: Direction | "NONE";
  stars: number;
  qualifies: boolean;
  h4: { trend: Trend; detail: string };
  h1: {
    ema200: number;
    slope: number; // pente en $ sur ~10 bougies
    priceAbove: boolean;
    trend: Trend;
    detail: string;
  };
  m15: { trend: Trend; event: StructureEvent | null; detail: string };
  m5: { trend: Trend; event: StructureEvent | null };
  sweep: { detected: boolean; detail: string };
  zones: Zone[];
  activeZone: Zone | null;
  fib: FibInfo;
  checks: CheckItem[];
  signal: SignalDraft | null;
  note: string;
}

export interface PriceInfo {
  price: number;
  change24h: number;
  symbol: string;
  source: string;
  at: string;
}

export const SIGNAL_STATUS = {
  ACTIVE: "ACTIVE",
  TP1: "TP1",
  TP2: "TP2",
  TP3_HIT: "TP3_HIT",
  SL_HIT: "SL_HIT",
  EXPIRED: "EXPIRED",
} as const;

export type SignalStatus = (typeof SIGNAL_STATUS)[keyof typeof SIGNAL_STATUS];

export interface SignalRow {
  id: number;
  symbol: string;
  direction: Direction;
  stars: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  status: SignalStatus;
  confluences: string[];
  telegramSent: boolean;
  telegramError: string | null;
  resultR: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}
