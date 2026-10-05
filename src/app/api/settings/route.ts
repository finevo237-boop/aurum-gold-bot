import { NextResponse } from "next/server";
import { SETTING_KEYS, getSetting, getStrategyParams, getTelegramConfig, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const mask = (v: string | null) => (v ? "•".repeat(Math.max(0, v.length - 4)) + v.slice(-4) : "");

export async function GET() {
  try {
    const [cfg, params, autoScan, cooldown] = await Promise.all([
      getTelegramConfig(),
      getStrategyParams(),
      getSetting(SETTING_KEYS.AUTO_SCAN),
      getSetting(SETTING_KEYS.COOLDOWN_MIN),
    ]);
    return NextResponse.json({
      telegram: {
        configured: cfg.configured,
        origin: cfg.origin,
        tokenMasked: mask(cfg.token),
        chatId: cfg.chatId ? cfg.chatId : "",
      },
      strategy: {
        minStars: params.minStars,
        cooldownMin: cooldown ?? "45",
        autoScan: autoScan !== "0",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lecture impossible" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      telegramBotToken?: string;
      telegramChatId?: string;
      minStars?: number;
      cooldownMin?: number;
      autoScan?: boolean;
    };
    if (typeof body.telegramBotToken === "string" && body.telegramBotToken.trim()) {
      await setSetting(SETTING_KEYS.TELEGRAM_BOT_TOKEN, body.telegramBotToken.trim());
    }
    if (typeof body.telegramChatId === "string" && body.telegramChatId.trim()) {
      await setSetting(SETTING_KEYS.TELEGRAM_CHAT_ID, body.telegramChatId.trim());
    }
    if (typeof body.minStars === "number") {
      await setSetting(SETTING_KEYS.MIN_STARS, String(Math.min(5, Math.max(3, Math.round(body.minStars)))));
    }
    if (typeof body.cooldownMin === "number") {
      await setSetting(SETTING_KEYS.COOLDOWN_MIN, String(Math.max(5, Math.round(body.cooldownMin))));
    }
    if (typeof body.autoScan === "boolean") {
      await setSetting(SETTING_KEYS.AUTO_SCAN, body.autoScan ? "1" : "0");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enregistrement impossible" },
      { status: 500 }
    );
  }
}
