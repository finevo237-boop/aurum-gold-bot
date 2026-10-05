import { NextResponse } from "next/server";
import { formatTestMessage, sendTelegram, verifyBotToken } from "@/lib/telegram";
import { getTelegramConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** POST { action: "verify" | "send", token? } */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; token?: string };
    if (body.action === "verify" && body.token) {
      const v = await verifyBotToken(body.token);
      return NextResponse.json(v);
    }
    // action === "send" : message de test avec la config enregistrée / env
    const cfg = await getTelegramConfig();
    const res = await sendTelegram(formatTestMessage());
    return NextResponse.json({ ...res, origin: cfg.origin });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Test impossible" },
      { status: 500 }
    );
  }
}
