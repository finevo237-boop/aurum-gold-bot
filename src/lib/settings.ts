// Réglages persistants (table settings) avec repli sur les variables d'environnement
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SETTING_KEYS = {
  TELEGRAM_BOT_TOKEN: "telegram_bot_token",
  TELEGRAM_CHAT_ID: "telegram_chat_id",
  MIN_STARS: "min_stars", // nb d'étoiles minimum pour envoyer un signal (défaut 5)
  COOLDOWN_MIN: "cooldown_min", // délai min entre deux signaux même sens
  AUTO_SCAN: "auto_scan", // "1" | "0"
  RR_MODE: "rr_mode",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.MIN_STARS]: "5",
  [SETTING_KEYS.COOLDOWN_MIN]: "45",
  [SETTING_KEYS.AUTO_SCAN]: "1",
};

export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (rows.length) return rows[0].value;
  } catch {
    // table pas encore prête
  }
  return DEFAULTS[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getTelegramConfig(): Promise<{
  token: string | null;
  chatId: string | null;
  configured: boolean;
  origin: "db" | "env" | "none";
}> {
  const dbToken = await getSetting(SETTING_KEYS.TELEGRAM_BOT_TOKEN);
  const dbChat = await getSetting(SETTING_KEYS.TELEGRAM_CHAT_ID);
  if (dbToken && dbChat) return { token: dbToken, chatId: dbChat, configured: true, origin: "db" };
  const envToken = process.env.TELEGRAM_BOT_TOKEN ?? null;
  const envChat = process.env.TELEGRAM_CHAT_ID ?? null;
  if (envToken && envChat) return { token: envToken, chatId: envChat, configured: true, origin: "env" };
  return { token: null, chatId: null, configured: false, origin: "none" };
}

export async function getStrategyParams(): Promise<{
  minStars: number;
  cooldownMin: number;
  autoScan: boolean;
}> {
  const [ms, cd, as] = await Promise.all([
    getSetting(SETTING_KEYS.MIN_STARS),
    getSetting(SETTING_KEYS.COOLDOWN_MIN),
    getSetting(SETTING_KEYS.AUTO_SCAN),
  ]);
  return {
    minStars: Math.min(5, Math.max(3, parseInt(ms ?? "5", 10) || 5)),
    cooldownMin: Math.max(5, parseInt(cd ?? "45", 10) || 45),
    autoScan: as !== "0",
  };
}
