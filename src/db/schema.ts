import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/** Statuts d'un signal : ACTIVE -> TP1 -> TP2 -> TP3_HIT, ou SL_HIT / EXPIRED */
export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull().default("GC=F"),
    direction: text("direction").notNull(), // BUY | SELL
    stars: integer("stars").notNull(),
    entry: doublePrecision("entry").notNull(),
    sl: doublePrecision("sl").notNull(),
    tp1: doublePrecision("tp1").notNull(),
    tp2: doublePrecision("tp2").notNull(),
    tp3: doublePrecision("tp3").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    confluences: jsonb("confluences").$type<string[]>().notNull(),
    analysis: jsonb("analysis").$type<Record<string, unknown>>(),
    telegramSent: boolean("telegram_sent").notNull().default(false),
    telegramError: text("telegram_error"),
    resultR: doublePrecision("result_r"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("signals_status_idx").on(t.status), index("signals_created_idx").on(t.createdAt)]
);

/** Journal complet de chaque analyse du moteur */
export const scans = pgTable(
  "scans",
  {
    id: serial("id").primaryKey(),
    mode: text("mode").notNull().default("auto"), // auto | manual
    price: doublePrecision("price").notNull(),
    bias: text("bias").notNull().default("NONE"), // BUY | SELL | NONE
    stars: integer("stars").notNull().default(0),
    signalId: integer("signal_id"),
    analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("scans_created_idx").on(t.createdAt)]
);

/** Réglages persistants (token telegram, chat id, paramètres stratégie) */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
