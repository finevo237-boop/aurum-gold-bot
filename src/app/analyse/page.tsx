"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Boxes, Crosshair, Layers, RefreshCw, Sigma, Waves } from "lucide-react";
import { GoldChart, type ChartMarker, type ChartPriceLine } from "@/components/charts/GoldChart";
import { CheckRow, Chip, DirectionPill, Panel, SectionHead, StarsRow, TrendBadge } from "@/components/ui";
import { api, fmtDateTime, fmtPrice, fmtTime } from "@/lib/client";
import type { AnalysisResult, Candle, Timeframe } from "@/lib/analysis/types";

const TF_LABEL: Record<Timeframe, string> = { "5m": "M5", "15m": "M15", "1h": "H1", "4h": "H4" };

interface MarketPayload {
  candles: Candle[];
  ema: { time: number; value: number }[];
  symbol: string;
  source: string;
}

function nearestTime(candles: Candle[], t: number): number {
  let best = candles[0]?.time ?? t;
  let d = Infinity;
  for (const c of candles) {
    const dd = Math.abs(c.time - t);
    if (dd < d) {
      d = dd;
      best = c.time;
    }
  }
  return best;
}

function FibGauge({ a }: { a: AnalysisResult }) {
  const pct = Math.max(0, Math.min(120, a.fib.retracement * 100));
  const pos = Math.min(100, (pct / 120) * 100);
  const zoneStart = (50 / 120) * 100;
  const zoneEnd = (68 / 120) * 100;
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <p className="kicker">Fibonacci — jambe d'impulsion</p>
        <Sigma className="h-4 w-4 text-gold-400" />
      </div>
      <div className="mt-4 flex items-baseline justify-between font-mono text-[10.5px] text-stone-500">
        <span className="num">LOW {fmtPrice(a.fib.anchorLow)}</span>
        <span className="num">HIGH {fmtPrice(a.fib.anchorHigh)}</span>
      </div>
      <div className="relative mt-2 h-3.5 rounded-full border border-white/10 bg-white/[0.03]">
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-gold-500/40 to-gold-400/60"
          style={{ left: `${zoneStart}%`, width: `${zoneEnd - zoneStart}%` }}
        />
        <motion.div
          className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
          animate={{ left: `${pos}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] text-stone-600">
        <span>0%</span>
        <span className="text-gold-300">50% — 68% (zone d'entrée)</span>
        <span>120%</span>
      </div>
      <p className="mt-4 text-center">
        <span className={`font-display num text-3xl italic ${a.fib.inZone ? "text-bull" : "text-stone-300"}`}>
          {(a.fib.retracement * 100).toFixed(1)}%
        </span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
          {a.fib.status === "IN_ZONE" ? "· dans la zone" : a.fib.status === "TOO_EARLY" ? "· pas assez retracé" : a.fib.status === "TOO_DEEP" ? "· retracement profond" : "· pas de jambe"}
        </span>
      </p>
      <div className="mt-4 space-y-1.5">
        {a.fib.levels.map((l) => (
          <div key={l.ratio} className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-1.5 font-mono text-[11px] text-stone-400">
            <span>FIB {l.ratio}</span>
            <span className="num text-gold-200">{fmtPrice(l.price)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ZonesList({ a }: { a: AnalysisResult }) {
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <p className="kicker">Zones SMC à proximité</p>
        <Layers className="h-4 w-4 text-gold-400" />
      </div>
      <div className="mt-4 space-y-2">
        {a.zones.length === 0 && <p className="font-mono text-[11px] text-stone-600">Aucune zone valide détectée à proximité du prix.</p>}
        {a.zones.map((z, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3.5 py-2.5 ${z.inZone ? "border-gold-500/50 bg-gold-500/[0.08]" : "border-white/[0.06] bg-white/[0.02]"}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Chip tone={z.inZone ? "gold" : "neutral"}>{z.kind} {z.tf.toUpperCase()}</Chip>
                {z.inZone && <span className="font-mono text-[9px] uppercase tracking-widest text-gold-300">prix dans la zone</span>}
              </span>
              <span className="font-mono text-[9.5px] text-stone-500">{z.direction === "BUY" ? "demande" : "offre"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
              <span className="num text-stone-300">{fmtPrice(z.bottom)} — {fmtPrice(z.top)}</span>
              <span className="text-stone-500">CE <span className="num text-gold-200">{fmtPrice(z.ce)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function AnalysePage() {
  const [tf, setTf] = useState<Timeframe>("15m");
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scans, setScans] = useState<{ id: number; mode: string; price: number; bias: string; stars: number; signalId: number | null; createdAt: string }[]>([]);

  const loadMarket = useCallback((t: Timeframe) => {
    api<MarketPayload>(`/api/market?tf=${t}&limit=280`).then(setMarket).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    loadMarket(tf);
    const id = setInterval(() => loadMarket(tf), 20000);
    return () => clearInterval(id);
  }, [tf, loadMarket]);

  useEffect(() => {
    api<{ analysis: AnalysisResult | null }>("/api/analyze")
      .then((d) => d.analysis && setAnalysis(d.analysis))
      .catch(() => {});
    api<{ recentScans: typeof scans }>("/api/status").then((d) => setScans(d.recentScans)).catch(() => {});
  }, []);

  const runAnalysis = async () => {
    setBusy(true);
    setErr(null);
    try {
      const out = await api<{ analysis: AnalysisResult }>("/api/analyze", { method: "POST" });
      setAnalysis(out.analysis);
      const s = await api<{ recentScans: typeof scans }>("/api/status");
      setScans(s.recentScans);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const overlays = useMemo(() => {
    const priceLines: ChartPriceLine[] = [];
    const markers: ChartMarker[] = [];
    if (!analysis || !market) return { priceLines, markers };
    const c = market.candles;
    if (!c.length) return { priceLines, markers };

    for (const l of analysis.fib.levels) {
      if (l.price > 0)
        priceLines.push({ price: l.price, color: "rgba(232,200,95,0.55)", title: `FIB ${l.ratio}`, dashed: true });
    }
    if (analysis.activeZone) {
      priceLines.push({ price: analysis.activeZone.top, color: "rgba(167,139,250,0.8)", title: `${analysis.activeZone.kind} ${analysis.activeZone.tf.toUpperCase()}`, dashed: true });
      priceLines.push({ price: analysis.activeZone.bottom, color: "rgba(167,139,250,0.8)", title: "", dashed: true });
      priceLines.push({ price: analysis.activeZone.ce, color: "rgba(167,139,250,0.45)", title: "CE", dashed: true });
    }
    if (tf === "1h") {
      priceLines.push({ price: analysis.h1.ema200, color: "#e8c85f", title: "EMA200", dashed: false });
    }
    if (analysis.signal) {
      const s = analysis.signal;
      priceLines.push({ price: s.entry, color: "#ffffff", title: "ENTRÉE" });
      priceLines.push({ price: s.sl, color: "#f4637c", title: "SL" });
      priceLines.push({ price: s.tp1, color: "rgba(45,212,160,0.85)", title: "TP1", dashed: true });
      priceLines.push({ price: s.tp2, color: "rgba(45,212,160,0.85)", title: "TP2", dashed: true });
      priceLines.push({ price: s.tp3, color: "rgba(45,212,160,0.85)", title: "TP3", dashed: true });
    }
    const ev = tf === "5m" ? analysis.m5.event : tf === "15m" ? analysis.m15.event : null;
    if (ev) {
      markers.push({
        time: nearestTime(c, ev.time),
        position: ev.direction === "BUY" ? "belowBar" : "aboveBar",
        color: ev.direction === "BUY" ? "#2dd4a0" : "#f4637c",
        shape: ev.direction === "BUY" ? "arrowUp" : "arrowDown",
        text: ev.type,
      });
    }
    return { priceLines, markers };
  }, [analysis, market, tf]);

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="Salle des marchés"
        title={<>Analyse <span className="gold-text italic">multi-timeframes</span></>}
        right={
          <button
            onClick={runAnalysis}
            disabled={busy}
            className="group flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-300 transition-all hover:bg-gold-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : "transition-transform group-hover:rotate-90"}`} />
            {busy ? "Analyse du marché…" : "Lancer l'analyse"}
          </button>
        }
      />

      {err && <p className="rounded-xl border border-bear/30 bg-bear/10 px-4 py-2.5 font-mono text-[11px] text-bear">{err}</p>}

      <Panel className="p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1.5">
            {(Object.keys(TF_LABEL) as Timeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-[11px] tracking-widest transition-all ${tf === t ? "bg-gold-500/20 text-gold-200 border border-gold-500/40" : "text-stone-500 border border-transparent hover:text-stone-300"}`}
              >
                {TF_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-stone-500">
            {analysis && (
              <>
                <span className="num">XAU/USD {fmtPrice(analysis.price)}</span>
                <TrendBadge trend={analysis.h4.trend} size="sm" />
              </>
            )}
            <span className="hidden md:inline">{market?.source ?? ""}</span>
          </div>
        </div>
        {market ? (
          <GoldChart data={market.candles} ema={market.ema} priceLines={overlays.priceLines} markers={overlays.markers} height={460} />
        ) : (
          <div className="grid h-[460px] place-items-center font-mono text-xs text-stone-600">
            <span className="shimmer-text text-sm">Chargement des données marché réelles…</span>
          </div>
        )}
        <p className="mt-2 px-1 font-mono text-[9.5px] text-stone-600">
          Horaires en UTC · Lignes pointillées or = niveaux Fibonacci · violet = zone OB/FVG active · vert/rouge = TP/SL du setup courant
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-6">
          <div className="flex items-center justify-between">
            <p className="kicker">Conditions d'entrée</p>
            <Crosshair className="h-4 w-4 text-gold-400" />
          </div>
          {analysis ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <StarsRow n={analysis.stars} size={18} />
                {analysis.bias !== "NONE" ? <DirectionPill direction={analysis.bias} /> : <Chip>NEUTRE</Chip>}
              </div>
              <div className="mt-4 space-y-2">
                {analysis.checks.map((c, i) => (
                  <CheckRow key={c.id} {...c} index={i} />
                ))}
              </div>
              {analysis.note && <p className="mt-3 rounded-lg border border-gold-500/20 bg-gold-500/[0.05] px-3 py-2.5 text-[11.5px] text-gold-200/90">{analysis.note}</p>}
            </>
          ) : (
            <p className="mt-4 font-mono text-[11px] text-stone-600">Aucune analyse chargée. Cliquez sur « Lancer l'analyse ».</p>
          )}
        </Panel>

        {analysis ? <FibGauge a={analysis} /> : <Panel className="p-6 font-mono text-[11px] text-stone-600">Fibonacci en attente…</Panel>}
        {analysis ? <ZonesList a={analysis} /> : <Panel className="p-6 font-mono text-[11px] text-stone-600">Zones en attente…</Panel>}
      </div>

      {analysis?.sweep.detected && (
        <Panel className="flex items-center gap-3 border-gold-500/25 p-4">
          <Waves className="h-4 w-4 shrink-0 text-gold-400" />
          <p className="font-mono text-[11.5px] text-stone-300">ICT — {analysis.sweep.detail}</p>
        </Panel>
      )}

      <Panel className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-gold-400" />
          <p className="kicker">Journal des balayages du moteur</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left font-mono text-[11px]">
            <thead>
              <tr className="text-stone-600">
                <th className="pb-2 font-normal">Heure</th>
                <th className="pb-2 font-normal">Mode</th>
                <th className="pb-2 font-normal">Prix</th>
                <th className="pb-2 font-normal">Biais</th>
                <th className="pb-2 font-normal">Étoiles</th>
                <th className="pb-2 font-normal">Signal</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id} className="border-t border-white/[0.04] text-stone-400">
                  <td className="py-2">{fmtDateTime(s.createdAt)} · {fmtTime(s.createdAt)}</td>
                  <td className="py-2 uppercase">{s.mode}</td>
                  <td className="py-2 num">{fmtPrice(s.price)}</td>
                  <td className={`py-2 ${s.bias === "BUY" ? "text-bull" : s.bias === "SELL" ? "text-bear" : "text-stone-600"}`}>{s.bias}</td>
                  <td className="py-2 text-gold-400">{s.stars > 0 ? "★".repeat(s.stars) : "—"}</td>
                  <td className="py-2">{s.signalId ? <span className="text-bull">#{s.signalId}</span> : <span className="text-stone-600">—</span>}</td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-stone-600">Le moteur n'a encore effectué aucun balayage.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
