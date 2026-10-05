import { NextResponse } from "next/server";
import { getPrice } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const info = await getPrice(force);
    return NextResponse.json(info);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Données indisponibles" },
      { status: 502 }
    );
  }
}
