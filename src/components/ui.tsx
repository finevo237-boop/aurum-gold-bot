"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Check, Minus, Star, X } from "lucide-react";
import type { ReactElement } from "react";

export function TrendBadge({ trend, size = "md" }: { trend: string; size?: "sm" | "md" }) {
  const map: Record<string, { label: string; cls: string; icon: ReactElement }> = {
    BULLISH: {
      label: "Haussier",
      cls: "text-bull border-bull/30 bg-bull/10",
      icon: <ArrowUpRight className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
    BEARISH: {
      label: "Baissier",
      cls: "text-bear border-bear/30 bg-bear/10",
      icon: <ArrowDownRight className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
    RANGE: {
      label: "Range",
      cls: "text-gold-300 border-gold-500/30 bg-gold-500/10",
      icon: <Minus className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />,
    },
  };
  const t = map[trend] ?? map.RANGE;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-mono uppercase tracking-widest ${t.cls} ${size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}>
      {t.icon}
      {t.label}
    </span>
  );
}

export function StarsRow({ n, size = 16, animate = true }: { n: number; size?: number; animate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          initial={animate ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.08 * i, type: "spring", stiffness: 300, damping: 18 }}
        >
          <Star
            style={{ width: size, height: size }}
            className={i < n ? "fill-gold-400 text-gold-400 drop-shadow-[0_0_6px_rgba(232,200,95,0.5)]" : "text-stone-700"}
          />
        </motion.span>
      ))}
    </span>
  );
}

export function Panel({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={`panel ${hover ? "panel-hover" : ""} ${className}`}>{children}</div>;
}

export function SectionHead({ kicker, title, right }: { kicker: string; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="kicker">{kicker}</p>
        <h2 className="font-display mt-1.5 text-2xl leading-tight text-stone-100 md:text-[27px]">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function CheckRow({ label, ok, detail, index }: { label: string; ok: boolean; detail: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
        ok ? "border-bull/25 bg-bull/[0.06]" : "border-white/[0.05] bg-white/[0.015]"
      }`}
    >
      <span className={`mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border ${ok ? "border-bull/40 bg-bull/15 text-bull" : "border-stone-700 bg-transparent text-stone-600"}`} style={{ height: 22, width: 22 }}>
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-medium ${ok ? "text-stone-100" : "text-stone-400"}`}>{label}</span>
        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-stone-500" title={detail}>
          {detail}
        </span>
      </span>
    </motion.div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "bull" | "bear" }) {
  const map = {
    neutral: "border-white/10 bg-white/[0.04] text-stone-300",
    gold: "border-gold-500/35 bg-gold-500/10 text-gold-300",
    bull: "border-bull/30 bg-bull/10 text-bull",
    bear: "border-bear/30 bg-bear/10 text-bear",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide ${map[tone]}`}>{children}</span>;
}

export function DirectionPill({ direction, big = false }: { direction: string; big?: boolean }) {
  const buy = direction === "BUY";
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl font-bold tracking-wide ${big ? "px-5 py-2.5 text-lg" : "px-3 py-1.5 text-xs"} ${buy ? "bg-bull/15 text-bull border border-bull/40" : "bg-bear/15 text-bear border border-bear/40"}`}>
      {buy ? <ArrowUpRight className={big ? "h-5 w-5" : "h-3.5 w-3.5"} /> : <ArrowDownRight className={big ? "h-5 w-5" : "h-3.5 w-3.5"} />}
      {buy ? "BUY GOLD" : "SELL GOLD"}
    </span>
  );
}
