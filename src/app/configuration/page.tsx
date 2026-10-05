"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Bot,
  CircleAlert,
  Database,
  KeyRound,
  MessageSquareText,
  Radio,
  Save,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { Chip, Panel, SectionHead } from "@/components/ui";
import { api, fmtTime } from "@/lib/client";

interface SettingsPayload {
  telegram: { configured: boolean; origin: string; tokenMasked: string; chatId: string };
  strategy: { minStars: number; cooldownMin: string; autoScan: boolean };
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-[12.5px] text-stone-200 placeholder:text-stone-600 transition-all";

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border px-4 py-2.5 font-mono text-[11px] ${ok ? "border-bull/30 bg-bull/10 text-bull" : "border-bear/30 bg-bear/10 text-bear"}`}
    >
      {msg}
    </motion.p>
  );
}

export default function ConfigurationPage() {
  const [cfg, setCfg] = useState<SettingsPayload | null>(null);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [minStars, setMinStars] = useState(5);
  const [cooldown, setCooldown] = useState(45);
  const [autoScan, setAutoScan] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [engine, setEngine] = useState<{ running: boolean; lastTickAt: string | null; lastError: string | null } | null>(null);
  const [priceSrc, setPriceSrc] = useState<{ source: string; price: number } | null>(null);

  const load = () => {
    api<SettingsPayload>("/api/settings")
      .then((d) => {
        setCfg(d);
        setChatId((v) => v || d.telegram.chatId || "");
        setMinStars(d.strategy.minStars);
        setCooldown(parseInt(d.strategy.cooldownMin, 10) || 45);
        setAutoScan(d.strategy.autoScan);
      })
      .catch(() => {});
    api<{ engine: typeof engine; price: { source: string; price: number } | null }>("/api/status")
      .then((d) => {
        setEngine(d.engine);
        setPriceSrc(d.price);
      })
      .catch(() => {});
  };

  useEffect(load, []);

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      await api("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken: token,
          telegramChatId: chatId,
          minStars,
          cooldownMin: cooldown,
          autoScan,
        }),
      });
      setToken("");
      setMsg({ text: "Configuration enregistrée.", ok: true });
      load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Erreur", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy("verify");
    setMsg(null);
    try {
      const v = await api<{ ok: boolean; name?: string; error?: string }>("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token }),
      });
      setMsg(v.ok ? { text: `Bot valide : @${v.name}`, ok: true } : { text: v.error ?? "Token invalide", ok: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Erreur", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy("send");
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; error?: string }>("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      setMsg(r.ok ? { text: "Message de test envoyé dans le canal ✓", ok: true } : { text: r.error ?? "Échec d'envoi", ok: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Erreur", ok: false });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHead kicker="Salle des machines" title={<>Configuration du <span className="gold-text italic">bot</span></>} />
      {msg && <Toast msg={msg.text} ok={msg.ok} />}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ——— Telegram ——— */}
        <Panel className="p-6 md:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/30 bg-gold-500/[0.08]">
                <Bot className="h-5 w-5 text-gold-400" />
              </span>
              <div>
                <h3 className="font-display text-xl text-stone-100">Canal Telegram</h3>
                <p className="font-mono text-[9.5px] uppercase tracking-widest text-stone-500">publication des signaux 5★</p>
              </div>
            </div>
            {cfg && (
              <Chip tone={cfg.telegram.configured ? "bull" : "bear"}>
                {cfg.telegram.configured ? `connecté (${cfg.telegram.origin === "db" ? "base" : "env"})` : "non configuré"}
              </Chip>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <KeyRound className="h-3 w-3" /> Token du bot (@BotFather)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={cfg?.telegram.tokenMasked || "1234567890:AA…"}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                ID du canal / chat (ex : -1001234567890 ou @moncanal)
              </label>
              <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-100…" className={inputCls} />
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button onClick={save} disabled={busy === "save"} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink transition-all hover:brightness-110 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> Enregistrer
              </button>
              <button onClick={verify} disabled={!token || busy === "verify"} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-stone-300 transition-all hover:bg-white/5 disabled:opacity-40">
                <BadgeCheck className="h-3.5 w-3.5" /> {busy === "verify" ? "Vérification…" : "Vérifier le token"}
              </button>
              <button onClick={sendTest} disabled={busy === "send"} className="flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-gold-300 transition-all hover:bg-gold-500/20 disabled:opacity-50">
                <Send className="h-3.5 w-3.5" /> {busy === "send" ? "Envoi…" : "Message de test"}
              </button>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-[11.5px] leading-relaxed text-stone-500">
              <p className="mb-1.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-widest text-gold-400"><CircleAlert className="h-3 w-3" /> Mise en route</p>
              1. Créez un bot via <span className="text-stone-300">@BotFather</span> (/newbot) et copiez le token.
              2. Ajoutez le bot à votre canal comme <span className="text-stone-300">administrateur</span>.
              3. Récupérez l'ID du canal (transférez un message à <span className="text-stone-300">@userinfobot</span> ou utilisez @username_du_canal).
              Vous pouvez aussi définir TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID dans l'environnement.
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          {/* ——— Stratégie ——— */}
          <Panel className="p-6 md:p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/30 bg-gold-500/[0.08]">
                <SlidersHorizontal className="h-5 w-5 text-gold-400" />
              </span>
              <div>
                <h3 className="font-display text-xl text-stone-100">Paramètres de la stratégie</h3>
                <p className="font-mono text-[9.5px] uppercase tracking-widest text-stone-500">SMC · ICT · Price Action</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">Étoiles minimum pour publier</p>
                <div className="flex gap-2">
                  {[3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMinStars(n)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 font-mono text-sm transition-all ${minStars === n ? "border-gold-500/60 bg-gold-500/15 text-gold-200" : "border-white/10 text-stone-500 hover:text-stone-300"}`}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[9.5px] text-stone-600">5★ = votre stratégie complète (recommandé) · 3★ = plus de signaux, moins de filtre</p>
              </div>

              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">Cooldown entre deux signaux (minutes)</p>
                <input type="number" min={5} value={cooldown} onChange={(e) => setCooldown(parseInt(e.target.value, 10) || 45)} className={inputCls} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                <div>
                  <p className="text-[13px] text-stone-200">Balayage automatique</p>
                  <p className="font-mono text-[9.5px] text-stone-500">analyse du marché toutes les 5 minutes</p>
                </div>
                <button
                  onClick={() => setAutoScan((v) => !v)}
                  className={`relative h-7 w-12 rounded-full border transition-all ${autoScan ? "border-gold-500/50 bg-gold-500/25" : "border-white/10 bg-white/5"}`}
                >
                  <span className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${autoScan ? "left-6 bg-gold-400" : "left-1 bg-stone-600"}`} />
                </button>
              </div>
            </div>
          </Panel>

          {/* ——— Système ——— */}
          <Panel className="p-6 md:p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/30 bg-gold-500/[0.08]">
                <Radio className="h-5 w-5 text-gold-400" />
              </span>
              <h3 className="font-display text-xl text-stone-100">État du système</h3>
            </div>
            <div className="mt-5 space-y-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-stone-500"><Database className="h-3.5 w-3.5" /> Flux de données</span>
                <span className="text-stone-300">{priceSrc ? priceSrc.source : "…"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3.5 py-2.5">
                <span className="text-stone-500">Moteur de balayage</span>
                <span className={engine?.running ? "text-bull" : "text-gold-300"}>
                  {engine?.running ? `actif · tick ${fmtTime(engine.lastTickAt)}` : "veille"}
                </span>
              </div>
              {engine?.lastError && (
                <div className="rounded-lg border border-bear/25 bg-bear/[0.06] px-3.5 py-2.5 text-bear">{engine.lastError}</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ——— Aperçu du message ——— */}
      <Panel className="p-6 md:p-7">
        <div className="mb-4 flex items-center gap-3">
          <MessageSquareText className="h-4 w-4 text-gold-400" />
          <p className="kicker">Aperçu du message publié dans votre canal</p>
        </div>
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#0e1621] p-5">
          <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-stone-200">
{`BUY GOLD ▲ SETUP ★★★★★

▸ Point d'entrée : 4182.40
▸ TP1 : 4190.20
▸ TP2 : 4195.40
▸ TP3 : 4203.20
▸ SL : 4177.20

Confluence : Tendance H4 haussière · EMA200 H1 · CHoCH M15 · Order Block M15 · Fibonacci 62% · Sweep liquidité (ICT)
Données temps réel — GC=F · Futures Or COMEX
Analyse SMC • ICT • Price Action`}
          </pre>
        </div>
      </Panel>
    </div>
  );
}
