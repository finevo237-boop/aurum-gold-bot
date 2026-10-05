"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CircleDollarSign, Send, Target, TrendingUp, X, Zap } from "lucide-react";
import { Panel, SectionHead, StarsRow, DirectionPill, Chip } from "@/components/ui";
import { api, fmtDateTime, fmtPrice, STATUS_LABEL } from "@/lib/client";

interface Signal {
  id: number;
  symbol: string;
  direction: "BUY" | "SELL";
  stars: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  status: string;
  confluences: string[];
  telegramSent: boolean;
  telegramError: string | null;
  resultR: number | null;
  createdAt: string;
  closedAt: string | null;
}

interface Stats {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  winrate: number | null;
  totalR: number;
}

function ProgressRail({ s }: { s: Signal }) {
  const steps = [
    { key: "entry", label: "Entrée", price: s.entry, hit: true },
    { key: "tp1", label: "TP1", price: s.tp1, hit: ["TP1", "TP2", "TP3_HIT"].includes(s.status) },
    { key: "tp2", label: "TP2", price: s.tp2, hit: ["TP2", "TP3_HIT"].includes(s.status) },
    { key: "tp3", label: "TP3", price: s.tp3, hit: s.status === "TP3_HIT" },
  ];
  return (
    <div className="mt-4 flex items-center gap-0">
      {steps.map((st, i) => (
        <div key={st.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className={`grid h-6 w-6 place-items-center rounded-full border font-mono text-[9px] ${st.hit ? "border-bull/50 bg-bull/15 text-bull" : "border-stone-700 text-stone-600"}`}>
              {st.hit ? <Check className="h-3 w-3" /> : i}
            </span>
            <span className="whitespace-nowrap font-mono text-[8.5px] uppercase tracking-widest text-stone-500">{st.label}</span>
            <span className="num text-[10px] text-stone-400">{fmtPrice(st.price)}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-1 mb-9 h-px flex-1 ${steps[i + 1].hit ? "bg-bull/50" : "bg-stone-800"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SignalCard({ s, onResend, sending }: { s: Signal; onResend: (id: number) => void; sending: number | null }) {
  const isWin = s.status === "TP3_HIT";
  const isLoss = s.status === "SL_HIT";
  const stopHit = s.status === "SL_HIT" || s.status === "EXPIRED";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Panel hover className={`p-6 ${isWin ? "border-bull/25" : isLoss ? "border-bear/25" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <DirectionPill direction={s.direction} />
            <div>
              <StarsRow n={s.stars} size={13} animate={false} />
              <p className="mt-1 font-mono text-[9.5px] text-stone-500">#{s.id} · {fmtDateTime(s.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Chip tone={isWin ? "bull" : isLoss ? "bear" : "gold"}>
              {STATUS_LABEL[s.status] ?? s.status}
              {s.resultR != null && ` · ${s.resultR > 0 ? "+" : ""}${s.resultR}R`}
            </Chip>
            <button
              onClick={() => onResend(s.id)}
              title={s.telegramSent ? "Signal publié sur Telegram — renvoyer" : "Telegram : publication en attente — cliquer pour envoyer"}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-widest transition-all ${s.telegramSent ? "border-bull/25 bg-bull/10 text-bull" : "border-bear/30 bg-bear/10 text-bear hover:bg-bear/20"}`}
            >
              <Send className={`h-3 w-3 ${sending === s.id ? "animate-pulse" : ""}`} />
              {sending === s.id ? "…" : s.telegramSent ? "Publié" : "Envoyer"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-widest text-stone-500">Point d'entrée</p>
            <p className="num mt-1 text-sm font-semibold text-white">{fmtPrice(s.entry)}</p>
          </div>
          {[s.tp1, s.tp2, s.tp3].map((tp, i) => (
            <div key={i} className="rounded-xl border border-bull/15 bg-bull/[0.04] px-3 py-2.5">
              <p className="font-mono text-[8.5px] uppercase tracking-widest text-bull/70">TP{i + 1}</p>
              <p className="num mt-1 text-sm font-semibold text-bull">{fmtPrice(tp)}</p>
            </div>
          ))}
          <div className="rounded-xl border border-bear/15 bg-bear/[0.04] px-3 py-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-widest text-bear/70">SL</p>
            <p className="num mt-1 text-sm font-semibold text-bear">{fmtPrice(s.sl)}</p>
          </div>
        </div>

        {!stopHit && <ProgressRail s={s} />}
        {stopHit && (
          <p className={`mt-4 flex items-center gap-2 font-mono text-[10.5px] ${isLoss ? "text-bear" : "text-stone-500"}`}>
            <X className="h-3.5 w-3.5" />
            {s.status === "SL_HIT" ? `Clôturé sur le stop ${fmtPrice(s.sl)}${s.closedAt ? ` · ${fmtDateTime(s.closedAt)}` : ""}` : "Signal expiré sans issue"}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {s.confluences.map((c) => (
            <Chip key={c} tone="neutral">{c}</Chip>
          ))}
        </div>
        {s.telegramError && <p className="mt-2.5 font-mono text-[10px] text-bear/80">Telegram : {s.telegramError}</p>}
      </Panel>
    </motion.div>
  );
}

export default function SignauxPage() {
  const [data, setData] = useState<{ signals: Signal[]; stats: Stats } | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<{ signals: Signal[]; stats: Stats }>("/api/signals").then(setData).catch((e) => setErr(e.message));

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const resend = async (id: number) => {
    setSending(id);
    try {
      await api("/api/signals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      // affiché via le statut du signal
    } finally {
      setSending(null);
      load();
    }
  };

  const stats = data?.stats;
  const cards = [
    { icon: Zap, label: "Signaux émis", value: stats?.total ?? 0, tone: "text-gold-300" },
    { icon: Target, label: "En cours", value: stats?.open ?? 0, tone: "text-gold-300" },
    {
      icon: TrendingUp,
      label: "Taux de réussite",
      value: stats?.winrate != null ? `${stats.winrate}%` : "—",
      tone: (stats?.winrate ?? 0) >= 50 ? "text-bull" : "text-stone-300",
    },
    {
      icon: CircleDollarSign,
      label: "Rendement cumulé",
      value: stats ? `${stats.totalR > 0 ? "+" : ""}${stats.totalR.toFixed(1)}R` : "—",
      tone: (stats?.totalR ?? 0) > 0 ? "text-bull" : (stats?.totalR ?? 0) < 0 ? "text-bear" : "text-stone-300",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHead kicker="Carnet d'ordres" title={<>Signaux <span className="gold-text italic">5 étoiles</span></>} />
      {err && <p className="rounded-xl border border-bear/30 bg-bear/10 px-4 py-2.5 font-mono text-[11px] text-bear">{err}</p>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Panel className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/[0.07]">
                <c.icon className="h-5 w-5 text-gold-400" />
              </span>
              <span>
                <span className={`font-display num block text-2xl ${c.tone}`}>{c.value}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">{c.label}</span>
              </span>
            </Panel>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {data?.signals.length === 0 && (
          <Panel className="p-14 text-center">
            <Zap className="mx-auto h-6 w-6 text-gold-500" />
            <p className="font-display mt-4 text-xl text-stone-200">Aucun signal pour le moment</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-stone-500">
              Le bot surveille le marché en continu et ne publie que les setups réunissant suffisamment
              d'étoiles : tendance H4, EMA200 H1, CHoCH/BOS M15, zone OB/FVG et Fibonacci 0.50–0.68.
            </p>
          </Panel>
        )}
        {data?.signals.map((s) => (
          <SignalCard key={s.id} s={s} onResend={resend} sending={sending} />
        ))}
      </div>
    </div>
  );
}
