// Boucle autonome du moteur — démarrée par instrumentation.ts (runtime nodejs)
import { runScan, updateOpenSignals } from "./scanner";
import { getStrategyParams } from "./settings";

export interface EngineState {
  running: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastScanAt: string | null;
  lastError: string | null;
  ticks: number;
}

const g = globalThis as unknown as {
  __engineStarted?: boolean;
  __engineState?: EngineState;
  __scanInFlight?: boolean;
};

const state: EngineState = (g.__engineState ??= {
  running: false,
  startedAt: null,
  lastTickAt: null,
  lastScanAt: null,
  lastError: null,
  ticks: 0,
});

export function getEngineState(): EngineState {
  return state;
}

const SCAN_INTERVAL = 5 * 60_000; // aligné sur les clôtures M5
let lastScanMs = 0;

async function tick() {
  state.ticks++;
  state.lastTickAt = new Date().toISOString();
  try {
    await updateOpenSignals();
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : "updateOpenSignals failed";
  }
  const now = Date.now();
  if (now - lastScanMs >= SCAN_INTERVAL && !g.__scanInFlight) {
    const { autoScan } = await getStrategyParams().catch(() => ({ autoScan: true }));
    if (!autoScan) return;
    g.__scanInFlight = true;
    lastScanMs = now;
    try {
      await runScan("auto");
      state.lastScanAt = new Date().toISOString();
      state.lastError = null;
    } catch (e) {
      state.lastError = e instanceof Error ? e.message : "scan failed";
    } finally {
      g.__scanInFlight = false;
    }
  }
}

export function startEngine() {
  if (g.__engineStarted) return;
  g.__engineStarted = true;
  state.running = true;
  state.startedAt = new Date().toISOString();
  // premier scan après stabilisation du serveur, puis toutes les minutes
  setTimeout(() => void tick(), 4000);
  setInterval(() => void tick(), 60_000);
}
