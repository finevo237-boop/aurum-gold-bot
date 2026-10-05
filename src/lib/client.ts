// Helpers client-safe (aucun code serveur importé)
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Erreur ${res.status}`);
  return json as T;
}

export const fmtPrice = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

export const TREND_LABEL: Record<string, string> = {
  BULLISH: "Haussier",
  BEARISH: "Baissier",
  RANGE: "Range",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  TP1: "TP1 atteint",
  TP2: "TP2 atteint",
  TP3_HIT: "TP3 atteint",
  SL_HIT: "SL touché",
  EXPIRED: "Expiré",
};
