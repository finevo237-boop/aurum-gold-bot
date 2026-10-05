"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
  Database,
  FlaskConical,
  Radio,
  RefreshCw,
  Send,
  Zap,
} from "lucide-react";
import { api, fmtDateTime, fmtPrice, fmtTime } from "@/lib/client";
import type { AnalysisResult } from "@/lib/analysis/types";
import { CheckRow, Chip, DirectionPill, Panel, SectionHead, StarsRow, TrendBadge } from "@/components/ui";

interface StatusPayload {
  price: { price: number; change24h: number; source: string; symbol: string } | null;
  engine: { running: boolean; lastScanAt: string | null; lastError: string | null; lastTickAt: string | null };
  lastAnalysis: AnalysisResult | null;
  lastScanAt: string | null;
  recentScans: { id: number; mode: string; price: number; bias: string; stars: number; signalId: number | null; createdAt: string }[];
  openSignals: number;
  telegramConfigured: boolean;
  params: { minStars: number; cooldownMin: number; autoScan: boolean };
}

interface SigRow {
  id: number;
  direction: string;
  stars: number;
  entry: number;
  status: string;
  telegramSent: boolean;
  resultR: number | null;
  createdAt: string;
}

function useNow(step = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(id);
  }, [step]);
  return now;
}

function HeroPrice({ status }: { status: StatusPayload | null }) {
  const price = status?.price?.price ?? null;
  const prev = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (price != null && prev.current != null && price !== prev.current) {
      setDir(price > prev.current ? "up" : "down");
    }
    if (price != null) prev.current = price;
  }, [price]);
  const change = status?.price?.change24h ?? 0;
  const a = status?.lastAnalysis;

  const now = useNow();
  const countdown = useMemo(() => {
    if (!status?.engine.lastScanAt) return null;
    const next = new Date(status.engine.lastScanAt).getTime() + 5 * 60_000;
    const diff = Math.max(0, next - now);
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [status?.engine.lastScanAt, now]);

  return (
    <Panel className="relative overflow-hidden p-7 md:p-9">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="kicker">OR — XAU/USD</span>
            <Chip tone="gold"><Database className="h-3 w-3" />{status?.price?.source ?? "Flux marché"}</Chip>
            {a?.session && <Chip><Clock3 className="h-3 w-3" />{a.session}</Chip>}
          </div>
          <div className="mt-4 flex items-end gap-4">
            <h1
              key={price}
              className={`font-display num text-[52px] leading-none md:text-[74px] ${dir === "up" ? "anim-tick-up" : dir === "down" ? "anim-tick-down" : ""}`}
            >
              <span className="gold-text italic">{price != null ? fmtPrice(price) : "····"}</span>
            </h1>
            <span className={`mb-2 flex items-center gap-1 font-mono text-sm ${change >= 0 ? "text-bull" : "text-bear"}`}>
              {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {change >= 0 ? "+" : ""}{fmtPrice(change)}%
            </span>
          </div>
          <p className="mt-3 font-mono text-[11px] tracking-wider text-stone-500">
            variation 24h · données marché réelles · unité de temps UTC
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {a && a.bias !== "NONE" ? <DirectionPill direction={a.bias} big /> : (
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 font-mono text-sm tracking-widest text-stone-400">NEUTRE</span>
          )}
          {a && <StarsRow n={a.stars} size={20} />}
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-stone-500">
            <Radio className={`h-3.5 w-3.5 ${status?.engine.running ? "text-bull" : "text-gold-400"}`} />
            {status?.engine.running
              ? countdown
                ? `prochain balayage dans ${countdown}`
                : "balayage imminent…"
              : "moteur en veille"}
          </div>
          {status && (
            <div className="flex items-center gap-2 font-mono text-[10.5px]">
              <Send className={`h-3.5 w-3.5 ${status.telegramConfigured ? "text-bull" : "text-bear"}`} />
              <span className={status.telegramConfigured ? "text-stone-400" : "text-bear"}>
                {status.telegramConfigured ? "canal Telegram connecté" : "Telegram non configuré"}
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function TfMatrix({ a }: { a: AnalysisResult | null }) {
  const cells = [
    {
      tf: "H4",
      role: "Tendance directrice",
      trend: a?.h4.trend,
      detail: a ? a.h4.detail : "—",
    },
    {
      tf: "H1",
      role: "Filtre EMA 200",
      trend: a?.h1.trend,
      detail: a ? `EMA200 ${fmtPrice(a.h1.ema200)} · pente ${a.h1.slope >= 0 ? "+" : ""}${fmtPrice(a.h1.slope)}$` : "—",
    },
    {
      tf: "M15",
      role: "Structure d'entrée",
      trend: a?.m15.trend,
      detail: a ? a.m15.detail : "—",
    },
    {
      tf: "M5",
      role: "Précision",
      trend: a?.m5.trend,
      detail: a?.m5.event ? `${a.m5.event.type} · il y a ${a.m5.event.candlesAgo} b.` : "En observation",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cells.map((c, i) => (
        <motion.div key={c.tf} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
          <Panel hover className="h-full p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl italic text-gold-300">{c.tf}</span>
              {c.trend ? <TrendBadge trend={c.trend} size="sm" /> : <span className="h-5 w-14 animate-pulse rounded-full bg-white/5" />}
            </div>
            <p className="kicker mt-3 !text-[9px] !tracking-[0.24em]">{c.role}</p>
            <p className="mt-1.5 line-clamp-2 font-mono text-[10.5px] leading-relaxed text-stone-500">{c.detail}</p>
          </Panel>
        </motion.div>
      ))}
    </div>
  );
}

function SetupPanel({ status, onAnalyze, busy }: { status: StatusPayload | null; onAnalyze: () => void; busy: boolean }) {
  const a = status?.lastAnalysis;
  return (
    <Panel className="p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="kicker">Score du setup</p>
          <h3 className="font-display mt-1.5 text-2xl text-stone-100">
            {a ? (a.qualifies ? "Setup validé" : "En formation") : "Analyse en attente"}
          </h3>
        </div>
        <button
          onClick={onAnalyze}
          disabled={busy}
          className="group flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-300 transition-all hover:bg-gold-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : "transition-transform group-hover:rotate-90"}`} />
          {busy ? "Analyse…" : "Analyser"}
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <StarsRow n={a?.stars ?? 0} size={26} />
        <span className="font-mono text-xs text-stone-500">
          {a ? `${a.stars}/5 — seuil d'envoi : ${status?.params.minStars ?? 5}★` : "…"}
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        {a ? (
          a.checks.map((c, i) => <CheckRow key={c.id} label={c.label} ok={c.ok} detail={c.detail} index={i} />)
        ) : (
          <div className="rounded-xl border border-white/5 p-4 font-mono text-[11px] text-stone-500">
            <FlaskConical className="mr-2 inline h-4 w-4 text-gold-400" />
            Le moteur exécute son premier balayage du marché…
          </div>
        )}
      </div>

      {a?.note && (
        <p className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] px-4 py-3 text-[12px] leading-relaxed text-gold-200/90">
          {a.note}
        </p>
      )}
      {a?.sweep?.detected && (
        <p className="mt-3 font-mono text-[11px] text-stone-400">
          <Activity className="mr-1.5 inline h-3.5 w-3.5 text-gold-400" />
          ICT — {a.sweep.detail}
        </p>
      )}
    </Panel>
  );
}

function LastSignals({ rows }: { rows: SigRow[] }) {
  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="kicker">Derniers signaux</p>
        <Link href="/signaux" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-gold-400 hover:text-gold-300">
          tout voir <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2.5">
        {rows.length === 0 && (
          <p className="rounded-xl border border-white/5 px-4 py-6 text-center font-mono text-[11px] text-stone-500">
            <Zap className="mx-auto mb-2 h-4 w-4 text-gold-500" />
            Aucun signal pour l'instant — le bot n'envoie que les setups 5★ complets.
          </p>
        )}
        {rows.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
            <div className="flex items-center gap-3">
              <DirectionPill direction={s.direction} />
              <div>
                <p className="num text-sm text-stone-200">@ {fmtPrice(s.entry)}</p>
                <p className="font-mono text-[9.5px] text-stone-500">{fmtDateTime(s.createdAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <StarsRow n={s.stars} size={11} animate={false} />
              <p className={`mt-1 font-mono text-[9.5px] uppercase tracking-widest ${s.status === "TP3_HIT" ? "text-bull" : s.status === "SL_HIT" ? "text-bear" : "text-gold-300"}`}>
                {s.status.replace("_HIT", "")}{s.resultR != null ? ` · ${s.resultR > 0 ? "+" : ""}${s.resultR}R` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ScanJournal({ scans }: { scans: StatusPayload["recentScans"] }) {
  return (
    <Panel className="p-6">
      <p className="kicker mb-4">Journal des balayages</p>
      <div className="space-y-1.5">
        {scans.length === 0 && <p className="font-mono text-[11px] text-stone-600">En attente du premier balayage…</p>}
        {scans.slice(0, 7).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg px-2.5 py-2 font-mono text-[10.5px] text-stone-500 odd:bg-white/[0.02]">
            <span>{fmtTime(s.createdAt)}</span>
            <span className="num">{fmtPrice(s.price)}</span>
            <span className={s.bias === "BUY" ? "text-bull" : s.bias === "SELL" ? "text-bear" : "text-stone-600"}>{s.bias}</span>
            <span className="text-gold-400">{"★".repeat(s.stars) || "—"}</span>
            <span className={s.signalId ? "text-bull" : "text-stone-600"}>{s.signalId ? "SIGNAL" : s.mode}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [sigs, setSigs] = useState<SigRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () => {
      api<StatusPayload>("/api/status").then((d) => !stop && setStatus(d)).catch((e) => !stop && setErr(e.message));
      api<{ signals: SigRow[] }>("/api/signals").then((d) => !stop && setSigs(d.signals.slice(0, 4))).catch(() => {});
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const analyze = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/analyze", { method: "POST" });
      const d = await api<StatusPayload>("/api/status");
      setStatus(d);
      const s = await api<{ signals: SigRow[] }>("/api/signals");
      setSigs(s.signals.slice(0, 4));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <HeroPrice status={status} />
      {err && <p className="rounded-xl border border-bear/30 bg-bear/10 px-4 py-2.5 font-mono text-[11px] text-bear">{err}</p>}
      <TfMatrix a={status?.lastAnalysis ?? null} />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <SetupPanel status={status} onAnalyze={analyze} busy={busy} />
        <div className="space-y-6">
          <LastSignals rows={sigs} />
          <ScanJournal scans={status?.recentScans ?? []} />
        </div>
      </div>
    </div>
  );
}
