import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
});

export const metadata: Metadata = {
  title: "AURUM — Bot de signaux XAU/USD · SMC + ICT + Price Action",
  description:
    "Moteur d'analyse multi-timeframes de l'or (H4 → H1 EMA200 → M15/M5) : CHoCH, Order Blocks, FVG, Fibonacci 0.5–0.68, sweeps de liquidité. Signaux 5★ publiés automatiquement sur Telegram.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${fraunces.variable} ${grotesk.variable} ${jbmono.variable} bg-ink text-stone-100 antialiased`}>
        <div className="bg-scene" />
        <div className="noise" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
