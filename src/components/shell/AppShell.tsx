"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChartCandlestick,
  Gauge,
  LayoutDashboard,
  Settings,
  Zap,
} from "lucide-react";
import { api } from "@/lib/client";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyse", label: "Analyse", icon: ChartCandlestick },
  { href: "/signaux", label: "Signaux", icon: Zap },
  { href: "/configuration", label: "Configuration", icon: Settings },
];

function EnginePulse() {
  const [state, setState] = useState<{ running: boolean; lastScanAt: string | null } | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      api<{ engine: { running: boolean; lastScanAt: string | null } }>("/api/status")
        .then((d) => !stop && setState(d.engine))
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
  return (
    <div className="flex items-center gap-2.5">
      <span className={`dot-live inline-block h-2 w-2 rounded-full ${state?.running ? "text-bull bg-bull" : "text-gold-500 bg-gold-500"}`} />
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-stone-400">
        {state?.running ? "Moteur actif" : "Initialisation…"}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r border-line px-5 py-7 md:flex">
        <Link href="/" className="group flex items-center gap-3 px-1">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/40 bg-gradient-to-br from-gold-500/20 to-transparent">
            <Gauge className="h-5 w-5 text-gold-400 transition-transform duration-500 group-hover:rotate-[140deg]" />
          </span>
          <span>
            <span className="block font-display text-xl italic leading-none gold-text">AURUM</span>
            <span className="kicker mt-1 block !text-[9px]">XAU/USD · SMC/ICT</span>
          </span>
        </Link>

        <nav className="mt-12 flex flex-col gap-1.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-gold-500/15 to-transparent text-gold-200"
                    : "text-stone-400 hover:bg-white/[0.03] hover:text-stone-200"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-[55%] w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-gold-300 to-gold-600" />
                )}
                <Icon className={`h-4 w-4 ${active ? "text-gold-400" : "text-stone-500 group-hover:text-stone-300"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-line pt-5">
          <EnginePulse />
          <p className="font-mono text-[9.5px] leading-relaxed tracking-wider text-stone-600">
            H4 → H1 EMA200 → M15/M5
            <br />
            OB · FVG · CHoCH · FIB 0.5–0.68
          </p>
        </div>
      </aside>

      {/* Nav mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-line bg-ink/90 px-2 py-2 backdrop-blur-md md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] ${active ? "text-gold-300" : "text-stone-500"}`}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-9 md:pb-12 md:pt-8">{children}</main>
    </div>
  );
}
