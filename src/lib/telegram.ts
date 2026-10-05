// Intégration Telegram Bot API — envoi des signaux 5★ dans le canal
import { getTelegramConfig } from "./settings";

const f = (v: number) => v.toFixed(2);

export function formatSignalMessage(s: {
  direction: "BUY" | "SELL";
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  stars: number;
  confluences: string[];
  source: string;
}): string {
  const stars = "★".repeat(s.stars) + "☆".repeat(Math.max(0, 5 - s.stars));
  const arrow = s.direction === "BUY" ? "▲" : "▼";
  const lines = [
    `<b>${s.direction} GOLD ${arrow} SETUP ${stars}</b>`,
    ``,
    `▸ Point d'entrée : <b>${f(s.entry)}</b>`,
    `▸ TP1 : <b>${f(s.tp1)}</b>`,
    `▸ TP2 : <b>${f(s.tp2)}</b>`,
    `▸ TP3 : <b>${f(s.tp3)}</b>`,
    `▸ SL : <b>${f(s.sl)}</b>`,
    ``,
    `Confluence : ${s.confluences.join(" · ")}`,
    `Données temps réel — ${s.source}`,
    `Analyse SMC • ICT • Price Action`,
  ];
  return lines.join("\n");
}

export function formatUpdateMessage(
  s: { direction: "BUY" | "SELL"; entry: number },
  kind: "TP1" | "TP2" | "TP3_HIT" | "SL_HIT",
  hitPrice: number
): string {
  const base = `<b>${s.direction} GOLD</b> @ ${f(s.entry)}`;
  if (kind === "TP1")
    return [`<b>TP1 ATTEINT ✓</b> — ${base}`, `TP1 : ${f(hitPrice)} (+1.5R)`, `Gestion : SL au breakeven, laisser courir.`].join("\n");
  if (kind === "TP2")
    return [`<b>TP2 ATTEINT ✓</b> — ${base}`, `TP2 : ${f(hitPrice)} (+2.5R)`, `Gestion : sécuriser, viser TP3.`].join("\n");
  if (kind === "TP3_HIT")
    return [`<b>TP3 ATTEINT ✓ — SIGNAL CLÔTURÉ</b>`, base, `TP3 : ${f(hitPrice)} (+4R)`, `Setup 5★ déroulé intégralement.`].join("\n");
  return [`<b>STOP LOSS TOUCHÉ ✗ — SIGNAL CLÔTURÉ</b>`, base, `SL : ${f(hitPrice)} (-1R)`, `Discipline avant tout. Prochain setup 5★ en surveillance.`].join(
    "\n"
  );
}

export function formatTestMessage(): string {
  return [
    `<b>AURUM — Bot de signaux XAU/USD connecté ✓</b>`,
    ``,
    `Le moteur SMC • ICT • Price Action surveille l'or en temps réel.`,
    `Les setups 5★ seront publiés ici automatiquement avec :`,
    `point d'entrée, TP1, TP2, TP3 et SL.`,
  ].join("\n");
}

export interface TelegramResult {
  ok: boolean;
  error?: string;
  configured: boolean;
}

export async function sendTelegram(text: string): Promise<TelegramResult> {
  const cfg = await getTelegramConfig();
  if (!cfg.configured || !cfg.token || !cfg.chatId) {
    return { ok: false, configured: false, error: "Telegram non configuré (token / chat id manquants)" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return {
        ok: false,
        configured: true,
        error: json?.description ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, configured: true };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : "Erreur réseau Telegram" };
  }
}

/** Vérifie le token auprès de Telegram (getMe) */
export async function verifyBotToken(token: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return { ok: false, error: json?.description ?? "Token invalide" };
    return { ok: true, name: json.result?.username ?? json.result?.first_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}
